-- Add NOT NULL constraint to number column
ALTER TABLE public.invoices
ALTER COLUMN number SET NOT NULL;

-- Add UNIQUE constraint to number column
ALTER TABLE public.invoices
ADD CONSTRAINT unique_invoice_number UNIQUE (number);

-- Add comment explaining the constraints
COMMENT ON CONSTRAINT unique_invoice_number ON public.invoices
IS 'Ensures each invoice has a unique number';