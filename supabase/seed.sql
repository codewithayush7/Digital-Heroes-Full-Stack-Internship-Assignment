-- ============================================================================
-- DIGITAL HEROES: Seed Data (Charities and Charity Events Only)
-- NOTE: Per PRD instructions, NO fake published draws are seeded.
-- ============================================================================

-- Clear existing data if re-seeding
truncate table public.charity_events cascade;
truncate table public.charities cascade;

-- Insert Featured and Standard Charities
insert into public.charities (
  id,
  name,
  slug,
  tagline,
  description,
  logo_url,
  cover_image_url,
  gallery_images,
  is_featured,
  website_url,
  total_funds_raised
) values
(
  'c1111111-1111-1111-1111-111111111111',
  'NextGen Youth Sports Academy',
  'nextgen-youth-sports',
  'Empowering underprivileged youth through mentorship, discipline, and athletics.',
  'NextGen Youth Sports Academy provides free sports coaching, academic tutoring, and equipment grants to children living in underserved communities. Through the dedication of volunteer coaches and community leaders, we help over 2,500 children each year build self-esteem, teamwork skills, and resilience.',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1200&h=600&q=80',
  array[
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80'
  ],
  true,
  'https://nextgenyouthsports.org',
  48500.00
),
(
  'c2222222-2222-2222-2222-222222222222',
  'Clean Waters Global Foundation',
  'clean-waters-global',
  'Delivering permanent clean drinking water infrastructure to rural families.',
  'Clean Waters Global Foundation designs and builds sustainable solar-powered water purification and distribution networks across rural areas. By collaborating directly with local leaders, we eliminate waterborne illness and allow young girls to attend school instead of walking hours each day for water.',
  'https://images.unsplash.com/photo-1541888946425-d0fbb18665c7?auto=format&fit=crop&w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&h=600&q=80',
  array[
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80'
  ],
  false,
  'https://cleanwatersglobal.org',
  92300.00
),
(
  'c3333333-3333-3333-3333-333333333333',
  'Honor & Valor Veterans Initiative',
  'honor-and-valor-veterans',
  'Comprehensive mental healthcare, housing support, and career transitions for veterans.',
  'Honor & Valor Veterans Initiative stands beside military service veterans transitioning back to civilian life. We provide trauma counseling, career retraining in high-demand technology fields, and emergency housing assistance so no hero is left behind.',
  'https://images.unsplash.com/photo-1579208575657-c595a05383b7?auto=format&fit=crop&w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?auto=format&fit=crop&w=1200&h=600&q=80',
  array[
    'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80'
  ],
  false,
  'https://honorandvalor.org',
  64150.00
),
(
  'c4444444-4444-4444-4444-444444444444',
  'Starlight Pediatric Care Alliance',
  'starlight-pediatric-care',
  'Life-saving medical treatment and emergency care grants for critically ill children.',
  'Starlight Pediatric Care Alliance funds vital pediatric surgeries, rare disease research, and family travel grants for pediatric oncology patients. Every dollar directly lightens the financial and emotional burden on families fighting childhood illness.',
  'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&h=600&q=80',
  array[
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80'
  ],
  false,
  'https://starlightpediatric.org',
  115400.00
);

-- Insert Upcoming Charity Events (e.g. Golf Days & Fundraiser Tournaments)
insert into public.charity_events (
  id,
  charity_id,
  title,
  description,
  event_date,
  location,
  event_type
) values
(
  'e1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'Annual Youth Sports Invitational Golf Day',
  'A charity scramble golf tournament featuring youth athletes as honorary caddies, followed by an evening awards gala and silent auction.',
  now() + interval '14 days',
  'St. Andrews Links Community Course',
  'golf_day'
),
(
  'e2222222-2222-2222-2222-222222222222',
  'c2222222-2222-2222-2222-222222222222',
  'Clean Waters Charity Golf Classic',
  'Join 120 players competing for clean water boreholes in developing communities. Registration includes 18 holes, lunch, and a presentation on 2026 clean water milestones.',
  now() + interval '28 days',
  'The Pines Championship Course',
  'golf_day'
),
(
  'e3333333-3333-3333-3333-333333333333',
  'c3333333-3333-3333-3333-333333333333',
  'Veterans Cup & Gala Dinner',
  'Honoring military veterans with an afternoon 4-ball better ball challenge and an evening fundraising dinner featuring keynote veteran speakers.',
  now() + interval '42 days',
  'Royal Oaks Country Club',
  'golf_day'
),
(
  'e4444444-4444-4444-4444-444444444444',
  'c4444444-4444-4444-4444-444444444444',
  'Swing for Children Charity Pro-Am',
  'An exclusive Pro-Am tournament partnering top regional golf pros with corporate donors to benefit pediatric surgery units.',
  now() + interval '60 days',
  'Harbor View Golf Sanctuary',
  'golf_day'
);
