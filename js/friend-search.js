/* Account-backed people search. The public prototype shows an honest unavailable state. */
(() => {
  const toggle = document.getElementById('peopleSearchToggle');
  const panel = document.getElementById('peopleSearchPanel');
  const close = document.getElementById('peopleSearchClose');
  const input = document.getElementById('peopleSearchInput');
  const results = document.getElementById('peopleSearchResults');
  const discoverable = document.getElementById('peopleSearchDiscoverable');
  const status = document.getElementById('peopleSearchStatus');
  if (!toggle || !window.OrbitingAccount) return;

  let ready = false;
  let following = [];
  let searchTimer;
  let searchVersion = 0;
  let openVersion = 0;

  function message(value) { status.textContent = value; }
  function button(label, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }
  function row(name, action) {
    const element = document.createElement('div');
    element.className = 'people-search__row';
    const label = document.createElement('span');
    label.textContent = `@${name}`;
    element.append(label, action);
    return element;
  }
  async function refreshFollowing() {
    following = await OrbitingAccount.listFollowing();
  }
  async function follow(person) {
    try {
      await OrbitingAccount.followPerson(person.user_id);
      await refreshFollowing();
      await search();
      message(`@${person.username} is now in your cosmos.`);
      window.dispatchEvent(new CustomEvent('orbiting:following-changed', { detail: { following } }));
    } catch (error) { message(error.message || 'Could not follow that person.'); }
  }
  async function unfollow(person) {
    try {
      await OrbitingAccount.unfollowPerson(person.user_id);
      await refreshFollowing();
      await search();
      message(`You stopped following @${person.username}.`);
      window.dispatchEvent(new CustomEvent('orbiting:following-changed', { detail: { following } }));
    } catch (error) { message(error.message || 'Could not unfollow that person.'); }
  }
  async function search() {
    const version = ++searchVersion;
    const query = input.value.trim();
    results.replaceChildren();
    if (!ready) return;
    if (query.replace(/^@/, '').length < 2) { message('Type at least two letters of a username.'); return; }
    message('Searching…');
    try {
      const people = await OrbitingAccount.searchPeople(query);
      if (version !== searchVersion) return;
      if (!people.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No matching usernames. The person must enable “Let people find me by username” in their search panel.';
        results.append(empty);
      }
      message('');
      people.forEach((person) => {
        const isFollowing = following.some((item) => item.followed_user_id === person.user_id);
        const action = isFollowing ? button('following · unfollow', () => unfollow(person))
          : button('follow', () => follow(person));
        results.append(row(person.username, action));
      });
    } catch (error) { if (version === searchVersion) message(error.message || 'Search is unavailable.'); }
  }
  async function open() {
    const version = ++openVersion;
    ready = false;
    results.replaceChildren();
    discoverable.disabled = true;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    message('');
    input.focus();
    try {
      const configured = await OrbitingAccount.isConfigured();
      const session = configured && await OrbitingAccount.getSession();
      if (version !== openVersion || panel.hidden) return;
      ready = Boolean(session);
      input.disabled = false;
      input.focus();
      discoverable.disabled = !ready;
      if (!ready) {
        message(configured ? 'Sign in to search and follow people.' : 'Search and following need an Orbit account connection. Nicole and Brandon are prototype examples.');
        return;
      }
      const settings = await OrbitingAccount.getDiscoverySettings();
      if (version !== openVersion || panel.hidden) return;
      discoverable.checked = settings.discoverable;
      await refreshFollowing();
      if (version === openVersion && !panel.hidden) await search();
    } catch (error) { if (version === openVersion) message(error.message || 'Friend search is unavailable.'); }
  }
  function hide() {
    ++openVersion;
    ++searchVersion;
    clearTimeout(searchTimer);
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
  toggle.addEventListener('click', () => panel.hidden ? open() : hide());
  close.addEventListener('click', hide);
  document.getElementById('peopleSearchFriends').addEventListener('click', () => {
    hide();
    window.dispatchEvent(new CustomEvent('orbiting:open-cosmos'));
  });
  input.addEventListener('input', () => { ++searchVersion; clearTimeout(searchTimer); searchTimer = setTimeout(search, 220); });
  discoverable.addEventListener('change', async () => {
    try {
      await OrbitingAccount.setDiscoverable(discoverable.checked);
      message(discoverable.checked ? 'People can now find your username.' : 'Your username is hidden from new searches. Existing follows remain.');
    } catch (error) {
      discoverable.checked = !discoverable.checked;
      message(error.message || 'Could not change discoverability.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) hide();
  });
})();
