-- Create terminals table for SumUp card readers
CREATE TABLE IF NOT EXISTS terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    reader_id TEXT NOT NULL UNIQUE,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'pairing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups by reader_id
CREATE INDEX IF NOT EXISTS idx_terminals_reader_id ON terminals(reader_id);

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS update_terminals_updated_at ON terminals;
CREATE TRIGGER update_terminals_updated_at
    BEFORE UPDATE ON terminals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read terminals
CREATE POLICY "Authenticated users can read terminals" ON terminals
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: authenticated users can insert terminals
CREATE POLICY "Authenticated users can insert terminals" ON terminals
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: authenticated users can delete terminals
CREATE POLICY "Authenticated users can delete terminals" ON terminals
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy: service role has full access
CREATE POLICY "Service role full access" ON terminals
    TO service_role
    USING (true)
    WITH CHECK (true);
