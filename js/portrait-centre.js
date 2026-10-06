/* Every face sits in the centre of its orbit at the same size, however the photo was taken.
   Real cutouts are messy: a person off to one side (Zach's head and hat sat right of centre),
   small in a lot of empty space, or wearing a hat. On load we measure where the visible
   (non-transparent) pixels are and fit them to the box the demo portrait's person fills,
   so every face lands where the demo face does. Each fitted face gets a soft edge sized to
   its own person: the top half is kept whole (hair, hats), and the shoulders and sides fade
   out like the demo's neck, so square crops never show hard edges. The demo portrait itself
   is the reference and keeps its own oval. Opaque photos (background kept) are left as they are. */
(() => {
  const REFERENCE = 'assets/saturn-face-transparent.webp';
  const SAMPLE = 160;         // measure on a small copy; plenty for a bounding box
  const VISIBLE_ALPHA = 40;   // pixels fainter than this count as background
  const MIN_SCALE = 0.4, MAX_SCALE = 4;  // a tiny person far away needs up to ~4x
  const FADE_SPREAD = { w: .56, h: .52 };  // fade radii as a share of the person's box (half = touching)
  let referencePromise;

  // Visible-pixel box of an image, in 0–1 image coordinates, plus its aspect (height / width).
  function measure(image) {
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) return null;
    const scale = SAMPLE / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    let pixels;
    try {
      context.drawImage(image, 0, 0, w, h);
      pixels = context.getImageData(0, 0, w, h).data;
    } catch (_) { return null; } // a cross-origin image cannot be measured; leave it as is
    let left = w, right = -1, top = h, bottom = -1, transparent = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] <= VISIBLE_ALPHA) { transparent++; continue; }
        if (x < left) left = x; if (x > right) right = x;
        if (y < top) top = y; if (y > bottom) bottom = y;
      }
    }
    if (right < left || transparent < w * h * .02) return null; // empty, or an opaque photo
    return {
      aspect: height / width,
      cx: (left + right + 1) / 2 / w, cy: (top + bottom + 1) / 2 / h,
      w: (right - left + 1) / w, h: (bottom - top + 1) / h
    };
  }

  function reference() {
    if (!referencePromise) referencePromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(measure(image));
      image.onerror = () => resolve(null);
      image.src = REFERENCE;
    });
    return referencePromise;
  }

  // Scale and shift (as fractions of the image's own width/height) that fit `box` onto the reference's.
  // Match the person's width to the demo's; a hat or tall hair may rise up to TALLER above the demo's
  // box instead of shrinking the face, and then the chin lines up with the demo's so the extra goes up.
  const TALLER = 1.35;
  const WIDER = 1.3;  // crops include hair and shoulders, the demo is only a face: let them run wider so faces match
  const same = (a, b) => ['cx', 'cy', 'w', 'h', 'aspect'].every((key) => Math.abs(a[key] - b[key]) < .01);
  function fit(box, ref) {
    if (!box || !ref) return null;
    if (same(box, ref)) return { scale: 1, tx: 0, ty: 0, box, aspect: box.aspect, refAspect: ref.aspect };  // the demo itself
    const refHeight = ref.h * ref.aspect;                     // in units of the image width
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
      Math.min(ref.w * WIDER / box.w, refHeight * TALLER / (box.h * box.aspect))));
    const height = scale * box.h * box.aspect;
    const targetY = height > refHeight
      ? (ref.cy + ref.h / 2 - .5) * ref.aspect - height / 2  // bottoms line up; the extra rises
      : (ref.cy - .5) * ref.aspect;                          // centres line up
    return {
      scale, box,
      aspect: box.aspect, refAspect: ref.aspect,
      tx: (ref.cx - .5) - scale * (box.cx - .5),
      ty: targetY / box.aspect - scale * (box.cy - .5)
    };
  }

  // Apply a fit plus the owner's size slider (100 = as chosen). The reference (no change needed)
  // keeps the demo's own oval from the stylesheet.
  const FADE_VARS = ['--fade-x', '--fade-y', '--fade-w', '--fade-h', '--keep-top', '--top-edge', '--top-solid'];
  function apply(image, placement, size = 100) {
    const p = placement || { scale: 1, tx: 0, ty: 0 };
    image.style.scale = String(Number((p.scale * size / 100).toFixed(4)));
    image.style.translate = `${(p.tx * 100).toFixed(2)}% ${(p.ty * 100).toFixed(2)}%`;
    const isReference = !placement || (Math.abs(p.scale - 1) < .02 && Math.abs(p.tx) < .01 && Math.abs(p.ty) < .01);
    image.classList.toggle('is-fitted', !isReference);
    if (isReference) { FADE_VARS.forEach((name) => image.style.removeProperty(name)); return; }
    const { box } = p;
    const pct = (value) => `${(value * 100).toFixed(2)}%`;
    image.style.setProperty('--fade-x', pct(box.cx));
    image.style.setProperty('--fade-y', pct(box.cy));
    image.style.setProperty('--fade-w', pct(box.w * FADE_SPREAD.w));
    image.style.setProperty('--fade-h', pct(box.h * FADE_SPREAD.h));
    image.style.setProperty('--keep-top', pct(box.cy));
    image.style.setProperty('--top-edge', pct(box.cy - box.h / 2));                 // a short fade where a crop cut through hair
    image.style.setProperty('--top-solid', pct(box.cy - box.h / 2 + box.h * .05));
  }

  // Calls back with the placement (or null to leave the image alone) whenever the image loads.
  function watch(image, onPlacement) {
    const run = async () => {
      const src = image.currentSrc || image.src;
      const placement = fit(measure(image), await reference());
      if ((image.currentSrc || image.src) === src) onPlacement(placement);
    };
    image.addEventListener('load', run);
    if (image.complete && image.naturalWidth) run();
  }

  window.OrbitPortraitCentre = { measure, fit, apply, watch, reference };
})();
