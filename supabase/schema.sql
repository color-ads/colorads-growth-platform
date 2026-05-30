-- ============================================
-- ColorADS Growth Platform — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'client' check (role in ('super_admin', 'growth_partner', 'client')),
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- PROPERTIES (Hotels)
-- ============================================
create table public.properties (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  location text not null,
  logo_url text,
  primary_color text not null default '#0ea5e9',
  secondary_color text not null default '#0f172a',
  success_fee_pct numeric(5,2) not null default 2.5,
  active boolean not null default true,
  -- API integrations
  cloudbeds_property_id text,
  cloudbeds_access_token text,
  cloudbeds_refresh_token text,
  cloudbeds_token_expires_at timestamptz,
  google_ads_account_id text,
  google_ads_refresh_token text,
  meta_ad_account_id text,
  meta_access_token text,
  -- Metadata
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- PROPERTY ACCESS (User <-> Property mapping)
-- ============================================
create table public.property_access (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz default now(),
  unique(user_id, property_id)
);

-- ============================================
-- BOOKING SOURCES (Configurable per property)
-- ============================================
create table public.booking_sources (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  source_name text not null,
  is_attributable boolean not null default false,
  created_at timestamptz default now()
);

-- Default sources for Hashtag 98
-- These get created when a property is onboarded

-- ============================================
-- MONTHLY REPORTS
-- ============================================
create table public.monthly_reports (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  -- Hero KPIs
  total_guests integer not null default 0,
  total_nights integer not null default 0,
  total_investment numeric(15,2) not null default 0,
  ad_cost_pct numeric(5,2) not null default 0,
  -- Revenue
  attributable_revenue numeric(15,2) not null default 0,
  total_hotel_revenue numeric(15,2) not null default 0,
  -- Bookings
  total_bookings integer not null default 0,
  booking_volume numeric(15,2) not null default 0,
  avg_ticket numeric(15,2) not null default 0,
  avg_stay numeric(5,2) not null default 0,
  -- Marketing metrics
  roas numeric(8,2) not null default 0,
  google_investment numeric(15,2) not null default 0,
  meta_investment numeric(15,2) not null default 0,
  content_investment numeric(15,2) not null default 0,
  fees_investment numeric(15,2) not null default 0,
  total_impressions bigint not null default 0,
  total_clicks integer not null default 0,
  avg_cpc numeric(10,2) not null default 0,
  -- Breakdowns (JSONB for flexibility)
  campaign_breakdown jsonb default '[]'::jsonb,
  geo_breakdown jsonb default '[]'::jsonb,
  source_breakdown jsonb default '[]'::jsonb,
  room_category_breakdown jsonb default '[]'::jsonb,
  booking_status_breakdown jsonb default '[]'::jsonb,
  booking_lead_time_breakdown jsonb default '[]'::jsonb,
  -- AI
  ai_insights jsonb,
  milestones jsonb default '[]'::jsonb,
  -- Status
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(property_id, year, month)
);

-- ============================================
-- CONTENT ITEMS (Calendar)
-- ============================================
create table public.content_items (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  title text not null,
  description text,
  content_type text not null check (content_type in ('reel', 'carousel', 'story', 'post', 'other')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'published')),
  media_url text,
  thumbnail_url text,
  scheduled_date date not null,
  platform text not null default 'instagram' check (platform in ('instagram', 'facebook', 'tiktok', 'other')),
  month integer not null,
  year integer not null,
  -- Approval flow
  approval_comment text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  -- Metadata
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- ALERTS
-- ============================================
create table public.alerts (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  type text not null check (type in ('roas_drop', 'budget_alert', 'content_pending', 'cpc_spike', 'booking_drop')),
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_access enable row level security;
alter table public.booking_sources enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.content_items enable row level security;
alter table public.alerts enable row level security;

-- Helper: get current user role
create or replace function public.get_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: check property access
create or replace function public.has_property_access(prop_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.property_access
    where user_id = auth.uid() and property_id = prop_id
  ) or get_user_role() in ('super_admin', 'growth_partner');
$$;

-- PROFILES policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Super admin can view all profiles"
  on public.profiles for select using (get_user_role() = 'super_admin');
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- PROPERTIES policies
create policy "Super admin full access to properties"
  on public.properties for all using (get_user_role() = 'super_admin');
create policy "Growth partner can view their properties"
  on public.properties for select using (
    get_user_role() = 'growth_partner' and
    exists (select 1 from public.property_access where user_id = auth.uid() and property_id = id)
  );
create policy "Clients can view their properties"
  on public.properties for select using (
    get_user_role() = 'client' and
    exists (select 1 from public.property_access where user_id = auth.uid() and property_id = id)
  );

-- PROPERTY ACCESS policies
create policy "Super admin full access to property_access"
  on public.property_access for all using (get_user_role() = 'super_admin');
create policy "Growth partner can manage their property access"
  on public.property_access for all using (get_user_role() = 'growth_partner');
create policy "Users can view own access"
  on public.property_access for select using (user_id = auth.uid());

-- BOOKING SOURCES policies
create policy "Property access required for booking_sources"
  on public.booking_sources for all using (has_property_access(property_id));

-- MONTHLY REPORTS policies
create policy "Property access required for monthly_reports"
  on public.monthly_reports for select using (has_property_access(property_id));
create policy "Growth partner and super admin can write monthly_reports"
  on public.monthly_reports for all using (
    get_user_role() in ('super_admin', 'growth_partner') and
    has_property_access(property_id)
  );

-- CONTENT ITEMS policies
create policy "Property access required for content_items"
  on public.content_items for select using (has_property_access(property_id));
create policy "Growth partner and super admin can write content_items"
  on public.content_items for insert with check (
    get_user_role() in ('super_admin', 'growth_partner') and
    has_property_access(property_id)
  );
create policy "Growth partner and super admin can update content_items"
  on public.content_items for update using (
    get_user_role() in ('super_admin', 'growth_partner') and
    has_property_access(property_id)
  );
create policy "Clients can approve/reject content"
  on public.content_items for update using (
    get_user_role() = 'client' and
    has_property_access(property_id)
  );

-- ALERTS policies
create policy "Property access required for alerts"
  on public.alerts for select using (has_property_access(property_id));
create policy "Mark alerts as read"
  on public.alerts for update using (has_property_access(property_id));

-- ============================================
-- INDEXES
-- ============================================
create index idx_property_access_user on public.property_access(user_id);
create index idx_property_access_property on public.property_access(property_id);
create index idx_monthly_reports_property on public.monthly_reports(property_id);
create index idx_monthly_reports_period on public.monthly_reports(property_id, year, month);
create index idx_content_items_property on public.content_items(property_id);
create index idx_content_items_period on public.content_items(property_id, year, month);
create index idx_content_items_status on public.content_items(status);
create index idx_alerts_property on public.alerts(property_id);
create index idx_alerts_unread on public.alerts(property_id, read) where read = false;

-- ============================================
-- SEED: Hashtag 98 Hotel (first property)
-- Run after creating your super admin user
-- ============================================

-- Insert property
insert into public.properties (
  name, slug, location, primary_color, secondary_color,
  success_fee_pct, active, cloudbeds_property_id
) values (
  'Hashtag 98 Hotel',
  'hashtag-98',
  'El Poblado, Medellín, Colombia',
  '#0ea5e9',
  '#0f172a',
  2.5,
  true,
  null -- Add Cloudbeds property ID when connecting API
);

-- Default booking sources for Hashtag 98
-- (property_id will need to be updated with actual UUID after insert above)
-- insert into public.booking_sources (property_id, source_name, is_attributable)
-- values
--   ('<property_id>', 'Sitio web o motor de reservas', true),
--   ('<property_id>', 'CENTRAL DE RESERVAS - (FULL SERVICE)', true),
--   ('<property_id>', 'WALK IN (FULL SERVICE)', false),
--   ('<property_id>', 'WALK IN (ROOM ONLY)', false),
--   ('<property_id>', 'Booking.com', false),
--   ('<property_id>', 'Expedia', false);
