begin;

create extension if not exists pgcrypto;

-- =========================================================
-- Profiles
-- Assumes you already have profiles. This will create only if missing.
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'director' check (role in ('executive', 'director', 'admissions', 'billing')),
  location_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Locations
-- Assumes you may already have locations. This will create only if missing.
-- =========================================================

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  city text,
  state text,
  timezone text default 'America/New_York',
  capacity integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists location_id uuid references public.locations(id) on delete set null;

-- =========================================================
-- CRM lead pipeline
-- =========================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  assigned_to uuid null references public.profiles(id) on delete set null,
  family_name text not null,
  child_name text,
  child_age integer,
  source text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'tour_scheduled', 'application_started', 'enrolled', 'lost')),
  tour_state text default 'none',
  intent_score integer not null default 50 check (intent_score between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_location_id_idx on public.leads(location_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_assigned_to_idx on public.leads(assigned_to);

-- =========================================================
-- Tours
-- =========================================================

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'pending_confirmation', 'completed', 'no_show', 'cancelled')),
  created_by uuid null references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tours_location_id_idx on public.tours(location_id);
create index if not exists tours_lead_id_idx on public.tours(lead_id);

-- =========================================================
-- Parent communications
-- =========================================================

create table if not exists public.parent_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  sender_name text,
  channel text not null default 'email' check (channel in ('email', 'sms', 'app')),
  body text not null,
  assigned_role text check (assigned_role in ('executive', 'director', 'admissions', 'billing')),
  is_unread boolean not null default true,
  requires_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists parent_messages_location_id_idx on public.parent_messages(location_id);
create index if not exists parent_messages_lead_id_idx on public.parent_messages(lead_id);

-- =========================================================
-- Billing
-- =========================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  location_id uuid not null references public.locations(id) on delete cascade,
  family_name text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'due', 'paid', 'past_due', 'void')),
  due_date date,
  paid_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists invoices_location_id_idx on public.invoices(location_id);
create index if not exists invoices_status_idx on public.invoices(status);

-- =========================================================
-- Compliance
-- =========================================================

create table if not exists public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'open'
    check (status in ('open', 'due_soon', 'overdue', 'complete')),
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists compliance_items_location_id_idx on public.compliance_items(location_id);

-- =========================================================
-- Operations
-- =========================================================

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  age_group text not null,
  capacity integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists classrooms_location_id_idx on public.classrooms(location_id);

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  classroom_id uuid null references public.classrooms(id) on delete set null,
  role_name text not null check (role_name in ('director', 'assistant_director', 'lead_teacher', 'assistant_teacher', 'float_teacher', 'billing', 'admissions')),
  shift_start timestamptz,
  shift_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_assignments_location_id_idx on public.staff_assignments(location_id);
create index if not exists staff_assignments_profile_id_idx on public.staff_assignments(profile_id);

-- =========================================================
-- Trigger for updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
before update on public.locations
for each row execute procedure public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

drop trigger if exists tours_set_updated_at on public.tours;
create trigger tours_set_updated_at
before update on public.tours
for each row execute procedure public.set_updated_at();

-- =========================================================
-- Views for easier frontend queries
-- =========================================================

create or replace view public.crm_leads_expanded as
select
  l.*,
  loc.name as location_name,
  p.full_name as assigned_to_name
from public.leads l
join public.locations loc on loc.id = l.location_id
left join public.profiles p on p.id = l.assigned_to;

create or replace view public.crm_tours_expanded as
select
  t.*,
  l.family_name,
  l.child_name,
  loc.name as location_name
from public.tours t
join public.leads l on l.id = t.lead_id
join public.locations loc on loc.id = t.location_id;

create or replace view public.crm_messages_expanded as
select
  pm.*,
  l.family_name,
  loc.name as location_name
from public.parent_messages pm
left join public.leads l on l.id = pm.lead_id
join public.locations loc on loc.id = pm.location_id;

create or replace view public.crm_invoices_expanded as
select
  i.*,
  loc.name as location_name
from public.invoices i
join public.locations loc on loc.id = i.location_id;

create or replace view public.staff_assignments_expanded as
select
  sa.*,
  p.full_name,
  c.name as classroom_name,
  loc.name as location_name
from public.staff_assignments sa
join public.profiles p on p.id = sa.profile_id
left join public.classrooms c on c.id = sa.classroom_id
join public.locations loc on loc.id = sa.location_id;

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.leads enable row level security;
alter table public.tours enable row level security;
alter table public.parent_messages enable row level security;
alter table public.invoices enable row level security;
alter table public.compliance_items enable row level security;
alter table public.classrooms enable row level security;
alter table public.staff_assignments enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_all_for_exec" on public.profiles;
create policy "profiles_select_own_or_all_for_exec"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'executive'
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Locations: authenticated users can read all active locations
drop policy if exists "locations_select_authenticated" on public.locations;
create policy "locations_select_authenticated"
on public.locations
for select
to authenticated
using (true);

-- Shared access rule helper pattern via policies
drop policy if exists "leads_select_by_role_scope" on public.leads;
create policy "leads_select_by_role_scope"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = leads.location_id
      )
  )
);

drop policy if exists "leads_insert_by_scope" on public.leads;
create policy "leads_insert_by_scope"
on public.leads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = leads.location_id
      )
  )
);

drop policy if exists "leads_update_by_scope" on public.leads;
create policy "leads_update_by_scope"
on public.leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = leads.location_id
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = leads.location_id
      )
  )
);

drop policy if exists "tours_select_by_scope" on public.tours;
create policy "tours_select_by_scope"
on public.tours
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = tours.location_id
      )
  )
);

drop policy if exists "parent_messages_select_by_scope" on public.parent_messages;
create policy "parent_messages_select_by_scope"
on public.parent_messages
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = parent_messages.location_id
      )
  )
);

drop policy if exists "invoices_select_by_scope" on public.invoices;
create policy "invoices_select_by_scope"
on public.invoices
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = invoices.location_id
      )
  )
);

drop policy if exists "compliance_select_by_scope" on public.compliance_items;
create policy "compliance_select_by_scope"
on public.compliance_items
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = compliance_items.location_id
      )
  )
);

drop policy if exists "classrooms_select_by_scope" on public.classrooms;
create policy "classrooms_select_by_scope"
on public.classrooms
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = classrooms.location_id
      )
  )
);

drop policy if exists "staff_assignments_select_by_scope" on public.staff_assignments;
create policy "staff_assignments_select_by_scope"
on public.staff_assignments
for select
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'executive'
        or me.location_id = staff_assignments.location_id
      )
  )
);

-- Views exposed to authenticated users
grant select on public.crm_leads_expanded to authenticated;
grant select on public.crm_tours_expanded to authenticated;
grant select on public.crm_messages_expanded to authenticated;
grant select on public.crm_invoices_expanded to authenticated;
grant select on public.staff_assignments_expanded to authenticated;

commit;