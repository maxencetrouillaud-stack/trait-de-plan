/* Trait de Plan \u2014 rendu 2D du plan (cha\u00eenes SVG). Utilise TP (core.js). Pas d'acc\u00e8s au DOM. */
(function (G) {
'use strict';
const TP = G.TP;
const { n2, esc, shade, wg, polyArea, centroid, bbox, isRect, rotPt, fmtLen, fmtArea, FURN, MATS, OPDEF, ROOFTYPES, isExt, stairInfo, roofSlope } = TP;

/* ---------- styles du plan ---------- */
const PLAN_CSS = `
.tech .fl{fill:none;stroke:var(--ink-2);stroke-opacity:.35}
.w-out{stroke:var(--wall-edge)}.w-in{stroke:var(--wall)}.lw-out{stroke:var(--wall-edge)}.lw-in{stroke:var(--low)}
.hedge{stroke:var(--hedge);opacity:.55}.hedge-c{fill:var(--hedge);opacity:.5}.fence{stroke:var(--fence)}.post{fill:var(--fence)}
.gap{fill:var(--paper)}.op{stroke:var(--ink);fill:none}.op-arc{stroke:var(--ink-2);fill:none}.op-gl{stroke:var(--glass);fill:none}
.fu{fill:var(--furn);stroke:var(--ink-2)}.fu-d{fill:none;stroke:var(--ink-2)}.fu-k{fill:var(--ink-2);stroke:none}.real .fu{stroke:rgba(20,24,30,.55)}.real .fu-d{stroke:rgba(20,24,30,.42)}
.st{fill:var(--paper);stroke:var(--ink)}.st-d{fill:none;stroke:var(--ink)}.st-a{fill:var(--ink)}.real .st{fill:#E9E2D4;stroke:#2A2F36}.real .st-d{stroke:#2A2F36}.real .st-a{fill:#2A2F36}
.lab{fill:var(--ink-2);font-family:var(--f-num)}.rlab{fill:var(--ink);font-family:var(--f-ui);font-weight:600}.rarea{fill:var(--ink-2);font-family:var(--f-num)}
.real .rlab{fill:#1A2029;paint-order:stroke;stroke:rgba(255,255,255,.75)}.real .rarea{fill:#3D4450;paint-order:stroke;stroke:rgba(255,255,255,.75)}
.dim-l{stroke:var(--dim)}.dim-t{fill:var(--dim);font-family:var(--f-num)}.adim-l{stroke:var(--dim);opacity:.85}.adim-t{fill:var(--dim);font-family:var(--f-num)}.txt{fill:var(--ink);font-family:var(--f-ui)}
.gh{stroke:var(--ink);opacity:.13}.hole{stroke:var(--ink);fill:none;opacity:.55}.gl1{stroke:var(--grid1)}.gl2{stroke:var(--grid2)}
.rf{stroke:var(--roof);fill:none}.rft{fill:var(--roof);font-family:var(--f-num)}.lot{stroke:var(--lot);fill:none}.lott{fill:var(--lot);font-family:var(--f-num)}
.hl{fill:none;stroke:var(--accent)}.hlf{fill:var(--accent);fill-opacity:.1;stroke:var(--accent)}.hd{fill:var(--paper);stroke:var(--accent)}
.pv{stroke:var(--accent);fill:none}.pvf{fill:var(--accent);fill-opacity:.08;stroke:var(--accent)}.pvt{fill:var(--accent);font-family:var(--f-num)}
.gd{stroke:var(--accent);fill:none}.gdt{fill:var(--accent);font-family:var(--f-num);paint-order:stroke;stroke:var(--paper)}.al{stroke:var(--align);fill:none}
.hl,.hlf,.hd,.pv,.pvf,.pvt,.gd,.gdt,.al,.gl1,.gl2{pointer-events:none}
.tech .w-in,.tech .w-out,.tech .lw-out{stroke:var(--ink)}.tech .lw-in{stroke:var(--paper)}
.tech .fu{fill:var(--paper);stroke:var(--ink)}.tech .fu-d{stroke:var(--ink)}.tech .hedge{stroke:var(--ink);opacity:.25}.tech .hedge-c{fill:none;stroke:var(--ink);opacity:.6}
.tech .fence,.tech .post{stroke:var(--ink);fill:var(--ink)}`;
const LIGHT = { '--paper': '#FBFCFA', '--ink': '#1A2029', '--ink-2': '#5A6370', '--wall': '#3E444D', '--wall-edge': '#1A1F25', '--low': '#8E949C', '--hedge': '#5E8F4B', '--fence': '#7A5C3E', '--glass': '#3C7FB0',
  '--furn': '#FFFFFF', '--dim': '#A15800', '--accent': '#2347C6', '--align': '#C2410C', '--roof': '#8A3B12', '--lot': '#4F7A2E', '--grid1': 'rgba(26,32,41,.05)', '--grid2': 'rgba(26,32,41,.11)', '--f-num': 'Menlo, Consolas, monospace', '--f-ui': 'Helvetica, Arial, sans-serif' };
const EXPORT_CSS = PLAN_CSS.replace(/var\((--[\w-]+)\)/g, (m, k) => LIGHT[k] || '#000');

/* ---------- motifs de sols ---------- */
function matPattern(k) {
  const m = MATS[k], c = m.c, dk = shade(c, -.22), lt = shade(c, .08), id = 'm-' + k;
  switch (m.tex) {
    case 'planks': return `<pattern id="${id}" width="120" height="40" patternUnits="userSpaceOnUse"><rect width="120" height="40" fill="${c}"/><rect width="120" height="20" fill="${lt}"/><path d="M0 0H120M0 20H120M0 40H120M0 0V20M60 20V40M95 0V20M25 20V40" stroke="${dk}" stroke-width="0.9" fill="none"/></pattern>`;
    case 'herring': return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${c}"/><path d="M0 20 20 0M20 40 40 20M0 0 20 20 0 40M20 0 40 20 20 40" stroke="${dk}" stroke-width=".8" fill="none"/></pattern>`;
    case 'tiles': { const t = m.k === 2 ? 60 : 50; return `<pattern id="${id}" width="${t}" height="${t}" patternUnits="userSpaceOnUse"><rect width="${t}" height="${t}" fill="${c}"/><path d="M${t} 0H0V${t}" stroke="${dk}" stroke-width="1.2" fill="none"/></pattern>`; }
    case 'tilesBig': return `<pattern id="${id}" width="120" height="60" patternUnits="userSpaceOnUse"><rect width="120" height="60" fill="${c}"/><path d="M120 0H0V60" stroke="${dk}" stroke-width="1" fill="none"/></pattern>`;
    case 'cement': return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${c}"/><path d="M10 2 18 10 10 18 2 10Z" fill="${shade(c, -.12)}"/><circle cx="10" cy="10" r="2.2" fill="#5E7184"/><path d="M20 0H0V20" stroke="${dk}" stroke-width=".6" fill="none"/></pattern>`;
    case 'marble': return `<pattern id="${id}" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="${c}"/><path d="M0 30C20 26 30 44 50 36S70 20 80 26M10 70C30 60 40 74 70 62" stroke="${shade(c, -.18)}" stroke-width=".8" fill="none"/><path d="M80 0H0V80" stroke="${shade(c, -.1)}" stroke-width=".6" fill="none"/></pattern>`;
    case 'flagstone': return `<pattern id="${id}" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="${c}"/><path d="M0 34 30 30 34 0M30 30 46 52 80 46M46 52 40 80M0 60 40 80" stroke="${dk}" stroke-width="1.2" fill="none"/></pattern>`;
    case 'noise': return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${c}"/><circle cx="7" cy="9" r="1" fill="${dk}" opacity=".5"/><circle cx="29" cy="15" r="1.3" fill="${lt}"/><circle cx="18" cy="31" r="1" fill="${dk}" opacity=".5"/><circle cx="35" cy="34" r=".9" fill="${lt}"/></pattern>`;
    case 'grass': return `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="${c}"/><path d="M5 12l2-5M14 25l1-5M22 9l2-4M26 22l-1-5" stroke="${dk}" stroke-width="1.1"/><path d="M9 20l1-4M19 15l2-4" stroke="${lt}" stroke-width="1.1"/></pattern>`;
    case 'gravel': return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${c}"/><circle cx="4" cy="5" r="2" fill="${dk}" opacity=".6"/><circle cx="13" cy="9" r="2.4" fill="${lt}"/><circle cx="8" cy="15" r="1.8" fill="${dk}" opacity=".5"/><circle cx="17" cy="17" r="1.6" fill="${lt}"/></pattern>`;
    case 'water': return `<pattern id="${id}" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="${c}"/><path d="M0 15c10-6 20 6 30 0s20 6 30 0" stroke="${lt}" stroke-width="2" fill="none"/></pattern>`;
  }
  return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${c}"/></pattern>`;
}
const MAT_DEFS = Object.keys(MATS).map(matPattern).join('');

/* ---------- symboles de mobilier (rep\u00e8re local : dos du meuble en -d/2) ---------- */
function furnShape(k, w, d, f, ctx) {
  const W = w / 2, D = d / 2;
  const R = (x, y, ww, hh, rx = 0, c = 'fu-d') => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(0, ww))}" height="${n2(Math.max(0, hh))}" rx="${n2(rx)}" class="${c}"/>`;
  const Ln = (a, b, c, e, cl = 'fu-d') => `<line x1="${n2(a)}" y1="${n2(b)}" x2="${n2(c)}" y2="${n2(e)}" class="${cl}"/>`;
  const C = (x, y, r, c = 'fu-d') => `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(Math.max(0, r))}" class="${c}"/>`;
  const E = (x, y, rx, ry, c = 'fu-d') => `<ellipse cx="${n2(x)}" cy="${n2(y)}" rx="${n2(Math.max(0, rx))}" ry="${n2(Math.max(0, ry))}" class="${c}"/>`;
  const body = R(-W, -D, w, d, Math.min(4, w * .05), 'fu');
  const chairsAround = round => { let s = ''; if (round) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, r = W + 16; s += `<g transform="translate(${n2(Math.cos(a) * r)} ${n2(Math.sin(a) * r)}) rotate(${i * 90 + 90})">` + R(-20, -14, 40, 28, 4, 'fu') + '</g>'; } return s; }
    const n = Math.max(1, Math.round(w / 60)); for (let i = 0; i < n; i++) { const x = -W + w * (i + .5) / n; s += R(x - 20, -D - 30, 40, 26, 4, 'fu') + R(x - 20, D + 4, 40, 26, 4, 'fu'); } if (w <= 200) s += R(-W - 30, -20, 26, 40, 4, 'fu') + R(W + 4, -20, 26, 40, 4, 'fu'); return s; };
  switch (k) {
    case 'bed2': case 'bed1': { const n = w > 120 ? 2 : 1; let s = body + R(-W, -D, w, 8, 2, 'fu'); for (let i = 0; i < n; i++) s += R(-W + 8 + i * (w - 16) / n, -D + 12, (w - 16) / n - (n > 1 ? 6 : 0), 28, 6); return s + Ln(-W, -D + 58, W, -D + 58) + Ln(-W, -D + 70, W, -D + 70); }
    case 'sofa': return body + R(-W, -D, w, d * .26, 3) + R(-W, -D, w * .09, d, 3) + R(W - w * .09, -D, w * .09, d, 3) + Ln(-w * .137, -D + d * .26, -w * .137, D) + Ln(w * .137, -D + d * .26, w * .137, D);
    case 'sofaL': { const s = 92; return `<path d="M${-W} ${-D}H${W}V${D}H${W - s}V${-D + s}H${-W}Z" class="fu"/>` + R(-W, -D, w, 22, 3) + R(W - 22, -D, 22, d, 3) + R(-W, -D, 18, s, 3) + Ln(-W / 3, -D + 22, -W / 3, -D + s) + Ln(W / 3, -D + 22, W / 3, -D + s) + Ln(W - s, -D + s + 50, W - 22, -D + s + 50); }
    case 'arm': return body + R(-W, -D, w, d * .26, 3) + R(-W, -D, w * .17, d, 3) + R(W - w * .17, -D, w * .17, d, 3);
    case 'coffee': return R(-W, -D, w, d, 8, 'fu') + R(-W + 7, -D + 7, w - 14, d - 14, 5);
    case 'tv': return body + R(-W * .72, -D + 6, w * .72, 4, 1, 'fu');
    case 'book': { let s = body; for (let i = 1; i < 4; i++) s += Ln(-W + w * i / 4, -D, -W + w * i / 4, D); return s; }
    case 'rug': return R(-W, -D, w, d, 2, 'fu') + R(-W + 10, -D + 10, w - 20, d - 20, 2);
    case 'lamp': return C(0, 0, W, 'fu') + C(0, 0, W * .45);
    case 'pendant': return C(0, 0, W, 'fu') + Ln(-W, 0, W, 0) + Ln(0, -W, 0, W);
    case 'tlamp': return C(0, 0, W, 'fu') + C(0, 0, W * .35);
    case 'sconce': return body + `<path d="M${-W} ${D} A${W} ${W} 0 0 0 ${W} ${D}" class="fu-d"/>`;
    case 'plant': case 'plant2': case 'bush': return C(0, 0, W, 'fu') + C(-W * .32, -W * .22, W * .38) + C(W * .3, -W * .25, W * .36) + C(0, W * .33, W * .38);
    case 'frame': case 'mirror': return R(-W, -D, w, d, 0, 'fu') + Ln(-W, D + 3, W, D + 3);
    case 'vase': return C(0, 0, W, 'fu') + C(0, 0, W * .5);
    case 'table6': case 'table4': case 'gtable': return chairsAround(false) + body;
    case 'tround': return chairsAround(true) + C(0, 0, W, 'fu') + C(0, 0, W * .15);
    case 'chair': return body + R(-W, -D, w, 7, 2);
    case 'buffet': return body + Ln(-W / 3, -D + 4, -W / 3, D) + Ln(W / 3, -D + 4, W / 3, D) + Ln(-W, D - 4, W, D - 4);
    case 'kitchen': return body + Ln(-W, D - 6, W, D - 6) + R(-W + 70, -D + 10, 60, 40, 7) + C(-W + 100, -D + 30, 3) + C(W - 74, -D + 20, 8) + C(W - 46, -D + 20, 8) + C(W - 74, -D + 42, 10) + C(W - 46, -D + 42, 10) + Ln(-W + 60, -D, -W + 60, D - 6) + Ln(W - 120, -D, W - 120, D - 6);
    case 'kitchenL': { const t = 62; return `<path d="M${-W} ${-D}H${W}V${-D + t}H${-W + t}V${D}H${-W}Z" class="fu"/>` + R(-W + 120, -D + 10, 60, 40, 7) + C(W - 60, -D + 20, 8) + C(W - 34, -D + 20, 8) + C(W - 60, -D + 42, 10) + C(W - 34, -D + 42, 10) + Ln(-W + t - 6, -D + t, -W + t - 6, D) + Ln(-W + t, -D + t - 6, W, -D + t - 6); }
    case 'island': return body + Ln(-W, D - 20, W, D - 20) + C(-W * .5, D + 18, 15, 'fu') + C(W * .5, D + 18, 15, 'fu');
    case 'fridge': case 'oven': return body + Ln(-W, D - 8, W, D - 8) + Ln(-W + 8, -D + 8, W - 8, D - 14) + Ln(W - 8, -D + 8, -W + 8, D - 14);
    case 'dishw': case 'washer': case 'dryer': return body + C(0, 4, W * .6) + Ln(-W, -D + 8, W, -D + 8);
    case 'stool': return C(0, 0, W, 'fu') + C(0, 0, W * .6);
    case 'night': return body + C(0, -3, 8) + Ln(-W, D - 5, W, D - 5);
    case 'ward': return body + Ln(-W, D - 8, W, D - 8) + `<line x1="${-W + 6}" y1="0" x2="${W - 6}" y2="0" class="fu-d" stroke-dasharray="6 5"/>` + Ln(0, 0, 0, D - 8);
    case 'dresser': return body + Ln(-W, D - 6, W, D - 6) + Ln(0, -D, 0, D - 6);
    case 'bath': return body + R(-W + 8, -D + 8, w - 16, d - 16, Math.min(30, d * .35)) + C(W - 26, 0, 4);
    case 'shower': return body + Ln(-W, -D, W, D) + Ln(W, -D, -W, D) + C(0, 0, 5, 'fu') + Ln(W - 2, -D, W - 2, D * .6);
    case 'wc': return R(-W, -D, w, 14, 3, 'fu') + E(0, -D + 14 + (d - 14) / 2, W - 2, (d - 14) / 2 - 1, 'fu') + E(0, -D + 14 + (d - 14) / 2, W - 9, (d - 14) / 2 - 8);
    case 'vanity': return body + E(0, 3, W - 14, D - 12) + C(0, -D + 8, 2.5, 'fu');
    case 'vanity2': return body + E(-W / 2, 3, W / 2 - 14, D - 12) + E(W / 2, 3, W / 2 - 14, D - 12);
    case 'desk': return body + Ln(-W + 6, -D + 8, W - 6, -D + 8) + R(-30, -D + 6, 60, 4, 1, 'fu');
    case 'ochair': return C(0, 4, W * .8, 'fu') + R(-W * .7, -D, w * .7, 10, 5, 'fu');
    case 'shelf': return body + Ln(-W, 0, W, 0);
    case 'lounger': return body + Ln(-W, -D + d * .32, W, -D + d * .32) + R(-W + 6, -D + 6, w - 12, d * .26, 6);
    case 'parasol': { let s = `<circle r="${n2(W)}" class="fu" fill-opacity=".45"/>`; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += Ln(0, 0, Math.cos(a) * W, Math.sin(a) * W); } return s + C(0, 0, 4, 'fu'); }
    case 'tree': { let s = C(0, 0, W, 'fu'); for (let i = 0; i < 7; i++) { const a = i * 2 * Math.PI / 7; s += C(Math.cos(a) * W * .55, Math.sin(a) * W * .55, W * .32); } return s + C(0, 0, W * .08, 'fu'); }
    case 'tree2': return C(0, 0, W, 'fu') + C(0, 0, W * .66) + C(0, 0, W * .33) + C(0, 0, W * .08, 'fu');
    case 'pine': case 'cypress': return C(0, 0, W, 'fu') + C(0, 0, W * .5) + C(0, 0, W * .08, 'fu');
    case 'birch': case 'olive': case 'fruit': { let s = C(0, 0, W, 'fu'); for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 + .3; s += C(Math.cos(a) * W * .5, Math.sin(a) * W * .5, W * .36); } return s + C(0, 0, W * .07, 'fu'); }
    case 'palm': { let s = C(0, 0, W * .12, 'fu'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += `<path d="M0 0Q${n2(Math.cos(a + .35) * W * .55)} ${n2(Math.sin(a + .35) * W * .55)} ${n2(Math.cos(a) * W)} ${n2(Math.sin(a) * W)}" class="fu-d" fill="none"/>`; } return s; }
    case 'flowers': case 'grassTuft': { let s = E(0, 0, W, D, 'fu'); for (let i = 0; i < 6; i++) { const a = i * 1.1; s += C(Math.cos(a) * W * .5, Math.sin(a) * D * .5, Math.min(W, D) * .16); } return s; }
    case 'rock': case 'rockBig': return `<path d="M${n2(-W)} ${n2(D * .2)}L${n2(-W * .55)} ${n2(-D)}L${n2(W * .4)} ${n2(-D * .85)}L${n2(W)} ${n2(D * .1)}L${n2(W * .35)} ${n2(D)}L${n2(-W * .6)} ${n2(D * .85)}Z" class="fu"/>` + Ln(-W * .55, -D, -W * .1, D * .1) + Ln(-W * .1, D * .1, W, D * .1);
    case 'ledStrip': case 'ledStripExt': case 'underCab': return R(-W, -D, w, d, 1, 'fu') + `<line x1="${n2(-W)}" y1="0" x2="${n2(W)}" y2="0" class="fu-d" stroke-dasharray="4 3"/>`;
    case 'railSpots': { let s = R(-W, -D, w, d, 1, 'fu'); const n = Math.max(2, Math.round(w / 40)); for (let i = 0; i < n; i++) { const x = -W + w * (i + .5) / n; s += C(x, 0, Math.min(D, 5)); } return s; }
    case 'spotSol': case 'borne': case 'projo': case 'applExt': case 'lampPost': case 'gateLight': case 'terraceLight': case 'poolLight': case 'stepLight': case 'uplight': case 'garageLight': case 'plafonnier': case 'spotPlaf': { const r = Math.min(W, D); return C(0, 0, r, 'fu') + Ln(-r * .7, -r * .7, r * .7, r * .7) + Ln(r * .7, -r * .7, -r * .7, r * .7); }
    case 'bench': return body + Ln(-W, -D + 10, W, -D + 10);
    case 'planter': return body + R(-W + 8, -D + 8, w - 16, d - 16, 2) + Ln(-W + 30, 0, W - 30, 0);
    case 'shed': return body + Ln(-W, 0, W, 0) + R(-25, D - 4, 50, 4, 0, 'fu');
    case 'car': case 'suv': return R(-W, -D, w, d, 30, 'fu') + R(-W + 16, -D + d * .27, w - 32, d * .15, 10) + R(-W + 16, D - d * .3, w - 32, d * .12, 10) + Ln(-W + 12, -D + d * .45, W - 12, -D + d * .45);
    case 'bike': return C(0, -D + 33, 30) + C(0, D - 33, 30) + Ln(0, -D + 33, 0, D - 33) + Ln(-22, -D + 50, 22, -D + 50);
    case 'pool': case 'poolS': return R(-W, -D, w, d, 4, 'fu') + `<rect x="${n2(-W + 30)}" y="${n2(-D + 30)}" width="${n2(w - 60)}" height="${n2(d - 60)}" rx="6" fill="url(#m-water)" class="fu-d"/>` + Ln(-W + 30, -D + 30 + 60, -W + 90, -D + 30 + 60) + Ln(-W + 30, -D + 30 + 90, -W + 90, -D + 30 + 90);
    case 'spa': return R(-W, -D, w, d, 24, 'fu') + `<rect x="${n2(-W + 18)}" y="${n2(-D + 18)}" width="${n2(w - 36)}" height="${n2(d - 36)}" rx="20" fill="url(#m-water)" class="fu-d"/>`;
    case 'fireplace': return body + R(-W * .55, -D + 6, w * .55 * 2, d * .55, 3) + R(-20, -D - 10, 40, 22, 0, 'fu-k');
    case 'balcony': return `<rect x="${n2(-W)}" y="${n2(-D)}" width="${n2(w)}" height="${n2(d)}" class="fu" fill-opacity=".6"/>` + `<path d="M${-W} ${-D}V${D}H${W}V${-D}" class="fu-d" stroke-width="3"/>`;
    case 'column': return R(-W, -D, w, d, 0, 'fu-k');
    case 'stairs': case 'stairsL': case 'spiral': return stairShape(k, w, d, f, ctx);
    case 'model': return body + Ln(-W, -D, W, D) + Ln(W, -D, -W, D) + `<text x="0" y="0" font-size="${n2(Math.min(w, d) * .22)}" text-anchor="middle" dominant-baseline="middle" class="lab">3D</text>`;
    default: return body;
  }
}
function stairShape(k, w, d, f, ctx) {
  const W = w / 2, D = d / 2; const info = ctx && ctx.P ? stairInfo(ctx.P, ctx.lv, f || { type: k, w, d }) : { n: 16 };
  const Ln = (a, b, c, e, cl = 'st-d') => `<line x1="${n2(a)}" y1="${n2(b)}" x2="${n2(c)}" y2="${n2(e)}" class="${cl}"/>`;
  const arrow = (pts) => { const a = pts[pts.length - 2], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, s = Math.min(14, W * .4); return `<polyline points="${pts.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ')}" class="st-d"/><path d="M${n2(b[0])} ${n2(b[1])}L${n2(b[0] - ux * s - uy * s * .5)} ${n2(b[1] - uy * s + ux * s * .5)}L${n2(b[0] - ux * s + uy * s * .5)} ${n2(b[1] - uy * s - ux * s * .5)}Z" class="st-a"/><circle cx="${n2(pts[0][0])}" cy="${n2(pts[0][1])}" r="${n2(s * .35)}" class="st-a"/>`; };
  const n = info.n;
  if (k === 'spiral') { let s = `<circle r="${n2(W)}" class="st"/><circle r="${n2(Math.max(5, W * .08))}" class="st-a"/>`; const tot = Math.PI * 2 * .85; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + tot * i / n; s += Ln(Math.cos(a) * W * .08, Math.sin(a) * W * .08, Math.cos(a) * W, Math.sin(a) * W); } const pts = []; for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + tot * i / 20; pts.push([Math.cos(a) * W * .6, Math.sin(a) * W * .6]); } return s + arrow(pts); }
  if (k === 'stairsL') { const sw = Math.min((f && f.sw) || 90, w, d); const L1 = d - sw, L2 = w - sw; const n1 = Math.max(2, Math.round(n * L1 / (L1 + L2))), n2_ = Math.max(2, n - n1); let s = `<path d="M${-W} ${-D}H${W}V${-D + sw}H${-W + sw}V${D}H${-W}Z" class="st"/>`;
    for (let i = 1; i < n1; i++) { const y = D - L1 * i / n1; s += Ln(-W, y, -W + sw, y); } s += Ln(-W, -D + sw, -W + sw, -D + sw); for (let i = 1; i < n2_; i++) { const x = -W + sw + L2 * i / n2_; s += Ln(x, -D, x, -D + sw); }
    return s + arrow([[-W + sw / 2, D - 12], [-W + sw / 2, -D + sw / 2], [W - 10, -D + sw / 2]]); }
  let s = `<rect x="${n2(-W)}" y="${n2(-D)}" width="${n2(w)}" height="${n2(d)}" class="st"/>`; for (let i = 1; i < n; i++) { const y = D - d * i / n; s += Ln(-W, y, W, y); }
  return s + arrow([[0, D - 12], [0, -D + 10]]);
}

/* ---------- ouvertures ---------- */
function openingSVG(op, w, lw) {
  const g = wg(w), hw = op.w / 2, t = w.t, cx = w.x1 + g.ux * op.pos, cy = w.y1 + g.uy * op.pos, sd = op.side || 1, hg = op.hinge || 1;
  const Pp = (a, b) => [n2(cx + g.ux * a + g.nx * b), n2(cy + g.uy * a + g.ny * b)];
  const L2 = (p, q, c = 'op', x = '') => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" class="${c}" ${x}/>`;
  const ht = t / 2 + lw * 1.3; let s = `<polygon points="${[Pp(-hw, -ht), Pp(hw, -ht), Pp(hw, ht), Pp(-hw, ht)].map(p => p.join(',')).join(' ')}" class="gap"/>`;
  s += L2(Pp(-hw, -t / 2), Pp(-hw, t / 2)) + L2(Pp(hw, -t / 2), Pp(hw, t / 2));
  const leaf = (hx, dir, len, glass) => { const pts = []; for (let i = 0; i <= 16; i++) { const th = i / 16 * Math.PI / 2; pts.push(Pp(hx + dir * len * Math.sin(th), sd * (t / 2 + len * Math.cos(th)))); }
    return L2(Pp(hx, sd * t / 2), Pp(hx, sd * (t / 2 + len)), glass ? 'op-gl' : 'op', `stroke-width="${lw * 2}"`) + `<polyline points="${pts.map(p => p.join(',')).join(' ')}" class="op-arc" stroke-width="${lw}"${glass ? ` stroke-dasharray="${n2(lw * 4)} ${n2(lw * 3)}"` : ''}/>`; };
  const da = `stroke-dasharray="${n2(lw * 6)} ${n2(lw * 4)}"`;
  const glassLines = () => { const gq = Math.max(lw, t * .12); return L2(Pp(-hw, -gq), Pp(hw, -gq), 'op-gl') + L2(Pp(-hw, gq), Pp(hw, gq), 'op-gl') + L2(Pp(-hw, -t / 2), Pp(hw, -t / 2), 'op-arc', `stroke-width="${lw}"`) + L2(Pp(-hw, t / 2), Pp(hw, t / 2), 'op-arc', `stroke-width="${lw}"`); };
  switch ((OPDEF[op.kind] || OPDEF.door).leaf) {
    case 'swing': s += leaf(-hw * hg, hg, op.w); break;
    case 'double': case 'gate': s += leaf(-hw, 1, hw) + leaf(hw, -1, hw); break;
    case 'french': s += glassLines() + leaf(-hw, 1, hw, true) + leaf(hw, -1, hw, true); break;
    case 'slide': s += L2(Pp(-hw * hg, sd * (t / 2 + 3)), Pp(hw * hg * .05, sd * (t / 2 + 3)), 'op', `stroke-width="${lw * 2.5}"`) + L2(Pp(-hw * .2 * hg, sd * (t / 2 + 10)), Pp(hw * .6 * hg, sd * (t / 2 + 10)), 'op-arc', `stroke-width="${lw}"`); break;
    case 'none': s += L2(Pp(-hw, 0), Pp(hw, 0), 'op-arc', `stroke-width="${lw * .8}" ${da}`); break;
    case 'garage': s += L2(Pp(-hw, 0), Pp(hw, 0), 'op', da) + L2(Pp(-hw, sd * (t / 2 + 40)), Pp(hw, sd * (t / 2 + 40)), 'op-arc', da + ` stroke-width="${lw}"`); break;
    case 'bay': { const o = Math.max(lw * 1.5, t * .18); s += L2(Pp(-hw, -t / 2), Pp(hw, -t / 2), 'op-arc', `stroke-width="${lw}"`) + L2(Pp(-hw, t / 2), Pp(hw, t / 2), 'op-arc', `stroke-width="${lw}"`) + L2(Pp(-hw, -o), Pp(hw * .12, -o), 'op-gl', `stroke-width="${lw * 2}"`) + L2(Pp(-hw * .12, o), Pp(hw, o), 'op-gl', `stroke-width="${lw * 2}"`); break; }
    case 'fixed': s += L2(Pp(-hw, 0), Pp(hw, 0), 'op-gl', `stroke-width="${lw * 1.8}"`) + L2(Pp(-hw, -t / 2), Pp(hw, -t / 2), 'op-arc', `stroke-width="${lw}"`) + L2(Pp(-hw, t / 2), Pp(hw, t / 2), 'op-arc', `stroke-width="${lw}"`); break;
    default: s += glassLines();
  }
  return s;
}
function dimSVG(d, lw, lab, cls) {
  cls = cls || 'dim'; const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); if (len < 1) return ''; const ux = (d.x2 - d.x1) / len, uy = (d.y2 - d.y1) / len, nx = -uy, ny = ux, k = lab * .45;
  const tk = (x, y) => `<line x1="${n2(x - (ux + nx) * k)}" y1="${n2(y - (uy + ny) * k)}" x2="${n2(x + (ux + nx) * k)}" y2="${n2(y + (uy + ny) * k)}" class="${cls}-l" stroke-width="${lw * 1.4}"/>`;
  let ang = Math.atan2(uy, ux) * 180 / Math.PI; if (ang > 90 || ang <= -90) ang += 180; const mx = (d.x1 + d.x2) / 2 + nx * lab * .75, my = (d.y1 + d.y2) / 2 + ny * lab * .75;
  return `<line x1="${n2(d.x1)}" y1="${n2(d.y1)}" x2="${n2(d.x2)}" y2="${n2(d.y2)}" class="${cls}-l" stroke-width="${lw}"/>` + tk(d.x1, d.y1) + tk(d.x2, d.y2) +
    `<text x="${n2(mx)}" y="${n2(my)}" class="${cls}-t" font-size="${n2(lab)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${n2(ang)} ${n2(mx)} ${n2(my)})">${fmtLen(len)}</text>`;
}
// cotes ext\u00e9rieures automatiques : cha\u00eene + cote totale sur les fa\u00e7ades haute et gauche
function autoDimsSVG(lv, lw, lab, scr) {
  const ext = lv.walls.filter(w => w.kind === 'wall' && TP.wallSides(lv, w).exterior); if (!ext.length) return '';
  const pts = ext.flatMap(w => [[w.x1, w.y1], [w.x2, w.y2]]); const b = bbox(pts); const tmax = Math.max(...ext.map(w => w.t)) / 2; let s = '';
  const off1 = tmax + lab * 3.2, off2 = tmax + lab * 6;
  const xs = [...new Set(ext.filter(w => Math.abs(w.y1 - b.y0) < 2 && Math.abs(w.y2 - b.y0) < 2).flatMap(w => [Math.round(w.x1), Math.round(w.x2)]))].sort((p, q) => p - q);
  const ys = [...new Set(ext.filter(w => Math.abs(w.x1 - b.x0) < 2 && Math.abs(w.x2 - b.x0) < 2).flatMap(w => [Math.round(w.y1), Math.round(w.y2)]))].sort((p, q) => p - q);
  // ajoute les ouvertures de la fa\u00e7ade haute comme points de cha\u00eene
  for (const op of lv.open) { const w = lv.walls.find(x => x.id === op.wall); if (!w || !ext.includes(w)) continue; const g = wg(w); const c = [w.x1 + g.ux * op.pos, w.y1 + g.uy * op.pos]; if (Math.abs(c[1] - b.y0) < 2 && Math.abs(g.uy) < .01) { xs.push(Math.round(c[0] - op.w / 2), Math.round(c[0] + op.w / 2)); } if (Math.abs(c[0] - b.x0) < 2 && Math.abs(g.ux) < .01) { ys.push(Math.round(c[1] - op.w / 2), Math.round(c[1] + op.w / 2)); } }
  const ux = [...new Set(xs)].sort((p, q) => p - q), uy = [...new Set(ys)].sort((p, q) => p - q);
  const fits = len => !scr || len * scr >= 34; const chain = d => fits(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)) ? dimSVG(d, lw, lab * .9, 'adim') : dimSVG(d, lw, lab * .9, 'adim').replace(/<text[^>]*>[^<]*<\/text>/, '');
  if (!scr || (b.x1 - b.x0) * scr > 160) for (let i = 0; i < ux.length - 1; i++) if (ux[i + 1] - ux[i] > 4) s += chain({ x1: ux[i], y1: b.y0 - off1, x2: ux[i + 1], y2: b.y0 - off1 });
  if (!scr || (b.y1 - b.y0) * scr > 160) for (let i = 0; i < uy.length - 1; i++) if (uy[i + 1] - uy[i] > 4) s += chain({ x1: b.x0 - off1, y1: uy[i + 1], x2: b.x0 - off1, y2: uy[i] });
  s += dimSVG({ x1: b.x0, y1: b.y0 - off2, x2: b.x1, y2: b.y0 - off2 }, lw, lab, 'adim') + dimSVG({ x1: b.x0 - off2, y1: b.y1, x2: b.x0 - off2, y2: b.y0 }, lw, lab, 'adim');
  return s;
}
function roofSVG(rf, lw, lab) {
  const W = rf.w / 2 + (rf.over || 0), D = rf.d / 2 + (rf.over || 0); const P = (u, v) => { const p = rotPt(u, v, rf.r || 0); return n2(rf.x + p[0]) + ',' + n2(rf.y + p[1]); };
  const L = (a, b) => `<polyline points="${a} ${b}" class="rf" stroke-width="${lw * 1.2}"/>`; const da = `stroke-dasharray="${n2(lw * 7)} ${n2(lw * 4)}"`;
  let s = `<polygon points="${[P(-W, -D), P(W, -D), P(W, D), P(-W, D)].join(' ')}" class="rf" stroke-width="${lw * 1.2}" ${da}/>`;
  if (rf.type === 'gable') s += L(P(-W, 0), P(W, 0));
  else if (rf.type === 'hip') { if (rf.w >= rf.d) { const r = (rf.w - rf.d) / 2; s += L(P(-r, 0), P(r, 0)) + L(P(-W, -D), P(-r, 0)) + L(P(-W, D), P(-r, 0)) + L(P(W, -D), P(r, 0)) + L(P(W, D), P(r, 0)); } else { const r = (rf.d - rf.w) / 2; s += L(P(0, -r), P(0, r)) + L(P(-W, -D), P(0, -r)) + L(P(W, -D), P(0, -r)) + L(P(-W, D), P(0, r)) + L(P(W, D), P(0, r)); } }
  else if (rf.type === 'shed') { s += L(P(0, -D * .6), P(0, D * .6)) + `<polygon points="${P(-lab * .5, D * .6 - lab)} ${P(lab * .5, D * .6 - lab)} ${P(0, D * .6)}" class="rft"/>`; }
  else { const i = (rf.over || 0) + 15; s += `<polygon points="${[P(-W + i, -D + i), P(W - i, -D + i), P(W - i, D - i), P(-W + i, D - i)].join(' ')}" class="rf" stroke-width="${lw}"/>`; }
  const c = P(0, rf.type === 'gable' ? D * .45 : 0).split(','); s += `<text x="${c[0]}" y="${c[1]}" class="rft" font-size="${n2(lab * .9)}" text-anchor="middle" dominant-baseline="middle">${ROOFTYPES[rf.type]}${rf.type === 'flat' ? '' : ' \u00b7 ' + rf.pitch + '\u00b0'}</text>`;
  return s;
}
function terrainSVG(P, lw, lab) {
  const t = P.terrain; if (!t) return ''; const cs = TP.lotCorners ? TP.lotCorners(P) : [[t.x - t.w / 2, t.y - t.d / 2], [t.x + t.w / 2, t.y - t.d / 2], [t.x + t.w / 2, t.y + t.d / 2], [t.x - t.w / 2, t.y + t.d / 2]];
  const r = (t.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); let s = '';
  const tr = `matrix(${n2(c)} ${n2(sn)} ${n2(-sn)} ${n2(c)} ${n2(t.x)} ${n2(t.y)})`;
  // sol peint : bandes horizontales fusionn\u00e9es par couleur
  const pg = t.paint; if (pg && Array.isArray(pg.data) && TP.PAINT_KEYS) { const byCode = {}; for (let j = 0; j < pg.ny; j++) { let i = 0; while (i < pg.nx) { const k = pg.data[j * pg.nx + i] | 0; if (!k) { i++; continue; } let e = i; while (e + 1 < pg.nx && (pg.data[j * pg.nx + e + 1] | 0) === k) e++; (byCode[k] = byCode[k] || []).push(`M${n2(pg.u0 + (i - .5) * pg.cell)} ${n2(pg.v0 + (j - .5) * pg.cell)}h${n2((e - i + 1) * pg.cell)}v${n2(pg.cell)}h${n2(-(e - i + 1) * pg.cell)}z`); i = e + 1; } }
    for (const [k, d] of Object.entries(byCode)) { const G = TP.GROUNDS[TP.PAINT_KEYS[k - 1]] || {}; s += `<path d="${d.join('')}" fill="${G.c || '#999'}" fill-opacity=".55" transform="${tr}"/>`; } }
  // modelage : relief ombr\u00e9 et courbes de niveau
  const hf = t.hf; if (hf && Array.isArray(hf.data)) { let mx = 0; for (const v of hf.data) mx = Math.max(mx, Math.abs(v)); if (mx > 4) { const st = mx > 600 ? 100 : mx > 200 ? 50 : 25; let sh = ''; const A = (i, j) => hf.data[j * hf.nx + i];
      for (let j = 0; j < hf.ny; j++) for (let i = 0; i < hf.nx; i++) { const v = A(i, j); if (Math.abs(v) < 4) continue; const a = Math.min(.45, Math.abs(v) / mx * .45); sh += `<rect x="${n2(hf.u0 + (i - .5) * hf.cell)}" y="${n2(hf.v0 + (j - .5) * hf.cell)}" width="${hf.cell}" height="${hf.cell}" fill="${v > 0 ? '#9A6B3A' : '#3A6F9A'}" fill-opacity="${n2(a)}"/>`; }
      let cl = ''; const P0 = (i, j) => [hf.u0 + i * hf.cell, hf.v0 + j * hf.cell];
      for (let lev = -Math.floor(mx / st) * st; lev <= mx; lev += st) { if (!lev) continue; for (let j = 0; j < hf.ny - 1; j++) for (let i = 0; i < hf.nx - 1; i++) { const q = [A(i, j), A(i + 1, j), A(i + 1, j + 1), A(i, j + 1)], cn = [P0(i, j), P0(i + 1, j), P0(i + 1, j + 1), P0(i, j + 1)]; const pts = [];
          for (let e = 0; e < 4; e++) { const a = q[e], b = q[(e + 1) % 4]; if ((a < lev) !== (b < lev)) { const f = (lev - a) / (b - a), p = cn[e], p2 = cn[(e + 1) % 4]; pts.push([p[0] + (p2[0] - p[0]) * f, p[1] + (p2[1] - p[1]) * f]); } }
          if (pts.length >= 2) cl += `M${n2(pts[0][0])} ${n2(pts[0][1])}L${n2(pts[1][0])} ${n2(pts[1][1])}`; if (pts.length === 4) cl += `M${n2(pts[2][0])} ${n2(pts[2][1])}L${n2(pts[3][0])} ${n2(pts[3][1])}`; } }
      s += `<g transform="${tr}">${sh}${cl ? `<path d="${cl}" fill="none" stroke="#7A5A34" stroke-opacity=".7" stroke-width="${n2(lw)}"/>` : ''}</g>`; } }
  s += `<polygon points="${cs.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ')}" class="lot" stroke-width="${lw * 1.5}" stroke-dasharray="${n2(lw * 14)} ${n2(lw * 4)} ${n2(lw * 2)} ${n2(lw * 4)}"/>`;
  const top = cs.reduce((a, b) => (b[1] < a[1] ? b : a), cs[0]);
  s += `<text x="${n2(top[0] + lab)}" y="${n2(top[1] - lab * .8)}" class="lott" font-size="${n2(lab)}">Terrain ${fmtLen(t.w, true)} \u00d7 ${fmtLen(t.d, true)} \u00b7 ${fmtArea(t.w * t.d)}${t.slope ? ` \u00b7 pente ${t.slope} % vers le ${t.dir}` : ''}${t.rot ? ` \u00b7 ${t.rot}\u00b0` : ''}</text>`;
  return s;
}

/* ---------- rendu d'un niveau ---------- */
function wallLine(w, cls, sw, cap) { return `<line x1="${n2(w.x1)}" y1="${n2(w.y1)}" x2="${n2(w.x2)}" y2="${n2(w.y2)}" class="${cls}" stroke-width="${n2(sw)}" stroke-linecap="${cap || 'square'}"/>`; }
function renderLevel(P, lv, o) {
  const lw = o.lw, lab = o.lab, real = P.mode !== 'tech'; let s = '';
  if (o.terrain && P.terrain) s += terrainSVG(P, lw, lab);
  const rooms = [...lv.rooms].sort((a, b) => (isExt(b) ? 1 : 0) - (isExt(a) ? 1 : 0) || polyArea(b.pts) - polyArea(a.pts));
  s += `<g stroke-width="${lw}">`; for (const r of rooms) if (r.pts.length >= 3) s += `<polygon points="${r.pts.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ')}" class="fl" fill="url(#m-${MATS[r.mat] ? r.mat : 'oak'})" data-room="${r.id}"/>`; s += '</g>';
  if (o.ghost) s += '<g>' + o.ghost.walls.filter(w => w.kind === 'wall').map(w => wallLine(w, 'gh', w.t)).join('') + '</g>';
  if (o.holes) for (const h of o.holes) s += `<polygon points="${h.map(p => n2(p[0]) + ',' + n2(p[1])).join(' ')}" class="hole" stroke-width="${lw * 1.4}" stroke-dasharray="${n2(lw * 6)} ${n2(lw * 3)}"/><line x1="${n2(h[0][0])}" y1="${n2(h[0][1])}" x2="${n2(h[2] ? h[2][0] : h[0][0])}" y2="${n2(h[2] ? h[2][1] : h[0][1])}" class="hole" stroke-width="${lw}"/>`;
  const by = k => lv.walls.filter(w => w.kind === k);
  for (const w of by('hedge')) { const g = wg(w); s += wallLine(w, 'hedge', w.t, 'round'); const step = Math.max(10, w.t * .6), n = Math.floor(g.len / step); for (let i = 0; i <= n; i++) { const t = i * step + ((i % 2) ? step * .15 : 0); if (t > g.len) break; s += `<circle cx="${n2(w.x1 + g.ux * t)}" cy="${n2(w.y1 + g.uy * t)}" r="${n2(w.t * (.38 + ((i * 37) % 7) / 40))}" class="hedge-c" stroke-width="${lw}"/>`; } }
  for (const w of by('fence')) { const g = wg(w); s += wallLine(w, 'fence', Math.max(lw * 1.6, w.t * .5), 'butt'); const n = Math.max(1, Math.round(g.len / 200)); for (let i = 0; i <= n; i++) { const t = g.len * i / n; s += `<rect x="${n2(w.x1 + g.ux * t - w.t)}" y="${n2(w.y1 + g.uy * t - w.t)}" width="${n2(w.t * 2)}" height="${n2(w.t * 2)}" class="post"/>`; } }
  s += by('low').map(w => wallLine(w, 'lw-out', w.t + lw * 2.2)).join('') + by('low').map(w => wallLine(w, 'lw-in', w.t)).join('');
  const mw = by('wall'); s += mw.map(w => wallLine(w, 'w-out', w.t + lw * 2.2)).join('') + mw.map(w => wallLine(w, 'w-in', w.t)).join('');
  s += `<g stroke-width="${lw * 1.3}">`; for (const op of lv.open) { const w = lv.walls.find(x => x.id === op.wall); if (w) s += openingSVG(op, w, lw); } s += '</g>';
  s += `<g stroke-width="${lw}">`;
  const ctx = { P, lv };
  for (const f of [...lv.furn].sort((a, b) => ((a.h || 0) + (a.z || 0)) - ((b.h || 0) + (b.z || 0)))) { let sh = furnShape(f.type, f.w, f.d, f, ctx); if (real && f.c && !TP.isStair(f)) sh = sh.replace(/class="fu"/g, `class="fu" style="fill:${f.c}"`); s += `<g transform="translate(${n2(f.x)} ${n2(f.y)}) rotate(${f.r || 0})" data-furn="${f.id}">${sh}</g>`; }
  s += '</g>';
  for (const r of lv.rooms) { if (r.pts.length < 3) continue; const a = polyArea(r.pts); if (a < 2500) continue; const [cx, cy] = centroid(r.pts); const b = bbox(r.pts); const small = Math.min(b.w, b.h) < lab * 6;
    const px = Math.min(b.w, b.h) * o.scr, pxw = b.w * o.scr; if (px < 26 || pxw < (String(r.name || '').length * 5.5)) continue;
    const fs = small ? lab * .85 : lab * 1.12; s += `<text x="${n2(cx)}" y="${n2(cy - lab * .2)}" class="rlab" font-size="${n2(fs)}" stroke-width="${n2(lab * .28)}" text-anchor="middle">${esc(r.name || '')}</text>` + (px >= 44 ? `<text x="${n2(cx)}" y="${n2(cy + lab * .95)}" class="rarea" font-size="${n2(lab * .9)}" stroke-width="${n2(lab * .25)}" text-anchor="middle">${fmtArea(a)}</text>` : '');
    if (!small && isRect(r.pts) && o.scr * Math.min(b.w, b.h) > 90) s += `<text x="${n2(cx)}" y="${n2(cy + lab * 2)}" class="rarea" font-size="${n2(lab * .8)}" stroke-width="${n2(lab * .22)}" text-anchor="middle">${fmtLen(b.w)} \u00d7 ${fmtLen(b.h)}</text>`; }
  for (const d of lv.dims) s += dimSVG(d, lw, lab);
  if (o.autoDims) s += autoDimsSVG(lv, lw, lab, o.scr >= 999 ? 0 : o.scr);
  for (const w of lv.walls) { const g = wg(w); if (g.len < 30 || g.len * o.scr < 38) continue; const off = w.t / 2 + lab * .95; let ang = Math.atan2(g.uy, g.ux) * 180 / Math.PI; if (ang > 90 || ang <= -90) ang += 180;
    const mx = (w.x1 + w.x2) / 2 + g.nx * off, my = (w.y1 + w.y2) / 2 + g.ny * off; s += `<text x="${n2(mx)}" y="${n2(my)}" class="lab" font-size="${n2(lab)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${n2(ang)} ${n2(mx)} ${n2(my)})" data-wl="${w.id}">${fmtLen(g.len)}</text>`; }
  for (const t of lv.texts) s += `<text x="${n2(t.x)}" y="${n2(t.y)}" class="txt" font-size="${t.fs}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${t.r || 0} ${n2(t.x)} ${n2(t.y)})">${esc(t.s)}</text>`;
  if (o.roofs) for (const rf of lv.roofs) s += roofSVG(rf, lw, lab);
  return s;
}
function levelBounds(P, lv, m) {
  m = m == null ? 60 : m; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const add = (x, y, k = 0) => { x0 = Math.min(x0, x - k); y0 = Math.min(y0, y - k); x1 = Math.max(x1, x + k); y1 = Math.max(y1, y + k); };
  lv.walls.forEach(w => { add(w.x1, w.y1, w.t); add(w.x2, w.y2, w.t); }); lv.rooms.forEach(r => r.pts.forEach(p => add(p[0], p[1]))); lv.furn.forEach(f => add(f.x, f.y, Math.max(f.w, f.d) / 2 + 30));
  lv.dims.forEach(d => { add(d.x1, d.y1, 40); add(d.x2, d.y2, 40); }); lv.texts.forEach(t => add(t.x, t.y, t.fs * String(t.s).length * .35 + 20)); lv.roofs.forEach(r => add(r.x, r.y, Math.max(r.w, r.d) / 2 + (r.over || 0)));
  if (P && P.terrain && lv.elev <= 0 && lv.elev >= (TP.sortedLevels(P).find(l => l.elev >= 0) || lv).elev) { const t = P.terrain; add(t.x - t.w / 2, t.y - t.d / 2); add(t.x + t.w / 2, t.y + t.d / 2); }
  if (!isFinite(x0)) return { x: -100, y: -100, w: 1200, h: 1000 }; return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}
function stairHoles(P, lv) { const below = TP.levelBelow(P, lv); return below ? below.furn.filter(TP.isStair).map(TP.stairOutline) : []; }
const isGroundLevel = (P, lv) => (TP.sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]).id === lv.id;
// SVG autonome d'un niveau (export PNG/SVG/PDF et vignettes)
function exportSVG(P, lv, opt) {
  const b = opt.bounds || levelBounds(P, lv, 60); const inner = renderLevel(P, lv, { lw: opt.lw, lab: opt.lab, scr: 999, ghost: null, autoDims: opt.autoDims, roofs: opt.roofs, terrain: opt.terrain && isGroundLevel(P, lv), holes: stairHoles(P, lv) });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n2(b.x)} ${n2(b.y)} ${n2(b.w)} ${n2(b.h)}" width="${Math.round(opt.wpx)}" height="${Math.round(opt.hpx)}"><defs>${MAT_DEFS}</defs><style>${EXPORT_CSS}</style>` + (opt.white ? `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#FFFFFF"/>` : '') + `<g class="${P.mode === 'tech' ? 'tech' : 'real'}">${inner}</g></svg>`;
}
function thumbSVG(P, w, h) { const lv = TP.sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]; const b = levelBounds({ terrain: null }, lv, 40); const s = Math.min(w / b.w, h / b.h); return exportSVG(Object.assign({}, P, { terrain: null }), lv, { lw: 1.6 / s, lab: 9 / s, wpx: w, hpx: h, white: true, autoDims: false, roofs: false, terrain: false, bounds: { x: b.x + b.w / 2 - w / s / 2, y: b.y + b.h / 2 - h / s / 2, w: w / s, h: h / s } }); }

Object.assign(TP, { PLAN_CSS, EXPORT_CSS, MAT_DEFS, matPattern, furnShape, openingSVG, dimSVG, autoDimsSVG, roofSVG, terrainSVG, renderLevel, levelBounds, stairHoles, exportSVG, thumbSVG, isGroundLevel });
})(typeof window !== 'undefined' ? window : globalThis);
