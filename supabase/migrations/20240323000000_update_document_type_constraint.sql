-- Drop existing constraint if it exists
ALTER TABLE document_numbers DROP CONSTRAINT IF EXISTS document_numbers_document_type_check;

-- Add new constraint with correct values
ALTER TABLE document_numbers ADD CONSTRAINT document_numbers_document_type_check
CHECK (document_type IN ('INVOICE', 'SALES_JOURNAL', 'QUOTE', 'DELIVERY', 'RETURN', 'PURCHASE_ORDER'));