create table if not exists rep_availability (
  id uuid primary key default gen_random_uuid(),
  rep_user_id uuid references app_users(id),
  date date not null,
  slot text not null,
  location text,
  created_at timestamptz default now()
);

create table if not exists availability_submissions (
  id uuid primary key default gen_random_uuid(),
  rep_user_id uuid references app_users(id),
  month_start date not null,
  slot_count integer default 0,
  submitted_at timestamptz default now()
);

create unique index if not exists availability_submissions_rep_month_idx
  on availability_submissions (rep_user_id, month_start);

create table if not exists appointment_slots (
  id uuid primary key default gen_random_uuid(),
  rep_user_id uuid references app_users(id),
  date date not null,
  slot text not null,
  location text,
  status text default 'open',
  appointment_id uuid,
  created_at timestamptz default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  rep_user_id uuid references app_users(id),
  date date not null,
  slot text not null,
  location text,
  interested_in text,
  notes text,
  address text,
  status text default 'booked',
  created_at timestamptz default now()
);

alter table projects
  add column if not exists assigned_installer_id uuid references app_users(id),
  add column if not exists scheduled_at timestamptz,
  add column if not exists appointment_id uuid references appointments(id);
