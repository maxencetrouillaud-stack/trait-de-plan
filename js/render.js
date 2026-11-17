/* Trait de Plan \u2014 moteur de rendu photor\u00e9aliste : lancer de rayons progressif (path tracing) sur GPU en WebGL2.
   Ind\u00e9pendant de Three.js : re\u00e7oit des triangles, des mat\u00e9riaux PBR, des lumi\u00e8res et un ciel ; produit une image HDR accumul\u00e9e. */
(function (G) {
'use strict';
const TP = G.TP = G.TP || {};
const TW = 2048, MAXL = 128;

/* ---------- cartes PBR d\u00e9riv\u00e9es (relief, normales, rugosit\u00e9) ---------- */
const NRM = { planks: 1.1, herring: 1.1, tiles: .9, tilesBig: .8, pavers: 1.6, cement: .5, marble: .12, flagstone: 2.4, stone: 2.8, noise: .7, render: 1.6, crepi: 3.2, concrete: .8, polished: .25, grass: 2.2, gravel: 3.2, soil: 2.6, water: 0, vboards: 1.8, brick: 2.8, rooftiles: 3.4, slate: 1.8, seam: 1.4, metal: .35, bark: 3, leaf: 1.2, rockface: 2.8, sand: 1.0, snow: .4, asphalt: .9, canopy: 1.5, field: 1.3 };
const RVAR = { planks: .25, herring: .25, tiles: .5, tilesBig: .5, pavers: .4, marble: .25, polished: .5, concrete: .35, brick: .3, metal: .5, seam: .3, asphalt: .3, rockface: .3 };
const pbrCache = new Map();
function pbrMaps(canvas, kind) {
  if (pbrCache.has(canvas)) return pbrCache.get(canvas);
  const S = canvas.width, x = canvas.getContext('2d'), src = x.getImageData(0, 0, S, S).data, n = S * S;
  const h = new Float32Array(n); for (let i = 0; i < n; i++) h[i] = (src[i * 4] * .3 + src[i * 4 + 1] * .59 + src[i * 4 + 2] * .11) / 255;
  // l\u00e9ger lissage pour \u00e9viter le bruit de pixel dans les normales
  const b = new Float32Array(n); for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) { const xm = (X + S - 1) % S, xp = (X + 1) % S, ym = (y + S - 1) % S, yp = (y + 1) % S; b[y * S + X] = (h[y * S + X] * 4 + h[y * S + xm] + h[y * S + xp] + h[ym * S + X] + h[yp * S + X]) / 8; }
  const st = (NRM[kind] != null ? NRM[kind] : 1) * 2.2, rv = RVAR[kind] != null ? RVAR[kind] : .3;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const nc = mk(), rc = mk(), nx = nc.getContext('2d'), rx = rc.getContext('2d'), nd = nx.createImageData(S, S), rd = rx.createImageData(S, S), nr = new Uint8Array(n * 4);
  for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const i = y * S + X, gx = (b[y * S + (X + 1) % S] - b[y * S + (X + S - 1) % S]) * st, gy = (b[((y + 1) % S) * S + X] - b[((y + S - 1) % S) * S + X]) * st;
    const il = 1 / Math.hypot(gx, gy, 1), vx = -gx * il, vy = gy * il, vz = il; const ro = Math.max(0, Math.min(1, .5 + (.5 - b[i]) * rv * 2));
    nd.data[i * 4] = (vx * .5 + .5) * 255; nd.data[i * 4 + 1] = (vy * .5 + .5) * 255; nd.data[i * 4 + 2] = (vz * .5 + .5) * 255; nd.data[i * 4 + 3] = 255;
    const rg = ro * 255; rd.data[i * 4] = rg; rd.data[i * 4 + 1] = rg; rd.data[i * 4 + 2] = rg; rd.data[i * 4 + 3] = 255;
    nr[i * 4] = nd.data[i * 4]; nr[i * 4 + 1] = nd.data[i * 4 + 1]; nr[i * 4 + 2] = rg; nr[i * 4 + 3] = 255;
  }
  nx.putImageData(nd, 0, 0); rx.putImageData(rd, 0, 0);
  const out = { normal: nc, rough: rc, nr, size: S, height: b }; pbrCache.set(canvas, out); return out;
}

/* ---------- BVH (SAH par casiers), construit sur le processeur ---------- */
function buildBVH(pos, n) {
  const bmin = new Float32Array(n * 3), bmax = new Float32Array(n * 3), cen = new Float32Array(n * 3), idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) { idx[i] = i; for (let a = 0; a < 3; a++) { const p0 = pos[i * 9 + a], p1 = pos[i * 9 + 3 + a], p2 = pos[i * 9 + 6 + a]; const lo = Math.min(p0, p1, p2), hi = Math.max(p0, p1, p2); bmin[i * 3 + a] = lo; bmax[i * 3 + a] = hi; cen[i * 3 + a] = (lo + hi) / 2; } }
  const nodes = new Float32Array(Math.max(1, n) * 2 * 8); let nn = 0; const NB = 12, cnt = new Int32Array(NB), bb = new Float32Array(NB * 6), la = new Float32Array(NB), ra = new Float32Array(NB);
  const area = (b, o) => { const dx = b[o + 3] - b[o], dy = b[o + 4] - b[o + 1], dz = b[o + 5] - b[o + 2]; return dx < 0 ? 0 : dx * dy + dy * dz + dz * dx; };
  function rec(s, e) {
    const me = nn++, o = me * 8; let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, c0 = [Infinity, Infinity, Infinity], c1 = [-Infinity, -Infinity, -Infinity];
    for (let i = s; i < e; i++) { const t = idx[i] * 3; if (bmin[t] < x0) x0 = bmin[t]; if (bmin[t + 1] < y0) y0 = bmin[t + 1]; if (bmin[t + 2] < z0) z0 = bmin[t + 2]; if (bmax[t] > x1) x1 = bmax[t]; if (bmax[t + 1] > y1) y1 = bmax[t + 1]; if (bmax[t + 2] > z1) z1 = bmax[t + 2]; for (let a = 0; a < 3; a++) { const c = cen[t + a]; if (c < c0[a]) c0[a] = c; if (c > c1[a]) c1[a] = c; } }
    nodes[o] = x0; nodes[o + 1] = y0; nodes[o + 2] = z0; nodes[o + 4] = x1; nodes[o + 5] = y1; nodes[o + 6] = z1;
    const count = e - s; if (count <= 4) { nodes[o + 3] = s; nodes[o + 7] = count; return me; }
    let ax = 0; if (c1[1] - c0[1] > c1[ax] - c0[ax]) ax = 1; if (c1[2] - c0[2] > c1[ax] - c0[ax]) ax = 2; const ext = c1[ax] - c0[ax]; let mid = -1;
    if (ext > 1e-9) {
      cnt.fill(0); for (let k = 0; k < NB; k++) { bb[k * 6] = bb[k * 6 + 1] = bb[k * 6 + 2] = Infinity; bb[k * 6 + 3] = bb[k * 6 + 4] = bb[k * 6 + 5] = -Infinity; }
      const sc = NB / ext * .9999;
      for (let i = s; i < e; i++) { const t = idx[i] * 3, k = ((cen[t + ax] - c0[ax]) * sc) | 0, q = k * 6; cnt[k]++; for (let a = 0; a < 3; a++) { if (bmin[t + a] < bb[q + a]) bb[q + a] = bmin[t + a]; if (bmax[t + a] > bb[q + 3 + a]) bb[q + 3 + a] = bmax[t + a]; } }
      const acc = new Float32Array(6); let c = 0; const lc = new Int32Array(NB);
      acc[0] = acc[1] = acc[2] = Infinity; acc[3] = acc[4] = acc[5] = -Infinity; for (let k = 0; k < NB - 1; k++) { for (let a = 0; a < 3; a++) { acc[a] = Math.min(acc[a], bb[k * 6 + a]); acc[3 + a] = Math.max(acc[3 + a], bb[k * 6 + 3 + a]); } c += cnt[k]; lc[k] = c; la[k] = area(acc, 0); }
      acc[0] = acc[1] = acc[2] = Infinity; acc[3] = acc[4] = acc[5] = -Infinity; for (let k = NB - 1; k > 0; k--) { for (let a = 0; a < 3; a++) { acc[a] = Math.min(acc[a], bb[k * 6 + a]); acc[3 + a] = Math.max(acc[3 + a], bb[k * 6 + 3 + a]); } ra[k - 1] = area(acc, 0); }
      let best = Infinity, bk = -1; for (let k = 0; k < NB - 1; k++) { if (!lc[k] || lc[k] === count) continue; const cost = la[k] * lc[k] + ra[k] * (count - lc[k]); if (cost < best) { best = cost; bk = k; } }
      if (bk >= 0) { let i = s, j = e - 1; while (i <= j) { const k = ((cen[idx[i] * 3 + ax] - c0[ax]) * sc) | 0; if (k <= bk) i++; else { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; j--; } } mid = i; }
    }
    if (mid <= s || mid >= e) { mid = (s + e) >> 1; const sub = Array.from(idx.subarray(s, e)).sort((p, q) => cen[p * 3 + ax] - cen[q * 3 + ax]); idx.set(sub, s); }
    rec(s, mid); const r = rec(mid, e); nodes[o + 3] = r; nodes[o + 7] = 0; return me;
  }
  if (n > 0) rec(0, n); else { nodes[7] = 0; nn = 1; }
  return { nodes: nodes.subarray(0, nn * 8), count: nn, idx };
}

/* ---------- shaders ---------- */
// Mat\u00e9riaux : 5 texels par mat\u00e9riau
//  M0 = alb\u00e9do.rgb, couche de texture (-1 : aucune)
//  M1 = rugosit\u00e9, m\u00e9tal, type (0 opaque, 1 verre, 2 eau, 3 feuillage), \u00e9chelle de texture
//  M2 = \u00e9mission.rgb, force des normales
//  M3 = teinte de transmission / absorption de l'eau (rgb), variation \u00e0 grande \u00e9chelle
//  M4 = m\u00e9t\u00e9o (0 aucune, 1 surface ext\u00e9rieure, 2 feuillage), eau naturelle (1), r\u00e9serve, r\u00e9serve
// Lumi\u00e8res (texture uLgt, 3 texels) : position + rayon, couleur + type, direction + cosinus du c\u00f4ne (-2 : omnidirectionnelle)
// Portails (m\u00eame texture, \u00e0 partir de uPB, 4 texels) : centre + aire, demi-c\u00f4t\u00e9 u, demi-c\u00f4t\u00e9 v, normale
const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }';
const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp sampler2DArray;
uniform sampler2D uTri, uAttr, uBvh, uMat, uLgt, uHdr; uniform sampler2DArray uAlb, uNr;
uniform vec2 uRes; uniform float uFrame, uAlpha, uPixAng, uClamp;
uniform vec3 uCamPos, uCamR, uCamU, uCamF; uniform vec4 uLens;
uniform vec3 uSunDir, uSunE, uSunRad, uSunGlow, uSkyZen, uSkyHor, uSkyGnd, uCloudCol, uFogCol, uWaterAbs, uWaterScat; uniform float uSunCos;
uniform vec4 uCloud, uClip, uFog, uWx, uWave, uSky2; uniform int uBounces, uNL, uNP, uPB;
out vec4 o;
const float PI = 3.14159265;
uint rs; float rnd(){ rs = rs*747796405u+2891336453u; uint w = ((rs >> ((rs>>28u)+4u)) ^ rs)*277803737u; w = (w>>22u)^w; return float(w>>8u)*(1.0/16777216.0); }
vec4 tf(sampler2D s, int i){ return texelFetch(s, ivec2(i & ${TW - 1}, i >> 11), 0); }
vec4 MT(int m, int k){ return tf(uMat, m*5+k); }
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float boxHit(vec3 ro, vec3 inv, vec3 mn, vec3 mx, float tmax){ vec3 t0=(mn-ro)*inv, t1=(mx-ro)*inv; vec3 a=min(t0,t1), b=max(t0,t1); float tn=max(max(a.x,a.y),max(a.z,0.0)), tx=min(min(b.x,b.y),min(b.z,tmax)); return tn<=tx ? tn : 1e30; }
float triHit(vec3 ro, vec3 rd, vec3 v0, vec3 e1, vec3 e2, out vec2 bc){ vec3 p=cross(rd,e2); float det=dot(e1,p); if(abs(det)<1e-14) return -1.0; float inv=1.0/det; vec3 s=ro-v0; float u=dot(s,p)*inv; if(u<0.0||u>1.0) return -1.0; vec3 q=cross(s,e1); float v=dot(rd,q)*inv; if(v<0.0||u+v>1.0) return -1.0; bc=vec2(u,v); return dot(e2,q)*inv; }
vec3 safeDir(vec3 d){ return vec3(abs(d.x)<1e-8?1e-8:d.x, abs(d.y)<1e-8?1e-8:d.y, abs(d.z)<1e-8?1e-8:d.z); }
bool clipped(vec3 p){ return uClip.w < 1e20 && dot(uClip.xyz, p) + uClip.w < 0.0; }
// plus proche intersection
bool trace(vec3 ro, vec3 rd, out float tHit, out int tri, out vec2 bcH){
  rd = safeDir(rd); vec3 inv = 1.0/rd; int stack[40]; int sp=0; int node=0; tHit=1e30; tri=-1; bcH=vec2(0.0);
  for(int it=0; it<900; it++){
    vec4 n0=tf(uBvh,node*2), n1=tf(uBvh,node*2+1); int cnt=int(n1.w);
    if(cnt>0){ int first=int(n0.w);
      for(int k=0;k<cnt;k++){ int ti=first+k; vec4 a=tf(uTri,ti*3); vec3 e1=tf(uTri,ti*3+1).xyz, e2=tf(uTri,ti*3+2).xyz; vec2 bc; float t=triHit(ro,rd,a.xyz,e1,e2,bc); if(t>1e-4 && t<tHit && !clipped(ro+rd*t)){ tHit=t; tri=ti; bcH=bc; } }
      if(sp==0) break; node=stack[--sp];
    } else {
      int l=node+1, r=int(n0.w); float tl=boxHit(ro,inv,tf(uBvh,l*2).xyz,tf(uBvh,l*2+1).xyz,tHit), tr=boxHit(ro,inv,tf(uBvh,r*2).xyz,tf(uBvh,r*2+1).xyz,tHit);
      if(tl<1e30 && tr<1e30){ if(tl<tr){ if(sp<40) stack[sp++]=r; node=l; } else { if(sp<40) stack[sp++]=l; node=r; } }
      else if(tl<1e30) node=l; else if(tr<1e30) node=r; else { if(sp==0) break; node=stack[--sp]; }
    }
  }
  return tri>=0;
}
// rayon d'ombre : transmittance (le verre et l'eau laissent passer la lumi\u00e8re)
vec3 shadow(vec3 ro, vec3 rd, float tmax){
  rd = safeDir(rd); vec3 inv = 1.0/rd; int stack[40]; int sp=0; int node=0; vec3 tr3=vec3(1.0);
  for(int it=0; it<900; it++){
    vec4 n0=tf(uBvh,node*2), n1=tf(uBvh,node*2+1); int cnt=int(n1.w);
    if(cnt>0){ int first=int(n0.w);
      for(int k=0;k<cnt;k++){ int ti=first+k; vec4 a=tf(uTri,ti*3); vec3 e1=tf(uTri,ti*3+1).xyz, e2=tf(uTri,ti*3+2).xyz; vec2 bc; float t=triHit(ro,rd,a.xyz,e1,e2,bc);
        if(t>1e-4 && t<tmax && !clipped(ro+rd*t)){ int m=int(a.w); float ty=MT(m,1).z;
          if(ty>0.5 && ty<1.5) tr3*=mix(vec3(1.0),MT(m,3).rgb,0.5)*0.96;
          else if(ty>1.5 && ty<2.5){ if(MT(m,4).y>0.5) tr3*=exp(-uWaterAbs*t)*0.97; else tr3*=mix(vec3(1.0),MT(m,3).rgb,0.5)*0.96; }
          else return vec3(0.0); } }
      if(sp==0) break; node=stack[--sp];
    } else {
      int l=node+1, r=int(n0.w); float tl=boxHit(ro,inv,tf(uBvh,l*2).xyz,tf(uBvh,l*2+1).xyz,tmax), tr=boxHit(ro,inv,tf(uBvh,r*2).xyz,tf(uBvh,r*2+1).xyz,tmax);
      if(tl<1e30 && tr<1e30){ if(sp<40) stack[sp++]=r; node=l; } else if(tl<1e30) node=l; else if(tr<1e30) node=r; else { if(sp==0) break; node=stack[--sp]; }
    }
  }
  return tr3;
}
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
float cloudCover(vec3 d){ if(uCloud.x<=0.0) return 0.0; if(uCloud.x>=0.999) return 1.0; if(d.y<0.01) return 0.0; vec2 p=d.xz/(d.y+0.12)*uCloud.y+uCloud.z; float n=fbm(p); return smoothstep(1.0-uCloud.x, 1.0-uCloud.x+uCloud.w, n)*smoothstep(0.0,0.1,d.y); }
vec3 sky(vec3 d, bool disk){
  float y=d.y, mu=dot(d,uSunDir); vec3 c;
  if(uSky2.z>0.0){ float ph=atan(d.z,d.x)+uSky2.w; vec2 uv=vec2(fract(ph/6.2831853+0.5), acos(clamp(d.y,-1.0,1.0))/PI); c=textureLod(uHdr,uv,0.0).rgb*uSky2.z; if(disk && mu>uSunCos) c+=uSunRad; return c; }
  if(y<0.0){ c=mix(uSkyHor, uSkyGnd, smoothstep(0.0,-0.35,y)); }
  else { float h=pow(1.0-clamp(y,0.0,1.0), 3.2); c=mix(uSkyZen,uSkyHor,h); float g=0.78; c+=uSunGlow*((1.0-g*g)/pow(1.0+g*g-2.0*g*mu,1.5))*0.08*(1.0-uSky2.x); }
  float cc=cloudCover(d);
  if(cc>0.0 && y>-0.02){ vec2 p=d.xz/(max(d.y,0.0)+0.12)*uCloud.y+uCloud.z; float dn=fbm(p*1.7+3.1); vec3 col=uCloudCol*(0.55+0.6*dn)*(1.0+1.4*pow(max(mu,0.0),6.0)*(1.0-uSky2.x)); c=mix(c,col,cc*(1.0-uSky2.x*0.35)); }
  if(uSky2.y>0.0 && y>0.0){ vec3 q=d*280.0; vec3 i=floor(q); float hs=fract(sin(dot(i,vec3(12.9898,78.233,37.719)))*43758.5453); if(hs>0.996){ vec3 f=fract(q)-0.5; float s=exp(-dot(f,f)*55.0); c+=vec3(0.85,0.92,1.0)*s*uSky2.y*(hs-0.996)*350.0*smoothstep(0.0,0.2,y)*(1.0-cc); }
    c+=vec3(0.02,0.022,0.03)*uSky2.y*smoothstep(0.6,1.0,fbm(d.xz/(d.y+0.3)*2.0+vec2(4.0)))*(1.0-cc); }
  if(disk && mu>uSunCos) c+=uSunRad*(1.0-cc);
  return c;
}
void basis(vec3 n, out vec3 t, out vec3 b){ float s=n.z>=0.0?1.0:-1.0; float a=-1.0/(s+n.z); float q=n.x*n.y*a; t=vec3(1.0+s*n.x*n.x*a, s*q, -s*n.x); b=vec3(q, s+n.y*n.y*a, -n.y); }
vec3 cosDir(vec3 n){ float u=rnd(), v=rnd(); float r=sqrt(u), ph=6.2831853*v; vec3 t,b; basis(n,t,b); return normalize(t*(r*cos(ph))+b*(r*sin(ph))+n*sqrt(max(0.0,1.0-u))); }
vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 alb, float rough, float metal, bool spec){
  float NL=dot(N,L); if(NL<=0.0) return vec3(0.0); float NV=max(dot(N,V),1e-3); vec3 H=normalize(V+L); float NH=max(dot(N,H),0.0), VH=max(dot(V,H),0.0);
  vec3 F0=mix(vec3(0.04),alb,metal); vec3 F=F0+(1.0-F0)*pow(1.0-VH,5.0); vec3 r=(1.0-F)*(1.0-metal)*alb/PI;
  if(spec){ float a=max(rough*rough,0.003), a2=a*a; float d=NH*NH*(a2-1.0)+1.0; float D=a2/(PI*d*d); float k=a*0.5; float Gs=(NL/(NL*(1.0-k)+k))*(NV/(NV*(1.0-k)+k)); r+=F*D*Gs/(4.0*NL*NV); }
  return r*NL;
}
// vagues (somme d'ondes directionnelles) et impacts de pluie
vec2 ripple(vec2 x){ vec2 g=vec2(0.0); vec2 c=floor(x*2.5); for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 cc=c+vec2(float(i),float(j)); float r=h21(cc); vec2 ctr=(cc+vec2(h21(cc+3.1),h21(cc+7.7)))/2.5; float ph=fract(r+uWx.w*0.9); vec2 dd=x-ctr; float dist=length(dd); float rad=ph*0.42; float w=exp(-pow((dist-rad)*16.0,2.0))*(1.0-ph); g+=dd/max(dist,1e-3)*w*sin((dist-rad)*55.0)*0.3; } return g; }
vec3 waveN(vec2 x){ float s=uWave.z; vec2 d=normalize(uWave.xy+vec2(1e-5)); vec2 g=vec2(0.0); float tm=uWave.w;
  for(int i=0;i<5;i++){ float fi=float(i); float ang=(fi-2.0)*0.42; vec2 di=vec2(d.x*cos(ang)-d.y*sin(ang), d.x*sin(ang)+d.y*cos(ang)); float k=0.32*pow(1.75,fi); float a=(0.02+s*0.07)/pow(1.55,fi); float ph=dot(di,x)*k+tm*sqrt(9.8*k)+fi*1.7; g+=di*(a*k*cos(ph)); }
  g+=(vec2(vnoise(x*1.7+tm*0.15), vnoise(x*1.7+7.0-tm*0.15))-0.5)*(0.05+0.1*s);
  if(uWx.x>0.0) g+=ripple(x)*uWx.x;
  return normalize(vec3(-g.x, 1.0, -g.y)); }
// lumi\u00e8res et portails (texture)
vec4 LP(int i){ return tf(uLgt,i*3); } vec4 LC(int i){ return tf(uLgt,i*3+1); } vec4 LD(int i){ return tf(uLgt,i*3+2); }
float spotF(int i, vec3 dirToLight){ vec4 sd=LD(i); if(sd.w<-1.5) return 1.0; return smoothstep(sd.w, min(sd.w+0.12,1.0), dot(-dirToLight, sd.xyz)); }
float lightW(int i, vec3 p, vec3 N){ vec4 a=LP(i); vec3 d=a.xyz-p; float d2=max(dot(d,d),0.04); return lum(LC(i).rgb)/d2*step(0.0,dot(d,N)+a.w)*spotF(i,d*inversesqrt(d2)); }
vec4 PC(int i){ return tf(uLgt,uPB+i*4); } vec3 PU(int i){ return tf(uLgt,uPB+i*4+1).xyz; } vec3 PV(int i){ return tf(uLgt,uPB+i*4+2).xyz; } vec3 PN(int i){ return tf(uLgt,uPB+i*4+3).xyz; }
float portalW(int i, vec3 x, vec3 N){ vec4 c=PC(i); vec3 d=c.xyz-x; float d2=max(dot(d,d),0.05); vec3 dn=d*inversesqrt(d2); float co=dot(PN(i),dn); if(co<=0.02) return 0.0; return c.w*co/d2*max(dot(N,dn)+0.3,0.0); }
float portalPdf(vec3 x, vec3 N, vec3 w){ float tot=0.0; for(int i=0;i<uNP;i++) tot+=portalW(i,x,N); if(tot<=0.0) return 0.0; float pdf=0.0;
  for(int i=0;i<uNP;i++){ vec3 pn=PN(i); float dn=dot(w,pn); if(dn<=1e-3) continue; vec4 c=PC(i); float t=dot(c.xyz-x,pn)/dn; if(t<=0.0) continue; vec3 h=x+w*t-c.xyz; vec3 pu=PU(i), pv=PV(i); float a=dot(h,pu)/dot(pu,pu), b=dot(h,pv)/dot(pv,pv); if(abs(a)<=1.0 && abs(b)<=1.0) pdf+=portalW(i,x,N)/tot*t*t/(c.w*dn); }
  return pdf; }
vec3 direct(vec3 p, vec3 Ng, vec3 N, vec3 V, vec3 alb, float rough, float metal, float fol, float pS){
  vec3 L=vec3(0.0); bool spec=rough>0.08; vec3 org=p+Ng*1.5e-3;
  if(uSunE.x+uSunE.y+uSunE.z>0.0){ vec3 t,b; basis(uSunDir,t,b); float r=sqrt(rnd())*sqrt(max(0.0,1.0-uSunCos*uSunCos)), ph=6.2831853*rnd(); vec3 ld=normalize(uSunDir+t*(r*cos(ph))+b*(r*sin(ph)));
    float nl=dot(N,ld); vec3 f=vec3(0.0); vec3 so=org;
    if(nl>0.0 && dot(Ng,ld)>0.0) f=brdf(N,V,ld,alb,rough,metal,spec); else if(fol>0.5 && nl<0.0){ f=alb*vec3(0.9,1.0,0.5)*0.45/PI*(-nl); so=p-Ng*1.5e-3; }
    if(f.x+f.y+f.z>0.0){ vec3 tr=shadow(so,ld,1e30); L+=uSunE*f*tr*(1.0-cloudCover(ld)*0.85); } }
  if(uNL>0){ float tot=0.0; for(int i=0;i<uNL;i++) tot+=lightW(i,p,N);
    if(tot>0.0){ float x=rnd()*tot, acc=0.0, wsel=0.0; int sel=-1; for(int i=0;i<uNL;i++){ float w=lightW(i,p,N); acc+=w; if(sel<0 && x<=acc && w>0.0){ sel=i; wsel=w; } }
      if(sel>=0){ vec4 a=LP(sel); vec3 q=a.xyz+normalize(vec3(rnd(),rnd(),rnd())*2.0-1.0)*a.w; vec3 d=q-p; float d2=max(dot(d,d),1e-4), dl=sqrt(d2); vec3 ld=d/dl;
        if(dot(N,ld)>0.0 && dot(Ng,ld)>0.0){ vec3 f=brdf(N,V,ld,alb,max(rough,0.15),metal,spec); vec3 tr=shadow(org,ld,dl-a.w*1.01-1e-3); L+=LC(sel).rgb*spotF(sel,ld)*f*tr/d2*(tot/wsel); } } } }
  if(uNP>0 && fol<0.5){ float tot=0.0; for(int i=0;i<uNP;i++) tot+=portalW(i,p,N);
    if(tot>0.0){ float x=rnd()*tot, acc=0.0; int sel=-1; for(int i=0;i<uNP;i++){ float w=portalW(i,p,N); acc+=w; if(sel<0 && x<=acc && w>0.0) sel=i; }
      if(sel>=0){ vec3 y=PC(sel).xyz+PU(sel)*(rnd()*2.0-1.0)+PV(sel)*(rnd()*2.0-1.0); vec3 d=y-p; vec3 ld=normalize(d); float nl=dot(N,ld);
        if(nl>0.0 && dot(Ng,ld)>0.0){ float pl=portalPdf(p,N,ld); float pb=nl/PI*(1.0-pS); if(pl>0.0){ vec3 tr=shadow(org,ld,1e30); if(tr.x+tr.y+tr.z>0.0) L+=sky(ld,false)*brdf(N,V,ld,alb,rough,metal,false)*tr/(pl+pb); } } } } }
  return L;
}
float fogOD(vec3 o0, vec3 d, float t){ float k=1.0/uFog.y, y0=o0.y; float a=d.y*k*t; return uFog.x*(abs(a)<1e-3 ? t*exp(-y0*k) : (exp(-y0*k)-exp(-(y0+d.y*t)*k))/(d.y*k)); }
void main(){
  rs = (uint(gl_FragCoord.x)*1973u + uint(gl_FragCoord.y)*9277u + uint(uFrame)*26699u) | 1u; rnd(); rnd();
  vec2 px=gl_FragCoord.xy+vec2(rnd(),rnd())-0.5; vec2 ndc=px/uRes*2.0-1.0; float asp=uRes.x/uRes.y;
  vec3 rd=normalize(uCamF+uCamR*(ndc.x*uLens.x*asp)+uCamU*(ndc.y*uLens.x+uLens.w)); vec3 ro=uCamPos;
  if(uLens.y>0.0){ vec3 fp=ro+rd*(uLens.z/max(dot(rd,uCamF),1e-3)); float r=sqrt(rnd())*uLens.y, ph=6.2831853*rnd(); ro+=uCamR*(r*cos(ph))+uCamU*(r*sin(ph)); rd=normalize(fp-ro); }
  vec3 ro0=ro, rd0=rd;
  vec3 L=vec3(0.0), thr=vec3(1.0); bool sunOK=true; int diffB=0; float tFirst=-1.0; bool lastD=false; vec3 lX=vec3(0.0), lN=vec3(0.0,1.0,0.0), lW=vec3(0.0); float lPS=0.0; bool inW=false;
  for(int b=0; b<24; b++){
    float t; int tri; vec2 bc;
    bool hit=trace(ro,rd,t,tri,bc);
    if(inW){ float tw=hit?t:60.0; vec3 Tw=exp(-uWaterAbs*tw); L+=thr*uWaterScat*(1.0-Tw); thr*=Tw; }
    if(!hit){ if(inW) break; vec3 s=sky(rd,sunOK); if(b>0) s=min(s,vec3(sunOK?400.0:uClamp*6.0)); if(lastD && uNP>0){ float pl=portalPdf(lX,lN,lW); float pb=max(dot(lN,lW),0.0)/PI*(1.0-lPS); s*=pb/max(pb+pl,1e-6); } L+=thr*s; break; }
    if(tFirst<0.0) tFirst=t;
    vec4 a0=tf(uTri,tri*3); vec3 e1=tf(uTri,tri*3+1).xyz, e2=tf(uTri,tri*3+2).xyz; int m=int(a0.w);
    vec4 A0=tf(uAttr,tri*4), A1=tf(uAttr,tri*4+1), A2=tf(uAttr,tri*4+2), A3=tf(uAttr,tri*4+3);
    vec4 M0=MT(m,0), M1=MT(m,1), M2=MT(m,2), M3=MT(m,3), M4=MT(m,4);
    float w0=1.0-bc.x-bc.y; vec3 p=ro+rd*t; vec3 Ng=normalize(cross(e1,e2)); bool back=dot(Ng,rd)>0.0; if(back) Ng=-Ng;
    vec3 N=normalize(A0.xyz*w0+A1.xyz*bc.x+A2.xyz*bc.y); if(dot(N,Ng)<0.0) N=-N;
    vec2 uv0=vec2(A0.w,A1.w), uv1=vec2(A2.w,A3.x), uv2=A3.yz; vec2 uv=uv0*w0+uv1*bc.x+uv2*bc.y;
    vec3 alb=M0.rgb; float rough=M1.x, metal=M1.y, type=M1.z; float lod=0.0; vec3 tc=vec3(0.0);
    if(M0.w>=0.0){ float sc=M1.w; lod=log2(max(t*uPixAng*512.0*sc/max(abs(dot(rd,Ng)),0.15),1.0))+(b>0?1.5:0.0); tc=vec3(uv.x*sc, 1.0-uv.y*sc, M0.w);
      if(!(type>1.5 && type<2.5)){ vec3 tx=textureLod(uAlb,tc,lod).rgb; alb*=pow(tx,vec3(2.2));
      if(M3.w>0.0){ float mv=fbm(p.xz*0.11+p.y*0.07+3.7)*0.45+fbm(p.xz*0.9+p.y*0.6)*0.2+fbm(p.xz*0.013+p.y*0.03+9.1)*0.35; alb*=1.0+(mv-0.5)*2.0*M3.w; alb=mix(alb,alb*vec3(1.08,1.0,0.8),clamp((mv-0.5)*2.2,0.0,1.0)*M3.w); float fine=fbm(p.xz*6.0+p.y*4.0); alb*=1.0+(fine-0.5)*1.1*M3.w; }
      if(M4.z>0.5){ // versants de montagne : for\u00eat, alpage, roche stri\u00e9e et neige calcul\u00e9s au pixel
      float sl=M4.w; float n1=fbm(p.xz*0.006+1.7), n2=fbm(p.xz*0.045+5.3), n3=fbm(p.xz*0.35);
      float up=N.y+(n2-0.5)*0.22+(n3-0.5)*0.1; float rockA=1.0-smoothstep(0.66,0.84,up);
      float strata=clamp(fbm(vec2(p.y*0.09+n1*7.0, dot(p.xz,vec2(0.003,0.002))+n2))*1.5-0.25+0.25*sin(p.y*0.21+n2*9.0),0.0,1.0);
      vec3 rockC=mix(vec3(0.17,0.16,0.15),vec3(0.42,0.39,0.36),strata)*(0.8+0.4*n3);
      float hN=p.y+(n1-0.5)*220.0+(n2-0.5)*60.0;
      float forest=(M4.z>1.5?1.0:0.0)*(1.0-smoothstep(sl-110.0,sl-40.0,hN))*smoothstep(0.78,0.9,up)*smoothstep(0.40,0.5,fbm(p.xz*0.012+8.0)+(n3-0.5)*0.15);
      alb=mix(alb,vec3(0.03,0.062,0.026)*(0.45+1.1*fbm(p.xz*0.55+2.0))*(0.75+0.5*n2),forest);
      alb=mix(alb,alb*vec3(1.05,0.93,0.68),smoothstep(sl-160.0,sl,hN)*(1.0-forest));
      float scree=smoothstep(0.62,0.74,up)*(1.0-smoothstep(0.8,0.9,up))*smoothstep(0.35,0.6,fbm(p.xz*0.02+4.0))*(1.0-forest); alb=mix(alb,vec3(0.30,0.285,0.26)*(0.75+0.5*n3),scree*0.5); alb=mix(alb,rockC,rockA);
      float snowA=smoothstep(sl-25.0,sl+45.0,hN)*smoothstep(0.42,0.62,up+0.08);
      snowA=max(snowA,smoothstep(sl-150.0,sl-40.0,hN)*smoothstep(0.6,0.7,n2)*smoothstep(0.5,0.7,up)*0.9);
      alb=mix(alb,vec3(0.84,0.87,0.92),snowA); rough=mix(rough,0.6,snowA);
      float bh0=fbm(p.xz*0.07+p.y*0.05)*0.7+fbm(p.xz*0.33+p.y*0.21)*0.3, bhx=fbm((p.xz+vec2(1.5,0.0))*0.07+p.y*0.05)*0.7+fbm((p.xz+vec2(1.5,0.0))*0.33+p.y*0.21)*0.3, bhz=fbm((p.xz+vec2(0.0,1.5))*0.07+p.y*0.05)*0.7+fbm((p.xz+vec2(0.0,1.5))*0.33+p.y*0.21)*0.3;
      vec3 bg=vec3(bh0-bhx,0.0,bh0-bhz)/1.5*(5.0+26.0*rockA)*(1.0-snowA*0.65)*(1.0-forest*0.5); alb*=mix(1.0,0.62+0.76*bh0,max(rockA,0.35)*(1.0-snowA*0.7)); N=normalize(N+bg); if(dot(N,-rd)<0.02) N=normalize(N+Ng*0.6); }
      if(M2.w>0.0){ vec3 nm=textureLod(uNr,tc,lod).xyz; vec2 d1=uv1-uv0, d2=uv2-uv0; float det=d1.x*d2.y-d2.x*d1.y;
        if(abs(det)>1e-12){ vec3 T=normalize((e1*d2.y-e2*d1.y)/det); T=normalize(T-N*dot(N,T)); vec3 B=cross(N,T); if(dot(B,(e2*d1.x-e1*d2.x)/det)<0.0) B=-B; vec2 nxy=(nm.xy*2.0-1.0)*M2.w; N=normalize(T*nxy.x+B*nxy.y+N); if(dot(N,-rd)<0.02) N=normalize(N+Ng*0.6); }
        rough=clamp(rough*mix(0.65,1.35,nm.z),0.02,1.0); } } }
    // m\u00e9t\u00e9o sur les surfaces ext\u00e9rieures : neige, sol mouill\u00e9, flaques, ruissellement
    float snowS=0.0;
    if(M4.x>0.5 && (type<0.5 || type>2.5)){ float ny=M4.x>1.5?abs(Ng.y):Ng.y;
      if(uWx.y>0.0){ float nmask=smoothstep(0.22,0.62,ny); float nz=fbm(p.xz*1.3+p.y*0.7)*0.6+vnoise(p.xz*7.0+p.y*3.0)*0.4; snowS=clamp(uWx.y*1.7-(1.0-nmask)*1.3-(0.55-nz)*0.7,0.0,1.0)*nmask;
        if(snowS>0.0){ alb=mix(alb,vec3(0.85,0.87,0.9)*(0.92+0.16*nz),snowS); rough=mix(rough,0.6,snowS); metal*=1.0-snowS; N=normalize(mix(N,Ng,snowS*0.8)); } }
      if(uWx.z>0.0 && M4.x<1.5){ float wet=uWx.z*(1.0-snowS);
        if(Ng.y>0.6){ alb*=mix(1.0,0.58,wet); rough=mix(rough,rough*0.3,wet); float pud=smoothstep(0.57,0.63,fbm(p.xz*0.3+1.3))*smoothstep(0.35,0.9,wet);
          if(pud>0.0){ alb*=mix(1.0,0.55,pud); rough=mix(rough,0.02,pud); metal*=1.0-pud; N=normalize(mix(N,Ng,pud)); if(uWx.x>0.0){ vec2 rp=ripple(p.xz)*uWx.x; N=normalize(N+vec3(rp.x,0.0,rp.y)*pud); } } }
        else if(abs(Ng.y)<0.35){ float st=smoothstep(0.3,0.75,vnoise(vec2((p.x+p.z)*5.0,p.y*0.5))); alb*=mix(1.0,0.68,wet*(0.4+0.6*st)); rough=mix(rough,rough*0.4,wet*st); } } }
    L+=thr*M2.rgb;
    if(type>0.5 && type<1.5){ // verre : r\u00e9flexion de Fresnel, r\u00e9fraction, gouttes de pluie
      if(uWx.x>0.0 && M4.x>0.5){ vec3 Tg=normalize(cross(vec3(0.0,1.0,0.0),Ng)+vec3(1e-4)); vec2 gp=vec2(dot(p,Tg),p.y)*13.0; vec2 c=floor(gp); vec2 f=fract(gp)-0.5; float r=h21(c); vec2 o2=(vec2(h21(c+1.7),h21(c+4.3))-0.5)*0.5; vec2 d=f-o2; float rad=0.1+0.22*r; float dd=length(d);
        if(dd<rad && r<uWx.x){ float k=dd/rad; N=normalize(N+(Tg*d.x+vec3(0.0,1.0,0.0)*d.y)/rad*1.6*k); } }
      float eta=back?1.5:1.0/1.5; float c=max(dot(-rd,N),0.0); float F=0.07+0.93*pow(1.0-c,5.0); vec3 rf=refract(rd,N,eta); if(dot(rf,rf)<1e-6) F=1.0;
      if(rnd()<F){ rd=reflect(rd,N); ro=p+Ng*1.5e-3; } else { rd=normalize(mix(rd,rf,0.35)); ro=p-Ng*1.5e-3; if(!back) thr*=M3.rgb; }
      continue; }
    float fol=type>2.5?1.0:0.0;
    if(type>1.5 && type<2.5){
      if(M4.y>0.5){ // eau naturelle : vagues, \u00e9cume, r\u00e9flexion, r\u00e9fraction et absorption selon la profondeur r\u00e9elle
        vec3 wn=waveN(p.xz); if(back) wn=-wn;
        float foam=0.0; if(M0.w>=0.0 && !back){ vec2 fu=vec2(uv.x*M1.w, uv.y*M1.w); foam=(fu.x>=0.0&&fu.x<=1.0&&fu.y>=0.0&&fu.y<=1.0)?textureLod(uAlb,tc,0.0).r:0.0; foam*=smoothstep(0.35,0.75,vnoise(p.xz*1.6+uWave.w*0.4)+foam*0.5); foam+=uWave.z*0.35*smoothstep(0.82,0.95,vnoise(p.xz*0.7-uWave.w*0.2))*0.5; }
        if(foam>0.0 && rnd()<foam){ alb=vec3(0.82,0.85,0.86); N=vec3(0.0,1.0,0.0); Ng=N; rough=0.9; metal=0.0; type=0.0; }
        else { float c=max(dot(-rd,wn),0.0); float F=0.02+0.98*pow(1.0-c,5.0); vec3 rf=refract(rd,wn,back?1.33:1.0/1.33); if(dot(rf,rf)<1e-6) F=1.0;
          if(rnd()<F){ rd=reflect(rd,wn); if(!back && rd.y<0.02) rd=normalize(vec3(rd.x,0.03,rd.z)); ro=p+Ng*2e-3; }
          else { rd=rf; ro=p-Ng*2e-3; inW=!back; }
          continue; } }
      else { // piscine : fond carrel\u00e9 virtuel
        vec2 q=p.xz*3.1; vec3 wn=normalize(vec3(sin(q.x*1.3+q.y*0.7)+0.6*sin(q.x*3.1-q.y*2.3+1.7), 26.0, cos(q.y*1.1-q.x*0.5)+0.6*sin(q.y*2.9+q.x*2.1)));
        if(uWx.x>0.0){ vec2 rp=ripple(p.xz)*uWx.x; wn=normalize(wn+vec3(rp.x,0.0,rp.y)); }
        float c=max(dot(-rd,wn),0.0); float F=0.02+0.98*pow(1.0-c,5.0);
        if(rnd()<F){ rd=reflect(rd,wn); if(rd.y<0.02) rd=normalize(vec3(rd.x,0.03,rd.z)); ro=p+vec3(0.0,2e-3,0.0); continue; }
        vec3 rf=refract(rd,wn,1.0/1.33); float len=1.5/max(-rf.y,0.25); vec2 pf=p.xz+rf.xz*len; vec2 g=abs(fract(pf*5.0)-0.5); float joint=smoothstep(0.46,0.49,max(g.x,g.y));
        float ca=0.75+0.7*pow(vnoise(pf*4.0+wn.xz*40.0),2.0); alb=mix(vec3(0.82,0.9,0.92),vec3(0.55,0.62,0.65),joint)*exp(-vec3(0.5,0.085,0.04)*(len+1.5))*ca; N=vec3(0.0,1.0,0.0); Ng=N; rough=1.0; metal=0.0; } }
    vec3 V=-rd;
    vec3 F0=mix(vec3(0.04),alb,metal); float NV=max(dot(N,V),1e-3); float Fv=lum(F0+(1.0-F0)*pow(1.0-NV,5.0)); float dW=lum(alb)*(1.0-metal); float pS=clamp(Fv/(Fv+dW+1e-4),0.08,0.95);
    vec3 dl=direct(p,Ng,N,V,alb,rough,metal,fol,pS); if(b>0) dl=min(dl,vec3(uClamp)); else dl=min(dl,vec3(60.0)); L+=thr*dl;
    if(diffB>=uBounces) break; lastD=false;
    if(rnd()<pS){ float a=max(rough*rough,0.003); float u1=rnd(), u2=rnd(); float ct=sqrt((1.0-u1)/(1.0+(a*a-1.0)*u1)), st=sqrt(max(0.0,1.0-ct*ct)), ph=6.2831853*u2; vec3 T,B; basis(N,T,B); vec3 H=normalize(T*(st*cos(ph))+B*(st*sin(ph))+N*ct); vec3 nd=reflect(rd,H);
      float NL=dot(N,nd); if(NL<=0.0 || dot(Ng,nd)<=0.0) break; float VH=max(dot(V,H),1e-4); vec3 F=F0+(1.0-F0)*pow(1.0-VH,5.0); float k=a*0.5; float Gs=(NL/(NL*(1.0-k)+k))*(NV/(NV*(1.0-k)+k));
      thr*=F*Gs*VH/(NV*max(ct,1e-4))/pS; rd=nd; ro=p+Ng*1.5e-3; sunOK=rough<=0.08; if(rough>0.3) diffB++; }
    else { vec3 nn=N; float side=1.0; if(fol>0.5 && rnd()<0.35){ nn=-N; side=-1.0; } rd=cosDir(nn); if(dot(rd,Ng)*side<=0.0) break; thr*=alb*(1.0-metal)*(1.0-Fv)/(1.0-pS); ro=p+Ng*(1.5e-3*side); sunOK=false; diffB++; if(side>0.0){ lastD=true; lX=p+Ng*1.5e-3; lN=N; lW=rd; lPS=pS; } }
    if(b>2){ float q=clamp(max(thr.x,max(thr.y,thr.z)),0.05,0.95); if(rnd()>q) break; thr/=q; }
  }
  // brouillard en hauteur : att\u00e9nuation, lumi\u00e8re ambiante diffus\u00e9e et rayons de soleil (diffusion simple avec ombres)
  if(uFog.x>0.0){ float tmax=min(tFirst<0.0?uFog.w:tFirst,uFog.w); float Tr=exp(-fogOD(ro0,rd0,tmax)); vec3 ins=uFogCol*(1.0-Tr);
    if(uFog.z>0.0 && uSunE.x+uSunE.y+uSunE.z>0.0){ float s=rnd()*min(tmax,180.0); vec3 x=ro0+rd0*s; float dens=uFog.x*exp(-x.y/uFog.y); vec3 vis=shadow(x,uSunDir,1e30); float mu=dot(rd0,uSunDir), g=0.6; float phs=(1.0-g*g)/(4.0*PI*pow(1.0+g*g-2.0*g*mu,1.5)); ins+=min(uSunE*vis*phs*dens*exp(-fogOD(ro0,rd0,s))*min(tmax,180.0)*uFog.z*(1.0-cloudCover(uSunDir)*0.85),vec3(uClamp*4.0)); }
    L=L*Tr+ins; }
  if(L.x!=L.x||L.y!=L.y||L.z!=L.z) L=vec3(0.0);
  o=vec4(L,uAlpha);
}`;
const GMAIN = `void main(){
  vec2 ndc=gl_FragCoord.xy/uRes*2.0-1.0; float asp=uRes.x/uRes.y;
  vec3 rd=normalize(uCamF+uCamR*(ndc.x*uLens.x*asp)+uCamU*(ndc.y*uLens.x+uLens.w)); vec3 ro=uCamPos; float t; int tri; vec2 bc; float tAcc=0.0; bool hit=false;
  for(int k=0;k<4;k++){ if(!trace(ro,rd,t,tri,bc)) break; float ty0=MT(int(tf(uTri,tri*3).w),1).z; if(ty0>0.5 && ty0<1.5){ ro+=rd*(t+2e-3); tAcc+=t+2e-3; continue; } hit=true; break; }
  if(!hit){ o=vec4(0.0,0.0,0.0,1e6); o2=vec4(1.0,1.0,1.0,1.0); o3=vec4(0.0); return; }
  vec4 a0=tf(uTri,tri*3); vec3 e1=tf(uTri,tri*3+1).xyz, e2=tf(uTri,tri*3+2).xyz; int m=int(a0.w);
  vec4 A0=tf(uAttr,tri*4), A1=tf(uAttr,tri*4+1), A2=tf(uAttr,tri*4+2), A3=tf(uAttr,tri*4+3); vec4 M0=MT(m,0), M1=MT(m,1), M4=MT(m,4);
  float w0=1.0-bc.x-bc.y; vec3 Ng=normalize(cross(e1,e2)); if(dot(Ng,rd)>0.0) Ng=-Ng; vec3 N=normalize(A0.xyz*w0+A1.xyz*bc.x+A2.xyz*bc.y); if(dot(N,Ng)<0.0) N=-N;
  vec2 uv=vec2(A0.w,A1.w)*w0+vec2(A2.w,A3.x)*bc.x+A3.yz*bc.y; vec3 alb=M0.rgb; float ty=M1.z; float spec=((ty>1.5&&ty<2.5)||M1.y>0.5||M1.x<0.06)?1.0:0.0;
  if(M0.w>=0.0 && !(ty>1.5&&ty<2.5)){ float sc=M1.w; float lod=log2(max(t*uPixAng*512.0*sc/max(abs(dot(rd,Ng)),0.15),1.0)); alb*=pow(textureLod(uAlb,vec3(uv.x*sc,1.0-uv.y*sc,M0.w),lod).rgb,vec3(2.2)); }
  if(M4.x>0.5 && M4.x<1.5 && uWx.z>0.0 && Ng.y>0.6){ vec3 pp=ro+rd*t; float pud=smoothstep(0.57,0.63,fbm(pp.xz*0.3+1.3))*smoothstep(0.35,0.9,uWx.z); if(pud>0.5) spec=1.0; }
  if(spec>0.5) alb=vec3(1.0);
  o=vec4(N,t+tAcc); o2=vec4(alb,spec); o3=vec4(ro+rd*t,1.0); }`;
const FS_DN = `#version 300 es
precision highp float; uniform sampler2D uIn, uG, uA, uP; uniform int uStep, uFirst; uniform float uSig; out vec4 o;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); ivec2 sz=textureSize(uIn,0); vec4 g0=texelFetch(uG,p,0), a0=texelFetch(uA,p,0); vec3 P0=texelFetch(uP,p,0).xyz; vec3 c0=texelFetch(uIn,p,0).rgb; if(uFirst==1) c0/=max(a0.rgb,vec3(0.03));
  if(a0.w>0.5){ o=vec4(c0,1.0); return; }
  float l0=dot(c0,vec3(.2126,.7152,.0722)); vec3 s=vec3(0.0); float ws=0.0; float k[3]=float[3](0.375,0.25,0.0625); float tol=g0.w*0.004*float(uStep)+0.004;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ ivec2 q=p+ivec2(i,j)*uStep; if(q.x<0||q.y<0||q.x>=sz.x||q.y>=sz.y) continue; vec4 a=texelFetch(uA,q,0); if(a.w>0.5) continue; vec4 g=texelFetch(uG,q,0); vec3 c=texelFetch(uIn,q,0).rgb; if(uFirst==1) c/=max(a.rgb,vec3(0.03));
    float wN=pow(max(dot(g0.xyz,g.xyz),0.0),48.0); float wP=exp(-abs(dot(g0.xyz,texelFetch(uP,q,0).xyz-P0))/tol); float l=dot(c,vec3(.2126,.7152,.0722)); float wL=exp(-abs(l-l0)/(uSig*(l0+l)*0.5+1e-4));
    float w=k[abs(i)]*k[abs(j)]*wN*wP*wL; s+=c*w; ws+=w; }
  o=vec4(ws>1e-6?s/ws:c0,1.0); }`;
// halo lumineux (bloom) : extraction des hautes lumi\u00e8res, r\u00e9ductions successives puis recomposition
const FS_BRIGHT = `#version 300 es
precision highp float; uniform sampler2D uAcc, uAlbT; uniform float uRemod; uniform vec3 uGain; out vec4 o;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy)*2; ivec2 sz=textureSize(uAcc,0); vec3 c=vec3(0.0);
  for(int j=0;j<2;j++) for(int i=0;i<2;i++){ ivec2 r=min(q+ivec2(i,j),sz-1); vec3 v=texelFetch(uAcc,r,0).rgb; if(uRemod>0.5) v*=max(texelFetch(uAlbT,r,0).rgb,vec3(0.03)); c+=v; }
  c=c*0.25*uGain; float l=dot(c,vec3(.2126,.7152,.0722)); o=vec4(min(c*max(l-1.0,0.0)/max(l,1e-4),vec3(50.0)),1.0); }`;
const FS_DOWN = `#version 300 es
precision highp float; uniform sampler2D uSrc; uniform vec2 uTex; out vec4 o;
void main(){ vec2 uv=gl_FragCoord.xy*2.0*uTex; vec3 c=texture(uSrc,uv+vec2(-1.0,-1.0)*uTex).rgb+texture(uSrc,uv+vec2(1.0,-1.0)*uTex).rgb+texture(uSrc,uv+vec2(-1.0,1.0)*uTex).rgb+texture(uSrc,uv+vec2(1.0,1.0)*uTex).rgb; o=vec4(c*0.25,1.0); }`;
const FS_UP = `#version 300 es
precision highp float; uniform sampler2D uSrc; uniform vec2 uTex, uRes; out vec4 o;
void main(){ vec2 uv=gl_FragCoord.xy/uRes; vec3 c=vec3(0.0); float w=0.0; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ float k=(i==0?2.0:1.0)*(j==0?2.0:1.0); c+=texture(uSrc,uv+vec2(float(i),float(j))*uTex).rgb*k; w+=k; } o=vec4(c/w,1.0); }`;
const FS_TM = `#version 300 es
precision highp float; uniform sampler2D uAcc, uAlbT, uBloomT; uniform vec2 uRes; uniform vec3 uGain; uniform float uVig, uFlip, uRemod, uBloom, uContrast, uSat; uniform vec4 uPrecip; out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float hh(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec3 precip(vec2 fc, vec3 c){
  if(uPrecip.x>0.0){ float acc=0.0; for(int l=0;l<4;l++){ float fl=float(l); float sc=1.0+fl*0.9; vec2 q=fc/uRes.y*vec2(70.0*sc,4.5*sc); q.x+=q.y*uPrecip.z*0.35*(1.0+fl*0.3); q.y+=hh(vec2(floor(q.x),fl))*7.0+uPrecip.w*3.1; vec2 cell=floor(q); float h=hh(cell+fl*13.1);
      if(h<uPrecip.x*0.4){ vec2 f=fract(q); float xo=abs(f.x-0.5-(hh(cell+4.2)-0.5)*0.7); acc+=smoothstep(0.09,0.0,xo)*smoothstep(0.0,0.25,f.y)*smoothstep(1.0,0.55,f.y)*(0.42-fl*0.08); } }
    c=mix(c,vec3(0.78,0.82,0.86)*max(dot(c,vec3(0.33)),0.35)+0.08,clamp(acc,0.0,0.7)*0.55); c=mix(c,vec3(dot(c,vec3(0.33))),0.12*uPrecip.x); }
  if(uPrecip.y>0.0){ float acc=0.0; for(int l=0;l<4;l++){ float fl=float(l); float sc=10.0+fl*9.0; vec2 q=fc/uRes.y*sc; q.x+=q.y*uPrecip.z*0.25+uPrecip.w*(fl+1.0); vec2 cell=floor(q); float h=hh(cell+fl*7.3);
      if(h<uPrecip.y*0.55){ vec2 ctr=vec2(hh(cell+1.3),hh(cell+2.7))*0.7+0.15; float d=length(fract(q)-ctr); float r=(0.05+0.06*hh(cell+5.1))*(l==0?2.2:1.0); acc+=smoothstep(r,r*(l==0?0.1:0.35),d)*(l==0?0.45:0.85); } }
    c=mix(c,vec3(0.94,0.95,0.97),clamp(acc,0.0,1.0)*0.8); }
  return c; }
void main(){ vec2 uv=gl_FragCoord.xy/uRes; vec2 st=uv; if(uFlip>0.5) st.y=1.0-st.y; vec3 c=texture(uAcc,st).rgb; if(uRemod>0.5) c*=max(texture(uAlbT,st).rgb,vec3(0.03)); c*=uGain; if(uBloom>0.0) c+=texture(uBloomT,st).rgb*uBloom; vec2 q=uv-0.5; c*=1.0-uVig*dot(q,q)*1.6; c=aces(c*0.8); c=pow(c,vec3(1.0/2.2));
  if(uContrast!=0.0) c=clamp((c-0.5)*(1.0+uContrast)+0.5,0.0,1.0); if(uSat!=0.0) c=clamp(mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,1.0+uSat),0.0,1.0);
  if(uPrecip.x>0.0 || uPrecip.y>0.0) c=precip(gl_FragCoord.xy, c);
  float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453); o=vec4(c+(n-0.5)/255.0,1.0); }`;
const FS_MET = `#version 300 es
precision highp float; uniform sampler2D uAcc; out vec4 o;
void main(){ vec2 c=floor(gl_FragCoord.xy); float s=0.0; for(int j=0;j<10;j++) for(int i=0;i<10;i++){ vec2 uv=(c+(vec2(float(i),float(j))+0.5)/10.0)/24.0; vec3 v=min(texture(uAcc,uv).rgb,vec3(40.0)); s+=dot(v,vec3(.2126,.7152,.0722)); } o=vec4(log(max(s/100.0,1e-5)),0.0,0.0,1.0); }`;

/* ---------- balance des blancs (kelvins -> gain RVB) ---------- */
function kelvinRGB(k) { k = Math.max(1500, Math.min(15000, k)) / 100; let r, g, b; r = k <= 66 ? 255 : 329.698727446 * Math.pow(k - 60, -0.1332047592); g = k <= 66 ? 99.4708025861 * Math.log(k) - 161.1195681661 : 288.1221695283 * Math.pow(k - 60, -0.0755148492); b = k >= 66 ? 255 : k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307; const c = v => Math.pow(Math.max(0, Math.min(255, v)) / 255, 2.2); return [c(r), c(g), c(b)]; }
function wbGain(k) { const s = kelvinRGB(k), n = kelvinRGB(6000); const g = [n[0] / s[0], n[1] / s[1], n[2] / s[2]]; const l = g[0] * .2126 + g[1] * .7152 + g[2] * .0722; return g.map(v => v / l); }

/* ---------- le traceur ---------- */
function supported() { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); return !!(gl && gl.getExtension('EXT_color_buffer_float')); } catch (e) { return false; } }
function create(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  const blend32 = !!gl.getExtension('EXT_float_blend'); gl.getExtension('OES_texture_float_linear');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader : ' + gl.getShaderInfoLog(s)); return s; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); const nm = inf.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, inf.name); } return { p, u }; };
  let PT, TM, MET, GB, DN, BR, DW, UP; try { PT = prog(FS); TM = prog(FS_TM); MET = prog(FS_MET); const cut = FS.lastIndexOf('void main(){'); GB = prog(FS.slice(0, cut).replace('out vec4 o;', 'layout(location=0) out vec4 o; layout(location=1) out vec4 o2; layout(location=2) out vec4 o3;') + GMAIN); DN = prog(FS_DN); BR = prog(FS_BRIGHT); DW = prog(FS_DOWN); UP = prog(FS_UP); } catch (e) { if (G.console) console.warn('[rendu]', e.message); return { error: e.message }; }
  const vao = gl.createVertexArray();
  const S = { gl, canvas, w: 0, h: 0, pass: 0, tile: 0, tiles: [], tileSize: 192, tpf: 2, lastT: 0, ready: false, tris: 0, opt: { bounces: 4, ev: 0, wb: 6000, vignette: 0, clamp: 12, auto: true, bloom: 0, contrast: 0, sat: 0 }, expo: 1, metered: -1, env: null, cam: null, lost: false, maxPass: 400, nl: 0, np: 0 };
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); S.lost = true; });
  const dataTex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const tex = { tri: dataTex(0), attr: dataTex(1), bvh: dataTex(2), mat: dataTex(3), lgt: dataTex(13), hdr: null, alb: gl.createTexture(), nr: gl.createTexture() };
  const upload = (t, unit, arr, texels) => { const h = Math.max(1, Math.ceil(texels / TW)); const buf = new Float32Array(TW * h * 4); buf.set(arr.subarray(0, Math.min(arr.length, buf.length))); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TW, h, 0, gl.RGBA, gl.FLOAT, buf); };
  // ciel HDRI (\u00e9quirectangulaire, lin\u00e9aire) ; texture 1 \u00d7 1 par d\u00e9faut
  function setHdr(data, w, h) { if (!tex.hdr) tex.hdr = gl.createTexture(); gl.activeTexture(gl.TEXTURE14); gl.bindTexture(gl.TEXTURE_2D, tex.hdr); const n = w * h, px = new Float32Array(n * 4); for (let i = 0; i < n; i++) { px[i * 4] = data[i * 3]; px[i * 4 + 1] = data[i * 3 + 1]; px[i * 4 + 2] = data[i * 3 + 2]; px[i * 4 + 3] = 1; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, px); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); S.hdrKey = w + 'x' + h + ':' + (data[0] || 0); reset(); }
  setHdr(new Float32Array([0, 0, 0]), 1, 1); S.hdrKey = null;
  const mkTarget = (w, h) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, blend32 ? gl.RGBA32F : gl.RGBA16F, w, h, 0, gl.RGBA, blend32 ? gl.FLOAT : gl.HALF_FLOAT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { t, f, w, h, ok }; };
  const freeTarget = T => { if (T) { gl.deleteTexture(T.t); gl.deleteFramebuffer(T.f); } };
  const met = (() => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 24, 24, 0, gl.RGBA, gl.FLOAT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { t, f }; })();
  const mkTex = (w, h, f32, lin) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, f32 ? gl.RGBA32F : gl.RGBA16F, w, h, 0, gl.RGBA, f32 ? gl.FLOAT : gl.HALF_FLOAT, null); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, lin ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  function mkDen(w, h) { const D = { w, h, g: mkTex(w, h, true), a: mkTex(w, h, false), p: mkTex(w, h, true), pp: [mkTex(w, h, false), mkTex(w, h, false)] }; D.gf = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, D.gf); [D.g, D.a, D.p].forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]); D.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    D.pf = D.pp.map(t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) D.ok = false; return f; }); gl.bindFramebuffer(gl.FRAMEBUFFER, null); D.valid = false; return D; }
  function freeDen(D) { if (!D) return; [D.g, D.a, D.p, ...D.pp].forEach(t => gl.deleteTexture(t)); [D.gf, ...D.pf].forEach(f => gl.deleteFramebuffer(f)); }
  function gbuffer(D, cam) { if (!GB || !D.ok) return; bindScene(D.w, D.h, cam, GB); gl.bindFramebuffer(gl.FRAMEBUFFER, D.gf); gl.viewport(0, 0, D.w, D.h); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindFramebuffer(gl.FRAMEBUFFER, null); D.valid = true; }
  // filtre \u00e0-trous guid\u00e9 par les normales, la position et l'alb\u00e9do ; renvoie la texture de radiance d\u00e9modul\u00e9e filtr\u00e9e
  function denoise(D, src, spp) { if (!DN || !D || !D.ok || !D.valid || S.opt.denoise === false) return null; const it = spp < 8 ? 5 : spp < 32 ? 4 : spp < 128 ? 3 : spp < 512 ? 2 : 1; const sig = 3.5 / Math.sqrt(spp + 1) + .12;
    gl.useProgram(DN.p); gl.bindVertexArray(vao); gl.viewport(0, 0, D.w, D.h); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); const bindT = (u, t, n) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(DN.u[n], u); };
    bindT(9, D.g, 'uG'); bindT(10, D.a, 'uA'); bindT(11, D.p, 'uP'); gl.uniform1f(DN.u.uSig, sig); let inp = src, k = 0;
    for (let i = 0; i < it; i++) { bindT(8, inp, 'uIn'); gl.uniform1i(DN.u.uStep, 1 << i); gl.uniform1i(DN.u.uFirst, i === 0 ? 1 : 0); gl.bindFramebuffer(gl.FRAMEBUFFER, D.pf[k]); gl.drawArrays(gl.TRIANGLES, 0, 3); inp = D.pp[k]; k ^= 1; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); return inp; }
  // cha\u00eene du halo lumineux
  const blooms = {};
  function bloomChain(w, h) { const k = w + 'x' + h; if (blooms[k]) return blooms[k]; const lv = []; let W = Math.max(1, w >> 1), H = Math.max(1, h >> 1); for (let i = 0; i < 5 && W >= 4 && H >= 4; i++) { const t = mkTex(W, H, false, true), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); lv.push({ t, f, w: W, h: H }); W >>= 1; H >>= 1; } gl.bindFramebuffer(gl.FRAMEBUFFER, null); return blooms[k] = lv; }
  function bloom(src, alb, remod, w, h) { if (!(S.opt.bloom > 0) || !BR) return null; const lv = bloomChain(w, h); if (!lv.length) return null; gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.bindVertexArray(vao);
    gl.useProgram(BR.p); gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(BR.u.uAcc, 8); gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, alb); gl.uniform1i(BR.u.uAlbT, 9); gl.uniform1f(BR.u.uRemod, remod ? 1 : 0); gl.uniform3fv(BR.u.uGain, gain()); gl.bindFramebuffer(gl.FRAMEBUFFER, lv[0].f); gl.viewport(0, 0, lv[0].w, lv[0].h); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(DW.p); for (let i = 1; i < lv.length; i++) { gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, lv[i - 1].t); gl.uniform1i(DW.u.uSrc, 8); gl.uniform2f(DW.u.uTex, 1 / lv[i - 1].w, 1 / lv[i - 1].h); gl.bindFramebuffer(gl.FRAMEBUFFER, lv[i].f); gl.viewport(0, 0, lv[i].w, lv[i].h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.useProgram(UP.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); for (let i = lv.length - 1; i > 0; i--) { gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, lv[i].t); gl.uniform1i(UP.u.uSrc, 8); gl.uniform2f(UP.u.uTex, 1 / lv[i].w, 1 / lv[i].h); gl.uniform2f(UP.u.uRes, lv[i - 1].w, lv[i - 1].h); gl.bindFramebuffer(gl.FRAMEBUFFER, lv[i - 1].f); gl.viewport(0, 0, lv[i - 1].w, lv[i - 1].h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return lv[0].t; }
  const mkTiles = (w, h, ts) => { const out = []; for (let y = 0; y < h; y += ts) for (let x = 0; x < w; x += ts) out.push([x, y, Math.min(ts, w - x), Math.min(ts, h - y)]); const cx = w / 2, cy = h / 2; out.sort((a, b) => Math.hypot(a[0] + a[2] / 2 - cx, a[1] + a[3] / 2 - cy) - Math.hypot(b[0] + b[2] / 2 - cx, b[1] + b[3] / 2 - cy)); return out; };

  function setSize(w, h) { w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h)); if (S.acc && S.w === w && S.h === h) return; freeTarget(S.acc); freeDen(S.den); canvas.width = w; canvas.height = h; S.w = w; S.h = h; S.acc = mkTarget(w, h); try { S.den = mkDen(w, h); } catch (e) { S.den = null; } S.tiles = mkTiles(w, h, S.tileSize); reset(); }
  function reset() { S.pass = 0; S.tile = 0; S.metered = -1; if (S.den) S.den.valid = false; if (S.acc) { gl.bindFramebuffer(gl.FRAMEBUFFER, S.acc.f); gl.viewport(0, 0, S.acc.w, S.acc.h); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, null); } }
  // lumi\u00e8res (spots et omnidirectionnelles) et portails dans une texture : aucune limite d'uniformes
  function setLights(lights, portals) {
    const L = (lights || []).slice(0, MAXL), PO = (portals || []).slice().sort((a, b) => Math.hypot(...b.u) * Math.hypot(...b.v) - Math.hypot(...a.u) * Math.hypot(...a.v)).slice(0, 32);
    const n = L.length * 3 + PO.length * 4, a = new Float32Array(Math.max(1, n) * 4);
    L.forEach((l, i) => { const o = i * 12, d = l.dir; a.set([l.p[0], l.p[1], l.p[2], l.r || .05, l.c[0], l.c[1], l.c[2], d ? 1 : 0, d ? d[0] : 0, d ? d[1] : -1, d ? d[2] : 0, d ? Math.cos(l.cone || .6) : -2], o); });
    const pb = L.length * 3; PO.forEach((q, i) => { const o = (pb + i * 4) * 4, ul = Math.hypot(...q.u), vl = Math.hypot(...q.v); a.set([q.c[0], q.c[1], q.c[2], 4 * ul * vl, q.u[0], q.u[1], q.u[2], 0, q.v[0], q.v[1], q.v[2], 0, q.n[0], q.n[1], q.n[2], 0], o); });
    upload(tex.lgt, 13, a, Math.max(1, n)); S.nl = L.length; S.np = PO.length; S.pb = pb; S.lights = L; S.portals = PO; reset(); }

  function setScene(sc) {
    const t0 = performance.now(); const n = sc.mid.length; const bvh = buildBVH(sc.pos, n); const idx = bvh.idx;
    const tri = new Float32Array(Math.max(1, n) * 12), at = new Float32Array(Math.max(1, n) * 16);
    for (let k = 0; k < n; k++) { const i = idx[k], p = i * 9, o = k * 12, q = k * 16, u = i * 6;
      tri[o] = sc.pos[p]; tri[o + 1] = sc.pos[p + 1]; tri[o + 2] = sc.pos[p + 2]; tri[o + 3] = sc.mid[i];
      tri[o + 4] = sc.pos[p + 3] - sc.pos[p]; tri[o + 5] = sc.pos[p + 4] - sc.pos[p + 1]; tri[o + 6] = sc.pos[p + 5] - sc.pos[p + 2];
      tri[o + 8] = sc.pos[p + 6] - sc.pos[p]; tri[o + 9] = sc.pos[p + 7] - sc.pos[p + 1]; tri[o + 10] = sc.pos[p + 8] - sc.pos[p + 2];
      at[q] = sc.nor[p]; at[q + 1] = sc.nor[p + 1]; at[q + 2] = sc.nor[p + 2]; at[q + 3] = sc.uv[u];
      at[q + 4] = sc.nor[p + 3]; at[q + 5] = sc.nor[p + 4]; at[q + 6] = sc.nor[p + 5]; at[q + 7] = sc.uv[u + 1];
      at[q + 8] = sc.nor[p + 6]; at[q + 9] = sc.nor[p + 7]; at[q + 10] = sc.nor[p + 8]; at[q + 11] = sc.uv[u + 2];
      at[q + 12] = sc.uv[u + 3]; at[q + 13] = sc.uv[u + 4]; at[q + 14] = sc.uv[u + 5]; }
    upload(tex.tri, 0, tri, n * 3); upload(tex.attr, 1, at, n * 4); upload(tex.bvh, 2, bvh.nodes, bvh.count * 2);
    const nm = Math.max(1, sc.mats.length), mt = new Float32Array(nm * 20);
    sc.mats.forEach((m, i) => { const o = i * 20; mt[o] = m.c[0]; mt[o + 1] = m.c[1]; mt[o + 2] = m.c[2]; mt[o + 3] = m.tex == null ? -1 : m.tex; mt[o + 4] = m.rough; mt[o + 5] = m.metal || 0; mt[o + 6] = m.type || 0; mt[o + 7] = m.scale || 1; const e = m.emis || [0, 0, 0]; mt[o + 8] = e[0]; mt[o + 9] = e[1]; mt[o + 10] = e[2]; mt[o + 11] = m.nrm == null ? 0 : m.nrm; const t = m.tint || [1, 1, 1]; mt[o + 12] = t[0]; mt[o + 13] = t[1]; mt[o + 14] = t[2]; mt[o + 15] = m.macro || 0; mt[o + 16] = m.wx || 0; mt[o + 17] = m.natural ? 1 : 0; if (m.alp) { mt[o + 18] = m.alp[0]; mt[o + 19] = m.alp[1]; } });
    upload(tex.mat, 3, mt, nm * 5);
    // couches de textures (alb\u00e9do sRGB + normales/rugosit\u00e9)
    const LS = sc.texSize || 512, nl = Math.max(1, sc.layers.length); const tmp = document.createElement('canvas'); tmp.width = tmp.height = LS; const tx = tmp.getContext('2d', { willReadFrequently: true });
    const arr = (t, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, LS, LS, nl, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); };
    arr(tex.alb, 4); arr(tex.nr, 5); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const flat = new Uint8Array(LS * LS * 4); for (let i = 0; i < LS * LS; i++) { flat[i * 4] = 128; flat[i * 4 + 1] = 128; flat[i * 4 + 2] = 128; flat[i * 4 + 3] = 255; }
    sc.layers.forEach((L, i) => {
      let px; try { tx.clearRect(0, 0, LS, LS); tx.drawImage(L.img, 0, 0, LS, LS); px = new Uint8Array(tx.getImageData(0, 0, LS, LS).data.buffer); } catch (e) { px = flat; }
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.alb); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, LS, LS, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let nr = flat; if (L.nr && L.nrSize === LS) nr = L.nr; else if (L.nr) { const s2 = L.nrSize, c2 = document.createElement('canvas'); c2.width = c2.height = s2; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(L.nr.buffer.slice(0)), s2, s2), 0, 0); tx.clearRect(0, 0, LS, LS); tx.drawImage(c2, 0, 0, LS, LS); nr = new Uint8Array(tx.getImageData(0, 0, LS, LS).data.buffer); }
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.nr); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, LS, LS, 1, gl.RGBA, gl.UNSIGNED_BYTE, nr);
    });
    for (const [t, u] of [[tex.alb, 4], [tex.nr, 5]]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT); }
    setLights(sc.lights, sc.portals); S.tris = n; S.ready = n > 0; S.nodes = bvh.count; S.layers = sc.layers.length; S.buildMs = Math.round(performance.now() - t0); reset();
    return { tris: n, nodes: bvh.count, ms: S.buildMs, layers: sc.layers.length, mats: sc.mats.length, lights: S.nl, portals: S.np };
  }
  function setEnv(e) { S.env = e; reset(); }
  function setCamera(c) { const k = JSON.stringify(c); if (k === S.camKey) return false; S.camKey = k; S.cam = c; reset(); return true; }
  function setOptions(o) { const b = S.opt.bounces; Object.assign(S.opt, o); if (S.opt.bounces !== b) reset(); }

  function bindScene(w, h, cam, pr) {
    pr = pr || PT; const u = pr.u, e = S.env, c = cam || S.cam; gl.useProgram(pr.p); gl.bindVertexArray(vao);
    const tx2 = [[0, tex.tri, 'uTri'], [1, tex.attr, 'uAttr'], [2, tex.bvh, 'uBvh'], [3, tex.mat, 'uMat'], [13, tex.lgt, 'uLgt'], [14, tex.hdr, 'uHdr']]; for (const [k, t, n] of tx2) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[n], k); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.alb); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.nr); gl.uniform1i(u.uAlb, 4); gl.uniform1i(u.uNr, 5);
    gl.uniform2f(u.uRes, w, h); gl.uniform3fv(u.uCamPos, c.pos); gl.uniform3fv(u.uCamR, c.right); gl.uniform3fv(u.uCamU, c.up); gl.uniform3fv(u.uCamF, c.fwd); gl.uniform4f(u.uLens, c.tan, c.aperture || 0, c.focus || 5, c.shift || 0);
    gl.uniform1f(u.uPixAng, 2 * c.tan / h); gl.uniform1f(u.uClamp, S.opt.clamp * .25 / Math.max(S.opt.auto === false ? (S.opt.exposure || 1) : S.expo, 1e-3)); gl.uniform1i(u.uBounces, S.opt.bounces);
    gl.uniform3fv(u.uSunDir, e.sunDir); gl.uniform3fv(u.uSunE, e.sunE); gl.uniform3fv(u.uSunRad, e.sunRad); gl.uniform3fv(u.uSunGlow, e.glow); gl.uniform1f(u.uSunCos, e.sunCos);
    gl.uniform3fv(u.uSkyZen, e.zen); gl.uniform3fv(u.uSkyHor, e.hor); gl.uniform3fv(u.uSkyGnd, e.gnd); gl.uniform3fv(u.uCloudCol, e.cloudCol); gl.uniform4fv(u.uCloud, e.cloud); gl.uniform3fv(u.uFogCol, e.fogCol || e.hor);
    gl.uniform4fv(u.uFog, e.fog4 || [0, 30, 0, 600]); gl.uniform4fv(u.uWx, e.wx || [0, 0, 0, 0]); gl.uniform4fv(u.uWave, e.wave || [1, 0, 0, 0]); gl.uniform4fv(u.uSky2, [e.overcast || 0, e.stars || 0, S.hdrKey && e.hdr ? e.hdr : 0, e.hdrRot || 0]);
    gl.uniform3fv(u.uWaterAbs, e.waterAbs || [.45, .09, .06]); gl.uniform3fv(u.uWaterScat, e.waterScat || [.0, .02, .03]);
    gl.uniform4fv(u.uClip, e.clip || [0, 0, 0, 1e30]); gl.uniform1i(u.uNL, S.nl); gl.uniform1i(u.uNP, S.np); gl.uniform1i(u.uPB, S.pb || 0);
  }
  function drawTile(target, tl, pass, seed) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); gl.enable(gl.SCISSOR_TEST); gl.scissor(tl[0], tl[1], tl[2], tl[3]); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(PT.u.uFrame, seed); gl.uniform1f(PT.u.uAlpha, 1 / (pass + 1)); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); }
  function meter(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, met.f); gl.viewport(0, 0, 24, 24); gl.useProgram(MET.p); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, target.t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.uniform1i(MET.u.uAcc, 6); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Float32Array(24 * 24 * 4); gl.readPixels(0, 0, 24, 24, gl.RGBA, gl.FLOAT, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const v = []; for (let i = 0; i < 576; i++) v.push(px[i * 4]); v.sort((a, b) => a - b); let s = 0, c = 0; for (let i = 58; i < 518; i++) { s += v[i]; c++; } const avg = Math.exp(s / c); const key = S.env && S.env.key != null ? S.env.key : .25; return Math.max(.01, Math.min(60, key / Math.max(avg, 1e-5)));
  }
  function gain() { const ev = Math.pow(2, S.opt.ev || 0) * (S.opt.auto ? S.expo : (S.opt.exposure || 1)); const g = wbGain(S.opt.wb || 6000); return [g[0] * ev, g[1] * ev, g[2] * ev]; }
  function present(target, toFbo, w, h, D, spp) {
    const dn = D ? denoise(D, (target || S.acc).t, spp || 1) : null; const W = w || S.w, H = h || S.h; const src = dn || (target || S.acc).t, alb = dn ? D.a : (target || S.acc).t;
    const bl = bloom(src, alb, !!dn, W, H); const e = S.env || {};
    gl.bindFramebuffer(gl.FRAMEBUFFER, toFbo || null); gl.viewport(0, 0, W, H); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.useProgram(TM.p); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(TM.u.uAcc, 6); gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, alb); gl.uniform1i(TM.u.uAlbT, 12);
    gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, bl || src); gl.uniform1i(TM.u.uBloomT, 15); gl.uniform1f(TM.u.uBloom, bl ? S.opt.bloom * .6 : 0); gl.uniform1f(TM.u.uContrast, S.opt.contrast || 0); gl.uniform1f(TM.u.uSat, S.opt.sat || 0); gl.uniform4fv(TM.u.uPrecip, e.precip || [0, 0, 0, 0]);
    gl.uniform1f(TM.u.uRemod, dn ? 1 : 0); gl.uniform2f(TM.u.uRes, W, H); gl.uniform3fv(TM.u.uGain, gain()); gl.uniform1f(TM.u.uVig, S.opt.vignette || 0); gl.uniform1f(TM.u.uFlip, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // une \u00e9tape : rend autant de tuiles que le budget le permet ; renvoie l'\u00e9tat
  function step(now, sync) {
    if (S.lost || !S.ready || !S.env || !S.cam || !S.acc || !S.acc.ok) return { spp: 0, done: true, error: S.lost ? 'lost' : 'notready' };
    if (S.pass >= S.maxPass) return { spp: S.pass, done: true };
    if (!sync) { const dt = now - S.lastT; S.lastT = now; if (dt > 0 && dt < 2000) { if (dt > 70) S.tpf = Math.max(1, Math.floor(S.tpf * .6)); else if (dt < 34) S.tpf = Math.min(S.tiles.length, S.tpf + 1); } }
    if (S.den && !S.den.valid) gbuffer(S.den, S.cam);
    bindScene(S.w, S.h); const nT = sync ? S.tiles.length : S.tpf;
    for (let k = 0; k < nT; k++) { drawTile(S.acc, S.tiles[S.tile], S.pass, S.pass * 131 + 7); S.tile++; if (S.tile >= S.tiles.length) { S.tile = 0; S.pass++; if (S.opt.auto && (S.pass === 1 || S.pass === 4 || S.pass === 12 || S.pass === 40) && S.metered < S.pass) { S.expo = meter(S.acc); S.metered = S.pass; bindScene(S.w, S.h); } if (S.pass >= S.maxPass) break; } }
    present(null, null, 0, 0, S.den, Math.max(1, S.pass)); if (sync) gl.finish();
    return { spp: S.pass, done: S.pass >= S.maxPass, progress: S.tile / S.tiles.length };
  }
  // rendu d'export hors \u00e9cran, par tuiles, sans bloquer l'interface
  async function renderImage(o) {
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE); const w = Math.min(o.w, max), h = Math.min(o.h, max); const tg = mkTarget(w, h); if (!tg.ok) { freeTarget(tg); throw new Error('R\u00e9solution non prise en charge par la carte graphique.'); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, tg.f); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const tiles = mkTiles(w, h, o.tile || 160), cam = o.cam || S.cam, total = o.spp * tiles.length; let done = 0, last = performance.now(), per = 1; const wait = () => new Promise(r => o.sync ? r() : requestAnimationFrame(r));
    for (let p = 0; p < o.spp; p++) { for (let i = 0; i < tiles.length;) { bindScene(w, h, cam); for (let k = 0; k < per && i < tiles.length; k++, i++, done++) drawTile(tg, tiles[i], p, p * 131 + 7919); if (o.sync) gl.finish(); await wait(); const n = performance.now(), dt = n - last; last = n; if (!o.sync) { if (dt > 80) per = Math.max(1, per >> 1); else if (dt < 30) per = Math.min(64, per + 1); } if (o.onProgress) o.onProgress(done / total); if (o.cancel && o.cancel()) { freeTarget(tg); throw new Error('Rendu annul\u00e9.'); } if (S.lost) { throw new Error('Le contexte graphique a \u00e9t\u00e9 perdu.'); } }
      if (S.opt.auto && p === Math.min(3, o.spp - 1) && !o.keepExposure) S.expo = meter(tg); }
    // d\u00e9bruitage final guid\u00e9, halo, conversion (tons, gamma) puis lecture
    let D = null; if (o.denoise !== false) { try { D = mkDen(w, h); gbuffer(D, cam); } catch (e) { D = null; } }
    const out = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, out); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
    present(tg, fb, w, h, D, o.spp); freeDen(D); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(out); freeTarget(tg);
    const k = w + 'x' + h; if (blooms[k]) { blooms[k].forEach(l => { gl.deleteTexture(l.t); gl.deleteFramebuffer(l.f); }); delete blooms[k]; }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'), id = cx.createImageData(w, h); for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); cx.putImageData(id, 0, 0); S.camKey = null;
    return cv;
  }
  return { denoise: () => !!(DN && GB), setSize, setScene, setLights, setEnv, setHdr, setCamera, setOptions, step, reset, renderImage, present, get state() { return S; }, gl };
}
TP.Tracer = { supported, create, pbrMaps, buildBVH, wbGain, kelvinRGB, MAXL };
})(typeof window !== 'undefined' ? window : globalThis);
