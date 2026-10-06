// Wander's sky: your zodiac signs plus those of people you orbit who chose to share theirs.
(() => {
  const layer = document.getElementById('exploreLayer');
  const sky = document.getElementById('wanderSharedSky');
  if (!layer || !sky) return;
  let loaded = false;
  let sequence = 0;

  async function load() {
    const api = window.OrbitingAccount;
    if (!api?.listFollowing || !window.OrbitingSharedSky || !(await api.getSession().catch(() => null))) return;
    const job = ++sequence;
    try {
      const following = await api.listFollowing();
      const skies = await Promise.allSettled(following.map((person) => api.loadVisibleFollowedSky(person.followed_user_id)
        .then((shared) => ({ name: `@${shared?.username || person.username}`, constellations: shared?.constellations || [] }))));
      if (job !== sequence) return;
      const own = window.OrbitSetup?.ownSkySigns?.() || [];
      const people = [
        ...(own.length ? [{ name: window.OrbitSetup.username() ? `@${window.OrbitSetup.username()}` : 'you', constellations: own }] : []),
        ...skies.flatMap((result) => result.status === 'fulfilled' && result.value.constellations.length ? [result.value] : [])
      ];
      const entries = window.OrbitingSharedSky.render(sky, people);
      sky.hidden = !entries.length;
      loaded = skies.every((result) => result.status === 'fulfilled');
    } catch (_) { /* Wander works without the shared sky. */ }
  }

  // Load when Wander opens; reload after following someone new.
  new MutationObserver(() => { if (layer.getAttribute('aria-hidden') === 'false' && !loaded) load(); })
    .observe(layer, { attributes: true, attributeFilter: ['aria-hidden'] });
  window.addEventListener('orbiting:following-changed', () => { loaded = false; if (layer.getAttribute('aria-hidden') === 'false') load(); });
  window.addEventListener('orbit:setup-changed', () => { loaded = false; });
})();
