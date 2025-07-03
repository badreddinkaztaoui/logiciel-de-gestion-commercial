-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
    ON public.settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON public.settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON public.settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Create function to create settings table if it doesn't exist
CREATE OR REPLACE FUNCTION public.create_settings_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'settings'
    ) THEN
        -- Create the table
        CREATE TABLE public.settings (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            settings_data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(user_id)
        );

        -- Add RLS policies
        ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

        -- Add policies
        CREATE POLICY "Users can view their own settings"
            ON public.settings FOR SELECT
            USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert their own settings"
            ON public.settings FOR INSERT
            WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update their own settings"
            ON public.settings FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END;
$$;

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_next_document_number(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_next_document_number(UUID, TEXT, BOOLEAN);

-- Function to get next document number atomically
CREATE OR REPLACE FUNCTION public.get_next_document_number(
    p_user_id UUID,
    p_document_type TEXT,
    p_preview BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings JSONB;
    v_numbering JSONB;
    v_current_number INTEGER;
    v_prefix TEXT;
    v_suffix TEXT;
    v_padded_number TEXT;
    v_default_settings JSONB;
    v_formatted_number TEXT;
BEGIN
    -- Verify user is authorized
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Define default settings
    v_default_settings := '{
        "numbering": {
            "INVOICE": {"prefix": "FAC", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"},
            "DELIVERY": {"prefix": "BL", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"},
            "RETURN": {"prefix": "BR", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"},
            "QUOTE": {"prefix": "DEV", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"},
            "SALES_JOURNAL": {"prefix": "JV", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"},
            "PURCHASE_ORDER": {"prefix": "BC", "startNumber": 1, "currentNumber": 1, "suffix": "", "resetPeriod": "yearly"}
        }
    }'::jsonb;

    -- Lock the row for atomic update or insert default settings if not exists
    WITH settings_upsert AS (
        INSERT INTO public.settings (user_id, settings_data)
        VALUES (p_user_id, v_default_settings)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING settings_data
    )
    SELECT COALESCE(
        (SELECT settings_data FROM settings_upsert),
        (SELECT settings_data FROM public.settings WHERE user_id = p_user_id FOR UPDATE)
    ) INTO v_settings;

    -- Get current numbering settings
    v_numbering := v_settings->'numbering'->p_document_type;

    IF v_numbering IS NULL THEN
        -- If document type doesn't exist in settings, add it with defaults
        v_numbering := v_default_settings->'numbering'->p_document_type;

        UPDATE public.settings
        SET settings_data = jsonb_set(
            settings_data,
            ARRAY['numbering', p_document_type],
            v_numbering,
            true
        )
        WHERE user_id = p_user_id;
    END IF;

    v_current_number := (v_numbering->>'currentNumber')::INTEGER;
    v_prefix := v_numbering->>'prefix';
    v_suffix := COALESCE(v_numbering->>'suffix', '');

    -- Format number based on suffix presence
    IF v_suffix = '' THEN
        -- No suffix: use padded number
        v_padded_number := LPAD(v_current_number::TEXT, 6, '0');
        v_formatted_number := v_prefix || '-' || v_padded_number;
    ELSE
        -- With suffix: use plain number
        v_formatted_number := v_prefix || '-' || v_suffix || v_current_number::TEXT;
    END IF;

    -- Only increment the number if not in preview mode
    IF NOT p_preview THEN
        UPDATE public.settings
        SET settings_data = jsonb_set(
            settings_data,
            ARRAY['numbering', p_document_type, 'currentNumber'],
            to_jsonb(v_current_number + 1),
            true
        )
        WHERE user_id = p_user_id;
    END IF;

    RETURN v_formatted_number;
END;
$$;

-- Create function to check and reset document numbering
CREATE OR REPLACE FUNCTION public.check_reset_document_numbering()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_settings RECORD;
    numbering_data JSONB;
    doc_type TEXT;
    doc_settings JSONB;
    reset_period TEXT;
    last_reset TIMESTAMP;
    should_reset BOOLEAN;
BEGIN
    -- Loop through all users' settings
    FOR user_settings IN SELECT * FROM public.settings
    LOOP
        -- Get the numbering settings
        numbering_data := user_settings.settings_data->'numbering';

        -- Loop through each document type
        FOR doc_type IN
            SELECT * FROM jsonb_object_keys(numbering_data)
        LOOP
            -- Get settings for this document type
            doc_settings := numbering_data->doc_type;
            reset_period := doc_settings->>'resetPeriod';

            -- Skip if reset period is 'never'
            CONTINUE WHEN reset_period = 'never';

            -- Get last reset date from settings or use created_at
            last_reset := COALESCE(
                (doc_settings->>'lastReset')::TIMESTAMP,
                user_settings.created_at
            );

            -- Check if we should reset based on period
            should_reset := CASE
                WHEN reset_period = 'yearly' AND
                    (EXTRACT(YEAR FROM NOW()) > EXTRACT(YEAR FROM last_reset)) THEN TRUE
                WHEN reset_period = 'monthly' AND
                    (EXTRACT(YEAR FROM NOW()) > EXTRACT(YEAR FROM last_reset) OR
                    EXTRACT(MONTH FROM NOW()) > EXTRACT(MONTH FROM last_reset)) THEN TRUE
                ELSE FALSE
            END;

            -- Reset if needed
            IF should_reset THEN
                -- Update the settings with new current number and last reset
                UPDATE public.settings
                SET settings_data = jsonb_set(
                    jsonb_set(
                        settings_data,
                        ARRAY['numbering', doc_type, 'currentNumber'],
                        to_jsonb((doc_settings->>'startNumber')::INTEGER),
                        true
                    ),
                    ARRAY['numbering', doc_type, 'lastReset'],
                    to_jsonb(NOW()::TEXT),
                    true
                )
                WHERE id = user_settings.id;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reset_document_numbering TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_settings_table TO authenticated;