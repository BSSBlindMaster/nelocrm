create table if not exists company_goals (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null,
  target_revenue numeric default 0,
  created_at timestamptz default now()
);

create unique index if not exists company_goals_year_month_idx
  on company_goals (year, month);

create table if not exists user_dashboard_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id),
  kpi_key text not null,
  position integer default 0,
  created_at timestamptz default now()
);

create unique index if not exists user_dashboard_pins_user_key_idx
  on user_dashboard_pins (user_id, kpi_key);

create table if not exists marketing_spend (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  month integer not null,
  year integer not null,
  amount numeric default 0,
  location text,
  created_at timestamptz default now()
);

alter table appointments
  add column if not exists sold boolean default false,
  add column if not exists sale_amount numeric default 0,
  add column if not exists assigned_to uuid references app_users(id),
  add column if not exists scheduled_at timestamptz,
  add column if not exists ran boolean default false,
  add column if not exists lead_source text;
