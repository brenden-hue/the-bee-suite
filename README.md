# The Bee Suite

This version is aligned to the Supabase route and includes only the files needed for the current test build plus the workbook source data used to rebuild Supabase.

## Included source data

Source workbook: `Kid City CRM Database.xlsx`

Imported into the generated Supabase SQL:
- 95 locations
- 97 profiles
- 13,276 leads

The rebuilt SQL lives in `kidcityusa_crm.sql` and is intended to be pasted into the Supabase SQL Editor for a fresh CRM setup.

## What the SQL does

- recreates the core CRM tables used by the frontend
- imports locations, profiles, and leads from the Excel workbook
- normalizes workbook roles for the app
  - `school_user` -> `director`
  - `executive_user` -> `executive`
- normalizes lead statuses for the app
  - `new_inquiry`, `subscribed`, `new` -> `new`
  - `tour_booked` -> `tour_scheduled`
  - `cleaned` -> `lost`
- creates the expanded views the frontend expects
- adds test-mode RLS policies so the static frontend can read and insert data

## Supabase import steps

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Open `kidcityusa_crm.sql` from this folder.
4. Paste the file contents into a new query.
5. Run the query once on a clean test database.
6. After it finishes, confirm these tables exist:
   - `locations`
   - `profiles`
   - `leads`
   - `tours`
   - `parent_messages`
   - `classrooms`
   - `staff_assignments`
   - `compliance_items`
7. In `profiles`, verify the email you want to test with is present.
8. Publish the frontend and test login using that email.

## Important test note

The policies in `kidcityusa_crm.sql` are intentionally open for testing so the static frontend can work with the anon key. Tighten them before any production launch.

