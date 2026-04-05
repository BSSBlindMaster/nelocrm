alter table user_dashboard_pins
  add column if not exists size text default 'small',
  add column if not exists col_span integer default 1,
  add column if not exists position integer default 0;
