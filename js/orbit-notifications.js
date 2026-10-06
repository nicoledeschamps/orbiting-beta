// Notifications tab: tells you when someone starts orbiting (following) you.
(() => {
  const button = document.getElementById('openOrbitNotifications');
  const badge = document.getElementById('orbitNotificationsBadge');
  const panel = document.getElementById('orbitNotifications');
  const list = document.getElementById('orbitNotificationsList');
  const status = document.getElementById('orbitNotificationsStatus');
  const signOut = document.getElementById('signOutOrbit');
  const REFRESH_MS = 90 * 1000;
  let items = [];
  let timer = 0;
  let loading = false;
  const api = () => window.OrbitingAccount;

  function timeAgo(value) {
    const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const steps = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month']];
    let amount = seconds / 60;
    let unit = 'minute';
    for (let index = 1; index < steps.length && amount >= steps[index - 1][0]; index++) {
      amount /= steps[index - 1][0];
      unit = steps[index][1];
    }
    const whole = Math.floor(amount);
    return `${whole} ${unit}${whole === 1 ? '' : 's'} ago`;
  }

  function renderBadge() {
    const unread = items.filter((item) => item.unread).length;
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    button.setAttribute('aria-label', unread ? `Notifications, ${unread} new` : 'Notifications');
  }

  function renderList() {
    list.replaceChildren();
    status.textContent = items.length ? '' : 'No one has started orbiting you yet. When someone does, they show up here.';
    for (const item of items) {
      const row = document.createElement('li');
      row.className = `orbit-notifications__item${item.unread ? ' is-unread' : ''}`;
      const text = document.createElement('p');
      const name = document.createElement('strong');
      name.textContent = `@${item.username}`;
      const when = document.createElement('small');
      when.textContent = timeAgo(item.created_at);
      text.append(name, ' started orbiting you', when);
      row.append(text);
      if (item.can_follow_back && !item.following_back) {
        const back = document.createElement('button');
        back.type = 'button';
        back.textContent = 'orbit back';
        back.addEventListener('click', () => orbitBack(item, back));
        row.append(back);
      } else if (item.following_back) {
        const mutual = document.createElement('span');
        mutual.textContent = 'you orbit each other';
        row.append(mutual);
      }
      list.append(row);
    }
  }

  async function refresh() {
    if (loading || !api()?.listNotifications) return;
    loading = true;
    try {
      items = await api().listNotifications();
      renderBadge();
      if (!panel.hidden) renderList();
    } catch (error) {
      if (!panel.hidden) status.textContent = error.message || 'Notifications could not load. Try again soon.';
    } finally {
      loading = false;
    }
  }

  async function orbitBack(item, control) {
    control.disabled = true;
    try {
      await api().followPerson(item.user_id);
      items = items.map((entry) => entry.user_id === item.user_id ? { ...entry, following_back: true } : entry);
      renderList();
      status.textContent = `@${item.username} is now in your cosmos.`;
      const following = await api().listFollowing();
      window.dispatchEvent(new CustomEvent('orbiting:following-changed', { detail: { following } }));
    } catch (error) {
      control.disabled = false;
      status.textContent = error.message || 'Could not orbit back right now.';
    }
  }

  async function open() {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    status.textContent = items.length ? '' : 'Loading…';
    renderList();
    await refresh();
    renderList();
    if (!items.some((item) => item.unread)) return;
    try {
      await api().markNotificationsSeen();
      // Keep the dots visible while the panel is open; the badge clears now.
      badge.hidden = true;
      button.setAttribute('aria-label', 'Notifications');
      items = items.map((item) => ({ ...item, unread: false }));
    } catch (_) { /* The badge stays; it clears on the next successful open. */ }
  }

  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function start() {
    if (!button.hidden) return;
    button.hidden = false;
    refresh();
    timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, REFRESH_MS);
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  document.getElementById('orbitNotificationsClose').addEventListener('click', () => { close(); button.focus(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) { close(); button.focus(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && timer) refresh(); });

  // The orbit shows "sign out" once someone is signed in; notifications follow it.
  if (!signOut.hidden) start();
  new MutationObserver(() => { if (!signOut.hidden) start(); }).observe(signOut, { attributes: true, attributeFilter: ['hidden'] });
})();
