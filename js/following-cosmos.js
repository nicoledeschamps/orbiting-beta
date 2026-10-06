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
  const friendSky = document.getElementById('followedOrbitSky');
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
      const pos = orbit.portraitPosition && typeof orbit.portraitPosition === 'object' ? orbit.portraitPosition : {};
      const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
      const portraitPosition = { size: clamp(pos.size, 50, 200, 100), x: clamp(pos.x, -50, 50, 0), y: clamp(pos.y, -50, 50, 0) };
      return { failed, portraitAsset: orbit.portraitAsset, portraitSrc, portraitPosition, title: skyTitle, rings: (orbit.rings || []).map(ring => ({
        name: ring.words || ring.source || 'Shared ring',
        provider: (ring.sources || [ring.source])[0],
        items: (ring.sources || [ring.source]).flatMap(provider => sources.get(provider) || [])
      })) };
    })();
    cache.set(person.followed_user_id, promise);
    try { return await promise; } catch (error) { cache.delete(person.followed_user_id); throw error; }
  }

  const NEAR_TILE_SPACING = 46, NEAR_TILE_HALF = 11;
  const nearRingRatio = index => .62 + index * .22;

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
      // On their full page, their face uses the size and position they chose, exactly like their own orbit does.
      const pos = snapshot.portraitPosition;
      if (!near && ownPortrait && pos) {
        portrait.style.scale = String(pos.size / 100);
        portrait.style.translate = `${pos.x}% ${pos.y}%`;
      }
      // A site copy may leave a supplied portrait out; fall back to the initial instead of a broken image.
      portrait.onerror = () => { core.replaceChildren(); core.textContent = person.username.slice(0, 1).toUpperCase(); };
      core.append(portrait);
    } else core.textContent = person.username.slice(0, 1).toUpperCase();
    container.append(core);
    const width = container.getBoundingClientRect().width || (near ? 64 : 240);
    // Rings without images are listed in the status text but never take an orbital path.
    const filled = snapshot.rings.filter(ring => ring.items.length);
    if (near) container.dataset.ringCount = String(filled.length);
    filled.forEach((ring, index) => {
      const back = document.createElement('span'), front = document.createElement('span');
      back.className = 'saturn-ring-back'; front.className = 'saturn-ring-front';
      back.dataset.friendRing = front.dataset.friendRing = String(index);
      container.append(back, front);
      const orbit = window.HuesOrbit || {};
      const ratio = orbit.ringRadiusRatio?.(index, filled.length) || .5;
      if (near) {
        // A small planet's rings start outside the face and spread apart, with only as many tiles as each path holds.
        const radius = width * nearRingRatio(index);
        const count = Math.min(ring.items.length, Math.max(5, Math.round(2 * Math.PI * radius / NEAR_TILE_SPACING)));
        const tween = orbit.buildRing?.(ring.items.slice(0, count), back, front, radius,
          [16, 22], [65 + index * 20, 85 + index * 20], ring.items, { previewOnly: true, startAngle: index * 120 });
        if (tween) tweens.push(tween);
        return;
      }
      // A friend's full orbit uses exactly the rules of your own: same spacing, fit, image count, tile size and speed.
      const outer = orbit.ringRadiusRatio?.(filled.length - 1, filled.length) || ratio;
      const radius = orbit.fittedRingRadius ? orbit.fittedRingRadius(width, ratio, outer) : width * ratio;
      const visible = orbit.personalRingVisibleImages ? orbit.personalRingVisibleImages(ring.items, index) : ring.items.slice(0, 20);
      const tween = orbit.buildRing?.(visible, back, front, radius, [34, 48], [55 + index * 20, 75 + index * 20], ring.items,
        { previewOnly: false, startAngle: index * 120 % 360 });
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
    showFriendSky(person, job);
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
      friendSky?._keepClear?.();  // The key and status just changed size; re-check the sky's spacing.
    } catch (_) { if (job === portalJob) worldStatus.textContent = 'This orbit could not load. Return to your cosmos and refresh to retry.'; }
  }
  // Their zodiac signs fill the sky of their page, only if they chose to share them.
  async function showFriendSky(person, job) {
    if (!friendSky) return;
    friendSky.hidden = true;
    friendSky.replaceChildren();
    try {
      const shared = await window.OrbitingAccount.loadVisibleFollowedSky(person.followed_user_id);
      if (job !== portalJob || dialog.hidden || !window.OrbitingSharedSky) return;
      const signs = Array.isArray(shared?.constellations) ? shared.constellations : [];
      if (!signs.length) return;
      const own = window.OrbitSetup?.ownSkyPlacements?.() || [];
      const rectOf = (element) => element && !element.hidden ? element.getBoundingClientRect() : null;
      window.OrbitingSharedSky.render(friendSky, [{ name: `@${person.username}`, constellations: signs, placements: shared.placements || [] }], {
        self: own.length ? { placements: own } : null,
        // Stay off their rings, their planet, and the page's title, back button, key and status.
        avoid: () => [window.OrbitingSharedSky.orbitBand(world), rectOf(world), rectOf(dialog.querySelector('.followed-orbit__head')),
          rectOf(close), rectOf(key), rectOf(worldStatus)]
      });
      friendSky.hidden = false;
    } catch (_) { /* The page works without their sky. */ }
  }

  function leave() {
    ++portalJob; kill(worldTweens); dialog.hidden = true;
    document.getElementById('hero').inert = false;
    activePlanet?.focus();
  }
  close.addEventListener('click', leave);
  // Escape closes an open photo first; the orbit only closes once no photo is showing.
  // Capture phase runs before the photo's own Escape handler hides it.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.hidden && !document.querySelector('.ring-lightbox.visible')) leave();
  }, true);

  // Friends turn around you: a tilted ring for a few friends, a globe from six up.
  // Planets on the near side pass in front of your planet; the far side passes behind it.
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let turn = 0, frame = 0, paused = false, ownRingRadius = null;
  const hero = document.getElementById('hero');
  // How far your own outermost ring reaches before the Friends pull-back scales it down.
  function measureOwnRings() {
    const saturn = document.getElementById('saturn');
    const filled = saturn ? [...saturn.querySelectorAll('.saturn-ring-front')].filter(ring => ring.children.length) : [];
    if (!filled.length) { ownRingRadius = 0; return; }
    const outer = Math.max(...filled.map(ring => Number(ring.dataset.outerRadiusRatio) || .7));
    const orbit = window.HuesOrbit || {};
    ownRingRadius = (orbit.fittedRingRadius ? orbit.fittedRingRadius(saturn.offsetWidth, outer, outer) : saturn.offsetWidth * outer) + 24;
  }
  // Friends travel just outside your rings (and theirs), so at the sides of the turn the two orbits never collide.
  function globeRadius(list, width, height) {
    const base = Math.min(width, height) * (width < 680 ? .4 : .34);
    if (ownRingRadius === null) measureOwnRings();
    const scale = parseFloat(hero?.style?.getPropertyValue?.('--orbit-scale')) || 1;
    const friendReach = Math.max(0, ...list.map(planet => {
      const sphere = planet.querySelector?.('.following-cosmos__sphere');
      const rings = Number(sphere?.dataset.ringCount) || 0;
      return rings ? (sphere.offsetWidth || 64) * nearRingRatio(rings - 1) + NEAR_TILE_HALF : (sphere?.offsetWidth || 64) / 2;
    })) * .875;
    const clear = ownRingRadius * scale + friendReach + 16;
    return Math.min(Math.max(base, clear), width / 2 - friendReach - 8);
  }
  function placeGlobe() {
    const list = [...planets.children];
    const count = list.length;
    if (!count) return;
    const width = window.innerWidth || 1024, height = window.innerHeight || 768;
    const radius = globeRadius(list, width, height);
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
      planet.style.zIndex = z > 0 ? '6' : '2';
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
  window.addEventListener('resize', () => { ownRingRadius = null; placeGlobe(); });

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

  // The friend card: tapping a planet shows who it is before you enter their orbit.
  const card = document.getElementById('friendCard');
  const cardPlanet = document.getElementById('friendCardPlanet');
  const cardName = document.getElementById('friendCardName');
  const cardBio = document.getElementById('friendCardBio');
  const cardHandle = document.getElementById('friendCardHandle');
  const cardRings = document.getElementById('friendCardRings');
  const cardEnter = document.getElementById('friendCardEnter');
  const cardUnfollow = document.getElementById('friendCardUnfollow');
  const cardStatus = document.getElementById('friendCardStatus');
  let cardPerson = null, cardSource = null, cardTweens = [], cardJob = 0;
  function closeCard(restoreFocus = true) {
    if (!card || card.hidden) return;
    card.hidden = true; ++cardJob; kill(cardTweens);
    if (restoreFocus) cardSource?.focus();
  }
  async function openCard(person, planet) {
    if (!card) { enter(person, planet); return; }
    const job = ++cardJob;
    cardPerson = person; cardSource = planet;
    kill(cardTweens); cardPlanet.replaceChildren();
    cardName.children[0].textContent = person.username; cardName.children[1].textContent = ''; cardName.children[1].style.color = '';
    cardBio.textContent = ''; cardBio.hidden = true;
    cardHandle.textContent = `@${person.username}`;
    cardRings.textContent = 'Loading their rings…';
    cardEnter.textContent = `Enter @${person.username}’s orbit`;
    cardStatus.textContent = '';
    card.hidden = false;
    cardEnter.focus();
    try {
      const snapshot = await sharedOrbit(person);
      if (job !== cardJob) return;
      drawOrbit(cardPlanet, snapshot, person, true, cardTweens);
      const t = snapshot.title || {};
      if (t.first || t.second) {
        cardName.children[0].textContent = t.first || person.username;
        cardName.children[1].textContent = t.second || '';
        cardName.children[1].style.color = t.secondColor || '';
      }
      cardBio.textContent = t.bio || ''; cardBio.hidden = !t.bio;
      const named = snapshot.rings.filter(ring => ring.items.length).map(ring => ring.name);
      cardRings.textContent = named.length ? named.join(' · ') : 'No rings shared with everyone yet.';
    } catch (_) { if (job === cardJob) cardRings.textContent = 'Their rings could not load right now.'; }
  }
  if (card) {
    document.getElementById('friendCardClose').addEventListener('click', () => closeCard());
    cardEnter.addEventListener('click', () => { const person = cardPerson, planet = cardSource; closeCard(false); enter(person, planet); });
    cardUnfollow.addEventListener('click', async () => {
      const person = cardPerson;
      cardUnfollow.disabled = true;
      try {
        await window.OrbitingAccount.unfollowPerson(person.followed_user_id);
        cache.delete(person.followed_user_id);
        closeCard(false);
        window.dispatchEvent(new CustomEvent('orbiting:following-changed', { detail: { following: lastFollowing.filter(entry => entry.followed_user_id !== person.followed_user_id) } }));
      } catch (error) { cardStatus.textContent = error.message || 'Could not unfollow right now.'; }
      finally { cardUnfollow.disabled = false; }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !card.hidden && dialog.hidden) closeCard(); });
  }

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
      planet.addEventListener('click', () => openCard(person, planet)); planets.append(planet);
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
    const note = document.getElementById('cosmosHeadingNote');
    if (note) note.textContent = following.length ? `your close orbit ✦ ${following.length} ${following.length === 1 ? 'friend' : 'friends'} around you` : 'your close orbit';
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
    if (!visible) closeCard(false);
    sky.hidden = !visible; sky.inert = !visible;
    if (visible && !loaded) load();
    if (visible) { ownRingRadius = null; startSpin(); }
  });
})();
