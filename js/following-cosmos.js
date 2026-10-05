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
        provider: (ring.sources || [ring.source])[0],
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
    // Until someone has a face, their planet glows in their own title color.
    const glow = snapshot.title?.secondColor;
    if (typeof glow === 'string' && /^#[0-9a-f]{6}$/i.test(glow)) core.style.setProperty('--planet-glow', glow);
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
      back.dataset.friendRing = front.dataset.friendRing = String(index);
      container.append(back, front);
      const orbit = window.HuesOrbit || {};
      const ratio = orbit.ringRadiusRatio?.(index, filled.length) || .5;
      if (near) {
        const tween = orbit.buildRing?.(ring.items.slice(0, 8), back, front, width * ratio,
          [16, 22], [65 + index * 20, 85 + index * 20], ring.items, { previewOnly: true, startAngle: index * 120 });
        if (tween) tweens.push(tween);
        return;
      }
      // A friend's full orbit uses exactly the rules of your own: same spacing, fit, image count, tile size and speed.
      const outer = orbit.ringRadiusRatio?.(filled.length - 1, filled.length) || ratio;
      const radius = orbit.fittedRingRadius ? orbit.fittedRingRadius(width, ratio, outer) : width * ratio;
      const visible = orbit.personalRingVisibleImages ? orbit.personalRingVisibleImages(ring.items, index) : ring.items.slice(0, 20);
      const tween = orbit.buildRing?.(visible, back, front, radius, [34, 48], [55 + index * 20, 75 + index * 20], ring.items,
        { previewOnly: true, startAngle: index * 120 % 360 });
      if (tween) tweens.push(tween);
    });
  }

  // The same "what's in my orbit" key as your own planet: an arc per shared ring; a ring name lights that ring and dims the rest.
  const key = document.getElementById('followedOrbitKey');
  const keyTrigger = document.getElementById('followedOrbitKeyTrigger');
  const keyChart = document.getElementById('followedOrbitKeyChart');
  const ringColors = { arena: '#a5b4dc', cosmos: '#a082c8', pinterest: '#c88c9d', spotify: '#9cc8c0', instagram: '#c6b69e' };
  let litRing = null;
  function lightRing(index) {
    litRing = litRing === index ? null : index;
    world.querySelectorAll('[data-friend-ring]').forEach(el => {
      el.classList.toggle('ring-highlighted', litRing !== null && el.dataset.friendRing === litRing);
      el.classList.toggle('ring-dimmed', litRing !== null && el.dataset.friendRing !== litRing);
    });
    keyChart.querySelectorAll('[data-ring]').forEach(el => {
      const on = litRing !== null && el.dataset.ring === litRing;
      if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(on));
      else { el.classList.toggle('arc-active', on); el.classList.toggle('arc-dimmed', litRing !== null && !on); }
    });
  }
  function closeKey() {
    if (!key) return;
    key.classList.remove('open'); keyTrigger.setAttribute('aria-expanded', 'false');
    if (litRing !== null) lightRing(litRing);
  }
  function buildKey(snapshot) {
    if (!key || !keyChart || !document.createElementNS) return false;
    litRing = null; closeKey();
    const filled = snapshot.rings.filter(ring => ring.items.length);
    key.hidden = !filled.length;
    if (!filled.length) return false;
    const height = Math.max(110, filled.length * 28 + 36), width = height * 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'orbit-chart-svg'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    keyChart.style.height = `${height}px`; keyChart.style.width = `${Math.min(360, width)}px`;
    keyChart.replaceChildren(svg);
    filled.forEach((ring, index) => {
      const radius = 36 + index * 28;
      const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arc.setAttribute('class', 'orbit-arc');
      arc.setAttribute('d', `M ${height - radius},${height - 8} A ${radius},${radius} 0 0,1 ${height + radius},${height - 8}`);
      arc.dataset.ring = String(index);
      arc.style.stroke = ringColors[ring.provider] || '#e8c589';
      svg.append(arc);
      const label = document.createElement('button');
      label.type = 'button'; label.className = 'orbit-chart-label'; label.dataset.ring = String(index);
      label.textContent = ring.name; label.setAttribute('aria-label', `Show ${ring.name} ring`); label.setAttribute('aria-pressed', 'false');
      label.style.left = '2%'; label.style.bottom = `${(radius + 3) / height * 100}%`;
      keyChart.append(label);
    });
    return true;
  }
  if (key) {
    keyTrigger.addEventListener('click', event => {
      event.stopPropagation();
      const open = !key.classList.contains('open');
      if (open) { key.classList.add('open'); keyTrigger.setAttribute('aria-expanded', 'true'); } else closeKey();
    });
    keyChart.addEventListener('click', event => {
      const label = event.target.closest('.orbit-chart-label');
      if (!label) return;
      event.stopPropagation(); lightRing(label.dataset.ring);
    });
    dialog.addEventListener('click', event => { if (!key.contains(event.target)) closeKey(); });
  }

  async function enter(person, planet) {
    const job = ++portalJob;
    activePlanet = planet;
    kill(worldTweens); world.replaceChildren();
    title.textContent = `@${person.username}’s orbit`;
    worldStatus.textContent = 'Loading shared rings…';
    if (key) { key.hidden = true; closeKey(); }
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
      // With the key in place, the plain list of ring names is only kept for rings that have no images.
      if (buildKey(snapshot)) worldStatus.textContent = snapshot.rings.filter(ring => !ring.items.length).map(ring => ring.name + ' (no images available)').join(' · ');
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

  // Wander mixes in what orbits the people you follow: every image from the rings they share with everyone.
  let wanderJob = 0;
  function shareWithWander(following) {
    const job = ++wanderJob;
    if (!window.OrbitingExplore?.setFriendImages) return;
    if (!following.length) { window.OrbitingExplore.setFriendImages([]); return; }
    Promise.allSettled(following.map(person => sharedOrbit(person).then(snapshot => snapshot.rings.flatMap(ring =>
      ring.items.map(item => ({ ...item, owner: `@${person.username}`, personId: person.followed_user_id, source: ring.name, ring: ring.name })))))).then(results => {
      if (job === wanderJob) window.OrbitingExplore.setFriendImages(results.flatMap(result => result.status === 'fulfilled' ? result.value : []));
    });
  }
  window.OrbitingFriends = {
    open(personId) {
      const person = lastFollowing.find(entry => entry.followed_user_id === personId);
      if (!person) return false;
      enter(person, [...planets.children].find(planet => planet.dataset.userId === personId));
      return true;
    }
  };
  let lastFollowing = [];

  function render(connections) {
    const job = sequence;
    kill(nearTweens); planets.replaceChildren();
    const following = connections.filter(person => person.followed_user_id && typeof person.username === 'string');
    lastFollowing = following;
    shareWithWander(following);
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
    // Wander sits past the cosmos, so friends load as soon as you start pulling back, ready for both.
    if (!event.detail.demo && event.detail.depth >= .72 && !loaded) load();
    const visible = event.detail.active && !event.detail.demo;
    sky.hidden = !visible; sky.inert = !visible;
    if (visible && !loaded) load();
    if (visible) startSpin();
  });
})();
