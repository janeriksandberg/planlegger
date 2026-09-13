// AI-hjelp med innebygde reserveløsninger. Appen skal fungere like godt uten AI.
// Tjenester: OpenAI-kompatibel (Groq, OpenRouter, OpenAI …), Google Gemini, Anthropic, Pollinations (ustabil, uten nøkkel).
window.PLAI = (() => {
  const SYSTEM = `Du er en varm, konkret og kortfattet assistent i en planleggingsapp for en person med ADHD.
Regler: Svar på norsk bokmål. Vær konkret og praktisk. Bruk korte setninger. Ingen moralisering, ingen skam.
Foreslå små, tydelige første steg (2–10 minutter). Vær oppmuntrende uten å overdrive.`;

  const PRESETS = {
    groq: { provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', label: 'Groq (gratisnivå)', url: 'https://console.groq.com/keys' },
    openrouter: { provider: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', label: 'OpenRouter (gratismodeller)', url: 'https://openrouter.ai/keys' },
    gemini: { provider: 'gemini', baseUrl: '', model: 'gemini-2.5-flash', label: 'Google Gemini (gratisnivå)', url: 'https://aistudio.google.com/apikey' },
    anthropic: { provider: 'anthropic', baseUrl: '', model: 'claude-haiku-4-5-20251001', label: 'Anthropic Claude', url: 'https://console.anthropic.com/settings/keys' },
    openai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
    pollinations: { provider: 'pollinations', baseUrl: '', model: 'openai', label: 'Pollinations (uten nøkkel, ustabil)', url: '' }
  };

  function cfg() { return (PLStore.state && PLStore.state.settings.ai) || window.PLANLEGGER_CONFIG.ai; }
  function enabled() { const c = cfg(); return c.provider && c.provider !== 'off'; }

  async function chat(messages, { json = false, temperature = 0.4 } = {}) {
    const c = cfg();
    if (!enabled()) throw new Error('AI er ikke satt opp.');
    const sys = SYSTEM + (json ? '\nSvar KUN med gyldig JSON, uten forklaring og uten kodeblokk.' : '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const fail = async (res) => { throw new Error('AI-feil ' + res.status + ': ' + (await res.text()).slice(0, 160)); };
    try {
      if (c.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: c.model || PRESETS.anthropic.model, max_tokens: 1024, system: sys, messages, temperature })
        });
        if (!res.ok) await fail(res);
        const data = await res.json();
        return data.content.map((p) => p.text || '').join('');
      }
      if (c.provider === 'gemini') {
        const model = c.model || PRESETS.gemini.model;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': c.apiKey },
          body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) } })
        });
        if (!res.ok) await fail(res);
        const data = await res.json();
        const text = ((data.candidates || [])[0] || {}).content?.parts?.map((p) => p.text || '').join('') || '';
        if (!text) throw new Error('Tomt svar fra Gemini.');
        return text;
      }
      let url;
      if (c.provider === 'pollinations') url = 'https://text.pollinations.ai/openai';
      else {
        const base = (c.baseUrl || PRESETS.openai.baseUrl).replace(/\/$/, '');
        url = /chat\/completions$/.test(base) ? base : base + '/chat/completions';
      }
      const headers = { 'content-type': 'application/json' };
      if (c.apiKey) headers.authorization = 'Bearer ' + c.apiKey;
      const body = { model: c.model || 'openai', messages: [{ role: 'system', content: sys }, ...messages], temperature };
      if (c.provider === 'pollinations') { body.private = true; body.seed = Math.floor(Math.random() * 1e6); }
      const res = await fetch(url, { method: 'POST', signal: ctrl.signal, headers, body: JSON.stringify(body) });
      if (!res.ok) await fail(res);
      const data = await res.json();
      const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      if (!text) throw new Error('Tomt svar fra AI-tjenesten.');
      return text;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI-tjenesten svarte ikke i tide.');
      throw e;
    } finally { clearTimeout(timer); }
  }

  function parseJson(text) {
    const m = text.match(/[\[{][\s\S]*[\]}]/);
    if (!m) throw new Error('Fant ikke JSON i svaret.');
    return JSON.parse(m[0]);
  }

  // ---------- Innebygde forslag (uten AI) ----------
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // Mest spesifikke mønstre først. Første treff vinner.
  const LOCAL_STEPS = [
    { re: /klesvask|vaske klær|vask.*(klær|tøy)|tøyvask|skittentøy/i, steps: () => ['Samle skittentøy', 'Sortere lyst og mørkt', 'Legge i maskinen og fylle såpe', 'Velge program og starte', 'Sette alarm til vasken er ferdig'] },
    { re: /henge opp|tørketrommel|tørke klær|brette/i, steps: () => ['Ta klærne ut av maskinen', 'Heng opp eller sett i trommelen', 'Sett alarm for å ta dem ned', 'Brett og legg i skapet'] },
    { re: /oppvask/i, steps: () => ['Tømme oppvaskmaskinen', 'Skylle og sette inn', 'Vaske det som må tas for hånd', 'Tørke over benken'] },
    { re: /søppel|pant/i, steps: () => ['Knyte igjen posen', 'Sette i ny pose', 'Gå ut med den'] },
    { re: /sengetøy/i, steps: () => ['Ta av det gamle', 'Finne fram rent sengetøy', 'Legge på laken, dyne- og putetrekk', 'Legge det gamle i vasken'] },
    { re: /medisin|tablett|resept|vitamin/i, steps: () => ['Finn fram medisinen', 'Ta den med et glass vann', 'Huk av her'] },
    { re: /ring|telefon/i, steps: () => ['Finn fram nummeret', 'Skriv ned 2 punkter du vil si', 'Ring', 'Noter svaret eller avtalen'] },
    { re: /e-?post|mail|melding|svar/i, steps: () => ['Åpne innboksen', 'Velg den ene meldingen som haster mest', 'Skriv et kort svar (3 setninger holder)', 'Send, og lukk innboksen'] },
    { re: /middag|frokost|lunsj|matpakke|lage mat|koke|bake/i, steps: () => ['Bestem hva du skal lage', 'Finn fram ingredienser', 'Lag maten', 'Spis', 'Sett inn i oppvaskmaskinen'] },
    { re: /handle|butikk|kjøp/i, steps: () => ['Skriv en kort handleliste', 'Finn fram poser og betalingskort', 'Dra til butikken', 'Pakk ut når du kommer hjem'] },
    { re: /rydd|støvsug|vask|tørk|kjøkken|bad|gulv|vindu/i, steps: () => ['Sett på musikk eller en podkast', 'Sett timer på 10 minutter', 'Start med det som er mest synlig', 'Fortsett til timeren ringer', 'Se hva som er gjort, og feir litt'] },
    { re: /trene|trening|gå en tur|tur|løpe|jogge|sykle|svømme/i, steps: () => ['Skift til treningstøy (bare det)', 'Fyll vannflaske', 'Gå ut døra', 'Gjør 10 minutter, resten er bonus'] },
    { re: /dusj|tannlege|pusse tenner|hår/i, steps: () => ['Finn fram det du trenger', 'Sett timer på 10 minutter', 'Gjør det', 'Huk av'] },
    { re: /legge meg|sove|søvn/i, steps: () => ['Sett alarm 30 min før leggetid', 'Mobil til lading utenfor soverommet', 'Pusse tenner', 'Lys av'] },
    { re: /les|pensum|studer|oppgave|skriv|rapport|notat/i, steps: () => ['Finn fram det du trenger og lukk andre faner', 'Sett timer på 15 minutter', 'Skriv eller les den første lille delen', 'Noter hvor du slapp', 'Ta en kort pause'] },
    { re: /regning|betal|nettbank|søknad|skjema|bestill|avtale|time hos|faktura/i, steps: () => ['Finn fram innlogging og det du trenger', 'Gjør bare første steg (åpne siden)', 'Fyll inn eller betal', 'Bekreft at det gikk gjennom'] },
    { re: /hund|katt|dyr|fôr|kattesand|lufte/i, steps: () => ['Finn fram det du trenger', 'Gjør det sammen med dyret', 'Rydd bort etterpå', 'Kos litt som belønning'] }
  ];
  function localBreakDown(title) {
    const example = PLStore.findExample(title);
    if (example) return [...example.steps];
    const hit = LOCAL_STEPS.find((x) => x.re.test(title));
    if (hit) return hit.steps(title);
    return ['Finn fram det du trenger', 'Sett timer på 5 minutter og gjør den første, enkleste delen', 'Fortsett til du er ferdig eller timeren ringer', 'Avslutt eller rydd opp etter deg', 'Huk av og feir 🎉'];
  }
  function localKickstart(title, steps) {
    const first = steps && steps.length ? steps[0] : 'den aller minste delen';
    return `${pick(['Sett timer på 2 minutter', 'Bare 2 minutter', 'Prøv 2 minutter'])} og gjør kun dette: ${first}. Du trenger ikke fortsette etterpå. ${pick(['Å begynne er hele jobben.', 'Det trenger ikke bli bra, bare gjort.', 'Kroppen først, motivasjonen kommer etter.', 'Ett steg. Det er alt.'])}`;
  }
  function localPlanDay(tasks, occurrences, dayEnd) {
    const S = PLStore;
    const now = S.minutesOf(S.hm());
    const end = S.minutesOf(dayEnd || '23:00');
    const busy = occurrences.filter((o) => !o.done).map((o) => [o.start, o.end]);
    const dur = { low: 15, medium: 25, high: 45 };
    const rank = { low: 0, medium: 1, high: 2 };
    const morning = now < 12 * 60;
    const sorted = [...tasks].sort((a, b) => (morning ? rank[b.energy] - rank[a.energy] : rank[a.energy] - rank[b.energy]));
    let t = Math.ceil((now + 5) / 5) * 5;
    const plan = [];
    sorted.forEach((task) => {
      const d = dur[task.energy] || 25;
      let guard = 0;
      while (guard++ < 200) {
        const clash = busy.find(([s, e]) => t < e && t + d > s);
        if (!clash) break;
        t = clash[1] + 5;
      }
      if (t + d > end) return;
      plan.push({ id: task.id, time: S.minToHm(t), duration: d, why: morning ? 'krevende ting mens energien er høy' : 'lett start gir fremdrift' });
      t += d + 5;
    });
    return plan;
  }

  // ---------- Offentlige funksjoner: bruker AI hvis mulig, ellers innebygd ----------
  async function breakDown(title, notes) {
    if (!enabled()) return { steps: localBreakDown(title), local: true };
    try {
      const text = await chat([{ role: 'user', content: `Bryt ned oppgaven "${title}"${notes ? ' (' + notes + ')' : ''} i 3–7 små, konkrete steg som hver tar under 10 minutter. Første steg skal være så lett at det nesten er umulig å ikke gjøre det. Svar som JSON-liste av strenger.` }], { json: true });
      const arr = parseJson(text);
      const steps = (Array.isArray(arr) ? arr : arr.steps || []).map((s) => (typeof s === 'string' ? s : s.title || s.step || String(s))).filter(Boolean).slice(0, 10);
      if (!steps.length) throw new Error('Tomt forslag');
      return { steps, local: false };
    } catch (e) { return { steps: localBreakDown(title), local: true, error: e.message }; }
  }

  async function kickstart(title, steps) {
    if (!enabled()) return { text: localKickstart(title, steps), local: true };
    try {
      const text = await chat([{ role: 'user', content: `Jeg sliter med å komme i gang med "${title}"${steps && steps.length ? ' (steg: ' + steps.join(', ') + ')' : ''}. Gi meg ett mikro-steg jeg kan gjøre på under 2 minutter, og én kort, konkret setning som hjelper meg i gang. Maks 40 ord totalt.` }]);
      return { text: text.trim(), local: false };
    } catch (e) { return { text: localKickstart(title, steps), local: true, error: e.message }; }
  }

  async function planDay(tasks, occurrences, dayEnd) {
    if (!enabled()) return { plan: localPlanDay(tasks, occurrences, dayEnd), local: true };
    try {
      const now = PLStore.hm();
      const busy = occurrences.filter((o) => !o.done).map((o) => `${o.ev.time}–${PLStore.minToHm(o.end)} ${o.ev.title}`).join('; ') || 'ingen';
      const list = tasks.map((t) => `${t.id}: ${t.title} (energi: ${t.energy})`).join('\n');
      const text = await chat([{ role: 'user', content: `Klokka er ${now}. Dagen varer til ${dayEnd}. Opptatt: ${busy}.
Oppgaver som skal gjøres i dag:
${list}
Lag en realistisk rekkefølge med starttid og varighet i minutter for hver oppgave, med små pauser innimellom og uten å overlappe de opptatte tidene. Start ikke før ${now}. Legg de mest krevende først hvis det er tidlig på dagen, ellers de letteste først. Svar som JSON-liste: [{"id":"…","time":"HH:MM","duration":25,"why":"kort begrunnelse"}].` }], { json: true });
      const arr = parseJson(text);
      const plan = Array.isArray(arr) ? arr : arr.plan || [];
      if (!plan.length) throw new Error('Tomt forslag');
      return { plan, local: false };
    } catch (e) { return { plan: localPlanDay(tasks, occurrences, dayEnd), local: true, error: e.message }; }
  }

  return { chat, breakDown, kickstart, planDay, cfg, enabled, PRESETS };
})();
