/* ============================================ */
/* HUES OF SATURN — Main JavaScript             */
/* ============================================ */

(function() {
'use strict';

gsap.registerPlugin(ScrollTrigger);

// Force scroll to top on load
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ── Utility ──────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ── Accessibility ──────────────────────────────
var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mobile breakpoints ──────────────────────
var isMobile = window.matchMedia('(max-width: 767px)').matches;
var isPhone = window.matchMedia('(max-width: 599px)').matches;
var isTouch = window.matchMedia('(hover: none)').matches;
// Re-evaluate on resize — rebuild gallery if breakpoint changes
var _prevMobile = isMobile;
var _prevPhone = isPhone;
var _resizeTimer = null;
window.addEventListener('resize', function() {
  isMobile = window.matchMedia('(max-width: 767px)').matches;
  isPhone = window.matchMedia('(max-width: 599px)').matches;
  isTouch = window.matchMedia('(hover: none)').matches;
  // Debounced gallery rebuild when breakpoint actually changes
  if (isMobile !== _prevMobile || isPhone !== _prevPhone) {
    _prevMobile = isMobile;
    _prevPhone = isPhone;
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
      // Three.js gallery handles its own resize via internal ResizeObserver
    }, 250);
  }
});

// ============================================
// STARS & SPARKLES
// ============================================
function createStars(container, count, tintBlue) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = tintBlue ? 'void-star' : 'star';
    const size = Math.random() * 2 + 1;
    star.style.cssText =
      'width:' + size + 'px;height:' + size + 'px;' +
      'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
      '--duration:' + (Math.random() * 3 + 2) + 's;' +
      '--delay:' + (Math.random() * 3) + 's;';
    container.appendChild(star);
  }
}

function createSparkles() {
  var container = document.getElementById('sparkles');
  var chars = ['+', '\u2726', '\u2727', '\u00B7'];
  for (let i = 0; i < 12; i++) {
    var s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    s.style.cssText =
      'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;' +
      '--size:' + (Math.random() * 14 + 8) + 'px;' +
      '--duration:' + (Math.random() * 4 + 3) + 's;' +
      '--delay:' + (Math.random() * 4) + 's;';
    container.appendChild(s);
  }
}

// Hero stars
createStars(document.getElementById('stars'), isPhone ? 40 : (isMobile ? 60 : 100), false);
createSparkles();

// (void stars removed — crack now uses light-through-wall approach)

// ============================================
// HERO — fade on scroll
// ============================================
gsap.to('#hero', {
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
  },
  opacity: 0,
  y: -80,
});

// ============================================
// RING IMAGE PREVIEW (hover overlay)
// ============================================
var ringPreview = document.createElement('div');
ringPreview.className = 'ring-preview';
ringPreview.innerHTML = '<img /><video muted loop playsinline style="display:none"></video>';
document.body.appendChild(ringPreview);

function showRingPreview(src, rect, isVideo) {
  var img = ringPreview.querySelector('img');
  var vid = ringPreview.querySelector('video');
  if (isVideo) {
    img.style.display = 'none';
    vid.style.display = 'block';
    vid.src = src;
    vid.play().catch(function() {});
  } else {
    vid.style.display = 'none';
    vid.pause();
    img.style.display = 'block';
    img.src = src;
  }
  // Position near the hovered image, centered
  var size = 200;
  var x = rect.left + rect.width / 2 - size / 2;
  var y = rect.top + rect.height / 2 - size / 2;
  // Keep on screen
  x = Math.max(10, Math.min(window.innerWidth - size - 10, x));
  y = Math.max(10, Math.min(window.innerHeight - size - 10, y));
  ringPreview.style.left = x + 'px';
  ringPreview.style.top = y + 'px';
  ringPreview.style.width = size + 'px';
  ringPreview.style.height = size + 'px';
  ringPreview.classList.add('visible');
}

function hideRingPreview() {
  ringPreview.classList.remove('visible');
}

// ── Ring image lightbox (tap to view) ──
var ringLightbox = document.createElement('div');
ringLightbox.className = 'ring-lightbox';
ringLightbox.innerHTML =
  '<div class="ring-lightbox-wrap">' +
    '<button class="ring-lightbox-close" type="button" aria-label="Close image">×</button>' +
    '<div class="ring-lightbox-inner"><img /><video muted loop playsinline style="display:none"></video></div>' +
    '<div class="ring-lightbox-context"><strong></strong><p></p></div>' +
    '<a class="ring-lightbox-board" href="#" target="_blank" rel="noopener">view board →</a>' +
  '</div>';
document.body.appendChild(ringLightbox);

var boardLink = ringLightbox.querySelector('.ring-lightbox-board');
var lightboxCloseBtn = ringLightbox.querySelector('.ring-lightbox-close');
ringLightbox.prepend(lightboxCloseBtn);
lightboxCloseBtn.textContent = '× Close';
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && ringLightbox.classList.contains('visible')) closeRingLightbox();
});

ringLightbox.addEventListener('click', function(e) {
  // Don't close if clicking the board link
  if (e.target === boardLink || boardLink.contains(e.target)) return;
  closeRingLightbox();
});

lightboxCloseBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  closeRingLightbox();
});

function openRingLightbox(src, isVideo, source, boardUrl, metadata) {
  metadata = metadata || {};
  var context = ringLightbox.querySelector('.ring-lightbox-context');
  context.querySelector('strong').textContent = metadata.title || metadata.alt || '';
  context.querySelector('p').textContent = [metadata.boardName || metadata.collection || source, metadata.description || metadata.context].filter(Boolean).join(' · ');
  boardLink.textContent = metadata.boardName || metadata.collection ? 'view ' + (metadata.boardName || metadata.collection) + ' →' : 'view board →';
  var img = ringLightbox.querySelector('img');
  var vid = ringLightbox.querySelector('video');
  if (isVideo) {
    img.style.display = 'none';
    vid.style.display = 'block';
    vid.src = src;
    vid.play().catch(function() {});
  } else {
    vid.style.display = 'none';
    vid.pause();
    img.style.display = 'block';
    img.src = src;
  }
  // Show board link for arena/cosmos sources with direct URL
  if (boardUrl) {
    boardLink.href = boardUrl;
    boardLink.style.display = '';
  } else {
    boardLink.style.display = 'none';
  }
  ringLightbox.classList.add('visible');
}

function closeRingLightbox() {
  ringLightbox.classList.remove('visible');
  var vid = ringLightbox.querySelector('video');
  if (vid) vid.pause();
  try { window.dispatchEvent(new CustomEvent('ring-lightbox:close')); } catch (e) {}
}

// Expose for other modules (e.g., immersive-orbit.js pinch-to-open)
window.openRingLightbox  = openRingLightbox;
window.closeRingLightbox = closeRingLightbox;

// ============================================
// SATURN — Dual Inspiration Rings
// ============================================
function ringMedia(img, wrapper) {
  var media;
  if (img.isVideo) {
    media = document.createElement('video');
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.autoplay = true;
    media.preload = 'metadata';
    media.setAttribute('playsinline', '');
    media.setAttribute('muted', '');
    media.addEventListener('loadeddata', function() { media.play().catch(function() {}); }, { once: true });
  } else {
    media = document.createElement('img');
    media.alt = img.alt || 'Inspiration';
    media.loading = 'eager';
    media.decoding = 'async';
  }
  media.onload = function() { wrapper.style.display = ''; };
  media.onerror = function() { wrapper.style.display = 'none'; };
  media.src = img.src;
  return media;
}

function buildRing(images, backEl, frontEl, radius, sizeRange, speedRange, allImages, options) {
  if (!backEl || !frontEl || !images || images.length === 0) return;
  options = options || {};

  // Keep every ring image in rotation, including images that were visible first.
  var pool = (allImages && allImages.length > images.length) ? allImages.slice(images.length) : [];
  var poolIndex = 0;

  var goldenAngle = 137.508;
  var items = [];

  images.forEach(function(img, i) {
    var angle = (i * goldenAngle + (options.startAngle || 0)) % 360;
    var sizeMult = isMobile ? 0.65 : 1;
    var imgSize = (sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])) * sizeMult * (options.sizeScale || 1);
    var opacity = 0.7 + Math.random() * 0.3;

    var wrapper = document.createElement('div');
    wrapper.className = 'ring-image';
    wrapper.dataset.baseAngle = angle;
    wrapper.style.setProperty('--angle', angle);
    wrapper.style.setProperty('--radius', radius);
    wrapper.style.setProperty('--img-size', imgSize);
    wrapper.style.setProperty('--img-opacity', opacity);

    var mediaEl = ringMedia(img, wrapper);

    wrapper.appendChild(mediaEl);
    wrapper._hovered = false;
    wrapper._mediaEl = mediaEl;
    wrapper._source = img.source || 'art';
    wrapper._isVideo = img.isVideo || false;
    wrapper._boardUrl = img.boardUrl || '';
    wrapper._metadata = img;

    // Hover — show enlarged preview outside the 3D context
    wrapper.addEventListener('mouseenter', function() {
      if (options.previewOnly) return;
      if (isTouch) return;
      wrapper._hovered = true;
      var rect = wrapper._mediaEl.getBoundingClientRect();
      showRingPreview(wrapper._mediaEl.src, rect, wrapper._isVideo);
    });
    wrapper.addEventListener('mouseleave', function() {
      wrapper._hovered = false;
      hideRingPreview();
    });

    // Click/tap — open lightbox
    wrapper.addEventListener('click', function(e) {
      if (options.previewOnly) return;
      e.stopPropagation();
      openRingLightbox(wrapper._mediaEl.src || wrapper._mediaEl.currentSrc, wrapper._isVideo, wrapper._source, wrapper._boardUrl, wrapper._metadata);
    });
    wrapper.style.cursor = options.previewOnly ? 'default' : 'pointer';

    if (angle >= 0 && angle < 180) {
      backEl.appendChild(wrapper);
    } else {
      frontEl.appendChild(wrapper);
    }

    items.push({ wrapper: wrapper, baseAngle: angle, image: img });
  });

  // Single tween per ring — batch-update all items from shared phase
  if (prefersReducedMotion || items.length === 0) return;
  var ringPhase = { angle: 0 };
  var avgDuration = (speedRange[0] + speedRange[1]) / 2;
  // Ring identity for immersive-orbit spin offset lookup
  var ringId = backEl.dataset.orbitRingIndex !== undefined ? 'personal-' + backEl.dataset.orbitRingIndex
             : backEl.classList.contains('ring-art') ? 'art'
             : backEl.classList.contains('ring-arena') ? 'arena'
             : backEl.classList.contains('ring-cosmos') ? 'cosmos' : null;
  if (!options.previewOnly && ringId) {
    window.ImmersiveOrbit = window.ImmersiveOrbit || { ringSpinDeg: {} };
    window.ImmersiveOrbit.ringSpinRates = window.ImmersiveOrbit.ringSpinRates || {};
    window.ImmersiveOrbit.ringSpinDeg[ringId] = window.ImmersiveOrbit.ringSpinDeg[ringId] || 0;
    var ringIndex = Number(backEl.dataset.orbitRingIndex);
    window.ImmersiveOrbit.ringSpinRates[ringId] = Number.isFinite(ringIndex)
      ? ([1, 0.7, 0.5][ringIndex] || 1 / (1 + ringIndex * 0.5))
      : ({ art: 1, arena: 0.7, cosmos: 0.5 }[ringId] || 1);
  }
  return gsap.to(ringPhase, {
    angle: 360,
    duration: avgDuration,
    repeat: -1,
    ease: 'none',
    onUpdate: function() {
      var spin = (!options.previewOnly && ringId && window.ImmersiveOrbit && window.ImmersiveOrbit.ringSpinDeg)
        ? (window.ImmersiveOrbit.ringSpinDeg[ringId] || 0) : 0;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.wrapper._hovered) continue;
        var current = (item.baseAngle + ringPhase.angle + spin) % 360;
        if (current < 0) current += 360;
        item.wrapper.style.setProperty('--angle', current);
        var shouldBeBack = (current >= 0 && current < 180);
        var isInBack = item.wrapper.parentElement === backEl;
        if (shouldBeBack && !isInBack) {
          // Crossing to back (behind Saturn) — exchange with the next waiting image.
          if (pool.length > 0 && !item.wrapper._hovered) {
            var slot = poolIndex % pool.length;
            var next = pool[slot];
            var media = item.wrapper._mediaEl;
            if (media.tagName !== (next.isVideo ? 'VIDEO' : 'IMG')) {
              if (media.tagName === 'VIDEO') media.pause();
              var replacement = ringMedia(next, item.wrapper);
              media.replaceWith(replacement);
              item.wrapper._mediaEl = replacement;
            } else {
              if (media.tagName === 'VIDEO') media.addEventListener('loadeddata', function() { media.play().catch(function() {}); }, { once: true });
              media.src = next.src;
              if (media.tagName === 'IMG') media.alt = next.alt || 'Inspiration';
              else media.play().catch(function() {});
            }
            item.wrapper.style.display = '';
            item.wrapper._boardUrl = next.boardUrl || '';
            item.wrapper._metadata = next;
            item.wrapper._source = next.source || 'art';
            item.wrapper._isVideo = !!next.isVideo;
            pool[slot] = item.image;
            item.image = next;
            poolIndex++;
          }
          backEl.appendChild(item.wrapper);
        } else if (!shouldBeBack && isInBack) {
          frontEl.appendChild(item.wrapper);
        }
      }
    }
  });
}

// The Orbiting setup preview reuses this exact Hues ring renderer.
var mainRingTweens = [];
// Same per-ring limits as the Hues of Saturn orbit; the innermost path holds fewer on small screens.
function personalRingVisibleImages(images, slotIndex) {
  var cap = slotIndex === 0 ? (isPhone ? 12 : (isMobile ? 18 : 45)) : (isPhone ? 18 : (isMobile ? 28 : 45));
  return images.slice(0, cap);
}
function ringRadiusRatio(index, count) {
  return count <= 3 ? [0.35, 0.52, 0.70][index] : 0.35 + index * (0.45 / Math.max(1, count - 1));
}
// Only rings with images take an orbital path, so an empty ring never leaves a gap.
function filledRingSlots(groups) {
  var count = groups.filter(function(group) { return group.length > 0; }).length;
  var next = 0;
  return groups.map(function(group) {
    return group.length > 0 ? { index: next++, count: count } : null;
  });
}
// Keep every orbital path inside a phone viewport, including four or more sources.
function fittedRingRadius(width, ratio, outerRatio) {
  var fit = isMobile ? Math.min(1, Math.max(0, window.innerWidth / 2 - 28) / (width * outerRatio)) : 1;
  return width * ratio * fit;
}
function setPersonalImages(rings) {
  window.HuesOrbit.personalSet = true;
  if (window.HuesOrbit.clearRingIsolation) window.HuesOrbit.clearRingIsolation();
  mainRingTweens.forEach(function(tween) { if (tween) tween.kill(); });
  mainRingTweens = [];
  if (window.ImmersiveOrbit) {
    window.ImmersiveOrbit.ringSpinDeg = {};
    window.ImmersiveOrbit.ringSpinRates = {};
  }
  document.querySelectorAll('#saturn .personal-ring-extra').forEach(function(el) { el.remove(); });
  var ids = [['artRingBack', 'artRingFront'], ['arenaRingBack', 'arenaRingFront'], ['cosmosRingBack', 'cosmosRingFront']];
  ids.forEach(function(pair) {
    document.getElementById(pair[0]).replaceChildren();
    document.getElementById(pair[1]).replaceChildren();
    delete document.getElementById(pair[0]).dataset.orbitRingIndex;
    delete document.getElementById(pair[1]).dataset.orbitRingIndex;
  });
  if (!rings.length) return;
  var groups = rings.map(function(ring) { return Array.isArray(ring.items) ? ring.items : []; });
  var width = document.getElementById('saturn').offsetWidth || 800;
  var slots = filledRingSlots(groups);
  groups.forEach(function(group, index) {
    var back;
    var front;
    if (index < ids.length) {
      back = document.getElementById(ids[index][0]);
      front = document.getElementById(ids[index][1]);
    } else {
      back = document.createElement('div');
      front = document.createElement('div');
      back.className = 'saturn-ring-back ring-art personal-ring-extra';
      front.className = 'saturn-ring-front ring-art personal-ring-extra';
      document.getElementById('saturn').append(back, front);
    }
    back.dataset.orbitRingIndex = String(index);
    front.dataset.orbitRingIndex = String(index);
    var slot = slots[index];
    if (!slot) return;
    // Match Hues of Saturn's three clearly separated orbital paths.
    var outerRatio = ringRadiusRatio(slot.count - 1, slot.count);
    var ratio = ringRadiusRatio(slot.index, slot.count);
    var radius = fittedRingRadius(width, ratio, outerRatio);
    back.dataset.outerRadiusRatio = front.dataset.outerRadiusRatio = String(outerRatio);
    back.dataset.radiusRatio = front.dataset.radiusRatio = String(ratio);
    mainRingTweens.push(buildRing(personalRingVisibleImages(group, slot.index), back, front,
      radius, [34, 48], [55 + slot.index * 20, 75 + slot.index * 20], group,
      { startAngle: slot.index * 120 % 360 }));
  });
}
window.HuesOrbit = { ringRadiusRatio: ringRadiusRatio, filledRingSlots: filledRingSlots, buildRing: buildRing, data: null, personalRingVisibleImages: personalRingVisibleImages, setPersonalImages: setPersonalImages, personalSet: false };

// Load and build all three rings
ArenaLoader.getAllImages().then(function(data) {
  window.HuesOrbit.data = data;
  window.dispatchEvent(new Event('hues-orbit:data-ready'));
  if (window.HuesOrbit.personalSet) return;
  var containerW = document.getElementById('saturn').offsetWidth || 800;
  var MAX_PER_RING = isPhone ? 18 : (isMobile ? 28 : 45);

  // Innermost ring — Your art + videos
  var artImages = GALLERY_ART.map(function(a) {
    return { src: a.src, alt: a.title, source: 'art' };
  });
  // Add BlobFX videos to the orbit
  var videoFiles = [
    { src: 'assets/art/compressed/blob-tracking-2026-03-19_131722-sm.mp4', alt: 'Hues of Dispositions I', source: 'art', isVideo: true },
    { src: 'assets/art/compressed/blob-tracking-2026-03-19_175436-sm.mp4', alt: 'Hues of Dispositions II', source: 'art', isVideo: true },
    { src: 'assets/art/compressed/blob-tracking-2026-03-23_172251-sm.mp4', alt: 'Hues of Dispositions III', source: 'art', isVideo: true },
  ];
  artImages = artImages.concat(videoFiles);
  // Pinterest removed for now
  var artCap = isPhone ? 12 : (isMobile ? 18 : artImages.length);
  mainRingTweens.push(buildRing(
    artImages.slice(0, artCap),
    document.getElementById('artRingBack'),
    document.getElementById('artRingFront'),
    fittedRingRadius(containerW, 0.35, 0.70),
    [38, 52],
    [50, 70],
    artImages
  ));

  // Middle ring — Are.na (clear gap from inner)
  mainRingTweens.push(buildRing(
    data.arena.slice(0, MAX_PER_RING),
    document.getElementById('arenaRingBack'),
    document.getElementById('arenaRingFront'),
    fittedRingRadius(containerW, 0.52, 0.70),
    [32, 46],
    [70, 100],
    data.arena
  ));

  // Outer ring — Cosmos (clear gap from middle)
  mainRingTweens.push(buildRing(
    data.cosmos.slice(0, MAX_PER_RING),
    document.getElementById('cosmosRingBack'),
    document.getElementById('cosmosRingFront'),
    fittedRingRadius(containerW, 0.70, 0.70),
    [35, 50],
    [120, 170],
    data.cosmos
  ));

  // Check if all rings are empty (resolved but no data)
  var totalImages = (data.arena || []).length + (data.cosmos || []).length;
  if (totalImages === 0) {
    var saturn = document.getElementById('saturn');
    if (saturn) saturn.classList.add('rings-failed');
  }
}).catch(function(err) {
  console.warn('[Rings] Failed to load inspiration data:', err);
  var saturn = document.getElementById('saturn');
  if (saturn) saturn.classList.add('rings-failed');
});

// B9: Recompute ring radii on container resize
var RING_RADIUS_MULTIPLIERS = { 'ring-art': 0.35, 'ring-arena': 0.52, 'ring-cosmos': 0.70 };
var saturnEl = document.getElementById('saturn');
if (saturnEl && typeof ResizeObserver !== 'undefined') {
  var ringResizeObs = new ResizeObserver(function(entries) {
    var newW = entries[0].contentRect.width || 800;
    Object.keys(RING_RADIUS_MULTIPLIERS).forEach(function(ringClass) {
      var r = newW * RING_RADIUS_MULTIPLIERS[ringClass];
      saturnEl.querySelectorAll('.' + ringClass + ' .ring-image').forEach(function(el) {
        var personalRatio = el.parentElement.dataset.radiusRatio;
        el.style.setProperty('--radius', fittedRingRadius(newW, personalRatio ? Number(personalRatio) : RING_RADIUS_MULTIPLIERS[ringClass], Number(el.parentElement.dataset.outerRadiusRatio) || 0.70));
      });
    });
  });
  ringResizeObs.observe(saturnEl);
}

// Pause ring videos when hero section is off-screen (single observer, not per-item)
var heroEl = document.getElementById('hero');
if (heroEl && typeof IntersectionObserver !== 'undefined') {
  new IntersectionObserver(function(entries) {
    var visible = entries[0].isIntersecting;
    document.querySelectorAll('.ring-image video').forEach(function(v) {
      if (visible) { v.play().catch(function(){}); }
      else { v.pause(); }
    });
  }).observe(heroEl);
}

// ============================================
// ORBIT KEY — "in my orbit" + radial chart + Saturn breathe
// ============================================
(function() {
  var orbitKey = document.getElementById('orbitKey');
  var trigger  = document.getElementById('orbitKeyTrigger');
  var chart    = document.getElementById('orbitKeyChart');
  if (!orbitKey || !trigger) return;

  var labels = function() { return chart ? chart.querySelectorAll('.orbit-chart-label') : []; };
  var arcs = function() { return chart ? chart.querySelectorAll('.orbit-arc') : []; };
  var saturnContainer = document.getElementById('saturn');
  var ringEls = function() { return saturnContainer ? saturnContainer.querySelectorAll('.saturn-ring-back, .saturn-ring-front') : []; };
  var activeRing = null;

  var RING_CLASS_MAP = {
    art:    'ring-art',
    arena:  'ring-arena',
    cosmos: 'ring-cosmos'
  };

  var ARC_CLASS_MAP = {
    art:    'orbit-arc--art',
    arena:  'orbit-arc--arena',
    cosmos: 'orbit-arc--cosmos'
  };

  // Clear all ring isolation
  function clearIsolation() {
    if (activeRing === null) return;
    activeRing = null;
    ringEls().forEach(function(el) {
      el.classList.remove('ring-dimmed', 'ring-highlighted');
    });
    labels().forEach(function(btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('dimmed');
    });
    arcs().forEach(function(arc) {
      arc.classList.remove('arc-active', 'arc-dimmed');
    });
  }
  window.HuesOrbit.clearRingIsolation = clearIsolation;

  // Toggle chart open/closed
  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    var wasOpen = orbitKey.classList.contains('open');
    orbitKey.classList.toggle('open');
    // Closing the chart restores all rings
    if (wasOpen) {
      clearIsolation();
      saturnBreathe();
    }
  });

  // Close chart when clicking outside
  document.addEventListener('click', function(e) {
    if (!orbitKey.contains(e.target) && orbitKey.classList.contains('open')) {
      orbitKey.classList.remove('open');
      clearIsolation();
      saturnBreathe();
    }
  });

  // Saturn breathe effect
  function saturnBreathe() {
    if (!saturnContainer) return;
    saturnContainer.classList.remove('breathing');
    // Force reflow to restart animation
    void saturnContainer.offsetWidth;
    saturnContainer.classList.add('breathing');
    saturnContainer.addEventListener('animationend', function() {
      saturnContainer.classList.remove('breathing');
    }, { once: true });
  }

  function setIsolation(ringKey) {
    var allRingEls = ringEls();

    if (ringKey === activeRing) {
      // Toggle off — restore all
      activeRing = null;
      allRingEls.forEach(function(el) {
        el.classList.remove('ring-dimmed', 'ring-highlighted');
      });
      labels().forEach(function(btn) {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('dimmed');
      });
      arcs().forEach(function(arc) {
        arc.classList.remove('arc-active', 'arc-dimmed');
      });
      saturnBreathe();
      return;
    }

    activeRing = ringKey;
    var targetClass = RING_CLASS_MAP[ringKey];
    var targetArc   = ARC_CLASS_MAP[ringKey];

    // Dim/highlight actual orbit rings
    allRingEls.forEach(function(el) {
      if (el.dataset.orbitRingIndex === ringKey || (!el.dataset.orbitRingIndex && el.classList.contains(targetClass))) {
        el.classList.remove('ring-dimmed');
        el.classList.add('ring-highlighted');
      } else {
        el.classList.remove('ring-highlighted');
        el.classList.add('ring-dimmed');
      }
    });

    // Update chart labels
    labels().forEach(function(btn) {
      var isTarget = btn.dataset.ring === ringKey;
      btn.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
      btn.classList.toggle('dimmed', !isTarget);
    });

    // Update chart arcs
    arcs().forEach(function(arc) {
      if (arc.dataset.ring === ringKey || arc.classList.contains(targetArc)) {
        arc.classList.add('arc-active');
        arc.classList.remove('arc-dimmed');
      } else {
        arc.classList.remove('arc-active');
        arc.classList.add('arc-dimmed');
      }
    });

    saturnBreathe();
  }

  chart.addEventListener('click', function(e) {
    var btn = e.target.closest('.orbit-chart-label');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setIsolation(btn.dataset.ring);
  });
})();

// ============================================
// SECTION 2: ELEVATOR DOORS
// ============================================
var elevatorSection = document.getElementById('elevator-section');
var behindContent = document.querySelector('.behind-content');
var activeFloor = null;

var behindText = document.getElementById('behindText');
var behindGallery = document.getElementById('behindGallery');
var behindAbout = document.getElementById('behindAbout');
var behindConnect = document.getElementById('behindConnect');
var behindHod = document.getElementById('behindHod');
var floorIndicator = document.querySelector('.indicator-floor');
var galleryLoading = document.getElementById('galleryLoading');
var galleryLoadingText = document.getElementById('galleryLoadingText');

var floorLabels = {
  gallery: '1', hod: '2', about: '3', contact: '4', help: '?'
};

// Floor order for counter ticking (lobby=0)
var floorOrder = ['★', '1', '2', '3', '4', '?'];
var floorToIndex = { gallery: 1, hod: 2, about: 3, contact: 4, help: 5 };
var currentFloorIndex = 0;
var traveling = false;

var floorContent = {
  hod: { title: 'HUES OF DISPOSITIONS', subtitle: 'thoughts pending...' },
  about: { title: 'ABOUT', subtitle: 'more soon' },
  contact: { title: 'LET\'S CONNECT', subtitle: 'nicole@huesofsaturn.com' },
  help: { title: '?', subtitle: 'you\'re doing great' },
};

var indicatorArrow = document.getElementById('indicatorArrow');

// (Sound effects removed)

function setGalleryLoadingState(message, isError) {
  if (!galleryLoading) return;
  if (galleryLoadingText && message) galleryLoadingText.textContent = message;
  galleryLoading.classList.remove('is-hidden');
  galleryLoading.classList.toggle('is-error', !!isError);
}

// ── Travel sequence ──────────────────────────
function setFloorContent(floor) {
  // Hide all floor-specific content first
  behindGallery.classList.remove('active');
  behindAbout.classList.remove('active');
  behindConnect.classList.remove('active');
  if (behindHod) behindHod.classList.remove('active');
  aboutActive = false;
  connectActive = false;
  behindText.style.display = 'none';

  // Stop Three.js gallery when leaving gallery floor
  if (window.gallery3D && activeFloor === 'gallery') window.gallery3D.stop();
  // Remove gallery-active class when leaving gallery
  elevatorSection.classList.remove('gallery-active');

  if (floor === 'gallery') {
    behindGallery.classList.add('active');
    // Remove portal clipping so 3D scene fills the elevator
    elevatorSection.classList.add('gallery-active');
    if (window.gallery3D) {
      window.gallery3D.reset();
      if (window.gallery3D.prepare() === false) return;
      // Small delay so container has dimensions before renderer sizes
      setTimeout(function() {
        if (window.gallery3D.start() === false) {
          setGalleryLoadingState(
            window.gallery3D.getStatusMessage ? window.gallery3D.getStatusMessage() : '3D gallery unavailable right now.',
            true
          );
        }
      }, 100);
    } else {
      setGalleryLoadingState('3D gallery unavailable right now.', true);
    }
  } else if (floor === 'hod') {
    if (behindHod) behindHod.classList.add('active');
  } else if (floor === 'about') {
    behindAbout.classList.add('active');
    aboutActive = true;
    if (!_orbRunning) { _orbRunning = true; orbPhysicsLoop(); }
  } else if (floor === 'contact') {
    behindConnect.classList.add('active');
    connectActive = true;
    if (!_connectRunning) { _connectRunning = true; connectLoop(); }
  } else {
    behindText.style.display = '';
    var content = floorContent[floor];
    if (content) {
      behindText.querySelector('.behind-title').textContent = content.title;
      behindText.querySelector('.behind-subtitle').textContent = content.subtitle;
    }
  }
}

function travelToFloor(floor, callback) {
  var targetIndex = floorToIndex[floor] || 0;
  var direction = targetIndex > currentFloorIndex ? 1 : -1;
  var floorsToTravel = Math.abs(targetIndex - currentFloorIndex);
  if (floorsToTravel === 0) { callback(); return; }

  // Set arrow direction
  indicatorArrow.className = 'indicator-arrow' + (direction > 0 ? '' : ' arrow-down');

  // Start shake
  elevatorSection.classList.add('traveling');

  // Tick through floors
  var step = 0;
  var tickInterval = setInterval(function() {
    step++;
    currentFloorIndex += direction;
    floorIndicator.textContent = floorOrder[currentFloorIndex] || '?';

    if (step >= floorsToTravel) {
      clearInterval(tickInterval);

      // Arrive — stop shake, ding, open
      setTimeout(function() {
        elevatorSection.classList.remove('traveling');
        indicatorArrow.className = 'indicator-arrow';
        callback();
      }, 300);
    }
  }, 700);
}

function pressFloor(floor) {
  if (traveling) return;
  var allBtns = document.querySelectorAll('.floor-btn');

  if (floor === 'close') { closeDoors(); return; }
  if (floor === 'open' && activeFloor) {
    elevatorSection.classList.add('doors-open');
    lockBodyScroll();
    return;
  }
  if (activeFloor === floor) { closeDoors(); return; }

  traveling = true;

  // Light up button
  allBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  var btn = document.querySelector('[data-floor="' + floor + '"]');
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }

  // If doors are open, close first then swap content during travel
  if (elevatorSection.classList.contains('doors-open')) {
    // Add a transitional class that closes doors but stays position:fixed
    elevatorSection.classList.add('doors-closing');
    elevatorSection.classList.remove('doors-open');
    setTimeout(function() {
      // Swap content only after doors have fully closed
      setFloorContent(floor);
      travelToFloor(floor, function() {
        elevatorSection.classList.remove('doors-closing');
        elevatorSection.classList.add('doors-open');
        lockBodyScroll();
        activeFloor = floor;
        traveling = false;
        updateMobileNavActive(floor);
      });
    }, 1600); // wait for door close animation
  } else {
    // Doors already closed — set content then travel and open
    setFloorContent(floor);
    travelToFloor(floor, function() {
      elevatorSection.classList.add('doors-open');
      lockBodyScroll();
      activeFloor = floor;
      traveling = false;
      updateMobileNavActive(floor);
    });
  }
}

function closeDoors() {
  if (traveling) return;
  // Keep position:fixed while doors animate shut to prevent page jump
  elevatorSection.classList.remove('doors-open');
  elevatorSection.classList.add('doors-closing');
  unlockBodyScroll();
  document.querySelectorAll('.floor-btn').forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  activeFloor = null;
  updateMobileNavActive(null);

  // Clear floor content AFTER doors finish closing (matches 1.6s CSS transition)
  setTimeout(function() {
    elevatorSection.classList.remove('gallery-active');
    behindGallery.classList.remove('active');
    behindAbout.classList.remove('active');
    behindConnect.classList.remove('active');
    if (behindHod) behindHod.classList.remove('active');
    aboutActive = false;
    connectActive = false;
    behindText.style.display = '';
    // Stop Three.js render loop when doors close
    if (window.gallery3D) window.gallery3D.stop();
  }, 1600);

  function releaseElevator() {
    // Scroll to elevator before releasing fixed position so page doesn't jump
    window.scrollTo({ top: elevatorSection.offsetTop, behavior: 'auto' });
    elevatorSection.classList.remove('doors-closing');
  }

  // Travel back to lobby after doors close
  if (currentFloorIndex !== 0) {
    traveling = true;
    indicatorArrow.className = 'indicator-arrow arrow-down';
    setTimeout(function() {
      var goLobby = setInterval(function() {
        if (currentFloorIndex > 0) {
          currentFloorIndex--;
          floorIndicator.textContent = floorOrder[currentFloorIndex] || '★';
        }
        if (currentFloorIndex <= 0) {
          clearInterval(goLobby);
          currentFloorIndex = 0;
          floorIndicator.textContent = '★';
          indicatorArrow.className = 'indicator-arrow';
          traveling = false;
          releaseElevator();
        }
      }, 500);
    }, 1600);
  } else {
    // Already at lobby — wait for door animation then release
    setTimeout(releaseElevator, 1600);
  }
}

// Button click handlers (door panel — all button types)
document.querySelectorAll('.floor-btn, .door-btn, .alarm-btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var floor = btn.dataset.floor;
    if (floor) pressFloor(floor);
  });
});


// ============================================
// GALLERY — Three.js (lifecycle managed by gallery-3d.js)
// ============================================

// (CSS 3D gallery removed — gallery-3d.js handles rendering)

// ── Art Viewer ───────────────────────────────
var artViewer = document.getElementById('artViewer');
var artViewerMedia = document.getElementById('artViewerMedia');
var artViewerInfo = document.getElementById('artViewerInfo');
var artViewerPrev = document.getElementById('artViewerPrev');
var artViewerNext = document.getElementById('artViewerNext');

var _artViewerPrevFocus = null;
var _artViewerCurrentIndex = -1;

function openArtViewer(index) {
  var data = GALLERY_ART[index];
  if (!data) return;
  _artViewerCurrentIndex = index;
  _artViewerPrevFocus = document.activeElement;

  artViewerMedia.innerHTML = '';
  var viewerImg = document.createElement('img');
  viewerImg.src = data.src;
  viewerImg.alt = data.title;
  artViewerMedia.appendChild(viewerImg);

  artViewerInfo.querySelector('.viewer-title').textContent = data.title;
  artViewerInfo.querySelector('.viewer-medium').textContent =
    [data.medium, data.year].filter(Boolean).join(' \u2014 ');
  artViewerInfo.querySelector('.viewer-description').textContent = data.description || '';

  // Update prev/next visibility
  if (artViewerPrev) artViewerPrev.style.display = index > 0 ? 'flex' : 'none';
  if (artViewerNext) artViewerNext.style.display = index < GALLERY_ART.length - 1 ? 'flex' : 'none';

  artViewer.classList.add('active');
  var closeBtn = artViewer.querySelector('.art-viewer-close');
  if (closeBtn) closeBtn.focus();
}

function navigateArtViewer(direction) {
  var newIndex = _artViewerCurrentIndex + direction;
  if (newIndex < 0 || newIndex >= GALLERY_ART.length) return;
  openArtViewer(newIndex);
}

function closeArtViewer() {
  artViewer.classList.remove('active');
  _artViewerCurrentIndex = -1;
  if (_artViewerPrevFocus) { _artViewerPrevFocus.focus(); _artViewerPrevFocus = null; }
}

// Bridge for gallery-3d.js module
window.HOSArtViewer = {
  open: openArtViewer,
  close: closeArtViewer,
  isOpen: function() { return artViewer && artViewer.classList.contains('active'); }
};

document.addEventListener('click', function(e) {
  if (e.target.closest('.art-viewer-prev')) { navigateArtViewer(-1); return; }
  if (e.target.closest('.art-viewer-next')) { navigateArtViewer(1); return; }
  if (e.target.closest('.art-viewer-backdrop') || e.target.closest('.art-viewer-close')) closeArtViewer();
});

document.addEventListener('keydown', function(e) {
  if (!artViewer || !artViewer.classList.contains('active')) return;
  if (e.key === 'Escape') closeArtViewer();
  if (e.key === 'ArrowLeft') { e.preventDefault(); navigateArtViewer(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); navigateArtViewer(1); }
});

// Focus trap for art viewer dialog
if (artViewer) {
  artViewer.addEventListener('keydown', function(e) {
    if (!artViewer.classList.contains('active')) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      var focusable = artViewer.querySelectorAll('.art-viewer-close, .art-viewer-prev, .art-viewer-next');
      var list = Array.from(focusable).filter(function(el) {
        return el.offsetParent !== null; // exclude display:none buttons
      });
      if (list.length === 0) return;
      var idx = list.indexOf(document.activeElement);
      var next = e.shiftKey ? (idx - 1 + list.length) % list.length : (idx + 1) % list.length;
      list[next].focus();
    }
  });
}

// ============================================
// ABOUT — Pretext-style floating orbs + text parting
// ============================================
var aboutText = document.getElementById('aboutText');
var connectText = document.getElementById('connectText');
var aboutWords = [];
var connectWords = [];
var aboutActive = false;
var connectActive = false;

var ABOUT_COPY = [
  'I make things because the alternative is just watching.',
  '',
  'My work lives in the ether... between what i feel and what i can touch... paint, clay, wood, trash, code, sound, whatever\'s in reach. Every medium is fair game. Every emotion is material.',
  '',
  'I don\'t believe art owes anyone an explanation. It\'s subjective, it\'s supposed to be. I\'d rather you feel something than understand something.',
  '',
  'Hues of Saturn is the universe i build from. The art, the tools, the experiments, all of it comes from the same place: curiosity about the tangible world, filtered through every feeling i can\'t name.',
  '',
  'Curiosity killed the cat... yet satisfaction brought it back.',
  '',
  'So i welcome you to my universe.',
];

var CONNECT_COPY = [
  'the best things happen when curious people find each other.',
];

var MOON_QUOTE_COPY = 'If you must think of me, think of me as the moon, constantly changing yet always remaining the same.';

function buildFloorWords(container, copy) {
  if (!container) return [];
  container.innerHTML = '';
  var words = [];

  copy.forEach(function(line) {
    if (line === '') {
      container.appendChild(document.createElement('br'));
      return;
    }
    var parts = line.split(' ');
    parts.forEach(function(word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      container.appendChild(span);
      words.push(span);
      if (i < parts.length - 1) {
        container.appendChild(document.createTextNode(' '));
      }
    });
    container.appendChild(document.createTextNode(' '));
  });

  return words;
}

aboutWords = buildFloorWords(aboutText, ABOUT_COPY);
connectWords = buildFloorWords(connectText, CONNECT_COPY);

// ============================================
// STAR POPOVERS — Libra (about) · Gemini (HOD) · lone star (connect)
// ============================================
(function starPopoverInit() {
  var pop        = document.getElementById('starPopover');
  var card       = document.getElementById('starPopoverCard');
  var titleEl    = document.getElementById('starPopoverTitle');
  var bodyEl     = document.getElementById('starPopoverBody');
  var actionsEl  = document.getElementById('starPopoverActions');
  var closeBtn   = document.getElementById('starPopoverClose');
  var backdrop   = document.getElementById('starPopoverBackdrop');
  if (!pop || !card || !titleEl || !bodyEl || !actionsEl) return;

  var HOD_URL = 'https://nicoledeschamps.github.io/hues-of-dispositions/';

  var HOD_LINES = [
    '68 REAL-TIME EFFECTS',
    'AUDIO-REACTIVE VISUALS',
    'MOTION TRACKING',
    'LAYERS, BLEND MODES, TIMELINE',
    'LIVE IN THE BROWSER',
  ];

  // Connect — three intentional contact rows. Labels/captions picked to
  // make each destination feel distinct without over-explaining.
  var CONNECT_ROWS = [
    {
      label: 'studio',
      handle: '@huesofsaturn',
      caption: 'personal, everyday, from the studio. art appears when it appears.',
      href: 'https://instagram.com/huesofsaturn',
      platform: 'instagram',
      external: true,
    },
    {
      label: 'experiments',
      handle: '@planetarydispositions',
      caption: 'video, motion, things still in flux.',
      href: 'https://instagram.com/planetarydispositions',
      platform: 'instagram',
      external: true,
    },
    {
      label: 'letters',
      handle: 'nicole.deschamps1@gmail.com',
      caption: 'commissions, collaborations, or a quiet hello.',
      href: 'mailto:nicole.deschamps1@gmail.com',
      platform: 'email',
      external: false,
    },
  ];

  // About paragraph → class map. Index counts paragraphs in ABOUT_COPY
  // (blank lines separate them). Drives rhythm/emphasis in the popover
  // without editing Nicole's copy.
  var ABOUT_PARA_CLASSES = {
    0: 'about-opener',    // "I make things because the alternative is just watching."
    4: 'about-aphorism',  // "curiosity killed the cat.."
    5: 'about-welcome',   // "so i welcome you to my universe"
  };

  function paragraphize(copy, classMap) {
    var frag = document.createDocumentFragment();
    var buffer = [];
    var paraIndex = 0;
    function flush() {
      if (!buffer.length) return;
      var p = document.createElement('p');
      p.textContent = buffer.join(' ');
      if (classMap && classMap[paraIndex]) p.className = classMap[paraIndex];
      frag.appendChild(p);
      buffer = [];
      paraIndex++;
    }
    copy.forEach(function(line) {
      if (line === '') flush();
      else buffer.push(line);
    });
    flush();
    return frag;
  }

  function buildAbout() {
    titleEl.classList.remove('star-popover-title--hod');
    titleEl.hidden = true;
    titleEl.textContent = '';
    bodyEl.innerHTML = '';
    bodyEl.appendChild(paragraphize(ABOUT_COPY, ABOUT_PARA_CLASSES));
    actionsEl.innerHTML = '';
  }

  function buildHod() {
    titleEl.classList.add('star-popover-title--hod');
    titleEl.hidden = false;
    titleEl.textContent = 'HUES OF DISPOSITIONS';
    bodyEl.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'hod-popover';

    var kicker = document.createElement('p');
    kicker.className = 'hod-popover-kicker';
    kicker.textContent = 'A TOOL I BUILT TO PLAY WITH THE WORLD AROUND ME.';
    wrap.appendChild(kicker);

    var list = document.createElement('div');
    list.className = 'hod-popover-list';
    HOD_LINES.forEach(function(line) {
      var item = document.createElement('div');
      item.className = 'hod-popover-line';
      item.textContent = line;
      list.appendChild(item);
    });
    wrap.appendChild(list);

    var note = document.createElement('p');
    note.className = 'hod-popover-note';
    note.textContent = 'THIS IS HOW I SEE. NOW YOU CAN TOO.';
    wrap.appendChild(note);

    bodyEl.appendChild(wrap);
    actionsEl.innerHTML = '';
    var a = document.createElement('a');
    a.className = 'star-popover-enter';
    a.href = HOD_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = 'enter <span class="star-popover-enter-arrow" aria-hidden="true">→</span>';
    actionsEl.appendChild(a);
  }

  function buildConnect() {
    titleEl.classList.remove('star-popover-title--hod');
    titleEl.hidden = false;
    titleEl.textContent = 'CONNECT';
    bodyEl.innerHTML = '';

    // Intro — keep current one-line invitation at the top of the card
    var intro = document.createElement('p');
    intro.className = 'connect-intro';
    intro.textContent = CONNECT_COPY[0];
    bodyEl.appendChild(intro);

    // Three contact rows — each with small label + handle + context caption
    var rows = document.createElement('div');
    rows.className = 'connect-rows';
    CONNECT_ROWS.forEach(function(row) {
      var a = document.createElement('a');
      a.className = 'connect-row';
      a.href = row.href;
      if (row.external) {
        a.target = '_blank';
        a.rel = 'noopener';
      }

      var label = document.createElement('span');
      label.className = 'connect-row-label';
      label.textContent = row.label;
      a.appendChild(label);

      var handle = document.createElement('span');
      handle.className = 'connect-row-handle';
      handle.textContent = row.handle;
      a.appendChild(handle);

      var platform = document.createElement('span');
      platform.className = 'connect-row-platform';
      platform.textContent = row.platform;
      a.appendChild(platform);

      var caption = document.createElement('span');
      caption.className = 'connect-row-caption';
      caption.textContent = row.caption;
      a.appendChild(caption);

      rows.appendChild(a);
    });
    bodyEl.appendChild(rows);

    actionsEl.innerHTML = '';
  }

  function buildMoonQuote() {
    titleEl.classList.remove('star-popover-title--hod');
    titleEl.hidden = true;
    titleEl.textContent = '';
    bodyEl.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'moon-quote-line';
    p.textContent = window.ORBITING_HIDDEN_THOUGHT || MOON_QUOTE_COPY;
    bodyEl.appendChild(p);
    actionsEl.innerHTML = '';
  }

  function buildHiddenThought(trigger) {
    var index = trigger && trigger.getAttribute('data-hidden-star-index');
    var message = index !== null && window.ORBITING_HIDDEN_THOUGHTS && window.ORBITING_HIDDEN_THOUGHTS[index];
    titleEl.classList.remove('star-popover-title--hod');
    titleEl.hidden = true;
    titleEl.textContent = '';
    bodyEl.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'moon-quote-line';
    p.textContent = message || '';
    bodyEl.appendChild(p);
    actionsEl.innerHTML = '';
  }

  function buildOrbitingStar(trigger) {
    var name = trigger && trigger.getAttribute('data-star-placement');
    var placement = name && window.ORBITING_STAR_CONTENT && window.ORBITING_STAR_CONTENT[name];
    titleEl.classList.remove('star-popover-title--hod');
    titleEl.hidden = true;
    titleEl.textContent = '';
    bodyEl.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'moon-quote-line';
    p.textContent = placement ? placement.text : '';
    bodyEl.appendChild(p);
    actionsEl.innerHTML = '';
  }

  var BUILDERS = { about: buildAbout, hod: buildHod, connect: buildConnect, moonQuote: buildMoonQuote, hiddenThought: buildHiddenThought, orbitingStar: buildOrbitingStar };
  var lastTrigger = null;

  function openPopover(action, trigger) {
    var build = BUILDERS[action];
    if (!build) return;
    build(trigger);
    lastTrigger = trigger || null;
    card.scrollTop = 0;
    pop.classList.add('is-open');
    pop.setAttribute('aria-hidden', 'false');
    // Defer focus so transition can begin
    setTimeout(function() {
      try { closeBtn.focus({ preventScroll: true }); } catch (e) { closeBtn.focus(); }
    }, 20);
  }

  function closePopover() {
    pop.classList.remove('is-open');
    pop.setAttribute('aria-hidden', 'true');
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) { lastTrigger.focus(); }
    }
    lastTrigger = null;
  }

  // Click triggers (delegated so future stars work too)
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest && e.target.closest('[data-star-action]');
    if (!trigger) return;
    e.preventDefault();
    openPopover(trigger.getAttribute('data-star-action'), trigger);
  });

  // Keyboard activation for SVG role=button (Enter / Space)
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var trigger = e.target.closest && e.target.closest('[data-star-action]');
    if (!trigger) return;
    // Native <button> already handles Enter/Space; skip those to avoid double-fire
    if (trigger.tagName === 'BUTTON') return;
    e.preventDefault();
    openPopover(trigger.getAttribute('data-star-action'), trigger);
  });

  closeBtn.addEventListener('click', closePopover);
  if (backdrop) backdrop.addEventListener('click', closePopover);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && pop.classList.contains('is-open')) {
      e.stopPropagation();
      closePopover();
    }
  });
})();

// ── Sun + Moon orb system (cinematic upgrade) ──
var SUN_RADIUS = 100;
var MOON_RADIUS = 80;
var ECLIPSE_RANGE = 200;

var sunEl = behindAbout ? behindAbout.querySelector('.orb-sun') : null;
var moonEl = behindAbout ? behindAbout.querySelector('.orb-moon') : null;
var lightcastEl = behindAbout ? behindAbout.querySelector('.about-lightcast') : null;

// Mouse target (raw) vs moon position (interpolated)
var mouseTargetX = -9999, mouseTargetY = -9999;
var moonX = -9999, moonY = -9999;
var eclipseRatio = 0;

// Sun state
var sunX = 0, sunY = 0, sunVX = 0.35, sunVY = 0.25;
var sunDragging = false, sunDragOffX = 0, sunDragOffY = 0;
var sunPrevX = 0, sunPrevY = 0;

if (behindAbout && sunEl) {
  var pw = behindAbout.offsetWidth || 800;
  var ph = behindAbout.offsetHeight || 600;
  sunX = 0.55 * pw;
  sunY = 0.30 * ph;
  sunPrevX = sunX;
  sunPrevY = sunY;
  sunEl.style.left = sunX + 'px';
  sunEl.style.top = sunY + 'px';

  // Drag handlers — track velocity from actual drag
  sunEl.addEventListener('pointerdown', function(e) {
    sunDragging = true;
    sunEl.classList.add('dragging');
    var rect = sunEl.getBoundingClientRect();
    sunDragOffX = e.clientX - rect.left - rect.width / 2;
    sunDragOffY = e.clientY - rect.top - rect.height / 2;
    sunPrevX = sunX;
    sunPrevY = sunY;
    sunEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  sunEl.addEventListener('pointermove', function(e) {
    if (!sunDragging) return;
    sunPrevX = sunX;
    sunPrevY = sunY;
    var pr = behindAbout.getBoundingClientRect();
    sunX = e.clientX - pr.left - sunDragOffX - sunEl.offsetWidth / 2;
    sunY = e.clientY - pr.top - sunDragOffY - sunEl.offsetHeight / 2;
    sunEl.style.left = sunX + 'px';
    sunEl.style.top = sunY + 'px';
  });

  sunEl.addEventListener('pointerup', function() {
    sunDragging = false;
    sunEl.classList.remove('dragging');
    // Derive velocity from drag direction
    sunVX = (sunX - sunPrevX) * 0.3;
    sunVY = (sunY - sunPrevY) * 0.3;
    // Clamp speed
    var spd = Math.sqrt(sunVX * sunVX + sunVY * sunVY);
    if (spd > 2) { sunVX *= 2 / spd; sunVY *= 2 / spd; }
    if (spd < 0.2) { sunVX = (Math.random() - 0.5) * 0.5; sunVY = (Math.random() - 0.5) * 0.5; }
  });
}

if (behindAbout) {
  // Track raw mouse target — moon lerps toward it in RAF
  behindAbout.addEventListener('mousemove', function(e) {
    if (isPhone) return;
    mouseTargetX = e.clientX;
    mouseTargetY = e.clientY;
    var hint = behindAbout.querySelector('.about-hint');
    if (hint) hint.style.opacity = '0';
  });

  behindAbout.addEventListener('mouseleave', function() {
    mouseTargetX = -9999;
    mouseTargetY = -9999;
  });
}

// Main physics + rendering loop
var _orbRunning = false;
function orbPhysicsLoop() {
  if (!aboutActive) { _orbRunning = false; return; }
  requestAnimationFrame(orbPhysicsLoop);

  var pw = behindAbout.offsetWidth;
  var ph = behindAbout.offsetHeight;

  // ── Sun physics ──
  if (sunEl && !sunDragging) {
    var ew = sunEl.offsetWidth;
    var eh = sunEl.offsetHeight;

    // Gravitational pull toward moon when nearby
    if (moonX > -9000) {
      var pr0 = behindAbout.getBoundingClientRect();
      var smx = moonX - pr0.left, smy = moonY - pr0.top;
      var gdx = smx - (sunX + ew / 2), gdy = smy - (sunY + eh / 2);
      var gDist = Math.sqrt(gdx * gdx + gdy * gdy);
      if (gDist < 300 && gDist > 10) {
        var gForce = 0.015 * (1 - gDist / 300);
        sunVX += (gdx / gDist) * gForce;
        sunVY += (gdy / gDist) * gForce;
      }
    }

    sunX += sunVX;
    sunY += sunVY;

    // Bounce with damping
    if (sunX <= 0) { sunVX = Math.abs(sunVX) * 0.9; sunX = 0; }
    if (sunX >= pw - ew) { sunVX = -Math.abs(sunVX) * 0.9; sunX = pw - ew; }
    if (sunY <= 0) { sunVY = Math.abs(sunVY) * 0.9; sunY = 0; }
    if (sunY >= ph - eh) { sunVY = -Math.abs(sunVY) * 0.9; sunY = ph - eh; }

    sunEl.style.left = sunX + 'px';
    sunEl.style.top = sunY + 'px';
  }

  // ── Moon inertia — lerp toward cursor ──
  if (mouseTargetX > -9000 && !isPhone) {
    if (moonX < -9000) {
      moonX = mouseTargetX;
      moonY = mouseTargetY;
    } else {
      moonX = lerp(moonX, mouseTargetX, 0.12);
      moonY = lerp(moonY, mouseTargetY, 0.12);
    }
    if (moonEl) {
      var pr1 = behindAbout.getBoundingClientRect();
      moonEl.style.left = (moonX - pr1.left - moonEl.offsetWidth / 2) + 'px';
      moonEl.style.top = (moonY - pr1.top - moonEl.offsetHeight / 2) + 'px';
    }
  } else {
    moonX = -9999;
    moonY = -9999;
  }

  // ── Continuous eclipse ratio (0..1) ──
  var pr = behindAbout.getBoundingClientRect();
  var sunCX = pr.left + sunX + (sunEl ? sunEl.offsetWidth / 2 : 0);
  var sunCY = pr.top + sunY + (sunEl ? sunEl.offsetHeight / 2 : 0);
  var targetEclipse = 0;

  if (sunEl && moonX > -9000) {
    var edx = moonX - sunCX, edy = moonY - sunCY;
    var eDist = Math.sqrt(edx * edx + edy * edy);
    if (eDist < ECLIPSE_RANGE) {
      targetEclipse = Math.max(0, Math.min(1, 1 - eDist / ECLIPSE_RANGE));
      targetEclipse = targetEclipse * targetEclipse;
    }
  }
  eclipseRatio = lerp(eclipseRatio, targetEclipse, 0.08);
  if (eclipseRatio < 0.005) eclipseRatio = 0;

  // Apply eclipse as CSS custom property
  if (sunEl) {
    sunEl.style.setProperty('--eclipse', eclipseRatio.toFixed(3));
  }
  if (behindAbout) {
    behindAbout.style.setProperty('--eclipse', eclipseRatio.toFixed(3));
  }

  // ── Dynamic light cast positions ──
  if (lightcastEl) {
    var sunPctX = ((sunX + (sunEl ? sunEl.offsetWidth / 2 : 0)) / pw * 100).toFixed(1);
    var sunPctY = ((sunY + (sunEl ? sunEl.offsetHeight / 2 : 0)) / ph * 100).toFixed(1);
    lightcastEl.style.setProperty('--sun-x', sunPctX + '%');
    lightcastEl.style.setProperty('--sun-y', sunPctY + '%');
    if (moonX > -9000) {
      var moonPctX = ((moonX - pr.left) / pw * 100).toFixed(1);
      var moonPctY = ((moonY - pr.top) / ph * 100).toFixed(1);
      lightcastEl.style.setProperty('--moon-x', moonPctX + '%');
      lightcastEl.style.setProperty('--moon-y', moonPctY + '%');
    } else {
      lightcastEl.style.setProperty('--moon-x', '-100%');
      lightcastEl.style.setProperty('--moon-y', '-100%');
    }
  }

  // ── Text displacement with differentiated reactions ──
  var sunCenter = { cx: sunCX, cy: sunCY, r: SUN_RADIUS + 30, type: 'sun' };
  var moonCenter = moonX > -9000 ? { cx: moonX, cy: moonY, r: MOON_RADIUS + 25, type: 'moon' } : null;
  displaceAboutWords(aboutWords, sunCenter, moonCenter, eclipseRatio);
}
// orbPhysicsLoop starts on demand when About floor is activated (setFloorContent)

function displaceAboutWords(words, sun, moon, eclipse) {
  // Batch all reads first to avoid interleaved read/write layout thrash
  var rects = new Array(words.length);
  for (var i = 0; i < words.length; i++) {
    rects[i] = words[i].getBoundingClientRect();
  }
  // Now apply transforms (write pass)
  for (var i = 0; i < words.length; i++) {
    var span = words[i];
    var rect = rects[i];
    var wcx = rect.left + rect.width / 2;
    var wcy = rect.top + rect.height / 2;
    var totalTX = 0, totalTY = 0, minOpacity = 1;
    var warmth = 0, chill = 0, totalRot = 0;

    // Sun push — warm glow effect
    if (sun) {
      var sdx = wcx - sun.cx, sdy = wcy - sun.cy;
      var sd2 = sdx * sdx + sdy * sdy;
      var sr2 = sun.r * sun.r;
      if (sd2 < sr2) {
        var sd = Math.sqrt(sd2) || 1;
        var sf = 1 - sd / sun.r;
        sf = sf * sf;
        var sp = sf * 120;
        totalTX += (sdx / sd) * sp;
        totalTY += (sdy / sd) * sp;
        minOpacity = Math.min(minOpacity, 0.15 + (1 - sf) * 0.85);
        warmth = Math.max(warmth, sf);
        totalRot += sf * 4 * (sdx > 0 ? 1 : -1);
      }
    }

    // Moon push — cool dim effect
    if (moon) {
      var mdx = wcx - moon.cx, mdy = wcy - moon.cy;
      var md2 = mdx * mdx + mdy * mdy;
      var mr2 = moon.r * moon.r;
      if (md2 < mr2) {
        var md = Math.sqrt(md2) || 1;
        var mf = 1 - md / moon.r;
        mf = mf * mf;
        var mp = mf * 100;
        totalTX += (mdx / md) * mp;
        totalTY += (mdy / md) * mp;
        minOpacity = Math.min(minOpacity, 0.1 + (1 - mf) * 0.9);
        chill = Math.max(chill, mf);
        totalRot += mf * -3 * (mdx > 0 ? 1 : -1);
      }
    }

    if (totalTX !== 0 || totalTY !== 0) {
      // Warm words glow amber near sun, cool words dim near moon
      var color = '';
      if (warmth > 0.1) {
        color = 'rgba(220,190,130,' + (0.6 + warmth * 0.4).toFixed(2) + ')';
      } else if (chill > 0.1) {
        color = 'rgba(180,185,200,' + (0.5 + chill * 0.3).toFixed(2) + ')';
      }
      span.style.transform = 'translate(' + totalTX.toFixed(1) + 'px,' + totalTY.toFixed(1) + 'px) rotate(' + totalRot.toFixed(1) + 'deg)';
      span.style.opacity = minOpacity.toFixed(2);
      if (color) {
        span.style.color = color;
      } else {
        span.style.color = '';
      }
    } else {
      if (span.style.transform) span.style.transform = '';
      if (span.style.opacity) span.style.opacity = '';
      if (span.style.color) span.style.color = '';
    }
  }
}

// ── Connect page: simpler — cursor only displacement ──
var connectMouseX = -9999, connectMouseY = -9999;
if (behindConnect) {
  behindConnect.addEventListener('mousemove', function(e) {
    connectMouseX = e.clientX;
    connectMouseY = e.clientY;
    var hint = behindConnect.querySelector('.about-hint');
    if (hint) hint.style.opacity = '0';
  });
  behindConnect.addEventListener('mouseleave', function() {
    connectMouseX = -9999;
    connectMouseY = -9999;
    connectWords.forEach(function(s) { s.style.transform = ''; s.style.opacity = ''; s.style.color = ''; });
  });
}

var _connectRunning = false;
function connectLoop() {
  if (!connectActive) { _connectRunning = false; return; }
  requestAnimationFrame(connectLoop);
  if (isTouch) return;
  if (connectMouseX < -9000) return;
  var cMoon = { cx: connectMouseX, cy: connectMouseY, r: 80, type: 'moon' };
  displaceAboutWords(connectWords, null, cMoon, 0);
}
// connectLoop starts on demand when Connect floor is activated (setFloorContent)

// ============================================
// iOS SCROLL LOCK HELPERS
// ============================================
function lockBodyScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.top = '-' + window.scrollY + 'px';
}

function unlockBodyScroll() {
  var scrollY = document.body.style.top;
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.top = '';
  window.scrollTo(0, (parseInt(scrollY || '0', 10) || 0) * -1);
}

// ============================================
// MOBILE BOTTOM NAV
// ============================================
var mobileFloorNav = document.getElementById('mobileFloorNav');
var mobileFloorMap = { 'lobby': null, '1': 'gallery', '2': 'hod', '3': 'about', '4': 'contact' };

function updateMobileNavActive(floor) {
  if (!mobileFloorNav) return;
  var btns = mobileFloorNav.querySelectorAll('button');
  btns.forEach(function(btn) {
    var mapped = mobileFloorMap[btn.dataset.floor];
    if (floor && mapped === floor) {
      btn.classList.add('active');
    } else if (!floor && btn.dataset.floor === 'lobby') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

if (mobileFloorNav) {
  mobileFloorNav.querySelectorAll('button').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var mFloor = btn.dataset.floor;
      if (mFloor === 'lobby') {
        closeDoors();
        updateMobileNavActive(null);
      } else {
        var elevatorFloor = mobileFloorMap[mFloor];
        if (elevatorFloor) {
          pressFloor(elevatorFloor);
          updateMobileNavActive(elevatorFloor);
        }
      }
    });
  });
}

// ============================================
// PAGE LOAD ANIMATION
// ============================================
if (prefersReducedMotion) {
  // Show everything instantly — no animations
  gsap.set('.saturn-container', { scale: 1, opacity: 1 });
  gsap.set('.title-main', { y: 0, opacity: 1 });
  gsap.set('.scroll-hint', { opacity: 0.5 });
} else {
  gsap.set('.saturn-container', { scale: 0.8, opacity: 0 });
  gsap.set('.title-main', { y: 40, opacity: 0 });
  gsap.set('.scroll-hint', { opacity: 0 });

  var loadTl = gsap.timeline({ delay: 0.3 });
  loadTl
    .to('.saturn-container', { scale: 1, opacity: 1, duration: 1.5, ease: 'power3.out' })
    .to('.title-main', { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: 'power3.out' }, '-=1')
    .to('.scroll-hint', { opacity: 0.5, duration: 1 }, '-=0.3');
}

})();
