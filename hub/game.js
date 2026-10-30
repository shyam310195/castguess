/* Guess Night: the shared round engine used by every category. */
"use strict";

const G = { mode: "solo", packIds: [], deck: [], decks: {}, item: null, plan: null, diff: "medium", stage: 0, stageStart: 0, wrong: 0, tried: [], over: true, raf: 0, token: 0,
  paused: false, pausedAt: 0, lastSec: null, score: 0, lives: LIVES, streak: 0, runBest: 0, nailed: [], missed: [], skipped: [], roundNo: 0, results: [], coachStep: 0,
  giveUpArmed: false, stageMs: 15000, skipsLeft: MAX_SKIPS, autoNext: 0, autoTick: 0, autoBase: null, autoResume: false,
  players: [], pstyle: "shout", totalRounds: 0, cur: -1, credit: -1, whoPending: null, frozenP: null, whoAt: 0, partialHit: false, prevRanks: null, filmStart: 0 };
const cur = () => G.item && G.item.pk;
const unitOf = (m = G.item) => (m ? m.pk.def.unit : "round");

// ================= clue area helpers (packs draw clues with these) =================
const ui = {
  flags: new Set(),
  reset() { $("#cast").className = "cast"; $("#cast").innerHTML = ""; $("#infoCards").innerHTML = ""; this.flags = new Set(); },
  has(k) { return this.flags.has(k); }, mark(k) { this.flags.add(k); },
  tile(t, i, total, extra = false) {
    const el = document.createElement("div"); el.className = "actor flip" + (extra ? " extra spot" : "") + (t.wide ? " tile-wide" : "");
    const alt = `${t.alt || "Clue picture"} ${i + 1} of ${total}`;
    el.innerHTML = `<div class="ph" ${t.html ? `role="img" aria-label="${esc(alt)}"` : ""}>${t.img ? `<img src="${esc(t.img)}" alt="${esc(alt)}">` : (t.html || "")}</div><div class="nm">${esc(t.name || "")}</div>`;
    return el;
  },
  tiles(list) { list.forEach((t, i) => { const el = this.tile(t, i, list.length); el.style.animationDelay = `${i * 120}ms`; $("#cast").appendChild(el); }); },
  replace(list) { $("#cast").innerHTML = ""; this.tiles(list); },
  locked(label) {
    const slot = document.createElement("div"); slot.className = "actor locked";
    slot.innerHTML = `<div class="ph">${LOCK_SVG}<em>${esc(label)}</em><small id="slotTimer">${G.mode === "practice" ? "next clue" : `in ${G.stageMs / 1000} seconds`}</small></div><div class="nm"></div>`;
    $("#cast").appendChild(slot);
  },
  unlock(t) { if (this.has("unlocked")) return; const slot = $("#cast .locked"); const el = this.tile(t, 3, 4, true); slot ? slot.replaceWith(el) : $("#cast").appendChild(el); this.mark("unlocked"); },
  names(on) { $("#cast").classList.toggle("names", on); if (on) $$("#cast .actor").forEach(a => { const img = a.querySelector("img"), nm = a.querySelector(".nm").textContent; if (img && nm) img.alt = nm; }); },
  compact(on) { $("#cast").classList.toggle("compact", on); },
  card(key, label, text, opts = {}) {
    if (this.has("card:" + key)) return; this.mark("card:" + key);
    const c = document.createElement("div"); c.className = "info-card"; c.innerHTML = `<div class="label gold">${esc(label)}</div>`;
    const p = document.createElement(opts.html ? "div" : "p"); if (opts.serif) p.className = "serif-it";
    if (opts.html) p.innerHTML = opts.html; else if (opts.typed) typewrite(p, text); else p.textContent = text;
    c.appendChild(p); $("#infoCards").appendChild(c);
  },
};
function typewrite(el, text) {
  if (rm()) { el.textContent = text; return; }
  el.textContent = ""; let i = 0; const tk = G.token;
  (function step() { if (tk !== G.token) return; i = Math.min(text.length, i + 2); el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, 18); })();
}

// ================= starting a game =================
// mode: solo | daily | practice | party.  ids: category ids (party may mix several)
async function startGame(mode, ids) {
  ids = ids.filter(packReady);
  try { await Promise.all(ids.map(loadPack)); } catch { toast("Couldn't load that category. Check your connection and try again."); return; }
  const decks = {};
  if (mode === "daily") decks[ids[0]] = dailyItems(ids[0]);
  else if (mode === "practice") decks.movies = [practiceItem()];
  else for (const id of ids) { const p = pool(id); if (p.length) decks[id] = freshDeck(id, p); }
  ids = ids.filter(id => decks[id] && decks[id].length);
  if (!ids.length) { toast("Nothing matches your choices. Try widening the filters."); return; }
  Object.assign(G, { mode, packIds: ids, decks, score: 0, lives: LIVES, streak: 0, runBest: 0, nailed: [], missed: [], skipped: [], skipsLeft: MAX_SKIPS, roundNo: 0, results: [], item: null,
    stageMs: (mode === "daily" ? DAILY_SEC : DB.prefs.stageSec) * 1000 });
  if (mode === "party") {
    const pp = DB.prefs.party;
    G.players = partyNames().map((name, i) => ({ name, color: PCOLORS[i], score: 0, nailed: 0, first: 0, last: 0, fastest: Infinity }));
    G.pstyle = pp.style; G.totalRounds = pp.style === "shout" ? pp.films : pp.films * pp.count; G.prevRanks = null;
  }
  if (mode === "solo" || mode === "party") {
    const tag = ids.length > 1 ? "mixed" : ids[0];
    track(`${tag}_game_start_${mode}`);
    if (mode === "party") track(`party_${G.players.length}`);
    track(`difficulty_${DB.prefs.difficulty}`);
    if (ids.length === 1 && PACK_DEFS[ids[0]].filter) { const v = filterValues(ids[0]); track(`${ids[0]}_filter_${v.length === PACK_DEFS[ids[0]].filter.options.length ? "all" : v.join("+")}`); }
  } else if (mode === "daily") track(`${ids[0]}_daily_start`);
  show("gameScreen"); startRound();
}
function nextItem() {
  const ids = G.packIds;
  let id = ids.length === 1 ? ids[0] : ids[Math.floor(Math.random() * ids.length)];
  if ((G.mode === "solo" || G.mode === "party") && !G.decks[id].length) { G.decks[id] = freshDeck(id, pool(id)); const d = G.decks[id]; if (G.item && d.length > 1 && d[0].id === G.item.id) d.push(d.shift()); }
  return G.decks[id].shift();
}

function preload(urls, timeout = 3500) {
  return Promise.race([Promise.all(urls.filter(Boolean).map(u => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = u; }))), sleep(timeout)]);
}
async function countdown(label) {
  const ov = $("#countdown"), num = $("#cdNum"); $("#cdLabel").textContent = label; ov.hidden = false;
  for (const v of ["3", "2", "1", "Action!"]) {
    num.textContent = v; num.className = "num" + (v === "Action!" ? " action" : ""); void num.offsetWidth; num.classList.add("go");
    v === "Action!" ? sfx.action() : sfx.count(); buzz(v === "Action!" ? 40 : 15);
    await sleep(v === "Action!" ? 520 : 560);
  }
  ov.hidden = true;
}

async function startRound() {
  const token = ++G.token;
  G.item = nextItem(); G.roundNo += 1;
  const P = G.item.pk, def = P.def;
  if (G.mode === "solo" || G.mode === "party") markSeen(G.item);
  const rng = G.mode === "daily" ? mulberry32(hash(todayKey() + P.id + G.item.id)) : Math.random;
  G.diff = G.mode === "practice" ? "easy" : G.mode === "daily" ? "medium" : DB.prefs.difficulty === "mixed" ? ["easy", "medium", "hard"][Math.floor(Math.random() * 3)] : DB.prefs.difficulty;
  G.plan = def.plan(G.item, G.diff, rng);
  Object.assign(G, { stage: 0, wrong: 0, tried: [], over: true, paused: false, lastSec: null, giveUpArmed: false, credit: -1, whoPending: null, frozenP: null, whoAt: 0, partialHit: false });
  G.cur = G.mode === "party" && G.pstyle === "turns" ? (G.roundNo - 1) % G.players.length : -1;
  voiceStop();

  ui.reset(); $("#tried").hidden = true; $("#coach").hidden = true; $("#guessInput").value = ""; hideSugg(); feedback("");
  $("#guessInput").placeholder = `Search any ${def.unit}`;
  $("#mixChip").hidden = G.packIds.length < 2; $("#mixChip").textContent = def.name;
  $("#ring").classList.remove("low"); $("#ring").hidden = G.mode === "practice";
  updateHud(); renderActHeader();

  const total = G.mode === "daily" ? DAILY_COUNT : G.mode === "party" ? G.totalRounds : 0;
  const label = G.mode === "daily" ? `${def.name} daily #${dailyNumber()} · ${G.roundNo} of ${DAILY_COUNT}`
    : G.mode === "practice" ? "Practice round"
    : G.mode === "party" ? `${G.cur >= 0 ? `${G.players[G.cur].name}'s turn · ` : ""}${G.packIds.length > 1 ? def.name + " · " : ""}Round ${G.roundNo} of ${total}`
    : `${def.name} · Round ${G.roundNo}`;
  await Promise.all([preload(G.plan.preload || []), countdown(label)]);
  if (token !== G.token) return;

  def.render(G.plan, 0, ui, G.item);
  G.over = false; G.stageStart = performance.now(); G.filmStart = G.stageStart;
  if (G.mode === "practice") { G.coachStep = 0; coach(); } else tick();
  syncVoice();
  if (matchMedia("(hover: hover)").matches) $("#guessInput").focus({ preventScroll: true });
  // warm up the next round's pictures
  const nextId = G.packIds[0], nx = G.decks[nextId] && G.decks[nextId][0];
  if (nx && nx.cast) nx.cast.slice(0, 8).forEach(c => { new Image().src = c.photo; });
}

function renderActHeader() {
  const a = cur().def.acts[G.stage];
  $("#actTitle").innerHTML = `${esc(a.n)} <em>· ${esc(a.name)}</em>`; $("#actHint").textContent = a.hint;
  $$("#bars b").forEach((b, i) => { b.style.transform = i < G.stage ? "scaleX(1)" : "scaleX(0)"; });
  $("#nextActBtn").textContent = G.stage === 3 ? "Give up" : "Next clue now";
  $("#nextActBtn").hidden = G.mode === "practice";
  $("#skipBtn").hidden = G.mode !== "solo" && G.mode !== "party";
  $("#skipBtn").disabled = G.mode === "solo" && G.skipsLeft <= 0;
  $("#skipBtn").textContent = G.mode === "party" ? "Skip" : G.skipsLeft > 0 ? `Skip · ${G.skipsLeft} left` : "No skips left";
  updateHintLine(); $("#worthNum").textContent = worth();
}
function renderStage() { cur().def.render(G.plan, G.stage, ui, G.item); renderActHeader(); }

function points(now = performance.now()) {
  const base = BASES[G.stage], left = Math.max(0, 1 - (now - G.stageStart) / G.stageMs);
  return { base, bonus: G.mode === "practice" ? 0 : Math.round(base * .5 * left), penalty: G.wrong * PENALTY };
}
const worth = () => { const p = points(); return Math.max(0, p.base + p.bonus - p.penalty); };
const mult = () => Math.min(2, 1 + .1 * G.streak);
const maxWrong = () => G.diff === "supereasy" ? 4 : MAX_WRONG;

function tick() {
  cancelAnimationFrame(G.raf);
  if (G.over || G.paused || G.mode === "practice") return;
  const now = performance.now(), el = now - G.stageStart, left = Math.max(0, G.stageMs - el), secs = Math.ceil(left / 1000);
  $("#ringNum").textContent = secs; $("#ringProg").style.strokeDashoffset = String(125.66 * (1 - left / G.stageMs));
  $("#ring").setAttribute("aria-label", `${secs} seconds left in this clue`);
  const low = secs <= 5 && left > 0; $("#ring").classList.toggle("low", low);
  if (low && secs !== G.lastSec) { G.lastSec = secs; sfx.tick(); buzz(18); }
  const bar = $$("#bars b")[G.stage]; if (bar) bar.style.transform = `scaleX(${Math.min(1, el / G.stageMs)})`;
  $("#worthNum").textContent = worth();
  const st = document.getElementById("slotTimer"); if (st && G.stage === 0) st.textContent = `in ${secs} second${secs === 1 ? "" : "s"}`;
  if (left <= 0) { advance(); return; }
  G.raf = requestAnimationFrame(tick);
}
function advance() {
  if (G.over) return;
  if (G.stage >= 3) { endRound(false, "time"); return; }
  G.stage += 1; G.stageStart = performance.now(); G.lastSec = null; G.giveUpArmed = false;
  $("#ring").classList.remove("low"); sfx.whoosh(); renderStage(); tick();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && G.autoBase) { stopAuto(); G.autoResume = true; }
  else if (!document.hidden && G.autoResume && onReveal()) { G.autoResume = false; startAuto(); }
  if (G.over || G.mode === "practice" || G.whoPending) { if (!document.hidden) syncVoice(); else voiceStop(); return; }
  if (document.hidden) { G.paused = true; G.pausedAt = performance.now(); cancelAnimationFrame(G.raf); voiceStop(); }
  else if (G.paused) { const d = performance.now() - G.pausedAt; G.stageStart += d; G.filmStart += d; G.paused = false; toast("Paused while you were away. Back to the show."); tick(); syncVoice(); }
});

// ================= practice coach =================
const COACH = [
  "These 3 actors were all in one film. Recognise any of them?",
  "Every {s} seconds a new clue appears. First, a fourth face joins in.",
  "Then everyone's name is revealed.",
  "Last comes the plot. The fewer clues you need, the more points you score.",
  "Now type the film's name and pick it from the list. Take your time, this one isn't scored.",
];
function coach() {
  $("#coach").hidden = false; $("#coachText").textContent = COACH[G.coachStep].replace("{s}", DB.prefs.stageSec);
  $("#coachStep").textContent = `Tip ${G.coachStep + 1} of ${COACH.length}`;
  $("#coachNext").hidden = G.coachStep === COACH.length - 1;
  if (G.coachStep === COACH.length - 1) $("#guessInput").focus({ preventScroll: true });
}
$("#coachNext").addEventListener("click", () => { G.coachStep += 1; if (G.coachStep >= 1 && G.coachStep <= 3) { G.stage = G.coachStep; sfx.whoosh(); renderStage(); } coach(); });

// ================= guessing =================
function feedback(msg, kind = "") { const f = $("#feedback"); f.textContent = msg; f.className = "feedback" + (kind ? " " + kind : ""); }
function updateHintLine() {
  const left = maxWrong() - G.wrong;
  $("#hintLine").textContent = G.mode === "practice" ? "Practice · not scored" : `${left} guess${left === 1 ? "" : "es"} left · worth up to ${worth()}`;
}
function renderTried() { $("#tried").hidden = !G.tried.length; $("#tried").innerHTML = "Not it:" + G.tried.map(t => `<s>${esc(t)}</s>`).join(""); }

function submitGuess(text, year) {
  if (G.over) return;
  const m = G.item, def = m.pk.def;
  text = (text ?? $("#guessInput").value).trim();
  if (!text) { feedback(`Type a ${def.unit} first.`, "bad"); return; }
  hideSugg();
  if (matches(text, m)) {
    if (year && m.year && def.years && Math.abs(year - m.year) > 1) { soClose("So close! Right title, different year."); return; }
    correctGuess(); return;
  }
  if (groupMatch(text, m)) { correctGuess(true); return; }
  if (nearMatch(text, m)) { soClose(`So close! ${def.nearText}.`); return; }
  if (def.years && nearMiss(text, m)) { soClose("So close! It's a related one. Think again."); return; }
  G.wrong += 1; G.tried.push(text); renderTried();
  const inp = $("#guessInput"); inp.value = ""; inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
  sfx.wrong(); buzz([40, 50, 40]);
  if (G.mode !== "practice") { const f = document.createElement("span"); f.className = "float"; f.textContent = `−${PENALTY}`; $(".guess-row").appendChild(f); setTimeout(() => f.remove(), 1000); }
  if (G.mode === "practice") { feedback(G.wrong >= 2 ? `Not it. Hint: it starts with “${m.title[0]}”.` : "Not it. Try again.", "bad"); if (G.wrong >= 4) endRound(false, "guesses"); return; }
  if (G.wrong >= maxWrong()) { endRound(false, "guesses"); return; }
  feedback(`Not it. ${maxWrong() - G.wrong} guess${maxWrong() - G.wrong === 1 ? "" : "es"} left.`, "bad"); updateHintLine(); $("#worthNum").textContent = worth();
}
function soClose(msg) { $("#guessInput").value = ""; feedback(msg, "near"); sfx.near(); buzz(25); }
function correctGuess(partial = false) {
  if (G.over || G.whoPending) return;
  G.partialHit = !!partial;
  if (G.mode === "party" && G.pstyle === "shout") { askWho(); return; }
  endRound(true);
}
function askWho() {
  const now = performance.now();
  G.whoPending = { at: now }; G.frozenP = points(now); cancelAnimationFrame(G.raf); voiceStop(); hideSugg();
  sfx.near(); buzz(40);
  $("#whoKicker").textContent = `Correct! It's ${G.item.title}`;
  const w = Math.round(Math.max(0, G.frozenP.base + G.frozenP.bonus - G.frozenP.penalty) * (G.partialHit ? PARTIAL_SHARE : 1) * (DIFF_MULT[G.diff] || 1));
  $("#whoPts").textContent = `Worth ${w} points${G.partialHit ? ` · ${G.item.pk.def.partial.toLowerCase()}` : ""}`;
  $("#whoList").innerHTML = G.players.map((pl, i) => `<button data-who="${i}"><span class="dot" style="background:${pl.color}" aria-hidden="true"></span>${esc(pl.name)}</button>`).join("");
  $("#whoSheet").hidden = false;
}
$("#whoList").addEventListener("click", e => { const b = e.target.closest("button[data-who]"); if (!b) return; $("#whoSheet").hidden = true; G.credit = +b.dataset.who; G.whoAt = G.whoPending.at; G.whoPending = null; endRound(true); });
$("#whoNobody").addEventListener("click", () => { $("#whoSheet").hidden = true; const d = performance.now() - G.whoPending.at; G.stageStart += d; G.filmStart += d; G.whoPending = null; G.frozenP = null; feedback("Keep going!"); tick(); syncVoice(); });

// ----- autocomplete -----
function activeTitles() { const out = []; G.packIds.forEach(id => PACKS[id] && out.push(...PACKS[id].titles)); return out; }
function renderSugg() {
  const q = normalize($("#guessInput").value); if (q.length < 2) { hideSugg(); return; }
  const out = [];
  for (const t of activeTitles()) { const n = normalize(t.title); const i = n.indexOf(q); if (i < 0) continue; out.push([i === 0 ? 0 : n.includes(" " + q) ? 1 : 2, t]); }
  out.sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title));
  const list = out.slice(0, 5).map(x => x[1]); if (!list.length) { hideSugg(); return; }
  $("#sugg").innerHTML = list.map(t => `<button type="button" role="option" data-t="${esc(t.title)}" data-y="${t.year ?? ""}">${esc(t.title)}<span>${esc(t.tag || t.year || "")}</span></button>`).join("");
  $("#sugg").hidden = false;
}
function hideSugg() { $("#sugg").hidden = true; $("#sugg").innerHTML = ""; }
$("#guessInput").addEventListener("input", renderSugg);
$("#guessInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitGuess(); } if (e.key === "Escape") hideSugg(); });
$("#guessBtn").addEventListener("click", () => submitGuess());
$("#sugg").addEventListener("click", e => { const b = e.target.closest("button[data-t]"); if (!b) return; $("#guessInput").value = b.dataset.t; submitGuess(b.dataset.t, Number(b.dataset.y) || null); });
document.addEventListener("click", e => { if (!e.target.closest(".guess-row")) hideSugg(); });
$("#nextActBtn").addEventListener("click", () => {
  if (G.over) return;
  if (G.stage < 3) { advance(); return; }
  if (!G.giveUpArmed) { G.giveUpArmed = true; $("#nextActBtn").textContent = "Tap again to give up"; setTimeout(() => { G.giveUpArmed = false; if (!G.over && G.stage === 3) $("#nextActBtn").textContent = "Give up"; }, 3000); return; }
  endRound(false, "gaveup");
});
$("#skipBtn").addEventListener("click", () => {
  if (G.over || G.whoPending) return;
  if (G.mode === "party") { endRound(false, "skipped"); return; }
  if (G.mode !== "solo" || G.skipsLeft <= 0) return;
  G.skipsLeft -= 1; endRound(false, "skipped");
});
$("#quitBtn").addEventListener("click", () => {
  if (!G.over && G.mode !== "practice" && !$("#quitBtn").dataset.armed) { $("#quitBtn").dataset.armed = "1"; toast("Tap ✕ again to leave. This game won't be saved."); setTimeout(() => { delete $("#quitBtn").dataset.armed; }, 3000); return; }
  delete $("#quitBtn").dataset.armed; G.over = true; G.token++; cancelAnimationFrame(G.raf); $("#countdown").hidden = true; $("#whoSheet").hidden = true; G.whoPending = null; voiceStop();
  G.mode === "party" ? goHub() : goHome();
});

// ================= HUD =================
function updateHud() {
  const solo = G.mode === "solo";
  $("#hudLives").hidden = !solo; $("#hudMode").hidden = solo;
  $("#hudLives").innerHTML = Array.from({ length: LIVES }, (_, i) => starSvg(i >= G.lives)).join("");
  $("#hudLives").setAttribute("aria-label", `${G.lives} of ${LIVES} lives left`);
  $("#hudMode").textContent = G.mode === "daily" ? `Daily · ${G.roundNo || 1}/${DAILY_COUNT}` : G.mode === "party" ? `Round ${G.roundNo || 1}/${G.totalRounds}` : "Practice";
  if (G.mode === "party") {
    if (G.cur >= 0) { const pl = G.players[G.cur]; $("#hudScore").textContent = pl.score.toLocaleString(); $("#hudStreak").textContent = `${pl.name}'s turn`; }
    else { const lead = [...G.players].sort((a, b) => b.score - a.score)[0]; $("#hudScore").textContent = lead.score.toLocaleString(); $("#hudStreak").textContent = lead.score ? `${lead.name} leads` : "Shout it out!"; }
    return;
  }
  $("#hudScore").textContent = G.score.toLocaleString();
  $("#hudStreak").textContent = G.streak ? `×${mult().toFixed(1)} streak` : "No streak yet";
}

// ================= end of round =================
function recordStats(m, won) {
  if (G.mode === "practice" || G.mode === "party") return;
  const s = packStats(m.pk.id); s.seen++; if (won) { s.won++; s.clueSum += G.stage + 1; }
  const bump = (obj, k) => { obj[k] = obj[k] || { seen: 0, won: 0 }; obj[k].seen++; if (won) obj[k].won++; };
  if (m.cat) bump(s.cat, m.cat); if (m.year) bump(s.dec, decadeOf(m.year)); save();
}
function endRound(won, reason) {
  if (G.over) return;
  G.over = true; cancelAnimationFrame(G.raf); hideSugg(); $("#guessInput").blur(); $("#coach").hidden = true; voiceStop();
  const m = G.item, pid = m.pk.id, p = G.frozenP || points(), mu = G.mode === "party" ? 1 : mult(), dm = DIFF_MULT[G.diff] || 1, share = G.partialHit ? PARTIAL_SHARE : 1;
  let pts = 0, badge = null, lostStar = false;
  if (G.mode === "practice") { showReveal({ won, reason, pts: 0, p, m: 1 }); return; }
  if (reason === "skipped") track(`${pid}_film_skipped`);
  else if (won) { track(`${pid}_film_guessed_stage_${G.stage + 1}`); if (G.partialHit) track(`${pid}_film_series_match`); }
  else track(`${pid}_film_missed`);
  if (G.mode === "party") {
    const who = G.cur >= 0 ? G.cur : G.credit;
    if (won && who >= 0) {
      pts = Math.round(Math.max(0, p.base + p.bonus - p.penalty) * share * dm); const pl = G.players[who];
      pl.score += pts; pl.nailed += 1; if (G.stage === 0) pl.first += 1; if (G.stage === 3) pl.last += 1;
      pl.fastest = Math.min(pl.fastest, (G.whoAt || performance.now()) - G.filmStart); G.credit = who;
    }
    updateHud(); showReveal({ won: won && who >= 0, reason: won && who < 0 ? "nobody" : reason, pts, p, m: 1 }); return;
  }
  if (won) {
    pts = Math.round(Math.max(0, p.base + p.bonus - p.penalty) * mu * share * dm);
    G.score += pts; G.streak += 1; G.runBest = Math.max(G.runBest, G.streak); G.nailed.push(m); badge = STREAK_BADGES[G.streak] || null;
  } else if (reason === "skipped") {
    G.streak = 0; G.skipped.push(m); const s = packStats(pid); s.skips = (s.skips || 0) + 1; save();
    updateHud(); showReveal({ won, reason, pts, p, m: mu }); return;
  } else { G.streak = 0; G.missed.push(m); if (G.mode === "solo") { G.lives -= 1; lostStar = true; } }
  if (G.mode === "daily") G.results.push({ id: m.id, title: m.title, year: m.year, won, clue: won ? G.stage + 1 : 0, pts });
  recordStats(m, won); updateHud();
  showReveal({ won, reason, pts, p, m: mu, badge, lostStar });
}
let countToken = 0;
function countUp(el, to, ms = 900) {
  const tk = ++countToken;
  if (rm() || to <= 0) { el.textContent = `+${to}`; return; }
  const start = performance.now(); (function f(now) { if (tk !== countToken) return; const k = Math.min(1, (now - start) / ms); el.textContent = `+${Math.round(to * (1 - Math.pow(1 - k, 3)))}`; if (k < 1) requestAnimationFrame(f); })(start);
}

function showReveal({ won, reason, pts, p, m, badge, lostStar }) {
  const item = G.item, def = item.pk.def, r = def.reveal(item);
  $("#revVisual").innerHTML = r.img ? `<img class="poster${r.wide ? " flagpic" : ""}" id="revPoster" alt="${esc(item.title)}" src="${esc(r.img)}"><div class="shimmer" id="revShimmer" hidden></div>` : `${r.html}<div class="shimmer" id="revShimmer" hidden></div>`;
  const poster = $("#revPoster"); if (poster) poster.className = "poster" + (r.wide ? " flagpic" : "") + (won ? " flip" : " miss");
  $("#revTitle").textContent = item.title; $("#revMeta").textContent = r.meta || "";
  let tier, tierCls = "tier";
  if (G.mode === "practice") tier = won ? "You've got it. You're ready for the real show." : "Now you know. You're ready for the real show.";
  else if (reason === "skipped") { tier = G.mode === "party" ? "Skipped" : `Skipped · ${G.skipsLeft} skip${G.skipsLeft === 1 ? "" : "s"} left`; tierCls += " miss"; }
  else if (!won) { tier = reason === "guesses" ? "Out of guesses. Now you know." : reason === "gaveup" ? "Curtain down. Now you know." : reason === "nobody" ? "Nobody got it. Now you know." : "Out of time. Now you know."; tierCls += " miss"; }
  else if (G.stage === 0) tier = "Standing ovation"; else if (G.stage <= 2) tier = "Curtain call"; else tier = "Just made it";
  if (won && G.mode !== "practice" && def.partial && item.g && item.pk.groups[item.g]) tier = G.partialHit ? `${def.partial}! It was this one · ${Math.round(PARTIAL_SHARE * 100)}% points` : `${tier} · Exact ${def.unit}!`;
  if (G.mode === "party" && won) tier = `${G.players[G.credit].name} · ${tier}`;
  $("#revTier").className = tierCls; $("#revTier").textContent = tier;
  if (won && G.mode !== "practice") {
    const dm = DIFF_MULT[G.diff] || 1;
    const third = G.partialHit && !p.penalty ? [`×${PARTIAL_SHARE}`, def.partial.replace("Right ", "")] : [p.penalty ? `−${p.penalty}` : "0", `${G.wrong} miss${G.wrong === 1 ? "" : "es"}`, p.penalty ? "var(--coral)" : ""];
    const last = G.mode === "party" ? [esc(G.players[G.credit].name), dm !== 1 ? `Point to · ×${dm}` : "Point to"] : [`×${(m * dm).toFixed(1)}`, dm !== 1 ? "Streak × super easy" : "Streak"];
    $("#revBreak").hidden = false;
    $("#revBreak").innerHTML = [[p.base, `${roman(G.stage)} clue`], [`+${p.bonus}`, "Speed"], third, last].map(([v, l, c]) => `<div><b style="${c ? `color:${c}` : ""}">${v}</b><small>${l}</small></div>`).join("");
  } else $("#revBreak").hidden = true;
  const ptsEl = $("#revPts"); ptsEl.style.color = won ? "var(--gold)" : "var(--dim)"; ptsEl.hidden = G.mode === "practice"; countUp(ptsEl, pts);
  $("#revTotal").textContent = G.mode === "practice" || G.mode === "party" ? "" : `Total ${G.score.toLocaleString()}`;
  renderBoard();
  $("#revBadge").innerHTML = "";
  $("#revLives").hidden = G.mode !== "solo";
  $("#revLives").innerHTML = Array.from({ length: LIVES }, (_, i) => i < G.lives ? starSvg(false) : (lostStar && i === G.lives ? starSvg(false, "drop") : starSvg(true))).join("");
  $("#revLives").setAttribute("aria-label", `${G.lives} of ${LIVES} lives left`);
  $("#revStarring").innerHTML = r.more || "";
  $("#reportBtn").textContent = `Report a problem with this ${def.unit}`;
  const nb = $("#revNextLbl"), U = def.unit[0].toUpperCase() + def.unit.slice(1);
  if (G.mode === "practice") nb.textContent = "Go to the main menu";
  else if (G.mode === "daily") nb.textContent = G.roundNo < DAILY_COUNT ? `Next (${G.roundNo + 1} of ${DAILY_COUNT})` : "See today's result";
  else if (G.mode === "party") nb.textContent = G.roundNo >= G.totalRounds ? "See the winners" : G.pstyle === "turns" ? `Pass to ${G.players[G.roundNo % G.players.length].name}` : `Next round (${G.roundNo + 1} of ${G.totalRounds})`;
  else nb.textContent = G.lives > 0 ? `Next ${G.packIds.length > 1 ? "round" : def.unit}` : "See the awards";
  void U;
  show("revealScreen");
  if (won && G.mode !== "practice") {
    if (G.stage === 0) { winChime(3); buzz([90, 50, 90, 50, 200]); confetti(180); }
    else if (G.stage <= 2) { winChime(2); buzz(60); if (!rm() && $("#revShimmer")) $("#revShimmer").hidden = false; }
    else { winChime(1); buzz(30); }
  } else if (won) { winChime(2); confetti(90); }
  else if (reason === "skipped") sfx.whoosh(); else { sfx.miss(); buzz(120); }
  stopAuto(); G.autoResume = false; startAuto();
  if (badge) setTimeout(() => { $("#revBadge").innerHTML = `<div class="badge">${starSvg()}<b>${badge}</b><span class="muted" style="font-size:13px">${G.streak} in a row</span></div>`; sfx.badge(); buzz([30, 30, 60]); }, 900);
  setTimeout(() => $("#revNext").focus({ preventScroll: true }), 200);
}

// ----- auto next -----
function onReveal() { return $("#revealScreen").classList.contains("active") && G.mode !== "practice"; }
function startAuto() {
  const nb = $("#revNextLbl");
  const more = (G.mode === "solo" && G.lives > 0) || (G.mode === "daily" && G.roundNo < DAILY_COUNT) || (G.mode === "party" && G.roundNo < G.totalRounds);
  if (!more || DB.prefs.autoNext === false) return;
  if (document.hidden) { G.autoResume = true; return; }
  const tk = G.token, base = nb.textContent, btn = $("#revNext"); let left = 3;
  btn.classList.remove("auto"); void btn.offsetWidth; btn.classList.add("auto");
  nb.textContent = `${base} · ${left}`; $("#revStay").hidden = false;
  G.autoTick = setInterval(() => { left -= 1; if (left > 0) nb.textContent = `${base} · ${left}`; }, 1000);
  G.autoNext = setTimeout(() => { stopAuto(); if (tk === G.token && onReveal()) $("#revNext").click(); }, 3000);
  G.autoBase = base;
}
function stopAuto() { clearTimeout(G.autoNext); clearInterval(G.autoTick); $("#revNext").classList.remove("auto"); $("#revStay").hidden = true; if (G.autoBase) $("#revNextLbl").textContent = G.autoBase; G.autoBase = null; }
$("#revStay").addEventListener("click", () => { stopAuto(); G.autoResume = false; toast("Take your time. Tap Next when you're ready."); });
$("#revNext").addEventListener("click", () => {
  stopAuto(); G.autoResume = false;
  if (G.mode === "practice") { goHub(); toast("You're all set. Enjoy the show!"); return; }
  if (G.mode === "daily") { if (G.roundNo < DAILY_COUNT) { show("gameScreen"); startRound(); } else finishDaily(); return; }
  if (G.mode === "party") { if (G.roundNo < G.totalRounds) { show("gameScreen"); startRound(); } else showPodium(); return; }
  if (G.lives <= 0) { gameOver(); return; }
  show("gameScreen"); startRound();
});

// ================= report a problem =================
const REPORT_KEY = "guessnight.reports", APP_VERSION = "4.0";
let reportReason = "";
$("#reportBtn").addEventListener("click", () => {
  stopAuto(); G.autoResume = false; reportReason = "";
  const def = G.item.pk.def;
  $("#reportFilm").textContent = `${def.name}: ${G.item.title}${G.item.year ? ` (${G.item.year})` : ""}`;
  $("#reportReasons").innerHTML = def.reasons.map(r => `<button data-reason="${esc(r)}" aria-pressed="false">${esc(r === "Other" ? "Something else" : r)}</button>`).join("");
  $("#reportNote").value = ""; $("#reportSend").disabled = true; $("#reportSheet").hidden = false;
});
$("#reportReasons").addEventListener("click", e => { const b = e.target.closest("button[data-reason]"); if (!b) return; reportReason = b.dataset.reason; $$("#reportReasons button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#reportSend").disabled = false; });
$("#reportSheet").addEventListener("click", e => { if (e.target.id === "reportSheet" || e.target.closest("[data-close]")) $("#reportSheet").hidden = true; });
$("#reportSend").addEventListener("click", () => {
  const m = G.item, def = m.pk.def, note = $("#reportNote").value.trim();
  const shown = G.plan && G.plan.initial ? [...G.plan.initial, G.plan.extra].filter(Boolean).map(c => `${c.name} (#${c.order})`).join(", ") : "";
  const report = { cat: m.pk.id, id: m.id, title: m.title, year: m.year, reason: reportReason, note, clue: G.stage + 1, mode: G.mode, difficulty: G.diff, at: new Date().toISOString(), v: APP_VERSION };
  try { const list = JSON.parse(localStorage.getItem(REPORT_KEY) || "[]"); list.push(report); localStorage.setItem(REPORT_KEY, JSON.stringify(list.slice(-200))); } catch { /* ignore */ }
  const title = `Bad clue (${def.name}): ${m.title}${m.year ? ` (${m.year})` : ""} – ${reportReason}`;
  const body = [`**Category:** ${def.name}`, `**Answer:** ${m.title}${m.year ? ` (${m.year})` : ""}, id ${m.id}`, `**Problem:** ${reportReason}`, note ? `**Note:** ${note}` : "", `**Ended at clue:** ${G.stage + 1} of 4`, shown ? `**Shown:** ${shown}` : "", `**Mode / difficulty:** ${G.mode} / ${G.diff}`, `**App version:** ${APP_VERSION}`].filter(Boolean).join("\n");
  window.open(`https://github.com/shyam310195/castguess/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bad-clue`, "_blank", "noopener");
  track(`${m.pk.id}_report_problem`);
  $("#reportSheet").hidden = true; toast("Thanks, reported. It helps fix the game.");
});

// ================= party scoreboard & podium =================
const PCOLORS = ["#E2C27A", "#F08A6C", "#7CC4C9", "#B9A3E8", "#8FD19E", "#F2A7C3", "#9DB4F0", "#E8D3A0"];
function partyNames() { const pp = DB.prefs.party; return Array.from({ length: pp.count }, (_, i) => (pp.names[i] || "").trim() || `Player ${i + 1}`); }
function ranked() { return G.players.map((pl, i) => ({ ...pl, i })).sort((a, b) => b.score - a.score || b.nailed - a.nailed); }
function renderBoard() {
  const board = $("#revBoard");
  if (G.mode !== "party") { board.hidden = true; return; }
  const r = ranked(), prev = G.prevRanks || {};
  board.hidden = false;
  board.innerHTML = r.map((pl, k) => {
    const was = prev[pl.i], chg = was == null ? "" : was > k ? `<span class="up">▲${was - k}</span>` : was < k ? `<span class="down">▼${k - was}</span>` : "";
    return `<div class="bro${k === 0 && pl.score > 0 ? " lead" : ""}" style="animation-delay:${k * 60}ms"><span class="rank">${k + 1}</span><span class="dot" style="background:${pl.color}" aria-hidden="true"></span><span>${esc(pl.name)}</span><b>${pl.score}</b><span class="chg">${chg}</span></div>`;
  }).join("");
  G.prevRanks = Object.fromEntries(r.map((pl, k) => [pl.i, k]));
}
function showPodium() {
  track(`game_over_${roundsBucket(G.roundNo)}`);
  const r = ranked(), top = r[0], tie = r.length > 1 && r[1].score === top.score;
  $("#podTitle").textContent = top.score === 0 ? "Nobody… yet" : tie ? "It's a tie!" : top.name;
  $("#podSub").textContent = top.score === 0 ? "Nothing guessed. Rematch?" : tie ? `${r.filter(x => x.score === top.score).map(x => x.name).join(" and ")} share the crown with ${top.score} points` : `${top.score} points · ${top.nailed} guessed`;
  const order = [r[1], r[0], r[2]], heights = [96, 132, 72];
  $("#podium").innerHTML = order.map((pl, k) => pl ? `<div class="col"><span class="dot" style="background:${pl.color};width:16px;height:16px" aria-hidden="true"></span><div class="nm">${esc(pl.name)}</div><div class="muted" style="font-size:13px">${pl.score}</div><div class="blk" style="height:${heights[k]}px;animation-delay:${k * 150}ms">${[2, 1, 3][k]}</div></div>` : `<div></div>`).join("");
  $("#podBoard").innerHTML = r.slice(3).map((pl, k) => `<div class="bro"><span class="rank">${k + 4}</span><span class="dot" style="background:${pl.color}" aria-hidden="true"></span><span>${esc(pl.name)}</span><b>${pl.score}</b><span></span></div>`).join("");
  const best = (key, ok) => { const c = G.players.filter(pl => ok(pl[key])); if (!c.length) return null; return c.sort((a, b) => key === "fastest" ? a[key] - b[key] : b[key] - a[key])[0]; };
  const quick = best("fastest", v => v < Infinity), hero = best("first", v => v > 0), nail = best("last", v => v > 0);
  $("#podAwards").innerHTML = [["Quickest draw", quick ? `${quick.name} · ${(quick.fastest / 1000).toFixed(1)}s` : "Nobody this time"], ["Clue 1 hero", hero ? `${hero.name} · ${hero.first} on the first clue` : "Nobody this time"], ["Nail-biter", nail ? `${nail.name} · ${nail.last} on the last clue` : "Nobody this time"]]
    .map(([a, b]) => `<div><b>${a}</b><span>${esc(b)}</span></div>`).join("");
  show("podiumScreen");
  if (top.score > 0) { confetti(200); winChime(3); buzz([90, 50, 90, 50, 200]); } else sfx.chime();
}
$("#podRematch").addEventListener("click", () => startGame("party", G.packIds));
$("#podHome").addEventListener("click", () => goHub());

// ================= solo game over =================
function shareText(text) { track("share_clicked"); if (navigator.share) { navigator.share({ text }).catch(() => {}); return; } copyText(text); }
function copyText(text) {
  const done = () => toast("Copied. Paste it anywhere to share.");
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("Couldn't copy. Select the text and copy it yourself."); } ta.remove();
}
function gameOver() {
  const pid = G.packIds[0], def = PACK_DEFS[pid], rec = packRecords(pid);
  track(`${pid}_game_over_${roundsBucket(G.roundNo)}`);
  const prev = rec.best, isBest = G.score > prev;
  if (isBest) rec.best = G.score; if (G.runBest > rec.bestStreak) rec.bestStreak = G.runBest; save();
  $("#overName").textContent = DB.prefs.nickname || "You";
  $("#overScore").textContent = G.score.toLocaleString();
  $("#overAward").innerHTML = isBest && G.score > 0 ? `<div class="award"><div class="label gold">New award</div><div class="title" style="font-size:24px;margin-top:6px">Personal best · ${esc(def.name)}</div><div class="muted" style="font-size:13px;margin-top:4px">Previous best: ${prev.toLocaleString()}</div></div>` : "";
  $("#overNailedLabel").textContent = `${def.units[0].toUpperCase() + def.units.slice(1)} nailed`;
  $("#overNailed").textContent = `${G.nailed.length} of ${G.nailed.length + G.missed.length + G.skipped.length}`;
  $("#overStreak").textContent = G.runBest;
  const line = (label, list, bold) => list.length ? `<div style="margin-top:10px"><span class="label">${label}</span><br>${list.map(m => bold ? `<b>${esc(m.title)}</b>` : `${esc(m.title)}${m.year ? ` (${m.year})` : ""}`).join(", ")}</div>` : "";
  $("#overLists").innerHTML = line("Nailed", G.nailed, true) + line("Missed", G.missed) + line("Skipped", G.skipped);
  show("overScreen");
  if (isBest && G.score > 0) { confetti(140); winChime(3); buzz([80, 40, 160]); } else sfx.chime();
}
$("#overAgain").addEventListener("click", () => startGame("solo", G.packIds));
$("#overHome").addEventListener("click", () => goHome());
$("#overShare").addEventListener("click", () => { const def = PACK_DEFS[G.packIds[0]]; shareText(`I scored ${G.score.toLocaleString()} on Guess Night (${def.name}) and named ${G.nailed.length} ${G.nailed.length === 1 ? def.unit : def.units}. Can you beat me? 🎬`); });

// ================= daily =================
const SQ = ["⬛", "🟨", "🟧", "🟫", "🟥"];
function finishDaily() {
  const pid = G.packIds[0], score = G.results.reduce((a, r) => a + r.pts, 0);
  packDaily(pid)[todayKey()] = { n: dailyNumber(), results: G.results, score }; save();
  track(`${pid}_daily_done`); showDailyResult(pid);
  if (G.results.filter(r => r.won).length >= 4) { confetti(150); winChime(3); } else sfx.chime();
}
function dailyShareText(pid, d) {
  const won = d.results.filter(r => r.won).length, first = d.results.filter(r => r.clue === 1).length;
  return `Guess Night · ${PACK_DEFS[pid].name} daily #${d.n} · ${won}/${DAILY_COUNT}${first ? ` · ${first} on the first clue` : ""}\n${d.results.map(r => SQ[r.clue]).join("")}\n${d.score} points`;
}
let dailyShown = null;
function showDailyResult(pid) {
  const d = packDaily(pid)[todayKey()]; if (!d) { goHome(); return; }
  dailyShown = pid;
  const won = d.results.filter(r => r.won).length, first = d.results.filter(r => r.clue === 1).length;
  $("#dailyKicker").textContent = `${PACK_DEFS[pid].name} · daily challenge`;
  $("#dailyTitle").textContent = `#${d.n} · ${won} of ${DAILY_COUNT}`;
  $("#dailySub").textContent = `${d.score} points${first ? ` · ${first} on the first clue` : ""}`;
  $("#dailySquares").innerHTML = d.results.map(r => `<i class="sq${r.clue}" aria-label="${esc(r.title)}: ${r.won ? `solved on clue ${r.clue}` : "missed"}">${r.won ? r.clue : "–"}</i>`).join("");
  $("#dailyFilms").innerHTML = d.results.map(r => `${r.won ? "<b>" : ""}${esc(r.title)}${r.won ? "</b>" : ""} <span style="color:var(--dim)">${r.year ?? ""}</span>`).join(" · ");
  $("#dailyShare").textContent = dailyShareText(pid, d);
  show("dailyScreen");
}
$("#dailyShareBtn").addEventListener("click", () => { const d = packDaily(dailyShown)[todayKey()]; if (d) shareText(dailyShareText(dailyShown, d)); });
$("#dailyCopyBtn").addEventListener("click", () => { track("share_clicked"); const d = packDaily(dailyShown)[todayKey()]; if (d) copyText(dailyShareText(dailyShown, d)); });
