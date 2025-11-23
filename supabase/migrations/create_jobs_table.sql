-- CoreMatch Brain: Jobs Table
-- Drop existing table if it exists (clean slate)
drop table if exists public.jobs cascade;

-- Create the jobs table
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  invoice_id text not null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  result text,
  logs text[]
);

-- Create indexes
create index jobs_invoice_id_idx on public.jobs(invoice_id);
create index jobs_status_idx on public.jobs(status);
create index jobs_created_at_idx on public.jobs(created_at desc);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach trigger to jobs table
create trigger set_updated_at
  before update on public.jobs
  for each row
  execute function public.handle_updated_at();

-- Enable Row Level Security
alter table public.jobs enable row level security;

-- Policy: Authenticated users can view jobs
create policy "Users can view jobs"
  on public.jobs
  for select
  using (auth.uid() is not null);

-- Policy: Service role can do everything
create policy "Service role can manage all jobs"
  on public.jobs
  for all
  using (auth.role() = 'service_role');

-- Enable Realtime
alter publication supabase_realtime add table jobs;
