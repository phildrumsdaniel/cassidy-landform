// Cloud config for cross-phone sync + shared photos. Live.
//
// The anon key is the *public* client key (safe to ship in the app); row-level
// security on the database limits it to exactly the trip tables. tripId is the
// shared, unguessable code both phones use for the same trip.

export const syncConfig = {
  url: 'https://jyjikwibvoagapioqeqe.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5amlrd2lidm9hZ2FwaW9xZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzI5NzYsImV4cCI6MjEwMTkwODk3Nn0.-8b3hpZw_iFkKGExH-n1LLu5UenJQItrpjfmsqKnTGk'
}

// Shared row id for this trip (both phones read/write the same row).
export const TRIP_ID = 'ptdaniel-highlands-2026-8f3a1c'

// Which localStorage keys sync between phones (small text only — never photos).
export const SYNC_PREFIXES = ['booking:', 'journal:', 'journalpub:', 'checklist:']
