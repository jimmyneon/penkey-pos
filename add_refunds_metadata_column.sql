-- Add metadata column to refunds table for SumUp refund confirmation data
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS metadata jsonb;
