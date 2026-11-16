/*
 * 1TO1 player icons (R64). 60 original icons, drawn in-house for 1TO1.
 * No uploads, no copied artwork, no logos, no real people.
 *
 * Style: one foreground colour on a dark disc, thick round strokes,
 * readable at 28px. Colours come from CSS variables so light and dark
 * pages both work:
 *   --pi-bg  disc colour   (default #0B1A33)
 *   --pi-fg  glyph colour  (default #FFD60A)
 *
 * Usage:
 *   import { PLAYER_ICONS, playerIconSvg, defaultPlayerIcon } from './player-icons.js';
 *   el.innerHTML = playerIconSvg('ball', { size: 56 });
 *   const id = defaultPlayerIcon(accountId);   // fixed rule, never blank
 */

const D = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const F = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const P = (d) => `<path d="${d}"/>`;

export const PLAYER_ICON_GROUPS = [
  { id: 'hoops', name: 'Basketball' },
  { id: 'animals', name: 'Animals' },
  { id: 'faces', name: 'Faces' },
  { id: 'shapes', name: 'Shapes' },
  { id: 'food', name: 'Food' },
  { id: 'sky', name: 'Weather and space' },
];

// Each entry: id, group, name (shown to screen readers and in the picker), body (SVG inside a 48 x 48 box).
export const PLAYER_ICONS = [
  // Basketball
  { id: 'ball', group: 'hoops', name: 'Basketball', body:
    C(24, 24, 14) + P('M24 10 V38 M10 24 H38') + P('M12.5 14 Q20 24 12.5 34') + P('M35.5 14 Q28 24 35.5 34') },
  { id: 'hoop', group: 'hoops', name: 'Hoop', body:
    '<rect x="10" y="9" width="28" height="16" rx="2"/>' + '<rect x="18" y="14" width="12" height="7"/>' +
    '<ellipse cx="24" cy="28" rx="8" ry="2.5"/>' + P('M17 29.5 L20 38 M24 30.5 V38 M31 29.5 L28 38') },
  { id: 'court', group: 'hoops', name: 'Court', body:
    '<rect x="9" y="12" width="30" height="24" rx="1"/>' + P('M24 12 V36') + C(24, 24, 4) +
    '<rect x="9" y="18" width="8" height="12"/>' + '<rect x="31" y="18" width="8" height="12"/>' },
  { id: 'sneaker', group: 'hoops', name: 'Sneaker', body:
    P('M11 14 H19 L21 24 L30 27 L38 28 V35 H11 Z') + P('M11 31 H38') },
  { id: 'jersey', group: 'hoops', name: 'Jersey', body:
    P('M17 10 L10 15 L13 22 L17 20 V38 H31 V20 L35 22 L38 15 L31 10 Q24 15 17 10 Z') },
  { id: 'trophy', group: 'hoops', name: 'Trophy', body:
    P('M16 10 H32 V20 Q32 28 24 28 Q16 28 16 20 Z') + P('M16 13 H11 Q11 20 16 21') +
    P('M32 13 H37 Q37 20 32 21') + P('M24 28 V33') + '<rect x="17" y="33" width="14" height="4" rx="1"/>' },
  { id: 'medal', group: 'hoops', name: 'Medal', body:
    P('M18 8 L23 22 M30 8 L25 22') + C(24, 30, 8) + D(24, 30, 2.5) },
  { id: 'whistle', group: 'hoops', name: 'Whistle', body:
    C(20, 28, 7) + P('M26 25 L37 22 V30 L26 31') + D(20, 28, 2) },
  { id: 'stopwatch', group: 'hoops', name: 'Stopwatch', body:
    C(24, 27, 11) + '<rect x="21" y="9" width="6" height="3"/>' + P('M24 27 V20 M24 27 L29 30') },
  { id: 'backboard', group: 'hoops', name: 'Backboard', body:
    '<rect x="8" y="10" width="32" height="22" rx="3"/>' + '<rect x="18" y="17" width="12" height="9"/>' + P('M24 32 V38 M18 38 H30') },

  // Animals
  { id: 'cat', group: 'animals', name: 'Cat', body:
    P('M12 20 L14 10 L20 16 Q24 15 28 16 L34 10 L36 20 Q38 26 34 32 Q30 37 24 37 Q18 37 14 32 Q10 26 12 20 Z') +
    D(19, 26, 1.8) + D(29, 26, 1.8) + F('M22 31 L26 31 L24 33 Z') + P('M10 30 L15 31 M38 30 L33 31') },
  { id: 'dog', group: 'animals', name: 'Dog', body:
    P('M17 18 Q12 18 12 26 Q12 34 17 33 M31 18 Q36 18 36 26 Q36 34 31 33') + C(24, 22, 10) +
    D(20, 21, 1.8) + D(28, 21, 1.8) + D(24, 27, 2) + P('M21 31 Q24 34 27 31') },
  { id: 'bear', group: 'animals', name: 'Bear', body:
    C(15, 15, 4) + C(33, 15, 4) + C(24, 26, 12) + '<ellipse cx="24" cy="31" rx="5" ry="4"/>' +
    D(24, 29, 1.5) + D(19, 23, 1.8) + D(29, 23, 1.8) },
  { id: 'fox', group: 'animals', name: 'Fox', body:
    P('M11 14 L19 19 Q24 18 29 19 L37 14 L36 27 Q34 35 24 38 Q14 35 12 27 Z') +
    P('M18 25 L21 26 M30 25 L27 26') + D(24, 31, 1.5) },
  { id: 'owl', group: 'animals', name: 'Owl', body:
    P('M14 14 L17 10 H31 L34 14 Q37 22 35 30 Q33 38 24 38 Q15 38 13 30 Q11 22 14 14 Z') +
    C(19, 22, 4) + C(29, 22, 4) + D(19, 22, 1.5) + D(29, 22, 1.5) + F('M22 28 H26 L24 31 Z') },
  { id: 'fish', group: 'animals', name: 'Fish', body:
    P('M10 24 Q18 14 28 18 Q34 20 38 24 Q34 28 28 30 Q18 34 10 24 Z') + P('M36 24 L42 19 V29 Z') +
    D(17, 22, 1.8) + P('M24 19 Q23 24 24 29') },
  { id: 'bird', group: 'animals', name: 'Bird', body:
    C(24, 26, 10) + C(32, 16, 5) + F('M36 15 L41 17 L36 19 Z') + D(33, 15, 1.5) +
    P('M16 26 Q22 20 28 26') + F('M14 26 L8 22 L9 30 Z') },
  { id: 'rabbit', group: 'animals', name: 'Rabbit', body:
    '<rect x="15" y="7" width="6" height="18" rx="3"/>' + '<rect x="27" y="7" width="6" height="18" rx="3"/>' +
    C(24, 30, 10) + D(20, 29, 1.6) + D(28, 29, 1.6) + F('M23 34 H25 L24 35.5 Z') },
  { id: 'frog', group: 'animals', name: 'Frog', body:
    P('M10 26 Q10 20 16 20 H32 Q38 20 38 26 Q38 34 24 34 Q10 34 10 26 Z') +
    C(17, 18, 4) + C(31, 18, 4) + D(17, 18, 1.5) + D(31, 18, 1.5) + P('M17 28 Q24 32 31 28') },
  { id: 'turtle', group: 'animals', name: 'Turtle', body:
    P('M12 26 Q12 14 24 14 Q36 14 36 26 Z') + P('M10 26 H38') + C(40, 24, 3) +
    P('M16 26 V31 M32 26 V31') + P('M24 14 V20 M18 20 L24 26 L30 20') },

  // Faces
  { id: 'smile', group: 'faces', name: 'Smile', body:
    C(24, 24, 14) + D(19, 21, 1.8) + D(29, 21, 1.8) + P('M18 27 Q24 33 30 27') },
  { id: 'grin', group: 'faces', name: 'Grin', body:
    C(24, 24, 14) + P('M16 21 Q19 18 22 21') + P('M26 21 Q29 18 32 21') +
    F('M16 27 H32 Q32 34 24 34 Q16 34 16 27 Z') },
  { id: 'wink', group: 'faces', name: 'Wink', body:
    C(24, 24, 14) + D(19, 21, 1.8) + P('M27 21 Q29 19 31 21') + P('M18 28 Q24 33 30 28') },
  { id: 'shades', group: 'faces', name: 'Cool', body:
    C(24, 24, 14) + '<rect x="15" y="19" width="7" height="5" rx="2" fill="currentColor"/>' +
    '<rect x="26" y="19" width="7" height="5" rx="2" fill="currentColor"/>' + P('M22 21 H26') + P('M19 29 Q24 33 29 29') },
  { id: 'sleepy', group: 'faces', name: 'Sleepy', body:
    C(24, 24, 14) + P('M16 22 Q19 25 22 22') + P('M26 22 Q29 25 32 22') + P('M21 30 H27') + P('M34 10 H38 L34 14 H38') },
  { id: 'wow', group: 'faces', name: 'Wow', body:
    C(24, 24, 14) + C(19, 21, 2.2) + C(29, 21, 2.2) + C(24, 30, 3) },
  { id: 'thinking', group: 'faces', name: 'Thinking', body:
    C(24, 24, 14) + D(19, 21, 1.8) + D(29, 21, 1.8) + P('M19 30 H29') + D(35, 11, 1.5) + D(39, 8, 1) },
  { id: 'party', group: 'faces', name: 'Party', body:
    P('M14 36 L22 12 L34 28 Z') + D(22, 12, 2) + P('M19 24 L26 30') + P('M34 12 L36 9 M38 18 L42 17') },
  { id: 'robot', group: 'faces', name: 'Robot', body:
    '<rect x="12" y="14" width="24" height="20" rx="4"/>' + P('M24 14 V8') + D(24, 7, 2) +
    D(19, 23, 2) + D(29, 23, 2) + P('M19 29 H29') + P('M12 22 H9 M36 22 H39') },
  { id: 'ghost', group: 'faces', name: 'Ghost', body:
    P('M14 36 V22 Q14 12 24 12 Q34 12 34 22 V36 L30 33 L27 36 L24 33 L21 36 L18 33 Z') +
    D(20, 22, 1.8) + D(28, 22, 1.8) + P('M21 27 Q24 29 27 27') },

  // Shapes
  { id: 'star', group: 'shapes', name: 'Star', body:
    P('M24 10 L27.5 19.2 L37.3 19.7 L29.7 25.9 L32.2 35.3 L24 30 L15.8 35.3 L18.3 25.9 L10.7 19.7 L20.5 19.2 Z') },
  { id: 'heart', group: 'shapes', name: 'Heart', body:
    P('M24 35 L12.5 23.5 Q9 19 12 15 Q16 10 20 13 Q23 15 24 18 Q25 15 28 13 Q32 10 36 15 Q39 19 35.5 23.5 Z') },
  { id: 'bolt', group: 'shapes', name: 'Bolt', body:
    F('M27 9 L15 26 H23 L21 39 L33 22 H25 Z') },
  { id: 'diamond', group: 'shapes', name: 'Diamond', body:
    P('M14 16 H34 L40 22 L24 38 L8 22 Z') + P('M8 22 H40') },
  { id: 'crown', group: 'shapes', name: 'Crown', body:
    P('M10 34 L8 16 L17 24 L24 12 L31 24 L40 16 L38 34 Z') },
  { id: 'shield', group: 'shapes', name: 'Shield', body:
    P('M24 9 L37 13 V23 Q37 33 24 39 Q11 33 11 23 V13 Z') + P('M18 24 L22 28 L30 20') },
  { id: 'flame', group: 'shapes', name: 'Flame', body:
    P('M24 10 Q28 16 34 20 Q37 26 33 33 Q29 38 24 38 Q17 38 14 32 Q12 26 17 21 Q18 26 21 27 Q20 18 24 10 Z') },
  { id: 'target', group: 'shapes', name: 'Target', body:
    C(24, 24, 14) + C(24, 24, 8) + D(24, 24, 2) },
  { id: 'hexagon', group: 'shapes', name: 'Hexagon', body:
    P('M24 10 L36.1 17 V31 L24 38 L11.9 31 V17 Z') + P('M24 18 L29.2 21 V27 L24 30 L18.8 27 V21 Z') },
  { id: 'anchor', group: 'shapes', name: 'Anchor', body:
    C(24, 14, 3) + P('M24 17 V38') + P('M18 22 H30') + P('M12 28 Q12 36 24 38 Q36 36 36 28') + P('M12 28 L9 25 M36 28 L39 25') },

  // Food
  { id: 'pizza', group: 'food', name: 'Pizza', body:
    P('M10 16 Q24 8 38 16 L24 40 Z') + D(20, 22, 2.5) + D(29, 24, 2.2) + D(24, 31, 2) },
  { id: 'burger', group: 'food', name: 'Burger', body:
    P('M11 22 Q11 11 24 11 Q37 11 37 22 Z') + P('M10 26 H38') + P('M11 30 H37 V32 Q37 36 33 36 H15 Q11 36 11 32 Z') +
    D(19, 17, 1) + D(25, 15, 1) + D(30, 18, 1) },
  { id: 'apple', group: 'food', name: 'Apple', body:
    P('M24 16 Q16 11 12 17 Q9 24 14 32 Q18 38 24 36 Q30 38 34 32 Q39 24 36 17 Q32 11 24 16 Z') +
    P('M24 16 Q24 12 27 9') + F('M26 13 Q31 9 34 11 Q31 15 26 13 Z') },
  { id: 'donut', group: 'food', name: 'Donut', body:
    C(24, 24, 13) + C(24, 24, 4) + P('M17 21 L19 19 M29 19 L31 21 M24 29 L27 31 M15 28 L17 27 M32 28 L34 27') },
  { id: 'icecream', group: 'food', name: 'Ice cream', body:
    P('M16 25 L24 40 L32 25 Z') + P('M12 25 Q12 12 24 12 Q36 12 36 25 Q30 28 24 25 Q18 28 12 25 Z') },
  { id: 'banana', group: 'food', name: 'Banana', body:
    P('M12 13 Q12 33 37 33 Q33 39 22 36 Q13 31 12 13 Z') + P('M12 13 L11 10') },
  { id: 'cherry', group: 'food', name: 'Cherry', body:
    C(17, 32, 6) + C(31, 30, 6) + P('M17 26 Q18 16 26 12 M31 24 Q30 16 26 12') + F('M26 12 Q32 8 36 10 Q32 14 26 12 Z') },
  { id: 'cupcake', group: 'food', name: 'Cupcake', body:
    P('M12 26 H36 L32 38 H16 Z') + P('M12 26 Q12 18 18 18 Q20 12 24 14 Q28 12 30 18 Q36 18 36 26 Z') + D(24, 11, 2) },
  { id: 'lemon', group: 'food', name: 'Lemon', body:
    '<ellipse cx="24" cy="24" rx="13" ry="10"/>' + P('M11 24 L8 24 M37 24 L40 24') + P('M26 14 Q30 9 34 11 Q31 14 26 14 Z') },
  { id: 'taco', group: 'food', name: 'Taco', body:
    P('M8 28 A16 16 0 0 1 40 28 Z') + P('M12 28 L15 24 L19 28 L23 24 L27 28 L31 24 L35 28') },

  // Weather and space
  { id: 'sun', group: 'sky', name: 'Sun', body:
    C(24, 24, 7) + P('M24 10 V13 M24 35 V38 M10 24 H13 M35 24 H38 M14.1 14.1 L16.2 16.2 M31.8 31.8 L33.9 33.9 M33.9 14.1 L31.8 16.2 M16.2 31.8 L14.1 33.9') },
  { id: 'moon', group: 'sky', name: 'Moon', body:
    P('M30 9 A15 15 0 1 0 39 30 A12 12 0 0 1 30 9 Z') },
  { id: 'cloud', group: 'sky', name: 'Cloud', body:
    P('M14 32 H34 Q40 32 40 26 Q40 20 34 20 Q33 14 26 14 Q20 14 19 19 Q13 19 13 25 Q13 32 14 32 Z') },
  { id: 'rainbow', group: 'sky', name: 'Rainbow', body:
    P('M10 32 A14 14 0 0 1 38 32') + P('M14 32 A10 10 0 0 1 34 32') + P('M18 32 A6 6 0 0 1 30 32') },
  { id: 'snowflake', group: 'sky', name: 'Snowflake', body:
    P('M24 8 V40 M10.9 16 L37.1 32 M10.9 32 L37.1 16') + P('M20 11 L24 14 L28 11 M20 37 L24 34 L28 37') },
  { id: 'rain', group: 'sky', name: 'Rain', body:
    P('M14 25 H34 Q39 25 39 20 Q39 15 33 15 Q31 10 25 11 Q19 12 18 17 Q10 17 10 21 Q10 25 14 25 Z') +
    P('M17 31 L15 37 M25 31 L23 37 M33 31 L31 37') },
  { id: 'planet', group: 'sky', name: 'Planet', body:
    C(24, 24, 10) + '<ellipse cx="24" cy="24" rx="18" ry="6" transform="rotate(-20 24 24)"/>' },
  { id: 'rocket', group: 'sky', name: 'Rocket', body:
    P('M24 8 Q32 14 32 26 V32 H16 V26 Q16 14 24 8 Z') + C(24, 20, 3) +
    P('M16 26 L11 32 V36 L16 32 M32 26 L37 32 V36 L32 32') + P('M20 36 Q24 42 28 36') },
  { id: 'comet', group: 'sky', name: 'Comet', body:
    C(30, 18, 5) + D(30, 18, 5) + P('M25 23 L10 38 M27 25 L14 38 M22 20 L12 30') },
  { id: 'mountain', group: 'sky', name: 'Mountain', body:
    P('M8 36 L19 16 L26 28 L30 22 L40 36 Z') + P('M17 21 L19 16 L22 21') },
];

const BY_ID = new Map(PLAYER_ICONS.map((icon) => [icon.id, icon]));

/** True when the id is one of the 60 icons. Anything else is refused. */
export function isPlayerIcon(id) {
  return BY_ID.has(id);
}

/** Accessible name for an icon id, or '' if unknown. */
export function playerIconName(id) {
  return BY_ID.get(id)?.name ?? '';
}

/**
 * Inline SVG string for an icon. Unknown ids fall back to the default icon
 * for a player (never a blank).
 * opts.size: pixels (default 48). opts.label: override the accessible name.
 */
export function playerIconSvg(id, opts = {}) {
  const icon = BY_ID.get(id) ?? BY_ID.get(PLAYER_ICONS[0].id);
  const size = opts.size ?? 48;
  const label = opts.label ?? icon.name;
  const safe = String(label).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return (
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="${safe}" ` +
    `style="color:var(--pi-fg,#FFD60A);display:block" focusable="false">` +
    `<circle cx="24" cy="24" r="24" style="fill:var(--pi-bg,#0B1A33)"/>` +
    `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
    icon.body +
    `</g></svg>`
  );
}

/**
 * Fixed rule so every account has an icon from day one.
 * seed: any stable string, for example the account id. Same seed, same icon.
 */
export function defaultPlayerIcon(seed) {
  const text = String(seed ?? '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PLAYER_ICONS[h % PLAYER_ICONS.length].id;
}
