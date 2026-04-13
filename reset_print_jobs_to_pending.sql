-- Reset all print jobs to pending status
UPDATE print_jobs SET status = 'pending';
