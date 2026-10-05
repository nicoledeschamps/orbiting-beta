// Rotating orbit-themed lines while "Opening your orbit…" is on screen.
// The static #profileLoadingMessage stays the accessible status; the rotating line is decorative.
(() => {
  const LINES = [
    'Opening your orbit…',
    'Waking up the sky…',
    'Gathering what orbits you…',
    'Pulling your rings into place…',
    'Lining up your stars…',
    'Calling your images home…',
    'Finding your gravity…',
    'Tracing your constellations…',
    'Almost in orbit…'
  ];
  const ROTATE_MS = 2600;
  const FADE_MS = 350;
  const screen = document.getElementById('profileLoading');
  const message = document.getElementById('profileLoadingMessage');
  const retry = document.getElementById('retryProfileLoad');
  if (!screen || !message) return;

  const line = document.createElement('p');
  line.id = 'profileLoadingLine';
  line.className = 'profile-loading__line';
  line.setAttribute('aria-hidden', 'true');
  screen.insertBefore(line, message);

  let timer = null;
  let next = 0;
  let progress = null;

  function show(text) {
    line.classList.add('is-swapping');
    setTimeout(() => { line.textContent = text; line.classList.remove('is-swapping'); }, FADE_MS);
  }
  function tick() {
    if (progress && progress.done < progress.total) {
      line.textContent = `Bringing your photos home · ${progress.done} of ${progress.total}`;
      return;
    }
    show(LINES[next]);
    next = next === LINES.length - 1 ? 1 : next + 1;
  }
  function start() {
    if (timer) return;
    screen.classList.add('is-cycling');
    line.textContent = LINES[0];
    next = 1;
    timer = setInterval(tick, ROTATE_MS);
  }
  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    screen.classList.remove('is-cycling');
  }
  function sync() {
    const failed = retry && !retry.hidden;
    if (screen.hidden || failed) stop(); else start();
  }

  window.addEventListener('orbiting:media-progress', (event) => {
    const { done, total } = event.detail || {};
    if (!Number.isInteger(done) || !Number.isInteger(total) || total < 3) return;
    progress = { done, total };
    if (timer) line.textContent = done < total ? `Bringing your photos home · ${done} of ${total}` : 'Almost in orbit…';
  });
  const observer = new MutationObserver(sync);
  observer.observe(screen, { attributes: true, attributeFilter: ['hidden'] });
  if (retry) observer.observe(retry, { attributes: true, attributeFilter: ['hidden'] });
  sync();
})();
