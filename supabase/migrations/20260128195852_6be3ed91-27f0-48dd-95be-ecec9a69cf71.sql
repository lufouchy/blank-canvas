-- Add new position values to admin_position enum
ALTER TYPE admin_position ADD VALUE IF NOT EXISTS 'socio';
ALTER TYPE admin_position ADD VALUE IF NOT EXISTS 'outro';