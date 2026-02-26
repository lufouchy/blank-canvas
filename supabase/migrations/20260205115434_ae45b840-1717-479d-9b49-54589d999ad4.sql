-- Make the timesheet-documents bucket private to prevent direct URL access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'timesheet-documents';