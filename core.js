/* Guess Night: core helpers, storage, matching, sound, confetti, analytics. */
"use strict";

// ================= rules =================
const BASES = [100, 75, 50, 25];
const PARTIAL_SHARE = 0.75;           // a right-series / right-franchise guess earns 75%
const DIFF_NOTES = {
  supereasy: "Only the most famous answers, clearest clues first, 4 guesses · scores ×0.8",
  easy: "Well-known answers, clearest clues first",
  medium: "A good mix of famous and less obvious",
  hard: "Everything, trickiest clues first",
  mixed: "A random difficulty each round",
};
const DIFF_MULT = { supereasy: 0.8 };
const ROUND_STEPS = [5, 10, 15, 20, 30, 0];   // 0 = endless
const MAX_WRONG = 3, PENALTY = 10, LIVES = 3, DAILY_COUNT = 5, MAX_SKIPS = 3, MIN_POOL = 10, DAILY_SEC = 15;
const STREAK_BADGES = { 3: "Hat-trick", 5: "On a roll", 10: "Showstopper" };
const NICKS = ["Front Row Fan", "Quick Guesser", "Plot Twister", "Midnight Quizzer", "Clue Hunter", "Trivia Bandit", "Quiz Royalty", "Popcorn Pro", "Trivia Titan", "Scene Stealer"];
const POP_MIN = { easy: 0.55, medium: 0.25 };

// ================= storage =================
const KEY = "guessnight.v1";
const DEFAULTS = () => ({
  prefs: {
    onboarded: false, difficulty: "medium", stageSec: 15, mode: "solo", cat: "movies",
    voice: false, voiceLang: "en-IN", voiceNoted: false, autoNext: true,
    party: { count: 3, names: [], style: "shout", films: 10, cat: "movies" },
    packs: {},   // per category: { filter: [...], yearFrom, yearTo }
    nickname: "", sound: true, vibrate: true, reduceMotion: false,
  },
  records: {},   // per category: { best, bestStreak }
  stats: {},     // per category: { seen, won, clueSum, skips, cat: {}, dec: {} }
  daily: {},     // per category: { "YYYY-MM-DD": {...} }
});
function load() {
  const d = DEFAULTS();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw) {
      Object.assign(d.prefs, raw.prefs); Object.assign(d.records, raw.records); Object.assign(d.stats, raw.stats); Object.assign(d.daily, raw.daily);
      d.prefs.party = Object.assign(DEFAULTS().prefs.party, raw.prefs?.party || {});
      d.prefs.packs = raw.prefs?.packs || {};
    } else {
      // first run: bring over CastGuess progress from this browser
      const old = JSON.parse(localStorage.getItem("castguess.v3") || "null");
      if (old) {
        const p = old.prefs || {};
        for (const k of ["difficulty", "stageSec", "voice", "voiceLang", "voiceNoted", "autoNext", "nickname", "sound", "vibrate", "reduceMotion", "onboarded"]) if (p[k] !== undefined) d.prefs[k] = p[k];
        if (p.party) Object.assign(d.prefs.party, p.party, { cat: "movies" });
        d.prefs.packs.movies = { filter: p.industries || null, yearFrom: p.yearFrom ?? null, yearTo: p.yearTo ?? null };
        if (old.records) d.records.movies = old.records;
        if (old.stats) d.stats.movies = { ...old.stats, cat: old.stats.ind || {}, dec: old.stats.dec || {} };
        if (old.daily) d.daily.movies = old.daily;
        const seen = localStorage.getItem("castguess.v3.seen");
        if (seen && !localStorage.getItem("guessnight.seen.movies")) localStorage.setItem("guessnight.seen.movies", seen);
      }
    }
    if (![15, 30, 60].includes(d.prefs.stageSec)) d.prefs.stageSec = 15;
  } catch { /* storage unavailable */ }
  return d;
}
let DB = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { /* ignore */ } }
function packPrefs(id) { DB.prefs.packs[id] = DB.prefs.packs[id] || { filter: null, yearFrom: null, yearTo: null }; return DB.prefs.packs[id]; }
function packStats(id) { DB.stats[id] = Object.assign({ seen: 0, won: 0, clueSum: 0, skips: 0, cat: {}, dec: {} }, DB.stats[id] || {}); return DB.stats[id]; }
function packRecords(id) { DB.records[id] = Object.assign({ best: 0, bestStreak: 0 }, DB.records[id] || {}); return DB.records[id]; }
function packDaily(id) { DB.daily[id] = DB.daily[id] || {}; return DB.daily[id]; }

// ================= helpers =================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(a, rng = Math.random) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
const roman = n => ["I", "II", "III", "IV"][n];
const rm = () => DB.prefs.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function applyMotion() { document.body.classList.toggle("rm", rm()); }
function toast(msg, ms = 2200) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms); }
function buzz(p) { if (DB.prefs.vibrate && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(p); } catch { /* ignore */ } } }
const decadeOf = y => y ? `${Math.floor(y / 10) * 10}s` : "Unknown";
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dailyNumber() { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 9, 29)) / 864e5) + 1; }
function starSvg(lost = false, extra = "") { return `<svg class="star ${lost ? "lost" : ""} ${extra}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="#E2C27A"/></svg>`; }
function show(id) { $$(".screen").forEach(s => s.classList.toggle("active", s.id === id)); window.scrollTo(0, 0); if (typeof syncVoice === "function") { try { syncVoice(); } catch { /* voice not ready yet */ } } }

// ================= answer matching =================
function normalize(v) {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/\b(the|a|an)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
const compact = v => normalize(v).replace(/\s/g, "");
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const s = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = s; } }
  return row[b.length];
}
const answers = m => [m.title, ...(m.aliases || [])].map(normalize).filter(Boolean);
function matches(value, m) {
  const g = normalize(value).replace(/\s/g, ""); if (!g) return false;
  return answers(m).some(c => { const t = c.replace(/\s/g, ""); if (g === t) return true; if (g.replace(/\D/g, "") !== t.replace(/\D/g, "")) return false; /* sequel numbers are never typos */ const max = Math.max(g.length, t.length); return max > 4 && lev(g, t) <= (max >= 15 ? 2 : 1); });
}
// Same series / franchise: another member, or the group name itself ("Harry Potter", "Dhoom")
function groupMatch(value, m) {
  const P = m.pk, gr = m.g && P.groups[m.g]; if (!gr || !P.def.partial) return false;
  const gc = compact(value); if (gc.length < 2) return false;
  if (gr.keys.some(k => gc === k || (k.length >= 6 && lev(gc, k) <= 1))) return true;
  const other = P.index.get(gc); if (other && other.g === m.g) return true;
  return gr.keys.some(k => k.length >= 5 && gc.includes(k));
}
// Near miss that costs nothing: same universe / neighbouring country / same parent company
function nearMatch(value, m) {
  const P = m.pk, gc = compact(value); if (gc.length < 3) return false;
  const other = P.index.get(gc);
  if (other && other.id !== m.id) {
    if (m.u && other.u === m.u) return true;
    if (m.near && m.near.includes(other.id)) return true;
  }
  if (m.u) return Object.values(P.groups).some(gr => gr.u === m.u && gr.keys.some(k => k.length >= 5 && gc.includes(k)));
  return false;
}
function nearMiss(value, m) {
  const g = normalize(value); if (g.length < 3) return false;
  const base = s => s.replace(/\b(part|chapter|vol|volume|returns|rises|reloaded|revolutions|season)\b.*$/, "").replace(/\b(\d+|ii|iii|iv|v|vi)\b/g, "").replace(/\s+/g, " ").trim();
  return answers(m).some(t => (base(g).length >= 3 && base(g) === base(t)) || t.startsWith(g + " ") || g.startsWith(t + " "));
}

// ================= anonymous analytics =================
const IS_LIVE = /\.github\.io$/.test(location.hostname);
const trackQueue = [];
function track(name, title) { if (!IS_LIVE) return; trackQueue.push([name, title]); flushTrack(); }
function flushTrack(tries = 0) {
  const gc = window.goatcounter;
  if (gc && typeof gc.count === "function") { while (trackQueue.length) { const [n, t] = trackQueue.shift(); try { gc.count({ path: "event/" + n, title: t || n, event: true }); } catch { /* ignore */ } } return; }
  if (tries < 10) setTimeout(() => flushTrack(tries + 1), 1000);
}
const roundsBucket = n => n >= 20 ? "20plus" : n >= 10 ? "10-19" : n >= 5 ? "5-9" : "1-4";

// ================= sound =================
const sfx = (() => {
  let ctx;
  function ac() { if (!DB.prefs.sound) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; } }
  function tone(f, t0, dur, type = "sine", vol = .12, f2) {
    const c = ac(); if (!c) return; const t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .03);
  }
  return {
    unlock() { ac(); }, tick() { tone(1150, 0, .05, "square", .04); }, count() { tone(660, 0, .14, "sine", .12); },
    action() { tone(990, 0, .3, "triangle", .14); tone(1320, .06, .3, "sine", .06); }, whoosh() { tone(300, 0, .22, "sine", .05, 700); },
    wrong() { tone(170, 0, .24, "square", .06, 110); }, near() { tone(520, 0, .14, "sine", .1, 720); },
    chime() { tone(880, 0, .6, "sine", .1); tone(1320, .1, .7, "sine", .05); },
    miss() { tone(440, 0, .3, "sine", .09, 330); tone(330, .25, .45, "sine", .07, 247); },
    badge() { tone(784, 0, .16, "triangle", .1); tone(1175, .13, .4, "triangle", .1); },
  };
})();
// Winning sound: B · Award chime. level 3 = clue 1, 2 = clues 2–3, 1 = clue 4
const winChime = (() => {
  let ctx, out, verb;
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      out = ctx.createGain(); out.gain.value = 0.9; out.connect(comp).connect(ctx.destination);
      verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.28; verb.connect(wet).connect(out);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(param, t, a, peak, d) { param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function bell(t, midi, vol, dest, decay = 1.4, ratio = 3.5) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), f = hz(midi);
    c.frequency.value = f; m.frequency.value = f * ratio; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay);
    m.connect(mg).connect(c.frequency); c.connect(g).connect(dest); env(g.gain, t, 0.004, vol, decay);
    c.start(t); m.start(t); c.stop(t + decay + 0.1); m.stop(t + decay + 0.1);
  }
  return function play(level) {
    if (!DB.prefs.sound) return;
    try {
      ac(); const t = ctx.currentTime + 0.02, b = ctx.createGain(); b.gain.value = 0.8; b.connect(out); b.connect(verb);
      const notes = level >= 3 ? [84, 88, 91, 96, 100] : level === 2 ? [84, 88, 91, 96] : [91, 96];
      notes.forEach((m, i) => bell(t + i * 0.075, m, 0.22, b, level === 1 ? 1.0 : 1.6));
      if (level >= 2) for (let i = 0; i < (level >= 3 ? 10 : 5); i++) bell(t + 0.35 + i * 0.045, 100 + (i % 5) * 2, 0.04, b, 0.5, 5.2);
    } catch { /* audio unavailable */ }
  };
})();

// ================= confetti =================
function confetti(amount = 160) {
  if (rm()) return;
  const cv = $("#confetti"), dpr = window.devicePixelRatio || 1; cv.hidden = false;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const colors = ["#E2C27A", "#F1D9A0", "#F4EFE4", "#C7A964", "#FFFFFF"];
  const parts = Array.from({ length: amount }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .38, vx: (Math.random() - .5) * 13, vy: -Math.random() * 15 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: colors[Math.floor(Math.random() * colors.length)] }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start; ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => { p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - t / 2600); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (t < 2600) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; }
  })(start);
}
