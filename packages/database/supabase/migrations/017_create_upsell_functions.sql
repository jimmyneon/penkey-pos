-- Create database functions for intelligent upsell suggestions
-- This analyzes receipt_lines to find items frequently purchased together
-- and excludes Gifts/Retail categories from suggestions

-- Function: calculate_item_associations
-- Analyzes historical sales data to find item co-occurrence patterns
CREATE OR REPLACE FUNCTION calculate_item_associations(
  p_org_id UUID,
  p_days_back INTEGER DEFAULT 90,
  p_min_frequency INTEGER DEFAULT 5,
  p_min_confidence NUMERIC DEFAULT 0.2
)
RETURNS TABLE (
  item_a_id UUID,
  item_b_id UUID,
  frequency BIGINT,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;
  
  -- Return item pairs that appear together frequently
  -- Exclude items from Gifts/Retail categories
  RETURN QUERY
  WITH item_pairs AS (
    -- Find all pairs of items that appear in the same receipt
    SELECT
      rl1.item_id AS item_a_id,
      rl2.item_id AS item_b_id,
      COUNT(DISTINCT rl1.receipt_id) AS frequency
    FROM receipt_lines rl1
    INNER JOIN receipt_lines rl2 
      ON rl1.receipt_id = rl2.receipt_id 
      AND rl1.item_id < rl2.item_id  -- Avoid duplicates (A,B and B,A)
    INNER JOIN receipts r ON rl1.receipt_id = r.id
    INNER JOIN items i1 ON rl1.item_id = i1.id
    INNER JOIN items i2 ON rl2.item_id = i2.id
    INNER JOIN categories c1 ON i1.category_id = c1.id
    INNER JOIN categories c2 ON i2.category_id = c2.id
    WHERE 
      r.org_id = p_org_id
      AND r.created_at >= v_cutoff_date
      AND r.status NOT IN ('fully_refunded', 'voided')
      AND i1.is_active = true
      AND i2.is_active = true
      -- Exclude Gifts/Retail categories
      AND LOWER(c1.name) NOT LIKE '%gift%'
      AND LOWER(c1.name) NOT LIKE '%retail%'
      AND LOWER(c2.name) NOT LIKE '%gift%'
      AND LOWER(c2.name) NOT LIKE '%retail%'
    GROUP BY rl1.item_id, rl2.item_id
    HAVING COUNT(DISTINCT rl1.receipt_id) >= p_min_frequency
  ),
  item_totals AS (
    -- Count total receipts each item appears in
    SELECT
      item_id,
      COUNT(DISTINCT receipt_id) AS total_receipts
    FROM receipt_lines rl
    INNER JOIN receipts r ON rl.receipt_id = r.id
    INNER JOIN items i ON rl.item_id = i.id
    INNER JOIN categories c ON i.category_id = c.id
    WHERE 
      r.org_id = p_org_id
      AND r.created_at >= v_cutoff_date
      AND r.status NOT IN ('fully_refunded', 'voided')
      AND i.is_active = true
      AND LOWER(c.name) NOT LIKE '%gift%'
      AND LOWER(c.name) NOT LIKE '%retail%'
    GROUP BY item_id
  )
  SELECT
    ip.item_a_id,
    ip.item_b_id,
    ip.frequency,
    -- Confidence = how often B appears when A appears
    CASE 
      WHEN it_a.total_receipts > 0 THEN 
        (ip.frequency::NUMERIC / it_a.total_receipts)
      ELSE 0
    END AS confidence
  FROM item_pairs ip
  INNER JOIN item_totals it_a ON ip.item_a_id = it_a.item_id
  WHERE 
    -- Filter by minimum confidence
    (ip.frequency::NUMERIC / it_a.total_receipts) >= p_min_confidence
  ORDER BY ip.frequency DESC, confidence DESC;
END;
$$;

-- Function: get_frequently_bought_together
-- Returns items frequently bought together with a specific item
CREATE OR REPLACE FUNCTION get_frequently_bought_together(
  p_org_id UUID,
  p_item_id UUID,
  p_days_back INTEGER DEFAULT 90,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  suggested_item_id UUID,
  frequency BIGINT,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use calculate_item_associations and filter for the specific item
  RETURN QUERY
  SELECT 
    item_b_id AS suggested_item_id,
    frequency,
    confidence
  FROM calculate_item_associations(
    p_org_id := p_org_id,
    p_days_back := p_days_back,
    p_min_frequency := 5,
    p_min_confidence := 0.2
  )
  WHERE item_a_id = p_item_id
  ORDER BY frequency DESC, confidence DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_item_associations TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_item_associations TO service_role;
GRANT EXECUTE ON FUNCTION get_frequently_bought_together TO authenticated;
GRANT EXECUTE ON FUNCTION get_frequently_bought_together TO service_role;

-- Add comments
COMMENT ON FUNCTION calculate_item_associations IS 'Analyzes receipt_lines to find items frequently purchased together, excluding Gifts/Retail categories. Returns item pairs with frequency and confidence scores.';
COMMENT ON FUNCTION get_frequently_bought_together IS 'Returns top N items frequently bought together with a specific item, using the calculate_item_associations function.';
