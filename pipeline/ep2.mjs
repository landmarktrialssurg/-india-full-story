// Episode 2 renderer — cinematic style, bilingual on-screen text (EN + HI), two audio tracks
import fs from 'fs';
import { spawn } from 'child_process';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { geoMercator } from 'd3-geo';

const D2 = '/home/claude/ep2/';
const F = 'node_modules/@fontsource/';
const reg = (pkg, sub, w, name, st = 'normal') => GlobalFonts.registerFromPath(`${F}${pkg}/files/${pkg}-${sub}-${w}-${st}.woff2`, name);
reg('inter', 'latin', 400, 'Inter'); reg('inter', 'latin', 700, 'InterB'); reg('inter', 'latin', 500, 'InterM');
reg('playfair-display', 'latin', 700, 'Playfair'); reg('playfair-display', 'latin', 400, 'PlayfairI', 'italic');
reg('tiro-devanagari-hindi', 'devanagari', 400, 'Tiro'); reg('tiro-devanagari-hindi', 'latin', 400, 'Tiro');
reg('noto-sans-devanagari', 'devanagari', 600, 'NotoDev'); reg('noto-sans-devanagari', 'devanagari', 700, 'NotoDevB');

const W = 1920, H = 1080, FPS = 30;
const GOLD = '#e3b45f', CREAM = '#f3e6cc', OCHRE = '#c8643a', HIC = 'rgba(243,230,204,0.82)';
const LB = 110;
const EP = { n: 2, en: 'THE FIRST HUMANS IN INDIA', hi: 'भारत के पहले इंसान', title: 'The First Humans in India' };

// ---------- timeline: each segment fits the longer of the two languages ----------
const EN = JSON.parse(fs.readFileSync(D2 + 'en_tim.json')), HI = JSON.parse(fs.readFileSync(D2 + 'hi_tim.json'));
const PAD = { 1: .6, 4: .5, 10: .5, 16: .6, 19: .6, 23: .6, 30: 1.0, 32: 5.5, 33: 5.5, 34: 5.5, 36: 3.5 };
const LEAD = 6.5; // branded sting before narration
let acc = LEAD;
const SEG = EN.map((e, i) => { const sp = Math.max(e.dur, HI[i].dur), p = PAD[i] ?? .4; const s = { i, start: acc, speak: sp, dur: sp + p }; acc += sp + p; return s; });
const TOTAL = acc;
fs.writeFileSync(D2 + 'segments.json', JSON.stringify(SEG.map(s => ({ ...s, en: EN[s.i], hi: HI[s.i] })), null, 1));

// ---------- map ----------
const land = JSON.parse(fs.readFileSync('land.json'));
const geo = { type: 'MultiPolygon', coordinates: [...land.main, ...land.lanka].map(r => [r]) };
const proj = geoMercator().fitExtent([[W * .5 - 380, 140], [W * .5 + 380, H - 130]], geo);
const rings = [...land.main, ...land.lanka].map(r => r.map(p => proj(p)));
const ringLen = rings.map(r => r.reduce((s, p, i) => i ? s + Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) : 0, 0));
const P = ll => proj(ll);
const SITES = {
  pallavaram: { n: 'Pallavaram', h: 'पल्लावरम', ll: [80.15, 12.97] }, attirampakkam: { n: 'Attirampakkam', h: 'अत्तिरमपक्कम', ll: [79.88, 13.23] },
  hunsgi: { n: 'Hunsgi & Isampur', h: 'हुंसगी और इसामपुर', ll: [76.5, 16.45] }, hathnora: { n: 'Hathnora', h: 'हथनोरा', ll: [77.97, 22.87] },
  jwalapuram: { n: 'Jwalapuram', h: 'ज्वालापुरम', ll: [78.07, 15.33] }, patne: { n: 'Patne', h: 'पाटणे', ll: [75.03, 20.33] },
  bhimbetka: { n: 'Bhimbetka', h: 'भीमबेटका', ll: [77.61, 22.94] },
};
const TOOLSITES = [[80.15, 12.97], [76.5, 16.45], [77.97, 22.87], [78.07, 15.33], [75.03, 20.33], [77.61, 22.94], [74.57, 27.4], [82.0, 24.4], [78.6, 18.2], [74.3, 15.9], [85.8, 21.6], [73.9, 18.6], [72.6, 23.1], [76.2, 11.5], [80.9, 16.8], [83.5, 19.5], [75.8, 25.2], [87.0, 23.4]];
const TOBA = [98.8, 2.6];

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eout = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, x) => a + (b - a) * x;
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function text(ctx, s, x, y, font, color, align = 'center', alpha = 1, o = {}) {
  if (!s || alpha <= 0.002) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (o.spacing) ctx.letterSpacing = o.spacing; if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 28; } ctx.fillText(s, x, y); ctx.restore();
}
const hiF = px => `${px}px Tiro`, hiS = px => `${px}px NotoDevB`; // Hindi serif / sans

// ---------- scenes ----------
const OV = { c: [W / 2, H / 2], z: 1 };
const cam = (ll, z) => ({ c: P(ll), z });
const S = {
  0: { map: 0, ov: { t: 'hook', lines: ['No kings.', 'No cities.', 'No farms.'], hi: ['न राजा।', 'न नगर।', 'न खेती।'] } },
  1: { map: 0, ov: { t: 'bigq', lines: ['Who were the first humans', 'to walk in India?'], hi: 'भारत में चलने वाले पहले इंसान कौन थे?' } },
  2: { map: 1, draw: true, cam: { c: P([68, 20]), z: .85 }, ov: { t: 'kicker', s: 'WHERE IT BEGAN', hi: 'शुरुआत कहाँ से' } },
  3: { map: 1, cam: { c: P([68, 20]), z: .85 }, routes: [{ from: [36, 14], via: [[50, 18], [60, 24]], to: [70, 27], lab: 'OUT OF AFRICA', hi: 'अफ़्रीका से बाहर' }], ov: { t: 'fact', big: '2 million', small: 'years ago · Homo erectus', hi: 'लगभग बीस लाख साल पहले', left: true } },
  4: { map: 1, cam: OV, routes: [{ from: [64, 30], via: [[70, 27]], to: [77, 23], lab: '' }, { from: [70, 27], via: [[74, 18]], to: [79.5, 13], lab: '' }, { from: [70, 27], via: [[80, 27]], to: [87, 24], lab: '' }], ov: { t: 'kicker', s: 'INTO THE SUBCONTINENT', hi: 'उपमहाद्वीप में' } },
  5: { map: .15, cam: OV, ov: { t: 'title', k: 'THE CLUES', s: 'Stone Tools', hi: 'पत्थर के औज़ार', icon: 'handaxe' } },
  6: { map: 1, cam: cam([80.15, 12.97], 2.4), marks: ['pallavaram'], labels: { pallavaram: ['Near Chennai', 'चेन्नई के पास'] }, ov: { t: 'fact', big: '1863', small: 'Robert Bruce Foote', hi: 'रॉबर्ट ब्रूस फ़ूट' } },
  7: { map: .45, cam: cam([80.15, 12.97], 2.4), marks: ['pallavaram'], ov: { t: 'icon', icon: 'handaxe', cap: 'The first Old Stone Age tool', hi: 'भारत का पहला पुरापाषाण औज़ार', sub: 'identified in India' } },
  8: { map: 1, cam: OV, dots: true, ov: { t: 'kicker', s: 'THOUSANDS OF TOOLS FOUND', hi: 'हज़ारों औज़ार मिले' } },
  9: { map: 1, cam: cam([79.88, 13.23], 2.4), marks: ['attirampakkam'], labels: { attirampakkam: ['Tamil Nadu', 'तमिलनाडु'] }, ov: { t: 'fact', big: '1.5 million', small: 'years old', hi: 'लगभग पंद्रह लाख साल पुराने' } },
  10: { map: .45, cam: cam([79.88, 13.23], 2.4), marks: ['attirampakkam'], ov: { t: 'icon', icon: 'handaxe', cap: 'Among the oldest outside Africa', hi: 'अफ़्रीका के बाहर सबसे पुराने औज़ारों में', sub: '', cont: true } },
  11: { map: 1, cam: cam([76.5, 16.45], 2.4), marks: ['hunsgi'], labels: { hunsgi: ['Karnataka', 'कर्नाटक'] }, ov: { t: 'kicker', s: 'STONE-TOOL WORKSHOPS', hi: 'पत्थर के औज़ारों की कार्यशालाएँ' } },
  12: { map: .15, cam: OV, ov: { t: 'title', k: 'OLD STONE AGE', s: 'The Palaeolithic', hi: 'पुरापाषाण काल', icon: 'handaxe' } },
  13: { map: .12, cam: OV, ov: { t: 'stages', items: [['Lower', 'निम्न'], ['Middle', 'मध्य'], ['Upper', 'उच्च']] } },
  14: { map: .25, cam: OV, ov: { t: 'icon', icon: 'handaxe', cap: 'Lower Palaeolithic', hi: 'निम्न पुरापाषाण', sub: 'Hand axes & cleavers' } },
  15: { map: .25, cam: OV, ov: { t: 'icon', icon: 'flakes', cap: 'Middle Palaeolithic', hi: 'मध्य पुरापाषाण', sub: 'Smaller flake tools' } },
  16: { map: .25, cam: OV, ov: { t: 'icon', icon: 'blades', cap: 'Upper Palaeolithic', hi: 'उच्च पुरापाषाण', sub: 'Blades, bone tools & art' } },
  17: { map: 0, ov: { t: 'bigq', lines: ['What did they look like?'], hi: 'वे दिखते कैसे थे?' } },
  18: { map: 1, cam: cam([77.97, 22.87], 2.4), marks: ['hathnora'], labels: { hathnora: ['Narmada valley · 1982', 'नर्मदा घाटी · 1982'] } },
  19: { map: .45, cam: cam([77.97, 22.87], 2.4), marks: ['hathnora'], ov: { t: 'icon', icon: 'skull', cap: 'Narmada Man', hi: 'नर्मदा मानव', sub: 'Exact age still debated' } },
  20: { map: .2, cam: { c: P([86, 13]), z: .85 }, ov: { t: 'fact', big: '74,000', small: 'years ago', hi: 'लगभग 74,000 साल पहले' } },
  21: { map: 1, cam: { c: P([86, 13]), z: .85 }, toba: 'erupt', ov: { t: 'kicker', s: 'TOBA SUPER-ERUPTION · SUMATRA', hi: 'टोबा महा-विस्फोट · सुमात्रा' } },
  22: { map: 1, cam: cam([78.07, 15.33], 1.9), toba: 'ash', marks: ['jwalapuram'], labels: { jwalapuram: ['Tools below & above the ash', 'राख के नीचे और ऊपर औज़ार'] } },
  23: { map: .25, cam: cam([78.07, 15.33], 1.9), toba: 'ash', ov: { t: 'bigq', lines: ['Did humans survive?'], hi: 'क्या इंसान बच पाए?' } },
  24: { map: 1, cam: OV, routes: [{ from: [52, 22], via: [[62, 24]], to: [72, 24], lab: 'HOMO SAPIENS', hi: 'आधुनिक मानव' }], ov: { t: 'fact', big: '50–70,000', small: 'years ago · people like us', hi: 'लगभग 50 से 70 हज़ार साल पहले' } },
  25: { map: .3, cam: OV, ov: { t: 'icon', icon: 'rock', cap: 'Hunter-gatherers', hi: 'शिकारी-संग्राहक', sub: 'Moving with the seasons' } },
  26: { map: .3, cam: OV, ov: { t: 'icon', icon: 'rock', cap: 'Caves & rock shelters', hi: 'गुफ़ाएँ और चट्टानी आश्रय', sub: 'Deer · wild cattle · fruit · honey', cont: true } },
  27: { map: .3, cam: OV, ov: { t: 'icon', icon: 'fire', cap: 'Fire', hi: 'आग', sub: 'Warmth · light · cooking' } },
  28: { map: 1, cam: cam([75.03, 20.33], 2.4), marks: ['patne'], labels: { patne: ['Maharashtra', 'महाराष्ट्र'] }, ov: { t: 'icon', icon: 'beads', cap: 'Engraved eggshell beads', hi: 'नक्काशीदार मनके', sub: 'Ostrich eggshell' } },
  29: { map: .3, cam: cam([75.03, 20.33], 2.4), ov: { t: 'bigq', lines: ['Thinkers. Artists.'], hi: 'विचारक। कलाकार।' } },
  30: { map: 1, cam: cam([77.61, 22.94], 2.3), marks: ['bhimbetka'], labels: { bhimbetka: ['Coming next', 'अगला एपिसोड'] } },
  31: { map: .15, cam: OV, ov: { t: 'title', k: 'QUIZ TIME', s: 'Test Yourself', hi: 'अब आपकी बारी', icon: 'magnifier' } },
  32: { map: .12, cam: OV, ov: { t: 'quiz', n: 1, q: 'Who found the first Old Stone Age tool in India, in 1863?', qh: '1863 में भारत में पहला पुरापाषाण औज़ार किसने खोजा?', o: ['John Marshall', 'Robert Bruce Foote', 'James Prinsep', 'Mortimer Wheeler'] } },
  33: { map: .12, cam: OV, ov: { t: 'quiz', n: 2, q: 'Which Tamil Nadu site has tools about 1.5 million years old?', qh: 'तमिलनाडु की किस जगह पर लगभग पंद्रह लाख साल पुराने औज़ार मिले?', o: ['Bhimbetka', 'Hunsgi', 'Attirampakkam', 'Patne'] } },
  34: { map: .12, cam: OV, ov: { t: 'quiz', n: 3, q: 'In which river valley was the Narmada Man skull found?', qh: 'नर्मदा मानव की खोपड़ी किस नदी घाटी में मिली?', o: ['Ganga', 'Godavari', 'Narmada', 'Krishna'] } },
  35: { map: .12, cam: OV, ov: { t: 'bigq', lines: ['Answers in the', 'pinned comment'], hi: 'जवाब पिन किए गए कमेंट में' } },
  36: { map: .1, cam: OV, ov: { t: 'end' } },
};
let lastCam = OV; for (const s of SEG) { const sp = S[s.i]; if (!sp.cam) sp.cam = lastCam; lastCam = sp.cam; }

// ---------- textures ----------
const bg = createCanvas(W, H); { const x = bg.getContext('2d'); const img = x.createImageData(W, H); const r = rng(11);
  for (let i = 0; i < W * H; i++) { const n = (r() - .5) * 10; img.data[i * 4] = 22 + n; img.data[i * 4 + 1] = 16 + n; img.data[i * 4 + 2] = 12 + n; img.data[i * 4 + 3] = 255; } x.putImageData(img, 0, 0);
  const v = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * .7); v.addColorStop(0, 'rgba(90,55,20,0.35)'); v.addColorStop(1, 'rgba(0,0,0,0.8)'); x.fillStyle = v; x.fillRect(0, 0, W, H); }
const vign = createCanvas(W, H); { const x = vign.getContext('2d'); const v = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H); }
const DUST = (() => { const r = rng(5); return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: .5 + r() * 2.5, v: 5 + r() * 25, a: .1 + r() * .5 })); })();

// ---------- icons ----------
function icon(ctx, name, p, t) {
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(227,180,95,0.5)'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.rect(-220, -220, 440 * eout(p), 440); ctx.clip();
  const L = (pts, close) => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const q of pts.slice(1)) ctx.lineTo(...q); if (close) ctx.closePath(); ctx.stroke(); };
  if (name === 'handaxe') {
    ctx.beginPath(); ctx.moveTo(0, -175); ctx.bezierCurveTo(70, -120, 115, 10, 95, 95); ctx.bezierCurveTo(75, 160, -75, 160, -95, 95); ctx.bezierCurveTo(-115, 10, -70, -120, 0, -175); ctx.closePath();
    ctx.fillStyle = 'rgba(120,90,50,0.35)'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.globalAlpha = .8; // flake scars
    [[[-60, 40], [-10, -20], [-40, -90]], [[60, 40], [10, -20], [40, -90]], [[-70, 110], [0, 60], [70, 110]], [[-20, -130], [0, -60], [20, -130]], [[-85, 60], [-30, 70]], [[85, 60], [30, 70]]].forEach(s => L(s));
  } else if (name === 'flakes') {
    const flake = (x, y, r, s) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-40, -60); ctx.lineTo(45, -45); ctx.lineTo(55, 40); ctx.lineTo(0, 75); ctx.lineTo(-50, 30); ctx.closePath(); ctx.fillStyle = 'rgba(120,90,50,0.35)'; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2; L([[-20, -40], [10, 10], [-10, 50]]); L([[20, -30], [30, 20]]); ctx.restore(); };
    flake(-100, -20, -.3, 1.1); flake(40, -60, .4, .9); flake(90, 80, -.1, 1); flake(-40, 110, .8, .8);
  } else if (name === 'blades') {
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(-120 + k * 80, 0); ctx.rotate(-.15 + k * .1); ctx.beginPath(); ctx.moveTo(0, -170); ctx.lineTo(20, -120); ctx.lineTo(18, 150); ctx.lineTo(-18, 150); ctx.lineTo(-20, -120); ctx.closePath(); ctx.fillStyle = 'rgba(120,90,50,0.3)'; ctx.fill(); ctx.stroke(); ctx.lineWidth = 2; L([[0, -130], [0, 140]]); ctx.restore(); }
    ctx.strokeStyle = CREAM; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-170, 175); ctx.quadraticCurveTo(0, 150, 170, 175); ctx.stroke(); // bone tool
    ctx.beginPath(); ctx.arc(-175, 175, 10, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(175, 175, 10, 0, 7); ctx.stroke();
  } else if (name === 'skull') {
    ctx.beginPath(); ctx.moveTo(-150, 20); ctx.bezierCurveTo(-160, -120, -40, -175, 50, -160); ctx.bezierCurveTo(140, -145, 175, -70, 165, 0); ctx.lineTo(150, 30); ctx.lineTo(120, 40); ctx.lineTo(110, 90); ctx.lineTo(60, 95); ctx.lineTo(50, 60); ctx.lineTo(-20, 60); ctx.bezierCurveTo(-80, 70, -140, 60, -150, 20); ctx.closePath();
    ctx.fillStyle = 'rgba(200,170,120,0.18)'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 6; L([[60, -20], [150, -25]]); // brow ridge
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(110, 5, 26, 18, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([8, 10]); ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(-150, 20); ctx.bezierCurveTo(-160, 120, 80, 140, 110, 90); ctx.stroke(); ctx.setLineDash([]); // missing jaw implied
    ctx.globalAlpha = 1; ctx.lineWidth = 2; L([[-60, -150], [-30, -60], [-70, 10]]); L([[20, -165], [0, -100]]);
  } else if (name === 'fire') {
    for (let k = 0; k < 3; k++) { const s = 1 - k * .28, f = Math.sin(t * 6 + k) * 8; ctx.strokeStyle = ['#e3b45f', '#e07a32', '#f3e6cc'][k]; ctx.fillStyle = ['rgba(227,180,95,0.25)', 'rgba(224,122,50,0.35)', 'rgba(243,230,204,0.4)'][k];
      ctx.beginPath(); ctx.moveTo(0, 120); ctx.bezierCurveTo(-110 * s, 100, -100 * s, -20, -30 * s + f, -60 * s); ctx.bezierCurveTo(-20 * s, -110 * s, 10 + f, -150 * s, 0 + f, -190 * s); ctx.bezierCurveTo(40 * s + f, -120 * s, 110 * s, -40, 90 * s, 40); ctx.bezierCurveTo(80 * s, 100, 40 * s, 120, 0, 120); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 12; L([[-130, 170], [120, 130]]); L([[-120, 130], [130, 170]]);
  } else if (name === 'beads') {
    ctx.beginPath(); ctx.moveTo(-180, -60); ctx.quadraticCurveTo(0, 160, 180, -60); ctx.stroke();
    for (let k = 0; k < 9; k++) { const u = k / 8, x = lerp(-160, 160, u), y = -60 + 4 * 110 * u * (1 - u) + 10; ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(243,230,204,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2a1d12'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.translate(0, -120); ctx.fillStyle = 'rgba(243,230,204,0.25)'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-60, -50); ctx.lineTo(50, -55); ctx.lineTo(95, 5); ctx.lineTo(40, 40); ctx.lineTo(-50, 35); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; for (let k = -3; k <= 3; k++) L([[k * 18 - 15, -30], [k * 18 + 15, 25]]); ctx.restore();
  } else if (name === 'rock') {
    ctx.beginPath(); ctx.moveTo(-170, 150); ctx.bezierCurveTo(-180, -60, -100, -170, 0, -165); ctx.bezierCurveTo(110, -170, 185, -60, 170, 150); ctx.stroke(); L([[-190, 150], [190, 150]]);
    ctx.strokeStyle = OCHRE; ctx.shadowColor = 'rgba(200,100,58,0.6)'; ctx.lineWidth = 5;
    const hunter = (x, y, s) => { ctx.beginPath(); ctx.arc(x, y - 52 * s, 9 * s, 0, 7); ctx.stroke(); L([[x, y - 42 * s], [x, y]]); L([[x, y], [x - 16 * s, y + 34 * s]]); L([[x, y], [x + 18 * s, y + 32 * s]]); L([[x, y - 30 * s], [x + 30 * s, y - 34 * s]]); ctx.beginPath(); ctx.arc(x + 30 * s, y - 34 * s, 26 * s, -1.3, 1.3); ctx.stroke(); L([[x + 20 * s, y - 34 * s], [x + 62 * s, y - 34 * s]]); };
    hunter(-110, 40, 1); hunter(-40, 60, .85);
    const dx = 70 + Math.sin(t * 1.2) * 3, dy = 20; ctx.beginPath(); ctx.ellipse(dx, dy, 42, 18, 0, 0, 7); ctx.stroke(); L([[dx - 30, dy + 12], [dx - 34, dy + 55]]); L([[dx - 14, dy + 16], [dx - 10, dy + 55]]); L([[dx + 18, dy + 15], [dx + 22, dy + 55]]); L([[dx + 32, dy + 10], [dx + 38, dy + 55]]);
    L([[dx + 38, dy - 8], [dx + 58, dy - 38]]); ctx.beginPath(); ctx.arc(dx + 62, dy - 42, 9, 0, 7); ctx.stroke(); L([[dx + 60, dy - 50], [dx + 52, dy - 80]]); L([[dx + 56, dy - 66], [dx + 44, dy - 72]]); L([[dx + 66, dy - 50], [dx + 76, dy - 78]]);
  } else if (name === 'magnifier') {
    ctx.beginPath(); ctx.arc(-25, -25, 95, 0, 7); ctx.stroke(); ctx.lineWidth = 16; L([[45, 45], [130, 130]]);
  }
  ctx.restore();
}

// ---------- drawing ----------
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
function landPath() { ctx.beginPath(); for (const r of rings) { ctx.moveTo(...r[0]); for (const p of r) ctx.lineTo(...p); ctx.closePath(); } }
function camAt(seg, u) { const prev = seg.i > 0 ? S[seg.i - 1].cam : OV, cur = S[seg.i].cam; const k = eio(prog(u, 0, 1.6)); return { x: lerp(prev.c[0], cur.c[0], k), y: lerp(prev.c[1], cur.c[1], k), z: lerp(prev.z, cur.z, k) }; }
function mapAlpha(seg, u) { const prev = seg.i > 0 ? S[seg.i - 1].map : 0; return lerp(prev, S[seg.i].map, eio(prog(u, 0, .9))); }
const firstMark = {}; for (const s of SEG) for (const m of (S[s.i].marks || [])) if (!(m in firstMark)) firstMark[m] = s.i;
const firstDots = SEG.find(s => S[s.i].dots).i;

function drawMap(seg, u, t, a) {
  if (a <= 0.003) return; const c = camAt(seg, u); const sp = S[seg.i];
  const toS = ([x, y]) => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
  landPath(); const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 600); g.addColorStop(0, '#6b4a22'); g.addColorStop(1, '#2e1f10'); ctx.fillStyle = g; ctx.fill('evenodd');
  const dp = sp.draw ? eio(prog(u, 0, 2.6)) : 1;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5 / c.z; ctx.shadowColor = GOLD; ctx.shadowBlur = 14; ctx.lineJoin = 'round';
  rings.forEach((r, i) => { ctx.beginPath(); ctx.moveTo(...r[0]); for (const q of r) ctx.lineTo(...q); ctx.closePath(); if (dp < 1) ctx.setLineDash([ringLen[i] * dp, ringLen[i] + 10]); ctx.stroke(); }); ctx.setLineDash([]); ctx.shadowBlur = 0;
  // Toba
  if (sp.toba) { const [tx, ty] = P(TOBA); const ep = sp.toba === 'erupt' ? eout(prog(u, .8, seg.speak)) : 1;
    if (sp.toba === 'erupt') { const fl = .5 + .5 * Math.sin(t * 14); const gl = ctx.createRadialGradient(tx, ty, 0, tx, ty, 70); gl.addColorStop(0, `rgba(255,140,60,${.9 * fl})`); gl.addColorStop(1, 'rgba(255,90,30,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(tx, ty, 70, 0, 7); ctx.fill(); }
    const R = 60 + ep * 900; const ash = ctx.createRadialGradient(tx, ty, R * .2, tx, ty, R); ash.addColorStop(0, `rgba(150,145,140,${.45 * Math.max(ep, .4)})`); ash.addColorStop(1, 'rgba(150,145,140,0)'); ctx.fillStyle = ash; ctx.beginPath(); ctx.arc(tx, ty, R, 0, 7); ctx.fill();
    if (sp.toba === 'ash') { ctx.save(); landPath(); ctx.clip(); ctx.fillStyle = 'rgba(160,155,150,0.18)'; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
  // routes
  (sp.routes || []).forEach((route, ri) => { const pts = [route.from, ...route.via, route.to].map(P); const rp = eio(prog(u, .5 + ri * .7, 2.8 + ri * .7));
    let tot = 0; const sl = pts.slice(1).map((q, k) => { const d = Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]); tot += d; return d; });
    ctx.strokeStyle = CREAM; ctx.lineWidth = 3 / c.z; ctx.setLineDash([10 / c.z, 8 / c.z]); ctx.lineDashOffset = -t * 30 / c.z;
    ctx.beginPath(); let rem = tot * rp; ctx.moveTo(...pts[0]); let head = pts[0], dir = [1, 0];
    for (let k = 1; k < pts.length && rem > 0; k++) { const d = sl[k - 1], f = Math.min(1, rem / d); head = [lerp(pts[k - 1][0], pts[k][0], f), lerp(pts[k - 1][1], pts[k][1], f)]; dir = [(pts[k][0] - pts[k - 1][0]) / d, (pts[k][1] - pts[k - 1][1]) / d]; ctx.lineTo(...head); rem -= d; }
    ctx.stroke(); ctx.setLineDash([]);
    if (rp > .02) { ctx.fillStyle = CREAM; ctx.save(); ctx.translate(...head); ctx.rotate(Math.atan2(dir[1], dir[0])); const s = 1 / c.z; ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(-10 * s, 9 * s); ctx.lineTo(-10 * s, -9 * s); ctx.closePath(); ctx.fill(); ctx.restore(); } });
  // tool-site dots
  if (sp.dots) TOOLSITES.forEach((e, k) => { const st = seg.i === firstDots ? .4 + k * (seg.speak * .7 / TOOLSITES.length) : -1; const ea = prog(u, st, st + .4); if (!ea) return; const [x, y] = P(e);
    ctx.fillStyle = `rgba(255,236,200,${ea})`; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); const s = 5.5 / c.z * (1 + (1 - eout(ea)) * 2); ctx.fillRect(-s, -s, 2 * s, 2 * s); ctx.restore(); });
  // marks
  for (const m of (sp.marks || [])) { const [x, y] = P(SITES[m].ll); const st = firstMark[m] === seg.i ? .9 : -1; const ma = prog(u, st, st + .6); if (!ma) continue;
    const R = 60 / Math.sqrt(c.z), pulse = 1 + .08 * Math.sin(t * 2.4); const gl = ctx.createRadialGradient(x, y, 0, x, y, R * pulse); gl.addColorStop(0, `rgba(255,200,110,${.8 * ma})`); gl.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x, y, 7 / c.z, 0, 7); ctx.fill(); }
  ctx.restore();
  // labels (screen space, bilingual)
  if (sp.labels) for (const [m, sub] of Object.entries(sp.labels)) { const la = prog(u, 1.2, 1.8) * a; const [sx, sy] = toS(P(SITES[m].ll));
    const right = sx < W * .62 && !(sp.ov && (sp.ov.t === 'fact' || sp.ov.t === 'icon')); const lx = sx + (right ? 44 : -44), al = right ? 'left' : 'right';
    text(ctx, SITES[m].n, lx, sy - 30, '52px Playfair', CREAM, al, la, { glow: '#000', blur: 18 });
    text(ctx, SITES[m].h, lx, sy + 18, hiF(34), HIC, al, la, { glow: '#000', blur: 14 });
    if (sub) { text(ctx, sub[0].toUpperCase(), lx, sy + 62, '22px InterB', GOLD, al, la, { spacing: '4px', glow: '#000', blur: 12 }); text(ctx, sub[1], lx, sy + 96, hiS(24), GOLD, al, la * .9, { glow: '#000', blur: 12 }); } }
  (sp.routes || []).forEach((route, ri) => { if (!route.lab) return; const [sx, sy] = toS(P(route.from)); const ra = prog(u, .4 + ri * .7, 1.0 + ri * .7) * a; const x = Math.max(80, Math.min(W - 460, sx));
    text(ctx, route.lab, x, sy + 40, '24px InterB', CREAM, 'left', ra, { spacing: '5px', glow: '#000', blur: 12 }); text(ctx, route.hi, x, sy + 72, hiS(24), HIC, 'left', ra, { glow: '#000', blur: 12 }); });
  if (sp.toba === 'erupt') { const [sx, sy] = toS(P(TOBA)); const ta = prog(u, .8, 1.4) * a; text(ctx, 'TOBA', sx, sy + 60, '30px InterB', CREAM, 'center', ta, { spacing: '6px', glow: '#000', blur: 12 }); text(ctx, 'टोबा', sx, sy + 96, hiS(26), HIC, 'center', ta, { glow: '#000', blur: 12 }); }
}

function sidePanel(alpha, x0 = .48) { ctx.save(); ctx.globalAlpha = alpha * .6; const g = ctx.createLinearGradient(W * x0, 0, W, 0); g.addColorStop(0, 'rgba(10,7,5,0)'); g.addColorStop(.25, 'rgba(10,7,5,0.85)'); g.addColorStop(1, 'rgba(10,7,5,0.95)'); ctx.fillStyle = g; ctx.fillRect(W * x0, 0, W * (1 - x0), H); ctx.restore(); }

function drawOverlay(seg, u) {
  const sp = S[seg.i], ov = sp.ov; if (!ov) return; const D = seg.dur, out = 1 - prog(u, D - .35, D), inn = prog(u, .1, .7), a = Math.min(inn, out);
  if (ov.t === 'hook') ov.lines.forEach((s, k) => { const st = k * seg.speak * .25; const la = Math.min(prog(u, st, st + .6), out); const sc = 1 + .04 * prog(u, 0, D);
    ctx.save(); ctx.translate(W / 2 - 220, 360 + k * 130); ctx.scale(sc, sc); text(ctx, s, 0, 0, '72px Playfair', CREAM, 'center', la, { glow: 'rgba(227,180,95,0.6)', blur: 30 }); ctx.restore();
    ctx.save(); ctx.translate(W / 2 + 260, 364 + k * 130); ctx.scale(sc, sc); text(ctx, ov.hi[k], 0, 0, hiF(64), GOLD, 'center', la, { glow: 'rgba(227,180,95,0.5)', blur: 26 }); ctx.restore(); });
  else if (ov.t === 'bigq') { const n = ov.lines.length; ov.lines.forEach((s, k) => text(ctx, s, W / 2, H / 2 - 60 - (n - 1) * 42 + k * 84, 'italic 64px PlayfairI', GOLD, 'center', a, { glow: 'rgba(227,180,95,0.7)', blur: 35 }));
    text(ctx, ov.hi, W / 2, H / 2 + 40 + (n - 1) * 42, hiF(54), CREAM, 'center', Math.min(prog(u, .4, 1.0), out), { glow: 'rgba(227,180,95,0.4)', blur: 24 }); }
  else if (ov.t === 'kicker') { text(ctx, ov.s, 120, LB + 56, '26px InterB', GOLD, 'left', a, { spacing: '7px', glow: '#000', blur: 10 }); text(ctx, ov.hi, 120, LB + 98, hiS(28), HIC, 'left', a, { glow: '#000', blur: 10 });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = GOLD; ctx.fillRect(120, LB + 126, 90 * eout(inn), 3); ctx.restore(); }
  else if (ov.t === 'title') { text(ctx, ov.k, W / 2, 300, '28px InterB', GOLD, 'center', a, { spacing: '14px' });
    const z = 1.06 - .06 * eout(prog(u, .2, D)); ctx.save(); ctx.translate(W / 2, 395); ctx.scale(z, z); text(ctx, ov.s, 0, 0, '96px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.55)', blur: 36 }); ctx.restore();
    text(ctx, ov.hi, W / 2, 485, hiF(58), GOLD, 'center', Math.min(prog(u, .5, 1.1), out), { glow: 'rgba(227,180,95,0.4)', blur: 24 });
    ctx.save(); ctx.translate(W / 2, 700); ctx.scale(.55, .55); ctx.globalAlpha = a * .9; icon(ctx, ov.icon, prog(u, .3, 1.5), u); ctx.restore(); }
  else if (ov.t === 'stages') { text(ctx, 'THREE STAGES', W / 2, 270, '28px InterB', GOLD, 'center', a, { spacing: '14px' }); text(ctx, 'तीन चरण', W / 2, 320, hiS(32), HIC, 'center', a);
    ov.items.forEach(([e, h], k) => { const x = W * (.25 + k * .25), st = .3 + k * seg.speak * .25, sa = Math.min(prog(u, st, st + .6), out);
      ctx.save(); ctx.globalAlpha = sa; ctx.strokeStyle = 'rgba(227,180,95,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 190, 400, 380, 300, 18); ctx.stroke(); ctx.restore();
      text(ctx, e, x, 500, '64px Playfair', CREAM, 'center', sa, { glow: 'rgba(227,180,95,0.5)', blur: 26 }); text(ctx, h, x, 575, hiF(52), GOLD, 'center', sa); text(ctx, 'PALAEOLITHIC', x, 645, '20px InterB', GOLD, 'center', sa * .8, { spacing: '5px' }); });
    ctx.save(); ctx.globalAlpha = a * .5; ctx.fillStyle = GOLD; ctx.fillRect(W * .2, 760, W * .6 * eout(prog(u, .3, seg.speak)), 3); ctx.restore(); text(ctx, 'OLDEST', W * .2, 800, '18px InterB', GOLD, 'left', a * .7, { spacing: '4px' }); text(ctx, 'NEWEST', W * .8, 800, '18px InterB', GOLD, 'right', a * .7, { spacing: '4px' }); }
  else if (ov.t === 'icon') { const ia = ov.cont ? out : a, ip = ov.cont ? 1 : prog(u, .1, 1.6), cx = W * .72, cy = 450; sidePanel(ia);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(.9, .9); ctx.globalAlpha = ia; icon(ctx, ov.icon, ip, u); ctx.restore();
    const capA = Math.min(prog(u, ov.cont ? 0 : .6, ov.cont ? .5 : 1.2), out);
    text(ctx, ov.cap, cx, 700, '54px Playfair', CREAM, 'center', capA, { glow: 'rgba(227,180,95,0.4)', blur: 24 }); text(ctx, ov.hi, cx, 768, hiF(44), GOLD, 'center', capA);
    if (ov.sub) text(ctx, ov.sub.toUpperCase(), cx, 830, '22px InterB', HIC, 'center', capA, { spacing: '5px' }); }
  else if (ov.t === 'fact') { const fx = ov.left ? W * .24 : W * .74; if (!ov.left) sidePanel(a, .5);
    const fy = ov.left ? 330 : 460; const z = 1.15 - .15 * eout(prog(u, .1, .9)); ctx.save(); ctx.translate(fx, fy); ctx.scale(z, z); text(ctx, ov.big, 0, 0, '150px Playfair', GOLD, 'center', a, { glow: 'rgba(227,180,95,0.6)', blur: 40 }); ctx.restore();
    const sa = Math.min(prog(u, .5, 1.1), out); text(ctx, ov.small.toUpperCase(), fx, fy + 125, '28px InterB', CREAM, 'center', sa, { spacing: '6px', glow: '#000', blur: 10 }); text(ctx, ov.hi, fx, fy + 180, hiF(42), GOLD, 'center', sa, { glow: '#000', blur: 10 }); }
  else if (ov.t === 'quiz') { text(ctx, `QUESTION ${ov.n} OF 3  ·  सवाल ${ov.n}`, W / 2, 200, '26px InterB', GOLD, 'center', a, { spacing: '6px' });
    text(ctx, ov.q, W / 2, 280, '50px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.4)', blur: 24 }); text(ctx, ov.qh, W / 2, 350, hiF(40), GOLD, 'center', a);
    ov.o.forEach((s, k) => { const oa = Math.min(prog(u, .8 + k * .25, 1.3 + k * .25), out); const x = W / 2 + (k % 2 ? 30 : -630), y = 460 + Math.floor(k / 2) * 130;
      ctx.save(); ctx.globalAlpha = oa; ctx.strokeStyle = 'rgba(227,180,95,0.7)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(30,20,10,0.75)'; ctx.beginPath(); ctx.roundRect(x, y, 600, 100, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x + 55, y + 50, 28, 0, 7); ctx.fill(); ctx.restore();
      text(ctx, 'ABCD'[k], x + 55, y + 52, '30px InterB', '#1a1108', 'center', oa); text(ctx, s, x + 105, y + 52, '38px InterM', CREAM, 'left', oa); });
    const tu = u - seg.speak, tl = 5; if (tu > 0) { const rem = clamp(1 - tu / tl), ta = Math.min(prog(tu, 0, .3), out), cx = W / 2, cy = 820;
      ctx.save(); ctx.globalAlpha = ta; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(227,180,95,0.2)'; ctx.beginPath(); ctx.arc(cx, cy, 44, 0, 7); ctx.stroke(); ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + rem * Math.PI * 2); ctx.stroke(); ctx.restore();
      text(ctx, String(Math.max(0, Math.ceil(tl - tu))), cx, cy + 2, '40px InterB', CREAM, 'center', ta); } }
  else if (ov.t === 'end') { text(ctx, 'NEXT ON INDIA: THE FULL STORY', W / 2, 290, '28px InterB', GOLD, 'center', a, { spacing: '12px' });
    const z = 1.06 - .06 * eout(prog(u, .2, D)); ctx.save(); ctx.translate(W / 2, 400); ctx.scale(z, z); text(ctx, "India's First Artists", 0, 0, '92px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.55)', blur: 36 }); ctx.restore();
    text(ctx, 'भारत के पहले कलाकार', W / 2, 495, hiF(56), GOLD, 'center', Math.min(prog(u, .5, 1.1), out));
    const ba = Math.min(prog(u, 1.5, 2.2), out), pulse = 1 + .04 * Math.sin(u * 4); ctx.save(); ctx.globalAlpha = ba; ctx.translate(W / 2, 640); ctx.scale(pulse, pulse); ctx.fillStyle = '#b8282a'; ctx.beginPath(); ctx.roundRect(-230, -48, 460, 96, 48); ctx.fill(); ctx.restore();
    text(ctx, 'SUBSCRIBE · सब्सक्राइब', W / 2, 642, '36px InterB', '#fff', 'center', ba); }
}

function sting(t) { const a = Math.min(prog(t, .4, 1.4), 1 - prog(t, LEAD - .8, LEAD - .1)); if (a <= 0) return;
  text(ctx, 'INDIA: THE FULL STORY  ·  EPISODE 2', W / 2, 380, '30px InterB', GOLD, 'center', a, { spacing: '12px' });
  const z = 1.08 - .08 * eout(prog(t, .6, LEAD)); ctx.save(); ctx.translate(W / 2, 500); ctx.scale(z, z); text(ctx, EP.title, 0, 0, '108px Playfair', CREAM, 'center', Math.min(prog(t, .8, 1.8), 1 - prog(t, LEAD - .8, LEAD - .1)), { glow: 'rgba(227,180,95,0.6)', blur: 44 }); ctx.restore();
  text(ctx, EP.hi, W / 2, 615, hiF(62), GOLD, 'center', Math.min(prog(t, 1.4, 2.4), 1 - prog(t, LEAD - .8, LEAD - .1)), { glow: 'rgba(227,180,95,0.4)', blur: 24 });
  const rl = eout(prog(t, 1.8, 3)); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 220 * rl, 690, 440 * rl, 3); ctx.restore(); }

function segAt(t) { let s = SEG[0]; for (const x of SEG) if (t >= x.start) s = x; return s; }
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(bg, 0, 0);
  if (t < SEG[0].start) sting(t);
  else { const seg = segAt(t), u = t - seg.start; drawMap(seg, u, t, mapAlpha(seg, u)); drawOverlay(seg, u); }
  for (const d of DUST) { const y = (d.y - t * d.v + H * 100) % H; ctx.fillStyle = `rgba(255,220,160,${d.a * .5})`; ctx.beginPath(); ctx.arc(d.x + Math.sin(t + d.y) * 10, y, d.s, 0, 7); ctx.fill(); }
  ctx.drawImage(vign, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, LB); ctx.fillRect(0, H - LB, W, LB);
  const wa = .75 * prog(t, LEAD, LEAD + 1); if (wa > 0) { text(ctx, 'INDIA: THE FULL STORY', 60, LB / 2, '20px InterB', GOLD, 'left', wa, { spacing: '6px' }); text(ctx, `EPISODE ${EP.n}  ·  ${EP.en}`, W - 60, LB / 2, '20px InterB', 'rgba(243,230,204,0.8)', 'right', wa, { spacing: '3px' }); }
  const fi = Math.min(1, t / .8, (TOTAL - t) / 1.0); if (fi < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fi})`; ctx.fillRect(0, 0, W, H); }
}

const arg = process.argv[2] || 'chunk';
if (arg === 'stills') { fs.mkdirSync(D2 + 'stills', { recursive: true }); for (const p of process.argv[3].split(',')) { const [i, f] = p.split(':').map(Number); const t = i < 0 ? f : SEG[i].start + SEG[i].dur * f; frame(t); fs.writeFileSync(`${D2}stills/s${i}_${f}.jpg`, canvas.toBuffer('image/jpeg', 85)); } }
else { const k = +process.argv[3], n = +process.argv[4]; const NF = Math.ceil(TOTAL * FPS); const a = Math.floor(NF * k / n), b = Math.floor(NF * (k + 1) / n);
  fs.mkdirSync(D2 + 'parts', { recursive: true }); const tmp = `${D2}parts/p${k}.part.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', `${FPS}`, '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) { frame(f / FPS); if (!ff.stdin.write(Buffer.from(canvas.data()))) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); ff.on('close', c => { if (c === 0) fs.renameSync(tmp, `${D2}parts/p${k}.mp4`); console.log('chunk', k, c); }); }
console.error('TOTAL', TOTAL.toFixed(2));
