/* Guess Night: category packs (definitions, loading, pools, daily, seen-history). */
"use strict";

const ICONS = {
  movies: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 9l2.5-5 15 3L21 9M7.5 4.5L9 8.5M12.5 5.5L14 9.5"/></svg>',
  tv: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 3l3 3 3-3"/></svg>',
  countries: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  brands: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  actors: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
  cities: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  animals: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M12 11c-3 0-6 4-6 7a3 3 0 0 0 3 3c1.2 0 2-.6 3-.6s1.8.6 3 .6a3 3 0 0 0 3-3c0-3-3-7-6-7z"/></svg>',
  people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
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
  actors: {
    id: "actors", name: "Actors", unit: "star", units: "stars",
    tagline: "Three scenes from their best work. Name the star before the curtain call.",
    blurb: "Hollywood, Bollywood & TV stars, from their films",
    filter: { label: "Stars from", options: [["hollywood", "Hollywood"], ["bollywood", "Bollywood"], ["tv", "TV"]] },
    years: false,
    acts: [
      { n: "Scene 1", name: "The filmography", hint: "Stills from three of their films or shows." },
      { n: "Scene 2", name: "The career", hint: "When they started and where they're from." },
      { n: "Scene 3", name: "The co-stars", hint: "The people they share the screen with most." },
      { n: "Scene 4", name: "The face", hint: "Last clue. Here they are." },
    ],
    partial: null, nearText: "",
    practice: ["Shah Rukh Khan", "Tom Hanks"],
    reasons: ["Wrong film still", "Wrong career facts", "Wrong co-stars", "Wrong photo", "Other"],
    init(raw) {
      const IMG = raw.img;
      return { items: raw.items.map(a => ({ ...a, photo: IMG + "h632" + a.photo, known: a.known.map(([t, y, k, still, poster]) => ({ t, y, k, still: IMG + "w780" + still, poster: poster ? IMG + "w500" + poster : "" })) })), groups: {}, decoys: raw.decoys || [] };
    },
    plan(item, diff, rng) {
      const k = item.known, n = k.length;
      const idx = diff === "supereasy" || diff === "easy" ? [0, 1, 2] : diff === "medium" ? [0, Math.min(2, n - 1), Math.min(3, n - 1)] : [Math.min(1, n - 1), Math.min(3, n - 1), n - 1];
      const picks = [...new Set(idx)].map(i => k[i]); for (const x of k) { if (picks.length >= 3) break; if (!picks.includes(x)) picks.push(x); }
      return { stills: shuffle(picks, rng), preload: [...picks.map(x => x.still), item.photo] };
    },
    render(pl, stage, ui, item) {
      if (!ui.has("init")) { ui.tiles(pl.stills.map(x => ({ img: x.still, alt: "Scene from one of their films" }))); ui.locked("Their face"); ui.mark("init"); }
      if (stage >= 1) ui.card("career", "The career", [`On screen ${item.active}`, [item.born && (item.died ? `${item.born}–${item.died}` : `Born ${item.born}`), item.country && `${item.born ? "in" : "From"} ${item.country}`].filter(Boolean).join(" ")].filter(Boolean).join(" · "));
      if (stage >= 2) { ui.compact(true); ui.card("costars", "Often seen with", item.costars.join(", ")); }
      if (stage >= 3) ui.unlock({ img: item.photo, alt: "Their photo" });
    },
    reveal: item => ({ img: item.photo, meta: [item.country, `On screen ${item.active}`].filter(Boolean).join(" · "), more: "Known for " + item.known.slice(0, 4).map(x => `<b>${esc(x.t)}</b>${x.y ? ` (${x.y})` : ""}`).join(", ") }),
    faces: items => shuffle(items.filter(m => m.f)).slice(0, 3).map(m => ({ img: m.photo })),
  },
  cities: {
    id: "cities", name: "Cities & landmarks", unit: "place", units: "places",
    tagline: "A dot on the map. Name the place before the tour bus leaves.",
    blurb: "Cities and famous sights, from a dot on the map",
    filter: { label: "Where", options: [["india", "India"], ["asia", "Asia"], ["europe", "Europe"], ["americas", "Americas"], ["africa", "Africa"], ["oceania", "Oceania"]] },
    filter2: { key: "type", label: "Type", options: [["city", "Cities"], ["landmark", "Landmarks"]] },
    years: false,
    acts: [
      { n: "Clue 1", name: "The map", hint: "Just a dot on a blank map." },
      { n: "Clue 2", name: "The basics", hint: "Country, and how big or how old." },
      { n: "Clue 3", name: "Famous for", hint: "What it's known for. Names hidden." },
      { n: "Clue 4", name: "The view", hint: "Last clue. Take a look." },
    ],
    partial: null, nearText: "Right country, different place",
    practice: ["Paris", "Taj Mahal"],
    reasons: ["Wrong spot on the map", "Wrong country or numbers", "Clue gives it away", "Wrong photo", "Other"],
    init(raw) { WORLD_PATH = raw.world; return { items: raw.items, groups: {}, decoys: raw.decoys || [] }; },
    plan: item => ({ preload: [item.photo] }),
    render(pl, stage, ui, item) {
      if (!ui.has("map")) { ui.replace([{ html: dotMap(item.lon, item.lat), wide: true, alt: "A dot on a world map" }]); ui.mark("map"); }
      if (stage >= 1) ui.card("basics", item.type === "city" ? "The city" : "The landmark", [item.country, item.type === "city" ? (item.population ? `population about ${fmtPop(item.population)}` : "") : (item.built || (item.natural ? "A natural wonder" : ""))].filter(Boolean).join(" · "));
      if (stage >= 2) { ui.compact(true); ui.card("famous", "Famous for", item.famous); }
      if (stage >= 3) ui.card("view", "The view", "", { html: `<img class="place-photo" src="${esc(item.photo)}" alt="Photo of the place">` });
    },
    reveal: item => ({ img: item.photo, wide: true, meta: [item.country, item.type === "city" ? "City" : "Landmark"].join(" · "), more: `${esc(item.famousFull)}${creditLine(item.credit)}` }),
    faces: items => shuffle(items.filter(m => m.f)).slice(0, 3).map(m => ({ img: m.photo })),
  },
  animals: {
    id: "animals", name: "Animals", unit: "animal", units: "animals",
    tagline: "A shadow in the wild. Name the animal before it runs off.",
    blurb: "From silhouettes, habitats and fun facts",
    filter: { label: "Animals", options: [["mammals", "Mammals"], ["birds", "Birds"], ["sea", "Sea life"], ["reptiles", "Reptiles & amphibians"], ["bugs", "Bugs"]] },
    years: false,
    acts: [
      { n: "Clue 1", name: "The shadow", hint: "Just its outline." },
      { n: "Clue 2", name: "The home", hint: "Where in the world it lives." },
      { n: "Clue 3", name: "The fact", hint: "A fun fact. Name hidden." },
      { n: "Clue 4", name: "The reveal", hint: "Last clue. Here it is." },
    ],
    partial: null, nearText: "Same family, different animal",
    practice: ["Tiger", "Giraffe"],
    reasons: ["Wrong silhouette", "Wrong habitat", "Wrong or misleading fact", "Wrong photo", "Other"],
    init(raw) { CONTINENTS = raw.continents; return { items: raw.items, groups: {}, decoys: raw.decoys || [] }; },
    plan: item => ({ preload: [item.shadow ? item.shadow.url : item.photo, item.photo] }),
    render(pl, stage, ui, item) {
      if (!ui.has("shadow")) {
        ui.replace([item.shadow ? { html: `<img class="silhouette" src="${esc(item.shadow.url)}" alt="Animal silhouette">`, wide: true, alt: "Animal silhouette" } : { html: `<img class="blurshadow" src="${esc(item.photo)}" alt="Blurred animal shape">`, wide: true, alt: "Blurred animal shape" }]);
        ui.mark("shadow");
      }
      if (stage >= 1) ui.card("home", "The home", "", { html: `${continentMap(item.where)}<p>${esc(whereText(item.where))} · ${esc(item.habitat)}</p>` });
      if (stage >= 2) { ui.compact(true); ui.card("fact", "Fun fact", item.fact, { serif: true, typed: true }); }
      if (stage >= 3) ui.card("view", "The reveal", "", { html: `<img class="place-photo" src="${esc(item.photo)}" alt="Photo of the animal">` });
    },
    reveal: item => ({ img: item.photo, wide: true, meta: [item.sci, whereText(item.where)].filter(Boolean).join(" · "), more: `${esc(item.factFull)}${creditLine(item.credit)}${item.shadow ? `<div class="credit">Silhouette: ${esc(item.shadow.by)} · <a href="${esc(item.shadow.src)}" target="_blank" rel="noopener">${esc(item.shadow.lic)}</a> (PhyloPic)</div>` : ""}` }),
    faces: items => shuffle(items.filter(m => m.f && m.shadow)).slice(0, 3).map(m => ({ html: `<img class="silhouette" src="${esc(m.shadow.url)}" alt="">` })),
  },
  people: {
    id: "people", name: "Famous people", unit: "person", units: "people",
    tagline: "A face in close-up. Name them before history moves on.",
    blurb: "Leaders, scientists, artists and icons",
    filter: { label: "Fields", options: [["politics", "Politics"], ["science", "Science"], ["music", "Music"], ["business", "Business"], ["arts", "Arts & writing"], ["history", "History"]] },
    years: false,
    acts: [
      { n: "Clue 1", name: "The close-up", hint: "A tight crop of their photo." },
      { n: "Clue 2", name: "The basics", hint: "What they did, where and when." },
      { n: "Clue 3", name: "The record", hint: "Three things they're known for." },
      { n: "Clue 4", name: "The portrait", hint: "Last clue. The full picture." },
    ],
    partial: null, nearText: "",
    practice: ["Albert Einstein", "Mahatma Gandhi"],
    reasons: ["Wrong or unclear photo", "Wrong facts", "Achievement gives it away", "Wrong person", "Other"],
    init(raw) { return { items: raw.items, groups: {}, decoys: raw.decoys || [] }; },
    plan: (item, diff) => ({ zoom: diff === "hard" ? 3.4 : diff === "medium" || diff === "mixed" ? 2.7 : 2.1, preload: [item.photo] }),
    render(pl, stage, ui, item) {
      if (stage < 3 && !ui.has("crop")) { ui.replace([{ html: `<img class="crop" style="--z:${pl.zoom}" src="${esc(item.photo)}" alt="Close-up crop">`, wide: true, alt: "Close-up crop of a photo" }]); ui.mark("crop"); }
      if (stage >= 1) ui.card("basics", "The basics", [item.role && item.role[0].toUpperCase() + item.role.slice(1), item.country && `Born in ${item.country}`, item.era].filter(Boolean).join(" · "));
      if (stage >= 2) { ui.compact(true); ui.card("ach", "Known for", "", { html: `<ul class="ach">${item.ach.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` }); }
      if (stage >= 3 && !ui.has("full")) { ui.replace([{ img: item.photo, wide: true, alt: "Portrait" }]); ui.mark("full"); }
    },
    reveal: item => ({ img: item.photo, meta: [item.country, item.era].filter(Boolean).join(" · "), more: `${item.achFull.map(esc).join(" · ")}${creditLine(item.credit)}` }),
    faces: items => shuffle(items.filter(m => m.f)).slice(0, 3).map(m => ({ img: m.photo })),
  },
};
const PACK_ORDER = ["movies", "tv", "actors", "people", "countries", "cities", "animals", "brands"];
// Continents map for animals (outlines come from the animals pack).
let CONTINENTS = {};
const CONT_NAMES = { AF: "Africa", AS: "Asia", EU: "Europe", NA: "North America", SA: "South America", OC: "Oceania", AN: "Antarctica", OCEAN: "the oceans" };
function whereText(w) { const land = w.filter(c => c !== "OCEAN"); return land.length >= 6 ? "Almost everywhere" : land.length ? land.map(c => CONT_NAMES[c]).join(", ") + (w.includes("OCEAN") ? " and the oceans" : "") : "The oceans"; }
function continentMap(w) {
  const keys = Object.keys(CONTINENTS).filter(k => k !== "AN" || w.includes("AN"));
  return `<svg class="map-svg cont${w.includes("OCEAN") ? " sea-on" : ""}" viewBox="-170 ${w.includes("AN") ? -80 : -80} 340 ${w.includes("AN") ? 165 : 140}" preserveAspectRatio="xMidYMid meet">${keys.map(k => `<path class="${w.includes(k) ? "on" : ""}" d="${CONTINENTS[k]}"/>`).join("")}</svg>`;
}
// A dot on a blank world map (equirectangular; the world outline comes from the cities pack).
let WORLD_PATH = "";
function dotMap(lon, lat, w = 90, h = 56) {
  const x0 = Math.max(-180, Math.min(180 - w, lon - w / 2)), y0 = Math.max(-84, Math.min(84 - h, -lat - h / 2));
  return `<svg class="map-svg world" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w} ${h}" preserveAspectRatio="xMidYMid slice"><path class="land" d="${WORLD_PATH}"/><circle class="ping" cx="${lon}" cy="${-lat}" r="3.2"/><circle class="dot" cx="${lon}" cy="${-lat}" r="1.1"/></svg>`;
}
// Photo attribution for Wikimedia Commons images.
const creditLine = c => c ? `<div class="credit">Photo: ${esc(c.by)} · <a href="${esc(c.src)}" target="_blank" rel="noopener">${esc(c.lic)}</a></div>` : "";
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
function filterValues(id, which = "filter") { const d = PACK_DEFS[id]; const f = packPrefs(id)[which]; return d[which] ? (f && f.length ? f : d[which].options.map(o => o[0])) : null; }
function yearOk(id, m) { const pp = packPrefs(id), y = m.year || 0; if (!PACK_DEFS[id].years) return true; return (pp.yearFrom == null || y >= pp.yearFrom) && (pp.yearTo == null || y <= pp.yearTo); }
function pool(id, difficulty = DB.prefs.difficulty) {
  const P = PACKS[id]; if (!P) return [];
  const vals = filterValues(id);
  const f2 = P.def.filter2, vals2 = filterValues(id, "filter2");
  const base = P.items.filter(m => (!vals || vals.includes(m.cat)) && (!f2 || vals2.includes(m[f2.key])) && yearOk(id, m));
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
