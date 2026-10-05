/* Populate followed planets from the server-filtered, everyone-visible orbit. */
(() => {
  const sky = document.getElementById('followingCosmos');
  const planets = document.getElementById('followingPlanets');
  const status = document.getElementById('followingCosmosStatus');
  const refresh = document.getElementById('refreshFollowingCosmos');
  const dialog = document.getElementById('followedOrbit');
  const world = document.getElementById('followedOrbitPlanet');
  const title = document.getElementById('followedOrbitTitle');
  const nameLine = document.getElementById('followedOrbitName');
  const bioLine = document.getElementById('followedOrbitBio');
  const worldStatus = document.getElementById('followedOrbitStatus');
  const close = document.getElementById('closeFollowedOrbit');
  if (!sky || !window.OrbitingAccount) return;
  let sequence = 0, loaded = false, activePlanet, portalJob = 0;
  let nearTweens = [], worldTweens = [];
  const cache = new Map();
  const providers = new Set(['cosmos','arena','pinterest','spotify','instagram']);
  const kill = tweens => { tweens.forEach(tween => tween?.kill()); tweens.length = 0; };

  async function sharedOrbit(person) {
    if (cache.has(person.followed_user_id)) return cache.get(person.followed_user_id);
    const promise = (async () => {
      const orbit = await window.OrbitingAccount.loadVisibleFollowedOrbit(person.followed_user_id);
      if (!orbit) return { rings: [], failed: false };
      const sources = new Map();
      let failed = false;
      await Promise.all((orbit.sources || []).filter(source => providers.has(source.provider)).map(async source => {
        const selections = Array.isArray(source.selectedUrls) ? source.selectedUrls : [];
        const batches = selections.length ? Array.from({length: Math.ceil(selections.length / 5)}, (_, i) => selections.slice(i * 5, i * 5 + 5)) : [[]];
        const results = await Promise.allSettled(batches.map((batch, index) => window.OrbitingAccount.previewPublicSource(source.provider, source.url, batch, {
          discover: false, includeBase: index === 0 && (source.baseShared === true || !selections.length)
        })));
        failed ||= results.some(result => result.status === 'rejected');
        const seen = new Set();
        sources.set(source.provider, results.flatMap(result => result.status === 'fulfilled' ? result.value.items || [] : []).filter(item => {
          if (typeof item.src !== 'string' || !item.src.startsWith('https://') || seen.has(item.src)) return false;
          seen.add(item.src); return true;
        }));
      }));
      const t = orbit.title && typeof orbit.title === 'object' ? orbit.title : {};
      const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
      const skyTitle = { first: text(t.first, 32), second: text(t.second, 32), secondColor: /^#[0-9a-f]{6}$/i.test(t.secondColor || '') ? t.secondColor : '', bio: text(t.bio, 80) };
      let portraitSrc = '';
      if (typeof orbit.portraitPath === 'string' && window.OrbitingAccount.loadFollowedPortrait) {
        try {
          const blob = await window.OrbitingAccount.loadFollowedPortrait(person.followed_user_id, orbit.portraitPath);
          if (blob && window.URL?.createObjectURL) portraitSrc = window.URL.createObjectURL(blob);
        } catch (_) { /* fall back to the initial */ }
      }
      return { failed, portraitAsset: orbit.portraitAsset, portraitSrc, title: skyTitle, rings: (orbit.rings || []).map(ring => ({
        name: ring.words || ring.source || 'Shared ring',
        items: (ring.sources || [ring.source]).flatMap(provider => sources.get(provider) || [])
      })) };
    })();
    cache.set(person.followed_user_id, promise);
    try { return await promise; } catch (error) { cache.delete(person.followed_user_id); throw error; }
  }

  function drawOrbit(container, snapshot, person, near, tweens) {
    container.replaceChildren();
    const core = document.createElement('span');
    core.className = 'following-cosmos__core';
    const ownPortrait = typeof snapshot.portraitSrc === 'string' && snapshot.portraitSrc.startsWith('blob:');
    if (ownPortrait || (typeof snapshot.portraitAsset === 'string' && /^assets\/portraits\/[a-z0-9_-]+\.jpg$/.test(snapshot.portraitAsset))) {
      const portrait = document.createElement('img');
      portrait.src = ownPortrait ? snapshot.portraitSrc : snapshot.portraitAsset;
      if (ownPortrait) core.classList?.add('has-cutout');
      portrait.alt = `${person.username}'s portrait`;
      // A site copy may leave a supplied portrait out; fall back to the initial instead of a broken image.
      portrait.onerror = () => { core.replaceChildren(); core.textContent = person.username.slice(0, 1).toUpperCase(); };
      core.append(portrait);
    } else core.textContent = person.username.slice(0, 1).toUpperCase();
    container.append(core);
    const width = container.getBoundingClientRect().width || (near ? 64 : 240);
    // Rings without images are listed in the status text but never take an orbital path.
    const filled = snapshot.rings.filter(ring => ring.items.length);
    filled.forEach((ring, index) => {
      const back = document.createElement('span'), front = document.createElement('span');
      back.className = 'saturn-ring-back'; front.className = 'saturn-ring-front';
      container.append(back, front);
      const ratio = window.HuesOrbit?.ringRadiusRatio(index, filled.length) || .5;
      const tween = window.HuesOrbit?.buildRing(ring.items.slice(0, near ? 8 : 20), back, front, width * ratio,
        near ? [16, 22] : [34, 48], [65 + index * 20, 85 + index * 20], ring.items,
        { previewOnly: true, startAngle: index * 120 });
      if (tween) tweens.push(tween);
    });
  }

  async function enter(person, planet) {
    const job = ++portalJob;
    activePlanet = planet;
    kill(worldTweens); world.replaceChildren();
    title.textContent = `@${person.username}’s orbit`;
    worldStatus.textContent = 'Loading shared rings…';
    if (nameLine) nameLine.hidden = true;
    if (bioLine) bioLine.hidden = true;
    dialog.hidden = false;
    document.getElementById('hero').inert = true;
    close.focus();
    try {
      const snapshot = await sharedOrbit(person);
      if (job !== portalJob || dialog.hidden) return;
      drawOrbit(world, snapshot, person, false, worldTweens);
      const skyTitle = snapshot.title || {};
      if (nameLine && (skyTitle.first || skyTitle.second)) {
        nameLine.children[0].textContent = skyTitle.first;
        nameLine.children[1].textContent = skyTitle.second;
        nameLine.children[1].style.color = skyTitle.secondColor || '';
        nameLine.hidden = false;
      }
      if (bioLine) { bioLine.textContent = skyTitle.bio || ''; bioLine.hidden = !skyTitle.bio; }
      worldStatus.textContent = snapshot.rings.map(ring => ring.name + (ring.items.length ? '' : ' (no images available)')).join(' · ') || 'No rings shared with everyone yet.';
      if (snapshot.failed) worldStatus.textContent += ' · Some source images could not load. Refresh your cosmos to retry.';
    } catch (_) { if (job === portalJob) worldStatus.textContent = 'This orbit could not load. Return to your cosmos and refresh to retry.'; }
  }
  function leave() {
    ++portalJob; kill(worldTweens); dialog.hidden = true;
    document.getElementById('hero').inert = false;
    activePlanet?.focus();
  }
  close.addEventListener('click', leave);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.hidden) leave(); });
  world.addEventListener('click', event => {
    const tile = event.target.closest('.ring-image');
    if (tile) window.openRingLightbox?.(tile._mediaEl.src, tile._isVideo, tile._source, tile._boardUrl, tile._metadata);
  });

  // Friends turn around you: a tilted ring for a few friends, a globe from six up.
  // Planets on the near side pass in front of your planet; the far side passes behind it.
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let turn = 0, frame = 0, paused = false;
  function placeGlobe() {
    const list = [...planets.children];
    const count = list.length;
    if (!count) return;
    const width = window.innerWidth || 1024, height = window.innerHeight || 768;
    const radius = Math.min(width, height) * (width < 680 ? .4 : .34);
    list.forEach((planet, index) => {
      let x, y, z;
      if (count < 6) {
        const angle = (index / count) * Math.PI * 2 + turn;
        x = Math.cos(angle); z = Math.sin(angle); y = -.5 * z;
      } else {
        const lat = 1 - (index / (count - 1)) * 2, ring = Math.sqrt(Math.max(0, 1 - lat * lat)), angle = index * 2.39996 + turn;
        x = Math.cos(angle) * ring; z = Math.sin(angle) * ring;
        y = lat * .9 - z * .4;
      }
      const near = (z + 1) / 2;
      planet.style.transform = `translate(-50%, -50%) translate(${(x * radius).toFixed(1)}px, ${(y * radius * .8).toFixed(1)}px) scale(${(.6 + .55 * near).toFixed(3)})`;
      planet.style.zIndex = z > 0 ? '6' : '1';
      planet.style.opacity = (.45 + .55 * near).toFixed(2);
      planet.dataset.near = String(near > .62);
    });
  }
  function spin() {
    frame = 0;
    if (sky.hidden || !window.requestAnimationFrame) return;
    if (!paused && !reduceMotion?.matches) { turn = (turn + .0022) % (Math.PI * 2); placeGlobe(); }
    frame = window.requestAnimationFrame(spin);
  }
  function startSpin() { placeGlobe(); if (!frame && window.requestAnimationFrame) frame = window.requestAnimationFrame(spin); }
  planets.addEventListener('mouseenter', () => { paused = true; });
  planets.addEventListener('mouseleave', () => { paused = false; });
  planets.addEventListener('focusin', () => { paused = true; });
  planets.addEventListener('focusout', () => { paused = false; });
  window.addEventListener('resize', placeGlobe);

  function render(connections) {
    const job = sequence;
    kill(nearTweens); planets.replaceChildren();
    const following = connections.filter(person => person.followed_user_id && typeof person.username === 'string');
    following.forEach((person, index) => {
      const planet = document.createElement('button');
      planet.type = 'button'; planet.className = 'following-cosmos__planet';
      planet.dataset.userId = person.followed_user_id;
      planet.style.setProperty('--planet-hue', String(260 + index * 37 % 100));
      const sphere = document.createElement('span'); sphere.className = 'following-cosmos__sphere';
      sphere.textContent = person.username.slice(0, 1).toUpperCase(); sphere.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'following-cosmos__name'; name.textContent = `@${person.username}`;
      planet.append(sphere, name); planet.setAttribute('aria-label', `Enter @${person.username}’s orbit`);
      planet.addEventListener('click', () => enter(person, planet)); planets.append(planet);
      sharedOrbit(person).then(snapshot => {
        if (job !== sequence) return;
        drawOrbit(sphere, snapshot, person, true, nearTweens);
        if (snapshot.title?.bio) {
          const bio = document.createElement('span'); bio.className = 'following-cosmos__bio'; bio.textContent = snapshot.title.bio;
          planet.append(bio);
        }
        if (snapshot.failed) status.textContent = 'Some shared images could not load. Refresh to retry.';
      }).catch(() => { if (job === sequence) status.textContent = 'A shared orbit could not load. Refresh to retry.'; });
    });
    loaded = true;
    status.textContent = following.length ? '' : 'Your cosmos is waiting. Find someone through search in Wander.';
    startSpin();
  }
  async function load() {
    const job = ++sequence;
    status.textContent = loaded ? 'Refreshing your cosmos…' : 'Looking for friends in your cosmos…';
    try {
      if (!await window.OrbitingAccount.isConfigured() || !await window.OrbitingAccount.getSession()) {
        if (job === sequence) status.textContent = 'Sign in to see friends in your cosmos.'; return;
      }
      const connections = await window.OrbitingAccount.listFollowing();
      if (job === sequence) render(connections);
    } catch (_) { if (job === sequence) status.textContent = 'Your cosmos could not refresh. Try again.'; }
  }
  refresh.addEventListener('click', () => { cache.clear(); return load(); });
  window.addEventListener('orbiting:following-changed', event => { ++sequence; render(event.detail.following || []); });
  window.addEventListener('orbiting:depth-changed', event => {
    const visible = event.detail.active && !event.detail.demo;
    sky.hidden = !visible; sky.inert = !visible;
    if (visible && !loaded) load();
    if (visible) startSpin();
  });
})();
