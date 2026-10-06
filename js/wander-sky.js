// Wander's sky: your zodiac signs plus those of people you orbit who chose to share theirs.
(() => {
  const layer = document.getElementById('exploreLayer');
  const sky = document.getElementById('wanderSharedSky');
  if (!layer || !sky) return;
  let loaded = false;
  const grow = (rect, by) => ({ left: rect.left - by, right: rect.right + by, top: rect.top - by, bottom: rect.bottom + by });
  let sequence = 0;

  async function load() {
    const api = window.OrbitingAccount;
    if (!api?.listFollowing || !window.OrbitingSharedSky || !(await api.getSession().catch(() => null))) return;
    const job = ++sequence;
    try {
      const following = await api.listFollowing();
      const skies = await Promise.allSettled(following.map((person) => api.loadVisibleFollowedSky(person.followed_user_id)
        .then((shared) => ({ name: `@${shared?.username || person.username}`, constellations: shared?.constellations || [], placements: shared?.placements || [] }))));
      if (job !== sequence) return;
      const own = window.OrbitSetup?.ownSkyPlacements?.() || [];
      const people = [
        ...(own.length ? [{ name: 'you', self: true, placements: own }] : []),
        ...skies.flatMap((result) => result.status === 'fulfilled' && result.value.constellations.length ? [result.value] : [])
      ];
      const rectOf = (element) => element && !element.hidden && element.offsetParent !== null ? element.getBoundingClientRect() : null;
      const planet = document.getElementById('explorePlanet');
      const entries = window.OrbitingSharedSky.render(sky, people, {
        // Stay off Wander's planet of clippings, its heading, search, and the controls under it.
        avoid: () => [rectOf(planet) && grow(rectOf(planet), 24), ...['.explore-layer__heading', '.people-search', '.wander-controls', '.wander-tools', '.wander-filters', '.explore-layer__empty']
          .map((selector) => rectOf(layer.querySelector(selector))), rectOf(document.getElementById('cosmosDepthControl')),
          rectOf(document.querySelector('.orbit-page-nav'))]
      });
      sky.hidden = !entries.length;
      loaded = skies.every((result) => result.status === 'fulfilled');
    } catch (_) { /* Wander works without the shared sky. */ }
  }

  // Load when Wander opens; reload after following someone new.
  // Wander zooms in as it opens, so re-check the spacing once it has settled at full size.
  const settle = () => { setTimeout(() => sky._keepClear?.(), 1000); };
  new MutationObserver(() => {
    if (layer.getAttribute('aria-hidden') !== 'false') return;
    if (!loaded) load().then(settle); else settle();
  })
    .observe(layer, { attributes: true, attributeFilter: ['aria-hidden'] });
  window.addEventListener('orbiting:following-changed', () => { loaded = false; if (layer.getAttribute('aria-hidden') === 'false') load(); });
  window.addEventListener('orbit:setup-changed', () => { loaded = false; });
})();
