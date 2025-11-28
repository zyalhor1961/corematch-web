-- Enable the vector extension
create extension if not exists vector;

-- Update invoices table to include raw_azure_data
alter table invoices 
add column if not exists raw_azure_data jsonb;

-- Ensure other columns exist (idempotent checks)
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'invoice_number') then
        alter table invoices add column invoice_number text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'vendor_name') then
        alter table invoices add column vendor_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'invoice_date') then
        alter table invoices add column invoice_date date;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'total_amount') then
        alter table invoices add column total_amount numeric;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'currency') then
        alter table invoices add column currency text;
    end if;
end $$;

-- Create invoice_chunks table for RAG
create table if not exists invoice_chunks (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid references invoices(id) on delete cascade,
    content text not null,
    chunk_type text not null, -- 'summary', 'table', 'kv_pair', etc.
    page_number integer,
    embedding vector(1536),
    created_at timestamptz default now()
);

-- Add HNSW index for fast vector search
create index if not exists invoice_chunks_embedding_idx 
on invoice_chunks 
using hnsw (embedding vector_cosine_ops);

-- Enable RLS on invoice_chunks (inheriting from invoices usually, but let's set basic policy)
alter table invoice_chunks enable row level security;

-- Policy: Allow read access to authenticated users (adjust as needed for multi-tenant)
create policy "Allow read access to authenticated users"
on invoice_chunks for select
to authenticated
using (true);

-- Policy: Allow insert/update/delete to service_role only (or authenticated if needed)
create policy "Allow all access to service_role"
on invoice_chunks for all
to service_role
using (true)
with check (true);
