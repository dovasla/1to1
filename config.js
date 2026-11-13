/* Player app settings. Edit only this file to switch things on.
   backend: 'mock' (one device, for testing) or 'supabase' (real online database, needs the url and anonKey below).
   The anon key is the public key from Supabase (Project Settings > API). Never put the service key or the database password here.
   squarePayLink: the Square payment link (https://...) for the Pay button. Empty means no Pay button; players pay Jord in cash or by Square as before. Set the amount in Square (e.g. £5).
   payAuto: false keeps the old Pay button. Set to true ONLY after the automatic Square steps in square-auto/README-JORD-STEPS.md are done.
*/
window.PLAYER_APP_CONFIG = {
  backend: 'supabase',
  supabaseUrl: 'https://opqbralmxwwqbdudfagc.supabase.co',
  supabaseAnonKey: 'sb_publishable_jgsxcwtILjkf9nv9y_waBA_g7PTdUZU',
  squarePayLink: 'https://square.link/u/lpqCGb6Y',
  payAuto: false,
  nightPublic: true
};
