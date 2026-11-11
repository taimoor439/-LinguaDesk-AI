-- ===========================================================================
-- seed-juicedseo-kb.sql — Knowledge Base seed for the JuicedSEO workspace
-- ===========================================================================
-- STANDALONE SEED — NOT a migration. Do NOT auto-apply: run it manually
-- in the Supabase SQL Editor (once) for workspace
-- fc16b1ed-c656-4527-9c05-ebbd34531183 (JuicedSEO).
--
-- Content is grounded ONLY in what https://juicedseo.com/ (home, about,
-- contact pages, fetched 2026-11-11) actually says: services, process,
-- packages, contact details. Nothing is invented — no fixed prices
-- (the site lists "Custom Pricing" only), no guarantees the site does
-- not make. Figures the site publishes are phrased as the site's own
-- claims ("JuicedSEO reports ...").
--
-- Safe to re-run: ON CONFLICT (workspace_id, slug) updates the article
-- in place instead of failing.
-- ===========================================================================

insert into public.knowledge_base_articles (workspace_id, title, slug, content, status)
values
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'About JuicedSEO',
    'about-juicedseo',
    $$JuicedSEO is a local SEO agency for Australian businesses. We help Australian local businesses get found on Google Maps and local search.

We are a team of SEO specialists with over 12 years of experience. JuicedSEO started as a one-person consultancy and has grown into one of Australia's most trusted local SEO agencies. Our mission is to empower every Australian local business with the search visibility they need to be found online by the customers in their area.

JuicedSEO reports that it has ranked more than 150 Australian businesses in the Google Map Pack, with 97% client retention. We work 100% white-hat only: no shortcuts, no link schemes, and no tactics that put a website at risk. Every strategy we use is fully compliant with Google's guidelines.

We serve businesses across Australia, including Sydney, Melbourne, Brisbane, Perth, Adelaide, Gold Coast, Canberra, Hobart, Darwin and Newcastle, and across industries such as healthcare, legal, trades and home services, retail and ecommerce, education, finance, hospitality, real estate, B2B and small business.$$,
    'published'
  ),
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'SEO services',
    'seo-services',
    $$JuicedSEO offers the following SEO services for Australian businesses:

Local SEO: Own your suburb, city, and region on Google Maps and local search. We optimise your Google Business Profile, build consistent local citations, and implement geo-targeted keyword strategies that connect your business with nearby customers.

Google Business Profile: Optimisation of your Google Business Profile so your business is found on Google Maps and local search.

Technical SEO: We fix Core Web Vitals, improve site speed, resolve crawl errors, and implement structured data so Google keeps crawling, indexing, and ranking your site.

On-Page SEO: We refine title tags, meta descriptions, heading hierarchy, keyword placement, and internal linking for maximum ranking impact.

Off-Page SEO and link building: We grow your website's authority with ethical, white-hat backlinks from trusted Australian publications through digital PR and outreach.

SEO Audit: A complete health check of your website's search performance, analysing technical infrastructure, on-page optimisation, backlink quality, and competitor positioning, followed by a prioritised action plan.

Ecommerce SEO: We optimise product pages, refine category taxonomy, implement ecommerce schema, and fix technical issues that prevent online stores from ranking.

Enterprise SEO: Scalable SEO frameworks for large organisations with complex site architectures, including multi-location SEO management.

Every strategy is built for the Australian market: how Australians search, the suburbs they type, the directories Google trusts, and the local signals that move the map pack.$$,
    'published'
  ),
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'How working with JuicedSEO works',
    'how-it-works',
    $$Working with JuicedSEO follows a clear four-step process:

1. Audit & Discovery: We conduct a full technical audit, analyse your Google Business Profile, review competitor rankings across your target cities, and identify the keyword gaps and citation inconsistencies holding you back.

2. Strategy & Planning: We build a custom SEO roadmap covering your target services, locations, and industries, with a prioritised action plan that sequences quick wins alongside long-term authority building.

3. Implementation: We execute on-page optimisation, technical fixes, Google Business Profile management, local citation building across Australian directories, and white-hat link acquisition, all in parallel.

4. Reporting & Growth: Monthly plain-English reports show ranking movements, traffic growth, and leads generated. We review performance with you, refine the strategy, and keep compounding your local search visibility.

Getting started: fill in the contact form or call us, and we will schedule a free strategy call to discuss your business and goals. We offer a free initial consultation with no obligation. We can typically begin within one week of signing up.

We also offer a free professional website audit: fill in your details and we will send a custom SEO report within 48 hours. No spam, no obligation, just actionable insights.

Every client gets a dedicated SEO manager, not a rotating support queue. Reporting is transparent: real-time dashboards and plain-English monthly reports show exactly what is moving and why, with no vanity metrics — just the rankings, traffic, and leads that matter.$$,
    'published'
  ),
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'Packages and pricing',
    'packages-and-pricing',
    $$JuicedSEO offers three local SEO packages. All plans are month-to-month with no lock-in contracts, and you can cancel anytime. Pricing is custom: every package is listed as Custom Pricing, because pricing depends on your goals, competition, location, and the level of service required. Contact us for a free consultation and a personalised quote.

Starter — for single-location businesses. Includes Google Business Profile optimisation, local keyword research, on-page SEO (up to 5 pages), monthly reporting, and citation building.

Growth — for businesses ready to scale. Our most popular package. Includes everything in Starter, plus content strategy and creation, link building campaigns, competitor analysis, technical SEO audit and fixes, and fortnightly strategy calls.

Enterprise — for multi-location brands. Includes everything in Growth, plus multi-location SEO management, a dedicated account manager, a custom reporting dashboard, priority support, and quarterly business reviews.

There are no lock-in contracts and no exit fees. If we are not delivering results, you are free to walk.$$,
    'published'
  ),
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'Contact JuicedSEO',
    'contact-juicedseo',
    $$You can reach JuicedSEO as follows:

Phone: +1 (771) 999-6921
Email: hello@juicedseo.com
Location: Sydney, NSW, Australia
Business hours: Monday to Friday, 9am to 5pm AEST
Response time: within 2 business hours

To start, fill in the contact form on our website or call us. We will schedule a free strategy call. The contact form asks for your full name, email address, phone number, website URL, the service you are interested in, and your message. Your information is secure and is never shared with third parties.

Service areas: we serve businesses across Australia, including Sydney (NSW), Melbourne (VIC), Brisbane (QLD), Perth (WA), Adelaide (SA), Gold Coast (QLD), Canberra (ACT), Newcastle (NSW), and Hobart (TAS).$$,
    'published'
  ),
  (
    'fc16b1ed-c656-4527-9c05-ebbd34531183',
    'Getting started — frequently asked questions',
    'getting-started-faq',
    $$How much do your SEO services cost?
Every business has different SEO requirements, so pricing depends on your goals, competition, location, and the level of service required. We provide customised SEO solutions tailored to your business. Contact us for a free consultation and a personalised quote. All packages are listed as Custom Pricing.

How do I get started?
Fill out the contact form on our website or give us a call. We will schedule a free strategy call to discuss your business, your goals, and how we can help you rank higher in local search results.

Do you offer free consultations?
Yes, we offer a free initial strategy call where we review your current online presence, discuss your goals, and outline a tailored plan to improve your local search visibility. No obligation, no pressure.

What information do you need from me?
We will need your website URL, target locations, a list of services you offer, and access to your Google Business Profile. During onboarding, we guide you through everything step by step.

How quickly can you start?
We can typically begin within one week of signing up. Our onboarding process is streamlined so we can hit the ground running.

What results does JuicedSEO report?
JuicedSEO reports an average 312% increase in organic traffic, more than 4,800 keywords ranked in page 1 positions, an average 156% increase in leads generated, and an average 3.8x revenue ROI across its campaigns. These are the figures published on our website.$$,
    'published'
  )
on conflict (workspace_id, slug)
do update set
  title = excluded.title,
  content = excluded.content,
  status = excluded.status,
  updated_at = now();
