-- Add location/address columns to the rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'RDC';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Update existing rooms to have default country
UPDATE rooms SET country = 'RDC' WHERE country IS NULL;

-- Create a composite index for location queries
CREATE INDEX IF NOT EXISTS idx_rooms_location ON rooms(city, province, country);