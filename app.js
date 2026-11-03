/* Guess Night: screens around the game (onboarding, hub, category home, party setup, voice, stats, settings, about). */
"use strict";

const catName = id => PACK_DEFS[id].name;
const PRESETS = {
  movies: [["All years", null, null], ["2000+", 2000, null], ["1990+", 1990, null], ["1970–1999", 1970, 1999], ["Before 1970", null, 1969]],
  tv: [["All years", null, null], ["2010+", 2010, null], ["2000+", 2000, null], ["Before 2000", null, 1999]],
};

// ================= onboarding =================
const ob = { level: "medium" };
function suggestNick() { return `${NICKS[Math.floor(Math.random() * NICKS.length)]} ${Math.floor(Math.random() * 90 + 10)}`; }
function catCard(id, opts = {}) {
  const d = PACK_DEFS[id], ready = packReady(id), m = MANIFEST[id] || {};
  const done = ready && packDaily(id)[todayKey()];
  return `<button class="cat-card" data-cat="${id}" ${ready && !opts.static ? "" : opts.static ? 'tabindex="-1"' : "disabled"}>
    ${ready ? "" : '<span class="soon">Coming soon</span>'}
    <span class="ic">${ICONS[id]}</span><strong>${esc(d.name)}</strong><small>${esc(d.blurb)}${ready && m.count ? ` · ${m.count.toLocaleString()}` : ""}</small>
    ${ready && !opts.static ? `<span class="daily-dot">${done ? `Daily #${dailyNumber()} done · ${done.results.filter(r => r.won).length}/5` : `Daily #${dailyNumber()} waiting`}</span>` : ""}
  </button>`;
}
function finishOnboarding(practice) {
  track("onboarding_done");
  DB.prefs.difficulty = ob.level;
  DB.prefs.nickname = ($("#nickInput").value || "").trim() || DB.prefs.nickname || suggestNick();
  DB.prefs.onboarded = true; save();
  if (practice && packReady("movies")) startGame("practice", ["movies"]); else goHub();
}
$("#ob1Next").addEventListener("click", () => { sfx.unlock(); show("ob2"); });
$$("#ob2 .choice").forEach(b => b.addEventListener("click", () => {
  $$("#ob2 .choice").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  ob.level = b.dataset.level; setTimeout(() => { $("#nickInput").value = DB.prefs.nickname || suggestNick(); show("ob3"); }, 220);
}));
$("#nickShuffle").addEventListener("click", () => { $("#nickInput").value = suggestNick(); });
$("#obPractice").addEventListener("click", () => finishOnboarding(true));
$("#obSkipPractice").addEventListener("click", () => finishOnboarding(false));
$$("[data-skip]").forEach(b => b.addEventListener("click", () => finishOnboarding(false)));
function startOnboarding() {
  ob.level = DB.prefs.difficulty === "mixed" ? "medium" : DB.prefs.difficulty;
  $("#obCats").innerHTML = PACK_ORDER.map(id => catCard(id, { static: true })).join("");
  $$("#ob2 .choice").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.level === ob.level)));
  show("ob1");
}

// ================= hub =================
function goHub() {
  const best = Math.max(0, ...PACK_ORDER.map(id => (DB.records[id] || {}).best || 0));
  $("#hubGreeting").textContent = DB.prefs.nickname ? `Welcome back, ${DB.prefs.nickname}. Pick a category. Four clues. Name it before the curtain falls.` : "Pick a category. Four clues. Name it before the curtain falls.";
  $("#hubRecords").innerHTML = best ? `Best score <b>${best.toLocaleString()}</b>` : "";
  $("#catGrid").innerHTML = PACK_ORDER.map(id => catCard(id)).join("");
  renderMode(); syncVoiceUI();
  show("hubScreen");
}
$("#catGrid").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (!b || b.disabled) return; DB.prefs.cat = b.dataset.cat; save(); goHome(); });
function renderMode() {
  const party = DB.prefs.mode === "party", pp = DB.prefs.party;
  $$("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === DB.prefs.mode)));
  $("#partySetup").hidden = !party; $("#catGrid").hidden = party;
  if (!party) return;
  if (pp.cat !== "mixed" && !packReady(pp.cat)) pp.cat = "movies";
  $("#pCount").textContent = pp.count; $("#pMinus").disabled = pp.count <= 2; $("#pPlus").disabled = pp.count >= 8;
  $("#pNames").innerHTML = Array.from({ length: pp.count }, (_, i) => `<label class="pname"><span class="dot" style="background:${PCOLORS[i]}" aria-hidden="true"></span><span class="sr">Player ${i + 1} name</span><input data-pi="${i}" maxlength="14" placeholder="Player ${i + 1}" value="${esc(pp.names[i] || "")}" autocomplete="off"></label>`).join("");
  const ready = PACK_ORDER.filter(packReady);
  $("#pCats").innerHTML = [...ready.map(id => [id, catName(id)]), ...(ready.length > 1 ? [["mixed", "Mixed round"]] : [])]
    .map(([v, l]) => `<button class="chip" data-v="${v}" aria-pressed="${pp.cat === v}"><svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${esc(l)}</button>`).join("");
  $("#pCatNote").textContent = pp.cat === "mixed" ? `Every round picks a category at random: ${ready.map(catName).join(", ")}.` : `Every round is ${catName(pp.cat).toLowerCase()}. Party choices below are saved separately from solo.`;
  $$("#pStyle button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === pp.style)));
  $("#pStyleNote").textContent = pp.style === "shout" ? "One screen, everyone plays at once. Shout the answer. When it's right, tap who said it. Turn on hands-free voice and the app hears it for you." : "Pass the phone. Each player gets their own round in turn, scored like solo.";
  if (pp.rounds === undefined) pp.rounds = pp.films || 10;
  $("#startParty").textContent = `Start party game · ${pp.count} players`;
  OPT_CTX = "party";
  const ids = pp.cat === "mixed" ? ready : [pp.cat], el = $("#partyOptions");
  if (el.dataset.ids !== ids.join(",") || !el.innerHTML) {
    el.dataset.ids = ids.join(","); el.innerHTML = `<div class="match">Loading options…</div>`;
    Promise.all(ids.map(loadPack)).then(() => { if (el.dataset.ids === ids.join(",")) mountOptions(el, ids, "party"); }).catch(() => { el.innerHTML = `<div class="match low">Couldn't load. Check your connection.</div>`; });
  } else refreshOptions(el);
}
$$("#modeSeg button").forEach(b => b.addEventListener("click", () => { DB.prefs.mode = b.dataset.v; save(); renderMode(); }));
$("#pMinus").addEventListener("click", () => { DB.prefs.party.count = Math.max(2, DB.prefs.party.count - 1); save(); renderMode(); });
$("#pPlus").addEventListener("click", () => { DB.prefs.party.count = Math.min(8, DB.prefs.party.count + 1); save(); renderMode(); setTimeout(() => $(`#pNames [data-pi="${DB.prefs.party.count - 1}"]`)?.focus(), 50); });
$("#pNames").addEventListener("input", e => { const i = e.target.dataset.pi; if (i == null) return; DB.prefs.party.names[+i] = e.target.value; save(); });
$("#pCats").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; DB.prefs.party.cat = b.dataset.v; save(); $("#partyOptions").innerHTML = ""; renderMode(); });
$("#pStyle").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; DB.prefs.party.style = b.dataset.v; save(); renderMode(); });
// ----- rounds slider (party setup + category home) -----
function setRounds(box, val, label) {
  const i = Math.max(0, ROUND_STEPS.indexOf(val));
  box.querySelector("[data-rr]").value = i; box.querySelector("[data-rl]").textContent = label;
  box.querySelector("[data-rv]").textContent = val ? `${val} rounds` : "Endless";
  box.querySelector("[data-rf]").style.right = `${100 - (100 * i / 5)}%`;
}
$("#startParty").addEventListener("click", () => {
  sfx.unlock(); const c = DB.prefs.party.cat;
  if (c !== "mixed" && PACKS[c]) { const n = pool(c, undefined, "party").length; if (n < MIN_POOL) { toast(`Only ${n} match your party choices. Widen them a little.`, 3200); return; } }
  startGame("party", c === "mixed" ? PACK_ORDER.filter(packReady) : [c]);
});

// ================= category home =================
async function goHome() {
  const id = DB.prefs.cat && packReady(DB.prefs.cat) ? DB.prefs.cat : "movies", def = PACK_DEFS[id];
  try { await loadPack(id); } catch { toast("Couldn't load that category. Check your connection."); goHub(); return; }
  OPT_CTX = "solo";
  const P = PACKS[id], rec = packRecords(id);
  $("#homeKicker").textContent = "Guess Night";
  $("#homeTitle").innerHTML = esc(def.name);
  $("#homeGreeting").textContent = def.tagline;
  $("#homeFaces").innerHTML = def.faces(pool(id).length ? pool(id) : P.items).map(f => f.img ? `<img src="${esc(f.img)}" alt="">` : `<span class="face-html">${f.html}</span>`).join("");
  OPT_CTX = "solo";
  mountOptions($("#homeOptions"), [id], "solo");
  $("#homeRecords").innerHTML = `Best <b>${rec.best.toLocaleString()}</b> · Streak <b>${rec.bestStreak}</b>`;
  const done = packDaily(id)[todayKey()];
  $("#dailyCard").innerHTML = done
    ? `<span class="cal">${dailyNumber()}</span><span><strong>${esc(def.name)} daily #${dailyNumber()} done · ${done.results.filter(r => r.won).length}/${DAILY_COUNT}</strong><small>See your result and share it</small></span>`
    : `<span class="cal">${dailyNumber()}</span><span><strong>${esc(def.name)} daily #${dailyNumber()}</strong><small>5 ${def.units}, same for everyone · 15 sec per clue</small></span>`;
  syncVoiceUI();
  show("homeScreen");
}
function bindSeg(sel, key, after) { $$(`${sel} button`).forEach(b => b.addEventListener("click", () => { DB.prefs[key] = b.dataset.v; save(); $$(`${sel} button`).forEach(x => x.setAttribute("aria-pressed", String(x === b))); after && after(); })); }
bindSeg("#setDiff", "difficulty");
$$("#setTime button").forEach(b => b.addEventListener("click", () => {
  DB.prefs.stageSec = +b.dataset.v; save();
  $$("#setTime button").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.v === DB.prefs.stageSec)));
}));
// ================= category options (shared by solo and party) =================
const TICK = '<svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const SEGS = {
  difficulty: { label: "Difficulty", cls: "five", opts: [["supereasy", "Super easy"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] },
  stageSec: { label: "Time per clue", cls: "three", opts: [["15", "15 sec"], ["30", "30 sec"], ["60", "1 min"]] },
  skips: { label: "Skips per game", cls: "three", opts: [["inf", "Unlimited"], ["3", "3"], ["0", "None"]] },
};
function packOptionsHTML(pid, inMixed) {
  const d = PACK_DEFS[pid], chips = which => `<div class="opt"><div class="label">${esc(d[which].label)}</div><div class="row chip-row" data-pid="${pid}" data-which="${which}">${d[which].options.map(([v, l]) => `<button class="chip" data-f="${v}">${TICK}${esc(l)}</button>`).join("")}</div></div>`;
  return (d.filter ? chips("filter") : "") + (d.filter2 ? chips("filter2") : "") +
    (d.years ? `<div class="opt" data-years="${pid}"><button class="collapse-row" data-ytoggle aria-expanded="false"><span>Years: <span data-ysum style="color:var(--gold)">All</span>${inMixed ? "" : ` <span class="match" data-ymini></span>`}</span>${CHEV}</button><div class="yp" data-yp hidden></div></div>` : "");
}
function optionsHTML(ids, ctx) {
  const single = ids.length === 1, seg = key => `<div class="opt"><div class="label">${SEGS[key].label}</div><div class="seg ${SEGS[key].cls}" role="group" aria-label="${SEGS[key].label}" data-opt="${key}">${SEGS[key].opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join("")}</div>${key === "difficulty" ? `<div class="diff-note" data-diffnote></div>` : ""}</div>`;
  const withFilters = ids.filter(pid => PACK_DEFS[pid].filter || PACK_DEFS[pid].filter2 || PACK_DEFS[pid].years);
  return (single ? packOptionsHTML(ids[0], false) : "") + seg("difficulty") + seg("stageSec") +
    `<div class="rounds-box opt" data-rounds><div class="yp-head"><span class="label" data-rl>Rounds</span><b data-rv>Endless</b></div><div class="range"><div class="rail"><div class="fill" data-rf style="left:0"></div></div><input type="range" min="0" max="5" step="1" data-rr aria-label="Number of rounds"></div><div class="rticks"><span>5</span><span>10</span><span>15</span><span>20</span><span>30</span><span>∞</span></div><div class="muted" data-rnote style="font-size:13px"></div></div>` +
    (ctx === "party" ? seg("skips") : "") +
    `<div class="switch-row"><span>Hands-free voice<small data-vnote>Say your answer out loud to guess</small></span><button class="switch" role="switch" data-voice aria-label="Hands-free voice"></button></div>` +
    `<div class="switch-row"><span>Auto next<small>Moves on by itself a few seconds after each answer</small></span><button class="switch" role="switch" data-auto aria-label="Auto next"></button></div>` +
    (!single && withFilters.length ? `<div class="opt"><button class="collapse-row" data-ftoggle aria-expanded="false"><span>Category filters <span class="match" data-fsum></span></span>${CHEV}</button><div data-fbody hidden>${withFilters.map(pid => `<div class="pack-opts"><div class="label gold">${esc(PACK_DEFS[pid].name)}</div>${packOptionsHTML(pid, true)}</div>`).join("")}</div></div>` : "") +
    `<div class="match" data-count></div>`;
}
function mountOptions(el, ids, ctx) {
  el.dataset.ctx = ctx; el.dataset.ids = ids.join(",");
  el.innerHTML = optionsHTML(ids, ctx);
  el.querySelectorAll("[data-years]").forEach(box => mountYearPanel(box.querySelector("[data-yp]"), box.dataset.years, ctx, el));
  refreshOptions(el);
}
const roundsOf = (ctx, ids) => ctx === "party" ? (DB.prefs.party.rounds ?? 10) : (optPrefs(ids[0], "solo").rounds ?? 0);
function refreshOptions(el) {
  if (!el || !el.dataset.ctx || !el.querySelector("[data-count]")) return;
  const ctx = el.dataset.ctx, ids = el.dataset.ids.split(","), single = ids.length === 1;
  el.querySelectorAll(".chip-row").forEach(row => { const vals = filterValues(row.dataset.pid, row.dataset.which, ctx); row.querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", String(vals.includes(b.dataset.f)))); });
  el.querySelectorAll("[data-opt]").forEach(seg => { const cur = String(seg.dataset.opt === "skips" ? (DB.prefs.party.skips ?? "inf") : ctxGet(seg.dataset.opt, ctx)); seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === cur))); });
  const dn = el.querySelector("[data-diffnote]"); if (dn) dn.textContent = DIFF_NOTES[ctxGet("difficulty", ctx)] || "";
  const r = roundsOf(ctx, ids), rb = el.querySelector("[data-rounds]");
  setRounds(rb, r, ctx === "party" ? "How many rounds?" : "Rounds");
  rb.querySelector("[data-rnote]").textContent = r ? (ctx === "party" && DB.prefs.party.style === "turns" ? `Turns rotate between players. ${r} rounds in total.` : ctx === "solo" ? `Plays all ${r} rounds. Misses just score nothing.` : "") : ctx === "solo" ? "Endless: you have 3 lives. Three misses ends the game." : "Endless: play until you tap End game after any round.";
  el.querySelector("[data-voice]").setAttribute("aria-checked", String(DB.prefs.voice && VOICE_OK));
  el.querySelector("[data-vnote]").textContent = VOICE_OK ? "Say your answer out loud to guess" : "Not available here. See Settings";
  el.querySelector("[data-auto]").setAttribute("aria-checked", String(ctxGet("autoNext", ctx) !== false));
  el.querySelectorAll("[data-years]").forEach(box => updateYearUI(box, box.dataset.years, ctx));
  const counts = ids.map(pid => [pid, PACKS[pid] ? pool(pid, undefined, ctx).length : 0]), line = el.querySelector("[data-count]");
  if (single) {
    const [pid, n] = counts[0], d = PACK_DEFS[pid], low = n < MIN_POOL;
    line.textContent = low ? `Only ${n} ${n === 1 ? d.unit + " matches" : d.units + " match"}. Widen your choices (at least ${MIN_POOL} needed).` : `${n.toLocaleString()} ${d.units} match your choices`;
    line.classList.toggle("low", low);
    const mini = el.querySelector("[data-ymini]"); if (mini) { mini.textContent = `· ${n} ${n === 1 ? d.unit : d.units}`; mini.classList.toggle("low", low); }
  } else {
    const thin = counts.filter(([, n]) => n < MIN_POOL).map(([pid]) => PACK_DEFS[pid].name);
    line.textContent = `${counts.reduce((a, [, n]) => a + n, 0).toLocaleString()} answers across ${ids.length} categories` + (thin.length ? ` · too few left in ${thin.join(", ")} (they'll be skipped)` : "");
    line.classList.toggle("low", thin.length > 0);
    const fs = el.querySelector("[data-fsum]"); if (fs) { const changed = ids.filter(pid => { const p = optPrefs(pid, ctx); return (p.filter && p.filter.length) || (p.filter2 && p.filter2.length) || p.yearFrom != null || p.yearTo != null; }).length; fs.textContent = changed ? `· ${changed} customised` : "· all on"; }
  }
}
// one delegated listener per options container
["#homeOptions", "#partyOptions"].forEach(sel => $(sel).addEventListener("click", e => {
  const el = e.currentTarget, ctx = el.dataset.ctx, ids = (el.dataset.ids || "").split(",");
  const chip = e.target.closest(".chip-row [data-f]");
  if (chip) {
    const row = chip.closest(".chip-row"), pid = row.dataset.pid, which = row.dataset.which, cur = new Set(filterValues(pid, which, ctx));
    if (cur.has(chip.dataset.f)) { if (cur.size === 1) { toast("Pick at least one."); return; } cur.delete(chip.dataset.f); } else cur.add(chip.dataset.f);
    optPrefs(pid, ctx)[which] = [...cur]; save(); refreshOptions(el); return;
  }
  const segBtn = e.target.closest("[data-opt] button");
  if (segBtn) { const key = segBtn.closest("[data-opt]").dataset.opt; if (key === "skips") { DB.prefs.party.skips = segBtn.dataset.v; save(); } else ctxSet(key, key === "stageSec" ? +segBtn.dataset.v : segBtn.dataset.v, ctx); refreshOptions(el); return; }
  if (e.target.closest("[data-voice]")) { setVoice(!(DB.prefs.voice && VOICE_OK)); refreshOptions(el); return; }
  if (e.target.closest("[data-auto]")) { ctxSet("autoNext", ctxGet("autoNext", ctx) === false, ctx); refreshOptions(el); return; }
  const tg = e.target.closest("[data-ytoggle], [data-ftoggle]");
  if (tg) { const body = tg.nextElementSibling, open = body.hidden; body.hidden = !open; tg.setAttribute("aria-expanded", String(open)); }
}));
["#homeOptions", "#partyOptions"].forEach(sel => $(sel).addEventListener("input", e => {
  const el = e.currentTarget, ctx = el.dataset.ctx, ids = el.dataset.ids.split(",");
  if (!e.target.matches("[data-rr]")) return;
  const v = ROUND_STEPS[+e.target.value];
  if (ctx === "party") DB.prefs.party.rounds = v; else optPrefs(ids[0], "solo").rounds = v;
  save(); refreshOptions(el);
}));
// ----- year range panel (one per category, solo or party) -----
function yearsText(id, ctx = OPT_CTX) { const pp = optPrefs(id, ctx), f = pp.yearFrom, t = pp.yearTo; return f == null && t == null ? "All" : f == null ? `Up to ${t}` : t == null ? `${f} onwards` : `${f}–${t}`; }
function mountYearPanel(el, id, ctx, root) {
  const P = PACKS[id], presets = PRESETS[id] || PRESETS.movies;
  el.innerHTML = `<div class="yp-head"><span class="label">${esc(PACK_DEFS[id].name)} years</span><b data-yl></b></div>
    <div class="range"><div class="rail"><div class="fill" data-fill></div></div>
      <input type="range" data-from min="${P.yearMin}" max="${P.yearMax}" step="1" aria-label="Start year">
      <input type="range" data-to min="${P.yearMin}" max="${P.yearMax}" step="1" aria-label="End year"></div>
    <div class="presets">${presets.map(([l], i) => `<button class="chip" data-preset="${i}">${l}</button>`).join("")}</div>`;
  const from = el.querySelector("[data-from]"), to = el.querySelector("[data-to]");
  const setRange = (f, t) => { const pp = optPrefs(id, ctx); pp.yearFrom = f <= P.yearMin ? null : f; pp.yearTo = t >= P.yearMax ? null : t; save(); refreshOptions(root); };
  from.addEventListener("input", e => { e.stopPropagation(); setRange(Math.min(+from.value, +to.value), +to.value); });
  to.addEventListener("input", e => { e.stopPropagation(); setRange(+from.value, Math.max(+to.value, +from.value)); });
  el.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); const [, f, t] = presets[+b.dataset.preset]; setRange(f ?? P.yearMin, t ?? P.yearMax); }));
}
function updateYearUI(box, id, ctx) {
  const P = PACKS[id], pp = optPrefs(id, ctx), presets = PRESETS[id] || PRESETS.movies, el = box.querySelector("[data-yp]");
  if (!P || !el.querySelector("[data-from]")) return;
  const f = pp.yearFrom ?? P.yearMin, t = pp.yearTo ?? P.yearMax, span = P.yearMax - P.yearMin || 1;
  el.querySelector("[data-from]").value = f; el.querySelector("[data-to]").value = t;
  el.querySelector("[data-yl]").textContent = `${f} – ${t}`;
  const fill = el.querySelector("[data-fill]"); fill.style.left = `${100 * (f - P.yearMin) / span}%`; fill.style.right = `${100 * (P.yearMax - t) / span}%`;
  el.querySelectorAll("[data-preset]").forEach(b => { const [, pf, pt] = presets[+b.dataset.preset]; b.setAttribute("aria-pressed", String((pf ?? null) === pp.yearFrom && (pt ?? null) === pp.yearTo)); });
  box.querySelector("[data-ysum]").textContent = yearsText(id, ctx);
}
$("#startSolo").addEventListener("click", () => {
  sfx.unlock(); const id = DB.prefs.cat, n = pool(id, undefined, "solo").length;
  if (n < MIN_POOL) { toast(`Only ${n} match your choices. Widen them a little.`, 3200); return; }
  startGame("solo", [id]);
});
$("#dailyCard").addEventListener("click", () => { sfx.unlock(); const id = DB.prefs.cat; packDaily(id)[todayKey()] ? showDailyResult(id) : startGame("daily", [id]); });
$$("[data-hub]").forEach(b => b.addEventListener("click", goHub));
$$("[data-home]").forEach(b => b.addEventListener("click", () => goHome()));
$("#openSettings").addEventListener("click", showSettings);
$("#openStats").addEventListener("click", showStats);
$("#openAbout").addEventListener("click", showAbout); $("#openAbout2").addEventListener("click", showAbout);
$$("[data-howto]").forEach(b => b.addEventListener("click", () => {
  const def = PACK_DEFS[$("#homeScreen").classList.contains("active") ? DB.prefs.cat : "movies"];
  $("#howToTitle").textContent = `How to play · ${def.name}`;
  $("#howToActs").innerHTML = def.acts.map(a => `<li><b>${esc(a.n)} · ${esc(a.name)}.</b> ${esc(a.hint)}</li>`).join("");
  $("#howTo").hidden = false;
}));
$("#howTo").addEventListener("click", e => { if (e.target.id === "howTo" || e.target.closest("[data-close]")) $("#howTo").hidden = true; });

// ================= voice =================
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE_OK = !!SR && window.isSecureContext;
const V = { rec: null, running: false, failCount: 0 };
function voiceUnsupportedText() { return !SR ? "Voice isn't available in this browser. Try Chrome, or Safari on iPhone/Mac." : "Voice needs a secure link. It works on your Mac at localhost, and on phones on the live site (https)."; }
function syncVoiceUI() {
  const on = DB.prefs.voice && VOICE_OK;
  $("#swVoice").setAttribute("aria-checked", String(on)); $$("[data-voice]").forEach(b => b.setAttribute("aria-checked", String(on)));
  $("#voiceSupport").textContent = VOICE_OK ? "Tip: English (India) handles Hollywood, Bollywood and Indian brand names well." : voiceUnsupportedText();
  $$("#setLang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === DB.prefs.voiceLang)));
  const mic = $("#micBtn"); mic.hidden = !VOICE_OK; mic.classList.toggle("on", on && V.running);
  mic.setAttribute("aria-pressed", String(on)); mic.setAttribute("aria-label", on ? "Turn off hands-free voice" : "Turn on hands-free voice");
}
function setVoice(on) {
  if (on && !VOICE_OK) { toast(voiceUnsupportedText(), 3600); return; }
  if (on && !DB.prefs.voiceNoted) { $("#voiceSheet").hidden = false; return; }
  DB.prefs.voice = on; save(); syncVoiceUI(); syncVoice();
  if (on) track("voice_on");
}
$("#voiceOk").addEventListener("click", () => { DB.prefs.voiceNoted = true; $("#voiceSheet").hidden = true; setVoice(true); });
$("#voiceSheet").addEventListener("click", e => { if (e.target.id === "voiceSheet" || e.target.closest("[data-close]")) $("#voiceSheet").hidden = true; });
["#swVoice", "#micBtn"].forEach(id => $(id).addEventListener("click", () => setVoice(!(DB.prefs.voice && VOICE_OK))));
$$("#setLang button").forEach(b => b.addEventListener("click", () => { DB.prefs.voiceLang = b.dataset.v; save(); syncVoiceUI(); voiceStop(); syncVoice(); }));
function voiceWanted() { return DB.prefs.voice && VOICE_OK && !document.hidden && !G.paused && !G.whoPending && ((!G.over && $("#gameScreen").classList.contains("active")) || onReveal()); }
function setHeard(text, live = false) { const h = $("#heard"); h.classList.toggle("live", live); h.textContent = text; }
function voiceStart() {
  if (V.running || !voiceWanted()) return;
  try {
    const r = new SR(); r.lang = DB.prefs.voiceLang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
    r.onresult = onVoice;
    r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { DB.prefs.voice = false; save(); voiceStop(); syncVoiceUI(); toast("Microphone is blocked. Allow it in your browser's settings to use voice.", 3600); } };
    r.onend = () => {
      V.running = false; V.rec = null; syncVoiceUI();
      if (!voiceWanted()) { setHeard(""); return; }
      setTimeout(() => { if (!voiceWanted()) return; V.failCount += 1; if (V.failCount > 4) showResume(); else voiceStart(); }, 250);
    };
    r.start(); V.rec = r; V.running = true; if (!onReveal()) setHeard("Listening… say your answer", true); syncVoiceUI();
  } catch { showResume(); }
}
function showResume() { const h = $("#heard"); h.classList.remove("live"); h.innerHTML = `<button type="button" id="resumeVoice">Tap to resume listening</button>`; $("#resumeVoice").addEventListener("click", () => { V.failCount = 0; voiceStart(); }); }
function voiceStop() { const r = V.rec; V.rec = null; V.running = false; if (r) { r.onend = null; try { r.abort(); } catch { /* ignore */ } } setHeard(""); syncVoiceUI(); }
function syncVoice() { if (voiceWanted()) { V.failCount = 0; voiceStart(); } else voiceStop(); }
const FILLERS = /^(i think it s|i think its|i think|is it|it s|its|it is|the answer is|answer is|maybe|um+|uh+|oh|ok|okay)\s+/;
function cleanSpoken(a) { let n = normalize(a), prev; do { prev = n; n = n.replace(FILLERS, ""); } while (n !== prev); return n; }
function onVoice(e) {
  V.failCount = 0;
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const res = e.results[i], alts = [];
    for (let k = 0; k < res.length; k++) if (res[k].transcript.trim()) alts.push(res[k].transcript.trim());
    if (!alts.length) continue;
    setHeard(`Heard: “${alts[0]}”`, true);
    handleSpoken(alts, res.isFinal);
    if (G.whoPending || (G.over && !onReveal())) return;
  }
}
function handleSpoken(alts, final) {
  if (onReveal()) { if (final && /\b(next|next one|next film|next round|go|continue|keep going|carry on)\b/.test(cleanSpoken(alts[0]))) $("#revNext").click(); return; }
  if (G.over || G.whoPending) return;
  const m = G.item, hit = voiceMatch(alts, m);
  if (hit && hit.how === "exact") { feedback(`Heard “${hit.heard}”`, "near"); correctGuess(); return; }
  if (hit && hit.how === "group") { feedback(`Heard “${hit.heard}” · ${m.pk.def.partial.toLowerCase()}`, "near"); correctGuess(true); return; }
  if (!final) return;
  const n = cleanSpoken(alts[0]);
  if (/\b(next clue|next act|another clue|more clues?)\b/.test(n)) { if (G.stage < 3) { advance(); toast("Next clue"); } return; }
  if (/^(skip|skip it|skip this|skip film|skip the film|pass)$/.test(n)) { if (!$("#skipBtn").hidden && !$("#skipBtn").disabled) $("#skipBtn").click(); return; }
  setHeard(`Heard: “${alts[0]}” · not it`, true);
}

// ================= stats =================
function showStats() {
  const id = DB.prefs.cat, def = PACK_DEFS[id], s = packStats(id), rec = packRecords(id), acc = s.seen ? Math.round(100 * s.won / s.seen) : 0;
  $("#statsTitle").textContent = `${def.name} stats`;
  const U = def.units[0].toUpperCase() + def.units.slice(1);
  $("#statsGrid").innerHTML = [[`${U} guessed`, s.won], [`${U} seen`, s.seen], ["Accuracy", `${acc}%`], ["Avg. clue needed", s.won ? (s.clueSum / s.won).toFixed(1) : "–"], ["Best score", rec.best.toLocaleString()], ["Best streak", rec.bestStreak], [`${U} skipped`, s.skips || 0]]
    .map(([l, v]) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`).join("");
  $("#statsCatLabel").hidden = !def.filter; $("#statsInd").hidden = !def.filter;
  if (def.filter) {
    $("#statsCatLabel").textContent = `Accuracy by ${def.filter.label.toLowerCase().replace(/ from$/, " origin")}`;
    $("#statsInd").innerHTML = def.filter.options.map(([k, l]) => { const x = s.cat[k] || { seen: 0, won: 0 }; const pct = x.seen ? Math.round(100 * x.won / x.seen) : 0;
      return `<div class="bar-row"><span>${esc(l)}</span><span class="track"><b style="width:${pct}%"></b></span><span style="text-align:right">${x.seen ? pct + "%" : "–"}</span></div>`; }).join("");
  }
  $("#statsDecadeLabel").hidden = !def.years; $("#statsDecade").hidden = !def.years;
  const decs = Object.entries(s.dec).filter(([, v]) => v.seen >= 3).sort((a, b) => b[1].won / b[1].seen - a[1].won / a[1].seen);
  $("#statsDecade").innerHTML = decs.length ? `<b>${decs[0][0]}</b>: ${Math.round(100 * decs[0][1].won / decs[0][1].seen)}% of ${decs[0][1].seen}` : "Play a few more to find your best decade.";
  $("#resetStats").textContent = `Reset ${def.name} stats`; show("statsScreen");
}
$("#resetStats").addEventListener("click", e => {
  if (!e.target.textContent.startsWith("Tap again")) { e.target.textContent = "Tap again to reset"; return; }
  const id = DB.prefs.cat; delete DB.stats[id]; delete DB.records[id]; save(); showStats(); toast("Stats reset.");
});

// ================= settings & about =================
function syncSwitches() {
  $("#swAuto").setAttribute("aria-checked", String(DB.prefs.autoNext !== false)); $("#swSound").setAttribute("aria-checked", String(DB.prefs.sound));
  $("#swVib").setAttribute("aria-checked", String(DB.prefs.vibrate)); $("#swRm").setAttribute("aria-checked", String(DB.prefs.reduceMotion));
}
function seenTotal() { return PACK_ORDER.reduce((a, id) => a + Object.keys(seenMap(id)).length, 0); }
function syncSeenBtn() { const n = seenTotal(); $("#resetSeen").textContent = n ? `Reset seen answers (${n} seen)` : "Reset seen answers (none yet)"; $("#resetSeen").disabled = !n; }
function showSettings() {
  $$("#setDiff button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === DB.prefs.difficulty)));
  $$("#setTime button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === DB.prefs.stageSec)));
  $("#setNick").value = DB.prefs.nickname; syncSwitches(); syncVoiceUI(); syncSeenBtn(); show("settingsScreen");
}
$("#setNick").addEventListener("change", e => { DB.prefs.nickname = e.target.value.trim(); save(); });
$("#swAuto").addEventListener("click", () => { DB.prefs.autoNext = DB.prefs.autoNext === false; save(); syncSwitches(); });
[["#swSound", "sound"], ["#swVib", "vibrate"], ["#swRm", "reduceMotion"]].forEach(([sel, k]) => $(sel).addEventListener("click", () => { DB.prefs[k] = !DB.prefs[k]; save(); syncSwitches(); applyMotion(); if (k === "sound" && DB.prefs.sound) sfx.chime(); if (k === "vibrate") buzz(40); }));
$("#resetSeen").addEventListener("click", e => {
  if (!e.target.dataset.armed) { e.target.dataset.armed = "1"; e.target.textContent = "Tap again to reset"; setTimeout(() => { delete e.target.dataset.armed; syncSeenBtn(); }, 3000); return; }
  delete e.target.dataset.armed; PACK_ORDER.forEach(id => { try { localStorage.removeItem(seenKey(id)); } catch { /* ignore */ } }); syncSeenBtn(); toast("Seen answers reset. Everything is fresh again.");
});
$("#replayTutorial").addEventListener("click", startOnboarding);
function showAbout() {
  $("#aboutBody").innerHTML = `
    <p><b>Guess Night</b> is a free guessing game: four clues per round across ${PACK_ORDER.filter(packReady).map(id => PACK_DEFS[id].name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}.</p>
    <p><b>Movies, TV & Actors:</b> film, show and people data and images from The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    <p><b>Countries:</b> outlines from Natural Earth (public domain); names, capitals, languages, currencies and borders from the mledoze/countries dataset (Open Database Licence 1.0, so this country data is shared under the same licence); population estimates from Natural Earth; flags from flag-icons by Panayiotis Lipiridis (MIT licence); “famous for” notes hand-written.</p>
    <p><b>Brands:</b> hand-curated facts and slogans (please report anything wrong). Colours are approximations; no logos are used. Brand names are trademarks of their owners and appear only for the quiz.</p>
    <p><b>Cities, People, Sports & Animals:</b> facts from Wikidata (CC0) and hand-written clues (please report anything wrong). Photos come from Wikimedia Commons under each author's licence (public domain, CC0, CC BY, CC BY-SA or Free Art License), credited with a link on every answer screen. Map outlines from Natural Earth. Animal silhouettes from PhyloPic, credited per image.</p>
    <p><b>Privacy:</b> we count anonymous plays to improve the game (GoatCounter). No cookies, no personal data. Your progress stays on this device.</p>
    <p><b>Version:</b> ${APP_VERSION}</p>`;
  show("aboutScreen");
}

// ================= boot =================
applyMotion();
try { const today = todayKey(), last = localStorage.getItem("guessnight.lastVisit"); if (DB.prefs.onboarded && last && last !== today) track("return_visit"); localStorage.setItem("guessnight.lastVisit", today); } catch { /* ignore */ }
DB.prefs.onboarded ? goHub() : startOnboarding();
