-- Drop existing policies from sales_journal
DROP POLICY IF EXISTS "Users can view their own records" ON sales_journal;
DROP POLICY IF EXISTS "Users can insert their own records" ON sales_journal;
DROP POLICY IF EXISTS "Users can update their own records" ON sales_journal;
DROP POLICY IF EXISTS "Users can delete their own records" ON sales_journal;

-- Drop existing policies from invoices
DROP POLICY IF EXISTS "Users can view their own records" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own records" ON invoices;
DROP POLICY IF EXISTS "Users can update their own records" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own records" ON invoices;

-- Remove user_id constraints from sales_journal table
ALTER TABLE sales_journal
DROP COLUMN IF EXISTS user_id;

-- Remove user_id constraints from invoices table
ALTER TABLE invoices
DROP COLUMN IF EXISTS user_id;

-- Enable RLS on tables
ALTER TABLE sales_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to allow access to all users
CREATE POLICY "Allow all authenticated users to read sales_journal"
ON sales_journal FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to insert sales_journal"
ON sales_journal FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update sales_journal"
ON sales_journal FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to read invoices"
ON invoices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to insert invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update invoices"
ON invoices FOR UPDATE
TO authenticated
USING (true);