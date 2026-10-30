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
  $("#pCatNote").textContent = pp.cat === "mixed" ? `Every round picks a category at random: ${ready.map(catName).join(", ")}.` : `Every round is ${catName(pp.cat).toLowerCase()}. Uses your ${catName(pp.cat)} filters.`;
  $$("#pStyle button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === pp.style)));
  $("#pStyleNote").textContent = pp.style === "shout" ? "One screen, everyone plays at once. Shout the answer. When it's right, tap who said it. Turn on hands-free voice and the app hears it for you." : "Pass the phone. Each player gets their own round in turn, scored like solo.";
  if (pp.rounds === undefined) pp.rounds = pp.films || 10;
  setRounds($("#pRounds"), pp.rounds, "How many rounds?");
  $("#pRoundsNote").textContent = pp.rounds ? (pp.style === "turns" ? `Turns rotate between players. ${pp.rounds} rounds in total.` : "") : "Endless: play until you tap End game after any round.";
  $$("#pDiff button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === DB.prefs.difficulty)));
  $("#startParty").textContent = `Start party game · ${pp.count} players`;
}
$$("#modeSeg button").forEach(b => b.addEventListener("click", () => { DB.prefs.mode = b.dataset.v; save(); renderMode(); }));
$("#pMinus").addEventListener("click", () => { DB.prefs.party.count = Math.max(2, DB.prefs.party.count - 1); save(); renderMode(); });
$("#pPlus").addEventListener("click", () => { DB.prefs.party.count = Math.min(8, DB.prefs.party.count + 1); save(); renderMode(); setTimeout(() => $(`#pNames [data-pi="${DB.prefs.party.count - 1}"]`)?.focus(), 50); });
$("#pNames").addEventListener("input", e => { const i = e.target.dataset.pi; if (i == null) return; DB.prefs.party.names[+i] = e.target.value; save(); });
$("#pCats").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; DB.prefs.party.cat = b.dataset.v; save(); renderMode(); });
$("#pStyle").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; DB.prefs.party.style = b.dataset.v; save(); renderMode(); });
// ----- rounds slider (party setup + category home) -----
function setRounds(box, val, label) {
  const i = Math.max(0, ROUND_STEPS.indexOf(val));
  box.querySelector("[data-rr]").value = i; box.querySelector("[data-rl]").textContent = label;
  box.querySelector("[data-rv]").textContent = val ? `${val} rounds` : "Endless";
  box.querySelector("[data-rf]").style.right = `${100 - (100 * i / 5)}%`;
}
$("#pRounds [data-rr]").addEventListener("input", e => { DB.prefs.party.rounds = ROUND_STEPS[+e.target.value]; save(); renderMode(); });
$("#homeRounds [data-rr]").addEventListener("input", e => { const id = DB.prefs.cat; packPrefs(id).rounds = ROUND_STEPS[+e.target.value]; save(); renderHomeRounds(); });
function renderHomeRounds() {
  const pp = packPrefs(DB.prefs.cat); if (pp.rounds === undefined) pp.rounds = 0;
  setRounds($("#homeRounds"), pp.rounds, pp.rounds ? "Rounds" : "Rounds · endless, with 3 lives");
}
$("#pDiff").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; DB.prefs.difficulty = b.dataset.v; save(); renderMode(); });
$("#startParty").addEventListener("click", () => {
  sfx.unlock(); const c = DB.prefs.party.cat;
  startGame("party", c === "mixed" ? PACK_ORDER.filter(packReady) : [c]);
});

// ================= category home =================
async function goHome() {
  const id = DB.prefs.cat && packReady(DB.prefs.cat) ? DB.prefs.cat : "movies", def = PACK_DEFS[id];
  try { await loadPack(id); } catch { toast("Couldn't load that category. Check your connection."); goHub(); return; }
  const P = PACKS[id], rec = packRecords(id);
  $("#homeKicker").textContent = "Guess Night";
  $("#homeTitle").innerHTML = esc(def.name);
  $("#homeGreeting").textContent = def.tagline;
  $("#homeFaces").innerHTML = def.faces(pool(id).length ? pool(id) : P.items).map(f => f.img ? `<img src="${esc(f.img)}" alt="">` : `<span class="face-html">${f.html}</span>`).join("");
  $("#homeFilterBox").hidden = !def.filter;
  if (def.filter) {
    const vals = filterValues(id);
    $("#homeFilterLabel").textContent = def.filter.label;
    $("#homeFilters").innerHTML = def.filter.options.map(([v, l]) => `<button class="chip" data-f="${v}" aria-pressed="${vals.includes(v)}"><svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${esc(l)}</button>`).join("");
  }
  $$("#homeDiff button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === DB.prefs.difficulty)));
  $$("#homeTime button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.v === DB.prefs.stageSec)));
  $("#homeYearsBox").hidden = !def.years;
  if (def.years) mountYearPanel($("#homeYears"), id);
  $("#homeRecords").innerHTML = `Best <b>${rec.best.toLocaleString()}</b> · Streak <b>${rec.bestStreak}</b>`;
  const done = packDaily(id)[todayKey()];
  $("#dailyCard").innerHTML = done
    ? `<span class="cal">${dailyNumber()}</span><span><strong>${esc(def.name)} daily #${dailyNumber()} done · ${done.results.filter(r => r.won).length}/${DAILY_COUNT}</strong><small>See your result and share it</small></span>`
    : `<span class="cal">${dailyNumber()}</span><span><strong>${esc(def.name)} daily #${dailyNumber()}</strong><small>5 ${def.units}, same for everyone · 15 sec per clue</small></span>`;
  updateCounts(); syncVoiceUI(); renderHomeRounds();
  show("homeScreen");
}
$("#homeFilters").addEventListener("click", e => {
  const b = e.target.closest("button[data-f]"); if (!b) return;
  const id = DB.prefs.cat, cur = new Set(filterValues(id));
  if (cur.has(b.dataset.f)) { if (cur.size === 1) { toast("Pick at least one."); return; } cur.delete(b.dataset.f); } else cur.add(b.dataset.f);
  packPrefs(id).filter = [...cur]; save();
  $$("#homeFilters [data-f]").forEach(x => x.setAttribute("aria-pressed", String(cur.has(x.dataset.f)))); updateCounts();
});
function bindSeg(sel, key, after) { $$(`${sel} button`).forEach(b => b.addEventListener("click", () => { DB.prefs[key] = b.dataset.v; save(); $$(`${sel} button`).forEach(x => x.setAttribute("aria-pressed", String(x === b))); after && after(); })); }
bindSeg("#homeDiff", "difficulty", updateCounts); bindSeg("#setDiff", "difficulty");
$$("#homeTime button, #setTime button").forEach(b => b.addEventListener("click", () => {
  DB.prefs.stageSec = +b.dataset.v; save();
  $$("#homeTime button, #setTime button").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.v === DB.prefs.stageSec)));
}));
function updateCounts() {
  const id = DB.prefs.cat, def = PACK_DEFS[id], n = pool(id).length;
  $("#homeDiffNote").textContent = DIFF_NOTES[DB.prefs.difficulty] || "";
  const low = n < MIN_POOL;
  $("#homeMatchLine").textContent = low ? `Only ${n} ${n === 1 ? def.unit + " matches" : def.units + " match"}. Widen your choices (at least ${MIN_POOL} needed).` : `${n.toLocaleString()} ${def.units} match your choices`;
  $("#homeMatchLine").classList.toggle("low", low);
  if (def.years) { updateYearUI(id); $("#homeMatchMini").textContent = `· ${n} ${n === 1 ? def.unit : def.units}`; $("#homeMatchMini").classList.toggle("low", low); }
}
// ----- year range panel -----
function yearsText(id) { const pp = packPrefs(id), f = pp.yearFrom, t = pp.yearTo; return f == null && t == null ? "All" : f == null ? `Up to ${t}` : t == null ? `${f} onwards` : `${f}–${t}`; }
function mountYearPanel(el, id) {
  const P = PACKS[id], presets = PRESETS[id] || PRESETS.movies;
  el.innerHTML = `<div class="yp-head"><span class="label">${esc(PACK_DEFS[id].filter ? PACK_DEFS[id].filter.label : "Years")}</span><b data-yl></b></div>
    <div class="range"><div class="rail"><div class="fill" data-fill></div></div>
      <input type="range" data-from min="${P.yearMin}" max="${P.yearMax}" step="1" aria-label="Start year">
      <input type="range" data-to min="${P.yearMin}" max="${P.yearMax}" step="1" aria-label="End year"></div>
    <div class="presets">${presets.map(([l], i) => `<button class="chip" data-preset="${i}">${l}</button>`).join("")}</div>`;
  const from = el.querySelector("[data-from]"), to = el.querySelector("[data-to]");
  const setRange = (f, t) => { const pp = packPrefs(id); pp.yearFrom = f <= P.yearMin ? null : f; pp.yearTo = t >= P.yearMax ? null : t; save(); updateCounts(); };
  from.addEventListener("input", () => setRange(Math.min(+from.value, +to.value), +to.value));
  to.addEventListener("input", () => setRange(+from.value, Math.max(+to.value, +from.value)));
  el.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => { const [, f, t] = presets[+b.dataset.preset]; setRange(f ?? P.yearMin, t ?? P.yearMax); }));
}
function updateYearUI(id) {
  const P = PACKS[id], pp = packPrefs(id), presets = PRESETS[id] || PRESETS.movies;
  const f = pp.yearFrom ?? P.yearMin, t = pp.yearTo ?? P.yearMax, span = P.yearMax - P.yearMin || 1, el = $("#homeYears");
  if (!el.querySelector("[data-from]")) return;
  el.querySelector("[data-from]").value = f; el.querySelector("[data-to]").value = t;
  el.querySelector("[data-yl]").textContent = `${f} – ${t}`;
  const fill = el.querySelector("[data-fill]"); fill.style.left = `${100 * (f - P.yearMin) / span}%`; fill.style.right = `${100 * (P.yearMax - t) / span}%`;
  el.querySelectorAll("[data-preset]").forEach(b => { const [, pf, pt] = presets[+b.dataset.preset]; b.setAttribute("aria-pressed", String((pf ?? null) === pp.yearFrom && (pt ?? null) === pp.yearTo)); });
  $("#yearsSummary").textContent = yearsText(id);
}
$("#yearsToggle").addEventListener("click", () => { const open = $("#homeYears").hidden; $("#homeYears").hidden = !open; $("#yearsToggle").setAttribute("aria-expanded", String(open)); });
$("#startSolo").addEventListener("click", () => {
  sfx.unlock(); const id = DB.prefs.cat, n = pool(id).length;
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
  ["#swVoice", "#swHomeVoice", "#swPartyVoice"].forEach(id => $(id).setAttribute("aria-checked", String(on)));
  $("#homeVoiceNote").textContent = VOICE_OK ? "Say your answer out loud to guess" : "Not available here. See Settings";
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
["#swVoice", "#swHomeVoice", "#swPartyVoice", "#micBtn"].forEach(id => $(id).addEventListener("click", () => setVoice(!(DB.prefs.voice && VOICE_OK))));
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
  const m = G.item;
  for (const a of alts) { const c = cleanSpoken(a); if (matches(a, m) || (c && matches(c, m))) { feedback(`Heard “${a}”`, "near"); correctGuess(); return; } }
  for (const a of alts) { const c = cleanSpoken(a); if (groupMatch(a, m) || (c && groupMatch(c, m))) { feedback(`Heard “${a}” · ${m.pk.def.partial.toLowerCase()}`, "near"); correctGuess(true); return; } }
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
    <p><b>Guess Night</b> is a free guessing game: four clues per round across movies, TV shows, countries and brands.</p>
    <p><b>Movies, TV & Actors:</b> film, show and people data and images from The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    <p><b>Countries:</b> outlines from Natural Earth (public domain); names, capitals, languages, currencies and borders from the mledoze/countries dataset (Open Database Licence 1.0, so this country data is shared under the same licence); population estimates from Natural Earth; flags from flag-icons by Panayiotis Lipiridis (MIT licence); “famous for” notes hand-written.</p>
    <p><b>Brands:</b> hand-curated facts and slogans (please report anything wrong). Colours are approximations; no logos are used. Brand names are trademarks of their owners and appear only for the quiz.</p>
    <p><b>Privacy:</b> we count anonymous plays to improve the game (GoatCounter). No cookies, no personal data. Your progress stays on this device.</p>
    <p><b>Version:</b> ${APP_VERSION}</p>`;
  show("aboutScreen");
}

// ================= boot =================
applyMotion();
try { const today = todayKey(), last = localStorage.getItem("guessnight.lastVisit"); if (DB.prefs.onboarded && last && last !== today) track("return_visit"); localStorage.setItem("guessnight.lastVisit", today); } catch { /* ignore */ }
DB.prefs.onboarded ? goHub() : startOnboarding();
