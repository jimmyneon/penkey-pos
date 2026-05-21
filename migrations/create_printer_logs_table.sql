-- Create printer_logs table for remote log monitoring
CREATE TABLE IF NOT EXISTS printer_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_printer_logs_printer_id ON printer_logs(printer_id);
CREATE INDEX idx_printer_logs_timestamp ON printer_logs(timestamp DESC);
CREATE INDEX idx_printer_logs_level ON printer_logs(level);
CREATE INDEX idx_printer_logs_printer_timestamp ON printer_logs(printer_id, timestamp DESC);

-- Enable RLS
ALTER TABLE printer_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for printers in their org
CREATE POLICY "Users can view logs for their org's printers"
  ON printer_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM printers p
      WHERE p.id = printer_logs.printer_id
      AND p.org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert logs"
  ON printer_logs
  FOR INSERT
  WITH CHECK (true);

-- Auto-cleanup: Delete logs older than 30 days
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_printer_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM printer_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- If pg_cron is not available, run this manually or via a cron job
-- SELECT cron.schedule('cleanup-printer-logs', '0 2 * * *', 'SELECT cleanup_old_printer_logs()');

COMMENT ON TABLE printer_logs IS 'Remote logging for print servers - stores logs from Raspberry Pi devices';
COMMENT ON COLUMN printer_logs.level IS 'Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL';
COMMENT ON COLUMN printer_logs.context IS 'Additional context data (job_id, error details, etc.)';
