(() => {
  const account = window.OrbitingAccount;
  const form = document.getElementById('loginForm');
  const email = document.getElementById('loginEmail');
  const password = document.getElementById('loginPassword');
  const submit = document.getElementById('loginSubmit');
  const status = document.getElementById('loginStatus');
  const forgot = document.getElementById('forgotPassword');
  let busy = false;
  const setBusy = value => { busy = value; submit.disabled = value; forgot.disabled = value; };
  document.getElementById('togglePassword').addEventListener('click', event => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Hide' : 'Show';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); status.textContent = 'Opening your orbit…';
    try {
      await account.signIn({ email: email.value, password: password.value });
      password.value = '';
      window.location.replace('./?view=profile');
    } catch (error) {
      status.textContent = error.message || 'We couldn’t log you in. Please try again.';
      setBusy(false);
    }
  });
  forgot.addEventListener('click', async () => {
    if (busy) return;
    if (!email.value || !email.reportValidity()) { email.focus(); status.textContent = 'Enter your account email first.'; return; }
    setBusy(true); status.textContent = 'Requesting a password reset…';
    try {
      await account.resetPassword(email.value);
      status.textContent = 'Reset requested. Check your inbox. During the beta, contact Nicole if the email doesn’t arrive.';
    } catch (error) { status.textContent = error.message || 'Couldn’t request a reset. Please try again.'; }
    finally { setBusy(false); }
  });
  setBusy(true);
  account.isConfigured().then(async configured => {
    if (!configured) throw new Error('Account sign-in is unavailable right now. Please try again later.');
    if (await account.getSession()) { window.location.replace('./?view=profile'); return; }
    if (await account.isInviteOnly()) {
      document.getElementById('inviteNote').textContent = 'Orbiting is invite-only for now. Use the personal setup link from your invitation to choose a password.';
    } else document.getElementById('newAccount').hidden = false;
    setBusy(false);
  }).catch(error => { status.textContent = error.message || 'Couldn’t connect. Please reload to try again.'; });
})();
