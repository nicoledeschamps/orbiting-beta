(() => {
  const status = document.getElementById('accessStatus');
  const form = document.getElementById('accessForm');
  const button = document.getElementById('savePassword');
  (async () => {
    try {
      await window.OrbitingAccount.isConfigured();
      const session = await window.OrbitingAccount.getSession();
      if (!session) throw new Error('This link has expired or was already used. Ask for a fresh account link.');
      status.textContent = `Choose a password for ${session.user.email}. Use at least 8 characters.`;
      form.hidden = false;
    } catch (error) { status.textContent = error.message; }
  })();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('newPassword');
    const repeat = document.getElementById('repeatPassword');
    if (password.value !== repeat.value) { status.textContent = 'The passwords do not match.'; repeat.focus(); return; }
    button.disabled = true;
    try {
      await window.OrbitingAccount.finishAccountAccess(password.value);
      password.value = ''; repeat.value = '';
      window.location.replace('./');
    } catch (error) { status.textContent = error.message || 'Your password could not be saved.'; button.disabled = false; }
  });
})();
