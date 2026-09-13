// Datalag: tilstand i minnet, kryptert i localStorage. Kategorier, maler, gjentakelse og poeng.
window.PLStore = (() => {
  const DATA_KEY = 'pl.data';
  const DEVICE_KEY = 'pl.key';

  // Standardkategorier med forslag og standardsteg. Kopieres inn i brukerens data og kan endres fritt der.
  const ex = (title, steps) => ({ title, steps });
  const DEFAULT_CATEGORIES = [
    { id: 'hjem', name: 'Hjem', emoji: '🏠', color: '#f59e0b', examples: [
      ex('Ta oppvasken', ['Tømme oppvaskmaskinen', 'Skylle og sette inn', 'Vaske det som må tas for hånd', 'Tørke over benken']),
      ex('Sette på en klesvask', ['Samle skittentøy', 'Sortere lyst og mørkt', 'Legge i maskinen og fylle såpe', 'Velge program og starte', 'Sette alarm til vasken er ferdig']),
      ex('Rydde stua 10 min', ['Sette timer på 10 min', 'Plukke opp alt som ikke hører hjemme', 'Sette ting på plass', 'Rette på puter og tepper']),
      ex('Ta ut søpla', ['Knyte igjen posen', 'Sette i ny pose', 'Gå ut med søpla']),
      ex('Skifte sengetøy', ['Ta av det gamle', 'Finne fram rent sengetøy', 'Legge på laken', 'Dyne- og putetrekk', 'Legge det gamle i vasken']),
      ex('Støvsuge', ['Finne fram støvsugeren', 'Flytte ting fra gulvet', 'Støvsuge rom for rom', 'Sette støvsugeren på plass'])
    ] },
    { id: 'jobb', name: 'Jobb / skole', emoji: '💼', color: '#3b82f6', examples: [
      ex('Svare på e-post', ['Åpne innboksen', 'Velg den viktigste', 'Skriv et kort svar', 'Send']),
      ex('Forberede møte', ['Les innkallingen', 'Skriv 3 punkter du vil si', 'Finn fram dokumenter']),
      ex('Lese 25 min', ['Finn fram teksten', 'Lukk andre faner', 'Sett timer på 25 min', 'Noter 2 setninger om hva du leste']),
      ex('Levere oppgave', ['Les gjennom én gang', 'Sjekk krav og filformat', 'Last opp og lever', 'Sjekk at leveringen er registrert']),
      ex('Rydde skrivebordet', ['Fjern kopper og søppel', 'Legg papirer i én bunke', 'Tørk av'])
    ] },
    { id: 'helse', name: 'Helse', emoji: '🩺', color: '#ef4444', examples: [
      ex('Ta medisin', ['Finn fram medisinen', 'Ta den med et glass vann', 'Huk av her']),
      ex('Drikke et glass vann', ['Fyll et glass', 'Drikk det opp']),
      ex('Gå en tur 20 min', ['Ta på sko og jakke', 'Gå ut døra', 'Gå 10 min én vei', 'Snu og gå hjem']),
      ex('Trene', ['Skift til treningstøy', 'Fyll vannflaske', 'Gjør 10 min, resten er bonus']),
      ex('Legge meg før 23', ['Sett alarm 22:30 for kveldsrutinen', 'Mobil til lading utenfor soverommet', 'Pusse tenner', 'Lys av'])
    ] },
    { id: 'mat', name: 'Mat', emoji: '🍽️', color: '#22c55e', examples: [
      ex('Spise frokost', ['Finn fram noe enkelt', 'Spis', 'Sett inn koppen']),
      ex('Lage middag', ['Bestem hva du skal lage', 'Finn fram ingredienser', 'Lag maten', 'Spis', 'Sett inn i oppvaskmaskinen']),
      ex('Handle mat', ['Skriv handleliste', 'Ta med poser', 'Dra til butikken', 'Pakk ut']),
      ex('Planlegge ukesmeny', ['Velg 4–5 enkle middager', 'Skriv ned per dag', 'Lag handleliste']),
      ex('Lage matpakke', ['Finn fram brød og pålegg', 'Smør 2 skiver', 'Pakk inn og sett i kjøleskapet'])
    ] },
    { id: 'sosialt', name: 'Sosialt', emoji: '💬', color: '#a855f7', examples: [
      ex('Ringe familie', ['Finn et rolig sted', 'Ring', 'Avtal neste gang']),
      ex('Svare på meldinger', ['Åpne meldinger', 'Svar på den eldste først', 'Kort svar er nok']),
      ex('Avtale kaffe med en venn', ['Velg hvem', 'Send melding med 2 forslag til tid', 'Legg avtalen i planen']),
      ex('Sende en hyggelig melding', ['Velg én person', 'Skriv én setning', 'Send'])
    ] },
    { id: 'admin', name: 'Økonomi / admin', emoji: '📄', color: '#64748b', examples: [
      ex('Betale regninger', ['Logg inn i nettbanken', 'Åpne forfall og eFaktura', 'Godkjenn én av gangen', 'Sjekk at alt er betalt']),
      ex('Sjekke nettbank', ['Logg inn', 'Se over siste bevegelser', 'Noter noe som må følges opp']),
      ex('Bestille legetime', ['Finn nummer eller nettside', 'Ha kalenderen klar', 'Ring eller bestill', 'Legg timen i planen']),
      ex('Fornye resept', ['Logg inn på helsenorge.no', 'Finn resepten', 'Send fornyelse']),
      ex('Sjekke posten', ['Hent posten', 'Kast reklame', 'Legg viktige brev i én bunke'])
    ] },
    { id: 'egentid', name: 'Egentid', emoji: '🌿', color: '#14b8a6', examples: [
      ex('Lese 15 min', ['Finn boka', 'Sett timer på 15 min', 'Les']),
      ex('Puste rolig 5 min', ['Sett deg godt', 'Sett timer på 5 min', 'Pust inn på 4, ut på 6']),
      ex('Gå tur uten mobil', ['Legg mobilen igjen', 'Gå ut', 'Legg merke til 3 ting du ser']),
      ex('Hobby 30 min', ['Finn fram utstyret', 'Sett timer på 30 min', 'Start på det enkleste']),
      ex('Høre på musikk', ['Velg en spilleliste', 'Sett deg ned', 'Lytt til 3 sanger'])
    ] },
    { id: 'aerend', name: 'Ærend', emoji: '🚗', color: '#ec4899', examples: [
      ex('Hente pakke', ['Finn hentekoden', 'Ta med legitimasjon', 'Dra og hent']),
      ex('Levere pant', ['Samle pant i en pose', 'Ta med til butikken', 'Pant og kjøp noe fint']),
      ex('Kjøpe gave', ['Bestem budsjett', 'Velg 1–2 ideer', 'Kjøp', 'Pakk inn']),
      ex('Til apoteket', ['Sjekk hva du trenger', 'Ta med legitimasjon', 'Dra']),
      ex('Fylle bensin', ['Sjekk nivået', 'Kjør til stasjonen', 'Fyll og betal'])
    ] },
    { id: 'dyr',     name: 'Dyr',             emoji: '🐾', color: '#f97316', examples: [
      ex('Mate hunden', ['Finne fram fôret', 'Fylle skåla', 'Bytte vann']),
      ex('Lufte hunden', ['Finne bånd og poser', 'Gå ut', 'Gå minst 15 min']),
      ex('Bytte kattesand', ['Finne fram pose og ny sand', 'Tømme kassen', 'Fylle på ny sand', 'Kaste posen']),
      ex('Kjøpe dyremat', ['Sjekke hva som er tomt', 'Skrive på handlelista', 'Kjøpe']),
      ex('Bestille veterinærtime', ['Finne nummeret', 'Ha kalenderen klar', 'Ringe', 'Legge timen i planen'])
    ] },
    { id: 'annet',   name: 'Annet',           emoji: '📌', color: '#94a3b8', examples: [] }
  ];
  const CATEGORY_COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#64748b', '#14b8a6', '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#8b5cf6'];

  const DEFAULT_TEMPLATES = [
    { title: 'Morgenrutine', cat: 'helse', time: '07:30', duration: 30, recur: 'daily',
      steps: ['Stå opp og drikke vann', 'Ta medisin', 'Dusje / vaske ansiktet', 'Kle på meg', 'Spise frokost', 'Sjekke dagens plan'] },
    { title: 'Kveldsrutine', cat: 'egentid', time: '21:30', duration: 30, recur: 'daily',
      steps: ['Legge fram klær til i morgen', 'Sette mobilen til lading utenfor soverommet', 'Pusse tenner', 'Lese eller puste rolig 10 min'] },
    { title: 'Planlegge morgendagen', cat: 'admin', time: '21:00', duration: 10, recur: 'daily',
      steps: ['Se på kalenderen for i morgen', 'Velg 1–3 viktigste oppgaver', 'Legg dem inn i planen'] },
    { title: 'Ta medisin', cat: 'helse', time: '08:00', duration: 5, recur: 'daily', steps: ['Finn fram medisinen', 'Ta den med et glass vann'] },
    { title: 'Måltid', cat: 'mat', time: '17:00', duration: 45, recur: 'daily', steps: ['Finne fram ingredienser', 'Lage maten', 'Spise', 'Sette inn i oppvaskmaskinen'] },
    { title: 'Trening', cat: 'helse', time: '17:30', duration: 45, recur: 'weekly', days: [1, 3, 5], steps: ['Skifte til treningstøy', 'Fylle vannflaske', 'Dra'] },
    { title: 'Ukesrydding', cat: 'hjem', time: '11:00', duration: 60, recur: 'weekly', days: [6], steps: ['Bad', 'Kjøkken', 'Støvsuge', 'Søppel ut'] },
    { title: 'Ukesplanlegging', cat: 'admin', time: '19:00', duration: 20, recur: 'weekly', days: [7], steps: ['Se over neste uke', 'Legge inn avtaler', 'Handleliste'] },
    { title: 'Pause uten skjerm', cat: 'egentid', time: '15:00', duration: 15, recur: 'weekdays', steps: [] }
  ];

  // --- Dato-hjelpere (ISO internt, nordisk visning) ---
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
  // 'YYYY-MM-DD' -> 'dd.mm.yyyy'
  const fmtNb = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '');
  // 'dd.mm.yyyy' | 'd.m.yy' | 'd.m' | 'YYYY-MM-DD' -> ISO eller null
  function parseNb(str) {
    const s = String(str || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidYmd(s) ? s : null;
    const m = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
    if (!m) return null;
    let y = m[3] ? +m[3] : new Date().getFullYear();
    if (y < 100) y += 2000;
    const iso = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
    return isValidYmd(iso) ? iso : null;
  }
  function isValidYmd(iso) { const d = parseYmd(iso); return !isNaN(d) && ymd(d) === iso; }
  // 'HH:MM' | 'HH.MM' | 'HHMM' | 'H' -> 'HH:MM' eller null
  function parseTime(str) {
    const s = String(str || '').trim().replace(/\s/g, '');
    const m = s.match(/^(\d{1,2})(?:[:.h]?(\d{2}))?$/);
    if (!m) return null;
    const h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 23 || mi > 59) return null;
    return `${pad(h)}:${pad(mi)}`;
  }

  // --- Tilstand ---
  let state = null;
  let aesKey = null;
  let saveTimer = null;
  const listeners = new Set();

  const cloneCats = () => DEFAULT_CATEGORIES.map((c) => ({ ...c, examples: c.examples.map((e) => ({ title: e.title, steps: [...e.steps] })) }));
  const cloneTemplates = () => DEFAULT_TEMPLATES.map((t) => ({ id: uid(), ...t, days: t.days || [], steps: [...t.steps] }));

  function defaultState() {
    const today = ymd();
    const templates = cloneTemplates();
    return {
      version: 2,
      categories: cloneCats(),
      templates,
      tasks: [],
      events: [
        makeEventFromTemplate(templates[0], today),
        makeEventFromTemplate(templates[1], today),
        makeEventFromTemplate(templates[2], today)
      ],
      inbox: [],
      energyLog: {},
      game: { points: 0, streak: 0, bestStreak: 0, lastActive: null, freezes: 1, history: {}, badges: [] },
      settings: { theme: 'auto', notify: true, calm: false, onboarded: false, lastCat: '', dayStart: '06:00', dayEnd: '23:00', dailyGoal: 3, ai: { ...window.PLANLEGGER_CONFIG.ai } }
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

  // --- Kategorier og maler (brukerens egne) ---
  const cats = () => state.categories;
  const templates = () => state.templates;
  // Standardkategori for fritekst: «Annet» hvis den finnes, ellers første kategori.
  const defaultCatId = () => (state.categories.some((c) => c.id === 'annet') ? 'annet' : state.categories[0].id);
  function catById(id) {
    return (state && state.categories.find((c) => c.id === id)) || DEFAULT_CATEGORIES.find((c) => c.id === id) || { id, name: 'Uten kategori', emoji: '📁', color: '#94a3b8', examples: [] };
  }
  function addCategory(data) {
    const base = (data.name || 'kategori').toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-|-$/g, '') || 'kat';
    let id = base, n = 2;
    while (state.categories.some((c) => c.id === id)) id = base + '-' + n++;
    const c = { id, name: data.name || 'Ny kategori', emoji: data.emoji || '📁', color: data.color || CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length], examples: data.examples || [] };
    state.categories.push(c); save(); return c;
  }
  function updateCategory(id, patch) { const c = state.categories.find((x) => x.id === id); if (c) Object.assign(c, patch); save(); return c; }
  function deleteCategory(id) {
    if (state.categories.length <= 1) return false;
    const fallback = state.categories.find((c) => c.id !== id).id;
    state.tasks.forEach((t) => { if (t.cat === id) t.cat = fallback; });
    state.events.forEach((e) => { if (e.cat === id) e.cat = fallback; });
    state.templates.forEach((t) => { if (t.cat === id) t.cat = fallback; });
    state.categories = state.categories.filter((c) => c.id !== id); save(); return true;
  }
  // Finner et forslag som matcher tittelen. Foretrukket kategori søkes først, deretter de andre.
  // Returnerer { title, steps, cat } eller null.
  function findExample(title, preferCat) {
    const q = String(title || '').trim().toLowerCase();
    if (!q) return null;
    const ordered = [...state.categories].sort((a, b) => (b.id === preferCat) - (a.id === preferCat));
    const match = (exact) => {
      for (const c of ordered) {
        const hit = exact
          ? c.examples.find((e) => e.title.toLowerCase() === q)
          : c.examples.find((e) => q.includes(e.title.toLowerCase()) || e.title.toLowerCase().includes(q));
        if (hit && hit.steps.length) return { ...hit, cat: c.id };
      }
      return null;
    };
    return match(true) || match(false);
  }
  function addTemplate(data) { const t = { id: uid(), title: '', cat: state.categories[0].id, time: '09:00', duration: 30, recur: 'none', days: [], steps: [], ...data }; state.templates.push(t); save(); return t; }
  function updateTemplate(id, patch) { const t = state.templates.find((x) => x.id === id); if (t) Object.assign(t, patch); save(); return t; }
  function deleteTemplate(id) { state.templates = state.templates.filter((t) => t.id !== id); save(); }

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
    state.inbox = state.inbox || [];
    state.energyLog = state.energyLog || {};
    if (!Array.isArray(state.categories) || !state.categories.length) state.categories = cloneCats();
    state.categories.forEach((c) => { c.examples = (c.examples || []).map((e) => (typeof e === 'string' ? { title: e, steps: [] } : { title: e.title, steps: e.steps || [] })); });
    // Fyll inn standardsteg for eksempler som mangler dem (fra v1)
    state.categories.forEach((c) => { const def = DEFAULT_CATEGORIES.find((x) => x.id === c.id); if (!def) return; c.examples.forEach((e) => { if (!e.steps.length) { const de = def.examples.find((x) => x.title === e.title); if (de) e.steps = [...de.steps]; } }); });
    // Ikonoppdateringer og ny standardkategori «Dyr» for eksisterende data
    state.categories.forEach((c) => {
      if (c.id === 'helse' && c.emoji === '💊') c.emoji = '🩺';
      if (/^dyr$/i.test((c.name || '').trim()) && (c.emoji === '📁' || !c.emoji)) c.emoji = '🐾';
    });
    if (!state.categories.some((c) => c.id === 'dyr' || /^dyr$/i.test((c.name || '').trim()))) {
      const dyr = cloneCats().find((c) => c.id === 'dyr');
      if (dyr) state.categories.push(dyr);
    }
    if (!state.categories.some((c) => c.id === 'annet')) state.categories.push({ id: 'annet', name: 'Annet', emoji: '📌', color: '#94a3b8', examples: [] });
    if (!Array.isArray(state.templates)) state.templates = cloneTemplates();
    state.events.forEach((e) => { e.done = e.done || {}; e.skipped = e.skipped || {}; e.stepDone = e.stepDone || {}; e.steps = e.steps || []; e.recur = e.recur || { type: 'none', days: [], until: '' }; });
    state.tasks.forEach((t) => { t.steps = t.steps || []; });
    // v1 telte steg som fullførte i historikken; regn om til faktiske fullføringer.
    if ((state.version || 1) < 2) {
      const hist = {};
      state.tasks.forEach((t) => { if (t.done && t.doneAt) { const k = ymd(new Date(t.doneAt)); hist[k] = (hist[k] || 0) + 1; } });
      state.events.forEach((e) => Object.keys(e.done).forEach((k) => { hist[k] = (hist[k] || 0) + 1; }));
      state.game.history = hist;
      state.version = 2;
    }
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

  // Kalenderfil (.ics) med aktiviteter og gjentakelse, slik at telefonens kalender kan varsle selv når appen er lukket.
  function exportIcs() {
    const dt = (date, time) => date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
    const escT = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const BY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planlegger//NO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Planlegger'];
    state.events.forEach((e) => {
      let rrule = '';
      const r = e.recur || { type: 'none' };
      if (r.type === 'daily') rrule = 'FREQ=DAILY';
      else if (r.type === 'weekdays') rrule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
      else if (r.type === 'weekly') rrule = 'FREQ=WEEKLY;BYDAY=' + (r.days && r.days.length ? r.days : [isoDow(e.date)]).map((d) => BY[d]).join(',');
      else if (r.type === 'monthly') rrule = 'FREQ=MONTHLY';
      if (rrule && r.until) rrule += ';UNTIL=' + r.until.replace(/-/g, '') + 'T235959';
      lines.push('BEGIN:VEVENT', `UID:${e.id}@planlegger`, `DTSTAMP:${dt(ymd(), hm())}`, `DTSTART:${dt(e.date, e.time)}`, `DURATION:PT${e.duration || 30}M`, `SUMMARY:${escT(e.title)}`);
      if (rrule) lines.push('RRULE:' + rrule);
      Object.keys(e.skipped || {}).forEach((d) => lines.push(`EXDATE:${dt(d, e.time)}`));
      const desc = [(e.steps || []).map((s) => '- ' + s.title).join('\n'), e.notes].filter(Boolean).join('\n');
      if (desc) lines.push(`DESCRIPTION:${escT(desc)}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT5M', `DESCRIPTION:${escT(e.title)}`, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // --- Innboks (tankefanger) og energi ---
  function addInbox(text) { const n = { id: uid(), text: text.trim(), created: Date.now() }; state.inbox.unshift(n); save(); return n; }
  function deleteInbox(id) { state.inbox = state.inbox.filter((n) => n.id !== id); save(); }
  function setEnergy(date, level) { if (level) state.energyLog[date] = level; else delete state.energyLog[date]; save(); }
  const energyOn = (date) => state.energyLog[date] || '';
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

  // Poeng gis for alt; bare fullførte oppgaver/aktiviteter (ikke steg) teller mot dagsmål, streak og merker.
  // Returnerer liste over hendelser (nye merker, streak-endring) for feiring i UI.
  function award(kind, sign = 1) {
    const g = state.game;
    const today = ymd();
    const news = [];
    g.points = Math.max(0, g.points + sign * POINTS[kind]);
    if (kind === 'step') return news;
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
    const t = { id: uid(), title: '', cat: state.categories[0].id, steps: [], done: false, energy: 'medium', prio: 2, due: '', today: '', notes: '', trigger: '', created: Date.now(), ...data };
    state.tasks.unshift(t); save(); return t;
  }
  function updateTask(id, patch) { const t = state.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); save(); return t; }
  function deleteTask(id) { state.tasks = state.tasks.filter((t) => t.id !== id); save(); }
  function restoreTask(t, index) { if (state.tasks.some((x) => x.id === t.id)) return; state.tasks.splice(Math.min(Math.max(index, 0), state.tasks.length), 0, t); save(); }
  function restoreEvent(e, index) { if (state.events.some((x) => x.id === e.id)) return; state.events.splice(Math.min(Math.max(index, 0), state.events.length), 0, e); save(); }
  function unskipOccurrence(id, date) { const e = state.events.find((x) => x.id === id); if (e) { delete e.skipped[date]; save(); } }
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
    const e = { id: uid(), title: '', cat: state.categories[0].id, date: ymd(), time: '09:00', duration: 30, recur: { type: 'none', days: [], until: '' }, steps: [], done: {}, skipped: {}, stepDone: {}, notes: '', ...data };
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
    CATEGORY_COLORS, BADGES, POINTS, cats, templates, catById, defaultCatId, findExample, makeEventFromTemplate,
    addCategory, updateCategory, deleteCategory, addTemplate, updateTemplate, deleteTemplate,
    ymd, parseYmd, addDays, isoDow, mondayOf, hm, minutesOf, minToHm, uid, fmtNb, parseNb, parseTime,
    get state() { return state; },
    onChange: (fn) => listeners.add(fn),
    hasDeviceKey, hasData, unlockWithPassword, unlockWithDevice, lockDevice, wipe, rekey, changePassword, save, exportJson, exportIcs, importJson,
    addInbox, deleteInbox, setEnergy, energyOn,
    occursOn, occurrencesOn, recurLabel, levelOf, totalDone,
    addTask, updateTask, deleteTask, restoreTask, toggleTask, toggleStep,
    addEvent, updateEvent, deleteEvent, restoreEvent, skipOccurrence, unskipOccurrence, toggleOccurrence, toggleEventStep
  };
})();
