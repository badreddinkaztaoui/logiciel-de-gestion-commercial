-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.sales_journal CASCADE;
DROP TABLE IF EXISTS public.delivery_note_items CASCADE;
DROP TABLE IF EXISTS public.delivery_notes CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_sequences CASCADE;
DROP TABLE IF EXISTS public.woocommerce_orders CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.reserve_document_number(text) CASCADE;

-- Create audit log table for tracking changes
CREATE TABLE public.audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    table_name character varying NOT NULL,
    record_id uuid NOT NULL,
    action character varying NOT NULL CHECK (action::text = ANY (ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying]::text[])),
    old_data jsonb,
    new_data jsonb,
    user_id uuid REFERENCES auth.users(id),
    user_email character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

-- Create customers table
CREATE TABLE public.customers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    woocommerce_id integer,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    company character varying,
    email character varying NOT NULL,
    phone character varying,
    address text,
    city character varying,
    postal_code character varying,
    country character varying DEFAULT 'Maroc'::character varying,
    ice character varying,
    notes text,
    billing_data jsonb,
    shipping_data jsonb,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customers_pkey PRIMARY KEY (id),
    UNIQUE (woocommerce_id, user_id)
);

-- Create WooCommerce orders table with pagination support
CREATE TABLE public.woocommerce_orders (
    id integer NOT NULL,
    number character varying NOT NULL,
    status character varying NOT NULL,
    currency character varying NOT NULL DEFAULT 'MAD'::character varying,
    date_created timestamp with time zone NOT NULL,
    date_modified timestamp with time zone,
    total numeric NOT NULL,
    total_tax numeric,
    shipping_total numeric,
    shipping_tax numeric,
    customer_id integer,
    billing jsonb,
    shipping jsonb,
    line_items jsonb,
    tax_lines jsonb,
    order_data jsonb,
    user_id uuid REFERENCES auth.users(id),
    synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT woocommerce_orders_pkey PRIMARY KEY (id, user_id)
);

-- Create invoice sequences for automatic numbering
CREATE SEQUENCE IF NOT EXISTS invoice_sequences_id_seq;

CREATE TABLE public.invoice_sequences (
    id integer NOT NULL DEFAULT nextval('invoice_sequences_id_seq'::regclass),
    document_type character varying NOT NULL UNIQUE,
    prefix character varying NOT NULL DEFAULT ''::character varying,
    current_number integer NOT NULL DEFAULT 1,
    suffix character varying NOT NULL DEFAULT ''::character varying,
    reset_period character varying NOT NULL DEFAULT 'yearly'::character varying,
    last_reset_date date,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoice_sequences_pkey PRIMARY KEY (id)
);

-- Create invoices table (Factures)
CREATE TABLE public.invoices (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    number character varying NOT NULL UNIQUE,
    woocommerce_order_id integer,
    customer_id uuid REFERENCES public.customers(id),
    date date NOT NULL,
    due_date date NOT NULL,
    status character varying NOT NULL CHECK (status::text = ANY (ARRAY['draft'::character varying, 'sent'::character varying, 'paid'::character varying, 'overdue'::character varying, 'cancelled'::character varying]::text[])),
    subtotal numeric NOT NULL DEFAULT 0,
    tax_rate numeric NOT NULL DEFAULT 20.00,
    tax_amount numeric NOT NULL DEFAULT 0,
    total numeric NOT NULL DEFAULT 0,
    currency character varying NOT NULL DEFAULT 'MAD'::character varying,
    notes text,
    payment_method character varying,
    payment_date date,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_pkey PRIMARY KEY (id),
    FOREIGN KEY (woocommerce_order_id, user_id) REFERENCES public.woocommerce_orders(id, user_id)
);

-- Create invoice items table
CREATE TABLE public.invoice_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id),
    woocommerce_product_id integer,
    sku character varying,
    description text NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL,
    total numeric NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoice_items_pkey PRIMARY KEY (id)
);

-- Create delivery notes table (Bons de livraison)
CREATE TABLE public.delivery_notes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    number character varying NOT NULL UNIQUE,
    invoice_id uuid REFERENCES public.invoices(id),
    woocommerce_order_id integer,
    customer_id uuid REFERENCES public.customers(id),
    date date NOT NULL,
    estimated_delivery_date date,
    actual_delivery_date date,
    status character varying NOT NULL CHECK (status::text = ANY (ARRAY['pending'::character varying, 'in_transit'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[])),
    notes text,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_notes_pkey PRIMARY KEY (id),
    FOREIGN KEY (woocommerce_order_id, user_id) REFERENCES public.woocommerce_orders(id, user_id)
);

-- Create delivery note items table
CREATE TABLE public.delivery_note_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id),
    woocommerce_product_id integer,
    description text NOT NULL,
    quantity_ordered numeric NOT NULL,
    quantity_delivered numeric DEFAULT 0,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id)
);

-- Create sales journal table (Journal de vente)
CREATE TABLE public.sales_journal (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    number character varying NOT NULL UNIQUE,
    date date NOT NULL,
    status character varying NOT NULL DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'validated'::character varying]::text[])),
    orders_included integer[] DEFAULT '{}'::integer[],
    lines jsonb NOT NULL DEFAULT '[]'::jsonb,
    totals jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_journal_pkey PRIMARY KEY (id)
);

-- Create indexes for better performance and pagination
CREATE INDEX idx_woocommerce_orders_date_created ON public.woocommerce_orders(date_created DESC);
CREATE INDEX idx_woocommerce_orders_status ON public.woocommerce_orders(status);
CREATE INDEX idx_woocommerce_orders_customer_id ON public.woocommerce_orders(customer_id);
CREATE INDEX idx_woocommerce_orders_user_id ON public.woocommerce_orders(user_id);

CREATE INDEX idx_customers_woocommerce_id ON public.customers(woocommerce_id);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_user_id ON public.customers(user_id);

CREATE INDEX idx_invoices_date ON public.invoices(date DESC);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);

CREATE INDEX idx_delivery_notes_date ON public.delivery_notes(date DESC);
CREATE INDEX idx_delivery_notes_status ON public.delivery_notes(status);
CREATE INDEX idx_delivery_notes_customer_id ON public.delivery_notes(customer_id);
CREATE INDEX idx_delivery_notes_user_id ON public.delivery_notes(user_id);

CREATE INDEX idx_sales_journal_date ON public.sales_journal(date DESC);
CREATE INDEX idx_sales_journal_status ON public.sales_journal(status);
CREATE INDEX idx_sales_journal_user_id ON public.sales_journal(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_journal ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own records" ON public.customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own records" ON public.customers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own records" ON public.customers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own records" ON public.customers FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view their own records" ON public.woocommerce_orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own records" ON public.woocommerce_orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own records" ON public.woocommerce_orders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own records" ON public.woocommerce_orders FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view their own records" ON public.invoices FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own records" ON public.invoices FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own records" ON public.invoices FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own records" ON public.invoices FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view their own records" ON public.delivery_notes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own records" ON public.delivery_notes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own records" ON public.delivery_notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own records" ON public.delivery_notes FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view their own records" ON public.sales_journal FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own records" ON public.sales_journal FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own records" ON public.sales_journal FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own records" ON public.sales_journal FOR DELETE USING (user_id = auth.uid());

-- Add policies for invoice_sequences
CREATE POLICY "Users can view all sequences" ON public.invoice_sequences FOR SELECT USING (true);
CREATE POLICY "Users can update sequences" ON public.invoice_sequences FOR UPDATE USING (true);
CREATE POLICY "Users can insert sequences" ON public.invoice_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete sequences" ON public.invoice_sequences FOR DELETE USING (true);

-- Insert default sequence records
INSERT INTO public.invoice_sequences (document_type, prefix, current_number, suffix, reset_period)
VALUES
    ('INVOICE', 'FAC-', 1, '', 'yearly'),
    ('DELIVERY', 'BL-', 1, '', 'yearly'),
    ('RETURN', 'BR-', 1, '', 'yearly'),
    ('QUOTE', 'DEV-', 1, '', 'yearly'),
    ('SALES_JOURNAL', 'JV-', 1, '', 'yearly'),
    ('PURCHASE_ORDER', 'BC-', 1, '', 'yearly');

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to reserve document numbers
CREATE OR REPLACE FUNCTION public.reserve_document_number(p_document_type text)
RETURNS text AS $$
DECLARE
    v_sequence record;
    v_next_number integer;
    v_number text;
BEGIN
    -- Lock the sequence record for update
    SELECT * INTO v_sequence
    FROM public.invoice_sequences
    WHERE document_type = p_document_type
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document type % not found', p_document_type;
    END IF;

    -- Get next number
    v_next_number := v_sequence.current_number;

    -- Update sequence
    UPDATE public.invoice_sequences
    SET current_number = current_number + 1,
        updated_at = now()
    WHERE document_type = p_document_type;

    -- Format document number
    v_number := v_sequence.prefix || LPAD(v_next_number::text, 6, '0') || v_sequence.suffix;

    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.reserve_document_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- Grant table permissions to authenticated users
GRANT ALL ON public.sales_journal TO authenticated;
GRANT ALL ON public.customers TO authenticated;
GRANT USAGE ON SEQUENCE invoice_sequences_id_seq TO authenticated;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.woocommerce_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.delivery_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.sales_journal
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();