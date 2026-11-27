-- Optional, self-declared answers that let scholarship checks use age and household-income limits.
--
-- ui-specifications.md §9.1 ruled out collecting a date of birth, so only the YEAR of birth is asked
-- (enough to tell whether an age limit is clearly met, clearly missed, or too close to call), and
-- household income is a band, not an exact figure. Both are optional and can be cleared. They live on
-- profiles, so the existing owner-only RLS applies, and they are not in the chatbot context allowlist.
alter table public.profiles
  add column birth_year smallint
    check (birth_year is null or birth_year between 1950 and 2100),
  add column household_income_band text
    check (household_income_band is null or household_income_band in
      ('under_2500', '2500_5000', '5000_7500', '7500_10000', '10000_15000', 'over_15000'));

comment on column public.profiles.birth_year is
  'Optional self-declared year of birth for scholarship age limits; null = not answered.';
comment on column public.profiles.household_income_band is
  'Optional self-declared monthly household income band for scholarship income limits; null = not answered.';
