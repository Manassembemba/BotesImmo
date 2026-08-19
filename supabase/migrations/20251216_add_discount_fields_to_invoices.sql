-- Add discount fields to the invoices table

-- Add discount amount column (fixed amount discount)
ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;

-- Add discount percentage column
ALTER TABLE invoices ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Add net total column (total after applying discounts)
ALTER TABLE invoices ADD COLUMN net_total DECIMAL(10,2);

-- Update net_total for existing records based on current total
-- This will be recalculated in the application logic after the migration
UPDATE invoices SET net_total = total WHERE net_total IS NULL OR net_total = 0;

-- Add a trigger to update the updated_at column (reuse the previous function if it exists)
-- Otherwise, recreate it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE 'plpgsql';
  END IF;
END $$;

-- Create or update the trigger to update the updated_at column
CREATE OR REPLACE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();