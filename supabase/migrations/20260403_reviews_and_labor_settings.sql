alter table business_settings
  add column if not exists review_url text,
  add column if not exists review_platform text,
  add column if not exists review_sms_message text,
  add column if not exists default_labor_rate numeric default 30;

alter table app_users
  add column if not exists hourly_rate numeric,
  add column if not exists hourly_rate_override boolean default false;
