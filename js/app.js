// Brukergrensesnitt for Planlegger.
(() => {
  const S = PLStore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let view = 'today';
  let selectedDate = S.ymd();
  let planDate = S.ymd(); // dagen som vises under «Dagens plan» på I dag (sveip for å bla)
  let listFilter = 'open';
  let listCat = 'all';
  let focus = null;
  let focusTimer = null;
  const notified = new Set();

  const DAY_NAMES = ['', 'man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];
  const fmtLong = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' });
  const longDate = (s) => fmtLong.format(S.parseYmd(s));
  const shortDate = (s) => fmtShort.format(S.parseYmd(s));
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const energyLabel = { low: '🟢 lett', medium: '🟡 middels', high: '🔴 krevende' };
  const eRank = { low: 0, medium: 1, high: 2 };

  const ICONS = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg>',
    lists: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12.5 2.5 2.5L16 9.5"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M7.5 14h3M13.5 14h3M7.5 17.5h3M13.5 17.5h3"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="17" r="2" fill="var(--surface)"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" opacity=".4"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>'
  };

  // ---------- Oppstart ----------
  async function boot() {
    applyTheme('auto');
    if (S.hasDeviceKey()) {
      try {
        if (await S.unlockWithDevice()) return start();
        S.lockDevice();
      } catch (e) {
        if (e.message === 'DECRYPT_FAILED') return renderDecryptFailed();
        S.lockDevice();
      }
    }
    renderLogin();
  }

  function applyTheme(t) { document.documentElement.dataset.theme = t || 'auto'; }

  function renderLogin(msg) {
    $('#app').innerHTML = `
      <div class="login"><div class="card">
        <div class="logo">${ICONS.logo}</div>
        <h1 class="center">Planlegger</h1>
        <p class="center muted small mb">Skriv inn passordet ditt. Du trenger bare gjøre det én gang på denne enheten.</p>
        <form data-form="login">
          <label class="field"><span>Passord</span><input class="input" type="password" name="pw" autocomplete="current-password" autofocus required></label>
          <label class="row small mb"><input type="checkbox" name="remember" checked> Husk denne enheten</label>
          ${msg ? `<p class="small" style="color:var(--danger)">${esc(msg)}</p>` : ''}
          <button class="btn primary block" type="submit">Lås opp</button>
        </form>
        <p class="tiny muted mt center">Alle data lagres kryptert på denne enheten. Ingenting sendes til en server.</p>
      </div></div>`;
  }

  function renderDecryptFailed() {
    $('#app').innerHTML = `
      <div class="login"><div class="card">
        <div class="logo">${ICONS.logo}</div>
        <h2 class="center mb">Kunne ikke låse opp dataene</h2>
        <p class="small muted">Dataene på denne enheten er kryptert med et annet passord enn det som ble brukt nå. Prøv igjen med det gamle passordet, eller slett lokale data og start på nytt.</p>
        <button class="btn block mb" data-act="retryLogin">Prøv et annet passord</button>
        <button class="btn danger block" data-act="wipeAll">Slett lokale data</button>
      </div></div>`;
  }

  const APP_VERSION = '12';

  // Registrerer service worker og laster siden på nytt når en ny versjon har tatt over.
  function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true; toast('Appen er oppdatert til ny versjon. Laster på nytt …', true);
      setTimeout(() => location.reload(), 800);
    });
    navigator.serviceWorker.register('sw.js').then((reg) => { reg.update().catch(() => {}); }).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) navigator.serviceWorker.getRegistration().then((r) => r && r.update().catch(() => {})); });
  }

  async function start() {
    applyTheme(S.state.settings.theme);
    renderShell();
    render();
    setupServiceWorker();
    // Minuttoppdatering av I dag, men aldri mens noe skrives (ellers mistes teksten).
    const typing = () => (document.activeElement && document.activeElement.closest('form')) || ($('[data-input="quickTitle"]') || {}).value;
    setInterval(() => { checkReminders(); if (view === 'today' && !$('#modal').innerHTML && !typing()) render(); }, 60000);
    checkReminders();
  }

  function renderShell() {
    const nav = (cls) => ['today', 'lists', 'plan', 'more'].map((v) => {
      const label = { today: 'I dag', lists: 'Lister', plan: 'Plan', more: 'Mer' }[v];
      return `<button class="nav-btn ${cls} ${view === v ? 'active' : ''}" data-act="nav" data-view="${v}">${ICONS[v]}<span>${label}</span></button>`;
    }).join('');
    $('#app').innerHTML = `
      <aside class="sidebar"><div class="brand"><span class="mark">${ICONS.logo}</span>Planlegger</div>${nav('side')}</aside>
      <main class="main" id="main"></main>
      <nav class="bottom-nav">${nav('')}</nav>
      <button class="fab" data-act="fab" aria-label="Legg til">${ICONS.plus}</button>`;
  }

  function render() {
    if (!S.state) return;
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $('.fab').hidden = view === 'more';
    $('#main').innerHTML = { today: renderToday, lists: renderLists, plan: renderPlan, more: renderMore }[view]();
    if (view === 'more') fillSettingsForm();
    revealActiveChips();
  }

  // ---------- Felles byggeklosser ----------
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'God natt' : h < 10 ? 'God morgen' : h < 18 ? 'Hei' : 'God kveld';
  }
  function statsHtml() {
    const g = S.state.game;
    const lv = S.levelOf(g.points);
    const today = g.history[S.ymd()] || 0;
    const goal = S.state.settings.dailyGoal;
    return `<div class="statline">
      <span title="Poeng og nivå">⭐ <b>${g.points}</b> nivå ${lv.level}</span>
      <span title="Dager på rad">🔥 <b>${g.streak}</b> ${g.streak === 1 ? 'dag' : 'dager'} på rad</span>
      <span title="Fullført i dag">🎯 <b>${Math.min(today, goal)}/${goal}</b> i dag${today > goal ? ` <b style="color:var(--success)">+${today - goal} bonus</b>` : ''}</span>
    </div>`;
  }
  function dueLabel(due) {
    const t = S.ymd();
    if (due === t) return 'i dag';
    if (due === S.addDays(t, 1)) return 'i morgen';
    if (due < t) return `<span style="color:var(--danger)">forfalt ${shortDate(due)}</span>`;
    return shortDate(due);
  }
  function catOptions(sel) { return S.cats().map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join(''); }
  // Kategorier sortert etter bruk (mest brukt først), «Annet» alltid sist.
  function catsByUsage() {
    const n = {};
    S.state.tasks.forEach((t) => { n[t.cat] = (n[t.cat] || 0) + 1; });
    S.state.events.forEach((e) => { n[e.cat] = (n[e.cat] || 0) + 1; });
    const cats = S.cats();
    return [...cats].sort((a, b) => (a.id === 'annet') - (b.id === 'annet') || (n[b.id] || 0) - (n[a.id] || 0) || cats.indexOf(a) - cats.indexOf(b));
  }
  // Kategorichips. `wrap` = bryt over flere linjer (skjema), ellers rullbar rad (I dag).
  function catChipsHtml(sel, act, wrap) {
    return `<div class="chips ${wrap ? '' : 'scroll'} cat-chips">${catsByUsage().map((x) => `<button type="button" class="chip ${x.id === sel ? 'active' : ''}" data-act="${act}" data-v="${x.id}" style="${x.id === sel ? `border-color:${x.color};color:${x.color};background:${x.color}1a` : ''}">${x.emoji} ${esc(x.name)}</button>`).join('')}</div>`;
  }
  // Oppdaterer chips + skjult felt + forslag i et skjema uten å tegne alt på nytt.
  function syncFormCat(f, id) {
    f.cat.value = id;
    $$('.cat-chips .chip', f).forEach((b) => {
      const c = S.catById(b.dataset.v); const on = b.dataset.v === id;
      b.classList.toggle('active', on);
      b.style.cssText = on ? `border-color:${c.color};color:${c.color};background:${c.color}1a` : '';
    });
    const ex = $('#examples', f); if (ex) ex.outerHTML = exampleChips(id);
  }
  function exampleChips(catId) {
    const c = S.catById(catId);
    if (!c.examples.length) return `<div id="examples" class="tiny muted">Ingen forslag i denne kategorien ennå. Legg til under Mer → Kategorier.</div>`;
    return `<div class="chips" id="examples">${c.examples.map((x, i) => `<button type="button" class="chip small" data-act="useExample" data-cat="${c.id}" data-i="${i}" title="${x.steps.length ? x.steps.length + ' standardsteg' : ''}">${esc(x.title)}${x.steps.length ? ' <span class="muted">·' + x.steps.length + '</span>' : ''}</button>`).join('')}</div>`;
  }

  // Nordisk datofelt: tekst dd.mm.åååå + kalenderknapp (skjult native velger) + hurtigvalg.
  function dateField(name, iso, chips) {
    return `<div class="dt">
      <input class="input" name="${name}" value="${S.fmtNb(iso)}" placeholder="dd.mm.åååå" inputmode="numeric" autocomplete="off">
      <button type="button" class="btn icon outline" data-act="pickDate" data-for="${name}" aria-label="Velg dato i kalender">📅</button>
      <input type="date" tabindex="-1" aria-hidden="true" data-change="nativeDate" data-for="${name}">
    </div>
    ${chips ? `<div class="chips">${chips.map(([l, v]) => `<button type="button" class="chip small" data-act="setDate" data-for="${name}" data-v="${v}">${l}</button>`).join('')}</div>` : ''}`;
  }
  function timeField(name, hm, steppers) {
    const inp = `<input class="input" name="${name}" value="${esc(hm || '')}" placeholder="tt:mm" inputmode="numeric" autocomplete="off">`;
    if (!steppers) return inp;
    return `<div class="dt"><button type="button" class="btn icon outline" data-act="timeStep" data-for="${name}" data-n="-15" aria-label="15 min tidligere">−</button>${inp}<button type="button" class="btn icon outline" data-act="timeStep" data-for="${name}" data-n="15" aria-label="15 min senere">+</button></div>`;
  }
  const dateChips = (withNone) => [['I dag', S.ymd()], ['I morgen', S.addDays(S.ymd(), 1)], ['Om en uke', S.addDays(S.ymd(), 7)], ...(withNone ? [['Ingen', '']] : [])];

  // ctx: 'today' | 'list' | 'group' (inne i kategorigruppe). Kategori vises med fargestripe og emoji, ikke tekst.
  function taskItemHtml(t, ctx = 'list') {
    const c = S.catById(t.cat);
    const sd = t.steps.filter((s) => s.done).length;
    const meta = [];
    if (t.due) meta.push(dueLabel(t.due));
    if (t.steps.length) meta.push(`${sd}/${t.steps.length} steg`);
    if (t.energy && t.energy !== 'medium') meta.push(energyLabel[t.energy]);
    if (t.trigger) meta.push('⛓ etter ' + esc(t.trigger));
    if (t.done && t.actualMin) meta.push(`brukte ${t.actualMin} min`);
    return `<div class="item task ${t.done ? 'done' : ''}" style="--c:${c.color}">
      <button class="check ${t.done ? 'on' : ''}" data-act="toggleTask" data-id="${t.id}" aria-label="Fullfør">${t.done ? '✓' : ''}</button>
      <div class="grow" data-act="openTask" data-id="${t.id}" style="cursor:pointer" title="${esc(c.name)}">
        <div class="title">${t.prio === 1 && !t.done ? '<span class="star">★</span> ' : ''}${ctx === 'group' ? '' : c.emoji + ' '}${esc(t.title)}</div>
        ${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}
      </div>
      ${!t.done ? `<div class="item-actions">
        <button class="btn ghost icon" title="Start fokus" aria-label="Start fokus" data-act="focusTask" data-id="${t.id}">▶</button>
        <button class="btn ghost icon" title="Flere valg" aria-label="Flere valg" data-act="taskMenu" data-id="${t.id}" data-ctx="${ctx}">⋯</button>
      </div>` : ''}
    </div>`;
  }

  // Samler aktiviteter (gjentakende + engangs) og tidsatte oppgaver for en dag.
  function dayEntries(date) {
    const occ = S.occurrencesOn(date).map((o) => ({
      kind: 'event', id: o.ev.id, date, title: o.ev.title, cat: o.ev.cat, start: o.start, end: o.end, done: o.done, trigger: o.ev.trigger,
      steps: o.ev.steps, isStepDone: (s) => !!o.ev.stepDone[date + ':' + s.id], recur: o.ev.recur, duration: o.ev.duration || 0
    }));
    const tasks = S.state.tasks.filter((t) => t.today === date && t.plannedTime).map((t) => {
      const st = S.minutesOf(t.plannedTime); const dur = t.plannedDuration || 25;
      return { kind: 'task', id: t.id, date, title: t.title, cat: t.cat, start: st, end: st + dur, done: t.done, trigger: t.trigger, steps: t.steps, isStepDone: (s) => s.done, recur: null, duration: dur, prio: t.prio };
    });
    return [...occ, ...tasks].sort((a, b) => a.start - b.start);
  }

  const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} t${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);

  // Proporsjonal dagslinje: gjør dagens form og «hvor er jeg nå» synlig på ett blikk.
  function dayBarHtml(entries, date) {
    const st = S.state.settings;
    const s = S.minutesOf(st.dayStart), e = Math.max(S.minutesOf(st.dayEnd), s + 60);
    const span = e - s;
    const pct = (m) => Math.max(0, Math.min(100, ((m - s) / span) * 100));
    const nm = nowMin();
    const isToday = date === S.ymd();
    const blocks = entries.filter((en) => en.end > s && en.start < e).map((en) => `<i class="${en.done ? 'done' : ''}" style="left:${pct(en.start)}%;width:${Math.max(pct(en.end) - pct(en.start), 0.8)}%;background:${S.catById(en.cat).color}" title="${S.minToHm(en.start)} ${esc(en.title)}"></i>`).join('');
    const now = isToday && nm >= s && nm <= e ? `<span class="now" style="left:${pct(nm)}%"></span>` : '';
    return `<div class="daybar">${blocks}${now}</div><div class="daybar-labels"><span>${st.dayStart}</span>${isToday ? `<span class="n">nå ${S.hm()}</span>` : '<span></span>'}<span>${st.dayEnd}</span></div>`;
  }

  function entryHtml(e, showNow) {
    const c = S.catById(e.cat);
    if (e.done) {
      const toggleAct = e.kind === 'event' ? 'toggleOcc' : 'toggleTask';
      return `<div class="item done compact" style="--c:${c.color}">
        <div class="time-col">${S.minToHm(e.start)}</div>
        <button class="check on" data-act="${toggleAct}" data-id="${e.id}" data-date="${e.date}" aria-label="Angre fullført">✓</button>
        <div class="grow title" data-act="${e.kind === 'event' ? 'openEvent' : 'openTask'}" data-id="${e.id}" data-date="${e.date}" style="cursor:pointer">${c.emoji} ${esc(e.title)}</div>
      </div>`;
    }
    const sd = e.steps.filter(e.isStepDone).length;
    const meta = [`${e.duration} min`];
    if (e.steps.length) meta.push(`${sd}/${e.steps.length} steg`);
    if (e.recur && e.recur.type !== 'none') meta.push('🔁 ' + S.recurLabel(e.recur));
    if (e.trigger) meta.push('⛓ etter ' + esc(e.trigger));
    const openAct = e.kind === 'event' ? 'openEvent' : 'openTask';
    const toggleAct = e.kind === 'event' ? 'toggleOcc' : 'toggleTask';
    const focusAct = e.kind === 'event' ? 'focusEvent' : 'focusTask';
    const isNow = showNow && !e.done && e.start <= nowMin() && nowMin() < e.end;
    return `<div class="item ${e.done ? 'done' : ''}" style="--c:${c.color}">
      <div class="time-col" ${isNow ? 'style="color:var(--primary);font-weight:700"' : ''}>${S.minToHm(e.start)}</div>
      <button class="check ${e.done ? 'on' : ''}" data-act="${toggleAct}" data-id="${e.id}" data-date="${e.date}" aria-label="Fullfør">${e.done ? '✓' : ''}</button>
      <div class="grow" data-act="${openAct}" data-id="${e.id}" data-date="${e.date}" style="cursor:pointer">
        <div class="title">${e.prio === 1 && !e.done ? '<span class="star">★</span> ' : ''}${c.emoji} ${esc(e.title)}</div>
        <div class="meta">${meta.join(' · ')}</div>
      </div>
      ${!e.done ? `<div class="item-actions"><button class="btn sm ${isNow ? 'primary' : 'ghost'}" title="Start fokus" data-act="${focusAct}" data-id="${e.id}" data-date="${e.date}">▶</button></div>` : ''}
    </div>`;
  }

  // Tidslinje med nå-markør og synlige ledige luker (gjør tid konkret).
  function timelineHtml(entries, date) {
    if (!entries.length) return '';
    const isToday = date === S.ymd();
    const nm = nowMin();
    let html = '<div class="timeline">';
    let nowInserted = !isToday;
    let prevEnd = null;
    entries.forEach((e) => {
      if (prevEnd !== null && e.start - prevEnd >= 30) {
        const gap = e.start - prevEnd;
        html += `<div class="gap">${gap >= 60 ? Math.floor(gap / 60) + ' t ' + (gap % 60 ? gap % 60 + ' min' : '') : gap + ' min'} ledig</div>`;
      }
      if (!nowInserted && e.start > nm) { html += `<div class="now-line">nå ${S.hm()}</div>`; nowInserted = true; }
      html += entryHtml(e, isToday);
      prevEnd = Math.max(prevEnd ?? 0, e.end);
    });
    if (!nowInserted) html += `<div class="now-line">nå ${S.hm()}</div>`;
    return html + '</div>';
  }

  function openTasksFor(date) {
    const dayE = S.energyOn(date);
    const match = (t) => (dayE ? Math.abs(eRank[t.energy] - eRank[dayE]) : 0);
    return S.state.tasks
      .filter((t) => !t.done && !(t.today === date && t.plannedTime) && (t.today === date || (t.due && t.due <= date)))
      .sort((a, b) => (b.prio === 1) - (a.prio === 1) || match(a) - match(b) || (a.due || '~').localeCompare(b.due || '~'));
  }

  // ---------- I dag ----------
  function renderToday() {
    const today = S.ymd();
    const entries = dayEntries(today);
    const planEntries = planDate === today ? entries : dayEntries(planDate);
    const openTasks = openTasksFor(today);
    const doneToday = S.state.tasks.filter((t) => t.done && t.doneAt && S.ymd(new Date(t.doneAt)) === today);
    const nm = nowMin();
    const current = entries.find((e) => !e.done && e.start <= nm && nm < e.end);
    const next = entries.find((e) => !e.done && e.start > nm);
    const g = S.state.game;
    const todayCount = g.history[today] || 0;
    const dayE = S.energyOn(today);
    const starred = openTasks.filter((t) => t.prio === 1).length;

    let nowCard;
    if (current) {
      const pct = Math.round(((nm - current.start) / Math.max(current.end - current.start, 1)) * 100);
      nowCard = `<div class="card now-card">
        <div class="eyebrow">Nå · ${current.end - nm} min igjen (til ${S.minToHm(current.end)})</div>
        <h2>${esc(current.title)}</h2>
        <div class="progress mb"><div style="width:${pct}%"></div></div>
        <div class="row"><button class="btn light" data-act="${current.kind === 'event' ? 'focusEvent' : 'focusTask'}" data-id="${current.id}" data-date="${today}">▶ Fokus</button>
        <button class="btn" data-act="${current.kind === 'event' ? 'toggleOcc' : 'toggleTask'}" data-id="${current.id}" data-date="${today}">✓ Ferdig</button></div>
      </div>`;
    } else if (next && (next.start - nm <= 60 || !openTasks.length)) {
      const diff = next.start - nm;
      nowCard = `<div class="card now-card">
        <div class="eyebrow">Neste · om ${fmtDur(diff)} (kl. ${S.minToHm(next.start)})</div>
        <h2>${esc(next.title)}</h2>
        <div class="row"><button class="btn light" data-act="${next.kind === 'event' ? 'focusEvent' : 'focusTask'}" data-id="${next.id}" data-date="${today}">▶ Start nå</button>
        ${openTasks.length ? `<button class="btn" data-act="focusTask" data-id="${openTasks[0].id}">Eller: ${esc(openTasks[0].title.slice(0, 24))}${openTasks[0].title.length > 24 ? '…' : ''}</button>` : ''}</div>
      </div>`;
    } else if (openTasks.length) {
      const t = openTasks[0];
      nowCard = `<div class="card now-card">
        <div class="eyebrow">${t.prio === 1 ? 'Dagens viktigste' : 'Forslag'} · én ting om gangen${dayE ? ' · ' + { low: 'lav', medium: 'middels', high: 'høy' }[dayE] + ' energi' : ''}</div>
        <h2>${esc(t.title)}</h2>
        <div class="row"><button class="btn light" data-act="focusTask" data-id="${t.id}">▶ Start ${t.plannedDuration || 25} min</button>
        <button class="btn" data-act="toggleTask" data-id="${t.id}">✓ Ferdig</button></div>
        ${next ? `<p class="small" style="opacity:.85;margin:10px 0 0">Neste i planen: kl. ${S.minToHm(next.start)} ${esc(next.title)} (om ${fmtDur(next.start - nm)})</p>` : ''}
      </div>`;
    } else {
      nowCard = `<div class="card now-card"><h2>${todayCount ? 'Alt er gjort. Nyt resten av dagen 🌿' : 'Ingenting planlagt akkurat nå'}</h2>
        <p class="small" style="opacity:.9">${todayCount ? 'Du kan alltid legge til noe lite, men du trenger ikke.' : 'Velg én liten ting å begynne med.'}</p>
        <div class="row"><button class="btn light" data-act="fab">+ Legg til</button><button class="btn" data-act="pickTasks">Hent fra lister</button></div></div>`;
    }

    return `
      <div class="page-head"><div><div class="muted small">${greeting()} 👋</div><h1>${longDate(today)}</h1>${statsHtml()}</div></div>
      ${nowCard}
      <div class="card slim energy"><span class="small muted">Energi i dag</span>
        ${[['low', 'Lav'], ['medium', 'Middels'], ['high', 'Høy']].map(([v, l]) => `<button class="chip small ${dayE === v ? 'active' : ''}" data-act="setEnergy" data-v="${v}">${l}</button>`).join('')}
        ${dayE ? '<span class="tiny muted">Forslagene tilpasses</span>' : ''}
      </div>
      ${onboardingHtml()}
      <div class="section-title"><h2>${planDate === today ? 'Dagens plan' : d2(planDate)}</h2>
        <div class="row" style="gap:4px">
          ${planDate !== today ? `<button class="btn sm ghost" data-act="planDay" data-n="0">I dag</button>` : ''}
          <button class="btn sm ghost icon" data-act="planDay" data-n="-1" aria-label="Forrige dag">‹</button>
          <button class="btn sm ghost icon" data-act="planDay" data-n="1" aria-label="Neste dag">›</button>
          <button class="btn sm ghost" data-act="nav" data-view="plan">Uke →</button>
        </div>
      </div>
      <div class="card" data-swipe="planDay">
        ${planEntries.length ? dayBarHtml(planEntries, planDate) + timelineHtml(planEntries, planDate) : `<div class="empty"><div class="big">${planDate === today ? '🌤️' : '📭'}</div>Ingen aktiviteter ${planDate === today ? 'i dag ennå' : d2(planDate).toLowerCase()}.<div class="mt"><button class="btn sm outline" data-act="newEvent">+ Legg til aktivitet</button></div></div>`}
        <div class="swipe-hint tiny muted center">‹ sveip for å bla mellom dager ›</div>
      </div>
      <div class="section-title"><h2>Oppgaver i dag${starred ? ` · ${starred} viktigst` : ''}</h2><div class="row"><button class="btn sm ghost" data-act="pickTasks">Hent fra lister</button>${openTasks.length > 1 ? `<button class="btn sm ghost" data-act="aiPlanDay">✨ Planlegg</button>` : ''}</div></div>
      <div class="card">
        ${quickAddHtml()}
        ${openTasks.length > 5 ? `<p class="tiny muted">${openTasks.length} oppgaver i dag er mye. Marker 1–3 som viktigst, og utsett resten uten dårlig samvittighet (⋯-menyen).</p>` : ''}
        ${openTasks.length ? openTasks.map((t) => taskItemHtml(t, 'today')).join('') : `<div class="empty small">Ingen løse oppgaver. ${todayCount ? 'Bra jobba!' : 'Legg til én liten ting.'}</div>`}
      </div>
      ${doneToday.length ? `<details class="card"><summary>Fullført i dag (${doneToday.length}) 🎉</summary>${doneToday.map((t) => taskItemHtml(t)).join('')}</details>` : ''}`;
  }

  // Hurtiglegg-til: skriv fritt (merkelappen viser hvor det havner), eller trykk på en kategori for forslag.
  let quickOpenCat = null;   // kategori med åpne forslag (null = skjult)
  let quickTextCat = null;   // manuelt valgt kategori for fritekst (null = automatisk)
  function quickTagText(title) {
    const x = S.findExample(title);
    const c = S.catById(quickTextCat || (x ? x.cat : S.defaultCatId()));
    return `→ <b>${c.emoji} ${esc(c.name)}</b>${x && x.steps.length ? ` · ${x.steps.length} steg` : ''}`;
  }
  function quickAddHtml() {
    const open = quickOpenCat && S.cats().some((c) => c.id === quickOpenCat) ? quickOpenCat : null;
    const c = open ? S.catById(open) : null;
    const today = S.ymd();
    const existing = new Set(S.state.tasks.filter((t) => !t.done && t.today === today).map((t) => t.title.toLowerCase()));
    return `<form data-form="quickAdd" class="quick mb">
      <div class="row">
        <input class="input grow" name="title" placeholder="Ny oppgave for i dag…" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" data-input="quickTitle">
        <button class="btn primary icon" type="submit" aria-label="Legg til">${ICONS.plus}</button>
      </div>
      <button type="button" class="quick-tag" id="quickTag" data-act="quickTag" title="Velg hvor oppgaven skal havne">${quickTagText('')}</button>
      ${catChipsHtml(open, 'quickCat', false)}
      ${c ? `<div class="chips" style="margin-top:2px">${c.examples.length
        ? c.examples.map((x, i) => existing.has(x.title.toLowerCase())
          ? `<span class="chip small" style="opacity:.45" title="Ligger allerede i dag">✓ ${esc(x.title)}</span>`
          : `<button type="button" class="chip small" data-act="quickExample" data-cat="${c.id}" data-i="${i}" title="${x.steps.length ? x.steps.length + ' steg' : ''}">${x.steps.length ? '☰ ' : ''}${esc(x.title)}</button>`).join('')
        : `<span class="tiny muted">Ingen forslag i ${esc(c.name)} ennå. Legg til under Mer → Kategorier.</span>`}</div>` : ''}
    </form>`;
  }

  // Tre små steg første gang. Hukes av automatisk, forsvinner når alle er gjort eller når brukeren skjuler det.
  function onboardingHtml() {
    const st = S.state.settings;
    if (st.onboarded) return '';
    const added = S.state.tasks.length > 0;
    const timed = S.state.tasks.some((t) => t.plannedTime) || S.state.events.length > 3;
    const done = S.totalDone(S.state.game) > 0;
    if (added && timed && done) { st.onboarded = true; S.save(); return ''; }
    const steps = [
      ['Legg til én ting du skal gjøre i dag', added, `<button class="btn sm outline" data-act="fab">+ Legg til</button>`],
      ['Gi den et klokkeslett (⋯ → Sett klokkeslett)', timed, ''],
      ['Trykk ▶ for å starte, og huk av når du er ferdig', done, '']
    ];
    return `<div class="card onboard">
      <div class="row between"><h2>Kom i gang</h2><button class="btn sm ghost" data-act="dismissOnboarding">Skjul</button></div>
      <p class="small muted">Du trenger ikke planlegge alt. Tre små steg holder.</p>
      ${steps.map(([label, on, extra], i) => `<div class="step ${on ? 'on' : ''}"><span class="num">${on ? '✓' : i + 1}</span><span class="grow">${label}</span>${on ? '' : extra}</div>`).join('')}
    </div>`;
  }

  // ---------- Lister ----------
  function renderLists() {
    const tasks = S.state.tasks.filter((t) => (listFilter === 'open' ? !t.done : t.done)).filter((t) => listCat === 'all' || t.cat === listCat);
    const groups = S.cats().map((c) => ({ c, items: tasks.filter((t) => t.cat === c.id) })).filter((g) => g.items.length);
    const orphan = tasks.filter((t) => !S.cats().some((c) => c.id === t.cat));
    if (orphan.length) groups.push({ c: S.catById('__none'), items: orphan });
    const openCount = S.state.tasks.filter((t) => !t.done).length;
    const doneCount = S.state.tasks.length - openCount;
    const inbox = S.state.inbox;
    return `
      <div class="page-head"><h1>Lister</h1></div>
      <div class="card">
        <div class="row between mb"><h2>💭 Innboks</h2><span class="tiny muted">Fang tanken nå, sorter senere</span></div>
        <form data-form="inboxAdd" class="row ${inbox.length ? 'mb' : ''}">
          <input class="input grow" name="text" placeholder="Noe du ikke vil glemme…" autocomplete="off">
          <button class="btn primary icon" type="submit" aria-label="Legg i innboks">${ICONS.plus}</button>
        </form>
        ${inbox.map((n) => `<div class="item"><div class="grow">${esc(n.text)}</div><button class="btn sm outline" data-act="inboxToTask" data-id="${n.id}">→ Oppgave</button><button class="btn sm ghost" data-act="inboxDelete" data-id="${n.id}" aria-label="Slett">✕</button></div>`).join('')}
      </div>
      <div class="row between mb wrap">
        <div class="seg" role="tablist">
          <button class="${listFilter === 'open' ? 'on' : ''}" data-act="listFilter" data-v="open">Åpne (${openCount})</button>
          <button class="${listFilter === 'done' ? 'on' : ''}" data-act="listFilter" data-v="done">Ferdige (${doneCount})</button>
        </div>
      </div>
      <div class="chips scroll mb">
        <button class="chip ${listCat === 'all' ? 'active' : ''}" data-act="listCat" data-v="all">Alle</button>
        ${S.cats().map((c) => `<button class="chip ${listCat === c.id ? 'active' : ''}" data-act="listCat" data-v="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
      </div>
      ${groups.length ? groups.map((g) => `<div class="card"><div class="row mb"><span class="cat-dot" style="background:${g.c.color}"></span><h2>${g.c.emoji} ${esc(g.c.name)}</h2><span class="muted small">${g.items.length}</span></div>${g.items.map((t) => taskItemHtml(t, 'group')).join('')}</div>`).join('')
        : `<div class="card"><div class="empty"><div class="big">${listFilter === 'open' ? '🎈' : '📭'}</div>${listFilter === 'open' ? 'Ingen åpne oppgaver her. Trykk + for å legge til.' : 'Ingen ferdige oppgaver ennå.'}</div></div>`}
      ${listFilter === 'done' && doneCount ? `<button class="btn ghost block" data-act="clearDone">Rydd bort ferdige oppgaver</button>` : ''}`;
  }

  // ---------- Plan ----------
  function renderPlan() {
    const monday = S.mondayOf(selectedDate);
    const today = S.ymd();
    const days = [...Array(7)].map((_, i) => S.addDays(monday, i));
    const entries = dayEntries(selectedDate);
    const dueTasks = S.state.tasks.filter((t) => !t.done && t.due === selectedDate && !(t.today === selectedDate && t.plannedTime));
    const total = entries.reduce((a, e) => a + e.duration, 0);
    return `
      <div class="page-head"><h1>Plan</h1><div class="row"><button class="btn sm outline" data-act="week" data-n="-1" aria-label="Forrige uke">‹</button><button class="btn sm outline" data-act="goToday">I dag</button><button class="btn sm outline" data-act="week" data-n="1" aria-label="Neste uke">›</button></div></div>
      <div class="week-strip mb" data-swipe="selDate">${days.map((d) => {
        const cats = [...new Set(dayEntries(d).map((e) => S.catById(e.cat).color))].slice(0, 4);
        return `<button class="${d === selectedDate ? 'sel' : ''} ${d === today ? 'today' : ''}" data-act="selDate" data-date="${d}"><span class="d">${DAY_NAMES[S.isoDow(d)]}</span><span class="n">${S.parseYmd(d).getDate()}</span><span class="dots">${cats.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`;
      }).join('')}</div>
      <div class="section-title"><h2>${d2(selectedDate)}</h2><span class="small muted">${entries.length ? fmtDur(total) + ' planlagt' : ''}</span></div>
      <div class="card" data-swipe="selDate">
        ${entries.length ? dayBarHtml(entries, selectedDate) + timelineHtml(entries, selectedDate) : `<div class="empty"><div class="big">📭</div>Ingenting planlagt.<div class="mt"><button class="btn sm outline" data-act="newEvent">+ Legg til aktivitet</button></div></div>`}
        <div class="swipe-hint tiny muted center">‹ sveip for å bla mellom dager ›</div>
      </div>
      ${dueTasks.length ? `<div class="section-title"><h2>Oppgaver med frist</h2></div><div class="card">${dueTasks.map((t) => taskItemHtml(t)).join('')}</div>` : ''}
      <div class="section-title"><h2>Maler</h2><button class="btn sm ghost" data-act="editTpl">+ Ny mal</button></div>
      <div class="chips mb">${S.templates().map((t) => `<button class="chip" data-act="newEventTpl" data-id="${t.id}">${S.catById(t.cat).emoji} ${esc(t.title)}</button>`).join('') || '<span class="small muted">Ingen maler. Lag en under Mer → Maler.</span>'}</div>`;
  }
  function d2(s) { const t = S.ymd(); return s === t ? 'I dag' : s === S.addDays(t, 1) ? 'I morgen' : longDate(s); }

  // ---------- Mer / innstillinger ----------
  function barsHtml() {
    const g = S.state.game; const today = S.ymd();
    const days = [...Array(14)].map((_, i) => S.addDays(today, i - 13));
    const max = Math.max(1, ...days.map((d) => g.history[d] || 0));
    return `<div class="bars">${days.map((d) => { const n = g.history[d] || 0; return `<div class="bar ${d === today ? 'today' : ''} ${n ? '' : 'zero'}" title="${S.fmtNb(d)}: ${n}"><div class="fill" style="height:${Math.round((n / max) * 100)}%"></div><span>${DAY_NAMES[S.isoDow(d)][0].toUpperCase()}</span></div>`; }).join('')}</div>`;
  }
  function renderMore() {
    const g = S.state.game; const lv = S.levelOf(g.points);
    const last7 = [...Array(7)].map((_, i) => g.history[S.addDays(S.ymd(), -i)] || 0).reduce((a, b) => a + b, 0);
    return `
      <div class="page-head"><h1>Mer</h1></div>
      <div class="card">
        <div class="row between"><h2>Fremgang</h2><span class="muted small">${S.totalDone(g)} ting fullført totalt</span></div>
        <div class="row mt"><strong>Nivå ${lv.level}</strong><div class="progress dark grow"><div style="width:${Math.round(lv.progress * 100)}%"></div></div><span class="small muted">${lv.toNext} til neste</span></div>
        <div class="row wrap mt small muted"><span>⭐ ${g.points} poeng</span><span>🔥 ${g.streak} dager på rad (rekord ${g.bestStreak})</span><span>❄️ ${g.freezes} fridag${g.freezes === 1 ? '' : 'er'} i reserve</span></div>
        <div class="row between mt"><h3>Siste 14 dager</h3><span class="small muted">${last7} fullført siste uke</span></div>
        ${barsHtml()}
        <div class="badge-grid mt">${S.BADGES.map((b) => `<div class="badge ${g.badges.includes(b.id) ? '' : 'locked'}"><div class="e">${b.emoji}</div>${esc(b.name)}</div>`).join('')}</div>
        <p class="tiny muted mt">Dagsmålet teller fullførte oppgaver og aktiviteter. Steg gir poeng, men teller ikke som fullført. En «fridag» redder streaken din hvis du hopper over en dag; du får en ny for hver 7. dag på rad.</p>
      </div>

      <div class="card">
        <div class="row between mb"><h2>Kategorier og forslag</h2><button class="btn sm outline" data-act="editCat">+ Ny kategori</button></div>
        <p class="small muted">Hver kategori har forslag til oppgaver. Et forslag kan ha standardsteg som fylles inn automatisk når du velger det.</p>
        ${S.cats().map((c) => `<div class="item"><span class="cat-dot" style="background:${c.color}"></span><div class="grow" data-act="editCat" data-id="${c.id}" style="cursor:pointer"><div class="title">${c.emoji} ${esc(c.name)}</div><div class="meta">${c.examples.length} forslag</div></div><button class="btn sm ghost" data-act="editCat" data-id="${c.id}">Rediger</button></div>`).join('')}
      </div>

      <div class="card">
        <div class="row between mb"><h2>Maler for aktiviteter</h2><button class="btn sm outline" data-act="editTpl">+ Ny mal</button></div>
        <p class="small muted">Maler fyller ut aktivitetsskjemaet med tid, varighet, gjentakelse og sjekkliste.</p>
        ${S.templates().map((t) => `<div class="item"><span class="cat-dot" style="background:${S.catById(t.cat).color}"></span><div class="grow" data-act="editTpl" data-id="${t.id}" style="cursor:pointer"><div class="title">${S.catById(t.cat).emoji} ${esc(t.title)}</div><div class="meta">kl. ${t.time} · ${t.duration} min · ${S.recurLabel({ type: t.recur, days: t.days }) || 'Engangs'} · ${t.steps.length} steg</div></div><button class="btn sm ghost" data-act="editTpl" data-id="${t.id}">Rediger</button></div>`).join('') || '<div class="empty small">Ingen maler.</div>'}
      </div>

      <div class="card">
        <div class="row between mb"><h2>✨ AI-hjelp (valgfritt)</h2><span class="small muted">${PLAI.enabled() ? 'På' : 'Av – innebygde forslag brukes'}</span></div>
        <p class="small muted">✨-knappene (bryt ned i steg, hjelp meg i gang, planlegg dagen) fungerer uten AI. Med en gratis API-nøkkel blir forslagene mer tilpasset. Velg en tjeneste, lim inn nøkkelen og trykk Test.</p>
        <div class="chips mb">${Object.entries(PLAI.PRESETS).map(([k, p]) => `<button type="button" class="chip small" data-act="aiPreset" data-p="${k}">${esc(p.label)}</button>`).join('')}</div>
        <form data-form="saveAi">
          <label class="field"><span>Tjeneste</span><select class="input" name="provider">
            <option value="off">Av (innebygde forslag)</option>
            <option value="openai">OpenAI-kompatibel (Groq, OpenRouter, OpenAI …)</option>
            <option value="gemini">Google Gemini</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="pollinations">Pollinations (uten nøkkel, ustabil)</option>
          </select></label>
          <div class="grid2">
            <label class="field"><span>Base-URL (OpenAI-kompatibel)</span><input class="input" name="baseUrl" placeholder="https://api.groq.com/openai/v1"></label>
            <label class="field"><span>Modell</span><input class="input" name="model" placeholder="llama-3.3-70b-versatile"></label>
          </div>
          <label class="field"><span>API-nøkkel (lagres kryptert på enheten)</span><input class="input" name="apiKey" type="password" autocomplete="off"></label>
          <p id="aiKeyLink" class="tiny muted"></p>
          <div class="row wrap"><button class="btn primary" type="submit">Lagre</button><button class="btn outline" type="button" data-act="testAi">Test</button><span id="aiTestResult" class="small muted"></span></div>
        </form>
      </div>

      <div class="card">
        <h2 class="mb">Innstillinger</h2>
        <form data-form="saveSettings">
          <div class="grid2">
            <label class="field"><span>Tema</span><select class="input" name="theme"><option value="auto">Automatisk</option><option value="light">Lyst</option><option value="dark">Mørkt</option></select></label>
            <label class="field"><span>Dagsmål (fullførte ting)</span><input class="input" type="number" name="dailyGoal" min="1" max="20"></label>
            <label class="field"><span>Dagen starter (tt:mm)</span>${timeField('dayStart', '')}</label>
            <label class="field"><span>Dagen slutter (tt:mm)</span>${timeField('dayEnd', '')}</label>
          </div>
          <label class="row small mb"><input type="checkbox" name="notify"> Påminnelser 5 min før aktiviteter (når appen er åpen)</label>
          <label class="row small mb"><input type="checkbox" name="calm"> Rolig modus: ingen konfetti, lyd eller vibrasjon</label>
          <div class="row wrap"><button class="btn primary" type="submit">Lagre</button><button class="btn outline" type="button" data-act="askNotify">Tillat varsler</button><span class="small muted">${'Notification' in window ? 'Status: ' + ({ granted: 'tillatt', denied: 'blokkert', default: 'ikke spurt' }[Notification.permission]) : 'Ikke støttet'}</span></div>
        </form>
      </div>

      <div class="card">
        <h2 class="mb">Data og sikkerhet</h2>
        <p class="small muted">Alt lagres kryptert (AES-256) i nettleseren på denne enheten. Ta jevnlig en sikkerhetskopi, og bruk den til å flytte data til en annen enhet.</p>
        <div class="row wrap">
          <button class="btn outline" data-act="export">⬇️ Sikkerhetskopi</button>
          <label class="btn outline">⬆️ Importer <input type="file" accept="application/json" hidden data-change="import"></label>
          <button class="btn outline" data-act="lock">🔒 Lås denne enheten</button>
        </div>
        <h3 class="mt">Varsler når appen er lukket</h3>
        <p class="small muted">En nettside kan ikke varsle når den er lukket. Eksporter aktivitetene til en kalenderfil og åpne den i telefonens kalender, så får du påminnelser 5 minutter før. Gjør det på nytt når du har endret rutiner.</p>
        <button class="btn outline" data-act="exportIcs">📆 Eksporter til kalender (.ics)</button>
        <details class="mt"><summary>Bytt passord</summary>
          <form data-form="changePw" class="mt">
            <label class="field"><span>Nytt passord (minst 12 tegn)</span><input class="input" type="password" name="pw1" minlength="12" required autocomplete="new-password"></label>
            <label class="field"><span>Gjenta</span><input class="input" type="password" name="pw2" minlength="12" required autocomplete="new-password"></label>
            <button class="btn primary" type="submit">Bytt passord</button>
          </form>
          <div id="pwResult"></div>
        </details>
        <details class="mt"><summary style="color:var(--danger)">Slett alle data</summary>
          <p class="small muted mt">Fjerner alt på denne enheten. Kan ikke angres.</p>
          <button class="btn danger" data-act="wipeAll">Slett alt</button>
        </details>
      </div>

      <div class="card flat small muted">
        <strong>Hvorfor appen er laget slik</strong>
        <ul class="why">
          <li><b>Én ting om gangen</b> og fokusmodus med timer: reduserer beslutningstrøtthet og «tidsblindhet».</li>
          <li><b>Visuell tidslinje</b> med nå-markør og synlige ledige luker (inspirert av Tiimo): gjør tid synlig og konkret.</li>
          <li><b>Små steg</b> og mikro-start: senker terskelen for å begynne, som er det vanskeligste ved ADHD.</li>
          <li><b>Hvis/når-koblinger</b> («etter at jeg …»): forskning på implementeringsintensjoner viser at det hjelper ADHD-hjernen å huske og starte.</li>
          <li><b>Innboks</b>: avlaster arbeidsminnet. Fang tanken først, sorter etterpå.</li>
          <li><b>Dagens viktigste (★)</b> og utsett-knapp: begrenser dagen til det som betyr noe, uten skam.</li>
          <li><b>Energi-innsjekk</b>: matcher oppgaver til dagsform i stedet for å kreve samme innsats hver dag.</li>
          <li><b>Faktisk tidsbruk</b> etter fokusøkter: trener realistisk tidsfølelse.</li>
          <li><b>Umiddelbar belønning</b> (poeng, feiring, merker) og <b>tilgivende streaks</b>: rask tilbakemelding uten straff.</li>
          <li><b>Rutiner og maler</b>: faste strukturer krever mindre viljestyrke enn å planlegge fra bunnen.</li>
        </ul>
        <p class="tiny mt">Versjon ${APP_VERSION} · <button class="btn sm ghost" data-act="checkUpdate">Se etter oppdatering</button></p>
      </div>`;
  }

  function fillSettingsForm() {
    const st = S.state.settings;
    const fa = $('form[data-form="saveAi"]'); const fs = $('form[data-form="saveSettings"]');
    if (!fa || !fs) return;
    fa.provider.value = st.ai.provider; fa.baseUrl.value = st.ai.baseUrl || ''; fa.model.value = st.ai.model || ''; fa.apiKey.value = st.ai.apiKey || '';
    fs.theme.value = st.theme; fs.dailyGoal.value = st.dailyGoal; fs.dayStart.value = st.dayStart; fs.dayEnd.value = st.dayEnd; fs.notify.checked = !!st.notify; fs.calm.checked = !!st.calm;
  }

  // ---------- Modaler ----------
  let modalDirty = false; // noe er skrevet i skjemaet – vern mot å miste det ved feiltrykk
  function openModal(html) { $('#modal').innerHTML = `<div class="modal-bg" data-act="closeModalBg"><div class="modal">${html}</div></div>`; modalDirty = false; revealActiveChips(); }
  function tryCloseModal() {
    if (modalDirty && $('#modal form') && !confirm('Lukke uten å lagre det du har skrevet?')) return;
    closeModal();
  }
  // Ruller valgt kategori inn i synsfeltet i rullbare chip-rader.
  function revealActiveChips() {
    $$('.cat-chips').forEach((row) => { const a = row.querySelector('.chip.active'); if (a) row.scrollLeft = a.offsetLeft - row.clientWidth / 2 + a.offsetWidth / 2; });
  }
  function closeModal() { $('#modal').innerHTML = ''; }
  const modalHead = (title, extra = '') => `<div class="row between mb"><h2>${title}</h2><div class="row">${extra}<button class="btn sm ghost" data-act="closeModal" aria-label="Lukk">✕</button></div></div>`;

  function taskModal(t, prefill) {
    const isNew = !t;
    const task = t || { title: '', cat: S.defaultCatId(), due: '', energy: 'medium', today: '', steps: [], notes: '', trigger: '', prio: 2, ...(prefill || {}) };
    const today = S.ymd();
    const more = !!(task.due || task.trigger || task.notes || (isNew && task.steps.length) || (task.energy && task.energy !== 'medium'));
    return `
      ${modalHead(isNew ? 'Ny oppgave' : 'Oppgave', isNew ? '' : `<button class="btn sm ghost" data-act="deleteTask" data-id="${task.id}" aria-label="Slett">🗑️</button>`)}
      <form data-form="saveTask" data-id="${task.id || ''}">
        ${prefill && prefill.inboxId ? `<input type="hidden" name="inboxId" value="${prefill.inboxId}">` : ''}
        <input type="hidden" name="cat" value="${task.cat}">
        <div class="field"><span class="field-label">1. Kategori</span>${catChipsHtml(task.cat, 'formCat', true)}</div>
        <div class="tiny muted">Forslag (fyller inn navn og standardsteg):</div>
        ${exampleChips(task.cat)}
        <label class="field mt"><span>2. Hva skal gjøres? <span class="steps-note" id="stepsNote"></span></span><input class="input" name="title" value="${esc(task.title)}" required autocomplete="off" autocapitalize="sentences" placeholder="Skriv selv, eller velg et forslag over"></label>
        <div class="chips mb">
          <label class="chip"><input type="checkbox" name="today" hidden ${task.today === today ? 'checked' : ''}>📅 Legg i dagens plan</label>
          <label class="chip"><input type="checkbox" name="star" hidden ${task.prio === 1 ? 'checked' : ''}>★ En av dagens viktigste</label>
        </div>
        <details class="more" ${more ? 'open' : ''}><summary>Flere valg</summary>
          <div class="grid2">
            <label class="field"><span>Krever</span><select class="input" name="energy"><option value="low" ${task.energy === 'low' ? 'selected' : ''}>🟢 lite energi</option><option value="medium" ${task.energy === 'medium' ? 'selected' : ''}>🟡 middels</option><option value="high" ${task.energy === 'high' ? 'selected' : ''}>🔴 mye energi</option></select></label>
            <label class="field"><span>Kobling: «Etter at jeg …»</span><input class="input" name="trigger" value="${esc(task.trigger || '')}" placeholder="f.eks. har spist frokost" autocomplete="off"></label>
          </div>
          <label class="field"><span>Frist (valgfritt)</span>${dateField('due', task.due, dateChips(true))}</label>
          ${isNew ? `<label class="field"><span>Steg (ett per linje, valgfritt)</span><textarea class="input" name="stepsText" placeholder="Finne fram…&#10;Gjøre første del…">${esc((task.steps || []).map((s) => s.title || s).join('\n'))}</textarea></label>` : ''}
          <label class="field"><span>Notat</span><textarea class="input" name="notes" style="min-height:56px">${esc(task.notes || '')}</textarea></label>
        </details>
        <div class="actions">
          <button class="btn primary" type="submit">${isNew ? 'Legg til' : 'Lagre'}</button>
          <button class="btn outline" type="button" data-act="aiBreakDown" data-id="${task.id || ''}">✨ Bryt ned i steg</button>
          ${isNew ? '' : `<button class="btn outline" type="button" data-act="focusTask" data-id="${task.id}">▶ Fokus</button>`}
        </div>
      </form>
      ${isNew ? '' : `
        <div class="section-title"><h2>Steg</h2></div>
        <div id="steps">${task.steps.map((s) => `<div class="item ${s.done ? 'done' : ''}"><button class="check sm ${s.done ? 'on' : ''}" data-act="toggleStep" data-id="${task.id}" data-step="${s.id}">${s.done ? '✓' : ''}</button><div class="grow title">${esc(s.title)}</div><button class="btn sm ghost" data-act="deleteStep" data-id="${task.id}" data-step="${s.id}" aria-label="Slett steg">✕</button></div>`).join('') || '<div class="empty small">Ingen steg. Legg til, velg et forslag, eller la ✨ foreslå.</div>'}</div>
        <form data-form="addStep" data-id="${task.id}" class="row mt"><input class="input grow" name="title" placeholder="Nytt steg…" autocomplete="off"><button class="btn icon outline" type="submit" aria-label="Legg til steg">${ICONS.plus}</button></form>`}`;
  }

  function recurFields(type, days, until) {
    return `
      <label class="field"><span>Gjentas</span><select class="input" name="recur" data-change="recurType">
        ${[['none', 'Ikke'], ['daily', 'Hver dag'], ['weekdays', 'Hverdager (man–fre)'], ['weekly', 'Ukentlig på valgte dager'], ['monthly', 'Månedlig']].map(([v, l]) => `<option value="${v}" ${type === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
      <div id="weekdays" class="mb" ${type === 'weekly' ? '' : 'hidden'}><div class="day-toggle">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="${(days || []).includes(d) ? 'on' : ''}" data-act="toggleDay" data-day="${d}">${DAY_NAMES[d]}</button>`).join('')}</div></div>
      ${until === undefined ? '' : `<label class="field" id="untilField" ${type === 'none' ? 'hidden' : ''}><span>Til og med (valgfritt)</span>${dateField('until', until)}</label>`}`;
  }
  const durationChips = () => `<div class="chips mb">${[5, 10, 15, 25, 30, 45, 60, 90].map((d) => `<button type="button" class="chip small" data-act="setDur" data-v="${d}">${d} min</button>`).join('')}</div>`;

  function eventModal(ev, date, tpl) {
    const isNew = !ev;
    const e = ev || (tpl ? S.makeEventFromTemplate(tpl, date || selectedDate) : { title: '', cat: S.defaultCatId(), date: date || selectedDate, time: nextQuarter(), duration: 30, recur: { type: 'none', days: [], until: '' }, steps: [], notes: '', trigger: '' });
    const more = !!((e.recur && e.recur.type !== 'none') || (e.steps && e.steps.length) || e.notes || e.trigger);
    return `
      ${modalHead(isNew ? (tpl ? `Ny aktivitet · ${esc(tpl.title)}` : 'Ny aktivitet') : 'Aktivitet', isNew ? `<button class="btn sm outline" data-act="tplSheet">📋 Bruk mal</button>` : `<button class="btn sm ghost" data-act="deleteEventMenu" data-id="${e.id}" data-date="${date || ''}" aria-label="Slett">🗑️</button>`)}
      <form data-form="saveEvent" data-id="${e.id || ''}">
        <input type="hidden" name="cat" value="${e.cat}">
        <div class="field"><span class="field-label">1. Kategori</span>${catChipsHtml(e.cat, 'formCat', true)}</div>
        <div class="tiny muted">Forslag (fyller inn navn og sjekkliste):</div>
        ${exampleChips(e.cat)}
        <label class="field mt"><span>2. Aktivitet <span class="steps-note" id="stepsNote">${tpl && tpl.steps.length ? tpl.steps.length + ' steg fra malen' : ''}</span></span><input class="input" name="title" value="${esc(e.title)}" required autocomplete="off" autocapitalize="sentences" placeholder="Skriv selv, eller velg et forslag over"></label>
        <label class="field"><span>Dato</span>${dateField('date', e.date, dateChips(false))}</label>
        <div class="grid2">
          <label class="field"><span>Klokkeslett (tt:mm)</span>${timeField('time', e.time, true)}</label>
          <label class="field"><span>Varighet (min)</span><input class="input" type="number" name="duration" min="1" max="720" value="${e.duration}"></label>
        </div>
        ${durationChips()}
        <details class="more" ${more ? 'open' : ''}><summary>Flere valg (gjentakelse, sjekkliste, kobling, notat)</summary>
          ${recurFields(e.recur.type, e.recur.days, e.recur.until || '')}
          <label class="field"><span>Kobling (valgfritt): «Etter at jeg …»</span><input class="input" name="trigger" value="${esc(e.trigger || '')}" placeholder="f.eks. har drukket morgenkaffen" autocomplete="off"></label>
          <label class="field"><span>Steg / sjekkliste (ett per linje)</span><textarea class="input" name="stepsText">${esc((e.steps || []).map((s) => s.title).join('\n'))}</textarea></label>
          <label class="field"><span>Notat</span><textarea class="input" name="notes" style="min-height:56px">${esc(e.notes || '')}</textarea></label>
        </details>
        <div class="actions"><button class="btn primary" type="submit">${isNew ? 'Legg til' : 'Lagre'}</button>${isNew ? '' : `<button class="btn outline" type="button" data-act="focusEvent" data-id="${e.id}" data-date="${date || S.ymd()}">▶ Fokus</button>`}<button class="btn ghost" type="button" data-act="saveAsTpl">Lagre som mal</button></div>
      </form>`;
  }
  function nextQuarter() { const m = Math.ceil((nowMin() + 1) / 15) * 15; return S.minToHm(m % 1440); }

  function catModal(c) {
    const isNew = !c;
    const cat = c || { name: '', emoji: '📁', color: S.CATEGORY_COLORS[S.cats().length % S.CATEGORY_COLORS.length], examples: [] };
    return `
      ${modalHead(isNew ? 'Ny kategori' : 'Kategori', isNew || S.cats().length <= 1 ? '' : `<button class="btn sm ghost" data-act="deleteCat" data-id="${cat.id}" aria-label="Slett">🗑️</button>`)}
      <form data-form="saveCat" data-id="${cat.id || ''}">
        <div class="grid2">
          <label class="field"><span>Navn</span><input class="input" name="name" value="${esc(cat.name)}" required autocomplete="off" placeholder="f.eks. Dyr"></label>
          <label class="field"><span>Emoji</span><input class="input" name="emoji" value="${esc(cat.emoji)}" maxlength="4" autocomplete="off" placeholder="🐶"></label>
        </div>
        <label class="field"><span>Farge</span><input type="hidden" name="color" value="${cat.color}"><div class="swatches">${S.CATEGORY_COLORS.map((col) => `<button type="button" class="${col === cat.color ? 'on' : ''}" style="background:${col}" data-act="pickColor" data-v="${col}" aria-label="${col}"></button>`).join('')}</div></label>
        <button class="btn primary" type="submit">${isNew ? 'Opprett' : 'Lagre'}</button>
      </form>
      ${isNew ? '<p class="tiny muted mt">Etter at kategorien er opprettet kan du legge til forslag med standardsteg.</p>' : `
        <div class="section-title"><h2>Forslag</h2><button class="btn sm outline" data-act="editExample" data-cat="${cat.id}">+ Nytt forslag</button></div>
        ${cat.examples.map((x, i) => `<div class="item"><div class="grow" data-act="editExample" data-cat="${cat.id}" data-i="${i}" style="cursor:pointer"><div class="title">${esc(x.title)}</div><div class="meta">${x.steps.length ? x.steps.length + ' steg: ' + esc(x.steps.join(' · ')) : 'Ingen standardsteg'}</div></div><button class="btn sm ghost" data-act="editExample" data-cat="${cat.id}" data-i="${i}" aria-label="Rediger">✎</button><button class="btn sm ghost" data-act="deleteExample" data-cat="${cat.id}" data-i="${i}" aria-label="Slett">✕</button></div>`).join('') || '<div class="empty small">Ingen forslag ennå.</div>'}`}`;
  }
  function exampleModal(catId, i) {
    const c = S.catById(catId);
    const x = i === undefined ? { title: '', steps: [] } : c.examples[i];
    return `
      <div class="row between mb"><h2>${i === undefined ? 'Nytt forslag' : 'Forslag'} · ${c.emoji} ${esc(c.name)}</h2><button class="btn sm ghost" data-act="editCat" data-id="${c.id}" aria-label="Tilbake">←</button></div>
      <form data-form="saveExample" data-cat="${c.id}" data-i="${i === undefined ? '' : i}">
        <label class="field"><span>Oppgave</span><input class="input" name="title" value="${esc(x.title)}" required autocomplete="off" placeholder="f.eks. Mate hunden" autofocus></label>
        <label class="field"><span>Standardsteg (ett per linje)</span><textarea class="input" name="stepsText" placeholder="Finne fram fôret&#10;Fylle skåla&#10;Bytte vann">${esc(x.steps.join('\n'))}</textarea></label>
        <div class="row"><button class="btn primary" type="submit">Lagre</button><button class="btn outline" type="button" data-act="editCat" data-id="${c.id}">Avbryt</button></div>
      </form>`;
  }
  function tplModal(t) {
    const isNew = !t;
    const tp = t || { title: '', cat: S.cats()[0].id, time: '09:00', duration: 30, recur: 'none', days: [], steps: [] };
    return `
      ${modalHead(isNew ? 'Ny mal' : 'Mal', isNew ? '' : `<button class="btn sm ghost" data-act="deleteTpl" data-id="${tp.id}" aria-label="Slett">🗑️</button>`)}
      <form data-form="saveTpl" data-id="${tp.id || ''}">
        <label class="field"><span>Navn</span><input class="input" name="title" value="${esc(tp.title)}" required autocomplete="off" placeholder="f.eks. Lufte hunden"></label>
        <label class="field"><span>Kategori</span><select class="input" name="cat">${catOptions(tp.cat)}</select></label>
        <div class="grid2">
          <label class="field"><span>Klokkeslett (tt:mm)</span>${timeField('time', tp.time, true)}</label>
          <label class="field"><span>Varighet (min)</span><input class="input" type="number" name="duration" min="1" max="720" value="${tp.duration}"></label>
        </div>
        ${durationChips()}
        ${recurFields(tp.recur, tp.days)}
        <label class="field"><span>Sjekkliste (ett steg per linje)</span><textarea class="input" name="stepsText">${esc(tp.steps.join('\n'))}</textarea></label>
        <button class="btn primary" type="submit">${isNew ? 'Opprett mal' : 'Lagre'}</button>
      </form>`;
  }

  function readForm(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = v; }); return o; }
  const linesToSteps = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean).map((title) => ({ id: S.uid(), title, done: false }));
  const linesToTitles = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  function readDate(val, label) { const iso = S.parseNb(val); if (iso === null) { toast(`Ugyldig ${label}. Bruk dd.mm.åååå`, true); return null; } return iso; }
  function readTime(val, label) { const t = S.parseTime(val); if (t === null) { toast(`Ugyldig ${label}. Bruk tt:mm (24 timer)`, true); return null; } return t; }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Fokusmodus ----------
  function startFocus(kind, id, date) {
    let title, duration, cat;
    if (kind === 'task') {
      const t = S.state.tasks.find((x) => x.id === id); if (!t) return;
      title = t.title; duration = t.plannedDuration || 25; cat = t.cat;
    } else {
      const e = S.state.events.find((x) => x.id === id); if (!e) return;
      title = e.title; duration = e.duration || 25; cat = e.cat;
    }
    closeModal();
    focus = { kind, id, date: date || S.ymd(), title, cat, planned: duration, total: duration * 60, remaining: duration * 60, running: false, endAt: null, ai: '', finished: false };
    renderFocus();
  }
  function focusSteps() {
    if (!focus) return [];
    if (focus.kind === 'task') { const t = S.state.tasks.find((x) => x.id === focus.id); return t ? t.steps.map((s) => ({ ...s, on: s.done })) : []; }
    const e = S.state.events.find((x) => x.id === focus.id); return e ? e.steps.map((s) => ({ ...s, on: !!e.stepDone[focus.date + ':' + s.id] })) : [];
  }
  function renderFocus() {
    const box = $('#focus');
    if (!focus) { box.innerHTML = ''; clearInterval(focusTimer); focusTimer = null; return; }
    const c = S.catById(focus.cat);
    const steps = focusSteps();
    const current = steps.find((s) => !s.on);
    box.innerHTML = `<div class="focus">
      <div class="row between" style="width:100%;max-width:480px"><button class="btn ghost" data-act="exitFocus">✕ Lukk</button><span class="cat-badge" style="background:${c.color}">${c.emoji} ${esc(c.name)}</span></div>
      <h1 class="center mt" style="max-width:480px">${esc(focus.title)}</h1>
      ${!focus.running && focus.remaining === focus.total ? `<div class="chips mt" style="justify-content:center">${[5, 10, 15, 25, 45, 60].map((m) => `<button class="chip ${m * 60 === focus.total ? 'active' : ''}" data-act="focusDur" data-v="${m}">${m} min</button>`).join('')}</div>` : ''}
      <div class="ring"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/><circle class="bar" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="0"/></svg>
        <div class="time"><span id="fTime">--:--</span><small>${focus.finished ? 'tiden er ute' : focus.running ? 'igjen' : 'klar?'}</small></div></div>
      <div class="row">
        ${focus.finished ? '' : `<button class="btn primary" data-act="focusToggle">${focus.running ? '⏸ Pause' : '▶ Start'}</button>`}
        <button class="btn outline" data-act="focusPlus">+5 min</button>
        <button class="btn success" data-act="focusDone">✓ Ferdig</button>
      </div>
      ${current ? `<p class="mt muted small center">Neste steg: <b>${esc(current.title)}</b></p>` : ''}
      <div class="steps mt">${steps.map((s) => `<div class="item ${s.on ? 'done' : ''} ${current && current.id === s.id ? 'current' : ''}"><button class="check ${s.on ? 'on' : ''}" data-act="focusStep" data-step="${s.id}">${s.on ? '✓' : ''}</button><div class="grow title">${esc(s.title)}</div></div>`).join('')}</div>
      <div style="width:100%;max-width:480px" class="mt">
        <button class="btn block outline" data-act="aiKickstart">✨ Hjelp meg i gang</button>
        <div id="fAi" class="mt">${focus.ai ? `<div class="ai-box">${esc(focus.ai)}</div>` : ''}</div>
        <button class="btn block ghost mt muted" data-act="focusSkip">Ikke i dag – flytt til i morgen</button>
      </div>
    </div>`;
    tickFocus();
    if (!focusTimer) focusTimer = setInterval(tickFocus, 1000);
  }
  function tickFocus() {
    if (!focus) return;
    if (focus.running) focus.remaining = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
    const el = $('#fTime'); if (!el) return;
    const m = Math.floor(focus.remaining / 60), s = focus.remaining % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    const bar = $('.focus .bar'); if (bar) bar.style.strokeDashoffset = String(263.9 * (1 - focus.remaining / Math.max(focus.total, 1)));
    if (focus.running && focus.remaining === 0) {
      focus.running = false; focus.finished = true; beep(); vibrate([200, 100, 200]);
      notify('Tiden er ute', focus.title + ' – bra jobba! Ferdig, eller +5 min?');
      renderFocus();
    }
  }
  function beep() {
    if (S.state && S.state.settings.calm) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, .25, .5].forEach((t) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .15; o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .18); });
    } catch (e) { /* ignorer */ }
  }
  const vibrate = (p) => { if (navigator.vibrate && !(S.state && S.state.settings.calm)) navigator.vibrate(p); };

  // ---------- Varsler, feiring ----------
  function notify(title, body) {
    if (!S.state.settings.notify) return;
    if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body, icon: 'icons/icon.svg' }); } catch (e) { /* ignorer */ } }
    toast(`🔔 ${title}: ${body}`);
  }
  function checkReminders() {
    if (!S.state || !S.state.settings.notify) return;
    const today = S.ymd(); const nm = nowMin();
    dayEntries(today).forEach((e) => {
      if (e.done) return;
      const diff = e.start - nm;
      const k5 = `${e.kind}:${e.id}:${today}:5`, k0 = `${e.kind}:${e.id}:${today}:0`;
      if (diff > 0 && diff <= 5 && !notified.has(k5)) { notified.add(k5); notify(`Om ${diff} min`, e.title); }
      if (diff <= 0 && diff > -3 && !notified.has(k0)) { notified.add(k0); notify('Nå', e.title); }
    });
  }
  function toast(msg, big) {
    const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), big ? 3500 : 2200);
  }
  // Angre-melding: feiltrykk skal være billig å rette.
  function undoToast(msg, undoFn) {
    $$('.toast.undo').forEach((t) => t.remove());
    const el = document.createElement('div'); el.className = 'toast big undo';
    el.innerHTML = `<span>${esc(msg)}</span><button type="button">Angre</button>`;
    el.querySelector('button').onclick = () => { el.remove(); undoFn(); render(); toast('Angret'); };
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 6000);
  }
  function confetti() {
    if (S.state && S.state.settings.calm) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const colors = S.cats().map((c) => c.color);
    for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + 'vw'; p.style.background = colors[i % colors.length]; p.style.animationDelay = Math.random() * .6 + 's'; p.style.animationDuration = 1.4 + Math.random() + 's'; box.appendChild(p); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2800);
  }
  function celebrate(news, points) {
    if (points > 0) { toast(`+${points} ⭐`); vibrate(30); }
    news.forEach((n, i) => setTimeout(() => {
      if (n.type === 'goal') { confetti(); toast('Dagsmålet er nådd! 🎯 Resten er bonus.', true); }
      else if (n.type === 'badge') { confetti(); toast(`Nytt merke: ${n.badge.emoji} ${n.badge.name}`, true); }
      else if (n.type === 'freeze') toast('Streaken din ble reddet av en fridag ❄️', true);
      else if (n.type === 'freezeEarned') toast('Du fikk en ny fridag i reserve ❄️', true);
      else if (n.type === 'restart') toast('Ny start i dag 💙 Streaks er bare bonus.', true);
    }, 400 + i * 900));
  }

  // ---------- AI-handlinger ----------
  function aiNotice(r) {
    if (r.local && PLAI.enabled()) toast('AI-tjenesten svarte ikke. Brukte innebygd forslag.' + (r.error ? ' (' + r.error.slice(0, 60) + ')' : ''), true);
  }
  async function withSpinner(el, fn) {
    const old = el.innerHTML; el.disabled = true; el.innerHTML = '<span class="spinner"></span> Tenker…';
    try { return await fn(); } catch (e) { toast('AI: ' + e.message, true); } finally { el.disabled = false; el.innerHTML = old; }
  }

  // ---------- Handlinger ----------
  const actions = {
    nav: (d) => { view = d.view; if (d.view === 'today') planDate = S.ymd(); render(); window.scrollTo(0, 0); },
    planDay: (d) => { planDate = +d.n === 0 ? S.ymd() : S.addDays(planDate, +d.n); render(); },
    fab: () => { if (view === 'plan') openModal(eventModal(null, selectedDate)); else openModal(taskModal(null, { today: view === 'today' ? S.ymd() : '' })); },
    closeModalBg: (d, el, e) => { if (e.target === el) tryCloseModal(); },
    closeModal: () => tryCloseModal(),
    tplSheet: () => {
      const date = view === 'plan' ? selectedDate : planDate;
      openModal(`${modalHead('Velg mal')}<div class="menu">
        ${S.templates().map((t) => `<button class="btn outline" data-act="newEventTpl" data-id="${t.id}" data-date="${date}"><span style="width:22px;text-align:center">${S.catById(t.cat).emoji}</span><span class="grow" style="text-align:left">${esc(t.title)}<div class="tiny muted">kl. ${t.time} · ${t.duration} min${t.recur && t.recur !== 'none' ? ' · ' + S.recurLabel({ type: t.recur, days: t.days }) : ''}</div></span></button>`).join('') || '<div class="empty">Ingen maler ennå. Lag en under Mer → Maler.</div>'}
        <button class="btn ghost" data-act="newEvent">Uten mal</button>
      </div>`);
    },
    retryLogin: () => { S.lockDevice(); renderLogin(); },
    wipeAll: () => { if (confirm('Slette alle data på denne enheten? Dette kan ikke angres.')) { S.wipe(); location.reload(); } },
    lock: () => { if (confirm('Låse enheten? Du må skrive inn passordet neste gang.')) { S.lockDevice(); location.reload(); } },

    // Dato/tid-felter
    pickDate: (d, el) => {
      const f = el.closest('form'); const nat = f.querySelector(`input[type="date"][data-for="${d.for}"]`);
      nat.value = S.parseNb(f[d.for].value) || S.ymd();
      try { nat.showPicker(); } catch (e) { nat.click(); }
    },
    setDate: (d, el) => { el.closest('form')[d.for].value = S.fmtNb(d.v); },
    timeStep: (d, el) => {
      const inp = el.closest('form')[d.for]; const t = S.parseTime(inp.value) || '09:00';
      inp.value = S.minToHm((S.minutesOf(t) + +d.n + 1440) % 1440);
    },
    setDur: (d, el) => { el.closest('form').duration.value = d.v; },
    toggleDay: (d, el) => el.classList.toggle('on'),
    pickColor: (d, el) => { el.closest('form').color.value = d.v; $$('.swatches button', el.closest('form')).forEach((b) => b.classList.toggle('on', b === el)); },

    // I dag
    quickCat: (d, el) => {
      quickOpenCat = quickOpenCat === d.v ? null : d.v;
      const typed = el.closest('form').title.value;
      render();
      const inp = $('form[data-form="quickAdd"] input[name="title"]'); if (inp && typed) { inp.value = typed; $('#quickTag').innerHTML = quickTagText(typed); }
    },
    quickExample: (d) => {
      const c = S.catById(d.cat); const x = c.examples[+d.i]; if (!x) return;
      const t = S.addTask({ title: x.title, cat: c.id, today: S.ymd(), steps: x.steps.map((title) => ({ id: S.uid(), title, done: false })) });
      render();
      undoToast(`Lagt til: ${x.title}${x.steps.length ? ` (${x.steps.length} steg)` : ''}`, () => S.deleteTask(t.id));
    },
    quickTag: (d, el) => {
      const typed = el.closest('form').title.value;
      openModal(`${modalHead('Hvor skal oppgaven havne?')}<div class="menu">
        <button class="btn outline" data-act="quickTextCat" data-v=""><span style="width:22px;text-align:center">✨</span>Automatisk (treff på forslag, ellers ${esc(S.catById(S.defaultCatId()).name)})</button>
        ${catsByUsage().map((c) => `<button class="btn outline" data-act="quickTextCat" data-v="${c.id}" style="${quickTextCat === c.id ? `border-color:${c.color}` : ''}"><span style="width:22px;text-align:center">${c.emoji}</span>${esc(c.name)}</button>`).join('')}
      </div>`);
      $('#modal').dataset.typed = typed;
    },
    quickTextCat: (d) => {
      quickTextCat = d.v || null;
      const typed = $('#modal').dataset.typed || '';
      closeModal(); render();
      const inp = $('form[data-form="quickAdd"] input[name="title"]'); if (inp) { inp.value = typed; $('#quickTag').innerHTML = quickTagText(typed); inp.focus(); }
    },
    setEnergy: (d) => { const today = S.ymd(); S.setEnergy(today, S.energyOn(today) === d.v ? '' : d.v); render(); },
    toggleStar: (d) => { const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return; S.updateTask(d.id, { prio: t.prio === 1 ? 2 : 1 }); closeModal(); render(); toast(t.prio === 1 ? '★ Markert som viktigst' : 'Fjernet fra viktigst'); },
    postpone: (d) => {
      const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return;
      const prior = { today: t.today, due: t.due, plannedTime: t.plannedTime || '', plannedDuration: t.plannedDuration || 0 };
      S.updateTask(d.id, { today: '', due: S.addDays(S.ymd(), 1), plannedTime: '', plannedDuration: 0 }); closeModal(); render();
      undoToast('Flyttet til i morgen. Helt greit 💙', () => S.updateTask(d.id, prior));
    },
    taskMenu: (d) => {
      const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return;
      const today = S.ymd();
      const onToday = t.today === today || (t.due && t.due <= today);
      const items = [
        ['▶', 'Start fokus', 'focusTask'],
        [t.prio === 1 ? '☆' : '★', t.prio === 1 ? 'Fjern fra dagens viktigste' : 'Marker som en av dagens viktigste', 'toggleStar'],
        onToday ? ['🕒', t.plannedTime ? `Endre klokkeslett (${t.plannedTime})` : 'Sett klokkeslett i dag', 'scheduleTask'] : ['📅', 'Legg i dagens plan', 'addToday'],
        ['⏭', 'Utsett til i morgen', 'postpone'],
        ['✎', 'Rediger', 'openTask']
      ];
      openModal(`${modalHead(esc(t.title))}<div class="menu">
        ${items.map(([i, l, a]) => `<button class="btn outline" data-act="${a}" data-id="${t.id}"><span style="width:22px;text-align:center">${i}</span>${l}</button>`).join('')}
        <button class="btn danger" data-act="deleteTask" data-id="${t.id}"><span style="width:22px;text-align:center">🗑</span>Slett</button>
      </div>`);
    },

    // Oppgaver
    toggleTask: (d) => {
      const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return;
      const news = S.toggleTask(d.id); if ($('#modal').innerHTML) closeModal(); render();
      if (t.done) { celebrate(news, 0); vibrate(30); undoToast(`Fullført · +${S.POINTS.task} ⭐`, () => S.toggleTask(d.id)); }
    },
    openTask: (d) => { const t = S.state.tasks.find((x) => x.id === d.id); if (t) openModal(taskModal(t)); },
    deleteTask: (d) => {
      const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return;
      const idx = S.state.tasks.indexOf(t); S.deleteTask(d.id); closeModal(); render();
      undoToast(`Slettet «${t.title.slice(0, 30)}»`, () => S.restoreTask(t, idx));
    },
    addToday: (d) => { S.updateTask(d.id, { today: S.ymd() }); closeModal(); toast('Lagt i dagens plan 📅'); render(); },
    scheduleTask: (d) => {
      const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return;
      openModal(`${modalHead(`Når vil du gjøre «${esc(t.title)}»?`)}
        <form data-form="scheduleTask" data-id="${t.id}">
          <div class="grid2"><label class="field"><span>Klokkeslett (tt:mm)</span>${timeField('time', t.plannedTime || nextQuarter(), true)}</label>
          <label class="field"><span>Varighet (min)</span><input class="input" type="number" name="duration" min="5" max="480" value="${t.plannedDuration || 25}"></label></div>
          ${durationChips()}
          <div class="row"><button class="btn primary" type="submit">Legg i tidslinjen</button>${t.plannedTime ? `<button class="btn outline" type="button" data-act="unscheduleTask" data-id="${t.id}">Fjern tidspunkt</button>` : ''}</div>
        </form>`);
    },
    unscheduleTask: (d) => { S.updateTask(d.id, { plannedTime: '', plannedDuration: 0 }); closeModal(); render(); },
    toggleStep: (d) => { const t = S.state.tasks.find((x) => x.id === d.id); const s = t && t.steps.find((x) => x.id === d.step); const news = S.toggleStep(d.id, d.step); celebrate(news, s && s.done ? S.POINTS.step : 0); openModal(taskModal(t)); render(); },
    deleteStep: (d) => { const t = S.state.tasks.find((x) => x.id === d.id); if (!t) return; S.updateTask(d.id, { steps: t.steps.filter((s) => s.id !== d.step) }); openModal(taskModal(t)); },
    clearDone: () => { if (confirm('Fjerne alle ferdige oppgaver fra lista? Poengene beholdes.')) { S.state.tasks = S.state.tasks.filter((t) => !t.done); S.save(); render(); } },
    listFilter: (d) => { listFilter = d.v; render(); },
    listCat: (d) => { listCat = d.v; render(); },
    formCat: (d, el) => { syncFormCat(el.closest('form'), d.v); revealActiveChips(); },
    useExample: (d, el) => {
      const c = S.catById(d.cat); const x = c.examples[+d.i]; if (!x) return;
      const f = el.closest('form');
      f.title.value = x.title;
      if (f.cat && f.cat.value !== c.id) syncFormCat(f, c.id);
      if (f.stepsText) {
        f.stepsText.value = x.steps.join('\n');
        const note = $('#stepsNote', f); if (note) note.textContent = x.steps.length ? `${x.steps.length} steg lagt til` : '';
        modalDirty = true; return;
      }
      const t = S.state.tasks.find((z) => z.id === f.dataset.id); if (!t) return;
      if (x.steps.length && (!t.steps.length || confirm('Erstatte stegene på oppgaven med standardstegene for dette forslaget?'))) {
        S.updateTask(t.id, { title: x.title, cat: c.id, steps: x.steps.map((title) => ({ id: S.uid(), title, done: false })) });
        openModal(taskModal(S.state.tasks.find((z) => z.id === t.id))); render(); toast(`Fylte inn ${x.steps.length} steg`);
      } else S.updateTask(t.id, { title: x.title, cat: c.id });
    },
    pickTasks: () => {
      const today = S.ymd();
      const cands = S.state.tasks.filter((t) => !t.done && t.today !== today && !(t.due && t.due <= today));
      openModal(`${modalHead('Velg oppgaver for i dag')}<p class="small muted">Tips: 1–3 ting er nok.</p>
        ${cands.length ? cands.map((t) => `<div class="item"><div class="grow"><div class="title">${esc(t.title)}</div><div class="meta">${S.catById(t.cat).emoji} ${esc(S.catById(t.cat).name)} · ${energyLabel[t.energy] || ''}${t.due ? ' · ' + dueLabel(t.due) : ''}</div></div><button class="btn sm outline" data-act="addTodayFromPick" data-id="${t.id}">+ I dag</button></div>`).join('') : '<div class="empty">Ingen flere åpne oppgaver i listene.</div>'}
        <button class="btn block mt" data-act="closeModal">Lukk</button>`);
    },
    addTodayFromPick: (d, el) => { S.updateTask(d.id, { today: S.ymd() }); el.closest('.item').remove(); toast('Lagt til 📅'); render(); },

    // Innboks
    inboxDelete: (d) => { S.deleteInbox(d.id); render(); },
    inboxToTask: (d) => { const n = S.state.inbox.find((x) => x.id === d.id); if (n) openModal(taskModal(null, { title: n.text, inboxId: n.id })); },

    // Aktiviteter
    newEvent: () => openModal(eventModal(null, view === 'plan' ? selectedDate : planDate)),
    newEventTpl: (d) => { const t = S.templates().find((x) => x.id === d.id); if (t) openModal(eventModal(null, d.date || (view === 'plan' ? selectedDate : planDate), t)); },
    applyTemplate: (d, el) => {
      const t = S.templates().find((x) => x.id === d.id); if (!t) return; const f = el.closest('.modal').querySelector('form');
      f.title.value = t.title; f.time.value = t.time; f.duration.value = t.duration; f.recur.value = t.recur || 'none'; f.stepsText.value = (t.steps || []).join('\n');
      syncFormCat(f, t.cat);
      $$('#weekdays button').forEach((b) => b.classList.toggle('on', (t.days || []).includes(+b.dataset.day)));
      $('#weekdays').hidden = f.recur.value !== 'weekly'; $('#untilField').hidden = f.recur.value === 'none';
      const det = f.querySelector('details.more'); if (det && (f.recur.value !== 'none' || (t.steps || []).length)) det.open = true;
      toast('Mal fylt inn');
    },
    saveAsTpl: (d, el) => {
      const f = el.closest('form'); const v = readForm(f);
      if (!v.title.trim()) { f.title.focus(); return; }
      const time = S.parseTime(v.time) || '09:00';
      S.addTemplate({ title: v.title.trim(), cat: v.cat, time, duration: Math.max(1, +v.duration || 30), recur: v.recur, days: v.recur === 'weekly' ? $$('#weekdays button.on').map((b) => +b.dataset.day) : [], steps: linesToTitles(v.stepsText) });
      toast('Lagret som mal ✔', true);
    },
    openEvent: (d) => { const e = S.state.events.find((x) => x.id === d.id); if (e) openModal(eventModal(e, d.date)); },
    toggleOcc: (d) => {
      const e = S.state.events.find((x) => x.id === d.id); if (!e) return;
      const news = S.toggleOccurrence(d.id, d.date); render();
      if (e.done[d.date]) { celebrate(news, 0); vibrate(30); undoToast(`Fullført · +${S.POINTS.event} ⭐`, () => S.toggleOccurrence(d.id, d.date)); }
    },
    deleteEventMenu: (d) => {
      const e = S.state.events.find((x) => x.id === d.id); if (!e) return;
      if (e.recur.type === 'none' || !d.date) { actions.deleteEvent(d); return; }
      openModal(`<h2 class="mb">Slette «${esc(e.title)}»?</h2><p class="small muted">Dette er en gjentakende aktivitet.</p>
        <button class="btn block outline mb" data-act="skipOcc" data-id="${e.id}" data-date="${d.date}">Bare ${d2(d.date).toLowerCase()}</button>
        <button class="btn danger block mb" data-act="deleteEvent" data-id="${e.id}">Hele serien</button>
        <button class="btn ghost block" data-act="closeModal">Avbryt</button>`);
    },
    skipOcc: (d) => { S.skipOccurrence(d.id, d.date); closeModal(); render(); undoToast(`Fjernet for ${d2(d.date).toLowerCase()}`, () => S.unskipOccurrence(d.id, d.date)); },
    deleteEvent: (d) => {
      const e = S.state.events.find((x) => x.id === d.id); if (!e) return;
      const idx = S.state.events.indexOf(e); S.deleteEvent(d.id); closeModal(); render();
      undoToast(`Slettet «${e.title.slice(0, 30)}»`, () => S.restoreEvent(e, idx));
    },
    week: (d) => { selectedDate = S.addDays(selectedDate, 7 * +d.n); render(); },
    goToday: () => { selectedDate = S.ymd(); render(); },
    selDate: (d) => { selectedDate = d.date; render(); },

    // Kategorier, forslag og maler
    editCat: (d) => openModal(catModal(d.id ? S.cats().find((c) => c.id === d.id) : null)),
    deleteCat: (d) => {
      const c = S.catById(d.id);
      const used = S.state.tasks.filter((t) => t.cat === d.id).length + S.state.events.filter((e) => e.cat === d.id).length;
      if (confirm(`Slette kategorien «${c.name}»?${used ? ` ${used} oppgaver/aktiviteter flyttes til en annen kategori.` : ''}`)) { S.deleteCategory(d.id); closeModal(); render(); toast('Kategori slettet'); }
    },
    editExample: (d) => openModal(exampleModal(d.cat, d.i === undefined || d.i === '' ? undefined : +d.i)),
    deleteExample: (d) => { const c = S.catById(d.cat); c.examples.splice(+d.i, 1); S.updateCategory(c.id, {}); openModal(catModal(c)); },
    editTpl: (d) => openModal(tplModal(d.id ? S.templates().find((t) => t.id === d.id) : null)),
    deleteTpl: (d) => { if (confirm('Slette malen?')) { S.deleteTemplate(d.id); closeModal(); render(); } },

    // Fokus
    focusTask: (d) => startFocus('task', d.id, S.ymd()),
    focusEvent: (d) => startFocus('event', d.id, d.date || S.ymd()),
    exitFocus: () => { focus = null; renderFocus(); render(); },
    focusSkip: () => {
      const f = focus; focus = null; renderFocus();
      if (f.kind === 'task') actions.postpone({ id: f.id });
      else { const nextDate = S.addDays(f.date, 1); actions.skipOcc({ id: f.id, date: f.date }); toast(`Neste gang: ${d2(nextDate).toLowerCase()} 💙`); }
    },
    dismissOnboarding: () => { S.state.settings.onboarded = true; S.save(); render(); },
    focusDur: (d) => { focus.planned = +d.v; focus.total = focus.remaining = +d.v * 60; renderFocus(); },
    focusToggle: () => {
      if (focus.running) { focus.running = false; focus.remaining = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000)); }
      else { focus.running = true; focus.finished = false; focus.endAt = Date.now() + focus.remaining * 1000; }
      renderFocus();
    },
    focusPlus: () => { focus.remaining += 300; focus.total += 300; focus.finished = false; if (focus.running) focus.endAt += 300000; renderFocus(); },
    focusStep: (d) => {
      let news, gained;
      if (focus.kind === 'task') { const t = S.state.tasks.find((x) => x.id === focus.id); const s = t.steps.find((x) => x.id === d.step); news = S.toggleStep(focus.id, d.step); gained = s.done; }
      else { news = S.toggleEventStep(focus.id, focus.date, d.step); const e = S.state.events.find((x) => x.id === focus.id); gained = !!e.stepDone[focus.date + ':' + d.step]; }
      celebrate(news, gained ? S.POINTS.step : 0); renderFocus();
    },
    focusDone: () => {
      if (focus.running) focus.remaining = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
      const used = Math.round((focus.total - focus.remaining) / 60);
      let news = [], pts = 0;
      if (focus.kind === 'task') { const t = S.state.tasks.find((x) => x.id === focus.id); if (t && !t.done) { if (used > 0) S.updateTask(focus.id, { actualMin: used }); news = S.toggleTask(focus.id); pts = S.POINTS.task; } }
      else { const e = S.state.events.find((x) => x.id === focus.id); if (e && !e.done[focus.date]) { news = S.toggleOccurrence(focus.id, focus.date); pts = S.POINTS.event; } }
      const planned = focus.planned;
      focus = null; renderFocus(); render(); confetti(); celebrate(news, pts);
      toast(used > 0 ? `Ferdig! 🎉 Planlagt ${planned} min, brukt ${used} min${used < planned ? ' – raskere enn du trodde' : used > planned ? ' – nyttig å vite til neste gang' : ''}` : 'Ferdig! 🎉', true);
    },
    aiKickstart: async (d, el) => {
      const steps = focusSteps().filter((s) => !s.on).map((s) => s.title);
      await withSpinner(el, async () => { const r = await PLAI.kickstart(focus.title, steps); aiNotice(r); focus.ai = r.text; renderFocus(); });
    },
    aiBreakDown: async (d, el) => {
      const form = el.closest('form'); const f = readForm(form);
      if (!f.title.trim()) { form.title.focus(); return; }
      let id = d.id;
      if (!id) {
        const due = readDate(f.due, 'frist'); if (due === null) return;
        const t = S.addTask({ title: f.title.trim(), cat: f.cat, due, energy: f.energy, today: f.today ? S.ymd() : '', prio: f.star ? 1 : 2, trigger: f.trigger || '', notes: f.notes, steps: linesToSteps(f.stepsText) });
        if (f.inboxId) S.deleteInbox(f.inboxId);
        id = t.id; openModal(taskModal(t)); el = $('[data-act="aiBreakDown"]');
      }
      await withSpinner(el, async () => {
        const t = S.state.tasks.find((x) => x.id === id);
        const r = await PLAI.breakDown(t.title, t.notes); aiNotice(r);
        S.updateTask(id, { steps: [...t.steps, ...r.steps.map((title) => ({ id: S.uid(), title, done: false }))] });
        openModal(taskModal(S.state.tasks.find((x) => x.id === id))); render();
      });
    },
    aiPlanDay: async (d, el) => {
      const today = S.ymd();
      const tasks = openTasksFor(today);
      await withSpinner(el, async () => {
        const r = await PLAI.planDay(tasks, S.occurrencesOn(today), S.state.settings.dayEnd, S.energyOn(today)); aiNotice(r);
        const rows = r.plan.map((p) => ({ ...p, task: tasks.find((t) => t.id === p.id) })).filter((p) => p.task && /^\d{2}:\d{2}$/.test(p.time || ''));
        if (!rows.length) throw new Error('Fant ikke plass til oppgavene før dagen er slutt. Prøv med færre oppgaver.');
        openModal(`${modalHead('✨ Forslag til dagen')}<p class="small muted">${r.local ? 'Innebygd forslag basert på energinivå, prioritet og ledig tid.' : 'Foreslått av AI.'}</p>
          ${rows.map((p) => `<div class="item"><div class="time-col">${p.time}</div><div class="grow"><div class="title">${esc(p.task.title)}</div><div class="meta">${+p.duration || 25} min${p.why ? ' · ' + esc(p.why) : ''}</div></div></div>`).join('')}
          <div class="row mt"><button class="btn primary" data-act="applyPlan">Bruk forslaget</button><button class="btn outline" data-act="closeModal">Nei takk</button></div>`);
        $('#modal').dataset.plan = JSON.stringify(rows.map((p) => ({ id: p.id, time: p.time, duration: +p.duration || 25 })));
      });
    },
    applyPlan: () => {
      const rows = JSON.parse($('#modal').dataset.plan || '[]'); const today = S.ymd();
      rows.forEach((p) => S.updateTask(p.id, { today, plannedTime: p.time, plannedDuration: p.duration }));
      closeModal(); render(); toast('Planen er lagt inn i tidslinjen 📅', true);
    },
    testAi: async (d, el) => {
      const f = el.closest('form'); const fd = readForm(f);
      const backup = { ...S.state.settings.ai };
      Object.assign(S.state.settings.ai, { provider: fd.provider, baseUrl: fd.baseUrl, model: fd.model, apiKey: fd.apiKey });
      const out = $('#aiTestResult'); out.textContent = 'Tester…';
      try { const r = await PLAI.chat([{ role: 'user', content: 'Si hei på norsk med maks fem ord.' }]); out.textContent = '✅ ' + r.slice(0, 60); }
      catch (e) { out.textContent = '❌ ' + e.message; }
      finally { S.state.settings.ai = backup; }
    },
    aiPreset: (d, el) => {
      const p = PLAI.PRESETS[d.p]; const f = el.closest('.card').querySelector('form');
      f.provider.value = p.provider; f.baseUrl.value = p.baseUrl; f.model.value = p.model; f.apiKey.focus();
      const link = $('#aiKeyLink'); if (link) link.innerHTML = p.url ? `Hent nøkkel: <a href="${p.url}" target="_blank" rel="noopener">${p.url.replace(/^https?:\/\//, '')}</a>` : '';
    },
    askNotify: async () => { if ('Notification' in window) { await Notification.requestPermission(); render(); } },
    checkUpdate: async () => {
      if (!('serviceWorker' in navigator)) { location.reload(); return; }
      toast('Ser etter oppdatering …');
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { location.reload(); return; }
      await reg.update().catch(() => {});
      setTimeout(() => { if (!reg.installing && !reg.waiting) toast('Du har nyeste versjon ✔'); }, 2500);
    },
    export: () => download(`planlegger-${S.ymd()}.json`, S.exportJson(), 'application/json'),
    exportIcs: () => { download('planlegger.ics', S.exportIcs(), 'text/calendar'); toast('Kalenderfil lastet ned. Åpne den i kalenderappen din.', true); }
  };

  const forms = {
    login: async (f) => {
      const d = readForm(f); const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Låser opp…';
      try {
        if (await S.unlockWithPassword(d.pw, !!d.remember)) return start();
        renderLogin('Feil passord. Prøv igjen.');
      } catch (e) {
        if (e.message === 'DECRYPT_FAILED') renderDecryptFailed(); else renderLogin('Noe gikk galt: ' + e.message);
      }
    },
    quickAdd: (f) => {
      const d = readForm(f); if (!d.title.trim()) return;
      // Manuelt valg vinner. Ellers: treff på et forslag gir forslagets kategori, og fritekst havner under «Annet».
      const x = S.findExample(d.title);
      const cat = quickTextCat || (x ? x.cat : S.defaultCatId());
      const t = S.addTask({ title: d.title.trim(), cat, today: S.ymd(), steps: x ? x.steps.map((title) => ({ id: S.uid(), title, done: false })) : [] });
      quickTextCat = null; render();
      const cname = S.catById(cat).name;
      undoToast(x ? `Lagt til under ${cname} med ${x.steps.length} steg` : `Lagt til under ${cname}`, () => S.deleteTask(t.id));
      const inp = $('form[data-form="quickAdd"] input'); if (inp) inp.focus();
    },
    inboxAdd: (f) => {
      const d = readForm(f); if (!d.text.trim()) return;
      S.addInbox(d.text); render(); toast('Fanget 💭');
      const inp = $('form[data-form="inboxAdd"] input'); if (inp) inp.focus();
    },
    saveTask: (f) => {
      const d = readForm(f); const today = S.ymd();
      const due = readDate(d.due, 'frist'); if (due === null) return;
      const patch = { title: d.title.trim(), cat: d.cat, due, energy: d.energy, notes: d.notes, trigger: (d.trigger || '').trim(), prio: d.star ? 1 : 2, today: d.today ? today : '' };
      if (f.dataset.id) {
        const t = S.state.tasks.find((x) => x.id === f.dataset.id);
        if (t && !d.today && t.today === today) patch.plannedTime = '';
        S.updateTask(f.dataset.id, patch);
      } else {
        S.addTask({ ...patch, steps: linesToSteps(d.stepsText) });
        if (d.inboxId) S.deleteInbox(d.inboxId);
      }
      closeModal(); render(); toast(f.dataset.id ? 'Lagret' : 'Oppgave lagt til ✔');
    },
    addStep: (f) => {
      const d = readForm(f); if (!d.title.trim()) return;
      const t = S.state.tasks.find((x) => x.id === f.dataset.id); if (!t) return;
      S.updateTask(t.id, { steps: [...t.steps, { id: S.uid(), title: d.title.trim(), done: false }] });
      openModal(taskModal(t)); $('form[data-form="addStep"] input').focus();
    },
    scheduleTask: (f) => {
      const d = readForm(f); const time = readTime(d.time, 'klokkeslett'); if (time === null) return;
      S.updateTask(f.dataset.id, { today: S.ymd(), plannedTime: time, plannedDuration: +d.duration || 25 }); closeModal(); render(); toast('Lagt i tidslinjen 🕒');
    },
    saveEvent: (f) => {
      const d = readForm(f);
      const date = readDate(d.date, 'dato'); if (!date) { if (date === '') toast('Dato mangler', true); return; }
      const time = readTime(d.time, 'klokkeslett'); if (time === null) return;
      const until = readDate(d.until, 'sluttdato'); if (until === null) return;
      const days = $$('#weekdays button.on').map((b) => +b.dataset.day);
      const patch = { title: d.title.trim(), cat: d.cat, date, time, duration: Math.max(1, +d.duration || 30), notes: d.notes, trigger: (d.trigger || '').trim(),
        recur: { type: d.recur, days: d.recur === 'weekly' ? days : [], until: d.recur === 'none' ? '' : until } };
      if (f.dataset.id) {
        const e = S.state.events.find((x) => x.id === f.dataset.id);
        const oldTitles = e.steps.map((s) => s.title).join('\n');
        if (oldTitles !== d.stepsText.trim()) patch.steps = linesToSteps(d.stepsText);
        S.updateEvent(f.dataset.id, patch);
      } else S.addEvent({ ...patch, steps: linesToSteps(d.stepsText) });
      closeModal(); render(); toast(f.dataset.id ? 'Lagret' : 'Aktivitet lagt til 🗓️');
    },
    saveCat: (f) => {
      const d = readForm(f); const patch = { name: d.name.trim(), emoji: d.emoji.trim() || '📁', color: d.color };
      if (f.dataset.id) { S.updateCategory(f.dataset.id, patch); closeModal(); render(); toast('Kategori lagret'); }
      else { const c = S.addCategory(patch); render(); openModal(catModal(c)); toast('Kategori opprettet. Legg til forslag under.'); }
    },
    saveExample: (f) => {
      const d = readForm(f); const c = S.catById(f.dataset.cat);
      const x = { title: d.title.trim(), steps: linesToTitles(d.stepsText) };
      if (f.dataset.i === '') c.examples.push(x); else c.examples[+f.dataset.i] = x;
      S.updateCategory(c.id, {}); openModal(catModal(c)); toast('Forslag lagret');
    },
    saveTpl: (f) => {
      const d = readForm(f); const time = readTime(d.time, 'klokkeslett'); if (time === null) return;
      const patch = { title: d.title.trim(), cat: d.cat, time, duration: Math.max(1, +d.duration || 30), recur: d.recur, days: d.recur === 'weekly' ? $$('#weekdays button.on').map((b) => +b.dataset.day) : [], steps: linesToTitles(d.stepsText) };
      if (f.dataset.id) S.updateTemplate(f.dataset.id, patch); else S.addTemplate(patch);
      closeModal(); render(); toast('Mal lagret');
    },
    saveAi: (f) => { const d = readForm(f); Object.assign(S.state.settings.ai, { provider: d.provider, baseUrl: d.baseUrl.trim(), model: d.model.trim(), apiKey: d.apiKey.trim() }); S.save(); toast('AI-innstillinger lagret'); render(); },
    saveSettings: (f) => {
      const d = readForm(f);
      const dayStart = readTime(d.dayStart, 'starttid'); if (dayStart === null) return;
      const dayEnd = readTime(d.dayEnd, 'sluttid'); if (dayEnd === null) return;
      Object.assign(S.state.settings, { theme: d.theme, dailyGoal: Math.max(1, +d.dailyGoal || 3), dayStart, dayEnd, notify: !!d.notify, calm: !!d.calm });
      applyTheme(d.theme); S.save(); toast('Lagret'); render();
    },
    changePw: async (f) => {
      const d = readForm(f);
      if (d.pw1 !== d.pw2) { toast('Passordene er ikke like', true); return; }
      const a = await S.changePassword(d.pw1);
      $('#pwResult').innerHTML = `<p class="small mt">✅ Passordet er byttet på denne enheten. For at det skal gjelde på andre enheter, oppdater <code>js/config.js</code> med:</p>
        <pre>auth: {\n  salt: '${a.salt}',\n  verifier: '${a.verifier}',\n  iterations: ${a.iterations}\n}</pre>
        <p class="tiny muted">På andre enheter: lås opp med det gamle passordet først, ta sikkerhetskopi, og importer den etter at config.js er oppdatert.</p>`;
      f.reset();
    }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = actions[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'BUTTON' && !el.type) e.preventDefault();
    fn(el.dataset, el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault(); const fn = forms[f.dataset.form]; if (fn) fn(f);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    if (el.dataset.change === 'catExamples') { const ex = $('#examples'); if (ex) ex.outerHTML = exampleChips(el.value); }
    if (el.dataset.change === 'recurType') { const w = $('#weekdays'); if (w) w.hidden = el.value !== 'weekly'; const u = $('#untilField'); if (u) u.hidden = el.value === 'none'; }
    if (el.dataset.change === 'nativeDate') { const f = el.closest('form'); if (el.value) f[el.dataset.for].value = S.fmtNb(el.value); }
    if (el.dataset.change === 'import') {
      const file = el.files[0]; if (!file) return;
      file.text().then((t) => S.importJson(t)).then(() => { toast('Importert ✔', true); render(); }).catch((err) => toast('Import feilet: ' + err.message, true));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('#modal').innerHTML) tryCloseModal(); } });
  document.addEventListener('input', (e) => {
    if (e.target.closest('#modal form')) modalDirty = true;
    if (e.target.matches('[data-input="quickTitle"]')) { const tag = $('#quickTag'); if (tag) tag.innerHTML = quickTagText(e.target.value); }
  });

  // Sveip sidelengs på elementer med data-swipe for å bla mellom dager.
  let swipe = null;
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest('[data-swipe]'); if (!el || e.touches.length !== 1) { swipe = null; return; }
    swipe = { kind: el.dataset.swipe, x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!swipe) return;
    const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
    const { kind, t } = swipe; swipe = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - t > 800) return;
    const n = dx < 0 ? 1 : -1; // sveip mot venstre = neste dag
    if (kind === 'planDay') actions.planDay({ n: String(n) });
    else if (kind === 'selDate') { selectedDate = S.addDays(selectedDate, n); render(); }
    vibrate(10);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.state) { checkReminders(); if (view === 'today' && !$('#modal').innerHTML) render(); } });

  boot();
})();
