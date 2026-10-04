/* Shared sky: one visible constellation per zodiac sign, with contributor names. */
(() => {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const positions = [
    [14, 14, -12], [40, 11, 10], [72, 14, -7], [88, 30, 18],
    [78, 51, -16], [89, 73, 5], [67, 84, 13], [42, 87, -10],
    [18, 79, 16], [12, 58, -5], [24, 37, 8], [58, 31, -14]
  ];
  const svgNS = 'http://www.w3.org/2000/svg';

  function merge(people) {
    const bySign = new Map();
    people.forEach(({ name, constellations }) => {
      if (!name || !Array.isArray(constellations)) return;
      const unique = new Set(constellations.filter((sign) => signs.includes(sign)));
      unique.forEach((sign) => {
        if (!bySign.has(sign)) bySign.set(sign, new Set());
        bySign.get(sign).add(name);
      });
    });
    return signs.filter((sign) => bySign.has(sign))
      .map((sign) => ({ sign, names: [...bySign.get(sign)] }));
  }

  function shape(sign) {
    const seed = [...sign].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return Array.from({ length: 5 }, (_, index) => ({
      x: 9 + ((seed * (index + 3) + index * 21) % 83),
      y: 11 + ((seed * (index + 5) + index * 17) % 64)
    }));
  }

  function render(container, people) {
    const entries = merge(people);
    const fragment = document.createDocumentFragment();
    entries.forEach(({ sign, names }) => {
      const [left, top, rotation] = positions[signs.indexOf(sign)];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shared-sky__constellation';
      button.style.left = `${left}%`;
      button.style.top = `${top}%`;
      button.style.transform = 'translate(-50%,-50%)';
      button.style.setProperty('--shared-tip-shift', left > 65 ? '-78%' : left < 35 ? '-22%' : '-50%');
      button.setAttribute('aria-label', `${sign} constellation · ${names.join(', ')}`);

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 110 80');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.transform = `rotate(${rotation}deg)`;
      const points = shape(sign);
      points.forEach((point, index) => {
        if (index) {
          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', String(points[index - 1].x));
          line.setAttribute('y1', String(points[index - 1].y));
          line.setAttribute('x2', String(point.x));
          line.setAttribute('y2', String(point.y));
          svg.append(line);
        }
        const star = document.createElementNS(svgNS, 'circle');
        star.setAttribute('cx', String(point.x));
        star.setAttribute('cy', String(point.y));
        star.setAttribute('r', names.length > 1 ? '1.9' : '1.4');
        svg.append(star);
      });
      const tooltip = document.createElement('span');
      tooltip.className = 'shared-sky__tooltip';
      tooltip.textContent = `${sign} · ${names.join(' + ')}`;
      button.append(svg, tooltip);
      button.addEventListener('click', () => {
        const wasOpen = button.classList.contains('is-open');
        container.querySelectorAll('.shared-sky__constellation.is-open')
          .forEach((item) => item.classList.remove('is-open'));
        button.classList.toggle('is-open', !wasOpen);
      });
      fragment.append(button);
    });
    container.replaceChildren(fragment);
    return entries;
  }

  window.OrbitingSharedSky = { merge, render };
})();
