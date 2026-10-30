/* Guess Night: category packs (definitions, loading, pools, daily, seen-history). */
"use strict";

const ICONS = {
  movies: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 9l2.5-5 15 3L21 9M7.5 4.5L9 8.5M12.5 5.5L14 9.5"/></svg>',
  tv: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 3l3 3 3-3"/></svg>',
  countries: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  brands: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
};
const LOCK_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

// Which cast members to show, from billing order and difficulty (movies and TV).
function pickLineup(item, diff, rng = Math.random) {
  const leads = shuffle(item.cast.filter(c => c.order <= 3), rng);
  let support = shuffle(item.cast.filter(c => c.order >= 4 && c.order <= 8), rng);
  if (support.length < 2) support = shuffle(item.cast.filter(c => c.order >= 4), rng);
  const take = (p, n) => p.splice(0, Math.min(n, p.length));
  let initial, extra;
  if (diff === "supereasy") { initial = take(leads, 3); const next = item.cast.filter(c => c.order > 3).sort((a, b) => a.order - b.order)[0]; extra = next; support = support.filter(c => c !== next); }
  else if (diff === "easy") { initial = take(leads, 3); extra = take(support, 1)[0]; }
  else if (diff === "medium") { initial = [...take(leads, 2), ...take(support, 1)]; extra = take(support, 1)[0] || take(leads, 1)[0]; }
  else { initial = [...take(leads, 1), ...take(support, 2)]; extra = take(leads, 1)[0] || take(support, 1)[0]; }
  const rest = [...leads, ...support];
  while (initial.length < 3 && rest.length) initial.push(rest.shift());
  if (!extra) extra = rest.shift();
  return { initial: shuffle(initial, rng), extra, preload: [...initial, extra].filter(Boolean).map(c => c.photo) };
}
const castTile = c => ({ img: c.photo, name: c.name, alt: "Actor photo" });
function castInit(raw, extra) {
  const IMG = raw.img;
  return raw.items.map(m => ({
    ...m, ...extra(m), poster: m.poster ? IMG + "w500" + m.poster : "",
    cast: (m.cast || []).map(c => ({ name: c[0], order: c[1], photo: IMG + "h632" + c[2] })),
  })).filter(m => m.cast.length >= 4);
}
function blankWords(text, words) {
  let t = String(text || "");
  for (const w of [...new Set(words.filter(w => w && w.length >= 3))].sort((a, b) => b.length - a.length)) t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "▇".repeat(Math.min(w.length, 6)));
  return t;
}
const fmtPop = n => !n ? "unknown" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} billion` : n >= 1e6 ? `${Math.round(n / 1e6)} million` : n >= 1e3 ? `${Math.round(n / 1e3)} thousand` : String(n);

const PACK_DEFS = {
  movies: {
    id: "movies", name: "Movies", unit: "film", units: "films",
    tagline: "Three faces walk onto the screen. Name the film before the credits roll.",
    blurb: "Hollywood & Bollywood, from cast photos",
    filter: { label: "Films from", options: [["hollywood", "Hollywood"], ["bollywood", "Bollywood"]] },
    years: true,
    acts: [
      { n: "Act I", name: "The faces", hint: "Three actors. One film." },
      { n: "Act II", name: "One more face", hint: "Enter, stage left." },
      { n: "Act III", name: "The names", hint: "Now you know who they are." },
      { n: "Act IV", name: "The plot", hint: "Last act. Read the synopsis." },
    ],
    partial: "Right series", nearText: "Right universe, different series",
    practice: ["Titanic", "Dilwale Dulhania Le Jayenge", "3 Idiots"],
    reasons: ["Wrong photo", "Wrong actor name", "Plot gives it away / bad plot", "Wrong title or year", "Other"],
    init(raw) { return { items: castInit(raw, m => ({ cat: m.industry, g: m.s })), groups: raw.groups, decoys: raw.decoys }; },
    plan: (item, diff, rng) => pickLineup(item, diff, rng),
    render(pl, stage, ui, item) {
      if (!ui.has("init")) { ui.tiles(pl.initial.map(castTile)); if (pl.extra) ui.locked("Enter, stage left"); ui.mark("init"); }
      if (stage >= 1 && pl.extra) ui.unlock(castTile(pl.extra));
      ui.names(stage >= 2);
      if (stage >= 3) { ui.compact(true); ui.card("plot", "Synopsis", `“${item.plot}”`, { serif: true, typed: true }); }
    },
    reveal: item => ({ img: item.poster, meta: [item.year, item.cat === "bollywood" ? "Bollywood" : "Hollywood", item.director].filter(Boolean).join(" · "), more: "Starring " + item.cast.slice(0, 6).map(c => `<b>${esc(c.name)}</b>`).join(", ") }),
    faces: items => shuffle(items.flatMap(m => m.cast.filter(c => c.order <= 2).map(c => c.photo))).slice(0, 3).map(img => ({ img })),
  },

  tv: {
    id: "tv", name: "TV shows", unit: "show", units: "shows",
    tagline: "The cast is back for another season. Name the show before the finale.",
    blurb: "US, UK & Indian series, from cast photos",
    filter: { label: "Shows from", options: [["us", "US"], ["uk", "UK"], ["india", "India"]] },
    years: true,
    acts: [
      { n: "Episode 1", name: "The cast", hint: "Three regulars. One show." },
      { n: "Episode 2", name: "One more face", hint: "A familiar face joins." },
      { n: "Episode 3", name: "The names", hint: "Who they are, and how long it ran." },
      { n: "Finale", name: "The premise", hint: "Last chance. Read the premise." },
    ],
    partial: "Right franchise", nearText: "Right universe, different show",
    practice: ["Friends", "Breaking Bad"],
    reasons: ["Wrong photo", "Wrong actor name", "Premise gives it away / bad premise", "Wrong title or years", "Other"],
    init(raw) { return { items: castInit(raw, m => ({})), groups: raw.groups || {}, decoys: raw.decoys || [] }; },
    plan: (item, diff, rng) => pickLineup(item, diff, rng),
    render(pl, stage, ui, item) {
      if (!ui.has("init")) { ui.tiles(pl.initial.map(castTile)); if (pl.extra) ui.locked("Joining the cast"); ui.mark("init"); }
      if (stage >= 1 && pl.extra) ui.unlock(castTile(pl.extra));
      ui.names(stage >= 2);
      if (stage >= 2) { ui.compact(true); ui.card("facts", "On air", [item.yearsText, item.seasons ? `${item.seasons} season${item.seasons === 1 ? "" : "s"}` : "", item.genre].filter(Boolean).join(" · ")); }
      if (stage >= 3) ui.card("plot", "Premise", `“${item.plot}”`, { serif: true, typed: true });
    },
    reveal: item => ({ img: item.poster, meta: [item.yearsText, ({ us: "US", uk: "UK", india: "India" })[item.cat], item.network].filter(Boolean).join(" · "), more: "Starring " + item.cast.slice(0, 6).map(c => `<b>${esc(c.name)}</b>`).join(", ") }),
    faces: items => shuffle(items.flatMap(m => m.cast.filter(c => c.order <= 2).map(c => c.photo))).slice(0, 3).map(img => ({ img })),
  },

  countries: {
    id: "countries", name: "Countries", unit: "country", units: "countries",
    tagline: "A shape on the map. Name the country before the borders close.",
    blurb: "From outline, neighbours, culture and flag",
    filter: { label: "Continents", options: [["africa", "Africa"], ["americas", "Americas"], ["asia", "Asia"], ["europe", "Europe"], ["oceania", "Oceania"]] },
    years: false,
    acts: [
      { n: "Clue 1", name: "The shape", hint: "Just the outline. No labels." },
      { n: "Clue 2", name: "The neighbourhood", hint: "Its neighbours, region and population." },
      { n: "Clue 3", name: "The facts", hint: "Languages, money and what it's famous for." },
      { n: "Clue 4", name: "The flag", hint: "Last clue. Fly the flag." },
    ],
    partial: null, nearText: "That's a neighbour. Look across the border",
    practice: ["France", "India"],
    reasons: ["Wrong outline or map", "Wrong facts", "Clue gives it away", "Wrong flag", "Other"],
    init(raw) { return { items: raw.items, groups: {}, decoys: raw.decoys || [] }; },
    plan: (item) => ({ preload: [item.flag] }),
    render(pl, stage, ui, item) {
      if (stage < 1 && !ui.has("outline")) { ui.replace([{ html: item.outline, wide: true, alt: "Country outline" }]); ui.mark("outline"); }
      if (stage >= 1 && !ui.has("map")) { ui.replace([{ html: item.map, wide: true, alt: "Country with its neighbours" }]); ui.mark("map"); }
      if (stage >= 1) ui.card("where", "Where & how many", `${item.region} · population about ${fmtPop(item.population)}${item.nbCount ? ` · ${item.nbCount} land neighbour${item.nbCount === 1 ? "" : "s"}` : " · no land borders"}`);
      if (stage >= 2) { ui.compact(true); ui.card("life", "Daily life", item.life); }
      if (stage >= 3) ui.card("flag", "The flag", "", { html: `<img class="flag-img" src="${esc(item.flag)}" alt="Flag">` });
    },
    reveal: item => ({ img: item.flag, wide: true, meta: [item.region, `Capital: ${item.capital}`].filter(Boolean).join(" · "), more: item.famous ? `Famous for <b>${esc(item.famous)}</b>` : "" }),
    faces: items => shuffle(items).slice(0, 3).map(m => ({ img: m.flag })),
  },

  brands: {
    id: "brands", name: "Brands", unit: "brand", units: "brands",
    tagline: "Colours, a slogan, a story. Name the brand before the ad break ends.",
    blurb: "Global & Indian brands, no logos",
    filter: { label: "Brands from", options: [["global", "Global"], ["india", "India"]] },
    years: false,
    acts: [
      { n: "Clue 1", name: "The colours", hint: "Its colours and what it does." },
      { n: "Clue 2", name: "The slogan", hint: "Name blanked out." },
      { n: "Clue 3", name: "The story", hint: "When, where and who." },
      { n: "Clue 4", name: "The product", hint: "Last clue. Its best-known product." },
    ],
    partial: null, nearText: "Same parent company, different brand",
    practice: ["Coca-Cola", "Tata"],
    reasons: ["Wrong colours", "Wrong slogan", "Wrong facts", "Clue gives it away", "Other"],
    init(raw) { return { items: raw.items, groups: {}, decoys: raw.decoys || [] }; },
    plan: () => ({ preload: [] }),
    render(pl, stage, ui, item) {
      if (!ui.has("swatch")) { ui.replace([{ html: `<div class="swatches">${item.colours.map(c => `<i style="background:${esc(c)}"></i>`).join("")}</div>`, wide: true, alt: "Brand colours" }]); ui.mark("swatch"); }
      ui.card("sector", "What it does", item.sector);
      if (stage >= 1) ui.card("slogan", "Slogan", `“${item.sloganBlank}”`, { serif: true, typed: true });
      if (stage >= 2) { ui.compact(true); ui.card("story", "Origin story", [item.founded && `Founded ${item.founded}`, item.country, (item.founderBlank || item.founder) && `by ${item.founderBlank || item.founder}`].filter(Boolean).join(" · ")); }
      if (stage >= 3) ui.card("product", "Famous for", item.productBlank);
    },
    reveal: item => ({ html: `<div class="brand-card" style="background:${esc(item.colours[0])};color:${esc(item.ink || "#fff")}">${esc(item.title)}</div>`, meta: [item.sector, item.country, item.founded].filter(Boolean).join(" · "), more: item.slogan ? `“${esc(item.slogan)}”` : "" }),
    faces: items => shuffle(items).slice(0, 3).map(m => ({ html: `<div class="swatches">${m.colours.map(c => `<i style="background:${esc(c)}"></i>`).join("")}</div>` })),
  },
};
const PACK_ORDER = ["movies", "tv", "countries", "brands"];
const MANIFEST = window.GN_MANIFEST || {};
const packReady = id => !!(MANIFEST[id] && MANIFEST[id].ready);

// ================= loading =================
const PACKS = {};   // id -> runtime { def, id, items, index, titles, groups }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load failed: " + src)); document.head.appendChild(s); }); }
async function loadPack(id) {
  if (PACKS[id]) return PACKS[id];
  if (!(window.GN_DATA && window.GN_DATA[id])) await loadScript(`packs/${id}.js?v=${(MANIFEST[id] || {}).v || "1"}`);
  const def = PACK_DEFS[id], raw = window.GN_DATA[id], P = { def, id };
  const { items, groups, decoys } = def.init(raw);
  P.items = items.map(m => ({ ...m, pop: m.pop ?? 1, pk: P }));
  P.groups = groups || {};
  Object.values(P.groups).forEach(gr => { gr.keys = [...new Set([gr.n, ...(gr.a || [])].map(compact).filter(Boolean))]; });
  P.index = new Map();
  P.items.forEach(m => [m.title, ...(m.aliases || [])].forEach(t => { const k = compact(t); if (k && !P.index.has(k)) P.index.set(k, m); }));
  const map = new Map();
  (decoys || []).forEach(([t, y]) => map.set(`${t.toLowerCase()}|${y}`, { title: t, year: y }));
  P.items.forEach(m => map.set(`${m.title.toLowerCase()}|${m.year}`, { title: m.title, year: m.year ?? null, tag: m.year ? "" : def.unit }));
  Object.values(P.groups).forEach(gr => { if ((gr.c || 0) >= 2) map.set(`${gr.n.toLowerCase()}|group`, { title: gr.n, year: null, tag: def.partial ? (id === "movies" ? "series" : "franchise") : "" }); });
  P.titles = [...map.values()];
  const ys = P.items.map(m => m.year).filter(Boolean);
  P.yearMin = ys.length ? Math.min(...ys) : 1900; P.yearMax = new Date().getFullYear();
  PACKS[id] = P;
  return P;
}

// ================= pools =================
function filterValues(id) { const d = PACK_DEFS[id]; const f = packPrefs(id).filter; return d.filter ? (f && f.length ? f : d.filter.options.map(o => o[0])) : null; }
function yearOk(id, m) { const pp = packPrefs(id), y = m.year || 0; if (!PACK_DEFS[id].years) return true; return (pp.yearFrom == null || y >= pp.yearFrom) && (pp.yearTo == null || y <= pp.yearTo); }
function pool(id, difficulty = DB.prefs.difficulty) {
  const P = PACKS[id]; if (!P) return [];
  const vals = filterValues(id);
  const base = P.items.filter(m => (!vals || vals.includes(m.cat)) && yearOk(id, m));
  const min = POP_MIN[difficulty] || 0;
  const famous = difficulty === "supereasy" ? base.filter(m => m.f) : base.filter(m => m.pop >= min);
  return famous.length >= 30 || famous.length === base.length ? famous : base;   // small selections keep everything
}
// keep items from the same group at least `gap` apart
function spreadGroups(list, gap = 15) {
  const out = [], waiting = [...list];
  while (waiting.length) {
    const recent = new Set(out.slice(-gap).map(m => m.g).filter(Boolean));
    const i = waiting.findIndex(m => !m.g || !recent.has(m.g));
    out.push(waiting.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}
function dailyItems(id) {
  const P = PACKS[id], rng = mulberry32(hash(`daily-${id}-${todayKey()}`)), seen = new Set();
  return shuffle(P.items.filter(m => m.pop >= 0.4).sort((a, b) => String(a.id).localeCompare(String(b.id))), rng)
    .filter(m => !m.g || (!seen.has(m.g) && seen.add(m.g))).slice(0, DAILY_COUNT);
}
function practiceItem() {
  const P = PACKS.movies;
  for (const t of P.def.practice) { const m = P.items.find(x => x.title === t); if (m) return m; }
  return P.items[0];
}

// ================= seen history (no repeats on this device) =================
const seenKey = id => `guessnight.seen.${id}`;
function seenMap(id) { try { return JSON.parse(localStorage.getItem(seenKey(id)) || "{}"); } catch { return {}; } }
function markSeen(m) { const s = seenMap(m.pk.id); s[m.id] = Date.now(); try { localStorage.setItem(seenKey(m.pk.id), JSON.stringify(s)); } catch { /* ignore */ } }
// Unseen first. Seen ones only come back once ~80% of this pool is used up, oldest-seen first.
function freshDeck(id, list) {
  const seen = seenMap(id), unseen = list.filter(m => !seen[m.id]);
  const deck = spreadGroups(shuffle(unseen));
  if (unseen.length >= list.length * 0.2) return deck;
  return deck.concat(list.filter(m => seen[m.id]).sort((a, b) => seen[a.id] - seen[b.id]));
}
