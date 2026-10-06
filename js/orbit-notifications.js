// Notifications tab: tells you when someone starts orbiting (following) you,
// and reminds new people of setup steps they haven't finished until they do them or ignore them.
(() => {
  const button = document.getElementById('openOrbitNotifications');
  const badge = document.getElementById('orbitNotificationsBadge');
  const panel = document.getElementById('orbitNotifications');
  const list = document.getElementById('orbitNotificationsList');
  const status = document.getElementById('orbitNotificationsStatus');
  const tipsSection = document.getElementById('orbitSetupTips');
  const tipsList = document.getElementById('orbitSetupTipsList');
  const signOut = document.getElementById('signOutOrbit');
  const REFRESH_MS = 90 * 1000;
  let items = [];
  let tips = [];
  let timer = 0;
  let loading = false;
  let again = false;
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
    const unread = items.filter((item) => item.unread).length + tips.length;
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    button.setAttribute('aria-label', unread ? `Notifications, ${unread} new` : 'Notifications');
  }

  async function loadTips() {
    const checklist = window.OrbitSetup?.checklist?.() || [];
    const [dismissed, discovery] = await Promise.all([
      api().listDismissedSetupTips(),
      api().getDiscoverySettings().catch(() => ({ discoverable: true }))
    ]);
    if (!discovery.discoverable) checklist.push({ id: 'findable', text: 'Friends can’t find you in search yet.', action: 'make me findable' });
    tips = checklist.filter((tip) => !dismissed.includes(tip.id));
  }

  function renderTips() {
    tipsList.replaceChildren();
    tipsSection.hidden = !tips.length;
    for (const tip of tips) {
      const row = document.createElement('li');
      row.className = 'orbit-notifications__item orbit-setup-tip';
      const text = document.createElement('p');
      text.textContent = tip.text;
      const actions = document.createElement('div');
      actions.className = 'orbit-setup-tip__actions';
      const go = document.createElement('button');
      go.type = 'button';
      go.textContent = tip.action;
      go.addEventListener('click', () => doTip(tip, go));
      const ignore = document.createElement('button');
      ignore.type = 'button';
      ignore.className = 'orbit-setup-tip__ignore';
      ignore.textContent = 'ignore';
      ignore.setAttribute('aria-label', `Ignore: ${tip.text}`);
      ignore.addEventListener('click', () => ignoreTip(tip, ignore));
      actions.append(go);
      if (tip.learn) {
        // A page to read what the moves are before trying them: Resources, at its hand-control guide.
        const learn = document.createElement('button');
        learn.type = 'button';
        learn.className = 'orbit-setup-tip__learn';
        learn.textContent = tip.learn;
        learn.addEventListener('click', () => {
          close();
          document.getElementById('openOrbitResources')?.click();
          const guide = document.getElementById('resourcesHandControl');
          if (guide) guide.open = true;  // they came to read it, so it opens already
          window.setTimeout(() => guide?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 100);
        });
        actions.append(learn);
      }
      actions.append(ignore);
      row.append(text, actions);
      tipsList.append(row);
    }
  }

  async function doTip(tip, control) {
    if (tip.id === 'findable') {
      control.disabled = true;
      try {
        await api().setDiscoverable(true);
        tips = tips.filter((entry) => entry.id !== tip.id);
        renderTips();
        renderBadge();
        status.textContent = 'People can now find you by your username.';
      } catch (error) {
        control.disabled = false;
        status.textContent = error.message || 'Could not change that right now.';
      }
      return;
    }
    close();
    if (tip.hands) {
      // The ✦ star's own intro explains the camera and asks before starting.
      document.getElementById('portalStarBtn')?.click();
      return;
    }
    if (tip.account) {
      // Account details live in the account dialog: open it with the username ready to change.
      document.getElementById('openAccountSettings')?.click();
      window.setTimeout(() => { const field = document.getElementById('settingsUsername'); field?.focus(); field?.select(); }, 600);
      return;
    }
    window.OrbitSetup.openStep(tip.step, tip.focus);
  }

  async function ignoreTip(tip, control) {
    control.disabled = true;
    try {
      await api().dismissSetupTip(tip.id);
      tips = tips.filter((entry) => entry.id !== tip.id);
      renderTips();
      renderBadge();
    } catch (error) {
      control.disabled = false;
      status.textContent = error.message || 'Could not ignore that right now.';
    }
  }

  function renderList() {
    renderTips();
    list.replaceChildren();
    status.textContent = items.length || tips.length ? '' : 'No one has started orbiting you yet. When someone does, they show up here.';
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
    if (!api()?.listNotifications) return;
    if (loading) { again = true; return; }
    loading = true;
    try {
      const [follows] = await Promise.all([api().listNotifications(), loadTips().catch(() => {})]);
      items = follows;
      renderBadge();
      if (!panel.hidden) renderList();
    } catch (error) {
      if (!panel.hidden) status.textContent = error.message || 'Notifications could not load. Try again soon.';
    } finally {
      loading = false;
      if (again) { again = false; refresh(); }
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
      // Keep the dots visible while the panel is open; follows leave the badge now.
      // Setup reminders stay counted until they are done or ignored.
      items = items.map((item) => ({ ...item, unread: false }));
      renderBadge();
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
  window.addEventListener('orbit:setup-changed', () => { if (timer) refresh(); });
  // Once someone has actually entered hand control, the reminder has done its job.
  window.addEventListener('orbit:enter', async () => {
    if (!tips.some((tip) => tip.id === 'hand_control')) return;
    try { await api().dismissSetupTip('hand_control'); } catch (_) { return; }
    tips = tips.filter((tip) => tip.id !== 'hand_control');
    renderTips();
    renderBadge();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && timer) refresh(); });

  // The orbit shows "sign out" once someone is signed in; notifications follow it.
  if (!signOut.hidden) start();
  new MutationObserver(() => { if (!signOut.hidden) start(); }).observe(signOut, { attributes: true, attributeFilter: ['hidden'] });
})();
