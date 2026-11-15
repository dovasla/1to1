/* Player app settings. Edit only this file to switch things on.
   backend: 'mock' (one device, for testing) or 'supabase' (real online database, needs the url and anonKey below).
   The anon key is the public key from Supabase (Project Settings > API). Never put the service key or the database password here.
   squarePayLink: the Square payment link (https://...) for the Pay button. Empty means no Pay button; players pay the organiser in cash or by Square as before. Set the amount in Square (e.g. £5).
   payAuto: true = the Pay button asks the server for a Square link (create-pay-link) and checks for Paid. Set to false to go back to the plain link or cash (rollback). Ruling R39 (15 Nov): on for Jord's real card test.
*/
window.PLAYER_APP_CONFIG = {
  backend: 'supabase',
  supabaseUrl: 'https://opqbralmxwwqbdudfagc.supabase.co',
  supabaseAnonKey: 'sb_publishable_jgsxcwtILjkf9nv9y_waBA_g7PTdUZU',
  squarePayLink: 'https://square.link/u/lpqCGb6Y',
  payAuto: true,
  // Door code at sign-up (H3/H4). Keep true until migration-25 (run-code) is live on Supabase.
  // Then set false: the door box hides and sign-up no longer asks for it.
  doorCodeAtSignUp: true,
  // Push reminders (N11). Public key only, from the organiser's VAPID steps. Empty = switches show an error, nothing is sent.
  VAPID_PUBLIC_KEY: '',
  nightPublic: true,
  // Receipt line under Paid (Brief 26). Shows 'Paid £5 · date'. Set false to switch off.
  receiptOn: true
};
