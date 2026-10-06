/* Shared sky: one constellation per zodiac sign. Each carries whose placements sit in it and
   what they mean, and lights up when you share a sign with someone. */
(() => {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const zodiacThemes = {
    Aries: 'beginnings · courage · action', Taurus: 'comfort · devotion · the senses',
    Gemini: 'curiosity · conversation · duality', Cancer: 'belonging · memory · care',
    Leo: 'expression · play · being seen', Virgo: 'craft · care · attention',
    Libra: 'balance · beauty · relationships', Scorpio: 'depth · trust · transformation',
    Sagittarius: 'freedom · discovery · belief', Capricorn: 'ambition · structure · legacy',
    Aquarius: 'community · originality · possibility', Pisces: 'dreams · empathy · imagination'
  };
  const placementMeanings = {
    Sun: 'identity · vitality · life force',
    Moon: 'emotion · instinct · inner self',
    Rising: 'first impression · approach · becoming',
    Mercury: 'mind · language · communication',
    Venus: 'love · beauty · values',
    Mars: 'drive · desire · action',
    Jupiter: 'growth · belief · expansion',
    Saturn: 'discipline · limits · lessons',
    Uranus: 'freedom · disruption · invention',
    Neptune: 'dreams · intuition · imagination',
    Pluto: 'power · depth · transformation',
    'North Node': 'growth edge · direction · purpose',
    'South Node': 'familiar patterns · inherited gifts',
    Chiron: 'tenderness · wound · healing',
    Midheaven: 'public life · calling · reputation',
    Descendant: 'partnership · attraction · the other',
    IC: 'roots · home · private foundation',
    Lilith: 'autonomy · shadow · raw desire',
    'Part of Fortune': 'ease · joy · natural flow',
    Vertex: 'fated encounters · turning points'
  };
  const elements = { Aries: 'fire', Leo: 'fire', Sagittarius: 'fire', Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
    Gemini: 'air', Libra: 'air', Aquarius: 'air', Cancer: 'water', Scorpio: 'water', Pisces: 'water' };
  const positions = [
    [14, 14, -12], [40, 11, 10], [72, 14, -7], [88, 30, 18],
    [78, 51, -16], [89, 73, 5], [67, 84, 13], [42, 87, -10],
    [18, 79, 16], [12, 58, -5], [24, 37, 8], [58, 31, -14]
  ];
  const svgNS = 'http://www.w3.org/2000/svg';

  // A person's placements grouped by sign. Older shares only list signs, so those keep a sign with no placements.
  function placementsBySign(person) {
    const bySign = new Map();
    const placements = Array.isArray(person.placements) ? person.placements : [];
    placements.forEach(({ name, sign }) => {
      if (!signs.includes(sign) || !placementMeanings[name]) return;
      if (!bySign.has(sign)) bySign.set(sign, []);
      if (!bySign.get(sign).includes(name)) bySign.get(sign).push(name);
    });
    (Array.isArray(person.constellations) ? person.constellations : []).forEach((sign) => {
      if (signs.includes(sign) && !bySign.has(sign)) bySign.set(sign, []);
    });
    return bySign;
  }

  function merge(people) {
    const bySign = new Map();
    people.forEach((person) => {
      if (!person?.name) return;
      placementsBySign(person).forEach((names, sign) => {
        if (!bySign.has(sign)) bySign.set(sign, []);
        bySign.get(sign).push({ name: person.name, self: Boolean(person.self), placements: names });
      });
    });
    return signs.filter((sign) => bySign.has(sign)).map((sign) => ({ sign, people: bySign.get(sign), names: bySign.get(sign).map((entry) => entry.name) }));
  }

  function shape(sign) {
    const seed = [...sign].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return Array.from({ length: 5 }, (_, index) => ({
      x: 9 + ((seed * (index + 3) + index * 21) % 83),
      y: 11 + ((seed * (index + 5) + index * 17) % 64)
    }));
  }

  function line(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  const listNames = (names) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

  // The card a constellation opens: the sign's themes, each person's placements in it and what they mean,
  // and what you share with them.
  function card(sign, people, selfInSign) {
    const box = document.createElement('span');
    box.className = 'shared-sky__tooltip';
    box.append(line('strong', 'shared-sky__sign', sign), line('small', 'shared-sky__themes', `${elements[sign]} · ${zodiacThemes[sign]}`));
    people.filter((person) => !person.self).forEach((person) => {
      const who = line('span', 'shared-sky__person', person.name);
      box.append(who);
      if (!person.placements.length) { box.append(line('span', 'shared-sky__meaning', `${sign} is in their chart.`)); return; }
      person.placements.forEach((name) => box.append(line('span', 'shared-sky__meaning', `${name} in ${sign}: ${placementMeanings[name]}, through ${zodiacThemes[sign]}.`)));
    });
    const self = selfInSign || people.find((person) => person.self);
    const others = people.filter((person) => !person.self);
    if (self) {
      const mine = self.placements.length ? `your ${listNames(self.placements)}` : `your chart`;
      box.append(line('span', 'shared-sky__shared', others.length
        ? `You share ${sign}: ${mine}; ${others.map((person) => person.placements.length ? `${person.name}’s ${listNames(person.placements)}` : person.name).join('; ')}.`
        : `Your ${self.placements.length ? listNames(self.placements) : 'chart'} in ${sign}.`));
    }
    return box;
  }

  // options.self: your placements, used to mark shared signs without drawing your own stars (a friend's page).
  function render(container, people, options = {}) {
    const entries = merge(people);
    const selfBySign = options.self ? placementsBySign(options.self) : new Map();
    const fragment = document.createDocumentFragment();
    entries.forEach(({ sign, people: inSign, names }) => {
      const [left, top, rotation] = positions[signs.indexOf(sign)];
      const selfInSign = selfBySign.has(sign) ? { name: 'you', self: true, placements: selfBySign.get(sign) } : null;
      const shared = (selfInSign || inSign.some((person) => person.self)) && inSign.some((person) => !person.self);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `shared-sky__constellation shared-sky--${elements[sign]}${shared ? ' is-shared' : ''}${top < 45 ? ' opens-down' : ''}`;
      button.style.left = `${left}%`;
      button.style.top = `${top}%`;
      button.style.transform = 'translate(-50%,-50%)';
      button.style.setProperty('--shared-tip-shift', left > 65 ? '-78%' : left < 35 ? '-22%' : '-50%');
      button.setAttribute('aria-label', `${sign} constellation · ${names.join(', ')}${shared ? ' · shared with you' : ''}`);

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 110 80');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.transform = `rotate(${rotation}deg)`;
      const points = shape(sign);
      points.forEach((point, index) => {
        if (index) {
          const segment = document.createElementNS(svgNS, 'line');
          segment.setAttribute('x1', String(points[index - 1].x));
          segment.setAttribute('y1', String(points[index - 1].y));
          segment.setAttribute('x2', String(point.x));
          segment.setAttribute('y2', String(point.y));
          svg.append(segment);
        }
        const star = document.createElementNS(svgNS, 'circle');
        star.setAttribute('cx', String(point.x));
        star.setAttribute('cy', String(point.y));
        star.setAttribute('r', inSign.length > 1 || shared ? '1.9' : '1.4');
        svg.append(star);
      });
      const label = line('span', 'shared-sky__label', shared ? `${sign} · shared` : sign);
      button.append(svg, label, card(sign, inSign, selfInSign));
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

  window.OrbitingSharedSky = { merge, render, zodiacThemes, placementMeanings, elements };
})();
