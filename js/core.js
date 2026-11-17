/* Trait de Plan \u2014 c\u0153ur : mod\u00e8le, g\u00e9om\u00e9trie, catalogues, calculs, g\u00e9n\u00e9rateur, op\u00e9rations.
   Aucun acc\u00e8s au DOM : ce fichier est charg\u00e9 tel quel par les tests Node. */
(function (G) {
'use strict';
const TP = G.TP = G.TP || {};

/* ---------------- utilitaires ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), n2 = v => Math.round(v * 100) / 100, r5 = v => Math.round(v / 5) * 5;
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019']/g, ' ').replace(/\s+/g, ' ').trim();
function shade(hex, a) { const n = parseInt(String(hex).slice(1), 16); if (!isFinite(n)) return hex; const r = n >> 16, g = n >> 8 & 255, b = n & 255; const f = v => Math.round(clamp(a >= 0 ? v + (255 - v) * a : v * (1 + a), 0, 255)); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const eur = v => Math.round(v).toLocaleString('fr-FR') + ' \u20ac';

/* ---------------- unit\u00e9s ---------------- */
let UNIT = 'm';
const setUnit = u => { UNIT = ['m', 'cm', 'mm'].includes(u) ? u : 'm'; };
function fmtLen(cm, withUnit, unit) { const u = unit || UNIT; let s; if (u === 'm') s = (cm / 100).toFixed(2).replace('.', ','); else if (u === 'cm') s = String(Math.round(cm)); else s = String(Math.round(cm * 10)); return withUnit ? s + ' ' + u : s; }
function parseLen(str, unit) { const u = unit || UNIT; const v = parseFloat(String(str).replace(',', '.').replace(/\s/g, '')); if (!isFinite(v)) return NaN; return u === 'm' ? v * 100 : u === 'cm' ? v : v / 10; }
const fmtArea = cm2 => (cm2 / 10000).toFixed(2).replace('.', ',') + ' m\u00b2';
const m2 = cm2 => Math.round(cm2 / 100) / 100;
const fr = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');

/* ---------------- catalogues ---------------- */
const CATS = [['salon', 'Salon'], ['repas', 'Salle \u00e0 manger'], ['cuisine', 'Cuisine et \u00e9lectrom\u00e9nager'], ['chambre', 'Chambre'], ['bain', 'Salle de bain et buanderie'], ['bureau', 'Bureau'], ['luminaire', 'Luminaires'], ['deco', 'D\u00e9coration'], ['structure', 'Escaliers et structure'], ['ouverture', 'Portes et fen\u00eatres'], ['jardin', 'Jardin et ext\u00e9rieur'], ['piscine', 'Piscines et spa'], ['vehicule', 'V\u00e9hicules'], ['modeles', 'Mes mod\u00e8les 3D']];
// free: pos\u00e9 librement (pas d'adossement au mur) ; role : utilis\u00e9 par les styles
const FURN = {
  sofa: { n: 'Canap\u00e9 3 places', cat: 'salon', w: 210, d: 92, h: 82, c: '#7D8C9C', p: 690, role: 'fabric' },
  sofaL: { n: "Canap\u00e9 d'angle", cat: 'salon', w: 270, d: 180, h: 82, c: '#9A9EA4', p: 1190, role: 'fabric' },
  arm: { n: 'Fauteuil', cat: 'salon', w: 80, d: 82, h: 80, c: '#B66A4C', p: 290, role: 'accent' },
  coffee: { n: 'Table basse', cat: 'salon', w: 110, d: 60, h: 40, c: '#C9A27A', p: 149, role: 'wood', free: 1 },
  tv: { n: 'Meuble TV et \u00e9cran', cat: 'salon', w: 180, d: 42, h: 50, c: '#3E4247', p: 520 },
  book: { n: 'Biblioth\u00e8que', cat: 'salon', w: 100, d: 35, h: 200, c: '#C9A27A', p: 179, role: 'wood' },
  rug: { n: 'Tapis', cat: 'deco', w: 200, d: 140, h: 1, c: '#C9B99B', p: 120, free: 1, role: 'rug' },
  table6: { n: 'Table 6 places', cat: 'repas', w: 180, d: 90, h: 75, c: '#C9A27A', p: 640, free: 1, role: 'wood' },
  table4: { n: 'Table 4 places', cat: 'repas', w: 120, d: 80, h: 75, c: '#F2F2EF', p: 390, free: 1, role: 'wood' },
  tround: { n: 'Table ronde', cat: 'repas', w: 110, d: 110, h: 75, c: '#7A5536', p: 420, free: 1, role: 'wood' },
  chair: { n: 'Chaise', cat: 'repas', w: 45, d: 50, h: 88, c: '#3E4247', p: 69, free: 1 },
  buffet: { n: 'Buffet', cat: 'repas', w: 180, d: 45, h: 85, c: '#7A5536', p: 480, role: 'wood' },
  kitchen: { n: 'Cuisine lin\u00e9aire 3 m', cat: 'cuisine', w: 300, d: 62, h: 90, c: '#F2F2EF', p: 3200, role: 'kitchen' },
  kitchenL: { n: 'Cuisine en L', cat: 'cuisine', w: 300, d: 240, h: 90, c: '#F2F2EF', p: 4600, role: 'kitchen' },
  island: { n: '\u00celot central', cat: 'cuisine', w: 180, d: 90, h: 92, c: '#5C7590', p: 1450, free: 1, role: 'kitchen' },
  fridge: { n: 'R\u00e9frig\u00e9rateur', cat: 'cuisine', w: 60, d: 66, h: 185, c: '#D9DBDD', p: 690, role: 'appliance' },
  oven: { n: 'Colonne four', cat: 'cuisine', w: 60, d: 62, h: 215, c: '#F2F2EF', p: 640, role: 'kitchen' },
  dishw: { n: 'Lave-vaisselle', cat: 'cuisine', w: 60, d: 60, h: 85, c: '#E4E6E8', p: 420, role: 'appliance' },
  stool: { n: 'Tabouret de bar', cat: 'cuisine', w: 40, d: 40, h: 75, c: '#C9A27A', p: 59, free: 1 },
  bed2: { n: 'Lit double 160', cat: 'chambre', w: 160, d: 205, h: 100, c: '#E7DCC8', p: 820, role: 'bed' },
  bed1: { n: 'Lit simple 90', cat: 'chambre', w: 90, d: 195, h: 90, c: '#B8C6D1', p: 340, role: 'bed' },
  night: { n: 'Table de chevet', cat: 'chambre', w: 45, d: 40, h: 50, c: '#C9A27A', p: 79, role: 'wood' },
  ward: { n: 'Armoire', cat: 'chambre', w: 150, d: 60, h: 220, c: '#F2F2EF', p: 560 },
  dresser: { n: 'Commode', cat: 'chambre', w: 100, d: 50, h: 85, c: '#C9A27A', p: 260, role: 'wood' },
  bath: { n: 'Baignoire', cat: 'bain', w: 170, d: 75, h: 58, c: '#F7F7F5', p: 450 },
  shower: { n: "Douche \u00e0 l'italienne", cat: 'bain', w: 120, d: 90, h: 200, c: '#E6ECEF', p: 890 },
  wc: { n: 'WC suspendu', cat: 'bain', w: 40, d: 55, h: 80, c: '#F7F7F5', p: 320 },
  vanity: { n: 'Meuble vasque', cat: 'bain', w: 80, d: 48, h: 85, c: '#7A5536', p: 380, role: 'wood' },
  vanity2: { n: 'Double vasque', cat: 'bain', w: 140, d: 48, h: 85, c: '#F2F2EF', p: 690 },
  washer: { n: 'Lave-linge', cat: 'bain', w: 60, d: 60, h: 85, c: '#F2F2EF', p: 450, role: 'appliance' },
  dryer: { n: 'S\u00e8che-linge', cat: 'bain', w: 60, d: 60, h: 85, c: '#F2F2EF', p: 420, role: 'appliance' },
  desk: { n: 'Bureau', cat: 'bureau', w: 140, d: 70, h: 75, c: '#F2F2EF', p: 230, role: 'wood' },
  ochair: { n: 'Fauteuil de bureau', cat: 'bureau', w: 62, d: 62, h: 110, c: '#3E4247', p: 179, free: 1 },
  shelf: { n: '\u00c9tag\u00e8re', cat: 'bureau', w: 80, d: 30, h: 180, c: '#3E4247', p: 99 },
  lamp: { n: 'Lampadaire', cat: 'luminaire', w: 40, d: 40, h: 170, c: '#2B2D30', p: 89, free: 1, light: 1 },
  pendant: { n: 'Suspension', cat: 'luminaire', w: 50, d: 50, h: 35, c: '#2B2D30', p: 120, free: 1, light: 1, hang: 1 },
  tlamp: { n: 'Lampe \u00e0 poser', cat: 'luminaire', w: 30, d: 30, h: 48, c: '#F1E9D8', p: 60, free: 1, light: 1, z: 75 },
  sconce: { n: 'Applique murale', cat: 'luminaire', w: 22, d: 14, h: 26, c: '#C9A043', p: 70, light: 1, z: 185 },
  plant: { n: 'Plante', cat: 'deco', w: 50, d: 50, h: 110, c: '#5C8F45', p: 45, free: 1 },
  plant2: { n: 'Ficus', cat: 'deco', w: 60, d: 60, h: 180, c: '#4E7F3C', p: 95, free: 1 },
  frame: { n: 'Tableau', cat: 'deco', w: 80, d: 4, h: 60, c: '#C9A043', p: 90, z: 130 },
  mirror: { n: 'Miroir', cat: 'deco', w: 60, d: 4, h: 100, c: '#C9C9C2', p: 110, z: 100 },
  vase: { n: 'Vase', cat: 'deco', w: 24, d: 24, h: 40, c: '#5E7184', p: 35, free: 1 },
  stairs: { n: 'Escalier droit', cat: 'structure', w: 90, d: 300, h: 0, c: '#C9A27A', p: 3500, stair: 'straight' },
  stairsL: { n: 'Escalier quart tournant', cat: 'structure', w: 200, d: 260, h: 0, c: '#C9A27A', p: 4800, stair: 'L' },
  spiral: { n: 'Escalier h\u00e9lico\u00efdal', cat: 'structure', w: 160, d: 160, h: 0, c: '#3E4247', p: 5200, stair: 'spiral', free: 1 },
  fireplace: { n: 'Chemin\u00e9e', cat: 'structure', w: 120, d: 55, h: 110, c: '#E8E4DC', p: 4500, flue: 1 },
  balcony: { n: 'Balcon', cat: 'structure', w: 300, d: 140, h: 110, c: '#B9BCBF', p: 3800 },
  column: { n: 'Poteau', cat: 'structure', w: 25, d: 25, h: 0, c: '#D9D6D0', p: 450, free: 1, full: 1 },
  gtable: { n: 'Salon de jardin', cat: 'jardin', w: 180, d: 90, h: 74, c: '#9C7A55', p: 520, free: 1 },
  lounger: { n: 'Bain de soleil', cat: 'jardin', w: 70, d: 195, h: 35, c: '#F2F2EF', p: 149, free: 1 },
  parasol: { n: 'Parasol', cat: 'jardin', w: 270, d: 270, h: 250, c: '#C9A043', p: 129, free: 1 },
  bench: { n: 'Banc', cat: 'jardin', w: 150, d: 50, h: 80, c: '#9C7A55', p: 160, free: 1 },
  planter: { n: 'Potager sur\u00e9lev\u00e9', cat: 'jardin', w: 200, d: 100, h: 45, c: '#8A6A4A', p: 180, free: 1 },
  shed: { n: 'Abri de jardin', cat: 'jardin', w: 300, d: 240, h: 230, c: '#8A6A4A', p: 2400, free: 1 },
  tree: { n: 'Arbre', cat: 'jardin', w: 320, d: 320, h: 550, c: '#4E7F3C', p: 0, free: 1 },
  tree2: { n: 'Conif\u00e8re', cat: 'jardin', w: 200, d: 200, h: 600, c: '#3F6B3A', p: 0, free: 1 },
  bush: { n: 'Arbuste', cat: 'jardin', w: 90, d: 90, h: 110, c: '#5C8F45', p: 40, free: 1 },
  pool: { n: 'Piscine 8 \u00d7 4 m', cat: 'piscine', w: 800, d: 400, h: 0, c: '#5FB3DA', p: 26000, free: 1, pool: 1 },
  poolS: { n: 'Bassin 5 \u00d7 2,5 m', cat: 'piscine', w: 500, d: 250, h: 0, c: '#5FB3DA', p: 16000, free: 1, pool: 1 },
  spa: { n: 'Spa', cat: 'piscine', w: 210, d: 210, h: 90, c: '#8A6A4A', p: 7500, free: 1 },
  car: { n: 'Voiture', cat: 'vehicule', w: 180, d: 450, h: 145, c: '#5C7590', p: 0, free: 1 },
  suv: { n: 'SUV', cat: 'vehicule', w: 190, d: 470, h: 170, c: '#3E4247', p: 0, free: 1 },
  bike: { n: 'V\u00e9lo', cat: 'vehicule', w: 60, d: 175, h: 100, c: '#B66A4C', p: 0, free: 1 }
};
const STRUCT_TYPES = ['stairs', 'stairsL', 'spiral', 'fireplace', 'balcony', 'column', 'pool', 'poolS', 'spa', 'shed'];

const MATS = {
  oak: { n: 'Parquet ch\u00eane', c: '#C9A274', tex: 'planks', m: 1.2, p: 70 },
  oakLight: { n: 'Parquet ch\u00eane clair', c: '#DCC6A0', tex: 'planks', m: 1.2, p: 75 },
  walnut: { n: 'Parquet noyer', c: '#7E5A3C', tex: 'planks', m: 1.2, p: 95 },
  herring: { n: 'Point de Hongrie', c: '#B88E62', tex: 'herring', m: 0.8, p: 110 },
  tileW: { n: 'Carrelage clair 60', c: '#E8E5DF', tex: 'tiles', k: 2, m: 1.2, p: 55 },
  tileG: { n: 'Carrelage gris 60', c: '#9EA2A4', tex: 'tiles', k: 2, m: 1.2, p: 55 },
  tileBig: { n: 'Gr\u00e8s 120 \u00d7 60', c: '#D8D1C6', tex: 'tilesBig', m: 2.4, p: 75 },
  cement: { n: 'Carreaux ciment', c: '#D9D2C2', tex: 'cement', m: 0.8, p: 85 },
  marble: { n: 'Marbre', c: '#ECEAE6', tex: 'marble', m: 1.6, p: 160 },
  concrete: { n: 'B\u00e9ton cir\u00e9', c: '#B8B5AF', tex: 'noise', m: 2, p: 90 },
  carpet: { n: 'Moquette', c: '#8E929C', tex: 'noise', m: 1, p: 30 },
  lawn: { n: 'Pelouse', c: '#6E9A4A', tex: 'grass', m: 2, ext: 1, p: 8 },
  deck: { n: 'Terrasse bois', c: '#A9845C', tex: 'planks', m: 1.2, ext: 1, p: 120 },
  pavers: { n: 'Dalles', c: '#C8C1B4', tex: 'tiles', k: 2, m: 1, ext: 1, p: 65 },
  stone: { n: 'Dallage pierre', c: '#CBBFA9', tex: 'flagstone', m: 1.6, ext: 1, p: 110 },
  gravel: { n: 'Gravier', c: '#CEC8BC', tex: 'gravel', m: 1, ext: 1, p: 15 },
  asphalt: { n: 'Enrob\u00e9', c: '#5B5E62', tex: 'noise', m: 2, ext: 1, p: 45 },
  water: { n: 'Bassin', c: '#5FB3DA', tex: 'water', m: 2, ext: 1, p: 300 }
};
const FACADES = {
  'enduit-blanc': { n: 'Enduit blanc', c: '#EEEBE4', tex: 'render', m: 2, p: 45 },
  'enduit-sable': { n: 'Enduit sable', c: '#E2D3B4', tex: 'render', m: 2, p: 45 },
  'enduit-gris': { n: 'Enduit gris', c: '#B9BBBA', tex: 'render', m: 2, p: 45 },
  'bardage-bois': { n: 'Bardage bois', c: '#A57B52', tex: 'vboards', m: 1.2, p: 95 },
  'bardage-gris': { n: 'Bardage gris', c: '#6A7077', tex: 'vboards', m: 1.2, p: 90 },
  'bardage-noir': { n: 'Bardage noir', c: '#2E3236', tex: 'vboards', m: 1.2, p: 95 },
  'brique': { n: 'Brique', c: '#A65A3F', tex: 'brick', m: 1, p: 120 },
  'pierre': { n: 'Pierre', c: '#C9BBA2', tex: 'stone', m: 1.4, p: 190 },
  'beton': { n: 'B\u00e9ton brut', c: '#A9A8A3', tex: 'concrete', m: 2.4, p: 70 }
};
const ROOFMATS = {
  'tuiles-rouges': { n: 'Tuiles terre cuite', c: '#A9553A', tex: 'rooftiles', m: 1, p: 110, per: 13, unit: 'tuiles' },
  'tuiles-grises': { n: 'Tuiles grises', c: '#5D6166', tex: 'rooftiles', m: 1, p: 110, per: 13, unit: 'tuiles' },
  'ardoise': { n: 'Ardoise', c: '#3F4549', tex: 'slate', m: 1, p: 150, per: 25, unit: 'ardoises' },
  'zinc': { n: 'Zinc joint debout', c: '#8D969C', tex: 'seam', m: 1.5, p: 140 },
  'bac-acier': { n: 'Bac acier', c: '#3B4045', tex: 'seam', m: 1.5, p: 75 },
  'gravier': { n: 'Toit-terrasse gravillonn\u00e9', c: '#B9B4AA', tex: 'gravel', m: 1, p: 120 },
  'vegetal': { n: 'Toiture v\u00e9g\u00e9talis\u00e9e', c: '#6E8F4E', tex: 'grass', m: 2, p: 165 }
};
const PAINTS = [['#F2EEE6', 'Blanc cass\u00e9'], ['#FFFFFF', 'Blanc pur'], ['#E7DCC8', 'Lin'], ['#C9D3C0', 'Sauge'], ['#B8C6D1', 'Bleu brume'], ['#5E7184', 'Bleu ardoise'], ['#D9A88A', 'Terre cuite'], ['#CFCBC4', 'Gris perle'], ['#4A4D52', 'Anthracite'], ['#E9D79A', 'Jaune paille'], ['#C7B3C9', 'Lavande'], ['#2F4A3E', 'Vert for\u00eat']];
const FCOLORS = [['#C9A27A', 'Ch\u00eane'], ['#7A5536', 'Noyer'], ['#F2F2EF', 'Blanc'], ['#9A9EA4', 'Gris clair'], ['#3E4247', 'Anthracite'], ['#8FA58A', 'Sauge'], ['#5C7590', 'Bleu'], ['#B66A4C', 'Terracotta'], ['#C9A043', 'Moutarde'], ['#E7DCC8', 'Lin']];
const FRAMES = [['#F4F4F2', 'Blanc'], ['#3A3F45', 'Anthracite'], ['#1E2023', 'Noir'], ['#9A7350', 'Ch\u00eane'], ['#8F9599', 'Gris alu']];
const WALLKINDS = { wall: 'Mur', low: 'Muret', fence: 'Cl\u00f4ture', hedge: 'Haie' };
const WALLDEF = { wall: null, low: 20, fence: 6, hedge: 60 };
// ouvertures : leaf = type de vantail ; sill = all\u00e8ge (cm) ; h = hauteur (cm)
const OPDEF = {
  door: { n: 'Porte int\u00e9rieure', w: 83, min: 60, max: 120, h: 204, sill: 0, leaf: 'swing', p: 320 },
  door2: { n: 'Porte double', w: 146, min: 120, max: 200, h: 204, sill: 0, leaf: 'double', p: 650 },
  slide: { n: 'Porte coulissante', w: 83, min: 60, max: 180, h: 204, sill: 0, leaf: 'slide', p: 450 },
  entry: { n: "Porte d'entr\u00e9e", w: 95, min: 80, max: 140, h: 215, sill: 0, leaf: 'swing', p: 1600, ext: 1 },
  passage: { n: 'Passage libre', w: 90, min: 60, max: 500, h: 210, sill: 0, leaf: 'none', p: 0 },
  window: { n: 'Fen\u00eatre 2 vantaux', w: 120, min: 60, max: 240, h: 125, sill: 95, leaf: 'glass', p: 650, ext: 1 },
  window1: { n: 'Fen\u00eatre 1 vantail', w: 60, min: 40, max: 100, h: 95, sill: 115, leaf: 'glass', p: 420, ext: 1 },
  fixed: { n: 'Fen\u00eatre fixe', w: 100, min: 40, max: 500, h: 120, sill: 90, leaf: 'fixed', p: 500, ext: 1 },
  frenchdoor: { n: 'Porte-fen\u00eatre', w: 140, min: 70, max: 200, h: 215, sill: 0, leaf: 'french', p: 1100, ext: 1 },
  bay: { n: 'Baie coulissante', w: 240, min: 160, max: 600, h: 215, sill: 0, leaf: 'bay', p: 2400, ext: 1 },
  garage: { n: 'Porte de garage', w: 240, min: 200, max: 600, h: 200, sill: 0, leaf: 'garage', p: 1900, ext: 1 },
  gate: { n: 'Portail', w: 300, min: 100, max: 600, h: 140, sill: 0, leaf: 'gate', p: 2200, ext: 1 }
};
const isGlazed = k => ['window', 'window1', 'fixed', 'frenchdoor', 'bay'].includes(k);
const isWindow = k => ['window', 'window1', 'fixed'].includes(k);
const isDoorLike = k => !isWindow(k);
const ROOFTYPES = { gable: 'Deux pans', hip: 'Quatre pans', shed: 'Monopente', flat: 'Toit plat' };
const ROOMTYPES = { sejcuis: 'S\u00e9jour / cuisine', sejour: 'S\u00e9jour', cuisine: 'Cuisine', chambre: 'Chambre', sdb: 'Salle de bain', wc: 'WC', entree: 'Entr\u00e9e', couloir: 'D\u00e9gagement', bureau: 'Bureau', cellier: 'Cellier', garage: 'Garage', autre: 'Autre pi\u00e8ce', exterieur: 'Ext\u00e9rieur' };
const LEVELKINDS = { 'sous-sol': 'Sous-sol', rdc: 'Rez-de-chauss\u00e9e', etage: '\u00c9tage', combles: 'Combles' };
const STYLES = {
  contemporain: { n: 'Contemporain', facade: 'enduit-blanc', accent: 'bardage-bois', roof: { type: 'flat', mat: 'gravier', pitch: 0, over: 10 }, frame: '#3A3F45', floors: { day: 'concrete', night: 'oak', wet: 'tileG', entree: 'tileG', garage: 'concrete' }, paints: { day: '#F2EEE6', night: '#E7DCC8', wet: '#FFFFFF' }, pal: { fabric: '#9A9EA4', wood: '#C9A27A', accent: '#3E4247', bed: '#E7DCC8', kitchen: '#3E4247' } },
  traditionnel: { n: 'Traditionnel', facade: 'enduit-sable', accent: null, roof: { type: 'gable', mat: 'tuiles-rouges', pitch: 35, over: 40 }, frame: '#F4F4F2', floors: { day: 'tileW', night: 'oak', wet: 'tileW', entree: 'tileW', garage: 'concrete' }, paints: { day: '#F2EEE6', night: '#E7DCC8', wet: '#F2EEE6' }, pal: { fabric: '#B66A4C', wood: '#7A5536', accent: '#C9A043', bed: '#F2EEE6', kitchen: '#F2F2EF' } },
  scandinave: { n: 'Scandinave', facade: 'bardage-noir', accent: 'bardage-bois', roof: { type: 'gable', mat: 'bac-acier', pitch: 40, over: 30 }, frame: '#F4F4F2', floors: { day: 'oakLight', night: 'oakLight', wet: 'tileW', entree: 'oakLight', garage: 'concrete' }, paints: { day: '#FFFFFF', night: '#C9D3C0', wet: '#FFFFFF' }, pal: { fabric: '#CFCBC4', wood: '#DCC6A0', accent: '#8FA58A', bed: '#F2F2EF', kitchen: '#F2F2EF' } },
  industriel: { n: 'Industriel', facade: 'brique', accent: 'bardage-noir', roof: { type: 'shed', mat: 'bac-acier', pitch: 8, over: 20 }, frame: '#1E2023', floors: { day: 'concrete', night: 'walnut', wet: 'cement', entree: 'concrete', garage: 'concrete' }, paints: { day: '#CFCBC4', night: '#4A4D52', wet: '#F2EEE6' }, pal: { fabric: '#7A5536', wood: '#3E4247', accent: '#B66A4C', bed: '#5E7184', kitchen: '#1E2023' } }
};

function guessType(name, mat) {
  if (mat && MATS[mat] && MATS[mat].ext) return 'exterieur';
  const s = norm(name);
  if (/(sejour|salon|living|piece de vie)/.test(s)) return /cuisine/.test(s) ? 'sejcuis' : 'sejour';
  if (/cuisine/.test(s)) return 'cuisine';
  if (/(chambre|suite)/.test(s)) return 'chambre';
  if (/(salle de bain|salle d eau|sdb|douche)/.test(s)) return 'sdb';
  if (/(wc|toilette)/.test(s)) return 'wc';
  if (/(entree|hall)/.test(s)) return 'entree';
  if (/(degagement|couloir|palier|circulation)/.test(s)) return 'couloir';
  if (/bureau/.test(s)) return 'bureau';
  if (/(cellier|buanderie|cave|rangement)/.test(s)) return 'cellier';
  if (/garage/.test(s)) return 'garage';
  return 'autre';
}
const isExt = r => !!(MATS[r.mat] && MATS[r.mat].ext);
const isHabitable = (r, lv) => !isExt(r) && r.type !== 'garage' && (!lv || (lv.kind !== 'sous-sol' && lv.h >= 180));

/* ---------------- mod\u00e8le ---------------- */
function newLevel(name, elev, kind) { return { id: uid(), name, elev, h: 250, slab: 20, kind: kind || (elev < 0 ? 'sous-sol' : elev === 0 ? 'rdc' : 'etage'), walls: [], open: [], rooms: [], dims: [], texts: [], furn: [], roofs: [] }; }
function blankProject() {
  const lv = newLevel('Rez-de-chauss\u00e9e', 0, 'rdc');
  return {
    v: 3, id: uid(), name: 'Mon plan', created: Date.now(), updated: Date.now(), style: null,
    unit: 'm', mode: 'real', view: 'split', snap: true, snapPct: 60, grid: 5, autoDims: true, showRoofs2D: true, north: 0,
    wallT: 20, wallKind: 'wall', doorKind: 'door', winKind: 'window', roomWalls: true, roofType: 'gable',
    facade: 'enduit-blanc', frame: '#F4F4F2',
    env: { hour: 15, month: 6, weather: 'sun', lat: 46.6, lon: 2.4, tz: 1, dst: 1, cut: false, cutH: 120, section: false, secAxis: 'x', secPos: 50, secFlip: false, upTo: false, ceil: 'auto', roofs: true, ground: 'opaque', lights: 'auto' },
    terrain: null, gamme: 'standard',
    exp: { bg: 'white', pdfScale: '100', pdfPaper: 'a4', pdfLv: 'all', pdfDims: true, pdfTables: true },
    models: {}, levels: [lv], cur: lv.id
  };
}
function normalize(o) {
  const b = blankProject();
  const p = Object.assign(b, o || {});
  p.env = Object.assign(blankProject().env, (o && o.env) || {});
  p.exp = Object.assign(blankProject().exp, (o && o.exp) || {});
  if (o && o.cut != null) p.env.cut = !!o.cut;
  if (o && o.upTo != null) p.env.upTo = !!o.upTo;
  if (o && o.bg) p.exp.bg = o.bg;
  delete p.cut; delete p.upTo; delete p.bg; delete p.pdfScale; delete p.pdfPaper; delete p.pdfLv;
  if (!p.id) p.id = uid(); if (!p.models) p.models = {};
  if (!Array.isArray(p.levels) || !p.levels.length) p.levels = blankProject().levels;
  const FM = { int: 'oak', lawn: 'lawn', terrace: 'deck', gravel: 'gravel', water: 'water' };
  p.levels.forEach(l => {
    for (const k of ['walls', 'open', 'rooms', 'dims', 'texts', 'furn', 'roofs']) l[k] = Array.isArray(l[k]) ? l[k] : [];
    if (!l.id) l.id = uid(); l.h = +l.h || 250; l.elev = +l.elev || 0; if (l.slab == null) l.slab = 20;
    if (!l.kind) l.kind = l.elev < 0 ? 'sous-sol' : l.elev === 0 ? 'rdc' : 'etage';
    l.walls.forEach(w => { if (!w.id) w.id = uid(); if (!w.c) w.c = '#F2EEE6'; if (!w.kind) w.kind = 'wall'; w.t = +w.t || 20; });
    l.rooms.forEach(r => { if (!r.id) r.id = uid(); if (!r.mat) r.mat = FM[r.floor] || 'oak'; if (!MATS[r.mat]) r.mat = 'oak'; delete r.floor; if (!r.type) r.type = guessType(r.name, r.mat); });
    l.open.forEach(op => { const d = OPDEF[op.kind] || OPDEF.door; if (!OPDEF[op.kind]) op.kind = 'door'; if (op.h == null) op.h = d.h; if (op.sill == null) op.sill = d.sill; if (!op.side) op.side = 1; if (!op.hinge) op.hinge = 1; if (op.closed == null) op.closed = op.kind === 'entry' || op.kind === 'garage' || op.kind === 'gate'; });
    l.furn = l.furn.filter(f => FURN[f.type] || f.type === 'model');
    l.furn.forEach(f => { const d = FURN[f.type] || {}; if (!f.id) f.id = uid(); if (f.h == null) f.h = d.h || 80; if (!f.c) f.c = d.c || '#9A9EA4'; if (f.z == null) f.z = d.z || 0; if (f.p == null) f.p = d.p || 0; if (!f.w) f.w = d.w || 100; if (!f.d) f.d = d.d || 100; });
    l.roofs.forEach(r => { if (!r.id) r.id = uid(); r.type = ROOFTYPES[r.type] ? r.type : 'gable'; if (r.pitch == null) r.pitch = 35; if (r.over == null) r.over = 40; if (!ROOFMATS[r.mat]) r.mat = 'tuiles-rouges'; if (r.gutters == null) r.gutters = true; if (r.sky == null) r.sky = 0; });
  });
  if (!p.levels.find(l => l.id === p.cur)) p.cur = p.levels[0].id;
  if (!FACADES[p.facade]) p.facade = 'enduit-blanc';
  if (p.terrain && !(p.terrain.w > 0)) p.terrain = null;
  p.v = 3; return p;
}
const sortedLevels = P => [...P.levels].sort((a, b) => a.elev - b.elev);
const levelAbove = (P, lv) => sortedLevels(P).find(l => l.elev > lv.elev);
const levelBelow = (P, lv) => { const ls = sortedLevels(P).filter(l => l.elev < lv.elev); return ls[ls.length - 1] || null; };
function fdesc(f, P) { if (f.type === 'model') { const m = (P && P.models && P.models[f.model]) || {}; return { n: m.name || 'Mod\u00e8le import\u00e9', cat: 'modeles', w: m.w || 100, d: m.d || 100, h: m.h || 100, c: '#9A9EA4', p: 0, free: 1, model: 1 }; } return FURN[f.type] || { n: f.type, cat: 'deco', w: 100, d: 100, h: 80, c: '#999', p: 0 }; }
function makeFurn(type, x, y, r, extra) { const d = FURN[type]; return Object.assign({ id: uid(), type, x: Math.round(x), y: Math.round(y), r: r || 0, w: d.w, d: d.d, h: d.h, c: d.c, z: d.z || 0, p: d.p }, extra || {}); }

/* ---------------- g\u00e9om\u00e9trie ---------------- */
function wg(w) { const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = hyp(dx, dy) || 1e-6, ux = dx / len, uy = dy / len; return { len, ux, uy, nx: -uy, ny: ux }; }
function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = clamp(t, 0, 1); const qx = x1 + dx * t, qy = y1 + dy * t; return { d: hyp(px - qx, py - qy), t, x: qx, y: qy }; }
function segInter(a, b, c, d) { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null; return { t, u, x: a[0] + r[0] * t, y: a[1] + r[1] * t }; }
function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function polyPerim(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += hyp(q[0] - p[0], q[1] - p[1]); } return s; }
function centroid(pts) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; const f = p[0] * q[1] - q[0] * p[1]; a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; } if (Math.abs(a) < 1e-6) { const n = pts.length || 1; return [sum(pts, p => p[0]) / n, sum(pts, p => p[1]) / n]; } return [cx / (3 * a), cy / (3 * a)]; }
function inPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const same = (a, b, e = 0.6) => Math.abs(a[0] - b[0]) < e && Math.abs(a[1] - b[1]) < e;
function bbox(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }
function isRect(pts) { if (pts.length !== 4) return false; const b = bbox(pts); return pts.every(p => (Math.abs(p[0] - b.x0) < 1 || Math.abs(p[0] - b.x1) < 1) && (Math.abs(p[1] - b.y0) < 1 || Math.abs(p[1] - b.y1) < 1)) && Math.abs(polyArea(pts) - b.w * b.h) < 50; }
function rotPt(lx, ly, r) { const a = r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [lx * c - ly * s, lx * s + ly * c]; }
function toLocal(px, py, cx, cy, r) { const a = -r * Math.PI / 180, dx = px - cx, dy = py - cy; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
function furnCorners(f) { return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = rotPt(a * f.w / 2, b * f.d / 2, f.r || 0); return [f.x + p[0], f.y + p[1]]; }); }
function furnHalf(f) { const a = (f.r || 0) * Math.PI / 180; return { hx: Math.abs(f.w / 2 * Math.cos(a)) + Math.abs(f.d / 2 * Math.sin(a)), hy: Math.abs(f.w / 2 * Math.sin(a)) + Math.abs(f.d / 2 * Math.cos(a)) }; }

/* orientation : P.north = angle (\u00b0) du nord, mesur\u00e9 dans le sens horaire depuis le haut du plan */
function northVec(P) { const a = (P.north || 0) * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; }
function sideVec(P, side) { const n = northVec(P), e = [-n[1], n[0]]; switch (normSide(side)) { case 'nord': return n; case 'sud': return [-n[0], -n[1]]; case 'est': return e; case 'ouest': return [-e[0], -e[1]]; } return null; }
function normSide(s) { s = norm(s); if (/^(n|nord|north)/.test(s)) return 'nord'; if (/^(s|sud|south)/.test(s)) return 'sud'; if (/^(e|est|east)/.test(s)) return 'est'; if (/^(o|ouest|w|west)/.test(s)) return 'ouest'; return null; }
function cardinalOf(P, vx, vy) { let best = null, bd = -2; for (const s of ['nord', 'sud', 'est', 'ouest']) { const v = sideVec(P, s), d = v[0] * vx + v[1] * vy; if (d > bd) { bd = d; best = s; } } return best; }

/* ---------------- murs ---------------- */
const structural = w => w.kind === 'wall' || w.kind === 'low';
function interiorRooms(lv) { return lv.rooms.filter(r => !isExt(r) && r.pts.length >= 3); }
// c\u00f4t\u00e9s d'un mur : +1 = c\u00f4t\u00e9 normal (nx,ny), -1 = oppos\u00e9 ; renvoie quels c\u00f4t\u00e9s donnent sur une pi\u00e8ce int\u00e9rieure
function wallSides(lv, w) { const g = wg(w), mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, o = w.t / 2 + 12, rs = interiorRooms(lv); const pos = rs.some(r => inPoly(mx + g.nx * o, my + g.ny * o, r.pts)), neg = rs.some(r => inPoly(mx - g.nx * o, my - g.ny * o, r.pts)); return { pos, neg, exterior: pos !== neg, extSign: pos && !neg ? -1 : (!pos && neg ? 1 : 0) }; }
function clampOpenings(lv, w) { const g = wg(w); lv.open.filter(o => o.wall === w.id).forEach(o => { o.w = Math.min(o.w, Math.max(20, g.len - 10)); o.pos = clamp(o.pos, o.w / 2, g.len - o.w / 2); }); }
function splitWallAt(lv, w, pt) {
  const g = wg(w), t = (pt[0] - w.x1) * g.ux + (pt[1] - w.y1) * g.uy;
  if (t < 2 || t > g.len - 2) return null;
  const w2 = Object.assign(clone(w), { id: uid(), x1: n2(pt[0]), y1: n2(pt[1]) });
  w.x2 = n2(pt[0]); w.y2 = n2(pt[1]); lv.walls.push(w2);
  lv.open.filter(o => o.wall === w.id).forEach(o => { if (o.pos > t) { o.wall = w2.id; o.pos -= t; } });
  clampOpenings(lv, w); clampOpenings(lv, w2); return w2;
}
// coupe les murs aux intersections et jonctions en T avec les murs neufs
function integrateWalls(lv, newWalls) {
  const queue = [...newWalls]; let guard = 0;
  while (queue.length && guard++ < 2000) {
    const nw = queue.shift(); if (!lv.walls.includes(nw)) continue;
    for (const ew of [...lv.walls]) {
      if (ew === nw) continue; const sameFamily = structural(ew) === structural(nw); if (!sameFamily) continue;
      const it = segInter([nw.x1, nw.y1], [nw.x2, nw.y2], [ew.x1, ew.y1], [ew.x2, ew.y2]); if (!it) continue;
      const p = [it.x, it.y]; const gN = wg(nw), gE = wg(ew);
      const tN = it.t * gN.len, tE = it.u * gE.len;
      if (tE > 2 && tE < gE.len - 2) splitWallAt(lv, ew, p);
      if (tN > 2 && tN < gN.len - 2) { const piece = splitWallAt(lv, nw, p); if (piece) queue.push(piece); }
    }
  }
}
// ajoute un mur sans doubler les portions d\u00e9j\u00e0 construites, puis g\u00e8re les intersections
function addWallSmart(lv, a, b, kind, t, extra) {
  const L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 2) return [];
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; const cov = [];
  for (const w of lv.walls) { if (structural(w) !== structural({ kind })) continue; const d1 = Math.abs((w.x1 - a[0]) * -uy + (w.y1 - a[1]) * ux), d2 = Math.abs((w.x2 - a[0]) * -uy + (w.y2 - a[1]) * ux); if (d1 > 1 || d2 > 1) continue; let s1 = (w.x1 - a[0]) * ux + (w.y1 - a[1]) * uy, s2 = (w.x2 - a[0]) * ux + (w.y2 - a[1]) * uy; if (s1 > s2) [s1, s2] = [s2, s1]; if (s2 <= 1 || s1 >= L - 1) continue; cov.push([Math.max(0, s1), Math.min(L, s2)]); }
  cov.sort((p, q) => p[0] - q[0]); const free = []; let cur = 0; for (const [s, e] of cov) { if (s > cur + 2) free.push([cur, s]); cur = Math.max(cur, e); } if (cur < L - 2) free.push([cur, L]);
  const made = [];
  for (const [s, e] of free) { const w = Object.assign({ id: uid(), x1: n2(a[0] + ux * s), y1: n2(a[1] + uy * s), x2: n2(a[0] + ux * e), y2: n2(a[1] + uy * e), t: t || (kind === 'wall' ? 20 : WALLDEF[kind] || 20), kind: kind || 'wall', c: '#F2EEE6' }, extra || {}); lv.walls.push(w); made.push(w); }
  integrateWalls(lv, made); return made;
}
function movePoints(lv, olds, news, skip) {
  lv.walls.forEach(w => { if (w.id === skip) return; olds.forEach((o, i) => { if (same([w.x1, w.y1], o)) { w.x1 = news[i][0]; w.y1 = news[i][1]; } if (same([w.x2, w.y2], o)) { w.x2 = news[i][0]; w.y2 = news[i][1]; } }); });
  lv.rooms.forEach(r => r.pts.forEach(pt => olds.forEach((o, i) => { if (same(pt, o)) { pt[0] = news[i][0]; pt[1] = news[i][1]; } })));
}
function setWallLength(lv, w, len) { const g = wg(w); const nb = [n2(w.x1 + g.ux * len), n2(w.y1 + g.uy * len)], ob = [w.x2, w.y2]; w.x2 = nb[0]; w.y2 = nb[1]; movePoints(lv, [ob], [nb], w.id); lv.walls.forEach(x => clampOpenings(lv, x)); }
function wallSnapFurn(f, lv) {
  let best = null, bd = Infinity;
  for (const w of lv.walls) { if (!structural(w)) continue; const q = segDist(f.x, f.y, w.x1, w.y1, w.x2, w.y2); if (q.t <= .01 || q.t >= .99) continue; const lim = Math.min(f.w, f.d) / 2 + w.t / 2 + 30; if (q.d < lim && q.d < bd) { bd = q.d; best = { w, q }; } }
  if (!best) return false; const g = wg(best.w); const side = Math.sign((f.x - best.w.x1) * g.nx + (f.y - best.w.y1) * g.ny) || 1; const nx = g.nx * side, ny = g.ny * side;
  f.r = (Math.round(Math.atan2(-nx, ny) * 180 / Math.PI) + 360) % 360; f.x = n2(best.q.x + nx * (best.w.t / 2 + f.d / 2 + 1)); f.y = n2(best.q.y + ny * (best.w.t / 2 + f.d / 2 + 1)); return true;
}
function onBoundary(pt, pts, tol = 2) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (segDist(pt[0], pt[1], a[0], a[1], b[0], b[1]).d < tol) return true; } return false; }
function roomWalls(lv, r) { return lv.walls.filter(w => structural(w) && onBoundary([w.x1, w.y1], r.pts) && onBoundary([w.x2, w.y2], r.pts) && onBoundary([(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], r.pts)); }
function paintRoomWalls(lv, r, c) { const ws = roomWalls(lv, r).filter(w => w.kind === 'wall'); ws.forEach(w => w.c = c); return ws.length; }
// ar\u00eates d'une pi\u00e8ce avec leur normale ext\u00e9rieure
function roomEdges(r) { const pts = r.pts, out = []; let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } const ccw = a > 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], L = hyp(q[0] - p[0], q[1] - p[1]); if (L < 1) continue; const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L; const nx = ccw ? uy : -uy, ny = ccw ? -ux : ux; out.push({ a: p, b: q, L, ux, uy, nx, ny }); } return out; }
// murs port\u00e9s par une ar\u00eate : portions communes
function edgeWalls(lv, e, kinds) {
  const res = [];
  for (const w of lv.walls) { if (kinds ? !kinds.includes(w.kind) : !structural(w)) continue; const d1 = Math.abs((w.x1 - e.a[0]) * -e.uy + (w.y1 - e.a[1]) * e.ux), d2 = Math.abs((w.x2 - e.a[0]) * -e.uy + (w.y2 - e.a[1]) * e.ux); if (d1 > 1.5 || d2 > 1.5) continue; let s1 = (w.x1 - e.a[0]) * e.ux + (w.y1 - e.a[1]) * e.uy, s2 = (w.x2 - e.a[0]) * e.ux + (w.y2 - e.a[1]) * e.uy; const lo = Math.max(0, Math.min(s1, s2)), hi = Math.min(e.L, Math.max(s1, s2)); if (hi - lo > 5) res.push({ w, lo, hi, len: hi - lo }); }
  return res.sort((p, q) => q.len - p.len);
}
// position libre d'une ouverture sur un mur (\u00e9vite les ouvertures existantes)
function freePos(lv, w, center, width, ignoreId) {
  const g = wg(w), lo = width / 2 + 5, hi = g.len - width / 2 - 5; if (hi < lo) return null;
  const occ = lv.open.filter(o => o.wall === w.id && o.id !== ignoreId).map(o => [o.pos - o.w / 2 - 15, o.pos + o.w / 2 + 15]);
  const ok = p => p >= lo && p <= hi && occ.every(([a, b]) => p + width / 2 <= a || p - width / 2 >= b);
  const c0 = clamp(center, lo, hi); if (ok(c0)) return c0;
  for (let d = 5; d < g.len; d += 5) { if (ok(c0 + d)) return c0 + d; if (ok(c0 - d)) return c0 - d; }
  return null;
}
function addOpening(lv, w, pos, kind, width, extra) { const d = OPDEF[kind] || OPDEF.door; const op = Object.assign({ id: uid(), wall: w.id, pos: n2(pos), w: width || d.w, kind, side: 1, hinge: 1, h: d.h, sill: d.sill, closed: kind === 'entry' || kind === 'garage' || kind === 'gate' }, extra || {}); lv.open.push(op); return op; }
function openingCenter(lv, op) { const w = lv.walls.find(x => x.id === op.wall); if (!w) return null; const g = wg(w); return [w.x1 + g.ux * op.pos, w.y1 + g.uy * op.pos]; }

/* ---------------- \u00e9tirement (agrandir une pi\u00e8ce, une fa\u00e7ade) ---------------- */
// d\u00e9place de delta*dir tous les points situ\u00e9s au-del\u00e0 de la ligne axis = at (c\u00f4t\u00e9 dir), sur tous les niveaux
function stretchAll(P, axis, at, delta, dir) {
  const k = axis === 'x' ? 0 : 1, beyond = v => (v - at) * dir >= -1, mv = delta * dir;
  const sp = pt => { if (beyond(pt[k])) pt[k] = n2(pt[k] + mv); };
  for (const lv of P.levels) {
    const centers = lv.open.map(op => ({ op, c: openingCenter(lv, op) }));
    lv.walls.forEach(w => { const a = [w.x1, w.y1], b = [w.x2, w.y2]; sp(a); sp(b); w.x1 = a[0]; w.y1 = a[1]; w.x2 = b[0]; w.y2 = b[1]; });
    lv.rooms.forEach(r => r.pts.forEach(sp));
    lv.dims.forEach(d => { const a = [d.x1, d.y1], b = [d.x2, d.y2]; sp(a); sp(b); d.x1 = a[0]; d.y1 = a[1]; d.x2 = b[0]; d.y2 = b[1]; });
    lv.texts.forEach(t => { const a = [t.x, t.y]; sp(a); t.x = a[0]; t.y = a[1]; });
    lv.furn.forEach(f => { const a = [f.x, f.y]; sp(a); f.x = a[0]; f.y = a[1]; });
    lv.roofs.forEach(rf => { const rr = ((rf.r || 0) % 180 + 180) % 180; const half = (axis === 'x') === (rr < 45 || rr > 135) ? rf.w / 2 : rf.d / 2; const c = axis === 'x' ? rf.x : rf.y; const lo = c - half, hi = c + half; const loB = beyond(lo), hiB = beyond(hi); if (loB && hiB) { if (axis === 'x') rf.x += mv; else rf.y += mv; } else if (loB !== hiB) { const key = half === rf.w / 2 ? 'w' : 'd'; rf[key] = Math.max(100, rf[key] + delta); if (axis === 'x') rf.x += mv / 2; else rf.y += mv / 2; } });
    centers.forEach(({ op, c }) => { if (!c) return; sp(c); const w = lv.walls.find(x => x.id === op.wall); if (!w) return; const g = wg(w); op.pos = n2((c[0] - w.x1) * g.ux + (c[1] - w.y1) * g.uy); });
    lv.walls.forEach(w => clampOpenings(lv, w));
  }
  if (P.terrain) { const t = P.terrain, c = axis === 'x' ? t.x : t.y, half = (axis === 'x' ? t.w : t.d) / 2; if (beyond(c + half * dir) && !beyond(c - half * dir)) { if (axis === 'x') { t.w += delta; t.x += mv / 2; } else { t.d += delta; t.y += mv / 2; } } }
}
// agrandit/r\u00e9duit une pi\u00e8ce. opts: {area (m\u00b2, delta)} | {width (cm, axe x)} | {depth (cm, axe y)} ; side optionnel (cardinal)
function resizeRoom(P, lv, room, opts) {
  const b = bbox(room.pts); const cands = [{ axis: 'x', at: b.x1, dir: 1, ext: b.h, n: [1, 0] }, { axis: 'x', at: b.x0, dir: -1, ext: b.h, n: [-1, 0] }, { axis: 'y', at: b.y1, dir: 1, ext: b.w, n: [0, 1] }, { axis: 'y', at: b.y0, dir: -1, ext: b.w, n: [0, -1] }];
  let list = cands, delta;
  if (opts.width != null) { list = cands.filter(c => c.axis === 'x'); delta = opts.width - b.w; }
  else if (opts.depth != null) { list = cands.filter(c => c.axis === 'y'); delta = opts.depth - b.h; }
  if (opts.side) { const s = normSide(opts.side); if (s) { const f = list.filter(c => cardinalOf(P, c.n[0], c.n[1]) === s); if (f.length) list = f; else return { ok: false, msg: 'La pi\u00e8ce ne peut pas s\'\u00e9tendre de ce c\u00f4t\u00e9.' }; } }
  const others = []; P.levels.forEach(l => l.rooms.forEach(r => { if (r !== room && r.pts.length >= 3) others.push({ r, l }); }));
  const scored = list.map(c => {
    const d = opts.area != null ? opts.area * 1e4 / c.ext : delta; const k = c.axis === 'x' ? 0 : 1; const cut = c.at - c.dir * 1;
    let cost = 0; const grown = [];
    for (const { r, l } of others) { const near = r.pts.some(p => (p[k] - cut) * c.dir < 0), far = r.pts.some(p => (p[k] - cut) * c.dir >= 0); if (near && far) { const w = isExt(r) ? 0.15 : (l === lv ? 1 : 0.6); cost += w; if (!isExt(r)) grown.push(r.name || 'pi\u00e8ce'); } }
    const beyondInterior = interiorRooms(lv).some(r => r !== room && r.pts.every(p => (p[k] - c.at) * c.dir >= -1) && (bbox(r.pts)[c.axis === 'x' ? 'y0' : 'x0'] < b[c.axis === 'x' ? 'y1' : 'x1'] && bbox(r.pts)[c.axis === 'x' ? 'y1' : 'x1'] > b[c.axis === 'x' ? 'y0' : 'x0']));
    if (!beyondInterior) cost -= 0.5;
    return { c, d, cost, grown };
  }).sort((p, q) => p.cost - q.cost);
  if (!scored.length) return { ok: false, msg: 'Aucun c\u00f4t\u00e9 disponible.' };
  const best = scored[0]; const size = best.c.axis === 'x' ? b.w : b.h;
  if (!isFinite(best.d) || Math.abs(best.d) < 1) return { ok: false, msg: 'Aucun changement \u00e0 faire.' };
  if (size + best.d < 60) return { ok: false, msg: 'La pi\u00e8ce deviendrait trop petite.' };
  stretchAll(P, best.c.axis, best.c.at, best.d, best.c.dir);
  return { ok: true, side: cardinalOf(P, best.c.n[0], best.c.n[1]), delta: best.d, grown: best.grown, area: polyArea(room.pts) };
}

/* ---------------- toitures ---------------- */
function roofLocal(rf, px, py) { return toLocal(px, py, rf.x, rf.y, rf.r || 0); }
function roofSlope(rf) { return Math.tan(clamp(rf.pitch || 0, 0, 70) * Math.PI / 180); }
// hauteur (cm) au-dessus du haut des murs, en coordonn\u00e9es locales ; null hors d\u00e9bord
function roofHLocal(rf, u, v) {
  const W = rf.w, D = rf.d, o = rf.over || 0, s = roofSlope(rf);
  if (Math.abs(u) > W / 2 + o + 0.5 || Math.abs(v) > D / 2 + o + 0.5) return null;
  switch (rf.type) { case 'gable': return s * (D / 2 - Math.abs(v)); case 'hip': return s * Math.min(W / 2 - Math.abs(u), D / 2 - Math.abs(v)); case 'shed': return s * (D / 2 - v); default: return 25; }
}
function roofHeightAt(rf, px, py) { const [u, v] = roofLocal(rf, px, py); return roofHLocal(rf, u, v); }
function roofRidge(rf) { const s = roofSlope(rf); switch (rf.type) { case 'gable': return s * rf.d / 2; case 'hip': return s * Math.min(rf.w, rf.d) / 2; case 'shed': return s * rf.d; default: return 25; } }
function roofArea(rf) { const W = rf.w + 2 * (rf.over || 0), D = rf.d + 2 * (rf.over || 0); if (rf.type === 'flat') return rf.w * rf.d; return W * D / Math.cos(clamp(rf.pitch || 0, 0, 70) * Math.PI / 180); }
function roofGutters(rf) { const W = rf.w + 2 * (rf.over || 0), D = rf.d + 2 * (rf.over || 0); if (!rf.gutters || rf.type === 'flat') return { len: 0, pipes: rf.type === 'flat' ? 1 : 0 }; if (rf.type === 'gable') return { len: 2 * W, pipes: W > 1200 ? 4 : 2 }; if (rf.type === 'hip') return { len: 2 * W + 2 * D, pipes: 4 }; return { len: W, pipes: 2 }; }
function roofBase(lv) { return lv.elev + lv.h; }
// g\u00e9om\u00e9trie en rep\u00e8re local (u le long de w, v le long de d, z au-dessus du haut des murs), en cm
function roofGeom(rf) {
  const W = rf.w / 2, D = rf.d / 2, o = rf.type === 'flat' ? 0 : (rf.over || 0), s = roofSlope(rf), e = -s * o; const Wo = W + o, Do = D + o;
  const g = { faces: [], fills: [], gutters: [], parapets: [] };
  if (rf.type === 'gable') { const H = s * D; g.faces.push([[-Wo, -Do, e], [Wo, -Do, e], [Wo, 0, H], [-Wo, 0, H]], [[Wo, Do, e], [-Wo, Do, e], [-Wo, 0, H], [Wo, 0, H]]); g.fills.push([[-W, D, 0], [-W, -D, 0], [-W, 0, H]], [[W, -D, 0], [W, D, 0], [W, 0, H]]); g.gutters.push([[-Wo, -Do, e], [Wo, -Do, e]], [[-Wo, Do, e], [Wo, Do, e]]); }
  else if (rf.type === 'hip') {
    if (rf.w >= rf.d) { const r = W - D, H = s * D; g.faces.push([[-Wo, -Do, e], [Wo, -Do, e], [r, 0, H], [-r, 0, H]], [[Wo, Do, e], [-Wo, Do, e], [-r, 0, H], [r, 0, H]], [[-Wo, Do, e], [-Wo, -Do, e], [-r, 0, H]], [[Wo, -Do, e], [Wo, Do, e], [r, 0, H]]); }
    else { const r = D - W, H = s * W; g.faces.push([[-Wo, Do, e], [-Wo, -Do, e], [0, -r, H], [0, r, H]], [[Wo, -Do, e], [Wo, Do, e], [0, r, H], [0, -r, H]], [[-Wo, -Do, e], [Wo, -Do, e], [0, -r, H]], [[Wo, Do, e], [-Wo, Do, e], [0, r, H]]); }
    g.gutters.push([[-Wo, -Do, e], [Wo, -Do, e]], [[-Wo, Do, e], [Wo, Do, e]], [[-Wo, -Do, e], [-Wo, Do, e]], [[Wo, -Do, e], [Wo, Do, e]]);
  }
  else if (rf.type === 'shed') { const Hh = 2 * s * D; g.faces.push([[-Wo, -Do, s * (2 * D + o)], [Wo, -Do, s * (2 * D + o)], [Wo, Do, e], [-Wo, Do, e]]); g.fills.push([[-W, -D, 0], [W, -D, 0], [W, -D, Hh], [-W, -D, Hh]], [[-W, D, 0], [-W, -D, 0], [-W, -D, Hh]], [[W, -D, 0], [W, D, 0], [W, -D, Hh]]); g.gutters.push([[-Wo, Do, e], [Wo, Do, e]]); }
  else { g.faces.push([[-W, -D, 25], [W, -D, 25], [W, D, 25], [-W, D, 25]]); g.parapets.push([[-W, -D], [W, -D]], [[W, -D], [W, D]], [[W, D], [-W, D]], [[-W, D], [-W, -D]]); }
  if (!rf.gutters) g.gutters = [];
  return g;
}
function mainRect(lv, excludeGarage) { const rs = interiorRooms(lv).filter(r => !excludeGarage || r.type !== 'garage'); if (!rs.length) { const ws = lv.walls.filter(w => w.kind === 'wall'); if (!ws.length) return null; return bbox(ws.flatMap(w => [[w.x1, w.y1], [w.x2, w.y2]])); } return bbox(rs.flatMap(r => r.pts)); }
function makeRoof(rect, type, style) { const st = style || {}; const along = rect.w >= rect.h; return { id: uid(), x: n2(rect.cx), y: n2(rect.cy), w: n2(along ? rect.w : rect.h), d: n2(along ? rect.h : rect.w), r: along ? 0 : 90, type: type || 'gable', pitch: type === 'flat' ? 0 : (st.pitch || (type === 'shed' ? 10 : 35)), over: type === 'flat' ? 10 : (st.over != null ? st.over : 40), mat: st.mat || (type === 'flat' ? 'gravier' : 'tuiles-rouges'), gutters: true, sky: 0 }; }
// toiture automatique : niveau le plus haut + garages non couverts
function autoRoofs(P, type, styleRoof) {
  const ls = sortedLevels(P).filter(l => l.elev >= 0); if (!ls.length) return [];
  const made = []; const top = ls[ls.length - 1];
  P.levels.forEach(l => l.roofs = []);
  const t = type || (styleRoof && styleRoof.type) || P.roofType || 'gable';
  const mr = mainRect(top, true); if (mr) { const rf = makeRoof(mr, t, styleRoof); top.roofs.push(rf); made.push(rf); }
  for (const l of ls) { for (const r of interiorRooms(l)) { if (r.type !== 'garage') continue; const b = bbox(r.pts); const covered = ls.some(u => u.elev > l.elev && interiorRooms(u).some(q => inPoly(b.cx, b.cy, q.pts))); if (covered || (l === top && mr && b.x0 >= mr.x0 - 1 && b.x1 <= mr.x1 + 1 && b.y0 >= mr.y0 - 1 && b.y1 <= mr.y1 + 1)) continue; const rf = makeRoof(b, 'flat', { mat: 'gravier' }); l.roofs.push(rf); made.push(rf); } }
  // pi\u00e8ces des niveaux inf\u00e9rieurs qui d\u00e9passent l'\u00e9tage
  for (const l of ls) { if (l === top) continue; const up = ls.filter(u => u.elev > l.elev); for (const r of interiorRooms(l)) { if (r.type === 'garage') continue; const b = bbox(r.pts); const covered = up.some(u => interiorRooms(u).some(q => inPoly(b.cx, b.cy, q.pts))); if (!covered) { const rf = makeRoof(b, t === 'flat' ? 'flat' : 'shed', t === 'flat' ? { mat: 'gravier' } : Object.assign({}, styleRoof || {}, { pitch: 12 })); l.roofs.push(rf); made.push(rf); } } }
  return made;
}

/* ---------------- escaliers ---------------- */
function stairRise(P, lv) { const up = levelAbove(P, lv); return up ? up.elev - lv.elev : lv.h + (lv.slab || 20); }
function stairInfo(P, lv, f) {
  const R = stairRise(P, lv), n = Math.max(3, Math.round(R / 17.5)), r = R / n; const d = FURN[f.type] || {};
  let run = f.d; if (d.stair === 'L') run = (f.d - 90) + (f.w - 90); if (d.stair === 'spiral') run = Math.PI * f.w / 2 * 0.85 * 0.66;
  const g = run / (n - 1 || 1); return { R, n, r, g, blondel: 2 * r + g };
}
// contour de tr\u00e9mie (coordonn\u00e9es du plan) d'un escalier
function stairOutline(f) {
  const d = FURN[f.type] || {}; let loc;
  if (d.stair === 'spiral') { loc = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; loc.push([Math.cos(a) * f.w / 2, Math.sin(a) * f.w / 2]); } }
  else if (d.stair === 'L') { const W = f.w / 2, D = f.d / 2, s = Math.min(f.sw || 90, f.w, f.d); loc = [[-W, -D], [W, -D], [W, -D + s], [-W + s, -D + s], [-W + s, D], [-W, D]]; }
  else loc = [[-f.w / 2, -f.d / 2], [f.w / 2, -f.d / 2], [f.w / 2, f.d / 2], [-f.w / 2, f.d / 2]];
  return loc.map(([x, y]) => { const p = rotPt(x, y, f.r || 0); return [f.x + p[0], f.y + p[1]]; });
}
const isStair = f => !!(FURN[f.type] && FURN[f.type].stair);

/* ---------------- m\u00e9tr\u00e9s, surfaces et estimation ---------------- */
function netArea(lv, r) { const A = polyArea(r.pts); let red = 0; for (const e of roomEdges(r)) { const ws = edgeWalls(lv, e, ['wall', 'low']); let cov = 0; for (const x of ws) { red += x.len * x.w.t / 2; cov += x.len; } } return Math.max(A * 0.6, A - red); }
function computeStats(P) {
  const ls = sortedLevels(P); const S = { rooms: [], hab: 0, habAxis: 0, footprint: 0, ext: 0, facade: 0, facadeBy: {}, paint: 0, cloisons: 0, cloisonArea: 0, extWallArea: 0, extWallLen: 0, volume: 0, slabs: 0, slabVol: 0, roofs: [], roofArea: 0, gutters: 0, pipes: 0, openings: [], floors: {}, plinths: 0, ceilings: 0, found: 0, counts: {}, furnTotal: 0, structTotal: 0, extFloors: {} };
  const lowest = ls.find(l => l.elev >= 0) || ls[0];
  for (const lv of ls) {
    const H = lv.h;
    for (const r of lv.rooms) { if (r.pts.length < 3) continue; const A = polyArea(r.pts), ext = isExt(r), net = ext ? A : netArea(lv, r), per = polyPerim(r.pts); const hab = isHabitable(r, lv); const row = { id: r.id, name: r.name || 'Pi\u00e8ce', type: r.type, level: lv.name, mat: r.mat, area: A, net, per, h: ext ? 0 : H, vol: ext ? 0 : net * H, ext, hab };
      S.rooms.push(row);
      if (ext) { S.ext += A; S.extFloors[r.mat] = (S.extFloors[r.mat] || 0) + A; continue; }
      if (hab) { S.hab += net; S.habAxis += A; }
      S.volume += net * H; S.floors[r.mat] = (S.floors[r.mat] || 0) + net; S.ceilings += net; S.plinths += per;
      if (lv === lowest) S.footprint += A;
      if (lv.elev > (lowest ? lowest.elev : 0)) { S.slabs += A; S.slabVol += A * (lv.slab || 20); }
      else { S.slabs += A; S.slabVol += A * 15; }
    }
    for (const w of lv.walls) {
      if (w.kind !== 'wall') continue; const g = wg(w); const ops = lv.open.filter(o => o.wall === w.id); const opA = sum(ops, o => o.w * o.h); const sides = wallSides(lv, w); const area = g.len * H - opA;
      if (sides.exterior || (!sides.pos && !sides.neg)) { S.extWallArea += area; S.extWallLen += g.len; const fk = w.ext || P.facade; S.facade += area; S.facadeBy[fk] = (S.facadeBy[fk] || 0) + area; if (sides.exterior) S.paint += area; if (lv === lowest) { S.found += g.len; S.footprint += g.len * w.t / 2; } }
      else { S.cloisons += g.len; S.cloisonArea += area; S.paint += 2 * area; }
    }
    for (const op of lv.open) { const w = lv.walls.find(x => x.id === op.wall); if (!w) continue; const d = OPDEF[op.kind]; S.openings.push({ level: lv.name, kind: op.kind, n: d.n, w: op.w, h: op.h, sill: isWindow(op.kind) ? op.sill : 0, area: op.w * op.h }); S.counts[op.kind] = (S.counts[op.kind] || 0) + 1; if (isDoorLike(op.kind) && op.kind !== 'garage' && op.kind !== 'gate') S.plinths -= op.w; }
    for (const rf of lv.roofs) { const a = roofArea(rf), g = roofGutters(rf); S.roofs.push({ id: rf.id, level: lv.name, type: rf.type, mat: rf.mat, area: a, pitch: rf.pitch, gutters: g.len, pipes: g.pipes }); S.roofArea += a; S.gutters += g.len; S.pipes += g.pipes; }
    for (const f of lv.furn) { const d = fdesc(f, P); if (STRUCT_TYPES.includes(f.type)) S.structTotal += +f.p || 0; else S.furnTotal += +f.p || 0; }
  }
  S.plinths = Math.max(0, S.plinths);
  // quantit\u00e9s
  const Q = []; const q = (lot, item, val, unit, note) => Q.push({ lot, item, val, unit, note: note || '' });
  q('Gros \u0153uvre', 'Murs ext\u00e9rieurs (surface nette)', S.extWallArea / 1e4, 'm\u00b2'); q('Gros \u0153uvre', 'Blocs b\u00e9ton 20 \u00d7 50', Math.ceil(S.extWallArea / 1e4 * 10 * 1.05), 'u', '10 blocs/m\u00b2 + 5 %');
  q('Gros \u0153uvre', 'Fondations (semelles filantes)', S.found / 100, 'ml'); q('Gros \u0153uvre', 'B\u00e9ton de fondation', S.found / 100 * 0.5 * 0.35, 'm\u00b3', 'semelle 50 \u00d7 35 cm');
  q('Gros \u0153uvre', 'Dalles et planchers', S.slabs / 1e4, 'm\u00b2'); q('Gros \u0153uvre', 'B\u00e9ton de dalles', S.slabVol / 1e6, 'm\u00b3');
  q('Pl\u00e2trerie', 'Cloisons (longueur)', S.cloisons / 100, 'ml'); q('Pl\u00e2trerie', 'Plaques de pl\u00e2tre BA13', Math.ceil(S.cloisonArea * 2 / 1e4 * 1.1 / 3), 'plaques', '2 faces, plaques de 3 m\u00b2, +10 %');
  q('Isolation', 'Isolation des murs ext\u00e9rieurs', S.extWallArea / 1e4, 'm\u00b2'); q('Isolation', 'Isolation des plafonds', S.ceilings / 1e4, 'm\u00b2');
  for (const k in S.facadeBy) q('Fa\u00e7ades', FACADES[k] ? FACADES[k].n : k, S.facadeBy[k] / 1e4, 'm\u00b2');
  for (const rf of S.roofs) { const m = ROOFMATS[rf.mat]; q('Toiture', `${ROOFTYPES[rf.type]} \u00b7 ${m.n}`, rf.area / 1e4, 'm\u00b2'); if (m.per) q('Toiture', m.unit === 'tuiles' ? 'Tuiles' : 'Ardoises', Math.ceil(rf.area / 1e4 * m.per * 1.05), 'u', `${m.per}/m\u00b2 + 5 %`); }
  if (S.gutters) { q('Toiture', 'Goutti\u00e8res', S.gutters / 100, 'ml'); q('Toiture', 'Descentes d\'eau pluviale', S.pipes, 'u'); }
  for (const k in S.counts) q('Menuiseries', OPDEF[k].n, S.counts[k], 'u');
  for (const k in S.floors) q('Rev\u00eatements de sol', MATS[k].n, S.floors[k] / 1e4 * 1.1, 'm\u00b2', '+10 % de chutes');
  q('Rev\u00eatements de sol', 'Plinthes', S.plinths / 100, 'ml');
  q('Peinture', 'Surfaces \u00e0 peindre (murs)', S.paint / 1e4, 'm\u00b2'); q('Peinture', 'Peinture murale', Math.ceil(S.paint / 1e4 * 2 / 10), 'L', '2 couches, 10 m\u00b2/L'); q('Peinture', 'Peinture plafonds', Math.ceil(S.ceilings / 1e4 * 2 / 10), 'L');
  for (const k in S.extFloors) q('Ext\u00e9rieurs', MATS[k].n, S.extFloors[k] / 1e4, 'm\u00b2');
  S.quantities = Q;
  S.cost = estimateCost(P, S);
  return S;
}
const GAMMES = { eco: { n: '\u00c9conomique', k: 0.85 }, standard: { n: 'Standard', k: 1 }, premium: { n: 'Haut de gamme', k: 1.35 } };
function estimateCost(P, S) {
  const g = (GAMMES[P.gamme] || GAMMES.standard).k, lots = []; const L = (n, v) => lots.push({ n, v: Math.max(0, v) });
  const hab = S.hab / 1e4;
  L('Terrassement et fondations', S.found / 100 * 165 + S.footprint / 1e4 * 28);
  L('Gros \u0153uvre (murs, dalles)', S.extWallArea / 1e4 * 115 + S.cloisonArea / 1e4 * 48 + S.slabs / 1e4 * 95);
  L('Charpente et couverture', sum(S.roofs, r => r.area / 1e4 * ((ROOFMATS[r.mat] || {}).p || 100) + (r.type === 'flat' ? 0 : r.area / 1e4 * 45)) + S.gutters / 100 * 38);
  L('Fa\u00e7ades', sum(Object.keys(S.facadeBy), k => S.facadeBy[k] / 1e4 * ((FACADES[k] || {}).p || 50)));
  L('Menuiseries', sum(S.openings, o => { const d = OPDEF[o.kind]; return d.p * Math.max(0.6, o.w / d.w); }));
  L('Isolation et pl\u00e2trerie', S.extWallArea / 1e4 * 48 + S.ceilings / 1e4 * 42);
  L('\u00c9lectricit\u00e9', hab * 85); L('Plomberie et sanitaires', S.rooms.filter(r => ['sdb', 'wc', 'cuisine', 'sejcuis', 'cellier'].includes(r.type)).length * 2600 + 1800);
  L('Chauffage et ventilation', hab * 78);
  L('Rev\u00eatements de sol', sum(Object.keys(S.floors), k => S.floors[k] / 1e4 * MATS[k].p));
  L('Peinture', S.paint / 1e4 * 24 + S.ceilings / 1e4 * 22);
  L('Am\u00e9nagements ext\u00e9rieurs', sum(Object.keys(S.extFloors), k => S.extFloors[k] / 1e4 * MATS[k].p));
  L('Escaliers, chemin\u00e9e, piscine', S.structTotal);
  const build = sum(lots, l => l.v) * g; const furn = S.furnTotal;
  return { lots: lots.map(l => ({ n: l.n, v: l.v * g })), build, furn, total: build + furn, perM2: hab > 0 ? build / hab : 0, low: build * 0.85, high: build * 1.15, gamme: P.gamme || 'standard' };
}

/* ---------------- g\u00e9n\u00e9rateur de maisons ---------------- */
const RSPEC = { sejcuis: { flex: 1, min: 400 }, sejour: { flex: 1, min: 350 }, cuisine: { min: 250, max: 420 }, chambre: { flex: 1, min: 270 }, sdb: { min: 170, max: 300 }, wc: { min: 95, max: 140 }, entree: { min: 180, max: 320 }, cellier: { min: 150, max: 260 }, bureau: { min: 250, max: 360 }, couloir: { min: 100 } };
function bandLayout(rooms, W, D) {
  const ws = rooms.map(r => { const s = RSPEC[r.type] || {}; return r.flex || s.flex ? null : clamp(r.area * 1e4 / D, s.min || 120, s.max || 600); });
  const fixed = sum(ws.filter(v => v != null)); const flex = rooms.filter((r, i) => ws[i] == null); let rem = W - fixed;
  if (flex.length && rem > flex.length * 150) { const fa = sum(flex, r => Math.max(r.area, 8)); rooms.forEach((r, i) => { if (ws[i] == null) ws[i] = rem * Math.max(r.area, 8) / fa; }); }
  else { rooms.forEach((r, i) => { if (ws[i] == null) ws[i] = Math.max(r.area, 8) * 1e4 / D; }); const tot = sum(ws); for (let i = 0; i < ws.length; i++) ws[i] *= W / tot; }
  const out = []; let x = 0; rooms.forEach((r, i) => { const x1 = i === rooms.length - 1 ? W : r5(x + ws[i]); out.push({ spec: r, x0: x, x1 }); x = x1; }); return out;
}
function bandMinW(rooms, D) { return sum(rooms, r => { const s = RSPEC[r.type] || {}; return (r.flex || s.flex) ? (s.min || 250) : clamp(r.area * 1e4 / D, s.min || 120, s.max || 600); }); }
// un WC trop profond est coup\u00e9 en deux : WC c\u00f4t\u00e9 circulation, placard derri\u00e8re
function splitDeepWC(rects, D) {
  const out = []; for (const r of rects) { if (r.spec.type !== 'wc' || D <= 230) { out.push(r); continue; } const fromS = r.door === 'S';
    const wcR = Object.assign({}, r, fromS ? { y0: r.y1 - 160 } : { y1: r.y0 + 160 }); const pl = Object.assign({}, r, fromS ? { y1: r.y1 - 160 } : { y0: r.y0 + 160 }, { spec: { type: 'cellier', name: 'Placard' }, placard: true, door: 'E' }); out.push(wcR, pl); }
  return out;
}
function interleave(a, b) { const o = []; const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { if (a[i]) o.push(a[i]); if (b[i]) o.push(b[i]); } return o; }
function wallsFromRects(lv, rects) {
  const H = {}, V = {}, add = (M, k, a, b) => { (M[k] = M[k] || []).push([Math.min(a, b), Math.max(a, b)]); };
  const corners = []; rects.forEach(r => { add(H, r.y0, r.x0, r.x1); add(H, r.y1, r.x0, r.x1); add(V, r.x0, r.y0, r.y1); add(V, r.x1, r.y0, r.y1); corners.push([r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]); });
  const inside = (x, y) => rects.filter(r => x > r.x0 + 0.5 && x < r.x1 - 0.5 && y > r.y0 + 0.5 && y < r.y1 - 0.5);
  const segs = [];
  const run = (M, horiz) => { for (const key in M) { const k = +key; const iv = M[key].sort((p, q) => p[0] - q[0]); const uni = []; for (const [a, b] of iv) { if (uni.length && a <= uni[uni.length - 1][1] + 0.5) uni[uni.length - 1][1] = Math.max(uni[uni.length - 1][1], b); else uni.push([a, b]); }
    const bp = new Set(); corners.forEach(c => { if (Math.abs((horiz ? c[1] : c[0]) - k) < 0.5) bp.add(horiz ? c[0] : c[1]); });
    for (const [a, b] of uni) { const pts = [a, ...[...bp].filter(v => v > a + 0.5 && v < b - 0.5).sort((p, q) => p - q), b]; for (let i = 0; i < pts.length - 1; i++) segs.push(horiz ? [[pts[i], k], [pts[i + 1], k]] : [[k, pts[i]], [k, pts[i + 1]]]); } } };
  run(H, true); run(V, false);
  for (const [a, b] of segs) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, horiz = a[1] === b[1]; const s1 = inside(mx + (horiz ? 0 : 15), my + (horiz ? 15 : 0)), s2 = inside(mx - (horiz ? 0 : 15), my - (horiz ? 15 : 0)); const both = s1.length && s2.length; const garageSplit = both && (s1.some(r => r.garage) !== s2.some(r => r.garage)); lv.walls.push({ id: uid(), x1: a[0], y1: a[1], x2: b[0], y2: b[1], t: both && !garageSplit ? 10 : 20, kind: 'wall', c: '#F2EEE6' }); }
}
function rectSide(rect, side) { // ar\u00eate d'un rectangle : N (y0) S (y1) W (x0) E (x1)
  const m = { N: [[rect.x0, rect.y0], [rect.x1, rect.y0]], S: [[rect.x1, rect.y1], [rect.x0, rect.y1]], W: [[rect.x0, rect.y1], [rect.x0, rect.y0]], E: [[rect.x1, rect.y0], [rect.x1, rect.y1]] }[side];
  const a = m[0], b = m[1], L = hyp(b[0] - a[0], b[1] - a[1]); return { a, b, L, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L };
}
function putOpening(lv, rect, side, kind, width, frac, opt) {
  const e = rectSide(rect, side); let ws = edgeWalls(lv, e); if (OPDEF[kind] && OPDEF[kind].ext && kind !== 'garage') ws = ws.filter(s => wallSides(lv, s.w).exterior); if (!ws.length) return null;
  // portion la plus proche de la fraction demand\u00e9e
  const target = e.L * (frac == null ? 0.5 : frac); let pick = ws[0], bd = Infinity; for (const s of ws) { const d = target < s.lo ? s.lo - target : target > s.hi ? target - s.hi : 0; if (d < bd || (d === bd && s.len > pick.len)) { bd = d; pick = s; } }
  const w = pick.w, g = wg(w); const wd = Math.min(width || OPDEF[kind].w, pick.len - 20); if (wd < OPDEF[kind].min * 0.8) return null;
  const tc = clamp(target, pick.lo + wd / 2 + 10, pick.hi - wd / 2 - 10); const P0 = [e.a[0] + e.ux * tc, e.a[1] + e.uy * tc]; const along = (P0[0] - w.x1) * g.ux + (P0[1] - w.y1) * g.uy;
  const pos = freePos(lv, w, along, wd); if (pos == null) return null;
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2, mid = [w.x1 + g.ux * pos, w.y1 + g.uy * pos];
  const into = Math.sign((cx - mid[0]) * g.nx + (cy - mid[1]) * g.ny) || 1;
  return addOpening(lv, w, pos, kind, wd, Object.assign({ side: (opt && opt.out) ? -into : into, hinge: (opt && opt.hinge) || 1 }, (opt && opt.extra) || {}));
}
function putFurn(lv, rect, type, side, frac, extra) {
  const d = FURN[type]; const f = makeFurn(type, 0, 0, 0, extra); const off = 10 + 1; const fw = f.w, fd = f.d;
  const rot = { N: 0, S: 180, W: 270, E: 90 }[side]; f.r = rot;
  if (side === 'N' || side === 'S') { f.x = clamp(rect.x0 + (rect.x1 - rect.x0) * frac, rect.x0 + off + fw / 2, rect.x1 - off - fw / 2); f.y = side === 'N' ? rect.y0 + off + fd / 2 : rect.y1 - off - fd / 2; }
  else if (side === 'W' || side === 'E') { f.y = clamp(rect.y0 + (rect.y1 - rect.y0) * frac, rect.y0 + off + fw / 2, rect.y1 - off - fw / 2); f.x = side === 'W' ? rect.x0 + off + fd / 2 : rect.x1 - off - fd / 2; }
  else { f.r = 0; f.x = rect.x0 + (rect.x1 - rect.x0) * (frac && frac[0] != null ? frac[0] : 0.5); f.y = rect.y0 + (rect.y1 - rect.y0) * (frac && frac[1] != null ? frac[1] : 0.5); }
  if ((rect.x1 - rect.x0) < (side === 'W' || side === 'E' ? fd : fw) + 20 || (rect.y1 - rect.y0) < (side === 'W' || side === 'E' ? fw : fd) + 20) { if (!d.free) return null; }
  f.x = Math.round(f.x); f.y = Math.round(f.y); lv.furn.push(f); return f;
}
function furnishRoom(lv, rect, spec, back, lvH) {
  const W = rect.x1 - rect.x0, D = rect.y1 - rect.y0;
  switch (spec.type) {
    case 'sejcuis': case 'sejour': {
      if (spec.type === 'sejcuis') { const k = putFurn(lv, rect, 'kitchen', 'W', 0.2); if (k) { const fy = k.y + k.w / 2 + 34; if (fy + 33 < rect.y1 - 10) lv.furn.push(makeFurn('fridge', rect.x0 + 11 + 33, fy, 270)); } }
      const big = W >= 560; const tx = spec.type === 'sejcuis' ? rect.x0 + Math.min(W * 0.42, 330) : rect.x0 + W * 0.3;
      if (spec.type === 'sejcuis' || W >= 500) { const t = makeFurn(big ? 'table6' : 'table4', tx, rect.y0 + D * 0.42, 0); lv.furn.push(t); lv.furn.push(makeFurn('pendant', t.x, t.y, 0, { z: lvH - 35 - 75 })); }
      const sx = rect.x1 - 10 - 47, sy = rect.y0 + D * 0.52; lv.furn.push(makeFurn('rug', sx - 150, sy, 90)); lv.furn.push(makeFurn('sofa', sx, sy, 90)); lv.furn.push(makeFurn('coffee', sx - 47 - 70, sy, 90));
      if (W >= 600) lv.furn.push(makeFurn('arm', sx - 250, sy + 85, 300));
      putFurn(lv, rect, 'plant2', 'S', 0.02); lv.furn.push(makeFurn('lamp', rect.x1 - 35, rect.y0 + 35, 0)); break;
    }
    case 'cuisine': { putFurn(lv, rect, 'kitchen', back, 0.5); if (W > 300 && D > 300) lv.furn.push(makeFurn('table4', rect.x0 + W / 2, rect.y0 + D * 0.62, 0)); break; }
    case 'chambre': {
      const bt = spec.main ? 'bed2' : 'bed1'; const b = putFurn(lv, rect, bt, 'W', 0.5);
      if (b) { lv.furn.push(makeFurn('night', rect.x0 + 11 + 20, b.y - b.w / 2 - 25, 270)); if (bt === 'bed2') lv.furn.push(makeFurn('night', rect.x0 + 11 + 20, b.y + b.w / 2 + 25, 270)); }
      if (W >= 330) putFurn(lv, rect, 'ward', 'E', back === 'N' ? 0.75 : 0.25); if (!spec.main && W >= 300 && D >= 300) putFurn(lv, rect, 'desk', back, 0.75); break;
    }
    case 'sdb': {
      if (spec.bath && W >= 180) putFurn(lv, rect, 'bath', back, 0.5); else putFurn(lv, rect, 'shower', back, 0);
      putFurn(lv, rect, W >= 230 ? 'vanity2' : 'vanity', 'E', 0.55); if (spec.wcInside) putFurn(lv, rect, 'wc', 'W', back === 'N' ? 0.8 : 0.2); break;
    }
    case 'wc': putFurn(lv, rect, 'wc', back, 0.5); break;
    case 'entree': putFurn(lv, rect, 'plant', back === 'N' ? 'S' : 'N', 0.05); if (W > 200) putFurn(lv, rect, 'mirror', 'W', 0.5); break;
    case 'bureau': { const dk = putFurn(lv, rect, 'desk', back, 0.5); if (dk) { const [ox, oy] = { N: [0, 1], S: [0, -1] }[back] || [0, 1]; lv.furn.push(makeFurn('ochair', dk.x + ox * 70, dk.y + oy * 70, back === 'N' ? 180 : 0)); } putFurn(lv, rect, 'shelf', 'W', 0.5); break; }
    case 'cellier': putFurn(lv, rect, 'washer', 'W', 0.25); putFurn(lv, rect, 'dryer', 'W', 0.7); break;
    case 'garage': lv.furn.push(makeFurn('car', (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2 + 20, 0)); break;
  }
}
function generateHouse(opts) {
  const o = Object.assign({ area: 110, bedrooms: 3, bathrooms: 1, wc: null, levels: 1, garage: false, terrace: true, pool: false, office: false, openKitchen: true, style: 'contemporain', name: '' }, opts || {});
  o.area = clamp(+o.area || 110, 35, 450); o.bedrooms = clamp(Math.round(+o.bedrooms || 0), 0, 8); o.bathrooms = clamp(Math.round(+o.bathrooms || 1), 1, 4); o.levels = (+o.levels >= 2) ? 2 : 1; if (o.wc == null) o.wc = o.area >= 75; if (!STYLES[o.style]) o.style = 'contemporain';
  const st = STYLES[o.style]; const P = blankProject(); P.name = o.name || `Maison ${Math.round(o.area)} m\u00b2`; P.style = o.style; P.facade = st.facade; P.frame = st.frame; P.roofType = st.roof.type;
  const A = o.area, C = 110;
  const beds = []; for (let i = 0; i < o.bedrooms; i++) beds.push({ type: 'chambre', name: o.bedrooms > 1 ? (i === 0 ? 'Chambre parentale' : `Chambre ${i + 1}`) : 'Chambre', area: i === 0 ? (A >= 110 ? 14 : 12.5) : (A >= 110 ? 11 : 10), flex: 1, main: i === 0 });
  const wets = []; for (let i = 0; i < o.bathrooms; i++) wets.push({ type: 'sdb', name: i === 0 ? 'Salle de bain' : "Salle d'eau", area: i === 0 ? 6 : 4.5, bath: i === 0 });
  const wc = o.wc ? { type: 'wc', name: 'WC', area: 1.8 } : null; if (!wc && wets[0]) wets[0].wcInside = true;
  const cel = A >= 95 ? { type: 'cellier', name: 'Cellier', area: 4.5 } : null, off = o.office ? { type: 'bureau', name: 'Bureau', area: 9 } : null;
  const ent = { type: 'entree', name: 'Entr\u00e9e', area: A >= 90 ? 6 : 4.5 };
  const levels = []; let W, Dn, Ds;
  if (o.levels === 1) {
    const night = interleave(beds, wets); if (wc) night.splice(Math.min(2, night.length), 0, wc);
    const living = o.openKitchen ? [{ type: 'sejcuis', name: 'S\u00e9jour / cuisine', area: 30, flex: 1 }] : [{ type: 'sejour', name: 'S\u00e9jour', area: 24, flex: 1 }, { type: 'cuisine', name: 'Cuisine', area: 11 }];
    const day = [...living, ent, cel, off].filter(Boolean);
    const An = sum(night, r => r.area) * 1e4, Afix = sum(day.filter(r => !r.flex), r => r.area) * 1e4; Dn = 370; Ds = 520; W = 700;
    for (let it = 0; it < 6; it++) { W = Math.max(An / Dn, 650, bandMinW(night, Dn), bandMinW(day, Ds)); const livingA = Math.max(22e4, A * 1e4 - An - W * C - Afix); const Ad = livingA + Afix; Ds = Ad / W; if (Ds < 420) Ds = 420; if (Ds > 650) { Ds = 650; W = Ad / Ds; Dn = clamp(An / W, 300, 460); } }
    W = r5(W); Dn = r5(Dn); Ds = r5(Ds);
    levels.push({ north: night, south: day, northDoor: 'S', southDoor: 'N' });
  } else {
    const upN = [], upS = []; const night = interleave(beds, wets); if (wc) night.push(Object.assign({}, wc));
    night.forEach((r, i) => (i % 2 ? upS : upN).push(r));
    if (!upS.some(r => r.flex) && upN.length > 1) { const k = upN.findIndex(r => r.flex); if (k >= 0 && upN.filter(r => r.flex).length > 1) upS.push(upN.splice(k, 1)[0]); }
    const gN = [{ type: 'cuisine', name: 'Cuisine', area: 12, flex: 1 }, cel, wc ? { type: 'wc', name: 'WC', area: 1.8 } : null, off].filter(Boolean);
    const gS = [{ type: o.openKitchen ? 'sejour' : 'sejour', name: 'S\u00e9jour', area: 30, flex: 1 }, ent];
    gN[0].min = 300; Dn = A < 120 ? 340 : 380; Ds = A < 120 ? 400 : 440; const An = sum(night, r => r.area) * 1e4; W = r5(Math.max(An / (Dn + Ds), A * 1e4 / (2 * (Dn + C + Ds)), 650, bandMinW(gN, Dn) + 50, bandMinW(gS, Ds), bandMinW(upN, Dn), bandMinW(upS, Ds)));
    levels.push({ north: gN, south: gS, northDoor: 'S', southDoor: 'N', ground: 1 }, { north: upN.length ? upN : [{ type: 'autre', name: 'Mezzanine', area: 10, flex: 1 }], south: upS.length ? upS : [{ type: 'autre', name: 'Bureau', area: 10, flex: 1 }], northDoor: 'S', southDoor: 'N', up: 1 });
  }
  const Ytot = Dn + C + Ds; P.levels = [];
  levels.forEach((L, li) => {
    const lv = newLevel(li === 0 ? 'Rez-de-chauss\u00e9e' : '\u00c9tage', li === 0 ? 0 : 270, li === 0 ? 'rdc' : 'etage'); P.levels.push(lv);
    let rects = [];
    bandLayout(L.north, W, Dn).forEach(b => rects.push({ x0: b.x0, x1: b.x1, y0: 0, y1: Dn, spec: b.spec, door: L.northDoor, back: 'N' }));
    rects.push({ x0: 0, x1: W, y0: Dn, y1: Dn + C, spec: { type: 'couloir', name: li === 0 && o.levels === 2 ? 'D\u00e9gagement' : (li === 1 ? 'Palier' : 'D\u00e9gagement') } });
    bandLayout(L.south, W, Ds).forEach(b => rects.push({ x0: b.x0, x1: b.x1, y0: Dn + C, y1: Ytot, spec: b.spec, door: L.southDoor, back: 'S' }));
    rects = splitDeepWC(rects, Math.max(Dn, Ds));
    if (li === 0 && o.garage) { const gy0 = Ytot >= 600 ? Ytot - 600 : 0; rects.push({ x0: W, x1: W + 340, y0: gy0, y1: Ytot, spec: { type: 'garage', name: 'Garage' }, garage: true }); }
    wallsFromRects(lv, rects);
    rects.forEach(r => { const fl = { sejcuis: 'day', sejour: 'day', cuisine: 'day', bureau: 'day', couloir: 'day', entree: 'entree', chambre: 'night', autre: 'night', sdb: 'wet', wc: 'wet', cellier: 'wet', garage: 'garage' }[r.spec.type] || 'day'; lv.rooms.push({ id: uid(), name: r.spec.name, type: r.spec.type, pts: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], mat: st.floors[fl] || 'oak' }); r.id = lv.rooms[lv.rooms.length - 1].id; });
    // ouvertures
    for (const r of rects) {
      const t = r.spec.type, w = r.x1 - r.x0;
      if (t === 'couloir' || t === 'garage') continue;
      if (r.placard) { if (!putOpening(lv, r, 'E', 'slide', Math.min(80, r.y1 - r.y0 - 30), 0.5)) putOpening(lv, r, 'W', 'slide', Math.min(80, r.y1 - r.y0 - 30), 0.5); continue; }
      const ext = r.back; // c\u00f4t\u00e9 ext\u00e9rieur
      if (['chambre', 'bureau', 'cuisine', 'cellier', 'sdb', 'wc', 'autre'].includes(t)) putOpening(lv, r, r.door, 'door', t === 'cellier' ? 73 : 83, r.door === 'S' || r.door === 'N' ? (t === 'sdb' || t === 'wc' ? 0.5 : 0.8) : 0.5);
      if (t === 'sejcuis' || t === 'sejour') { putOpening(lv, r, r.door, 'passage', 140, li === 0 && o.levels === 2 ? 0.4 : 0.85); putOpening(lv, r, ext, 'bay', Math.min(300, w * 0.45), 0.42); if (w > 520) putOpening(lv, r, ext, 'window', 120, 0.86); if (r.x0 === 0) putOpening(lv, r, 'W', 'window', 120, ext === 'S' ? 0.75 : 0.25); }
      if (t === 'entree') { putOpening(lv, r, ext, 'entry', 95, 0.5); putOpening(lv, r, r.door, 'passage', 100, 0.5); }
      if (t === 'chambre') { putOpening(lv, r, ext, w > 330 ? 'frenchdoor' : 'window', w > 330 ? 140 : 120, 0.5); if (r.x0 === 0 || r.x1 === W) { } }
      if (t === 'bureau' || t === 'autre') putOpening(lv, r, ext, 'window', 120, 0.5);
      if (t === 'cuisine') putOpening(lv, r, ext, 'window', 140, 0.5);
      if (t === 'cellier') putOpening(lv, r, ext, 'window1', 60, 0.5, { extra: { sill: 120, h: 80 } });
      if (t === 'sdb') putOpening(lv, r, ext, 'window1', 60, 0.5, { extra: { sill: 130, h: 70 } });
      if (t === 'wc') putOpening(lv, r, ext, 'window1', 45, 0.5, { extra: { sill: 150, h: 60 } });
    }
    const gar = rects.find(r => r.garage);
    if (gar) { putOpening(lv, gar, 'S', 'garage', 240, 0.5, { out: true }); const corr = rects.find(r => r.spec.type === 'couloir'); const tgt = corr && corr.y1 > gar.y0 ? corr : rects.filter(r => r.x1 === W && r.y1 > gar.y0 && !r.garage).pop(); if (tgt) { const yy = (Math.max(gar.y0, tgt.y0) + Math.min(gar.y1, tgt.y1)) / 2; putOpening(lv, gar, 'W', 'door', 83, (yy - gar.y0) / (gar.y1 - gar.y0)); } putOpening(lv, gar, 'E', 'window1', 60, 0.5, { extra: { sill: 140, h: 60 } }); }
    // mobilier
    rects.forEach(r => { if (!r.placard) furnishRoom(lv, r, r.spec, r.back || 'N', lv.h); });
    // escalier
    if (o.levels === 2) { const corr = rects.find(r => r.spec.type === 'couloir'); if (li === 0) lv.furn.push(makeFurn('stairs', W - 30 - 150, Dn + C / 2, 90, { w: 90, d: 300, c: st.pal.wood })); }
  });
  // garde-corps de tr\u00e9mie : rien de plus ; ext\u00e9rieurs
  const L0 = P.levels[0], sej = L0.rooms.find(r => r.type === 'sejcuis' || r.type === 'sejour'), entR = L0.rooms.find(r => r.type === 'entree');
  const Wtot = W + (o.garage ? 340 : 0); let yEnd = Ytot;
  if (o.terrace && sej) { const b = bbox(sej.pts); L0.rooms.push({ id: uid(), name: 'Terrasse', type: 'exterieur', pts: [[b.x0, Ytot], [b.x1, Ytot], [b.x1, Ytot + 350], [b.x0, Ytot + 350]], mat: o.style === 'contemporain' || o.style === 'scandinave' ? 'deck' : 'stone' }); const tb = { x0: b.x0, x1: b.x1, y0: Ytot, y1: Ytot + 350 }; L0.furn.push(makeFurn('gtable', (tb.x0 + tb.x1) / 2, Ytot + 190, 0)); L0.furn.push(makeFurn('parasol', (tb.x0 + tb.x1) / 2, Ytot + 190, 0)); yEnd = Ytot + 350; }
  let lotY1 = yEnd + 700;
  let lotX0 = -500;
  if (o.pool) { const px = -300 - 520, py = Math.max(Ytot / 2, 420); L0.rooms.push({ id: uid(), name: 'Plage de piscine', type: 'exterieur', pts: [[px - 520, py - 320], [px + 520, py - 320], [px + 520, py + 320], [px - 520, py + 320]], mat: 'stone' }); L0.furn.push(makeFurn('pool', px, py, 0)); L0.furn.push(makeFurn('lounger', px - 300, py + 250, 0)); L0.furn.push(makeFurn('lounger', px - 200, py + 250, 0)); lotX0 = px - 520 - 450; lotY1 = Math.max(lotY1, py + 320 + 500); }
  const lot = { x0: lotX0, y0: -500, x1: Wtot + 500, y1: lotY1 };
  if (entR) { const b = bbox(entR.pts); L0.rooms.push({ id: uid(), name: 'All\u00e9e', type: 'exterieur', pts: [[b.cx - 70, Ytot], [b.cx + 70, Ytot], [b.cx + 70, lot.y1], [b.cx - 70, lot.y1]], mat: 'gravel' }); }
  if (o.garage) { L0.rooms.push({ id: uid(), name: 'Stationnement', type: 'exterieur', pts: [[W, Ytot], [W + 340, Ytot], [W + 340, lot.y1], [W, lot.y1]], mat: 'pavers' }); }
  // cl\u00f4tures et portail
  const fence = (a, b, kind) => { const w = { id: uid(), x1: a[0], y1: a[1], x2: b[0], y2: b[1], t: WALLDEF[kind], kind, c: '#F2EEE6' }; L0.walls.push(w); return w; };
  fence([lot.x0, lot.y0], [lot.x1, lot.y0], 'hedge'); fence([lot.x1, lot.y0], [lot.x1, lot.y1], 'fence'); fence([lot.x0, lot.y1], [lot.x0, lot.y0], 'fence');
  const sf = fence([lot.x1, lot.y1], [lot.x0, lot.y1], 'fence'); const gx = o.garage ? W + 170 : (entR ? bbox(entR.pts).cx : W / 2); addOpening(L0, sf, lot.x1 - gx, 'gate', o.garage ? 400 : 300, { closed: true });
  L0.furn.push(makeFurn('tree', lot.x0 + 260, lot.y0 + 260, 0)); L0.furn.push(makeFurn('tree2', lot.x1 - 220, lot.y0 + 220, 0)); L0.furn.push(makeFurn('bush', lot.x0 + 150, lot.y1 - 160, 0)); L0.furn.push(makeFurn('bush', lot.x0 + 260, lot.y1 - 140, 0));
  P.terrain = { x: (lot.x0 + lot.x1) / 2, y: (lot.y0 + lot.y1) / 2, w: lot.x1 - lot.x0, d: lot.y1 - lot.y0, slope: 0, dir: 'sud' };
  P.cur = P.levels[0].id;
  autoRoofs(P, st.roof.type, st.roof);
  applyStyle(P, o.style, { keepFloors: true });
  return P;
}

/* ---------------- styles ---------------- */
function applyStyle(P, key, opt) {
  const st = STYLES[key]; if (!st) return false; P.style = key; P.facade = st.facade; P.frame = st.frame; P.roofType = st.roof.type;
  for (const lv of P.levels) {
    const garageRooms = lv.rooms.filter(r => r.type === 'garage');
    lv.walls.forEach(w => { if (w.kind !== 'wall') return; delete w.ext; if (st.accent && garageRooms.some(g => onBoundary([(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], g.pts))) w.ext = st.accent; });
    lv.open.forEach(op => op.frame = st.frame);
    lv.rooms.forEach(r => { if (isExt(r)) return; const grp = { sejcuis: 'day', sejour: 'day', cuisine: 'day', bureau: 'day', couloir: 'day', entree: 'entree', chambre: 'night', autre: 'night', sdb: 'wet', wc: 'wet', cellier: 'wet', garage: 'garage' }[r.type] || 'day'; if (!(opt && opt.keepFloors)) r.mat = st.floors[grp] || r.mat; const paint = st.paints[grp === 'entree' ? 'day' : grp === 'garage' ? 'wet' : grp]; if (paint && r.type !== 'garage') paintRoomWalls(lv, r, paint); });
    lv.roofs.forEach(rf => { const keepFlat = rf.type === 'flat' && st.roof.type !== 'flat' && lv.roofs.length > 1 && rf !== lv.roofs[0]; if (keepFlat) return; rf.type = st.roof.type; rf.mat = st.roof.mat; rf.pitch = st.roof.pitch; rf.over = st.roof.over; });
    lv.furn.forEach(f => { const d = FURN[f.type]; if (!d || !d.role) return; const c = st.pal[d.role === 'appliance' ? null : d.role]; if (c) f.c = c; });
  }
  return true;
}

/* ---------------- op\u00e9rations de haut niveau (assistant, inspecteur) ---------------- */
const SYN = { sejour: ['sejour', 'salon', 'living', 'piece de vie', 'salle a manger'], cuisine: ['cuisine'], chambre: ['chambre', 'suite'], sdb: ['salle de bain', 'salle de bains', 'salle d eau', 'sdb', 'douche'], wc: ['wc', 'toilettes', 'toilette'], entree: ['entree', 'hall'], couloir: ['couloir', 'degagement', 'palier'], bureau: ['bureau'], cellier: ['cellier', 'buanderie'], garage: ['garage'] };
function findRoom(P, ref, preferLv) {
  if (!ref) return null; const all = []; P.levels.forEach(l => l.rooms.forEach(r => all.push({ lv: l, room: r })));
  const byId = all.find(x => x.room.id === ref); if (byId) return byId;
  const s = norm(ref); const exact = all.find(x => norm(x.room.name) === s); if (exact) return exact;
  const num = (s.match(/(\d+)/) || [])[1];
  const partial = all.filter(x => norm(x.room.name).includes(s) || s.includes(norm(x.room.name)));
  if (partial.length) return partial.sort((a, b) => (num && norm(b.room.name).includes(num) ? 1 : 0) - (num && norm(a.room.name).includes(num) ? 1 : 0) || polyArea(b.room.pts) - polyArea(a.room.pts))[0];
  for (const t in SYN) if (SYN[t].some(k => s.includes(k))) { const c = all.filter(x => x.room.type === t || (t === 'sejour' && x.room.type === 'sejcuis') || (t === 'cuisine' && x.room.type === 'sejcuis')); if (c.length) { if (/parent/.test(s)) { const m = c.find(x => /parent/.test(norm(x.room.name))); if (m) return m; } if (num) { const m = c.find(x => norm(x.room.name).includes(num)); if (m) return m; } const pl = preferLv ? c.filter(x => x.lv === preferLv) : []; return (pl.length ? pl : c).sort((a, b) => polyArea(b.room.pts) - polyArea(a.room.pts))[0]; } }
  return null;
}
function roomAt(lv, x, y) { const rs = lv.rooms.filter(r => r.pts.length >= 3 && inPoly(x, y, r.pts)).sort((a, b) => polyArea(a.pts) - polyArea(b.pts)); return rs[0] || null; }
// ouverture sur un c\u00f4t\u00e9 cardinal d'une pi\u00e8ce
function addOpeningToRoom(P, lv, room, side, kind, width) {
  if (!OPDEF[kind]) kind = 'window'; const sd = normSide(side) || 'sud'; const sv = sideVec(P, sd);
  const edges = roomEdges(room).map(e => ({ e, dot: e.nx * sv[0] + e.ny * sv[1] })).filter(x => x.dot > 0.7).sort((a, b) => b.e.L - a.e.L);
  if (!edges.length) return { ok: false, msg: `La pi\u00e8ce \u00ab ${room.name} \u00bb n'a pas de mur c\u00f4t\u00e9 ${sd}.` };
  for (const { e } of edges) {
    const ws = edgeWalls(lv, e); const pref = ws.filter(x => wallSides(lv, x.w).exterior); const list = OPDEF[kind].ext ? (pref.length ? pref : ws) : ws;
    for (let pass = 0; pass < 3; pass++) for (const s of list) {
      let wd = clamp(width || OPDEF[kind].w, OPDEF[kind].min, Math.min(OPDEF[kind].max, s.len - 20)); if (wd < OPDEF[kind].min) continue;
      const g = wg(s.w), mid = (s.lo + s.hi) / 2, pt = [e.a[0] + e.ux * mid, e.a[1] + e.uy * mid], along = (pt[0] - s.w.x1) * g.ux + (pt[1] - s.w.y1) * g.uy;
      const a0 = (e.a[0] + e.ux * s.lo - s.w.x1) * g.ux + (e.a[1] + e.uy * s.lo - s.w.y1) * g.uy, a1 = (e.a[0] + e.ux * s.hi - s.w.x1) * g.ux + (e.a[1] + e.uy * s.hi - s.w.y1) * g.uy; const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      let pos = freePos(lv, s.w, along, wd), note = '';
      if (pos == null && pass >= 1) { // 2e passe : plus grande place libre ; 3e passe : on remplace les fen\u00eatres de ce mur
        if (pass === 2) { const rm = lv.open.filter(o => o.wall === s.w.id && isWindow(o.kind) && o.pos > lo && o.pos < hi); if (rm.length) { lv.open = lv.open.filter(o => !rm.includes(o)); note = `remplace ${rm.length > 1 ? rm.length + ' fen\u00eatres' : 'la fen\u00eatre'} existante${rm.length > 1 ? 's' : ''}`; pos = freePos(lv, s.w, along, wd); } }
        else { const occ = lv.open.filter(o => o.wall === s.w.id).map(o => [o.pos - o.w / 2 - 15, o.pos + o.w / 2 + 15]).sort((p, q) => p[0] - q[0]); let best = null, cur = lo + 5; for (const [a, b] of [...occ, [hi - 5, hi - 5]]) { const L = Math.min(a, hi - 5) - cur; if (L > 0 && (!best || L > best[1] - best[0])) best = [cur, cur + L]; cur = Math.max(cur, b); } if (best && best[1] - best[0] >= OPDEF[kind].min) { wd = Math.min(wd, best[1] - best[0]); pos = (best[0] + best[1]) / 2; note = `largeur r\u00e9duite \u00e0 ${fmtLen(wd, true, 'm')} faute de place`; } }
      }
      if (pos == null) continue;
      const c = centroid(room.pts), m = [s.w.x1 + g.ux * pos, s.w.y1 + g.uy * pos]; const into = Math.sign((c[0] - m[0]) * g.nx + (c[1] - m[1]) * g.ny) || 1;
      const op = addOpening(lv, s.w, pos, kind, wd, { side: into, frame: P.frame }); return { ok: true, op, width: wd, side: sd, exterior: wallSides(lv, s.w).exterior, note };
    }
  }
  return { ok: false, msg: `Pas assez de place libre c\u00f4t\u00e9 ${sd} de \u00ab ${room.name} \u00bb.` };
}
// pose un ou plusieurs meubles c\u00f4te \u00e0 c\u00f4te contre le mur d'un c\u00f4t\u00e9 de la pi\u00e8ce
function placeAgainst(P, lv, room, items, side, align) {
  const sd = normSide(side) || 'nord', sv = sideVec(P, sd); const edges = roomEdges(room).map(e => ({ e, dot: e.nx * sv[0] + e.ny * sv[1] })).filter(x => x.dot > 0.7).sort((a, b) => b.e.L - a.e.L);
  if (!edges.length) return { ok: false, msg: `Pas de mur c\u00f4t\u00e9 ${sd} dans \u00ab ${room.name} \u00bb.` };
  const e = edges[0].e; const ws = edgeWalls(lv, e); const t = ws.length ? Math.max(...ws.map(x => x.w.t)) : 10;
  const total = sum(items, f => f.w) + 2 * (items.length - 1); if (total > e.L - t) return { ok: false, msg: 'Le mur est trop court pour ces meubles.' };
  const a = norm(align || 'centre'); let start = /deb|gauche|left/.test(a) ? t / 2 + 5 : /fin|droite|right/.test(a) ? e.L - t / 2 - 5 - total : (e.L - total) / 2;
  const nIn = [-e.nx, -e.ny]; const r = (Math.round(Math.atan2(-nIn[0], nIn[1]) * 180 / Math.PI) + 360) % 360;
  for (const f of items) { const s = start + f.w / 2; const off = t / 2 + f.d / 2 + 1; f.x = n2(e.a[0] + e.ux * s + nIn[0] * off); f.y = n2(e.a[1] + e.uy * s + nIn[1] * off); f.r = r; start += f.w + 2; }
  return { ok: true, side: sd };
}
function addLevel(P, kind) {
  const ls = sortedLevels(P); kind = LEVELKINDS[kind] ? kind : 'etage';
  if (kind === 'sous-sol') {
    const low = ls[0]; const lv = newLevel('Sous-sol', low.elev - 270, 'sous-sol'); lv.h = 250;
    lv.walls = low.walls.filter(w => w.kind === 'wall' && w.t >= 18).map(w => Object.assign(clone(w), { id: uid(), ext: 'beton' }));
    const b = mainRect(low, false); if (b) lv.rooms.push({ id: uid(), name: 'Sous-sol', type: 'cellier', pts: [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], mat: 'concrete' });
    P.levels.push(lv); const st = placeStairs(P, lv); return { lv, stairs: st };
  }
  const top = ls[ls.length - 1]; const lv = newLevel(kind === 'combles' ? 'Combles' : '\u00c9tage ' + ls.filter(l => l.elev > 0).length + (ls.filter(l => l.elev > 0).length ? '' : ''), top.elev + top.h + (top.slab || 20), kind);
  if (lv.name === '\u00c9tage 0') lv.name = '\u00c9tage'; if (/^\u00c9tage \d+$/.test(lv.name) && lv.name === '\u00c9tage 0') lv.name = '\u00c9tage';
  if (kind === 'combles') lv.h = 120;
  lv.walls = top.walls.filter(w => w.kind === 'wall' && (w.t >= 18 || wallSides(top, w).exterior)).map(w => Object.assign(clone(w), { id: uid() }));
  const b = mainRect(top, true); if (b) lv.rooms.push({ id: uid(), name: kind === 'combles' ? 'Combles' : '\u00c9tage \u00e0 am\u00e9nager', type: 'autre', pts: [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], mat: 'oak' });
  // on remonte la toiture principale
  const mains = top.roofs.filter(rf => b && inPoly(rf.x, rf.y, [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]));
  top.roofs = top.roofs.filter(rf => !mains.includes(rf)); lv.roofs = mains;
  if (kind === 'combles' && !lv.roofs.length && b) lv.roofs.push(makeRoof(b, 'gable', { pitch: 45, mat: P.style && STYLES[P.style] ? STYLES[P.style].roof.mat : 'tuiles-rouges' }));
  P.levels.push(lv); const st = placeStairs(P, top);
  return { lv, stairs: st };
}
// trouve une place pour un escalier droit dans le niveau (monte vers le niveau sup\u00e9rieur)
function placeStairs(P, lv) {
  if (lv.furn.some(isStair)) return null;
  const rooms = interiorRooms(lv).filter(r => ['couloir', 'entree', 'sejour', 'sejcuis', 'autre', 'cellier'].includes(r.type)).sort((a, b) => ['couloir', 'entree', 'sejour', 'sejcuis', 'autre', 'cellier'].indexOf(a.type) - ['couloir', 'entree', 'sejour', 'sejcuis', 'autre', 'cellier'].indexOf(b.type));
  for (const r of rooms) { const b = bbox(r.pts); const along = b.w >= b.h; const L = along ? b.w : b.h, Wd = along ? b.h : b.w; if (L < 330 || Wd < 100) continue;
    const f = makeFurn('stairs', 0, 0, along ? 90 : 0, { w: 90, d: 300 });
    if (along) { f.x = b.x1 - 20 - 150; f.y = b.y0 + 10 + 46; if (Wd < 120) f.y = b.cy; } else { f.y = b.y1 - 20 - 150; f.x = b.x0 + 10 + 46; if (Wd < 120) f.x = b.cx; }
    lv.furn.push(f); return f; }
  return null;
}
function setRoofs(P, props, onlyId) { const out = []; P.levels.forEach(l => l.roofs.forEach(rf => { if (onlyId && rf.id !== onlyId) return; if (props.type && ROOFTYPES[props.type]) { rf.type = props.type; if (props.type === 'flat') { rf.pitch = 0; rf.over = Math.min(rf.over, 15); if (!props.mat) rf.mat = 'gravier'; } else if (rf.pitch < 5) rf.pitch = props.type === 'shed' ? 10 : 35; } if (props.pitch != null && isFinite(+props.pitch)) rf.pitch = clamp(+props.pitch, rf.type === 'flat' ? 0 : 3, 60); if (props.over != null && isFinite(+props.over)) rf.over = clamp(+props.over, 0, 150); if (props.mat && ROOFMATS[props.mat]) rf.mat = props.mat; if (props.gutters != null) rf.gutters = !!props.gutters; if (props.sky != null) rf.sky = clamp(Math.round(+props.sky) || 0, 0, 8); out.push(rf); })); return out; }
function addExtension(P, lv, o) {
  const b = mainRect(lv, false); if (!b) return { ok: false, msg: 'Dessinez d\'abord la maison.' };
  const sd = normSide(o.side) || 'sud', sv = sideVec(P, sd); const W = clamp(+o.width || 400, 150, 2000), D = clamp(+o.depth || 400, 150, 2000);
  let rect; if (Math.abs(sv[1]) >= Math.abs(sv[0])) { const y0 = sv[1] > 0 ? b.y1 : b.y0 - D; rect = { x0: r5(b.cx - W / 2), x1: r5(b.cx + W / 2), y0, y1: y0 + D }; } else { const x0 = sv[0] > 0 ? b.x1 : b.x0 - D; rect = { x0, x1: x0 + D, y0: r5(b.cy - W / 2), y1: r5(b.cy + W / 2) }; }
  const c = [[rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x1, rect.y1], [rect.x0, rect.y1]];
  for (let i = 0; i < 4; i++) addWallSmart(lv, c[i], c[(i + 1) % 4], 'wall', 20);
  const type = o.type && ROOMTYPES[o.type] ? o.type : guessType(o.name || ''); const room = { id: uid(), name: o.name || ROOMTYPES[type] || 'Extension', type, pts: c, mat: o.mat && MATS[o.mat] ? o.mat : (type === 'garage' ? 'concrete' : 'oak') }; lv.rooms.push(room);
  const inner = { sud: 'N', nord: 'S', est: 'W', ouest: 'E' }; const sideMap = rv => { const ang = cardinalOf(P, rv[0], rv[1]); return ang; };
  // porte de communication sur le c\u00f4t\u00e9 accol\u00e9 \u00e0 la maison
  const shared = { x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: rect.y1 }; const adj = sv[1] > 0.7 ? 'N' : sv[1] < -0.7 ? 'S' : sv[0] > 0.7 ? 'W' : 'E';
  putOpening(lv, shared, adj, type === 'sejour' || type === 'autre' ? 'passage' : 'door', type === 'sejour' ? 160 : 83, 0.5);
  if (type === 'garage') putOpening(lv, shared, { N: 'S', S: 'N', W: 'E', E: 'W' }[adj], 'garage', 240, 0.5, { out: true }); else putOpening(lv, shared, { N: 'S', S: 'N', W: 'E', E: 'W' }[adj], 'window', 120, 0.5);
  void inner; void sideMap;
  return { ok: true, room };
}
// Implantation en for\u00eat : cl\u00f4tures retir\u00e9es, terrain \u00e9largi, sous-bois d'arbres plac\u00e9s hors de la maison et des am\u00e9nagements
function forestSetting(P, o) {
  o = o || {}; const L0 = sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]; const R = rng(o.seed || 1789);
  L0.walls = L0.walls.filter(w => w.kind !== 'fence' && w.kind !== 'hedge'); L0.furn = L0.furn.filter(f => !FURN[f.type] || !FURN[f.type].free || !/^(tree|tree2|bush)$/.test(f.type));
  const all = [].concat(...P.levels.filter(l => l.elev >= 0).map(l => l.rooms.map(r => r.pts))); const hb = bbox([].concat(...all));
  const m = o.margin || 1600, lot = { x0: hb.x0 - m, y0: hb.y0 - m, x1: hb.x1 + m, y1: hb.y1 + m + 400 };
  P.terrain = Object.assign({}, P.terrain || {}, { x: (lot.x0 + lot.x1) / 2, y: (lot.y0 + lot.y1) / 2, w: lot.x1 - lot.x0, d: lot.y1 - lot.y0, slope: o.slope != null ? o.slope : 3, dir: P.terrain && P.terrain.dir || 'sud' });
  const keep = L0.rooms.map(r => bbox(r.pts)).map(b => ({ x0: b.x0 - 260, y0: b.y0 - 260, x1: b.x1 + 260, y1: b.y1 + 260 })); keep.push({ x0: hb.x0 - 450, y0: hb.y0 - 450, x1: hb.x1 + 450, y1: hb.y1 + 650 });
  const free = (x, y, r) => !keep.some(k => x + r > k.x0 && x - r < k.x1 && y + r > k.y0 && y - r < k.y1);
  const pts = []; const n = o.trees || 70; let guard = 0;
  while (pts.length < n && guard++ < 6000) { const x = lot.x0 + 150 + R() * (lot.x1 - lot.x0 - 300), y = lot.y0 + 150 + R() * (lot.y1 - lot.y0 - 300), con = R() < (o.conifers != null ? o.conifers : .45), rr = con ? 170 : 260;
    if (!free(x, y, rr * .55)) continue; if (pts.some(q => Math.hypot(q[0] - x, q[1] - y) < (q[2] + rr) * .85)) continue; pts.push([x, y, rr, con]); }
  for (const [x, y, rr, con] of pts) { const k = .8 + R() * .55; const f = con ? makeFurn('tree2', x, y, Math.round(R() * 360), { w: Math.round(260 * k + 80), d: Math.round(260 * k + 80), h: Math.round(1100 * k + 300), c: ['#33573A', '#3E6640', '#2F4E33'][Math.floor(R() * 3)] }) : makeFurn('tree', x, y, Math.round(R() * 360), { w: Math.round(520 * k + 120), d: Math.round(520 * k + 120), h: Math.round(900 * k + 250), c: ['#4E7A3A', '#5A8442', '#466F36', '#6A8A44'][Math.floor(R() * 4)] }); L0.furn.push(f); }
  for (let i = 0; i < (o.bushes || 26); i++) { const x = lot.x0 + R() * (lot.x1 - lot.x0), y = lot.y0 + R() * (lot.y1 - lot.y0); if (!free(x, y, 90)) continue; const k = .7 + R() * .8; L0.furn.push(makeFurn('bush', x, y, 0, { w: Math.round(130 * k), d: Math.round(130 * k), h: Math.round(90 * k), c: ['#4C7136', '#5B7E3E', '#3F6431'][i % 3] })); }
  P.env = Object.assign(P.env || {}, { forest: true }); return pts.length;
}
function setTerrain(P, o) { const lv = sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]; const b = mainRect(lv, false) || { cx: 500, cy: 400, w: 1000, h: 800 }; const t = P.terrain || { x: b.cx, y: b.cy, w: Math.max(1500, b.w + 1200), d: Math.max(1500, b.h + 1400), slope: 0, dir: 'sud' }; if (o.width != null) t.w = clamp(+o.width, 300, 50000); if (o.depth != null) t.d = clamp(+o.depth, 300, 50000); if (o.slope != null) t.slope = clamp(+o.slope, 0, 40); if (o.dir) t.dir = normSide(o.dir) || t.dir; P.terrain = t; return t; }
function setMaterial(P, target, key, room, lv) {
  const tg = norm(target); const k = String(key || '');
  const findKey = (dict) => { if (dict[k]) return k; const s = norm(k); return Object.keys(dict).find(x => norm(dict[x].n) === s) || Object.keys(dict).find(x => norm(dict[x].n).includes(s) || s.includes(norm(dict[x].n))) || null; };
  const findColor = (list) => { if (/^#[0-9a-f]{6}$/i.test(k)) return k; const s = norm(k); const m = list.find(([, n]) => norm(n) === s) || list.find(([, n]) => norm(n).includes(s) || s.includes(norm(n))); return m ? m[0] : null; };
  if (/sol|parquet|carrel|revet/.test(tg)) { const m = findKey(MATS); if (!m) return { ok: false, msg: 'Rev\u00eatement inconnu. Choix : ' + Object.values(MATS).map(x => x.n).join(', ') }; const rooms = room ? [room] : P.levels.flatMap(l => l.rooms.filter(r => !isExt(r))); rooms.forEach(r => r.mat = m); return { ok: true, n: MATS[m].n, count: rooms.length }; }
  if (/mur|peint|couleur/.test(tg)) { const c = findColor(PAINTS); if (!c) return { ok: false, msg: 'Teinte inconnue. Choix : ' + PAINTS.map(p => p[1]).join(', ') }; let n = 0; if (room && lv) n = paintRoomWalls(lv, room, c); else P.levels.forEach(l => l.walls.forEach(w => { if (w.kind === 'wall' && !wallSides(l, w).exterior) { w.c = c; n++; } })); return { ok: true, n: c, count: n }; }
  if (/facad|enduit|bardage|exterieur/.test(tg)) { const m = findKey(FACADES); if (!m) return { ok: false, msg: 'Fa\u00e7ade inconnue. Choix : ' + Object.values(FACADES).map(x => x.n).join(', ') }; P.facade = m; P.levels.forEach(l => l.walls.forEach(w => delete w.ext)); return { ok: true, n: FACADES[m].n }; }
  if (/toit|couverture|tuile/.test(tg)) { const m = findKey(ROOFMATS); if (!m) return { ok: false, msg: 'Couverture inconnue. Choix : ' + Object.values(ROOFMATS).map(x => x.n).join(', ') }; setRoofs(P, { mat: m }); return { ok: true, n: ROOFMATS[m].n }; }
  if (/menuis|fenetre|chassis/.test(tg)) { const c = findColor(FRAMES); if (!c) return { ok: false, msg: 'Teinte de menuiserie inconnue. Choix : ' + FRAMES.map(f => f[1]).join(', ') }; P.frame = c; P.levels.forEach(l => l.open.forEach(o => o.frame = c)); return { ok: true, n: c }; }
  return { ok: false, msg: 'Cible inconnue : sol, murs, fa\u00e7ade, toiture ou menuiseries.' };
}
function describeProject(P) {
  const S = computeStats(P); const out = { nom: P.name, style: P.style ? STYLES[P.style].n : 'libre', orientation: `nord \u00e0 ${P.north || 0}\u00b0 (0\u00b0 = haut du plan, sens horaire)`, unites: 'm\u00e8tres', surface_habitable_m2: n2(S.hab / 1e4), niveaux: [], pieces: [], meubles: [], toitures: [], terrain: P.terrain ? { largeur_m: n2(P.terrain.w / 100), profondeur_m: n2(P.terrain.d / 100), pente_pct: P.terrain.slope } : null };
  for (const lv of sortedLevels(P)) {
    out.niveaux.push({ id: lv.id, nom: lv.name, type: lv.kind, altitude_m: n2(lv.elev / 100), hauteur_m: n2(lv.h / 100) });
    for (const r of lv.rooms) { if (r.pts.length < 3) continue; const b = bbox(r.pts); const sides = []; if (!isExt(r)) for (const e of roomEdges(r)) { const ws = edgeWalls(lv, e); if (ws.some(x => wallSides(lv, x.w).exterior)) { const s = cardinalOf(P, e.nx, e.ny); if (!sides.includes(s)) sides.push(s); } }
      const ops = lv.open.filter(o => { const c = openingCenter(lv, o); return c && onBoundary(c, r.pts, 15); }).map(o => OPDEF[o.kind].n + ' ' + n2(o.w / 100) + ' m');
      out.pieces.push({ id: r.id, nom: r.name, type: r.type, niveau: lv.name, surface_m2: n2(polyArea(r.pts) / 1e4), largeur_m: n2(b.w / 100), profondeur_m: n2(b.h / 100), murs_exterieurs: sides, sol: MATS[r.mat].n, ouvertures: ops }); }
    lv.furn.slice(0, 120).forEach(f => { const r = roomAt(lv, f.x, f.y); out.meubles.push({ id: f.id, type: f.type, nom: fdesc(f, P).n, piece: r ? r.name : null, niveau: lv.name }); });
    lv.roofs.forEach(rf => out.toitures.push({ id: rf.id, niveau: lv.name, type: ROOFTYPES[rf.type], pente_deg: rf.pitch, materiau: ROOFMATS[rf.mat].n }));
  }
  return out;
}

/* ---------------- commandes en fran\u00e7ais (sans IA) ---------------- */
const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 };
const numOf = s => { if (s == null) return null; const t = norm(s); if (NUMW[t] != null) return NUMW[t]; const v = parseFloat(t.replace(',', '.')); return isFinite(v) ? v : null; };
function parseProgram(text) {
  const s = norm(text); const nb = '(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit)'; const get = re => { const m = s.match(re); return m ? numOf(m[1]) : null; };
  const area = get(/(\d+[.,]?\d*)\s*(?:m2|m\u00b2|m 2|metres carres|m\b)/);
  const o = { area: area || 110, bedrooms: get(new RegExp(nb + '\\s+chambres?')) ?? 3, bathrooms: get(new RegExp(nb + '\\s+(?:salles? de bains?|salles? d eau|sdb)')) ?? (/(salle de bain|sdb)/.test(s) ? 1 : 1), garage: /garage/.test(s), terrace: /terrasse/.test(s) || !/sans terrasse/.test(s), pool: /piscine/.test(s), office: /bureau/.test(s), levels: /(etage|r\+1|deux niveaux|2 niveaux)/.test(s) && !/plain[- ]pied/.test(s) ? 2 : 1, openKitchen: !/cuisine (fermee|separee|independante)/.test(s) };
  o.style = /traditionn/.test(s) ? 'traditionnel' : /scandinav/.test(s) ? 'scandinave' : /industri/.test(s) ? 'industriel' : 'contemporain';
  o.wc = /wc separe|toilettes separees/.test(s) ? true : null; return o;
}
// renvoie une liste d'op\u00e9rations {op, args} comprises dans le texte
function parseCommand(text) {
  const s = norm(text); const ops = [];
  const roomRef = () => { const m = s.match(/(?:du|de la|de l|le|la|l|dans le|dans la|dans l|au|a la)\s+(salon|sejour|cuisine|chambre(?: parentale| \d+)?|salle de bains?|salle d eau|bureau|entree|garage|cellier|wc|couloir|degagement)/); return m ? m[1] : null; };
  const sideRef = () => { const m = s.match(/\b(nord|sud|est|ouest)\b/); return m ? m[1] : null; };
  const len = () => { const m = s.match(/(\d+[.,]?\d*)\s*(m|metres?|cm)\b(?!2| carre)/); if (!m) return null; const v = numOf(m[1]); return m[2] === 'cm' ? v : v * 100; };
  if (/(cree|creer|genere|dessine|fais)[- ]?(moi)?\s+(une|ma)?\s*maison/.test(s) || (/maison/.test(s) && /\d+\s*(m2|m\u00b2)/.test(s) && /chambre/.test(s))) { ops.push({ op: 'generer_maison', args: parseProgram(text) }); return ops; }
  let m = s.match(/(agrandi\w*|elargi\w*|redui\w*|retreci\w*)\s+(?:le|la|l)\s*([a-z ]+?)\s+de\s+(\d+[.,]?\d*)\s*(m2|m\u00b2|m 2|metres? carres?|m|cm)/);
  if (m) { const v = numOf(m[3]) * (/(redui|retreci)/.test(m[1]) ? -1 : 1); const area = /(m2|m\u00b2|m 2|carre)/.test(m[4]); ops.push({ op: 'agrandir_piece', args: area ? { piece: m[2].trim(), surface_m2: v, cote: sideRef() } : { piece: m[2].trim(), longueur_m: m[4] === 'cm' ? v / 100 : v, cote: sideRef() } }); }
  if (/(baie|porte[- ]fenetre|fenetre|velux|fenetre de toit)/.test(s) && /(ajoute|cree|pose|mets|perce|ouvre)/.test(s)) { const kind = /baie/.test(s) ? 'baie' : /porte[- ]fenetre/.test(s) ? 'porte-fenetre' : 'fenetre'; ops.push({ op: 'ajouter_ouverture', args: { piece: roomRef() || (kind === 'baie' ? 'sejour' : null), cote: sideRef() || 'sud', type: kind, largeur_m: (len() || (kind === 'baie' ? 240 : 120)) / 100 } }); }
  m = s.match(/(deplace|mets|pousse|place)\s+(?:la|le|les|l)\s*([a-z ]+?)\s+contre\s+(?:le\s+)?mur\s+(nord|sud|est|ouest)/);
  if (m) ops.push({ op: 'deplacer_meuble', args: { meuble: m[2].trim(), cote: m[3] } });
  if (/(contemporain|moderne|traditionnel|scandinave|industriel)/.test(s) && /(style|architecture|transforme|passe|rends|version)/.test(s)) ops.push({ op: 'appliquer_style', args: { style: /traditionn/.test(s) ? 'traditionnel' : /scandinav/.test(s) ? 'scandinave' : /industri/.test(s) ? 'industriel' : 'contemporain' } });
  if (/(ajoute|cree|rajoute|construis)\s+(un|une)?\s*(etage|niveau|sous-sol|sous sol|combles)/.test(s)) ops.push({ op: 'ajouter_niveau', args: { type: /sous.sol/.test(s) ? 'sous-sol' : /combles/.test(s) ? 'combles' : 'etage' } });
  if (/(toit|toiture)/.test(s) && /(plat|deux pans|2 pans|quatre pans|4 pans|monopente|terrasse)/.test(s)) ops.push({ op: 'modifier_toiture', args: { type: /plat|terrasse/.test(s) ? 'flat' : /(quatre|4) pans/.test(s) ? 'hip' : /monopente/.test(s) ? 'shed' : 'gable', pente_deg: numOf((s.match(/(\d+)\s*(?:\u00b0|degres)/) || [])[1]) } });
  if (/(ajoute|cree|mets)\s+(un|une)\s+(garage|veranda|extension)/.test(s)) ops.push({ op: 'ajouter_piece', args: { nom: /garage/.test(s) ? 'Garage' : /veranda/.test(s) ? 'V\u00e9randa' : 'Extension', type: /garage/.test(s) ? 'garage' : 'sejour', cote: sideRef() || 'est', largeur_m: /garage/.test(s) ? 3.4 : 4, profondeur_m: /garage/.test(s) ? 6 : 3.5 } });
  if (/(ajoute|mets)\s+(une|un)\s+(piscine|bassin)/.test(s)) ops.push({ op: 'ajouter_meuble', args: { type: 'pool', piece: null } });
  if (/(peins|peindre|peinture)/.test(s)) { const c = PAINTS.find(([, n]) => s.includes(norm(n))) || PAINTS.find(([, n]) => s.includes(norm(n).split(' ')[0])); if (c) ops.push({ op: 'changer_materiau', args: { cible: 'murs', piece: roomRef(), materiau: c[1] } }); }
  if (/(sol|parquet|carrelage|beton cire|moquette)/.test(s) && /(mets|pose|change|remplace)/.test(s)) { const k = Object.keys(MATS).find(x => s.includes(norm(MATS[x].n))) || (/parquet/.test(s) ? 'oak' : /carrelage/.test(s) ? 'tileW' : /beton/.test(s) ? 'concrete' : /moquette/.test(s) ? 'carpet' : null); if (k) ops.push({ op: 'changer_materiau', args: { cible: 'sol', piece: roomRef(), materiau: MATS[k].n } }); }
  return ops;
}

Object.assign(TP, { uid, hyp, clamp, n2, r5, clone, esc, norm, shade, rng, sum, eur, setUnit, fmtLen, parseLen, fmtArea, m2, fr,
  CATS, FURN, STRUCT_TYPES, MATS, FACADES, ROOFMATS, PAINTS, FCOLORS, FRAMES, WALLKINDS, WALLDEF, OPDEF, isGlazed, isWindow, isDoorLike, ROOFTYPES, ROOMTYPES, LEVELKINDS, STYLES, GAMMES, guessType, isExt, isHabitable,
  newLevel, blankProject, normalize, sortedLevels, levelAbove, levelBelow, fdesc, makeFurn,
  wg, segDist, segInter, polyArea, polyPerim, centroid, inPoly, same, bbox, isRect, rotPt, toLocal, furnCorners, furnHalf, northVec, sideVec, normSide, cardinalOf,
  structural, interiorRooms, wallSides, clampOpenings, splitWallAt, integrateWalls, addWallSmart, movePoints, setWallLength, wallSnapFurn, onBoundary, roomWalls, paintRoomWalls, roomEdges, edgeWalls, freePos, addOpening, openingCenter,
  stretchAll, resizeRoom, roofLocal, roofSlope, roofHLocal, roofHeightAt, roofRidge, roofArea, roofGutters, roofBase, roofGeom, mainRect, makeRoof, autoRoofs, stairRise, stairInfo, stairOutline, isStair,
  netArea, computeStats, estimateCost, generateHouse, applyStyle, findRoom, roomAt, addOpeningToRoom, placeAgainst, addLevel, placeStairs, setRoofs, addExtension, setTerrain, forestSetting, setMaterial, describeProject, parseProgram, parseCommand, numOf });
})(typeof window !== 'undefined' ? window : globalThis);
