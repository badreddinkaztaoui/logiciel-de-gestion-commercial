-- Add customer_data column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_data JSONB;

-- Add items column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Migrate existing customer data
UPDATE public.invoices
SET customer_data = jsonb_build_object(
  'name', c.first_name || ' ' || c.last_name,
  'email', c.email,
  'company', c.company,
  'address', c.address,
  'city', c.city,
  'postalCode', c.postal_code,
  'country', c.country
)
FROM public.customers c
WHERE invoices.customer_id = c.id;

-- Migrate existing invoice items
UPDATE public.invoices i
SET items = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ii.id,
      'description', ii.description,
      'quantity', ii.quantity,
      'unitPrice', ii.unit_price,
      'total', ii.total,
      'productId', ii.woocommerce_product_id,
      'sku', ii.sku,
      'taxRate', 20,
      'taxAmount', (ii.total * 0.2)
    )
  )
  FROM public.invoice_items ii
  WHERE ii.invoice_id = i.id
);

-- Make customer_id nullable since we'll store customer data in customer_data
ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their own records" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own records" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own records" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own records" ON public.invoices;

-- Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own records"
ON public.invoices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own records"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own records"
ON public.invoices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own records"
ON public.invoices FOR DELETE
USING (auth.uid() = user_id);