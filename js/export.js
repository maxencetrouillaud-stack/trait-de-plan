/* Trait de Plan \u2014 exports sans d\u00e9pendance : ZIP, DXF (R12), IFC4, CSV. Pas d'acc\u00e8s au DOM. */
(function (G) {
'use strict';
const TP = G.TP;
const { wg, polyArea, centroid, bbox, rotPt, sortedLevels, MATS, OPDEF, ROOFMATS, ROOFTYPES, FACADES, fdesc, isExt, isWindow, roofGeom, stairOutline, isStair, n2 } = TP;
const enc = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
const ascii = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00b2/g, '2').replace(/[^\x20-\x7E]/g, '?');

/* ---------- ZIP (m\u00e9thode \u00ab stock\u00e9e \u00bb, sans compression) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc(f.name), data = typeof f.data === 'string' ? enc(f.data) : (f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data)); const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0); const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(4, 0, true); e.setUint16(6, 0, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true); e.setUint16(20, 0, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
}

/* ---------- DXF R12 (unit\u00e9s : mm, axe Y vers le haut) ---------- */
function toDXF(P, levelIds) {
  const L = []; const g = (c, v) => L.push(String(c), String(v));
  const X = (x, ox) => n2((x + ox) * 10), Y = y => n2(-y * 10);
  const layers = [['MURS', 7], ['CLOISONS', 8], ['OUVERTURES', 4], ['PIECES', 3], ['TEXTES', 2], ['MOBILIER', 9], ['COTES', 1], ['TOITURE', 6], ['EXTERIEUR', 94]];
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length); for (const [n, c] of layers) { g(0, 'LAYER'); g(2, n); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); } g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const line = (ly, a, b, ox) => { g(0, 'LINE'); g(8, ly); g(10, X(a[0], ox)); g(20, Y(a[1])); g(30, 0); g(11, X(b[0], ox)); g(21, Y(b[1])); g(31, 0); };
  const poly = (ly, pts, ox, closed = true) => { g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(70, closed ? 1 : 0); for (const p of pts) { g(0, 'VERTEX'); g(8, ly); g(10, X(p[0], ox)); g(20, Y(p[1])); g(30, 0); } g(0, 'SEQEND'); g(8, ly); };
  const text = (ly, x, y, h, s, ox) => { g(0, 'TEXT'); g(8, ly); g(10, X(x, ox)); g(20, Y(y)); g(30, 0); g(40, n2(h * 10)); g(1, ascii(s)); g(72, 1); g(11, X(x, ox)); g(21, Y(y)); g(31, 0); };
  const arc = (ly, c, r, a0, a1, ox) => { g(0, 'ARC'); g(8, ly); g(10, X(c[0], ox)); g(20, Y(c[1])); g(30, 0); g(40, n2(r * 10)); g(50, n2(a0)); g(51, n2(a1)); };
  let ox = 0; const lvls = sortedLevels(P).filter(l => !levelIds || levelIds.includes(l.id));
  for (const lv of lvls) {
    const b = TP.levelBounds ? TP.levelBounds(null, lv, 100) : { x: 0, w: 1500, y: 0 }; const shift = ox - b.x;
    text('TEXTES', b.x + b.w / 2, b.y - 40, 40, `${lv.name} - ${P.name}`, shift);
    for (const w of lv.walls) { const gg = wg(w), t = w.t / 2; const ly = w.kind === 'wall' ? (w.t >= 15 ? 'MURS' : 'CLOISONS') : 'EXTERIEUR';
      const a1 = [w.x1 + gg.nx * t, w.y1 + gg.ny * t], b1 = [w.x2 + gg.nx * t, w.y2 + gg.ny * t], a2 = [w.x1 - gg.nx * t, w.y1 - gg.ny * t], b2 = [w.x2 - gg.nx * t, w.y2 - gg.ny * t];
      const ops = lv.open.filter(o => o.wall === w.id).sort((p, q) => p.pos - q.pos); let cur = 0; const seg = (s0, s1) => { if (s1 - s0 < 0.5) return; const P1 = s => [w.x1 + gg.ux * s, w.y1 + gg.uy * s]; const p = P1(s0), q = P1(s1); line(ly, [p[0] + gg.nx * t, p[1] + gg.ny * t], [q[0] + gg.nx * t, q[1] + gg.ny * t], shift); line(ly, [p[0] - gg.nx * t, p[1] - gg.ny * t], [q[0] - gg.nx * t, q[1] - gg.ny * t], shift); };
      for (const o of ops) { seg(cur, o.pos - o.w / 2); cur = o.pos + o.w / 2; } seg(cur, gg.len); line(ly, a1, a2, shift); line(ly, b1, b2, shift);
      for (const o of ops) { const c = [w.x1 + gg.ux * o.pos, w.y1 + gg.uy * o.pos], hw = o.w / 2; const J = (u, v) => [c[0] + gg.ux * u + gg.nx * v, c[1] + gg.uy * u + gg.ny * v];
        line('OUVERTURES', J(-hw, -t), J(-hw, t), shift); line('OUVERTURES', J(hw, -t), J(hw, t), shift);
        if (isWindow(o.kind) || o.kind === 'bay') { line('OUVERTURES', J(-hw, 0), J(hw, 0), shift); }
        else if (OPDEF[o.kind].leaf === 'swing') { const sd = o.side || 1, hg = o.hinge || 1; const hp = J(-hw * hg, sd * t), tip = J(-hw * hg, sd * (t + o.w)); line('OUVERTURES', hp, tip, shift); const a0 = Math.atan2(-(tip[1] - hp[1]), tip[0] - hp[0]) * 180 / Math.PI; const end = J(hw * hg, sd * t); const a1x = Math.atan2(-(end[1] - hp[1]), end[0] - hp[0]) * 180 / Math.PI; let s0 = a0, s1 = a1x; const dd = ((s1 - s0) % 360 + 360) % 360; if (dd > 180) [s0, s1] = [s1, s0]; arc('OUVERTURES', hp, o.w, s0, s1, shift); } }
    }
    for (const r of lv.rooms) { if (r.pts.length < 3) continue; poly(isExt(r) ? 'EXTERIEUR' : 'PIECES', r.pts, shift); const c = centroid(r.pts); text('TEXTES', c[0], c[1] - 12, 18, r.name || 'Piece', shift); text('TEXTES', c[0], c[1] + 14, 14, (polyArea(r.pts) / 1e4).toFixed(2) + ' m2', shift); }
    for (const f of lv.furn) { const pts = isStair(f) ? stairOutline(f) : TP.furnCorners(f); poly('MOBILIER', pts, shift); }
    for (const d of lv.dims) { line('COTES', [d.x1, d.y1], [d.x2, d.y2], shift); text('COTES', (d.x1 + d.x2) / 2, (d.y1 + d.y2) / 2 - 10, 14, (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) / 100).toFixed(2), shift); }
    for (const t of lv.texts) text('TEXTES', t.x, t.y, t.fs, t.s, shift);
    for (const rf of lv.roofs) { const W = rf.w / 2 + rf.over, D = rf.d / 2 + rf.over; poly('TOITURE', [[-W, -D], [W, -D], [W, D], [-W, D]].map(([u, v]) => { const p = rotPt(u, v, rf.r || 0); return [rf.x + p[0], rf.y + p[1]]; }), shift); }
    ox += b.w + 400;
  }
  g(0, 'ENDSEC'); g(0, 'EOF');
  return L.join('\r\n') + '\r\n';
}

/* ---------- IFC4 (STEP) ---------- */
const GCH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid() { let s = GCH[Math.floor(Math.random() * 4)]; for (let i = 0; i < 21; i++) s += GCH[Math.floor(Math.random() * 64)]; return s; }
const fx = v => { const n = Math.round(v * 1e5) / 1e5; const s = String(n); return /[.eE]/.test(s) ? s : s + '.'; };
const str = s => "'" + ascii(s).replace(/'/g, "''") + "'";
function toIFC(P) {
  const E = []; let id = 0; const add = s => { E.push(`#${++id}=${s};`); return '#' + id; };
  const pt3 = (x, y, z) => add(`IFCCARTESIANPOINT((${fx(x)},${fx(y)},${fx(z)}))`), pt2 = (x, y) => add(`IFCCARTESIANPOINT((${fx(x)},${fx(y)}))`), dir3 = (x, y, z) => add(`IFCDIRECTION((${fx(x)},${fx(y)},${fx(z)}))`);
  const origin = pt3(0, 0, 0), zUp = dir3(0, 0, 1), xDir = dir3(1, 0, 0), wcs = add(`IFCAXIS2PLACEMENT3D(${origin},$,$)`);
  const ctx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`); const body = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const u = [add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'), add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'), add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'), add('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')];
  const units = add(`IFCUNITASSIGNMENT((${u.join(',')}))`);
  const project = add(`IFCPROJECT('${guid()}',$,${str(P.name)},$,$,$,$,(${ctx}),${units})`);
  const lpSite = add(`IFCLOCALPLACEMENT($,${wcs})`), site = add(`IFCSITE('${guid()}',$,'Terrain',$,$,${lpSite},$,$,.ELEMENT.,$,$,$,$,$)`);
  const lpB = add(`IFCLOCALPLACEMENT(${lpSite},${wcs})`), bld = add(`IFCBUILDING('${guid()}',$,${str(P.name)},$,$,${lpB},$,$,.ELEMENT.,$,$,$)`);
  add(`IFCRELAGGREGATES('${guid()}',$,$,$,${project},(${site}))`); add(`IFCRELAGGREGATES('${guid()}',$,$,$,${site},(${bld}))`);
  const M = v => v / 100; // cm \u2192 m ; y du plan invers\u00e9
  const shapeExtrude = (profile, z, depth) => { const pos = add(`IFCAXIS2PLACEMENT3D(${pt3(0, 0, z)},$,$)`); const solid = add(`IFCEXTRUDEDAREASOLID(${profile},${pos},${zUp},${fx(depth)})`); const rep = add(`IFCSHAPEREPRESENTATION(${body},'Body','SweptSolid',(${solid}))`); return add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`); };
  const polyProfile = pts => { const ps = pts.map(p => pt2(M(p[0]), -M(p[1]))); ps.push(ps[0]); const pl = add(`IFCPOLYLINE((${ps.join(',')}))`); return add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${pl})`); };
  const storeys = [];
  for (const lv of sortedLevels(P)) {
    const lpS = add(`IFCLOCALPLACEMENT(${lpB},${add(`IFCAXIS2PLACEMENT3D(${pt3(0, 0, M(lv.elev))},$,$)`)})`); const st = add(`IFCBUILDINGSTOREY('${guid()}',$,${str(lv.name)},$,$,${lpS},$,$,.ELEMENT.,${fx(M(lv.elev))})`); storeys.push(st);
    const contained = [], spaces = [];
    for (const w of lv.walls) {
      if (w.kind === 'hedge') continue; const g = wg(w), H = w.kind === 'wall' ? lv.h : w.kind === 'low' ? 100 : 120;
      const place = add(`IFCAXIS2PLACEMENT3D(${pt3(M(w.x1), -M(w.y1), 0)},${zUp},${dir3(g.ux, -g.uy, 0)})`); const lpW = add(`IFCLOCALPLACEMENT(${lpS},${place})`);
      const prof = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${add(`IFCAXIS2PLACEMENT2D(${pt2(M(g.len / 2), 0)},$)`)},${fx(M(g.len))},${fx(M(w.t))})`);
      const wall = add(`IFCWALL('${guid()}',$,${str(w.kind === 'wall' ? (w.t >= 15 ? 'Mur' : 'Cloison') : TP.WALLKINDS[w.kind])},$,$,${lpW},${shapeExtrude(prof, 0, M(H))},$,${w.kind === 'wall' ? '.STANDARD.' : '.NOTDEFINED.'})`); contained.push(wall);
      for (const o of lv.open.filter(x => x.wall === w.id)) {
        const d = OPDEF[o.kind], sill = isWindow(o.kind) ? o.sill : 0, h = Math.min(o.h, H - sill);
        const opProf = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${add(`IFCAXIS2PLACEMENT2D(${pt2(M(o.pos), 0)},$)`)},${fx(M(o.w))},${fx(M(w.t + 10))})`);
        const lpO = add(`IFCLOCALPLACEMENT(${lpW},${wcs})`); const opening = add(`IFCOPENINGELEMENT('${guid()}',$,'Ouverture',$,$,${lpO},${shapeExtrude(opProf, M(sill), M(h))},$,.OPENING.)`);
        add(`IFCRELVOIDSELEMENT('${guid()}',$,$,$,${wall},${opening})`);
        if (d.leaf === 'none') continue;
        const fProf = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${add(`IFCAXIS2PLACEMENT2D(${pt2(M(o.pos), 0)},$)`)},${fx(M(o.w))},${fx(0.06)})`); const lpF = add(`IFCLOCALPLACEMENT(${lpW},${wcs})`); const shp = shapeExtrude(fProf, M(sill), M(h));
        const el = isWindow(o.kind) ? add(`IFCWINDOW('${guid()}',$,${str(d.n)},$,$,${lpF},${shp},$,${fx(M(h))},${fx(M(o.w))},.WINDOW.,.SINGLE_PANEL.,$)`) : add(`IFCDOOR('${guid()}',$,${str(d.n)},$,$,${lpF},${shp},$,${fx(M(h))},${fx(M(o.w))},${o.kind === 'gate' ? '.GATE.' : '.DOOR.'},${d.leaf === 'double' || d.leaf === 'french' ? '.DOUBLE_DOOR_SINGLE_SWING.' : d.leaf === 'slide' || d.leaf === 'bay' ? '.SLIDING_TO_LEFT.' : d.leaf === 'garage' ? '.ROLLINGUP.' : '.SINGLE_SWING_LEFT.'},$)`);
        add(`IFCRELFILLSELEMENT('${guid()}',$,$,$,${opening},${el})`); contained.push(el);
      }
    }
    for (const r of lv.rooms) {
      if (r.pts.length < 3) continue; const A = polyArea(r.pts) / 1e4;
      if (isExt(r)) { const sl = add(`IFCSLAB('${guid()}',$,${str(r.name || 'Exterieur')},$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${shapeExtrude(polyProfile(r.pts), -0.05, 0.05)},$,.BASESLAB.)`); contained.push(sl); continue; }
      const sp = add(`IFCSPACE('${guid()}',$,${str(r.name || 'Piece')},$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${shapeExtrude(polyProfile(r.pts), 0, M(lv.h))},${str(TP.ROOMTYPES[r.type] || '')},.ELEMENT.,.SPACE.,$)`); spaces.push(sp);
      const qa = add(`IFCQUANTITYAREA('NetFloorArea',$,$,${fx(A)},$)`), qv = add(`IFCQUANTITYVOLUME('NetVolume',$,$,${fx(A * M(lv.h))},$)`); const eq = add(`IFCELEMENTQUANTITY('${guid()}',$,'Qto_SpaceBaseQuantities',$,$,(${qa},${qv}))`); add(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${sp}),${eq})`);
      const sl = add(`IFCSLAB('${guid()}',$,${str('Dalle ' + (r.name || ''))},$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${shapeExtrude(polyProfile(r.pts), -M(lv.slab || 20), M(lv.slab || 20))},$,.FLOOR.)`); contained.push(sl);
    }
    for (const rf of lv.roofs) {
      const geo = roofGeom(rf), thk = 0.18, faces = [];
      const W3 = ([uu, vv, zz]) => { const p = rotPt(uu, vv, rf.r || 0); return [M(rf.x + p[0]), -M(rf.y + p[1]), M(lv.h + zz)]; };
      for (const f of geo.faces) { const top = f.map(W3); const bot = top.map(p => [p[0], p[1], p[2] - thk]); const loop = ps => add(`IFCFACE((${add(`IFCFACEOUTERBOUND(${add(`IFCPOLYLOOP((${ps.map(p => pt3(p[0], p[1], p[2])).join(',')}))`)},.T.)`)}))`); faces.push(loop(top), loop([...bot].reverse())); for (let i = 0; i < top.length; i++) { const j = (i + 1) % top.length; faces.push(loop([top[j], top[i], bot[i], bot[j]])); } }
      const shell = add(`IFCCLOSEDSHELL((${faces.join(',')}))`); const brep = add(`IFCFACETEDBREP(${shell})`); const rep = add(`IFCSHAPEREPRESENTATION(${body},'Body','Brep',(${brep}))`); const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
      const roof = add(`IFCROOF('${guid()}',$,${str(ROOFTYPES[rf.type] + ' - ' + ROOFMATS[rf.mat].n)},$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${pds},$,${{ gable: '.GABLE_ROOF.', hip: '.HIP_ROOF.', shed: '.SHED_ROOF.', flat: '.FLAT_ROOF.' }[rf.type]})`); contained.push(roof);
    }
    for (const f of lv.furn) {
      if (!isStair(f) && f.type !== 'column') continue; const pts = isStair(f) ? stairOutline(f) : TP.furnCorners(f); const H = TP.stairRise(P, lv);
      const el = isStair(f) ? add(`IFCSTAIR('${guid()}',$,${str(fdesc(f, P).n)},$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${shapeExtrude(polyProfile(pts), 0, M(H))},$,${f.type === 'spiral' ? '.SPIRAL_STAIR.' : f.type === 'stairsL' ? '.QUARTER_TURN_STAIR.' : '.STRAIGHT_RUN_STAIR.'})`) : add(`IFCCOLUMN('${guid()}',$,'Poteau',$,$,${add(`IFCLOCALPLACEMENT(${lpS},${wcs})`)},${shapeExtrude(polyProfile(pts), 0, M(lv.h))},$,.COLUMN.)`);
      contained.push(el);
    }
    if (contained.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${contained.join(',')}),${st})`);
    if (spaces.length) add(`IFCRELAGGREGATES('${guid()}',$,$,$,${st},(${spaces.join(',')}))`);
  }
  add(`IFCRELAGGREGATES('${guid()}',$,$,$,${bld},(${storeys.join(',')}))`);
  const ts = new Date().toISOString().slice(0, 19);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');\nFILE_NAME(${str(P.name + '.ifc')},'${ts}',(''),(''),'Trait de Plan','Trait de Plan','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${E.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}

/* ---------- tableaux CSV (s\u00e9parateur ; pour Excel en fran\u00e7ais) ---------- */
function csv(rows) { return '\ufeff' + rows.map(r => r.map(v => { const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n'); }
function csvRooms(P, S) { const rows = [['Niveau', 'Pi\u00e8ce', 'Type', 'Rev\u00eatement', 'Surface (m\u00b2)', 'Surface nette (m\u00b2)', 'P\u00e9rim\u00e8tre (m)', 'Hauteur (m)', 'Volume (m\u00b3)', 'Habitable']]; for (const r of S.rooms) rows.push([r.level, r.name, TP.ROOMTYPES[r.type] || '', MATS[r.mat] ? MATS[r.mat].n : '', r.area / 1e4, r.net / 1e4, r.per / 100, r.h / 100, r.vol / 1e6, r.hab ? 'oui' : 'non']); rows.push([]); rows.push(['', 'Surface habitable', '', '', '', S.hab / 1e4]); rows.push(['', 'Emprise au sol', '', '', S.footprint / 1e4]); return csv(rows); }
function csvOpenings(S) { const rows = [['Niveau', 'Type', 'Largeur (m)', 'Hauteur (m)', 'All\u00e8ge (m)', 'Surface (m\u00b2)']]; for (const o of S.openings) rows.push([o.level, o.n, o.w / 100, o.h / 100, o.sill / 100, o.area / 1e4]); return csv(rows); }
function csvQuantities(P, S) { const rows = [['Lot', 'Ouvrage', 'Quantit\u00e9', 'Unit\u00e9', 'Remarque']]; for (const q of S.quantities) rows.push([q.lot, q.item, q.val, q.unit, q.note]); rows.push([]); rows.push(['Estimation indicative', 'Gamme', TP.GAMMES[S.cost.gamme].n]); for (const l of S.cost.lots) rows.push(['Co\u00fbt', l.n, Math.round(l.v), '\u20ac']); rows.push(['Co\u00fbt', 'Total construction', Math.round(S.cost.build), '\u20ac', `fourchette ${Math.round(S.cost.low)} \u00e0 ${Math.round(S.cost.high)} \u20ac`]); rows.push(['Co\u00fbt', 'Mobilier', Math.round(S.cost.furn), '\u20ac']); rows.push(['Co\u00fbt', 'Prix au m\u00b2 habitable', Math.round(S.cost.perM2), '\u20ac/m\u00b2']); return csv(rows); }
function csvFurniture(P) { const rows = [['Niveau', 'Article', 'Largeur (cm)', 'Profondeur (cm)', 'Hauteur (cm)', 'Prix (\u20ac)']]; let t = 0; for (const lv of sortedLevels(P)) for (const f of lv.furn) { const d = fdesc(f, P); rows.push([lv.name, d.n, f.w, f.d, f.h, f.p || 0]); t += +f.p || 0; } rows.push(['', 'Total', '', '', '', t]); return csv(rows); }

Object.assign(TP, { zip, crc32, toDXF, toIFC, csv, csvRooms, csvOpenings, csvQuantities, csvFurniture, ifcGuid: guid });
})(typeof window !== 'undefined' ? window : globalThis);
