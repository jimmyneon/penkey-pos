-- Fix print_jobs table schema to match print server expectations
-- Add missing columns that the Python code expects

-- Add error_message column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- Add attempts column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'attempts'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add max_attempts column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'max_attempts'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist (for tracking when job was last updated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;
