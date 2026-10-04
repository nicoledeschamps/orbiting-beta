(() => {
  const api = window.OrbitingAccount;
  const dialog = document.getElementById('accountSettingsDialog');
  const status = document.getElementById('accountSettingsMessage');
  const username = document.getElementById('settingsUsername');
  const nameFields = document.getElementById('usernameSettingsFields');
  const passwordFields = document.getElementById('passwordSettingsFields');
  const resend = document.getElementById('settingsResendEmail');
  const visibilityControls = [...passwordFields.querySelectorAll('input[type="password"]')].map(input => {
    const wrapper = document.createElement('div');
    wrapper.className = 'account-password-input';
    input.before(wrapper);
    wrapper.append(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-eye';
    button.setAttribute('aria-controls', input.id);
    const name = document.querySelector(`label[for="${input.id}"]`).textContent.toLowerCase();
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg>';
    const setVisible = visible => {
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${name}`);
      button.setAttribute('aria-pressed', String(visible));
      button.title = `${visible ? 'Hide' : 'Show'} password`;
    };
    setVisible(false);
    button.addEventListener('click', () => setVisible(input.type === 'password'));
    wrapper.append(button);
    return () => setVisible(false);
  });
  document.getElementById('passwordSettingsForm').addEventListener('reset', () => visibilityControls.forEach(hide => hide()));
  let account = null, busy = false;
  const setBusy = value => { busy = value; nameFields.disabled = value || !account; passwordFields.disabled = value || !account; resend.disabled = value; };
  async function load() {
    account = null; setBusy(true); status.textContent = 'Loading your account…';
    try {
      const session = await api.getSession();
      if (session) {
        account = await api.getAccountSettings();
        username.value = account.username;
        document.getElementById('settingsEmail').textContent = account.email;
        document.getElementById('settingsEmailStatus').textContent = account.verified ? 'Email confirmed' : 'Email not yet confirmed';
        resend.hidden = account.verified;
        status.textContent = '';
      } else {
        const pending = api.getPendingSignup();
        username.value = '';
        document.getElementById('settingsEmail').textContent = pending?.email || 'Not signed in';
        document.getElementById('settingsEmailStatus').textContent = pending ? 'Email not yet confirmed' : '';
        resend.hidden = !pending;
        status.textContent = pending ? 'Confirm your email and sign in to change your username or password.' : 'Sign in to manage your account.';
      }
    } catch (error) { status.textContent = error.message || 'Couldn’t load your account. Close and reopen this panel to try again.'; resend.hidden = true; }
    finally { setBusy(false); }
  }
  document.getElementById('openAccountSettings').addEventListener('click', () => { dialog.showModal(); load(); });
  document.getElementById('closeAccountSettings').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { document.getElementById('passwordSettingsForm').reset(); });
  document.getElementById('usernameSettingsForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !account) return;
    setBusy(true); status.textContent = 'Saving your username…';
    try {
      const saved = await api.updateUsername(username.value, account.userId);
      username.value = saved; account = { ...account, username: saved };
      document.getElementById('accountUsername').value = saved;
      status.textContent = 'Username updated.';
    } catch (error) { status.textContent = error.message || 'Couldn’t update your username.'; }
    finally { setBusy(false); }
  });
  document.getElementById('passwordSettingsForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !account) return;
    const current = document.getElementById('settingsCurrentPassword');
    const next = document.getElementById('settingsNewPassword');
    const repeat = document.getElementById('settingsRepeatPassword');
    if (next.value !== repeat.value) { status.textContent = 'The new passwords do not match.'; repeat.focus(); return; }
    setBusy(true); status.textContent = 'Updating your password…';
    try {
      await api.updateAccountPassword(current.value, next.value, account.userId);
      event.target.reset(); status.textContent = 'Password updated. Use your new password the next time you log in.';
    } catch (error) { status.textContent = error.message || 'Couldn’t update your password. Please sign in again and retry.'; }
    finally { setBusy(false); }
  });
  resend.addEventListener('click', async () => {
    if (busy) return;
    const email = account?.email || api.getPendingSignup()?.email;
    if (!email) return;
    setBusy(true); status.textContent = 'Requesting confirmation…';
    try { await api.resendVerification(email); status.textContent = 'Confirmation requested. Check your inbox and spam. During the beta, contact Nicole if it doesn’t arrive.'; }
    catch (error) { status.textContent = error.message || 'Couldn’t resend confirmation. Please try again later.'; }
    finally { setBusy(false); }
  });
})();
