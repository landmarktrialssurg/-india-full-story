// Episode 1 renderer — cinematic style, timed to narration lines
import fs from 'fs';
import { spawn } from 'child_process';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { geoMercator } from 'd3-geo';

const F = 'node_modules/@fontsource/';
const reg = (pkg, w, name, st = 'normal') => GlobalFonts.registerFromPath(`${F}${pkg}/files/${pkg}-latin-${w}-${st}.woff2`, name);
reg('inter', 400, 'Inter'); reg('inter', 700, 'InterB'); reg('inter', 500, 'InterM');
reg('playfair-display', 700, 'Playfair'); reg('playfair-display', 400, 'PlayfairI', 'italic');

const W = 1920, H = 1080, FPS = 30;
const GOLD = '#e3b45f', CREAM = '#f3e6cc', OCHRE = '#c8643a', SILVER = '#d4d8dc';
const LB = 110; // letterbox

// ---------- timeline ----------
const LINES = JSON.parse(fs.readFileSync('script.json'));
const TIM = JSON.parse(fs.readFileSync('timings.json')); // [{start,dur}]
const PAD0 = { 0: .3, 1: 4.2, 3: .6, 13: .6, 22: .8, 31: .6, 33: 1.0, 35: 5.5, 36: 5.5, 37: 5.5, 39: 3.5 };
const NI = 9; const PAD = { 0: 1.2, 1: .4, 2: .5, 3: .4, 4: .5, 5: .4, 6: .6, 7: .5, 8: 2.6 }; for (const [k, v] of Object.entries(PAD0)) PAD[+k + NI] = v;
let acc = 1.0; // 1 s lead-in
const SEG = LINES.map((txt, i) => { const d = TIM[i].dur, p = PAD[i] ?? .35; const s = { i, txt, start: acc, speak: d, dur: d + p }; acc += d + p; return s; });
const TOTAL = acc;
fs.writeFileSync('segments.json', JSON.stringify(SEG.map(s => ({ i: s.i, start: s.start, speak: s.speak, dur: s.dur, src: TIM[s.i] })), null, 1));

// ---------- map ----------
const land = JSON.parse(fs.readFileSync('land.json'));
const geo = { type: 'MultiPolygon', coordinates: [...land.main, ...land.lanka].map(r => [r]) };
const proj = geoMercator().fitExtent([[W * .5 - 380, 140], [W * .5 + 380, H - 130]], geo);
const rings = [...land.main, ...land.lanka].map(r => r.map(p => proj(p)));
const ringLen = rings.map(r => r.reduce((s, p, i) => i ? s + Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) : 0, 0));
const P = ll => proj(ll);

const SITES = {
  mohenjo: { n: 'Mohenjo-daro', ll: [68.14, 27.33] }, harappa: { n: 'Harappa', ll: [72.86, 30.63] },
  bhimbetka: { n: 'Bhimbetka', ll: [77.61, 22.94] }, sarnath: { n: 'Sarnath', ll: [83.02, 25.38] },
  arikamedu: { n: 'Arikamedu', ll: [79.82, 11.90] }, pataliputra: { n: 'Pataliputra', ll: [85.14, 25.6] },
  nalanda: { n: 'Nalanda', ll: [85.44, 25.13] }, madurai: { n: 'Sangam country', ll: [78.12, 9.92] },
  lahore: { n: 'Punjab', ll: [74.3, 31.5] },
  delhi: { n: 'Delhi', ll: [77.21, 28.61] }, hampi: { n: 'Hampi', ll: [76.46, 15.33] }, thanjavur: { n: 'Thanjavur', ll: [79.14, 10.79] }, agra: { n: 'Agra', ll: [78.0, 27.18] },
};
const EDICTS = [[70.5, 21.5], [77.85, 30.52], [72.17, 34.22], [85.84, 20.19], [84.83, 19.5], [72.8, 19.4], [77.6, 15.2], [83.02, 25.38], [83.28, 27.47], [77.74, 23.48], [76.65, 15.96], [77.2, 30.1], [80.0, 22.9], [76.3, 14.3]];
const MAIN5 = ['mohenjo', 'harappa', 'bhimbetka', 'sarnath', 'arikamedu'];

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eout = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, x) => a + (b - a) * x;
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function text(ctx, s, x, y, font, color, align = 'center', alpha = 1, o = {}) {
  if (alpha <= 0.002) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (o.spacing) ctx.letterSpacing = o.spacing; if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 28; }
  ctx.fillText(s, x, y); ctx.restore();
}
function wrap(ctx, s, font, maxW) { ctx.font = font; const words = s.split(' '); const out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }

// ---------- scene specs ----------
const OV = { c: [W / 2, H / 2], z: 1 };
const cam = (ll, z) => ({ c: P(ll), z });
const S0 = {
  0: { map: 0, ov: { t: 'hook', lines: ['No newspapers.', 'No cameras.', 'No written history books.'] } },
  1: { map: 0, ov: { t: 'bigq', lines: ['So how do we know what happened', 'in India thousands of years ago?'] }, sting: true },
  2: { map: 1, cam: OV, marks: MAIN5, stagger: true, ov: { t: 'kicker', s: 'THE PAST HAS LEFT US CLUES' } },
  3: { map: .18, cam: OV, ov: { t: 'split' } },
  4: { map: .15, cam: OV, ov: { t: 'title', k: 'PART ONE', s: 'Archaeological Sources', icon: 'magnifier' } },
  5: { map: 1, cam: cam([77.61, 22.94], 2.3), marks: ['bhimbetka'], labels: { bhimbetka: 'Madhya Pradesh' } },
  6: { map: .55, cam: cam([77.61, 22.94], 2.3), marks: ['bhimbetka'], ov: { t: 'icon', icon: 'rock', cap: 'Rock Paintings', sub: 'More than 10,000 years old' } },
  7: { map: .55, cam: cam([77.61, 22.94], 2.3), marks: ['bhimbetka'], ov: { t: 'icon', icon: 'rock', cap: 'Life before writing', sub: 'Hunters · dancers · animals', cont: true } },
  8: { map: .15, cam: OV, ov: { t: 'title', k: 'ARCHAEOLOGY', s: 'Ruined Cities', icon: 'bath' } },
  9: { map: 1, cam: cam([72.86, 30.63], 2.3), marks: ['harappa'], labels: { harappa: 'Excavated 1921' }, ov: { t: 'fact', big: '1921', small: 'Harappa is excavated' } },
  10: { map: .55, cam: cam([68.14, 27.33], 2.3), marks: ['mohenjo', 'harappa'], labels: { mohenjo: 'Excavated 1922' }, ov: { t: 'icon', icon: 'bath', cap: 'The Great Bath', sub: 'Mohenjo-daro' } },
  11: { map: 1, cam: cam([70.6, 29.0], 1.9), marks: ['mohenjo', 'harappa'], labels: { mohenjo: '', harappa: '' }, ov: { t: 'fact', big: '4,500+', small: 'years old' } },
  12: { map: .45, cam: cam([70.6, 29.0], 1.9), marks: ['mohenjo', 'harappa'], ov: { t: 'icon', icon: 'seal', cap: 'Indus Seals', sub: 'Animals and a mysterious script' } },
  13: { map: .45, cam: cam([70.6, 29.0], 1.9), marks: ['mohenjo', 'harappa'], ov: { t: 'icon', icon: 'seal', cap: 'Still undeciphered', sub: 'One of history’s great puzzles', cont: true } },
  14: { map: .15, cam: OV, ov: { t: 'title', k: 'ARCHAEOLOGY', s: 'Inscriptions', icon: 'pillar' } },
  15: { map: 1, cam: cam([79.5, 22.5], 1.1), edicts: true, ov: { t: 'kicker', s: 'ASHOKA’S EDICTS · c. 3RD CENTURY BCE' } },
  16: { map: .5, cam: cam([79.5, 22.5], 1.1), edicts: true, ov: { t: 'fact', big: 'Unread', small: 'for centuries' } },
  17: { map: .25, cam: cam([79.5, 22.5], 1.1), edicts: true, ov: { t: 'fact', big: '1837', small: 'James Prinsep deciphers Brahmi', brahmi: true } },
  18: { map: .55, cam: cam([83.02, 25.38], 2.4), marks: ['sarnath'], ov: { t: 'icon', icon: 'pillar', cap: 'Lion Capital, Sarnath', sub: 'National Emblem of India' } },
  19: { map: .15, cam: OV, ov: { t: 'title', k: 'ARCHAEOLOGY', s: 'Coins', icon: 'coin' } },
  20: { map: .3, cam: OV, ov: { t: 'icon', icon: 'coin', cap: 'Punch-marked Coins', sub: 'India’s earliest coins' } },
  21: { map: .3, cam: OV, ov: { t: 'icon', icon: 'coin', cap: 'Rulers · Beliefs · Trade', sub: 'What coins reveal', cont: true } },
  22: { map: 1, cam: cam([74, 12.5], 1.5), marks: ['arikamedu'], labels: { arikamedu: 'Near Puducherry' }, route: { from: [57, 9], via: [[72, 6.2], [80.2, 5.2], [82.6, 8.2]], to: [79.82, 11.9], lab: 'FROM ROME' } },
  23: { map: .15, cam: OV, ov: { t: 'title', k: 'PART TWO', s: 'Literary Sources', icon: 'scroll' } },
  24: { map: .3, cam: OV, ov: { t: 'icon', icon: 'scroll', cap: 'The Rigveda', sub: 'More than 3,000 years old' } },
  25: { map: .3, cam: OV, ov: { t: 'icon', icon: 'scroll', cap: 'Jatakas & Jain Texts', sub: 'Kingdoms and daily life', cont: true } },
  26: { map: .3, cam: OV, ov: { t: 'icon', icon: 'scroll', cap: 'Arthashastra', sub: 'by Kautilya · a guide to running a kingdom', cont: true } },
  27: { map: 1, cam: cam([78.4, 10.6], 2.4), marks: ['madurai'], labels: { madurai: 'Tamil Nadu' }, ov: { t: 'kicker', s: 'SANGAM POETRY' } },
  28: { map: .15, cam: OV, ov: { t: 'title', k: 'LITERATURE', s: 'Foreign Travellers', icon: 'compass' } },
  29: { map: 1, cam: cam([75, 26], 1.05), marks: ['pataliputra'], labels: { pataliputra: 'Megasthenes · c. 300 BCE' }, route: { from: [56, 31], via: [[66, 30]], to: [85.14, 25.6], lab: 'FROM GREECE' } },
  30: { map: 1, cam: cam([75, 28], 1.05), marks: ['nalanda'], labels: { nalanda: 'Fa-Hien · Xuanzang' }, route: { from: [64, 39], via: [[71.5, 35], [76, 31]], to: [85.44, 25.13], lab: 'FROM CHINA, VIA CENTRAL ASIA' } },
  31: { map: 1, cam: cam([72, 30], 1.5), marks: ['lahore'], labels: { lahore: 'Al-Biruni · 11th century' }, route: { from: [68.4, 33.5], via: [[71.5, 32.5]], to: [74.3, 31.5], lab: 'FROM GHAZNI' } },
  32: { map: 1, cam: OV, marks: [...MAIN5, 'pataliputra', 'nalanda', 'madurai'], edicts: true },
  33: { map: .3, cam: OV, ov: { t: 'icon', icon: 'puzzle', cap: 'The past begins to speak', sub: '', center: true } },
  34: { map: .15, cam: OV, ov: { t: 'title', k: 'QUIZ TIME', s: 'Test Yourself', icon: 'magnifier' } },
  35: { map: .12, cam: OV, ov: { t: 'quiz', n: 1, q: 'Who deciphered the Brahmi script in 1837?', o: ['Alexander Cunningham', 'James Prinsep', 'William Jones', 'John Marshall'] } },
  36: { map: .12, cam: OV, ov: { t: 'quiz', n: 2, q: 'Where are the rock shelters with paintings 10,000+ years old?', o: ['Ajanta', 'Bhimbetka', 'Ellora', 'Elephanta'] } },
  37: { map: .12, cam: OV, ov: { t: 'quiz', n: 3, q: 'Which Greek ambassador wrote Indica?', o: ['Herodotus', 'Ptolemy', 'Megasthenes', 'Seleucus'] } },
  38: { map: .12, cam: OV, ov: { t: 'bigq', lines: ['Answers in the', 'pinned comment'] } },
  39: { map: .1, cam: OV, ov: { t: 'end' } },
};
const S = {
  0: { map: 1, draw: true, cam: OV, ov: null },
  1: { map: 1, cam: OV, geo: [['HIMALAYAS', [83.5, 29.6]], ['THAR DESERT', [71.2, 26.6]], ['GANGA', [84.5, 25.0]], ['INDUS', [69.3, 29.5]], ['ARABIAN SEA', [64.5, 16]], ['BAY OF BENGAL', [88.5, 15]], ['INDIAN OCEAN', [79, 3.5]]] },
  2: { map: .2, cam: OV, ov: { t: 'stats', items: [['1 BILLION+', 'PEOPLE'], ['HUNDREDS', 'OF LANGUAGES'], ['4,500+ YEARS', 'OF CITIES']] } },
  3: { map: 1, cam: OV, marks: ['pataliputra', 'delhi', 'agra', 'hampi', 'thanjavur'], stagger: true, labelsAll: true, ov: { t: 'kicker', s: 'EMPIRES ROSE AND FELL' } },
  4: { map: 1, cam: OV, routes: [{ from: [55, 21], via: [[63, 18.5]], to: [72.8, 19.0], lab: 'TRADERS' }, { from: [62, 37.5], via: [[68.5, 34.5]], to: [74.3, 31.5], lab: 'INVADERS' }, { from: [80.3, 13.2], via: [[89, 10]], to: [99, 6], lab: 'IDEAS SAIL EAST', labAt: 'to' }] },
  5: { map: .3, cam: OV, ov: { t: 'fact', big: 'Stone Age', small: 'where our story begins' } },
  6: { map: .15, cam: OV, ov: { t: 'timeline', items: ['Stone Age', 'Indus Cities', 'Mauryas & Guptas', 'Cholas', 'Sultans', 'Mughals', 'British Raj', 'Independence'] } },
  7: { map: .2, cam: OV, ov: { t: 'fact', big: '100+', small: 'episodes \u00b7 in order' } },
  8: { map: .35, cam: OV, marks: [], ov: { t: 'brand' } },
};
for (const [k, v] of Object.entries(S0)) S[+k + NI] = v;
// carry previous camera when unspecified
let lastCam = OV; for (const s of SEG) { const sp = S[s.i]; if (!sp.cam) sp.cam = lastCam; lastCam = sp.cam; }

// ---------- textures ----------
const bg = createCanvas(W, H); { const x = bg.getContext('2d'); const img = x.createImageData(W, H); const r = rng(11);
  for (let i = 0; i < W * H; i++) { const n = (r() - .5) * 10; img.data[i * 4] = 22 + n; img.data[i * 4 + 1] = 16 + n; img.data[i * 4 + 2] = 12 + n; img.data[i * 4 + 3] = 255; } x.putImageData(img, 0, 0);
  const v = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * .7); v.addColorStop(0, 'rgba(90,55,20,0.35)'); v.addColorStop(1, 'rgba(0,0,0,0.8)'); x.fillStyle = v; x.fillRect(0, 0, W, H); }
const vign = createCanvas(W, H); { const x = vign.getContext('2d'); const v = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H); }
const DUST = (() => { const r = rng(5); return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: .5 + r() * 2.5, v: 5 + r() * 25, a: .1 + r() * .5 })); })();

// ---------- icons (gold line art, ~360px box) ----------
function icon(ctx, name, p, t) {
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(227,180,95,0.5)'; ctx.shadowBlur = 14;
  // wipe reveal
  ctx.beginPath(); ctx.rect(-200, -200, 400 * eout(p), 400); ctx.clip();
  const L = (pts, close) => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const q of pts.slice(1)) ctx.lineTo(...q); if (close) ctx.closePath(); ctx.stroke(); };
  if (name === 'rock') {
    ctx.beginPath(); ctx.moveTo(-170, 150); ctx.bezierCurveTo(-180, -60, -100, -170, 0, -165); ctx.bezierCurveTo(110, -170, 185, -60, 170, 150); ctx.stroke();
    L([[-190, 150], [190, 150]]);
    ctx.strokeStyle = OCHRE; ctx.shadowColor = 'rgba(200,100,58,0.6)'; ctx.lineWidth = 5;
    const hunter = (x, y, s) => { ctx.beginPath(); ctx.arc(x, y - 52 * s, 9 * s, 0, 7); ctx.stroke(); L([[x, y - 42 * s], [x, y]]); L([[x, y], [x - 16 * s, y + 34 * s]]); L([[x, y], [x + 18 * s, y + 32 * s]]);
      L([[x, y - 30 * s], [x + 30 * s, y - 34 * s]]); ctx.beginPath(); ctx.arc(x + 30 * s, y - 34 * s, 26 * s, -1.3, 1.3); ctx.stroke(); L([[x + 20 * s, y - 34 * s], [x + 62 * s, y - 34 * s]]); };
    hunter(-110, 40, 1); hunter(-40, 60, .85);
    // deer
    const dx = 70 + Math.sin(t * 1.2) * 3, dy = 20; ctx.beginPath(); ctx.ellipse(dx, dy, 42, 18, 0, 0, 7); ctx.stroke();
    L([[dx - 30, dy + 12], [dx - 34, dy + 55]]); L([[dx - 14, dy + 16], [dx - 10, dy + 55]]); L([[dx + 18, dy + 15], [dx + 22, dy + 55]]); L([[dx + 32, dy + 10], [dx + 38, dy + 55]]);
    L([[dx + 38, dy - 8], [dx + 58, dy - 38]]); ctx.beginPath(); ctx.arc(dx + 62, dy - 42, 9, 0, 7); ctx.stroke(); L([[dx + 60, dy - 50], [dx + 52, dy - 80]]); L([[dx + 56, dy - 66], [dx + 44, dy - 72]]); L([[dx + 66, dy - 50], [dx + 76, dy - 78]]);
    // dancers row
    for (let k = 0; k < 4; k++) { const x = -120 + k * 34, y = -70; ctx.beginPath(); ctx.arc(x, y - 22, 6, 0, 7); ctx.stroke(); L([[x, y - 16], [x, y + 8]]); L([[x - 14, y - 12], [x + 14, y - 4]]); L([[x, y + 8], [x - 9, y + 24]]); L([[x, y + 8], [x + 9, y + 24]]); }
  } else if (name === 'bath') {
    const tw = 300, th = 170; ctx.strokeRect(-tw / 2, -th / 2, tw, th); ctx.strokeRect(-tw / 2 + 40, -th / 2 + 30, tw - 80, th - 60);
    for (let k = 0; k < 4; k++) { L([[-tw / 2 + 10 * k, -th / 2 + 30 + k * 8], [-tw / 2 + 40, -th / 2 + 30 + k * 8]]); L([[tw / 2 - 10 * k, th / 2 - 30 - k * 8], [tw / 2 - 40, th / 2 - 30 - k * 8]]); }
    ctx.lineWidth = 1.5; ctx.globalAlpha = .6; for (let j = -th / 2 - 60; j < -th / 2; j += 15) L([[-tw / 2 - 20, j], [tw / 2 + 20, j]]); for (let j = th / 2 + 15; j < th / 2 + 70; j += 15) L([[-tw / 2 - 20, j], [tw / 2 + 20, j]]);
    ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(150,200,230,0.8)'; for (let k = 0; k < 3; k++) { const y = -20 + k * 22, ph = t * 2 + k; ctx.beginPath(); for (let x = -tw / 2 + 50; x <= tw / 2 - 50; x += 6) ctx.lineTo(x, y + Math.sin(x / 18 + ph) * 4); ctx.stroke(); }
  } else if (name === 'seal') {
    ctx.beginPath(); ctx.roundRect(-160, -160, 320, 320, 26); ctx.stroke(); ctx.beginPath(); ctx.roundRect(-145, -145, 290, 290, 18); ctx.stroke();
    // glyph row
    const gx = [-100, -55, -10, 35, 80]; ctx.lineWidth = 5;
    L([[gx[0], -120], [gx[0], -80]]); L([[gx[0] + 12, -120], [gx[0] + 12, -80]]);
    ctx.beginPath(); ctx.arc(gx[1], -108, 14, 0, Math.PI); ctx.stroke(); L([[gx[2] - 14, -100], [gx[2], -122], [gx[2] + 14, -100], [gx[2], -78]], true);
    L([[gx[3] - 12, -122], [gx[3] + 12, -78]]); L([[gx[3] + 12, -122], [gx[3] - 12, -78]]); ctx.beginPath(); ctx.arc(gx[4], -100, 14, 0, 7); ctx.stroke(); L([[gx[4], -114], [gx[4], -86]]);
    // bull-like animal
    ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-90, 10); ctx.bezierCurveTo(-90, -40, 40, -45, 70, -5); ctx.bezierCurveTo(75, 30, 40, 50, -60, 45); ctx.bezierCurveTo(-90, 42, -95, 30, -90, 10); ctx.stroke();
    L([[-70, 44], [-74, 110]]); L([[-40, 46], [-38, 110]]); L([[30, 42], [28, 110]]); L([[55, 30], [60, 110]]);
    ctx.beginPath(); ctx.moveTo(70, -5); ctx.lineTo(110, -30); ctx.lineTo(118, 0); ctx.lineTo(85, 15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(108, -28); ctx.quadraticCurveTo(150, -80, 112, -105); ctx.stroke();
    L([[-90, 15], [-118, 55]]); // tail
    ctx.lineWidth = 3; ctx.strokeRect(70, 80, 50, 34); L([[75, 92], [115, 92]]); L([[75, 102], [115, 102]]); // manger
  } else if (name === 'pillar') {
    ctx.beginPath(); ctx.moveTo(-34, 175); ctx.lineTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(34, 175); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.bezierCurveTo(-60, -10, -55, -45, -45, -50); ctx.lineTo(45, -50); ctx.bezierCurveTo(55, -45, 60, -10, 26, 0); ctx.stroke();
    ctx.strokeRect(-70, -78, 140, 28); ctx.beginPath(); ctx.arc(0, -64, 11, 0, 7); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; L([[Math.cos(a) * 3, -64 + Math.sin(a) * 3], [Math.cos(a) * 11, -64 + Math.sin(a) * 11]]); }
    const lion = (x, f) => { ctx.beginPath(); ctx.moveTo(x - 28 * f, -78); ctx.lineTo(x - 26 * f, -120); ctx.quadraticCurveTo(x - 10 * f, -150, x + 6 * f, -140); ctx.lineTo(x + 26 * f, -138); ctx.lineTo(x + 24 * f, -122); ctx.lineTo(x + 8 * f, -118); ctx.lineTo(x + 6 * f, -78); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 6 * f, -126, 20, 0, 7); ctx.stroke(); };
    lion(-38, -1); lion(38, 1); lion(0, 1);
    ctx.lineWidth = 2; ctx.globalAlpha = .5; for (let y = 30; y < 170; y += 28) L([[-28, y], [28, y]]);
  } else if (name === 'coin') {
    ctx.strokeStyle = SILVER; ctx.shadowColor = 'rgba(220,225,230,0.5)';
    ctx.beginPath(); ctx.moveTo(-150, -95); ctx.lineTo(140, -110); ctx.lineTo(158, 90); ctx.lineTo(-138, 112); ctx.closePath(); ctx.stroke();
    // sun
    ctx.beginPath(); ctx.arc(-70, -30, 26, 0, 7); ctx.stroke(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; L([[-70 + Math.cos(a) * 32, -30 + Math.sin(a) * 32], [-70 + Math.cos(a) * 46, -30 + Math.sin(a) * 46]]); }
    // six-armed symbol
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + t * .2; const x2 = 55 + Math.cos(a) * 42, y2 = -30 + Math.sin(a) * 42; L([[55, -30], [x2, y2]]); ctx.beginPath(); ctx.arc(x2, y2, 9, 0, 7); ctx.stroke(); }
    // hill
    L([[-90, 75], [-60, 35], [-30, 75]]); L([[-60, 75], [-30, 35], [0, 75]]); L([[-30, 75], [-60, 50], [-90, 75]]); L([[-100, 75], [10, 75]]);
    // tree
    L([[80, 80], [80, 30]]); ctx.beginPath(); ctx.arc(80, 18, 20, 0, 7); ctx.stroke(); L([[80, 50], [60, 36]]); L([[80, 46], [100, 34]]);
  } else if (name === 'scroll') {
    for (let k = 0; k < 4; k++) { const y = -100 + k * 62, x0 = -175 + k * 6; ctx.beginPath(); ctx.roundRect(x0, y, 340, 46, 14); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + 120, y + 23, 5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x0 + 220, y + 23, 5, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; for (let j = 0; j < 2; j++) { ctx.beginPath(); for (let x = x0 + 18; x < x0 + 320; x += 12) { if (Math.abs(x - x0 - 120) < 10 || Math.abs(x - x0 - 220) < 10) { ctx.moveTo(x + 12, y + 15 + j * 15); continue; } ctx.lineTo(x, y + 15 + j * 15 + ((x * 7 + k * 3 + j) % 5 - 2)); } ctx.stroke(); } ctx.lineWidth = 4; }
    L([[-55, -120], [-55, 170]]); L([[45, -120], [45, 170]]); ctx.lineWidth = 2;
  } else if (name === 'magnifier') {
    ctx.beginPath(); ctx.arc(-25, -25, 95, 0, 7); ctx.stroke(); ctx.lineWidth = 16; L([[45, 45], [130, 130]]); ctx.lineWidth = 3; ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(-25, -25, 70, 3.6, 4.6); ctx.stroke();
  } else if (name === 'compass') {
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 100, 0, 7); ctx.stroke(); ctx.rotate(Math.sin(t * .8) * .15);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); L([[0, -150], [16, 0], [-16, 0]], true); }
  } else if (name === 'puzzle') {
    const g = 1 - eio(clamp(p * 1.4 - .2)); const pcs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    pcs.forEach(([sx, sy]) => { ctx.save(); ctx.translate(sx * (75 + g * 70), sy * (75 + g * 70)); ctx.rotate(sx * sy * g * .4); ctx.strokeRect(-72, -72, 144, 144);
      ctx.beginPath(); ctx.arc(sx < 0 ? 72 : -72, 0, 18, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, sy < 0 ? 72 : -72, 18, 0, 7); ctx.stroke(); ctx.restore(); });
  }
  ctx.restore();
}

// ---------- drawing ----------
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
function landPath() { ctx.beginPath(); for (const r of rings) { ctx.moveTo(...r[0]); for (const p of r) ctx.lineTo(...p); ctx.closePath(); } }
function camAt(seg, u) { const prev = seg.i > 0 ? S[seg.i - 1].cam : OV, cur = S[seg.i].cam; const k = eio(prog(u, 0, 1.6)); return { x: lerp(prev.c[0], cur.c[0], k), y: lerp(prev.c[1], cur.c[1], k), z: lerp(prev.z, cur.z, k) }; }
function mapAlpha(seg, u) { const prev = seg.i > 0 ? S[seg.i - 1].map : 0; return lerp(prev, S[seg.i].map, eio(prog(u, 0, .9))); }
const firstMark = {}; // first segment index where a site mark appears
for (const s of SEG) for (const m of (S[s.i].marks || [])) if (!(m in firstMark)) firstMark[m] = s.i;
const firstEdict = SEG.find(s => S[s.i].edicts).i;

function drawMap(seg, u, t, a) {
  if (a <= 0.003) return; const c = camAt(seg, u); const sp = S[seg.i];
  const toS = ([x, y]) => [W / 2 + (x - c.x) * c.z, H / 2 + (y - c.y) * c.z];
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
  landPath(); const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 600); g.addColorStop(0, '#6b4a22'); g.addColorStop(1, '#2e1f10'); ctx.fillStyle = g; ctx.fill('evenodd');
  const dp = S[seg.i].draw ? eio(prog(u, 0, 2.8)) : 1;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5 / c.z; ctx.shadowColor = GOLD; ctx.shadowBlur = 14; ctx.lineJoin = 'round';
  rings.forEach((r, i) => { ctx.beginPath(); ctx.moveTo(...r[0]); for (const q of r) ctx.lineTo(...q); ctx.closePath(); if (dp < 1) ctx.setLineDash([ringLen[i] * dp, ringLen[i] + 10]); ctx.stroke(); }); ctx.setLineDash([]); ctx.shadowBlur = 0;
  // route
  const ROUTES = sp.routes || (sp.route ? [sp.route] : []);
  ROUTES.forEach((route, ri) => { const pts = [route.from, ...route.via, route.to].map(P); const rp = eio(prog(u, .6 + ri * 1.1, 3.0 + ri * 1.1));
    let tot = 0; const seglen = pts.slice(1).map((q, k) => { const d = Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]); tot += d; return d; });
    ctx.strokeStyle = CREAM; ctx.lineWidth = 3 / c.z; ctx.setLineDash([10 / c.z, 8 / c.z]); ctx.lineDashOffset = -t * 30 / c.z;
    ctx.save(); ctx.beginPath(); let rem = tot * rp; ctx.moveTo(...pts[0]); let head = pts[0], dir = [1, 0];
    for (let k = 1; k < pts.length && rem > 0; k++) { const d = seglen[k - 1], f = Math.min(1, rem / d); head = [lerp(pts[k - 1][0], pts[k][0], f), lerp(pts[k - 1][1], pts[k][1], f)]; dir = [(pts[k][0] - pts[k - 1][0]) / d, (pts[k][1] - pts[k - 1][1]) / d]; ctx.lineTo(...head); rem -= d; }
    ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
    if (rp > .02) { ctx.fillStyle = CREAM; ctx.save(); ctx.translate(...head); ctx.rotate(Math.atan2(dir[1], dir[0])); const s = 1 / c.z; ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(-10 * s, 9 * s); ctx.lineTo(-10 * s, -9 * s); ctx.closePath(); ctx.fill(); ctx.restore(); }
  });
  // edicts
  if (sp.edicts) EDICTS.forEach((e, k) => { const st = seg.i === firstEdict ? .5 + k * .22 : -1; const ea = prog(u, st, st + .4); if (!ea) return; const [x, y] = P(e);
    ctx.fillStyle = `rgba(255,236,200,${ea})`; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); const s = 5.5 / c.z * (1 + (1 - eout(ea)) * 2); ctx.fillRect(-s, -s, 2 * s, 2 * s); ctx.restore(); });
  // marks
  for (const m of (sp.marks || [])) { const [x, y] = P(SITES[m].ll); const k = (sp.marks || []).indexOf(m);
    const st = firstMark[m] === seg.i ? (sp.stagger ? (seg.i === NI + 2 ? 2.4 + k * .45 : .5 + k * seg.speak / 7) : .9) : -1; const ma = prog(u, st, st + .6); if (!ma) continue;
    const R = 60 / Math.sqrt(c.z); const pulse = 1 + .08 * Math.sin(t * 2.4 + k);
    const gl = ctx.createRadialGradient(x, y, 0, x, y, R * pulse); gl.addColorStop(0, `rgba(255,200,110,${.8 * ma})`); gl.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x, y, 7 / c.z, 0, 7); ctx.fill(); }
  ctx.restore();
  // labels (screen space)
  if (sp.labels) for (const [m, sub] of Object.entries(sp.labels)) { const la = prog(u, 1.2, 1.8) * a; const [sx, sy] = toS(P(SITES[m].ll));
    const right = sx < W * .62 && !(sp.ov && (sp.ov.t === 'fact' || sp.ov.t === 'icon')); const lx = sx + (right ? 44 : -44), al = right ? 'left' : 'right';
    text(ctx, SITES[m].n, lx, sy - (sub ? 18 : 0), '52px Playfair', CREAM, al, la, { glow: '#000', blur: 18 });
    if (sub) text(ctx, sub.toUpperCase(), lx, sy + 30, '24px InterB', GOLD, al, la, { spacing: '5px', glow: '#000', blur: 12 }); }
  (sp.routes || (sp.route ? [sp.route] : [])).forEach((route, ri) => { const [sx, sy] = toS(P(route.labAt === 'to' ? route.to : route.from)); text(ctx, route.lab, Math.min(W - 420, Math.max(80, sx - (route.labAt === 'to' ? 120 : 0))), sy + (route.labAt === 'to' ? 40 : -34), '24px InterB', CREAM, 'left', prog(u, .4 + ri * 1.1, 1.0 + ri * 1.1) * a, { spacing: '5px', glow: '#000', blur: 12 }); });
  if (sp.geo) sp.geo.forEach(([n, ll], k) => { const [sx, sy] = toS(P(ll)); const ga = prog(u, .3 + k * seg.speak / 9, .9 + k * seg.speak / 9) * a; const water = /SEA|OCEAN|BAY/.test(n);
    text(ctx, n, sx, sy, (water ? 'italic 30px PlayfairI' : '22px InterB'), water ? 'rgba(243,230,204,0.75)' : CREAM, 'center', ga, { spacing: water ? '2px' : '6px', glow: '#000', blur: 14 }); });
  if (sp.labelsAll) (sp.marks || []).forEach((m, k) => { const [sx, sy] = toS(P(SITES[m].ll)); const la = prog(u, .9 + k * seg.speak / 7, 1.4 + k * seg.speak / 7) * a; text(ctx, SITES[m].n, sx + 34, sy, '36px Playfair', CREAM, 'left', la, { glow: '#000', blur: 14 }); });
}

function drawOverlay(seg, u) {
  const sp = S[seg.i], ov = sp.ov; if (!ov) return; const D = seg.dur, out = 1 - prog(u, D - .35, D);
  const inn = prog(u, .1, .7); const a = Math.min(inn, out);
  if (ov.t === 'hook') ov.lines.forEach((s, k) => { const st = k * seg.speak * .3; const la = Math.min(prog(u, st, st + .6), out); const sc = 1 + .04 * prog(u, 0, D);
    ctx.save(); ctx.translate(W / 2, 400 + k * 110); ctx.scale(sc, sc); text(ctx, s, 0, 0, '68px Playfair', CREAM, 'center', la, { glow: 'rgba(227,180,95,0.6)', blur: 30 }); ctx.restore(); });
  else if (ov.t === 'bigq') { const qa = Math.min(inn, sp.sting ? 1 - prog(u, seg.speak, seg.speak + .4) : out);
    ov.lines.forEach((s, k) => text(ctx, s, W / 2, H / 2 - 40 + k * 84 - (ov.lines.length - 1) * 2, 'italic 64px PlayfairI', GOLD, 'center', qa, { glow: 'rgba(227,180,95,0.7)', blur: 35 }));
    if (sp.sting) { const su = u - seg.speak - .3; const e = prog(su, 0, .8), eo = 1 - prog(u, D - .5, D);
      text(ctx, 'INDIA: THE FULL STORY  \u00b7  EPISODE ONE', W / 2, 400, '30px InterB', GOLD, 'center', Math.min(e, eo), { spacing: '12px' });
      const ts = prog(su, .3, 3.5); ctx.save(); ctx.translate(W / 2, 520); const z = 1.08 - .08 * eout(ts); ctx.scale(z, z);
      text(ctx, 'Sources of Indian History', 0, 0, '104px Playfair', CREAM, 'center', Math.min(prog(su, .3, 1.2), eo), { glow: 'rgba(227,180,95,0.6)', blur: 40 }); ctx.restore();
      text(ctx, 'How do we know India’s past?', W / 2, 640, 'italic 42px PlayfairI', GOLD, 'center', Math.min(prog(su, 1.0, 1.8), eo)); } }
  else if (ov.t === 'kicker') { text(ctx, ov.s, 120, LB + 60, '26px InterB', GOLD, 'left', a, { spacing: '7px', glow: '#000', blur: 10 });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = GOLD; ctx.fillRect(120, LB + 86, 90 * eout(inn), 3); ctx.restore(); }
  else if (ov.t === 'title') { text(ctx, ov.k, W / 2, 330, '28px InterB', GOLD, 'center', a, { spacing: '14px' });
    ctx.save(); ctx.translate(W / 2, 570); ctx.scale(.62, .62); ctx.globalAlpha = a * .9; icon(ctx, ov.icon, prog(u, .2, 1.4), u); ctx.restore();
    const ts = prog(u, .2, D); ctx.save(); ctx.translate(W / 2, 420); const z = 1.06 - .06 * eout(ts); ctx.scale(z, z); text(ctx, ov.s, 0, 0, '96px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.55)', blur: 36 }); ctx.restore(); }
  else if (ov.t === 'split') { const l = Math.min(prog(u, .4, 1.1), out), r = Math.min(prog(u, seg.speak * .55, seg.speak * .55 + .7), out);
    [['ARCHAEOLOGICAL', 'What people left behind', 'magnifier', W * .3, l], ['LITERARY', 'What people wrote down', 'scroll', W * .7, r]].forEach(([k, s, ic, x, al]) => {
      ctx.save(); ctx.translate(x, 470); ctx.scale(.7, .7); ctx.globalAlpha = al; icon(ctx, ic, al, u); ctx.restore();
      text(ctx, k, x, 690, '34px InterB', GOLD, 'center', al, { spacing: '9px' }); text(ctx, s, x, 750, 'italic 40px PlayfairI', CREAM, 'center', al); });
    ctx.save(); ctx.globalAlpha = Math.min(l, out) * .5; ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 1, 330, 2, 460 * eout(l)); ctx.restore(); }
  else if (ov.t === 'icon') { const ia = ov.cont ? out : a; const ip = ov.cont ? 1 : prog(u, .1, 1.6); const cx = ov.center ? W / 2 : W * .72, cy = ov.center ? 470 : 470;
    if (!ov.center) { ctx.save(); ctx.globalAlpha = ia * .55; const g = ctx.createLinearGradient(W * .48, 0, W, 0); g.addColorStop(0, 'rgba(10,7,5,0)'); g.addColorStop(.25, 'rgba(10,7,5,0.85)'); g.addColorStop(1, 'rgba(10,7,5,0.95)'); ctx.fillStyle = g; ctx.fillRect(W * .48, 0, W * .52, H); ctx.restore(); }
    ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = ia; icon(ctx, ov.icon, ip, u); ctx.restore();
    const capA = Math.min(prog(u, ov.cont ? 0 : .6, ov.cont ? .5 : 1.2), out); const ty = ov.center ? 780 : 740;
    text(ctx, ov.cap, cx, ty, '58px Playfair', CREAM, 'center', capA, { glow: 'rgba(227,180,95,0.4)', blur: 24 });
    if (ov.sub) text(ctx, ov.sub.toUpperCase(), cx, ty + 60, '24px InterB', GOLD, 'center', capA, { spacing: '5px' }); }
  else if (ov.t === 'fact') { const fx = W * .74; ctx.save(); ctx.globalAlpha = a * .6; const g = ctx.createLinearGradient(W * .5, 0, W, 0); g.addColorStop(0, 'rgba(10,7,5,0)'); g.addColorStop(.3, 'rgba(10,7,5,0.8)'); g.addColorStop(1, 'rgba(10,7,5,0.9)'); ctx.fillStyle = g; ctx.fillRect(W * .5, 0, W * .5, H); ctx.restore();
    const z = 1.15 - .15 * eout(prog(u, .1, .9)); ctx.save(); ctx.translate(fx, 480); ctx.scale(z, z); text(ctx, ov.big, 0, 0, '170px Playfair', GOLD, 'center', a, { glow: 'rgba(227,180,95,0.6)', blur: 40 }); ctx.restore();
    text(ctx, ov.small.toUpperCase(), fx, 610, '28px InterB', CREAM, 'center', Math.min(prog(u, .5, 1.1), out), { spacing: '6px' });
    if (ov.brahmi) { const ba = Math.min(prog(u, 1.0, 2.2), out); ctx.save(); ctx.globalAlpha = ba; ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.translate(fx - 210, 700);
      const G = [[[0, 0], [0, 50]], [[30, 0], [30, 50], [55, 50]], [[80, 25], [105, 0], [130, 25], [105, 50], [80, 25]], [[155, 0], [155, 50]], [[155, 25], [180, 25]], [[205, 50], [205, 0], [230, 25], [255, 0], [255, 50]], [[280, 0], [305, 50], [330, 0]], [[355, 0], [380, 0], [380, 50], [355, 50]], [[405, 0], [420, 50]]];
      G.forEach(g => { ctx.beginPath(); ctx.moveTo(...g[0]); for (const q of g.slice(1)) ctx.lineTo(...q); ctx.stroke(); }); ctx.restore();
      text(ctx, 'BRAHMI SCRIPT', fx, 790, '20px InterB', GOLD, 'center', ba * .8, { spacing: '6px' }); } }
  else if (ov.t === 'stats') ov.items.forEach(([big, small], k) => { const x = W * (.2 + k * .3), st = .2 + k * seg.speak * .27; const sa = Math.min(prog(u, st, st + .6), out); const z = 1.12 - .12 * eout(prog(u, st, st + .8));
      ctx.save(); ctx.translate(x, 500); ctx.scale(z, z); text(ctx, big, 0, 0, '70px Playfair', GOLD, 'center', sa, { glow: 'rgba(227,180,95,0.6)', blur: 36 }); ctx.restore();
      text(ctx, small, x, 590, '26px InterB', CREAM, 'center', sa, { spacing: '7px' }); })
  else if (ov.t === 'timeline') { const x0 = 170, x1 = W - 170, y = 560, n = ov.items.length; const span = seg.speak * .78;
    const lp = eio(prog(u, .1, span + .5)); ctx.save(); ctx.globalAlpha = out; ctx.fillStyle = 'rgba(227,180,95,0.35)'; ctx.fillRect(x0, y - 1, x1 - x0, 2); ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 12; ctx.fillRect(x0, y - 2, (x1 - x0) * lp, 4); ctx.restore();
    text(ctx, 'THE JOURNEY AHEAD', W / 2, 300, '28px InterB', GOLD, 'center', a, { spacing: '14px' });
    ov.items.forEach((s, k) => { const x = x0 + (x1 - x0) * k / (n - 1), st = .3 + span * k / (n - 1); const na = Math.min(prog(u, st, st + .5), out); const up = k % 2 === 0;
      ctx.save(); ctx.globalAlpha = na; ctx.fillStyle = '#fff3d6'; ctx.shadowColor = GOLD; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(x, y, 10 * (1 + (1 - eout(na)) * 1.5), 0, 7); ctx.fill(); ctx.restore();
      text(ctx, s, x, up ? y - 60 : y + 60, '40px Playfair', CREAM, 'center', na, { glow: 'rgba(227,180,95,0.4)', blur: 20 }); }); }
  else if (ov.t === 'brand') { text(ctx, 'WELCOME TO', W / 2, 360, '30px InterB', GOLD, 'center', a, { spacing: '16px' });
    const z = 1.1 - .1 * eout(prog(u, .1, D)); ctx.save(); ctx.translate(W / 2, 500); ctx.scale(z, z); text(ctx, 'India: The Full Story', 0, 0, '132px Playfair', CREAM, 'center', Math.min(prog(u, .3, 1.3), out), { glow: 'rgba(227,180,95,0.7)', blur: 50 }); ctx.restore();
    const rl = eout(prog(u, 1.0, 2.0)); ctx.save(); ctx.globalAlpha = out; ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 220 * rl, 600, 440 * rl, 3); ctx.restore();
    text(ctx, 'Indian history, from the very beginning', W / 2, 665, 'italic 46px PlayfairI', GOLD, 'center', Math.min(prog(u, 1.4, 2.2), out)); }
  else if (ov.t === 'quiz') { text(ctx, `QUESTION ${ov.n} OF 3`, W / 2, 230, '26px InterB', GOLD, 'center', a, { spacing: '10px' });
    const ql = wrap(ctx, ov.q, '60px Playfair', 1400); ql.forEach((s, k) => text(ctx, s, W / 2, 320 + k * 72, '60px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.4)', blur: 24 }));
    ov.o.forEach((s, k) => { const oa = Math.min(prog(u, .8 + k * .25, 1.3 + k * .25), out); const x = W / 2 + (k % 2 ? 30 : -630), y = 520 + Math.floor(k / 2) * 130;
      ctx.save(); ctx.globalAlpha = oa; ctx.strokeStyle = 'rgba(227,180,95,0.7)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(30,20,10,0.75)'; ctx.beginPath(); ctx.roundRect(x, y, 600, 100, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x + 55, y + 50, 28, 0, 7); ctx.fill(); ctx.restore();
      text(ctx, 'ABCD'[k], x + 55, y + 52, '30px InterB', '#1a1108', 'center', oa); text(ctx, s, x + 105, y + 52, '38px InterM', CREAM, 'left', oa); });
    const tu = u - seg.speak, tl = 5; if (tu > 0) { const rem = clamp(1 - tu / tl); const ta = Math.min(prog(tu, 0, .3), out); const cx = W / 2, cy = 860;
      ctx.save(); ctx.globalAlpha = ta; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(227,180,95,0.2)'; ctx.beginPath(); ctx.arc(cx, cy, 44, 0, 7); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + rem * Math.PI * 2); ctx.stroke(); ctx.restore();
      text(ctx, String(Math.max(0, Math.ceil(tl - tu))), cx, cy + 2, '40px InterB', CREAM, 'center', ta); } }
  else if (ov.t === 'end') { text(ctx, 'NEXT ON INDIA: THE FULL STORY', W / 2, 330, '28px InterB', GOLD, 'center', a, { spacing: '14px' });
    const z = 1.06 - .06 * eout(prog(u, .2, D)); ctx.save(); ctx.translate(W / 2, 440); ctx.scale(z, z); text(ctx, 'The First Humans in India', 0, 0, '92px Playfair', CREAM, 'center', a, { glow: 'rgba(227,180,95,0.55)', blur: 36 }); ctx.restore();
    const ba = Math.min(prog(u, 1.5, 2.2), out); const pulse = 1 + .04 * Math.sin(u * 4); ctx.save(); ctx.globalAlpha = ba; ctx.translate(W / 2, 620); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#b8282a'; ctx.beginPath(); ctx.roundRect(-190, -48, 380, 96, 48); ctx.fill(); ctx.restore(); text(ctx, 'SUBSCRIBE', W / 2, 622, '40px InterB', '#fff', 'center', ba, { spacing: '6px' });
    text(ctx, 'Indian history, from the very beginning', W / 2, 740, 'italic 38px PlayfairI', GOLD, 'center', ba); }
}

function subtitles(seg, u) { if (u > seg.speak + .15) return; const a = Math.min(prog(u, 0, .2), 1 - prog(u, seg.speak, seg.speak + .15));
  const ls = wrap(ctx, seg.txt, '30px InterM', 1600); const y0 = H - LB / 2 - (ls.length - 1) * 19; ls.forEach((s, k) => text(ctx, s, W / 2, y0 + k * 38, '30px InterM', CREAM, 'center', a * .92)); }

function segAt(t) { let s = SEG[0]; for (const x of SEG) if (t >= x.start) s = x; return s; }
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(bg, 0, 0);
  const seg = segAt(Math.max(t, SEG[0].start)), u = t - seg.start;
  drawMap(seg, u, t, mapAlpha(seg, u));
  drawOverlay(seg, u);
  for (const d of DUST) { const y = (d.y - t * d.v + H * 100) % H; ctx.fillStyle = `rgba(255,220,160,${d.a * .5})`; ctx.beginPath(); ctx.arc(d.x + Math.sin(t + d.y) * 10, y, d.s, 0, 7); ctx.fill(); }
  ctx.drawImage(vign, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, LB); ctx.fillRect(0, H - LB, W, LB);
  { const wa = .75 * Math.min(prog(t, SEG[NI].start, SEG[NI].start + 1), 1); if (wa > 0) { text(ctx, 'INDIA: THE FULL STORY', 60, LB / 2, '20px InterB', GOLD, 'left', wa, { spacing: '6px' }); text(ctx, 'EPISODE 1  \u00b7  SOURCES OF INDIAN HISTORY', W - 60, LB / 2, '20px InterB', 'rgba(243,230,204,0.8)', 'right', wa, { spacing: '5px' }); } }
  if (t >= SEG[0].start) subtitles(seg, u);
  const fi = Math.min(1, t / .8, (TOTAL - t) / 1.0); if (fi < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fi})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- main ----------
const arg = process.argv[2] || 'full';
if (arg === 'stills') { fs.mkdirSync('stills2', { recursive: true }); const pts = process.argv[3].split(',');
  for (const p of pts) { const [i, f] = p.split(':').map(Number); const s = SEG[i]; const t = s.start + s.dur * f; frame(t); fs.writeFileSync(`stills2/s${i}_${f}.jpg`, canvas.toBuffer('image/jpeg', 85)); } }
else { // render chunk: node ep1.mjs chunk k n
  const k = +process.argv[3], n = +process.argv[4]; const NF = Math.ceil(TOTAL * FPS); const a = Math.floor(NF * k / n), b = Math.floor(NF * (k + 1) / n);
  fs.mkdirSync('parts', { recursive: true }); const tmp = `parts/p${k}.part.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', `${FPS}`, '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) { frame(f / FPS); if (!ff.stdin.write(Buffer.from(canvas.data()))) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); ff.on('close', c => { if (c === 0) fs.renameSync(tmp, `parts/p${k}.mp4`); console.log('chunk', k, c, (b - a) + ' frames'); });
}
console.error('TOTAL', TOTAL.toFixed(2));
