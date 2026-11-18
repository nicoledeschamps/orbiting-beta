/* Orbit voice: the speaking star. A star at the bottom-left of the four places is how you ask orbit for something.
   Tap it and speak (or press / and type); tap it again when you're done. Your words show small under orbit's line so
   you can check them, and nothing runs until you press go. Orbit answers in one short line in its own voice, with at
   most three next steps; the details (why only 6, what was left out) stay folded behind "why?".
   Looking around (moving between places, finding someone, searching the Ether, playing a song) runs straight away
   and back undoes a move. Changes (saving a picture, orbiting someone) always ask first, with save / not now.
   People are found the way friend search finds them, so blocked people never show up, and nobody is guessed.
   Calm on purpose: text only, nothing pulses or flashes (see the motion-safety plan). */
(() => {
  const nav = document.getElementById('orbitPageNav');
  const V = window.OrbitVoiceIntent;
  if (!nav || !V) return;

  const PLACE_DEPTH = { orbit: 0, friends: 1, wander: 2, ether: 3 };
  const NAMES = { 0: 'your orbit', 1: 'friends', 2: 'wander', 3: 'the ether' };
  const byId = (id) => document.getElementById(id);
  const account = () => window.OrbitingAccount;
  const friendOpen = () => { const dialog = byId('followedOrbit'); return Boolean(dialog && !dialog.hidden); };
  const visible = (node) => Boolean(node && node.isConnected && !node.hidden && !node.closest('[hidden]') && node.getClientRects().length);
  const STAR_PATH = 'M12 0C12.9 6.6 17.4 11.1 24 12C17.4 12.9 12.9 17.4 12 24C11.1 17.4 6.6 12.9 0 12C6.6 11.1 11.1 6.6 12 0Z';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function button(label, onClick, className = 'orbit-voice__button') {
    const node = el('button', className, label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  // ---------- The star and its bubble ----------
  const star = el('button', 'ask-star');
  star.type = 'button';
  star.id = 'askStar';
  star.setAttribute('aria-expanded', 'false');
  star.setAttribute('aria-controls', 'orbitVoice');
  star.setAttribute('aria-label', 'ask orbit');
  star.title = 'ask orbit (or press /)';
  star.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;

  const panel = el('section', 'orbit-voice');
  panel.id = 'orbitVoice';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'ask orbit');
  const close = button('×', () => hide(), 'orbit-voice__close');
  close.setAttribute('aria-label', 'close');
  // Orbit's line, in its own voice.
  const status = el('p', 'orbit-voice__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  // Your words: shown small; tap them (or "change") to edit before go.
  const heard = button('', () => typeMode(heard.textContent), 'orbit-voice__heard');
  heard.hidden = true;
  heard.setAttribute('aria-label', 'your words, tap to change them');
  const form = el('form', 'orbit-voice__form');
  form.hidden = true;
  const label = el('label', 'orbit-voice__label', 'ask orbit');
  label.htmlFor = 'orbitVoiceWords';
  const input = el('input', 'orbit-voice__words');
  input.id = 'orbitVoiceWords';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 300;
  input.placeholder = 'ask orbit…';
  const go = el('button', 'orbit-voice__go', 'go');
  go.type = 'submit';
  form.append(label, input, go);
  const area = el('div', 'orbit-voice__area');
  const more = el('ul', 'orbit-voice__notes');
  more.hidden = true;
  panel.append(close, status, heard, form, area, more);
  document.body.append(star, panel);

  // On phones an open picture (the Ether's card, Wander's photo view, a ring photo) fills the lower screen, so the star
  // and its bubble move up under the heading instead of covering it, and come back down when it closes.
  const narrow = matchMedia('(max-width: 680px)');
  const COVERS = ['#etherDriftCard', '#exploreDetail .explore-detail__card', '.photo-crate'];
  function fit() {
    const high = narrow.matches && COVERS.some((selector) => visible(document.querySelector(selector)));
    star.classList.toggle('is-high', high);
    panel.classList.toggle('is-high', high);
  }
  let fitting = 0;
  const refit = () => { cancelAnimationFrame(fitting); fitting = requestAnimationFrame(fit); };
  new MutationObserver(refit).observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  ['etherDriftCard', 'exploreDetail'].forEach((id) => { const node = byId(id); if (node) new MutationObserver(refit).observe(node, { attributes: true, attributeFilter: ['hidden', 'class'] }); });
  new MutationObserver(refit).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', refit);

  let depth = 0;
  let job = 0;
  const trail = [];
  window.addEventListener('orbiting:depth-changed', (event) => { depth = Math.round(Number(event.detail?.depth) || 0); });

  // The star rests while setup or settings is open (the setup guide star lives there).
  const setup = byId('orbitSetup');
  function rest() {
    const away = setup && setup.getAttribute('aria-hidden') === 'false';
    star.hidden = Boolean(away);
    if (away && !panel.hidden) hide(false);
  }
  if (setup) new MutationObserver(rest).observe(setup, { attributes: true, attributeFilter: ['aria-hidden'] });
  rest();

  const say = (text) => { status.textContent = text; };
  function clearArea() { area.replaceChildren(); more.replaceChildren(); more.hidden = true; }
  function showHeard(words) { heard.textContent = words || ''; heard.hidden = !words; heard.classList.remove('is-hint'); }
  // Up to three quiet next steps, as words you can tap.
  function links(list) {
    const row = el('div', 'orbit-voice__links');
    list.filter(Boolean).slice(0, 3).forEach(([text, onClick]) => row.append(button(text, onClick, 'orbit-voice__link')));
    area.replaceChildren(row);
  }

  function open() {
    panel.hidden = false;
    star.setAttribute('aria-expanded', 'true');
    star.classList.add('is-open');
  }
  function typeMode(words = '') {
    stopListening(false);
    open();
    form.hidden = false;
    showHeard('');
    if (!status.textContent) say('what would you like?');
    input.value = words;
    input.focus();
    input.select();
  }
  function show() {
    open();
    clearArea();
    if (canSpeak) startListening();
    else { say('what would you like?'); typeMode(); }
  }
  function hide(focusStar = true) {
    stopListening(false);
    ++job;
    panel.hidden = true;
    form.hidden = true;
    star.setAttribute('aria-expanded', 'false');
    star.classList.remove('is-open', 'is-listening');
    say('');
    showHeard('');
    clearArea();
    if (focusStar && !star.hidden) star.focus({ preventScroll: true });
  }
  star.addEventListener('click', () => {
    if (recorder) { stopListening(true); return; }
    if (panel.hidden && !introSeen()) { intro(); return; }
    if (panel.hidden) show();
    else if (canSpeak) { clearArea(); form.hidden = true; startListening(); }
    else typeMode();
  });
  // Escape closes only the bubble (not a friend's orbit under it), so it listens first.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) { event.stopImmediatePropagation(); hide(); return; }
    const typing = /^(?:INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '') || event.target?.isContentEditable;
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey && !star.hidden && panel.hidden) { event.preventDefault(); typeMode(); }
  }, true);

  // ---------- Speaking ----------
  // One short recording at a time, after the browser asks for the microphone. The recording stays in memory only,
  // goes to Orbit's server once, and is dropped as soon as the words come back (or straight away if you cancel).
  const canSpeak = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const MOST_SECONDS = 15;
  let recorder = null, stream = null, chunks = [], stopTimer = null, keepRecording = false;
  function audioType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return types.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || '';
  }
  function stopListening(keep) {
    clearTimeout(stopTimer);
    keepRecording = keep;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else release();
  }
  function release() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
    star.classList.remove('is-listening');
    star.setAttribute('aria-label', 'ask orbit');
  }
  async function startListening() {
    const mine = ++job;
    showHeard('');
    form.hidden = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      say(error?.name === 'NotAllowedError' ? 'i need the microphone for that. you can type instead.' : 'no microphone found. you can type instead.');
      typeMode();
      return;
    }
    if (mine !== job || panel.hidden) { release(); return; }
    const type = audioType();
    recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    chunks = [];
    recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) chunks.push(event.data); });
    recorder.addEventListener('stop', async () => {
      const keep = keepRecording;
      let audio = keep && chunks.length ? new Blob(chunks, { type: recorder?.mimeType || type || 'audio/webm' }) : null;
      release();
      if (!audio) return;
      const mineToo = ++job;
      say('one moment…');
      try {
        const answer = await account().transcribeVoice(audio);
        if (mineToo !== job) return;
        const words = String(answer?.words || '').trim();
        if (!words) { say('i didn’t catch that. tap the star and try again.'); return; }
        say('is that right?');
        showHeard(words);
        input.value = words;
        area.replaceChildren(confirmRow('go', () => run(words), 'change', () => typeMode(words)));
      } catch (error) {
        if (mineToo === job) say(error?.message || 'orbit couldn’t hear that. try again, or type it.');
      } finally {
        audio = null;  // the recording isn't kept anywhere
      }
    });
    recorder.start();
    star.classList.add('is-listening');
    star.setAttribute('aria-label', 'stop listening');
    say('i’m listening… tap me when you’re done');
    showHeard(`try “${hintsHere()[0]}” or “${hintsHere()[1]}”`);
    heard.classList.add('is-hint');
    links([['type instead', () => typeMode()], ['what can you do?', () => { stopListening(false); showHelp(); }]]);
    stopTimer = setTimeout(() => stopListening(true), MOST_SECONDS * 1000);
  }

  function confirmRow(yesText, onYes, noText, onNo) {
    const row = el('div', 'orbit-voice__row');
    const yes = button(yesText, onYes, 'orbit-voice__button is-yes');
    const no = button(noText, onNo);
    row.append(yes, no);
    return row;
  }

  // ---------- Reading the words ----------
  form.addEventListener('submit', (event) => { event.preventDefault(); run(input.value); });

  // What's on screen, so "save this" or "play it" can be read in context (sent to Claude only with the words).
  function context() {
    return { place: NAMES[depth] || 'your orbit', photo_open: Boolean(openItem()), song_on_screen: Boolean(songButton()), searching: Boolean(search) };
  }

  async function run(text) {
    const words = String(text || '').trim();
    const mine = ++job;
    form.hidden = true;
    clearArea();
    if (!words) { typeMode(); return; }
    showHeard(words);
    let { actions, understood } = V.readCommand(words);
    if (!understood) {
      say('one moment…');
      try {
        const answer = await account()?.readVoiceCommand?.(words, context());
        if (mine !== job) return;
        actions = V.checkActions(answer?.actions);
      } catch (error) {
        if (mine !== job) return;
        actions = [];
        if (!/sign in/i.test(error?.message || '')) console.warn('[ask orbit]', error?.message || error);
      }
    }
    if (!actions.length) {
      say('i’m not sure what you mean.');
      links([[hintsHere()[0], () => run(hintsHere()[0])], ['what can you do?', () => showHelp()], ['type it', () => typeMode(words)]]);
      return;
    }
    for (const action of actions) {
      if (mine !== job) return;
      const keepGoing = await perform(action, mine);
      if (!keepGoing) return;
    }
  }

  // ---------- Doing it ----------
  const glide = (stop) => window.dispatchEvent(new CustomEvent('orbiting:glide-depth', { detail: stop }));

  async function perform(action, mine) {
    switch (action.type) {
      case 'go_to': return goTo(action.place);
      case 'back': return depth === 3 && !friendOpen() ? etherMove('back') : goBack();
      case 'ether_tune': return etherTune(action.words);
      case 'ether_shape': return etherShape(action.words);
      case 'ether_move': return etherMove(action.words);
      case 'open_tune': return openTune();
      case 'refresh': return refresh();
      case 'show_help': return showHelp();
      case 'find_help': return findHelp(action.words);
      case 'open_profile': return openPerson(action.person, mine);
      case 'follow':
      case 'unfollow': return changeFollow(action, mine);
      case 'ether_search': return etherSearch(action.words, mine);
      case 'ether_refine': return etherRefine(action.words, mine);
      case 'save_item': return saveItem();
      case 'play_song': return playSong(true);
      case 'stop_song': return playSong(false);
      default: return false;
    }
  }

  function goTo(place) {
    if (place in PLACE_DEPTH) {
      if (friendOpen()) byId('closeFollowedOrbit')?.click();
      trail.push({ depth });
      glide(PLACE_DEPTH[place]);
      say(`here’s ${NAMES[PLACE_DEPTH[place]]}.`);
      links(place === 'ether' ? [['tune to red', () => run('tune to red')], ['go deeper', () => run('go deeper')], ['back', placeBack]] : [['back', placeBack]]);
      return true;
    }
    if (place === 'settings') {
      if (!window.OrbitSetup?.openSettings) { say('settings open after you sign in.'); return false; }
      hide(false);
      window.OrbitSetup.openSettings('all');
      return false;
    }
    if (place === 'help') { hide(false); byId('openOrbitGuide')?.click(); return false; }
    if (place === 'notifications') {
      const openIt = byId('openOrbitNotifications');
      if (!openIt || openIt.hidden) { say('notifications show once you’re signed in.'); return false; }
      hide(false);
      openIt.click();
      return false;
    }
    return false;
  }

  function goBack() {
    if (window.OrbitGuide?.isOpen?.()) { window.OrbitGuide.close(); say('closed how it works.'); return true; }
    if (friendOpen()) { byId('closeFollowedOrbit')?.click(); say('left their orbit.'); return true; }
    const last = trail.pop();
    if (!last) { say('nothing to go back to yet.'); return true; }
    glide(last.depth);
    say(`back to ${NAMES[last.depth]}.`);
    return true;
  }

  // ---------- The Ether's own controls ----------
  const placeBack = () => { const mine = ++job; clearArea(); showHeard('back'); goBack(); return mine; };
  function inEther() {
    if (depth === 3) return true;
    trail.push({ depth });
    glide(3);
    return true;
  }
  const lower = (text) => String(text || '').toLowerCase().trim();
  // "red", "the 1920s", "nasa", "maps", "red from the met": colour, time and source are picked as the panel picks them;
  // anything else becomes Tune's words. Nothing is searched.
  const ERA_WORDS = [
    [/\b(?:before 1800|1700s|18th century|17th century|old(?:est)?)\b/, 'before 1800'], [/\b(?:1800s|19th century)\b/, '1800s'],
    [/\b(?:1900s|1910s|1900[–-]1919)\b/, '1900–1919'], [/\b(?:1920s|twenties|20s)\b/, '1920s'],
    [/\b(?:1930s|1940s|thirties|forties|30s|40s)\b/, '1930s–40s'], [/\b(?:1960s|1970s|sixties|seventies|60s|70s)\b/, '60s–70s']
  ];
  function readTune(words) {
    let rest = ` ${lower(words).replace(/\bcolou?r\b/g, ' ')} `;
    const change = {};
    const colours = (window.ImageColor?.COLORS || []).map((c) => c.name);
    const alias = { purple: 'violet', gray: 'grey', crimson: 'red', scarlet: 'red', turquoise: 'teal', gold: 'amber', golden: 'amber' };
    const colour = colours.find((name) => new RegExp(`\\b${name}\\b`).test(rest)) || Object.keys(alias).find((w) => new RegExp(`\\b${w}\\b`).test(rest));
    if (colour) { change.color = alias[colour] || colour; rest = rest.replace(new RegExp(`\\b${colour}\\b`), ' '); }
    for (const [pattern, era] of ERA_WORDS) if (pattern.test(rest)) { change.era = era; rest = rest.replace(pattern, ' '); break; }
    const sources = (window.EtherSources?.FROM || []).filter((name) => name !== 'everywhere');
    const plainSource = (name) => lower(name).replace(/^the\s+/, '').replace(/\s+(?:museum of art|collection|copenhagen)$/, '');
    const source = sources.find((name) => rest.includes(` ${plainSource(name)} `) || rest.includes(` ${lower(name)} `)) || (/\b(?:friends|people|orbits)\b/.test(rest) ? 'other orbits' : '');
    if (source) { change.from = source; rest = rest.replace(lower(source), ' ').replace(plainSource(source), ' '); }
    if (/\beverywhere\b|\ball sources\b/.test(rest)) { change.from = 'everywhere'; rest = rest.replace(/\beverywhere\b|\ball sources\b/, ' '); }
    rest = rest.replace(/\b(?:the|to|a|an|from|only|just|images?|pictures?|things|stuff|ones?|of|in|with|and|ether|please|time|era|source|period)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (rest) change.query = rest.slice(0, 60);
    return change;
  }
  async function etherTune(words) {
    if (!window.EtherTune) { say('the ether isn’t ready yet. try again in a moment.'); return false; }
    inEther();
    search = null;
    if (words === 'clear') { await window.EtherTune.clear(); say('the whole ether again.'); links([['tune to red', () => run('tune to red')], ['go deeper', () => run('go deeper')]]); return true; }
    const change = readTune(words);
    if (!Object.keys(change).length) { openTune(); return false; }
    const said = window.EtherSources?.describe({ ...window.EtherTune.current(), ...change }) || words;
    say(`tuning to ${said}…`);
    window.EtherTune.change(change);
    say(`tuned to ${said}.`);
    links([['clear the tune', () => run('clear the tune')], change.color ? ['another colour', () => openTune()] : ['open tune', () => openTune()]]);
    return true;
  }
  function openTune() {
    inEther();
    hide(false);
    window.EtherTune?.openPanel();
    return false;
  }
  function etherShape(shape) {
    inEther();
    const pill = document.querySelector(`#etherShape [data-shape="${shape}"]`);
    if (!pill) { say('that shape isn’t here.'); return false; }
    pill.click();
    say(`the ether as a ${shape}.`);
    links(['drift', 'horizon', 'well', 'planet'].filter((other) => other !== shape).slice(0, 3).map((other) => [other, () => run(other)]));
    return true;
  }
  function etherMove(way) {
    if (depth !== 3) { inEther(); say('here’s the ether.'); return true; }
    const button = byId(way === 'deeper' ? 'etherDeeper' : 'etherBack');
    if (!button) return false;
    button.click();
    say(way === 'deeper' ? 'deeper into the ether.' : 'drifting back.');
    links([[way === 'deeper' ? 'deeper again' : 'back again', () => run(way === 'deeper' ? 'go deeper' : 'drift back')], ['leave the ether', () => run('go to wander')]]);
    return true;
  }
  function refresh() {
    const id = depth >= 2 ? 'refreshWander' : depth === 1 ? 'refreshFollowingCosmos' : 'refreshMyOrbit';
    const button = byId(id);
    if (!button || button.disabled) { say('there’s nothing to refresh here.'); return false; }
    button.click();
    say(`refreshing ${NAMES[depth] || 'your orbit'}.`);
    return true;
  }

  // ---------- Saying what it can do ----------
  const HINTS = {
    0: ['take me to the ether', 'refresh my orbit', 'find sam'],
    1: ['find sam', 'open @yourname', 'take me to wander'],
    2: ['save this', 'play the song', 'take me to the ether'],
    3: ['tune to red', 'go deeper', 'horizon']
  };
  const hintsHere = () => HINTS[depth] || HINTS[0];
  function showHelp() {
    say('i’m orbit’s star. tap me and say what you’d like.');
    const list = el('ul', 'orbit-voice__notes');
    ['move: “take me to the ether”, “back”', 'people: “find sam”, “open @yourname”', 'the ether: “tune to red”, “horizon”, “go deeper”, “search red bowls from the 1700s”',
      'pictures: “save this”, “play the song”', 'finding things: “how do i connect my agent?”'].forEach((line) => list.append(el('li', '', line)));
    list.hidden = false;
    area.replaceChildren(list);
    return false;
  }
  // "how do i…": one line on where it lives, and "take me there" opens that spot (settings rows, or the guide star
  // for anything with steps). Nothing changes until they press it.
  const account_ = () => window.OrbitSetup;
  const inSettings = (spot) => () => account_()?.openAccount?.(spot);
  const inStep = (step, spot, after) => () => { account_()?.openStep?.(step, spot); after?.(); };
  const guided = (task) => () => window.OrbitStar?.open?.(task);
  const openBox = () => { const box = byId('sourceAccordion'); if (box) box.open = true; };
  const FIND = {
    agents: ['your agents live in settings, under agents. that’s where you connect claude or another assistant.', inSettings('agentSettingsGroup')],
    download: ['download my orbit is in settings, under agents.', inSettings('exportSettingsGroup')],
    username: ['your name and username are in settings, under you. the guide star can walk you through it.', guided('username')],
    email: ['email and password are in settings, under you.', inSettings('settingsEmail')],
    account_type: ['personal or business is in settings, under you.', inSettings('accountTypeSlot')],
    blocked: ['blocked people are in settings, under you. you can unblock anyone there.', inSettings('blockedSettingsGroup')],
    notifications: ['notifications open from the word notifications at the top.', () => byId('openOrbitNotifications')?.click(), () => { const b = byId('openOrbitNotifications'); return b && !b.hidden; }],
    source: ['sources live in cultivate, under sources. the guide star can add one with you.', guided('source')],
    photos: ['your own photos go in cultivate, under sources, in my photos.', inStep(1, 'photosSourceButton', () => {
      openBox();
      const photos = byId('photosSourceButton');
      if (photos?.getAttribute('aria-expanded') === 'false') photos.click();
    })],
    face: ['your face is in cultivate, under you at the centre. the guide star can help.', guided('face')],
    ring: ['rings are named and arranged in cultivate. the guide star can walk you through it.', guided('ring')],
    sky: ['your night sky is in cultivate, under sky + stars.', guided('sky')],
    mood: ['mood orbits are made in cultivate, under mood orbits.', inStep(1, 'moodName')],
    guide: ['how it works shows the big picture, one scroll.', () => byId('openOrbitGuide')?.click(), () => Boolean(byId('openOrbitGuide'))],
    feedback: ['send feedback is in settings, under help. it goes straight to us.', () => byId('openOrbitFeedback')?.click(), () => { const b = byId('openOrbitFeedback'); return b && !b.hidden; }],
    test: ['help test orbit is in settings, under help: a short checklist.', () => window.OrbitTestWalk?.start?.(), () => Boolean(window.OrbitTestWalk?.start)]
  };
  function findHelp(topic) {
    const found = FIND[topic];
    if (!found) { say('i don’t know where that is yet.'); links([['what can you do?', () => showHelp()]]); return false; }
    const [line, go, ready = () => Boolean(account_()?.signedIn?.())] = found;
    say(line);
    if (!ready()) { area.replaceChildren(el('p', 'orbit-voice__notes', 'it opens once you’re signed in.')); return false; }
    area.replaceChildren(confirmRow('take me there', () => { hide(false); go(); }, 'not now', () => hide()));
    return false;
  }
  // The very first tap says what the star is before it listens.
  const INTRO_KEY = 'orbit:star-intro-v1';
  const introSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (_) { return true; } };
  function intro() {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (_) { /* storage blocked: it shows again next time */ }
    open();
    clearArea();
    showHeard('');
    say('i’m orbit’s star. tap me, say what you’d like, then tap me again.');
    const list = el('ul', 'orbit-voice__notes');
    hintsHere().forEach((line) => list.append(el('li', '', `“${line}”`)));
    list.hidden = false;
    area.replaceChildren(list, confirmRow(canSpeak ? 'start talking' : 'start typing', () => (canSpeak ? startListening() : typeMode()), canSpeak ? 'type instead' : 'not now', () => (canSpeak ? typeMode() : hide())));
  }

  // ---------- Saving and songs ----------
  // The picture that's open: the Ether's card, or Wander's (and the Ether planet's) photo view.
  function openItem() {
    const etherAdd = byId('etherDriftAdd');
    if (visible(byId('etherDriftCard')) && visible(etherAdd)) return { add: etherAdd, title: byId('etherDriftTitle')?.textContent?.trim() || '' };
    const exploreAdd = byId('exploreAddToOrbit');
    if (visible(byId('exploreDetail')) && visible(exploreAdd)) return { add: exploreAdd, title: byId('exploreDetailTitle')?.textContent?.trim() || '' };
    return null;
  }
  function saveItem() {
    const item = openItem();
    if (!item) {
      say('open a picture first, then say “save this”.');
      return false;
    }
    if (item.add.disabled) { say('that one is already in your orbit.'); return false; }
    const name = item.title ? `“${item.title.slice(0, 60)}”` : 'this';
    say(`save ${name} to your orbit?`);
    area.replaceChildren(confirmRow('save', () => {
      if (!visible(item.add)) { say('that picture closed. open it again, then say “save this”.'); clearArea(); return; }
      item.add.click();
      say('saved to your orbit.');
      clearArea();
    }, 'not now', () => { say('nothing changed.'); clearArea(); }));
    return false;
  }
  // The song pinned to what's open (a ring photo, a friend's photo, Wander's photo view).
  function songButton() {
    return [...document.querySelectorAll('.song-preview__play')].find(visible) || null;
  }
  function playSong(start) {
    const play = songButton();
    if (!play) { say(start ? 'there’s no song on what’s open. open a photo with a song first.' : 'nothing is playing.'); return false; }
    const playing = play.getAttribute('aria-label') === 'Pause the preview';
    if (start !== playing) play.click();
    say(start ? 'playing the song.' : 'stopped the song.');
    links([start ? ['stop', () => run('stop the song')] : ['play it again', () => run('play the song')]]);
    return true;
  }

  // ---------- People ----------
  async function findPerson(person) {
    const api = account();
    const session = api?.getSession ? await api.getSession().catch(() => null) : null;
    if (!session) return { signedOut: true };
    // Friends with the names on their planets (what you see on Friends); usernames alone if those are slow to load.
    const plainFriends = () => api.listFollowing().catch(() => []);
    const named = window.OrbitingFriends?.names
      ? Promise.race([window.OrbitingFriends.names().catch(() => null), new Promise((done) => setTimeout(() => done(null), 5000))])
      : Promise.resolve(null);
    const friends = (await named) || await plainFriends();
    const found = [];
    for (const term of V.searchTerms(person)) {
      const people = await api.searchPeople(term).catch(() => []);
      found.push(...people);
    }
    return { ...V.choosePerson(person, friends, found), friends };
  }
  function nobody(person) {
    say(`i can’t find ${person.replace(/^@?/, '@')}. try their username.`);
  }
  async function openPerson(person, mine) {
    say('looking…');
    const result = await findPerson(person);
    if (mine !== job) return false;
    if (result.signedOut) { say('sign in to find people.'); return false; }
    if (result.none) { nobody(person); return false; }
    if (result.choices) { offerChoices(result.choices, (who) => enterOrbit(who)); return false; }
    enterOrbit(result.pick);
    return true;
  }
  function offerChoices(people, choose) {
    say(`${people.length} people match. which one?`);
    const list = el('ul', 'orbit-voice__choices');
    people.forEach((who) => {
      const item = el('li');
      const pick = button('', () => choose(who), 'orbit-voice__choice');
      pick.append(el('span', 'orbit-voice__handle', `@${who.username}`));
      if (who.display_name) pick.append(el('span', 'orbit-voice__name', who.display_name));
      if (who.friend) pick.append(el('span', 'orbit-voice__tag', 'you orbit them'));
      item.append(pick);
      list.append(item);
    });
    area.replaceChildren(list);
  }
  // A friend opens their orbit; anyone else opens as the public preview (only what they share with everyone).
  function enterOrbit(who) {
    trail.push({ depth });
    if (depth !== 1) glide(1);
    const preview = who.friend ? null : { username: who.username };
    const opened = () => window.OrbitingFriends?.open(who.user_id, preview);
    if (!opened()) {
      const later = () => { window.removeEventListener('orbiting:friends-rendered', later); opened(); };
      window.addEventListener('orbiting:friends-rendered', later);
    }
    say(`here’s @${who.username}’s orbit${who.friend ? '' : ', what they share with everyone'}.`);
    links([['back', placeBack]]);
  }

  // ---------- Searching the Ether by what things are ----------
  // The last search, so "only bowls" or "older" can change one filter and keep the rest.
  let search = null;
  const F = () => window.EtherFacets;
  const facetCount = (facets) => ['type', 'material', 'colour'].filter((key) => facets[key]).length + (facets.years ? 1 : 0);
  const plural = (type) => (!type ? 'pieces' : /(?:sh|ch|s|x)$/.test(type) ? `${type}es` : `${type}s`);
  // " from the 18th century", " from the 1700s", " from 1700–1774", " from before 1800".
  function when(facets) {
    const label = facets.years?.label;
    if (!label) return '';
    const the = /century/.test(label) || /^\d{3,4}s$/.test(label) ? 'the ' : '';
    return ` from ${the}${label}`;
  }
  function phrase(facets, count = 2) {
    const thing = count === 1 ? (facets.type || 'piece') : plural(facets.type);
    return `${[facets.colour, facets.material, thing].filter(Boolean).join(' ')}${when(facets)}`;
  }

  async function etherSearch(words, mine) {
    if (!F() || !window.EtherSearch) { say('the ether isn’t ready yet. try again in a moment.'); return false; }
    const facets = F().readFacets(words);
    if (depth !== 3) { trail.push({ depth }); glide(3); }
    // Plain words with nothing to filter on tune the Ether the way typing them in tune does.
    if (!facetCount(facets)) {
      search = null;
      window.EtherTune?.words(facets.words || words);
      say(`tuned the ether to “${facets.words || words}”.`);
      return true;
    }
    return runSearch(facets, mine);
  }

  async function runSearch(facets, mine, { showMaybe = false } = {}) {
    say('looking through the collections…');
    clearArea();
    let result;
    try { result = await window.EtherSearch.find(facets); }
    catch (error) { if (mine === job) say('the collections didn’t answer. try again in a moment.'); return false; }
    if (mine !== job) return false;
    search = { facets, result };
    const shown = showMaybe ? [...result.matches, ...result.maybe.map((entry) => entry.record)] : result.matches;
    if (shown.length) window.EtherTune?.showFound(window.EtherSearch.toItems(shown), phrase(facets));
    renderResult(result, showMaybe);
    return true;
  }

  // The honest details, folded behind "why?": what each collection gave and what couldn't be checked.
  function details(result) {
    const { facets, unknown, unknownBySource, partly, sources } = result;
    const lines = [Object.entries(sources).map(([name, info]) => info.failed ? `${name} didn’t answer` : `${name} ${info.matched || 0}`).join(' · ')];
    const names = (key) => Object.keys(unknownBySource[key] || {}).join(' and ');
    if (facets.colour && unknown.colour) lines.push(`${unknown.colour} couldn’t be checked for ${facets.colour}: ${names('colour')} don’t let their pictures be read.`);
    if (facets.years && unknown.years) lines.push(`${unknown.years} have no date.`);
    if (partly) lines.push(`${partly} are dated across the edge of ${facets.years.label}.`);
    if (facets.material && unknown.material) lines.push(`${unknown.material} don’t list a material.`);
    if (facets.type && unknown.type) lines.push(`${unknown.type} don’t say what kind of object they are.`);
    lines.push(`left out: ${window.EtherSearch.LEFT_OUT}, which don’t list these details.`);
    return lines;
  }
  function toggleWhy() {
    more.hidden = !more.hidden;
    if (!more.hidden && search) more.replaceChildren(...details(search.result).map((line) => el('li', '', line)));
  }

  function renderResult(result, showMaybe) {
    const { facets, matches, maybe } = result;
    const n = matches.length;
    const extra = showMaybe && maybe.length ? `, plus ${maybe.length} that may fit` : '';
    say(n ? `${n} ${phrase(facets, n)}${extra}.` : `nothing found that’s ${[facets.colour, facets.material, facets.type].filter(Boolean).join(', ') || 'like that'}${when(facets)}.`);
    const next = [];
    if (maybe.length && !showMaybe && n < 6) next.push([`${maybe.length} more may fit`, () => runSearch(facets, ++job, { showMaybe: true })]);
    if (n < 3 && facets.colour) next.push(['any colour', () => runSearch({ ...facets, colour: '' }, ++job)]);
    else if (n < 3 && facets.years && facets.years.from != null && facets.years.to != null) {
      next.push(['wider dates', () => runSearch({ ...facets, years: { from: facets.years.from - 50, to: facets.years.to + 50, label: `${facets.years.from - 50}–${facets.years.to + 50}` } }, ++job)]);
    } else if (n >= 5 && facets.years) next.push(['older ones', () => run('show me older ones')]);
    next.push([n ? `why ${n}?` : 'why?', toggleWhy]);
    links(next);
  }

  async function etherRefine(words, mine) {
    if (!search && depth === 3) return etherTune(words.replace(/^only\s+/, ''));
    if (!search) { say('search the ether first, then narrow it.'); links([['red porcelain bowls', () => run('search the ether for red porcelain bowls')]]); return false; }
    const asked = F().refine(search.facets, words);
    if (!asked) { say('i’m not sure how to change the search. try “only bowls” or “older”.'); return false; }
    if (asked.older || asked.newer) {
      const range = F().olderRange(search.result.matches, search.facets.years, Boolean(asked.newer));
      if (!range) return askWhen(asked.newer, mine);
      return runSearch({ ...search.facets, years: range }, mine);
    }
    return runSearch(asked.facets, mine);
  }
  // Too few dated results to say what "older" means here: ask instead of guessing.
  function askWhen(newer) {
    const years = search.facets.years;
    const edge = newer ? (years?.to ?? 1900) : (years?.from ?? 1800);
    const choices = newer ? [edge, edge + 50] : [edge, edge - 100];
    say(`${newer ? 'after' : 'before'} which year?`);
    links(choices.map((year) => [`${newer ? 'after' : 'before'} ${year}`, () => {
      const range = newer ? { from: year + 1, to: null, label: `after ${year}` } : { from: null, to: year - 1, label: `before ${year}` };
      runSearch({ ...search.facets, years: range }, ++job);
    }]));
    return false;
  }

  // ---------- Orbiting someone asks first ----------
  async function changeFollow(action, mine) {
    const start = action.type === 'follow';
    say('looking…');
    const result = await findPerson(action.person);
    if (mine !== job) return false;
    if (result.signedOut) { say('sign in to orbit people.'); return false; }
    if (result.none) { nobody(action.person); return false; }
    if (result.choices) { offerChoices(result.choices, (who) => confirmFollow(who, start, result.friends)); return false; }
    confirmFollow(result.pick, start, result.friends);
    return false;
  }
  function confirmFollow(who, start, friends) {
    const already = (friends || []).some((friend) => friend.followed_user_id === who.user_id);
    if (start && already) { say(`you already orbit @${who.username}.`); clearArea(); return; }
    if (!start && !already) { say(`you don’t orbit @${who.username}.`); clearArea(); return; }
    say(start ? `orbit @${who.username}? they’ll see that you do.` : `stop orbiting @${who.username}?`);
    const row = confirmRow(start ? 'orbit' : 'stop orbiting', async () => {
      row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        if (start) await account().followPerson(who.user_id);
        else await account().unfollowPerson(who.user_id);
        const following = await account().listFollowing().catch(() => null);
        if (following) window.dispatchEvent(new CustomEvent('orbiting:following-changed', { detail: { following } }));
        say(start ? `@${who.username} is in your cosmos now.` : `you stopped orbiting @${who.username}.`);
        clearArea();
      } catch (error) {
        row.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        say(error?.message || 'that didn’t go through. try again.');
      }
    }, 'not now', () => { say('nothing changed.'); clearArea(); });
    area.replaceChildren(row);
  }

  // lastSearch lets scripts/check-ether-search.mjs see which records were shown and why.
  window.OrbitVoice = { open: () => typeMode(), listen: show, close: hide, run, lastSearch: () => search, intro };
})();
