/* Shop catalogue, 144 items in 13 layers (shop-handoff pack, 16 Nov). Design data only.
   The live server still uses the old 25 rows (shop-server.sql) until the SQL job is run (go given by the desk).
   Generated from revamp/review/shop-handoff/items.json. Do not hand-edit; regenerate from the pack. */
(function (root) {
  'use strict';
  var LAYERS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'flourish', 'row', 'ring', 'pose', 'intro', 'pop'];
  var TIERS = ['common', 'rare', 'epic', 'legend'];
  var ITEMS = [
 {
  "id": "bg-court-wood",
  "layer": "background",
  "name": "Court wood",
  "tier": "common",
  "price": 60,
  "unlock": {
   "kind": "level",
   "minLevel": 2,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 1
 },
 {
  "id": "bg-chalk",
  "layer": "background",
  "name": "Chalk",
  "tier": "common",
  "price": 90,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 2
 },
 {
  "id": "bg-street-grit",
  "layer": "background",
  "name": "Street grit",
  "tier": "common",
  "price": 120,
  "unlock": {
   "kind": "level",
   "minLevel": 8,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 3
 },
 {
  "id": "bg-night",
  "layer": "background",
  "name": "Night",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 4
 },
 {
  "id": "bg-hoop-sky",
  "layer": "background",
  "name": "Hoop sky",
  "tier": "rare",
  "price": 450,
  "unlock": {
   "kind": "level",
   "minLevel": 18,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 5
 },
 {
  "id": "bg-blue-court",
  "layer": "background",
  "name": "Blue court",
  "tier": "rare",
  "price": 700,
  "unlock": {
   "kind": "level",
   "minLevel": 25,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 6
 },
 {
  "id": "bg-neon-grid",
  "layer": "background",
  "name": "Neon grid",
  "tier": "epic",
  "price": 1500,
  "unlock": {
   "kind": "level",
   "minLevel": 40,
   "minStars": 0
  },
  "depth": 2,
  "effect": "neon",
  "sort": 7
 },
 {
  "id": "bg-ember",
  "layer": "background",
  "name": "Ember",
  "tier": "epic",
  "price": 2200,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "embers",
  "sort": 8
 },
 {
  "id": "bg-ice",
  "layer": "background",
  "name": "Ice",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "ice",
  "sort": 9
 },
 {
  "id": "bg-gold-foil",
  "layer": "background",
  "name": "Gold foil",
  "tier": "legend",
  "price": 4000,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "gold-foil",
  "sort": 10
 },
 {
  "id": "bg-void",
  "layer": "background",
  "name": "Void",
  "tier": "legend",
  "price": 4500,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "void",
  "sort": 11
 },
 {
  "id": "bg-galaxy",
  "layer": "background",
  "name": "Galaxy",
  "tier": "legend",
  "price": 5000,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "galaxy",
  "sort": 12
 },
 {
  "id": "bg-rainbow-ring",
  "layer": "background",
  "name": "Rainbow ring",
  "tier": "legend",
  "price": 5500,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "rainbow-ring",
  "sort": 13
 },
 {
  "id": "bg-vip-crown",
  "layer": "background",
  "name": "Crown court",
  "tier": "legend",
  "price": 0,
  "unlock": {
   "kind": "vip",
   "vip": true
  },
  "depth": 3,
  "effect": "holo",
  "sort": 14
 },
 {
  "id": "frame-line",
  "layer": "frame",
  "name": "Line",
  "tier": "common",
  "price": 40,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 15
 },
 {
  "id": "frame-double",
  "layer": "frame",
  "name": "Double",
  "tier": "common",
  "price": 110,
  "unlock": {
   "kind": "level",
   "minLevel": 6,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 16
 },
 {
  "id": "frame-notched",
  "layer": "frame",
  "name": "Notched",
  "tier": "common",
  "price": 160,
  "unlock": {
   "kind": "level",
   "minLevel": 10,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 17
 },
 {
  "id": "frame-corner",
  "layer": "frame",
  "name": "Corner marks",
  "tier": "rare",
  "price": 350,
  "unlock": {
   "kind": "level",
   "minLevel": 14,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 18
 },
 {
  "id": "frame-rail",
  "layer": "frame",
  "name": "Rail",
  "tier": "rare",
  "price": 600,
  "unlock": {
   "kind": "level",
   "minLevel": 20,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 19
 },
 {
  "id": "frame-brass",
  "layer": "frame",
  "name": "Brass",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "level",
   "minLevel": 30,
   "minStars": 0
  },
  "depth": 2,
  "effect": "none",
  "sort": 20
 },
 {
  "id": "frame-sharp",
  "layer": "frame",
  "name": "Sharp shooter",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "wins-50",
   "badgeLabel": "Sharp Shooter"
  },
  "depth": 2,
  "effect": "none",
  "sort": 21
 },
 {
  "id": "frame-spark",
  "layer": "frame",
  "name": "Spark",
  "tier": "epic",
  "price": 2400,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "electric",
  "sort": 22
 },
 {
  "id": "frame-ice",
  "layer": "frame",
  "name": "Ice edge",
  "tier": "legend",
  "price": 4200,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "ice",
  "sort": 23
 },
 {
  "id": "frame-flame",
  "layer": "frame",
  "name": "Flame edge",
  "tier": "legend",
  "price": 4400,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "flame",
  "sort": 24
 },
 {
  "id": "frame-plasma",
  "layer": "frame",
  "name": "Plasma edge",
  "tier": "legend",
  "price": 5000,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "plasma",
  "sort": 25
 },
 {
  "id": "frame-vip-crown",
  "layer": "frame",
  "name": "Crown edge",
  "tier": "legend",
  "price": 0,
  "unlock": {
   "kind": "vip",
   "vip": true
  },
  "depth": 3,
  "effect": "holo",
  "sort": 26
 },
 {
  "id": "emblem-ball",
  "layer": "emblem",
  "name": "Ball",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 27
 },
 {
  "id": "emblem-whistle",
  "layer": "emblem",
  "name": "Whistle",
  "tier": "common",
  "price": 80,
  "unlock": {
   "kind": "level",
   "minLevel": 5,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 28
 },
 {
  "id": "emblem-hoop",
  "layer": "emblem",
  "name": "Hoop",
  "tier": "common",
  "price": 130,
  "unlock": {
   "kind": "level",
   "minLevel": 9,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 29
 },
 {
  "id": "emblem-star",
  "layer": "emblem",
  "name": "Star",
  "tier": "rare",
  "price": 380,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 30
 },
 {
  "id": "emblem-bolt",
  "layer": "emblem",
  "name": "Bolt",
  "tier": "rare",
  "price": 650,
  "unlock": {
   "kind": "level",
   "minLevel": 22,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 31
 },
 {
  "id": "emblem-diamond",
  "layer": "emblem",
  "name": "Diamond",
  "tier": "epic",
  "price": 1600,
  "unlock": {
   "kind": "level",
   "minLevel": 40,
   "minStars": 0
  },
  "depth": 2,
  "effect": "none",
  "sort": 32
 },
 {
  "id": "emblem-shield",
  "layer": "emblem",
  "name": "Shield",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "mvp",
   "badgeLabel": "Captain"
  },
  "depth": 2,
  "effect": "none",
  "sort": 33
 },
 {
  "id": "emblem-flame",
  "layer": "emblem",
  "name": "Flame",
  "tier": "epic",
  "price": 2500,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 34
 },
 {
  "id": "emblem-comet",
  "layer": "emblem",
  "name": "Comet",
  "tier": "legend",
  "price": 4100,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "none",
  "sort": 35
 },
 {
  "id": "emblem-orbit",
  "layer": "emblem",
  "name": "Orbit",
  "tier": "legend",
  "price": 4800,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "none",
  "sort": 36
 },
 {
  "id": "emblem-trophy",
  "layer": "emblem",
  "name": "Trophy",
  "tier": "legend",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "points-200",
   "badgeLabel": "Season Champ"
  },
  "depth": 3,
  "effect": "none",
  "sort": 37
 },
 {
  "id": "emblem-crown-vip",
  "layer": "emblem",
  "name": "Crown",
  "tier": "legend",
  "price": 0,
  "unlock": {
   "kind": "vip",
   "vip": true
  },
  "depth": 3,
  "effect": "none",
  "sort": 38
 },
 {
  "id": "title-player",
  "layer": "title",
  "name": "Player",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 3,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 39
 },
 {
  "id": "title-gym-rat",
  "layer": "title",
  "name": "Gym rat",
  "tier": "common",
  "price": 100,
  "unlock": {
   "kind": "level",
   "minLevel": 7,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 40
 },
 {
  "id": "title-sharp",
  "layer": "title",
  "name": "Sharp",
  "tier": "rare",
  "price": 350,
  "unlock": {
   "kind": "level",
   "minLevel": 15,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 41
 },
 {
  "id": "title-captain",
  "layer": "title",
  "name": "Captain",
  "tier": "rare",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "mvp",
   "badgeLabel": "Captain"
  },
  "depth": 1,
  "effect": "none",
  "sort": 42
 },
 {
  "id": "title-closer",
  "layer": "title",
  "name": "Closer",
  "tier": "rare",
  "price": 800,
  "unlock": {
   "kind": "level",
   "minLevel": 26,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 43
 },
 {
  "id": "title-night-owl",
  "layer": "title",
  "name": "Night owl",
  "tier": "rare",
  "price": 900,
  "unlock": {
   "kind": "level",
   "minLevel": 33,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 44
 },
 {
  "id": "title-iron",
  "layer": "title",
  "name": "Iron",
  "tier": "epic",
  "price": 1300,
  "unlock": {
   "kind": "level",
   "minLevel": 34,
   "minStars": 0
  },
  "depth": 2,
  "effect": "none",
  "sort": 45
 },
 {
  "id": "title-floor-general",
  "layer": "title",
  "name": "Floor general",
  "tier": "epic",
  "price": 2300,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 46
 },
 {
  "id": "title-ten-run",
  "layer": "title",
  "name": "Ten Run",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "none",
  "sort": 47
 },
 {
  "id": "title-legend",
  "layer": "title",
  "name": "Legend",
  "tier": "legend",
  "price": 5000,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "none",
  "sort": 48
 },
 {
  "id": "title-founder",
  "layer": "title",
  "name": "Founder",
  "tier": "legend",
  "price": 0,
  "unlock": {
   "kind": "vip",
   "vip": true
  },
  "depth": 3,
  "effect": "none",
  "sort": 49
 },
 {
  "id": "title-iron-will",
  "layer": "title",
  "name": "Iron will",
  "tier": "legend",
  "price": 4300,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "none",
  "sort": 50
 },
 {
  "id": "fx-pulse",
  "layer": "effect",
  "name": "Pulse",
  "tier": "common",
  "price": 250,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 0,
  "effect": "pulse",
  "sort": 51
 },
 {
  "id": "fx-neon",
  "layer": "effect",
  "name": "Neon",
  "tier": "rare",
  "price": 500,
  "unlock": {
   "kind": "level",
   "minLevel": 20,
   "minStars": 0
  },
  "depth": 1,
  "effect": "neon",
  "sort": 52
 },
 {
  "id": "fx-ice",
  "layer": "effect",
  "name": "Ice",
  "tier": "rare",
  "price": 750,
  "unlock": {
   "kind": "level",
   "minLevel": 28,
   "minStars": 0
  },
  "depth": 1,
  "effect": "ice",
  "sort": 53
 },
 {
  "id": "fx-aura",
  "layer": "effect",
  "name": "Aura",
  "tier": "epic",
  "price": 1700,
  "unlock": {
   "kind": "level",
   "minLevel": 45,
   "minStars": 0
  },
  "depth": 2,
  "effect": "aura",
  "sort": 54
 },
 {
  "id": "fx-electric",
  "layer": "effect",
  "name": "Electric",
  "tier": "epic",
  "price": 2000,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "electric",
  "sort": 55
 },
 {
  "id": "fx-embers",
  "layer": "effect",
  "name": "Embers",
  "tier": "epic",
  "price": 2600,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "embers",
  "sort": 56
 },
 {
  "id": "fx-glitch",
  "layer": "effect",
  "name": "Glitch",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "glitch",
  "sort": 57
 },
 {
  "id": "fx-flame",
  "layer": "effect",
  "name": "Flame",
  "tier": "epic",
  "price": 2700,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "flame",
  "sort": 58
 },
 {
  "id": "fx-plasma",
  "layer": "effect",
  "name": "Plasma",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "plasma",
  "sort": 59
 },
 {
  "id": "fx-gold-foil",
  "layer": "effect",
  "name": "Gold foil",
  "tier": "legend",
  "price": 3600,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "gold-foil",
  "sort": 60
 },
 {
  "id": "fx-holo",
  "layer": "effect",
  "name": "Holo",
  "tier": "legend",
  "price": 5200,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "holo",
  "sort": 61
 },
 {
  "id": "fx-void",
  "layer": "effect",
  "name": "Void",
  "tier": "legend",
  "price": 5300,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "void",
  "sort": 62
 },
 {
  "id": "fx-galaxy",
  "layer": "effect",
  "name": "Galaxy",
  "tier": "legend",
  "price": 5400,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "galaxy",
  "sort": 63
 },
 {
  "id": "fx-rainbow-ring",
  "layer": "effect",
  "name": "Rainbow ring",
  "tier": "legend",
  "price": 5600,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "rainbow-ring",
  "sort": 64
 },
 {
  "id": "name-plain",
  "layer": "name",
  "name": "Plain",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 65
 },
 {
  "id": "name-caps",
  "layer": "name",
  "name": "Caps",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 66
 },
 {
  "id": "name-spaced",
  "layer": "name",
  "name": "Spaced",
  "tier": "common",
  "price": 70,
  "unlock": {
   "kind": "level",
   "minLevel": 7,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 67
 },
 {
  "id": "name-outline",
  "layer": "name",
  "name": "Outline",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 68
 },
 {
  "id": "name-italic",
  "layer": "name",
  "name": "Italic",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 69
 },
 {
  "id": "name-slant",
  "layer": "name",
  "name": "Slant",
  "tier": "rare",
  "price": 420,
  "unlock": {
   "kind": "level",
   "minLevel": 20,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 70
 },
 {
  "id": "name-stamp",
  "layer": "name",
  "name": "Stamp",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 71
 },
 {
  "id": "name-chrome",
  "layer": "name",
  "name": "Chrome",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "gold-foil",
  "sort": 72
 },
 {
  "id": "name-neon",
  "layer": "name",
  "name": "Neon",
  "tier": "epic",
  "price": 1500,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "neon",
  "sort": 73
 },
 {
  "id": "name-glitch",
  "layer": "name",
  "name": "Glitch",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "glitch",
  "sort": 74
 },
 {
  "id": "name-ice",
  "layer": "name",
  "name": "Ice",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "ice",
  "sort": 75
 },
 {
  "id": "name-ember",
  "layer": "name",
  "name": "Ember",
  "tier": "legend",
  "price": 4100,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "embers",
  "sort": 76
 },
 {
  "id": "name-rainbow",
  "layer": "name",
  "name": "Rainbow",
  "tier": "legend",
  "price": 4400,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "rainbow-ring",
  "sort": 77
 },
 {
  "id": "name-void",
  "layer": "name",
  "name": "Void",
  "tier": "legend",
  "price": 4700,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "void",
  "sort": 78
 },
 {
  "id": "card-flat-card",
  "layer": "card",
  "name": "Flat card",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 79
 },
 {
  "id": "card-ticket",
  "layer": "card",
  "name": "Ticket",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 80
 },
 {
  "id": "card-split",
  "layer": "card",
  "name": "Split",
  "tier": "common",
  "price": 70,
  "unlock": {
   "kind": "level",
   "minLevel": 7,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 81
 },
 {
  "id": "card-court-lines",
  "layer": "card",
  "name": "Court lines",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 82
 },
 {
  "id": "card-scoreboard",
  "layer": "card",
  "name": "Scoreboard",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 83
 },
 {
  "id": "card-hoop-arc",
  "layer": "card",
  "name": "Hoop arc",
  "tier": "rare",
  "price": 420,
  "unlock": {
   "kind": "level",
   "minLevel": 20,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 84
 },
 {
  "id": "card-tape",
  "layer": "card",
  "name": "Tape",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 85
 },
 {
  "id": "card-badge-plate",
  "layer": "card",
  "name": "Badge plate",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "none",
  "sort": 86
 },
 {
  "id": "card-glass",
  "layer": "card",
  "name": "Glass",
  "tier": "epic",
  "price": 1500,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "ice",
  "sort": 87
 },
 {
  "id": "card-night-pass",
  "layer": "card",
  "name": "Night pass",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "galaxy",
  "sort": 88
 },
 {
  "id": "card-trophy-case",
  "layer": "card",
  "name": "Trophy case",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "gold-foil",
  "sort": 89
 },
 {
  "id": "card-holo-card",
  "layer": "card",
  "name": "Holo card",
  "tier": "legend",
  "price": 4100,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "holo",
  "sort": 90
 },
 {
  "id": "flourish-corner-tick",
  "layer": "flourish",
  "name": "Corner tick",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 91
 },
 {
  "id": "flourish-dot-trail",
  "layer": "flourish",
  "name": "Dot trail",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 92
 },
 {
  "id": "flourish-scanline",
  "layer": "flourish",
  "name": "Scanline",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 93
 },
 {
  "id": "flourish-sparkle-corners",
  "layer": "flourish",
  "name": "Sparkle corners",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 94
 },
 {
  "id": "flourish-pixel-dust",
  "layer": "flourish",
  "name": "Pixel dust",
  "tier": "rare",
  "price": 420,
  "unlock": {
   "kind": "level",
   "minLevel": 20,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 95
 },
 {
  "id": "flourish-frost-ring",
  "layer": "flourish",
  "name": "Frost ring",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "ice",
  "sort": 96
 },
 {
  "id": "flourish-flame-trail",
  "layer": "flourish",
  "name": "Flame trail",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "flame",
  "sort": 97
 },
 {
  "id": "flourish-star-on-level",
  "layer": "flourish",
  "name": "Star on level",
  "tier": "epic",
  "price": 1500,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 98
 },
 {
  "id": "flourish-aura-pulse",
  "layer": "flourish",
  "name": "Aura pulse",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "aura",
  "sort": 99
 },
 {
  "id": "flourish-plasma-trail",
  "layer": "flourish",
  "name": "Plasma trail",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "plasma",
  "sort": 100
 },
 {
  "id": "pose-hands-up",
  "layer": "pose",
  "name": "Hands up",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 101
 },
 {
  "id": "pose-lay-up",
  "layer": "pose",
  "name": "Lay-up",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 102
 },
 {
  "id": "pose-tip-off",
  "layer": "pose",
  "name": "Tip-off",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 103
 },
 {
  "id": "pose-three-point",
  "layer": "pose",
  "name": "Three-point",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 104
 },
 {
  "id": "pose-coach-nod",
  "layer": "pose",
  "name": "Coach nod",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 105
 },
 {
  "id": "pose-dunk-stance",
  "layer": "pose",
  "name": "Dunk stance",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "none",
  "sort": 106
 },
 {
  "id": "pose-crown-pose",
  "layer": "pose",
  "name": "Crown pose",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "holo",
  "sort": 107
 },
 {
  "id": "pose-fist",
  "layer": "pose",
  "name": "Fist",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "none",
  "sort": 108
 },
 {
  "id": "intro-tip-off-card",
  "layer": "intro",
  "name": "Tip-off card",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 109
 },
 {
  "id": "intro-door-swing",
  "layer": "intro",
  "name": "Door swing",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 110
 },
 {
  "id": "intro-spotlight",
  "layer": "intro",
  "name": "Spotlight",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 111
 },
 {
  "id": "intro-ticket-punch",
  "layer": "intro",
  "name": "Ticket punch",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 112
 },
 {
  "id": "intro-floodlights",
  "layer": "intro",
  "name": "Floodlights",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 113
 },
 {
  "id": "intro-scoreboard-flip",
  "layer": "intro",
  "name": "Scoreboard flip",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "none",
  "sort": 114
 },
 {
  "id": "intro-court-slam",
  "layer": "intro",
  "name": "Court slam",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "electric",
  "sort": 115
 },
 {
  "id": "intro-silent-fade",
  "layer": "intro",
  "name": "Silent fade",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "void",
  "sort": 116
 },
 {
  "id": "pop-plain-pop",
  "layer": "pop",
  "name": "Plain pop",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 117
 },
 {
  "id": "pop-bubble",
  "layer": "pop",
  "name": "Bubble",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 118
 },
 {
  "id": "pop-double-pop",
  "layer": "pop",
  "name": "Double pop",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 119
 },
 {
  "id": "pop-neon-pop",
  "layer": "pop",
  "name": "Neon pop",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "neon",
  "sort": 120
 },
 {
  "id": "pop-ember-burst",
  "layer": "pop",
  "name": "Ember burst",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "embers",
  "sort": 121
 },
 {
  "id": "pop-ice-shatter",
  "layer": "pop",
  "name": "Ice shatter",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "ice",
  "sort": 122
 },
 {
  "id": "pop-glitch-pop",
  "layer": "pop",
  "name": "Glitch pop",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "glitch",
  "sort": 123
 },
 {
  "id": "pop-gold-burst",
  "layer": "pop",
  "name": "Gold burst",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "gold-foil",
  "sort": 124
 },
 {
  "id": "row-plain-row",
  "layer": "row",
  "name": "Plain row",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 125
 },
 {
  "id": "row-striped",
  "layer": "row",
  "name": "Striped",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 126
 },
 {
  "id": "row-tape-row",
  "layer": "row",
  "name": "Tape row",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 127
 },
 {
  "id": "row-gradient-bar",
  "layer": "row",
  "name": "Gradient bar",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 128
 },
 {
  "id": "row-split-bar",
  "layer": "row",
  "name": "Split bar",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "none",
  "sort": 129
 },
 {
  "id": "row-gold-rail",
  "layer": "row",
  "name": "Gold rail",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "gold-foil",
  "sort": 130
 },
 {
  "id": "row-ice-rail",
  "layer": "row",
  "name": "Ice rail",
  "tier": "epic",
  "price": 1500,
  "unlock": {
   "kind": "stars",
   "minStars": 2,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "ice",
  "sort": 131
 },
 {
  "id": "row-neon-rail",
  "layer": "row",
  "name": "Neon rail",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "neon",
  "sort": 132
 },
 {
  "id": "row-ember-rail",
  "layer": "row",
  "name": "Ember rail",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "embers",
  "sort": 133
 },
 {
  "id": "row-void-rail",
  "layer": "row",
  "name": "Void rail",
  "tier": "legend",
  "price": 4100,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "void",
  "sort": 134
 },
 {
  "id": "ring-thin-ring",
  "layer": "ring",
  "name": "Thin ring",
  "tier": "common",
  "price": 30,
  "unlock": {
   "kind": "level",
   "minLevel": 1,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 135
 },
 {
  "id": "ring-dashed-ring",
  "layer": "ring",
  "name": "Dashed ring",
  "tier": "common",
  "price": 50,
  "unlock": {
   "kind": "level",
   "minLevel": 4,
   "minStars": 0
  },
  "depth": 0,
  "effect": "none",
  "sort": 136
 },
 {
  "id": "ring-double-ring",
  "layer": "ring",
  "name": "Double ring",
  "tier": "rare",
  "price": 300,
  "unlock": {
   "kind": "level",
   "minLevel": 12,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 137
 },
 {
  "id": "ring-hoop-ring",
  "layer": "ring",
  "name": "Hoop ring",
  "tier": "rare",
  "price": 360,
  "unlock": {
   "kind": "level",
   "minLevel": 16,
   "minStars": 0
  },
  "depth": 1,
  "effect": "none",
  "sort": 138
 },
 {
  "id": "ring-pulse-ring",
  "layer": "ring",
  "name": "Pulse ring",
  "tier": "epic",
  "price": 1200,
  "unlock": {
   "kind": "stars",
   "minStars": 1,
   "minLevel": 1
  },
  "depth": 2,
  "effect": "pulse",
  "sort": 139
 },
 {
  "id": "ring-flame-ring",
  "layer": "ring",
  "name": "Flame ring",
  "tier": "epic",
  "price": 0,
  "unlock": {
   "kind": "badge",
   "badge": "iron-10",
   "badgeLabel": "Ten Run"
  },
  "depth": 2,
  "effect": "flame",
  "sort": 140
 },
 {
  "id": "ring-ice-ring",
  "layer": "ring",
  "name": "Ice ring",
  "tier": "legend",
  "price": 3500,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "ice",
  "sort": 141
 },
 {
  "id": "ring-gold-ring",
  "layer": "ring",
  "name": "Gold ring",
  "tier": "legend",
  "price": 3800,
  "unlock": {
   "kind": "stars",
   "minStars": 4,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "gold-foil",
  "sort": 142
 },
 {
  "id": "ring-holo-ring",
  "layer": "ring",
  "name": "Holo ring",
  "tier": "legend",
  "price": 4100,
  "unlock": {
   "kind": "stars",
   "minStars": 5,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "holo",
  "sort": 143
 },
 {
  "id": "ring-rainbow-ring",
  "layer": "ring",
  "name": "Rainbow ring",
  "tier": "legend",
  "price": 4400,
  "unlock": {
   "kind": "stars",
   "minStars": 3,
   "minLevel": 1
  },
  "depth": 3,
  "effect": "rainbow-ring",
  "sort": 144
 }
];
  var api = { LAYERS: LAYERS, TIERS: TIERS, ITEMS: ITEMS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShopCatalogue = api;
})(typeof window !== 'undefined' ? window : globalThis);
