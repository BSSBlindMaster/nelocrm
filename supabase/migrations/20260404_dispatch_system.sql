create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  assigned_to uuid references app_users(id) on delete set null,
  installer_id uuid references app_users(id) on delete set null,
  job_type text default 'Install',
  status text default 'scheduled',
  scheduled_at timestamptz,
  duration_minutes integer default 90,
  address text,
  gate_code text,
  notes text,
  lat numeric,
  lng numeric,
  issue_notes text,
  clock_in timestamptz,
  clock_out timestamptz,
  labor_minutes integer,
  created_at timestamptz default now()
);

alter table jobs
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists customer_id uuid references customers(id) on delete set null,
  add column if not exists assigned_to uuid references app_users(id) on delete set null,
  add column if not exists job_type text default 'Install',
  add column if not exists status text default 'scheduled',
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_minutes integer default 90,
  add column if not exists address text,
  add column if not exists gate_code text,
  add column if not exists notes text,
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists issue_notes text;

create table if not exists service_tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  quote_line_id uuid references quote_lines(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  description text,
  resolution_notes text,
  status text default 'open',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz default now()
);

insert into jobs (
  customer_id,
  assigned_to,
  installer_id,
  job_type,
  status,
  scheduled_at,
  duration_minutes,
  address,
  lat,
  lng,
  notes
)
select *
from (
  with installers as (
    select au.id, row_number() over (order by au.first_name nulls last, au.last_name nulls last, au.id) as rn
    from app_users au
    left join roles r on r.id = au.role_id
    where au.active = true and r.name = 'Installer'
  ),
  customers_ranked as (
    select c.id, row_number() over (order by c.created_at desc nulls last, c.id) as rn
    from customers c
  )
  select
    (select id from customers_ranked where rn = 1) as customer_id,
    (select id from installers where rn = 1) as assigned_to,
    (select id from installers where rn = 1) as installer_id,
    'Install'::text,
    'scheduled'::text,
    date_trunc('day', now()) + interval '8 hours',
    90,
    '2150 E Brown Rd, Mesa, AZ 85213'::text,
    33.4367::numeric,
    -111.7857::numeric,
    'Front entry install'::text
  union all
  select
    (select id from customers_ranked where rn = 2),
    (select id from installers where rn = 2),
    (select id from installers where rn = 2),
    'Repair',
    'in_progress',
    date_trunc('day', now()) + interval '9 hours 30 minutes',
    60,
    '1830 S Val Vista Dr, Mesa, AZ 85204',
    33.3812,
    -111.7565,
    'Clutch replacement'
  union all
  select
    (select id from customers_ranked where rn = 3),
    (select id from installers where rn = 1),
    (select id from installers where rn = 1),
    'Measure',
    'scheduled',
    date_trunc('day', now()) + interval '11 hours',
    90,
    '3440 E Baseline Rd, Mesa, AZ 85204',
    33.3788,
    -111.7579,
    'Measure for new shutters'
  union all
  select
    (select id from customers_ranked where rn = 4),
    null,
    null,
    'Service',
    'scheduled',
    date_trunc('day', now()) + interval '13 hours',
    90,
    '6555 E Southern Ave, Mesa, AZ 85206',
    33.3939,
    -111.6890,
    'Unassigned service call'
  union all
  select
    (select id from customers_ranked where rn = 5),
    (select id from installers where rn = 2),
    (select id from installers where rn = 2),
    'Install',
    'complete',
    date_trunc('day', now()) + interval '15 hours',
    120,
    '9233 E Broadway Rd, Mesa, AZ 85208',
    33.4057,
    -111.6324,
    'Completed motorized install'
) sample_rows
where not exists (
  select 1
  from jobs
  where scheduled_at >= date_trunc('day', now())
    and scheduled_at < date_trunc('day', now()) + interval '1 day'
);
