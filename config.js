/* Player app settings. Edit only this file to switch things on.
   backend: 'mock' (one device, for testing) or 'supabase' (real online database, needs the url and anonKey below).
   The anon key is the public key from Supabase (Project Settings > API). Never put the service key or the database password here.
   squarePayLink: the Square payment link (https://...) for the Pay button. Empty means no Pay button; players pay the organiser in cash or by Square as before. Set the amount in Square (e.g. £5).
   payAuto: true turns on the automatic card pay path. Keep it true in the published copy.
   vapidPublicKey: the PUBLIC half of the run-alert key (see supabase/README-RUN-ALERTS.md). Empty means run alerts are not set up yet and nothing is asked. Never put the private key here.
*/
window.PLAYER_APP_CONFIG = {
  backend: 'supabase',
  supabaseUrl: 'https://opqbralmxwwqbdudfagc.supabase.co',
  supabaseAnonKey: 'sb_publishable_jgsxcwtILjkf9nv9y_waBA_g7PTdUZU',
  squarePayLink: 'https://square.link/u/lpqCGb6Y',
  payAuto: true,
  nightPublic: true,
  vapidPublicKey: ''
};
