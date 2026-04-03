insert into manufacturers (name, active)
values ('Hunter Douglas', true)
on conflict do nothing;

insert into products (manufacturer_id, name, active)
select m.id, 'Duette® Honeycomb Shades', true
from manufacturers m
where m.name = 'Hunter Douglas'
on conflict do nothing;

insert into price_grid_codes (manufacturer_id, code, description)
select m.id, v.code, v.description
from manufacturers m
cross join (
  values
    ('DU-LF1', 'Light Filtering Entry'),
    ('DU-RD1', 'Room Darkening Entry'),
    ('DU-LF2', 'Light Filtering Mid'),
    ('DU-RD2', 'Room Darkening Mid'),
    ('DU-LF3', 'Sheer Mid'),
    ('DU-RD3', 'Room Darkening Upper Mid'),
    ('DU-LF4', 'Light Filtering Premium'),
    ('DU-RD4', 'Room Darkening Premium'),
    ('DU-LF5', 'Sheer Premium'),
    ('DU-RD5', 'Room Darkening Luxury'),
    ('DU-LF6', 'Light Filtering Luxury'),
    ('DU-RD6', 'Room Darkening Luxury')
) as v(code, description)
where m.name = 'Hunter Douglas'
on conflict do nothing;

insert into fabrics (product_id, name, fabric_code, pleat_size, opacity, price_grid_code)
select p.id, v.name, v.fabric_code, v.pleat_size, v.opacity, v.price_grid_code
from products p
join manufacturers m on m.id = p.manufacturer_id
cross join (
  values
    ('Reception 3/4" Light Filtering', 'D56', '3/4"', 'Light Filtering', 'DU-LF1'),
    ('Reception 3/4" Room Darkening', 'D57', '3/4"', 'Room Darkening', 'DU-RD1'),
    ('Architella Reception 3/4" Light Filtering', 'C56', '3/4"', 'Light Filtering', 'DU-LF2'),
    ('Classic 3/4" Light Filtering', 'D2', '3/4"', 'Light Filtering', 'DU-LF2'),
    ('Commercial 3/4" Light Filtering', 'D22', '3/4"', 'Light Filtering', 'DU-LF2'),
    ('Architella Reception 3/4" Room Darkening', 'C57', '3/4"', 'Room Darkening', 'DU-RD2'),
    ('Classic 3/4" Room Darkening', 'D7', '3/4"', 'Room Darkening', 'DU-RD2'),
    ('Commercial 3/4" Room Darkening', 'D23', '3/4"', 'Room Darkening', 'DU-RD2'),
    ('Architella Classic 3/4" Light Filtering', 'C50', '3/4"', 'Light Filtering', 'DU-LF3'),
    ('Architella Elan 3/4" Light Filtering', 'C22', '3/4"', 'Light Filtering', 'DU-LF3'),
    ('Architella Elan 1-1/4" Light Filtering', 'C42', '1-1/4"', 'Light Filtering', 'DU-LF3'),
    ('Whisper Sheer 3/4"', 'D8', '3/4"', 'Sheer', 'DU-LF3'),
    ('Whisper Sheer 3/4" alt', 'D9', '3/4"', 'Sheer', 'DU-LF3'),
    ('Whisper Sheer 1-1/4"', 'D40', '1-1/4"', 'Sheer', 'DU-LF3'),
    ('Whisper Sheer 1-1/4" alt', 'D49', '1-1/4"', 'Sheer', 'DU-LF3'),
    ('Architella Classic 3/4" Room Darkening', 'C51', '3/4"', 'Room Darkening', 'DU-RD3'),
    ('Architella Elan 3/4" Room Darkening', 'C23', '3/4"', 'Room Darkening', 'DU-RD3'),
    ('Architella Elan 1-1/4" Room Darkening', 'C43', '1-1/4"', 'Room Darkening', 'DU-RD3'),
    ('Architella Alexa 3/4" Light Filtering', 'C93', '3/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Alexa 1-1/4" Light Filtering', 'C88', '1-1/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Batiste Bamboo 3/4" Light Filtering', 'C95', '3/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Batiste Bamboo 1-1/4" Light Filtering', 'C97', '1-1/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Batiste Semi-Sheer 3/4"', 'Y10', '3/4"', 'Semi-Sheer', 'DU-LF4'),
    ('Architella Batiste Semi-Sheer 1-1/4"', 'Y09', '1-1/4"', 'Semi-Sheer', 'DU-LF4'),
    ('Architella Thea 3/4" Light Filtering', 'C58', '3/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Thea 1-1/4" Light Filtering', 'C60', '1-1/4"', 'Light Filtering', 'DU-LF4'),
    ('Architella Alexa 3/4" Room Darkening', 'C94', '3/4"', 'Room Darkening', 'DU-RD4'),
    ('Architella Alexa 1-1/4" Room Darkening', 'C89', '1-1/4"', 'Room Darkening', 'DU-RD4'),
    ('Architella Batiste Bamboo 3/4" Room Darkening', 'C96', '3/4"', 'Room Darkening', 'DU-RD4'),
    ('Architella Batiste Bamboo 1-1/4" Room Darkening', 'C98', '1-1/4"', 'Room Darkening', 'DU-RD4'),
    ('Architella Thea 3/4" Room Darkening', 'C59', '3/4"', 'Room Darkening', 'DU-RD4'),
    ('Architella Thea 1-1/4" Room Darkening', 'C61', '1-1/4"', 'Room Darkening', 'DU-RD4'),
    ('ClearView 3/4" Sheer', 'V01', '3/4"', 'Sheer', 'DU-LF5'),
    ('ClearView 1-1/4" Sheer', 'V02', '1-1/4"', 'Sheer', 'DU-LF5'),
    ('Architella India Silk 3/4" Room Darkening', 'U23', '3/4"', 'Room Darkening', 'DU-RD5'),
    ('Architella India Silk 1-1/4" Room Darkening', 'U43', '1-1/4"', 'Room Darkening', 'DU-RD5'),
    ('Architella India Silk 3/4" Light Filtering', 'U22', '3/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella India Silk 1-1/4" Light Filtering', 'U42', '1-1/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Leela 3/4" Light Filtering', 'U24', '3/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Leela 1-1/4" Light Filtering', 'U44', '1-1/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Macon 3/4" Light Filtering', 'U26', '3/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Macon 1-1/4" Light Filtering', 'U46', '1-1/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Solasta 3/4" Light Filtering', 'U28', '3/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Solasta 1-1/4" Light Filtering', 'U48', '1-1/4"', 'Light Filtering', 'DU-LF6'),
    ('Architella Leela 3/4" Room Darkening', 'U25', '3/4"', 'Room Darkening', 'DU-RD6'),
    ('Architella Leela 1-1/4" Room Darkening', 'U45', '1-1/4"', 'Room Darkening', 'DU-RD6'),
    ('Architella Macon 3/4" Room Darkening', 'U27', '3/4"', 'Room Darkening', 'DU-RD6'),
    ('Architella Macon 1-1/4" Room Darkening', 'U47', '1-1/4"', 'Room Darkening', 'DU-RD6'),
    ('Architella Solasta 3/4" Room Darkening', 'U29', '3/4"', 'Room Darkening', 'DU-RD6'),
    ('Architella Solasta 1-1/4" Room Darkening', 'U49', '1-1/4"', 'Room Darkening', 'DU-RD6')
) as v(name, fabric_code, pleat_size, opacity, price_grid_code)
where m.name = 'Hunter Douglas'
  and p.name = 'Duette® Honeycomb Shades'
on conflict do nothing;

insert into lift_options (product_id, name, surcharge_type, surcharge_value)
select p.id, v.name, v.surcharge_type, v.surcharge_value
from products p
join manufacturers m on m.id = p.manufacturer_id
cross join (
  values
    ('EasyRise', 'flat', 0),
    ('LiteRise', 'flat', 0),
    ('UltraGlide', 'flat', 130),
    ('PowerView Gen 3 (up to 60H)', 'size_based', 345),
    ('PowerView Gen 3 (up to 84H)', 'size_based', 405),
    ('PowerView Gen 3 (up to 144H)', 'size_based', 465)
) as v(name, surcharge_type, surcharge_value)
where m.name = 'Hunter Douglas'
  and p.name = 'Duette® Honeycomb Shades'
on conflict do nothing;

insert into design_options (product_id, name, surcharge)
select p.id, v.name, v.surcharge
from products p
join manufacturers m on m.id = p.manufacturer_id
cross join (
  values
    ('Top-Down', 130),
    ('Top-Down/Bottom-Up', 160),
    ('Duolite', 270)
) as v(name, surcharge)
where m.name = 'Hunter Douglas'
  and p.name = 'Duette® Honeycomb Shades'
on conflict do nothing;

-- DU-LF1 price grid rows are intentionally left as a placeholder because the
-- exact width/height/MSRP matrix is referenced from a previous prompt but is
-- not included in this thread. Paste those rows below exactly as provided.
--
-- insert into price_grids (price_grid_code, width_to, height_to, msrp_price)
-- values
--   ('DU-LF1', <width_to>, <height_to>, <msrp_price>),
--   ...;

insert into pricing_settings (manufacturer_id, cost_factor, default_margin, minimum_margin)
select m.id, 0.43, 0.65, 0.55
from manufacturers m
where m.name = 'Hunter Douglas'
  and not exists (
    select 1
    from pricing_settings ps
    where ps.manufacturer_id = m.id
  );

insert into business_settings (
  business_name,
  primary_color,
  sidebar_color,
  tax_rate,
  default_shipping,
  default_installation
)
select
  'Nelo',
  '#FF4900',
  '#1C1C1C',
  0.0875,
  300,
  0
where not exists (
  select 1
  from business_settings
);
