-- Create storage bucket for voucher template background images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voucher-templates',
  'voucher-templates',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their org's folder
CREATE POLICY "Users can upload voucher templates" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voucher-templates');

-- Allow public read access for voucher template images
CREATE POLICY "Public can read voucher templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'voucher-templates');

-- Allow users to delete their own voucher templates
CREATE POLICY "Users can delete voucher templates" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voucher-templates');
