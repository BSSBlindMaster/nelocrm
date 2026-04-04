-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Manufacturers
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price grid codes
CREATE TABLE price_grid_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID REFERENCES manufacturers(id),
  code TEXT UNIQUE NOT NULL,
  description TEXT
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID REFERENCES manufacturers(id),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Fabrics
CREATE TABLE fabrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  fabric_code TEXT NOT NULL,
  pleat_size TEXT,
  opacity TEXT,
  price_grid_code TEXT REFERENCES price_grid_codes(code)
);

-- Lift options
CREATE TABLE lift_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  surcharge_type TEXT DEFAULT 'flat',
  surcharge_value NUMERIC DEFAULT 0
);

-- Design options
CREATE TABLE design_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  surcharge NUMERIC DEFAULT 0
);

-- Price grids
CREATE TABLE price_grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_grid_code TEXT REFERENCES price_grid_codes(code),
  width_to NUMERIC NOT NULL,
  height_to NUMERIC NOT NULL,
  msrp_price NUMERIC NOT NULL
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  type TEXT DEFAULT 'customer',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  status TEXT DEFAULT 'pending',
  subtotal NUMERIC DEFAULT 0,
  shipping NUMERIC DEFAULT 0,
  installation NUMERIC DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote lines
CREATE TABLE quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id),
  line_number INTEGER,
  room TEXT,
  manufacturer_id UUID REFERENCES manufacturers(id),
  product_id UUID REFERENCES products(id),
  fabric_id UUID REFERENCES fabrics(id),
  lift_option_id UUID REFERENCES lift_options(id),
  design_options JSONB,
  mount_type TEXT,
  width_whole INTEGER,
  width_fraction TEXT,
  height_whole INTEGER,
  height_fraction TEXT,
  quantity INTEGER DEFAULT 1,
  msrp_base NUMERIC,
  surcharges_total NUMERIC,
  msrp_total NUMERIC,
  cost_factor NUMERIC,
  cost_price NUMERIC,
  margin NUMERIC,
  sell_price NUMERIC,
  line_total NUMERIC,
  notes TEXT
);

-- Business settings
CREATE TABLE business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT,
  primary_color TEXT DEFAULT '#FF4900',
  sidebar_color TEXT DEFAULT '#1C1C1C',
  tax_rate NUMERIC DEFAULT 0.0875,
  default_shipping NUMERIC DEFAULT 300,
  default_installation NUMERIC DEFAULT 0,
  terms_and_conditions TEXT
);

-- Pricing settings
CREATE TABLE pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID REFERENCES manufacturers(id),
  cost_factor NUMERIC NOT NULL,
  default_margin NUMERIC NOT NULL,
  minimum_margin NUMERIC NOT NULL
);

-- Pricing function
CREATE OR REPLACE FUNCTION calculate_line_price(
  p_fabric_code TEXT,
  p_width_inches NUMERIC,
  p_height_inches NUMERIC,
  p_lift_surcharge NUMERIC,
  p_design_surcharge NUMERIC,
  p_cost_factor NUMERIC,
  p_margin NUMERIC
)
RETURNS TABLE (
  msrp_base NUMERIC,
  surcharges_total NUMERIC,
  msrp_total NUMERIC,
  cost_price NUMERIC,
  sell_price NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_grid_code TEXT;
  v_msrp_base NUMERIC;
  v_surcharges NUMERIC;
  v_msrp_total NUMERIC;
  v_cost NUMERIC;
  v_sell NUMERIC;
BEGIN
  -- Step 1: get price grid code from fabric code
  SELECT price_grid_code INTO v_grid_code
  FROM fabrics
  WHERE fabric_code = p_fabric_code
  LIMIT 1;

  -- Step 2: find base price from grid
  SELECT pg.msrp_price INTO v_msrp_base
  FROM price_grids pg
  WHERE pg.price_grid_code = v_grid_code
    AND pg.width_to >= p_width_inches
    AND pg.height_to >= p_height_inches
  ORDER BY pg.width_to ASC, pg.height_to ASC
  LIMIT 1;

  -- Step 3: add surcharges
  v_surcharges := COALESCE(p_lift_surcharge, 0) + COALESCE(p_design_surcharge, 0);
  v_msrp_total := v_msrp_base + v_surcharges;

  -- Step 4: apply cost factor
  v_cost := v_msrp_total * p_cost_factor;

  -- Step 5: apply margin (true profit margin formula)
  v_sell := v_cost / (1 - p_margin);

  RETURN QUERY SELECT v_msrp_base, v_surcharges, v_msrp_total, v_cost, v_sell;
END;
$$;

-- Job number sequence
CREATE TABLE IF NOT EXISTS job_number_sequence (
  year INTEGER PRIMARY KEY,
  last_sequence INTEGER DEFAULT 0
);

-- Job number trigger function
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
