// Renders the demo video frame by frame (deterministic) and encodes it.
// Usage:
//   node video/render.mjs                         v2 (défis 1, 2, 4, 8) → video/out/elife-hub-demo-v2.mp4 + .srt
//   node video/render.mjs --version v1            v1 (frozen in video/v1/) → video/out/elife-hub-demo-v1.mp4
//   node video/render.mjs --stills 3,27,50        PNG stills at these seconds → video/out/stills/
//   node video/render.mjs --fps 30 --to 40        faster draft (lower frame rate, partial)
//   node video/render.mjs --audio-only            soundtrack only → video/out/soundtrack-<version>.wav
//   node video/render.mjs --remux                 re-mix the audio (music + video/voice-<version>.wav if present)
//                                                 onto the last render, without rendering the frames again
// Env: PLAYWRIGHT_PATH, CHROME_PATH (same as tests/e2e.mjs). Needs ffmpeg (H.264 + AAC) for the MP4.
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
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const VERSION = arg('version', 'v2');
const STAGE = VERSION === 'v1' ? '/video/v1/stage.html' : '/video/stage.html';
const STILLS = arg('stills') ? arg('stills').split(',').map(Number) : null;
const fpsOut = +arg('fps', 60);
const F = {
  wav: path.join(OUT, `soundtrack-${VERSION}.wav`),
  voice: ['wav', 'mp3', 'm4a'].map((e) => path.join(HERE, `voice-${VERSION}.${e}`)).find((p) => fs.existsSync(p)),
  videoOnly: path.join(OUT, `video-only-${VERSION}.mp4`),
  final: path.join(OUT, `elife-hub-demo-${VERSION}.mp4`),
  srt: path.join(OUT, `elife-hub-demo-${VERSION}.srt`),
  cues: path.join(OUT, `cues-${VERSION}.json`)
};
fs.mkdirSync(OUT, { recursive: true });
const sysFfmpeg = spawnSync('which', ['ffmpeg']).status === 0;

/** Music + optional voice-over (music ducked under the voice) → final MP4. */
const mux = () => {
  if (!sysFfmpeg) { console.log('ffmpeg absent : installez-le pour produire le MP4 avec le son.'); return; }
  const args = ['-y', '-i', F.videoOnly, '-i', F.wav];
  if (F.voice) {
    args.push('-i', F.voice, '-filter_complex',
      '[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.6,asplit=2[vo][sc];[1:a][sc]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=400[duck];[duck][vo]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]',
      '-map', '0:v', '-map', '[a]');
  } else args.push('-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11');
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', F.final);
  spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('Vidéo :', path.relative(ROOT, F.final), F.voice ? `(voix off : ${path.basename(F.voice)})` : '(musique seule)');
};

if (has('remux')) {
  if (!fs.existsSync(F.videoOnly) || !fs.existsSync(F.wav)) { console.log('Lancez d’abord un rendu complet de', VERSION); process.exit(1); }
  mux(); process.exit(0);
}

const PW = process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), '.npm/_npx/705bc6b22212b352/node_modules/playwright');
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', path.join(os.homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome')].find((p) => fs.existsSync(p));
const { chromium } = require(PW);

/* static server for the repo (the stage loads the app in an iframe) */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none', '--disable-lcd-text', '--lang=fr-FR'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' } });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Africa/Tunis' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}${STAGE}`);
await page.evaluate(() => window.stageReady);
const V = await page.evaluate(() => window.VIDEO);
const stage = await page.$('#stage');
const step = Math.round(V.FPS / fpsOut);
const last = Math.min(V.FRAMES, Math.round(+arg('to', V.DURATION) * V.FPS));
const cues = { duration: last / V.FPS, clicks: V.clicks.filter((c) => c < last / V.FPS), wipes: V.wipes.filter((w) => w < last / V.FPS), scenes: V.scenes };
fs.writeFileSync(F.cues, JSON.stringify(cues, null, 1));

// subtitles (.srt) from the on-screen titles
if (V.subtitles && !STILLS) {
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  fs.writeFileSync(F.srt, V.subtitles.map((s, i) => `${i + 1}\n${ts(s.t0)} --> ${ts(s.t1)}\n${s.text}\n`).join('\n'));
  console.log('Sous-titres :', path.relative(ROOT, F.srt));
}

if (!STILLS) {
  await page.addScriptTag({ path: path.join(HERE, 'audio.js') });
  const b64 = await page.evaluate((c) => window.renderAudio(c), cues);
  fs.writeFileSync(F.wav, Buffer.from(b64, 'base64'));
  console.log('Bande son :', path.relative(ROOT, F.wav));
  if (has('audio-only')) { await browser.close(); server.close(); process.exit(0); }
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
    if (i === want[w]) { await page.waitForTimeout(250); await stage.screenshot({ path: path.join(OUT, 'stills', `${VERSION}-t${(i / V.FPS).toFixed(1).padStart(5, '0')}.png`) }); w++; }
  }
} else {
  const ff = sysFfmpeg ? 'ffmpeg' : path.join(os.homedir(), '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux');
  const file = sysFfmpeg ? F.videoOnly : path.join(OUT, `elife-hub-demo-${VERSION}-preview.webm`);
  const enc = sysFfmpeg
    ? ['-y', '-f', 'image2pipe', '-framerate', String(fpsOut), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fpsOut), file]
    : ['-y', '-f', 'image2pipe', '-framerate', String(fpsOut), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '12M', '-qmin', '0', '-qmax', '20', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', file];
  const proc = spawn(ff, enc, { stdio: ['pipe', 'ignore', 'ignore'] });
  const t0 = Date.now(); let lastCap = Date.now();
  for (let i = 0; i < last; i++) {
    await page.evaluate((n) => window.renderFrame(n), i);
    if (i % step) continue;
    const buf = await stage.screenshot({ type: 'jpeg', quality: 94 });
    if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
    const now = Date.now(), real = now - lastCap; lastCap = now;
    await setRate(Math.max(0.02, Math.min(1, (1000 / fpsOut) / Math.max(real, 1))));
    if (i % (V.FPS * 5) === 0) console.log(`  ${(i / V.FPS).toFixed(0)} s / ${(last / V.FPS).toFixed(0)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s écoulées`);
  }
  proc.stdin.end();
  await new Promise((r) => proc.on('close', r));
  if (sysFfmpeg) mux(); else console.log('Vidéo :', path.relative(ROOT, file), '(aperçu WebM sans son)');
}
if (errors.length) console.log('Erreurs dans la page :\n' + errors.slice(0, 10).join('\n'));
await browser.close();
server.close();
