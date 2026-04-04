alter table business_settings
  add column if not exists terms_and_conditions text;

create table if not exists quote_signatures (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade,
  customer_name text not null,
  signature_data text not null,
  agreed_to_terms boolean default false,
  agreed_to_disclaimer boolean default false,
  ip_address text,
  signed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists job_number_sequence (
  year integer primary key,
  last_sequence integer default 0
);

CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT := TO_CHAR(NOW(), 'YY');
  current_year_int INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  next_seq INTEGER;
BEGIN
  INSERT INTO job_number_sequence (year, last_sequence)
  VALUES (current_year_int, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_sequence = job_number_sequence.last_sequence + 1
  RETURNING last_sequence INTO next_seq;

  NEW.job_number := 'PO' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
