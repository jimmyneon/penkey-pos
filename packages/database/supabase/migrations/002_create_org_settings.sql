-- Create org_settings table for organization-level settings
CREATE TABLE IF NOT EXISTS org_settings (
    org_id UUID PRIMARY KEY,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id ON org_settings(org_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_org_settings_updated_at
    BEFORE UPDATE ON org_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

-- Policy: users can read org_settings for their own org
CREATE POLICY "Users can read own org settings" ON org_settings
    FOR SELECT
    TO authenticated
    USING (
        org_id IN (
            SELECT org_id FROM org_members WHERE user_id = auth.uid()
        )
    );

-- Policy: service role has full access
CREATE POLICY "Service role full access" ON org_settings
    TO service_role
    USING (true)
    WITH CHECK (true);
