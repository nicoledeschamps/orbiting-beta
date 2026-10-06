/* Faces always sit in the centre of the orbit. A cutout saved before automatic face
   framing can have the person off to one side of a transparent image (Zach's head and
   hat sat right of centre), so measure where the visible pixels are and report the
   horizontal shift, as a % of the image width, that centres them. */
(() => {
  const SAMPLE = 96;        // measure on a small copy; plenty for a centre estimate
  const VISIBLE_ALPHA = 32; // pixels fainter than this count as background
  const MIN_SHIFT = 3;      // ignore tiny offsets so well-framed portraits never move
  const MAX_SHIFT = 30;     // never push a face further than this

  function horizontalOffset(image) {
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) return 0;
    const scale = SAMPLE / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 0;
    let pixels;
    try {
      context.drawImage(image, 0, 0, w, h);
      pixels = context.getImageData(0, 0, w, h).data;
    } catch (_) { return 0; } // a cross-origin image cannot be measured; leave it as is
    let left = w, right = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] > VISIBLE_ALPHA) { if (x < left) left = x; if (x > right) right = x; }
      }
    }
    if (right < left) return 0;
    const shift = ((w / 2) - (left + right + 1) / 2) / w * 100;
    if (Math.abs(shift) < MIN_SHIFT) return 0;
    return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shift));
  }

  // Calls back with the shift once the image has loaded (and again if its src changes).
  function watch(image, onShift) {
    const measure = () => onShift(Number(horizontalOffset(image).toFixed(1)));
    image.addEventListener('load', measure);
    if (image.complete && image.naturalWidth) measure();
  }

  window.OrbitPortraitCentre = { horizontalOffset, watch };
})();
