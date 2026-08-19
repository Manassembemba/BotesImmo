-- Add location_id column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Update existing records if needed (for initial values)
-- All existing rooms will have NULL as location_id initially