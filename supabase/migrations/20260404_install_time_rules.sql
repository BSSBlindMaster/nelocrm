-- Install time rules for auto-calculating job durations
create table if not exists install_time_rules (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  minutes_per_unit integer not null default 30,
  notes text,
  created_at timestamptz default now()
);

-- Add columns to jobs table for optimization tracking
alter table jobs
  add column if not exists duration_auto_calculated boolean default false,
  add column if not exists drive_time_minutes integer;

-- Seed default install time rules
insert into install_time_rules (product_type, minutes_per_unit, notes) values
  ('Shutters', 45, 'Per window — includes mounting and adjustment'),
  ('Blinds', 25, 'Per window — standard install'),
  ('Shades', 30, 'Per window — includes chain/cord setup'),
  ('Duette / Honeycomb', 35, 'Per window — precision fit required'),
  ('Roller Shades', 20, 'Per window — bracket and tension'),
  ('Curtains / Drapes', 40, 'Per window — rod install plus hanging')
on conflict do nothing;
