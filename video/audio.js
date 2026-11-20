/* Original soundtrack, synthesised offline with the Web Audio API (no sample, no third-party asset):
   a calm pad + soft plucked arpeggio + bass, a light click on every real click, a whoosh on each role
   transition. window.renderAudio(cues) resolves to a base64 16-bit stereo WAV. */
(function () {
  'use strict';
  const SR = 48000;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // D major colour, 4 s per chord: Dmaj7 · Bm7 · Gmaj7 · A6sus
  const CHORDS = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 50, 52, 54]];

  const reverb = (ctx, seconds = 2.8) => {
    const len = SR * seconds, buf = ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let seed = 1234 + c * 77; for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3.2); } }
    const conv = ctx.createConvolver(); conv.buffer = buf; return conv;
  };
  const noiseBuffer = (ctx, seconds) => {
    const len = Math.floor(SR * seconds), buf = ctx.createBuffer(1, len, SR), d = buf.getChannelData(0);
    let seed = 99; for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    return buf;
  };

  window.renderAudio = async (cues) => {
    const dur = cues.duration + 0.5;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    const music = ctx.createGain(); music.connect(master);
    const rv = reverb(ctx); const wet = ctx.createGain(); wet.gain.value = 0.32; rv.connect(wet); wet.connect(master);
    // music bed: fade in, duck slightly under the product scenes, fade out at the end
    music.gain.setValueAtTime(0, 0); music.gain.linearRampToValueAtTime(0.85, 2.0);
    music.gain.setValueAtTime(0.85, dur - 3.2); music.gain.linearRampToValueAtTime(0, dur - 0.3);

    const CH = 4.0, BEAT = 0.625;
    for (let t = 0, k = 0; t < dur; t += CH, k++) {
      const ch = CHORDS[k % CHORDS.length];
      // pad: two detuned triangles per note through a soft low-pass
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.055, t + 1.4); g.gain.setValueAtTime(0.055, t + CH - 0.2); g.gain.linearRampToValueAtTime(0, t + CH + 1.4);
      lp.connect(g); g.connect(music); g.connect(rv);
      ch.forEach((n) => [-6, 6].forEach((cents) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n + 12); o.detune.value = cents; o.connect(lp); o.start(t); o.stop(t + CH + 1.6); }));
      // bass on beats 1 and 3
      [0, 2 * BEAT, 4 * BEAT, 6 * BEAT].forEach((b, i) => {
        const bt = t + b; if (bt > dur - 1 || t < 4.9) return;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(ch[0] - 12 + (i % 2 ? 7 : 0));
        const bg = ctx.createGain(); bg.gain.setValueAtTime(0, bt); bg.gain.linearRampToValueAtTime(0.16, bt + 0.02); bg.gain.exponentialRampToValueAtTime(0.001, bt + 1.1);
        o.connect(bg); bg.connect(music); o.start(bt); o.stop(bt + 1.2);
      });
      // plucked arpeggio (eighth notes) from the problem scene onwards, pausing on the closing logo
      if (t >= 4.9 && t < dur - 6) for (let e = 0; e < 8; e++) {
        const pt = t + e * BEAT / 2; const note = ch[[0, 1, 2, 3, 2, 1, 2, 3][e]] + 24;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(note);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = midi(note) * 2.01;
        const pg = ctx.createGain(); pg.gain.setValueAtTime(0, pt); pg.gain.linearRampToValueAtTime(e % 2 ? 0.035 : 0.05, pt + 0.008); pg.gain.exponentialRampToValueAtTime(0.0008, pt + 0.9);
        const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(pg);
        o.connect(pg); pg.connect(music); pg.connect(rv); o.start(pt); o2.start(pt); o.stop(pt + 1); o2.stop(pt + 1);
      }
    }
    // closing chord on the logo
    const endT = dur - 6.2;
    CHORDS[0].concat([62, 66]).forEach((n) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n + 12); const g = ctx.createGain(); g.gain.setValueAtTime(0, endT); g.gain.linearRampToValueAtTime(0.03, endT + 0.4); g.gain.exponentialRampToValueAtTime(0.001, dur - 0.2); o.connect(g); g.connect(master); g.connect(rv); o.start(endT); o.stop(dur); });

    // UI clicks: short, soft, slightly pitched
    cues.clicks.forEach((ct) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1900, ct); o.frequency.exponentialRampToValueAtTime(900, ct + 0.05);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, ct); g.gain.linearRampToValueAtTime(0.22, ct + 0.003); g.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.03); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; const ng = ctx.createGain(); ng.gain.setValueAtTime(0.06, ct); ng.gain.exponentialRampToValueAtTime(0.001, ct + 0.025);
      o.connect(g); g.connect(master); n.connect(hp); hp.connect(ng); ng.connect(master);
      o.start(ct); o.stop(ct + 0.08); n.start(ct);
    });
    // whoosh on role transitions (band-passed noise sweeping up then down)
    cues.wipes.forEach((wt) => {
      const t0 = wt - 0.55, n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 1.4);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(2600, wt); bp.frequency.exponentialRampToValueAtTime(500, wt + 0.7);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.32, wt - 0.05); g.gain.exponentialRampToValueAtTime(0.001, wt + 0.8);
      n.connect(bp); bp.connect(g); g.connect(master); g.connect(rv); n.start(t0); n.stop(t0 + 1.4);
    });

    const buf = await ctx.startRendering();
    // 16-bit PCM WAV
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const norm = peak > 0 ? 0.89 / peak : 1; // −1 dBFS
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * norm)) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * norm)) * 32767, true); }
    const bytes = new Uint8Array(out.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
})();
