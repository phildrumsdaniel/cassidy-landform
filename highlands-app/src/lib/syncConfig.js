// Cloud sync configuration. Sync stays OFF (app behaves exactly as before)
// until this is filled in with a free Supabase project's details.
//
// To enable: set url + anonKey to your Supabase project's values (Settings →
// API). tripId is a shared, unguessable code both phones use for the same trip
// — keep it as-is so both devices sync together.
//
// export const syncConfig = {
//   url: 'https://xxxx.supabase.co',
//   anonKey: 'eyJhbGciOi...'  // the public "anon" key — safe in client code
// }

export const syncConfig = null

// Shared row id for this trip (both phones read/write the same row).
export const TRIP_ID = 'ptdaniel-highlands-2026-8f3a1c'

// Which localStorage keys sync between phones (small text only — never photos).
export const SYNC_PREFIXES = ['booking:', 'journal:', 'checklist:']
