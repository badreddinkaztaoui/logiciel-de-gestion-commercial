-- Add unique constraint on date column of sales_journal table
ALTER TABLE public.sales_journal
ADD CONSTRAINT unique_sales_journal_date UNIQUE (date);

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT unique_sales_journal_date ON public.sales_journal
IS 'Ensures only one sales journal can exist per day';