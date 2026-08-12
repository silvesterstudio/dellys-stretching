-- Dellys — the five adult class types that run on the weekly timetable but had
-- no row in class_types, so they never appeared in the admin's "Tip de clasă"
-- picker and could not be scheduled.
--
--   High Heels      Tue/Thu 20:00
--   Spate + Mâini   Tue/Thu 11:00, Fri 19:00
--   Step Aerobica   Mon 18:00
--   Circuit         Fri 18:00
--   Stretching MFR  Fri 20:00, Sun 11:00
--
-- category is NOT NULL default 'adult' (see 0011), which is the correct
-- membership/free-trial bucket for all five. class_types carries no
-- location_id, so these serve both the Trandafirilor and Moscova studios.

insert into public.class_types (key, audience, name_ro, name_ru, color, default_capacity)
values
  ('high_heels',     'adult', 'High Heels',     'High Heels',      '#e84d86', 11),
  ('spate_maini',    'adult', 'Spate + Mâini',  'Спина + руки',    '#a589b9', 11),
  ('step_aerobica',  'adult', 'Step Aerobica',  'Степ-аэробика',   '#d42f6b', 11),
  ('circuit',        'adult', 'Circuit',        'Circuit',         '#f272a3', 11),
  ('stretching_mfr', 'adult', 'Stretching MFR', 'Стретчинг МФР',   '#8b69a1', 11)
on conflict (key) do nothing;
