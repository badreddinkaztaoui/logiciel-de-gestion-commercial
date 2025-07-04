-- Create document_numbers table
create table if not exists public.document_numbers (
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

-- Create indexes for faster lookups
create index if not exists document_numbers_type_year_idx on document_numbers(document_type, year);
create index if not exists document_numbers_order_id_idx on document_numbers(order_id) where order_id is not null;
create index if not exists document_numbers_journal_id_idx on document_numbers(journal_id) where journal_id is not null;

-- Enable Row Level Security
alter table public.document_numbers enable row level security;

-- Create RPC function to drop the table
create or replace function drop_document_numbers_table()
returns void
language plpgsql
security definer
as $$
begin
  -- Drop the table if it exists
  drop table if exists public.document_numbers cascade;
end;
$$;

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
    create index if not exists document_numbers_type_year_idx on document_numbers(document_type, year);
    create index if not exists document_numbers_order_id_idx on document_numbers(order_id) where order_id is not null;
    create index if not exists document_numbers_journal_id_idx on document_numbers(journal_id) where journal_id is not null;

    -- Enable RLS
    alter table public.document_numbers enable row level security;
  end if;

  -- Drop existing policies if they exist
  drop policy if exists "Authenticated users can view document numbers" on public.document_numbers;
  drop policy if exists "Authenticated users can insert document numbers" on public.document_numbers;
  drop policy if exists "Authenticated users can update document numbers" on public.document_numbers;

  -- Create policies
  create policy "Authenticated users can view document numbers"
    on public.document_numbers for select
    using (auth.role() = 'authenticated');

  create policy "Authenticated users can insert document numbers"
    on public.document_numbers for insert
    with check (auth.role() = 'authenticated');

  create policy "Authenticated users can update document numbers"
    on public.document_numbers for update
    using (auth.role() = 'authenticated');
end;
$$;

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all on public.document_numbers to authenticated;
grant execute on function public.create_document_numbers_table to authenticated;
grant execute on function public.drop_document_numbers_table to authenticated;

-- Initialize the table and policies
select create_document_numbers_table();