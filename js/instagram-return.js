// Instagram sends people back here after they allow Orbiting. Finish the connection, tell the Orbiting
// tab that started it (through storage), then close this tab or offer a way back.
(() => {
  const status = document.getElementById('instagramStatus');
  const back = document.getElementById('instagramBack');
  const params = new URLSearchParams(window.location.search);
  // Keep the one-time code out of the address bar and history.
  window.history.replaceState(null, '', window.location.pathname);
  (async () => {
    try {
      await window.OrbitingAccount.isConfigured();
      if (!await window.OrbitingAccount.getSession()) throw new Error('Sign in to Orbit first, then connect Instagram again from your sources.');
      const result = await window.OrbitingAccount.finishInstagramConnect(params);
      status.textContent = `Connected${result.username ? ` as @${result.username}` : ''}. Your posts are joining your orbit; you can close this tab.`;
      back.textContent = 'Back to Orbit';
      setTimeout(() => window.close(), 1500);
    } catch (error) {
      status.textContent = error.message || 'Instagram did not connect. Try again from your sources.';
    }
  })();
})();
