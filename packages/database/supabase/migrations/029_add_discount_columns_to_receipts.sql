-- Add discount columns to receipts table
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0 NOT NULL;
