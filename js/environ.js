/* Trait de Plan \u2014 environnement 3D : paysage jusqu'\u00e0 l'horizon, eau, v\u00e9g\u00e9tation instanci\u00e9e, ville, m\u00e9t\u00e9o anim\u00e9e,
   ciel et \u00e9clairage temps r\u00e9el, environnement du rendu photor\u00e9aliste, animations (timelapse, visite), vid\u00e9o, HDRI. */
(function (G) {
'use strict';
const TP = G.TP; if (!TP) return;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = () => TP.View3D, I = () => TP.View3D._, ST = () => TP.View3D && TP.View3D.state;
const Env = { E: null, hdriData: null, play: null };
let U = null;
function uni() { if (U) return U; U = { uTime: { value: 0 }, uWind: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 }, uRain: { value: 0 }, uWave: { value: .3 }, uWaveDir: { value: { x: 1, y: 0 } }, uFlash: { value: 0 }, uFoam: { value: null }, uFoamR: { value: { x: 0, y: 0, z: 1, w: 1 } } }; return U; }
const lin = h => { const c = new THREE.Color(h); if (c.convertSRGBToLinear) c.convertSRGBToLinear(); return c; };
const mixHex = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, clamp(t, 0, 1)).getHexString(); };
const shade = TP.shade;

/* ================= shaders : intemp\u00e9ries, vent, eau ================= */
const NOISE = `float wxH(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float wxN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(wxH(i),wxH(i+vec2(1,0)),f.x), mix(wxH(i+vec2(0,1)),wxH(i+vec2(1,1)),f.x), f.y); }
float wxF(vec2 p){ return (wxN(p)*0.5+wxN(p*2.03+17.0)*0.25+wxN(p*4.1+3.0)*0.125+wxN(p*8.3+9.0)*0.0625)/0.9375; }
vec2 wxRipple(vec2 x, float tm){ vec2 g=vec2(0.0); vec2 c=floor(x*2.5); for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 cc=c+vec2(float(i),float(j)); float r=wxH(cc); vec2 ctr=(cc+vec2(wxH(cc+3.1),wxH(cc+7.7)))/2.5; float ph=fract(r+tm*0.9); vec2 dd=x-ctr; float dist=length(dd); float rad=ph*0.42; float w=exp(-pow((dist-rad)*16.0,2.0))*(1.0-ph); g+=dd/max(dist,1e-3)*w*sin((dist-rad)*55.0)*0.3; } return g; }`;
const VPARS = 'uniform float uTime; uniform float uWind; varying vec3 vWxP; varying vec3 vWxN;\n';
const FPARS = 'uniform float uTime; uniform float uSnow; uniform float uWet; uniform float uRain; varying vec3 vWxP; varying vec3 vWxN;\n' + NOISE + '\n';
function vertexWx(o) {
  const wind = o.wind ? `{ vec4 wo = modelMatrix * vec4(0.0,0.0,0.0,1.0);
  #ifdef USE_INSTANCING
  wo = modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
  #endif
  float ph = wo.x*0.37 + wo.z*0.23; float hg = clamp(position.y, 0.0, 1.5); float sw = uWind*(0.016+0.03*uWind)*hg*hg;
  transformed.x += sin(uTime*1.3+ph)*sw + sin(uTime*7.1+position.x*31.0+ph)*0.005*uWind*hg; transformed.z += cos(uTime*1.07+ph*1.3)*sw*0.6 + cos(uTime*6.3+position.z*27.0)*0.004*uWind*hg; }` : '';
  return [wind, `{ vec4 wxp = vec4(transformed,1.0); vec3 wxn = objectNormal;
  #ifdef USE_INSTANCING
  wxp = instanceMatrix * wxp; wxn = mat3(instanceMatrix) * wxn;
  #endif
  vWxP = (modelMatrix * wxp).xyz; vWxN = normalize(mat3(modelMatrix) * wxn); }`];
}
const ALPGL = alp => `float sl=${(+alp[1]).toFixed(1)}; float n1=wxF(vWxP.xz*0.006+1.7), n2=wxF(vWxP.xz*0.045+5.3), n3=wxF(vWxP.xz*0.35);
      float up=vWxN.y+(n2-0.5)*0.22+(n3-0.5)*0.1; float rockA=1.0-smoothstep(0.66,0.84,up);
      float strata=clamp(wxF(vec2(vWxP.y*0.09+n1*7.0, dot(vWxP.xz,vec2(0.003,0.002))+n2))*1.5-0.25+0.25*sin(vWxP.y*0.21+n2*9.0),0.0,1.0);
      vec3 rockC=mix(vec3(0.17,0.16,0.15),vec3(0.42,0.39,0.36),strata)*(0.8+0.4*n3);
      float hN=vWxP.y+(n1-0.5)*220.0+(n2-0.5)*60.0;
      float forest=${alp[0] > 1.5 ? '1.0' : '0.0'}*(1.0-smoothstep(sl-110.0,sl-40.0,hN))*smoothstep(0.78,0.9,up)*smoothstep(0.40,0.5,wxF(vWxP.xz*0.012+8.0)+(n3-0.5)*0.15);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.03,0.062,0.026)*(0.45+1.1*wxF(vWxP.xz*0.55+2.0))*(0.75+0.5*n2),forest);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.05,0.93,0.68),smoothstep(sl-160.0,sl,hN)*(1.0-forest));
      float scree=smoothstep(0.62,0.74,up)*(1.0-smoothstep(0.8,0.9,up))*smoothstep(0.35,0.6,wxF(vWxP.xz*0.02+4.0))*(1.0-forest); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.30,0.285,0.26)*(0.75+0.5*n3),scree*0.5); diffuseColor.rgb=mix(diffuseColor.rgb,rockC,rockA);
      float snowA=smoothstep(sl-25.0,sl+45.0,hN)*smoothstep(0.42,0.62,up+0.08);
      snowA=max(snowA,smoothstep(sl-150.0,sl-40.0,hN)*smoothstep(0.6,0.7,n2)*smoothstep(0.5,0.7,up)*0.9);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.84,0.87,0.92),snowA); roughnessFactor=mix(roughnessFactor,0.6,snowA);
      float bh0=wxF(vWxP.xz*0.07+vWxP.y*0.05)*0.7+wxF(vWxP.xz*0.33+vWxP.y*0.21)*0.3, bhx=wxF((vWxP.xz+vec2(1.5,0.0))*0.07+vWxP.y*0.05)*0.7+wxF((vWxP.xz+vec2(1.5,0.0))*0.33+vWxP.y*0.21)*0.3, bhz=wxF((vWxP.xz+vec2(0.0,1.5))*0.07+vWxP.y*0.05)*0.7+wxF((vWxP.xz+vec2(0.0,1.5))*0.33+vWxP.y*0.21)*0.3;
      vec3 bg=vec3(bh0-bhx,0.0,bh0-bhz)/1.5*(5.0+26.0*rockA)*(1.0-snowA*0.65)*(1.0-forest*0.5); diffuseColor.rgb*=mix(1.0,0.62+0.76*bh0,max(rockA,0.35)*(1.0-snowA*0.7)); alpG=bg;`;
function patch(m, o) {
  if (typeof THREE === 'undefined' || THREE.MINI || !m || m.userData.wxPatched) return m; const u = uni(); m.userData.wxPatched = true; const fol = !!o.fol, wind = !!o.wind;
  const alp = o.alp || null; const ALP = alp ? `{ ${ALPGL(alp)} }` : '';
  m.customProgramCacheKey = () => 'wx' + (fol ? 'f' : '') + (wind ? 'w' : '') + (alp ? 'a' + alp.join('_') : '');
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime: u.uTime, uWind: u.uWind, uSnow: u.uSnow, uWet: u.uWet, uRain: u.uRain });
    const [wv, wp] = vertexWx({ wind });
    sh.vertexShader = VPARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + wv).replace('#include <project_vertex>', '#include <project_vertex>\n' + wp);
    sh.fragmentShader = FPARS + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float wxSnowM = 0.0; float wxPud = 0.0; vec3 alpG = vec3(0.0);')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  ${ALP}
  { float ny = ${fol ? 'abs(vWxN.y)' : 'vWxN.y'};
    if (uSnow > 0.0) { float nm = smoothstep(0.22,0.62,ny); float nz = wxF(vWxP.xz*1.3+vWxP.y*0.7)*0.6+wxN(vWxP.xz*7.0+vWxP.y*3.0)*0.4; wxSnowM = clamp(uSnow*1.7-(1.0-nm)*1.3-(0.55-nz)*0.7,0.0,1.0)*nm; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.88,0.92)*(0.92+0.16*nz), wxSnowM); roughnessFactor = mix(roughnessFactor, 0.6, wxSnowM); }
    ${fol ? '' : `if (uWet > 0.0) { float wet = uWet*(1.0-wxSnowM);
      if (vWxN.y > 0.6) { diffuseColor.rgb *= mix(1.0,0.58,wet); roughnessFactor = mix(roughnessFactor, roughnessFactor*0.3, wet); wxPud = smoothstep(0.57,0.63,wxF(vWxP.xz*0.3+1.3))*smoothstep(0.35,0.9,wet); diffuseColor.rgb *= mix(1.0,0.55,wxPud); roughnessFactor = mix(roughnessFactor,0.03,wxPud); }
      else if (abs(vWxN.y) < 0.35) { float st = smoothstep(0.3,0.75,wxN(vec2((vWxP.x+vWxP.z)*5.0, vWxP.y*0.5))); diffuseColor.rgb *= mix(1.0,0.68,wet*(0.4+0.6*st)); roughnessFactor = mix(roughnessFactor, roughnessFactor*0.4, wet*st); } }`} }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  ${alp ? 'normal = normalize(normal + (viewMatrix*vec4(alpG,0.0)).xyz);' : ''}
  if (wxSnowM > 0.0 || wxPud > 0.0) { vec3 gn = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0); normal = normalize(mix(normal, gn, max(wxSnowM*0.8, wxPud)));
    if (wxPud > 0.0 && uRain > 0.0) { vec2 rp = wxRipple(vWxP.xz, uTime)*uRain*wxPud; normal = normalize(normal + (viewMatrix*vec4(rp.x,0.0,rp.y,0.0)).xyz); } }`);
  };
  return m;
}
function waterMaterial(w, foamCanvas) {
  const u = uni(); const m = new THREE.MeshStandardMaterial({ color: lin(w.color), roughness: .05, metalness: .02, transparent: true, opacity: w.clear ? .74 : .9, depthWrite: false });
  m.envMapIntensity = 1.5; m.userData.rt = { type: 2, natural: 1, wx: 0 }; if (foamCanvas) m.userData.rtMap = foamCanvas;
  if (THREE.MINI) return m;
  m.customProgramCacheKey = () => 'eau';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime: u.uTime, uWind: u.uWind, uRain: u.uRain, uWave: u.uWave, uWaveDir: u.uWaveDir, uFoam: u.uFoam, uFoamR: u.uFoamR, uSnow: u.uSnow, uWet: u.uWet });
    const [, wp] = vertexWx({});
    sh.vertexShader = VPARS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + wp);
    sh.fragmentShader = FPARS + 'uniform float uWave; uniform vec2 uWaveDir; uniform sampler2D uFoam; uniform vec4 uFoamR;\n' +
      `vec2 wxWave(vec2 x){ vec2 d=normalize(uWaveDir+vec2(1e-5)); vec2 g=vec2(0.0); for(int i=0;i<5;i++){ float fi=float(i); float a=(fi-2.0)*0.42; vec2 di=vec2(d.x*cos(a)-d.y*sin(a), d.x*sin(a)+d.y*cos(a)); float k=0.32*pow(1.75,fi); float am=(0.02+uWave*0.07)/pow(1.55,fi); g+=di*(am*k*cos(dot(di,x)*k+uTime*sqrt(9.8*k)+fi*1.7)); } g+=(vec2(wxN(x*1.7+uTime*0.15), wxN(x*1.7+7.0-uTime*0.15))-0.5)*(0.05+0.1*uWave); if(uRain>0.0) g+=wxRipple(x,uTime)*uRain; return g; }\n` + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float wxFoam = 0.0;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec2 fu = (vWxP.xz - uFoamR.xy)/uFoamR.zw; if (fu.x>0.0 && fu.y>0.0 && fu.x<1.0 && fu.y<1.0) wxFoam = texture2D(uFoam, fu).r; wxFoam *= smoothstep(0.35,0.75, wxN(vWxP.xz*1.6+uTime*0.4)+wxFoam*0.5); wxFoam += uWave*0.18*smoothstep(0.82,0.95,wxN(vWxP.xz*0.7-uTime*0.2));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), clamp(wxFoam,0.0,1.0)); diffuseColor.a = mix(diffuseColor.a, 1.0, clamp(wxFoam,0.0,1.0)); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.9, clamp(wxFoam,0.0,1.0));')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n { vec2 g = wxWave(vWxP.xz); normal = normalize((viewMatrix*vec4(normalize(vec3(-g.x,1.0,-g.y)),0.0)).xyz); }');
  };
  return m;
}

/* ================= ciel et \u00e9clairage temps r\u00e9el ================= */
function skyMat() {
  const u = uni();
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, .95, .85) }, sunAmt: { value: 1 }, uClouds: { value: .3 }, uOvercast: { value: 0 }, uStars: { value: 0 }, uDark: { value: 0 }, uTime: u.uTime, uWind: u.uWind, uFlash: u.uFlash },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt, uClouds, uOvercast, uStars, uDark, uTime, uWind, uFlash; varying vec3 vDir;\n' + NOISE + `
void main(){
#include <logdepthbuf_fragment>
  vec3 d = normalize(vDir); float h = d.y; vec3 c = h > 0.0 ? mix(hor, zen, pow(clamp(h,0.0,1.0),0.5)) : mix(hor, gnd, clamp(-h*4.0,0.0,1.0));
  float mu = max(dot(d, normalize(sunDir)), 0.0); c += sunCol*(pow(mu,900.0)*3.0*(1.0-uOvercast) + pow(mu,10.0)*0.15*(1.0-uOvercast*0.8))*sunAmt;
  if (h > 0.0) { vec2 p = d.xz/(h+0.12)*0.55 + vec2(uTime*0.004*(0.3+uWind*2.0), uTime*0.0015);
    float cov = uOvercast > 0.98 ? 1.0 : smoothstep(1.0-uClouds, 1.0-uClouds+0.3, wxF(p))*smoothstep(0.0,0.12,h);
    if (uStars > 0.0) { vec3 q = d*280.0; vec3 i = floor(q); float hs = fract(sin(dot(i,vec3(12.9898,78.233,37.719)))*43758.5453); if (hs > 0.996) { vec3 f = fract(q)-0.5; c += vec3(0.85,0.92,1.0)*exp(-dot(f,f)*55.0)*uStars*(hs-0.996)*250.0*smoothstep(0.0,0.2,h)*(1.0-cov); } }
    float dn = wxF(p*1.7+3.1); vec3 cc = mix(vec3(0.97), vec3(0.5,0.53,0.58), clamp(uDark + (1.0-dn)*0.35, 0.0, 1.0)) * (0.12 + 0.88*max(sunAmt, uOvercast*0.6)) * (1.0 + pow(mu,6.0)*0.8*(1.0-uOvercast));
    c = mix(c, mix(cc, hor*1.02, uOvercast*0.55), cov*(1.0-uOvercast*0.4)); }
  c += uFlash*vec3(0.75,0.8,0.95);
  gl_FragColor = vec4(c, 1.0); }` });
}
function skyState(P, s) {
  const wx = P.env.wx || {}, oc = wx.overcast || 0, dk = wx.dark || 0, fg = wx.fog || 0; let zen = '#3C78C8', hor = '#CFE2F1';
  const dusk = clamp(1 - Math.abs(s.el) / .2, 0, 1) * (1 - oc * .7); hor = mixHex(hor, '#F0A66E', dusk * .75); zen = mixHex(zen, '#3D5A8F', dusk * .5);
  zen = mixHex(zen, '#9AA3AD', oc); hor = mixHex(hor, '#C9CED3', oc); zen = mixHex(zen, '#4A5058', dk); hor = mixHex(hor, '#6E747B', dk * .85); hor = mixHex(hor, '#DDE1E4', fg * .7 * (1 - dk));
  zen = mixHex('#040914', zen, s.day); hor = mixHex('#0F1828', hor, s.day);
  return { zen, hor, ground: mixHex('#141A14', '#8E9A84', s.day), sunAmt: s.day * (1 - oc * .95), clouds: wx.clouds || 0, overcast: oc, stars: Math.pow(1 - (s.day0 != null ? s.day0 : s.day), 2) * (1 - oc), dark: dk };
}
function applySky(mat, sp, s) { const u = mat.uniforms; u.zen.value.set(sp.zen); u.hor.value.set(sp.hor); u.gnd.value.set(sp.ground); u.sunDir.value.copy(s.dir); u.sunAmt.value = sp.sunAmt; u.uClouds.value = sp.clouds; u.uOvercast.value = sp.overcast; u.uStars.value = sp.stars; u.uDark.value = sp.dark; }
function moonDir(P) { const m = TP.moonPos(P), nv = TP.northVec(P), ev = [-nv[1], nv[0]]; const hx = nv[0] * Math.cos(m.az) + ev[0] * Math.sin(m.az), hz = nv[1] * Math.cos(m.az) + ev[1] * Math.sin(m.az); return { el: m.el, v: [hx * Math.cos(m.el), Math.sin(m.el), hz * Math.cos(m.el)] }; }
function lighting(P, scene, s) {
  const T = ST(); uni(); const L = Env.L = Env.L || {}; const sp = skyState(P, s); const wx = P.env.wx || {};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), skyMat()); sky.renderOrder = -1; sky.frustumCulled = false; sky.userData.rtSkip = true; sky.name = 'Ciel'; scene.add(sky); applySky(sky.material, sp, s); L.sky = sky;
  // reflets : carte d'environnement calcul\u00e9e sur le m\u00eame ciel
  if (!L.envSky && T.envScene) { L.envSky = skyMat(); T.envScene.children.forEach(c => { c.material = L.envSky; }); }
  const ek = envKey(P); if (ek !== T.envKey && L.envSky && T.pmrem) { applySky(L.envSky, sp, s); if (T.envRT) T.envRT.dispose(); try { T.envRT = T.pmrem.fromScene(T.envScene, .04); } catch (e) { T.envRT = null; } T.envKey = ek; }
  if (Env.hdriTex && P.env.hdri) { scene.background = Env.hdriTex; scene.environment = Env.hdriEnv || (T.envRT && T.envRT.texture); sky.visible = false; }
  else { if (T.envRT) scene.environment = T.envRT.texture; scene.background = new THREE.Color(sp.hor); }
  scene.fog = new THREE.FogExp2(new THREE.Color(mixHex(sp.hor, '#9BA4AC', (wx.fog || 0) * .3 * s.day)), fogDensity(P));
  const hemi = new THREE.HemisphereLight(lin(sp.zen), lin(sp.ground), 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(P.env.graphics === 'eco' ? 1024 : P.env.graphics === 'ultra' ? 4096 : 2048, P.env.graphics === 'eco' ? 1024 : P.env.graphics === 'ultra' ? 4096 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x8FA6D8, 0); scene.add(moon);
  Object.assign(L, { hemi, sun, moon }); updateLighting(P, s, true); return L;
}
function envKey(P) { const e = P.env, w = e.wx || {}; return [Math.round((e.hour || 0) * 4), e.month, e.weather, Math.round((w.overcast || 0) * 10), Math.round((w.dark || 0) * 10), Math.round((w.clouds || 0) * 10), P.north, e.lat, e.lon].join('|'); }
function fogDensity(P) { const w = P.env.wx || {}; return .00014 + (w.fog || 0) * (w.mist ? .012 : .028) + (w.rain || 0) * .004 + (w.snow || 0) * .01; }
// mise \u00e0 jour rapide (animation de l'heure, de la m\u00e9t\u00e9o) sans reconstruire la sc\u00e8ne
function updateLighting(P, s, first) {
  const T = ST(), L = Env.L; if (!T || !L || !L.sun) return; s = s || V()._.sunState(P); T.sun = s; const wx = P.env.wx || {}; const sp = skyState(P, s); const oc = wx.overcast || 0, cl = wx.clouds || 0;
  if (L.sky) applySky(L.sky.material, sp, s); if (T.scene && T.scene.fog) { T.scene.fog.color.set(mixHex(sp.hor, '#9BA4AC', (wx.fog || 0) * .3 * s.day)); T.scene.fog.density = fogDensity(P); } if (T.scene && T.scene.background && T.scene.background.isColor) T.scene.background.set(sp.hor);
  L.hemi.color.copy(lin(sp.zen)); L.hemi.groundColor.copy(lin(sp.ground)); L.hemi.intensity = (.18 + .82 * s.day) * (.42 + .45 * oc); L.hemiBase = L.hemi.intensity;
  L.sun.color.copy(lin(mixHex('#FFB774', '#FFF4E6', clamp(Math.sin(s.el) / .35, 0, 1)))); L.sun.intensity = 1.6 * s.day * (1 - oc * .92) * (1 - cl * (1 - oc) * .2); L.sun.castShadow = oc < .75 && s.day > .05; L.sun.shadow.radius = 3 + cl * 6;
  const b = T.bounds || { cx: 0, cz: 0, span: 12 }; const span = Math.max(b.span || 12, 8); const cx = b.cx, cz = b.cz;
  L.sun.position.set(cx + s.dir.x * span * 2, Math.max(2, s.dir.y * span * 2) + 2, cz + s.dir.z * span * 2); L.sun.target.position.set(cx, 0, cz); const sc = L.sun.shadow.camera; sc.left = -span * .8; sc.right = span * .8; sc.top = span * .8; sc.bottom = -span * .8; sc.near = .5; sc.far = span * 5 + 40; sc.updateProjectionMatrix();
  const md = moonDir(P); L.moon.position.set(cx + md.v[0] * 50, Math.max(5, md.v[1] * 50), cz + md.v[2] * 50); L.moon.intensity = .14 * (1 - (s.day0 != null ? s.day0 : s.day)) * (md.el > 0 ? 1 : .35) * (1 - oc * .7);
  if (T.renderer) T.renderer.toneMappingExposure = 1.15 * Math.pow(2, (T.camOpt && T.camOpt.ev) || 0) * (1 + (1 - (s.day0 != null ? s.day0 : s.day)) * 1.3);
  const u = uni(); u.uWind.value = wx.wind || 0; u.uSnow.value = (TP.PLACES[P.env.place] || {}).nosnow ? 0 : (wx.snowAcc || 0); u.uWet.value = wx.wet || 0; u.uRain.value = wx.rain || 0;
  if (Env.E) { const E = Env.E; if (E.rain) { E.rain.visible = (wx.rain || 0) > .01; E.rain.material.uniforms.uRain.value = wx.rain || 0; E.rain.material.uniforms.uCol.value.set(mixHex('#2A3038', '#C9D1D8', s.day)); } if (E.snow) { E.snow.visible = (wx.snow || 0) > .01; E.snow.material.uniforms.uSnow.value = wx.snow || 0; E.snow.material.uniforms.uCol.value.set(mixHex('#3A4252', '#F4F6F8', s.day)); }
    for (const f of E.fog) { f.visible = (wx.fog || 0) > .05; f.material.opacity = (wx.fog || 0) * (wx.mist ? .5 : .28) * f.userData.k; f.material.color.set(mixHex(sp.hor, '#E9ECEE', .5 * s.day)); } }
  T.dirty = true;
}

/* ================= paysage ================= */
const GSCALE = { grass: 1, sand: 1.6, rockface: 3.5, snow: 3, soil: 1.3, gravel: 1, asphalt: 2.4, tiles: 1, canopy: 30, field: 6 };
function seasonGround(key, c, season) { const g = TP.GROUNDS[key] || {}; if (!g.veg || key === 'forest') return key === 'forest' && season === 'automne' ? shade(c, -.05) : c;
  if (season === 'printemps') return mixHex(c, '#86B25A', .35); if (season === 'automne') return mixHex(c, '#8C8A4E', .45); if (season === 'hiver') return mixHex(c, '#7D7556', .5); return c; }
let userGround = { url: null, cv: null };
function userGroundCanvas(P) { const u = P.env.groundTex; if (!u || typeof Image === 'undefined' || THREE.MINI) return null; if (userGround.url === u) return userGround.cv; userGround = { url: u, cv: null };
  const img = new Image(); img.onload = () => { if (userGround.url !== u) return; const cv = document.createElement('canvas'); cv.width = cv.height = 512; cv.getContext('2d').drawImage(img, 0, 0, 512, 512); userGround.cv = cv; rebuild(); }; img.src = u; return null; }
function groundMat(key, season, P) { const far = key === 'alpFar'; if (far) key = TP.GROUNDS[P.env.groundKind] ? P.env.groundKind : 'alpine'; const slK = { ete: 1.4, printemps: 1, automne: 1.2, hiver: .55 }[season] || 1; const g = TP.GROUNDS[key] || TP.GROUNDS.grass; const col = seasonGround(key, g.c, season); const kind = g.tex === 'tiles' ? 'pavers' : g.tex;
  const m = I().texMat(kind, col, GSCALE[g.tex] || 1, Object.assign({ rough: key === 'snow' ? .55 : key === 'asphalt' ? .8 : 1, env: .25, wx: 1, noclip: true }, far ? { alp: [(P.env.veg && P.env.veg.d > .2 && key !== 'snow') ? 2 : 1, key === 'snow' ? -5000 : Math.round((P.env.snowLine != null ? P.env.snowLine : 600) * slK)] } : {})); m.clippingPlanes = null; if (far) { m.userData.rt.alp = [(P.env.veg && P.env.veg.d > .2 && key !== 'snow') ? 2 : 1, key === 'snow' ? -5000 : Math.round((P.env.snowLine != null ? P.env.snowLine : 600) * slK)]; m.userData.rt.macro = .25; }
  const ucv = P && g.veg && key !== 'forest' ? userGroundCanvas(P) : null;
  if (ucv) { const m2 = m.clone(); m2.onBeforeCompile = m.onBeforeCompile; if (m.customProgramCacheKey) m2.customProgramCacheKey = m.customProgramCacheKey; const t = new THREE.CanvasTexture(ucv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 2.5, 1 / 2.5); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; m2.map = t; m2.color.set('#ffffff'); m2.userData = Object.assign({}, m.userData, { rt: Object.assign({}, m.userData.rt || {}, { macro: .1 }) }); m2.clippingPlanes = null; return m2; }
  return m; }
function terrainMesh(P, c, E) {
  const T = ST(), gq = P.env.graphics || 'normal', N = gq === 'eco' ? 160 : gq === 'ultra' ? 400 : 300; const F = c.F; const hw = Math.max(F.hw, F.hd) / 100; const Si = Math.max(60, hw * 1.42 + 35), Rf = 5500, g0 = .42, kk = 3.7, ek = Math.exp(kk) - 1;
  const f = gv => { const a = Math.abs(gv), sg = gv < 0 ? -1 : 1; if (a <= g0) return sg * a / g0 * Si; const u = (a - g0) / (1 - g0); return sg * (Si + (Math.exp(u * kk) - 1) / ek * (Rf - Si)); };
  const n1 = N + 1, pos = new Float32Array(n1 * n1 * 3), uvs = new Float32Array(n1 * n1 * 2), xs = [];
  for (let i = 0; i <= N; i++) xs.push(f(i / N * 2 - 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = c.hx + xs[i], z = c.hz + xs[j], k = j * n1 + i, y = c.h(x, z) - .03; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uvs[k * 2] = x; uvs[k * 2 + 1] = z; }
  const groups = new Map(); const season = T.season; const alpOn = ['mountains', 'valley', 'summit'].includes((P.env.relief || {}).type) || ((P.env.relief || {}).peaks > 0), gk0 = P.env.groundKind;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * n1 + i, b = a + 1, cc = a + n1, d = cc + 1; const ax = pos[a * 3], az = pos[a * 3 + 2], dx = pos[d * 3] - ax, dz = pos[d * 3 + 2] - az; const ya = pos[a * 3 + 1], yb = pos[b * 3 + 1], yc = pos[cc * 3 + 1], yd = pos[d * 3 + 1];
    const sx = ((yb - ya) + (yd - yc)) / 2 / Math.max(dx, 1e-3), sz = ((yc - ya) + (yd - yb)) / 2 / Math.max(dz, 1e-3), ny = 1 / Math.hypot(sx, sz, 1);
    let key = c.groundAt(ax + dx / 2, az + dz / 2, (ya + yb + yc + yd) / 4 + .03, ny); if (alpOn && (key === 'rock' || key === 'snow' || key === 'forestFar' || key === gk0) && Math.hypot(ax + dx / 2 - c.hx, az + dz / 2 - c.hz) > 170) key = 'alpFar'; let arr = groups.get(key); if (!arr) groups.set(key, arr = []); arr.push(a, cc, b, b, cc, d); }
  // normales liss\u00e9es sur la grille partag\u00e9e
  const nrm = new Float32Array(pos.length);
  for (const arr of groups.values()) for (let i = 0; i < arr.length; i += 3) { const a = arr[i] * 3, b = arr[i + 1] * 3, cc = arr[i + 2] * 3; const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2], e2x = pos[cc] - pos[a], e2y = pos[cc + 1] - pos[a + 1], e2z = pos[cc + 2] - pos[a + 2]; const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; for (const v of [a, b, cc]) { nrm[v] += nx; nrm[v + 1] += ny; nrm[v + 2] += nz; } }
  for (let i = 0; i < nrm.length; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1; nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; }
  // roche : sommets d\u00e9doubl\u00e9s avec une projection par face (pas de texture \u00e9tir\u00e9e sur les parois)
  const xP = [], xN = [], xU = []; let nv = n1 * n1;
  for (const [key, arr] of groups) { if ((TP.GROUNDS[key] || {}).tex !== 'rockface') continue; const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i += 3) { let fx = 0, fy = 0, fz = 0; for (let k = 0; k < 3; k++) { const v = arr[i + k] * 3; fx += nrm[v]; fy += nrm[v + 1]; fz += nrm[v + 2]; } const ax = Math.abs(fx), ay = Math.abs(fy), az = Math.abs(fz), mode = ay > Math.max(ax, az) * 1.1 ? 0 : ax > az ? 1 : 2;
      for (let k = 0; k < 3; k++) { const v = arr[i + k] * 3, x = pos[v], y = pos[v + 1], z = pos[v + 2]; xP.push(x, y, z); xN.push(nrm[v], nrm[v + 1], nrm[v + 2]); if (mode === 0) xU.push(x, z); else if (mode === 1) xU.push(z, -y); else xU.push(x, -y); out[i + k] = nv++; } }
    groups.set(key, out); }
  const cat = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  const total = [...groups.values()].reduce((s, a) => s + a.length, 0), idx = new Uint32Array(total); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(cat(pos, xP), 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(cat(nrm, xN), 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(cat(uvs, xU), 2));
  const mats = []; let off = 0; for (const [key, arr] of groups) { idx.set(arr, off); geo.addGroup(off, arr.length, mats.length); mats.push(groundMat(key, season, P)); off += arr.length; }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, mats); mesh.receiveShadow = true; mesh.name = 'Terrain'; E.group.add(mesh); T.ground = mesh; E.groundKeys = [...groups.keys()]; E.stats.terrainTris = total / 3;
}
// \u00e9cume : zones de faible profondeur (texture vue du dessus, rang\u00e9e 0 = bord z maximal)
function foamCanvas(c, R) { const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), id = x.createImageData(S, S), lev = c.level;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const wx = c.hx - R + (i + .5) / S * 2 * R, wz = c.hz + R - (j + .5) / S * 2 * R; const dpt = lev - c.h(wx, wz); const v = dpt > 0 && dpt < 1.3 ? Math.pow(1 - dpt / 1.3, 1.6) : 0; const o = (j * S + i) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = Math.round(v * 255); id.data[o + 3] = 255; }
  x.putImageData(id, 0, 0); return cv; }
function waterMesh(P, c, E) {
  const w = c.water; if (w.type === 'none') return; const u = uni(); const R = 260; let foam = null; if (w.type !== 'river') { foam = foamCanvas(c, R); const t = new THREE.CanvasTexture(foam); u.uFoam.value = t; u.uFoamR.value = { x: c.hx - R, y: c.hz - R, z: 2 * R, w: 2 * R }; } else u.uFoamR.value = { x: 0, y: 0, z: 1, w: 1 };
  const mat = waterMaterial(w, foam); const P3 = [], UV = []; const uvOf = (x, z) => [(x - (c.hx - R)) / (2 * R), (z - (c.hz - R)) / (2 * R)]; const tri = (a, b, d) => { for (const p of [a, b, d]) { P3.push(p[0], w.level, p[1]); UV.push(...uvOf(p[0], p[1])); } };
  if (w.type === 'sea') { const S = 9000; const q = [[c.hx - S, c.hz - S], [c.hx + S, c.hz - S], [c.hx + S, c.hz + S], [c.hx - S, c.hz + S]]; tri(q[0], q[3], q[1]); tri(q[1], q[3], q[2]); }
  else if (w.type === 'lake') { const n = 72, ctr = [c.hx + c.sv[0] * w.lakeC, c.hz + c.sv[1] * w.lakeC], ra = w.lakeR * 1.25, rb = w.lakeR * 1.5 * 1.25; let prev = null; for (let i = 0; i <= n; i++) { const a = i / n * 6.2832, p = [ctr[0] + c.sv[0] * Math.cos(a) * ra + c.pv[0] * Math.sin(a) * rb, ctr[1] + c.sv[1] * Math.cos(a) * ra + c.pv[1] * Math.sin(a) * rb]; if (prev) tri(ctr, p, prev); prev = p; } }
  else { let prev = null; for (let b = -1500; b <= 1500; b += 12) { const rd = w.river(c.hx + c.pv[0] * b, c.hz + c.pv[1] * b); const a = rd.aR, hwid = w.width / 2 + 3; const ctr = [c.hx + c.sv[0] * a + c.pv[0] * b, c.hz + c.sv[1] * a + c.pv[1] * b]; const L = [ctr[0] - c.sv[0] * hwid, ctr[1] - c.sv[1] * hwid], Rr = [ctr[0] + c.sv[0] * hwid, ctr[1] + c.sv[1] * hwid]; if (prev) { tri(prev[0], L, prev[1]); tri(prev[1], L, Rr); } prev = [L, Rr]; } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(P3), 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(UV), 2)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'Eau'; mesh.renderOrder = 2; E.group.add(mesh); E.water = mesh; E.hasWater = true;
  const wd = (w.wdir || 0) * Math.PI / 180, dx = -c.sv[0], dz = -c.sv[1]; u.uWaveDir.value = { x: dx * Math.cos(wd) - dz * Math.sin(wd), y: dx * Math.sin(wd) + dz * Math.cos(wd) };
}

/* ================= v\u00e9g\u00e9tation instanci\u00e9e ================= */
const SPCOL = { tree: '#4E7F3C', conifer: '#3F6B3A', birch: '#7FA650', palm: '#5E8F3C', olive: '#8A9A6A', cypress: '#2F4A2E', pine: '#4C6B3A', fruit: '#5E8A40', bush: '#5C8F45' };
const FLOWER_COLS = ['#C94F6D', '#E8C547', '#F2F2EE', '#8E6CC4', '#E07B39'];
function instanced(geo, mats, list, E, opt) { if (!list.length || !mats) return null; const im = new THREE.InstancedMesh(geo, mats, list.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((t, i) => { q.setFromAxisAngle(up, t.r || 0); p.set(t.x, t.y, t.z); s.set(t.sx, t.sy, t.sz); m.compose(p, q, s); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; if (opt && opt.trees) { im.userData.trees = list; im.userData.base = Float32Array.from(im.instanceMatrix.array); (E.treeMeshes = E.treeMeshes || []).push(im); } im.castShadow = !!(opt && opt.shadow); im.receiveShadow = true; if (opt && opt.far) im.userData.far = true; E.group.add(im); E.stats.instances = (E.stats.instances || 0) + list.length; return im; }
function vegetation(P, c, E) {
  const T = ST(), Iv = I(), gq = P.env.graphics || 'normal'; const sc = TP.scatterEnv(P, c, { max: gq === 'eco' ? 300 : gq === 'ultra' ? 1500 : 900, grass: gq === 'eco' ? 1500 : gq === 'ultra' ? 12000 : 6000 }); E.scatter = sc;
  const groups = new Map(); for (const t of sc.trees) { const d = Math.hypot(t.x - c.hx, t.z - c.hz), lo = d > 70; const kind = t.k + (lo ? 'Lo' : ''); const key = kind + '|' + t.v + '|' + t.pal; let g = groups.get(key); if (!g) groups.set(key, g = { kind, k: t.k, v: t.v, pal: t.pal, lo, list: [] }); g.list.push({ x: t.x, y: t.y - .05, z: t.z, r: t.r, sx: t.w, sy: t.h, sz: t.w }); }
  for (const g of groups.values()) { const geo = Iv.vegGeo(g.kind, g.v); if (geo.wood) instanced(geo.wood, Iv.barkMat(g.k), g.list, E, { shadow: !g.lo, far: g.lo, trees: !g.lo }); const lm = Iv.leafMats(SPCOL[g.k] || '#4E7F3C', g.k, g.pal); if (lm) instanced(geo.leaves, lm, g.list, E, { shadow: !g.lo, far: g.lo, trees: !g.lo }); }
  const rockC = { desert: '#B08B66', sand: '#A59B8C', tropical: '#7E786E', snow: '#8E8C88' }[P.env.groundKind] || '#8C877F';
  for (let v = 0; v < 3; v++) { const list = sc.rocks.filter(r => r.v === v).map(r => ({ x: r.x, y: r.y - r.s * .25, z: r.z, r: r.r, sx: r.s * 1.3, sy: r.s * .8, sz: r.s })); if (list.length) instanced(Iv.rockGeo(v), Iv.texMat('rockface', rockC, .5, { rough: .9, wx: 1 }), list, E, { shadow: true, trees: true }); }
  for (let ci = 0; ci < FLOWER_COLS.length; ci++) { const list = sc.flowers.filter(f => f.c === ci).map(f => ({ x: f.x, y: f.y - .02, z: f.z, r: f.r, sx: f.s, sy: f.s * .45, sz: f.s })); if (list.length) instanced(Iv.vegGeo('flowers', ci % 3).leaves, Iv.leafMats(FLOWER_COLS[ci], 'flowers'), list, E, {}); }
  const gcol = (TP.GROUNDS[P.env.groundKind] && TP.GROUNDS[P.env.groundKind].veg ? seasonGround(P.env.groundKind, TP.GROUNDS[P.env.groundKind].c, 'ete') : '#5C8240');
  for (let v = 0; v < 3; v++) { const list = sc.grass.filter((g, i) => i % 3 === v).map(g => ({ x: g.x, y: g.y - .03, z: g.z, r: g.r, sx: g.s * 1.5, sy: g.s * .55, sz: g.s * 1.5 })); if (list.length) instanced(Iv.vegGeo('grass', v).leaves, Iv.leafMats(gcol, 'grass'), list, E, {}); }
  // feuilles mortes en automne
  if (T.season === 'automne') { const R = TP.rng(77), leaves = []; for (const t of sc.trees) { if (!/^(tree|birch|fruit)$/.test(t.k) || Math.hypot(t.x - c.hx, t.z - c.hz) > 80) continue; const n = 14; for (let i = 0; i < n; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * t.w * .8; const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr; leaves.push({ x, y: c.h(x, z) + .005, z, r: R() * 6.283, sx: .1 + R() * .06, sy: 1, sz: .07, pal: Math.floor(R() * 3) }); } if (leaves.length > 6000) break; }
    const lg = new THREE.PlaneGeometry(1, 1); lg.rotateX(-Math.PI / 2); for (let p = 0; p < 3; p++) instanced(lg, Iv.M3(['#B5462B', '#D9A23A', '#8E5A2A'][p], { rough: .8, ds: true, wx: 1 }), leaves.filter(l => l.pal === p), E, {}); }
}
/* ================= ville ================= */
let winCache = {};
function windowCanvas(col, kind) { const key = col + kind; if (winCache[key]) return winCache[key]; const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, S, S); const R = TP.rng(col.length * 31 + kind.length);
  for (let i = 0; i < 1600; i++) { x.fillStyle = shade(col, (R() - .5) * .12); x.fillRect(R() * S, R() * S, 2, 2); }
  const nx = kind === 'tower' ? 4 : 2, ny = kind === 'tower' ? 2 : 1, cw = S / nx, ch = S / ny; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const w = cw * (kind === 'tower' ? .62 : .42), h = ch * (kind === 'tower' ? .58 : .45); const g = x.createLinearGradient(0, j * ch, 0, j * ch + h); g.addColorStop(0, '#3E4E5E'); g.addColorStop(1, '#1E2630'); x.fillStyle = g; x.fillRect(i * cw + (cw - w) / 2, j * ch + ch * .22, w, h); x.fillStyle = shade(col, -.25); x.fillRect(i * cw + (cw - w) / 2 - 2, j * ch + ch * .22 + h, w + 4, 3); }
  return winCache[key] = cv; }
function boxInto(A, cx, cz, w, d, h, y0, rot, opt) { const c = Math.cos(rot), s = Math.sin(rot), tile = opt.tile || 6; const P0 = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c]; const hw = w / 2, hd = d / 2;
  const quad = (Arr, a, b, cc, dd, n, uw, vh) => { for (const [p, t] of [[a, [0, 0]], [b, [uw, 0]], [cc, [uw, vh]], [a, [0, 0]], [cc, [uw, vh]], [dd, [0, vh]]]) { Arr.p.push(...p); Arr.n.push(...n); Arr.u.push(t[0] / tile, t[1] / tile); } };
  const rn = (x, z) => [x * c - z * s, 0, x * s + z * c];
  quad(A, P0(-hw, hd, y0), P0(hw, hd, y0), P0(hw, hd, y0 + h), P0(-hw, hd, y0 + h), rn(0, 1), w, h); quad(A, P0(hw, -hd, y0), P0(-hw, -hd, y0), P0(-hw, -hd, y0 + h), P0(hw, -hd, y0 + h), rn(0, -1), w, h);
  quad(A, P0(hw, hd, y0), P0(hw, -hd, y0), P0(hw, -hd, y0 + h), P0(hw, hd, y0 + h), rn(1, 0), d, h); quad(A, P0(-hw, -hd, y0), P0(-hw, hd, y0), P0(-hw, hd, y0 + h), P0(-hw, -hd, y0 + h), rn(-1, 0), d, h);
  if (opt.top !== false) quad(opt.topArr || A, P0(-hw, hd, y0 + h), P0(hw, hd, y0 + h), P0(hw, -hd, y0 + h), P0(-hw, -hd, y0 + h), [0, 1, 0], w, d); }
function gableInto(A, cx, cz, w, d, h0, rh, rot) { const c = Math.cos(rot), s = Math.sin(rot); const P0 = (u, v, y) => [cx + u * c - v * s, y, cz + u * s + v * c]; const hw = w / 2 + .3, hd = d / 2 + .3;
  const tri = (a, b, cc) => { const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]]; const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...n) || 1; for (const p of [a, b, cc]) { A.p.push(...p); A.n.push(n[0] / l, n[1] / l, n[2] / l); A.u.push(p[0] / 1.5, (p[1] + p[2]) / 1.5); } };
  const a = P0(-hw, -hd, h0), b = P0(hw, -hd, h0), cc = P0(hw, hd, h0), dd = P0(-hw, hd, h0), r1 = P0(-hw, 0, h0 + rh), r2 = P0(hw, 0, h0 + rh);
  tri(a, r1, b); tri(b, r1, r2); tri(dd, cc, r1); tri(cc, r2, r1); tri(a, dd, r1); tri(b, r2, cc); }
function meshFrom(A, mat) { if (!A.p.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(A.p), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(A.n), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(A.u), 2)); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m; }
function cityMesh(P, c, E) {
  const C = c.city, Iv = I(), byCol = new Map(), roofs = new Map(), lit = []; const night = TP.isNight(P), R = TP.rng(9);
  for (const b of C.blocks) { const y0 = c.h(b.p[0], b.p[1]) - .2, key = b.c + '|' + b.kind; let A = byCol.get(key); if (!A) byCol.set(key, A = { p: [], n: [], u: [], col: b.c, kind: b.kind }); const top = { p: [], n: [], u: [] };
    boxInto(A, b.p[0], b.p[1], b.w, b.d, b.h + .2, y0, b.rot, { tile: b.kind === 'tower' ? 6 : 6, top: b.roof === 'flat', topArr: top });
    if (top.p.length) { let Rr = roofs.get('#6E6E6A'); if (!Rr) roofs.set('#6E6E6A', Rr = { p: [], n: [], u: [] }); Rr.p.push(...top.p); Rr.n.push(...top.n); Rr.u.push(...top.u); }
    if (b.roof === 'gable') { let Rr = roofs.get(b.roofC); if (!Rr) roofs.set(b.roofC, Rr = { p: [], n: [], u: [] }); gableInto(Rr, b.p[0], b.p[1], b.w, b.d, y0 + b.h + .2, Math.min(b.w, b.d) * .35, b.rot + (b.w < b.d ? Math.PI / 2 : 0)); }
    if (night && b.kind === 'tower') { const floors = Math.floor(b.h / 3); for (let f = 1; f < floors; f++) for (const side of [-1, 1]) for (let k = 0; k < Math.floor(b.w / 3); k++) { if (R() > .22) continue; const u = -b.w / 2 + 1.5 + k * 3, v = side * (b.d / 2 + .06); lit.push([b.p[0] + u * Math.cos(b.rot) - v * Math.sin(b.rot), y0 + f * 3 + 1.4, b.p[1] + u * Math.sin(b.rot) + v * Math.cos(b.rot), b.rot]); } } }
  for (const A of byCol.values()) { const cv = windowCanvas(A.col, A.kind); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; const m = new THREE.MeshStandardMaterial({ map: t, roughness: .75 }); m.userData.rt = { kind: 'render', wx: 1 }; patch(m, { wx: 1 }); const me = meshFrom(A, m); if (me) E.group.add(me); }
  for (const [col, A] of roofs) { const me = meshFrom(A, Iv.texMat(col === '#6E6E6A' ? 'gravel' : 'rooftiles', col, 1, { rough: .85, wx: 1 })); if (me) E.group.add(me); }
  if (lit.length) { const A = { p: [], n: [], u: [] }; for (const [x, y, z, rot] of lit.slice(0, 1500)) boxInto(A, x, z, 1.3, .05, 1.2, y - .6, rot, { top: false }); const me = meshFrom(A, Iv.M3('#FFE2B0', { emis: '#FFC77A', emisI: .9, glow: 1 })); if (me) { me.castShadow = false; E.group.add(me); } }
  // lampadaires de rue
  const A = { p: [], n: [], u: [] }, B = { p: [], n: [], u: [] }; for (const [x, z] of C.lamps) { const y = c.h(x, z); boxInto(A, x, z, .14, .14, 6, y, 0, {}); boxInto(B, x, z, .5, .5, .25, y + 5.9, 0, {}); }
  const pm = meshFrom(A, Iv.M3('#3A3F45', { rough: .5, metal: .4, wx: 1 })); if (pm) E.group.add(pm); const lm = meshFrom(B, night ? Iv.M3('#FFF1D6', { emis: '#FFD9A0', emisI: 1.4, glow: 1 }) : Iv.M3('#E8E4DA', { rough: .4 })); if (lm) E.group.add(lm);
  E.cityLamps = night ? C.lamps.map(([x, z]) => [x, c.h(x, z) + 5.8, z]) : [];
}
/* ================= m\u00e9t\u00e9o : pluie, neige, brouillard, \u00e9clairs ================= */
function rainMesh(E) { const n = 7000, seed = new Float32Array(n * 2 * 4), pos = new Float32Array(n * 2 * 3); const R = TP.rng(5); for (let i = 0; i < n; i++) { const a = R(), b = R(), cc = R(); for (let e = 0; e < 2; e++) { const o = (i * 2 + e) * 4; seed[o] = a; seed[o + 1] = b; seed[o + 2] = cc; seed[o + 3] = e; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4)); const u = uni();
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: u.uTime, uWind: u.uWind, uRain: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0xC9D1D8) } },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute vec4 seed; uniform float uTime, uWind, uRain; uniform vec3 uCam; varying float vA; void main(){ vec3 box=vec3(40.0,24.0,40.0); float sp=11.0+seed.x*3.0; float y=mod(seed.y*box.y-uTime*sp, box.y)-5.0+uCam.y; float x=uCam.x-box.x*0.5+mod(seed.x*box.x-uCam.x+uWind*uTime*sp*0.25, box.x); float z=uCam.z-box.z*0.5+mod(seed.z*box.z-uCam.z, box.z); vec3 vel=normalize(vec3(uWind*0.35,-1.0,0.0)); vec3 p=vec3(x,y,z)-vel*seed.w*0.6; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; if(fract(seed.x*7.13+seed.z*3.7)>uRain) gl_Position=vec4(2.0,2.0,2.0,1.0); vA=1.0-seed.w*0.85;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 uCol; uniform float uRain; varying float vA; void main(){\n#include <logdepthbuf_fragment>\n gl_FragColor=vec4(uCol, (0.25+0.25*uRain)*vA); }' });
  const L = new THREE.LineSegments(g, m); L.frustumCulled = false; L.userData.rtSkip = true; L.name = 'Pluie'; E.group.add(L); return L; }
function snowMesh(E) { const n = 6000, seed = new Float32Array(n * 3); const R = TP.rng(6); for (let i = 0; i < n * 3; i++) seed[i] = R(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3)); const u = uni();
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: u.uTime, uWind: u.uWind, uSnow: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0xF4F6F8) }, uSize: { value: 70 } },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute vec3 seed; uniform float uTime, uWind, uSnow, uSize; uniform vec3 uCam; void main(){ vec3 box=vec3(50.0,26.0,50.0); vec3 p; p.y=mod(seed.y*box.y-uTime*(0.9+seed.x*0.6), box.y)-6.0+uCam.y; float dx=seed.x*box.x+sin(uTime*0.7+seed.z*20.0)*0.6+uWind*uTime*2.0; float dz=seed.z*box.z+cos(uTime*0.5+seed.x*17.0)*0.6; p.x=uCam.x-box.x*0.5+mod(dx-uCam.x, box.x); p.z=uCam.z-box.z*0.5+mod(dz-uCam.z, box.z); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=uSize*(0.6+seed.x*0.8)/max(-mv.z,0.5); if(fract(seed.y*9.17+seed.z*4.3)>uSnow) gl_PointSize=0.0;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <logdepthbuf_pars_fragment>\nuniform vec3 uCol; void main(){\n#include <logdepthbuf_fragment>\n vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; gl_FragColor=vec4(uCol, smoothstep(0.5,0.1,d)*0.9); }' });
  const Pt = new THREE.Points(g, m); Pt.frustumCulled = false; Pt.userData.rtSkip = true; Pt.name = 'Neige'; E.group.add(Pt); return Pt; }
let fogTex = null;
function fogSheets(E) { if (!fogTex) { const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); const R = TP.rng(12); for (let i = 0; i < 90; i++) { const px = R() * S, py = R() * S, r = 20 + R() * 60; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, 2 * r, 2 * r); } } fogTex = new THREE.CanvasTexture(cv); fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping; }
  const out = []; [[.4, 1], [1.1, .9], [2, .8], [3.2, .65], [4.8, .5], [7, .35]].forEach(([h, k], i) => { const g = new THREE.PlaneGeometry(260, 260); g.rotateX(-Math.PI / 2); const m = new THREE.MeshBasicMaterial({ color: 0xE9ECEE, alphaMap: fogTex, transparent: true, depthWrite: false, opacity: .2 }); const t = fogTex.clone ? fogTex.clone() : fogTex; t.needsUpdate = true; t.repeat && t.repeat.set(2 + i * .3, 2 + i * .3); m.alphaMap = t; const me = new THREE.Mesh(g, m); me.userData.rtSkip = true; me.userData.k = k; me.userData.h = h; me.renderOrder = 3; me.position.y = h; E.group.add(me); out.push(me); }); return out; }
function boltMesh(E, c, wx) { const R = TP.rng(Math.floor(Math.random() * 1e6)), pts = []; const a = R() * 6.283, d = 350 + R() * 500; let x = c.hx + Math.cos(a) * d, z = c.hz + Math.sin(a) * d, y = 420; pts.push([x, y, z]); while (y > c.h(x, z) + 5) { y -= 18 + R() * 30; x += (R() - .5) * 40; z += (R() - .5) * 40; pts.push([x, y, z]); }
  const tubes = []; for (let i = 1; i < pts.length; i++) tubes.push([pts[i - 1], pts[i], 1.2, 1.0]); const geo = I().tubesGeo(tubes); const m = new THREE.MeshBasicMaterial({ color: 0xEEF2FF }); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = 1; m.userData.glowK = 60; m.userData.rt = { type: 0 };
  const me = new THREE.Mesh(geo, m); me.visible = false; me.userData.rtForce = (wx.lightning || 0) >= .5; me.name = '\u00c9clair'; E.group.add(me); E.boltPts = pts; return me; }
function icicles(P, E) { const T = ST(), wx = P.env.wx || {}; if (!(wx.snowAcc > .35) || (TP.PLACES[P.env.place] || {}).nosnow || !T.eaves || !T.eaves.length) return; const R = TP.rng(3), A = { p: [], n: [], u: [] };
  const cone = (x, y, z, h, r) => { const N = 5; for (let i = 0; i < N; i++) { const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283; const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], tip = [x, y - h, z]; for (const p of [p0, tip, p1]) { A.p.push(...p); const nx = p[0] - x, nz = p[2] - z, l = Math.hypot(nx, nz) || 1; A.n.push(nx / l, .3, nz / l); A.u.push(0, 0); } } };
  for (const [a, b] of T.eaves) { const L = Math.hypot(b[0] - a[0], b[2] - a[2]); const n = Math.floor(L / .18); for (let i = 0; i < n; i++) { if (R() > .55 * wx.snowAcc) continue; const t = (i + R()) / n; cone(a[0] + (b[0] - a[0]) * t, a[1] - .06, a[2] + (b[2] - a[2]) * t, .08 + Math.pow(R(), 2) * .45 * wx.snowAcc, .015 + R() * .02); } }
  const me = meshFrom(A, I().M3('#DCEAF2', { op: .55, rough: .04, env: 1.6 })); if (me) { me.castShadow = false; me.name = 'Gla\u00e7ons'; E.group.add(me); } }
function lotBorder(P, c, E) { const t = P.terrain; if (!t) return; const cs = TP.lotCorners(P).map(p => [p[0] / 100, p[1] / 100]); const pts = []; for (let k = 0; k < 4; k++) { const a = cs[k], b = cs[(k + 1) % 4]; for (let i = 0; i <= 20; i++) { const x = a[0] + (b[0] - a[0]) * i / 20, z = a[1] + (b[1] - a[1]) * i / 20; pts.push(new THREE.Vector3(x, c.h(x, z) + .04, z)); } }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x4F7A2E, dashSize: .6, gapSize: .3, transparent: true, opacity: .55 })); line.computeLineDistances(); line.userData.rtSkip = true; E.group.add(line); }

/* ================= construction ================= */
/* ================= d\u00e9tails de montagne : sapins sur les versants, cascades, blocs rocheux, refuges ================= */
let firGeoC = null, fallTex = null;
function firGeo() { if (firGeoC) return firGeoC; const p = [], n = [], S = 6; for (const [y0, y1, r] of [[.1, .72, .5], [.42, 1, .33]]) for (let i = 0; i < S; i++) { const a0 = i / S * 6.2832, a1 = (i + 1) / S * 6.2832, am = (a0 + a1) / 2; p.push(0, y1, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r, Math.cos(a0) * r, y0, Math.sin(a0) * r); n.push(Math.cos(am) * .6, .8, Math.sin(am) * .6, Math.cos(a1) * .85, .52, Math.sin(a1) * .85, Math.cos(a0) * .85, .52, Math.sin(a0) * .85); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(p), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2), 2)); return firGeoC = g; }
function mountainDetails(P, c, E) {
  const rel = P.env.relief || {}; if (!(['mountains', 'valley', 'summit'].includes(rel.type) || rel.peaks > 0)) return;
  const T = ST(), Iv = I(), R = TP.rng((c.seed || 1) + 911), NZ = TP.envNoise, gq = P.env.graphics || 'normal', sd = (c.seed || 1);
  const slK = { ete: 1.4, printemps: 1, automne: 1.2, hiver: .55 }[T.season] || 1, sl = (P.env.snowLine != null ? P.env.snowLine : 600) * slK, wl = c.hasWater && c.water ? c.water.level : -1e9;
  const slope = (x, z, d) => { const y = c.h(x, z), gx = (c.h(x + d, z) - y) / d, gz = (c.h(x, z + d) - y) / d; return { y, gx, gz, ny: 1 / Math.hypot(gx, gz, 1) }; };
  // sapins en bosquets jusqu'\u00e0 la limite des arbres
  const nF = gq === 'eco' ? 1500 : gq === 'ultra' ? 9000 : 5000, firs = [[], []]; let guard = 0, nf = 0;
  while (nf < nF && guard++ < nF * 10) { const a = R() * 6.2832, rr = 175 + Math.pow(R(), 1.7) * 1900, x = c.hx + Math.cos(a) * rr, z = c.hz + Math.sin(a) * rr; if (NZ.fbm(x / 150, z / 150, sd + 77, 3) < .39) continue; const q = slope(x, z, 6);
    if (q.ny < .6 || q.y < wl + 1 || q.y > sl - 45 + (NZ.vnoise(x / 90, z / 90, sd + 78) - .5) * 90) continue; const h = 10 + R() * 14; firs[nf % 2].push({ x, y: q.y - .4, z, r: R() * 6.2832, sx: h * .44, sy: h, sz: h * .44 }); nf++; }
  ['#24452B', '#2F5434'].forEach((col, i) => instanced(firGeo(), Iv.M3(col, { rough: .92, ds: true, wx: 2 }), firs[i], E, {}));
  // blocs rocheux sur les pentes
  const rocks = [[], [], []]; for (let i = 0; i < (gq === 'eco' ? 120 : 320); i++) { const a = R() * 6.2832, rr = 175 + Math.pow(R(), 1.4) * 1100, x = c.hx + Math.cos(a) * rr, z = c.hz + Math.sin(a) * rr, q = slope(x, z, 5); if (q.ny > .92 || q.ny < .66 || q.y < wl + .5) continue; const s2 = 1.5 + Math.pow(R(), 2) * 6; rocks[i % 3].push({ x, y: q.y - s2 * .3, z, r: R() * 6.2832, sx: s2 * 1.3, sy: s2 * .8, sz: s2 }); }
  rocks.forEach((l, v) => { if (l.length) instanced(Iv.rockGeo(v), Iv.texMat('rockface', '#7E7A73', .5, { rough: .9, wx: 1 }), l, E, {}); });
  // cascades : on suit la ligne de plus grande pente sur une paroi tourn\u00e9e vers la maison
  const falls = []; let tries = 0;
  while (falls.length < 3 && tries++ < 600) { const a = R() * 6.2832, rr = 240 + R() * 1150, x0 = c.hx + Math.cos(a) * rr, z0 = c.hz + Math.sin(a) * rr, q = slope(x0, z0, 4); if (q.ny > .64 || q.y > sl + 80 || q.y < wl + 10) continue; const gl = Math.hypot(q.gx, q.gz) || 1, tl = Math.hypot(c.hx - x0, c.hz - z0) || 1;
    if ((-q.gx / gl * (c.hx - x0) - q.gz / gl * (c.hz - z0)) / tl < .2 || falls.some(f => Math.hypot(f.x - x0, f.z - z0) < 260)) continue;
    let x = x0, z = z0; const up = []; for (let i = 0; i < 30; i++) { const s2 = slope(x, z, 4), g = Math.hypot(s2.gx, s2.gz); if (g < .6) break; x += s2.gx / g * 4; z += s2.gz / g * 4; up.push([x, c.h(x, z), z]); }
    const pts = up.reverse().concat([[x0, q.y, z0]]); x = x0; z = z0; for (let i = 0; i < 50; i++) { const s2 = slope(x, z, 4), g = Math.hypot(s2.gx, s2.gz); if (g < .38) break; x -= s2.gx / g * 4; z -= s2.gz / g * 4; const y = c.h(x, z); if (y < wl + .3) break; pts.push([x, y, z]); }
    if (pts.length < 8 || pts[0][1] - pts[pts.length - 1][1] < 28) continue; falls.push({ x: x0, z: z0, pts }); }
  E.falls = [];
  if (falls.length) { if (!fallTex && typeof document !== 'undefined') { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#CFE3EC'; g.fillRect(0, 0, 64, 256); const R2 = TP.rng(5151); for (let i = 0; i < 260; i++) { g.fillStyle = R2() < .75 ? `rgba(255,255,255,${.35 + R2() * .6})` : `rgba(120,160,180,${.2 + R2() * .3})`; g.fillRect(R2() * 64, R2() * 256, 1 + R2() * 3, 14 + R2() * 70); } fallTex = cv; }
    const foam = [];
    for (const f of falls) { const n = f.pts.length, pos = [], uv = [], idx = []; let len = 0;
      for (let i = 0; i < n; i++) { const p = f.pts[i], a = f.pts[Math.max(0, i - 1)], b = f.pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[2] - a[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; if (i) len += Math.hypot(p[0] - f.pts[i - 1][0], p[1] - f.pts[i - 1][1], p[2] - f.pts[i - 1][2]); const w = 2.4 + 4 * i / n + Math.sin(i * 1.7) * .5;
        pos.push(p[0] - tz * w, p[1] + .7, p[2] + tx * w, p[0] + tz * w, p[1] + .7, p[2] - tx * w); uv.push(0, len / 14, 1, len / 14); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx); g.computeVertexNormals();
      const t = new THREE.CanvasTexture(fallTex); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; const m = new THREE.MeshStandardMaterial({ map: t, roughness: .28, side: THREE.DoubleSide, emissive: new THREE.Color('#7E97A6'), emissiveIntensity: .12 }); m.userData.rt = { kind: 'render', wx: 0 };
      const me = new THREE.Mesh(g, m); me.name = 'Cascade'; me.receiveShadow = true; E.group.add(me); E.falls.push(m);
      const e = f.pts[n - 1]; for (let k = 0; k < 4; k++) foam.push({ x: e[0] + (R() - .5) * 5, y: e[1] - .3, z: e[2] + (R() - .5) * 5, r: R() * 6.28, sx: 3 + R() * 3, sy: 1.2 + R(), sz: 3 + R() * 3 }); }
    instanced(Iv.rockGeo(1), Iv.M3('#EEF5F8', { rough: .5 }), foam, E, {}); }
  // refuges de montagne
  const W = { p: [], n: [], u: [] }, RF = { p: [], n: [], u: [] }; let huts = 0; for (let i = 0; i < 300 && huts < 4; i++) { const a = R() * 6.2832, rr = 230 + R() * 700, x = c.hx + Math.cos(a) * rr, z = c.hz + Math.sin(a) * rr, q = slope(x, z, 6); if (q.ny < .94 || q.y > sl + 40 || q.y < wl + 2) continue; const rot = R() * 3.14, w = 6 + R() * 3, d = 5 + R() * 2;
    boxInto(W, x, z, w, d, 3.2, q.y - .6, rot, { top: false }); gableInto(RF, x, z, w, d, q.y + 2.6, 1.9, rot); huts++; }
  if (huts) { const wm = meshFrom(W, Iv.texMat('planks', '#6B4A32', 1.2, { rough: .8, wx: 1 })); if (wm) E.group.add(wm); const rm = meshFrom(RF, Iv.texMat('slate', '#4A5058', 1, { rough: .7, wx: 1 })); if (rm) E.group.add(rm); }
  E.stats.firs = nf; E.stats.falls = falls.length; E.stats.huts = huts;
}
function build(P, scene, bb, ctx3) {
  const T = ST(); uni(); const t0 = performance.now(); const c = (T && T.envCtx) || TP.envCtx(P); const wx = P.env.wx || {};
  const E = Env.E = { ctx: c, group: new THREE.Group(), stats: {}, fog: [], rain: null, snow: null, bolt: null, water: null, hasWater: false, ctx3, nextFlash: 2, flashT: 0, P };
  E.group.name = 'Environnement'; scene.add(E.group);
  const step = (n, fn) => { try { fn(); } catch (e) { E.stats.errors = (E.stats.errors || 0) + 1; if (G.console) console.warn('[environnement] ' + n, e); } };
  step('terrain', () => terrainMesh(P, c, E)); step('eau', () => waterMesh(P, c, E)); step('v\u00e9g\u00e9tation', () => vegetation(P, c, E)); step('montagne', () => mountainDetails(P, c, E)); if (c.city) step('ville', () => cityMesh(P, c, E));
  step('pluie', () => { E.rain = rainMesh(E); }); step('neige', () => { E.snow = snowMesh(E); }); step('brouillard', () => { E.fog = fogSheets(E); });
  if ((wx.lightning || 0) > 0) step('\u00e9clair', () => { E.bolt = boltMesh(E, c, wx); }); step('gla\u00e7ons', () => icicles(P, E)); step('limite', () => lotBorder(P, c, E));
  updateLighting(P, T.sun); E.stats.ms = Math.round(performance.now() - t0); return E.stats;
}
// lumi\u00e8res : liste compl\u00e8te pour le rendu photo, s\u00e9lection limit\u00e9e pour le temps r\u00e9el
function finishLights(P, scene) {
  const T = ST(), E = Env.E; const L = T.lightList || []; const wx = P.env.wx || {};
  if (E && E.cityLamps) { const c = E.ctx; E.cityLamps.slice().sort((a, b) => Math.hypot(a[0] - c.hx, a[2] - c.hz) - Math.hypot(b[0] - c.hx, b[2] - c.hz)).slice(0, 24).forEach(p => L.push({ p, dir: [0, -1, 0], cone: 1.15, c: [9, 7.5, 5], r: .15, range: 25, ext: true, city: 1 })); }
  T.rtLights = L.slice(0, 120);
  if (E && E.bolt && E.bolt.userData.rtForce && E.boltPts) { const p = E.boltPts[Math.floor(E.boltPts.length * .6)]; T.rtLights.push({ p, c: [9000, 9500, 12000], r: 8 }); }
  // temps r\u00e9el : les sources les plus importantes vues depuis la maison
  const c = E ? E.ctx : { hx: 0, hz: 0 }; const score = l => Math.max(...l.c) / (1 + Math.hypot(l.p[0] - c.hx, l.p[2] - c.hz) * .15); const pick = L.slice().sort((a, b) => score(b) - score(a)).slice(0, P.env.graphics === 'eco' ? 4 : P.env.graphics === 'ultra' ? 14 : 9);
  for (const l of pick) { const lum = Math.max(...l.c); const col = new THREE.Color(l.c[0] / lum, l.c[1] / lum, l.c[2] / lum); let o;
    if (l.dir && THREE.SpotLight) { o = new THREE.SpotLight(col, lum * .4, (l.range || 8) * 1.4, Math.min(1.45, l.cone || .6), .55, 2); o.position.set(...l.p); o.target.position.set(l.p[0] + l.dir[0], l.p[1] + l.dir[1], l.p[2] + l.dir[2]); scene.add(o.target); }
    else o = new THREE.PointLight(col, lum * .35, (l.range || 7) * 1.3, 2), o.position.set(...l.p);
    scene.add(o); }
  T.rtDirty = true;
}

/* ================= animations ================= */
// vue d\u00e9gag\u00e9e : les arbres entre la cam\u00e9ra et la maison (ou autour de la cam\u00e9ra) sont masqu\u00e9s
function clearView(force) { const E = Env.E, T = ST(); if (!E || !E.treeMeshes || !T || !T.camera) return false; const cam = T.camera.position; let tg;
  if (T.mode === 'orbit') tg = T.center; else { const w = T.walk || { yaw: 0, pitch: 0 }; tg = { x: cam.x + Math.sin(w.yaw) * 30, y: cam.y + Math.sin(w.pitch) * 30, z: cam.z - Math.cos(w.yaw) * 30 }; }
  const key = [cam.x, cam.y, cam.z, tg.x, tg.y, tg.z].map(v => Math.round(v * 4)).join(',') + (T.camera.fov | 0); if (!force && key === E.viewKey) return false; E.viewKey = key;
  const dx = tg.x - cam.x, dy = tg.y - cam.y, dz = tg.z - cam.z, D = Math.hypot(dx, dy, dz) || 1, vx = dx / D, vy = dy / D, vz = dz / D, L2 = dx * dx + dz * dz || 1;
  const th = Math.tan((T.camera.fov || 48) * Math.PI / 360), tw = th * (T.camera.aspect || 1.6); let changed = false;
  for (const im of E.treeMeshes) { const list = im.userData.trees, base = im.userData.base, a = im.instanceMatrix.array; let mod = false;
    for (let i = 0; i < list.length; i++) { const t = list[i], rr = t.sx * .5 + .4;
      // sur la ligne de vis\u00e9e vers la maison
      const u = clamp(((t.x - cam.x) * dx + (t.z - cam.z) * dz) / L2, 0, 1), d = Math.hypot(cam.x + dx * u - t.x, cam.z + dz * u - t.z), yLine = cam.y + dy * u;
      let hide = u > 0 && u < .9 && d < rr && t.y + t.sy > yLine - .5 && t.y < yLine + 1;
      // trop pr\u00e8s de l'objectif : il mangerait l'image
      if (!hide) { const px = t.x - cam.x, py = t.y + t.sy * .6 - cam.y, pz = t.z - cam.z, depth = px * vx + py * vy + pz * vz;
        if (depth < 1.5) hide = Math.hypot(px, pz) < rr + 1.2 && cam.y < t.y + t.sy + 1;
        else if (depth < D - 2) { const lx = px - vx * depth, ly = py - vy * depth, lz = pz - vz * depth, off = Math.hypot(lx, ly, lz) - rr; if (off < Math.max(th, tw) * depth * 1.05 && rr / depth / th > .3) hide = true; } }
      const o = i * 16, hidden = a[o] === 0 && a[o + 5] === 0 && a[o + 10] === 0;
      if (hide && !hidden) { for (let k = 0; k < 15; k++) a[o + k] = 0; a[o + 12] = base[o + 12]; a[o + 13] = base[o + 13]; a[o + 14] = base[o + 14]; a[o + 15] = 1; mod = true; }
      else if (!hide && hidden) { for (let k = 0; k < 16; k++) a[o + k] = base[o + k]; mod = true; } }
    if (mod) { im.instanceMatrix.needsUpdate = true; changed = true; } }
  if (changed) { T.rtDirty = true; T.dirty = true; } return changed; }
function tick(dt, tms) {
  const T = ST(), E = Env.E; if (!T || !E || !T.scene || !T.P) return false; const P = T.P, wx = P.env.wx || {}, u = uni(); let anim = false;
  if (Env.play) { stepPlay(dt); anim = true; }
  const on = P.env.anim !== false && T.quality === 'rt' && T.visible;
  if (on) { u.uTime.value += dt; anim = anim || (wx.rain || 0) > .01 || (wx.snow || 0) > .01 || (wx.wind || 0) > .04 || E.hasWater || (wx.lightning || 0) > 0 || (wx.fog || 0) > .05 || (wx.clouds || 0) > .05; }
  if (on && E.falls && E.falls.length) { for (const m of E.falls) if (m.map && m.map.offset) m.map.offset.y += dt * .55; anim = true; }
  const cam = T.camera.position;
  if (E.rain && E.rain.visible) E.rain.material.uniforms.uCam.value.copy(cam); if (E.snow && E.snow.visible) E.snow.material.uniforms.uCam.value.copy(cam);
  for (const f of E.fog) if (f.visible) { f.position.x = cam.x; f.position.z = cam.z; f.position.y = E.ctx.h(cam.x, cam.z) + f.userData.h; if (f.material.alphaMap && f.material.alphaMap.offset && on) { f.material.alphaMap.offset.x += dt * .004 * (1 + (wx.wind || 0) * 6) * f.userData.k; f.material.alphaMap.offset.y += dt * .0017; } }
  // \u00e9clairs
  if (on && (wx.lightning || 0) > 0 && E.bolt) { E.nextFlash -= dt; if (E.nextFlash <= 0 && !E.flashT) { E.flashT = 1e-4; E.nextFlash = 2.5 + Math.random() * 9 / (.3 + wx.lightning); } }
  if (E.flashT > 0) { E.flashT += dt; const t = E.flashT, f = Math.max(0, 1 - Math.abs(t - .04) / .05) + .7 * Math.max(0, 1 - Math.abs(t - .19) / .06); u.uFlash.value = f * .55; if (E.bolt) E.bolt.visible = f > .25; if (Env.L && Env.L.hemi) Env.L.hemi.intensity = Env.L.hemiBase + f * 1.6; if (t > .4) { E.flashT = 0; u.uFlash.value = 0; if (E.bolt) E.bolt.visible = false; if (Env.L && Env.L.hemi) Env.L.hemi.intensity = Env.L.hemiBase; } anim = true; }
  else if (Env.L && Env.L.hemi) Env.L.hemiBase = Env.L.hemi.intensity;
  return anim;
}
// timelapse et visite : interpolation de l'environnement, de la cam\u00e9ra, enregistrement vid\u00e9o
const PLAYS = { jour: 'Lever et coucher du soleil', jourNuit: 'Passage du jour \u00e0 la nuit', orage: 'Arriv\u00e9e d\'un orage', saisons: 'Changement des saisons', neige: 'Neige qui s\'accumule', pluie: 'Pluie qui commence et s\'arr\u00eate', visite: 'Visite cin\u00e9matique autour de la maison' };
function startPlay(type, o) {
  const T = ST(); if (!T || !T.P) return false; o = o || {}; const P = T.P; stopPlay(true); const from = JSON.parse(JSON.stringify(P.env)); const st = TP.sunTimes(P);
  Env.play = { type, t: 0, dur: Math.max(3, o.dur || 20), from, keep: !!o.keep, onEnd: o.onEnd, onTick: o.onTick, rise: st.rise != null ? st.rise : 6, set: st.set != null ? st.set : 20, season: TP.seasonOf(P.env), keys: o.keys || P.env.camKeys || [], rebuildAt: 0, lastEnv: 0 };
  if (T.quality !== 'rt') V().setQuality('rt'); T.dirty = true; V().kick(); return true; }
function stopPlay(silent) { const p = Env.play; if (!p) return; Env.play = null; const T = ST(); if (T && T.P) { if (!p.keep) { T.P.env = Object.assign(T.P.env, p.from); } updateLighting(T.P); if (p.rebuilt && p.from && TP.seasonOf(T.P.env) !== p.season) rebuild(); else if (p.rebuilt) rebuild(); } if (!silent && p.onEnd) p.onEnd(); }
function rebuild() { const E = Env.E; if (E && E.ctx3 && E.ctx3.rebuild) E.ctx3.rebuild(); }
function camLerp(keys, t) { const n = keys.length; if (n === 1) return keys[0]; const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i; const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)]; const cr = (a, b, c, d) => a.map((_, j) => .5 * ((2 * b[j]) + (-a[j] + c[j]) * u + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * u * u + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * u * u * u)); return { pos: cr(k0.pos, k1.pos, k2.pos, k3.pos), target: cr(k0.target, k1.target, k2.target, k3.target) }; }
function setCamPT(pos, target) { const T = ST(); T.mode = 'orbit'; T.center.set(...target); const dx = pos[0] - target[0], dy = pos[1] - target[1], dz = pos[2] - target[2], r = Math.max(.5, Math.hypot(dx, dy, dz)); T.orb.r = r; T.orb.ph = Math.acos(clamp(dy / r, -1, 1)); T.orb.th = Math.atan2(dz, dx); }
function stepPlay(dt) {
  const p = Env.play, T = ST(), P = T.P, e = P.env, f = p.from; p.t += dt; const k = clamp(p.t / p.dur, 0, 1), ease = k * k * (3 - 2 * k);
  const W = (key) => TP.weatherDefaults(key);
  switch (p.type) {
    case 'jour': e.hour = (p.rise - .5) + (p.set + 1 - (p.rise - .5)) * k; break;
    case 'jourNuit': e.hour = 16 + 7.5 * k; break;
    case 'orage': { const a = f.wx, b = W('orage'); e.wx = Object.assign({}, a); for (const kk of TP.WX_KEYS) e.wx[kk] = (a[kk] || 0) + ((b[kk] || 0) - (a[kk] || 0)) * clamp(k / .6, 0, 1); e.wx.snowAcc = a.snowAcc || 0; break; }
    case 'saisons': { e.month = 1 + Math.floor(k * 11.99); const s = TP.seasonOf(e); e.wx = Object.assign({}, f.wx, { snowAcc: s === 'hiver' ? .7 : 0, fog: s === 'automne' ? .15 : f.wx.fog }); if (s !== p.season) { p.season = s; p.rebuilt = true; rebuild(); } break; }
    case 'neige': e.wx = Object.assign({}, f.wx, { snow: .8, clouds: 1, overcast: 1, snowAcc: ease, fog: .2 }); break;
    case 'pluie': { const r = Math.sin(Math.PI * k); e.wx = Object.assign({}, f.wx, { rain: r * .85, clouds: Math.max(f.wx.clouds || 0, r), overcast: Math.max(f.wx.overcast || 0, Math.min(1, r * 1.3)), wet: clamp(Math.sin(Math.PI * Math.min(1, k * 1.25)) * 1.1, 0, 1), dark: r * .3 }); break; }
    case 'visite': { const keys = p.keys && p.keys.length >= 2 ? p.keys : null; if (keys) { const c = camLerp(keys, ease); setCamPT(c.pos, c.target); } else { T.mode = 'orbit'; T.orb.th = (p.th0 != null ? p.th0 : (p.th0 = T.orb.th)) + ease * Math.PI * 2; } break; }
  }
  if (p.type !== 'visite' && p.keys && p.keys.length >= 2) { const c = camLerp(p.keys, ease); setCamPT(c.pos, c.target); }
  const now = performance.now(); updateLighting(P); if (now - p.lastEnv > 450) { p.lastEnv = now; const s = T.sun; const ek = envKey(P); if (ek !== T.envKey && Env.L && Env.L.envSky && T.pmrem) { applySky(Env.L.envSky, skyState(P, s), s); if (T.envRT) T.envRT.dispose(); try { T.envRT = T.pmrem.fromScene(T.envScene, .04); T.scene.environment = T.envRT.texture; } catch (er) { } T.envKey = ek; } }
  // les lumi\u00e8res automatiques s'allument \u00e0 la tomb\u00e9e de la nuit : reconstruction ponctuelle
  const night = TP.isNight(P); if (p.night == null) p.night = night; if (night !== p.night) { p.night = night; p.rebuilt = true; rebuild(); }
  if (p.onTick) p.onTick(k); T.dirty = true;
  if (k >= 1) stopPlay(false);
}
// enregistrement vid\u00e9o du canevas 3D (WebM)
function recordStart() { const T = ST(); if (!T || !T.canvas || !T.canvas.captureStream || typeof MediaRecorder === 'undefined') return null; const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']; const mt = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)); if (!mt) return null;
  const stream = T.canvas.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 8e6 }); const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; rec.start(250);
  return { stop: () => new Promise(res => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); try { rec.stop(); } catch (e) { res(new Blob(chunks, { type: 'video/webm' })); } stream.getTracks().forEach(t => t.stop()); }) }; }
// points de cam\u00e9ra
function camKey() { const T = ST(); const cam = T.camera; T.camera.updateMatrixWorld && T.camera.updateMatrixWorld(); const pos = [cam.position.x, cam.position.y, cam.position.z]; let target;
  if (T.mode === 'orbit') target = [T.center.x, T.center.y, T.center.z]; else { const w = T.walk || { yaw: 0, pitch: 0 }; target = [pos[0] + Math.sin(w.yaw) * Math.cos(w.pitch) * 5, pos[1] + Math.sin(w.pitch) * 5, pos[2] - Math.cos(w.yaw) * Math.cos(w.pitch) * 5]; }
  return { pos: pos.map(v => Math.round(v * 100) / 100), target: target.map(v => Math.round(v * 100) / 100) }; }
// cadrages professionnels
const FRAMES = { facade: 'Fa\u00e7ade principale', troisQuarts: 'Trois-quarts', aerien: 'Vue a\u00e9rienne', jardin: 'Depuis le jardin', contrePlongee: 'Contre-plong\u00e9e', interieur: 'Int\u00e9rieur' };
function frame(name) {
  const T = ST(); if (!T || !T.bounds || !T.P) return false; const P = T.P, b = T.bounds; const E = Env.E; const front = (() => { const lv = TP.sortedLevels(P).find(l => l.elev >= 0) || P.levels[0]; const ent = lv.open.find(o => o.kind === 'entry'); if (ent) { const w = lv.walls.find(x => x.id === ent.wall); if (w) { const g = TP.wg(w), sd = TP.wallSides(lv, w); const s = sd.extSign || 1; return [g.nx * s, g.ny * s]; } } return TP.sideVec(P, 'sud'); })();
  const side = name === 'jardin' ? (E && E.ctx && E.ctx.hasWater && !['cliff', 'summit'].includes((P.env.relief || {}).type) ? E.ctx.sv : [-front[0], -front[1]]) : front; const ang = Math.atan2(side[1], side[0]); const span = Math.max(b.span, 8), cy = Math.min(b.ytop || 3, 6);
  const set = (th, ph, r, cyy) => { T.mode = 'orbit'; T.center.set(b.cx, cyy, b.cz); T.orb.th = th; T.orb.ph = ph; T.orb.r = r; };
  switch (name) {
    case 'facade': set(ang, Math.acos(clamp((1.6 - cy * .45) / (span * 1.35), -1, 1)), span * 1.35, cy * .45); break;
    case 'troisQuarts': set(ang + .72, Math.acos(clamp((2.6 - cy * .4) / (span * 1.5), -1, 1)), span * 1.5, cy * .4); break;
    case 'aerien': set(ang + .6, .62, span * 2.3, 0); break;
    case 'jardin': set(ang - .35, Math.acos(clamp((1.7 - cy * .5) / (span * 1.45), -1, 1)), span * 1.45, cy * .5); break;
    case 'contrePlongee': set(ang + .45, Math.acos(clamp((.45 - cy * .75) / (span * .95), -1, 1)), span * .95, cy * .75); break;
    case 'interieur': { V().setCam('walk', P); const lv = P.levels.find(l => l.id === P.cur) || P.levels[0]; const rooms = TP.interiorRooms(lv); const rm = rooms.sort((a, c) => TP.polyArea(c.pts) - TP.polyArea(a.pts))[0]; if (rm && T.walk) { const bx = TP.bbox(rm.pts); T.walk.x = (bx.x0 + bx.w * .2) / 100; T.walk.z = (bx.y0 + bx.h * .8) / 100; T.walk.yaw = Math.atan2(bx.cx / 100 - T.walk.x, -(bx.cy / 100 - T.walk.z)); T.walk.pitch = -.05; } break; }
  }
  // le relief ne doit ni cacher la maison ni passer au-dessus de la cam\u00e9ra : on rel\u00e8ve la vue si besoin
  if (name !== 'interieur' && E && E.ctx) { const c = E.ctx, wl = c.hasWater && c.water ? c.water.level : -1e9; for (let it = 0; it < 30; it++) { const sp = Math.sin(T.orb.ph), px = T.center.x + T.orb.r * sp * Math.cos(T.orb.th), py = T.center.y + T.orb.r * Math.cos(T.orb.ph), pz = T.center.z + T.orb.r * sp * Math.sin(T.orb.th);
      let blocked = py < Math.max(c.h(px, pz), wl) + 1.4; for (let k = 1; k < 16 && !blocked; k++) { const u = k / 16, x = px + (T.center.x - px) * u, y = py + (T.center.y - py) * u, z = pz + (T.center.z - pz) * u; if (c.h(x, z) > y - .25) blocked = true; } if (!blocked) break; T.orb.ph = Math.max(.12, T.orb.ph - .06); } }
  T.dirty = true; V().kick(); return true; }
function setCamHeight(h) { const T = ST(); if (!T) return; if (T.mode === 'walk' && T.walk) T.walk.y = (T.P ? (TP.sortedLevels(T.P).find(l => l.id === T.P.cur) || {}).elev || 0 : 0) / 100 + h; else T.center.y = h; T.dirty = true; V().kick(); }

/* ================= environnement du rendu photor\u00e9aliste ================= */
function rtEnv(P) {
  const T = ST(), s = T.sun || V()._.sunState(P), e = P.env, wx = e.wx || {}; const sinE = Math.sin(s.el), day = clamp((sinE + .1) / .35, 0, 1), up = Math.max(sinE, .03); const oc = wx.overcast || 0, cl = wx.clouds || 0, dk = wx.dark || 0, fg = wx.fog || 0;
  const tr = [.075, .14, .29].map(t => Math.exp(-t / up)); const wk = (1 - oc * .97) * (1 - cl * (1 - oc) * .2) * (1 - fg * .55);
  let sunDir, sunE, ang;
  if (sinE > -.03) { const d = [s.dir.x, Math.max(s.dir.y, .015), s.dir.z], l = Math.hypot(...d); sunDir = d.map(v => v / l); const E0 = 30 * wk * clamp((sinE + .02) / .06, 0, 1); sunE = tr.map(t => t * E0); ang = .011 + oc * .19 + fg * .05; }
  else { const md = moonDir(P); const d = [md.v[0], Math.max(md.v[1], .02), md.v[2]], l = Math.hypot(...d); sunDir = d.map(v => v / l); const k = md.el > 0 ? (1 - oc * .9) : 0; sunE = [.013 * k, .016 * k, .024 * k]; ang = .012; }
  const sunCos = Math.cos(ang), om = 2 * Math.PI * (1 - sunCos); const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); const dusk = clamp(1 - Math.abs(s.el) / .28, 0, 1);
  let zen = mix([.0025, .0035, .008], [.17, .44, 1.65], Math.pow(day, 1.4)), hor = mix([.004, .006, .011], [2.0, 2.5, 3.1], Math.pow(day, 1.2)); hor = mix(hor, [1.5 * day + .05, .78 * day + .03, .42 * day + .02], dusk * .6 * (1 - oc)); zen = mix(zen, [.12 * day, .16 * day, .42 * day + .01], dusk * .5 * (1 - oc));
  const og = 1 - dk * .75; zen = mix(zen, [2.1 * day * og + .003, 2.15 * day * og + .004, 2.25 * day * og + .006], oc); hor = mix(hor, [.95 * day * og + .004, 1 * day * og + .005, 1.05 * day * og + .007], oc);
  if (fg > 0) { hor = mix(hor, [1.6 * day + .01, 1.62 * day + .01, 1.66 * day + .012], fg * .7); zen = mix(zen, [1.2 * day, 1.25 * day, 1.35 * day], fg * .45); }
  const cloud = [oc > .97 ? 1 : cl, .55, 3.7 + (e.month || 6) * .31, .3], cloudCol = mix([.02, .025, .035], [5.2, 5.2, 5.3], day).map(v => v * (1 - dk * .7)); const gnd = mix([.004, .005, .004], [.75, 1.0, .5], day);
  const glow = sunE.map(v => v * .5 + .02 * day); const clip = T.clipPlanes && T.clipPlanes.length ? [T.clipPlanes[0].normal.x, T.clipPlanes[0].normal.y, T.clipPlanes[0].normal.z, T.clipPlanes[0].constant] : [0, 0, 0, 1e30];
  const dens = .00011 + fg * (wx.mist ? .03 : .045) + (wx.rain || 0) * .006 + (wx.snow || 0) * .014; const fogH = wx.mist ? 5 : fg > .03 ? 40 + 160 * (1 - fg) : 1200;
  const fogCol = mix(hor, zen, fg > .05 ? .3 : .72).map(v => v * (wx.mist ? .9 : .62));
  const w = (Env.E && Env.E.ctx && Env.E.ctx.water) || { type: 'none' }; const wc = new THREE.Color(w.color || '#2F6F86'); if (wc.convertSRGBToLinear) wc.convertSRGBToLinear(); const clear = !!w.clear;
  const waterAbs = clear ? [.38, .07, .06] : [.5, .12, .095]; const sky = (zen[0] + zen[1] + zen[2]) / 3 * .35 + Math.max(...sunE) * .012; const waterScat = [wc.r * sky * .5, wc.g * sky * .5, wc.b * sky * .5];
  const u = uni(), wd = u.uWaveDir.value; const t = u.uTime.value;
  let key = .25; if (day < .25) key = .07 + .13 * day / .25;
  return { sunDir, sunE, sunRad: sunE.map(v => v / om), glow, sunCos, zen, hor, gnd, cloud, cloudCol, fogCol, fog4: [dens, fogH, (1 - oc * .8) * .9, 3000], clip, key,
    wx: [wx.rain || 0, (TP.PLACES[e.place] || {}).nosnow ? 0 : wx.snowAcc || 0, wx.wet || 0, t], wave: [wd.x, wd.y, (w.waves != null ? w.waves : .3) + (wx.wind || 0) * .35, t], overcast: oc, stars: Math.pow(1 - (s.day0 != null ? s.day0 : s.day), 2) * (1 - oc),
    hdr: e.hdri && Env.hdriData ? (e.hdriGain || 1) : 0, hdrRot: (e.hdriRot || 0) * Math.PI / 180, waterAbs, waterScat, precip: [wx.rain || 0, wx.snow || 0, (wx.wind || 0) * 2, (t * 7.3) % 100] };
}

/* ================= HDRI et panoramas 360\u00b0 ================= */
function parseHDR(buf) { const b = new Uint8Array(buf); let p = 0; const line = () => { let s = ''; while (p < b.length && b[p] !== 10) s += String.fromCharCode(b[p++]); p++; return s; };
  const head = line(); if (!/^#\?(RADIANCE|RGBE)/.test(head)) throw new Error('Fichier HDR non reconnu.'); let l; while ((l = line()) !== '') { if (p >= b.length) throw new Error('En-t\u00eate HDR incomplet.'); }
  const dim = line().match(/-Y\s+(\d+)\s+\+X\s+(\d+)/); if (!dim) throw new Error('Orientation HDR non prise en charge.'); const H = +dim[1], W = +dim[2]; const out = new Float32Array(W * H * 3), sc = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) { if (b[p] === 2 && b[p + 1] === 2 && ((b[p + 2] << 8) | b[p + 3]) === W) { p += 4; for (let ch = 0; ch < 4; ch++) { let x = 0; while (x < W) { let n = b[p++]; if (n > 128) { n -= 128; const v = b[p++]; for (let i = 0; i < n; i++) sc[(x++) * 4 + ch] = v; } else for (let i = 0; i < n; i++) sc[(x++) * 4 + ch] = b[p++]; } } }
    else for (let x = 0; x < W; x++) { for (let ch = 0; ch < 4; ch++) sc[x * 4 + ch] = b[p++]; }
    for (let x = 0; x < W; x++) { const e = sc[x * 4 + 3], f = e ? Math.pow(2, e - 136) : 0, o = (y * W + x) * 3; out[o] = sc[x * 4] * f; out[o + 1] = sc[x * 4 + 1] * f; out[o + 2] = sc[x * 4 + 2] * f; } }
  return { data: out, w: W, h: H }; }
function downsample(img, maxW) { if (img.w <= maxW) return img; const f = Math.ceil(img.w / maxW), W = Math.floor(img.w / f), H = Math.floor(img.h / f), o = new Float32Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const k = ((y * f + j) * img.w + x * f + i) * 3; r += img.data[k]; g += img.data[k + 1]; b += img.data[k + 2]; } const k = (y * W + x) * 3, n = f * f; o[k] = r / n; o[k + 1] = g / n; o[k + 2] = b / n; } return { data: o, w: W, h: H }; }
async function loadHdri(buf, name) {
  let img; if (/\.hdr$/i.test(name || '')) img = parseHDR(buf);
  else { const bl = new Blob([buf]); const bm = await createImageBitmap(bl); const cv = document.createElement('canvas'); const W = Math.min(2048, bm.width), H = Math.round(W * bm.height / bm.width); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data; const o = new Float32Array(W * H * 3); for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.pow(d[i * 4 + c] / 255, 2.2) * 1.6; img = { data: o, w: W, h: H }; }
  img = downsample(img, 1024); Env.hdriData = Object.assign(img, { key: (name || 'hdri') + img.w + 'x' + img.h + ':' + img.data[0] });
  const T = ST(); if (T && T.renderer && THREE.DataTexture && !THREE.MINI) { const n = img.w * img.h, px = new Float32Array(n * 4); for (let i = 0; i < n; i++) { px[i * 4] = img.data[i * 3]; px[i * 4 + 1] = img.data[i * 3 + 1]; px[i * 4 + 2] = img.data[i * 3 + 2]; px[i * 4 + 3] = 1; }
    const t = new THREE.DataTexture(px, img.w, img.h, THREE.RGBAFormat, THREE.FloatType); t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; Env.hdriTex = t; try { const rt = T.pmrem.fromEquirectangular(t); Env.hdriEnv = rt.texture; } catch (e) { Env.hdriEnv = null; } }
  return { w: img.w, h: img.h }; }
function clearHdri() { Env.hdriData = null; Env.hdriTex = null; Env.hdriEnv = null; }
// relief depuis une image en niveaux de gris
async function heightmapFromFile(P, buf, maxH) { const bm = await createImageBitmap(new Blob([buf])); const W = Math.min(256, bm.width), H = Math.round(W * bm.height / bm.width); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H); for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255; return TP.heightmapFromImage(P, g, W, H, maxH); }
function stats() { const E = Env.E; return E ? Object.assign({ water: !!E.water, rain: !!E.rain, snow: !!E.snow, fog: E.fog.length, bolt: !!E.bolt, groundKinds: E.groundKeys }, E.stats) : null; }

Object.assign(Env, { clearView, patch, lighting, updateLighting, build, finishLights, tick, rtEnv, startPlay, stopPlay, recordStart, camKey, frame, setCamHeight, loadHdri, clearHdri, heightmapFromFile, stats, PLAYS, FRAMES, parseHDR });
Object.defineProperty(Env, 'playing', { get() { return !!Env.play; } });
TP.Env = Env;
})(typeof window !== 'undefined' ? window : globalThis);
