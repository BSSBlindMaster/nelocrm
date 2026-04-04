-- Commission rate on app_users
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.08;

-- Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES app_users(id),
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.08,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  payment_part INTEGER DEFAULT 1,
  payment_label TEXT DEFAULT 'Sale commission',
  status TEXT NOT NULL DEFAULT 'pending_sale',
  earned_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  approved_by UUID REFERENCES app_users(id),
  approved_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  quickbooks_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commissions_project_id_idx ON commissions (project_id);
CREATE INDEX IF NOT EXISTS commissions_user_id_idx ON commissions (user_id);
CREATE INDEX IF NOT EXISTS commissions_status_idx ON commissions (status);

-- Commission settings table
CREATE TABLE IF NOT EXISTS commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_on_install BOOLEAN DEFAULT true,
  split_percentage NUMERIC DEFAULT 0.50,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default commission settings
INSERT INTO commission_settings (split_on_install, split_percentage)
VALUES (true, 0.50)
ON CONFLICT DO NOTHING;
