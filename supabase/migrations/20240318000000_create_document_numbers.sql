-- Create document_numbers table
create table if not exists document_numbers (
  id uuid primary key,
  document_type text not null check (document_type in ('INVOICE', 'SALES_JOURNAL')),
  number text not null,
  year integer not null,
  sequence integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  order_id bigint,
  journal_id uuid,
  unique(document_type, year, sequence),
  unique(number)
);

-- Create index for faster lookups
create index if not exists document_numbers_type_year_idx on document_numbers(document_type, year);
create index if not exists document_numbers_order_id_idx on document_numbers(order_id) where order_id is not null;
create index if not exists document_numbers_journal_id_idx on document_numbers(journal_id) where journal_id is not null;

-- Create RPC function to create the table if it doesn't exist
create or replace function create_document_numbers_table()
returns void
language plpgsql
security definer
as $$
begin
  -- Check if table exists
  if not exists (select from pg_tables where schemaname = 'public' and tablename = 'document_numbers') then
    -- Create the table
    create table public.document_numbers (
      id uuid primary key,
      document_type text not null check (document_type in ('INVOICE', 'SALES_JOURNAL')),
      number text not null,
      year integer not null,
      sequence integer not null,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      order_id bigint,
      journal_id uuid,
      unique(document_type, year, sequence),
      unique(number)
    );

    -- Create indexes
    create index document_numbers_type_year_idx on document_numbers(document_type, year);
    create index document_numbers_order_id_idx on document_numbers(order_id) where order_id is not null;
    create index document_numbers_journal_id_idx on document_numbers(journal_id) where journal_id is not null;
  end if;
end;
$$;