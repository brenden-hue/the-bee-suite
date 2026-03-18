# Kid City USA CRM

Supabase-backed CRM frontend for Kid City USA.

## Files

- `index.html`
- `styles.css`
- `config.js`
- `app.js`
- `supabase_setup.sql`

## Current features

- Google login
- login screen role-selection buttons
- actual access still controlled by Supabase `profiles.role` and `profiles.location_id`
- executive bulk CSV upload
- manual lead entry for executive, director, and admissions
- billing hidden from UI
- role-based dashboard views

## Important auth note

The login screen buttons are for UX only.

Actual access is determined by:
- Supabase Auth user
- matching row in `public.profiles`
- `profiles.role`
- `profiles.location_id`
- RLS policies in Supabase

## Google auth setup

Enable Google auth in Supabase and add your redirect URLs for:
- local development
- production GitHub Pages URL

## CSV headers

```csv
family_name,child_name,child_age,source,location_code,status,tour_state,intent_score,notes,created_at
