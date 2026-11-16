// 1TO1 picture lookup (patch F, next-66). Pure: no DOM, no network.
// Works out which picture a player shows. Three kinds:
//   svg  a01 to a50 (and later a-batches): local character SVG in ./set/
//   mark i01 to i60: the plain mark, drawn in code (icons/players/player-icons.js)
//   img  v01 to v99: VIP picture, only from the server's list (player_vip_icons), only for VIP players
// Rules (R85): under-18 and hidden players show as "Player" with the default mark i01,
// unless the viewer is that player (opts.self). A v id with no picture to show falls back to the mark.

export const PLAIN_MARK = 'i01';
export const CHARACTER_DIR = 'icons/characters/set/';

const CHARACTER_RE = /^a[0-9]{2,3}$/;
const MARK_RE = /^i[0-9]{2}$/;
const VIP_RE = /^v[0-9]{2}$/;

// player: { icon, name, hidden, under18 }. opts: { self, vip, vipIcons: [{ id, src }] }.
// Returns { kind, id, src, label }. src is '' for a mark.
export function pictureFor(player, opts) {
  const p = player || {};
  const o = opts || {};
  const masked = !o.self && (p.hidden === true || p.under18 === true);
  const label = masked || !p.name ? 'Player' : String(p.name);
  const id = masked ? PLAIN_MARK : String(p.icon || '');
  const mark = { kind: 'mark', id: PLAIN_MARK, src: '', label };

  if (CHARACTER_RE.test(id)) return { kind: 'svg', id, src: CHARACTER_DIR + id + '.svg', label };
  if (MARK_RE.test(id)) return { kind: 'mark', id, src: '', label };
  if (VIP_RE.test(id)) {
    const hit = o.vip && Array.isArray(o.vipIcons)
      ? o.vipIcons.find((x) => x && x.id === id && /^data:image\//.test(String(x.src || '')))
      : null;
    return hit ? { kind: 'img', id, src: hit.src, label } : mark;
  }
  return mark;
}
