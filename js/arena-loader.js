/* ============================================ */
/* Are.na + Cosmos Inspiration Image Loader     */
/* ============================================ */

const ArenaLoader = (function() {
  'use strict';

  // ── Configuration ──────────────────────────────
  const ARENA_CHANNELS = [
    'i-like-t58kvbzcjmu',
    'creative-direction-msvjvkzq6ei',
  ];
  const COSMOS_DATA_PATH = 'cosmos-data.json';

  const API_BASE = 'https://api.are.na/v2';
  const CACHE_KEY = 'hos-inspiration-v10';
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // ── Cache ──────────────────────────────────────
  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached.images;
    } catch (_) {
      return null;
    }
  }

  function setCache(images) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), images }));
    } catch (_) {
      // Storage full or unavailable
    }
  }

  // ── Are.na API ─────────────────────────────────
  async function fetchOneChannel(slug) {
    const url = `${API_BASE}/channels/${slug}/contents?per=100`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[Loader] Are.na channel "${slug}" returned ${res.status}. Skipping.`);
      return [];
    }

    const data = await res.json();
    const blocks = data.contents || data.data || [];

    return blocks
      .filter(b => b.class === 'Image' || b.class === 'image' || (b.image && b.image.url))
      .filter(b => {
        // Filter by source URL — block out Pinterest & social reposts
        const sourceUrl = (b.source && b.source.url) || '';
        const sourceTitle = (b.source && b.source.title) || '';
        if (/pinterest\.|pinimg\.|pin\.it/i.test(sourceUrl)) return false;
        if (/pinterest|instagram/i.test(sourceTitle)) return false;

        // Filter by any text field mentioning Pinterest
        const allText = [b.description, b.generated_title, b.title, b.content]
          .filter(Boolean).join(' ');
        if (/pinterest|pin on |saved from |discover this pin|pinned by/i.test(allText)) return false;

        // Filter tiny/square images (likely icons/avatars) — Are.na provides dimensions
        const img = b.image || {};
        const origW = img.original && img.original.width;
        const origH = img.original && img.original.height;
        if (origW && origH) {
          // Skip very small images (icons, thumbnails)
          if (origW < 200 && origH < 200) return false;
          // Skip small square images (profile pics) — ratio ~1:1 and under 400px
          const ratio = Math.max(origW, origH) / Math.min(origW, origH);
          if (ratio < 1.15 && Math.max(origW, origH) < 400) return false;
        }

        return true;
      })
      .map(b => {
        const img = b.image || {};
        const src = (img.display && img.display.url)
          || (img.thumb && img.thumb.url)
          || (img.square && img.square.url)
          || img.url
          || '';
        const alt = b.title || b.generated_title || 'Inspiration';
        return { src, alt, source: 'arena', boardUrl: `https://www.are.na/block/${b.id}` };
      })
      .filter(img => img.src && !isJunkImage(img.src, img.alt));
  }

  const ARENA_FALLBACK_KEY = 'hos-arena-fallback';

  async function fetchArenaImages() {
    const results = await Promise.all(
      ARENA_CHANNELS.map(slug => fetchOneChannel(slug).catch(() => []))
    );
    // Merge and dedupe by src
    const seen = new Set();
    const all = [];
    for (const imgs of results) {
      for (const img of imgs) {
        if (!seen.has(img.src)) {
          seen.add(img.src);
          all.push(img);
        }
      }
    }

    // Save successful fetches as fallback
    if (all.length > 0) {
      try { sessionStorage.setItem(ARENA_FALLBACK_KEY, JSON.stringify(all)); } catch(_) {}
    }

    // If API failed (CORS etc.), use local fallback
    if (all.length === 0) {
      try {
        const fb = sessionStorage.getItem(ARENA_FALLBACK_KEY);
        if (fb) return JSON.parse(fb);
      } catch(_) {}
      // Last resort: load from static JSON
      try {
        const res = await fetch('arena-data.json');
        if (res.ok) {
          const data = await res.json();
          const imgs = (data.images || [])
            .map(img => ({ src: img.src, alt: img.alt || 'Inspiration', source: 'arena', boardUrl: img.boardUrl || '' }))
            .filter(img => !isJunkImage(img.src, img.alt));
          console.log(`[Loader] Are.na fallback: ${imgs.length} images from arena-data.json`);
          return imgs;
        }
      } catch(_) {}
    }

    return all;
  }

  // ── Cosmos (local JSON from update-cosmos.py) ──
  async function fetchCosmosImages() {
    try {
      const res = await fetch(COSMOS_DATA_PATH);
      if (!res.ok) {
        console.warn('[Loader] cosmos-data.json not found. Run: python3 update-cosmos.py');
        return [];
      }
      const data = await res.json();
      // Cosmos collections likely sourced from Pinterest — exclude
      const SKIP_COSMOS = new Set([
        'outfit-inspo', 'fashion-ad', 'halloween-costume-ideas',
        'clotbes-that-catch-me', 'furniture',
      ]);

      return (data.images || [])
        .filter(img => !SKIP_COSMOS.has(img.collection))
        .map(img => ({
          src: img.src,
          alt: img.collection || 'Cosmos',
          source: 'cosmos',
          collection: img.collection,
          boardUrl: img.collection ? `https://cosmos.so/huesofsaturn/${img.collection}` : 'https://cosmos.so/huesofsaturn',
        }))
        .filter(img => !isJunkImage(img.src, img.alt));
    } catch (err) {
      console.warn('[Loader] Error loading cosmos-data.json:', err.message);
      return [];
    }
  }

  // ── Filter out profile icons & UI images ────────
  const PROFILE_PATTERNS = [
    /avatar/i,
    /profile/i,
    /user.*photo/i,
    /gravatar/i,
    /\/photos\/.*\/photo/i,          // Are.na user photos
    /fbcdn.*\/[a-z]_/i,              // Facebook CDN profile pics (small variant)
    /instagram.*\/s\d+x\d+\//i,     // Instagram profile thumbnails
    /pbs\.twimg\.com\/profile/i,     // Twitter profile images
    /googleusercontent.*=s\d+-c$/i,  // Google profile pics
    /\/p\/\d+x\d+\//i,              // Common CDN profile size pattern
    /default.*avatar/i,              // Default avatar images
    /placeholder/i,                  // Placeholder images
    /arena-avatars/i,                // Are.na avatar bucket
    /d2w9rnfcy7mm78.*\/small_/i,    // Are.na small thumbnails (often avatars)
  ];

  // Screenshots & low-quality content to filter out
  const SCREENSHOT_PATTERNS = [
    /screen.?shot/i,
    /^image\.(png|jpg|jpeg|webp)$/i,   // generic "image.png" saves
    /^image-\d+-/i,                     // generic "image-5-.jpg" saves
    /^untitled$/i,                      // unnamed saves
    /^photo$/i,
    /pinterest/i,                       // Pinterest screenshots or pins
    /instagram/i,                       // Instagram logos or screenshots
    /cdninstagram\.com/i,               // Instagram CDN in alt text
    /istockphoto/i,                     // Stock photo watermarks
    /^IMG_\d+\.(jpg|jpeg|png)$/i,      // phone camera rolls
    /^photo_\d/i,                       // generic photo exports
    /^download/i,                       // downloaded files
    /^capture/i,                        // screen captures
    /\d{4}-\d{2}-\d{2}.*\d{2}\.\d{2}\.\d{2}/i,  // timestamp filenames (screenshots)
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,  // UUID filenames
    /^\d{5,}_\d+.*\.(jpg|jpeg|png)/i,  // Instagram numeric export filenames (e.g. 464688339_550983...)
  ];

  function isJunkImage(src, alt) {
    // Check URL patterns for profile icons
    for (const pat of PROFILE_PATTERNS) {
      if (pat.test(src)) return true;
    }
    // Check alt/title for profile indicators
    if (alt && /^(profile|avatar|user|photo of)/i.test(alt)) return true;
    // Check for screenshots and generic saves
    if (alt) {
      for (const pat of SCREENSHOT_PATTERNS) {
        if (pat.test(alt)) return true;
      }
    }
    // Check URL for screenshot filenames
    if (/screen.?shot/i.test(src)) return true;
    return false;
  }

  // ── Shuffle (Fisher-Yates) ─────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Pinterest (local JSON from update-pinterest.py) ──
  async function fetchPinterestImages() {
    try {
      const res = await fetch('pinterest-data.json');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.images || []).map(img => ({
        src: img.src,
        alt: 'planetary dispositions',
        source: 'pinterest',
        isVideo: img.isVideo || false,
      }));
    } catch (_) {
      return [];
    }
  }

  // ── Public API ─────────────────────────────────
  async function getAllImages() {
    // Use cached raw data if available, but always reshuffle
    let raw = getCached();

    if (!raw || !raw.arena || raw.arena.length === 0) {
      const [arenaImages, cosmosImages, pinterestImages] = await Promise.all([
        fetchArenaImages().catch(err => {
          console.warn('[Loader] Are.na error:', err.message);
          return [];
        }),
        fetchCosmosImages(),
        fetchPinterestImages(),
      ]);

      raw = { arena: arenaImages, cosmos: cosmosImages, pinterest: pinterestImages };

      if (raw.arena.length > 0 || raw.cosmos.length > 0) {
        setCache(raw);
      }
    }

    // Always reshuffle so every page load shows a different mix
    const result = {
      arena: shuffle(raw.arena),
      cosmos: shuffle(raw.cosmos),
      pinterest: shuffle(raw.pinterest || []),
    };

    console.log(`[Loader] ${result.arena.length} Are.na + ${result.cosmos.length} Cosmos + ${result.pinterest.length} Pinterest`);
    return result;
  }

  return { getAllImages };
})();
