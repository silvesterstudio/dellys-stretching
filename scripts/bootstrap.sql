-- Allow service-role / direct SQL (no JWT) to manage roles; still block
-- authenticated non-admins from escalating themselves.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'FORBIDDEN: only an admin can change roles';
    end if;
  end if;
  return new;
end;
$$;

-- De-duplicate membership_plans (seed was run twice), keeping the earliest row.
delete from public.membership_plans a
using public.membership_plans b
where a.name_ro = b.name_ro and a.audience = b.audience and a.ctid > b.ctid;

-- Prevent future duplicates.
alter table public.membership_plans
  drop constraint if exists membership_plans_audience_name_uniq;
alter table public.membership_plans
  add constraint membership_plans_audience_name_uniq unique (audience, name_ro);

-- Promote the admin account.
update public.profiles set role = 'admin' where email = 'admin@dellys.local';

select email, role from public.profiles where role = 'admin';
