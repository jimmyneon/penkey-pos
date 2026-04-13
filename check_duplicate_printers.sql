-- Check for duplicate printers
SELECT id, name, type, connection_type, ip_address, device_path, is_active, status, last_seen_at
FROM printers
ORDER BY name, created_at;
