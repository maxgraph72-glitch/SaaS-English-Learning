# Approved Design Baseline

## Purpose

This file records the user-approved visual design of Daily English. It exists so future work can be compared with, or restored to, the approved version without guessing what the site used to look like.

This is a locked reference. Update this file, its baseline version, or its Git reference only after the user has explicitly reviewed and approved a new design. A request to add or change product functionality is not approval to change the design baseline.

## Approved Version

- Status: **Approved**
- Baseline version: **1**
- Approved on: **2026-07-14**
- Git commit: `2e14e52b130fd1174c402e6fe4a886f1f81c33a0`
- Branch at approval: `feature/spaced-repetition`
- Covered screens: Today dashboard, Vocabulary, Review, Login, desktop navigation, mobile navigation, light theme, and dark theme.

The Git commit above is the exact recovery source. This document describes the design, but the committed implementation is authoritative when pixel-level restoration is required.

## Visual Direction

The approved style is calm, clean, minimal, practical, and learning-focused. It uses a dark green navigation area, warm off-white page background, white content cards, restrained shadows, and soft mint, peach, lilac, and sky accents. Decorative elements must remain subtle and must not compete with the daily learning flow.

The interface should feel like a focused study workspace rather than a marketing page, game, or highly decorative dashboard.

## Design Tokens

The canonical token definitions are in `app/globals.css` at the approved commit.

### Light theme

- Page: `#f2f5f0`
- Surface: `#ffffff`
- Soft surface: `#f7f9f5`
- Sidebar: `#183f35`
- Strong sidebar: `#0d3028`
- Main text: `#18312b`
- Muted text: `#708078`
- Border: `#dfe6df`
- Primary: `#1c6b55`
- Primary hover: `#155541`
- Primary soft: `#dff1e8`
- Mint: `#bfe5d2`
- Peach: `#f5d2b6`
- Lilac: `#ddd4ee`
- Sky: `#cddfec`
- Card shadow: `0 20px 60px rgba(26, 61, 50, 0.08)`

### Typography

- Interface text: `Segoe UI Variable`, `Segoe UI`, Inter, system UI, sans-serif.
- Large editorial words and selected page headings: Georgia / Times New Roman, serif.
- Typography uses compact letter spacing, clear hierarchy, and restrained weights.

### Shape and spacing

- Cards generally use 18–22 px corner radii.
- Form controls and primary buttons generally use 11 px corner radii.
- Pills and status badges use fully rounded corners.
- Borders are thin and low contrast.
- Shadows are soft and sparse.
- Content has generous whitespace without making everyday actions feel distant.

## Approved Layout

### Application shell

- Desktop uses a fixed visual hierarchy with a 248 px dark-green sidebar and a flexible workspace.
- The sidebar contains the Daily brand, primary navigation, CEFR indicator, and a short learning message.
- The top bar is 76 px high and contains theme and profile controls.
- Below 900 px, the sidebar is replaced by a four-item floating bottom navigation.
- Mobile content keeps comfortable side padding and reserves space for bottom navigation.

### Today dashboard

- Welcome and continue action appear at the top.
- The main white routine card contains the progress summary, four lesson rows, and one colored focus card.
- The focus card remains the strongest accent, but stays within the soft approved palette.
- Three compact insight cards follow the routine card on desktop and collapse responsively.
- Real vocabulary, review, progress, and session data must be placed into this composition rather than replacing it with a new dashboard layout.

### Vocabulary

- Manual entry and CSV import appear as paired white cards.
- The study-before-scheduling state uses a soft mint panel.
- Vocabulary collection uses a white card, compact filter pills, search, status badges, and a responsive table/list.
- New functions should extend these patterns instead of introducing a separate visual language.

### Review

- The review page centers attention on one large word card.
- Translation remains hidden until reveal.
- Incorrect and Correct actions use the approved peach and mint colors.
- Progress, stage, group, and timing information remain secondary to recall.

### Login

- Desktop uses a dark-green editorial panel beside a compact white login card.
- Mobile hides the editorial panel and keeps the login card centered on the page background.

## Canonical Design Files

At baseline version 1, the visual implementation is defined primarily by:

- `app/globals.css`
- `components/app-shell.tsx`
- `components/dashboard.tsx`
- `components/vocabulary-workspace.tsx`
- `components/review-session.tsx`
- `app/login/page.tsx`
- `app/login/login-form.tsx`
- `app/layout.tsx`

Functional code may evolve, but changes to these files must preserve the approved appearance unless the user explicitly approves a redesign.

## What Counts As A Design Change

Prior approval is required before changing any of the following:

- Color palette or theme tokens.
- Typography families, hierarchy, or general type scale.
- Sidebar, top bar, mobile navigation, or page composition.
- Card structure, spacing rhythm, corner radii, borders, or shadows.
- Dashboard, vocabulary, review, or login screen layout.
- Icons, decorative language, animation style, or overall visual density.
- Responsive behavior that materially changes the approved composition.

Copy corrections, accessibility fixes, data wiring, and functional bug fixes are allowed without design approval only when they preserve the approved visual appearance.

## Comparison And Recovery

Before restoring anything, preserve any current uncommitted work. Never discard user work merely to restore the design.

To compare the current visual implementation with the approved baseline:

```powershell
git diff 2e14e52b130fd1174c402e6fe4a886f1f81c33a0 -- app/globals.css components/app-shell.tsx components/dashboard.tsx components/vocabulary-workspace.tsx components/review-session.tsx app/login/page.tsx app/login/login-form.tsx app/layout.tsx
```

For a style-only recovery, use the approved `app/globals.css` as the reference. Restoring TSX files verbatim can also remove newer functionality, so component markup should be restored selectively unless the user explicitly requests a full rollback.

The baseline itself must not be advanced to a newer commit until the user says that the new design is approved and should replace this version.
