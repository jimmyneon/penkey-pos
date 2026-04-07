-- Create printers table for managing Epson TM-series and other printers
CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('epson', 'star', 'escpos')),
    connection_type TEXT NOT NULL CHECK (connection_type IN ('lan', 'usb', 'bluetooth', 'cups')),
    ip_address TEXT,
    port INTEGER DEFAULT 8008,
    device_path TEXT, -- For USB printers like /dev/usb/lp0
    cups_printer_name TEXT, -- For CUPS printer name
    paper_width INTEGER NOT NULL CHECK (paper_width IN (58, 80)), -- mm
    
    -- Location info
    location TEXT,
    register_id UUID REFERENCES registers(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'printing')),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    
    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT printer_connection_check CHECK (
        (connection_type = 'lan' AND ip_address IS NOT NULL) OR
        (connection_type = 'usb' AND device_path IS NOT NULL) OR
        (connection_type = 'cups' AND cups_printer_name IS NOT NULL) OR
        (connection_type = 'bluetooth')
    )
);

-- Create print_jobs table for the print queue
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    
    -- Job content
    job_type TEXT NOT NULL CHECK (job_type IN ('receipt', 'report', 'test', 'label')),
    template TEXT NOT NULL,
    data JSONB NOT NULL, -- Receipt data, report data, etc.
    
    -- Priority and status
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'completed', 'failed', 'cancelled')),
    
    -- Receipt reference (optional)
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    
    -- Processing info
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    printed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_print_jobs_printer_id ON print_jobs(printer_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_printer_status ON print_jobs(printer_id, status);
CREATE INDEX idx_print_jobs_created_at ON print_jobs(created_at);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_register ON printers(register_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_printers_updated_at
    BEFORE UPDATE ON printers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_print_jobs_updated_at
    BEFORE UPDATE ON print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for printers
CREATE POLICY "Enable read access for authenticated users" ON printers
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON printers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON printers
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON printers
    FOR DELETE
    TO authenticated
    USING (true);

-- Create policies for print_jobs
CREATE POLICY "Enable read access for authenticated users" ON print_jobs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON print_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON print_jobs
    FOR UPDATE
    TO authenticated
    USING (true);
