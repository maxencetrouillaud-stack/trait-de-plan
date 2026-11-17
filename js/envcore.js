/* Trait de Plan \u2014 mod\u00e8le de l'environnement (sans DOM) :
   lieux, relief et eau autour de la maison, nature du sol, v\u00e9g\u00e9tation, ville, m\u00e9t\u00e9o, saisons, soleil g\u00e9ographique,
   luminaires r\u00e9glables, sc\u00e9narios, pr\u00e9r\u00e9glages et \u00e9dition du terrain (modelage, peinture, chemins). */
(function (G) {
'use strict';
const TP = G.TP;
const { clamp, rng, bbox, hyp, sideVec, sortedLevels, isExt, clone, FURN, CATS, WALLKINDS, WALLDEF } = TP;

/* ---------- bruit d\u00e9terministe ---------- */
function hash2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, s, oct) { oct = oct || 5; let a = .5, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += a * vnoise(x, y, s + i * 31); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= .5; } return t / n; }
function ridged(x, y, s, oct) { oct = oct || 5; let a = .5, t = 0, n = 0, w = 1; for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(vnoise(x, y, s + i * 17) * 2 - 1); v *= v; t += a * v * w; w = clamp(v * 1.5, 0, 1); n += a; x = x * 2.1 + 3.3; y = y * 2.1 + 7.7; a *= .5; } return t / n; }
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const strSeed = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- catalogues ---------- */
const ENV_CATS = [['montagne', 'Montagne'], ['mer', 'Bord de mer'], ['nature', 'Nature'], ['autre', 'Autres environnements']];
const FR = { lat: 46.6, lon: 2.4, tz: 1, dst: 1 }, ALPES = { lat: 45.92, lon: 6.87, tz: 1, dst: 1 };
const PLACES = {
  alpesSommet: { n: 'Sommet des Alpes', cat: 'montagne', geo: ALPES, relief: { type: 'summit', amp: 5, drop: 380, peaks: 950, far: 1250 }, ground: 'alpine', snowLine: 120, veg: { d: .16, mix: { conifer: 1 }, rocks: 1 }, def: { month: 7, hour: 11, weather: 'clair' }, d: 'La maison domine les vall\u00e9es, sommets enneig\u00e9s \u00e0 l\'horizon.' },
  chalet: { n: 'Chalet dans les montagnes', cat: 'montagne', geo: ALPES, relief: { type: 'mountains', amp: 14, peaks: 850, far: 520 }, ground: 'alpine', snowLine: 420, veg: { d: .62, mix: { conifer: .85, birch: .15 }, rocks: .4 }, def: { month: 2, hour: 16, weather: 'neige' }, d: 'Pentes couvertes de sapins, grands sommets tout autour.' },
  alpage: { n: 'Alpage fleuri', cat: 'montagne', geo: ALPES, relief: { type: 'mountains', amp: 9, peaks: 1100, far: 650 }, ground: 'alpine', snowLine: 380, veg: { d: .12, mix: { conifer: .8, bush: .2 }, rocks: .9, flowers: 1.3 }, def: { month: 6, hour: 9.5, weather: 'clair' }, d: 'Prairie d\'altitude en fleurs, sapins \u00e9pars, rochers et glaciers au loin.' },
  vallee: { n: 'Vall\u00e9e montagneuse', cat: 'montagne', geo: ALPES, relief: { type: 'valley', amp: 7, peaks: 950, far: 300 }, water: { type: 'river', side: 'sud', dist: 42, width: 12, level: -1.8, waves: .1 }, ground: 'meadow', snowLine: 520, veg: { d: .45, mix: { conifer: .5, decid: .3, birch: .2 }, rocks: .3, flowers: .4 }, def: { month: 6, hour: 10, weather: 'sun' }, d: 'Prairies et rivi\u00e8re au fond d\'une vall\u00e9e encaiss\u00e9e.' },
  montagneNeige: { n: 'Montagne enneig\u00e9e', cat: 'montagne', geo: ALPES, relief: { type: 'mountains', amp: 10, peaks: 1000, far: 420 }, ground: 'snow', snowLine: -1e4, veg: { d: .45, mix: { conifer: 1 }, rocks: .2 }, def: { month: 1, hour: 14, weather: 'neige', snowAcc: 1 }, d: 'Tout est blanc, sapins charg\u00e9s de neige.' },
  lacMontagne: { n: 'Bord d\'un lac de montagne', cat: 'montagne', geo: ALPES, relief: { type: 'mountains', amp: 6, peaks: 800, far: 640 }, water: { type: 'lake', side: 'sud', dist: 20, r: 260, level: -1.4, waves: .15, color: '#2E6E7A' }, ground: 'alpine', snowLine: 480, veg: { d: .5, mix: { conifer: .8, birch: .2 }, rocks: .5 }, def: { month: 8, hour: 9, weather: 'clair' }, d: 'Lac clair entour\u00e9 de for\u00eats et de sommets.' },
  falaise: { n: 'Falaise rocheuse', cat: 'montagne', geo: ALPES, relief: { type: 'cliff', side: 'sud', dist: 14, drop: 90, peaks: 700, far: 900 }, ground: 'alpine', snowLine: 600, veg: { d: .35, mix: { conifer: .7, bush: .3 }, rocks: 1 }, def: { month: 9, hour: 17, weather: 'sun' }, d: 'La maison au bord d\'un \u00e0-pic au-dessus de la vall\u00e9e.' },
  plage: { n: 'Villa en bord de plage', cat: 'mer', geo: { lat: 43.48, lon: -1.56, tz: 1, dst: 1 }, relief: { type: 'coast', side: 'sud', dist: 30, slope: .045 }, water: { type: 'sea', side: 'sud', level: -2.2, waves: .5, color: '#2F6F86' }, ground: 'dry', sand: 'sand', veg: { d: .22, mix: { pine: .6, bush: .4 } }, def: { month: 7, hour: 15, weather: 'sun' }, d: 'Dune de sable puis l\'oc\u00e9an face \u00e0 la maison.' },
  falaiseOcean: { n: 'Maison sur une falaise face \u00e0 l\'oc\u00e9an', cat: 'mer', geo: { lat: 48.35, lon: -4.75, tz: 1, dst: 1 }, relief: { type: 'cliff', side: 'sud', dist: 18, drop: 42 }, water: { type: 'sea', side: 'sud', level: -40, waves: .75, color: '#285F78' }, ground: 'grass', veg: { d: .14, mix: { bush: .7, cypress: .3 }, rocks: .8 }, def: { month: 9, hour: 18, weather: 'voile' }, d: 'Lande, falaise de granit et oc\u00e9an en contrebas.' },
  mediterranee: { n: 'Maison m\u00e9diterran\u00e9enne', cat: 'mer', geo: { lat: 43.2, lon: 5.4, tz: 1, dst: 1 }, relief: { type: 'coast', side: 'sud', dist: 70, slope: .07, hills: 22 }, water: { type: 'sea', side: 'sud', level: -6, waves: .2, color: '#2C7D9A' }, ground: 'dry', sand: 'sand', veg: { d: .45, mix: { olive: .35, cypress: .25, pine: .25, bush: .15 }, rocks: .4 }, def: { month: 7, hour: 19, weather: 'clair' }, d: 'Collines s\u00e8ches, oliviers, cypr\u00e8s et mer au loin.' },
  tropical: { n: 'Bord de mer tropical', cat: 'mer', geo: { lat: -17.53, lon: -149.57, tz: -10, dst: 0 }, relief: { type: 'coast', side: 'sud', dist: 26, slope: .03 }, water: { type: 'sea', side: 'sud', level: -1.6, waves: .25, color: '#1FA7B5', clear: 1 }, ground: 'tropical', sand: 'sandWhite', nosnow: 1, veg: { d: .5, mix: { palm: .8, bush: .2 } }, def: { month: 8, hour: 14, weather: 'sun' }, d: 'Sable blanc, cocotiers et lagon turquoise.' },
  coteRocheuse: { n: 'C\u00f4te rocheuse', cat: 'mer', geo: { lat: 48.83, lon: -3.48, tz: 1, dst: 1 }, relief: { type: 'coast', side: 'sud', dist: 26, slope: .11, rocky: 1 }, water: { type: 'sea', side: 'sud', level: -3, waves: .85, color: '#2B5E70' }, ground: 'grass', veg: { d: .2, mix: { bush: .6, conifer: .4 }, rocks: 1 }, def: { month: 10, hour: 16, weather: 'voile' }, d: 'Rochers de granit, vagues et lande.' },
  crique: { n: 'Petite crique', cat: 'mer', geo: { lat: 43.21, lon: 5.45, tz: 1, dst: 1 }, relief: { type: 'cove', side: 'sud', dist: 30, r: 80, hills: 26 }, water: { type: 'sea', side: 'sud', level: -3, waves: .12, color: '#2189A1', clear: 1 }, ground: 'dry', sand: 'sand', veg: { d: .4, mix: { pine: .6, olive: .2, bush: .2 }, rocks: 1 }, def: { month: 7, hour: 12, weather: 'clair' }, d: 'Anse abrit\u00e9e entre deux pointes rocheuses.' },
  foretDense: { n: 'For\u00eat dense', cat: 'nature', geo: FR, relief: { type: 'hills', amp: 9 }, ground: 'forest', veg: { d: 1, ring: 5, mix: { decid: .5, conifer: .38, birch: .12 }, bush: .5 }, def: { month: 6, hour: 16, weather: 'sun' }, d: 'Grands arbres serr\u00e9s jusqu\'aux abords du terrain.' },
  clairiere: { n: 'Clairi\u00e8re', cat: 'nature', geo: FR, relief: { type: 'hills', amp: 6 }, ground: 'meadow', veg: { d: .95, ring: 38, mix: { decid: .6, conifer: .25, birch: .15 }, flowers: .6 }, def: { month: 5, hour: 17, weather: 'sun' }, d: 'Prairie fleurie entour\u00e9e d\'une for\u00eat.' },
  campagne: { n: 'Campagne fran\u00e7aise', cat: 'nature', geo: FR, relief: { type: 'meadow', amp: 7, far: 260, hills: 45 }, ground: 'meadow', fields: 1, veg: { d: .26, mix: { decid: .65, fruit: .2, conifer: .15 }, flowers: .3 }, def: { month: 6, hour: 18, weather: 'voile' }, d: 'Champs, haies et collines douces.' },
  prairie: { n: 'Prairie', cat: 'nature', geo: FR, relief: { type: 'meadow', amp: 4, far: 400, hills: 25 }, ground: 'meadow', veg: { d: .08, mix: { decid: .7, bush: .3 }, flowers: 1 }, def: { month: 5, hour: 15, weather: 'sun' }, d: 'Grande \u00e9tendue d\'herbes et de fleurs.' },
  riviere: { n: 'Bord de rivi\u00e8re', cat: 'nature', geo: FR, relief: { type: 'hills', amp: 5 }, water: { type: 'river', side: 'sud', dist: 22, width: 14, level: -1.6, waves: .1, color: '#3B6A5E' }, ground: 'meadow', veg: { d: .45, mix: { decid: .45, birch: .3, conifer: .25 }, flowers: .3 }, def: { month: 6, hour: 17, weather: 'sun' }, d: 'Une rivi\u00e8re coule au bas du jardin.' },
  lac: { n: 'Bord de lac', cat: 'nature', geo: FR, relief: { type: 'hills', amp: 6 }, water: { type: 'lake', side: 'sud', dist: 18, r: 340, level: -1.3, waves: .2, color: '#3A6F78' }, ground: 'grass', veg: { d: .4, mix: { decid: .5, conifer: .3, birch: .2 } }, def: { month: 7, hour: 19, weather: 'clair' }, d: 'Plan d\'eau calme devant la maison.' },
  boise: { n: 'Terrain bois\u00e9', cat: 'nature', geo: FR, relief: { type: 'hills', amp: 7 }, ground: 'grass', veg: { d: .6, ring: 10, mix: { decid: .6, conifer: .25, birch: .15 } }, def: { month: 9, hour: 16, weather: 'sun' }, d: 'Bosquets et grands arbres isol\u00e9s.' },
  desert: { n: 'D\u00e9sert', cat: 'autre', geo: { lat: 30.9, lon: -6.9, tz: 1, dst: 0 }, relief: { type: 'dunes', amp: 7, far: 140, hills: 40 }, ground: 'desert', nosnow: 1, veg: { d: .03, mix: { palm: .6, bush: .4 }, rocks: .5 }, def: { month: 4, hour: 18, weather: 'clair' }, d: 'Dunes ocre \u00e0 perte de vue.' },
  tropiques: { n: 'Terrain tropical', cat: 'autre', geo: { lat: 4.9, lon: -52.3, tz: -3, dst: 0 }, relief: { type: 'hills', amp: 14 }, ground: 'tropical', nosnow: 1, veg: { d: .85, mix: { palm: .45, decid: .4, bush: .15 } }, def: { month: 3, hour: 11, weather: 'voile' }, d: 'V\u00e9g\u00e9tation luxuriante et collines.' },
  ile: { n: '\u00cele paradisiaque', cat: 'autre', geo: { lat: -16.5, lon: -151.7, tz: -10, dst: 0 }, relief: { type: 'island', r: 150 }, water: { type: 'sea', side: 'sud', level: -1.5, waves: .2, color: '#22B5C0', clear: 1 }, ground: 'tropical', sand: 'sandWhite', nosnow: 1, veg: { d: .55, mix: { palm: 1 } }, def: { month: 9, hour: 17.5, weather: 'clair' }, d: 'Une \u00eele de sable blanc au milieu du lagon.' },
  ville: { n: 'Ville moderne', cat: 'autre', geo: FR, relief: { type: 'flat' }, urban: 'ville', ground: 'grass', veg: { d: .05, mix: { decid: 1 } }, def: { month: 10, hour: 18, weather: 'voile' }, d: 'Immeubles, rues et lampadaires.' },
  residentiel: { n: 'Quartier r\u00e9sidentiel', cat: 'autre', geo: FR, relief: { type: 'flat' }, urban: 'residentiel', ground: 'grass', veg: { d: .1, mix: { decid: .7, fruit: .3 } }, def: { month: 5, hour: 17, weather: 'sun' }, d: 'Maisons et jardins le long de rues calmes.' },
  banlieue: { n: 'Banlieue contemporaine', cat: 'autre', geo: FR, relief: { type: 'flat' }, urban: 'banlieue', ground: 'grass', veg: { d: .08, mix: { decid: .6, birch: .4 } }, def: { month: 6, hour: 16, weather: 'sun' }, d: 'Maisons cubiques et haies taill\u00e9es.' },
  isole: { n: 'Terrain isol\u00e9', cat: 'autre', geo: FR, relief: { type: 'meadow', amp: 3, far: 500, hills: 60 }, ground: 'dry', veg: { d: .03, mix: { decid: .5, bush: .5 } }, def: { month: 8, hour: 20, weather: 'clair' }, d: 'Plaine ouverte, aucune lumi\u00e8re \u00e0 l\'horizon.' },
  jardin: { n: 'Terrain personnalisable', cat: 'autre', geo: FR, relief: { type: 'flat' }, ground: 'grass', veg: { d: .2, mix: { decid: .65, conifer: .35 } }, custom: 1, def: { month: 6, hour: 15, weather: 'sun' }, d: 'R\u00e9glez vous-m\u00eame le relief, l\'eau, le sol et la v\u00e9g\u00e9tation.' }
};
const RELIEFS = { flat: 'Plat', meadow: 'Ondul\u00e9', hills: 'Collines', mountains: 'Montagnes', valley: 'Vall\u00e9e', summit: 'Sommet', cliff: 'Falaise', coast: 'Littoral', cove: 'Crique', dunes: 'Dunes', island: '\u00cele' };
const WATERS = { none: 'Aucune', sea: 'Mer ou oc\u00e9an', lake: 'Lac', river: 'Rivi\u00e8re' };
const GROUNDS = {
  grass: { n: 'Gazon', c: '#5C8240', tex: 'grass', veg: 1 }, meadow: { n: 'Prairie', c: '#6A8A44', tex: 'grass', veg: 1 }, alpine: { n: 'Alpage', c: '#66834A', tex: 'grass', veg: 1 },
  dry: { n: 'Herbe s\u00e8che', c: '#9C9458', tex: 'grass', veg: 1 }, tropical: { n: 'Herbe tropicale', c: '#4E8C3C', tex: 'grass', veg: 1 }, forest: { n: 'Sous-bois', c: '#5D5A3A', tex: 'soil', veg: 1 },
  sand: { n: 'Sable', c: '#D9C9A1', tex: 'sand' }, sandWhite: { n: 'Sable blanc', c: '#EEE6D2', tex: 'sand' }, desert: { n: 'Sable du d\u00e9sert', c: '#D7B184', tex: 'sand' },
  rock: { n: 'Roche', c: '#8C877F', tex: 'rockface' }, snow: { n: 'Neige', c: '#EEF2F6', tex: 'snow' }, soil: { n: 'Terre', c: '#6B5641', tex: 'soil' }, gravel: { n: 'Gravier', c: '#B9B2A6', tex: 'gravel' },
  asphalt: { n: 'Enrob\u00e9', c: '#55585C', tex: 'asphalt' }, pavers: { n: 'Pav\u00e9s', c: '#BDB6A9', tex: 'tiles' }, field: { n: 'Champ de bl\u00e9', c: '#C2AA5E', tex: 'field' }, plowed: { n: 'Terre labour\u00e9e', c: '#7A6248', tex: 'field' },
  forestFar: { n: 'For\u00eat lointaine', c: '#3D5132', tex: 'canopy' }
};
const PAINT_KEYS = ['grass', 'meadow', 'dry', 'forest', 'sand', 'soil', 'gravel', 'rock', 'snow', 'asphalt', 'pavers'];
const WEATHERS = {
  sun: { n: 'Soleil', clouds: .3, wind: .15 },
  clair: { n: 'Ciel d\u00e9gag\u00e9', clouds: 0, wind: .08 },
  voile: { n: 'Nuages l\u00e9gers', clouds: .6, overcast: .15, wind: .2 },
  couvert: { n: 'Ciel couvert', clouds: 1, overcast: 1, wind: .25, fog: .05, dark: .1 },
  pluie: { n: 'Pluie l\u00e9g\u00e8re', clouds: 1, overcast: 1, rain: .35, wet: .75, wind: .25, fog: .12, dark: .15 },
  pluieForte: { n: 'Pluie forte', clouds: 1, overcast: 1, rain: .85, wet: 1, wind: .45, fog: .22, dark: .35 },
  orage: { n: 'Orage', clouds: 1, overcast: 1, rain: .9, wet: 1, wind: .7, fog: .15, dark: .6, lightning: .6 },
  eclairs: { n: '\u00c9clairs', clouds: 1, overcast: 1, rain: .1, wet: .3, wind: .45, dark: .65, lightning: 1 },
  neige: { n: 'Neige l\u00e9g\u00e8re', clouds: 1, overcast: 1, snow: .35, snowAcc: .5, wind: .15, fog: .12, dark: .05 },
  neigeForte: { n: 'Forte chute de neige', clouds: 1, overcast: 1, snow: .95, snowAcc: .95, wind: .45, fog: .38, dark: .2 },
  brouillard: { n: 'Brouillard', clouds: 1, overcast: .85, fog: .85, wind: .03, wet: .2 },
  brume: { n: 'Brume matinale', clouds: .15, fog: .5, mist: 1, wind: .05, wet: .15 },
  vent: { n: 'Vent', clouds: .55, overcast: .1, wind: .8 },
  tempete: { n: 'Temp\u00eate', clouds: 1, overcast: 1, rain: .75, wet: 1, wind: 1, fog: .25, dark: .55, lightning: .3 }
};
const WX_KEYS = ['clouds', 'overcast', 'rain', 'snow', 'wind', 'fog', 'wet', 'snowAcc', 'lightning', 'dark', 'mist'];
const SEASONS = { printemps: { n: 'Printemps', month: 4, d: 'Herbe verte, fleurs, arbres fruitiers en fleurs, lumi\u00e8re douce.' }, ete: { n: '\u00c9t\u00e9', month: 7, d: 'V\u00e9g\u00e9tation dense, soleil haut et intense, ciel lumineux.' }, automne: { n: 'Automne', month: 10, d: 'Feuillages orange et rouges, feuilles au sol, brume, lumi\u00e8re chaude.' }, hiver: { n: 'Hiver', month: 1, d: 'Neige au sol et sur les arbres, gla\u00e7ons, lumi\u00e8re froide.' } };
const CITIES = { paris: ['Paris', 48.86, 2.35, 1, 1], lyon: ['Lyon', 45.76, 4.84, 1, 1], marseille: ['Marseille', 43.3, 5.37, 1, 1], bordeaux: ['Bordeaux', 44.84, -.58, 1, 1], lille: ['Lille', 50.63, 3.06, 1, 1], brest: ['Brest', 48.39, -4.49, 1, 1], nice: ['Nice', 43.7, 7.27, 1, 1], limoges: ['Limoges', 45.83, 1.26, 1, 1], chamonix: ['Chamonix', 45.92, 6.87, 1, 1], ajaccio: ['Ajaccio', 41.93, 8.74, 1, 1], strasbourg: ['Strasbourg', 48.58, 7.75, 1, 1], biarritz: ['Biarritz', 43.48, -1.56, 1, 1], montreal: ['Montr\u00e9al', 45.5, -73.57, -5, 1], tahiti: ['Papeete', -17.53, -149.57, -10, 0], marrakech: ['Marrakech', 31.63, -8, 1, 0], reykjavik: ['Reykjavik', 64.15, -21.94, 0, 0] };

// v\u00e9g\u00e9tation et nature (biblioth\u00e8que)
const NEW_FURN = {
  palm: { n: 'Palmier', cat: 'vegetal', w: 520, d: 520, h: 900, c: '#4F7F3A', p: 0, free: 1, veg: 'palm' },
  birch: { n: 'Bouleau', cat: 'vegetal', w: 320, d: 320, h: 950, c: '#6C9447', p: 0, free: 1, veg: 'birch' },
  olive: { n: 'Olivier', cat: 'vegetal', w: 460, d: 460, h: 480, c: '#7F8E5E', p: 0, free: 1, veg: 'olive' },
  fruit: { n: 'Arbre fruitier', cat: 'vegetal', w: 420, d: 420, h: 450, c: '#5E8A40', p: 0, free: 1, veg: 'fruit' },
  cypress: { n: 'Cypr\u00e8s', cat: 'vegetal', w: 120, d: 120, h: 950, c: '#2F4A2E', p: 0, free: 1, veg: 'cypress' },
  pine: { n: 'Pin parasol', cat: 'vegetal', w: 720, d: 720, h: 1100, c: '#4C6B3A', p: 0, free: 1, veg: 'pine' },
  flowers: { n: 'Massif de fleurs', cat: 'vegetal', w: 140, d: 140, h: 45, c: '#C94F6D', p: 35, free: 1, veg: 'flowers' },
  grassTuft: { n: 'Gramin\u00e9es', cat: 'vegetal', w: 70, d: 70, h: 80, c: '#8FA35A', p: 15, free: 1, veg: 'grass' },
  rock: { n: 'Rocher', cat: 'vegetal', w: 120, d: 100, h: 70, c: '#8C877F', p: 0, free: 1, rock: 1 },
  rockBig: { n: 'Gros rocher', cat: 'vegetal', w: 320, d: 260, h: 190, c: '#8A857C', p: 0, free: 1, rock: 1 },
  // \u00e9clairage ext\u00e9rieur
  spotSol: { n: 'Spot encastr\u00e9 au sol', cat: 'eclairage', w: 14, d: 14, h: 2, c: '#3E4247', p: 65, free: 1, light: 1, ext: 1, lt: 'up', lm: 1.2, k: 3000, aim: 80 },
  borne: { n: 'Borne lumineuse', cat: 'eclairage', w: 18, d: 18, h: 70, c: '#2E3236', p: 120, free: 1, light: 1, ext: 1, lt: 'bollard', lm: .9, k: 3000 },
  projo: { n: 'Projecteur de fa\u00e7ade', cat: 'eclairage', w: 22, d: 18, h: 20, c: '#2E3236', p: 140, free: 1, light: 1, ext: 1, lt: 'spot', lm: 3.2, k: 3500, aim: 55 },
  applExt: { n: 'Applique ext\u00e9rieure', cat: 'eclairage', w: 16, d: 12, h: 26, c: '#2E3236', p: 80, light: 1, ext: 1, lt: 'wall', lm: 1.4, k: 2700, z: 210 },
  lampPost: { n: 'Lampadaire de jardin', cat: 'eclairage', w: 30, d: 30, h: 330, c: '#2E3236', p: 380, free: 1, light: 1, ext: 1, lt: 'point', lm: 3.5, k: 3000 },
  gateLight: { n: '\u00c9clairage de portail', cat: 'eclairage', w: 24, d: 24, h: 32, c: '#2E3236', p: 90, free: 1, light: 1, ext: 1, lt: 'point', lm: 1.3, k: 2700, z: 160 },
  terraceLight: { n: 'Guirlande de terrasse', cat: 'eclairage', w: 400, d: 8, h: 6, c: '#3A3F45', p: 45, free: 1, light: 1, ext: 1, lt: 'strip', lm: .8, k: 2400, z: 250 },
  poolLight: { n: 'Projecteur de piscine', cat: 'eclairage', w: 20, d: 10, h: 10, c: '#D9DBDD', p: 230, free: 1, light: 1, ext: 1, lt: 'pool', lm: 2.4, k: 6500, col: '#9FD8FF', z: -40 },
  stepLight: { n: '\u00c9clairage de marches', cat: 'eclairage', w: 14, d: 4, h: 8, c: '#3A3F45', p: 55, light: 1, ext: 1, lt: 'down', lm: .5, k: 3000, z: 30 },
  uplight: { n: 'Spot paysager', cat: 'eclairage', w: 16, d: 16, h: 26, c: '#2E3236', p: 95, free: 1, light: 1, ext: 1, lt: 'spot', lm: 2.2, k: 3000, aim: 75 },
  ledStripExt: { n: 'Bande LED ext\u00e9rieure', cat: 'eclairage', w: 300, d: 4, h: 2, c: '#3A3F45', p: 90, light: 1, ext: 1, lt: 'strip', lm: .9, k: 3000, z: 240 },
  garageLight: { n: '\u00c9clairage de garage', cat: 'eclairage', w: 120, d: 10, h: 6, c: '#E4E6E8', p: 70, free: 1, light: 1, lt: 'down', lm: 3.5, k: 5000, hang: 1 },
  // \u00e9clairage int\u00e9rieur
  plafonnier: { n: 'Plafonnier', cat: 'luminaire', w: 45, d: 45, h: 10, c: '#F2F2EF', p: 80, free: 1, light: 1, lt: 'down', lm: 3.2, k: 3000, hang: 1 },
  spotPlaf: { n: 'Spot encastr\u00e9 (plafond)', cat: 'luminaire', w: 10, d: 10, h: 3, c: '#F2F2EF', p: 35, free: 1, light: 1, lt: 'down', lm: 1.2, k: 3000, hang: 1, aim: 90 },
  ledStrip: { n: 'Bande LED', cat: 'luminaire', w: 200, d: 4, h: 2, c: '#F2F2EF', p: 50, light: 1, lt: 'strip', lm: .8, k: 3000, z: 240 },
  underCab: { n: 'LED sous meubles hauts', cat: 'luminaire', w: 160, d: 6, h: 2, c: '#F2F2EF', p: 60, light: 1, lt: 'strip', lm: .7, k: 3500, z: 140 },
  railSpots: { n: 'Rail de spots (cuisine)', cat: 'luminaire', w: 160, d: 8, h: 14, c: '#2B2D30', p: 140, free: 1, light: 1, lt: 'down', lm: 3.2, k: 3500, hang: 1 }
};
const LIGHT_DEF = { lamp: { lt: 'point', lm: 2.4, k: 2700 }, pendant: { lt: 'down', lm: 3.6, k: 2700 }, tlamp: { lt: 'point', lm: 1.4, k: 2700 }, sconce: { lt: 'wall', lm: 1.3, k: 2700 } };
const LT_NAMES = { point: 'Omnidirectionnelle', spot: 'Projecteur', up: 'Vers le haut', down: 'Vers le bas', strip: 'Bande', bollard: 'Borne', wall: 'Applique', pool: 'Sous l\'eau' };
const EXT_LIGHT_GROUPS = [['spotSol', 'Spots encastr\u00e9s au sol'], ['borne', 'Bornes de jardin'], ['projo', 'Projecteurs de fa\u00e7ade'], ['applExt', 'Appliques murales'], ['terraceLight', '\u00c9clairage de terrasse'], ['poolLight', '\u00c9clairage de piscine'], ['stepLight', '\u00c9clairage des marches'], ['garageLight', '\u00c9clairage de garage'], ['ledStripExt', 'Bandes LED'], ['uplight', '\u00c9clairage paysager'], ['lampPost', 'Lampadaires'], ['gateLight', '\u00c9clairage de portail']];
const INT_LIGHT_GROUPS = [['plafonnier', 'Plafonniers'], ['pendant', 'Suspensions'], ['spotPlaf', 'Spots'], ['lamp', 'Lampadaires'], ['tlamp', 'Lampes'], ['sconce', 'Appliques'], ['ledStrip', 'Bandes LED indirectes'], ['underCab', '\u00c9clairage sous les meubles'], ['railSpots', '\u00c9clairage de cuisine']];
Object.assign(FURN, NEW_FURN); for (const [k, v] of Object.entries(LIGHT_DEF)) if (FURN[k]) Object.assign(FURN[k], v);
for (const k of ['tree', 'tree2', 'bush']) if (FURN[k]) FURN[k].cat = 'vegetal';
if (FURN.tree) FURN.tree.veg = 'tree'; if (FURN.tree2) FURN.tree2.veg = 'conifer'; if (FURN.bush) FURN.bush.veg = 'bush';
if (!CATS.find(c => c[0] === 'vegetal')) { const i = CATS.findIndex(c => c[0] === 'jardin'); CATS.splice(i + 1, 0, ['vegetal', 'V\u00e9g\u00e9tation et nature'], ['eclairage', '\u00c9clairage ext\u00e9rieur']); }
WALLKINDS.retain = 'Mur de sout\u00e8nement'; WALLDEF.retain = 25;

/* ---------- soleil : position g\u00e9ographique ---------- */
const MD = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function dayOfYear(env) { return MD[clamp(Math.round(env.month || 6), 1, 12) - 1] + clamp(env.day || 15, 1, 31); }
function isDST(env) { const m = env.month || 6; return !!env.dst && m >= 4 && m <= 10; }
function eqTime(doy) { const B = 2 * Math.PI * (doy - 81) / 364; return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); }
// heure l\u00e9gale -> heure solaire (projets anciens sans longitude : l'heure saisie est l'heure solaire)
function solarHour(env, h) { if (env.lon == null) return h; return h - (env.tz || 0) - (isDST(env) ? 1 : 0) + env.lon / 15 + eqTime(dayOfYear(env)) / 60; }
function clockFromSolar(env, s) { if (env.lon == null) return s; return s + (env.tz || 0) + (isDST(env) ? 1 : 0) - env.lon / 15 - eqTime(dayOfYear(env)) / 60; }
function declination(env) { return 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + dayOfYear(env)) / 365); }
// \u00e9l\u00e9vation et azimut (depuis le nord, sens horaire), en radians
function sunPos(P, hour) { const env = P.env, lat = (env.lat != null ? env.lat : 46) * Math.PI / 180, decl = declination(env); const sh = solarHour(env, hour == null ? (env.hour == null ? 15 : env.hour) : hour); const H = (sh - 12) * 15 * Math.PI / 180;
  const el = Math.asin(clamp(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H), -1, 1)); const A = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)); return { el, az: A + Math.PI, solar: sh }; }
// lune (approximation : pleine lune oppos\u00e9e au soleil)
function moonPos(P) { return sunPos(P, ((P.env.hour == null ? 15 : P.env.hour) + 12) % 24); }
function sunTimes(P) { const env = P.env, lat = (env.lat != null ? env.lat : 46) * Math.PI / 180, decl = declination(env); const c = (Math.sin(-.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  if (c > 1) return { rise: null, set: null, noon: clockFromSolar(env, 12), polar: 'nuit' }; if (c < -1) return { rise: null, set: null, noon: clockFromSolar(env, 12), polar: 'jour' };
  const H0 = Math.acos(c) * 180 / Math.PI / 15; return { rise: clockFromSolar(env, 12 - H0), set: clockFromSolar(env, 12 + H0), noon: clockFromSolar(env, 12) }; }
const mod24 = h => ((h % 24) + 24) % 24;
function timePresets(P) { const t = sunTimes(P), rise = t.rise != null ? t.rise : 6, set = t.set != null ? t.set : 20, noon = t.noon;
  return [['lever', 'Lever du soleil', rise + .15], ['matin', 'Matin', (rise + noon) / 2], ['midi', 'Midi', noon], ['apresmidi', 'Apr\u00e8s-midi', (noon + set) / 2], ['golden', 'Golden hour', set - .75], ['coucher', 'Coucher du soleil', set - .05], ['crepuscule', 'Cr\u00e9puscule', set + .45], ['nuit', 'Nuit', set + 1.6], ['nuitProfonde', 'Nuit profonde', 2]].map(([k, n, h]) => ({ k, n, h: Math.round(mod24(h) * 12) / 12 })); }
function seasonOf(env) { let m = env.month || 6; if ((env.lat || 46) < -23) m = ((m + 5) % 12) + 1; return m >= 3 && m <= 5 ? 'printemps' : m >= 6 && m <= 8 ? 'ete' : m >= 9 && m <= 11 ? 'automne' : 'hiver'; }
// facteur jour (0 nuit, 1 plein jour) \u00e0 partir de l'\u00e9l\u00e9vation
const dayFactor = el => clamp((Math.sin(el) + .05) / .17, 0, 1);

/* ---------- m\u00e9t\u00e9o, saisons, lieux ---------- */
function weatherDefaults(key) { const w = WEATHERS[key] || WEATHERS.sun; const o = {}; for (const k of WX_KEYS) o[k] = w[k] || 0; o.snowAcc = w.snowAcc != null ? w.snowAcc : null; return o; }
function setWeather(P, key) { const e = P.env; if (!WEATHERS[key]) key = 'sun'; const d = weatherDefaults(key), old = e.wx || {}; e.weather = key;
  const winter = seasonOf(e) === 'hiver', pl = PLACES[e.place] || {}; const nos = pl.nosnow;
  d.snowAcc = nos ? 0 : d.snowAcc != null ? Math.max(d.snowAcc, winter ? old.snowAcc || 0 : 0) : (winter || (pl.ground === 'snow') ? (old.snowAcc || 0) : 0);
  if (nos) d.snow = 0; e.wx = d; return e.wx; }
function setSeason(P, key) { const s = SEASONS[key]; if (!s) return; const e = P.env; let m = s.month; if ((e.lat || 46) < -23) m = ((m + 5) % 12) + 1; e.month = m; const pl = PLACES[e.place] || {}; e.wx = e.wx || weatherDefaults(e.weather);
  if (key === 'hiver' && !pl.nosnow) e.wx.snowAcc = Math.max(e.wx.snowAcc || 0, .7); else if (!(e.wx.snow > 0) && pl.ground !== 'snow') e.wx.snowAcc = 0;
  if (key === 'automne') e.wx.fog = Math.max(e.wx.fog || 0, .15); }
function ensureTerrain(P) { if (!P.terrain) TP.setTerrain(P, {}); return P.terrain; }
function applyPlace(P, key, o) { o = o || {}; const pl = PLACES[key]; if (!pl) return false; const e = P.env;
  e.place = key; e.relief = clone(pl.relief); e.water = clone(pl.water || { type: 'none' }); e.groundKind = pl.ground; e.veg = clone(pl.veg || { d: .2, mix: { decid: 1 } }); e.urban = pl.urban || null; e.snowLine = pl.snowLine != null ? pl.snowLine : 600; e.sandKind = pl.sand || 'sand'; e.fields = !!pl.fields; e.forest = key === 'foretDense';
  if (!o.keepGeo) { const g = pl.geo || FR; e.lat = g.lat; e.lon = g.lon; e.tz = g.tz; e.dst = g.dst; }
  if (!o.keepTime && pl.def) { if (pl.def.month) e.month = pl.def.month; if (pl.def.hour != null) e.hour = pl.def.hour; setWeather(P, pl.def.weather || 'sun'); if (pl.def.snowAcc != null) e.wx.snowAcc = pl.def.snowAcc; }
  else { e.wx = e.wx || weatherDefaults(e.weather); if (pl.nosnow) { e.wx.snow = 0; e.wx.snowAcc = 0; } }
  ensureTerrain(P); return true; }
function normalizeEnv(P) {
  const e = P.env = P.env || {};
  if (!WEATHERS[e.weather]) e.weather = 'sun';
  if (!e.wx || typeof e.wx !== 'object') { e.wx = weatherDefaults(e.weather); if (e.wx.snowAcc == null) e.wx.snowAcc = 0; }
  for (const k of WX_KEYS) e.wx[k] = clamp(+e.wx[k] || 0, 0, 1);
  if (!PLACES[e.place]) { const k = e.forest ? 'foretDense' : 'jardin', pl = PLACES[k]; e.place = k; e.relief = e.relief || clone(pl.relief); e.water = e.water || clone(pl.water || { type: 'none' }); e.groundKind = e.groundKind || pl.ground; e.veg = e.veg || clone(pl.veg); e.snowLine = e.snowLine != null ? e.snowLine : 600; e.sandKind = e.sandKind || 'sand'; }
  if (!e.relief || !RELIEFS[e.relief.type]) e.relief = { type: 'flat' }; if (!e.water || !WATERS[e.water.type]) e.water = { type: 'none' }; if (!GROUNDS[e.groundKind]) e.groundKind = 'grass'; if (!e.veg) e.veg = { d: .2, mix: { decid: 1 } };
  if (e.lights == null) e.lights = 'auto'; if (e.lampGain == null) e.lampGain = 1; if (e.ceilLights == null) e.ceilLights = true; if (e.anim == null) e.anim = true; if (e.graphics == null) e.graphics = 'normal';
  if (P.terrain) { const t = P.terrain; if (t.rot == null) t.rot = 0; }
  return P; }
const baseNormalize = TP.normalize;
TP.normalize = o => normalizeEnv(baseNormalize(o));

/* ---------- terrain : rep\u00e8re de la parcelle, grilles de modelage et de peinture ---------- */
const GRID_CELL = 100, GRID_MARGIN = 1500;
function lotFrame(P) { const t = P.terrain; if (!t) return null; const r = (t.rot || 0) * Math.PI / 180; return { cx: t.x, cy: t.y, hw: t.w / 2, hd: t.d / 2, c: Math.cos(r), s: Math.sin(r) }; }
function toLot(F, x, y) { const dx = x - F.cx, dy = y - F.cy; return [dx * F.c + dy * F.s, -dx * F.s + dy * F.c]; }
function fromLot(F, u, v) { return [F.cx + u * F.c - v * F.s, F.cy + u * F.s + v * F.c]; }
function lotCorners(P) { const F = lotFrame(P); if (!F) return []; return [[-F.hw, -F.hd], [F.hw, -F.hd], [F.hw, F.hd], [-F.hw, F.hd]].map(p => fromLot(F, p[0], p[1])); }
function gridFor(P, key) { const t = P.terrain; if (!t) return null; const nx = Math.ceil((t.w + 2 * GRID_MARGIN) / GRID_CELL) + 1, ny = Math.ceil((t.d + 2 * GRID_MARGIN) / GRID_CELL) + 1; let g = t[key];
  if (g && g.nx === nx && g.ny === ny && Array.isArray(g.data)) return g;
  const old = g; g = { cell: GRID_CELL, nx, ny, u0: -t.w / 2 - GRID_MARGIN, v0: -t.d / 2 - GRID_MARGIN, data: new Array(nx * ny).fill(0) };
  if (old && Array.isArray(old.data) && old.nx && old.ny) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const u = g.u0 + i * GRID_CELL, v = g.v0 + j * GRID_CELL; const oi = Math.round((u - old.u0) / old.cell), oj = Math.round((v - old.v0) / old.cell); if (oi >= 0 && oj >= 0 && oi < old.nx && oj < old.ny) g.data[j * nx + i] = old.data[oj * old.nx + oi]; }
  t[key] = g; return g; }
function gridSample(g, u, v) { if (!g) return 0; const fx = (u - g.u0) / g.cell, fy = (v - g.v0) / g.cell; if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return 0; const i = Math.min(g.nx - 2, Math.floor(fx)), j = Math.min(g.ny - 2, Math.floor(fy)), a = fx - i, b = fy - j, d = g.data, n = g.nx;
  return (d[j * n + i] * (1 - a) + d[j * n + i + 1] * a) * (1 - b) + (d[(j + 1) * n + i] * (1 - a) + d[(j + 1) * n + i + 1] * a) * b; }
function gridCode(g, u, v) { if (!g) return 0; const i = Math.round((u - g.u0) / g.cell), j = Math.round((v - g.v0) / g.cell); if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return 0; return g.data[j * g.nx + i] | 0; }
// modelage : monter, creuser, aplanir, adoucir, niveler (altitude cible) ; x, y en cm (plan)
function sculptAt(P, x, y, o) { ensureTerrain(P); const F = lotFrame(P), g = gridFor(P, 'hf'); const [u, v] = toLot(F, x, y); const r = Math.max(50, o.r || 300), s = o.s == null ? 15 : o.s, mode = o.mode || 'raise'; let changed = false;
  const i0 = Math.max(0, Math.floor((u - r - g.u0) / g.cell)), i1 = Math.min(g.nx - 1, Math.ceil((u + r - g.u0) / g.cell)), j0 = Math.max(0, Math.floor((v - r - g.v0) / g.cell)), j1 = Math.min(g.ny - 1, Math.ceil((v + r - g.v0) / g.cell));
  let avg = 0, na = 0; if (mode === 'smooth' || mode === 'flatten') { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const du = g.u0 + i * g.cell - u, dv = g.v0 + j * g.cell - v; if (du * du + dv * dv <= r * r) { avg += g.data[j * g.nx + i]; na++; } } avg = na ? avg / na : 0; }
  const target = o.target != null ? o.target : avg;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const du = g.u0 + i * g.cell - u, dv = g.v0 + j * g.cell - v, d = Math.sqrt(du * du + dv * dv); if (d > r) continue; const f = .5 + .5 * Math.cos(Math.PI * d / r), k = j * g.nx + i, h0 = g.data[k]; let h = h0;
    if (mode === 'raise') h = h0 + s * f; else if (mode === 'lower') h = h0 - s * f; else if (mode === 'flatten' || mode === 'level') h = h0 + (target - h0) * clamp(f * (mode === 'level' ? 1 : .5), 0, 1); else if (mode === 'smooth') h = h0 + (avg - h0) * f * .5;
    h = Math.round(clamp(h, -5000, 5000)); if (h !== h0) { g.data[k] = h; changed = true; } }
  return changed; }
function paintAt(P, x, y, o) { ensureTerrain(P); const F = lotFrame(P), g = gridFor(P, 'paint'); const [u, v] = toLot(F, x, y); const r = Math.max(50, o.r || 200), code = o.key === 'auto' ? 0 : PAINT_KEYS.indexOf(o.key) + 1; if (code < 0) return false; let changed = false;
  for (let j = 0; j < g.ny; j++) { const dv = g.v0 + j * g.cell - v; if (Math.abs(dv) > r) continue; for (let i = 0; i < g.nx; i++) { const du = g.u0 + i * g.cell - u; if (du * du + dv * dv > r * r) continue; const k = j * g.nx + i; if (g.data[k] !== code) { g.data[k] = code; changed = true; } } }
  return changed; }
function resetSculpt(P) { if (P.terrain) { delete P.terrain.hf; } }
function resetPaint(P) { if (P.terrain) { delete P.terrain.paint; } }
// relief import\u00e9 d'une image en niveaux de gris (valeurs 0..1) sur la grille de modelage
function heightmapFromImage(P, gray, w, h, maxH) { ensureTerrain(P); const g = gridFor(P, 'hf'); for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { const x = Math.min(w - 1, Math.round(i / (g.nx - 1) * (w - 1))), y = Math.min(h - 1, Math.round(j / (g.ny - 1) * (h - 1))); g.data[j * g.nx + i] = Math.round(gray[y * w + x] * maxH); } return g; }
// chemin : polyligne \u00e9largie en polygone (cm)
function pathPolygon(pts, width) { if (!pts || pts.length < 2) return null; const hw = width / 2, L = [], R = [];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; let nx = -ty, ny = tx, k = 1;
    if (i > 0 && i < pts.length - 1) { const ux = p[0] - a[0], uy = p[1] - a[1], ul = Math.hypot(ux, uy) || 1, vx = b[0] - p[0], vy = b[1] - p[1], vl = Math.hypot(vx, vy) || 1, n1x = -uy / ul, n1y = ux / ul, n2x = -vy / vl, n2y = vx / vl; let mx = n1x + n2x, my = n1y + n2y; const ml = Math.hypot(mx, my); if (ml > 1e-6) { nx = mx / ml; ny = my / ml; } else { nx = n1x; ny = n1y; } k = 1 / Math.max(.35, nx * n1x + ny * n1y); }
    L.push([Math.round(p[0] + nx * hw * k), Math.round(p[1] + ny * hw * k)]); R.push([Math.round(p[0] - nx * hw * k), Math.round(p[1] - ny * hw * k)]); }
  return L.concat(R.reverse()); }

/* ---------- contexte d'environnement : hauteur, sol, eau ---------- */
// coordonn\u00e9es monde en m\u00e8tres (x = x du plan, z = y du plan)
function envCtx(P) {
  const e = P.env, rel = e.relief || { type: 'flat' }, wat = e.water || { type: 'none' }, seed = strSeed(e.place || 'jardin') % 9973;
  const lv = sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]; const pts = []; lv.rooms.filter(r => !isExt(r)).forEach(r => r.pts.forEach(p => pts.push(p))); lv.walls.filter(w => w.kind === 'wall').forEach(w => { pts.push([w.x1, w.y1]); pts.push([w.x2, w.y2]); });
  const hb0 = pts.length ? bbox(pts) : { x0: 0, y0: 0, x1: 1000, y1: 800 }; const hb = { x0: hb0.x0 / 100, z0: hb0.y0 / 100, x1: hb0.x1 / 100, z1: hb0.y1 / 100 }; const hx = (hb.x0 + hb.x1) / 2, hz = (hb.z0 + hb.z1) / 2;
  const plat = { x0: hb.x0 - 3, x1: hb.x1 + 3, z0: hb.z0 - 3, z1: hb.z1 + 3 };
  const F = lotFrame(P) || { cx: hx * 100, cy: hz * 100, hw: (hb.x1 - hb.x0) * 50 + 600, hd: (hb.z1 - hb.z0) * 50 + 600, c: 1, s: 0 };
  const t = P.terrain, hf = t && t.hf, paint = t && t.paint;
  const sv = sideVec(P, (wat.type !== 'none' && wat.side) || rel.side || 'sud') || [0, 1], pv = [-sv[1], sv[0]];
  const corners = [[-F.hw, -F.hd], [F.hw, -F.hd], [F.hw, F.hd], [-F.hw, F.hd]].map(p => fromLot(F, p[0], p[1]).map(v => v / 100));
  const aEdge = Math.max(...corners.map(c => (c[0] - hx) * sv[0] + (c[1] - hz) * sv[1]));
  const level = wat.type !== 'none' ? (wat.level != null ? wat.level : -1.5) : -1e9;
  const slope = t && t.slope ? t.slope / 100 : 0, sd = t ? (sideVec(P, t.dir || 'sud') || [0, 1]) : [0, 1];
  const distLot = (x, z) => { const [u, v] = toLot(F, x * 100, z * 100); const du = Math.max(0, Math.abs(u) - F.hw), dv = Math.max(0, Math.abs(v) - F.hd); return Math.hypot(du, dv) / 100; };
  const platDist = (x, z) => Math.hypot(Math.max(0, plat.x0 - x, x - plat.x1), Math.max(0, plat.z0 - z, z - plat.z1));
  // pente de la parcelle (limit\u00e9e \u00e0 60 m au-del\u00e0 de la plateforme)
  const lotBase = (x, z) => { if (!slope) return 0; const a = (x - hx) * sd[0] + (z - hz) * sd[1], a0 = Math.abs(sd[0]) * (plat.x1 - plat.x0) / 2 + Math.abs(sd[1]) * (plat.z1 - plat.z0) / 2; const d = a > a0 ? Math.min(a - a0, 60) : a < -a0 ? -Math.min(-a0 - a, 60) : 0; return -slope * d; };
  const amp = rel.amp || 0, peaks = rel.peaks || 0, far = rel.far || 600, S = seed;
  const hillsN = (x, z, a, sc) => a * (fbm(x / sc, z / sc, S) - .47) * 2.2;
  // massifs : cr\u00eates d\u00e9form\u00e9es (pas de c\u00f4nes r\u00e9guliers), ar\u00eates secondaires et d\u00e9tail d'\u00e9rosion
  const mountain = (x, z, r) => { if (!peaks) return 0; const m = sstep(far, far * 1.75, r); if (m <= 0) return 0; const wx = x + 260 * (fbm(x / 1100, z / 1100, S + 41, 3) - .5), wz = z + 260 * (fbm(x / 1100 + 7.3, z / 1100 + 2.1, S + 42, 3) - .5);
    const env = .45 + .95 * fbm(wx / 1700, wz / 1700, S + 49, 3), b = Math.pow(ridged(wx / 1050, wz / 1050, S + 5, 6), 1.2) * env, sec = ridged(wx / 330, wz / 330, S + 43, 5) - .45, det = fbm(x / 55, z / 55, S + 44, 3) - .5; return m * peaks * Math.max(0, b + sec * .2 * (.25 + b) + det * .04 * (.4 + b)); };
  function reliefH(x, z) {
    const r = Math.hypot(x - hx, z - hz), a = (x - hx) * sv[0] + (z - hz) * sv[1], b = (x - hx) * pv[0] + (z - hz) * pv[1], dl = distLot(x, z), mr = sstep(1, 24, dl);
    switch (rel.type) {
      case 'meadow': return mr * hillsN(x, z, amp, 110) + sstep(far, far * 2, r) * (rel.hills || 30) * (fbm(x / 420, z / 420, S + 2) - .32) * 2 + mountain(x, z, r);
      case 'hills': return mr * hillsN(x, z, amp, 75) + sstep(150, 400, r) * amp * 2.5 * (fbm(x / 260, z / 260, S + 3) - .4) + mountain(x, z, r);
      case 'mountains': return mr * hillsN(x, z, amp, 90) + sstep(120, 500, r) * amp * 6 * (fbm(x / 300, z / 300, S + 4) - .35) + mountain(x, z, r);
      case 'valley': { const ab = Math.abs(a); const wx = x + 200 * (fbm(x / 900, z / 900, S + 45, 3) - .5), wz = z + 200 * (fbm(x / 900 + 3.1, z / 900 + 8.2, S + 46, 3) - .5); return mr * hillsN(x, z, amp, 90) + (peaks ? sstep(far * .45, far * 1.6, ab) * peaks * Math.max(0, .35 + .65 * Math.pow(ridged(wx / 600, wz / 600, S + 6, 6), 1.15) + .1 * (ridged(wx / 190, wz / 190, S + 47, 4) - .45) + .025 * (fbm(x / 50, z / 50, S + 48, 3) - .5)) : 0); }
      case 'summit': { const dd = Math.max(0, dl - 2); return -(rel.drop || 380) * (1 - Math.exp(-dd / 260)) + sstep(0, 60, dd) * 22 * (ridged(x / 90, z / 90, S + 7) - .4) + mountain(x, z, r) * .9 + mr * hillsN(x, z, amp, 40); }
      case 'cliff': { const ae = a - (aEdge + (rel.dist || 15)) + 6 * (fbm(b / 45, 0, S + 8) - .5); const drop = rel.drop || 60; const back = mr * hillsN(x, z, 6, 80) * (ae < 0 ? 1 : 0); if (ae <= 0) return back + mountain(x, z, r) * (a < 0 ? 1 : 0); const f = sstep(0, 3 + drop * .07, ae); return -drop * f - Math.max(0, ae - 30) * .02 + (1 - f) * back + 3 * (vnoise(x / 6, z / 6, S + 9) - .5) * f * (1 - sstep(10, 40, ae)) + (wat.type === 'none' ? mountain(x, z, r) : 0); }
      case 'coast': { const a0 = aEdge + (rel.dist || 30) + 10 * (fbm(b / 70, 0, S + 10) - .5); const lev = wat.type === 'sea' ? level : -2; let h;
        if (a <= aEdge) h = 0; else if (a < a0) h = lev * Math.pow((a - aEdge) / (a0 - aEdge), 1.25) + (rel.rocky ? 1.2 : .5) * (fbm(x / 9, z / 9, S + 11) - .5) * sstep(aEdge, aEdge + 6, a);
        else h = lev - (a - a0) * Math.max(rel.slope || .04, .02) + (rel.rocky ? 2.2 * (fbm(x / 7, z / 7, S + 12) - .5) * (1 - sstep(a0 + 8, a0 + 40, a)) : 0);
        const land = rel.hills ? sstep(-10, -60, a) * rel.hills * (fbm(x / 160, z / 160, S + 13) - .25) * 1.6 : 0; return Math.max(h, -60) + land + (a < aEdge ? mr * hillsN(x, z, 3, 70) : 0); }
      case 'cove': { const R = rel.r || 80, cA = aEdge + (rel.dist || 30) + R; const da = a - cA; const dc = Math.hypot(da, b * .8) - R * (1 + .12 * (fbm(Math.atan2(b, da) * 2, 0, S + 14) - .5)); const open = sstep(cA + R * .2, cA + R * 1.2, a) * (1 - sstep(R * 1.2, R * 2.5, Math.abs(b)));
        const w = Math.max(sstep(8, -6, dc), open); const lev = level; const landH = mr * hillsN(x, z, 4, 60) + (rel.hills || 20) * sstep(-5, 50, dc) * (.5 + .5 * fbm(x / 70, z / 70, S + 15)) * sstep(aEdge + 5, aEdge + 40, a + Math.abs(b) * .6);
        const water = lev - 1.5 - Math.max(0, -dc) * .05 - Math.max(0, a - cA) * .03; return landH * (1 - w) + water * w; }
      case 'dunes': { const d1 = ridged((x * .85 + z * .35) / 70, (z * .9 - x * .25) / 28, S + 16, 4); return mr * amp * (d1 - .35) * 2 + sstep(far, far * 2.5, r) * (rel.hills || 40) * (ridged(x / 260, z / 140, S + 17, 4) - .3) * 2; }
      case 'island': { const R = (rel.r || 150) * (1 + .18 * (fbm(Math.atan2(z - hz, x - hx) * 1.6, 0, S + 18) - .5)); const t0 = sstep(R - 30, R + 12, r); const land = 1.2 * (1 - sstep(R - 60, R - 5, r)) + mr * hillsN(x, z, 3, 50) * (1 - t0); return land * (1 - t0) + t0 * (level - .8 - Math.max(0, r - R) * .05) - (r > R + 300 ? (r - R - 300) * .02 : 0); }
      default: return mr * .6 * (fbm(x / 40, z / 40, S) - .5);
    }
  }
  // lac et rivi\u00e8re : creusement et berges
  const lakeR = wat.r || 300, lakeC = aEdge + (wat.dist || 20) + lakeR;
  const lakeQ = (x, z) => { const a = (x - hx) * sv[0] + (z - hz) * sv[1] - lakeC, b = (x - hx) * pv[0] + (z - hz) * pv[1]; const q = Math.hypot(a / lakeR, b / (lakeR * 1.5)); return q * (1 + .08 * (fbm(Math.atan2(b, a) * 1.5, 0, S + 19) - .5)); };
  const riverD = (x, z) => { const a = (x - hx) * sv[0] + (z - hz) * sv[1], b = (x - hx) * pv[0] + (z - hz) * pv[1]; const aR = aEdge + (wat.dist || 25) + (wat.width || 12) / 2 + 9 * Math.sin(b / 85) + 4 * Math.sin(b / 29 + 1); return { d: Math.abs(a - aR) - (wat.width || 12) / 2, b, aR }; };
  function carve(x, z, h) {
    if (wat.type === 'lake') { const q = lakeQ(x, z); if (q < 1) return level - .3 - Math.min(14, (1 - q) * lakeR * .07); if (q < 1.7) return Math.max(h, level + .25 + (q - 1) * lakeR * .035); return h; }
    if (wat.type === 'river') { const { d } = riverD(x, z); if (d < 0) return level - .3 - Math.min(2.6, -d * .45); if (d < 45) return Math.max(h, level + .3 + d * .045); return h; }
    return h; }
  // modelage manuel et plateforme de la maison
  function sculpt(x, z) { if (!hf) return 0; const [u, v] = toLot(F, x * 100, z * 100); return gridSample(hf, u, v) / 100; }
  const hp = (x, z) => sstep(0, 2.5, Math.hypot(Math.max(0, hb.x0 - .3 - x, x - hb.x1 - .3), Math.max(0, hb.z0 - .3 - z, z - hb.z1 - .3)));
  function h(x, z) { const dl = distLot(x, z), m = sstep(.5, 8, dl); let y = lotBase(x, z) + (m > 0 ? reliefH(x, z) * m : 0); if (m > 0 && (wat.type === 'lake' || wat.type === 'river')) y = y + (carve(x, z, y) - y) * m; if (hf) y += sculpt(x, z) * hp(x, z); return y; }
  // nature du sol
  const ground = e.groundKind || 'grass', sandK = e.sandKind || 'sand', snowLine = e.snowLine != null ? e.snowLine : 600, isCity = !!e.urban;
  let city = null; if (isCity) city = cityLayout(P, { hx, hz, F, seed: S });
  function groundAt(x, z, y, ny) {
    if (paint) { const [u, v] = toLot(F, x * 100, z * 100); const c = gridCode(paint, u, v); if (c > 0) return PAINT_KEYS[c - 1]; }
    if (city) { const c = city.groundAt(x, z); if (c) return c; }
    if (ground === 'snow') return ny < .55 ? 'rock' : 'snow';
    if (wat.type !== 'none') { if (y < level + (wat.type === 'sea' ? 1.1 : .4)) { if (wat.type === 'river') return 'soil'; if (wat.type === 'lake') return y < level - .2 ? 'sand' : 'gravel'; return (e.relief && e.relief.rocky) || (ny < .8 && y > level - 1) ? 'rock' : sandK; } }
    if (ny < (['mountains', 'summit', 'valley', 'cliff'].includes(rel.type) ? .8 : .68)) return 'rock';
    if (y > snowLine + 25 * (vnoise(x / 60, z / 60, S + 20) - .5) && ny > .5) return 'snow';
    const r = Math.hypot(x - hx, z - hz);
    if (r > 230 && ny > .8 && y < snowLine - 60 && (e.veg && e.veg.d > .2) && ground !== 'desert' && ground !== 'tropical' && fbm(x / 180, z / 180, S + 21) > .47) return 'forestFar';
    if (e.fields && r > 70) { const fx = Math.floor((x + 40 * vnoise(z / 90, 0, S)) / 95), fz = Math.floor((z + 40 * vnoise(x / 90, 1, S)) / 70), q = hash2(fx, fz, S + 22); if (q < .3) return 'field'; if (q < .42) return 'plowed'; if (q < .6) return 'meadow'; }
    return ground; }
  const water = { type: wat.type, level, color: wat.color || '#2F6F86', waves: wat.waves != null ? wat.waves : .3, wdir: wat.wdir || 0, clear: !!wat.clear, sv, pv, aEdge, lakeC, lakeR, river: wat.type === 'river' ? riverD : null, width: wat.width || 12 };
  return { h, groundAt, distLot, platDist, hx, hz, hb, plat, F, sv, pv, aEdge, level, water, city, seed: S, rel, lotBase, reliefH, hasWater: wat.type !== 'none' };
}

/* ---------- ville : rues, immeubles et maisons voisines ---------- */
function cityLayout(P, o) {
  const kind = P.env.urban, R = rng(o.seed + 77), F = o.F; const B = kind === 'ville' ? 62 : kind === 'residentiel' ? 46 : 52, road = kind === 'ville' ? 12 : 8, walk = kind === 'ville' ? 3.5 : 2;
  const hw = F.hw / 100 + 6, hd = F.hd / 100 + 6, ext = kind === 'ville' ? 520 : 380; const roads = [], blocks = [], lamps = [];
  // rep\u00e8re de la parcelle (en m\u00e8tres) : u, v
  const toW = (u, v) => { const p = fromLot(F, u * 100, v * 100); return [p[0] / 100, p[1] / 100]; }; const toL = (x, z) => { const p = toLot(F, x * 100, z * 100); return [p[0] / 100, p[1] / 100]; };
  const lines = (lo, hi, a0) => { const out = []; for (let s = a0; s < hi; s += B) out.push(s); for (let s = a0 - B; s > lo; s -= B) out.unshift(s); return out; };
  const us = lines(-ext, ext, hw + road / 2 + walk), vs = lines(-ext, ext, hd + road / 2 + walk);
  // rue devant (c\u00f4t\u00e9 v+) et rues lat\u00e9rales autour de la parcelle
  const uL = [-hw - road / 2 - walk].concat(us), vL = [-hd - road / 2 - walk].concat(vs);
  for (const u of uL) roads.push({ u0: u - road / 2, u1: u + road / 2, v0: -ext, v1: ext }); for (const v of vL) roads.push({ u0: -ext, u1: ext, v0: v - road / 2, v1: v + road / 2 });
  const inRoad = (u, v, pad) => roads.some(r => u > r.u0 - pad && u < r.u1 + pad && v > r.v0 - pad && v < r.v1 + pad);
  const cellsU = [], cellsV = []; const su = uL.slice().sort((a, b) => a - b), svv = vL.slice().sort((a, b) => a - b);
  for (let i = 0; i < su.length - 1; i++) cellsU.push([su[i] + road / 2 + walk, su[i + 1] - road / 2 - walk]); for (let i = 0; i < svv.length - 1; i++) cellsV.push([svv[i] + road / 2 + walk, svv[i + 1] - road / 2 - walk]);
  const pal = kind === 'residentiel' ? ['#EDE6D6', '#E2D3B4', '#D9D2C5', '#F2EEE6', '#C9B79C', '#E8DDCB'] : kind === 'banlieue' ? ['#F2F2EF', '#E9E7E2', '#3E4247', '#B9BBBA', '#D8D3CA'] : ['#B9BBBA', '#9C9A95', '#D8D3CA', '#7D838A', '#C4B8A6', '#5E6670'];
  for (const [u0, u1] of cellsU) for (const [v0, v1] of cellsV) {
    if (u1 - u0 < 8 || v1 - v0 < 8) continue; const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; if (Math.abs(cu) < hw + 2 && Math.abs(cv) < hd + 2) continue; if (Math.hypot(cu, cv) > ext) continue;
    if (kind === 'ville') { const n = R() < .5 ? 1 : 2; for (let k = 0; k < n; k++) { const w = (u1 - u0) * (n === 1 ? .78 : .42), d = (v1 - v0) * (.55 + R() * .3); const bu = n === 1 ? cu : u0 + (u1 - u0) * (k ? .75 : .25), bv = cv + (R() - .5) * ((v1 - v0) - d) * .8; const hgt = 14 + Math.pow(R(), 1.6) * 48 * (1 - Math.min(1, Math.hypot(cu, cv) / ext) * .4); blocks.push({ u: bu, v: bv, w, d, h: hgt, roof: 'flat', c: pal[Math.floor(R() * pal.length)], kind: 'tower' }); } }
    else { const lotW = kind === 'residentiel' ? 18 : 20; const nU = Math.max(1, Math.floor((u1 - u0) / lotW)), nV = 2; for (let i = 0; i < nU; i++) for (let j = 0; j < nV; j++) { const pu = u0 + (u1 - u0) * (i + .5) / nU, pv = j === 0 ? v0 + 7.5 : v1 - 7.5; const w = kind === 'residentiel' ? 9 + R() * 3 : 10 + R() * 4, d = kind === 'residentiel' ? 8 + R() * 3 : 9 + R() * 3; if (R() < .12) continue;
      blocks.push({ u: pu, v: pv, w, d, h: kind === 'residentiel' ? 5.6 + R() * 1.2 : 6 + R() * 1.4, roof: kind === 'residentiel' ? 'gable' : 'flat', c: pal[Math.floor(R() * pal.length)], roofC: kind === 'residentiel' ? (R() < .6 ? '#A9553A' : '#4A4F55') : '#55585C', kind: 'house', face: j === 0 ? -1 : 1 }); } }
  }
  for (const r of roads) { const along = (r.u1 - r.u0) > (r.v1 - r.v0); const L0 = along ? r.u0 : r.v0, L1 = along ? r.u1 : r.v1; for (let s = L0 + 12; s < L1; s += 26) { const u = along ? s : r.u1 + walk * .5, v = along ? r.v1 + walk * .5 : s; if (Math.hypot(u, v) > 160) continue; if (Math.abs(u) < hw && Math.abs(v) < hd) continue; lamps.push(toW(u, v)); } }
  const bl = blocks.map(b => Object.assign(b, { p: toW(b.u, b.v), rot: Math.atan2(F.s, F.c) }));
  return { kind, roads, blocks: bl, lamps: lamps.slice(0, 60), walk,
    groundAt(x, z) { const [u, v] = toL(x, z); for (const r of roads) { if (u > r.u0 && u < r.u1 && v > r.v0 && v < r.v1) return 'asphalt'; if (u > r.u0 - walk && u < r.u1 + walk && v > r.v0 - walk && v < r.v1 + walk) return 'pavers'; } return null; },
    blocked(x, z, pad) { const [u, v] = toL(x, z); if (inRoad(u, v, pad || 0)) return true; return blocks.some(b => Math.abs(u - b.u) < b.w / 2 + (pad || 0) && Math.abs(v - b.v) < b.d / 2 + (pad || 0)); } };
}

/* ---------- v\u00e9g\u00e9tation, rochers, fleurs, herbes autour de la parcelle ---------- */
const SPECIES = { decid: { k: 'tree', h: [9, 17], w: [.75, 1.05] }, conifer: { k: 'conifer', h: [12, 24], w: [.36, .46] }, birch: { k: 'birch', h: [11, 18], w: [.42, .55] }, palm: { k: 'palm', h: [7, 13], w: [.55, .7] }, olive: { k: 'olive', h: [4, 7], w: [1.0, 1.25] }, cypress: { k: 'cypress', h: [9, 15], w: [.13, .17] }, pine: { k: 'pine', h: [10, 16], w: [.75, .95] }, fruit: { k: 'fruit', h: [4, 6.5], w: [.95, 1.15] }, bush: { k: 'bush', h: [1, 2.4], w: [1.1, 1.6] } };
function scatterEnv(P, ctx, o) {
  o = o || {}; const e = P.env, veg = e.veg || { d: .2, mix: {} }, R = rng((ctx.seed || 1) + 31); const out = { trees: [], rocks: [], flowers: [], grass: [] };
  const mix = Object.entries(veg.mix || {}).filter(([k, v]) => SPECIES[k] && v > 0); const tot = mix.reduce((s, [, v]) => s + v, 0); const pick = () => { let x = R() * tot; for (const [k, v] of mix) { x -= v; if (x <= 0) return k; } return mix.length ? mix[mix.length - 1][0] : 'decid'; };
  const ring = veg.ring != null ? veg.ring : 3, Rmax = o.rmax || 320, d = clamp(veg.d || 0, 0, 1), maxN = o.max || 900;
  const ok = (x, z, sp) => { const dl = ctx.distLot(x, z); if (dl < ring) return null; if (ctx.city && ctx.city.blocked(x, z, 2.5)) return null; const y = ctx.h(x, z); if (ctx.hasWater && y < ctx.level + .45) return null;
    const nx = ctx.h(x + 1, z) - y, nz = ctx.h(x, z + 1) - y, ny = 1 / Math.hypot(nx, nz, 1); const g = ctx.groundAt(x, z, y, ny);
    if (g === 'asphalt' || g === 'pavers' || g === 'field' || g === 'plowed') return null; if (g === 'rock' && R() > .12) return null; if (g === 'snow' && sp !== 'conifer') return null;
    if ((g === 'sand' || g === 'sandWhite') && !(sp === 'palm' || sp === 'pine')) return null; if (g === 'desert' && sp !== 'palm' && sp !== 'bush') return null; if (ny < .72) return null; return { y, g, ny }; };
  if (tot > 0 && d > 0) { const s0 = 4 + (1 - d) * 16; // espacement de base (m)
    for (let gz = -Rmax; gz <= Rmax; gz += s0) for (let gx = -Rmax; gx <= Rmax; gx += s0) { const r = Math.hypot(gx, gz); if (r > Rmax) continue; const far = r > 140; if (far && R() > .55) continue;
      const x = ctx.hx + gx + (R() - .5) * s0 * .9, z = ctx.hz + gz + (R() - .5) * s0 * .9; if (R() > .35 + .65 * d) continue; const sp = pick(); const q = ok(x, z, sp); if (!q) continue; const S = SPECIES[sp]; const hgt = S.h[0] + R() * (S.h[1] - S.h[0]);
      out.trees.push({ sp, k: S.k, x, z, y: q.y, h: hgt, w: hgt * (S.w[0] + R() * (S.w[1] - S.w[0])), r: R() * 6.283, v: Math.floor(R() * 3), far, pal: Math.floor(R() * 3) }); if (out.trees.length >= maxN) break; } }
  if (veg.bush) for (let i = 0; i < 160 * veg.bush; i++) { const a = R() * 6.283, rr = 8 + Math.pow(R(), .7) * 120; const x = ctx.hx + Math.cos(a) * rr, z = ctx.hz + Math.sin(a) * rr; const q = ok(x, z, 'bush'); if (!q) continue; const hgt = 1 + R() * 1.5; out.trees.push({ sp: 'bush', k: 'bush', x, z, y: q.y, h: hgt, w: hgt * 1.4, r: R() * 6.283, v: Math.floor(R() * 3), far: false, pal: Math.floor(R() * 3) }); }
  const rk = veg.rocks || 0; if (rk > 0) for (let i = 0; i < 220 * rk; i++) { const a = R() * 6.283, rr = 6 + Math.pow(R(), .8) * 200; const x = ctx.hx + Math.cos(a) * rr, z = ctx.hz + Math.sin(a) * rr; if (ctx.distLot(x, z) < 2) continue; if (ctx.city && ctx.city.blocked(x, z, 1)) continue; const y = ctx.h(x, z); if (ctx.hasWater && y < ctx.level - 1.2) continue; const s = .4 + Math.pow(R(), 2.2) * 3.2; out.rocks.push({ x, z, y, s, r: R() * 6.283, v: Math.floor(R() * 3) }); }
  const fl = (veg.flowers || 0) + (seasonOf(e) === 'printemps' ? .5 : 0); if (fl > 0 && !(e.wx && e.wx.snowAcc > .3)) for (let i = 0; i < 260 * Math.min(fl, 1.5); i++) { const a = R() * 6.283, rr = 3 + Math.pow(R(), .6) * 90; const x = ctx.hx + Math.cos(a) * rr, z = ctx.hz + Math.sin(a) * rr; const q = ok(x, z, 'flowers'); if (!q || !GROUNDS[q.g] || !GROUNDS[q.g].veg || q.g === 'forest') continue; out.flowers.push({ x, z, y: q.y, s: .6 + R() * .8, c: Math.floor(R() * 5), r: R() * 6.283 }); }
  const gn = o.grass != null ? o.grass : 2200; for (let i = 0; i < gn; i++) { const a = R() * 6.283, rr = Math.pow(R(), 1.5) * 55; const x = ctx.hx + Math.cos(a) * (rr + 6), z = ctx.hz + Math.sin(a) * (rr + 6); const dl = ctx.distLot(x, z); if (dl < .5 || dl > 45) continue; const q = ok(x, z, 'grass'); if (!q || !GROUNDS[q.g] || !GROUNDS[q.g].veg) continue; out.grass.push({ x, z, y: q.y, s: .5 + R() * .6, r: R() * 6.283 }); }
  return out; }

/* ---------- luminaires r\u00e9glables ---------- */
function kelvinRGB(k) { k = clamp(k, 1500, 15000) / 100; let r, g, b; r = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592); g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492); b = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307; const c = v => Math.pow(clamp(v, 0, 255) / 255, 2.2); return [c(r), c(g), c(b)]; }
const hexLin = h => { const v = parseInt(String(h || '#ffffff').slice(1, 7), 16) || 0xffffff; return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map(c => Math.pow(c, 2.2)); };
function lightProps(f) { const d = FURN[f.type] || {}; return { lt: f.lt || d.lt || 'point', lm: d.lm || 1.5, k: f.k || d.k || 3000, lum: f.lum != null ? f.lum : 1, col: f.col || d.col || null, range: f.range || (d.ext ? 12 : 7), aim: f.aim != null ? f.aim : (d.aim != null ? d.aim : 45), on: f.on || 'auto', ext: !!d.ext }; }
function isNight(P) { const s = sunPos(P); const wx = P.env.wx || {}; const day = dayFactor(s.el) * (1 - (wx.dark || 0) * .6); return day < .45; }
function lightOn(P, f) { const m = P.env.lights; if (m === 'on') return true; if (m === 'off') return false; const lp = lightProps(f); if (lp.on === 'on') return true; if (lp.on === 'off') return false; return isNight(P); }
function lightColor(P, f) { const lp = lightProps(f); const k = kelvinRGB(lp.k), c = lp.col ? hexLin(lp.col) : [1, 1, 1]; const m = Math.max(k[0] * c[0], k[1] * c[1], k[2] * c[2]) || 1; const I = lp.lm * lp.lum * (P.env.lampGain != null ? P.env.lampGain : 1); return [k[0] * c[0] / m * I, k[1] * c[1] / m * I, k[2] * c[2] / m * I]; }
function allLights(P) { const out = []; for (const lv of P.levels) for (const f of lv.furn) { const d = FURN[f.type]; if (d && d.light) out.push({ f, lv, d, ext: !!d.ext }); } return out; }
function setAllLights(P, mode) { P.env.lights = mode; }

/* ---------- sc\u00e9narios et pr\u00e9r\u00e9glages ---------- */
const SCENARIOS = {
  villaMed: { n: 'Villa m\u00e9diterran\u00e9enne au coucher du soleil', place: 'mediterranee', month: 7, time: 'coucher', weather: 'clair', wx: { clouds: .25 }, lights: 'auto', cam: { frame: 'troisQuarts', focal: 28, ev: .2, wb: 6200, bloom: .35, contrast: .08 } },
  chaletNuit: { n: 'Chalet alpin sous la neige, de nuit', place: 'chalet', month: 1, hour: 21, weather: 'neige', wx: { snowAcc: 1 }, lights: 'on', led: true, cam: { frame: 'troisQuarts', focal: 24, ev: .6, wb: 5200, bloom: .5 } },
  orage: { n: 'Maison contemporaine sous une pluie d\'orage', place: null, month: 9, hour: 17.5, weather: 'orage', lights: 'auto', cam: { frame: 'troisQuarts', focal: 24, ev: .2, wb: 6800, contrast: .12 } },
  oceanEte: { n: 'Villa au bord de l\'oc\u00e9an en plein \u00e9t\u00e9', place: 'plage', month: 7, hour: 14.5, weather: 'sun', lights: 'off', cam: { frame: 'jardin', focal: 24, ev: 0, wb: 6000 } },
  foretBrume: { n: 'Maison en for\u00eat avec brouillard matinal', place: 'foretDense', month: 10, time: 'matin', weather: 'brume', lights: 'off', cam: { frame: 'troisQuarts', focal: 32, ev: .3, wb: 6300 } },
  nuitEtoilee: { n: 'Maison moderne pendant une nuit \u00e9toil\u00e9e', place: 'isole', month: 8, hour: 23.5, weather: 'clair', lights: 'on', led: true, cam: { frame: 'contrePlongee', focal: 20, ev: 1.2, wb: 4800, bloom: .45 } },
  campagneAutomne: { n: 'Maison de campagne en automne', place: 'campagne', month: 10, time: 'golden', weather: 'voile', wx: { fog: .18 }, lights: 'auto', cam: { frame: 'troisQuarts', focal: 35, ev: 0, wb: 5800 } },
  tropicalSunset: { n: 'Villa tropicale au coucher du soleil', place: 'ile', month: 9, time: 'coucher', weather: 'clair', wx: { clouds: .35 }, lights: 'on', cam: { frame: 'jardin', focal: 24, ev: .2, wb: 6400, bloom: .4 } },
  apresPluie: { n: 'Maison sous un ciel nuageux apr\u00e8s la pluie', place: null, month: 4, hour: 18, weather: 'couvert', wx: { wet: .95, rain: 0, clouds: .85, overcast: .7 }, lights: 'auto', cam: { frame: 'troisQuarts', focal: 28, ev: .1, wb: 6500 } },
  hiverSoir: { n: 'Maison illumin\u00e9e pendant une soir\u00e9e d\'hiver', place: 'residentiel', month: 12, time: 'crepuscule', weather: 'neige', wx: { snowAcc: .85 }, lights: 'on', led: true, cam: { frame: 'troisQuarts', focal: 28, ev: .5, wb: 5600, bloom: .45 } }
};
function applyScenario(P, key) { const s = SCENARIOS[key]; if (!s) return null; const e = P.env;
  if (s.place) applyPlace(P, s.place, { keepTime: true }); e.month = s.month || e.month; setWeather(P, s.weather);
  if (s.time) { const t = timePresets(P).find(x => x.k === s.time); if (t) e.hour = t.h; } else if (s.hour != null) e.hour = s.hour;
  if (s.wx) Object.assign(e.wx, s.wx); if ((PLACES[e.place] || {}).nosnow) { e.wx.snow = 0; e.wx.snowAcc = 0; }
  e.lights = s.lights || 'auto'; if (s.led != null) e.led = s.led; e.cam = Object.assign({}, e.cam || {}, s.cam || {}); e.scenario = key; return s.cam ? s.cam.frame : null; }
const SNAP_KEYS = ['place', 'relief', 'water', 'groundKind', 'veg', 'urban', 'snowLine', 'sandKind', 'fields', 'forest', 'lat', 'lon', 'tz', 'dst', 'month', 'day', 'hour', 'weather', 'wx', 'lights', 'led', 'ceilLights', 'lampGain', 'cam', 'hdri', 'hdriRot', 'hdriGain'];
function envSnapshot(P, name) { const s = { name: name || 'Mon pr\u00e9r\u00e9glage', at: Date.now(), env: {} }; for (const k of SNAP_KEYS) if (P.env[k] !== undefined) s.env[k] = clone(P.env[k]); return s; }
function applyEnvSnapshot(P, snap) { if (!snap || !snap.env) return false; for (const k of SNAP_KEYS) if (snap.env[k] !== undefined) P.env[k] = clone(snap.env[k]); normalizeEnv(P); ensureTerrain(P); return true; }

/* ---------- interpolation d'animation ---------- */
function lerpEnv(a, b, t) { const o = clone(a); for (const k of ['hour', 'month']) if (typeof a[k] === 'number' && typeof b[k] === 'number') o[k] = a[k] + (b[k] - a[k]) * t; if (a.wx && b.wx) for (const k of WX_KEYS) o.wx[k] = (a.wx[k] || 0) + ((b.wx[k] || 0) - (a.wx[k] || 0)) * t; return o; }

Object.assign(TP, { ENV_CATS, PLACES, RELIEFS, WATERS, GROUNDS, PAINT_KEYS, WEATHERS, WX_KEYS, SEASONS, CITIES, SPECIES, LT_NAMES, EXT_LIGHT_GROUPS, INT_LIGHT_GROUPS, SCENARIOS,
  envNoise: { hash2, vnoise, fbm, ridged, sstep }, dayOfYear, solarHour, clockFromSolar, sunPos, moonPos, sunTimes, timePresets, seasonOf, dayFactor,
  weatherDefaults, setWeather, setSeason, applyPlace, normalizeEnv, ensureTerrain, lotFrame, toLot, fromLot, lotCorners, gridFor, gridSample, gridCode, sculptAt, paintAt, resetSculpt, resetPaint, heightmapFromImage, pathPolygon,
  envCtx, cityLayout, scatterEnv, kelvinRGB, lightProps, lightOn, lightColor, allLights, setAllLights, isNight, applyScenario, envSnapshot, applyEnvSnapshot, lerpEnv });
})(typeof window !== 'undefined' ? window : globalThis);
