-- Add WooCommerce status and sync fields to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS woocommerce_status TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster WooCommerce order lookups
CREATE INDEX IF NOT EXISTS invoices_woocommerce_order_id_idx ON public.invoices(woocommerce_order_id) WHERE woocommerce_order_id IS NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN public.invoices.woocommerce_status IS 'Current status of the associated WooCommerce order';
COMMENT ON COLUMN public.invoices.last_synced_at IS 'Timestamp of last synchronization with WooCommerce';