/* Trait de Plan \u2014 moteur 3D (Three.js r128). Construit la sc\u00e8ne \u00e0 partir du mod\u00e8le P (source unique de v\u00e9rit\u00e9). */
(function (G) {
'use strict';
const TP = G.TP;
const { clamp, n2, shade, rng, hyp, wg, polyArea, centroid, bbox, rotPt, sortedLevels, levelAbove, MATS, FACADES, ROOFMATS, OPDEF, FURN, isExt, isWindow, wallSides, stairInfo, stairOutline, isStair, roofGeom, roofHeightAt, roofBase, interiorRooms, fdesc } = TP;
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
let T = null; const k3 = { f: 0, b: 0, l: 0, r: 0 };
const available = () => !!G.THREE;

/* ---------- chargement paresseux des modules compl\u00e9mentaires ---------- */
const scripts = {};
function loadScript(url) { if (scripts[url]) return scripts[url]; scripts[url] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => res(); s.onerror = () => { delete scripts[url]; rej(new Error('Impossible de charger ' + url.split('/').pop())); }; document.head.appendChild(s); }); return scripts[url]; }

/* ---------- textures proc\u00e9durales ---------- */
const texCache = {};
function texCanvas(kind, base, size, seedKey) {
  const key = kind + base + size; if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), R = rng(String(seedKey || kind).length * 977 + size + parseInt(String(base).slice(1, 4), 16)); const S = size;
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  const rgba = (hex, a) => { const v = parseInt(String(hex).slice(1, 7), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; };
  const blotch = (n, amp, r0, r1, al) => { for (let i = 0; i < n; i++) { const px = R() * S, py = R() * S, rr = S * (r0 + R() * (r1 - r0)), col = shade(base, (R() - .5) * amp); for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { if (px + ox + rr < 0 || px + ox - rr > S || py + oy + rr < 0 || py + oy - rr > S) continue; const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr); g.addColorStop(0, rgba(col, al)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(px + ox - rr, py + oy - rr, rr * 2, rr * 2); } } };
  const speck = (n, amp, sz) => { for (let i = 0; i < n; i++) { x.fillStyle = shade(base, (R() - .5) * amp); x.fillRect(R() * S, R() * S, sz, sz); } };
  switch (kind) {
    case 'planks': { const rows = 6, rh = S / rows; for (let r = 0; r < rows; r++) { let px = -R() * S * .6; while (px < S) { const len = S * (.35 + R() * .5); x.fillStyle = shade(base, (R() - .5) * .18); x.fillRect(px, r * rh, len, rh); x.strokeStyle = shade(base, -.12); x.globalAlpha = .25; for (let g = 0; g < 4; g++) { x.beginPath(); const gy = r * rh + rh * (.2 + R() * .6); x.moveTo(px, gy); x.bezierCurveTo(px + len * .3, gy + R() * 3, px + len * .6, gy - R() * 3, px + len, gy); x.stroke(); } x.globalAlpha = 1; x.fillStyle = shade(base, -.3); x.fillRect(px, r * rh, 1.5, rh); px += len; } x.fillStyle = shade(base, -.32); x.fillRect(0, r * rh, S, 1.2); } break; }
    case 'herring': { const u = S / 8; for (let j = -1; j < 9; j++) for (let i = -1; i < 9; i++) { x.save(); x.translate(i * u, j * u); x.rotate(((i + j) % 2 ? 1 : -1) * Math.PI / 4); x.fillStyle = shade(base, (R() - .5) * .18); x.fillRect(-u * .7, -u * .18, u * 1.4, u * .36); x.strokeStyle = shade(base, -.3); x.lineWidth = 1; x.strokeRect(-u * .7, -u * .18, u * 1.4, u * .36); x.restore(); } break; }
    case 'tiles': case 'tilesBig': case 'pavers': { const nx = kind === 'tilesBig' ? 1 : 2, ny = kind === 'tilesBig' ? 2 : 2, tw = S / nx, th = S / ny; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { x.fillStyle = shade(base, (R() - .5) * .08); x.fillRect(i * tw, j * th, tw, th); } speck(500, .06, 1.5); x.fillStyle = shade(base, -.22); for (let i = 0; i <= nx; i++) x.fillRect(i * tw - 1.2, 0, 2.4, S); for (let j = 0; j <= ny; j++) x.fillRect(0, j * th - 1.2, S, 2.4); break; }
    case 'cement': { const n = 4, t = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const ox = i * t, oy = j * t; x.fillStyle = base; x.fillRect(ox, oy, t, t); x.fillStyle = '#5E7184'; x.beginPath(); x.moveTo(ox + t / 2, oy + t * .12); x.lineTo(ox + t * .88, oy + t / 2); x.lineTo(ox + t / 2, oy + t * .88); x.lineTo(ox + t * .12, oy + t / 2); x.closePath(); x.fill(); x.fillStyle = base; x.beginPath(); x.arc(ox + t / 2, oy + t / 2, t * .2, 0, 7); x.fill(); x.fillStyle = '#C9A043'; x.beginPath(); x.arc(ox + t / 2, oy + t / 2, t * .08, 0, 7); x.fill(); x.fillStyle = shade(base, -.25); x.fillRect(ox, oy, t, 1.2); x.fillRect(ox, oy, 1.2, t); } break; }
    case 'marble': { speck(800, .05, 2); x.strokeStyle = shade(base, -.2); x.globalAlpha = .45; for (let i = 0; i < 7; i++) { x.lineWidth = .6 + R() * 1.6; x.beginPath(); let px = R() * S, py = 0; x.moveTo(px, py); while (py < S) { px += (R() - .5) * 40; py += 10 + R() * 25; x.lineTo(px, py); } x.stroke(); } x.globalAlpha = 1; x.fillStyle = shade(base, -.12); x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); break; }
    case 'flagstone': case 'stone': { const cells = kind === 'stone' ? 7 : 5; for (let j = 0; j < cells; j++) { let px = -R() * S / cells; const hh = S / cells; while (px < S) { const ww = S / cells * (0.7 + R() * .9); x.fillStyle = shade(base, (R() - .5) * .28); x.fillRect(px + 2, j * hh + 2, ww - 4, hh - 4); px += ww; } } x.globalAlpha = .4; speck(1200, .25, 1.5); x.globalAlpha = 1; break; }
    case 'noise': case 'render': case 'concrete': { speck(kind === 'render' ? 5000 : 2400, kind === 'render' ? .1 : .2, kind === 'render' ? 1.2 : 1.6); if (kind === 'concrete') { x.strokeStyle = shade(base, -.15); x.lineWidth = 1; for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(0, S * i / 3); x.lineTo(S, S * i / 3); x.stroke(); } for (let i = 0; i < 12; i++) { x.fillStyle = shade(base, -.25); x.beginPath(); x.arc((i % 4 + .5) * S / 4, (Math.floor(i / 4) + .5) * S / 3, 2.5, 0, 7); x.fill(); } } break; }
    case 'grass': break;
    case 'gravel': { for (let i = 0; i < 1100; i++) { x.fillStyle = shade(base, (R() - .5) * .3); x.beginPath(); x.arc(R() * S, R() * S, 1.5 + R() * 3, 0, 7); x.fill(); } break; }
    case 'water': { const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, shade(base, .12)); g.addColorStop(1, shade(base, -.12)); x.fillStyle = g; x.fillRect(0, 0, S, S); x.strokeStyle = shade(base, .35); x.lineWidth = 2; x.globalAlpha = .5; for (let i = 0; i < 9; i++) { x.beginPath(); const y0 = R() * S; x.moveTo(0, y0); for (let px = 0; px <= S; px += 16) x.lineTo(px, y0 + Math.sin(px / 18 + i) * 4); x.stroke(); } x.globalAlpha = 1; break; }
    case 'vboards': { const n = 8, bw = S / n; for (let i = 0; i < n; i++) { x.fillStyle = shade(base, (R() - .5) * .14); x.fillRect(i * bw, 0, bw, S); x.globalAlpha = .18; x.strokeStyle = shade(base, -.25); for (let k = 0; k < 3; k++) { x.beginPath(); const gx = i * bw + bw * (.2 + R() * .6); x.moveTo(gx, 0); x.lineTo(gx + (R() - .5) * 4, S); x.stroke(); } x.globalAlpha = 1; x.fillStyle = shade(base, -.35); x.fillRect(i * bw, 0, 2, S); } break; }
    case 'brick': { const rows = 12, rh = S / rows, bw = S / 4; x.fillStyle = shade(base, .35); x.fillRect(0, 0, S, S); for (let r = 0; r < rows; r++) { const off = r % 2 ? bw / 2 : 0; for (let px = -bw; px < S + bw; px += bw) { x.fillStyle = shade(base, (R() - .5) * .25); x.fillRect(px + off + 1.5, r * rh + 1.5, bw - 3, rh - 3); } } break; }
    case 'rooftiles': { const rows = 8, rh = S / rows, n = 6, tw = S / n; for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const off = r % 2 ? tw / 2 : 0; const g = x.createLinearGradient(0, r * rh, 0, (r + 1) * rh); g.addColorStop(0, shade(base, -.25)); g.addColorStop(.25, shade(base, .08)); g.addColorStop(1, shade(base, (R() - .5) * .2)); x.fillStyle = g; x.fillRect(i * tw + off - tw, r * rh, tw - 1.5, rh); x.fillRect(i * tw + off, r * rh, tw - 1.5, rh); } break; }
    case 'slate': { const rows = 10, rh = S / rows, n = 5, tw = S / n; for (let r = 0; r < rows; r++) for (let i = -1; i <= n; i++) { const off = r % 2 ? tw / 2 : 0; x.fillStyle = shade(base, (R() - .5) * .22); x.fillRect(i * tw + off + 1, r * rh, tw - 2, rh - 1.5); } break; }
    case 'seam': { const n = 6, bw = S / n; speck(800, .06, 1.5); for (let i = 0; i < n; i++) { x.fillStyle = shade(base, .2); x.fillRect(i * bw, 0, 3, S); x.fillStyle = shade(base, -.3); x.fillRect(i * bw + 3, 0, 2, S); } break; }
    case 'crepi': { speck(Math.round(9000 * S * S / 262144), .24, 2.2 * S / 512); speck(Math.round(2600 * S * S / 262144), .34, 3.2 * S / 512); break; }
    case 'polished': { blotch(46, .16, .08, .22, .55); break; }
    case 'soil': { blotch(24, .2, .06, .18, .5); speck(3200, .3, 2); for (let i = 0; i < 140; i++) { x.fillStyle = shade(base, (R() - .3) * .5); x.beginPath(); x.arc(R() * S, R() * S, 1 + R() * 3.5, 0, 7); x.fill(); } break; }
    case 'metal': { x.globalAlpha = .16; for (let i = 0; i < 1100; i++) { x.fillStyle = shade(base, (R() - .5) * .5); x.fillRect(R() * S - 60, R() * S, 40 + R() * 160, 1); } x.globalAlpha = 1; break; }
    case 'sand': { blotch(22, .1, .1, .28, .4); speck(Math.round(14000 * S * S / 262144), .2, 1.1); x.globalAlpha = .12; x.strokeStyle = shade(base, -.22); x.lineWidth = 1.5; for (let i = 0; i < 14; i++) { x.beginPath(); const y0 = R() * S; for (let px = 0; px <= S; px += 8) x.lineTo(px, y0 + Math.sin(px / 30 + i) * 6); x.stroke(); } x.globalAlpha = 1; break; }
    case 'snow': { blotch(26, .07, .1, .3, .5); speck(1400, .05, 1.5); x.fillStyle = '#FFFFFF'; for (let i = 0; i < 260; i++) x.fillRect(R() * S, R() * S, 1, 1); break; }
    case 'rockface': { blotch(30, .3, .05, .2, .55); x.globalAlpha = .5; for (let j = 0; j < 9; j++) { x.fillStyle = shade(base, (R() - .5) * .28); x.fillRect(0, j * S / 9 + R() * 6, S, 2 + R() * 6); } x.globalAlpha = .38; x.strokeStyle = shade(base, -.4); for (let i = 0; i < 28; i++) { x.lineWidth = .8 + R() * 1.8; x.beginPath(); let px = R() * S, py = R() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - .5) * 50; py += (R() - .3) * 30; x.lineTo(px, py); } x.stroke(); } x.globalAlpha = 1; speck(2600, .3, 1.6); break; }
    case 'asphalt': { speck(Math.round(16000 * S * S / 262144), .35, 1.2); blotch(12, .12, .1, .3, .35); break; }
    case 'canopy': { for (let i = 0; i < 900; i++) { x.fillStyle = shade(base, (R() - .45) * .55); x.beginPath(); x.arc(R() * S, R() * S, 3 + R() * 9, 0, 7); x.fill(); } break; }
    case 'field': { const rows = 24; for (let r = 0; r < rows; r++) { x.fillStyle = shade(base, (r % 2 ? -.08 : .05) + (R() - .5) * .06); x.fillRect(0, r * S / rows, S, S / rows * .6); } speck(6000, .25, 1.2); break; }
    case 'foam': { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); break; }
  }
  if (kind === 'grass') { blotch(30, .22, .08, .2, .5); for (let i = 0; i < 9000 * S * S / 262144; i++) { const t = R(); x.fillStyle = t < .12 ? shade('#B9B46A', (R() - .5) * .3) : shade(base, (R() - .5) * .55); x.fillRect(R() * S, R() * S, 1.2, 2 + R() * 5); } }
  const GA = { water: 0, cement: .04, marble: .05, planks: .1, herring: .1, vboards: .12, tiles: .05, tilesBig: .07, pavers: .12, render: .1, crepi: .14, concrete: .2, polished: .1, noise: .14, grass: .16, gravel: .1, soil: .2, brick: .12, stone: .14, flagstone: .14, rooftiles: .14, slate: .16, seam: .08, metal: .06, sand: .12, snow: .05, rockface: .18, asphalt: .1, canopy: .15, field: .12, foam: 0 };
  if (S >= 128 && GA[kind] !== 0) grain(x, S, GA[kind] == null ? .1 : GA[kind], R);
  return texCache[key] = c;
}
function grain(x, S, amt, R) {
  let id; try { id = x.getImageData(0, 0, S, S); } catch (e) { return; } const d = id.data; const mk = n => { const a = new Float32Array(n * n); for (let i = 0; i < n * n; i++) a[i] = R(); return a; };
  const oc = [[6, mk(6), .4], [24, mk(24), .3], [96, mk(96), .2], [S >> 1, mk(S >> 1), .1]];
  for (let Y = 0; Y < S; Y++) for (let X = 0; X < S; X++) { let v = 0; for (const [n, a, w] of oc) { const fx = X / S * n, fy = Y / S * n, x0 = fx | 0, y0 = fy | 0, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n; let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); v += w * ((a[y0 * n + x0] * (1 - tx) + a[y0 * n + x1] * tx) * (1 - ty) + (a[y1 * n + x0] * (1 - tx) + a[y1 * n + x1] * tx) * ty); }
    const k = 1 + (v - .5) * 2 * amt, i = (Y * S + X) * 4; d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k); }
  x.putImageData(id, 0, 0);
}

/* ---------- mat\u00e9riaux ---------- */
let matCache = {};
function lin(hex) { const c = new THREE.Color(hex); if (c.convertSRGBToLinear) c.convertSRGBToLinear(); return c; }
function clipFor(m) { if (T && T.clipPlanes && T.clipPlanes.length) { m.clippingPlanes = T.clipPlanes; m.clipShadows = true; } return m; }
function M3(col, o) {
  o = o || {}; const k = 'c' + col + JSON.stringify(o); if (matCache[k]) return matCache[k];
  const m = new THREE.MeshStandardMaterial({ color: lin(col), roughness: o.rough != null ? o.rough : .8, metalness: o.metal || 0, transparent: o.op != null && o.op < 1, opacity: o.op != null ? o.op : 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
  m.userData.rt = { type: o.fol ? 3 : (o.op != null && o.op < .9 ? 1 : 0), wx: o.wx || (o.op != null && o.op < .9 ? 1 : 0) };
  m.envMapIntensity = o.env != null ? o.env : .55; if (o.emis) { m.emissive = lin(o.emis); m.emissiveIntensity = o.emisI != null ? o.emisI : (T ? T.lampGlow : .4); if (!o.glow) m.userData.lamp = true; } if (o.op != null && o.op < 1) m.depthWrite = false; if (!o.noclip) clipFor(m);
  if ((o.wx || o.wind) && TP.Env && TP.Env.patch) TP.Env.patch(m, o); return matCache[k] = m;
}
function texMat(kind, base, scaleM, o) {
  o = o || {}; const k = 't' + kind + base + scaleM + JSON.stringify(o); if (matCache[k]) return matCache[k];
  const t = new THREE.CanvasTexture(texCanvas(kind, base, o.size || 512)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / scaleM, 1 / scaleM); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: o.rough != null ? o.rough : .8, metalness: o.metal || 0, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, transparent: o.op != null && o.op < 1, opacity: o.op != null ? o.op : 1 });
  m.userData.rt = { kind, type: kind === 'water' ? 2 : 0, nrm: 1, macro: { grass: .42, soil: .3, gravel: .16, concrete: .2, polished: .1, render: .1, crepi: .12, stone: .12, flagstone: .12, brick: .1, rooftiles: .16, slate: .14, pavers: .12, planks: .06, vboards: .1, sand: .15, rockface: .42, snow: .06, canopy: .3, field: .25, asphalt: .08 }[kind] || 0 };
  if (kind !== 'water' && TP.Tracer && !THREE.MINI) { try { const pm = TP.Tracer.pbrMaps(t.image, kind); const nt = new THREE.CanvasTexture(pm.normal), rt = new THREE.CanvasTexture(pm.rough); for (const q of [nt, rt]) { q.wrapS = q.wrapT = THREE.RepeatWrapping; q.repeat.copy(t.repeat); q.anisotropy = 4; } m.normalMap = nt; m.roughnessMap = rt; m.roughness = Math.min(1, m.roughness * 1.35); } catch (e) { } }
  m.userData.rt.wx = o.wx || 0; if (o.emis) { m.emissive = lin(o.emis); m.emissiveIntensity = o.emisI != null ? o.emisI : 1; }
  m.envMapIntensity = o.env != null ? o.env : .5; if (!o.noclip) clipFor(m); if ((o.wx || o.wind) && TP.Env && TP.Env.patch) TP.Env.patch(m, o); return matCache[k] = m;
}
const floorMat = (k, o) => { const m = MATS[k] || MATS.oak; return texMat(m.tex === 'tiles' && m.ext ? 'pavers' : m.tex, m.c, m.m, Object.assign({ rough: k === 'water' ? .08 : m.tex === 'polished' ? .2 : m.tex === 'marble' ? .12 : m.tex === 'tiles' || m.tex === 'tilesBig' ? .28 : m.tex === 'planks' || m.tex === 'herring' ? (m.ext ? .75 : .42) : .85, ds: true, env: k === 'water' ? 1.2 : .5 }, m.ext && k !== 'water' ? { wx: 1 } : {}, o || {})); };
const facadeMat = k => { const m = FACADES[k] || FACADES['enduit-blanc']; return texMat(m.tex, m.c, 1, { rough: m.tex === 'vboards' ? .75 : m.tex === 'metal' ? .32 : .92, metal: m.tex === 'metal' ? .9 : 0, wx: 1 }); };
const roofMat = k => { const m = ROOFMATS[k] || ROOFMATS['tuiles-rouges']; return texMat(m.tex, m.c, 1, { rough: m.tex === 'seam' ? .45 : .85, metal: m.tex === 'seam' ? .35 : 0, ds: true, wx: 1 }); };
const paintMat = c => M3(c || '#F2EEE6', { rough: .92 });

/* ---------- utilitaires g\u00e9om\u00e9triques ---------- */
// UV en m\u00e8tres (texture r\u00e9p\u00e9t\u00e9e selon la taille r\u00e9elle) pour une bo\u00eete de mur
function boxUV(geo, sx, sy, sz, u0) {
  const uv = geo.attributes.uv; const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] + (f >= 4 ? u0 || 0 : 0), uv.getY(k) * dims[f][1]); }
  uv.needsUpdate = true;
}
// prisme \u00e9pais \u00e0 partir d'un polygone 3D convexe (m\u00e8tres), mat\u00e9riau du dessus et des chants
function prism(pts, thk, topMat, sideMat) {
  const V = THREE.Vector3; const P = pts.map(p => new V(p[0], p[1], p[2])); const n = new V();
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
  n.normalize(); if (n.y < -1e-6 || (Math.abs(n.y) < 1e-6 && n.lengthSq() === 0)) { P.reverse(); n.negate(); }
  const B = P.map(p => p.clone().addScaledVector(n, -thk));
  const e1 = P[1].clone().sub(P[0]).normalize(), e2 = new V().crossVectors(n, e1).normalize();
  const pos = [], uv = [], idxTop = [], idxRest = []; let vi = 0;
  const vert = (p, u, v) => { pos.push(p.x, p.y, p.z); uv.push(u, v); return vi++; };
  const uvOf = p => { const d = p.clone().sub(P[0]); return [d.dot(e1), d.dot(e2)]; };
  const top = P.map(p => vert(p, ...uvOf(p))); for (let i = 1; i < P.length - 1; i++) idxTop.push(top[0], top[i], top[i + 1]);
  const bot = B.map(p => vert(p, ...uvOf(p))); for (let i = 1; i < B.length - 1; i++) idxRest.push(bot[0], bot[i + 1], bot[i]);
  for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; const L = P[i].distanceTo(P[j]); const a = vert(P[i], 0, 0), b = vert(P[j], L, 0), c = vert(B[j], L, thk), d = vert(B[i], 0, thk); idxRest.push(a, d, c, a, c, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex([...idxTop, ...idxRest]); g.addGroup(0, idxTop.length, 0); g.addGroup(idxTop.length, idxRest.length, 1); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, [topMat, sideMat || topMat]); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
// surface pos\u00e9e sur le terrain : subdivision des ar\u00eates trop longues (sans fissures), puis altitude de chaque sommet
function drapeGeo(geo, gh, maxL) {
  const pa = geo.attributes.position; let V = []; for (let i = 0; i < pa.count; i++) V.push([pa.getX(i), pa.getY(i)]); let F = []; const ix = geo.index; if (ix) for (let i = 0; i < ix.count; i += 3) F.push([ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)]); else for (let i = 0; i < pa.count; i += 3) F.push([i, i + 1, i + 2]);
  const L2 = maxL * maxL;
  for (let it = 0; it < 7 && F.length < 60000; it++) { const mid = new Map(); let split = false; const len2 = (a, b) => { const dx = V[a][0] - V[b][0], dy = V[a][1] - V[b][1]; return dx * dx + dy * dy; };
    const M = (a, b) => { if (len2(a, b) <= L2) return -1; const k = a < b ? a + ',' + b : b + ',' + a; let m = mid.get(k); if (m == null) { m = V.length; V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]); mid.set(k, m); } split = true; return m; };
    const NF = []; for (const [a, b, c] of F) { const ab = M(a, b), bc = M(b, c), ca = M(c, a); const n = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (!n) NF.push([a, b, c]);
      else if (n === 3) NF.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      else if (n === 1) { if (ab >= 0) NF.push([a, ab, c], [ab, b, c]); else if (bc >= 0) NF.push([b, bc, a], [bc, c, a]); else NF.push([c, ca, b], [ca, a, b]); }
      else { if (ab < 0) NF.push([c, ca, bc], [ca, a, b], [ca, b, bc]); else if (bc < 0) NF.push([a, ab, ca], [ab, b, c], [ab, c, ca]); else NF.push([b, bc, ab], [bc, c, a], [bc, a, ab]); } }
    F = NF; if (!split) break; }
  const pos = new Float32Array(V.length * 3), uv = new Float32Array(V.length * 2); for (let i = 0; i < V.length; i++) { const x = V[i][0], y = V[i][1]; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = -gh(x, y); uv[i * 2] = x; uv[i * 2 + 1] = y; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(F.flat()); g.computeVertexNormals(); geo.dispose(); return g; }
function shapeFrom(pts, holes) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0] / 100, p[1] / 100))); (holes || []).forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0] / 100, p[1] / 100))))); return s; }

/* ---------- ciel, soleil, m\u00e9t\u00e9o ---------- */
const WEATHER = TP.WEATHERS || { sun: { n: 'Soleil' } };
function sunState(P) {
  const sp = TP.sunPos ? TP.sunPos(P) : { el: .8, az: Math.PI }; const el = sp.el, az = sp.az, wx = P.env.wx || {};
  const nv = TP.northVec(P), ev = [-nv[1], nv[0]]; const hx = nv[0] * Math.cos(az) + ev[0] * Math.sin(az), hz = nv[1] * Math.cos(az) + ev[1] * Math.sin(az);
  const dir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize(); const day0 = clamp((Math.sin(el) + .05) / .17, 0, 1), day = day0 * (1 - (wx.dark || 0) * .55);
  return { el, az, dir, day, day0, wx, w: WEATHER[P.env.weather] || WEATHER.sun };
}
function basicLighting(P, scene, s) { const hemi = new THREE.HemisphereLight(0xCFE2F1, 0x8E9A84, .3 + .5 * s.day); scene.add(hemi); const sun = new THREE.DirectionalLight(0xFFF4E6, 1.6 * s.day); sun.castShadow = s.day > .05; sun.shadow.mapSize.set(2048, 2048); scene.add(sun); scene.add(sun.target); scene.background = new THREE.Color(0xCFE2F1); return { sun, hemi }; }
function lerpHex(a, b, t) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, clamp(t, 0, 1)).getHexString(); }
function skyColors(s) { const w = s.w; let zen = w.zen, hor = w.hor; const dusk = clamp(1 - Math.abs(s.el) / .2, 0, 1) * (w === WEATHER.couvert ? .3 : 1); hor = lerpHex(hor, '#F0A66E', dusk * .75); zen = lerpHex(zen, '#3D5A8F', dusk * .5); zen = lerpHex('#08101F', zen, s.day); hor = lerpHex('#1A2740', hor, s.day); return { zen, hor, ground: lerpHex('#141A14', '#8E9A84', s.day) }; }
function skyMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, .95, .85) }, sunAmt: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(hor, zen, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, gnd, clamp(-h*4.0,0.0,1.0)); float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunCol * (pow(d, 900.0) * 3.0 + pow(d, 12.0) * 0.18) * sunAmt; gl_FragColor = vec4(c, 1.0); }' });
}
function applySky(mat, s) { const c = skyColors(s); mat.uniforms.zen.value.set(c.zen); mat.uniforms.hor.value.set(c.hor); mat.uniforms.gnd.value.set(c.ground); mat.uniforms.sunDir.value.copy(s.dir); mat.uniforms.sunAmt.value = s.day * (s.w === WEATHER.couvert ? .05 : s.w === WEATHER.brume ? .4 : 1); return c; }

/* ---------- initialisation ---------- */
function init(canvas, cb) {
  if (!available()) return false; if (T) return true;
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(2, G.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.localClippingEnabled = true;
  T = { renderer, canvas, cb: cb || {}, mode: 'orbit', orb: { th: -1.0, ph: .95, r: 22 }, center: new THREE.Vector3(5, 1, 4), walk: null, dirty: true, raf: 0, clipPlanes: [], lampGlow: .4, models: {}, envKey: '', visible: false, quality: 'rt', camOpt: Object.assign({}, CAMDEF), rtLights: [], rtDirty: true, rtStart: 0 };
  T.camera = new THREE.PerspectiveCamera(48, 1, .08, 12000);
  const envScene = new THREE.Scene(); T.envSkyMat = skyMaterial(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), T.envSkyMat)); T.envScene = envScene; T.pmrem = new THREE.PMREMGenerator(renderer);
  bindControls(canvas); try { new ResizeObserver(() => { resize(); }).observe(canvas.parentElement); } catch (e) { G.addEventListener('resize', resize); }
  return true;
}
function resize() { if (!T) return; const c = T.canvas, w = c.clientWidth, h = c.clientHeight; if (!w || !h) return; T.renderer.setSize(w, h, false); T.camera.aspect = w / h; T.camera.updateProjectionMatrix(); T.dirty = true; kick(); }
function setVisible(v) { if (!T) return; T.visible = v; if (v) { resize(); kick(); } }
function kick() { if (T && T.visible && !T.raf) T.raf = requestAnimationFrame(loop); }
let last = 0;
function placeCam() { const cam = T.camera;
  if (T.mode === 'orbit') { const o = T.orb, c = T.center; cam.position.set(c.x + o.r * Math.sin(o.ph) * Math.cos(o.th), c.y + o.r * Math.cos(o.ph), c.z + o.r * Math.sin(o.ph) * Math.sin(o.th)); cam.lookAt(c); }
  else if (T.walk) { const w = T.walk; cam.position.set(w.x, w.y, w.z); cam.lookAt(w.x + Math.sin(w.yaw) * Math.cos(w.pitch), w.y + Math.sin(w.pitch), w.z - Math.cos(w.yaw) * Math.cos(w.pitch)); } }
function loop(t) {
  T.raf = 0; if (!T.visible || !T.scene) return; const dt = Math.min(.05, ((t || 0) - last) / 1000 || .016); last = t || 0; const cam = T.camera; let moving = false;
  if (T.mode !== 'orbit' && T.walk) { const w = T.walk, sp = 1.7 * dt, fx = Math.sin(w.yaw), fz = -Math.cos(w.yaw), mv = (k3.f - k3.b) * sp, st = (k3.r - k3.l) * sp; if (mv || st) { w.x += fx * mv - fz * st; w.z += fz * mv + fx * st; moving = true; } }
  placeCam(); let anim = false; if (TP.Env && TP.Env.tick) { try { anim = TP.Env.tick(dt, t || 0); } catch (e) { if (G.console) console.warn('[environnement]', e); } }
  const changed = T.dirty || moving || (anim && T.quality === 'rt'); let cs = null; try { cs = applyCamera(); } catch (e) { }
  if (changed) { T.renderer.render(T.scene, cam); T.dirty = false; }
  let more = false; try { more = rtTick(t || performance.now(), changed); } catch (e) { if (G.console) console.warn('[rendu]', e); T.quality = 'rt'; if (T.cb.onRender) T.cb.onRender({ error: 'Le rendu photor\u00e9aliste a rencontr\u00e9 une erreur.' }); }
  if (moving || T.dirty || more || (anim && T.quality === 'rt')) T.raf = requestAnimationFrame(loop);
}

/* ---------- construction de la sc\u00e8ne ---------- */
function build(P, ctx) {
  if (!T) return { errors: 0 }; ctx = ctx || {}; T.P = P; const t0 = performance.now(); let errors = 0; const guard = (fn) => { try { fn(); } catch (e) { errors++; if (G.console) console.warn('[3D]', e); } };
  // plans de coupe
  const clipWanted = !!P.env.section; const hadClip = T.clipPlanes.length > 0; if (clipWanted !== hadClip) { matCache = {}; T.clipPlanes = clipWanted ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)] : []; }
  if (T.scene) T.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  const scene = new THREE.Scene(); const root = new THREE.Group(); root.name = 'Maison'; scene.add(root); T.root = root;
  const s = sunState(P); T.sun = s; T.season = TP.seasonOf ? TP.seasonOf(P.env) : 'ete'; T.lightsOn = P.env.lights === 'on' || (P.env.lights !== 'off' && (TP.isNight ? TP.isNight(P) : s.day < .45)); T.rtLights = []; T.rtPortals = []; T.lightList = []; T.eaves = []; T.envCtx = null; T.gh = null; if (TP.envCtx && P.env.ground !== 'transparent') { try { T.envCtx = TP.envCtx(P); } catch (e) { T.envCtx = null; } } T.rtDirty = true; T.lampGlow = .25 + (1 - s.day) * 1.6; Object.values(matCache).forEach(m => { if (m.userData && m.userData.lamp) m.emissiveIntensity = T.lampGlow; });
  const lights = TP.Env && TP.Env.lighting ? TP.Env.lighting(P, scene, s) : basicLighting(P, scene, s); const sun = lights.sun;
  // contenu
  const ls = sortedLevels(P), cur = P.levels.find(l => l.id === P.cur) || ls[0]; const hideAbove = P.env.cut || P.env.upTo; const shown = ls.filter(l => !hideAbove || l.elev <= cur.elev);
  let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity, ytop = 0; const pad = (x, z) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); };
  const lightRooms = [];
  const gElev = (ls.find(l => l.elev >= 0) || ls[0]).elev;
  for (const lv of shown) {
    T.gh = T.envCtx && lv.elev === gElev ? T.envCtx.h : null;
    const base = lv.elev / 100, H = lv.h / 100; ytop = Math.max(ytop, base + H); const isCur = lv.id === cur.id; const cutH = P.env.cut && isCur ? P.env.cutH / 100 : Infinity;
    const holes = []; const below = TP.levelBelow(P, lv); if (below) below.furn.filter(isStair).forEach(f => holes.push(stairOutline(f)));
    guard(() => buildFloors(P, lv, root, base, holes, pad, lightRooms, ls[0] === lv || lv.elev === (ls.find(l => l.elev >= 0) || ls[0]).elev, cutH));
    guard(() => buildWalls(P, lv, root, base, H, cutH, pad));
    guard(() => buildFurniture(P, lv, root, base, H, ctx));
    if (!P.env.cut && P.env.roofs !== false && !(hideAbove && !isCur && false)) guard(() => buildRoofs(P, lv, root, base, H));
    if (lv === ls[0] || lv.kind === 'sous-sol' || lv.elev === (ls.find(l => l.elev >= 0) || ls[0]).elev) if (P.env.ground === 'transparent') guard(() => buildFoundations(P, lv, root, base));
  }
  T.gh = null; guard(() => buildChimneys(P, root, shown));
  if (!isFinite(bx0)) { bx0 = 0; bz0 = 0; bx1 = 10; bz1 = 8; }
  guard(() => { const bb = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 }; if (TP.Env && TP.Env.build && P.env.ground !== 'transparent') TP.Env.build(P, scene, bb, ctx); else buildTerrain(P, scene, bb); });
  // lumi\u00e8res int\u00e9rieures
  if (T.lightsOn) guard(() => roomLights(P, lightRooms));
  guard(() => { if (TP.Env && TP.Env.finishLights) TP.Env.finishLights(P, scene); else T.rtLights = T.lightList.slice(0, 128); });
  // soleil cadr\u00e9 sur la maison
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, span = Math.max(bx1 - bx0, bz1 - bz0, 8);
  sun.position.set(cx + s.dir.x * span * 2, Math.max(2, s.dir.y * span * 2) + 2, cz + s.dir.z * span * 2); sun.target.position.set(cx, 0, cz); const sc = sun.shadow.camera; sc.left = -span * .8; sc.right = span * .8; sc.top = span * .8; sc.bottom = -span * .8; sc.near = .5; sc.far = span * 5 + 40; sc.updateProjectionMatrix();
  // plan de coupe verticale
  if (T.clipPlanes.length) { const axis = P.env.secAxis === 'z' ? 'z' : 'x'; const lo = axis === 'x' ? bx0 : bz0, hi = axis === 'x' ? bx1 : bz1; const c = lo + (hi - lo) * clamp(P.env.secPos, 0, 100) / 100; const n = axis === 'x' ? new THREE.Vector3(P.env.secFlip ? 1 : -1, 0, 0) : new THREE.Vector3(0, 0, P.env.secFlip ? 1 : -1); T.clipPlanes[0].normal.copy(n); T.clipPlanes[0].constant = P.env.secFlip ? -c : c; }
  const first = !T.scene; T.scene = scene; T.bounds = { cx, cz, span, ytop };
  if (first || T.recenter) { T.center.set(cx, Math.min(ytop, 3) * .35, cz); T.orb.r = span * 1.15 + 4; T.recenter = false; }
  if (T.mode === 'walk' && T.walk) T.walk.y = cur.elev / 100 + 1.62;
  highlight(ctx.sel); T.dirty = true; kick();
  return { errors, ms: Math.round(performance.now() - t0) };
}
function tag(o, sel) { o.userData.sel = sel; return o; }
function addMesh(parent, geo, mat, x, y, z, sel) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (sel) m.userData.sel = sel; parent.add(m); return m; }

function buildFloors(P, lv, root, base, holes, pad, lightRooms, isGround, cutH) {
  const okHoles = r => holes.filter(h => h.every(p => TP.inPoly(p[0], p[1], r.pts)));
  const showCeil = P.env.ceil === 'on' || (P.env.ceil === 'auto' && T.mode === 'walk');
  for (const r of lv.rooms) {
    if (r.pts.length < 3) continue; r.pts.forEach(p => pad(p[0] / 100, p[1] / 100)); const ext = isExt(r); const hs = ext ? [] : okHoles(r); const sel = { type: 'room', id: r.id, lv: lv.id };
    let fg = new THREE.ShapeGeometry(shapeFrom(r.pts, hs)); if (ext && T.gh) fg = drapeGeo(fg, T.gh, 1.2); const me = new THREE.Mesh(fg, floorMat(r.mat)); me.rotation.x = Math.PI / 2; me.position.y = base + (ext ? (r.mat === 'water' ? .012 : .006) : .02); me.receiveShadow = true; tag(me, sel); root.add(me);
    if (!ext) {
      const slab = lv.slab || 20; const geo = new THREE.ExtrudeGeometry(shapeFrom(r.pts, hs), { depth: (isGround ? 15 : slab) / 100, bevelEnabled: false }); const sm = new THREE.Mesh(geo, M3('#B8B5AF', { rough: .95 })); sm.rotation.x = Math.PI / 2; sm.position.y = base + .019; sm.receiveShadow = true; sm.castShadow = !isGround; tag(sm, sel); root.add(sm);
      const c = centroid(r.pts); lightRooms.push({ x: c[0] / 100, y: base + lv.h / 100 - .3, z: c[1] / 100, a: polyArea(r.pts), pts: r.pts });
      if (showCeil && cutH === Infinity) { const cm = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(r.pts, hs)), M3('#FAFAF7', { rough: .95, ds: true })); cm.rotation.x = Math.PI / 2; cm.position.y = base + lv.h / 100 - .005; tag(cm, sel); root.add(cm); }
    }
  }
}
function buildWalls(P, lv, root, base0, H, cutH, pad) {
  const frameDefault = P.frame || '#F4F4F2';
  for (const w of lv.walls) {
    const g = wg(w), len = g.len / 100, t = w.t / 100, ang = -Math.atan2(g.uy, g.ux); pad(w.x1 / 100, w.y1 / 100); pad(w.x2 / 100, w.y2 / 100);
    const sel = { type: 'wall', id: w.id, lv: lv.id }; let kh = { wall: H, low: 1.0, fence: 1.2, hedge: 1.6, retain: (w.h || 120) / 100 }[w.kind] || H; if (w.kind === 'wall') kh = Math.min(kh, cutH);
    let base = base0; if (w.kind !== 'wall' && T.gh) { const h1 = T.gh(w.x1 / 100, w.y1 / 100), h2 = T.gh(w.x2 / 100, w.y2 / 100); base += Math.min(h1, h2); if (w.kind !== 'hedge' && w.kind !== 'fence') kh += Math.abs(h1 - h2); }
    let mats;
    if (w.kind === 'wall') { const sd = wallSides(lv, w); const fac = facadeMat(w.ext || P.facade), pin = paintMat(w.c); const plus = sd.extSign === 1 || (!sd.pos && !sd.neg) ? fac : pin, minus = sd.extSign === -1 || (!sd.pos && !sd.neg) ? fac : pin; const top = M3('#CFCAC1', { rough: .95 }); mats = [top, top, top, top, plus, minus]; }
    else { const m = { low: texMat('stone', '#B9B4AA', 1.4, { rough: .95, wx: 1 }), retain: texMat('concrete', '#A9A8A3', 2.4, { rough: .9, wx: 1 }), fence: M3('#8A6A4A', { rough: .8, wx: 1 }), hedge: texMat('grass', '#4E7F3C', 1, { rough: 1, wx: 1 }) }[w.kind]; mats = m; }
    const piece = (s0, s1, y0, y1, tt) => { if (s1 - s0 < .001 || y1 - y0 < .001) return; const thick = tt || t; const geo = new THREE.BoxGeometry(s1 - s0, y1 - y0, thick); boxUV(geo, s1 - s0, y1 - y0, thick, s0); const mid = (s0 + s1) / 2; const me = new THREE.Mesh(geo, mats); me.position.set(w.x1 / 100 + g.ux * mid, base + (y0 + y1) / 2, w.y1 / 100 + g.uy * mid); me.rotation.y = ang; me.castShadow = true; me.receiveShadow = true; tag(me, sel); root.add(me); };
    const ops = lv.open.filter(o => o.wall === w.id).sort((a, b) => a.pos - b.pos);
    if (w.kind === 'fence') { const n = Math.max(1, Math.round(len / 2)); for (let i = 0; i <= n; i++) { const tt = len * i / n; addMesh(root, new THREE.BoxGeometry(.1, 1.3, .1), mats, w.x1 / 100 + g.ux * tt, base + .65, w.y1 / 100 + g.uy * tt, sel); }
      let cur = 0; const run = (a, b) => { piece(a, b, .95, 1.0, .04); piece(a, b, .25, .3, .04); for (let x = a + .06; x < b - .02; x += .11) piece(x, Math.min(b, x + .07), .1, 1.15, .02); };
      for (const o of ops) { const a = (o.pos - o.w / 2) / 100, b = (o.pos + o.w / 2) / 100; run(cur, a); opening3D(P, root, o, w, g, base, kh, ang, sel, frameDefault); cur = b; } run(cur, len); continue; }
    if (w.kind === 'hedge') { const hg = hedge3D(len, kh, Math.max(t, .45), w.id); hg.position.set((w.x1 + w.x2) / 200, base, (w.y1 + w.y2) / 200); hg.rotation.y = ang; tag(hg, sel); root.add(hg); continue; }
    if (w.kind === 'retain') { piece(-t / 2, len + t / 2, -1.2, kh); continue; }
    const ext = t / 2; let cur = -ext;
    for (const o of ops) {
      const a = (o.pos - o.w / 2) / 100, b = (o.pos + o.w / 2) / 100; piece(cur, a, 0, kh);
      const sill = isWindow(o.kind) ? o.sill / 100 : 0, top = Math.min(kh, sill + o.h / 100);
      if (sill > 0) piece(a, b, 0, Math.min(sill, kh)); if (top < kh) piece(a, b, top, kh);
      if (kh > sill + .05) opening3D(P, root, o, w, g, base, kh, ang, sel, frameDefault);
      if (w.kind === 'wall' && kh > sill + .3) { const sd = wallSides(lv, w), lf = (OPDEF[o.kind] || {}).leaf; if (sd.extSign && (lf === 'glass' || lf === 'fixed' || lf === 'bay' || lf === 'french')) { const hh = (top - sill) / 2, hw = o.w / 200 - .05; T.rtPortals.push({ c: [(w.x1 + g.ux * o.pos) / 100, base + sill + hh, (w.y1 + g.uy * o.pos) / 100], u: [g.ux * hw, 0, g.uy * hw], v: [0, hh - .05, 0], n: [g.nx * sd.extSign, 0, g.ny * sd.extSign] }); } }
      cur = b;
    }
    piece(cur, len + ext, 0, kh);
  }
}
function opening3D(P, root, op, w, g, base, kh, ang, wsel, frameDefault) {
  const d = OPDEF[op.kind] || OPDEF.door, t = w.t / 100, hw = op.w / 200, cx = (w.x1 + g.ux * op.pos) / 100, cz = (w.y1 + g.uy * op.pos) / 100, sd = op.side || 1, hg = op.hinge || 1, sel = { type: 'open', id: op.id, lv: wsel.lv };
  const at = (a, b) => [cx + g.ux * a + g.nx * b, cz + g.uy * a + g.ny * b];
  const box = (len, h, dep, a, b, y, mt, rot) => { const me = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.005, len), Math.max(.005, h), Math.max(.005, dep)), mt); const p = at(a, b); me.position.set(p[0], base + y, p[1]); me.rotation.y = rot == null ? ang : rot; me.castShadow = true; me.receiveShadow = true; tag(me, sel); root.add(me); return me; };
  const frame = M3(op.frame || frameDefault, { rough: .45, env: .8 }), wood = texMat('planks', '#B58A5E', 1.2, { rough: .6 }), glass = M3('#BFDDEB', { op: .25, rough: .03, metal: .1, env: 1.6 }), fw = .055;
  const sill = isWindow(op.kind) ? op.sill / 100 : 0, top = Math.min(kh, sill + op.h / 100), h = top - sill; const leafDir = (hx, len, angDeg, mat, th, dz) => { const th0 = angDeg * Math.PI / 180; const dirx = (hx < 0 ? 1 : -1) * Math.cos(th0), dirn = sd * Math.sin(th0); const pc = [hx + dirx * len / 2, sd * (t / 2) * (angDeg > 2 ? 1 : 0) + dirn * len / 2 + (dz || 0)]; const v = [g.ux * dirx + g.nx * dirn, g.uy * dirx + g.ny * dirn]; return box(len, th, .045, pc[0], pc[1], sill + th / 2, mat, -Math.atan2(v[1], v[0])); };
  switch (d.leaf) {
    case 'glass': case 'fixed': { box(op.w / 100, fw, t + .04, 0, 0, sill + fw / 2, M3('#E5E2DC', { rough: .6 })); box(op.w / 100, fw, t * .5, 0, 0, top - fw / 2, frame); for (const s of [-1, 1]) box(fw, h, t * .5, s * (hw - fw / 2), 0, sill + h / 2, frame); box(op.w / 100 - 2 * fw, h - 2 * fw, .012, 0, 0, sill + h / 2, glass); if (d.leaf === 'glass' && op.w > 90) box(.05, h, t * .5, 0, 0, sill + h / 2, frame); break; }
    case 'bay': case 'french': { box(op.w / 100, fw, t * .5, 0, 0, top - fw / 2, frame); for (const s of [-1, 1]) box(fw, h, t * .5, s * (hw - fw / 2), 0, h / 2, frame); const n = d.leaf === 'bay' ? 2 : 2; for (let i = 0; i < n; i++) { const pw = (op.w / 100 - 2 * fw) / n; const a = -hw + fw + pw * (i + .5) + (d.leaf === 'bay' && !op.closed ? (i ? -pw * .45 : 0) : 0); const off = d.leaf === 'bay' ? (i ? .03 : -.03) : 0; const lh = h - fw; for (const s2 of [-1, 1]) box(.05, lh, .05, a + s2 * (pw / 2 - .025), off, lh / 2, frame); box(pw, .05, .05, a, off, lh - .025, frame); box(pw, .06, .05, a, off, .03, frame); box(pw - .1, lh - .11, .015, a, off, lh / 2, glass); } break; }
    case 'swing': case 'double': case 'slide': {
      const H2 = Math.min(top, kh - .02); for (const s of [-1, 1]) box(fw, H2, t + .02, s * (hw - fw / 2), 0, H2 / 2, frame); box(op.w / 100, fw, t + .02, 0, 0, H2 - fw / 2, frame);
      const lw = op.w / 100 - 2 * fw, leafMat = op.kind === 'entry' ? M3(op.frame || frameDefault, { rough: .5 }) : wood; const th = H2 - fw - .01; const angDeg = op.closed ? 0 : 82;
      if (d.leaf === 'swing') { const hx = -hg * (hw - fw); const th0 = angDeg * Math.PI / 180; const dirx = hg * Math.cos(th0), dirn = sd * Math.sin(th0); const pc = [hx + dirx * lw / 2, (angDeg ? sd * t / 2 : 0) + dirn * lw / 2]; const v = [g.ux * dirx + g.nx * dirn, g.uy * dirx + g.ny * dirn]; box(lw, th, .045, pc[0], pc[1], th / 2, leafMat, -Math.atan2(v[1], v[0])); }
      else if (d.leaf === 'double') { for (const s of [-1, 1]) { const hx = s * (hw - fw), l2 = lw / 2; const th0 = angDeg * Math.PI / 180; const dirx = -s * Math.cos(th0), dirn = sd * Math.sin(th0); const pc = [hx + dirx * l2 / 2, (angDeg ? sd * t / 2 : 0) + dirn * l2 / 2]; const v = [g.ux * dirx + g.nx * dirn, g.uy * dirx + g.ny * dirn]; box(l2, th, .045, pc[0], pc[1], th / 2, leafMat, -Math.atan2(v[1], v[0])); } }
      else { const off = op.closed ? 0 : -hg * lw * .85; box(lw, th, .04, off, sd * (t / 2 + .03), th / 2, leafMat); }
      break; }
    case 'garage': { const H2 = Math.min(top, kh - .02); if (op.closed) { box(op.w / 100, H2, .05, 0, 0, H2 / 2, M3('#D7D9DB', { rough: .5 })); for (let y = .4; y < H2; y += .45) box(op.w / 100, .015, .06, 0, 0, y, M3('#B9BCBF')); } else box(op.w / 100, .05, .6, 0, sd * .3, H2 - .05, M3('#D7D9DB', { rough: .5 })); break; }
    case 'gate': { const wd = texMat('vboards', '#8A6A4A', 1, { rough: .7 }); const angDeg = op.closed ? 0 : 70; for (const s of [-1, 1]) { const hx = s * hw, l2 = hw; const th0 = angDeg * Math.PI / 180; const dirx = -s * Math.cos(th0), dirn = sd * Math.sin(th0); const pc = [hx + dirx * l2 / 2, dirn * l2 / 2]; const v = [g.ux * dirx + g.nx * dirn, g.uy * dirx + g.ny * dirn]; box(l2, 1.3, .04, pc[0], pc[1], .7, wd, -Math.atan2(v[1], v[0])); } break; }
    default: break;
  }
  void leafDir;
}

/* ---------- mobilier ---------- */
function furn3D(f, ctx) {
  const g = new THREE.Group(), W = f.w, D = f.d, H = f.h || 1, c = f.c || '#999';
  const add = (geo, mt, x, y, z) => { const me = new THREE.Mesh(geo, mt); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
  const B = (w, h, d, x, y, z, mt) => add(new THREE.BoxGeometry(Math.max(.1, w), Math.max(.1, h), Math.max(.1, d)), mt, x, y, z);
  const Cy = (rt, rb, h, x, y, z, mt, seg) => add(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mt, x, y, z);
  const Sp = (r, x, y, z, mt) => add(new THREE.SphereGeometry(r, 18, 14), mt, x, y, z);
  const main = M3(c), fab = M3(c, { rough: .95, env: .3 }), light = M3(shade(c, .25), { rough: .95, env: .3 }), wood = texMat('planks', '#C9A27A', 1, { rough: .6 }), white = M3('#F4F4F2', { rough: .3, env: .8 }), dark = M3('#2A2D31', { rough: .5 }), metal = M3('#A3A8AE', { metal: .75, rough: .28, env: 1 }), glass = M3('#BFDDEB', { op: .3, rough: .05, env: 1.5 }), lampM = (!ctx || ctx.lit !== false) ? M3('#F1E9D8', { emis: (ctx && ctx.lc) || '#FFE0A8', ds: true }) : M3('#F1E9D8', { ds: true, rough: .6 });
  const legs = (w, d, h, ins, mt, s) => { s = s || 4; for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(s, h, s, sx * (w / 2 - ins), h / 2, sz * (d / 2 - ins), mt); };
  const chair = (x, z, rot, col, cw, cd, ch) => { cw = cw || 44; cd = cd || 46; ch = ch || 88; const sg = new THREE.Group(); const m = M3(col); const sb = (w, h, d, px, py, pz) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(px, py, pz); me.castShadow = true; sg.add(me); }; sb(cw, 4, cd, 0, 45, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) sb(3, 43, 3, sx * (cw / 2 - 3), 21.5, sz * (cd / 2 - 3)); sb(cw, ch - 47, 3, 0, 47 + (ch - 47) / 2, -cd / 2 + 1.5); sg.position.set(x, 0, z); sg.rotation.y = rot; g.add(sg); };
  const chairsAround = col => { const n = Math.max(1, Math.round(W / 60)); for (let i = 0; i < n; i++) { const x = -W / 2 + W * (i + .5) / n; chair(x, -D / 2 - 14, 0, col); chair(x, D / 2 + 14, Math.PI, col); } if (W <= 200) { chair(-W / 2 - 14, 0, Math.PI / 2, col); chair(W / 2 + 14, 0, -Math.PI / 2, col); } };
  const dd = FURN[f.type] || {};
  if (dd.veg) { veg(g, dd.veg, c, W, H, 0, f.id, f.pal); g.scale.setScalar(.01); return g; }
  if (dd.rock) { rock3D(g, W, H, D, c, f.id); g.scale.setScalar(.01); return g; }
  if (NEW_FIXTURES.includes(f.type)) { fixture3D(g, f, dd, ctx, { B, Cy, Sp }); g.scale.setScalar(.01); return g; }
  switch (f.type) {
    case 'sofa': case 'arm': { const aw = f.type === 'arm' ? W * .17 : W * .09; B(W, H * .42, D, 0, H * .21, 0, fab); B(W, H, D * .24, 0, H / 2, -D / 2 + D * .12, fab); for (const s of [-1, 1]) B(aw, H * .66, D, s * (W / 2 - aw / 2), H * .33, 0, fab); const n = f.type === 'arm' ? 1 : 3, iw = (W - 2 * aw) / n; for (let i = 0; i < n; i++) { B(iw - 3, 12, D * .7, -W / 2 + aw + iw * (i + .5), H * .42 + 6, D * .1, light); B(iw - 6, H * .38, 12, -W / 2 + aw + iw * (i + .5), H * .42 + H * .2, -D / 2 + D * .24 + 6, light); } break; }
    case 'sofaL': { const s = 92; B(W, H * .42, s, 0, H * .21, -D / 2 + s / 2, fab); B(s, H * .42, D - s, W / 2 - s / 2, H * .21, -D / 2 + s + (D - s) / 2, fab); B(W, H, 22, 0, H / 2, -D / 2 + 11, fab); B(22, H, D, W / 2 - 11, H / 2, 0, fab); B(18, H * .66, s, -W / 2 + 9, H * .33, -D / 2 + s / 2, fab); B(W - 40 - s, 12, s - 30, -W / 2 + 18 + (W - 40 - s) / 2, H * .42 + 6, -D / 2 + 26, light); B(s - 28, 12, D - s - 10, W / 2 - s / 2 - 11, H * .42 + 6, -D / 2 + s + (D - s) / 2 - 4, light); break; }
    case 'coffee': B(W, 5, D, 0, H - 2.5, 0, main); B(W - 12, 2, D - 12, 0, 12, 0, main); legs(W, D, H - 5, 4, main); break;
    case 'tv': B(W, H * .8, D, 0, H * .4, 0, main); B(W * .7, W * .7 * .56, 4, 0, H * .8 + 10 + W * .7 * .28, -D / 2 + 10, M3('#111318', { rough: .15, env: 1.2 })); B(24, 10, 16, 0, H * .8 + 5, -D / 2 + 12, dark); break;
    case 'book': { for (const s of [-1, 1]) B(2.5, H, D, s * (W / 2 - 1.25), H / 2, 0, main); B(W, H, 1, 0, H / 2, -D / 2 + .5, main); const n = 5, R = rng(String(f.id).length * 31 + W); const cols = ['#B66A4C', '#5C7590', '#C9A043', '#3E4247', '#8FA58A', '#E7DCC8']; for (let i = 0; i <= n; i++) { const y = i * (H - 2) / n + 1; B(W - 5, 2.5, D - 1, 0, y, .5, main); if (i < n) { let x = -W / 2 + 5; while (x < W / 2 - 10) { const bw = 3 + R() * 4, bh = (H / n) * (.55 + R() * .3); B(bw, bh, D * .75, x + bw / 2, y + 1.25 + bh / 2, 0, M3(cols[Math.floor(R() * cols.length)])); x += bw + .4; if (R() < .12) x += 8; } } } break; }
    case 'rug': B(W, 1, D, 0, .5, 0, M3(c, { rough: 1, env: .2 })); break;
    case 'lamp': Cy(15, 15, 3, 0, 1.5, 0, dark); Cy(1.2, 1.2, H - 30, 0, (H - 30) / 2, 0, dark); Cy(14, 20, 28, 0, H - 14, 0, lampM); break;
    case 'pendant': { const ceil = (ctx && ctx.lvH) || 250; const z = f.z || 0; Cy(.4, .4, Math.max(1, ceil - z - H), 0, H + (ceil - z - H) / 2, 0, dark); Cy(W * .12, W / 2, H, 0, H / 2, 0, M3(c, { ds: true, rough: .5 })); Sp(6, 0, 4, 0, lampM); break; }
    case 'tlamp': Cy(6, 9, 4, 0, 2, 0, dark); Cy(1, 1, H * .5, 0, H * .27, 0, dark); Cy(W * .35, W / 2, H * .45, 0, H * .75, 0, lampM); break;
    case 'sconce': B(W * .5, H * .3, 3, 0, H * .5, -D / 2 + 1.5, metal); Cy(W / 2, W * .35, H * .6, 0, H * .5, 0, lampM); break;
    case 'plant': case 'plant2': Cy(W * .3, W * .24, H * .28, 0, H * .14, 0, M3('#B66A4C', { rough: .7 })); Cy(W * .27, W * .27, 1, 0, H * .27, 0, M3('#3B2E22', { rough: 1 })); veg(g, f.type === 'plant2' ? 'tree' : 'bush', c, W * 1.15, H * .78, H * .24, f.id); break;
    case 'bush': veg(g, 'bush', c, W, H, 0, f.id); break;
    case 'frame': B(W, H, D, 0, H / 2, 0, M3('#2A2D31')); B(W - 8, H - 8, 1, 0, H / 2, D / 2, M3(c, { rough: .7 })); break;
    case 'mirror': B(W, H, D, 0, H / 2, 0, M3('#C9C3B8')); B(W - 6, H - 6, 1, 0, H / 2, D / 2, M3('#DDE6EB', { metal: 1, rough: .04, env: 1.6 })); break;
    case 'vase': Cy(W * .3, W * .5, H * .7, 0, H * .35, 0, M3(c, { rough: .3 })); Cy(W * .2, W * .3, H * .3, 0, H * .85, 0, M3(c, { rough: .3 })); break;
    case 'table6': case 'table4': case 'gtable': chairsAround(f.type === 'gtable' ? '#3E4247' : f.type === 'table4' ? '#C9A27A' : '#3E4247'); B(W, 4, D, 0, H - 2, 0, main); legs(W, D, H - 4, 6, main, 6); break;
    case 'tround': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, r = W / 2 + 16; chair(Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2, '#C9A27A'); } Cy(W / 2, W / 2, 4, 0, H - 2, 0, main, 40); Cy(6, 6, H - 4, 0, (H - 4) / 2, 0, main); Cy(26, 26, 3, 0, 1.5, 0, main, 32); break;
    case 'chair': chair(0, 0, 0, c, W, D, H); break;
    case 'buffet': B(W, H - 14, D, 0, 14 + (H - 14) / 2, 0, main); legs(W, D, 14, 6, dark, 3); break;
    case 'kitchen': { B(W, H - 14, D - 4, 0, 10 + (H - 14) / 2, 2, main); B(W - 4, 10, D - 10, 0, 5, -1, dark); B(W, 4, D, 0, H - 2, 0, M3('#3B3B3B', { rough: .35, env: .8 })); B(56, 1, 40, -W / 2 + 100, H + .2, 0, metal); B(58, 1, 50, W / 2 - 60, H + .2, 0, M3('#111', { rough: .15 })); for (let x = -W / 2 + 60; x < W / 2; x += 60) B(.6, H - 16, .6, x, 10 + (H - 14) / 2, D / 2 + .4, dark); B(W, 70, 35, 0, 185, -D / 2 + 17.5, main); Cy(1.2, 1.2, 26, -W / 2 + 100, H + 13, -D / 2 + 10, metal); B(60, 6, 45, W / 2 - 60, 148, -D / 2 + 22, metal); break; }
    case 'kitchenL': { const t = 62; B(W, H - 14, t, 0, 10 + (H - 14) / 2, -D / 2 + t / 2, main); B(t, H - 14, D - t, -W / 2 + t / 2, 10 + (H - 14) / 2, -D / 2 + t + (D - t) / 2, main); const top = M3('#3B3B3B', { rough: .35 }); B(W, 4, t, 0, H - 2, -D / 2 + t / 2, top); B(t, 4, D - t, -W / 2 + t / 2, H - 2, -D / 2 + t + (D - t) / 2, top); B(58, 1, 50, W / 2 - 50, H + .2, -D / 2 + t / 2, M3('#111', { rough: .15 })); B(56, 1, 40, -W / 2 + 150, H + .2, -D / 2 + t / 2, metal); break; }
    case 'island': B(W - 20, H - 4, D, 0, (H - 4) / 2, 0, main); B(W, 4, D + 22, 0, H - 2, 11, M3('#E8E4DC', { rough: .3 })); break;
    case 'fridge': case 'oven': case 'dishw': case 'washer': case 'dryer': B(W, H, D, 0, H / 2, 0, main); if (f.type === 'washer' || f.type === 'dryer') { const m = Cy(18, 18, 2, 0, H * .47, D / 2 + 1, M3('#9DB8C6', { op: .7, rough: .1 })); m.rotation.x = Math.PI / 2; } else B(2, Math.min(40, H * .4), 3, W / 2 - 6, H * .62, D / 2 + 1.5, metal); if (f.type === 'oven') { B(W - 12, 38, 1, 0, 108, D / 2 + .5, dark); B(W - 12, 30, 1, 0, 150, D / 2 + .5, dark); } break;
    case 'stool': Cy(18, 18, 4, 0, H - 2, 0, main); Cy(2, 2, H - 4, 0, (H - 4) / 2, 0, metal); Cy(18, 18, 2, 0, 1, 0, metal); break;
    case 'bed2': case 'bed1': { B(W, 28, D, 0, 14, 0, wood); B(W - 6, 22, D - 14, 0, 39, 4, white); B(W - 2, 7, D * .62, 0, 51, D / 2 - D * .31, M3(c, { rough: .95, env: .3 })); const n = W > 120 ? 2 : 1; for (let i = 0; i < n; i++) B(W / n - 16, 12, 38, -W / 2 + W / n * (i + .5), 56, -D / 2 + 30, white); B(W + 6, H, 8, 0, H / 2, -D / 2 - 2, M3(shade(c, -.25), { rough: .9 })); break; }
    case 'night': B(W, H, D, 0, H / 2, 0, main); Cy(6, 8, 2, 0, H + 1, 0, dark); Cy(1, 1, 24, 0, H + 13, 0, dark); Cy(8, 11, 14, 0, H + 28, 0, lampM); break;
    case 'ward': B(W, H, D, 0, H / 2, 0, main); B(.8, H - 6, .8, 0, H / 2, D / 2 + .4, dark); for (const s of [-1, 1]) B(2, 28, 2, s * 4, H / 2, D / 2 + 1.5, metal); break;
    case 'dresser': B(W, H - 10, D, 0, 10 + (H - 10) / 2, 0, main); legs(W, D, 10, 5, dark, 3); for (let i = 0; i < 3; i++) B(14, 1.5, 1.5, 0, 10 + (H - 10) * (i + .5) / 3, D / 2 + 1, metal); break;
    case 'bath': B(W, H, D, 0, H / 2, 0, M3(c, { rough: .25, env: .9 })); B(W - 14, .6, D - 14, 0, H + .3, 0, M3('#D6E5EC', { rough: .1, env: 1.2 })); Cy(1.5, 1.5, 12, W / 2 - 14, H + 6, -D / 2 + 8, metal); break;
    case 'shower': B(W, 4, D, 0, 2, 0, M3('#E8E8E6', { rough: .35 })); B(1, H - 4, D * .75, W / 2 - .5, H / 2 + 2, -D * .125, glass); Cy(1, 1, H - 20, -W / 2 + 12, (H - 20) / 2 + 4, -D / 2 + 4, metal); Cy(11, 11, 1.5, -W / 2 + 12, H - 14, -D / 2 + 16, metal); break;
    case 'wc': B(W, 60, 10, 0, 50, -D / 2 + 5, white); { const m = Cy(W / 2 - 2, W / 2 - 7, 32, 0, 42, 4, white); m.scale.z = (D - 10) / W; } B(W - 6, 2, D - 14, 0, 59, 4, white); break;
    case 'vanity': case 'vanity2': { B(W, H - 28, D, 0, 28 + (H - 28) / 2, 0, main); B(W, 3, D, 0, H, 0, white); const n = f.type === 'vanity2' ? 2 : 1; for (let i = 0; i < n; i++) { const x = -W / 2 + W / n * (i + .5); Cy(16, 12, 10, x, H + 6.5, 2, white); Cy(1.2, 1.2, 16, x, H + 8, -D / 2 + 6, metal); } B(W * .92, 70, 2, 0, H + 70, -D / 2 + 1, M3('#CFE3EC', { metal: 1, rough: .05, env: 1.5 })); break; }
    case 'desk': B(W, 3, D, 0, H - 1.5, 0, main); for (const s of [-1, 1]) B(3, H - 3, D, s * (W / 2 - 1.5), (H - 3) / 2, 0, main); B(56, 33, 2, 0, H + 26, -D / 2 + 18, M3('#15171B', { rough: .2 })); B(5, 10, 5, 0, H + 5, -D / 2 + 18, dark); break;
    case 'ochair': Cy(30, 30, 3, 0, 7, 0, dark, 5); Cy(2.5, 2.5, 36, 0, 26, 0, metal); B(50, 8, 48, 0, 48, 0, main); B(46, 55, 5, 0, 86, -22, main); break;
    case 'shelf': for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(2.5, H, 2.5, sx * (W / 2 - 1.25), H / 2, sz * (D / 2 - 1.25), main); for (let i = 0; i < 5; i++) B(W, 2, D, 0, 4 + i * (H - 6) / 4, 0, wood); break;
    case 'lounger': { B(W, 6, D * .68, 0, 30, D * .16, main); const bk = B(W, 6, D * .34, 0, 44, -D / 2 + D * .15, main); bk.rotation.x = .55; legs(W, D * .9, 30, 5, M3('#7A5536'), 4); break; }
    case 'parasol': Cy(26, 26, 6, 0, 3, 0, dark); Cy(2, 2, H, 0, H / 2, 0, M3('#E8E2D6')); add(new THREE.ConeGeometry(W / 2, 45, 8, 1, true), M3(c, { ds: true, rough: .9 }), 0, H - 22, 0); break;
    case 'bench': B(W, 5, D * .7, 0, 45, D * .1, main); B(W, 30, 4, 0, 65, -D / 2 + 4, main); legs(W, D * .7, 43, 6, dark, 5); break;
    case 'planter': B(W, H, D, 0, H / 2, 0, texMat('planks', c, 1, { rough: .8 })); B(W - 8, 2, D - 8, 0, H, 0, M3('#4A3626', { rough: 1 })); for (let i = 0; i < Math.max(1, Math.round(W / 45)); i++) { const sg = new THREE.Group(); veg(sg, 'bush', '#5C8F45', Math.min(48, D + 14), 34, 0, f.id + i); sg.position.set(-W / 2 + 22 + i * (W - 44) / Math.max(1, Math.round(W / 45) - 1 || 1), H - 2, 0); g.add(sg); } break;
    case 'shed': { B(W, H * .72, D, 0, H * .36, 0, texMat('vboards', c, 1)); const rh = H * .28; for (const s of [-1, 1]) { const p = B(W + 20, 4, D / 2 / Math.cos(.5) + 15, 0, H * .72 + rh / 2, s * D / 4, M3('#3E4247')); p.rotation.x = s * .5; } B(70, 180, 2, 0, 90, D / 2 + 1, M3(shade(c, -.2))); break; }
    case 'tree': veg(g, 'tree', c, W, H, 0, f.id); break;
    case 'tree2': veg(g, 'conifer', c, W, H, 0, f.id); break;
    case 'car': case 'suv': car3D(g, f, W, D, H, c, B, Cy, dark); break;
    case 'bike': for (const z of [-D / 2 + 33, D / 2 - 33]) { const wh = add(new THREE.TorusGeometry(30, 2, 8, 24), dark, 0, 33, z); wh.rotation.y = Math.PI / 2; } B(3, 3, D - 70, 0, 55, 0, M3(c)); B(40, 3, 3, 0, 95, -D / 2 + 45, dark); break;
    case 'pool': case 'poolS': { const cp = texMat('stone', '#E3DACB', 1, { rough: .9 }); B(W, 7, 30, 0, 3.5, -D / 2 + 15, cp); B(W, 7, 30, 0, 3.5, D / 2 - 15, cp); B(30, 7, D - 60, -W / 2 + 15, 3.5, 0, cp); B(30, 7, D - 60, W / 2 - 15, 3.5, 0, cp); const wm = ctx && ctx.poolGlow ? floorMat('water', { emis: '#4FC3F0', emisI: .5 }) : floorMat('water'); const water = new THREE.Mesh(new THREE.PlaneGeometry((W - 60) / 100, (D - 60) / 100), wm); water.rotation.x = -Math.PI / 2; water.scale.setScalar(100); water.position.y = 3; water.receiveShadow = true; g.add(water); break; }
    case 'spa': B(W, H, D, 0, H / 2, 0, texMat('planks', c, 1, { rough: .7 })); { const wm = floorMat('water'); const water = new THREE.Mesh(new THREE.PlaneGeometry((W - 36) / 100, (D - 36) / 100), wm); water.rotation.x = -Math.PI / 2; water.scale.setScalar(100); water.position.y = H + .5; g.add(water); } break;
    case 'fireplace': { B(W, H, D, 0, H / 2, 0, texMat('stone', c, 1, { rough: .9 })); B(W * .55 * 2 * .9, H * .55, 4, 0, H * .35, D / 2 - 1, M3('#141414', { rough: .9 })); B(W + 16, 6, D + 8, 0, H + 3, 4, M3('#7A5536')); Sp(8, -8, 14, D / 2 - 14, M3('#FF8A3D', { emis: '#FF6A1A' })); break; }
    case 'balcony': { B(W, 15, D, 0, -7.5, 0, M3('#C9C6C0', { rough: .9 })); const gl = M3('#BFDDEB', { op: .28, rough: .05, env: 1.5 }); B(W, H, 1.5, 0, H / 2, D / 2 - 1, gl); for (const s of [-1, 1]) B(1.5, H, D, s * (W / 2 - 1), H / 2, 0, gl); B(W, 4, 5, 0, H, D / 2 - 1, metal); for (const s of [-1, 1]) B(5, 4, D, s * (W / 2 - 1), H, 0, metal); break; }
    case 'column': B(W, (ctx && ctx.lvH) || 250, D, 0, ((ctx && ctx.lvH) || 250) / 2, 0, M3(c, { rough: .9 })); break;
    case 'stairs': case 'stairsL': case 'spiral': stairs3D(g, f, ctx, B, Cy, M3(c, { rough: .55 }), metal); break;
    case 'model': { const mdl = ctx && ctx.model; if (mdl && mdl.object) { const o = mdl.object.clone(true); const s = mdl.size; o.scale.set(W / (s.x * 100 || 1) * 100, H / (s.y * 100 || 1) * 100, D / (s.z * 100 || 1) * 100); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); g.add(o); } else { B(W, H, D, 0, H / 2, 0, M3('#9AA3AE', { op: .55 })); } break; }
    default: B(W, H, D, 0, H / 2, 0, main);
  }
  g.scale.setScalar(.01); return g;
}
function stairs3D(g, f, ctx, B, Cy, mat, metal) {
  const P = ctx.P, lv = ctx.lv; const info = stairInfo(P, lv, f); const n = info.n, r = info.r, W = f.w, D = f.d;
  if (f.type === 'spiral') { const R = W / 2, tot = Math.PI * 2 * .85; Cy(5, 5, info.R, 0, info.R / 2, 0, metal); for (let i = 1; i < n; i++) { const a = -Math.PI / 2 + tot * i / n, rm = (R + 8) / 2; const chord = 2 * Math.PI * R * .85 / n * 1.15; const b = B(R - 8, 4, chord, Math.cos(a) * rm, i * r - 2, Math.sin(a) * rm, mat); b.rotation.y = -a; } for (let i = 1; i < n; i++) { const a = -Math.PI / 2 + tot * i / n; Cy(1, 1, 90, Math.cos(a) * (R - 3), i * r + 45, Math.sin(a) * (R - 3), metal, 6); } return; }
  if (f.type === 'stairsL') { const sw = Math.min(f.sw || 90, W, D), L1 = D - sw, L2 = W - sw, n1 = Math.max(2, Math.round(n * L1 / (L1 + L2))), n2_ = Math.max(2, n - n1), g1 = L1 / n1, g2 = L2 / n2_;
    for (let i = 1; i < n1; i++) B(sw, 4, g1 + 3, -W / 2 + sw / 2, i * r - 2, D / 2 - (i + .5) * g1, mat);
    B(sw, Math.max(4, n1 * r), sw, -W / 2 + sw / 2, n1 * r / 2, -D / 2 + sw / 2, mat);
    for (let i = 1; i < n2_; i++) B(g2 + 3, 4, sw, -W / 2 + sw + (i - .5) * g2, (n1 + i) * r - 2, -D / 2 + sw / 2, mat);
    return; }
  const gg = D / n; for (let i = 1; i < n; i++) B(W, 4, gg + 3, 0, i * r - 2, D / 2 - (i + .5) * gg, mat);
  const ang = Math.atan2(info.R, D), L = Math.hypot(D, info.R); for (const s of [-1, 1]) { const st = B(5, 25, L, s * (W / 2 - 2.5), info.R / 2 - 6, 0, mat); st.rotation.x = ang; }
  const rail = B(4, 5, L, W / 2 - 2, info.R / 2 + 90, 0, metal); rail.rotation.x = ang; for (let i = 2; i < n; i += 3) Cy(1.2, 1.2, 90, W / 2 - 2, i * r + 45, D / 2 - (i + .5) * gg, metal, 6);
}
function buildFurniture(P, lv, root, base, H, ctx) {
  const poolGlow = lv.furn.some(f => f.type === 'poolLight' && TP.lightOn && TP.lightOn(P, f));
  for (const f of lv.furn) {
    const d = fdesc(f, P); if (!d) continue; let model = null;
    if (f.type === 'model') { const c = T.models[f.model]; if (c && c.object) model = c; else if (!c && ctx.getModel) { T.models[f.model] = { loading: true }; loadModel(f.model, ctx.getModel).then(() => { if (ctx.rebuild) ctx.rebuild(); }).catch(() => { T.models[f.model] = { failed: true }; }); } }
    let lit = false, lc = null, col = null;
    if (d.light) { lit = TP.lightOn ? TP.lightOn(P, f) : T.lightsOn; col = TP.lightColor ? TP.lightColor(P, f) : [3, 2.4, 1.6]; const mx = Math.max(...col) || 1; lc = '#' + new THREE.Color(Math.pow(col[0] / mx, 1 / 2.2), Math.pow(col[1] / mx, 1 / 2.2), Math.pow(col[2] / mx, 1 / 2.2)).getHexString(); }
    const gp = furn3D(f, { P, lv, lvH: lv.h, model, lit, lc, poolGlow }); const ceilFix = ['plafonnier', 'spotPlaf', 'garageLight', 'railSpots'].includes(f.type); const z = d.hang ? (f.z || (ceilFix ? lv.h - (f.h || 10) - 1 : lv.h - 110)) : (f.z || 0);
    const gy = T.gh ? T.gh(f.x / 100, f.y / 100) : 0; gp.position.set(f.x / 100, base + gy + .02 + z / 100, f.y / 100); gp.rotation.y = -(f.r || 0) * Math.PI / 180; tag(gp, { type: 'furn', id: f.id, lv: lv.id }); root.add(gp);
    if (d.light && lit) addLightSources(P, f, d, base + gy, z, col);
  }
}
function buildRoofs(P, lv, root, base, H) {
  for (const rf of lv.roofs) {
    const geo = roofGeom(rf), z0 = base + H, sel = { type: 'roof', id: rf.id, lv: lv.id };
    const W3 = (p) => { const q = rotPt(p[0], p[1], rf.r || 0); return [(rf.x + q[0]) / 100, z0 + p[2] / 100, (rf.y + q[1]) / 100]; };
    const rm = roofMat(rf.mat), edge = M3('#5A5248', { rough: .9 }), fac = facadeMat(P.facade);
    for (const f of geo.faces) { const m = prism(f.map(W3), rf.type === 'flat' ? .25 : .16, rm, edge); tag(m, sel); root.add(m); }
    for (const f of geo.fills) { const m = prism(f.map(W3), .2, fac, fac); tag(m, sel); root.add(m); }
    const gm = M3('#8A9196', { metal: .6, rough: .35 });
    for (const [a, b] of geo.gutters) { const A = W3(a), Bp = W3(b); if (T.eaves) T.eaves.push([A, Bp]); const len = hyp(Bp[0] - A[0], Bp[2] - A[2]); const cy = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, len, 10, 1, false, 0, Math.PI), gm); cy.position.set((A[0] + Bp[0]) / 2, A[1] - .04, (A[2] + Bp[2]) / 2); cy.rotation.z = Math.PI / 2; const grp = new THREE.Group(); grp.position.copy(cy.position); cy.position.set(0, 0, 0); grp.add(cy); grp.rotation.y = -Math.atan2(Bp[2] - A[2], Bp[0] - A[0]); tag(grp, sel); root.add(grp);
      for (const P0 of [A, Bp]) { const h = P0[1] - base; const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, h, 8), gm); pipe.position.set(P0[0], base + h / 2, P0[2]); tag(pipe, sel); root.add(pipe); } }
    for (const [a, b] of geo.parapets) { const A = W3([a[0], a[1], 0]), Bp = W3([b[0], b[1], 0]); const len = hyp(Bp[0] - A[0], Bp[2] - A[2]) + .2; const me = new THREE.Mesh(new THREE.BoxGeometry(len, .55, .2), fac); me.position.set((A[0] + Bp[0]) / 2, z0 + .27, (A[2] + Bp[2]) / 2); me.rotation.y = -Math.atan2(Bp[2] - A[2], Bp[0] - A[0]); me.castShadow = true; tag(me, sel); root.add(me); }
    // fen\u00eatres de toit sur le premier versant
    if (rf.sky > 0 && rf.type !== 'flat' && geo.faces[0]) { const f = geo.faces[0].map(W3).map(p => new THREE.Vector3(...p)); const e1 = f[1].clone().sub(f[0]); const L = e1.length(); e1.normalize(); const up = (f[f.length - 1]).clone().sub(f[0]); const n = new THREE.Vector3().crossVectors(e1, up).normalize(); if (n.y < 0) n.negate(); const e2 = new THREE.Vector3().crossVectors(n, e1).normalize(); if (e2.dot(up) < 0) e2.negate();
      for (let i = 0; i < rf.sky; i++) { const t = (i + .5) / rf.sky; const c = f[0].clone().addScaledVector(e1, L * t).addScaledVector(e2, up.length() * .45).addScaledVector(n, .06); const m = new THREE.Mesh(new THREE.BoxGeometry(.78, .98, .08), [M3('#3A3F45'), M3('#3A3F45'), M3('#3A3F45'), M3('#3A3F45'), M3('#7FA9C4', { rough: .05, metal: .2, env: 1.6 }), M3('#3A3F45')]); const mat = new THREE.Matrix4().makeBasis(e1, e2, n); m.quaternion.setFromRotationMatrix(mat); m.position.copy(c); m.castShadow = true; tag(m, sel); root.add(m); } }
  }
}
function buildChimneys(P, root, shown) {
  for (const lv of shown) for (const f of lv.furn) { if (f.type !== 'fireplace') continue; const back = rotPt(0, -f.d / 2 + 15, f.r || 0); const px = f.x + back[0], py = f.y + back[1];
    let top = lv.elev + lv.h + 60; for (const L of P.levels) for (const rf of L.roofs) { const h = roofHeightAt(rf, px, py); if (h != null) top = Math.max(top, roofBase(L) + h + (rf.type === 'flat' ? 120 : 60)); }
    for (const L of P.levels) if (L.elev > lv.elev) top = Math.max(top, L.elev + L.h + 60);
    const y0 = lv.elev + f.h; const h = (top - y0) / 100; if (h <= 0) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(.45, h, .45), texMat('brick', '#A65A3F', 1, { rough: .9 })); m.position.set(px / 100, y0 / 100 + h / 2, py / 100); m.castShadow = true; tag(m, { type: 'furn', id: f.id, lv: lv.id }); root.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.6, .06, .6), M3('#5A5248')); cap.position.set(px / 100, top / 100 + .03, py / 100); root.add(cap); }
}
function buildFoundations(P, lv, root, base) {
  for (const w of lv.walls) { if (w.kind !== 'wall' || w.t < 15) continue; const g = wg(w); const len = g.len / 100 + .3; const m = new THREE.Mesh(new THREE.BoxGeometry(len, .4, w.t / 100 + .3), M3('#9C9890', { rough: 1 })); m.position.set((w.x1 + w.x2) / 200, base - .2 - .2, (w.y1 + w.y2) / 200); m.rotation.y = -Math.atan2(g.uy, g.ux); root.add(m); }
}
function terrainHeight(P, x, z, plat) {
  const t = P.terrain; if (!t || !t.slope) return 0; const sv = TP.sideVec(P, t.dir || 'sud') || [0, 1]; const cx = (plat.x0 + plat.x1) / 2, cz = (plat.z0 + plat.z1) / 2; const hw = (plat.x1 - plat.x0) / 2, hh = (plat.z1 - plat.z0) / 2;
  const a = (x - cx) * sv[0] + (z - cz) * sv[1], a0 = Math.abs(sv[0]) * hw + Math.abs(sv[1]) * hh, s = t.slope / 100;
  return a > a0 ? -s * (a - a0) : a < -a0 ? s * (-a0 - a) : 0;
}
function buildTerrain(P, scene, b) {
  const plat = { x0: b.x0 - 3, x1: b.x1 + 3, z0: b.z0 - 3, z1: b.z1 + 3 }; const t = P.terrain; const cx = t ? t.x / 100 : (b.x0 + b.x1) / 2, cz = t ? t.y / 100 : (b.z0 + b.z1) / 2;
  const size = 260, seg = t && t.slope ? 90 : 1; const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + cx, z = pos.getZ(i) + cz; pos.setX(i, x); pos.setZ(i, z); pos.setY(i, terrainHeight(P, x, z, plat) - .03); } geo.computeVertexNormals();
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 2, uv.getY(i) * size / 2);
  const transparent = P.env.ground === 'transparent'; const m = texMat('grass', P.env.forest ? '#5E7442' : '#6F8F4C', 1, { rough: 1, op: transparent ? .35 : 1, env: .25 }); m.userData.noclip = true; m.clippingPlanes = null;
  const ground = new THREE.Mesh(geo, m); ground.receiveShadow = true; ground.name = 'Terrain'; scene.add(ground); T.ground = ground;
  if (!transparent && P.env.backdrop !== false) { const R = rng(4242), hx = (b.x0 + b.x1) / 2, hz = (b.z0 + b.z1) / 2, rad = Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2; const tw = t ? t.w / 200 : 0, td = t ? t.d / 200 : 0; const fo = !!P.env.forest, NB = fo ? 150 : 46; const r0 = fo ? Math.max(tw, td) + 2 : Math.max(rad + 26, Math.hypot(tw, td) + 10); const belt = new THREE.Group(); belt.name = 'Paysage';
    for (let i = 0; i < NB; i++) { const a = (i + R() * .8) / NB * Math.PI * 2, rr = r0 + R() * (fo ? 55 : 34), x = (t ? cx : hx) + Math.cos(a) * rr, z = (t ? cz : hz) + Math.sin(a) * rr, con = R() < (fo ? .5 : .3), H = (con ? 900 : 700) * (fo ? 1.4 : 1) + R() * 600, W = con ? H * .42 : H * (.75 + R() * .3); const g = new THREE.Group(); veg(g, con ? 'coniferLo' : 'treeLo', ['#4F7A3A', '#5E8A42', '#44703A', '#6A8F48'][i % 4], W, H, 0, 'b' + i); g.scale.setScalar(.01); g.position.set(x, terrainHeight(P, x, z, plat) - .1, z); belt.add(g); }
    scene.add(belt); }
  if (t) { const x0 = (t.x - t.w / 2) / 100, x1 = (t.x + t.w / 2) / 100, z0 = (t.y - t.d / 2) / 100, z1 = (t.y + t.d / 2) / 100; const pts = []; const push = (x, z) => pts.push(new THREE.Vector3(x, terrainHeight(P, x, z, plat) + .03, z)); const N = 30; for (let i = 0; i <= N; i++) push(x0 + (x1 - x0) * i / N, z0); for (let i = 0; i <= N; i++) push(x1, z0 + (z1 - z0) * i / N); for (let i = 0; i <= N; i++) push(x1 - (x1 - x0) * i / N, z1); for (let i = 0; i <= N; i++) push(x0, z1 - (z1 - z0) * i / N);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x4F7A2E, dashSize: .6, gapSize: .3 })); line.computeLineDistances(); scene.add(line); }
}

/* ---------- s\u00e9lection, cam\u00e9ra, interactions ---------- */
function highlight(sel) {
  if (!T || !T.scene) return; if (T.hl) { T.scene.remove(T.hl); T.hl = null; } if (!sel) { T.dirty = true; kick(); return; }
  const box = new THREE.Box3(); let any = false; T.root.traverse(o => { if (o.userData.sel && o.userData.sel.id === sel.id) { box.expandByObject(o); any = true; } }); if (!any) { T.dirty = true; kick(); return; }
  T.hl = new THREE.Box3Helper(box, 0x2347C6); T.scene.add(T.hl); T.dirty = true; kick();
}
function setCam(mode, P) {
  if (!T) return; T.mode = mode; T.dirty = true;
  if (mode === 'walk') { const lv = P.levels.find(l => l.id === P.cur) || P.levels[0]; let x = T.center.x, z = T.center.z, yaw = 0; const ent = lv.rooms.find(r => r.type === 'entree'); const big = interiorRooms(lv).filter(r => r.type !== 'garage').sort((a, b) => polyArea(b.pts) - polyArea(a.pts))[0]; const r = ent || big; if (r) { const c = centroid(r.pts); x = c[0] / 100; z = c[1] / 100; } if (big && r !== big) { const c2 = centroid(big.pts); yaw = Math.atan2(c2[0] / 100 - x, -(c2[1] / 100 - z)); } T.walk = { x, z, y: lv.elev / 100 + 1.62, yaw, pitch: -.04 }; }
  kick();
}
function recenter() { if (!T) return; T.recenter = true; T.orb.th = -1.0; T.orb.ph = .95; if (T.bounds) { T.center.set(T.bounds.cx, Math.min(T.bounds.ytop, 3) * .35, T.bounds.cz); T.orb.r = T.bounds.span * 1.15 + 4; T.recenter = false; } T.dirty = true; kick(); }
function key(e, down) { const m = { arrowup: 'f', z: 'f', w: 'f', arrowdown: 'b', s: 'b', arrowleft: 'l', q: 'l', a: 'l', arrowright: 'r', d: 'r' }[String(e.key).toLowerCase()]; if (!m || !T || T.mode !== 'walk' || !T.visible || e.ctrlKey || e.metaKey) return false; k3[m] = down ? 1 : 0; if (down) kick(); return true; }
function pad(k, down) { k3[k] = down ? 1 : 0; if (down) kick(); }
function bindControls(c) {
  const pts = new Map(); let pd = 0, down = null, lastClick = 0;
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = { x: e.clientX, y: e.clientY, m: 0, b: e.button, sh: e.shiftKey }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = hyp(a.x - b.x, a.y - b.y); } });
  c.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (down) down.m += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = hyp(a.x - b.x, a.y - b.y); if (pd && T.mode === 'orbit') T.orb.r = clamp(T.orb.r * pd / d, 1.5, 300); pd = d; T.dirty = true; kick(); return; }
    if (T.mode === 'orbit') { if (e.shiftKey || (down && down.b === 2) || e.buttons === 2 || e.buttons === 4) { const s = T.orb.r * .0016, th = T.orb.th; T.center.x += (-Math.sin(th) * dx - Math.cos(th) * dy) * s; T.center.z += (Math.cos(th) * dx - Math.sin(th) * dy) * s; } else { T.orb.th += dx * .006; T.orb.ph = clamp(T.orb.ph - dy * .006, .1, 1.53); } }
    else if (T.walk) { T.walk.yaw += dx * .005; T.walk.pitch = clamp(T.walk.pitch - dy * .005, -1.2, 1.2); }
    T.dirty = true; kick(); });
  const up = e => { pts.delete(e.pointerId); pd = 0; if (down && down.m < 5 && e.type === 'pointerup' && down.b === 0) { const now = performance.now(); const dbl = now - lastClick < 350; lastClick = now; pick(e, dbl); } down = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('wheel', e => { e.preventDefault(); if (T.mode === 'orbit') { T.orb.r = clamp(T.orb.r * Math.exp(e.deltaY * .0012), 1.5, 300); T.dirty = true; kick(); } }, { passive: false });
}
function pick(e, dbl) {
  if (!T || !T.scene) return; const r = T.canvas.getBoundingClientRect(); const v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(v, T.camera);
  const hits = rc.intersectObjects(T.root.children, true); for (const h of hits) { let o = h.object; while (o && !o.userData.sel) o = o.parent; if (o) { if (T.cb.onPick) T.cb.onPick(o.userData.sel, dbl); return; } }
  if (T.cb.onPick) T.cb.onPick(null, dbl);
}

/* ---------- captures et exports ---------- */
function capture(scale) {
  return new Promise((res, rej) => {
    if (!T || !T.scene) return rej(new Error('La vue 3D n\'est pas pr\u00eate.'));
    const r = T.renderer, c = T.canvas, w = c.clientWidth || 800, h = c.clientHeight || 600, s = scale || 1, pr = r.getPixelRatio();
    const tw = Math.min(4096, Math.round(w * s)), th = Math.round(tw * h / w);
    let sun = null; T.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) sun = o; });
    if (s > 1 && sun) { if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.mapSize.set(4096, 4096); }
    r.setPixelRatio(1); r.setSize(tw, th, false); T.camera.aspect = tw / th; T.camera.updateProjectionMatrix(); r.render(T.scene, T.camera);
    c.toBlob(b => { r.setPixelRatio(pr); if (s > 1 && sun) { if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.mapSize.set(2048, 2048); } resize(); T.dirty = true; kick(); b ? res(b) : rej(new Error('Capture impossible.')); }, 'image/png');
  });
}
async function exportGLB() {
  if (!T || !T.root) throw new Error('La vue 3D n\'est pas pr\u00eate.');
  await loadScript(CDN + 'exporters/GLTFExporter.js'); const exp = new THREE.GLTFExporter(); const grp = new THREE.Group(); grp.name = 'Trait de Plan'; grp.add(T.root.clone(true)); if (T.ground) grp.add(T.ground.clone());
  return new Promise((res, rej) => { try { exp.parse(grp, r => res(r), { binary: true, onlyVisible: true }); } catch (e) { rej(e); } });
}
async function parseModelData(format, data) {
  if (format === 'obj') { await loadScript(CDN + 'loaders/OBJLoader.js'); const obj = new THREE.OBJLoader().parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); return obj; }
  await loadScript(CDN + 'loaders/GLTFLoader.js'); return new Promise((res, rej) => new THREE.GLTFLoader().parse(data, '', gl => res(gl.scene), err => rej(err || new Error('Fichier 3D illisible.'))));
}
function normalizeModel(obj, format) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()); let k = 1; const mx = Math.max(size.x, size.y, size.z);
  if (format === 'obj') { if (mx > 3000) k = .001; else if (mx > 30) k = .01; }
  const wrap = new THREE.Group(); const ctr = box.getCenter(new THREE.Vector3()); obj.position.sub(new THREE.Vector3(ctr.x, box.min.y, ctr.z)); wrap.add(obj); wrap.scale.setScalar(k); const outer = new THREE.Group(); outer.add(wrap);
  const b2 = new THREE.Box3().setFromObject(outer), s2 = b2.getSize(new THREE.Vector3()); return { object: outer, size: { x: s2.x || .01, y: s2.y || .01, z: s2.z || .01 } };
}
async function loadModel(id, getModel) { const rec = await getModel(id); if (!rec) throw new Error('Mod\u00e8le absent de ce navigateur.'); const obj = await parseModelData(rec.format, rec.data); const n = normalizeModel(obj, rec.format); T.models[id] = n; return n; }
async function inspectModelFile(format, data) { if (!available()) throw new Error('La 3D n\'est pas disponible.'); const obj = await parseModelData(format, data); const n = normalizeModel(obj, format); return { w: Math.round(n.size.x * 100), d: Math.round(n.size.z * 100), h: Math.round(n.size.y * 100) }; }
function stats() { if (!T || !T.scene) return null; let meshes = 0; T.scene.traverse(o => { if (o.isMesh) meshes++; }); return { meshes, sun: T.sun ? { el: T.sun.el, day: T.sun.day } : null }; }

/* ================= V\u00c9G\u00c9TATION ET V\u00c9HICULES D\u00c9TAILL\u00c9S ================= */
const vegCache = {};
function quadsGeo(q, groups) { // q : [cx,cy,cz, ux,uy,uz, vx,vy,vz] par carte ; r\u00e9partis en \u00ab groups \u00bb mat\u00e9riaux
  const n = q.length / 9, pos = new Float32Array(n * 18), nor = new Float32Array(n * 18), uv = new Float32Array(n * 12); const g = new THREE.BufferGeometry(); const per = Math.ceil(n / groups);
  for (let i = 0; i < n; i++) { const o = i * 9, c = [q[o], q[o + 1], q[o + 2]], u = [q[o + 3], q[o + 4], q[o + 5]], v = [q[o + 6], q[o + 7], q[o + 8]]; let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const P4 = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]; P4.forEach((s, k) => { const b = i * 18 + k * 3; for (let a = 0; a < 3; a++) pos[b + a] = c[a] + u[a] * s[0] + v[a] * s[1]; nor[b] = nx; nor[b + 1] = ny; nor[b + 2] = nz; uv[i * 12 + k * 2] = s[0] * .5 + .5; uv[i * 12 + k * 2 + 1] = s[1] * .5 + .5; }); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (let k = 0; k < groups; k++) { const s = k * per, c = Math.min(per, n - s); if (c > 0) g.addGroup(s * 6, c * 6, k); } return g;
}
function tubesGeo(tubes) { // segments coniques [p0, p1, r0, r1] \u00e0 6 pans, normales liss\u00e9es
  const pos = [], nor = [], N = 6;
  for (const [a, b, r0, r1] of tubes) { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1; d[0] /= L; d[1] /= L; d[2] /= L; let u = Math.abs(d[1]) < .9 ? [d[2], 0, -d[0]] : [1, 0, 0]; const ul = Math.hypot(...u) || 1; u = u.map(x => x / ul); const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const ring = (p, r, k) => { const t = k / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), n = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s]; return [[p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r], n]; };
    for (let k = 0; k < N; k++) { const A = ring(a, r0, k), B = ring(a, r0, k + 1), C = ring(b, r1, k + 1), D = ring(b, r1, k); for (const q of [A, B, C, A, C, D]) { pos.push(...q[0]); nor.push(...q[1]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); return g;
}
function quadsGeoG(lists) { const all = [].concat(...lists); const g = quadsGeo(all, 1); g.groups = []; let s = 0; lists.forEach((l, i) => { const n = l.length / 9; if (n > 0) g.addGroup(s * 6, n * 6, i); s += n; }); return g; }
function vegGeo(kind, variant) {
  const key = kind + variant; if (vegCache[key]) return vegCache[key]; const lo = /Lo$/.test(kind); kind = kind.replace(/Lo$/, ''); const R = rng(977 + variant * 131 + kind.length * 17 + kind.charCodeAt(0) * 7), tubes = [], q = [], q2 = [], q3 = [];
  const rs = () => { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1); return [x, y, z]; };
  const nrm = A => { const l = Math.hypot(...A) || 1; return A.map(x => x / l); };
  const card = (c, s, list) => { const a = rs(), b = rs(); const u = nrm(a).map(x => x * s); let v = [u[1] * b[2] - u[2] * b[1], u[2] * b[0] - u[0] * b[2], u[0] * b[1] - u[1] * b[0]]; v = nrm(v).map(x => x * s * (.7 + R() * .5)); (list || q).push(...c, ...u, ...v); };
  // arbre ramifi\u00e9 param\u00e9trable (feuillus)
  const grow = o => { const tips = []; const bx = o.bx || .5;
    const branch = (p, d, len, rad, depth) => { const e = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len]; tubes.push([p, e, rad, rad * .62]); if (depth === 0) { tips.push([e, 1]); return; } if (depth === 1) tips.push([[(p[0] + e[0]) / 2, (p[1] + e[1]) / 2, (p[2] + e[2]) / 2], .7]);
      let a = Math.abs(d[1]) < .9 ? [d[2], 0, -d[0]] : [1, 0, 0]; a = nrm(a); const b = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]]; const n = depth === o.depth ? (o.first || 5) : 3, off = R() * 6.28;
      for (let i = 0; i < n; i++) { const az = off + (i + R() * .6) / n * 6.283, tilt = (depth === o.depth ? o.t0 : o.t1) + R() * .5, st = Math.sin(tilt), ct = Math.cos(tilt); let nd = [d[0] * ct + (a[0] * Math.cos(az) + b[0] * Math.sin(az)) * st, d[1] * ct + (a[1] * Math.cos(az) + b[1] * Math.sin(az)) * st, d[2] * ct + (a[2] * Math.cos(az) + b[2] * Math.sin(az)) * st]; nd[1] = Math.max(nd[1], o.minUp != null ? o.minUp : .05); nd = nrm(nd); const f = .55 + R() * .45; branch([p[0] + d[0] * len * f, p[1] + d[1] * len * f, p[2] + d[2] * len * f], nd, len * (.6 + R() * .2), rad * .55, depth - 1); }
      if (depth > 1) branch(e, nrm([d[0] + (R() - .5) * .3, d[1], d[2] + (R() - .5) * .3]), len * .7, rad * .62, depth - 1); };
    for (const s of (o.stems || [[0, 0, 0, 0, 0]])) branch([s[0], 0, s[1]], nrm([(R() - .5) * .06 + s[2], 1, (R() - .5) * .06 + s[3]]), o.len * (1 + (s[4] || 0)), o.rad, o.depth);
    for (const [t, k] of tips) { const n = Math.round((lo ? o.nLo : o.n) * k); for (let i = 0; i < n; i++) { const r = rs(); const lst = o.split && R() < o.split ? q3 : (R() < .5 ? q : q2); card([Math.max(-bx, Math.min(bx, t[0] + r[0] * .12)), Math.min(1, t[1] + r[1] * .1), Math.max(-bx, Math.min(bx, t[2] + r[2] * .12))], (lo ? o.sLo : o.s) + R() * (lo ? .013 : o.s * .75), lst); } } };
  switch (kind) {
    case 'tree': grow({ len: .36, rad: .034, depth: 3, t0: .55, t1: .5, n: 40, nLo: 10, s: .0145, sLo: .04 }); break;
    case 'birch': grow({ len: .42, rad: .022, depth: 3, t0: .32, t1: .42, n: 44, nLo: 11, s: .0105, sLo: .03, minUp: .2 }); break;
    case 'fruit': grow({ len: .3, rad: .04, depth: 3, t0: .8, t1: .55, n: 46, nLo: 12, s: .016, sLo: .045, split: .3 }); break;
    case 'olive': grow({ len: .26, rad: .045, depth: 3, t0: .9, t1: .6, n: 48, nLo: 13, s: .0115, sLo: .035, first: 4, stems: [[-.03, 0, -.25, .1, 0], [.04, .02, .3, -.05, -.1], [0, -.04, .05, .3, -.15]] }); break;
    case 'conifer':
      tubes.push([[0, 0, 0], [0, .96, 0], .03, .006]);
      for (let y = .16; y < .98; y += lo ? .06 : .028) { const r = .46 * Math.pow(1 - y, .85) + .02, n = Math.max(5, Math.round(13 * r / .46 + 3)), off = R() * 6.28; for (let i = 0; i < n; i++) { const az = off + (i + R() * .5) / n * 6.283, cx = Math.cos(az), cz = Math.sin(az), dr = r * (.75 + R() * .3), drop = .05 + R() * .05; const u = [cx * dr / 2, -drop / 2 * (dr / .3), cz * dr / 2], v = [-cz * (.035 + r * .12), .012, cx * (.035 + r * .12)]; (i % 3 === 0 ? q2 : q).push(cx * dr / 2, y - drop / 2 * (dr / .3) + .04, cz * dr / 2, ...u, ...v); } }
      break;
    case 'cypress':
      tubes.push([[0, 0, 0], [0, .95, 0], .05, .01]);
      for (let y = .05; y < .99; y += lo ? .04 : .015) { const r = .5 * Math.pow(Math.sin(Math.PI * Math.min(1, y * 1.05)), .55) + .02, n = lo ? 6 : 12, off = R() * 6.28; for (let i = 0; i < n; i++) { const az = off + i / n * 6.283, rr = r * (.55 + R() * .45); (i % 2 ? q2 : q).push(Math.cos(az) * rr, y, Math.sin(az) * rr, -Math.sin(az) * .09, (R() - .5) * .02, Math.cos(az) * .09, (R() - .5) * .02, .03 + R() * .02, (R() - .5) * .02); } }
      break;
    case 'pine': { // pin parasol : f\u00fbt nu l\u00e9g\u00e8rement courb\u00e9, couronne en d\u00f4me aplati
      const top = [.06, .66, .03]; tubes.push([[0, 0, 0], [.03, .35, .01], .045, .036], [[.03, .35, .01], top, .036, .026]);
      const nb = 9; for (let i = 0; i < nb; i++) { const az = i / nb * 6.283 + R() * .4, L = .32 + R() * .14, e = [top[0] + Math.cos(az) * L, top[1] + .1 + R() * .06, top[2] + Math.sin(az) * L]; tubes.push([top, e, .02, .008]); }
      const n = lo ? 160 : 520; for (let i = 0; i < n; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * .5, yy = .76 + .16 * Math.sqrt(Math.max(0, 1 - (rr / .5) ** 2)) + (R() - .5) * .05; card([Math.cos(a) * rr, yy, Math.sin(a) * rr], (lo ? .05 : .028) + R() * .02, R() < .5 ? q : q2); }
      break; }
    case 'palm': { // tronc courbe \u00e0 anneaux, couronne de palmes arqu\u00e9es
      const lean = .1 + R() * .08, base = [0, 0, 0]; let prev = base; const N = lo ? 6 : 12;
      for (let i = 1; i <= N; i++) { const t = i / N, p = [lean * t * t, .86 * t, 0]; tubes.push([prev, p, .045 - .016 * t + (i % 2 ? .004 : 0), .043 - .016 * t]); prev = p; }
      const top = prev, nf = lo ? 9 : 15;
      for (let f = 0; f < nf; f++) { const az = f / nf * 6.283 + R() * .3, dx = Math.cos(az), dz = Math.sin(az), up = .1 + R() * .12, L = .4 + R() * .12, nl = lo ? 6 : 16;
        let pp = top; for (let k = 1; k <= nl; k++) { const t = k / nl, p = [top[0] + dx * L * t, top[1] + Math.sin(t * Math.PI * .7) * up - t * t * .28, top[2] + dz * L * t]; const px = -dz, pz = dx, w = .065 * Math.sin(Math.PI * Math.min(1, t * 1.1 + .05)), dr = .03;
          for (const sgn of [-1, 1]) (sgn < 0 ? q : q2).push((pp[0] + p[0]) / 2 + px * sgn * w * .55, (pp[1] + p[1]) / 2 - dr, (pp[2] + p[2]) / 2 + pz * sgn * w * .55, px * sgn * w * .55, -dr, pz * sgn * w * .55, (p[0] - pp[0]) / 2, (p[1] - pp[1]) / 2, (p[2] - pp[2]) / 2);
          pp = p; } }
      tubes.push([top, [top[0], top[1] + .03, top[2]], .04, .01]); break; }
    case 'flowers': // p\u00e9tales (2 teintes) et feuillage
      for (let i = 0; i < (lo ? 30 : 90); i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * .45; card([Math.cos(a) * rr, .05 + R() * .18, Math.sin(a) * rr], .05 + R() * .03, q3); }
      for (let i = 0; i < (lo ? 30 : 110); i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * .46; const c = [Math.cos(a) * rr, .62 + R() * .36, Math.sin(a) * rr]; q.push(...c, .022, 0, 0, 0, 0, .022); if (R() < .6) q2.push(c[0] + .01, c[1] - .02, c[2], .016, .004, 0, 0, .004, .016); }
      break;
    case 'grass': // touffe d'herbe : brins larges \u00e0 la base, pench\u00e9s en \u00e9ventail
      for (let i = 0; i < (lo ? 10 : 34); i++) { const a = R() * 6.283, lean = .15 + R() * .7, hh = .25 + R() * .75, rr = Math.sqrt(R()) * .5, cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, w = .014 + R() * .016; (i % 3 === 0 ? q2 : i % 3 === 1 ? q : q3).push(cx + Math.cos(a) * lean * .22, hh / 2, cz + Math.sin(a) * lean * .22, -Math.sin(a) * w, 0, Math.cos(a) * w, Math.cos(a) * lean * .22, hh / 2, Math.sin(a) * lean * .22); }
      break;
    default: // buisson
      for (let i = 0; i < (lo ? 200 : 520); i++) { const o = rs(), l = Math.hypot(...o) || 1, rr = .5 * (.78 + R() * .22); card([o[0] / l * rr, .5 + o[1] / l * rr * .98, o[2] / l * rr], (lo ? .06 : .04) + R() * .03, i % 3 === 0 ? q3 : i % 3 === 1 ? q2 : q); }
  }
  const leaves = quadsGeoG([q, q2, q3]);
  // normales adoucies : le houppier est \u00e9clair\u00e9 comme un volume (plus de facettes sombres au hasard)
  { const pa = leaves.attributes.position.array, na = leaves.attributes.normal.array, mode = /^(grass|flowers)$/.test(kind) ? 'up' : /^(conifer|cypress)$/.test(kind) ? 'cone' : kind === 'palm' ? 'palm' : 'ball', cy = kind === 'bush' ? .45 : kind === 'pine' ? .7 : .6;
    for (let i = 0; i < pa.length; i += 3) { const x = pa[i], y = pa[i + 1], z = pa[i + 2]; let ox, oy, oz, k = .28;
      if (mode === 'up') { ox = 0; oy = 1; oz = 0; k = .3; } else if (mode === 'cone') { const l = Math.hypot(x, z) || 1e-3; ox = x / l; oy = .45; oz = z / l; } else if (mode === 'palm') { ox = 0; oy = 1; oz = 0; k = .55; } else { ox = x; oy = (y - cy) * 1.1 + .12; oz = z; const l = Math.hypot(ox, oy, oz) || 1e-3; ox /= l; oy /= l; oz /= l; }
      let fx = na[i], fy = na[i + 1], fz = na[i + 2]; if (fx * ox + fy * oy + fz * oz < 0) { fx = -fx; fy = -fy; fz = -fz; } let nx = ox + fx * k, ny = oy + fy * k, nz = oz + fz * k; const l = Math.hypot(nx, ny, nz) || 1; na[i] = nx / l; na[i + 1] = ny / l; na[i + 2] = nz / l; } }
  return vegCache[key] = { wood: tubes.length ? tubesGeo(tubes) : null, leaves };
}
// couleurs de feuillage selon l'esp\u00e8ce et la saison (null : arbre nu)
const AUTUMN = [['#C8742B', '#D9A23A', '#A54A22'], ['#B5462B', '#D46A2E', '#8E3A23'], ['#D8B13A', '#C98F2E', '#9C7A2A']];
function leafColors(kind, c, pal) {
  const s = (T && T.season) || 'ete', decid = /^(tree|birch|fruit|bush)$/.test(kind);
  if (kind === 'flowers') return s === 'hiver' ? null : s === 'automne' ? [shade(c, -.25), shade(c, -.1), '#6E6A3C'] : [c, shade(c, .25), '#4F7A35'];
  if (kind === 'grass') return s === 'hiver' ? ['#B8A77A', '#C9BA8C', '#9C8D62'] : s === 'automne' ? ['#A89A5A', '#B8A86A', '#8C7E48'] : s === 'printemps' ? [shade(c, .15), shade(c, .25), c] : [shade(c, .1), shade(c, .2), shade(c, -.02)];
  if (s === 'hiver' && decid) return kind === 'bush' ? [shade(c, -.38), shade(c, -.3), shade(c, -.42)] : null;
  if (s === 'automne' && decid) return AUTUMN[(pal || 0) % 3];
  if (s === 'printemps') { if (kind === 'fruit') return ['#F6F2EE', '#F2C6D3', '#8DB85A']; if (decid) return [shade(c, .22), shade(c, .32), shade(c, .1)]; }
  if (s === 'hiver') return [shade(c, -.12), shade(c, -.05), shade(c, -.2)];
  return [c, shade(c, .16), shade(c, -.14)];
}
function leafMats(c, kind, pal) { const cols = Array.isArray(c) ? c : leafColors(kind || 'tree', c, pal); if (!cols) return null; return cols.map((x, i) => M3(x, { rough: i === 2 ? .6 : .55, ds: true, fol: 1, env: .3, wind: 1, wx: 2 })); }
const BARK = { birch: '#DDD8CC', palm: '#8E7D63', olive: '#7D7464', pine: '#6E5A48' };
function barkMat(kind) { return M3(BARK[kind] || '#5B4A3A', { rough: .95, wind: 1, wx: 1 }); }
function veg(g, kind, c, W, H, y0, seed, pal) {
  const variant = (String(seed || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 3; const geo = vegGeo(kind, variant); const grp = new THREE.Group(); kind = kind.replace(/Lo$/, '');
  if (geo.wood) { const m = new THREE.Mesh(geo.wood, barkMat(kind)); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  if (kind === 'bush') { const core = new THREE.Mesh(new THREE.SphereGeometry(.4, 10, 8), M3(shade(c, -.45), { rough: 1, wx: 1 })); core.position.y = .5; core.castShadow = true; grp.add(core); }
  const mats = leafMats(c, kind, pal != null ? pal : variant); if (mats) { const lv = new THREE.Mesh(geo.leaves, mats); lv.castShadow = true; lv.receiveShadow = true; grp.add(lv); }
  grp.scale.set(W, H, W); grp.position.y = y0 || 0; grp.rotation.y = variant * 2.1 + (W % 7); g.add(grp); return grp;
}
// rocher : sph\u00e8re d\u00e9form\u00e9e, base aplatie
const rockCache = {};
function rockGeo(v) { if (rockCache[v]) return rockCache[v]; const geo = new THREE.SphereGeometry(.5, 14, 10), p = geo.attributes.position, R = rng(331 + v * 97), ph = [R() * 9, R() * 9, R() * 9];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + .22 * Math.sin(x * 7 + ph[0]) * Math.cos(z * 6 + ph[1]) + .12 * Math.sin(y * 11 + ph[2]) + .06 * Math.sin((x + z) * 19); let ny = y * n; if (ny < -.1) ny = -.1 - (ny + .1) * .15; p.setXYZ(i, x * n * (1 + .2 * v), ny + .1, z * n); }
  geo.computeVertexNormals(); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 2 + .5, (p.getY(i) + p.getZ(i)) * 2 + .5); return rockCache[v] = geo; }
function rock3D(g, W, H, D, c, seed) { const v = (String(seed || '').length + (W | 0)) % 3; const m = new THREE.Mesh(rockGeo(v), texMat('rockface', c || '#8C877F', .5, { rough: .9, wx: 1 })); m.scale.set(W, H, D); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
function hedge3D(len, h, t, seed) {
  const g = new THREE.Group(), c = '#4B7A3A', R = rng(String(seed).length * 71 + Math.round(len * 100)); const core = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.1, len - .12), Math.max(.1, h - .08), Math.max(.1, t - .14)), M3(shade(c, -.5), { rough: 1 })); core.position.y = (h - .08) / 2; core.castShadow = true; g.add(core);
  const q = [], dens = 150, faces = [[len, h, 0, 0, 1], [len, h, 0, 0, -1], [len, t, 1, 0, 0], [t, h, 0, 1, 1], [t, h, 0, 1, -1]]; // largeur, hauteur, dessus ?, bout ?, signe
  for (const [fw, fh, top, end, sg] of faces) { const n = Math.min(6000, Math.round(fw * fh * dens)); for (let i = 0; i < n; i++) { const a = (R() - .5) * fw, b = R() * fh, j = (R() - .5) * .07; let p, nrm; if (top) { p = [a, h + j, (b - fh / 2)]; nrm = [0, 1, 0]; } else if (end) { p = [sg * (len / 2 + j), b, a]; nrm = [sg, 0, 0]; } else { p = [a, b, sg * (t / 2 + j)]; nrm = [0, 0, sg]; }
    const s = .035 + R() * .03; let u = [R() - .5, R() - .5, R() - .5]; const d = u[0] * nrm[0] + u[1] * nrm[1] + u[2] * nrm[2]; u = u.map((x, k) => x - nrm[k] * d * .7); const ul = Math.hypot(...u) || 1; u = u.map(x => x / ul * s); const tl = [nrm[0] + (R() - .5) * .9, nrm[1] + (R() - .5) * .9, nrm[2] + (R() - .5) * .9]; let v = [u[1] * tl[2] - u[2] * tl[1], u[2] * tl[0] - u[0] * tl[2], u[0] * tl[1] - u[1] * tl[0]]; const vl = Math.hypot(...v) || 1; v = v.map(x => x / vl * s); q.push(...p, ...u, ...v); } }
  const lv = new THREE.Mesh(quadsGeo(q, 3), leafMats(c, 'hedge')); lv.castShadow = true; lv.receiveShadow = true; g.add(lv); return g;
}
function car3D(g, f, W, D, H, c, B, Cy, dark) {
  const suv = f.type === 'suv', body = M3(c, { rough: .2, metal: .6, env: 1.3 }), glassM = M3('#161D25', { rough: .03, metal: .35, env: 1.7 }), L = D, gc = suv ? 22 : 16, hb = H * (suv ? .58 : .56), wr = suv ? 37 : 32;
  const ext = (pts, depth, mat) => { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); const me = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), mat); me.rotation.y = -Math.PI / 2; me.position.x = depth / 2; me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
  ext([[-L / 2 + 6, gc], [-L / 2, gc + 18], [-L / 2 + 3, hb - 6], [-L / 2 + 14, hb], [L / 2 - 30, hb - 2], [L / 2 - 4, hb - 12], [L / 2, gc + 20], [L / 2 - 6, gc]], W, body);
  const c0 = -L * (suv ? .36 : .3), c1 = L * (suv ? .2 : .16); ext([[c0, hb - 1], [c0 + (suv ? 16 : 34), H - 2], [c1 - 30, H - 2], [c1 + (suv ? 38 : 52), hb - 3]], W - 14, glassM);
  B(W - 16, 3, (c1 - 30) - (c0 + (suv ? 16 : 34)) + 14, 0, H - 1, (c0 + (suv ? 16 : 34) + c1 - 30) / 2, body);
  for (const a of [c0 + (suv ? 16 : 34) + 4, (c0 + c1) / 2 + 6, c1 - 30]) for (const sx of [-1, 1]) B(3, H - hb, 5, sx * (W / 2 - 8.5), (H + hb) / 2 - 1, a, body);
  const rim = M3('#C7CCD1', { metal: .9, rough: .25, env: 1.2 }), tyre = M3('#17181A', { rough: .92 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const z = sz * (L / 2 - (sz < 0 ? 78 : 84)); const wh = Cy(wr, wr, 21, sx * (W / 2 - 10), wr, z, tyre, 22); wh.rotation.z = Math.PI / 2; const hub = Cy(wr * .58, wr * .58, 22.5, sx * (W / 2 - 10), wr, z, rim, 18); hub.rotation.z = Math.PI / 2; }
  for (const sx of [-1, 1]) { B(W * .2, 7, 3, sx * W * .32, hb - 16, L / 2 - 3, M3('#F3F6F8', { rough: .1, metal: .2, env: 1.5 })); B(W * .22, 6, 3, sx * W * .31, hb - 14, -L / 2 + 2, M3('#8E1B1B', { rough: .25 })); }
  B(W * .5, 9, 2, 0, gc + 16, L / 2 - .5, dark);
}

/* ================= LUMI\u00c8RES INT\u00c9RIEURES POUR LE RENDU ================= */
function roomLights(P, rooms) {
  const L = T.lightList; const led = P.env.led === true || P.env.led === 'on'; let n0 = 0;
  if (P.env.ceilLights !== false) for (const r of rooms.slice().sort((a, b) => b.a - a.a)) { if (n0 >= 36) break; const m2 = r.a / 10000, n = clamp(Math.round(m2 / 9), 1, 3), b = bbox(r.pts), horiz = (b.x1 - b.x0) >= (b.y1 - b.y0), span = (horiz ? b.x1 - b.x0 : b.y1 - b.y0) / 100;
    for (let i = 0; i < n; i++) { const o = n === 1 ? 0 : (i / (n - 1) - .5) * span * .5; let x = r.x + (horiz ? o : 0), z = r.z + (horiz ? 0 : o); if (!TP.inPoly(x * 100, z * 100, r.pts)) { x = r.x; z = r.z; } const k = 3.4 * Math.min(1.3, Math.max(.7, m2 / n / 8)) * (P.env.lampGain != null ? P.env.lampGain : 1); L.push({ p: [x, r.y + .12, z], dir: [0, -1, 0], cone: 1.25, r: .045, c: [k, k * .8, k * .56], room: 1 }); n0++; } }
  if (led) for (const r of rooms.slice().sort((a, b) => b.a - a.a).slice(0, 4)) { const n = r.pts.length; for (let i = 0; i < n; i++) { const a = r.pts[i], b = r.pts[(i + 1) % n], len = hyp(b[0] - a[0], b[1] - a[1]); const k = Math.max(1, Math.round(len / 90)); for (let j = 0; j < k; j++) { const t = (j + .5) / k; let x = (a[0] + (b[0] - a[0]) * t) / 100, z = (a[1] + (b[1] - a[1]) * t) / 100; const dx = r.x - x, dz = r.z - z, dl = Math.hypot(dx, dz) || 1; x += dx / dl * .16; z += dz / dl * .16; L.push({ p: [x, r.y + .2, z], r: .02, c: [.42, .36, .27], led: 1 }); } } }
}
// sources lumineuses d'un luminaire (position, direction et c\u00f4ne selon son type)
function addLightSources(P, f, d, base, z, col) {
  const lp = TP.lightProps ? TP.lightProps(f) : { lt: 'point', aim: 45, range: 7 }; const r = -(f.r || 0) * Math.PI / 180, fx = Math.sin(r), fz = Math.cos(r), ax = Math.cos(r), az = -Math.sin(r);
  const X = f.x / 100, Z = f.y / 100, y0 = base + .02 + z / 100, Hm = (f.h || 10) / 100, aim = (lp.aim || 45) * Math.PI / 180, L = T.lightList;
  const push = (p, dir, cone, c, rad) => L.push({ p, dir, cone, c, r: rad || .05, range: lp.range, ext: !!d.ext, id: f.id });
  switch (lp.lt) {
    case 'down': push([X, y0 + (f.type === 'pendant' ? .03 : -.01), Z], [0, -1, 0], f.type === 'spotPlaf' ? .55 : f.type === 'railSpots' ? .6 : 1.15, col, .04); break;
    case 'up': push([X, y0 + .04, Z], [fx * Math.cos(aim), Math.sin(aim), fz * Math.cos(aim)], .42, col, .03); break;
    case 'spot': push([X + fx * .08, y0 + Hm * .6, Z + fz * .08], [fx * Math.cos(aim), Math.sin(aim), fz * Math.cos(aim)], .5, col, .05); break;
    case 'bollard': push([X, y0 + Hm * .86, Z], [0, -1, 0], 1.4, col, .04); break;
    case 'wall': push([X + fx * .12, y0 + Hm * .5, Z + fz * .12], null, 0, col, .05); break;
    case 'strip': { const n = clamp(Math.round(f.w / 80), 1, 5); for (let i = 0; i < n; i++) { const t = (i + .5) / n - .5; push([X + ax * f.w / 100 * t, y0 + (f.type === 'terraceLight' ? -.15 : .01), Z + az * f.w / 100 * t], f.type === 'underCab' ? [0, -1, 0] : null, f.type === 'underCab' ? 1.2 : 0, col.map(v => v / n * (f.type === 'terraceLight' ? 1.6 : 1)), .03); } break; }
    case 'pool': push([X, y0 + .45, Z], null, 0, col.map(v => v * .5), .1); break;
    default: push([X, y0 + Hm * (f.type === 'lamp' ? .82 : f.type === 'tlamp' ? .75 : f.type === 'lampPost' ? .95 : .55), Z], null, 0, col, .05);
  }
}
function fixture3D(g, f, d, ctx, k) {
  const { B, Cy, Sp } = k, W = f.w, D = f.d, H = f.h || 10, lit = !ctx || ctx.lit !== false; const em = lit ? M3('#FFF6E6', { emis: (ctx && ctx.lc) || '#FFE6B8', ds: true, emisI: 1.4, glow: 1 }) : M3('#E8E4DA', { rough: .35, env: .8 }); const body = M3(f.c || d.c || '#2E3236', { rough: .45, metal: .4, wx: d.ext ? 1 : 0 });
  switch (f.type) {
    case 'spotSol': Cy(W / 2, W / 2, 2, 0, 1, 0, body); Cy(W * .32, W * .32, 1, 0, 2.2, 0, em); break;
    case 'borne': Cy(W / 2, W / 2, H * .8, 0, H * .4, 0, body); Cy(W * .42, W * .42, H * .12, 0, H * .86, 0, em); Cy(W * .55, W * .55, 3, 0, H - 1.5, 0, body); break;
    case 'projo': B(W, 6, D, 0, 3, 0, body); B(W * .8, H * .7, D * .6, 0, H * .55, 0, body); B(W * .6, H * .45, 1, 0, H * .55, D * .31, em); break;
    case 'applExt': B(W, H, D * .4, 0, H / 2, -D / 2 + D * .2, body); B(W * .7, 2, D * .6, 0, 1, 0, em); B(W * .7, 2, D * .6, 0, H - 1, 0, em); break;
    case 'lampPost': Cy(4, 5, H - 30, 0, (H - 30) / 2, 0, body); B(26, 30, 26, 0, H - 15, 0, em); B(32, 4, 32, 0, H, 0, body); break;
    case 'gateLight': B(W, H * .2, W, 0, H * .1, 0, body); B(W * .8, H * .6, W * .8, 0, H * .5, 0, em); B(W, H * .2, W, 0, H * .9, 0, body); break;
    case 'terraceLight': { const n = Math.max(4, Math.round(W / 40)); for (let i = 0; i <= n; i++) { const x = -W / 2 + W * i / n, sag = Math.sin(Math.PI * i / n) * 25; Sp(3.5, x, -sag - 4, 0, em); if (i < n) { const x2 = -W / 2 + W * (i + 1) / n, sag2 = Math.sin(Math.PI * (i + 1) / n) * 25; const m = B(Math.hypot(x2 - x, sag2 - sag), .6, .6, (x + x2) / 2, -(sag + sag2) / 2, 0, body); m.rotation.z = -Math.atan2(sag2 - sag, x2 - x); } } break; }
    case 'poolLight': Cy(W / 2, W / 2, 3, 0, 1.5, 0, em); break;
    case 'stepLight': B(W, H, 2, 0, H / 2, -D / 2 + 1, body); B(W * .8, H * .35, 1, 0, H * .3, -D / 2 + 2, em); break;
    case 'uplight': Cy(W / 2, W / 2, 4, 0, 2, 0, body); Cy(W * .42, W * .42, H * .8, 0, H * .5, 0, body); Cy(W * .36, W * .36, 1, 0, H * .92, 0, em); break;
    case 'ledStripExt': case 'ledStrip': case 'underCab': B(W, Math.max(1, H), Math.max(1, D), 0, H / 2, 0, em); break;
    case 'garageLight': B(W, H, D, 0, H / 2, 0, body); B(W * .94, 1, D * .8, 0, 0, 0, em); break;
    case 'plafonnier': Cy(W / 2, W * .45, H, 0, H / 2, 0, em); break;
    case 'spotPlaf': Cy(W / 2, W / 2, H, 0, H / 2, 0, body); Cy(W * .35, W * .35, 1, 0, 0, 0, em); break;
    case 'railSpots': { B(W, 3, 4, 0, H, 0, body); for (let i = 0; i < 4; i++) { const x = -W / 2 + W * (i + .5) / 4; Cy(3.5, 4.5, 10, x, H - 6, 0, body); Cy(3, 3, 1, x, H - 11.5, 0, em); } break; }
    default: B(W, H, D, 0, H / 2, 0, em);
  }
}
const NEW_FIXTURES = ['spotSol', 'borne', 'projo', 'applExt', 'lampPost', 'gateLight', 'terraceLight', 'poolLight', 'stepLight', 'uplight', 'ledStripExt', 'ledStrip', 'underCab', 'garageLight', 'plafonnier', 'spotPlaf', 'railSpots'];

/* ================= RENDU PHOTOR\u00c9ALISTE : extraction de la sc\u00e8ne et pilotage du traceur ================= */
const QUALITY = { rt: { n: 'Temps r\u00e9el' }, hq: { n: 'Haute qualit\u00e9', scale: .62, maxW: 1100, bounces: 2, spp: 160, clamp: 8 }, ultra: { n: 'Ultra', scale: 1, maxW: 1700, bounces: 6, spp: 1500, clamp: 14 } };
const CAMDEF = { focal: 28, fnum: 0, focus: 0, ev: 0, wb: 6000, archi: false, auto: true, bloom: .2, contrast: .1, sat: .08, reflect: 1 };
function extractScene(opt) {
  opt = opt || {}; const scene = T.scene; scene.updateMatrixWorld(true); const items = []; let nt = 0, farTris = 0;
  const triCount = g => (g.index ? (g.index.count != null ? g.index.count : g.index.array.length) : g.attributes.position.count) / 3 | 0;
  const walk = o => { const ud = o.userData || {}; if (ud.rtSkip) return; if (!o.visible && !ud.rtForce) return;
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && !(o.material && o.material.isShaderMaterial)) { const n3 = triCount(o.geometry) * (o.isInstancedMesh ? (o.count || 0) : 1); items.push(o); nt += n3; if (ud.far) farTris += n3; }
    for (const c of o.children) walk(c); }; walk(scene);
  // budget : on \u00e9carte d'abord la v\u00e9g\u00e9tation lointaine
  const budget = opt.budget || 2.4e6; const skipFar = nt > budget; if (skipFar) nt -= farTris;
  const pos = new Float32Array(nt * 9), nor = new Float32Array(nt * 9), uv = new Float32Array(nt * 6), mid = new Uint16Array(nt); const mats = [], matIx = new Map(), layers = [], layIx = new Map(); let k = 0;
  const layerOf = (img, kind) => { if (!img || !img.width) return -1; if (layIx.has(img)) return layIx.get(img); if (layers.length >= 96) return -1; let nr = null, nrSize = 0; if (kind && img.getContext) { try { const pm = TP.Tracer.pbrMaps(img, kind); nr = pm.nr; nrSize = pm.size; } catch (e) { } } layers.push({ img, nr, nrSize }); layIx.set(img, layers.length - 1); return layers.length - 1; };
  const matOf = (m, tint) => { if (!m) m = {}; const key = tint ? (m.uuid || '') + '|' + tint.hex : m; if (matIx.has(key)) return matIx.get(key); const u = (m.userData && m.userData.rt) || {}, c = m.color || { r: .8, g: .8, b: .8 }; let type = u.type || 0; if (!type && m.transparent && m.opacity < .9 && !(m.map)) type = 1;
    const img = (m.userData && m.userData.rtMap) || (m.map && m.map.image); const lay = img ? layerOf(img, u.natural ? null : u.kind) : -1; const em = m.userData && m.userData.lamp ? 5 : (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0 ? (m.emissiveIntensity || 1) * (m.userData && m.userData.glowK || 3) : 0); const e = m.emissive || { r: 0, g: 0, b: 0 };
    let cc = type === 2 && !u.natural ? [1, 1, 1] : [c.r, c.g, c.b]; if (tint) cc = cc.map((v, i) => v * tint.rgb[i]);
    const r = { c: cc, rough: u.rough != null ? u.rough : (m.roughness != null ? m.roughness / (m.roughnessMap ? 1.35 : 1) : .8), metal: m.metalness || 0, type, tex: lay, scale: m.userData && m.userData.rtMap ? 1 : (m.map && m.map.repeat ? m.map.repeat.x : 1), nrm: lay >= 0 && layers[lay].nr ? (u.nrm != null ? u.nrm : 1) : 0, emis: [e.r * em, e.g * em, e.b * em], tint: [1 - (1 - c.r) * .45, 1 - (1 - c.g) * .45, 1 - (1 - c.b) * .45], macro: u.macro || 0, wx: u.wx || 0, natural: !!u.natural, alp: u.alp || null };
    mats.push(r); matIx.set(key, mats.length - 1); return mats.length - 1; };
  const mul = (A, B, o) => { const r = new Array(16); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let q = 0; q < 4; q++) s += A[q * 4 + rr] * B[o + c * 4 + q]; r[c * 4 + rr] = s; } return r; };
  const emit = (o, e, tint) => { const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ix = g.index ? g.index.array : null; const n3 = triCount(g);
    const c00 = e[5] * e[10] - e[6] * e[9], c01 = e[6] * e[8] - e[4] * e[10], c02 = e[4] * e[9] - e[5] * e[8], c10 = e[2] * e[9] - e[1] * e[10], c11 = e[0] * e[10] - e[2] * e[8], c12 = e[1] * e[8] - e[0] * e[9], c20 = e[1] * e[6] - e[2] * e[5], c21 = e[2] * e[4] - e[0] * e[6], c22 = e[0] * e[5] - e[1] * e[4]; const det = e[0] * c00 + e[1] * c01 + e[2] * c02, sg = det < 0 ? -1 : 1;
    const groups = Array.isArray(o.material) && g.groups && g.groups.length ? g.groups : [{ start: 0, count: n3 * 3, materialIndex: 0 }];
    for (const gr of groups) { const mm = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material; if (!mm) continue; const mi = matOf(mm, tint); const t0 = gr.start / 3 | 0, t1 = Math.min(n3, (gr.start + gr.count) / 3 | 0);
      for (let t = t0; t < t1 && k < nt; t++) {
        for (let q = 0; q < 3; q++) { const vi = ix ? ix[t * 3 + q] : t * 3 + q, x = pa.array[vi * 3], y = pa.array[vi * 3 + 1], z = pa.array[vi * 3 + 2], o9 = k * 9 + q * 3; pos[o9] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[o9 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[o9 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (na) { const a = na.array[vi * 3], b = na.array[vi * 3 + 1], c = na.array[vi * 3 + 2]; let X = (c00 * a + c10 * b + c20 * c) * sg, Y = (c01 * a + c11 * b + c21 * c) * sg, Z = (c02 * a + c12 * b + c22 * c) * sg; const l = Math.hypot(X, Y, Z) || 1; nor[o9] = X / l; nor[o9 + 1] = Y / l; nor[o9 + 2] = Z / l; }
          if (ua) { uv[k * 6 + q * 2] = ua.array[vi * 2]; uv[k * 6 + q * 2 + 1] = ua.array[vi * 2 + 1]; } }
        if (!na) { const p = k * 9; const ax = pos[p + 3] - pos[p], ay = pos[p + 4] - pos[p + 1], az = pos[p + 5] - pos[p + 2], bx = pos[p + 6] - pos[p], by = pos[p + 7] - pos[p + 1], bz = pos[p + 8] - pos[p + 2]; const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx; const l = Math.hypot(fx, fy, fz) || 1; for (let q = 0; q < 3; q++) { nor[p + q * 3] = fx / l; nor[p + q * 3 + 1] = fy / l; nor[p + q * 3 + 2] = fz / l; } }
        mid[k] = mi; k++; } } };
  for (const o of items) { if (skipFar && o.userData && o.userData.far) continue;
    if (o.isInstancedMesh) { const im = o.instanceMatrix.array, ic = o.instanceColor ? o.instanceColor.array : null, W = o.matrixWorld.elements; for (let i = 0; i < (o.count || 0); i++) { if (im[i * 16] === 0 && im[i * 16 + 5] === 0 && im[i * 16 + 10] === 0 && im[i * 16 + 1] === 0) continue; let tint = null; if (ic) { const rgb = [ic[i * 3], ic[i * 3 + 1], ic[i * 3 + 2]]; tint = { rgb, hex: rgb.map(v => Math.round(v * 40)).join(',') }; } emit(o, mul(W, im, i * 16), tint); } }
    else emit(o, o.matrixWorld.elements, null); }
  return { pos: pos.subarray(0, k * 9), nor: nor.subarray(0, k * 9), uv: uv.subarray(0, k * 6), mid: mid.subarray(0, k), mats, layers, lights: T.rtLights || [], portals: T.rtPortals || [], texSize: 512, skippedFar: skipFar };
}
// ciel et soleil physiques (unit\u00e9s relatives, lin\u00e9aire HDR) \u00e0 partir de l'heure, du mois et de la m\u00e9t\u00e9o
function rtEnv(P) {
  const s = T.sun || sunState(P), w = P.env.weather || 'sun', sinE = Math.sin(s.el), day = clamp((sinE + .1) / .35, 0, 1), up = Math.max(sinE, .03);
  const tau = [.075, .14, .29], tr = tau.map(t => Math.exp(-t / up)); const wk = { sun: 1, voile: .42, couvert: 0, brume: .5 }[w]; const dir = sinE > -.02 ? [s.dir.x, Math.max(s.dir.y, .015), s.dir.z] : [-.4, .5, .3]; const dl = Math.hypot(...dir); const sunDir = dir.map(v => v / dl);
  const E0 = 30 * wk * clamp((sinE + .02) / .06, 0, 1); let sunE = tr.map(t => t * E0); const ang = { sun: .011, voile: .06, couvert: .2, brume: .045 }[w], sunCos = Math.cos(ang), om = 2 * Math.PI * (1 - sunCos);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); const dusk = clamp(1 - Math.abs(s.el) / .28, 0, 1);
  let zen = mix([.0035, .005, .011], [.17, .44, 1.65], Math.pow(day, 1.4)), hor = mix([.006, .008, .014], [2.0, 2.5, 3.1], Math.pow(day, 1.2)); hor = mix(hor, [1.5 * day + .05, .78 * day + .03, .42 * day + .02], dusk * .6); zen = mix(zen, [.12 * day, .16 * day, .42 * day + .01], dusk * .5);
  let cloud = [.42, .55, 3.7 + (P.env.month || 6) * .31, .3], cloudCol = mix([.02, .025, .035], [5.2, 5.2, 5.3], day), fog = .0022, key = .25;
  if (w === 'voile') { const g = (zen[0] + zen[1] + zen[2]) / 3 * 2.2; zen = mix(zen, [g, g, g * 1.05], .55); hor = mix(hor, [1.5 * day, 1.55 * day, 1.6 * day], .5); cloud = [.72, .4, 9.1, .6]; cloudCol = cloudCol.map(v => v * .75); fog = .0012; }
  if (w === 'couvert') { const d = day; zen = [2.1 * d + .004, 2.15 * d + .005, 2.25 * d + .008]; hor = [.95 * d + .004, 1 * d + .005, 1.05 * d + .008]; cloud = [0, 1, 0, 1]; fog = .0018; }
  if (w === 'brume') { hor = mix(hor, [1.6 * day, 1.62 * day, 1.66 * day], .8); zen = mix(zen, [1.2 * day, 1.25 * day, 1.35 * day], .6); cloud = [0, 1, 0, 1]; fog = .02; }
  if (P.env.forest) fog *= .35;
  const gnd = mix([.004, .005, .004], [.75, 1.0, .5], day); const glow = sunE.map(v => v * .5 + .02 * day);
  const clip = T.clipPlanes && T.clipPlanes.length ? [T.clipPlanes[0].normal.x, T.clipPlanes[0].normal.y, T.clipPlanes[0].normal.z, T.clipPlanes[0].constant] : [0, 0, 0, 1e30];
  if (day < .25) key = .07 + .13 * day / .25;
  return { sunDir, sunE, sunRad: sunE.map(v => v / om), glow, sunCos, zen, hor, gnd, cloud, cloudCol, fog, fogCol: mix(hor, zen, .25), clip, key };
}
function camState() {
  const cam = T.camera, o = T.camOpt, p = [cam.position.x, cam.position.y, cam.position.z]; let f;
  if (T.mode === 'orbit') f = [T.center.x - p[0], T.center.y - p[1], T.center.z - p[2]]; else { const w = T.walk || { yaw: 0, pitch: 0 }; f = [Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch)]; }
  const fl = Math.hypot(...f) || 1; f = f.map(v => v / fl); let shift = 0; const pitch = Math.asin(clamp(f[1], -1, 1));
  if (o.archi && Math.abs(pitch) < .62) { shift = Math.tan(pitch); const h = Math.hypot(f[0], f[2]) || 1; f = [f[0] / h, 0, f[2] / h]; }
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r) || 1; r = r.map(v => v / rl); const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const tan = 12 / o.focal; const focus = o.focus > 0 ? o.focus : (T.mode === 'orbit' ? T.orb.r : 3.5); const ap = o.fnum > 0 ? (o.focal / 1000) / (2 * o.fnum) * (o.dofBoost || 1) : 0;
  const rd = v => Math.round(v * 1e4) / 1e4; return { pos: p.map(rd), right: r.map(rd), up: u.map(rd), fwd: f.map(rd), tan: rd(tan), aperture: ap, focus: rd(focus), shift: rd(shift), pitch };
}
function applyCamera() { // objectif (focale) et d\u00e9centrement pour la vue temps r\u00e9el
  const cam = T.camera, o = T.camOpt; const fov = 2 * Math.atan(12 / o.focal) * 180 / Math.PI; let dirty = false; if (Math.abs(cam.fov - fov) > 1e-4) { cam.fov = fov; dirty = true; }
  const cs = camState(); const sh = o.archi && cs.shift ? cs.shift / cs.tan : 0; if (dirty || sh !== T.camShift) { cam.updateProjectionMatrix(); if (sh && cam.projectionMatrix && cam.projectionMatrix.elements) { cam.projectionMatrix.elements[9] = sh; if (cam.projectionMatrixInverse && cam.projectionMatrixInverse.copy) cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); } T.camShift = sh; }
  if (sh) cam.lookAt(cam.position.x + cs.fwd[0], cam.position.y, cam.position.z + cs.fwd[2]); return cs;
}
function rtEnsure() {
  if (T.rt !== undefined) return T.rt; T.rt = null; if (!TP.Tracer || !TP.Tracer.supported()) { T.rtError = 'Cette carte graphique ne prend pas en charge le rendu par lancer de rayons (WebGL2 et textures flottantes requis).'; return null; }
  const oc = document.createElement('canvas'); oc.id = 'crt'; oc.setAttribute('aria-hidden', 'true'); oc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .25s';
  const tr = TP.Tracer.create(oc); if (!tr || tr.error) { T.rtError = 'Le moteur de rendu n\'a pas pu d\u00e9marrer' + (tr && tr.error ? ' : ' + String(tr.error).slice(0, 140) : '.'); return null; }
  T.canvas.parentElement.insertBefore(oc, T.canvas.nextSibling); T.rtCanvas = oc; T.rt = tr; return tr;
}
function rtSync(P) { // (re)charge la sc\u00e8ne dans le traceur si le mod\u00e8le a chang\u00e9
  const tr = rtEnsure(); if (!tr || !T.scene) return null; if (TP.Env && TP.Env.clearView) { try { placeCam(); TP.Env.clearView(); } catch (e) { } } if (T.rtDirty || !tr.state.ready) { const t0 = performance.now(); const sc = extractScene(); T.rtInfo = tr.setScene(sc); T.rtInfo.extractMs = Math.round(performance.now() - t0) - T.rtInfo.ms; T.rtInfo.skippedFar = sc.skippedFar; T.rtDirty = false; }
  if (TP.Env && TP.Env.hdriData && TP.Env.hdriData.key !== tr.state.hdrKeyU) { const h = TP.Env.hdriData; tr.setHdr(h.data, h.w, h.h); tr.state.hdrKeyU = h.key; }
  tr.setEnv(TP.Env && TP.Env.rtEnv ? TP.Env.rtEnv(P || T.P) : rtEnv(P || T.P)); return tr;
}
function rtSize() { const q = QUALITY[T.quality] || QUALITY.hq, c = T.canvas, w = c.clientWidth || 800, h = c.clientHeight || 500; let W = Math.round(w * q.scale * Math.min(1.5, G.devicePixelRatio || 1)); W = Math.min(W, q.maxW); return [W, Math.max(16, Math.round(W * h / w))]; }
function rtTick(now, changed) {
  const q = QUALITY[T.quality]; if (!q || T.quality === 'rt' || T.exporting) { if (T.rtCanvas) T.rtCanvas.style.opacity = 0; return false; }
  const tr = rtEnsure(); if (!tr) { if (T.cb.onRender) T.cb.onRender({ error: T.rtError }); T.quality = 'rt'; return false; }
  const cs = applyCamera(); const camChanged = tr.setCamera(cs);
  if (changed || camChanged) { T.rtStart = now + 160; T.rtCanvas.style.opacity = 0; T.rtShown = false; if (T.cb.onRender) T.cb.onRender({ spp: 0, max: q.spp, wait: true }); return true; }
  if (now < T.rtStart) return true;
  if (T.rtDirty || !tr.state.ready || T.rtEnvKey !== T.envKey + T.quality) { rtSync(T.P); T.rtEnvKey = T.envKey + T.quality; tr.setCamera(cs); }
  const sz = rtSize(); tr.setSize(sz[0], sz[1]); tr.state.maxPass = q.spp; tr.setOptions({ bounces: q.bounces, clamp: q.clamp, ev: T.camOpt.ev, wb: T.camOpt.wb, auto: T.camOpt.auto !== false, denoise: T.camOpt.denoise !== false, vignette: T.camOpt.archi ? .22 : .1, bloom: T.camOpt.bloom || 0, contrast: T.camOpt.contrast || 0, sat: T.camOpt.sat || 0 });
  const r = tr.step(now); if (r.error) { if (T.cb.onRender) T.cb.onRender({ error: 'Le rendu a \u00e9t\u00e9 interrompu par la carte graphique.' }); T.quality = 'rt'; return false; }
  if (!T.rtShown && r.spp >= 1) { T.rtCanvas.style.opacity = 1; T.rtShown = true; }
  if (T.cb.onRender) T.cb.onRender({ spp: r.spp, max: q.spp, done: r.done, info: T.rtInfo }); return !r.done;
}
function setQuality(q) { if (!T || !QUALITY[q]) return; T.quality = q; T.rtShown = false; if (T.rt) T.rt.reset(); if (T.rtCanvas) T.rtCanvas.style.opacity = 0; T.dirty = true; kick(); }
function setCamOpt(o) { if (!T) return; Object.assign(T.camOpt, o); T.dirty = true; kick(); }
// image finale haute d\u00e9finition par lancer de rayons (hors \u00e9cran, par tuiles)
async function renderHD(o) {
  o = o || {}; const tr = rtSync(T.P); if (!tr) throw new Error(T.rtError || 'Rendu photor\u00e9aliste indisponible.'); const c = T.canvas, asp = o.aspect || (c.clientWidth || 16) / (c.clientHeight || 9); const w = o.w || 1920, h = Math.round(w / asp); T.exporting = true; if (T.rtCanvas) T.rtCanvas.style.opacity = 0;
  try { tr.setOptions({ bounces: o.bounces || 6, clamp: 14, ev: T.camOpt.ev, wb: T.camOpt.wb, auto: T.camOpt.auto !== false, denoise: T.camOpt.denoise !== false, vignette: T.camOpt.archi ? .22 : .1, bloom: T.camOpt.bloom || 0, contrast: T.camOpt.contrast || 0, sat: T.camOpt.sat || 0 }); placeCam(); const cv = await tr.renderImage({ w, h, spp: o.spp || 200, cam: applyCamera(), onProgress: o.onProgress, cancel: o.cancel, sync: o.sync }); if (o.canvas) return cv; return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Image impossible \u00e0 produire.')), 'image/png')); }
  finally { T.exporting = false; T.dirty = true; kick(); }
}

TP.View3D = { QUALITY, CAMDEF, setQuality, setCamOpt, renderHD, rtSync, extractScene, rtEnv, camState, vegGeo, texCanvas, kick, placeCam,
  _: { M3, texMat, floorMat, veg, vegGeo, leafMats, leafColors, barkMat, rockGeo, rock3D, quadsGeo, quadsGeoG, tubesGeo, tag, lin, texCanvas, clearMats: () => { matCache = {}; }, sunState, applyCamera, terrainHeight, skyMaterial: () => null }, _furn3D: f => furn3D(f, { lvH: 250 }), available, init, build, highlight, resize, setVisible, setCam, recenter, key, pad, capture, exportGLB, inspectModelFile, stats, WEATHER, get state() { return T; } };
})(typeof window !== 'undefined' ? window : globalThis);
