// Datalag: tilstand i minnet, kryptert i localStorage. Kategorier, gjentakelse og poeng.
window.PLStore = (() => {
  const DATA_KEY = 'pl.data';
  const DEVICE_KEY = 'pl.key';

  const CATEGORIES = [
    { id: 'hjem',    name: 'Hjem',            emoji: '🏠', color: '#f59e0b', examples: ['Ta oppvasken', 'Sette på en klesvask', 'Rydde stua 10 min', 'Ta ut søpla', 'Skifte sengetøy', 'Støvsuge'] },
    { id: 'jobb',    name: 'Jobb / skole',    emoji: '💼', color: '#3b82f6', examples: ['Svare på e-post', 'Forberede møte', 'Lese 25 min', 'Levere oppgave', 'Rydde skrivebordet'] },
    { id: 'helse',   name: 'Helse',           emoji: '💊', color: '#ef4444', examples: ['Ta medisin', 'Drikke et glass vann', 'Gå en tur 20 min', 'Trene', 'Legge meg før 23'] },
    { id: 'mat',     name: 'Mat',             emoji: '🍽️', color: '#22c55e', examples: ['Spise frokost', 'Lage middag', 'Handle mat', 'Planlegge ukesmeny', 'Lage matpakke'] },
    { id: 'sosialt', name: 'Sosialt',         emoji: '💬', color: '#a855f7', examples: ['Ringe familie', 'Svare på meldinger', 'Avtale kaffe med en venn', 'Sende en hyggelig melding'] },
    { id: 'admin',   name: 'Økonomi / admin', emoji: '📄', color: '#64748b', examples: ['Betale regninger', 'Sjekke nettbank', 'Bestille legetime', 'Fornye resept', 'Sjekke posten'] },
    { id: 'egentid', name: 'Egentid',         emoji: '🌿', color: '#14b8a6', examples: ['Lese 15 min', 'Puste rolig 5 min', 'Gå tur uten mobil', 'Hobby 30 min', 'Høre på musikk'] },
    { id: 'aerend',  name: 'Ærend',           emoji: '🚗', color: '#ec4899', examples: ['Hente pakke', 'Levere pant', 'Kjøpe gave', 'Til apoteket', 'Fylle bensin'] }
  ];
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  const TEMPLATES = [
    { title: 'Morgenrutine', cat: 'helse', time: '07:30', duration: 30, recur: 'daily',
      steps: ['Stå opp og drikke vann', 'Ta medisin', 'Dusje / vaske ansiktet', 'Kle på meg', 'Spise frokost', 'Sjekke dagens plan'] },
    { title: 'Kveldsrutine', cat: 'egentid', time: '21:30', duration: 30, recur: 'daily',
      steps: ['Legge fram klær til i morgen', 'Sette mobilen til lading utenfor soverommet', 'Pusse tenner', 'Lese eller puste rolig 10 min'] },
    { title: 'Planlegge morgendagen', cat: 'admin', time: '21:00', duration: 10, recur: 'daily',
      steps: ['Se på kalenderen for i morgen', 'Velg 1–3 viktigste oppgaver', 'Legg dem inn i planen'] },
    { title: 'Ta medisin', cat: 'helse', time: '08:00', duration: 5, recur: 'daily', steps: [] },
    { title: 'Måltid', cat: 'mat', time: '17:00', duration: 45, recur: 'daily', steps: ['Finne fram ingredienser', 'Lage maten', 'Spise', 'Sette inn i oppvaskmaskinen'] },
    { title: 'Trening', cat: 'helse', time: '17:30', duration: 45, recur: 'weekly', days: [1, 3, 5], steps: ['Skifte til treningstøy', 'Fylle vannflaske', 'Dra'] },
    { title: 'Ukesrydding', cat: 'hjem', time: '11:00', duration: 60, recur: 'weekly', days: [6], steps: ['Bad', 'Kjøkken', 'Støvsuge', 'Søppel ut'] },
    { title: 'Ukesplanlegging', cat: 'admin', time: '19:00', duration: 20, recur: 'weekly', days: [7], steps: ['Se over neste uke', 'Legge inn avtaler', 'Handleliste'] },
    { title: 'Pause uten skjerm', cat: 'egentid', time: '15:00', duration: 15, recur: 'weekdays', steps: [] }
  ];

  // --- Dato-hjelpere ---
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const isoDow = (s) => { const d = parseYmd(s).getDay(); return d === 0 ? 7 : d; }; // 1=man ... 7=søn
  const mondayOf = (s) => addDays(s, 1 - isoDow(s));
  const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const minutesOf = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const minToHm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // --- Tilstand ---
  let state = null;
  let aesKey = null;
  let saveTimer = null;
  const listeners = new Set();

  function defaultState() {
    const today = ymd();
    return {
      version: 1,
      tasks: [
        { id: uid(), title: 'Bli kjent med appen', cat: 'egentid', today, due: today, energy: 'low', prio: 1, done: false, created: Date.now(), notes: 'Du får poeng for hvert steg. Slett meg når du er ferdig.',
          steps: [
            { id: uid(), title: 'Huk av dette steget', done: false },
            { id: uid(), title: 'Legg til en egen oppgave under «Lister»', done: false },
            { id: uid(), title: 'Legg inn en aktivitet i «Plan»', done: false },
            { id: uid(), title: 'Start en aktivitet i fokusmodus', done: false }
          ] }
      ],
      events: [
        makeEventFromTemplate(TEMPLATES[0], today),
        makeEventFromTemplate(TEMPLATES[1], today),
        makeEventFromTemplate(TEMPLATES[2], today)
      ],
      game: { points: 0, streak: 0, bestStreak: 0, lastActive: null, freezes: 1, history: {}, badges: [] },
      settings: { theme: 'auto', notify: true, dayStart: '06:00', dayEnd: '23:00', dailyGoal: 3, ai: { ...window.PLANLEGGER_CONFIG.ai } }
    };
  }

  function makeEventFromTemplate(t, date) {
    return {
      id: uid(), title: t.title, cat: t.cat, date, time: t.time, duration: t.duration,
      recur: { type: t.recur || 'none', days: t.days || [], until: '' },
      steps: (t.steps || []).map((s) => ({ id: uid(), title: s })),
      done: {}, skipped: {}, stepDone: {}, notes: ''
    };
  }

  // --- Persistens ---
  const hasDeviceKey = () => !!localStorage.getItem(DEVICE_KEY);
  const hasData = () => !!localStorage.getItem(DATA_KEY);

  // Passord byttet i appen lagres som lokal overstyring, slik at enheten virker selv om config.js ikke er oppdatert ennå.
  const AUTH_KEY = 'pl.auth';
  function authConfig() {
    try { const o = JSON.parse(localStorage.getItem(AUTH_KEY)); if (o && o.salt && o.verifier) return o; } catch (e) { /* ignorer */ }
    return window.PLANLEGGER_CONFIG.auth;
  }

  async function unlockWithRawKey(rawKey, remember) {
    const ver = await PLCrypto.verifierOf(rawKey);
    if (ver !== authConfig().verifier) return false;
    aesKey = await PLCrypto.importAesKey(rawKey);
    if (remember) localStorage.setItem(DEVICE_KEY, PLCrypto.bytesToB64(rawKey));
    await load();
    return true;
  }

  async function unlockWithPassword(password, remember) {
    const cfg = authConfig();
    const raw = await PLCrypto.deriveRawKey(password, cfg.salt, cfg.iterations);
    return unlockWithRawKey(raw, remember);
  }

  async function changePassword(newPassword) {
    const salt = PLCrypto.randomHex(16);
    const iterations = 200000;
    const raw = await PLCrypto.deriveRawKey(newPassword, salt, iterations);
    const verifier = await PLCrypto.verifierOf(raw);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ salt, verifier, iterations }));
    await rekey(raw);
    return { salt, verifier, iterations };
  }

  async function unlockWithDevice() {
    const b64 = localStorage.getItem(DEVICE_KEY);
    if (!b64) return false;
    return unlockWithRawKey(PLCrypto.b64ToBytes(b64).buffer, false);
  }

  async function load() {
    const blob = localStorage.getItem(DATA_KEY);
    if (!blob) { state = defaultState(); await save(true); return; }
    try {
      state = JSON.parse(await PLCrypto.decrypt(aesKey, blob));
    } catch (e) {
      throw new Error('DECRYPT_FAILED');
    }
    migrate();
  }

  function migrate() {
    const d = defaultState();
    state.settings = { ...d.settings, ...(state.settings || {}) };
    state.settings.ai = { ...d.settings.ai, ...(state.settings.ai || {}) };
    state.game = { ...d.game, ...(state.game || {}) };
    state.tasks = state.tasks || [];
    state.events = state.events || [];
    state.events.forEach((e) => { e.done = e.done || {}; e.skipped = e.skipped || {}; e.stepDone = e.stepDone || {}; e.steps = e.steps || []; e.recur = e.recur || { type: 'none', days: [], until: '' }; });
    state.tasks.forEach((t) => { t.steps = t.steps || []; });
  }

  async function save(immediate) {
    if (!state || !aesKey) return;
    clearTimeout(saveTimer);
    const doSave = async () => {
      localStorage.setItem(DATA_KEY, await PLCrypto.encrypt(aesKey, JSON.stringify(state)));
    };
    if (immediate) await doSave(); else saveTimer = setTimeout(doSave, 250);
    listeners.forEach((fn) => fn());
  }

  function lockDevice() { localStorage.removeItem(DEVICE_KEY); aesKey = null; state = null; }
  function wipe() { localStorage.removeItem(DATA_KEY); localStorage.removeItem(DEVICE_KEY); localStorage.removeItem(AUTH_KEY); aesKey = null; state = null; }

  async function rekey(newRawKey) {
    aesKey = await PLCrypto.importAesKey(newRawKey);
    localStorage.setItem(DEVICE_KEY, PLCrypto.bytesToB64(newRawKey));
    await save(true);
  }

  function exportJson() { return JSON.stringify(state, null, 2); }
  async function importJson(text) {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.tasks) || !Array.isArray(obj.events)) throw new Error('Ugyldig fil');
    state = obj; migrate(); await save(true);
  }

  // --- Gjentakelse ---
  function occursOn(ev, date) {
    if (date < ev.date) return false;
    if (ev.skipped[date]) return false;
    const r = ev.recur || { type: 'none' };
    if (r.until && date > r.until) return false;
    switch (r.type) {
      case 'none': return date === ev.date;
      case 'daily': return true;
      case 'weekdays': return isoDow(date) <= 5;
      case 'weekly': { const days = r.days && r.days.length ? r.days : [isoDow(ev.date)]; return days.includes(isoDow(date)); }
      case 'monthly': return parseYmd(date).getDate() === parseYmd(ev.date).getDate();
      default: return false;
    }
  }
  function occurrencesOn(date) {
    return state.events.filter((e) => occursOn(e, date))
      .map((e) => ({ ev: e, date, done: !!e.done[date], start: minutesOf(e.time), end: minutesOf(e.time) + (e.duration || 0) }))
      .sort((a, b) => a.start - b.start);
  }
  function recurLabel(r) {
    const names = ['', 'man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];
    switch ((r || {}).type) {
      case 'daily': return 'Hver dag';
      case 'weekdays': return 'Hverdager';
      case 'weekly': return 'Ukentlig' + (r.days && r.days.length ? ' (' + r.days.map((d) => names[d]).join(', ') + ')' : '');
      case 'monthly': return 'Månedlig';
      default: return '';
    }
  }

  // --- Poeng og streak ---
  const POINTS = { task: 10, step: 3, event: 5 };
  const BADGES = [
    { id: 'first', name: 'Første seier', emoji: '🌱', test: (g) => totalDone(g) >= 1 },
    { id: 'ten', name: '10 fullført', emoji: '⭐', test: (g) => totalDone(g) >= 10 },
    { id: 'fifty', name: '50 fullført', emoji: '🏅', test: (g) => totalDone(g) >= 50 },
    { id: 'hundred', name: '100 fullført', emoji: '🏆', test: (g) => totalDone(g) >= 100 },
    { id: 'streak3', name: '3 dager på rad', emoji: '🔥', test: (g) => g.bestStreak >= 3 },
    { id: 'streak7', name: 'En hel uke', emoji: '🚀', test: (g) => g.bestStreak >= 7 },
    { id: 'streak30', name: '30 dager', emoji: '👑', test: (g) => g.bestStreak >= 30 },
    { id: 'level5', name: 'Nivå 5', emoji: '💎', test: (g) => levelOf(g.points).level >= 5 }
  ];
  const totalDone = (g) => Object.values(g.history).reduce((a, b) => a + b, 0);
  function levelOf(points) {
    const level = Math.floor(Math.sqrt(Math.max(points, 0) / 25)) + 1;
    const base = 25 * (level - 1) ** 2;
    const next = 25 * level ** 2;
    return { level, progress: (points - base) / (next - base), toNext: next - points };
  }

  // Returnerer liste over hendelser (nye merker, streak-endring) for feiring i UI.
  function award(kind, sign = 1) {
    const g = state.game;
    const today = ymd();
    const news = [];
    g.points = Math.max(0, g.points + sign * POINTS[kind]);
    g.history[today] = Math.max(0, (g.history[today] || 0) + sign);
    if (sign > 0 && g.lastActive !== today) {
      if (g.lastActive) {
        const gap = Math.round((parseYmd(today) - parseYmd(g.lastActive)) / 864e5);
        if (gap === 1) g.streak += 1;
        else if (gap > 1 && gap - 1 <= g.freezes) { g.freezes -= gap - 1; g.streak += 1; news.push({ type: 'freeze' }); }
        else { g.streak = 1; if (gap > 1) news.push({ type: 'restart' }); }
      } else g.streak = 1;
      g.lastActive = today;
      if (g.streak > g.bestStreak) g.bestStreak = g.streak;
      if (g.streak > 0 && g.streak % 7 === 0 && g.freezes < 3) { g.freezes += 1; news.push({ type: 'freezeEarned' }); }
    }
    if (sign > 0 && g.history[today] === state.settings.dailyGoal) news.push({ type: 'goal' });
    BADGES.forEach((b) => { if (!g.badges.includes(b.id) && b.test(g)) { g.badges.push(b.id); news.push({ type: 'badge', badge: b }); } });
    return news;
  }

  // --- Mutasjoner ---
  function addTask(data) {
    const t = { id: uid(), title: '', cat: 'hjem', steps: [], done: false, energy: 'medium', prio: 2, due: '', today: '', notes: '', created: Date.now(), ...data };
    state.tasks.unshift(t); save(); return t;
  }
  function updateTask(id, patch) { const t = state.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); save(); return t; }
  function deleteTask(id) { state.tasks = state.tasks.filter((t) => t.id !== id); save(); }
  function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id); if (!t) return [];
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
    const news = award('task', t.done ? 1 : -1); save(); return news;
  }
  function toggleStep(taskId, stepId) {
    const t = state.tasks.find((x) => x.id === taskId); if (!t) return [];
    const s = t.steps.find((x) => x.id === stepId); if (!s) return [];
    s.done = !s.done; const news = award('step', s.done ? 1 : -1); save(); return news;
  }
  function addEvent(data) {
    const e = { id: uid(), title: '', cat: 'hjem', date: ymd(), time: '09:00', duration: 30, recur: { type: 'none', days: [], until: '' }, steps: [], done: {}, skipped: {}, stepDone: {}, notes: '', ...data };
    state.events.push(e); save(); return e;
  }
  function updateEvent(id, patch) { const e = state.events.find((x) => x.id === id); if (e) Object.assign(e, patch); save(); return e; }
  function deleteEvent(id) { state.events = state.events.filter((e) => e.id !== id); save(); }
  function skipOccurrence(id, date) { const e = state.events.find((x) => x.id === id); if (e) { e.skipped[date] = true; save(); } }
  function toggleOccurrence(id, date) {
    const e = state.events.find((x) => x.id === id); if (!e) return [];
    const nowDone = !e.done[date];
    if (nowDone) e.done[date] = Date.now(); else delete e.done[date];
    const news = award('event', nowDone ? 1 : -1); save(); return news;
  }
  function toggleEventStep(id, date, stepId) {
    const e = state.events.find((x) => x.id === id); if (!e) return [];
    const key = date + ':' + stepId;
    const nowDone = !e.stepDone[key];
    if (nowDone) e.stepDone[key] = true; else delete e.stepDone[key];
    const news = award('step', nowDone ? 1 : -1); save(); return news;
  }

  return {
    CATEGORIES, TEMPLATES, BADGES, POINTS, catById, makeEventFromTemplate,
    ymd, parseYmd, addDays, isoDow, mondayOf, hm, minutesOf, minToHm, uid,
    get state() { return state; },
    onChange: (fn) => listeners.add(fn),
    hasDeviceKey, hasData, unlockWithPassword, unlockWithDevice, lockDevice, wipe, rekey, changePassword, save, exportJson, importJson,
    occursOn, occurrencesOn, recurLabel, levelOf, totalDone,
    addTask, updateTask, deleteTask, toggleTask, toggleStep,
    addEvent, updateEvent, deleteEvent, skipOccurrence, toggleOccurrence, toggleEventStep
  };
})();
