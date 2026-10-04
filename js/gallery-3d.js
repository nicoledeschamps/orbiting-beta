/* ============================================ */
/* gallery-3d.js — Three.js Walkable Gallery   */
/* Hues of Saturn                              */
/* ============================================ */
import * as THREE from 'three';

// ── Constants ─────────────────────────────────
const HALL_WIDTH = 10;
const HALL_HEIGHT = 5;
const ART_SPACING = 6;       // distance between art positions along Z
const ART_START_Z = -8;      // first artwork Z offset
const WALL_COLOR = 0xe8dfcf; // warm cream
const FLOOR_COLOR = 0xc2b8a6; // darker warm stone
const CEILING_COLOR = 0xede5d8;
const FRAME_COLOR = 0x1a1a1a;
const FRAME_DEPTH = 0.12;
const FRAME_BORDER = 0.18;
const AVATAR_COLOR = 0x1a1714;

const WALK_SPEED = 6;
const WALK_FRICTION = 0.92;
const CAM_HEIGHT = 2.2;
const CAM_DISTANCE = 3.5;
const CAM_LERP = 0.08;

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

// ── State ─────────────────────────────────────
let renderer, scene, camera, clock;
// First-person — no avatar
var playerPos = new THREE.Vector3(0, 0, 0);
let artMeshes = [];
let spotLights = [];
let running = false;
let prepared = false;
let assetsReady = false;
let resizeObserver = null;
let galleryError = '';

let walkVelocity = 0;
let walkBob = 0;
let minZ, maxZ;
const keys = {};
let _maxPos = 0;
let _lastShadowZ = Infinity;

// ── Reusable objects (avoid per-frame allocation) ──
const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
const _lookTarget = new THREE.Vector3();

// ── DOM refs ──────────────────────────────────
let viewport, loadingEl, loadingTextEl, hudEl, positionEl, dpadEl;

function showLoading(message, isError) {
  if (!loadingEl) return;
  if (loadingTextEl && message) loadingTextEl.textContent = message;
  loadingEl.classList.remove('is-hidden');
  loadingEl.classList.toggle('is-error', !!isError);
}

function hideLoading() {
  if (!loadingEl) return;
  loadingEl.classList.remove('is-error');
  loadingEl.classList.add('is-hidden');
}

function setFailure(message) {
  galleryError = message || '3D gallery unavailable right now.';
  showLoading(galleryError, true);
  return false;
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (_) {
    return false;
  }
}

// ── Texture noise for walls ───────────────────
function createPlasterTexture(color, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w || 512;
  canvas.height = h || 512;
  const ctx = canvas.getContext('2d');
  // Base color
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Noise grain
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    d[i] += noise;
    d[i + 1] += noise;
    d[i + 2] += noise;
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Build Scene ───────────────────────────────
function buildRoom() {
  const hallLength = (_maxPos + 2) * ART_SPACING;
  minZ = ART_START_Z - hallLength + 2;
  maxZ = 2;

  // Floor — oversized so it fills the camera's full FOV
  var floorW = HALL_WIDTH * 4;
  var floorL = hallLength + 20;
  const floorTex = createPlasterTexture(FLOOR_COLOR, 256, 256);
  floorTex.repeat.set(floorW / 2, floorL / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorL),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, ART_START_Z - hallLength / 2 + 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling — oversized to match floor
  const ceilTex = createPlasterTexture(CEILING_COLOR, 256, 256);
  ceilTex.repeat.set(floorW / 2, floorL / 2);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorL),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, HALL_HEIGHT, ART_START_Z - hallLength / 2 + 2);
  scene.add(ceiling);

  // Left wall
  const wallTex = createPlasterTexture(WALL_COLOR, 512, 512);
  wallTex.repeat.set(hallLength / 4, 1);
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(hallLength, HALL_HEIGHT),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 })
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-HALL_WIDTH / 2, HALL_HEIGHT / 2, ART_START_Z - hallLength / 2 + 2);
  scene.add(leftWall);

  // Right wall
  const wallTexR = createPlasterTexture(WALL_COLOR, 512, 512);
  wallTexR.repeat.set(hallLength / 4, 1);
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(hallLength, HALL_HEIGHT),
    new THREE.MeshStandardMaterial({ map: wallTexR, roughness: 0.85 })
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(HALL_WIDTH / 2, HALL_HEIGHT / 2, ART_START_Z - hallLength / 2 + 2);
  scene.add(rightWall);

  // Back wall
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_WIDTH, HALL_HEIGHT),
    new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 })
  );
  backWall.position.set(0, HALL_HEIGHT / 2, ART_START_Z - hallLength + 2);
  scene.add(backWall);

  // Front wall (behind camera start)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_WIDTH, HALL_HEIGHT),
    new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 })
  );
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, HALL_HEIGHT / 2, 2);
  scene.add(frontWall);

  // ── Stanchion railings ──
  const railY = 1.0;
  const railX = HALL_WIDTH / 2 - 0.8;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.6 });

  for (let p = 0; p <= _maxPos; p++) {
    const pz = ART_START_Z - p * ART_SPACING;
    // Left post
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, railY, 8);
    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-railX, railY / 2, pz);
    scene.add(postL);
    // Right post
    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(railX, railY / 2, pz);
    scene.add(postR);
    // Cap
    const capGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const capL = new THREE.Mesh(capGeo, postMat);
    capL.position.set(-railX, railY, pz);
    scene.add(capL);
    const capR = new THREE.Mesh(capGeo, postMat);
    capR.position.set(railX, railY, pz);
    scene.add(capR);

    // Bar between posts
    if (p < _maxPos) {
      const barLen = ART_SPACING;
      const barGeo = new THREE.CylinderGeometry(0.02, 0.02, barLen, 6);
      barGeo.rotateX(Math.PI / 2);
      const barL = new THREE.Mesh(barGeo, postMat);
      barL.position.set(-railX, railY, pz - barLen / 2);
      scene.add(barL);
      const barR = new THREE.Mesh(barGeo, postMat);
      barR.position.set(railX, railY, pz - barLen / 2);
      scene.add(barR);
    }
  }

  // ── Ceiling beams ──
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.7 });
  for (let p = 0; p <= _maxPos; p++) {
    const bz = ART_START_Z - p * ART_SPACING;
    const beamGeo = new THREE.BoxGeometry(HALL_WIDTH, 0.15, 0.12);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, HALL_HEIGHT - 0.08, bz);
    scene.add(beam);
  }
}

function buildArtworks(manager) {
  const loader = new THREE.TextureLoader(manager);
  const maxArtH = 2.4;
  const maxArtW = 1.8;
  const artY = 2.6; // center height on wall

  GALLERY_ART.forEach(function(art, index) {
    const wallSign = art.wall === 'left' ? -1 : 1;
    const x = wallSign * (HALL_WIDTH / 2 - 0.02); // flush against wall
    const z = ART_START_Z - art.position * ART_SPACING;
    const rotY = art.wall === 'left' ? Math.PI / 2 : -Math.PI / 2;

    // Frame (slightly larger box behind artwork)
    const frameGeo = new THREE.BoxGeometry(
      maxArtW + FRAME_BORDER * 2,
      maxArtH + FRAME_BORDER * 2,
      FRAME_DEPTH
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: FRAME_COLOR, roughness: 0.4, metalness: 0.1
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(x, artY, z);
    frameMesh.rotation.y = rotY;
    frameMesh.castShadow = true;
    scene.add(frameMesh);

    // Artwork plane
    const artGeo = new THREE.PlaneGeometry(maxArtW, maxArtH);
    const artMat = new THREE.MeshStandardMaterial({
      color: 0x9a8f80, roughness: 0.6,
      side: THREE.FrontSide
    });
    const artMesh = new THREE.Mesh(artGeo, artMat);
    artMesh.position.set(x, artY, z);
    artMesh.rotation.y = rotY;
    // Push slightly in front of frame
    artMesh.translateZ(FRAME_DEPTH / 2 + 0.005);
    artMesh.userData.artIndex = index;
    artMesh.userData.title = art.title;
    scene.add(artMesh);
    artMeshes.push(artMesh);

    // Load texture
    loader.load(art.src, function(tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      // Resize for mobile
      if (isMobile && tex.image && tex.image.width > 1024) {
        tex.minFilter = THREE.LinearFilter;
      }
      artMat.color.setHex(0xffffff);
      artMat.map = tex;
      artMat.needsUpdate = true;
    }, undefined, function(err) {
      artMat.color.setHex(0x6f665c);
      artMat.needsUpdate = true;
      console.warn('Gallery: failed to load', art.src, err);
    });

    // Spotlight per artwork
    const spot = new THREE.SpotLight(0xfff5e0, 4, 8, Math.PI / 4, 0.4, 1.2);
    const spotX = x - wallSign * 1.5;
    spot.position.set(spotX, HALL_HEIGHT - 0.3, z);
    spot.target.position.set(x, artY, z);
    scene.add(spot);
    scene.add(spot.target);
    // Only nearest paintings get shadows (perf)
    spot.castShadow = false;
    spotLights.push({ light: spot, z: z });
  });
}

function buildLighting() {
  // Ambient fill — warm and generous
  scene.add(new THREE.AmbientLight(0xfff8f0, 0.7));
  // Hemisphere: sky warm white, ground warm
  const hemi = new THREE.HemisphereLight(0xfff5e0, 0xd4c8b0, 0.5);
  scene.add(hemi);
  // Overhead point lights along the hallway for even illumination
  for (let i = 0; i <= _maxPos; i += 2) {
    const pz = ART_START_Z - i * ART_SPACING;
    const overhead = new THREE.PointLight(0xfff5e0, 0.6, 15, 1.5);
    overhead.position.set(0, HALL_HEIGHT - 0.5, pz);
    scene.add(overhead);
  }
}

function buildAvatar() {
  // First-person mode — no visible avatar
  playerPos.set(0, 0, 0);
}

// ── Input ─────────────────────────────────────
function bindEvents() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  if (viewport) {
    viewport.addEventListener('click', onViewportClick);
    viewport.addEventListener('wheel', onWheel, { passive: false });
  }
  // D-pad — event delegation on parent
  if (dpadEl) {
    dpadEl.addEventListener('pointerdown', onDpadDown);
    dpadEl.addEventListener('pointerup', onDpadUp);
    dpadEl.addEventListener('pointercancel', onDpadUp);
    dpadEl.addEventListener('pointerleave', onDpadUp);
  }
}

function onDpadDown(e) {
  var btn = e.target.closest('.gallery-dpad-btn');
  if (!btn) return;
  e.preventDefault();
  keys[btn.dataset.dir] = true;
  btn.classList.add('active');
}

function onDpadUp(e) {
  var btn = e.target.closest('.gallery-dpad-btn');
  if (!btn) return;
  keys[btn.dataset.dir] = false;
  btn.classList.remove('active');
}

function unbindEvents() {
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  if (viewport) {
    viewport.removeEventListener('click', onViewportClick);
    viewport.removeEventListener('wheel', onWheel, { passive: false });
  }
  if (dpadEl) {
    dpadEl.removeEventListener('pointerdown', onDpadDown);
    dpadEl.removeEventListener('pointerup', onDpadUp);
    dpadEl.removeEventListener('pointercancel', onDpadUp);
    dpadEl.removeEventListener('pointerleave', onDpadUp);
  }
}

function onKeyDown(e) {
  if (!running) return;
  if (window.HOSArtViewer && window.HOSArtViewer.isOpen()) return;
  const k = e.key;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.up = true; e.preventDefault(); }
  if (k === 'ArrowDown' || k === 's' || k === 'S') { keys.down = true; e.preventDefault(); }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
  if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
  // Enter key opens nearest artwork
  if (k === 'Enter') { openNearestArtwork(); e.preventDefault(); }
}

function onKeyUp(e) {
  if (!running) return;
  // Always clear keys even when viewer is open — prevents stuck movement
  const k = e.key;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
  if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
}

function openNearestArtwork() {
  if (window.HOSArtViewer && window.HOSArtViewer.isOpen()) return;
  if (artMeshes.length === 0) return;
  var nearest = null;
  var nearestDist = Infinity;
  artMeshes.forEach(function(mesh) {
    var dist = Math.abs(mesh.position.z - playerPos.z);
    if (dist < nearestDist) { nearestDist = dist; nearest = mesh; }
  });
  if (nearest && nearestDist < ART_SPACING && window.HOSArtViewer) {
    window.HOSArtViewer.open(nearest.userData.artIndex);
  }
}

function onWheel(e) {
  if (!running) return;
  if (window.HOSArtViewer && window.HOSArtViewer.isOpen()) return;
  e.preventDefault();
  // Normalize deltaMode for Firefox (lines/pages vs pixels)
  var LINE_H = 40, PAGE_H = 800;
  var dy = e.deltaMode === 2 ? e.deltaY * PAGE_H
         : e.deltaMode === 1 ? e.deltaY * LINE_H
         : e.deltaY;
  walkVelocity += dy * 0.008;
}

function onViewportClick(e) {
  if (window.HOSArtViewer && window.HOSArtViewer.isOpen()) return;
  const rect = viewport.getBoundingClientRect();
  _mouse.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  _raycaster.setFromCamera(_mouse, camera);
  const hits = _raycaster.intersectObjects(artMeshes);
  if (hits.length > 0 && window.HOSArtViewer) {
    window.HOSArtViewer.open(hits[0].object.userData.artIndex);
  }
}

// ── Update Loop ───────────────────────────────
var lookYaw = 0; // horizontal look angle

function updateMovement(delta) {
  // Acceleration from input
  if (keys.up) walkVelocity -= WALK_SPEED * delta;
  if (keys.down) walkVelocity += WALK_SPEED * delta;

  // Clamp speed
  walkVelocity = Math.max(-12, Math.min(12, walkVelocity));

  // Apply friction
  const anyHeld = keys.up || keys.down;
  if (!anyHeld) walkVelocity *= WALK_FRICTION;
  if (Math.abs(walkVelocity) < 0.01) walkVelocity = 0;

  // Move player along Z
  playerPos.z += walkVelocity * delta;
  playerPos.z = Math.max(minZ, Math.min(maxZ, playerPos.z));

  // Walking bob (subtle head bob in first person)
  const isWalking = Math.abs(walkVelocity) > 0.1;
  if (isWalking) {
    walkBob += delta * 8;
  }

  // Left/right: subtle look rotation
  if (keys.left) lookYaw += 1.2 * delta;
  if (keys.right) lookYaw -= 1.2 * delta;
  // Clamp look angle to ~30 degrees each way
  lookYaw = Math.max(-0.5, Math.min(0.5, lookYaw));
  // Return to center when not looking
  if (!keys.left && !keys.right) {
    lookYaw *= 0.94;
  }
}

function updateCamera(delta) {
  // First-person: camera at eye height, looking forward along hallway
  const bobY = Math.abs(walkVelocity) > 0.1 ? Math.sin(walkBob) * 0.03 : 0;
  camera.position.set(playerPos.x, 1.7 + bobY, playerPos.z);

  // Look direction: forward into hallway with yaw offset, at art center height
  _lookTarget.set(
    Math.sin(lookYaw) * 10,
    2.4,
    playerPos.z - 10
  );
  camera.lookAt(_lookTarget);
}

function updateShadows() {
  // Only re-sort when player has moved significantly
  if (Math.abs(playerPos.z - _lastShadowZ) < 1) return;
  _lastShadowZ = playerPos.z;
  // Enable shadows only on nearest 2 spotlights for performance
  var sorted = spotLights.slice().sort(function(a, b) {
    return Math.abs(a.z - playerPos.z) - Math.abs(b.z - playerPos.z);
  });
  sorted.forEach(function(s, i) {
    s.light.castShadow = !isMobile && i < 2;
  });
}

function updateHud() {
  if (!positionEl) return;
  const progress = Math.abs(playerPos.z - maxZ) / Math.abs(minZ - maxZ);
  positionEl.style.setProperty('--walk-progress', (progress * 100) + '%');
  const nearest = Math.round(progress * _maxPos);
  const label = positionEl.querySelector('.gallery-position-label');
  if (label) label.firstChild.textContent = (nearest + 1) + ' / ';
  const total = positionEl.querySelector('.gallery-position-total');
  if (total) total.textContent = _maxPos + 1;
  if (progress > 0.01) positionEl.classList.add('visible');

  // Fade HUD after walking starts
  if (hudEl) {
    hudEl.classList.toggle('faded', progress > 0.05);
  }
}

function animate() {
  if (!running) return;
  const delta = Math.min(clock.getDelta(), 0.05); // cap delta for tab-away
  updateMovement(delta);
  updateCamera(delta);
  updateShadows();
  updateHud();
  renderer.render(scene, camera);
}

// ── Lifecycle API ─────────────────────────────
function prepare() {
  if (prepared) {
    if (assetsReady) hideLoading();
    else showLoading('loading gallery...', false);
    return true;
  }

  viewport = document.getElementById('galleryViewport');
  loadingEl = document.getElementById('galleryLoading');
  loadingTextEl = document.getElementById('galleryLoadingText');
  hudEl = document.getElementById('galleryControlsHud');
  positionEl = document.getElementById('galleryPosition');
  dpadEl = document.getElementById('galleryDpad');

  if (!viewport) return false;

  galleryError = '';
  assetsReady = false;
  showLoading('loading gallery...', false);

  if (!isWebGLAvailable()) {
    return setFailure('3D gallery unavailable on this device right now.');
  }

  // Renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (err) {
    console.warn('Gallery: renderer init failed', err);
    return setFailure('3D gallery unavailable right now.');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth || 800, viewport.clientHeight || 600);
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(WALL_COLOR);

  // Camera
  camera = new THREE.PerspectiveCamera(
    72,
    (viewport.clientWidth || 800) / (viewport.clientHeight || 600),
    0.1,
    100
  );
  camera.position.set(0, 1.7, 0);

  // Clock
  clock = new THREE.Clock(false);

  // Cache max position from gallery data
  _maxPos = Math.max(...GALLERY_ART.map(a => a.position));

  const loadingManager = new THREE.LoadingManager(function() {
    assetsReady = true;
    hideLoading();
  });

  // Build everything
  buildRoom();
  buildLighting();
  buildArtworks(loadingManager);
  buildAvatar();
  bindEvents();

  // Resize handling
  resizeObserver = new ResizeObserver(function() {
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  });
  resizeObserver.observe(viewport);

  prepared = true;
  return true;
}

function start() {
  if (!prepared && prepare() === false) return false;
  if (galleryError) return false;
  if (running) return;
  running = true;
  clock.start();
  renderer.setAnimationLoop(animate);
  return true;
}

function stop() {
  running = false;
  if (renderer) renderer.setAnimationLoop(null);
  if (clock) clock.stop();
  // Clear held keys
  Object.keys(keys).forEach(function(k) { keys[k] = false; });
  walkVelocity = 0;
}

function reset() {
  playerPos.set(0, 0, 0);
  lookYaw = 0;
  walkVelocity = 0;
  walkBob = 0;
}

function dispose() {
  stop();
  unbindEvents();
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  // Dispose all scene geometry, materials, and textures
  if (scene) {
    scene.traverse(function(obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function(m) {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }
  artMeshes = [];
  spotLights = [];
  if (renderer) {
    renderer.dispose();
    if (viewport && renderer.domElement.parentNode === viewport) {
      viewport.removeChild(renderer.domElement);
    }
  }
  prepared = false;
  assetsReady = false;
  galleryError = '';
}

// ── Expose global API for main.js ─────────────
window.gallery3D = {
  prepare,
  start,
  stop,
  reset,
  dispose,
  getStatusMessage: function() { return galleryError; }
};
