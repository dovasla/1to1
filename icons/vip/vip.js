/*
 * VIP / special player helpers (15 Nov 2026). Pure functions, no network here.
 * The server (migration-48 player_vip) decides who has which feature.
 * This file only reads the answer.
 *
 * Adding a VIP feature: add its name to vip_players.features in SQL, then
 * check it on the client with hasVipFeature(features, 'name').
 * Adding a picture: drop a round PNG into the pool folder and add one line to pool.json.
 */

export const VIP_FEATURES = { ICONS: 'vip_icons' };

// features: array from player_vip().features. Anything else means no VIP.
export function hasVipFeature(features, name) {
  return Array.isArray(features) && features.includes(name);
}

// VIP picture ids are v01 to v99. The server sends them only to VIP players with vip_icons, and refuses them for anyone else.
export function isVipPictureId(id) {
  return typeof id === 'string' && /^v[0-9]{2}$/.test(id);
}

// pool: array of { id, file, label } from pool.json. Returns [] unless the player has vip_icons.
export function vipIconOptions(features, pool) {
  if (!hasVipFeature(features, VIP_FEATURES.ICONS)) return [];
  return (Array.isArray(pool) ? pool : []).filter((i) => i && /^v[0-9]{2}$/.test(i.id));
}
