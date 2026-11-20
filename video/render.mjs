// Renders video/stage.html frame by frame (deterministic) and encodes it.
// Usage:
//   node video/render.mjs                      full video → video/out/elife-hub-demo.mp4 (or .webm without system ffmpeg)
//   node video/render.mjs --stills 3,27,50     PNG stills at these seconds → video/out/stills/
//   node video/render.mjs --fps 30 --to 40     faster draft (lower frame rate, partial)
//   node video/render.mjs --audio-only         soundtrack only → video/out/soundtrack.wav
// Env: PLAYWRIGHT_PATH, CHROME_PATH (same as tests/e2e.mjs). Needs no network except Google Fonts.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(HERE, 'out');
const PW = process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), '.npm/_npx/705bc6b22212b352/node_modules/playwright');
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome')].find((p) => fs.existsSync(p));
const { chromium } = require(PW);

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const STILLS = arg('stills') ? arg('stills').split(',').map(Number) : null;
const fpsOut = +arg('fps', 60);
fs.mkdirSync(OUT, { recursive: true });

/* static server for the repo (the stage loads ../index.html in an iframe) */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.xlsx': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const URL = `http://127.0.0.1:${server.address().port}/video/stage.html`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.evaluate(() => window.stageReady);
const V = await page.evaluate(() => window.VIDEO);
const stage = await page.$('#stage');
const step = Math.round(V.FPS / fpsOut); // render every frame (events stay exact), capture one in `step`
const last = Math.min(V.FRAMES, Math.round(+arg('to', V.DURATION) * V.FPS));
const cues = { duration: last / V.FPS, clicks: V.clicks.filter((c) => c < last / V.FPS), wipes: V.wipes.filter((w) => w < last / V.FPS), scenes: V.scenes };
fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(cues, null, 1));
const WAV = path.join(OUT, 'soundtrack.wav');
if (!STILLS) {
  await page.addScriptTag({ path: path.join(HERE, 'audio.js') });
  const b64 = await page.evaluate((c) => window.renderAudio(c), cues);
  fs.writeFileSync(WAV, Buffer.from(b64, 'base64'));
  console.log('Bande son :', path.relative(ROOT, WAV));
  if (process.argv.includes('--audio-only')) { await browser.close(); server.close(); process.exit(0); }
}

// CSS transitions inside the app follow the video clock: slow them down to the capture speed.
const cdp = await page.context().newCDPSession(page);
await cdp.send('Animation.enable');
const setRate = (r) => cdp.send('Animation.setPlaybackRate', { playbackRate: r });

if (STILLS) {
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  await setRate(1);
  const want = STILLS.map((s) => Math.round(s * V.FPS)).sort((a, b) => a - b);
  for (let i = 0, w = 0; i <= want[want.length - 1]; i++) {
    await page.evaluate((n) => window.renderFrame(n), i);
    if (i === want[w]) { await page.waitForTimeout(250); await stage.screenshot({ path: path.join(OUT, 'stills', `t${(i / V.FPS).toFixed(1).padStart(5, '0')}.png`) }); w++; }
  }
} else {
  const sys = spawnSync('which', ['ffmpeg']).status === 0;
  const ff = sys ? 'ffmpeg' : path.join(os.homedir(), '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux');
  const file = path.join(OUT, sys ? 'video-only.mp4' : 'elife-hub-demo-preview.webm');
  const enc = sys
    ? ['-y', '-f', 'image2pipe', '-framerate', String(fpsOut), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fpsOut), file]
    : ['-y', '-f', 'image2pipe', '-framerate', String(fpsOut), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '12M', '-qmin', '0', '-qmax', '20', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', file];
  const proc = spawn(ff, enc, { stdio: ['pipe', 'ignore', 'inherit'] });
  let t0 = Date.now(), lastCap = Date.now();
  for (let i = 0; i < last; i++) {
    await page.evaluate((n) => window.renderFrame(n), i);
    if (i % step) continue;
    const buf = await stage.screenshot({ type: 'jpeg', quality: 94 });
    if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
    const now = Date.now(), real = now - lastCap; lastCap = now;
    await setRate(Math.max(0.02, Math.min(1, (1000 / fpsOut) / Math.max(real, 1))));
    if (i % (V.FPS * 5) === 0) process.stdout.write(`  ${(i / V.FPS).toFixed(0)} s / ${(last / V.FPS).toFixed(0)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s écoulées\n`);
  }
  proc.stdin.end();
  await new Promise((r) => proc.on('close', r));
  if (sys) {
    const final = path.join(OUT, 'elife-hub-demo.mp4');
    spawnSync('ffmpeg', ['-y', '-i', file, '-i', WAV, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
    fs.rmSync(file);
    console.log('Vidéo :', path.relative(ROOT, final));
  } else console.log('Vidéo :', path.relative(ROOT, file), '(aperçu WebM sans son : installez ffmpeg pour le MP4 H.264 avec la bande son)');
}
if (errors.length) console.log('Erreurs dans la page :\n' + errors.slice(0, 10).join('\n'));
await browser.close();
server.close();
