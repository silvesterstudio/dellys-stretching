-- ============================================================================
-- Dellys — seed data (class types + membership price list)
-- Idempotent: safe to re-run. Prices are placeholders — tune in the admin panel.
-- ============================================================================

insert into public.class_types (key, audience, name_ro, name_ru, color, default_capacity)
values
  ('pilates',    'adult', 'Pilates',          'Пилатес',          '#e84d86', 11),
  ('stretching', 'adult', 'Stretching',       'Стретчинг',        '#a589b9', 11),
  ('total_body', 'adult', 'Total Body',       'Тотал боди',       '#d42f6b', 11),
  ('popa_press', 'adult', 'Popa + Press',     'Попа + Пресс',     '#f272a3', 11),
  ('gimnastica', 'child', 'Gimnastică',       'Гимнастика',       '#8b69a1', 11)
on conflict (key) do nothing;

insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days, sort_order)
values
  ('adult', '4 ședințe',  '4 занятия',  4,  160, 'RON', 30, 1),
  ('adult', '8 ședințe',  '8 занятий',  8,  280, 'RON', 30, 2),
  ('adult', '12 ședințe', '12 занятий', 12, 360, 'RON', 45, 3),
  ('child', '8 ședințe (copii)', '8 занятий (дети)', 8, 240, 'RON', 30, 4)
on conflict do nothing;
