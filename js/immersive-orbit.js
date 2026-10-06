// ══════════════════════════════════════════════════════════════════
// IMMERSIVE ORBIT v4 — hand-tracked Saturn
//
// Gestures (one-hand):
//   • move           → aim: the cursor sits between thumb and index tips; the
//                      photo under it lights up
//   • pinch          → open that photo (thumb + index tips touch, like a click)
//   • fist           → close the open photo (hold ~⅓s)
//   • swipe (L/R)    → spin burst with a fast hand, decays naturally
//   • swipe down     → also closes an open photo
//
// Gestures (two-hand):
//   • L-frame        → both hands as L's (index up, other fingers curled);
//                      the dashed box between them zooms the orbit's photos
//                      in after ~½s (the face in the middle stays put).
//                      Swipe / pinch / fist keep working while zoomed; a fist
//                      with no photo open zooms back out.
//
// Onboarding:
//   • "you're seen" flash on first hand detection (one shot)
//   • progressive cards: spin → pinch → fist; the guide rail stays visible
//     and lights up whatever the camera currently reads
//
// Wander: when the Wander planet is showing (body.is-explore), the same
//   gestures spin that planet and open its clippings instead of the rings.
//   Entered from the "Wander with your hand" button.
//
// Exit: ✕ button in the HUD, or the Escape key.
// Debug: press D while inside (or add ?handdebug to the URL) for live
//        tracking stats and the active-region box on the camera preview.
// ══════════════════════════════════════════════════════════════════

const MP_VERSION  = '0.10.18';
const MP_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MODEL_PATH = 'assets/hand_landmarker.task';

// ── Detection / smoothing ─────────────────────────────────────────
const HAND_DETECT_INTERVAL_MS = 33; // ~30 detections/sec; stretched automatically when inference is slow
const DETECT_INTERVAL_PER_INFER_MS = 1.5; // never spend more than ~2/3 of the main thread on inference
const MAX_DETECT_INTERVAL_MS = 100;  // even on slow machines, keep ≥10 detections/sec
const INFER_WARMUP_DETECTIONS = 3;   // first calls compile shaders — don't let them skew the average
const NUM_HANDS            = 2;     // second hand feeds the two-hand L-frame (phase 3)
const HAND_LOST_GRACE_MS   = 250;   // hold the last pose through brief tracking dropouts
const HAND_SWITCH_JUMP     = 0.25;  // palm jump (frame units) that means a different hand → reset filters
const GPU_FAILURES_BEFORE_CPU = 3;

// One Euro filter: steady when the hand is still, responsive when it moves.
// Units are normalized frame coords, so beta is large compared with pixel-space tunings.
const ONE_EURO_MIN_CUTOFF  = 1.0;   // Hz — lower = steadier at rest
const ONE_EURO_BETA        = 8.0;   // higher = less lag on fast motion
const ONE_EURO_D_CUTOFF    = 1.0;   // Hz — derivative smoothing
const CURSOR_GLIDE_MS      = 40;    // per-frame glide between detections (time constant)

// ── Active region: the central slice of the camera that maps to the full
// viewport, aspect-matched so up/down and left/right feel equally sensitive.
const ACTIVE_REGION_WIDTH      = 0.7;   // fraction of camera width
const ACTIVE_REGION_MAX_HEIGHT = 0.8;   // fraction of camera height
const ACTIVE_REGION_CENTER_Y   = 0.45;  // hands sit slightly above frame centre

// Hand span (wrist → middle MCP) at a typical laptop distance. Motion
// thresholds scale with the live span so swipes feel the same near or far.
const REFERENCE_HAND_SPAN  = 0.15;
const HAND_SCALE_MIN       = 0.6;
const HAND_SCALE_MAX       = 1.5;

// ── Ring spin ──────────────────────────────────────────────────────
const IDLE_AUTO_SPIN_DEG   = 16;    // deg/sec drift when nothing else is driving
const SPIN_EASE            = 0.08;  // ease rate near idle
const RING_MULT            = { art: 1.0, arena: 0.7, cosmos: 0.5 };
const KEYBOARD_SPIN_DEG    = 220;
const WANDER_SPIN_MULT     = 0.6;   // the planet is bigger than a ring — a gentler burst reads the same
const MAX_SPIN_DEG         = 720;   // cap on accumulated swipe momentum (2 rot/sec)
const SPIN_FRICTION_RATE   = 1.05;  // per-sec multiplicative decay while coasting
const BRAKE_DECAY_RATE     = 6.0;   // per-sec decay when palm-open is braking (fast)

// ── Swipe detection ────────────────────────────────────────────────
const SWIPE_HISTORY_SIZE    = 12;
const SWIPE_WINDOW_MS       = 500;   // total time window considered
const SWIPE_MIN_WINDOW_MS   = 60;    // too fast = not a swipe
const SWIPE_MIN_DX          = 0.12;  // normalized frame-width displacement
const SWIPE_DIR_RATIO       = 0.55;  // min |dx| / (|dx| + |dy|) — mostly horizontal
const SWIPE_MIN_SAMPLES     = 3;     // MP runs ~20Hz; 3 samples catches fast swipes
const SWIPE_MIN_AVG_VEL     = 0.00025; // normalized units / ms — avg per-frame speed
const SWIPE_BURST_DEG       = 220;   // deg/sec added per swipe
const SWIPE_COOLDOWN_MS     = 260;   // keep swipes intentional, not jittery
const SWIPE_REBOUND_BLOCK_MS = 350;  // after a swipe, ignore opposite-direction swipes for this long
const DISMISS_MIN_DY        = 0.12;  // normalized frame-height downward displacement
const DISMISS_DIR_RATIO     = 0.62;  // min |dy| / (|dx| + |dy|) — mostly vertical

// ── Pose gestures: move to aim, pinch to open, fist to close ──────
// Pinch gap = thumb-tip ↔ index-tip distance / hand size (wrist ↔ middle
// MCP), on the aspect-corrected image. Real pinches measured 0.07–0.24;
// points and open hands ≥ 0.55 (scripts/fixtures/hand-poses.json).
const PINCH_CLOSED_GAP      = 0.25;  // at or below → fully pinched
const PINCH_OPEN_GAP        = 0.40;  // at or above → not pinching
const PINCH_BRAKE_GAP       = 0.45;  // fingers closing on a photo → hold the rings still
const PINCH_METER_GAP       = 0.55;  // cursor ring starts filling below this gap
const AIM_MEMORY_MS         = 400;   // a photo stays targeted briefly if the pinch nudges the cursor off it
const FIST_HOLD_MS          = 300;

// ── L-frame zoom ───────────────────────────────────────────────────
// Each hand's "L" = index straight + other three curled (real pointing
// hands score 1.0; fists, open hands and pinches ≤ 0.3).
const FRAME_POSE_SCORE      = 0.6;   // both hands at or above → framing
const FRAME_KEEP_SCORE      = 0.35;  // once framing, stay framing down to this
const FRAME_GRACE_MS        = 250;   // tolerate brief dropouts before the frame clears
const FRAME_LOCK_MS         = 500;   // hold the frame this long to zoom
const FRAME_MIN_W_PX        = 80;
const FRAME_MIN_H_PX        = 60;
const FRAME_RECT_GLIDE_MS   = 60;    // on-screen box smoothing (time constant)
const ZOOM_MAX              = 3;
const ZOOM_STEP_MAX         = 2;     // one frame gesture at most doubles the zoom
const FRAME_LOCK_GLIDE_MS   = 150;   // the zoom target averages the box over the hold, not one noisy tick
const ZOOM_FILL             = 0.9;   // the framed area fills 90% of the screen
const HOLD_METER_FADE_IN    = 0.04;  // progress below this → arc hidden
const HOLD_METER_SMOOTH     = 0.35;  // EMA on displayed progress for smoothness

// ── Shared state buildRing reads from ──────────────────────────────
window.ImmersiveOrbit = window.ImmersiveOrbit || {
  ringSpinDeg: { art: 0, arena: 0, cosmos: 0 }
};

// ══════════════════════════════════════════════════════════════════
//  MODULE STATE
// ══════════════════════════════════════════════════════════════════

const state = {
  active: false,
  loading: false,
  videoStream: null,
  landmarker: null,
  rafId: null,
  lastDetectTime: -Infinity,
  lastVideoTime: -1,

  delegate: null,              // 'GPU' | 'CPU' — whichever MediaPipe accepted
  inferMsAvg: 0,               // EMA of detectForVideo duration
  inferWarmupLeft: 0,          // detections still excluded from inferMsAvg
  detectHzAvg: 0,              // EMA of fresh detections per second
  lastFreshTs: 0,
  detectErrorCount: 0,
  fallingBackToCpu: false,

  // Landmarks
  smoothedLandmarks: null,   // One Euro filtered — for cursor, skeleton, hover targeting
  rawLandmarks: null,         // raw image-space landmarks from the last fresh detection — for swipes
  handPose: null,             // finger bends from image + worldLandmarks — for pose scoring
  otherHands: [],             // raw landmarks of any non-primary hands
  landmarkFilters: null,      // per-landmark One Euro filters for the primary hand
  lastHandSeenTs: 0,
  handSpan: REFERENCE_HAND_SPAN,
  cursorPos: null,            // displayed cursor position (glides between detections)
  poseScores: { pinch: 0, fist: 0, gap: NaN },
  otherPose: null,            // finger bends of the second hand (L-frame)
  frame: { sinceTs: 0, lastValidTs: 0, rect: null, shownRect: null, lockRect: null, armed: true },
  zoom: { el: null, faces: [], scale: 1, tx: 0, ty: 0, ox: 0, oy: 0 },   // target zoom
  zoomShown: { scale: 1, tx: 0, ty: 0 },                                  // zoom on screen (animating)
  debug: false,

  // Palm history for swipe detection
  palmHistory: [],             // [{x, y, t}, ...]
  palmSpeed: 0,                // latest palm speed, normalized units / ms
  lastSwipeTime: 0,
  lastSwipeDirection: 0,       // ±1 direction of the last successful swipe
  lastDismissTime: 0,

  // Spin
  currentVelocity: 0,
  lastTick: 0,
  keyboardSpin: 0,

  // Aim: the photo last pointed at (open hand opens it while still fresh)
  aimRing: null,
  aimTs: 0,
  displayedHoldProgress: 0,   // smoothed 0..1 for the cursor meter ring

  // Misc
  permissionDenied: false,
  openedRing: null,            // ring-image currently displayed in the lightbox
  lastCursoredRing: null,      // ring-image under cursor (for cursor-over class)
  onboardingShown: false,
  firstGestureFired: false,
  handSeenOnce: false,         // "you're seen" flash shown once per session
  onboardingStarted: false,    // cards visible (after seen-flash → fade-in)
  onboardingComplete: false,   // all onboarding cards marked is-done

  // Pose flags (kept for compatibility while the active UX stays simple)
  palmBraking: false,          // true while open-palm pose holds — decays spin fast
};

// ── DOM handles (resolved on init) ─────────────────────────────────
let $portalStar, $modal, $modalHint, $modalEnter, $modalCancel, $modalBody;
let $hud, $hudHint, $hudVideo, $hudExit, $hudHelp, $cam, $onboarding, $guide;
let $cursor, $cursorMeterFill, $seenFlash;
let $hudSkeleton, _hudSkelCtx = null, _hudSkelSized = false;

// MediaPipe hand topology (21 landmarks)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],          // thumb
  [0,5],[5,6],[6,7],[7,8],          // index
  [5,9],[9,10],[10,11],[11,12],     // middle
  [9,13],[13,14],[14,15],[15,16],   // ring
  [13,17],[0,17],[17,18],[18,19],[19,20], // pinky + palm edge
];
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// ══════════════════════════════════════════════════════════════════
//  GESTURE ICONS — inline SVG, constellation/line-art aesthetic
//  32px viewBox, cream stroke, round caps. Match Cancer/Libra hero stars.
// ══════════════════════════════════════════════════════════════════

// All icons: 24x24 viewBox, 1.8 stroke, constellation-leaning silhouettes that
// still read at ~18px in the persistent guide rail.
const GESTURE_ICONS = {
  // Horizontal motion: star trail + arrow tip. Reads as "sweep right".
  swipe: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="4"  cy="12" r="0.9" fill="currentColor" stroke="none" opacity="0.55"/>
      <circle cx="8"  cy="12" r="1.1" fill="currentColor" stroke="none" opacity="0.8"/>
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>
      <path d="M14.5 12 L20 12"/>
      <path d="M17.5 9 L20 12 L17.5 15"/>
    </svg>`,

  // Open palm: 5 fingertip stars in a fan + palm arc. Reads as "stop / hand".
  palm: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- Palm base arc -->
      <path d="M4.5 14 Q12 19 19.5 14" opacity="0.6"/>
      <!-- Five fingertip stars, middle finger tallest -->
      <circle cx="12"   cy="3.5" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="7.5"  cy="5.5" r="1.1" fill="currentColor" stroke="none"/>
      <circle cx="16.5" cy="5.5" r="1.1" fill="currentColor" stroke="none"/>
      <circle cx="4.5"  cy="9.5" r="1.0" fill="currentColor" stroke="none"/>
      <circle cx="19.5" cy="9.5" r="1.0" fill="currentColor" stroke="none"/>
      <!-- Finger lines up to tips (subtle) -->
      <path d="M12 12 L12 5 M9.5 12 L7.5 6.5 M14.5 12 L16.5 6.5 M7 13 L4.8 10 M17 13 L19.2 10" opacity="0.35"/>
    </svg>`,

  // Pointing: diagonal line ending in a 4-point spark. Reads as "aim".
  point: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- Hand base + pointing finger line -->
      <circle cx="6" cy="19" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M6.8 18.2 L17 8"/>
      <!-- Spark at tip — 4-point star -->
      <circle cx="17.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/>
      <path d="M17.5 3.5 L17.5 5 M17.5 10 L17.5 11.5 M13.5 7.5 L15 7.5 M20 7.5 L21.5 7.5" stroke-width="1.4"/>
    </svg>`,

  // Pinch: two rings touching with a spark. Reads as "precision grab".
  pinch: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="8"  cy="12" r="3.2"/>
      <circle cx="16" cy="12" r="3.2"/>
      <!-- Spark where they meet -->
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>
      <path d="M12 8 L12 9.5 M12 14.5 L12 16 M8.5 12 L9.5 12 M14.5 12 L15.5 12" stroke-width="1.4"/>
    </svg>`,

  // L-frame: two opposite corner brackets. Reads as "frame this".
  frame: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M4 10 L4 4 L10 4"/>
      <path d="M20 14 L20 20 L14 20"/>
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" opacity="0.7"/>
    </svg>`,

  // Fist: tight rounded shape + four knuckle dots. Reads as "closed hand".
  fist: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M6 8 Q6 5 9 5 L15 5 Q18 5 18 8 L18 16 Q18 19 15 19 L9 19 Q6 19 6 16 Z"/>
      <circle cx="9"  cy="9"  r="0.85" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="9"  r="0.85" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="9"  r="0.85" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="15.5" r="0.85" fill="currentColor" stroke="none"/>
    </svg>`,
};

// ══════════════════════════════════════════════════════════════════
//  GESTURE FRAMEWORK (v3)
//  Time-based gates (not RAF frames). Two-pass arbitration.
//  Each gesture:
//    compute(landmarks, handSpan)   → score 0..1
//    threshold / releaseThreshold    → hysteresis bounds
//    fireHoldMs / releaseHoldMs     → continuous time required, measured
//                                     via fresh-detection timestamps
//    cooldown (ms)                  → min time between fires
//    priority (higher wins conflicts)
//    mutualExclusion: [...]          → other gesture keys suppressing this
//    continuous: bool                → if true, onFire once + onRelease on release
//    onFire / onHold / onRelease / onReady (ready = rearmed after fire)
// ══════════════════════════════════════════════════════════════════

const GESTURE_DEFS = {
  // Pinch: a click. Fires once as thumb and index tips meet; opens the photo
  // under the cursor. Re-arms once the fingers part.
  pinch: {
    compute: (pose) => computePinchScore(pose),
    threshold: 0.6, releaseThreshold: 0.1,
    fireHoldMs: 60, releaseHoldMs: 80, cooldown: 300,
    priority: 2, mutualExclusion: ['fist'],
    onFire: () => onPinchFire(),
  },
  // Fist: closes the open photo. Does nothing else.
  fist: {
    compute: (lm) => computeFistScore(lm),
    threshold: 0.7, releaseThreshold: 0.35,
    fireHoldMs: FIST_HOLD_MS, releaseHoldMs: 200, cooldown: 600,
    priority: 3,
    onFire: () => onFistFire(),
  },
};

const gestureState = {};
for (const key of Object.keys(GESTURE_DEFS)) {
  gestureState[key] = {
    active: false,
    rearmed: true,          // becomes false after fire, true again after full release
    aboveSinceTs: 0,        // timestamp score first rose above threshold (0 = not above)
    belowSinceTs: 0,        // timestamp score first dropped below release
    lastFireTs: 0,
    lastScore: 0,
  };
}

/**
 * Evaluate every gesture with two-pass arbitration:
 *   1. Compute all scores.
 *   2. Compute per-gesture intent (wantActivate / wantStayActive / wantRelease / nothing).
 *   3. Resolve conflicts by priority + mutualExclusion (no callbacks fire yet).
 *   4. Apply winning transitions (fire callbacks).
 */
function evaluateGestures(smoothed, raw, handSpan, nowMs, isFreshDetection) {
  // Pass 1 — scores from the hand pose (finger bends).
  const source = raw;   // the hand pose (finger bends); null scores 0
  const scores = {};
  for (const [key, def] of Object.entries(GESTURE_DEFS)) {
    scores[key] = def.compute(source, handSpan);
    gestureState[key].lastScore = scores[key];
  }

  // Pass 2 — intents. Advance timers ONLY on fresh detections so "150ms hold"
  // reflects real detection evidence, not RAF ticks re-using cached landmarks.
  const intents = {};
  for (const [key, def] of Object.entries(GESTURE_DEFS)) {
    const st = gestureState[key];
    const score = scores[key];

    if (isFreshDetection) {
      // Track "above threshold since" and "below release-threshold since"
      if (score >= def.threshold) {
        if (st.aboveSinceTs === 0) st.aboveSinceTs = nowMs;
      } else {
        st.aboveSinceTs = 0;
      }
      if (score <= def.releaseThreshold) {
        if (st.belowSinceTs === 0) st.belowSinceTs = nowMs;
      } else {
        st.belowSinceTs = 0;
      }
      // Rearm latch: once enough continuous below-time has passed, rearm.
      if (!st.rearmed && st.belowSinceTs > 0 &&
          (nowMs - st.belowSinceTs) >= def.releaseHoldMs) {
        st.rearmed = true;
      }
    }

    if (st.active) {
      // Currently active — should we stay, or release?
      if (score < def.releaseThreshold &&
          st.belowSinceTs > 0 &&
          (nowMs - st.belowSinceTs) >= def.releaseHoldMs) {
        intents[key] = 'wantRelease';
      } else {
        intents[key] = 'wantStayActive';
      }
    } else {
      // Inactive — should we activate?
      if (st.rearmed &&
          st.aboveSinceTs > 0 &&
          (nowMs - st.aboveSinceTs) >= def.fireHoldMs &&
          (nowMs - st.lastFireTs) >= def.cooldown) {
        intents[key] = 'wantActivate';
      } else {
        intents[key] = 'idle';
      }
    }
  }

  // Pass 3 — resolve conflicts. Higher-priority wantActivate suppresses
  // mutually-excluded lower-priority gestures.
  const sortedKeys = Object.keys(GESTURE_DEFS).sort(
    (a, b) => GESTURE_DEFS[b].priority - GESTURE_DEFS[a].priority
  );
  const winners = { ...intents };
  const activatingOrActive = new Set();
  for (const key of sortedKeys) {
    const intent = winners[key];
    if (intent === 'wantActivate' || intent === 'wantStayActive') {
      activatingOrActive.add(key);
    }
  }
  for (const key of sortedKeys) {
    const def = GESTURE_DEFS[key];
    if (!def.mutualExclusion) continue;
    const winning = winners[key];
    if (winning !== 'wantActivate' && winning !== 'wantStayActive') continue;
    for (const blockerKey of def.mutualExclusion) {
      // If a gesture listed in our mutual-exclusion is activating/active AND
      // has higher priority, we must yield.
      if (activatingOrActive.has(blockerKey) &&
          GESTURE_DEFS[blockerKey].priority >= def.priority) {
        winners[key] = 'idle';
        // This gesture is suppressed — if it was active, force release later.
        if (gestureState[key].active) {
          winners[key] = 'wantRelease';
        }
        break;
      }
    }
  }

  // Pass 4 — apply transitions. Fire callbacks now, safely.
  for (const key of sortedKeys) {
    const def = GESTURE_DEFS[key];
    const st  = gestureState[key];
    const outcome = winners[key];

    if (outcome === 'wantActivate') {
      st.active = true;
      st.rearmed = false;
      st.lastFireTs = nowMs;
      st.aboveSinceTs = 0;
      st.belowSinceTs = 0;
      try {
        if (def.onFire) def.onFire(smoothed, raw);
      } catch (e) { console.warn('[ImmersiveOrbit] onFire threw:', e); }
      // NB: card advancement is driven by each gesture's specific handler
      // (detectSwipe, onPinchFire, onFistFire) — not by generic pose entry.
      // Pinch, in particular, advances only when a photo actually opens.
      dispatch('orbit:gesture-fired', { gesture: key, score: scores[key] });
    } else if (outcome === 'wantStayActive') {
      if (def.continuous && def.onHold) {
        try { def.onHold(smoothed, raw, nowMs); } catch (e) {}
      }
    } else if (outcome === 'wantRelease') {
      st.active = false;
      // rearmed flips to true only via below-threshold time — leave alone here
      if (def.continuous && def.onRelease) {
        try { def.onRelease(); } catch (e) {}
      }
    }
  }
}

/**
 * Called once the hand has been gone longer than the dropout grace. Resets
 * time-based counters and ends continuous poses (pointing) so the hand comes
 * back fresh. One-shot latches (open, fist) keep their state: losing the hand
 * isn't a deliberate release, so it can't re-fire them.
 */
function onHandLost() {
  for (const key of Object.keys(gestureState)) {
    const st = gestureState[key];
    st.aboveSinceTs = 0;
    st.belowSinceTs = 0;
    if (st.active && GESTURE_DEFS[key].continuous) {
      st.active = false;
      st.rearmed = true;
      try { if (GESTURE_DEFS[key].onRelease) GESTURE_DEFS[key].onRelease(); } catch (e) {}
    }
  }
  state.palmBraking = false;
  state.palmHistory = [];
  updateLiveGuide();
}

function isPinching() {
  return !!(gestureState.pinch && gestureState.pinch.active);
}

// Fingers closing toward a pinch over a photo: hold the rings still so the
// target doesn't slide out from under the click.
function isPinchApproaching(nowMs) {
  const gap = state.handPose ? state.handPose.gap : Infinity;
  return !state.openedRing && gap < PINCH_BRAKE_GAP && !!aimedRing(nowMs);
}

function aimedRing(nowMs) {
  const ring = state.aimRing;
  return ring && ring.isConnected && nowMs - state.aimTs <= AIM_MEMORY_MS ? ring : null;
}

function onPinchFire() {
  if ($cursor) {
    $cursor.classList.add('is-pinching');
    setTimeout(() => { if ($cursor) $cursor.classList.remove('is-pinching'); }, 220);
  }
  pulseOnboardingIcon('pinch');
  if (state.openedRing) return;
  const ring = aimedRing(performance.now());
  if (!ring || !openTarget(ring)) return;
  markFirstGesture('pinch');
}

// Guide rail: light up what the camera reads right now — aim while the
// cursor is on a photo, pinch/fist while those poses are held.
function updateLiveGuide() {
  if (!$guide) return;
  const live = {
    aim: !state.openedRing && !!state.lastCursoredRing,
    pinch: isPinching(),
    fist: !!(gestureState.fist && gestureState.fist.active),
    frame: isFraming(),
  };
  for (const [key, on] of Object.entries(live)) {
    const row = $guide.querySelector(`.orbit-hud-guide-row[data-gesture-key="${key}"]`);
    if (row) row.classList.toggle('is-live', on);
  }
}

// ══════════════════════════════════════════════════════════════════
//  GESTURE SCORE FUNCTIONS
//  Indices: 0=wrist, 4=thumbTip, 8=indexTip, 12=midTip, 16=ringTip, 20=pinkyTip
//           9 = middle-finger MCP (≈ palm center).
// ══════════════════════════════════════════════════════════════════

function dist2D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function handSpanOf(landmarks) {
  return Math.max(0.05, dist2D(landmarks[0], landmarks[9]));
}

// Motion-threshold multiplier: >1 when the hand is close to the camera
// (looks big, moves far in frame units), <1 when it's far away.
function handScale() {
  return clamp(state.handSpan / REFERENCE_HAND_SPAN, HAND_SCALE_MIN, HAND_SCALE_MAX);
}

// ══════════════════════════════════════════════════════════════════
//  LANDMARK FILTERING — One Euro (Casiez et al. 2012)
// ══════════════════════════════════════════════════════════════════

function smoothingAlpha(cutoffHz, dtSec) {
  const r = 2 * Math.PI * cutoffHz * dtSec;
  return r / (r + 1);
}

class OneEuroFilter {
  constructor(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.value = null;
    this.derivative = 0;
    this.lastTs = 0;
  }

  filter(value, tMs) {
    if (this.value === null) {
      this.value = value;
      this.derivative = 0;
      this.lastTs = tMs;
      return value;
    }
    const dt = Math.max(0.001, (tMs - this.lastTs) / 1000);
    this.lastTs = tMs;
    const rawDerivative = (value - this.value) / dt;
    this.derivative += (rawDerivative - this.derivative) * smoothingAlpha(this.dCutoff, dt);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    this.value += (value - this.value) * smoothingAlpha(cutoff, dt);
    return this.value;
  }
}

function makeLandmarkFilter() {
  return {
    x: new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF),
    y: new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF),
    z: new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF),
  };
}

function filterLandmarks(raw, nowMs) {
  if (!state.landmarkFilters || state.landmarkFilters.length !== raw.length) {
    state.landmarkFilters = raw.map(makeLandmarkFilter);
  }
  return raw.map((p, i) => {
    const f = state.landmarkFilters[i];
    return { x: f.x.filter(p.x, nowMs), y: f.y.filter(p.y, nowMs), z: f.z.filter(p.z || 0, nowMs) };
  });
}

// With two hands in frame, keep following the hand we were already
// tracking (nearest palm); on first sight, take the biggest (closest) hand.
function pickPrimaryHand(hands, worldHands) {
  let best = 0;
  if (hands.length > 1) {
    const prev = state.rawLandmarks;
    let bestMetric = Infinity;
    hands.forEach((hand, i) => {
      const metric = prev ? dist2D(hand[9], prev[9]) : -handSpanOf(hand);
      if (metric < bestMetric) { bestMetric = metric; best = i; }
    });
  }
  return {
    primary: hands[best],
    primaryWorld: worldHands && worldHands[best] ? worldHands[best] : null,
    others: hands.filter((_, i) => i !== best),
    othersWorld: worldHands ? worldHands.filter((_, i) => i !== best) : [],
  };
}

function acceptHandDetection(hands, worldHands, nowMs) {
  const { primary, primaryWorld, others, othersWorld } = pickPrimaryHand(hands, worldHands);
  const prev = state.rawLandmarks;
  if (prev && dist2D(primary[9], prev[9]) > HAND_SWITCH_JUMP) {
    state.landmarkFilters = null;   // a different hand — don't smear between them
    state.palmHistory = [];
    state.cursorPos = null;
  }
  state.rawLandmarks = primary;
  const camAspect = $cam && $cam.videoWidth && $cam.videoHeight ? $cam.videoWidth / $cam.videoHeight : 4 / 3;
  state.handPose = handPose(primary, primaryWorld, camAspect);
  state.otherHands = others;
  state.otherPose = others.length ? handPose(others[0], othersWorld[0] || null, camAspect) : null;
  state.smoothedLandmarks = filterLandmarks(primary, nowMs);
  state.handSpan = handSpanOf(primary);
  state.lastHandSeenTs = nowMs;
  state.poseScores = {
    pinch: computePinchScore(state.handPose),
    fist: computeFistScore(state.handPose),
    gap: state.handPose.gap,
  };
}

function clearTracking() {
  state.smoothedLandmarks = null;
  state.rawLandmarks = null;
  state.handPose = null;
  state.otherHands = [];
  state.otherPose = null;
  state.landmarkFilters = null;
  state.poseScores = { pinch: 0, fist: 0, gap: NaN };
}


// ── Hand pose from finger bend angles ─────────────────────────────
// Each finger's bend = the angles at its MCP, PIP and DIP joints added up
// (degrees): ~0–50 straight, ~120–250 curled. It is measured twice:
//   • on the flat camera image (aspect-corrected): reliable, except that a
//     fist facing the camera folds toward the lens and looks straight;
//   • on MediaPipe worldLandmarks (3D): catches that fold, but reads a
//     straight finger as bent fairly often.
// So a finger counts as curled if EITHER view sees a strong bend, and as
// straight if either view sees it straight. Thresholds were checked against
// real photos (scripts/fixtures/hand-poses.json).
// Joints per finger: MCP / PIP / DIP / TIP
//   index 5/6/7/8   middle 9/10/11/12   ring 13/14/15/16   pinky 17/18/19/20
const FINGER_JOINTS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

function jointAngle(a, b, c, useZ, xScale) {
  const ux = (b.x - a.x) * xScale, uy = b.y - a.y, uz = useZ ? (b.z || 0) - (a.z || 0) : 0;
  const vx = (c.x - b.x) * xScale, vy = c.y - b.y, vz = useZ ? (c.z || 0) - (b.z || 0) : 0;
  const nu = Math.sqrt(ux * ux + uy * uy + uz * uz), nv = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (nu < 1e-6 || nv < 1e-6) return 90;   // a joint folded straight at the lens: call it bent
  return Math.acos(clamp((ux * vx + uy * vy + uz * vz) / (nu * nv), -1, 1)) * 180 / Math.PI;
}

function fingerBends(lm, useZ, xScale) {
  return FINGER_JOINTS.map(([mcp, pip, dip, tip]) =>
    jointAngle(lm[0], lm[mcp], lm[pip], useZ, xScale) +
    jointAngle(lm[mcp], lm[pip], lm[dip], useZ, xScale) +
    jointAngle(lm[pip], lm[dip], lm[tip], useZ, xScale));
}

// image: normalized camera landmarks; world: worldLandmarks (or image again);
// xScale: camera width / height, so image angles aren't squashed.
function handPose(image, world, xScale) {
  const flat = fingerBends(image, false, xScale);
  const deep = fingerBends(world || image, true, 1);
  const flatDist = (a, b) => Math.hypot((a.x - b.x) * xScale, a.y - b.y);
  return {
    gap: flatDist(image[4], image[8]) / Math.max(flatDist(image[0], image[9]), 1e-4),
    flat,
    curl: flat.map((b, i) => Math.max(b, deep[i])),
    straight: flat.map((b, i) => Math.min(b, deep[i])),
  };
}

const average = (list) => list.reduce((sum, x) => sum + x, 0) / list.length;

// Fist: every finger curled — unless the flat image clearly shows a
// straight index, which a real fist never does.
function computeFistScore(pose) {
  if (!pose) return 0;
  const curled = clamp((average(pose.curl) - 100) / 50, 0, 1) * clamp((Math.min(...pose.curl) - 80) / 40, 0, 1);
  const indexNotStraight = clamp((pose.flat[0] - 25) / 15, 0, 1);
  return curled * indexNotStraight;
}

// Pinch: thumb and index tips together — but not a fist, where the thumb
// often rests on the curled index (real fists measured gaps down to 0.06).
function computePinchScore(pose) {
  if (!pose) return 0;
  const closed = clamp((PINCH_OPEN_GAP - pose.gap) / (PINCH_OPEN_GAP - PINCH_CLOSED_GAP), 0, 1);
  const notFist = clamp((0.6 - computeFistScore(pose)) / 0.2, 0, 1);
  return closed * notFist;
}

// L-frame hand: index straight, the other three curled.
function computeFrameHandScore(pose) {
  if (!pose) return 0;
  const indexStraight = clamp((60 - pose.straight[0]) / 30, 0, 1);
  const othersCurled = clamp((average(pose.curl.slice(1)) - 100) / 50, 0, 1);
  return indexStraight * othersCurled;
}

// ── Fist handler — closes an open photo. Never exits immersive mode;
// that's reserved for the ✕ button and Escape.
function onFistFire() {
  pulseOnboardingIcon('fist');
  if (state.openedRing || _isLightboxOpen()) {
    closeLightboxIfOpen();
    markFirstGesture('fist');
  } else if (isZoomed()) {
    resetZoom();
  }
  // Otherwise a no-op — the pulse still shows the fist was recognised.
}

// The ring lightbox (main.js) toggles `.visible` on a `.ring-lightbox` node.
function _isLightboxOpen() {
  const lb = document.querySelector('.ring-lightbox');
  if (lb && lb.classList.contains('visible')) return true;
  return !!(window.OrbitingExplore && window.OrbitingExplore.isDetailOpen && window.OrbitingExplore.isDetailOpen());
}

// ══════════════════════════════════════════════════════════════════
//  SWIPE DETECTION
//  Palm position history → directional burst. Replaces continuous
//  palm-velocity-to-spin mapping. One-shot with cooldown.
// ══════════════════════════════════════════════════════════════════

// Keeps recording through the cooldown so chained same-direction swipes
// already have history; the return stroke is caught by the rebound block.
// Slow drift while hovering an image can't pass the speed gate, so the
// dwell no longer needs to wipe this buffer.
function recordPalmSample(landmarks, nowMs) {
  const palm = landmarks[9];
  // Per-sample velocity magnitude so detectSwipe can check average speed.
  let v = 0;
  if (state.palmHistory.length > 0) {
    const prev = state.palmHistory[state.palmHistory.length - 1];
    const dt = Math.max(1, nowMs - prev.t);
    const vx = (palm.x - prev.x) / dt;
    const vy = (palm.y - prev.y) / dt;
    v = Math.sqrt(vx * vx + vy * vy);
  }
  state.palmSpeed = v;

  state.palmHistory.push({ x: palm.x, y: palm.y, t: nowMs, v });
  while (state.palmHistory.length > SWIPE_HISTORY_SIZE) state.palmHistory.shift();
  // Drop stale samples outside the window
  while (state.palmHistory.length > 0 &&
         nowMs - state.palmHistory[0].t > SWIPE_WINDOW_MS) {
    state.palmHistory.shift();
  }
}

function detectSwipe(nowMs) {
  if (nowMs - state.lastSwipeTime < SWIPE_COOLDOWN_MS) return 0;
  if (state.openedRing) return 0;
  if (isPinching()) return 0;   // moving while pinched is not a spin
  if (isFraming()) return 0;    // two hands framing are not a swipe
  if (state.palmHistory.length < SWIPE_MIN_SAMPLES) return 0;

  const oldest = state.palmHistory[0];
  const newest = state.palmHistory[state.palmHistory.length - 1];
  const elapsed = newest.t - oldest.t;
  if (elapsed < SWIPE_MIN_WINDOW_MS || elapsed > SWIPE_WINDOW_MS) return 0;

  const scale = handScale();
  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < SWIPE_MIN_DX * scale) return 0;
  if (adx / (adx + ady + 1e-6) < SWIPE_DIR_RATIO) return 0;

  // Average velocity check — rejects slow drifts and hesitant arcs.
  // Every sample's per-frame velMag must average above the minimum.
  let avgV = 0, vSamples = 0;
  for (let i = 1; i < state.palmHistory.length; i++) {
    avgV += state.palmHistory[i].v || 0;
    vSamples++;
  }
  if (vSamples > 0) avgV /= vSamples;
  if (avgV < SWIPE_MIN_AVG_VEL * scale) return 0;

  // Unmirrored camera: dx > 0 means user's hand moved to user's LEFT.
  // User-intuitive: right-swipe = spin clockwise (positive deg).
  // So dx > 0 → negative burst, dx < 0 → positive burst.
  const direction = dx > 0 ? -1 : 1;

  // Directional rebound block: after a swipe, ignore opposite-direction
  // swipes for SWIPE_REBOUND_BLOCK_MS. Same-direction swipes stack freely.
  // This replaces the old settle-velocity gate which blocked chained swipes.
  const sinceLastSwipe = nowMs - state.lastSwipeTime;
  if (state.lastSwipeDirection !== 0 &&
      direction !== state.lastSwipeDirection &&
      sinceLastSwipe < SWIPE_REBOUND_BLOCK_MS) {
    // Likely a rebound — drop history so it doesn't re-fire, but do NOT
    // emit a swipe burst.
    state.palmHistory = [];
    return 0;
  }

  state.lastSwipeTime = nowMs;
  state.lastSwipeDirection = direction;
  state.palmHistory = [];
  state.aimRing = null;   // the fingertip crossed photos mid-swipe; don't open one

  markFirstGesture('swipe');
  pulseOnboardingIcon('swipe');
  flashSwipeIndicator(direction);
  dispatch('orbit:gesture-fired', { gesture: 'swipe', direction });
  return direction * SWIPE_BURST_DEG;
}

function detectDismissSwipe(nowMs) {
  if (!state.openedRing) return false;
  if (nowMs - state.lastDismissTime < 450) return false;
  if (state.palmHistory.length < SWIPE_MIN_SAMPLES) return false;

  const oldest = state.palmHistory[0];
  const newest = state.palmHistory[state.palmHistory.length - 1];
  const elapsed = newest.t - oldest.t;
  if (elapsed < SWIPE_MIN_WINDOW_MS || elapsed > SWIPE_WINDOW_MS) return false;

  const scale = handScale();
  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (dy < DISMISS_MIN_DY * scale) return false;
  if (ady / (adx + ady + 1e-6) < DISMISS_DIR_RATIO) return false;

  let avgV = 0, vSamples = 0;
  for (let i = 1; i < state.palmHistory.length; i++) {
    avgV += state.palmHistory[i].v || 0;
    vSamples++;
  }
  if (vSamples > 0) avgV /= vSamples;
  if (avgV < SWIPE_MIN_AVG_VEL * scale) return false;

  state.lastDismissTime = nowMs;
  state.palmHistory = [];
  pulseOnboardingIcon('dismiss');
  closeLightboxIfOpen();
  dispatch('orbit:gesture-fired', { gesture: 'dismiss' });
  return true;
}

let _swipeFlashTimer = null;
function flashSwipeIndicator(direction) {
  if (!$hud) return;
  const thumb = $hud.querySelector('.orbit-hud-thumb');
  if (!thumb) return;
  thumb.classList.remove('is-swipe-flash', 'swipe-left', 'swipe-right');
  void thumb.offsetWidth;  // restart animation
  thumb.classList.add('is-swipe-flash', direction > 0 ? 'swipe-right' : 'swipe-left');
  if (_swipeFlashTimer) clearTimeout(_swipeFlashTimer);
  _swipeFlashTimer = setTimeout(() => {
    thumb.classList.remove('is-swipe-flash', 'swipe-left', 'swipe-right');
    _swipeFlashTimer = null;
  }, 450);
}

// ══════════════════════════════════════════════════════════════════
//  RING HIT-TEST + OPEN
//  Index-fingertip (landmark 8) → elementsFromPoint → ring-image.
//  If nothing hits directly, fall back to expanded-rect nearest match.
// ══════════════════════════════════════════════════════════════════

const RECT_PADDING_PX = 12;

// Wander planet showing → gestures act on its clippings, not the rings.
function wanderActive() {
  return !!window.OrbitingExplore && document.body.classList.contains('is-explore');
}

function targetSelector() {
  return wanderActive() ? '.explore-clipping' : '.ring-image';
}

function isWanderClipping(el) {
  return !!(el && el.classList && el.classList.contains('explore-clipping'));
}

// Central slice of the camera frame (normalized camera coords) that maps to
// the whole viewport. Its physical aspect matches the viewport, so a
// centimetre of hand travel moves the cursor equally far on both axes, and
// the user never has to reach the frame edges where tracking degrades.
function activeRegion() {
  const camW = ($cam && $cam.videoWidth) || 640;
  const camH = ($cam && $cam.videoHeight) || 480;
  const viewAspect = window.innerWidth / Math.max(1, window.innerHeight);
  let w = ACTIVE_REGION_WIDTH;
  let h = (w * camW) / (camH * viewAspect);
  if (h > ACTIVE_REGION_MAX_HEIGHT) {
    w *= ACTIVE_REGION_MAX_HEIGHT / h;
    h = ACTIVE_REGION_MAX_HEIGHT;
  }
  const cy = clamp(ACTIVE_REGION_CENTER_Y, h / 2, 1 - h / 2);
  return { x0: 0.5 - w / 2, y0: cy - h / 2, w, h };
}

function landmarkToScreen(lm) {
  // Detection runs on the unmirrored #orbitCam stream; user sees mirrored HUD.
  // Flip x to match what the user visually intuits.
  const r = activeRegion();
  const u = clamp((lm.x - r.x0) / r.w, 0, 1);
  const v = clamp((lm.y - r.y0) / r.h, 0, 1);
  return {
    x: (1 - u) * window.innerWidth,
    y: v * window.innerHeight,
  };
}

function findRingImageAt(x, y) {
  const selector = targetSelector();
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const match = el.closest ? el.closest(selector) : null;
    if (match) return match;
  }
  const imgs = document.querySelectorAll(selector);
  let best = null, bestDist = Infinity;
  for (const img of imgs) {
    if (img.hidden || img.getAttribute('aria-hidden') === 'true') continue; // far side of the planet
    const r = img.getBoundingClientRect();
    if (r.width === 0) continue;
    if (x < r.left - RECT_PADDING_PX || x > r.right + RECT_PADDING_PX) continue;
    if (y < r.top  - RECT_PADDING_PX || y > r.bottom + RECT_PADDING_PX) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestDist) { bestDist = d; best = img; }
  }
  return best;
}

function openTarget(ringImage) {
  if (!ringImage) return false;
  if (isWanderClipping(ringImage)) {
    state.openedRing = ringImage;
    ringImage.click();   // explore-planet.js opens its own detail view
    fireCursorSparkle();
    return true;
  }
  const media = ringImage._mediaEl;
  const src = media ? (media.src || media.currentSrc) : null;
  if (!src) return false;

  state.openedRing = ringImage;
  if (typeof window.openRingLightbox === 'function') {
    window.openRingLightbox(
      src,
      !!ringImage._isVideo,
      ringImage._source || 'art',
      ringImage._boardUrl || '',
      ringImage._metadata
    );
  }
  ringImage.classList.add('pinch-selected'); // CSS class name kept for style reuse
  fireCursorSparkle();
  return true;
}

function closeLightboxIfOpen() {
  if (window.OrbitingExplore && window.OrbitingExplore.isDetailOpen && window.OrbitingExplore.isDetailOpen()) {
    window.OrbitingExplore.closeDetail();
  }
  if (typeof window.closeRingLightbox === 'function') {
    try { window.closeRingLightbox(); } catch (e) {}
  }
  clearOpenedRingState();
}

function clearOpenedRingState() {
  if (state.openedRing) {
    state.openedRing.classList.remove('pinch-selected');
    state.openedRing = null;
  }
  // Clear the aim so the still-open hand can't reopen the same photo.
  state.aimRing = null;
  setHoldMeter(0);
}

// ══════════════════════════════════════════════════════════════════
//  CURSOR + PINCH METER
// ══════════════════════════════════════════════════════════════════

// Detections land at ~30Hz; the cursor glides toward each one every frame
// so it moves smoothly instead of stepping.
function updateCursorPosition(landmarks, dtSec, nowMs) {
  if (!$cursor) return;
  // Between thumb and index tips: as they pinch together this point barely
  // moves, so the click lands where you aimed.
  const target = landmarkToScreen({
    x: (landmarks[4].x + landmarks[8].x) / 2,
    y: (landmarks[4].y + landmarks[8].y) / 2,
  });
  if (!state.cursorPos) {
    state.cursorPos = target;
  } else {
    const a = 1 - Math.exp(-(dtSec * 1000) / CURSOR_GLIDE_MS);
    state.cursorPos = {
      x: state.cursorPos.x + (target.x - state.cursorPos.x) * a,
      y: state.cursorPos.y + (target.y - state.cursorPos.y) * a,
    };
  }
  const tip = state.cursorPos;
  $cursor.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
  if (!$cursor.classList.contains('is-visible')) {
    $cursor.classList.add('is-visible');
    $cursor.setAttribute('aria-hidden', 'false');
  }
  // Whatever is under the cursor is the target. Keep the last one briefly
  // so a pinch that nudges the cursor off its edge still lands.
  if (!state.openedRing) {
    const under = findRingImageAt(tip.x, tip.y);
    if (under || nowMs - state.aimTs > AIM_MEMORY_MS) {
      state.aimRing = under;
      state.aimTs = nowMs;
    }
  }
  const hoveredRing = state.openedRing ? null : aimedRing(nowMs);
  if (hoveredRing !== state.lastCursoredRing) {
    if (state.lastCursoredRing) state.lastCursoredRing.classList.remove('cursor-over');
    if (hoveredRing) hoveredRing.classList.add('cursor-over');
    state.lastCursoredRing = hoveredRing;
  }
}

function hideCursor() {
  state.cursorPos = null;
  if (!$cursor) return;
  $cursor.classList.remove('is-visible');
  $cursor.setAttribute('aria-hidden', 'true');
  if (state.lastCursoredRing) {
    state.lastCursoredRing.classList.remove('cursor-over');
    state.lastCursoredRing = null;
  }
}

function setHoldMeter(rawProgress) {
  state.displayedHoldProgress += (rawProgress - state.displayedHoldProgress) * HOLD_METER_SMOOTH;
  const s = state.displayedHoldProgress;
  if ($cursorMeterFill) {
    // pathLength=100 → dashoffset in [0 (full) ... 100 (empty)]
    $cursorMeterFill.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, s * 100)));
  }
  if ($cursor) {
    $cursor.classList.toggle('is-meter-visible', s > HOLD_METER_FADE_IN);
    $cursor.classList.toggle('is-meter-ready',   s > 0.80);
  }
}

// The cursor ring fills as thumb and index close on a photo (how near the
// click is), or while a fist is held with a photo open.
function updateHoldMeter(nowMs) {
  let progress = 0;
  if (state.openedRing) {
    const st = gestureState.fist;
    if (st && !st.active && st.aboveSinceTs > 0) progress = clamp((nowMs - st.aboveSinceTs) / FIST_HOLD_MS, 0, 1);
  } else if (aimedRing(nowMs) && state.handPose && !isPinching()) {
    progress = clamp((PINCH_METER_GAP - state.handPose.gap) / (PINCH_METER_GAP - PINCH_CLOSED_GAP), 0, 1);
  }
  setHoldMeter(progress);
}

// ══════════════════════════════════════════════════════════════════
//  L-FRAME ZOOM
//  Two L-hands make a box (bounding box of both index + thumb tips). Hold it
//  FRAME_LOCK_MS and the view zooms so the box fills the screen. Zoom uses
//  the CSS `translate` / `scale` properties, which stack on top of the
//  element's own `transform` animations instead of replacing them. In the
//  orbit view the face gets an exact counter-zoom: only the rings grow.
// ══════════════════════════════════════════════════════════════════

let $frame = null, $frameLabel = null;

function isFraming() {
  return state.frame.sinceTs > 0;
}

function isZoomed() {
  return state.zoom.scale > 1.001;
}

function zoomTargetEl() {
  return wanderActive() ? document.getElementById('explorePlanet') : document.getElementById('orbitCamera');
}

// Screen-space box between both hands' index and thumb tips, or null.
function currentFrameRect() {
  if (!state.smoothedLandmarks || !state.otherHands.length) return null;
  const a = state.smoothedLandmarks, b = state.otherHands[0];
  const pts = [a[4], a[8], b[4], b[8]].map(landmarkToScreen);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const rect = { x: Math.min(...xs), y: Math.min(...ys) };
  rect.w = Math.max(...xs) - rect.x;
  rect.h = Math.max(...ys) - rect.y;
  return rect.w >= FRAME_MIN_W_PX && rect.h >= FRAME_MIN_H_PX ? rect : null;
}

function framePoseHeld() {
  const need = isFraming() ? FRAME_KEEP_SCORE : FRAME_POSE_SCORE;
  return computeFrameHandScore(state.handPose) >= need && computeFrameHandScore(state.otherPose) >= need;
}

// Zoom that makes `rect` (screen px, as seen now) fill the viewport.
// `current` is the zoom already applied: screen = O + T + S·(base − O),
// where O is the target's transform origin on screen.
function zoomForRect(rect, current, viewW, viewH) {
  const { scale: S, tx, ty, ox, oy } = current;
  const toBase = (x, y) => ({ x: ox + (x - ox - tx) / S, y: oy + (y - oy - ty) / S });
  const a = toBase(rect.x, rect.y), b = toBase(rect.x + rect.w, rect.y + rect.h);
  const w = b.x - a.x, h = b.y - a.y;
  const scale = clamp(Math.min(viewW / w, viewH / h) * ZOOM_FILL, 1, Math.min(ZOOM_MAX, S * ZOOM_STEP_MAX));
  // Zoom about the orbit's own centre: the face stays put, so panning toward the
  // box would slide the rings off the face. The box sets only how far to zoom.
  return scale <= 1.001 ? { scale: 1, tx: 0, ty: 0, ox, oy } : { scale, tx: 0, ty: 0, ox, oy };
}

// Where an element's transform origin (its layout centre) sits on screen.
// Its own transform may already shift it (the orbit's friends depth slides
// it sideways; the face is centred with translate(-50%, -50%)), so undo that
// translation — scaled by `k`, the element's px → screen px factor.
function transformOrigin(el, k = 1) {
  const r = el.getBoundingClientRect();
  const t = getComputedStyle(el).transform;
  const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : { e: 0, f: 0 };
  return { ox: r.left + r.width / 2 - k * m.e, oy: r.top + r.height / 2 - k * m.f };
}

// Screen px per CSS px for this element (its ancestors' scale).
function screenScale(el) {
  return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
}

// The face rides inside the zoomed orbit; give it the exact opposite zoom so
// it stays where it was, at its normal size, while the rings grow around it.
//   orbit:  screen = O + T + S·(p − O)
//   face:   p → Of + k·Tf + p'·(p − Of) with p' = 1/S, solved for screen = p
function faceCounterZoom(z, face) {
  const S = z.scale;
  return {
    scale: 1 / S,
    tx: ((1 - S) * (face.ox - z.ox) - z.tx) / (S * face.k),
    ty: ((1 - S) * (face.oy - z.oy) - z.ty) / (S * face.k),
  };
}

const NO_ZOOM = { scale: 1, tx: 0, ty: 0 };
const ZOOM_ANIM_MS = 700;

function setZoomStyles(el, z) {
  const none = Math.abs(z.scale - 1) < 1e-4 && Math.abs(z.tx) < 0.01 && Math.abs(z.ty) < 0.01;
  el.style.translate = none ? '' : `${z.tx}px ${z.ty}px`;
  el.style.scale = none ? '' : String(z.scale);
}

function renderZoom(shown) {
  const zm = state.zoom;
  state.zoomShown = shown;
  if (!zm.el) return;
  setZoomStyles(zm.el, shown);
  const z = { ...shown, ox: zm.ox, oy: zm.oy };
  for (const face of zm.faces) setZoomStyles(face.el, faceCounterZoom(z, face));
}

// Driven frame by frame (not CSS transitions) so the orbit's zoom and the
// face's counter-zoom stay exact at every moment of the animation.
let _zoomRaf = 0;
function animateZoomTo(target, onDone) {
  cancelAnimationFrame(_zoomRaf);
  const from = { ...state.zoomShown };
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  const t0 = performance.now();
  const step = (now) => {
    const t = reduce ? 1 : clamp((now - t0) / ZOOM_ANIM_MS, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    renderZoom({
      scale: from.scale + (target.scale - from.scale) * e,
      tx: from.tx + (target.tx - from.tx) * e,
      ty: from.ty + (target.ty - from.ty) * e,
    });
    if (t < 1) _zoomRaf = requestAnimationFrame(step);
    else { _zoomRaf = 0; if (onDone) onDone(); }
  };
  _zoomRaf = requestAnimationFrame(step);
}

function zoomToRect(rect) {
  const el = zoomTargetEl();
  if (!el) return;
  if (state.zoom.el !== el) {
    clearZoomNow();
    // Measured unzoomed. In the orbit view the face (portrait + glow) is
    // held still; Wander has no face, so the whole planet zooms.
    const faces = el.id === 'orbitCamera'
      ? [...el.querySelectorAll('.saturn-glow, .saturn-body')].map((f) => {
          const k = screenScale(f);
          return { el: f, k, ...transformOrigin(f, k) };
        })
      : [];
    state.zoom = { el, faces, ...NO_ZOOM, ...transformOrigin(el) };
  }
  const next = zoomForRect(rect, { ...state.zoomShown, ox: state.zoom.ox, oy: state.zoom.oy },
    window.innerWidth, window.innerHeight);
  state.zoom = { ...state.zoom, scale: next.scale, tx: next.tx, ty: next.ty };
  document.body.classList.toggle('is-hand-zoomed', isZoomed());
  animateZoomTo(next);
  pulseOnboardingIcon('frame');
  dispatch('orbit:gesture-fired', { gesture: 'frame', scale: next.scale });
}

function resetZoom() {
  if (!state.zoom.el) return;
  state.zoom = { ...state.zoom, ...NO_ZOOM };
  document.body.classList.remove('is-hand-zoomed');
  animateZoomTo(NO_ZOOM, clearZoomNow);
}

function clearZoomNow() {
  cancelAnimationFrame(_zoomRaf);
  _zoomRaf = 0;
  const zm = state.zoom;
  if (zm.el) {
    setZoomStyles(zm.el, NO_ZOOM);
    zm.faces.forEach((f) => setZoomStyles(f.el, NO_ZOOM));
  }
  state.zoom = { el: null, faces: [], ...NO_ZOOM, ox: 0, oy: 0 };
  state.zoomShown = { ...NO_ZOOM };
  document.body.classList.remove('is-hand-zoomed');
}

function ensureFrameOverlay() {
  if ($frame) return;
  $frame = document.createElement('div');
  $frame.className = 'orbit-frame';
  $frame.setAttribute('aria-hidden', 'true');
  $frame.innerHTML = '<span class="orbit-frame-label"></span><span class="orbit-frame-progress"></span>';
  $frameLabel = $frame.querySelector('.orbit-frame-label');
  document.body.appendChild($frame);
}

function hideFrameOverlay() {
  if ($frame) $frame.classList.remove('is-visible', 'is-locked');
}

function clearFrame() {
  state.frame = { sinceTs: 0, lastValidTs: 0, rect: null, shownRect: null, lockRect: null, armed: true };
  hideFrameOverlay();
}

// Called every loop tick while a hand is in view.
// (The frame box zooms the orbit's photos; the face in the middle stays put.)
function updateFrame(nowMs, dtSec) {
  // Moved between the orbit and Wander while zoomed: the zoom belonged to
  // the other view, so let it go.
  if (isZoomed() && state.zoom.el !== zoomTargetEl()) resetZoom();
  const f = state.frame;
  const rect = framePoseHeld() ? currentFrameRect() : null;
  if (rect) {
    if (!f.sinceTs) f.sinceTs = nowMs;
    f.lastValidTs = nowMs;
    f.rect = rect;
    if (!f.lockRect) f.lockRect = { ...rect };
    else {
      const a = 1 - Math.exp(-((dtSec || 0.016) * 1000) / FRAME_LOCK_GLIDE_MS);
      for (const k of ['x', 'y', 'w', 'h']) f.lockRect[k] += (rect[k] - f.lockRect[k]) * a;
    }
  } else if (f.sinceTs && nowMs - f.lastValidTs > FRAME_GRACE_MS) {
    clearFrame();
    return;
  }
  if (!f.sinceTs || !f.rect) return;
  const progress = clamp((nowMs - f.sinceTs) / FRAME_LOCK_MS, 0, 1);
  if (progress >= 1 && f.armed) {
    f.armed = false;   // re-arms only when the hands drop out of the frame pose
    zoomToRect(f.lockRect || f.rect);
  }
  drawFrameOverlay(f, progress, dtSec);
}

function drawFrameOverlay(f, progress, dtSec) {
  ensureFrameOverlay();
  if (!f.shownRect) f.shownRect = { ...f.rect };
  else {
    const a = 1 - Math.exp(-((dtSec || 0.016) * 1000) / FRAME_RECT_GLIDE_MS);
    for (const k of ['x', 'y', 'w', 'h']) f.shownRect[k] += (f.rect[k] - f.shownRect[k]) * a;
  }
  const r = f.shownRect;
  $frame.style.transform = `translate(${r.x}px, ${r.y}px)`;
  $frame.style.width = `${r.w}px`;
  $frame.style.height = `${r.h}px`;
  $frame.style.setProperty('--frame-progress', String(progress));
  $frame.classList.add('is-visible');
  $frame.classList.toggle('is-locked', !f.armed);
  if ($frameLabel) $frameLabel.textContent = f.armed ? 'hold to zoom' : `zoomed ×${state.zoom.scale.toFixed(1)}`;
}

// ══════════════════════════════════════════════════════════════════
//  HAND SKELETON — drawn on the HUD preview to prove tracking works
// ══════════════════════════════════════════════════════════════════

function ensureSkeletonSized() {
  if (!$hudSkeleton || !_hudSkelCtx) return false;
  const rect = $hudSkeleton.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if ($hudSkeleton.width !== w || $hudSkeleton.height !== h) {
    $hudSkeleton.width = w;
    $hudSkeleton.height = h;
    _hudSkelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _hudSkelSized = true;
  } else if (!_hudSkelSized) {
    _hudSkelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _hudSkelSized = true;
  }
  return true;
}

function drawHandSkeleton(landmarks) {
  if (!$hudSkeleton || !_hudSkelCtx || !landmarks) return;
  if (!ensureSkeletonSized()) return;
  const rect = $hudSkeleton.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const videoWidth = $hudVideo.videoWidth || W;
  const videoHeight = $hudVideo.videoHeight || H;
  // Match centered object-fit: cover; CSS mirrors video and canvas together.
  const scale = Math.max(W / videoWidth, H / videoHeight);
  const drawnWidth = videoWidth * scale, drawnHeight = videoHeight * scale;
  const offsetX = (W - drawnWidth) / 2, offsetY = (H - drawnHeight) / 2;
  const point = (landmark) => ({ x: landmark.x * drawnWidth + offsetX, y: landmark.y * drawnHeight + offsetY });
  const ctx = _hudSkelCtx;
  ctx.clearRect(0, 0, W, H);

  // Connections (cream lines)
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.78)';
  ctx.shadowColor = 'rgba(255, 220, 180, 0.45)';
  ctx.shadowBlur = 3;
  for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
    const [a, b] = HAND_CONNECTIONS[i];
    const A = landmarks[a], B = landmarks[b];
    if (!A || !B) continue;
    ctx.beginPath();
    const start = point(A), end = point(B);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Joints (cream dots)
  ctx.fillStyle = 'rgba(255, 248, 232, 0.95)';
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    const r = FINGERTIP_INDICES.indexOf(i) !== -1 ? 2.8 : 1.8;
    ctx.beginPath();
    const mapped = point(p);
    ctx.arc(mapped.x, mapped.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fingertip glow (gold)
  ctx.fillStyle = 'rgba(255, 220, 150, 0.35)';
  for (let i = 0; i < FINGERTIP_INDICES.length; i++) {
    const p = landmarks[FINGERTIP_INDICES[i]];
    if (!p) continue;
    ctx.beginPath();
    const mapped = point(p);
    ctx.arc(mapped.x, mapped.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clearHandSkeleton() {
  if (!$hudSkeleton || !_hudSkelCtx) return;
  const rect = $hudSkeleton.getBoundingClientRect();
  _hudSkelCtx.clearRect(0, 0, rect.width, rect.height);
}

// ══════════════════════════════════════════════════════════════════
//  DEBUG OVERLAY — live tracking numbers for tuning (D key / ?handdebug)
// ══════════════════════════════════════════════════════════════════

let $debugPanel = null;

function setDebug(on) {
  state.debug = on;
  if (on && !$debugPanel) {
    $debugPanel = document.createElement('pre');
    $debugPanel.id = 'orbitHandDebug';
    $debugPanel.setAttribute('aria-hidden', 'true');
    Object.assign($debugPanel.style, {
      position: 'fixed', left: '16px', bottom: '16px', zIndex: '10000', margin: '0',
      padding: '10px 12px', borderRadius: '8px', pointerEvents: 'none',
      font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      color: 'rgba(255, 248, 232, 0.95)', background: 'rgba(10, 8, 20, 0.78)',
      whiteSpace: 'pre',
    });
    document.body.appendChild($debugPanel);
  }
  if ($debugPanel) $debugPanel.style.display = on ? 'block' : 'none';
}

function fmt(n, digits) { return Number.isFinite(n) ? n.toFixed(digits) : '–'; }

function updateDebugOverlay(haveHand) {
  if (!$debugPanel) return;
  const scale = handScale();
  const s = state.poseScores;
  const best = [['pinch', s.pinch], ['fist', s.fist]].sort((a, b) => b[1] - a[1])[0];
  const pose = best && best[1] >= 0.6 ? best[0] : '—';
  const hands = haveHand ? 1 + state.otherHands.length : 0;
  $debugPanel.textContent = [
    `delegate ${state.delegate || '…'}  infer ${fmt(state.inferMsAvg, 1)}ms  ${fmt(state.detectHzAvg, 0)}Hz`,
    `hands ${hands}  span ${fmt(state.handSpan, 3)}  scale ×${fmt(scale, 2)}`,
    `pose ${pose.padEnd(5)} pinch ${fmt(s.pinch, 2)} (gap ${fmt(s.gap, 2)})  fist ${fmt(s.fist, 2)}`,
    `palm ${fmt(state.palmSpeed * 1000, 2)}/s  swipe ≥ ${fmt(SWIPE_MIN_AVG_VEL * scale * 1000, 2)}/s over ${fmt(SWIPE_MIN_DX * scale, 3)}`,
    `frame L ${fmt(computeFrameHandScore(state.handPose), 2)} / ${fmt(computeFrameHandScore(state.otherPose), 2)}  ${isFraming() ? 'framing' : '—'}  zoom ×${fmt(state.zoom.scale, 2)}`,
    `spin ${fmt(state.currentVelocity, 0)}°/s  aim ${aimedRing(performance.now()) ? 'on' : 'off'}  active ${Object.keys(GESTURE_DEFS).filter((k) => gestureState[k].active).join(',') || '—'}`,
  ].join('\n');
}

// Dashed box on the camera preview showing the slice of the frame that maps
// to the full screen. Same object-fit: cover mapping as drawHandSkeleton.
function drawActiveRegionGuide() {
  if (!$hudSkeleton || !_hudSkelCtx || !ensureSkeletonSized()) return;
  const rect = $hudSkeleton.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const vw = $hudVideo.videoWidth || W, vh = $hudVideo.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale, dh = vh * scale;
  const ox = (W - dw) / 2, oy = (H - dh) / 2;
  const r = activeRegion();
  const ctx = _hudSkelCtx;
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 220, 150, 0.7)';
  ctx.strokeRect(r.x0 * dw + ox, r.y0 * dh + oy, r.w * dw, r.h * dh);
  ctx.restore();
}

let _sparkleTimer = null;
function fireCursorSparkle() {
  if (!$cursor) return;
  $cursor.classList.remove('is-sparkling');
  void $cursor.offsetWidth;
  $cursor.classList.add('is-sparkling');
  if (_sparkleTimer) clearTimeout(_sparkleTimer);
  _sparkleTimer = setTimeout(() => {
    if ($cursor) $cursor.classList.remove('is-sparkling');
    _sparkleTimer = null;
  }, 600);
}

// ══════════════════════════════════════════════════════════════════
//  ONBOARDING HUD
// ══════════════════════════════════════════════════════════════════

// First-impression cards: spin, then pinch to open, then fist to close. The guide rail below keeps every gesture visible.
const ONBOARDING_CARDS = [
  { key: 'swipe', icon: GESTURE_ICONS.swipe, label: 'swipe to spin' },
  { key: 'pinch', icon: GESTURE_ICONS.pinch, label: 'pinch to open' },
  { key: 'fist',  icon: GESTURE_ICONS.fist,  label: 'fist to close' },
];

// Persistent guide rail — every gesture, always visible. Rows light up
// (is-live) while the camera reads them.
const GUIDE_RAIL_ITEMS = [
  { key: 'swipe', icon: GESTURE_ICONS.swipe, label: 'swipe to spin' },
  { key: 'aim',   icon: GESTURE_ICONS.point, label: 'move to aim' },
  { key: 'pinch', icon: GESTURE_ICONS.pinch, label: 'pinch to open' },
  { key: 'frame', icon: GESTURE_ICONS.frame, label: 'L-frame to zoom' },
  { key: 'fist',  icon: GESTURE_ICONS.fist,  label: 'fist to close / zoom out' },
];

function buildOnboardingCards() {
  if (!$onboarding || $onboarding.childElementCount > 0) return;
  for (const item of ONBOARDING_CARDS) {
    const card = document.createElement('div');
    card.className = 'orbit-gesture-card';
    card.dataset.gestureKey = item.key;
    card.innerHTML = `
      <div class="orbit-gesture-icon">${item.icon}</div>
      <div class="orbit-gesture-label">${item.label}</div>
    `;
    $onboarding.appendChild(card);
  }
}

function buildGuideRail() {
  if (!$guide || $guide.childElementCount > 0) return;
  for (const item of GUIDE_RAIL_ITEMS) {
    const row = document.createElement('div');
    row.className = 'orbit-hud-guide-row';
    row.dataset.gestureKey = item.key;
    row.innerHTML = `
      <div class="orbit-hud-guide-icon">${item.icon}</div>
      <div class="orbit-hud-guide-label">${item.label}</div>
    `;
    $guide.appendChild(row);
  }
}

// Reset card progression — called on each new immersive session so the
// user starts fresh each time.
function resetOnboardingCards() {
  if (!$onboarding) return;
  const cards = $onboarding.querySelectorAll('.orbit-gesture-card');
  cards.forEach(c => c.classList.remove('is-current', 'is-done', 'is-pulse'));
}

// Promote the first not-yet-done card to `is-current`. Called when the
// cards first appear and after each successful gesture.
function promoteCurrentCard() {
  if (!$onboarding) return false;
  const cards = Array.from($onboarding.querySelectorAll('.orbit-gesture-card'));
  let promoted = false;
  for (const c of cards) {
    c.classList.remove('is-current');
    if (!c.classList.contains('is-done') && !promoted) {
      c.classList.add('is-current');
      promoted = true;
    }
  }
  return promoted; // false = every card already done
}

function showOnboarding(/* manual */) {
  if (!$onboarding) return;
  // Restart progression if the user hit Help after completing it
  if (state.onboardingComplete) {
    state.onboardingComplete = false;
    resetOnboardingCards();
  }
  promoteCurrentCard();
  $onboarding.classList.add('is-visible');
  $onboarding.setAttribute('aria-hidden', 'false');
  state.onboardingStarted = true;
  state.onboardingShown = true;
}

function hideOnboarding() {
  if (!$onboarding) return;
  $onboarding.classList.remove('is-visible');
  $onboarding.setAttribute('aria-hidden', 'true');
}

// One-shot "you're seen" flash on first hand detection of the session.
// Then, after the text fades, the onboarding cards reveal themselves.
function showSeenFlash() {
  if (!$seenFlash || state.handSeenOnce) return;
  state.handSeenOnce = true;
  $seenFlash.textContent = "you're seen";
  $seenFlash.classList.add('is-visible');
  setTimeout(() => {
    if ($seenFlash) $seenFlash.classList.remove('is-visible');
    // Brief beat after the text fades before the cards appear —
    // skip if the user has already left immersive mode.
    setTimeout(() => {
      if (state.active) showOnboarding(false);
    }, 500);
  }, 1600);
}

// Called by every gesture-fire site. Marks the matching card done,
// promotes the next one to current, and ends the lesson once all
// three core gestures have been performed.
function markFirstGesture(key) {
  state.firstGestureFired = true;
  if (!state.onboardingStarted || state.onboardingComplete) return;
  if (!$onboarding) return;
  const card = $onboarding.querySelector(
    `.orbit-gesture-card[data-gesture-key="${key}"]`
  );
  if (!card || card.classList.contains('is-done')) return;
  card.classList.remove('is-current');
  card.classList.add('is-done');
  const stillPending = promoteCurrentCard();
  if (!stillPending) {
    state.onboardingComplete = true;
    // Keep both instructions available after the first successful gestures.
  }
}

function pulseOnboardingIcon(key) {
  const targets = [];
  if ($onboarding) {
    const card = $onboarding.querySelector(`.orbit-gesture-card[data-gesture-key="${key}"]`);
    if (card) targets.push(card);
  }
  if ($guide) {
    const row = $guide.querySelector(`.orbit-hud-guide-row[data-gesture-key="${key}"]`);
    if (row) targets.push(row);
  }
  for (const el of targets) {
    el.classList.remove('is-pulse');
    void el.offsetWidth;
    el.classList.add('is-pulse');
    setTimeout(() => el.classList.remove('is-pulse'), 700);
  }
}

// ══════════════════════════════════════════════════════════════════
//  INIT + PORTAL FLOW
// ══════════════════════════════════════════════════════════════════

function init() {
  $portalStar   = document.querySelector('.portal-star');
  $modal        = document.getElementById('orbitModal');
  $modalBody    = document.getElementById('orbitModalBody');
  $modalHint    = document.getElementById('orbitModalHint');
  $modalEnter   = document.getElementById('orbitEnterBtn');
  $modalCancel  = document.getElementById('orbitCancelBtn');
  $hud          = document.getElementById('orbitHud');
  $hudHint      = document.getElementById('orbitHudHint');
  $hudVideo     = document.getElementById('orbitHudVideo');
  $hudExit      = document.getElementById('orbitHudExitBtn');
  $hudHelp      = document.getElementById('orbitHudHelpBtn');
  $cam          = document.getElementById('orbitCam');
  $onboarding   = document.getElementById('orbitOnboarding');
  $guide        = document.getElementById('orbitGuide');
  $cursor       = document.getElementById('orbitCursor');
  $cursorMeterFill = $cursor ? $cursor.querySelector('.orbit-cursor-meter-fill') : null;
  $seenFlash    = document.getElementById('orbitSeenFlash');
  $hudSkeleton  = document.getElementById('orbitHudSkeleton');
  if ($hudSkeleton) {
    try { _hudSkelCtx = $hudSkeleton.getContext('2d'); } catch (e) { _hudSkelCtx = null; }
    if (_hudSkelCtx) {
      // Size once after layout + resync on resize
      requestAnimationFrame(ensureSkeletonSized);
      window.addEventListener('resize', () => { _hudSkelSized = false; }, { passive: true });
    }
  }

  if (!$portalStar || !$modal) {
    console.warn('[ImmersiveOrbit] Missing required DOM nodes');
    return;
  }

  buildOnboardingCards();
  buildGuideRail();
  try {
    if (new URLSearchParams(window.location.search).has('handdebug')) state.debug = true;
  } catch (e) {}

  $portalStar.addEventListener('click', (e) => {
    e.stopPropagation();
    onPortalActivate();
  });

  $modalCancel.addEventListener('click', closeModal);
  $modalEnter.addEventListener('click', onEnterConfirmed);
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal || e.target.classList.contains('orbit-modal-backdrop')) {
      if (!state.loading) closeModal();
    }
  });

  $hudExit.addEventListener('click', () => exitImmersive('button'));
  if ($hudHelp) $hudHelp.addEventListener('click', () => showOnboarding(true));

  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('keyup', onGlobalKeyup);
  window.addEventListener('ring-lightbox:close', clearOpenedRingState);
  window.addEventListener('explore-detail:close', clearOpenedRingState);
  const wanderHandBtn = document.getElementById('wanderHandBtn');
  if (wanderHandBtn) wanderHandBtn.addEventListener('click', onPortalActivate);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', () => stopStreamOnly());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.active) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = null;
    } else if (!document.hidden && state.active && !state.rafId) {
      state.lastTick = performance.now();
      state.rafId = requestAnimationFrame(detectLoop);
    }
  });
}

function onPortalActivate() {
  if (state.active || state.loading) return;
  if (isCoarsePointerOrMobile()) {
    openModal({
      title: 'desktop experience',
      body: 'this one needs a camera and some room to move. come back on a laptop 🪐',
      enter: null, cancel: 'okay',
    });
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    openModal({
      title: 'no camera available',
      body: 'your browser won’t let me reach the webcam here. try chrome or safari on a laptop.',
      enter: null, cancel: 'okay',
    });
    return;
  }
  openModal();
}

function isCoarsePointerOrMobile() {
  try { if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true; }
  catch (e) {}
  return window.innerWidth < 700;
}

function openModal(opts) {
  opts = opts || {};
  const titleEl = $modal.querySelector('.orbit-modal-title');
  const bodyEl  = $modalBody || $modal.querySelector('.orbit-modal-body');
  titleEl.textContent = opts.title || (wanderActive() ? 'wander with your hand?' : 'enter my orbit?');

  // Reset the body each time so staggered beat animations replay. Custom
  // messages (e.g. "no camera available") collapse to a single paragraph.
  bodyEl.innerHTML = '';
  if (opts.body) {
    const p = document.createElement('p');
    p.className = 'orbit-modal-beat';
    p.textContent = opts.body;
    bodyEl.appendChild(p);
  } else {
    const beats = [
      'your camera becomes a quiet controller.',
      'nothing is recorded. nothing leaves your browser.',
      "once you're inside, the first move will show itself.",
    ];
    for (const text of beats) {
      const p = document.createElement('p');
      p.className = 'orbit-modal-beat';
      p.textContent = text;
      bodyEl.appendChild(p);
    }
  }
  $modalHint.textContent = '';

  if (opts.enter === null) {
    $modalEnter.style.display = 'none';
  } else {
    $modalEnter.style.display = '';
    $modalEnter.textContent = opts.enter || 'enter';
  }
  $modalCancel.textContent = opts.cancel || 'not now';

  $modal.classList.add('is-open');
  $modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    ($modalEnter.style.display === 'none' ? $modalCancel : $modalEnter).focus();
  }, 50);
}

function closeModal() {
  $modal.classList.remove('is-open');
  $modal.setAttribute('aria-hidden', 'true');
  setModalLoading(false);
  if ($portalStar) $portalStar.focus();
}

function setModalLoading(loading) {
  state.loading = loading;
  $modalEnter.disabled = loading;
  $modalCancel.disabled = loading;
  $modalEnter.textContent = loading ? 'tuning in…' : 'enter';
}

async function onEnterConfirmed() {
  if (state.loading) return;
  setModalLoading(true);
  $modalHint.textContent = '';

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    state.permissionDenied = true;
    setModalLoading(false);
    $modalHint.textContent = err.name === 'NotAllowedError'
      ? 'camera access was blocked. you can try again anytime.'
      : 'couldn’t open the camera — ' + (err.message || 'unknown error');
    console.warn('[ImmersiveOrbit] getUserMedia failed:', err);
    return;
  }
  state.videoStream = stream;
  $cam.srcObject = stream;
  $hudVideo.srcObject = stream;
  try { await $cam.play(); } catch (e) {}
  try { await $hudVideo.play(); } catch (e) {}

  // Reuse the landmarker across sessions — skips the slow import +
  // createFromOptions on re-entry.
  if (!state.landmarker) {
    try {
      $modalHint.textContent = 'waking up the sky…';
      state.landmarker = await createLandmarker(['GPU', 'CPU']);
    } catch (err) {
      setModalLoading(false);
      $modalHint.textContent = 'hand tracking couldn’t load. check your connection?';
      console.error('[ImmersiveOrbit] HandLandmarker init failed:', err);
      stopStreamOnly();
      return;
    }
  }

  beginImmersiveSession();
}

let _mpModule = null, _mpVision = null;

// Try each delegate in order; GPU is much faster where it works, CPU is the
// safe fallback (older Safari, blocked WebGL, flaky drivers).
async function createLandmarker(delegates) {
  if (!_mpModule) _mpModule = await import(/* @vite-ignore */ MP_BUNDLE_URL);
  if (!_mpVision) _mpVision = await _mpModule.FilesetResolver.forVisionTasks(MP_WASM_URL);
  let lastErr = null;
  for (const delegate of delegates) {
    try {
      const landmarker = await _mpModule.HandLandmarker.createFromOptions(_mpVision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numHands: NUM_HANDS,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.4,  // a bit forgiving so fast motion doesn't drop tracking
        minTrackingConfidence: 0.4,
      });
      state.delegate = delegate;
      state.inferMsAvg = 0;
      state.inferWarmupLeft = INFER_WARMUP_DETECTIONS;
      return landmarker;
    } catch (err) {
      lastErr = err;
      console.warn(`[ImmersiveOrbit] HandLandmarker ${delegate} delegate unavailable:`, err);
    }
  }
  throw lastErr;
}

// Some GPUs accept the delegate but then fail per-frame — swap to CPU once.
async function fallbackToCpu() {
  if (state.fallingBackToCpu) return;
  state.fallingBackToCpu = true;
  const old = state.landmarker;
  state.landmarker = null;
  try { if (old) old.close(); } catch (e) {}
  try {
    state.landmarker = await createLandmarker(['CPU']);
  } catch (err) {
    console.error('[ImmersiveOrbit] CPU fallback failed:', err);
  }
  state.detectErrorCount = 0;
  state.fallingBackToCpu = false;
}

function beginImmersiveSession() {
  state.active = true;
  setModalLoading(false);   // re-enable Enter so a later re-entry works
  state.firstGestureFired = false;
  clearTracking();
  state.cursorPos = null;
  state.palmSpeed = 0;
  state.detectErrorCount = 0;
  state.palmHistory = [];
  state.lastSwipeTime = 0;
  state.lastSwipeDirection = 0;
  state.lastDismissTime = 0;
  state.displayedHoldProgress = 0;
  state.aimRing = null;
  state.aimTs = 0;
  state.palmBraking = false;
  state.handSeenOnce = false;
  state.onboardingStarted = false;
  state.onboardingComplete = false;
  resetOnboardingCards();
  if ($onboarding) $onboarding.classList.remove('is-visible');
  if ($seenFlash) $seenFlash.classList.remove('is-visible');
  $modal.classList.remove('is-open');
  $modal.setAttribute('aria-hidden', 'true');
  document.body.classList.add('immersive-active');
  $hud.setAttribute('aria-hidden', 'false');

  if (window.gsap) {
    window.gsap.to('.saturn-container', { scale: 1.06, duration: 0.9, ease: 'power3.out' });
  }

  // Instructions are visible immediately, even before a hand is detected.
  showOnboarding(false);
  setDebug(state.debug);

  state.lastTick = performance.now();
  state.lastDetectTime = -Infinity;
  state.lastVideoTime = -1;
  state.rafId = requestAnimationFrame(detectLoop);

  dispatch('orbit:enter');
}

// ══════════════════════════════════════════════════════════════════
//  DETECT LOOP
// ══════════════════════════════════════════════════════════════════

function detectLoop(now) {
  if (!state.active) return;

  const dt = Math.min(0.1, (now - state.lastTick) / 1000);
  state.lastTick = now;

  let haveHand = false;
  let isFreshDetection = false;

  // Slow machines stretch the interval so inference never starves rendering.
  const detectInterval = clamp((state.inferMsAvg || 0) * DETECT_INTERVAL_PER_INFER_MS, HAND_DETECT_INTERVAL_MS, MAX_DETECT_INTERVAL_MS);
  if (now - state.lastDetectTime >= detectInterval && state.landmarker && $cam.readyState >= 2 && $cam.currentTime !== state.lastVideoTime) {
    state.lastDetectTime = now;
    state.lastVideoTime = $cam.currentTime;
    try {
      const t0 = performance.now();
      const result = state.landmarker.detectForVideo($cam, now);
      const inferMs = performance.now() - t0;
      if (state.inferWarmupLeft > 0) state.inferWarmupLeft--;
      else state.inferMsAvg = state.inferMsAvg ? state.inferMsAvg + (inferMs - state.inferMsAvg) * 0.1 : inferMs;
      if (state.lastFreshTs) {
        const hz = 1000 / Math.max(1, now - state.lastFreshTs);
        state.detectHzAvg = state.detectHzAvg ? state.detectHzAvg + (hz - state.detectHzAvg) * 0.1 : hz;
      }
      state.lastFreshTs = now;
      state.detectErrorCount = 0;
      if (result.landmarks && result.landmarks.length > 0) {
        acceptHandDetection(result.landmarks, result.worldLandmarks, now);
        haveHand = true;
        isFreshDetection = true;
        // First-ever fresh detection of this session → "you're seen" flash,
        // then the onboarding cards reveal themselves.
        if (!state.handSeenOnce) showSeenFlash();
      } else if (state.smoothedLandmarks && now - state.lastHandSeenTs < HAND_LOST_GRACE_MS) {
        haveHand = true;  // brief dropout — hold the last pose instead of resetting
      } else {
        state.smoothedLandmarks = null;
        state.rawLandmarks = null;
        state.landmarkFilters = null;
        onHandLost();
      }
    } catch (err) {
      state.smoothedLandmarks = null;
      state.rawLandmarks = null;
      state.landmarkFilters = null;
      onHandLost();
      console.warn('[ImmersiveOrbit] detectForVideo failed:', err);
      state.detectErrorCount = (state.detectErrorCount || 0) + 1;
      if (state.delegate === 'GPU' && state.detectErrorCount >= GPU_FAILURES_BEFORE_CPU) fallbackToCpu();
    }
  } else if (state.smoothedLandmarks) {
    haveHand = true;  // Reuse last smoothed landmarks between detections
  }

  // Cursor + gesture evaluation + hold meter
  if (haveHand && state.smoothedLandmarks) {
    updateCursorPosition(state.smoothedLandmarks, dt, now);
    drawHandSkeleton(state.smoothedLandmarks);
    const handSpan = state.handSpan;
    if (isFreshDetection) {
      // Raw landmarks for swipe — smoothing lags the fast motion and
      // inflates the displacement/velocity thresholds in practice.
      recordPalmSample(state.rawLandmarks || state.smoothedLandmarks, now);
    }
    evaluateGestures(state.smoothedLandmarks, state.handPose, handSpan, now, isFreshDetection);
    updateFrame(now, dt);
    updateHoldMeter(now);
    updateLiveGuide();
  } else {
    hideCursor();
    clearHandSkeleton();
    setHoldMeter(0);
    clearFrame();
  }

  // Ring spin: swipes accumulate momentum; a downward swipe closes a photo.
  if (haveHand && isFreshDetection && detectDismissSwipe(now)) {
    state.currentVelocity = 0;
  }
  const swipeBurst = haveHand && isFreshDetection ? detectSwipe(now) : 0;
  if (swipeBurst !== 0) {
    // Add into current velocity so repeated swipes stack. Cap to prevent runaway.
    // Same direction → accelerate; opposite direction → decelerate/reverse.
    state.currentVelocity = clamp(
      state.currentVelocity + swipeBurst,
      -MAX_SPIN_DEG,
      MAX_SPIN_DEG
    );
  }

  // Wander's planet already turns on its own; hand mode only adds momentum.
  const inWander = wanderActive();
  const idleDeg = inWander ? 0 : IDLE_AUTO_SPIN_DEG;

  // Brake only applies while we actually see the hand — tracking drops should
  // not freeze the spin.
  // Closing a pinch on a photo holds the rings still so it doesn't slide away.
  if (haveHand && (state.palmBraking || isPinchApproaching(now))) {
    // Strong exponential decay toward 0 while palm-open held.
    state.currentVelocity *= Math.exp(-BRAKE_DECAY_RATE * dt);
    if (Math.abs(state.currentVelocity) < 1) state.currentVelocity = 0;
  } else if (haveHand && state.openedRing) {
    // Freeze the image the user has opened — bleed off spin quickly.
    state.currentVelocity *= Math.exp(-3.0 * dt);
  } else if (Math.abs(state.currentVelocity) > idleDeg * 1.2 + 1) {
    // Coasting above idle — gentle multiplicative friction (~45%/sec) keeps
    // momentum without decaying instantly. No pull toward idle here.
    state.currentVelocity *= Math.exp(-SPIN_FRICTION_RATE * dt);
  } else {
    // Near-idle — exponential approach to idle drift (plus keyboard nudge).
    const targetDeg = idleDeg + state.keyboardSpin;
    const k = 4.5; // rate constant: ~63% of the way there per 0.22s
    state.currentVelocity += (targetDeg - state.currentVelocity) * (1 - Math.exp(-k * dt));
  }

  const rings = window.ImmersiveOrbit.ringSpinDeg;
  Object.keys(rings).forEach((key) => {
    const rate = window.ImmersiveOrbit.ringSpinRates?.[key] ?? RING_MULT[key] ?? 1;
    rings[key] = wrap360(rings[key] + state.currentVelocity * dt * rate);
  });
  if (inWander && state.currentVelocity !== 0 && window.OrbitingExplore.spinBy) {
    window.OrbitingExplore.spinBy(state.currentVelocity * dt * WANDER_SPIN_MULT);
  }

  if (state.debug) {
    drawActiveRegionGuide();
    updateDebugOverlay(haveHand);
  }

  state.rafId = requestAnimationFrame(detectLoop);
}

function wrap360(d) {
  d = d % 360;
  if (d < 0) d += 360;
  return d;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ══════════════════════════════════════════════════════════════════
//  EXIT + CLEANUP
// ══════════════════════════════════════════════════════════════════

function exitImmersive(reason) {
  if (!state.active) return;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.active = false;
  state.currentVelocity = 0;
  state.keyboardSpin = 0;
  clearTracking();
  state.palmHistory = [];
  state.displayedHoldProgress = 0;
  state.aimRing = null;
  state.aimTs = 0;
  state.openedRing = null;
  state.palmBraking = false;
  state.lastSwipeDirection = 0;
  state.lastDismissTime = 0;

  // Reset gesture states completely on exit
  for (const key of Object.keys(gestureState)) {
    const st = gestureState[key];
    if (st.active && GESTURE_DEFS[key].continuous && GESTURE_DEFS[key].onRelease) {
      try { GESTURE_DEFS[key].onRelease(); } catch (e) {}
    }
    st.active = false;
    st.rearmed = true;
    st.aboveSinceTs = 0;
    st.belowSinceTs = 0;
  }

  closeLightboxIfOpen();
  clearFrame();
  resetZoom();
  hideOnboarding();
  hideCursor();
  clearHandSkeleton();

  stopStreamOnly();
  if ($debugPanel) $debugPanel.style.display = 'none';
  // The landmarker stays loaded so re-entry is instant.

  document.body.classList.remove('immersive-active');
  $hud.setAttribute('aria-hidden', 'true');

  if (window.gsap) {
    window.gsap.to('.saturn-container', { scale: 1, duration: 0.7, ease: 'power3.out' });
  }

  // Ease ring offsets back to zero
  const rings = window.ImmersiveOrbit.ringSpinDeg;
  const startOffsets = { ...rings };
  const t0 = performance.now();
  function settle(now) {
    if (state.active) return;
    const t = Math.min(1, (now - t0) / 1500);
    const e = 1 - Math.pow(1 - t, 3);
    Object.keys(startOffsets).forEach((key) => {
      if (Object.hasOwn(rings, key)) rings[key] = startOffsets[key] * (1 - e);
    });
    if (t < 1) requestAnimationFrame(settle);
  }
  requestAnimationFrame(settle);

  dispatch('orbit:exit', { reason: reason || 'unknown' });
}

function stopStreamOnly() {
  if (state.videoStream) {
    try { state.videoStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    state.videoStream = null;
  }
  try { $cam.srcObject = null; } catch (e) {}
  try { $hudVideo.srcObject = null; } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════
//  KEYBOARD + SCROLL
// ══════════════════════════════════════════════════════════════════

function onGlobalKeydown(e) {
  if (e.key === 'Escape') {
    if (e.defaultPrevented) return;   // Wander's viewer already closed on this press
    // Two-step Escape: close lightbox first (if open), then exit immersive
    if (state.active && state.openedRing) {
      closeLightboxIfOpen();
      e.preventDefault();
      return;
    }
    if (state.active) { exitImmersive('escape'); e.preventDefault(); return; }
    if ($modal.classList.contains('is-open') && !state.loading) {
      closeModal(); e.preventDefault(); return;
    }
  }
  if (state.active) {
    if (e.key === 'ArrowLeft')  { state.keyboardSpin = -KEYBOARD_SPIN_DEG; e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.keyboardSpin =  KEYBOARD_SPIN_DEG; e.preventDefault(); }
    if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setDebug(!state.debug);
      if (!state.debug) clearHandSkeleton();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      // Open the aimed photo, if any
      if (state.lastCursoredRing && openTarget(state.lastCursoredRing)) e.preventDefault();
    }
  }
}

function onGlobalKeyup(e) {
  if (!state.active) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') state.keyboardSpin = 0;
}

function onScroll() {
  if (!state.active || wanderActive()) return;
  const hero = document.getElementById('hero');
  if (!hero) return;
  const rect = hero.getBoundingClientRect();
  if (rect.bottom < window.innerHeight * 0.35) exitImmersive('scroll');
}

function dispatch(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
}

// ── Boot ────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
