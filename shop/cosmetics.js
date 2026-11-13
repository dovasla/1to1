/* Shop catalog, MOCK copy for testing only. The live prices and gates are in supabase/shop-server.sql (table shop_items).
   Keep these 25 rows in step with that seed. The phone shows what the server sends back.
   Spec: DECISIONS-AND-BRAND.md section 2 (X2) and revamp/build/player-app-plan/XP-SYSTEM.md. */
(function (root) {
  'use strict';

  var SLOT_ORDER = ['banner', 'name', 'calling', 'row', 'clan'];
  var SLOT_LABEL = {
    banner: 'Banners',
    name: 'Name styles',
    calling: 'Calling cards',
    row: 'Row effects',
    clan: 'Clan tags'
  };

  // id, slot, value (the look), name, price (coins), minLevel, minStars
  var ITEMS = [
    { id: 'name-caps',      slot: 'name',    value: 'caps',    name: 'Caps name',     price: 60,   minLevel: 2,  minStars: 0 },
    { id: 'banner-blue',    slot: 'banner',  value: 'blue',    name: 'Blue banner',   price: 90,   minLevel: 4,  minStars: 0 },
    { id: 'clan-tag',       slot: 'clan',    value: 'tag',     name: 'Clan tag',      price: 120,  minLevel: 6,  minStars: 0 },
    { id: 'name-silver',    slot: 'name',    value: 'silver',  name: 'Silver name',   price: 150,  minLevel: 10, minStars: 0 },
    { id: 'banner-silver',  slot: 'banner',  value: 'silver',  name: 'Silver banner', price: 400,  minLevel: 15, minStars: 0 },
    { id: 'calling-blue',   slot: 'calling', value: 'blue',    name: 'Blue card',     price: 450,  minLevel: 18, minStars: 0 },
    { id: 'name-bronze',    slot: 'name',    value: 'bronze',  name: 'Bronze name',   price: 500,  minLevel: 20, minStars: 0 },
    { id: 'banner-bronze',  slot: 'banner',  value: 'bronze',  name: 'Bronze banner', price: 550,  minLevel: 22, minStars: 0 },
    { id: 'calling-court',  slot: 'calling', value: 'court',   name: 'Court card',    price: 700,  minLevel: 25, minStars: 0 },
    { id: 'name-blue',      slot: 'name',    value: 'blue',    name: 'Blue name',     price: 900,  minLevel: 30, minStars: 0 },
    { id: 'banner-black',   slot: 'banner',  value: 'black',   name: 'Black banner',  price: 1500, minLevel: 40, minStars: 0 },
    { id: 'calling-silver', slot: 'calling', value: 'silver',  name: 'Silver card',   price: 2000, minLevel: 45, minStars: 0 },
    { id: 'name-legend',    slot: 'name',    value: 'legend',  name: 'Legend name',   price: 2500, minLevel: 50, minStars: 0 },
    { id: 'calling-black',  slot: 'calling', value: 'black',   name: 'Black card',    price: 3000, minLevel: 55, minStars: 0 },
    { id: 'banner-gold',    slot: 'banner',  value: 'gold',    name: 'Gold banner',   price: 2000, minLevel: 1,  minStars: 1 },
    { id: 'name-gold',      slot: 'name',    value: 'gold',    name: 'Gold name',     price: 2000, minLevel: 1,  minStars: 2 },
    { id: 'banner-ember',   slot: 'banner',  value: 'ember',   name: 'Ember banner',  price: 2200, minLevel: 1,  minStars: 2 },
    { id: 'calling-gold',   slot: 'calling', value: 'gold',    name: 'Gold card',     price: 2500, minLevel: 1,  minStars: 3 },
    { id: 'name-ember',     slot: 'name',    value: 'ember',   name: 'Ember name',    price: 2600, minLevel: 1,  minStars: 3 },
    { id: 'calling-bronze', slot: 'calling', value: 'bronze',  name: 'Bronze card',   price: 2800, minLevel: 1,  minStars: 4 },
    { id: 'calling-ember',  slot: 'calling', value: 'ember',   name: 'Ember card',    price: 3200, minLevel: 1,  minStars: 4 },
    { id: 'row-glow',       slot: 'row',     value: 'glow',    name: 'Glow row',      price: 3000, minLevel: 1,  minStars: 4 },
    { id: 'banner-legend',  slot: 'banner',  value: 'legend',  name: 'Legend banner', price: 4500, minLevel: 1,  minStars: 5 },
    { id: 'calling-legend', slot: 'calling', value: 'legend',  name: 'Legend card',   price: 5000, minLevel: 1,  minStars: 5 },
    { id: 'row-shimmer',    slot: 'row',     value: 'shimmer', name: 'Shimmer row',   price: 5500, minLevel: 1,  minStars: 5 }
  ];

  var api = {
    ITEMS: ITEMS,
    SLOT_ORDER: SLOT_ORDER,
    SLOT_LABEL: SLOT_LABEL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShopCosmetics = api;
})(typeof window !== 'undefined' ? window : globalThis);
