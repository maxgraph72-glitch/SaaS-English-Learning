# Public Launch Implementation Specification

## Execution instruction

Implement this specification end to end in the current repository. Do not stop
after writing a plan or explaining how it could be done. Inspect the current
code, make the changes, run the relevant checks, publish the validated site
publicly through the repository's existing Sites workflow, and return the
public URL.

The user wants an autonomous result. Do not ask design, copy, route, hosting, or
SEO preference questions. Use the decisions in this document and conservative
engineering judgment. Ask the user only if an external account permission or
credential approval is strictly required and cannot be completed through an
already connected session. A missing custom domain or unavailable Google Search
Console session must not block the public launch.

## User outcome

Deliver a publicly accessible Daily English site that:

- has a useful public landing page at `/` that does not require authentication;
- preserves the existing authenticated learning application and approved visual
  design;
- sends authenticated users to `/dashboard` after sign-in;
- is technically crawlable and indexable by Google;
- keeps account data and authenticated application routes out of search results;
- is deployed to a stable HTTPS Sites URL;
- requires no domain purchase or paid hosting-plan upgrade for the initial
  launch;
- includes a concise final handoff with the public URL and verification results.

## Current repository facts

Treat these as starting facts, but verify them before editing because another
task may have changed the working tree:

- The working branch prepared for this work is `codex/public-launch`.
- The repository contains uncommitted user work. Preserve it. Never reset,
  discard, overwrite, or selectively restore those changes.
- This is an existing Next.js 16 / TypeScript application built with `vinext`
  and the Cloudflare Vite plugin.
- npm and `package-lock.json` are the canonical package-manager artifacts.
- The existing `npm run build` command is `vinext build`.
- `.openai/hosting.json` exists and currently may not contain a `project_id`.
- Supabase provides authentication and application persistence.
- The current `/` route is the authenticated Today dashboard and calls
  `requireViewer()`.
- The current login and OAuth callback flows default to `/` after successful
  authentication.
- `app/layout.tsx` already supplies a product title, description, Open Graph,
  and X/Twitter metadata.
- `public/og.png` already exists. Preserve it unless it is missing or unusable;
  do not replace a valid product-specific image merely to refresh it.
- There is no implemented `robots` or `sitemap` route at the time this
  specification was written.
- `DESIGN_BASELINE.md` locks the approved application visual system.

## Authority and boundaries

Running this specification is explicit authorization to:

- change the application routes and links required for the public launch;
- add the public landing, privacy, terms, robots, sitemap, and SEO support;
- run the existing validation commands;
- create and publicly deploy a Sites version after validation;
- create the Sites project if `.openai/hosting.json` has no `project_id`;
- make the deployment commit or source push required by the Sites workflow.

It is not authorization to:

- purchase a custom domain or any paid plan;
- enable paid overages;
- expose, print, copy, or commit secrets;
- read or edit `.env` or `.env.local` files;
- expose a Supabase service-role key to browser code;
- change the database schema or RLS policies for this launch;
- add analytics, advertising, tracking pixels, cookie banners, payment
  providers, or telemetry;
- redesign existing dashboard, vocabulary, review, writing, login, settings,
  navigation, or theme screens;
- update `DESIGN_BASELINE.md` or advance its approved baseline reference;
- push the current branch to the existing GitHub `origin` unless the user asks;
- commit unrelated files to `origin` merely to make the worktree clean.

Use Sites-managed runtime configuration and source credentials only through the
official Sites workflow. Never persist a credential in a remote URL, Git config,
source file, log, or final response.

## Required route model

Implement this public/private separation:

| Route | Access | Search behavior | Purpose |
| --- | --- | --- | --- |
| `/` | Public | `index, follow` | Product landing page |
| `/privacy` | Public | `index, follow` | Plain-language privacy notice |
| `/terms` | Public | `index, follow` | Plain-language terms |
| `/login` | Public | `noindex, nofollow` | Sign in and registration |
| `/dashboard` | Authenticated | `noindex, nofollow` | Existing Today dashboard |
| `/vocabulary` and descendants | Authenticated | `noindex, nofollow` | Existing vocabulary features |
| `/review` and descendants | Authenticated | `noindex, nofollow` | Existing review features |
| `/writing` and descendants | Authenticated | `noindex, nofollow` | Existing writing features |
| `/settings` and descendants | Authenticated | `noindex, nofollow` | Existing settings |
| `/auth/*` | Callback only | Disallow crawling | Authentication callbacks |

Do not duplicate the Today dashboard. Move or extract the existing root-page
implementation into `/dashboard` while preserving its behavior and data
queries. The public root must render even when Supabase environment variables
are not configured; only authentication-dependent routes may show the existing
setup notice.

Prefer the smallest safe routing change. A route group may be used to share
`noindex` metadata across authenticated pages if it does not risk losing or
overwriting current uncommitted work. Otherwise add route-level metadata. URL
behavior and preservation of existing code matter more than introducing a new
folder abstraction.

## Authenticated navigation migration

Update every application navigation path that currently treats `/` as Today so
it uses `/dashboard` instead. Inspect the repository rather than relying only on
this list. At minimum cover:

- the Today item in desktop and mobile navigation;
- desktop and mobile brand links inside the authenticated application shell;
- all `Back to today` and review-completion links;
- vocabulary study-session completion links;
- writing-workspace return links;
- the active-navigation helper so `/dashboard` is selected correctly;
- redirect of an already authenticated visitor away from `/login`;
- email/password sign-in success navigation;
- the OAuth callback's safe default destination;
- any tests or fixtures that assert the old post-login `/` destination.

Keep `/` as the destination after sign-out only when the intended result is the
public landing page. If the existing product deliberately sends signed-out
users to `/login`, it may continue to do so.

Preserve open-redirect protection in the OAuth callback. A requested `next`
value must remain a safe local path. The default should become `/dashboard`.

## Public landing page

Create a polished, responsive, accessible public landing page at `/`. It must
feel like the same Daily English product without changing the locked application
design. Reuse the existing visual tokens and visual direction: dark green,
warm off-white, white surfaces, restrained soft accents, subtle shadows,
rounded cards, Segoe/system UI text, and restrained Georgia editorial accents.

Do not run a design picker and do not ask the user to choose a visual direction.
Use the approved baseline as the answer. Do not alter existing application
screens to make the landing page fit.

The landing page must include:

1. A compact public header with the Daily brand, a `Sign in` link, and a primary
   `Start learning` action.
2. A clear hero describing the real product value. Use honest, specific English
   copy centered on short daily English practice, vocabulary, spaced review,
   and measurable progress.
3. A visual representation of the daily learning loop using normal HTML/CSS and
   existing icon conventions. Do not add decorative model-authored SVGs.
4. A `How it works` section with three concise steps.
5. A feature section that only claims behavior verified in the current code.
   Vocabulary ownership, CSV import, flashcards, spaced repetition, due review,
   progress/session tracking, authentication, and themes may be described when
   still implemented. Do not advertise AI writing feedback, pronunciation
   scoring, subscriptions, or other planned functionality as available unless
   the code genuinely implements it.
6. A final call to action leading to `/login`.
7. A small footer with links to `/privacy`, `/terms`, and `/login`.

Use semantic HTML with one useful `h1`, logical heading levels, descriptive link
text, visible keyboard focus, sufficient contrast, and reduced-motion-safe
behavior. The page must work at mobile, tablet, and desktop widths without
horizontal scrolling. Avoid heavy animation, stock imagery, testimonials,
fabricated user counts, fabricated ratings, and invented awards.

If the visitor already has an authenticated session, the public landing page
may change the primary CTA to `Continue learning`, but it must remain publicly
renderable and must not expose user data in its HTML.

## Privacy and terms pages

Add compact, readable `/privacy` and `/terms` pages in the same public visual
language. These are operational launch notices, not invented legal guarantees.

The privacy page must accurately describe only the data flows present in the
repository, including as applicable:

- account email and authentication handled through Supabase;
- user vocabulary, review history, settings, and learning progress;
- Google sign-in when the user chooses it;
- no sale of personal data and no advertising/analytics added by this launch;
- a contact placeholder only if no real contact address exists; do not invent
  an email address;
- a clear note that users can request account/data deletion through the contact
  channel once one is provided.

The terms page should state the educational purpose, user responsibility for
account access, acceptable use, service availability without fabricated SLA,
and that product features may evolve. Do not claim a registered company,
jurisdiction, refund policy, subscription, certification, or support channel
that does not exist.

If no valid operator/contact details are available, clearly label the relevant
field as `Contact details will be published before commercial launch` instead
of fabricating details. This does not block an MVP technical launch.

## SEO and crawler requirements

Implement all of the following:

- Preserve or refine the existing product title and description so they describe
  the public landing page and contain natural phrases such as `daily English
  practice`, `vocabulary`, and `spaced repetition` without keyword stuffing.
- Set an explicit canonical URL for `/`, derived safely from the request host or
  the deployment's public site URL. Do not hard-code localhost or an invented
  domain in production metadata.
- Keep Open Graph and X/Twitter metadata valid. Reuse the existing
  `public/og.png` when it accurately represents Daily English. Verify that the
  deployed absolute image URL resolves successfully.
- Add a WebApplication or SoftwareApplication JSON-LD object with only truthful
  fields. Do not invent ratings, reviews, price, organization data, or download
  counts.
- Add a root `robots.txt` response that allows the public landing/legal pages,
  disallows authenticated and callback paths, and advertises the absolute
  sitemap URL.
- Add a root `sitemap.xml` response containing only canonical, indexable public
  URLs: `/`, `/privacy`, and `/terms`.
- Generate sitemap and robots host values from the real request/deployment host
  or a safely configured public-site variable. Never emit localhost URLs in the
  deployed versions.
- Apply `noindex, nofollow` metadata to `/login` and every authenticated route.
  `robots.txt` disallow rules alone are not a substitute for `noindex`.
- Do not place authenticated routes, callback routes, query strings, or user
  content in the sitemap.
- Confirm that the public routes return successful HTML without authentication,
  passwords, or JavaScript-only content gates.
- Confirm that no `X-Robots-Tag: noindex` header is accidentally applied to `/`,
  `/privacy`, or `/terms`.

The SEO work is complete when the site is eligible for indexing. Do not claim
that Google has indexed or ranked it unless Search Console or a live Google
result actually confirms that state.

## Supabase and hosted authentication

Do not modify the database for this work.

Preserve the existing Supabase browser/server split and publishable-key model.
Never expose a service-role key. Do not read local `.env*` files. Use only safe
variable names from `.env.example` and already configured hosted runtime values.

When the public deployment URL becomes known:

- ensure the application uses the deployed origin for OAuth callback URLs;
- preserve `/auth/callback` as the callback path;
- if an already accessible Supabase dashboard/session allows updating Auth URL
  Configuration, add the deployed origin and callback without removing valid
  local development URLs;
- do not block the public landing deployment if Supabase dashboard access is
  unavailable;
- clearly distinguish `public landing reachable` from `hosted sign-in verified`
  in the final verification report.

Do not print or return runtime values. If hosted Supabase public variables are
missing and no connected account can provide them safely, publish the public
landing anyway, leave authentication code intact, and report hosted sign-in as
the single remaining external-configuration limitation. Do not replace Supabase
with mock authentication.

## Sites hosting workflow

This repository contains `.openai/hosting.json`; use the installed
`sites-building` capability path followed by `sites-hosting`.

1. Preserve the existing npm lockfile and vinext/Cloudflare-compatible build.
2. Do not reinitialize the project.
3. Complete the implementation before the deployment build.
4. Run `npm run build` and fix real failures.
5. Create a Sites project only if no `project_id` exists, then persist only the
   permitted hosting metadata in `.openai/hosting.json`.
6. Public deployment is explicitly authorized by this specification. Do not
   default to a private-only result.
7. Follow the official Sites packaging, version-saving, credential, and status
   polling sequence. Keep temporary archives and credentials private.
8. Wait until deployment status is `succeeded` or a terminal failure is known.
9. Open the successful deployed URL in Codex as required by the Sites workflow.
10. Use the generated Sites HTTPS URL as the launch URL. A custom domain is not
    required and must not be purchased.

Do not deploy an invalid build merely to obtain a URL. Do not modify D1 or R2
bindings; this application continues to use Supabase.

## Google discovery handoff

Google Search Console is useful but not required for the site to be public or
discoverable.

After successful deployment:

1. Verify live `/robots.txt` and `/sitemap.xml` using the deployed origin.
2. Verify the sitemap's public URLs return `200` and are not authentication
   redirects.
3. If a connected, already signed-in Google browser session is available, add a
   URL-prefix Search Console property for the deployed URL, complete a safe
   verification method by editing/redeploying the site if needed, submit
   `/sitemap.xml`, and request indexing for `/`.
4. Do not ask the user to buy a domain for Search Console.
5. If no signed-in Google session is available or the Sites subdomain cannot be
   verified, skip Search Console without blocking launch. State that the site is
   crawlable and that actual Google indexing may take days or weeks and is not
   guaranteed.

Never claim successful Search Console submission unless it was actually
completed and verified.

## Validation

Run checks in proportion to the changes and use the real scripts in
`package.json`:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run test:db` is not required because this specification makes no database
changes. Do not start or modify a local Supabase stack merely for this launch.

Add or update focused tests for route/SEO logic where the repository's current
test conventions make that practical. At minimum verify through code/tests or
live responses that:

- `/` does not invoke `requireViewer()` and renders without Supabase config;
- `/dashboard` preserves the original Today dashboard behavior and requires a
  viewer;
- sign-in and OAuth callback defaults resolve to `/dashboard`;
- all authenticated `Today` and `Back to today` links resolve to `/dashboard`;
- robots rules allow public content and disallow private/callback routes;
- sitemap contains exactly the intended public canonical URLs;
- private pages emit `noindex`;
- the public landing has no obvious accessibility or responsive-layout defects;
- the production build succeeds;
- the deployed public routes, `robots.txt`, `sitemap.xml`, and `og.png` resolve as
  expected.

Do not perform broad visual redesign QA on the locked application screens. Check
the new public pages and route migration without changing the approved UI.

## Definition of done

The task is done only when all applicable statements are true:

- Current user work was preserved.
- `/` is a useful public landing page.
- The Today dashboard works at `/dashboard` behind authentication.
- Successful login and OAuth callback default to `/dashboard`.
- Existing authenticated navigation no longer mistakes `/` for Today.
- `/privacy` and `/terms` exist and contain honest launch-appropriate copy.
- Public metadata, canonical, JSON-LD, Open Graph, robots, and sitemap are valid.
- Private/login/callback routes are not offered for indexing.
- Existing tests plus typecheck, lint, and build pass, or every remaining failure
  is proven pre-existing and reported precisely.
- A public Sites deployment succeeded and its HTTPS URL was verified.
- Hosted Supabase authentication was tested when runtime configuration and
  account access permitted it.
- Search Console was attempted only when an already connected session made it
  possible; its absence did not block launch.
- No paid service was purchased or enabled.
- No secret or `.env` content was exposed.
- `DESIGN_BASELINE.md` was not changed.

## Final response requirements

Lead with the public URL. Then report, concisely:

- what is now public;
- whether hosted sign-in was verified;
- whether Search Console submission was completed or skipped;
- the validation commands and results;
- any single external-account limitation that remains.

Do not end with a generic plan, ask the user to run commands, or give manual
deployment instructions. The primary deliverable is the working public URL.
