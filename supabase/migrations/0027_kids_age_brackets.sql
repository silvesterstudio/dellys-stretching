-- Dellys — the kids groups were re-bracketed: 3-7 -> 4-8 and 8-13 -> 9-14.
--
-- Display names only. The internal identifiers are deliberately NOT renamed:
--   * class_types.key ('gimnastica_3_7' / 'gimnastica_8_13')
--   * class_types.category / free_trial_usage.category ('kids_3_7' / 'kids_8_13')
-- Those category strings are stored on consumed free trials and are mirrored by
-- TRIAL_CATEGORIES in src/lib/constants.ts and the trial.categories keys in the
-- i18n dictionaries. Renaming them would orphan trial history for zero visible
-- gain, so the keys stay as-is and only the labels move.

update public.class_types
   set name_ro = 'Gimnastică 4-8 ani', name_ru = 'Гимнастика 4-8 лет'
 where key = 'gimnastica_3_7';

update public.class_types
   set name_ro = 'Gimnastică 9-14 ani', name_ru = 'Гимнастика 9-14 лет'
 where key = 'gimnastica_8_13';

-- Kids plans exist once per studio (membership_plans.location_id is NOT NULL
-- since 0024), so these touch both the Trandafirilor and Moscova copies.
update public.membership_plans
   set name_ro = replace(name_ro, '3-7 ani',  '4-8 ani'),
       name_ru = replace(name_ru, '3-7 лет',  '4-8 лет')
 where audience = 'child' and (name_ro like '%3-7 ani%' or name_ru like '%3-7 лет%');

update public.membership_plans
   set name_ro = replace(name_ro, '8-13 ani', '9-14 ani'),
       name_ru = replace(name_ru, '8-13 лет', '9-14 лет')
 where audience = 'child' and (name_ro like '%8-13 ani%' or name_ru like '%8-13 лет%');
