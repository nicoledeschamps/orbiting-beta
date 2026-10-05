/* Wander is what orbits you plus what orbits the people you orbit: your clippings and the rings your friends share with everyone.
   The direct Wander demo keeps its sample worlds. */
(() => {
  const planet = document.getElementById('explorePlanet');
  const container = document.getElementById('explorePlanetItems');
  const detail = document.getElementById('exploreDetail');
  const title = document.getElementById('exploreDetailTitle');
  const detailImage = document.getElementById('exploreDetailImage');
  const source = document.getElementById('exploreDetailSource');
  const sourceLink = document.getElementById('exploreSourceLink');
  const enterOrbit = document.getElementById('exploreEnterFriend');
  const closeDetail = document.getElementById('exploreDetailClose');
  const emptyNote = document.getElementById('wanderEmpty');
  const demoMode = new URLSearchParams(window.location.search).get('view') === 'wander';
  document.querySelector('.explore-layer__note').textContent = demoMode
    ? 'Prototype imagery · not live sharing.'
    : 'From your orbit in this browser.';
  const brandon = (window.BRANDON_ORBIT_DATA || []).flat().map((item) => ({
    ...item, owner: 'Brandon Jerman', ownerKey: 'brandon'
  }));
  if (!planet || !container) return;

  const art = (typeof GALLERY_ART === 'undefined' ? [] : GALLERY_ART)
    .filter((item) => item.type === 'image' && item.src)
    .map((item) => ({ src: item.src, alt: item.title, source: 'my art', boardUrl: '', owner: 'Nicole Deschamps', ownerKey: 'nicole' }));
  const bands = [6, 8, 10, 12, 14, 16, 18, 16, 14, 12, 10, 8, 6];
  const shapes = [1, .72, 1.24, .9, 1.08, .62, 1.4, .84, 1.15];
  let nodes = [];
  let selected = null;
  let selectedButton = null;
  let isVisible = false;
  let personalItems = [];
  let friendItems = [];
  // Images waiting their turn; each one leaves the planet's far side as another comes in.
  let waiting = [];

  function nicoleItems() {
    const data = window.HuesOrbit?.data || {};
    const curated = [...(data.arena || []).slice(0, 38), ...(data.cosmos || []).slice(0, 54)]
      .filter((item) => item.src && !item.isVideo)
      .map((item) => ({ ...item, owner: 'Nicole Deschamps', ownerKey: 'nicole' }));
    return [...art, ...curated];
  }

  function showItem(item, button) {
    selected = item;
    selectedButton = button;
    nodes.forEach((node) => node.button.classList.toggle('is-selected', node.button === button));
    detailImage.src = item.src;
    detailImage.alt = item.alt || `Clipping shared by ${item.owner}`;
    title.textContent = item.alt || 'An orbit clipping';
    source.textContent = item.ownerKey === 'self'
      ? `In your orbit · ${item.source}`
      : `Shared by ${item.owner} · ${item.source}`;
    sourceLink.hidden = !item.boardUrl;
    if (item.boardUrl) {
      sourceLink.href = item.boardUrl;
      sourceLink.textContent = `open ${item.source} source ↗`;
    }
    enterOrbit.textContent = item.ownerKey === 'nicole' || item.ownerKey === 'self' ? 'return to my orbit ↗' : 'enter their orbit ↗';
    detail.hidden = false;
    planet.inert = true;
    document.body.classList.add('is-explore-detail');
    closeDetail.focus();
  }

  function closeViewer(restoreFocus = true) {
    detail.hidden = true;
    detailImage.removeAttribute('src');
    planet.inert = false;
    document.body.classList.remove('is-explore-detail');
    nodes.forEach(({ button }) => button.classList.remove('is-selected'));
    if (restoreFocus && selectedButton?.isConnected) selectedButton.focus();
    selected = null;
    selectedButton = null;
    if (isVisible && !reduceMotion.matches) tween?.play();
  }

  function populate() {
    const nicole = demoMode ? nicoleItems() : [];
    const own = demoMode ? [] : personalItems;
    const theirs = demoMode ? [] : friendItems;
    const hasItems = demoMode ? nicole.length + brandon.length > 0 : own.length + theirs.length > 0;
    emptyNote.hidden = hasItems;
    planet.setAttribute('aria-label', demoMode ? 'Rotating planet of prototype clippings' : 'Rotating planet of your clippings and your friends’');
    if (!hasItems) {
      container.replaceChildren();
      nodes = [];
      if (!detail.hidden) closeViewer(false);
      return;
    }
    const fragment = document.createDocumentFragment();
    const nextNodes = [];
    const seen = new Set();
    const shuffle = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    // Deal round-robin across people so every orbit (yours included) gets a fair share when the planet is full.
    const byOwner = new Map();
    (demoMode ? [...nicole, ...brandon] : [...own, ...theirs]).forEach((item) => {
      if (seen.has(item.src)) return;
      seen.add(item.src);
      const key = item.ownerKey === 'friend' ? `friend:${item.personId}` : item.ownerKey;
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(item);
    });
    const piles = [...byOwner.values()].map(shuffle);
    const dealt = [];
    for (let round = 0; piles.some((pile) => round < pile.length); round += 1) {
      piles.forEach((pile) => { if (round < pile.length) dealt.push(pile[round]); });
    }
    const capacity = bands.reduce((sum, count) => sum + count, 0);
    const pool = shuffle(dealt.slice(0, capacity));
    waiting = dealt.slice(capacity);
    const visibleCount = Math.min(pool.length, capacity);
    const occupied = new Map(Array.from({ length: visibleCount }, (_, index) =>
      [Math.floor((index + .5) * capacity / visibleCount), pool[index]]));
    let position = 0;
    bands.forEach((count, row) => {
      for (let slot = 0; slot < count; slot += 1) {
        const item = occupied.get(position);
        if (!item) { position += 1; continue; }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'explore-clipping';
        button.style.setProperty('--clip-aspect', String(shapes[(position * 5 + row) % shapes.length]));
        button.style.setProperty('--clip-width', `${7.5 + ((position * 7 + row * 3) % 6)}%`);
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => { button.hidden = true; });
        button.appendChild(img);
        const node = { button, img, row, slot, count, item, front: true };
        showOn(node, item);
        button.addEventListener('click', () => showItem(node.item, button));
        fragment.appendChild(button);
        nextNodes.push(node);
        position += 1;
      }
    });
    container.replaceChildren(fragment);
    nodes = nextNodes;
    if (!detail.hidden) closeViewer(false);
    render(phase.angle);
  }

  function showOn(node, item) {
    node.item = item;
    node.button.hidden = false;
    node.img.src = item.src;
    node.button.setAttribute('aria-label', `${item.alt || 'Clipping'} · ${item.ownerKey === 'self' ? 'in your orbit' : `shared by ${item.owner}`} · ${item.source}`);
  }
  // As an image turns to the far side, out of sight, it trades places: with one that hasn't been shown yet,
  // or, when everything already fits, with another far-side image, so each turn of the planet looks different.
  function swapOut(node) {
    if (node.item === selected) return;
    if (waiting.length) {
      const next = waiting.shift();
      waiting.push(node.item);
      showOn(node, next);
      return;
    }
    const behind = nodes.filter((other) => other !== node && !other.front && other.item !== selected);
    if (!behind.length) return;
    const other = behind[Math.floor(Math.random() * behind.length)];
    const item = node.item;
    showOn(node, other.item);
    showOn(other, item);
  }

  function render(degrees) {
    const radius = planet.clientWidth / 2;
    const spin = degrees * Math.PI / 180;
    nodes.forEach((node) => {
      const { button, row, slot, count } = node;
      const latitude = -1.38 + row * (2.76 / (bands.length - 1)) + Math.sin(slot * 2.31 + row) * .035;
      const longitude = (slot + (row % 2 ? .43 : 0) + Math.sin(row * 1.73) * .18) * Math.PI * 2 / count + spin;
      const arc = Math.cos(latitude);
      const facing = Math.cos(longitude);
      const depth = facing * arc;
      const x = Math.sin(longitude) * arc * radius * .96 + Math.sin(slot * 3.2 + row) * radius * .012;
      const y = Math.sin(latitude) * radius * .93 + Math.cos(slot * 2.4 + row) * radius * .012;
      const front = facing >= 0;
      if (node.front && !front) swapOut(node);
      node.front = front;
      const opacity = front ? .72 + Math.max(0, depth) * .28 : .14 + (1 + depth) * .18;
      button.style.setProperty('--clip-x', `${x}px`);
      button.style.setProperty('--clip-y', `${y}px`);
      button.style.setProperty('--clip-scale', String((front ? .8 : .57) + Math.max(0, depth) * .27));
      button.style.setProperty('--clip-opacity', String(opacity));
      button.style.setProperty('--clip-tilt', `${Math.sin(longitude) * 25}deg`);
      button.style.setProperty('--clip-rotation', `${Math.sin(row * 2.4 + slot * 1.7) * 6}deg`);
      button.style.zIndex = String(Math.round(depth * 100));
      button.style.pointerEvents = front ? 'auto' : 'none';
      button.tabIndex = front ? 0 : -1;
      button.setAttribute('aria-hidden', String(!front));
    });
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phase = { angle: 0 };
  const tween = window.gsap && window.gsap.to(phase, {
    angle: 360, duration: 45, repeat: -1, ease: 'none', paused: true,
    onUpdate: () => render(phase.angle)
  });
  const setSpeed = (speed) => tween?.timeScale(Math.max(.5, Math.min(12, Number(speed) || 1)));
  populate();
  window.addEventListener('hues-orbit:data-ready', populate);
  window.addEventListener('resize', () => render(phase.angle));
  new ResizeObserver(() => render(phase.angle)).observe(planet);
  closeDetail.addEventListener('click', () => closeViewer());
  detail.addEventListener('click', (event) => { if (!event.target.closest('img, a, button, .explore-detail__caption')) closeViewer(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !detail.hidden) closeViewer();
  });
  enterOrbit.addEventListener('click', () => {
    const item = selected;
    closeViewer(false);
    if (item?.ownerKey === 'nicole' || item?.ownerKey === 'self') window.OrbitingExplore.onEnterSelf?.();
    else window.OrbitingExplore.onEnterFriend?.(item);
  });
  window.OrbitingExplore = {
    onEnterFriend: null,
    onEnterSelf: null,
    setSpeed,
    setPersonalImages(items) {
      personalItems = Array.isArray(items) ? items.filter((item) => item?.src && !item.isVideo).map((item) => ({
        ...item, owner: 'you', ownerKey: 'self'
      })) : [];
      if (!demoMode) populate();
    },
    // Images from the rings the people you follow share with everyone.
    setFriendImages(items) {
      friendItems = Array.isArray(items) ? items.filter((item) => item?.src && !item.isVideo && item.personId).map((item) => ({
        ...item, ownerKey: 'friend'
      })) : [];
      if (!demoMode) populate();
    },
    setVisible(visible) {
      isVisible = visible;
      if (!tween || reduceMotion.matches) return;
      if (visible) tween.play();
      else tween.pause();
    }
  };
})();
