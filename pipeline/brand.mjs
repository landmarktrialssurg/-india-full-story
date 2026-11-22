import fs from 'fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { geoMercator } from 'd3-geo';
const F = 'node_modules/@fontsource/';
const reg = (pkg, w, name, st = 'normal') => GlobalFonts.registerFromPath(`${F}${pkg}/files/${pkg}-latin-${w}-${st}.woff2`, name);
reg('inter', 700, 'InterB'); reg('playfair-display', 700, 'Playfair'); reg('playfair-display', 400, 'PlayfairI', 'italic');
const GOLD = '#e3b45f', CREAM = '#f3e6cc';
const land = JSON.parse(fs.readFileSync('land.json'));
const geo = { type: 'MultiPolygon', coordinates: [...land.main, ...land.lanka].map(r => [r]) };
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function bg(ctx, W, H, cx, cy) {
  const img = ctx.createImageData(W, H); const r = rng(11);
  for (let i = 0; i < W * H; i++) { const n = (r() - .5) * 10; img.data[i * 4] = 22 + n; img.data[i * 4 + 1] = 16 + n; img.data[i * 4 + 2] = 12 + n; img.data[i * 4 + 3] = 255; } ctx.putImageData(img, 0, 0);
  const v = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(W, H) * .6); v.addColorStop(0, 'rgba(110,70,25,0.45)'); v.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const d = rng(5); for (let i = 0; i < W * H / 9000; i++) { ctx.fillStyle = `rgba(255,220,160,${.1 + d() * .35})`; ctx.beginPath(); ctx.arc(d() * W, d() * H, .5 + d() * 2.2 * (W / 1920), 0, 7); ctx.fill(); }
}
function map(ctx, box, lw, glow) {
  const proj = geoMercator().fitExtent(box, geo); ctx.beginPath();
  for (const r of [...land.main, ...land.lanka]) { const p = r.map(q => proj(q)); ctx.moveTo(...p[0]); for (const q of p) ctx.lineTo(...q); ctx.closePath(); }
  const [[x0, y0], [x1, y1]] = box; const g = ctx.createRadialGradient((x0 + x1) / 2, (y0 + y1) / 2, 10, (x0 + x1) / 2, (y0 + y1) / 2, (y1 - y0) * .6);
  g.addColorStop(0, '#7a5428'); g.addColorStop(1, '#2e1f10'); ctx.fillStyle = g; ctx.fill('evenodd');
  ctx.strokeStyle = GOLD; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.shadowColor = GOLD; ctx.shadowBlur = glow; ctx.stroke(); ctx.stroke(); ctx.shadowBlur = 0;
  return proj;
}
function text(ctx, s, x, y, font, color, o = {}) { ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  if (o.spacing) ctx.letterSpacing = o.spacing; if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 30; } ctx.fillText(s, x, y); ctx.restore(); }
function sites(ctx, proj, R, list) { for (const ll of list) { const [x, y] = proj(ll); const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(255,200,110,0.85)'); g.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x, y, R * .14, 0, 7); ctx.fill(); } }
const SITES = [[68.14, 27.33], [72.86, 30.63], [77.61, 22.94], [83.02, 25.38], [79.82, 11.9]];
fs.mkdirSync('brand', { recursive: true });

// ---------- PROFILE PICTURE 800x800 (shown as a circle) ----------
for (const variant of ['map', 'monogram']) {
  const S = 800, c = createCanvas(S, S), ctx = c.getContext('2d'); bg(ctx, S, S, S / 2, S / 2);
  // ring
  ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.shadowColor = GOLD; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(S / 2, S / 2, 340, 0, 7); ctx.stroke();
  ctx.lineWidth = 2; ctx.shadowBlur = 0; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(S / 2, S / 2, 318, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, r0 = 326, r1 = k % 6 ? 332 : 338; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); ctx.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); ctx.stroke(); } ctx.globalAlpha = 1;
  if (variant === 'map') { const p = map(ctx, [[S / 2 - 200, 130], [S / 2 + 200, 670]], 5, 22); sites(ctx, p, 34, SITES); }
  else { const p = map(ctx, [[S / 2 - 210, 120], [S / 2 + 210, 680]], 3, 10); ctx.fillStyle = 'rgba(15,10,6,0.55)'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 318, 0, 7); ctx.fill();
    text(ctx, 'IFS', S / 2, S / 2 - 10, '230px Playfair', CREAM, { glow: 'rgba(227,180,95,0.8)', blur: 40, spacing: '6px' });
    ctx.fillStyle = GOLD; ctx.fillRect(S / 2 - 120, S / 2 + 110, 240, 4); text(ctx, 'INDIA · THE FULL STORY', S / 2, S / 2 + 160, '30px InterB', GOLD, { spacing: '5px' }); }
  fs.writeFileSync(`brand/Profile_${variant}.png`, c.toBuffer('image/png'));
}

// ---------- BANNER 2560x1440 (safe area 1546x423 centred) ----------
{ const W = 2560, H = 1440, c = createCanvas(W, H), ctx = c.getContext('2d'); bg(ctx, W, H, W * .5, H * .5);
  // big faint map on the right, extends beyond safe area
  ctx.save(); ctx.globalAlpha = .9; const p = map(ctx, [[1830, 200], [2520, 1260]], 4, 26); sites(ctx, p, 55, SITES); ctx.restore();
  // fade map toward the text
  const fg = ctx.createLinearGradient(1350, 0, 1900, 0); fg.addColorStop(0, 'rgba(15,10,6,0.9)'); fg.addColorStop(1, 'rgba(15,10,6,0)'); 
  // dashed route lines (travellers) from left edge
  ctx.strokeStyle = 'rgba(243,230,204,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(0, 560); ctx.bezierCurveTo(500, 520, 900, 470, 1250, 500); ctx.stroke(); ctx.setLineDash([]);
  const sx = W / 2 - 773, sy = H / 2 - 211; // safe area top-left (1546 x 423)
  const tx = sx + 60;
  text(ctx, 'INDIAN HISTORY · FROM THE VERY BEGINNING', tx, sy + 62, '30px InterB', GOLD, { align: 'left', spacing: '9px' });
  text(ctx, 'India: The Full Story', tx - 4, sy + 175, '128px Playfair', CREAM, { align: 'left', glow: 'rgba(227,180,95,0.6)', blur: 45 });
  ctx.fillStyle = GOLD; ctx.fillRect(tx, sy + 255, 160, 4);
  text(ctx, 'Prehistoric  ·  Ancient  ·  Medieval  ·  Mughal  ·  British', tx, sy + 305, 'italic 42px PlayfairI', GOLD, { align: 'left' });
  text(ctx, 'NEW EPISODES EVERY MONDAY & THURSDAY', tx, sy + 375, '26px InterB', CREAM, { align: 'left', spacing: '7px' });
  // letterbox-style thin gold rules at safe-area edges (subtle)
  ctx.globalAlpha = .35; ctx.fillStyle = GOLD; ctx.fillRect(0, sy - 30, W, 2); ctx.fillRect(0, sy + 453, W, 2); ctx.globalAlpha = 1;
  fs.writeFileSync('brand/Banner_2560x1440.png', c.toBuffer('image/png'));
  // preview with safe-area guides
  ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.setLineDash([20, 12]); ctx.strokeRect(sx, sy, 1546, 423); ctx.strokeStyle = '#3bb0ff'; ctx.strokeRect(0, sy, W, 423);
  fs.writeFileSync('brand/preview_guides.jpg', c.toBuffer('image/jpeg', 80));
}
console.log('ok');
