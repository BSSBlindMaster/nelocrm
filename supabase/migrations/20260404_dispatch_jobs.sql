-- Dispatch jobs table
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  project_id uuid references projects(id),
  assigned_to uuid references app_users(id),
  job_type text not null default 'Install',
  status text not null default 'scheduled',
  location text,
  address text,
  gate_code text,
  lat double precision,
  lng double precision,
  scheduled_at timestamptz,
  duration_minutes integer default 90,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for date-based queries
create index if not exists jobs_scheduled_at_idx on jobs (scheduled_at);
create index if not exists jobs_assigned_to_idx on jobs (assigned_to);
create index if not exists jobs_status_idx on jobs (status);
