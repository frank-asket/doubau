# Doubow V1 Segment: West Africa Remote-Ready Professionals

## User #1

Doubow v1 is built for Ghana/Nigeria-based and diaspora professionals who want credible local, regional, and remote-global roles without manually searching every job board.

The first user is not "everyone looking for work." They are early-to-mid career professionals in Ghana or Nigeria, or people with strong GH/NG context, who need a focused discovery feed, a salary benchmark, and application support that respects real hiring channels.

## Geography

Primary coverage:

- Ghana: Accra, Kumasi, Tema, and Ghana-wide roles.
- Nigeria: Lagos, Abuja, Port Harcourt, and Nigeria-wide roles.
- Remote-global: remote, worldwide, distributed, work-from-home, and similar listings.

Out-of-region jobs can still appear when semantic fit is strong, but they should not crowd out GH/NG/remote results in the default v1 experience.

## Role Families

The shared catalog should stay broad enough for beta learning, but matching quality should be judged first on these role families:

- Operations and administration
- Sales and customer success
- Marketing and communications
- Finance and accounting
- Product, project, and program management
- Design, data, and software roles

## Strong Match Definition

A strong match for this segment meets most of these conditions:

- The role title and description overlap clearly with the user's resume or profile goals.
- The location is Ghana, Nigeria, or remote-global.
- Seniority is plausible for the user's years of experience.
- The listing is fresh, active, and has a usable apply link.
- The company/source is credible enough for the user to click through.

The week 3 gate is practical: 8 out of 10 internal GH/NG/remote resumes should receive at least 15 relevant results, with no obvious location failure in the top results.

## Matching Implications

Use `match_scope=west_africa` for this segment. It keeps semantic fit as the lead signal while favoring Ghana, Nigeria, and remote-global listings.

Current blend:

- Resume/profile similarity: 52%
- Location fit: 18%
- Seniority fit: 20%
- Freshness: 10%

Remote-global roles receive a strong location score for GH/NG users. Ghana and Nigeria are treated as neighboring target markets rather than hard mismatches.

## Ingest Implications

RapidAPI JSearch is the primary scheduled provider, with RapidAPI Active Jobs DB as the supplemental ATS/career-site feed.

Default catalog coverage should include:

- Ghana-specific queries
- Nigeria-specific queries
- Remote-global queries
- Broad role-family seeds for the target beta cohort

Do not add additional paid providers until internal testing shows a measurable JSearch coverage gap.
