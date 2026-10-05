(() => {
  const needsPasswordSetup = ['invite', 'recovery'].includes(new URLSearchParams(window.location.hash.slice(1)).get('type'));
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (requestedView === 'signin' && !needsPasswordSetup) { window.location.replace('login.html'); return; }
  const sharedWander = requestedView === 'wander';
  const hasDemoFriend = sharedWander;
  const walkthroughMode = requestedView === 'walkthrough' || window.location.hash === '#walkthrough';
  const accountTestingMode = walkthroughMode;
  if (sharedWander) document.title = 'Wander · Orbiting';
  if (walkthroughMode) document.title = 'Walkthrough · Orbiting';
  const setup = document.getElementById('orbitSetup');
  const panels = [...document.querySelectorAll('[data-setup-panel]')];
  const stepButtons = [...document.querySelectorAll('[data-setup-step]')];
  const backButton = document.getElementById('setupBack');
  const nextButton = document.getElementById('setupNext');
  const skipButton = document.getElementById('setupSkip');
  const setupWordmark = document.getElementById('setupWordmark');
  const editorHotspots = document.getElementById('editorHotspots');
  const progressLabel = document.getElementById('setupProgressLabel');
  const accountUsername = document.getElementById('accountUsername');
  const accountEmail = document.getElementById('accountEmail');
  const accountPassword = document.getElementById('accountPassword');
  const accountStatus = document.getElementById('accountStatus');
  const accountDemoNotice = document.getElementById('accountDemoNotice');
  const accountUsernameField = document.getElementById('accountUsernameField');
  const accountModeButtons = [...document.querySelectorAll('[data-account-mode]')];
  const birthPrivacyNote = document.getElementById('birthPrivacyNote');
  let accountMode = 'signup';
  let accountConnected = false;
  let signedInUser = null;
  let pendingVerificationEmail = '';
  const verificationReminder = document.getElementById('verificationReminder');
  const verificationStatus = document.getElementById('verificationStatus');
  const previewState = document.getElementById('previewState');
  const previewNote = document.getElementById('setupPreviewNote');
  const setupPlanet = document.getElementById('setupPlanet');
  const setupPreviewRings = document.getElementById('setupPreviewRings');
  const setupPortrait = document.getElementById('setupPortraitPreview');
  const finalPortrait = document.querySelector('.saturn-body img');
  const portraitInput = document.getElementById('setupPortraitInput');
  const albumInput = document.getElementById('setupAlbumInput');
  const folderInput = document.getElementById('setupFolderInput');
  const photosSourceButton = document.getElementById('photosSourceButton');
  const photoSharing = document.getElementById('photoSharing');
  const photoSelectionStatus = document.getElementById('photoSelectionStatus');
  const clearPhotos = document.getElementById('clearPhotos');
  const portraitStatus = document.getElementById('portraitStatus');
  const portraitRefine = document.getElementById('portraitRefine');
  const portraitRemoveBackground = document.getElementById('portraitRemoveBackground');
  const portraitSize = document.getElementById('portraitSize');
  const portraitX = document.getElementById('portraitX');
  const portraitY = document.getElementById('portraitY');
  function updatePortraitPosition() {
    document.getElementById('portraitSizeValue').textContent = `${portraitSize.value}%`;
    [setupPortrait, finalPortrait].forEach((image) => {
      image.style.scale = String(Number(portraitSize.value) / 100);
      image.style.translate = `${portraitX.value}% ${portraitY.value}%`;
    });
  }
  function resetPortraitPosition() {
    portraitSize.value = '100'; portraitX.value = '0'; portraitY.value = '0';
    updatePortraitPosition();
  }
  [portraitSize, portraitX, portraitY].forEach((control) => control.addEventListener('input', updatePortraitPosition));
  document.getElementById('portraitPositionReset').addEventListener('click', resetPortraitPosition);
  const portraitEdge = document.getElementById('portraitEdge');
  const portraitEdgeValue = document.getElementById('portraitEdgeValue');
  const portraitOriginal = document.getElementById('portraitOriginal');
  const portraitLasso = document.getElementById('portraitLasso');
  const portraitLassoCanvas = document.getElementById('portraitLassoCanvas');
  const portraitLassoApply = document.getElementById('portraitLassoApply');
  const portraitLassoReset = document.getElementById('portraitLassoReset');
  let portraitJob = 0;
  let portraitRenderVersion = 0;
  let originalPortraitUrl = null;
  let cutoutPortraitUrl = null;
  let portraitCutout = null;
  let portraitLassoPoints = null;
  let portraitLassoMagic = false;
  const portraitMagicLasso = document.getElementById('portraitMagicLasso');
  let lassoDraft = [];
  let lassoDrawing = false;
  let lassoImage = null;
  let edgeTimer;
  const skyTitleFirst = document.getElementById('skyTitleFirst');
  const skyTitleSecond = document.getElementById('skyTitleSecond');
  const skyTitleSecondColor = document.getElementById('skyTitleSecondColor');
  const skyBio = document.getElementById('skyBio');
  const heroBio = document.getElementById('heroBio');
  const skyTitleSecondColorValue = document.getElementById('skyTitleSecondColorValue');
  const setupSkyTitle = document.getElementById('setupSkyTitle');
  const heroTitleFirst = document.getElementById('heroTitleFirst');
  const heroTitleSecond = document.getElementById('heroTitleSecond');
  const constellation = document.getElementById('setupConstellation');
  const constellationPicker = document.getElementById('constellationPicker');
  const featuredPlacements = document.getElementById('featuredPlacements');
  const otherPlacementGroups = document.getElementById('otherPlacementGroups');
  const featuredPlacementCount = document.getElementById('featuredPlacementCount');
  const otherPlacementCount = document.getElementById('otherPlacementCount');
  const skyCalculationNote = document.getElementById('skyCalculationNote');
  const hiddenStarEnabled = document.getElementById('hiddenStarEnabled');
  const lightUpSpace = document.getElementById('lightUpSpace');
  const shareSkyWithFriends = document.getElementById('shareSkyWithFriends');
  const combineSkyWithFriends = document.getElementById('combineSkyWithFriends');
  const friendSkyPicker = document.getElementById('friendSkyPicker');
  const friendSkyChoices = document.getElementById('friendSkyChoices');
  const friendSkyStatus = document.getElementById('friendSkyStatus');
  const hiddenStarPlacement = document.getElementById('hiddenStarPlacement');
  const hiddenStarSelectionStatus = document.getElementById('hiddenStarSelectionStatus');
  const hiddenStarChoices = document.getElementById('hiddenStarChoices');
  const hiddenMessageList = document.getElementById('hiddenMessageList');
  const addHiddenMessage = document.getElementById('addHiddenMessage');
  const setupHiddenThought = document.getElementById('setupHiddenThought');
  const finalHiddenThoughts = document.getElementById('orbitingHiddenThoughts');
  const sourceAuthStatus = document.getElementById('sourceAuthStatus');
  const sourceSharing = document.getElementById('sourceSharing');
  const sourceButtons = [...document.querySelectorAll('.source-option[data-source]')];
  const ringBuilder = document.getElementById('ringBuilder');
  const ringBuilderEmpty = document.getElementById('ringBuilderEmpty');
  const ringValidation = document.getElementById('ringValidation');
  const addRing = document.getElementById('addRing');
  const wanderSpeed = document.getElementById('wanderSpeed');
  const wanderSize = document.getElementById('wanderSize');
  const wanderSizeValue = document.getElementById('wanderSizeValue');
  const wanderSpeedValue = document.getElementById('wanderSpeedValue');
  const orbitKeyChart = document.getElementById('orbitKeyChart');
  const orbitKeyTrigger = document.getElementById('orbitKeyTrigger');
  const defaultOrbitChart = orbitKeyChart.innerHTML;
  const finalBirthSky = document.getElementById('orbitingBirthSky');
  const finalSharedSky = document.getElementById('orbitingSharedSky');
  const birthInputs = ['birthDate', 'birthTime', 'birthPlace'].map((id) => document.getElementById(id));
  const selectedSources = new Set();
  let activeSource = null;
  const sourceUnits = { arena: 'channels', cosmos: 'collections', pinterest: 'boards', spotify: 'playlists', instagram: 'posts' };
  // Setup shows "what's in my orbit" one move at a time: pick a platform, point us to it, choose, arrange.
  const sourcePanel = document.querySelector('[data-setup-panel="1"]');
  let sourceStageAdvance = false;
  function setSourceStage(stage) {
    sourcePanel.dataset.sourceStage = stage;
    if (stage !== 'link') sourceStageAdvance = false;
    if (!settingsMode) document.getElementById('sourceAccordion').open = true;
    sourcePanel.querySelectorAll('.source-stages [data-source-stage-go]').forEach((button) => {
      if (button.dataset.sourceStageGo === stage) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }
  const sourcePreviewTimers = new Map();
  const sourceChoices = {
    cosmos: { name: 'Cosmos', kind: 'public profile or collection', example: 'https://www.cosmos.so/yourname', prefix: 'https://www.cosmos.so/', url: '', approved: false, items: [], options: [], selectedUrls: [], nextPage: null },
    arena: { name: 'Are.na', kind: 'public profile or channel', example: 'https://www.are.na/yourname', prefix: 'https://www.are.na/', url: '', approved: false, items: [], options: [], selectedUrls: [], nextPage: null },
    pinterest: { name: 'Pinterest', kind: 'public profile or board', example: 'https://www.pinterest.com/yourname/', prefix: 'https://www.pinterest.com/', url: '', approved: false, items: [], options: [], selectedUrls: [], nextPage: null },
    spotify: { name: 'Spotify', kind: 'public profile or playlist', example: 'https://open.spotify.com/user/yourname', prefix: 'https://open.spotify.com/user/', url: '', approved: false, items: [], options: [], selectedUrls: [], nextPage: null },
    instagram: { name: 'Instagram', kind: 'public profile, post or Reel', example: 'https://www.instagram.com/p/.../', prefix: 'https://www.instagram.com/', url: '', approved: false, items: [], options: [], selectedUrls: [], nextPage: null }
  };
  let localPhotoUrls = [];
  let localPhotoFiles = [];
  let savedMedia = { portrait: null, uploads: [] };
  const savedImageRefs = new Map();
  let savedPortraitSrc = '';
  const portraitAssets = ['assets/saturn-face.png', 'assets/saturn-face-transparent.webp', 'assets/portraits/zachbell14.jpg'];
  let mediaRestoreFailed = false;

  async function saveCurrentOrbit() {
    if (mediaRestoreFailed) throw new Error('Your saved images could not be loaded. Reload and try again before saving changes.');
    const active = await window.OrbitingAccount.getSession();
    if (!signedInUser || active?.user?.id !== signedInUser.id) throw new Error('The signed-in account changed. Reload before saving.');
    let portrait = savedPortraitSrc === setupPortrait.src ? savedMedia.portrait : null;
    if (!portrait && setupPortrait.style.opacity !== '0') {
      const url = setupPortrait.src;
      if (url.startsWith('blob:')) {
        const response = await fetch(url);
        portrait = await window.OrbitingAccount.saveImage(await response.blob(), 'portrait', 'Your portrait', signedInUser.id);
      } else {
        const asset = portraitAssets.find(path => new URL(url).pathname === new URL(path, document.baseURI).pathname);
        if (asset) portrait = { asset };
      }
    }
    const uploads = [];
    for (let i = 0; i < localPhotoUrls.length; i++) {
      let ref = savedImageRefs.get(localPhotoUrls[i]);
      if (!ref) {
        accountStatus.textContent = `Saving image ${i + 1} of ${localPhotoUrls.length}…`;
        ref = await window.OrbitingAccount.saveImage(localPhotoFiles[i], 'uploads', localPhotoFiles[i].name, signedInUser.id);
        savedImageRefs.set(localPhotoUrls[i], ref);
      }
      uploads.push(ref);
    }
    savedMedia = { portrait, uploads };
    savedPortraitSrc = setupPortrait.src;
    return window.OrbitingAccount.saveOrbit(collectOrbitData(), signedInUser.id);
  }

  async function restoreOrbitMedia(media) {
    mediaRestoreFailed = true;
    const manifest = media || { portrait: null, uploads: [] };
    if (!Array.isArray(manifest.uploads) || manifest.uploads.length > 200) throw new Error('Your saved media list could not be read.');
    // Finish downloads before replacing the current draft, so a failed request cannot erase it.
    const restored = [];
    for (const ref of manifest.uploads) {
      restored.push(await window.OrbitingAccount.loadImage(ref));
      window.dispatchEvent(new CustomEvent('orbiting:media-progress', { detail: { done: restored.length, total: manifest.uploads.length } }));
    }
    const portrait = manifest.portrait?.path ? await window.OrbitingAccount.loadImage(manifest.portrait) : null;
    localPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    savedImageRefs.clear();
    localPhotoFiles = restored.map(item => new File([item.blob], item.ref.name, { type: item.blob.type }));
    localPhotoUrls = restored.map(item => {
      const url = URL.createObjectURL(item.blob);
      savedImageRefs.set(url, item.ref);
      return url;
    });
    if (originalPortraitUrl) URL.revokeObjectURL(originalPortraitUrl);
    if (cutoutPortraitUrl) URL.revokeObjectURL(cutoutPortraitUrl);
    originalPortraitUrl = null;
    cutoutPortraitUrl = null;
    portraitCutout = null;
    portraitRefine.hidden = true;
    if (portrait) {
      originalPortraitUrl = URL.createObjectURL(portrait.blob);
      showPortrait(originalPortraitUrl);
      portraitStatus.textContent = 'Your saved portrait is ready.';
    } else if (portraitAssets.includes(manifest.portrait?.asset)) showPortrait(manifest.portrait.asset);
    else {
      setupPortrait.style.opacity = '0';
      finalPortrait.style.opacity = '0';
      portraitStatus.textContent = 'Add a portrait to your orbit.';
    }
    savedMedia = manifest;
    savedPortraitSrc = setupPortrait.src;
    mediaRestoreFailed = false;
    clearPhotos.hidden = !localPhotoUrls.length;
    photoSelectionStatus.textContent = localPhotoUrls.length ? `${localPhotoUrls.length} saved images restored.` : 'No images selected yet.';
  }
  let nextRingId = 1;
  let legacyOverflowRings = [];
  const excludedRingSources = new Set();
  const localPhotoItems = () => localPhotoUrls.map((src, index) => ({ src, alt: localPhotoFiles[index]?.name || `Selected photo ${index + 1}`, source: 'photos' }));
  const approvedSourceItems = () => [...selectedSources].filter(sourceIsApproved).flatMap((source) => sourceChoices[source].items).concat(localPhotoItems());
  const ringSourceList = (row) => (row.dataset.ringSources || row.dataset.ringSource || '').split(',').filter((source) => source === 'photos' || sourceChoices[source]);
  const itemsForRingSource = (source) => source === 'photos' ? localPhotoItems() : sourceChoices[source]?.items || [];
  const itemsForRingSources = (sources) => {
    const groups = sources.map(itemsForRingSource);
    const items = [];
    const maxLength = Math.max(0, ...groups.map((group) => group.length));
    for (let index = 0; index < maxLength; index++) {
      groups.forEach((group) => { if (group[index]) items.push(group[index]); });
    }
    return items;
  };
  const ringGroups = () => [...ringBuilder.querySelectorAll('.ring-row')].map((row) => ({
    source: row.dataset.orbitRing,
    items: itemsForRingSources(ringSourceList(row))
  }));
  let previewRingTweens = [];
  let currentStep = 0;
  let settingsMode = false;
  let selectedSetupRing = null;
  let setupCloseTimer;
  const demoOrbitKey = 'orbiting-local-demo-orbit-v1';
  const pendingOrbitKey = 'orbiting-pending-signup-orbit-v1';
  const hiddenMessages = [{ text: '', starIndex: null }];
  let activeHiddenMessage = 0;
  const zodiac = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
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
  const placementNames = ['Sun', 'Moon', 'Rising', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node', 'Chiron', 'Lilith', 'Midheaven', 'Descendant', 'IC', 'Part of Fortune', 'Vertex'];
  const skyPositions = [
    [25, 80, 21], [86, 66, -1], [48, 23, -4], [59, 80, -4], [43, 87, 15],
    [27, 30, 22], [14, 39, 9], [87, 48, 18], [38, 16, -7], [86, 15, 10],
    [65, 28, -20], [66, 10, -9], [24, 64, 4], [16, 24, -4], [35, 74, 14],
    [83, 84, 19], [84, 32, 4], [16, 11, 15], [74, 72, -15], [12, 62, -15]
  ];
  const hiddenStarPositions = ['Sun', 'Moon', 'Rising', 'Mercury', 'Venus', 'Mars'].map((name, index) => ({
    name, left: skyPositions[index][0], top: skyPositions[index][1]
  }));
  document.getElementById('signThemesList').innerHTML = zodiac.map((sign) =>
    `<div><dt>${sign}</dt><dd>${zodiacThemes[sign]}</dd></div>`).join('');
  let chartPlacements = [];
  let friendSkyIds = new Set();
  let friendSkies = new Map();
  let friendSkyLoadSequence = 0;
  let friendSkiesLoaded = false;
  let swissEphPromise;
  let calculationSequence = 0;
  let calculationTimer;
  const locationCache = new Map();

  const stepPreview = [
    ['portrait ready', 'Your portrait becomes the center of the planet.'],
    ['empty orbit', 'Connect sources, then choose how they fill your rings.'],
    ['constellation forming', 'The sky becomes more specific with each detail you know.'],
    ['ready to explore', 'Preview your sky in the cosmos. Your choices stay in this browser.']
  ];
  const editorTitles = ['Portrait & title', 'Connections & rings', 'Stars & hidden messages'];
  const editorIntros = [
    'Change your portrait or the words in your sky. Photos are cut out on your device.',
    'Choose what to share, then arrange or combine your sources into rings.',
    'Adjust your birth sky and decide which stars hold something more.'
  ];

  function updateSourcePreview() {
    syncRingRows();
    const groups = ringGroups();
    const imageCount = groups.reduce((total, group) => total + group.items.length, 0);
    setupPlanet.classList.toggle('has-sources', imageCount > 0);
    const awaitingChoice = [...selectedSources].some((source) => sourceChoices[source].options.length && !sourceChoices[source].selectedUrls.length);
    const loadingSelection = [...selectedSources].some((source) => sourceIsApproved(source) && sourceChoices[source].previewLoading);
    const visiblePerRing = window.matchMedia('(max-width: 599px)').matches ? 12 : 28;
    const hasWaitingImages = groups.some(({ items }) => items.length > visiblePerRing);
    const ringPreviewNote = hasWaitingImages
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? `Up to ${visiblePerRing} images appear at once per ring. The remaining images are loaded but stay out of view while reduced motion is on.`
        : `Up to ${visiblePerRing} images appear at once per ring. The others rotate in; the finished orbit uses the same set.`
      : 'The setup preview and finished orbit use the same loaded images.';
    previewState.textContent = settingsMode ? 'your live orbit' : imageCount ? `${imageCount} image${imageCount === 1 ? '' : 's'} in preview` : loadingSelection ? 'loading selected images' : 'empty orbit';
    previewNote.textContent = settingsMode ? 'Select the planet, rings, or stars to edit. Your approved public links live in the editor.'
      : imageCount ? ringPreviewNote
      : loadingSelection ? 'Loading the images you selected to share.'
      : awaitingChoice ? 'Choose public posts or collections to fill a ring.'
      : 'Choose what to share or add photos to see your rings.';
    renderSetupRings();
  }

  function sourceIsApproved(source) {
    const choice = sourceChoices[source];
    return selectedSources.has(source) && choice.approved && Boolean(choice.url)
      && (sourceIsProfile(source, choice.url) ? choice.selectedUrls.length > 0 : choice.baseShared === true);
  }

  function sourceIsProfile(source, url) {
    if (!url) return false;
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return source === 'spotify' ? parts[0] === 'user' : parts.length === 1;
  }

  function validateSourceUrl(source, raw) {
    const url = new URL(String(raw).trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    const hosts = { cosmos: 'cosmos.so', arena: 'are.na', pinterest: 'pinterest.com', spotify: 'open.spotify.com', instagram: 'instagram.com' };
    if (url.protocol !== 'https:' || url.username || url.password || url.port || host !== hosts[source]) throw new Error(`Use a public ${sourceChoices[source].name} link.`);
    if (source === 'arena' && (parts.length < 1 || parts.length > 2 || !parts.every(part => /^[a-z0-9_-]+$/.test(part)))) throw new Error('Use a public Are.na profile or channel link.');
    if (source === 'cosmos' && (parts.length < 1 || parts.length > 2 || !parts.every(part => /^[a-z0-9-]+$/i.test(part)))) throw new Error('Use a public Cosmos profile or collection link.');
    if (source === 'pinterest' && (parts.length < 1 || parts.length > 2 || !parts.every(part => /^[a-z0-9_-]+$/i.test(part)))) throw new Error('Use a public Pinterest profile or board link.');
    if (source === 'spotify' && (parts.length !== 2 || (parts[0] === 'playlist' ? !/^[a-z0-9]+$/i.test(parts[1]) : parts[0] !== 'user' || !/^[a-z0-9._-]+$/i.test(parts[1])))) throw new Error('Use a public Spotify profile or playlist link.');
    if (source === 'instagram' && !(
      parts.length === 1 && /^[a-z0-9._]{1,30}$/i.test(parts[0]) && !['p', 'reel'].includes(parts[0]) ||
      parts.length === 2 && ['p', 'reel'].includes(parts[0]) && /^[a-z0-9_-]+$/i.test(parts[1])
    )) throw new Error('Use a public Instagram profile, post, or Reel link.');
    url.hash = '';
    url.search = '';
    return url.href;
  }

  function sourceInputUrl(source, raw) {
    const value = String(raw).trim();
    if (sourceChoices[source].prefix && /^@?[a-z0-9._-]+$/i.test(value)) {
      return validateSourceUrl(source, `${sourceChoices[source].prefix}${value.replace(/^@/, '')}`);
    }
    return validateSourceUrl(source, value);
  }

  function sourceInputValue(source, url) {
    return url && sourceIsProfile(source, url)
      ? new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''
      : url;
  }

  function syncSourceButtons() {
    sourceButtons.forEach((button) => {
      const source = button.dataset.source;
      const selected = selectedSources.has(source);
      const count = sourceChoices[source].selectedUrls.length;
      button.setAttribute('aria-expanded', String(source === activeSource));
      button.dataset.hasSource = String(sourceIsApproved(source));
      button.querySelector('em').textContent = count ? `${count} shared` : selected && sourceChoices[source].approved
        ? sourceChoices[source].baseShared ? 'shared' : 'preview'
        : source === activeSource ? 'editing' : 'choose';
    });
    photosSourceButton.setAttribute('aria-expanded', String(activeSource === 'photos'));
    document.getElementById('albumLabel').textContent = localPhotoUrls.length ? `${localPhotoUrls.length} added` : activeSource === 'photos' ? 'editing' : 'choose';
    photosSourceButton.dataset.hasSource = String(Boolean(localPhotoUrls.length));
  }

  document.getElementById('refreshSources').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = document.getElementById('refreshSourcesStatus');
    if (![...selectedSources].some((source) => sourceChoices[source].approved && sourceChoices[source].url)) {
      status.textContent = 'Connect a source first.';
      return;
    }
    button.disabled = true;
    button.textContent = '↻ Refreshing…';
    status.textContent = 'Checking your selected source links for images…';
    try {
      await refreshPublicSources(null, false);
      status.textContent = `${approvedSourceItems().length} images available. Check each source for any loading issues. Public pages may not expose every image.`;
    } finally {
      button.disabled = false;
      button.textContent = '↻ Refresh sources';
    }
  });

  async function refreshPublicSources(onlySource = null, rediscover = true) {
    if (!window.OrbitingAccount?.previewPublicSource) {
      [...selectedSources].filter((source) => !onlySource || source === onlySource).forEach((source) => { sourceChoices[source].previewLoading = false; });
      updateSourcePreview();
      return;
    }
    let hasCurrentResult = false;
    await Promise.all([...selectedSources].filter((source) => (!onlySource || source === onlySource) && sourceChoices[source].approved && sourceChoices[source].url).map(async (source) => {
      const choice = sourceChoices[source];
      const url = choice.url;
      const selectedUrls = [...choice.selectedUrls];
      try {
        const batches = [];
        for (let index = 0; index < selectedUrls.length; index += 5) batches.push(selectedUrls.slice(index, index + 5));
        if (!batches.length) batches.push([]);
        const results = [];
        for (let index = 0; index < batches.length; index += 3) {
          const group = await Promise.allSettled(batches.slice(index, index + 3).map((batch, offset) =>
            window.OrbitingAccount.previewPublicSource(source, url, batch, {
              discover: rediscover && index + offset === 0,
              includeBase: index + offset === 0 && (!selectedUrls.length || !sourceIsProfile(source, url))
            })));
          results.push(...group);
        }
        if (choice.url !== url || choice.selectedUrls.join('\n') !== selectedUrls.join('\n')) return;
        hasCurrentResult = true;
        choice.previewLoading = false;
        const first = results[0]?.status === 'fulfilled' ? results[0].value : null;
        if (rediscover && first) {
          choice.options = Array.isArray(first.options) ? first.options.filter((option) => typeof option.name === 'string' && typeof option.url === 'string') : [];
          choice.nextPage = Number.isInteger(first.nextPage) ? first.nextPage : null;
          if (source === 'instagram' && sourceIsProfile(source, url)) {
            choice.pickerOpen = choice.options.length > 0;
            choice.extraOpen = false;
          }
        }
        if (source !== 'instagram' && sourceIsProfile(source, url)) choice.selectedUrls.forEach((selectedUrl) => {
          if (!choice.options.some((option) => option.url === selectedUrl)) {
            const slug = new URL(selectedUrl).pathname.split('/').filter(Boolean).at(-1) || 'Selected item';
            choice.options.push({ name: slug.replace(/[-_]+/g, ' '), url: selectedUrl });
          }
        });
        const seen = new Set();
        choice.items = results.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value.items) ? result.value.items : [])
          .filter((item) => {
            if (typeof item.src !== 'string' || !(item.src.startsWith('https://') || /^data:image\/(?:jpeg|png|webp);base64,/.test(item.src)) || seen.has(item.src)) return false;
            seen.add(item.src);
            return true;
          });
        const failed = results.filter((result) => result.status === 'rejected').length;
        if (source === activeSource) sourceAuthStatus.textContent = source === 'instagram' && sourceIsProfile(source, url) && !choice.selectedUrls.length
          ? choice.options.length ? `${choice.options.length} recent public posts found. Choose which ones enter your orbit.`
            : 'Instagram could not list public posts here. Private posts cannot be imported; you can add your own copies through My Photos.'
          : choice.options.length && !choice.selectedUrls.length
          ? `${choice.name}: ${choice.options.length} public choice${choice.options.length === 1 ? '' : 's'} found. Select what enters your orbit.`
          : choice.items.length
            ? `${choice.name}: ${choice.items.length} public image${choice.items.length === 1 ? '' : 's'} found.${sourceIsApproved(source) ? ' They are now in your ring preview.' : ' Choose what to share to see the ring.'}${failed ? ` ${failed} link group${failed === 1 ? '' : 's'} could not be read.` : ''}`
            : `No signal yet. There are no public ${sourceUnits[source] || 'images'} here.`;
      } catch (error) {
        if (choice.url !== url) return;
        hasCurrentResult = true;
        choice.previewLoading = false;
        choice.items = [];
        choice.options = [];
        if (source === activeSource) sourceAuthStatus.textContent = source === 'instagram'
          ? 'Instagram public posts could not be read right now. Private posts cannot be imported; add your own copies through My Photos.'
          : `Couldn’t reach that link. Try a full link, like ${choice.example}.`;
      }
    }));
    if (!hasCurrentResult) return;
    const focusedSource = document.activeElement?.dataset?.sourceUrl;
    const caret = focusedSource ? document.activeElement.selectionStart : null;
    renderSourceSharing();
    if (focusedSource && focusedSource === activeSource) {
      const input = sourceSharing.querySelector(`[data-source-url="${focusedSource}"]`);
      input?.focus();
      if (input && Number.isInteger(caret)) input.setSelectionRange(caret, caret);
    }
    syncSourceButtons();
    updateSourcePreview();
    if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
    document.body.classList.toggle('orbit-empty', !approvedSourceItems().length);
  }

  function renderSourceSharing() {
    const advanceToChoose = sourceStageAdvance && !settingsMode && activeSource && activeSource !== 'photos' && sourceChoices[activeSource]?.options.length > 0;
    if (advanceToChoose) { sourceStageAdvance = false; sourceChoices[activeSource].pickerOpen = true; setSourceStage('choose'); }
    sourceSharing.replaceChildren();
    photoSharing.hidden = activeSource !== 'photos';
    if (!activeSource || !selectedSources.has(activeSource)) return;
    [activeSource].forEach((source) => {
      const choice = sourceChoices[source];
      const card = document.createElement('section');
      card.className = 'source-sharing-card';
      card.dataset.sharingSource = source;
      const header = document.createElement('div');
      header.className = 'source-sharing-header';
      const heading = document.createElement('h2');
      heading.textContent = `Point us to your ${choice.name}.`;
      const removeSource = document.createElement('button');
      removeSource.type = 'button';
      removeSource.className = 'source-list-action';
      removeSource.dataset.removeSource = source;
      removeSource.textContent = `Remove ${choice.name}`;
      header.append(heading, removeSource);
      card.append(header);
      const label = document.createElement('label');
      label.className = 'source-link-label';
      label.textContent = source === 'spotify' ? 'Profile ID or public link' : source === 'instagram' ? 'Public Instagram username' : 'Username or public link';
      const entry = document.createElement('span');
      entry.className = 'source-link-entry';
      if (choice.prefix) {
        const prefix = document.createElement('span');
        prefix.className = 'source-link-prefix';
        prefix.textContent = choice.prefix;
        prefix.hidden = Boolean(choice.url && !sourceIsProfile(source, choice.url));
        entry.append(prefix);
      }
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.sourceUrl = source;
      input.placeholder = choice.prefix ? 'yourname' : choice.example;
      input.value = sourceInputValue(source, choice.url);
      input.autocomplete = 'off';
      entry.append(input);
      label.append(entry);
      card.append(label);
      const hint = document.createElement('p');
      hint.className = 'source-input-hint';
      hint.textContent = source === 'instagram'
        ? 'Enter a public username. No Instagram sign-in is needed. Choose the posts you want to show after they load.'
        : 'Enter just your public profile name, or paste a full collection, board, channel, or playlist link.';
      card.append(hint);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'source-link-approve';
      button.dataset.approveSource = source;
      button.textContent = source === 'instagram' ? choice.approved ? 'Check for recent public posts again' : 'Find my public posts' : choice.approved ? 'Scan again' : 'Scan for signals';
      card.append(button);
      if (choice.approved && choice.url && !sourceIsProfile(source, choice.url)) {
        const share = document.createElement('button');
        share.type = 'button';
        share.className = 'source-link-approve';
        share.dataset.shareBaseSource = source;
        share.setAttribute('aria-pressed', String(Boolean(choice.baseShared)));
        share.textContent = choice.baseShared ? 'Remove this link from my orbit' : 'Share this link in my orbit';
        card.append(share);
      }
      if (choice.options.length) {
        const prompt = document.createElement('p');
        prompt.className = 'source-container-heading';
        prompt.textContent = source === 'instagram'
          ? `${choice.options.length} recent public posts found · ${choice.selectedUrls.length} selected`
          : `${choice.options.length} ${sourceUnits[source] || 'choices'} picked up. Which ones fall into your orbit? · ${choice.selectedUrls.length} in orbit`;
        card.append(prompt);
        const actions = document.createElement('div');
        actions.className = 'source-choice-actions';
        const selectAll = document.createElement('button');
        selectAll.type = 'button';
        selectAll.className = 'source-list-action';
        selectAll.dataset.selectAllSource = source;
        selectAll.textContent = choice.nextPage ? 'Select every public channel' : source === 'instagram' ? 'Select all posts shown' : 'Select all public choices shown';
        actions.append(selectAll);
        const toggleChoices = document.createElement('button');
        toggleChoices.type = 'button';
        toggleChoices.className = 'source-list-action';
        toggleChoices.dataset.toggleSourceOptions = source;
        toggleChoices.setAttribute('aria-expanded', String(Boolean(choice.pickerOpen)));
        toggleChoices.textContent = source === 'instagram' ? choice.pickerOpen ? 'Hide public posts' : 'Choose public posts' : choice.pickerOpen ? 'Hide individual choices' : 'Choose individually';
        actions.append(toggleChoices);
        card.append(actions);
        const list = document.createElement('div');
        list.className = 'source-container-list';
        list.hidden = !choice.pickerOpen;
        choice.options.forEach((item) => {
          const label = document.createElement('label');
          label.className = 'source-container-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.sourceChoice = source;
          checkbox.value = item.url;
          checkbox.checked = choice.selectedUrls.includes(item.url);
          if (source === 'instagram' && item.previewSrc) {
            const preview = document.createElement('img');
            preview.className = 'source-container-thumb';
            preview.src = item.previewSrc;
            preview.alt = '';
            preview.loading = 'lazy';
            preview.referrerPolicy = 'no-referrer';
            label.append(preview);
          }
          const title = document.createElement('span');
          title.textContent = item.name;
          label.append(checkbox, title);
          list.append(label);
        });
        card.append(list);
      }
      if (choice.nextPage) {
        const loadMore = document.createElement('button');
        loadMore.type = 'button';
        loadMore.className = 'source-list-action';
        loadMore.dataset.loadMoreSource = source;
        loadMore.textContent = 'Load more public channels';
        card.append(loadMore);
      }
      if (choice.approved) {
        const extraPanel = document.createElement('div');
        extraPanel.className = 'source-extra-panel';
        const toggleExtra = document.createElement('button');
        toggleExtra.type = 'button';
        toggleExtra.className = 'source-list-action';
        toggleExtra.dataset.toggleExtraSource = source;
        toggleExtra.setAttribute('aria-expanded', String(Boolean(choice.extraOpen)));
        toggleExtra.textContent = source === 'instagram'
          ? choice.extraOpen ? 'Hide post links' : 'Add posts from a saved Collection or older posts'
          : choice.extraOpen ? 'Hide specific link' : 'Add a specific public link';
        card.append(toggleExtra);
        extraPanel.hidden = !choice.extraOpen;
        const more = document.createElement('label');
        more.className = 'source-link-label source-link-extra';
        more.textContent = source === 'instagram' ? 'Public Instagram post or Reel links, one per line' : `Add a public ${choice.name} item link${sourceIsProfile(source, choice.url) ? ' that is not listed' : ''}`;
        const extraInput = document.createElement(source === 'instagram' ? 'textarea' : 'input');
        if (source === 'instagram') extraInput.rows = 4;
        else extraInput.type = 'url';
        extraInput.dataset.extraSourceUrl = source;
        extraInput.placeholder = source === 'instagram' ? 'https://www.instagram.com/p/.../\nhttps://www.instagram.com/reel/.../' : choice.example;
        more.append(extraInput);
        extraPanel.append(more);
        if (source === 'instagram') {
          const collectionNote = document.createElement('p');
          collectionNote.className = 'source-input-hint';
          collectionNote.textContent = 'Saved Collections are visible only to you or invited collaborators. Copy the links for the public posts you want from one; only those posts enter Orbiting.';
          extraPanel.append(collectionNote);
        }
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'source-link-approve source-link-approve--secondary';
        addButton.dataset.addExtraSource = source;
        addButton.textContent = source === 'instagram' ? 'Add these public posts' : 'Add this item';
        extraPanel.append(addButton);
        choice.selectedUrls.forEach((url, index) => {
          if (sourceIsProfile(source, choice.url) && choice.options.some((option) => option.url === url)) return;
          const row = document.createElement('div');
          row.className = 'source-added-link';
          const span = document.createElement('span');
          span.textContent = new URL(url).pathname.split('/').filter(Boolean).at(-1) || url;
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.dataset.removeExtraSource = source;
          remove.dataset.extraIndex = String(index);
          remove.textContent = 'remove';
          row.append(span, remove);
          extraPanel.append(row);
        });
        card.append(extraPanel);
      }
      const note = document.createElement('p');
      note.className = 'source-sharing-note';
      note.textContent = source === 'instagram' && choice.approved && sourceIsProfile(source, choice.url) && !choice.selectedUrls.length
        ? choice.options.length ? 'Select the public posts you want. Older posts can be added by link. Nothing enters your orbit until you select it.'
          : 'Instagram did not provide a public post list. Private posts cannot be imported. You can add your own copies through My Photos instead.'
        : choice.options.length
        ? `${choice.selectedUrls.length} public choices selected; ${choice.options.length} shown. ${sourceIsApproved(source) ? `${choice.items.length} images in the live preview.` : 'Select what to share to see a photo ring.'} Ring visibility is separate.`
        : choice.approved
          ? sourceIsApproved(source) ? `${choice.items.length} public images from your shared links in the live preview. Ring visibility is separate.` : `${choice.items.length} public images found. Choose what to share to see a photo ring.`
          : source === 'instagram'
            ? 'Enter a public username to choose posts. Private posts cannot be imported; add your own copies through My Photos.'
            : 'Paste a public profile or item link. This does not sign into the source account or access private content.';
      card.append(note);
      if (source === 'instagram') {
        const usePhotos = document.createElement('button');
        usePhotos.type = 'button';
        usePhotos.className = 'source-list-action';
        usePhotos.dataset.switchToPhotos = '';
        usePhotos.textContent = 'Add my own photos instead';
        card.append(usePhotos);
      }
      sourceSharing.append(card);
    });
  }

  function renderSetupRings() {
    previewRingTweens.forEach((tween) => tween.kill());
    previewRingTweens = [];
    clearSetupRingSelection();
    setupPreviewRings.replaceChildren();
    const groups = ringGroups();
    if (!groups.length) return;
    const width = setupPlanet.getBoundingClientRect().width || 400;
    if (!window.HuesOrbit?.buildRing) return;
    const slots = window.HuesOrbit.filledRingSlots(groups.map((group) => group.items));
    groups.forEach((group, index) => {
      const images = group.items;
      const slot = slots[index];
      if (!slot) return;
      const radius = width * window.HuesOrbit.ringRadiusRatio(slot.index, slot.count);
      const ringClass = ['ring-art', 'ring-arena', 'ring-cosmos'][index % 3];
      const back = document.createElement('div');
      const front = document.createElement('div');
      back.className = `saturn-ring-back ${ringClass}`;
      front.className = `saturn-ring-front ${ringClass}`;
      back.dataset.orbitRingIndex = front.dataset.orbitRingIndex = String(index);
      setupPreviewRings.append(back, front);
      const visibleImages = window.HuesOrbit.personalRingVisibleImages(images, slot.index);
      const tween = window.HuesOrbit.buildRing(visibleImages, back, front, radius, [38, 52], [55 + slot.index * 20, 75 + slot.index * 20], images, { previewOnly: true, sizeScale: visibleImages.length > 18 ? 0.42 : 0.52, startAngle: slot.index * 120 % 360 });
      if (tween) previewRingTweens.push(tween);
    });
  }

  window.addEventListener('hues-orbit:data-ready', renderSetupRings);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(renderSetupRings).observe(setupPlanet);

  function constellationShape(name) {
    const seed = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return Array.from({ length: 5 }, (_, index) => ({
      x: 9 + ((seed * (index + 3) + index * 21) % 83),
      y: 11 + ((seed * (index + 5) + index * 17) % 64)
    }));
  }

  const placementGroups = [
    { title: 'personal placements', names: ['Sun', 'Moon', 'Rising', 'Mercury', 'Venus', 'Mars'] },
    { title: 'social + outer planets', names: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] },
    { title: 'angles + houses', names: ['Midheaven', 'Descendant', 'IC', 'Part of Fortune', 'Vertex'] },
    { title: 'nodes + calculated points', names: ['North Node', 'South Node', 'Chiron', 'Lilith'] }
  ];

  function placementMeta(placement) {
    if (!placement.available) return placement.requirement;
    return `${placementMeanings[placement.name]}${placement.house ? ` · house ${placement.house}` : ''}`;
  }

  function escapeMarkup(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function updateHiddenStarSelection() {
    hiddenStarChoices.hidden = !hiddenStarEnabled.checked || currentStep !== 2;
    hiddenStarPlacement.hidden = !hiddenStarEnabled.checked;
    hiddenMessageList.hidden = !hiddenStarEnabled.checked;
    addHiddenMessage.hidden = !hiddenStarEnabled.checked || hiddenMessages.length >= hiddenStarPositions.length;
    const assigned = hiddenMessages.filter((message) => message.starIndex !== null).length;
    hiddenStarSelectionStatus.textContent = `${assigned} of ${hiddenMessages.length} messages placed · editing message ${activeHiddenMessage + 1}`;
    hiddenStarChoices.querySelectorAll('[data-hidden-star-position]').forEach((button) => {
      const index = Number(button.dataset.hiddenStarPosition);
      const selected = index === hiddenMessages[activeHiddenMessage].starIndex;
      const assignedTo = hiddenMessages.findIndex((message) => message.starIndex === index);
      button.setAttribute('aria-pressed', String(assignedTo !== -1));
      button.setAttribute('aria-label', `${hiddenStarPositions[index].name} placement${assignedTo !== -1 ? `, message ${assignedTo + 1}` : ', empty'}`);
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-assigned', assignedTo !== -1);
    });
  }

  function renderHiddenMessages() {
    hiddenMessageList.innerHTML = hiddenMessages.map((message, index) => `
      <div class="hidden-message-card${index === activeHiddenMessage ? ' is-active' : ''}" data-hidden-message="${index}">
        <div class="hidden-message-card__top">
          <button class="hidden-message-card__select" type="button" data-edit-message="${index}" aria-pressed="${index === activeHiddenMessage}">Message ${index + 1}</button>
          ${hiddenMessages.length > 1 ? `<button class="hidden-message-card__remove" type="button" data-remove-message="${index}" aria-label="Remove message ${index + 1}">remove</button>` : ''}
        </div>
        <label>What should someone discover?<textarea data-message-text="${index}" rows="2" maxlength="180" placeholder="A line, memory, or thought…">${escapeMarkup(message.text)}</textarea></label>
        <small>${message.starIndex === null ? 'No placement chosen yet' : `In the ${hiddenStarPositions[message.starIndex].name} placement`}</small>
      </div>`).join('');
    updateHiddenStarSelection();
  }

  function updateSkyTitle() {
    const first = skyTitleFirst.value.trim() || 'Orbit';
    const second = skyTitleSecond.value.trim() || (skyTitleFirst.value.trim() ? '' : 'ing');
    const secondColor = skyTitleSecondColor.value;
    setupSkyTitle.children[0].textContent = first;
    setupSkyTitle.children[1].textContent = second;
    setupSkyTitle.children[1].style.color = secondColor;
    heroTitleFirst.textContent = first;
    heroTitleSecond.textContent = second;
    heroTitleSecond.style.color = secondColor;
    heroTitleSecond.hidden = !second;
    skyTitleSecondColorValue.value = secondColor.toUpperCase();
    const bio = skyBio.value.trim().slice(0, 80);
    setupSkyTitle.children[2].textContent = bio;
    heroBio.textContent = bio;
    heroBio.hidden = !bio;
  }

  const ringSources = { arena: 'Are.na', cosmos: 'Cosmos', pinterest: 'Pinterest', spotify: 'Spotify', instagram: 'Instagram', photos: 'my photos' };
  const availableRingSources = () => [
    ...[...selectedSources].filter((source) => sourceIsApproved(source) && sourceChoices[source].items.length > 0).map((source) => ({ value: source, label: ringSources[source] })),
    ...(localPhotoUrls.length ? [{ value: 'photos', label: ringSources.photos }] : [])
  ];

  function syncRingRows() {
    const sources = availableRingSources();
    [...ringBuilder.querySelectorAll('.ring-row[data-auto-created="true"]')].forEach((row) => {
      if (ringSourceList(row).some((source) => source === 'photos' ? localPhotoUrls.length > 0 : sourceIsApproved(source))) return;
      row.remove();
    });
    const rows = [...ringBuilder.querySelectorAll('.ring-row')];
    const assigned = new Set(rows.flatMap(ringSourceList));
    sources.forEach(({ value }) => {
      if (assigned.has(value) || excludedRingSources.has(value)) return;
      rows.push(createRingRow({ sources: [value], autoCreated: true }));
      assigned.add(value);
    });
    rows.forEach((row, index) => {
      row.dataset.ringColor = ['oxblood', 'silver', 'ink'][index % 3];
      const choices = row.querySelector('[data-ring-source-choices]');
      const selected = ringSourceList(row).filter((source) => source === 'photos' ? localPhotoUrls.length > 0 : sourceIsApproved(source));
      row.dataset.ringSources = selected.join(',');
      row.querySelector('.ring-words-field').hidden = false;
      row.querySelector('.ring-row-title').textContent = ringLabel(row);
      ['up', 'down'].forEach((direction) => {
        const control = row.querySelector(`[data-move-ring="${direction}"]`);
        control.disabled = direction === 'up' ? index === 0 : index === rows.length - 1;
        control.setAttribute('aria-label', `Move ${ringLabel(row)} ${direction}`);
      });
      const visibleSources = [...sources, ...selected.filter((source) => !sources.some(({ value }) => value === source)).map((source) => ({ value: source, label: ringSources[source] }))];
      choices.innerHTML = visibleSources.map(({ value, label }) => `<button type="button" data-ring-source-choice="${value}" aria-pressed="${selected.includes(value)}">${label}</button>`).join('');
      const items = itemsForRingSources(selected);
      row.querySelector('.ring-image-count').textContent = selected.length
        ? `${items.length} image${items.length === 1 ? '' : 's'} loaded`
        : 'Choose what fills this ring';
      row.querySelector('.ring-source-choices')?.setAttribute('aria-label', `Ring ${index + 1} sources`);
      row.querySelector('.ring-visibility')?.setAttribute('aria-label', `Ring ${index + 1} visibility`);
      row.querySelector('.ring-words-field input')?.setAttribute('aria-label', `Ring ${index + 1} name`);
    });
    ringBuilder.dataset.empty = String(rows.length === 0);
    ringBuilderEmpty.hidden = rows.length > 0;
    const canSeparate = rows.some((row) => ringSourceList(row).length > 1);
    addRing.disabled = !sources.some(({ value }) => !assigned.has(value)) && !canSeparate;
    addRing.textContent = canSeparate ? '+ separate a source into its own ring' : '+ add a ring';
    addRing.hidden = addRing.disabled;
    document.getElementById('sourceSummary').textContent = sources.length ? sources.map(({ label }) => label).join(' · ') : 'Choose what to share';
    if (ringGroups().some((ring) => ring.items.length)) ringValidation.hidden = true;
    syncRingLabels();
  }

  function ringRowMarkup(row, index, label = '') {
    return `<span class="ring-swatch" aria-hidden="true"></span>
      <div class="ring-meaning"><strong class="ring-row-title"></strong>
        <label class="ring-words-field"><span>Name this ring</span><input aria-label="Ring ${index + 1} name" maxlength="32" value="${escapeMarkup(label)}" placeholder="inspiration, inner world, daily life…"></label>
        <div class="ring-source-field"><span>What fills it? Choose one or more.</span><div class="ring-source-choices" data-ring-source-choices role="group" aria-label="Ring ${index + 1} sources"></div></div>
        <span class="ring-image-count"></span>
      </div>
      <div class="ring-controls"><div class="ring-order-controls" role="group" aria-label="Ring order"><button type="button" data-move-ring="up">↑ move up</button><button type="button" data-move-ring="down">↓ move down</button></div><div class="ring-visibility" role="radiogroup" aria-label="Ring ${index + 1} visibility">${['only me', 'close orbit', 'everyone'].map((visibility) => `<button type="button" role="radio" aria-checked="${visibility === 'everyone'}">${visibility}</button>`).join('')}</div><button class="remove-ring" type="button" data-remove-ring>remove</button></div>`;
  }

  function createRingRow({ id = `ring-${Date.now().toString(36)}-${nextRingId++}`, sources = [], label = '', autoCreated = false } = {}) {
    const row = document.createElement('div');
    row.className = 'ring-row';
    row.dataset.orbitRing = id;
    row.dataset.ringSources = sources.join(',');
    if (autoCreated) row.dataset.autoCreated = 'true';
    row.innerHTML = ringRowMarkup(row, ringBuilder.children.length, label);
    ringBuilder.append(row);
    return row;
  }

  function ringLabel(row) {
    const sources = ringSourceList(row);
    const displayOrder = ['cosmos', 'arena', 'pinterest', 'spotify', 'instagram', 'photos'];
    const customLabel = row.querySelector('.ring-words-field input')?.value.trim();
    if (customLabel) return customLabel;
    if (sources.length === 1 && sources[0] === 'photos') return row.querySelector('.ring-words-field input')?.value.trim() || 'my photos';
    return sources.length
      ? sources.slice().sort((a, b) => displayOrder.indexOf(a) - displayOrder.indexOf(b)).map((source) => ringSources[source]).join(' ')
      : row.querySelector('.ring-words-field input')?.value.trim() || 'unnamed ring';
  }

  function syncRingLabels(showHuesDemo = false) {
    window.HuesOrbit?.clearRingIsolation?.();
    const rows = [...ringBuilder.querySelectorAll('.ring-row')];
    const filledRows = rows.filter((row) => itemsForRingSources(ringSourceList(row)).length > 0);
    const canChooseRings = showHuesDemo || filledRows.length > 0;
    orbitKeyTrigger.disabled = !canChooseRings;
    orbitKeyTrigger.setAttribute('aria-label', canChooseRings ? "What's in my orbit" : 'Share images to explore your rings');
    document.getElementById('orbitKey').classList.toggle('open', canChooseRings && document.getElementById('orbitKey').classList.contains('open'));
    if (showHuesDemo) {
      orbitKeyChart.classList.remove('orbit-key-chart--personal');
      orbitKeyChart.innerHTML = defaultOrbitChart;
    } else {
      orbitKeyChart.classList.add('orbit-key-chart--personal');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'orbit-chart-svg');
      svg.setAttribute('preserveAspectRatio', 'none');
      const chartHeight = Math.max(110, filledRows.length * 28 + 36);
      const chartWidth = chartHeight * 2;
      svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`);
      orbitKeyChart.style.height = `${chartHeight}px`;
      orbitKeyChart.style.width = `${Math.min(360, chartWidth)}px`;
      orbitKeyChart.replaceChildren(svg);
      const colors = { photos: '#e8c589', arena: '#a5b4dc', cosmos: '#a082c8', pinterest: '#c88c9d', spotify: '#9cc8c0', instagram: '#c6b69e' };
      let visibleIndex = 0;
      (canChooseRings ? rows : []).forEach((row, index) => {
        if (!itemsForRingSources(ringSourceList(row)).length) return;
        const radius = 36 + visibleIndex++ * 28;
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arc.setAttribute('class', 'orbit-arc');
        arc.setAttribute('d', `M ${chartHeight - radius},${chartHeight - 8} A ${radius},${radius} 0 0,1 ${chartHeight + radius},${chartHeight - 8}`);
        arc.dataset.ring = String(index);
        arc.style.stroke = colors[ringSourceList(row)[0]] || '#e8c589';
        svg.append(arc);
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'orbit-chart-label';
        label.dataset.ring = String(index);
        label.setAttribute('aria-label', `Show ${ringLabel(row)} ring`);
        label.textContent = ringLabel(row);
        label.style.left = '2%';
        label.style.bottom = `${(radius + 3) / chartHeight * 100}%`;
        label.setAttribute('aria-pressed', 'false');
        orbitKeyChart.append(label);
      });
    }
    const setupChart = document.getElementById('setupOrbitChart');
    setupChart.innerHTML = orbitKeyChart.innerHTML;
    setupChart.style.height = orbitKeyChart.style.height;
    setupChart.style.width = orbitKeyChart.style.width;
    document.getElementById('setupOrbitKey').hidden = !filledRows.length;
    clearSetupRingSelection();
    if (currentStep === 1) {
      if (!settingsMode) previewState.textContent = filledRows.length ? `${filledRows.length} ring${filledRows.length === 1 ? '' : 's'} ready` : rows.length ? 'ring needs images' : 'no rings yet';
      previewNote.textContent = filledRows.length ? `${filledRows.map(ringLabel).join(' · ')} · These names appear in your orbit.` : rows.length ? 'Choose a source with images for your ring before continuing.' : 'No rings yet. Add one with images before continuing.';
    }
  }


  function clearSetupRingSelection() {
    selectedSetupRing = null;
    ringBuilder.querySelectorAll('.ring-row').forEach((row) => row.classList.remove('is-highlighted'));
    setupPreviewRings.querySelectorAll('[data-orbit-ring-index]').forEach((ring) => ring.classList.remove('ring-dimmed', 'ring-highlighted'));
    document.querySelectorAll('#setupOrbitChart .orbit-chart-label').forEach((label) => {
      label.setAttribute('aria-pressed', 'false');
      label.classList.remove('dimmed');
    });
    document.querySelectorAll('#setupOrbitChart .orbit-arc').forEach((arc) => arc.classList.remove('arc-active', 'arc-dimmed'));
  }
  document.getElementById('setupOrbitChart').addEventListener('click', (event) => {
    const label = event.target.closest('.orbit-chart-label');
    if (!label) return;
    const index = label.dataset.ring;
    const restore = selectedSetupRing === index;
    clearSetupRingSelection();
    if (restore) return;
    selectedSetupRing = index;
    ringBuilder.children[Number(index)]?.classList.add('is-highlighted');
    setupPreviewRings.querySelectorAll('[data-orbit-ring-index]').forEach((ring) => {
      ring.classList.toggle('ring-highlighted', ring.dataset.orbitRingIndex === index);
      ring.classList.toggle('ring-dimmed', ring.dataset.orbitRingIndex !== index);
    });
    document.querySelectorAll('#setupOrbitChart .orbit-chart-label').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.ring === index));
      button.classList.toggle('dimmed', button.dataset.ring !== index);
    });
    document.querySelectorAll('#setupOrbitChart .orbit-arc').forEach((arc) => {
      arc.classList.toggle('arc-active', arc.dataset.ring === index);
      arc.classList.toggle('arc-dimmed', arc.dataset.ring !== index);
    });
  });

  function ownSkySigns() {
    return [...new Set(chartPlacements.filter((placement) => placement.available)
      .map((placement) => zodiac.find((sign) => placement.sign.endsWith(sign)))
      .filter(Boolean))];
  }

  function renderFriendSkyChoices() {
    friendSkyChoices.replaceChildren();
    friendSkies.forEach(({ name, constellations }, id) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = friendSkyIds.has(id);
      const copy = document.createElement('span');
      copy.textContent = `${name} · ${constellations.length} constellation${constellations.length === 1 ? '' : 's'}`;
      label.append(checkbox, copy);
      friendSkyChoices.append(label);
    });
  }

  async function loadFriendSkies(force = false) {
    if (!combineSkyWithFriends.checked) return;
    if (!signedInUser) {
      friendSkyStatus.textContent = accountTestingMode
        ? 'Sign in with an account to use shared skies.'
        : 'Sign in to combine with friends in your cosmos.';
      return;
    }
    if (friendSkiesLoaded && !force) return;
    const sequence = ++friendSkyLoadSequence;
    friendSkyStatus.textContent = 'Looking for friends who share their skies…';
    try {
      const following = await window.OrbitingAccount.listFollowing();
      if (sequence !== friendSkyLoadSequence) return;
      const results = await Promise.allSettled(following.map(async (person) => ({
        id: person.followed_user_id,
        sky: await window.OrbitingAccount.loadVisibleFollowedSky(person.followed_user_id)
      })));
      if (sequence !== friendSkyLoadSequence) return;
      const next = new Map();
      results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        const { id, sky } = result.value;
        if (!sky || !Array.isArray(sky.constellations) || !sky.constellations.length) return;
        const username = String(sky.username || following.find((person) => person.followed_user_id === id)?.username || 'friend').slice(0, 20);
        next.set(id, { name: `@${username}`, constellations: sky.constellations.filter((sign) => zodiac.includes(sign)) });
      });
      friendSkies = next;
      const failed = results.some((result) => result.status === 'rejected');
      friendSkiesLoaded = !failed;
      renderFriendSkyChoices();
      renderSharedSky();
      friendSkyStatus.textContent = next.size
        ? `${next.size} shared ${next.size === 1 ? 'sky' : 'skies'} available.${failed ? ' Some could not load.' : ''} Choose whose constellations join yours.`
        : failed ? 'Friends’ skies could not load yet. Try refresh.'
          : following.length ? 'No friends in your cosmos have shared a sky yet.'
            : 'Follow someone in your cosmos who shares their sky.';
    } catch (error) {
      if (sequence !== friendSkyLoadSequence) return;
      friendSkyStatus.textContent = 'Friends’ skies could not load yet. Try refresh.';
    }
  }

  function renderSharedSky() {
    const selected = [...friendSkyIds].map((id) => friendSkies.get(id)).filter(Boolean);
    const active = combineSkyWithFriends.checked && selected.length > 0 && Boolean(window.OrbitingSharedSky);
    if (active) {
      window.OrbitingSharedSky.render(finalSharedSky, [
        { name: accountUsername.value.trim() ? `@${accountUsername.value.trim()}` : 'you', constellations: ownSkySigns() },
        ...selected
      ]);
    } else finalSharedSky.replaceChildren();
    finalSharedSky.hidden = !active;
    finalSharedSky.setAttribute('aria-hidden', String(!active));
    document.body.classList.toggle('orbit-shared-sky', active);
  }

  function renderFinalBirthSky() {
    const available = chartPlacements.filter((placement) => placement.available);
    window.ORBITING_STAR_CONTENT = Object.fromEntries(available.map((placement) => [placement.name, {
      text: placement.reveal.trim() || `${placement.name} in ${placement.sign} · ${placementMeanings[placement.name]}`
    }]));
    finalBirthSky.innerHTML = available.map((placement) => {
      const [left, top, rotation] = skyPositions[placementNames.indexOf(placement.name)];
      const width = placement.featured ? 10 : 8;
      const points = constellationShape(`${placement.name}-${placement.sign}`);
      const lines = points.slice(0, -1).map((point, pointIndex) => `<line x1="${point.x}" y1="${point.y}" x2="${points[pointIndex + 1].x}" y2="${points[pointIndex + 1].y}"/>`).join('');
      const stars = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${placement.featured ? 1.8 : 1.2}"/>`).join('');
      return `<button class="orbiting-sky-star${placement.interactive ? ' is-interactive' : ''}${placement.featured ? ' is-featured' : ''}" type="button" data-star-action="orbitingStar" data-star-placement="${placement.name}" aria-label="${placement.interactive ? `Reveal ${placement.name} in ${placement.sign}` : `${placement.name} in ${placement.sign}`}" ${placement.interactive ? '' : 'disabled'} style="left:${left}%;top:${top}%;width:${width}%;opacity:${(placement.featured ? placement.opacity : 24) / 100};--star-glow:${placement.strength / 18}px;transform:translate(-50%,-50%) rotate(${rotation}deg)"><svg viewBox="0 0 110 80" aria-hidden="true"><g>${lines}</g><g>${stars}</g></svg></button>`;
    }).join('');
    document.body.classList.add('orbit-personalized');
    renderSharedSky();
  }

  function renderFeaturedPlacement(placement, index) {
    return `
      <details class="featured-placement-card" data-placement-name="${placement.name}" ${index === 0 ? 'open' : ''}>
        <summary>
          <span class="featured-star-mark" aria-hidden="true"></span>
          <span><strong>${placement.name} <em>${placement.sign}</em></strong><small>${placementMeta(placement)}</small></span>
          <span class="featured-state">${placement.interactive ? 'opens' : 'ambient'}</span>
        </summary>
        <div class="featured-placement-settings">
          <label class="interactive-star-toggle"><input type="checkbox" data-setting="interactive" ${placement.interactive ? 'checked' : ''}> <span><strong>Interactive star</strong><small>Hover shimmers. Select to reveal what you place inside.</small></span></label>
          <label class="placement-reveal-copy"><span>What does this star reveal?</span><textarea rows="2" maxlength="180" data-setting="reveal" placeholder="A thought, link, detail, or invitation…" ${placement.interactive ? '' : 'disabled'}>${escapeMarkup(placement.reveal)}</textarea></label>
          <div class="featured-visual-controls">
            <label class="constellation-control"><span>glow</span><output>${placement.strength}%</output><input type="range" min="10" max="100" value="${placement.strength}" data-setting="strength"></label>
            <label class="constellation-control"><span>opacity</span><output>${placement.opacity}%</output><input type="range" min="5" max="100" value="${placement.opacity}" data-setting="opacity"></label>
          </div>
          <button class="placement-return" type="button" data-action="unfeature" data-placement="${placement.name}">return to all placements</button>
        </div>
      </details>`;
  }

  function renderOtherPlacement(placement) {
    return `
      <div class="other-placement-row${placement.available ? '' : ' is-unavailable'}" data-placement-name="${placement.name}">
        <span><strong>${placement.name} <em>${placement.available ? placement.sign : 'locked'}</em></strong><small>${placementMeta(placement)}</small></span>
        <button type="button" data-action="feature" data-placement="${placement.name}" ${placement.available ? '' : 'disabled'}>${placement.available ? 'feature' : 'locked'}</button>
      </div>`;
  }

  function renderBirthSky() {
    const featured = chartPlacements.filter((placement) => placement.available && placement.featured);
    const remaining = chartPlacements.filter((placement) => !placement.featured);
    featuredPlacements.innerHTML = featured.length
      ? featured.map(renderFeaturedPlacement).join('')
      : '<p class="featured-placement-empty">Choose a placement below to make it brighter or interactive.</p>';
    featuredPlacementCount.textContent = `${featured.length} featured`;
    otherPlacementCount.textContent = `${remaining.length} placement${remaining.length === 1 ? '' : 's'}`;
    otherPlacementGroups.innerHTML = placementGroups.map((group) => {
      const placements = group.names.map((name) => remaining.find((placement) => placement.name === name)).filter(Boolean);
      if (!placements.length) return '';
      return `<section class="placement-group"><h3>${group.title}</h3>${placements.map(renderOtherPlacement).join('')}</section>`;
    }).join('');
    updateConstellationPreview();
  }

  function updateConstellationPreview() {
    const available = chartPlacements.filter((placement) => placement.available);
    const featured = available.filter((placement) => placement.featured);
    constellation.innerHTML = available.map((placement) => {
      const strength = placement.featured ? placement.strength : 24;
      const opacity = (placement.featured ? placement.opacity : 20) / 100;
      const points = constellationShape(`${placement.name}-${placement.sign}`);
      const [left, top, rotation] = skyPositions[placementNames.indexOf(placement.name)];
      const width = placement.featured ? 18 : 14;
      const lines = points.slice(0, -1).map((point, pointIndex) => `<line x1="${point.x}" y1="${point.y}" x2="${points[pointIndex + 1].x}" y2="${points[pointIndex + 1].y}"/>`).join('');
      const stars = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${1.1 + strength / 75}"/>`).join('');
      return `<button class="placement-sky-star${placement.featured ? ' is-featured' : ''}${placement.interactive ? ' is-interactive' : ''}" type="button" data-sky-placement="${placement.name}" aria-label="${placement.interactive ? `Open ${placement.name} in ${placement.sign}` : `${placement.name} in ${placement.sign}`}" ${placement.interactive ? '' : 'disabled'} style="left:${left}%;top:${top}%;width:${width}%;opacity:${opacity};transform:translate(-50%,-50%) rotate(${rotation}deg);filter:drop-shadow(0 0 ${strength / 18}px rgba(237,241,244,.5))"><svg viewBox="0 0 110 80" aria-hidden="true"><g style="stroke-width:${.35 + strength / 85}">${lines}</g><g>${stars}</g></svg></button>`;
    }).join('');
    previewState.textContent = available.length ? `${featured.length} featured · ${available.length} in your sky` : 'chart waiting';
    previewNote.textContent = available.length ? 'All placements stay in the sky. Featured stars glow brighter; interactive stars shimmer and open.' : 'Add a birth date to begin forming your sky.';
  }

  function normalizeDegree(value) {
    return ((value % 360) + 360) % 360;
  }

  function formatPlacement(longitude) {
    const normalized = normalizeDegree(longitude);
    const sign = zodiac[Math.floor(normalized / 30)];
    const withinSign = normalized % 30;
    let degrees = Math.floor(withinSign);
    let minutes = Math.round((withinSign - degrees) * 60);
    if (minutes === 60) {
      degrees += 1;
      minutes = 0;
    }
    return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${sign}`;
  }

  function houseForLongitude(longitude, cusps) {
    const point = normalizeDegree(longitude);
    for (let house = 1; house <= 12; house += 1) {
      const start = normalizeDegree(cusps[house]);
      let end = normalizeDegree(cusps[house === 12 ? 1 : house + 1]);
      let adjusted = point;
      if (end <= start) end += 360;
      if (adjusted < start) adjusted += 360;
      if (adjusted >= start && adjusted < end) return house;
    }
    return null;
  }

  function timeZoneOffsetAt(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return representedAsUtc - date.getTime();
  }

  function localBirthTimeToUtc(date, time, timeZone) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const localWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
    let utcTime = localWallTime;
    for (let pass = 0; pass < 3; pass += 1) {
      utcTime = localWallTime - timeZoneOffsetAt(new Date(utcTime), timeZone);
    }
    return new Date(utcTime);
  }

  async function loadSwissEph() {
    if (!swissEphPromise) {
      swissEphPromise = import('https://cdn.jsdelivr.net/gh/prolaxu/swisseph-wasm@v0.1.0/src/swisseph.js').then(async ({ default: SwissEph }) => {
        const swe = new SwissEph();
        await swe.initSwissEph();
        return swe;
      });
    }
    return swissEphPromise;
  }

  async function resolveBirthPlace(place) {
    const cacheKey = place.toLowerCase().trim();
    if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);
    const searchPlace = async (query) => {
      const endpoint = new URL('https://geocoding-api.open-meteo.com/v1/search');
      endpoint.search = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Birthplace lookup is unavailable.');
      const data = await response.json();
      return data.results || [];
    };
    let results = await searchPlace(place);
    if (!results.length && place.includes(',')) results = await searchPlace(place.split(',')[0].trim());
    const qualifiers = place.toLowerCase().split(',').slice(1).map((part) => part.trim()).filter(Boolean);
    const result = results.find((candidate) => qualifiers.every((qualifier) =>
      [candidate.admin1, candidate.admin2, candidate.country, candidate.country_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(qualifier) || qualifier.includes(String(value).toLowerCase()))
    )) || results[0];
    if (!result) throw new Error('We could not find that birthplace. Try adding the state or country.');
    const location = {
      latitude: result.latitude,
      longitude: result.longitude,
      timeZone: result.timezone,
      label: [result.name, result.admin1, result.country].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(', ')
    };
    locationCache.set(cacheKey, location);
    return location;
  }

  function placementSettings(name, available) {
    const previous = chartPlacements.find((placement) => placement.name === name);
    const defaultFeatured = available && ['Sun', 'Moon', 'Rising', 'Venus'].includes(name);
    const preservePrevious = previous && previous.available;
    return {
      featured: preservePrevious ? previous.featured && available : defaultFeatured,
      interactive: preservePrevious ? previous.interactive && available : defaultFeatured && ['Sun', 'Moon', 'Rising'].includes(name),
      strength: preservePrevious ? previous.strength : (defaultFeatured ? 78 : 24),
      opacity: preservePrevious ? previous.opacity : (defaultFeatured ? 78 : 20),
      reveal: preservePrevious ? previous.reveal : ''
    };
  }

  function buildPlacement(name, longitude, houses, available = true) {
    return {
      name,
      sign: available ? formatPlacement(longitude) : 'locked',
      longitude: available ? normalizeDegree(longitude) : null,
      house: available && houses ? houseForLongitude(longitude, houses.cusps) : null,
      available,
      ...placementSettings(name, available),
      requirement: 'birth time and place required'
    };
  }

  async function calculateBirthSky() {
    const sequence = ++calculationSequence;
    const [date, time, place] = birthInputs.map((field) => field.value.trim());
    const hasDate = Boolean(date);
    const hasAngles = Boolean(date && time && place);

    if (!hasDate) {
      chartPlacements = placementNames.map((name) => buildPlacement(name, 0, null, false));
      skyCalculationNote.textContent = 'Enter a birth date to calculate planetary placements.';
      renderBirthSky();
      return;
    }

    skyCalculationNote.textContent = hasAngles ? 'Finding the birthplace and calculating your exact sky…' : 'Calculating a date-only sky at noon UTC…';
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [swe, location] = await Promise.all([
        loadSwissEph(),
        hasAngles ? resolveBirthPlace(place) : Promise.resolve(null)
      ]);
      if (sequence !== calculationSequence) return;

      const utc = hasAngles ? localBirthTimeToUtc(date, time, location.timeZone) : new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const utcHour = utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600;
      const julianDay = swe.julday(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(), utcHour);
      const houses = hasAngles ? swe.houses(julianDay, location.latitude, location.longitude, 'P') : null;
      const bodyIds = {
        Sun: swe.SE_SUN, Moon: swe.SE_MOON, Mercury: swe.SE_MERCURY, Venus: swe.SE_VENUS,
        Mars: swe.SE_MARS, Jupiter: swe.SE_JUPITER, Saturn: swe.SE_SATURN, Uranus: swe.SE_URANUS,
        Neptune: swe.SE_NEPTUNE, Pluto: swe.SE_PLUTO, 'North Node': swe.SE_TRUE_NODE,
        Chiron: swe.SE_CHIRON, Lilith: swe.SE_MEAN_APOG
      };
      const longitudes = {};
      Object.entries(bodyIds).forEach(([name, body]) => {
        longitudes[name] = swe.calc_ut(julianDay, body, swe.SEFLG_SWIEPH)[0];
      });
      longitudes['South Node'] = normalizeDegree(longitudes['North Node'] + 180);

      if (hasAngles) {
        longitudes.Rising = houses.ascmc[swe.SE_ASC];
        longitudes.Midheaven = houses.ascmc[swe.SE_MC];
        longitudes.Descendant = normalizeDegree(longitudes.Rising + 180);
        longitudes.IC = normalizeDegree(longitudes.Midheaven + 180);
        longitudes.Vertex = houses.ascmc[swe.SE_VERTEX];
        const sunHouse = houseForLongitude(longitudes.Sun, houses.cusps);
        longitudes['Part of Fortune'] = normalizeDegree(longitudes.Rising + (sunHouse >= 7 ? longitudes.Moon - longitudes.Sun : longitudes.Sun - longitudes.Moon));
      }

      chartPlacements = placementNames.map((name) => {
        const available = Object.hasOwn(longitudes, name);
        return buildPlacement(name, available ? longitudes[name] : 0, houses, available);
      });
      skyCalculationNote.textContent = hasAngles
        ? `Exact chart calculated for ${location.label} · ${location.timeZone}.`
        : 'Date-only chart at noon UTC. Add birth time and place for exact Moon timing, Rising, houses, and angles.';
      renderBirthSky();
    } catch (error) {
      if (sequence !== calculationSequence) return;
      chartPlacements = placementNames.map((name) => buildPlacement(name, 0, null, false));
      skyCalculationNote.textContent = error.message || 'The chart engine could not load. Please try again.';
      renderBirthSky();
    }
  }

  function scheduleBirthSkyCalculation() {
    window.clearTimeout(calculationTimer);
    calculationTimer = window.setTimeout(calculateBirthSky, 500);
  }

  function showStep(index) {
    const canShareSky = Boolean(signedInUser) && !accountTestingMode;
    shareSkyWithFriends.disabled = !canShareSky;
    combineSkyWithFriends.disabled = !canShareSky;
    document.getElementById('sharedSkyHelp').textContent = canShareSky
      ? 'Save changes to update sharing. Birth details and hidden messages stay private.'
      : 'Sign in to share your zodiac signs. Birth details and hidden messages stay private.';
    const stepCount = settingsMode ? panels.length - 1 : panels.length;
    const previousStep = currentStep;
    currentStep = Math.max(0, Math.min(index, stepCount - 1));
    if (currentStep === 1 && previousStep !== 1 && !settingsMode) setSourceStage(selectedSources.size || localPhotoUrls.length ? 'arrange' : 'pick');
    setup.dataset.activeStep = String(currentStep);
    panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== currentStep; });
    stepButtons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === currentStep);
      button.classList.toggle('is-complete', !settingsMode && buttonIndex < currentStep);
      if (buttonIndex === currentStep) button.setAttribute('aria-current', settingsMode ? 'page' : 'step');
      else button.removeAttribute('aria-current');
    });
    progressLabel.textContent = settingsMode ? 'your orbit, live' : `plate ${['i', 'ii', 'iii', 'iv'][currentStep] || currentStep + 1} of ${['i', 'ii', 'iii', 'iv'][stepCount - 1] || stepCount}`;
    if (settingsMode) {
      panels.slice(0, 3).forEach((panel, panelIndex) => {
        panel.querySelector('h1').textContent = editorTitles[panelIndex];
        panel.querySelector('.setup-intro').textContent = editorIntros[panelIndex];
      });
      editorHotspots.querySelectorAll('[data-editor-target]').forEach((button) => {
        button.classList.toggle('is-active', Number(button.dataset.editorTarget) === currentStep);
        button.setAttribute('aria-pressed', String(Number(button.dataset.editorTarget) === currentStep));
      });
    }
    backButton.disabled = currentStep === 0;
    nextButton.textContent = currentStep === stepCount - 1
      ? (settingsMode ? 'save changes' : accountTestingMode ? 'enter my orbit' : signedInUser ? 'save my orbit' : accountConnected ? (accountMode === 'signup' ? 'create account' : 'sign in') : 'preview my orbit')
      : !settingsMode && currentStep === 1 ? 'Set them in motion →' : 'continue';
    if (accountConnected) {
      const authenticated = Boolean(signedInUser);
      document.querySelector('.account-mode').hidden = authenticated;
      document.querySelector('.account-fields').hidden = authenticated;
      if (authenticated) accountStatus.textContent = 'You are signed in. Save these choices to your orbit.';
    }
    skipButton.hidden = !settingsMode;
    skipButton.textContent = 'save changes';
    updateHiddenStarSelection();
    if (currentStep !== 2) setupHiddenThought.hidden = true;
    if (currentStep === 2) loadFriendSkies();
    if (currentStep === 1) {
      updateSourcePreview();
      syncRingLabels();
    } else {
      previewState.textContent = settingsMode ? 'your live orbit' : stepPreview[currentStep][0];
      previewNote.textContent = settingsMode ? 'Select the planet, rings, or stars to edit. Connections live in the editor.' : stepPreview[currentStep][1];
      if (!settingsMode && currentStep === 3 && accountMode !== 'signin' && !ringGroups().some((ring) => ring.items.length)) {
        previewState.textContent = 'ring needed';
        previewNote.textContent = 'Return to sources and add a ring with images before entering your orbit.';
      }
    }
  }

  function collectOrbitData() {
    return {
      version: 1,
      media: savedMedia,
      sharedPortrait: savedMedia.portrait?.asset === 'assets/portraits/zachbell14.jpg' ? { asset: savedMedia.portrait.asset } : null,
      sources: [...selectedSources].filter(sourceIsApproved).map((source) => ({
        provider: source, url: sourceChoices[source].url, selectedUrls: [...sourceChoices[source].selectedUrls], baseShared: Boolean(sourceChoices[source].baseShared)
      })),
      title: {
        first: skyTitleFirst.value.slice(0, 32),
        second: skyTitleSecond.value.slice(0, 32),
        secondColor: skyTitleSecondColor.value,
        bio: skyBio.value.trim().slice(0, 80)
      },
      birth: Object.fromEntries(['date', 'time', 'place'].map((key, index) => [key, birthInputs[index].value.slice(0, 100)])),
      placements: chartPlacements.map(({ name, featured, interactive, strength, opacity, reveal }) => ({
        name, featured, interactive, strength, opacity, reveal: reveal.slice(0, 180)
      })),
      hiddenStars: {
        enabled: hiddenStarEnabled.checked,
        messages: hiddenMessages.map(({ text, starIndex }) => ({ text: text.slice(0, 180), starIndex }))
      },
      sharedSky: { enabled: shareSkyWithFriends.checked, constellations: shareSkyWithFriends.checked ? ownSkySigns() : [] },
      preferences: {
        portraitPosition: { size: Number(portraitSize.value), x: Number(portraitX.value), y: Number(portraitY.value) },
        wanderSize: Number(wanderSize.value), wanderSpeed: Number(wanderSpeed.value), lightUpSpace: lightUpSpace.checked,
        combineSkyWithFriends: combineSkyWithFriends.checked, friendSkyIds: [...friendSkyIds]
      },
      legacyOverflowRings,
      excludedRingSources: [...excludedRingSources],
      rings: [...ringBuilder.querySelectorAll('.ring-row')].map((row) => ({
        id: row.dataset.orbitRing,
        source: ringSourceList(row)[0] || '',
        sources: ringSourceList(row),
        autoCreated: row.dataset.autoCreated === 'true',
        mode: 'words',
        words: row.querySelector('.ring-words-field input')?.value.slice(0, 32) || '',
        visibility: row.querySelector('[role="radio"][aria-checked="true"]')?.textContent || 'everyone'
      }))
    };
  }

  async function applyOrbitData(saved, preserveLocalMedia = false) {
    if (!saved || saved.version !== 1) return;
    if (!preserveLocalMedia) await restoreOrbitMedia(saved.media);
    const position = saved.preferences?.portraitPosition || {};
    for (const [control, key, fallback] of [[portraitSize, 'size', 100], [portraitX, 'x', 0], [portraitY, 'y', 0]]) {
      control.value = String(Number.isFinite(position[key]) ? Math.max(Number(control.min), Math.min(Number(control.max), position[key])) : fallback);
    }
    updatePortraitPosition();
    excludedRingSources.clear();
    if (Array.isArray(saved.excludedRingSources)) saved.excludedRingSources
      .filter((source) => Object.hasOwn(ringSources, source))
      .forEach((source) => excludedRingSources.add(source));
    selectedSources.clear();
    activeSource = null;
    Object.values(sourceChoices).forEach((choice) => { choice.url = ''; choice.approved = false; choice.baseShared = false; choice.previewLoading = false; choice.items = []; choice.options = []; choice.selectedUrls = []; choice.nextPage = null; choice.pickerOpen = false; choice.extraOpen = false; });
    if (Array.isArray(saved.sources)) saved.sources.slice(0, 5).forEach((entry) => {
      if (!sourceChoices[entry?.provider] || typeof entry.url !== 'string') return;
      try {
        sourceChoices[entry.provider].url = validateSourceUrl(entry.provider, entry.url);
        sourceChoices[entry.provider].approved = true;
        sourceChoices[entry.provider].baseShared = entry.baseShared === true || (entry.baseShared === undefined && !sourceIsProfile(entry.provider, sourceChoices[entry.provider].url));
        sourceChoices[entry.provider].selectedUrls = Array.isArray(entry.selectedUrls)
          ? [...new Set(entry.selectedUrls.flatMap((url) => { try { return [validateSourceUrl(entry.provider, url)]; } catch (_) { return []; } }))] : [];
        selectedSources.add(entry.provider);
      } catch (_) {}
    });
    syncSourceButtons();
    renderSourceSharing();
    await refreshPublicSources();
    skyTitleFirst.value = String(saved.title?.first || '').slice(0, 32);
    skyTitleSecond.value = String(saved.title?.second || '').slice(0, 32);
    if (/^#[0-9a-f]{6}$/i.test(saved.title?.secondColor || '')) skyTitleSecondColor.value = saved.title.secondColor;
    skyBio.value = String(saved.title?.bio || '').slice(0, 80);
    updateSkyTitle();
    const birth = saved.birth || {};
    [birth.date, birth.time, birth.place].forEach((value, index) => { birthInputs[index].value = String(value || '').slice(0, 100); });
    await calculateBirthSky();
    if (Array.isArray(saved.placements)) {
      saved.placements.forEach((settings) => {
        const placement = chartPlacements.find((item) => item.name === settings.name);
        if (!placement) return;
        placement.featured = Boolean(settings.featured) && placement.available;
        placement.interactive = Boolean(settings.interactive) && placement.featured;
        placement.strength = Math.max(10, Math.min(100, Number(settings.strength) || 40));
        placement.opacity = Math.max(5, Math.min(100, Number(settings.opacity) || 60));
        placement.reveal = String(settings.reveal || '').slice(0, 180);
      });
      renderBirthSky();
    }
    hiddenStarEnabled.checked = Boolean(saved.hiddenStars?.enabled);
    const messages = Array.isArray(saved.hiddenStars?.messages) ? saved.hiddenStars.messages : [];
    hiddenMessages.splice(0, hiddenMessages.length, ...messages.slice(0, 6).map((message) => ({
      text: String(message.text || '').slice(0, 180),
      starIndex: Number.isInteger(message.starIndex) && message.starIndex >= 0 && message.starIndex < hiddenStarPositions.length ? message.starIndex : null
    })));
    if (!hiddenMessages.length) hiddenMessages.push({ text: '', starIndex: null });
    activeHiddenMessage = 0;
    renderHiddenMessages();
    shareSkyWithFriends.checked = !accountTestingMode && saved.sharedSky?.enabled === true;
    combineSkyWithFriends.checked = !accountTestingMode && saved.preferences?.combineSkyWithFriends === true;
    friendSkyPicker.hidden = !combineSkyWithFriends.checked;
    friendSkyIds = new Set(!accountTestingMode && Array.isArray(saved.preferences?.friendSkyIds)
      ? saved.preferences.friendSkyIds.filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100)
      : []);
    renderFriendSkyChoices();
    if (combineSkyWithFriends.checked) loadFriendSkies();
    lightUpSpace.checked = saved.preferences?.lightUpSpace !== false;
    document.body.classList.toggle('orbit-sky-unlit', !lightUpSpace.checked);
    if (Number.isFinite(saved.preferences?.wanderSize)) {
      wanderSize.value = String(Math.max(60, Math.min(140, saved.preferences.wanderSize)));
      updateWanderSize();
    }
    if (Number.isFinite(saved.preferences?.wanderSpeed)) {
      wanderSpeed.value = String(Math.max(50, Math.min(1200, saved.preferences.wanderSpeed)));
      updateWanderSpeed();
    }
    renderSharedSky();
    if (Array.isArray(saved.rings)) {
      legacyOverflowRings = Array.isArray(saved.legacyOverflowRings) ? saved.legacyOverflowRings : [];
      ringBuilder.replaceChildren();
      saved.rings.forEach((ring, index) => {
        const legacySource = ring.source && ringSources[ring.source] ? ring.source : '';
        const sources = Array.isArray(ring.sources)
          ? [...new Set(ring.sources.filter((source) => ringSources[source]))]
          : legacySource ? [legacySource] : [];
        const row = createRingRow({
          id: ring.id ? String(ring.id) : undefined,
          sources,
          autoCreated: ring.autoCreated === true,
          label: String(ring.words || ringSources[legacySource] || '').slice(0, 32)
        });
        row.querySelectorAll('[role="radio"]').forEach((option) => {
          option.setAttribute('aria-checked', String(option.textContent === (['only me', 'close orbit', 'everyone'].includes(ring.visibility) ? ring.visibility : 'everyone')));
        });
      });
      syncRingRows();
      syncRingLabels();
      renderSetupRings();
    }
  }

  function setAccountMode(mode) {
    accountMode = mode;
  accountModeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.accountMode === mode)));
    accountUsernameField.hidden = mode === 'signin';
    accountUsername.required = mode === 'signup';
    accountPassword.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    const accountPanel = document.querySelector('[data-setup-panel="3"]');
    accountPanel.querySelector('h1').textContent = mode === 'signin' ? 'Welcome back.' : 'Save your orbit.';
    if (mode === 'signin') {
      accountPanel.querySelector('.setup-intro').textContent = 'Sign in to return to your saved portrait, rings, and sky.';
      document.querySelector('#accountEmail + small').textContent = 'Use the email address on your Orbiting account.';
    } else if (accountConnected) {
      accountPanel.querySelector('.setup-intro').textContent = 'Create your account and step into your orbit. Verify your email when you’re ready to save across devices.';
      document.querySelector('#accountEmail + small').textContent = 'We’ll send you a verification link. You can enter your orbit first.';
    }
    accountStatus.textContent = '';
    if (currentStep === panels.length - 1) showStep(currentStep);
  }

  async function previewAccount() {
    if (accountTestingMode) {
      accountEmail.value = '';
      accountPassword.value = '';
      enterOrbit(false);
      return;
    }
    if (signedInUser) {
      nextButton.disabled = true;
      try {
        await saveCurrentOrbit();
        accountStatus.textContent = 'Your orbit is saved.';
        enterOrbit(false);
      } catch (error) {
        accountStatus.textContent = error.message || 'Your orbit could not be saved.';
      } finally { nextButton.disabled = false; }
      return;
    }
    accountUsername.value = accountUsername.value.trim();
    const fields = accountMode === 'signup' ? [accountUsername, accountEmail, accountPassword] : [accountEmail, accountPassword];
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      accountStatus.textContent = invalid === accountUsername
        ? 'Choose a username with 3–20 letters, numbers, or underscores.'
        : invalid === accountEmail
          ? 'Enter a valid email address.'
          : 'Use at least 8 characters for your password.';
      invalid.focus();
      return;
    }
    if (!accountConnected) {
      accountStatus.textContent = '';
      accountEmail.value = '';
      accountPassword.value = '';
      enterOrbit(false);
      return;
    }
    nextButton.disabled = true;
    accountStatus.textContent = accountMode === 'signup' ? 'Creating your account…' : 'Signing in…';
    try {
      let shouldSave = accountMode === 'signup';
      if (accountMode === 'signup') {
        const result = await window.OrbitingAccount.signUp({
          username: accountUsername.value, email: accountEmail.value, password: accountPassword.value
        });
        accountPassword.value = '';
        if (result.needsConfirmation) {
          pendingVerificationEmail = accountEmail.value.trim().toLowerCase();
          let savedLocally = true;
          try { window.OrbitingAccount.savePendingSignup(pendingVerificationEmail, collectOrbitData()); }
          catch (_) { savedLocally = false; }
          showVerificationReminder(savedLocally);
          enterOrbit(false);
          return;
        }
        signedInUser = result.user;
      } else {
        const result = await window.OrbitingAccount.signIn({
          email: accountEmail.value, password: accountPassword.value, username: accountUsername.value
        });
        signedInUser = result.user;
        const pending = readPendingOrbit(result.user?.email);
        if (pending) { await applyOrbitData(pending, true); shouldSave = true; }
        else if (result.profile?.orbit_data?.version === 1) await applyOrbitData(result.profile.orbit_data);
      }
      if (shouldSave) await saveCurrentOrbit();
      if (readPendingOrbit(signedInUser?.email)) {
        try { localStorage.removeItem(pendingOrbitKey); } catch (_) {}
      }
      pendingVerificationEmail = '';
      verificationReminder.hidden = true;
      document.getElementById('signOutOrbit').hidden = false;
      document.getElementById('setupSignIn').hidden = true;
      accountPassword.value = '';
      accountStatus.textContent = shouldSave ? 'Your orbit is saved.' : 'You’re signed in.';
      if (ringGroups().some(ring => ring.items.length)) enterOrbit(false);
      else openAccountSetup(0);
    } catch (error) {
      accountStatus.textContent = error.message || 'Your account could not be saved. Please try again.';
    } finally {
      nextButton.disabled = false;
    }
  }

  function requireFilledRing() {
    if (settingsMode || sharedWander || ringGroups().some((ring) => ring.items.length)) {
      ringValidation.hidden = true;
      return true;
    }
    const hasImages = approvedSourceItems().length > 0;
    ringValidation.textContent = hasImages
      ? 'Your images are ready, but no ring contains them. Add a ring or select a source for one before continuing.'
      : 'No images are ready yet. Choose a public source that loads images or add your photos before continuing.';
    ringValidation.hidden = false;
    showStep(1);
    (hasImages ? addRing : sourceButtons[0]).focus();
    ringValidation.scrollIntoView({ block: 'center' });
    return false;
  }

  function enterOrbit(forceEmpty = false, previewHues = false, restoringProfile = false) {
    if (!restoringProfile && !requireFilledRing()) return;
    const items = approvedSourceItems();
    window.OrbitingExplore?.setPersonalImages(items);
    const showHuesDemo = previewHues && !items.length;
    if (!showHuesDemo && window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
    const hasSources = !forceEmpty && (previewHues || ringGroups().some((ring) => ring.items.length));
    document.body.classList.toggle('orbit-empty', !hasSources);
    const visibleMessages = hiddenStarEnabled.checked
      ? hiddenMessages.filter((message) => message.text.trim() && message.starIndex !== null)
      : [];
    window.ORBITING_HIDDEN_THOUGHTS = Object.fromEntries(visibleMessages.map((message) => [message.starIndex, message.text.trim()]));
    finalHiddenThoughts.innerHTML = visibleMessages.map((message) => {
      const position = hiddenStarPositions[message.starIndex];
      return `<button class="quote-star c-moon-quote is-interactive" type="button" data-star-action="hiddenThought" data-hidden-star-index="${message.starIndex}" aria-label="Reveal a hidden message" style="left:${position.left}%;top:${position.top}%;right:auto"><span class="quote-star-halo" aria-hidden="true"></span><span class="quote-star-core" aria-hidden="true"></span></button>`;
    }).join('');
    const owner = document.getElementById('prototypeOwner');
    if (owner) owner.textContent = hasSources ? 'your orbit' : 'your empty orbit';
    syncRingLabels(showHuesDemo);
    renderFinalBirthSky();
    if (pendingVerificationEmail) {
      try { window.OrbitingAccount.savePendingSignup(pendingVerificationEmail, collectOrbitData()); }
      catch (_) { verificationStatus.textContent = 'Your browser could not save this draft. Keep this tab open and verify your email to save it to your account.'; }
    }
    if (!accountConnected) {
      try { localStorage.setItem(demoOrbitKey, JSON.stringify(collectOrbitData())); } catch (_) {}
    }
    setup.classList.add('is-leaving');
    window.clearTimeout(setupCloseTimer);
    setupCloseTimer = window.setTimeout(() => {
      setup.setAttribute('aria-hidden', 'true');
      setup.inert = true;
    }, 720);
    document.getElementById('hero').inert = false;
    if (settingsMode) document.getElementById('openOrbitSettings').focus();
  }

  nextButton.addEventListener('click', async () => {
    if (currentStep === 1 && !settingsMode && !requireFilledRing()) return;
    if (currentStep === 2 && hiddenStarEnabled.checked) {
      const unplaced = hiddenMessages.findIndex((message) => message.starIndex === null);
      if (unplaced !== -1) {
        activeHiddenMessage = unplaced;
        renderHiddenMessages();
        hiddenStarSelectionStatus.textContent = `Choose a star for message ${unplaced + 1} before continuing`;
        hiddenStarChoices.querySelector('button')?.focus();
        return;
      }
      const empty = hiddenMessages.findIndex((message) => !message.text.trim());
      if (empty !== -1) {
        activeHiddenMessage = empty;
        renderHiddenMessages();
        hiddenStarSelectionStatus.textContent = `Add text for message ${empty + 1}`;
        hiddenMessageList.querySelector(`[data-message-text="${empty}"]`)?.focus();
        return;
      }
    }
    if (settingsMode && currentStep === panels.length - 2) {
      if (accountConnected && signedInUser) {
        nextButton.disabled = true;
        try {
          await saveCurrentOrbit();
        } catch (error) {
          previewNote.textContent = error.message || 'Your changes could not be saved. Please try again.';
          nextButton.disabled = false;
          return;
        }
        nextButton.disabled = false;
      }
      enterOrbit(false, !accountConnected);
    }
    else if (currentStep < panels.length - 1) showStep(currentStep + 1);
    else previewAccount();
  });
  backButton.addEventListener('click', () => showStep(currentStep - 1));
  skipButton.addEventListener('click', async () => {
    if (!settingsMode && accountConnected) return;
    if (settingsMode && signedInUser) {
      skipButton.disabled = true;
      skipButton.textContent = 'saving…';
      try {
        await saveCurrentOrbit();
      } catch (error) {
        previewNote.textContent = error.message || 'Your changes could not be saved. Please try again.';
        skipButton.disabled = false;
        skipButton.textContent = 'save changes';
        return;
      }
      skipButton.disabled = false;
      skipButton.textContent = 'save changes';
    }
    if (!settingsMode) setCosmosDepth(0);
    enterOrbit(false, !accountConnected);
  });
  stepButtons.forEach((button) => button.addEventListener('click', () => showStep(Number(button.dataset.setupStep))));
  editorHotspots.addEventListener('click', (event) => {
    const button = event.target.closest('[data-editor-target]');
    if (!button) return;
    showStep(Number(button.dataset.editorTarget));
    stepButtons[Number(button.dataset.editorTarget)].focus();
  });
  [accountUsername, accountEmail, accountPassword].forEach((field) => {
    field.addEventListener('input', () => { accountStatus.textContent = ''; });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        previewAccount();
      }
    });
  });
  document.getElementById('setupSignIn').addEventListener('click', () => { window.location.assign('login.html'); });
  document.getElementById('signOutOrbit').addEventListener('click', async () => {
    try { await window.OrbitingAccount.signOut(); window.location.assign('login.html'); }
    catch (error) { window.alert(error.message || 'Could not sign out. Please try again.'); }
  });
  accountModeButtons.forEach((button) => button.addEventListener('click', () => setAccountMode(button.dataset.accountMode)));
  function readPendingOrbit(email) {
    return window.OrbitingAccount.getPendingSignup(email)?.orbit || null;
  }

  function showVerificationReminder(savedLocally = true) {
    verificationReminder.hidden = false;
    verificationStatus.textContent = savedLocally
      ? 'Enjoy your orbit here. Check your inbox to verify your email before signing in on another device. Your draft stays in this browser until then.'
      : 'Enjoy your orbit here. This browser could not save your draft; keep this tab open and verify your email to save it to your account.';
  }

  document.getElementById('resendVerification').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await window.OrbitingAccount.resendVerification(pendingVerificationEmail);
      verificationStatus.textContent = 'Check your inbox for a verification link. You can keep exploring.';
    } catch (error) { verificationStatus.textContent = error.message || 'The email could not be sent. Try again shortly.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('completeVerification').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const session = await window.OrbitingAccount.getSession();
      if (!session?.user?.email_confirmed_at || session.user.email?.toLowerCase() !== pendingVerificationEmail) {
        setAccountMode('signin');
        accountEmail.value = pendingVerificationEmail;
        openAccountSetup(panels.length - 1);
        accountStatus.textContent = 'After verifying your email, sign in to save this orbit to your account.';
        return;
      }
      await window.OrbitingAccount.loadOrbit();
      signedInUser = session.user;
      await saveCurrentOrbit();
      signedInUser = session.user;
      window.OrbitingAccount.clearPendingSignup();
      pendingVerificationEmail = '';
      verificationReminder.hidden = true;
    } catch (error) { verificationStatus.textContent = error.message || 'Your orbit could not be saved yet. Your draft is still here.'; }
    finally { button.disabled = false; }
  });

  const profileLoading = document.getElementById('profileLoading');
  const profileLoadingMessage = document.getElementById('profileLoadingMessage');
  const retryProfileLoad = document.getElementById('retryProfileLoad');
  retryProfileLoad.addEventListener('click', () => window.location.reload());
  profileLoading.hidden = false;
  document.getElementById('hero').inert = true;
  // Invite-only sites show visitors without an account nothing but sign-in, including the demo routes.
  const demoRouteAllowed = !(sharedWander || accountTestingMode) ? Promise.resolve(true)
    : window.OrbitingAccount.isInviteOnly()
      .then(async (inviteOnly) => !inviteOnly || Boolean(await window.OrbitingAccount.getSession()))
      .catch(() => true);
  if (sharedWander) demoRouteAllowed.then((allowed) => {
    if (!allowed) { window.location.replace('login.html'); return; }
    profileLoading.hidden = true;
    document.getElementById('hero').inert = false;
  });

  function openAccountSetup(step) {
    profileLoading.hidden = true;
    settingsMode = false;
    showStep(step);
    setup.inert = false;
    setup.setAttribute('aria-hidden', 'false');
    setup.classList.remove('is-leaving');
    document.getElementById('hero').inert = true;
    (step === panels.length - 1 && !signedInUser ? (accountTestingMode ? nextButton : accountEmail) : stepButtons[0]).focus();
  }

  if (!sharedWander && accountTestingMode) (async () => {
    if (!(await demoRouteAllowed)) { window.location.replace('login.html'); return; }
    accountConnected = false;
    try {
      if (!walkthroughMode) {
        const saved = JSON.parse(localStorage.getItem(demoOrbitKey) || 'null');
        if (saved?.version === 1) await applyOrbitData(saved, true);
      }
    } catch (_) {}
    openAccountSetup(0);
  })(); else if (!sharedWander) window.OrbitingAccount.isConfigured().then(async (configured) => {
    accountConnected = configured;
    document.getElementById('setupSignIn').hidden = !configured;
    if (requestedView === 'signin') setAccountMode('signin');
    if (!configured) {
      if (!walkthroughMode) {
        try {
          const saved = JSON.parse(localStorage.getItem(demoOrbitKey) || 'null');
          if (saved?.version === 1) await applyOrbitData(saved, true);
        } catch (_) {}
      }
      openAccountSetup(0);
      return;
    }
    accountDemoNotice.hidden = true;
    stepPreview[3][1] = 'Save your sky before you enter the cosmos.';
    document.querySelector('.account-mode').hidden = false;
    document.querySelector('[data-setup-panel="3"] .setup-intro').textContent = 'Create your account and step into your orbit. Verify your email when you’re ready to save across devices. Once verified and signed in, your portrait and uploaded images are saved privately with your account.';
    accountEmail.required = true;
    accountPassword.required = true;
    accountEmail.autocomplete = 'email';
    accountPassword.autocomplete = accountMode === 'signup' ? 'new-password' : 'current-password';
    document.querySelector('#accountEmail + small').textContent = 'We’ll send you a verification link. You can enter your orbit first.';
    document.querySelector('#accountPassword + small').textContent = 'At least 8 characters. Never use a password from another site.';
    setAccountMode(accountMode);
    birthPrivacyNote.textContent = 'Your birth details are saved privately with your Orbiting account to recreate your sky. Your place name is sent to Open-Meteo to find its coordinates and historical time zone. Friends see only your zodiac constellations if you turn on sky sharing.';
    showStep(currentStep);
    const session = await window.OrbitingAccount.getSession();
    if (session && needsPasswordSetup) { window.location.replace('account-access.html'); return; }
    if (session) {
      signedInUser = session.user;
      document.getElementById('signOutOrbit').hidden = false;
      document.getElementById('setupSignIn').hidden = true;
      const profile = await window.OrbitingAccount.loadOrbit();
      accountUsername.value = profile.username;
      const pending = readPendingOrbit(session.user?.email);
      const saved = profile.orbit_data?.version === 1 ? profile.orbit_data : pending;
      if (saved && !walkthroughMode) {
        await applyOrbitData(saved);
        if (pending && !profile.orbit_data?.version) {
          await saveCurrentOrbit();
          localStorage.removeItem(pendingOrbitKey);
        }

        enterOrbit(false, false, true);
        profileLoading.hidden = true;
      } else openAccountSetup(0);
    } else {
      const pending = window.OrbitingAccount.getPendingSignup();
      if (pending && !walkthroughMode) {
        pendingVerificationEmail = pending.email;
        accountEmail.value = pending.email;
        await applyOrbitData(pending.orbit, true);
        showVerificationReminder();
        if (ringGroups().some((ring) => ring.items.length)) { enterOrbit(false); profileLoading.hidden = true; }
        else { openAccountSetup(1); accountStatus.textContent = 'Your draft is here. Re-add any local images to restore their rings.'; }
      } else if (requestedView === 'setup' && !(await window.OrbitingAccount.isInviteOnly())) openAccountSetup(0);
      else window.location.replace('login.html');
    }
  }).catch((error) => {
    accountConnected = true;
    accountDemoNotice.hidden = true;
    accountStatus.textContent = error.message || 'The account service is temporarily unavailable. Please reload and try again.';
    portraitStatus.textContent = accountStatus.textContent;
    setup.classList.add('is-leaving');
    setup.setAttribute('aria-hidden', 'true');
    setup.inert = true;
    profileLoading.hidden = false;
    profileLoadingMessage.textContent = 'Your profile could not be opened. Please try again.';
    retryProfileLoad.hidden = false;
    document.getElementById('profileLoadSignIn').hidden = false;
  });

  function showPortrait(url) {
    setupPortrait.src = url;
    finalPortrait.src = url;
    setupPortrait.style.opacity = '';
    finalPortrait.style.opacity = '';
  }

  async function renderPortraitEdge(job) {
    if (!portraitCutout) return;
    const version = ++portraitRenderVersion;
    portraitStatus.textContent = 'Refining your cutout…';
    try {
      const url = portraitLassoPoints
        ? await portraitCutout.renderLasso(portraitLassoPoints, Number(portraitEdge.value), portraitLassoMagic)
        : await portraitCutout.render(Number(portraitEdge.value));
      if (job !== portraitJob || version !== portraitRenderVersion) { URL.revokeObjectURL(url); return; }
      if (cutoutPortraitUrl) URL.revokeObjectURL(cutoutPortraitUrl);
      cutoutPortraitUrl = url;
      if (portraitOriginal.getAttribute('aria-pressed') !== 'true') showPortrait(url);
      portraitStatus.textContent = portraitLassoPoints
        ? 'Custom cutout ready. Move the slider to refine its edge.'
        : 'Cutout ready. Move the slider if the edge needs adjusting.';
    } catch (error) {
      if (job !== portraitJob || version !== portraitRenderVersion) return;
      portraitStatus.textContent = 'Could not refine this cutout. You can still use the original photo.';
    }
  }

  async function loadPortraitFile(file) {
    if (!file) return;
    const job = ++portraitJob;
    resetPortraitPosition();
    portraitRemoveBackground.disabled = true;
    portraitMagicLasso.disabled = true;
    portraitMagicLasso.checked = false;
    portraitLassoMagic = false;
    window.clearTimeout(edgeTimer);
    if (originalPortraitUrl) URL.revokeObjectURL(originalPortraitUrl);
    if (cutoutPortraitUrl) URL.revokeObjectURL(cutoutPortraitUrl);
    originalPortraitUrl = URL.createObjectURL(file);
    cutoutPortraitUrl = null;
    portraitCutout = null;
    portraitLassoPoints = null;
    portraitLasso.hidden = true;
    portraitLassoReset.hidden = true;
    portraitRefine.hidden = true;
    portraitEdge.hidden = false;
    portraitEdge.previousElementSibling.hidden = false;
    portraitOriginal.setAttribute('aria-pressed', 'true');
    portraitOriginal.textContent = 'original photo selected';
    showPortrait(originalPortraitUrl);
    try {
      const { cutOutPortrait } = await import('./portrait-cutout.js?v=4');
      const cutout = await cutOutPortrait(file, (message) => {
        if (job === portraitJob) portraitStatus.textContent = message;
      });
      if (job !== portraitJob) return;
      portraitCutout = cutout;
      portraitRefine.hidden = false;
      portraitEdge.hidden = true;
      portraitEdge.previousElementSibling.hidden = true;
      portraitStatus.textContent = 'Photo ready. Draw a custom cutout now, or wait for the automatic outline.';
      const automaticAvailable = await cutout.automaticReady;
      if (job !== portraitJob) return;
      if (automaticAvailable) {
        portraitRemoveBackground.disabled = false;
        portraitMagicLasso.disabled = false;
        if (!portraitLassoPoints) portraitStatus.textContent = 'Photo ready. Choose remove background, draw a cutout, or keep the original.';
      } else if (!portraitLassoPoints) {
        portraitStatus.textContent = 'Automatic cutout could not find a clear outline. Draw one or keep the original photo.';
      }
    } catch (error) {
      if (job !== portraitJob) return;
      portraitStatus.textContent = 'Could not prepare this photo for cutting. You can keep the original or try another.';
      portraitRefine.hidden = true;
    }
  }

  portraitInput.addEventListener('change', () => {
    loadPortraitFile(portraitInput.files && portraitInput.files[0]);
  });

  document.getElementById('tryDemoCutout').addEventListener('click', async () => {
    portraitStatus.textContent = 'Opening the demo photo…';
    try {
      const response = await fetch('assets/saturn-face.png');
      if (!response.ok) throw new Error('Demo photo unavailable.');
      const file = new File([await response.blob()], 'demo-portrait.png', { type: 'image/png' });
      await loadPortraitFile(file);
    } catch (_) {
      portraitStatus.textContent = 'Could not open the demo photo. Choose another image to try the cutout.';
    }
  });

  portraitEdge.addEventListener('input', () => {
    const value = Number(portraitEdge.value);
    portraitEdgeValue.textContent = value < 35 ? 'softer' : value > 55 ? 'tighter' : 'balanced';
    window.clearTimeout(edgeTimer);
    edgeTimer = window.setTimeout(() => renderPortraitEdge(portraitJob), 120);
  });

  function drawLasso() {
    if (!lassoImage) return;
    const canvas = portraitLassoCanvas;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(lassoImage, 0, 0, canvas.width, canvas.height);
    if (!lassoDraft.length) return;
    context.beginPath();
    lassoDraft.forEach(({ x, y }, index) => {
      if (index === 0) context.moveTo(x * canvas.width, y * canvas.height);
      else context.lineTo(x * canvas.width, y * canvas.height);
    });
    if (!lassoDrawing && lassoDraft.length >= 3) context.closePath();
    context.strokeStyle = '#fff4d6';
    context.lineWidth = Math.max(2, canvas.width / 200);
    context.setLineDash([8, 5]);
    context.stroke();
    if (!lassoDrawing && lassoDraft.length >= 3) {
      context.fillStyle = 'rgba(124, 64, 80, .2)';
      context.fill();
    }
  }

  document.getElementById('portraitLassoOpen').addEventListener('click', async () => {
    if (!originalPortraitUrl || !portraitCutout) return;
    const job = portraitJob;
    portraitLasso.hidden = false;
    lassoDraft = [];
    portraitLassoApply.disabled = true;
    const image = new Image();
    image.src = originalPortraitUrl;
    try { await image.decode(); } catch (_) {
      portraitLasso.hidden = true;
      portraitStatus.textContent = 'Could not open that photo for manual cutout.';
      return;
    }
    if (job !== portraitJob) { portraitLasso.hidden = true; return; }
    lassoImage = image;
    const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
    portraitLassoCanvas.width = Math.round(image.naturalWidth * scale);
    portraitLassoCanvas.height = Math.round(image.naturalHeight * scale);
    drawLasso();
  });

  const lassoPoint = (event) => {
    const bounds = portraitLassoCanvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  };
  portraitLassoCanvas.addEventListener('pointerdown', (event) => {
    lassoDrawing = true;
    lassoDraft = [lassoPoint(event)];
    portraitLassoApply.disabled = true;
    portraitLassoCanvas.setPointerCapture(event.pointerId);
    drawLasso();
  });
  portraitLassoCanvas.addEventListener('pointermove', (event) => {
    if (!lassoDrawing) return;
    const point = lassoPoint(event);
    const last = lassoDraft[lassoDraft.length - 1];
    if (Math.hypot((point.x - last.x) * portraitLassoCanvas.width, (point.y - last.y) * portraitLassoCanvas.height) < 3) return;
    lassoDraft.push(point);
    drawLasso();
  });
  portraitLassoCanvas.addEventListener('pointerup', () => {
    lassoDrawing = false;
    portraitLassoApply.disabled = lassoDraft.length < 3;
    drawLasso();
  });
  portraitLassoCanvas.addEventListener('pointercancel', () => {
    lassoDrawing = false;
    portraitLassoApply.disabled = lassoDraft.length < 3;
    drawLasso();
  });
  document.getElementById('portraitLassoClear').addEventListener('click', () => {
    lassoDraft = [];
    portraitLassoApply.disabled = true;
    drawLasso();
  });
  document.getElementById('portraitLassoCancel').addEventListener('click', () => { portraitLasso.hidden = true; });
  portraitLassoApply.addEventListener('click', async () => {
    if (lassoDraft.length < 3) return;
    portraitOriginal.setAttribute('aria-pressed', 'false');
    portraitOriginal.textContent = 'show original photo';
    portraitLassoMagic = portraitMagicLasso.checked && !portraitMagicLasso.disabled;
    portraitLassoPoints = lassoDraft.slice();
    portraitLasso.hidden = true;
    portraitLassoReset.hidden = !portraitCutout.automaticAvailable;
    portraitEdge.hidden = false;
    portraitEdge.previousElementSibling.hidden = false;
    await renderPortraitEdge(portraitJob);
  });
  portraitLassoReset.addEventListener('click', async () => {
    if (!portraitCutout?.automaticAvailable) return;
    portraitLassoPoints = null;
    portraitLassoReset.hidden = true;
    portraitOriginal.setAttribute('aria-pressed', 'false');
    portraitOriginal.textContent = 'show original photo';
    await renderPortraitEdge(portraitJob);
  });

  portraitRemoveBackground.addEventListener('click', async () => {
    if (!portraitCutout?.automaticAvailable) return;
    portraitLassoPoints = null;
    portraitLasso.hidden = true;
    portraitLassoReset.hidden = true;
    portraitOriginal.setAttribute('aria-pressed', 'false');
    portraitOriginal.textContent = 'show original photo';
    portraitEdge.hidden = false;
    portraitEdge.previousElementSibling.hidden = false;
    await renderPortraitEdge(portraitJob);
  });

  portraitOriginal.addEventListener('click', () => {
    if (!originalPortraitUrl || !cutoutPortraitUrl) return;
    const useOriginal = portraitOriginal.getAttribute('aria-pressed') !== 'true';
    portraitOriginal.setAttribute('aria-pressed', String(useOriginal));
    portraitOriginal.textContent = useOriginal ? 'use cutout instead' : 'show original photo';
    showPortrait(useOriginal ? originalPortraitUrl : cutoutPortraitUrl);
    portraitStatus.textContent = useOriginal ? 'Original photo selected.' : 'Cutout selected.';
  });

  document.getElementById('useDemoPortrait').addEventListener('click', () => {
    ++portraitJob;
    resetPortraitPosition();
    portraitRefine.hidden = true;
    const demo = 'assets/saturn-face-transparent.webp';
    showPortrait(demo);
    portraitStatus.textContent = 'Demo portrait ready.';
  });

  sourceButtons.forEach((button) => button.addEventListener('click', () => {
    const source = button.dataset.source;
    selectedSources.add(source);
    activeSource = source;
    syncSourceButtons();
    const choice = sourceChoices[source];
    sourceAuthStatus.textContent = choice.approved ? `${choice.name}: ${choice.selectedUrls.length} public choices selected.` : source === 'instagram' ? 'Enter your public Instagram username below.' : `Enter your public ${choice.name} username or link below.`;
    sourceStageAdvance = false;
    setSourceStage('link');
    renderSourceSharing();
    sourceSharing.querySelector(`[data-source-url="${source}"]`)?.focus();
    updateSourcePreview();
  }));

  photosSourceButton.addEventListener('click', () => {
    activeSource = 'photos';
    syncSourceButtons();
    setSourceStage('link');
    renderSourceSharing();
    sourceAuthStatus.textContent = 'Choose image files or a folder below. Your photos stay on this device.';
    document.getElementById('choosePhotoFiles').focus();
  });

  document.getElementById('choosePhotoFiles').addEventListener('click', () => albumInput.click());
  document.getElementById('choosePhotoFolder').addEventListener('click', () => folderInput.click());

  async function loadMorePublicChoices(source, selectLoaded = false) {
    const choice = sourceChoices[source];
    if (!choice.nextPage) return;
    const url = choice.url;
    const page = choice.nextPage;
    const result = await window.OrbitingAccount.previewPublicSource(source, url, [], {
      discoveryPage: page, includeBase: false
    });
    if (choice.url !== url || choice.nextPage !== page) throw new Error('The profile changed while loading. Try again.');
    const known = new Set(choice.options.map((option) => option.url));
    (result.options || []).forEach((option) => {
      if (typeof option.name !== 'string' || typeof option.url !== 'string' || known.has(option.url)) return;
      known.add(option.url);
      choice.options.push(option);
      if (selectLoaded && !choice.selectedUrls.includes(option.url)) choice.selectedUrls.push(option.url);
    });
    choice.nextPage = Number.isInteger(result.nextPage) && result.nextPage > page ? result.nextPage : null;
  }

  sourceSharing.addEventListener('click', async (event) => {
    if (event.target.closest('[data-switch-to-photos]')) {
      photosSourceButton.click();
      return;
    }
    const removeSource = event.target.closest('[data-remove-source]');
    if (removeSource) {
      const source = removeSource.dataset.removeSource;
      const choice = sourceChoices[source];
      selectedSources.delete(source);
      clearTimeout(sourcePreviewTimers.get(source));
      excludedRingSources.delete(source);
      choice.url = ''; choice.approved = false; choice.baseShared = false; choice.previewLoading = false; choice.items = []; choice.options = []; choice.selectedUrls = []; choice.nextPage = null; choice.pickerOpen = false; choice.extraOpen = false;
      activeSource = null;
      sourceAuthStatus.textContent = `${choice.name} removed. Choose another source above, or continue.`;
      setSourceStage('pick');
      syncSourceButtons();
      renderSourceSharing();
      updateSourcePreview();
      if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
      document.body.classList.toggle('orbit-empty', !approvedSourceItems().length);
      return;
    }
    const shareBase = event.target.closest('[data-share-base-source]');
    if (shareBase) {
      const choice = sourceChoices[shareBase.dataset.shareBaseSource];
      choice.baseShared = !choice.baseShared;
      renderSourceSharing();
      syncSourceButtons();
      updateSourcePreview();
      if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
      document.body.classList.toggle('orbit-empty', !approvedSourceItems().length);
      return;
    }
    const toggleChoices = event.target.closest('[data-toggle-source-options]');
    if (toggleChoices) {
      sourceChoices[toggleChoices.dataset.toggleSourceOptions].pickerOpen = !sourceChoices[toggleChoices.dataset.toggleSourceOptions].pickerOpen;
      renderSourceSharing();
      return;
    }
    const toggleExtra = event.target.closest('[data-toggle-extra-source]');
    if (toggleExtra) {
      sourceChoices[toggleExtra.dataset.toggleExtraSource].extraOpen = !sourceChoices[toggleExtra.dataset.toggleExtraSource].extraOpen;
      renderSourceSharing();
      return;
    }
    const selectAll = event.target.closest('[data-select-all-source]');
    if (selectAll) {
      const source = selectAll.dataset.selectAllSource;
      const choice = sourceChoices[source];
      choice.options.forEach((option) => {
        if (!choice.selectedUrls.includes(option.url)) choice.selectedUrls.push(option.url);
      });
      try {
        while (choice.nextPage) {
          sourceAuthStatus.textContent = `${choice.name}: selecting all public channels… ${choice.selectedUrls.length} found so far.`;
          await loadMorePublicChoices(source, true);
        }
        sourceAuthStatus.textContent = `${choice.name}: ${choice.selectedUrls.length} public choices selected. Loading your preview…`;
        renderSourceSharing();
        await refreshPublicSources(source, false);
      } catch (error) {
        renderSourceSharing();
        sourceAuthStatus.textContent = `${choice.name}: ${choice.selectedUrls.length} choices selected. ${error.message || 'More public choices could not be loaded.'}`;
      }
      return;
    }
    const loadMore = event.target.closest('[data-load-more-source]');
    if (loadMore) {
      const source = loadMore.dataset.loadMoreSource;
      try {
        sourceAuthStatus.textContent = `Loading more public ${sourceChoices[source].name} channels…`;
        await loadMorePublicChoices(source);
        renderSourceSharing();
        sourceAuthStatus.textContent = `${sourceChoices[source].name}: ${sourceChoices[source].options.length} public choices shown.`;
      } catch (error) { sourceAuthStatus.textContent = error.message || 'More public channels could not be loaded.'; }
      return;
    }
    const addExtra = event.target.closest('[data-add-extra-source]');
    if (addExtra) {
      const source = addExtra.dataset.addExtraSource;
      const choice = sourceChoices[source];
      const input = sourceSharing.querySelector(`[data-extra-source-url="${source}"]`);
      try {
        const rawLinks = source === 'instagram' ? input.value.trim().split(/[\s,]+/).filter(Boolean) : [input.value];
        if (!rawLinks.length) throw new Error('Paste at least one public post or Reel link.');
        const urls = [...new Set(rawLinks.map((raw) => validateSourceUrl(source, raw)))];
        if (urls.some((url) => sourceIsProfile(source, url))) throw new Error('Add public post or Reel links, not a profile link.');
        const added = urls.filter((url) => !choice.selectedUrls.includes(url) && choice.url !== url);
        if (!added.length) throw new Error('These links are already selected.');
        choice.selectedUrls.push(...added);
        sourceAuthStatus.textContent = source === 'instagram'
          ? `Loading ${added.length} public post${added.length === 1 ? '' : 's'} into your preview…`
          : `Loading another public ${choice.name} item…`;
        renderSourceSharing();
        await refreshPublicSources(source, false);
      } catch (error) { sourceAuthStatus.textContent = error.message || 'Enter a valid public item link.'; input.focus(); }
      return;
    }
    const removeExtra = event.target.closest('[data-remove-extra-source]');
    if (removeExtra) {
      const choice = sourceChoices[removeExtra.dataset.removeExtraSource];
      choice.selectedUrls.splice(Number(removeExtra.dataset.extraIndex), 1);
      sourceAuthStatus.textContent = 'Public item removed from your preview.';
      renderSourceSharing();
      await refreshPublicSources(removeExtra.dataset.removeExtraSource, false);
      return;
    }
    const button = event.target.closest('[data-approve-source]');
    if (!button) return;
    const source = button.dataset.approveSource;
    const choice = sourceChoices[source];
    const input = sourceSharing.querySelector(`[data-source-url="${source}"]`);
    sourceStageAdvance = true;
    try {
      clearTimeout(sourcePreviewTimers.get(source));
      const nextUrl = sourceInputUrl(source, input.value);
      if (choice.url !== nextUrl) {
        choice.selectedUrls = [];
        choice.baseShared = false;
        choice.options = [];
        choice.nextPage = null;
        choice.pickerOpen = false;
        choice.extraOpen = false;
      }
      choice.url = nextUrl;
      choice.approved = true;
      choice.previewLoading = true;
      choice.items = [];
      if (source === 'instagram' && sourceIsProfile(source, nextUrl)) choice.extraOpen = false;
      sourceAuthStatus.textContent = `Scanning your ${choice.name}…`;
      renderSourceSharing();
      updateSourcePreview();
      await refreshPublicSources(source);
    } catch (error) {
      sourceAuthStatus.textContent = error.message || 'Enter a valid public link.';
      input.focus();
    }
  });

  sourceSharing.addEventListener('input', (event) => {
    const input = event.target.closest('[data-source-url]');
    if (!input) return;
    const source = input.dataset.sourceUrl;
    const choice = sourceChoices[source];
    const prefix = input.closest('.source-link-entry')?.querySelector('.source-link-prefix');
    if (prefix) prefix.hidden = /^https?:\/\//i.test(input.value.trim());
    clearTimeout(sourcePreviewTimers.get(source));
    let nextUrl;
    try { nextUrl = sourceInputUrl(source, input.value); } catch (_) {}
    if (nextUrl === choice.url) return;
    choice.url = '';
    choice.approved = false;
    choice.baseShared = false;
    choice.selectedUrls = [];
    choice.options = [];
    choice.nextPage = null;
    choice.items = [];
    choice.previewLoading = Boolean(nextUrl);
    choice.pendingInput = nextUrl;
    sourceAuthStatus.textContent = nextUrl ? `Finding public ${choice.name} choices…` : 'Enter a public profile or item link, then choose what to share.';
    updateSourcePreview();
    if (!nextUrl) return;
    sourcePreviewTimers.set(source, setTimeout(async () => {
      if (!selectedSources.has(source) || choice.pendingInput !== nextUrl) return;
      choice.url = nextUrl;
      choice.approved = true;
      await refreshPublicSources(source);
    }, 650));
  });

  sourceSharing.addEventListener('change', async (event) => {
    const checkbox = event.target.closest('[data-source-choice]');
    if (!checkbox) return;
    const choice = sourceChoices[checkbox.dataset.sourceChoice];
    if (checkbox.checked) {
      if (!choice.selectedUrls.includes(checkbox.value)) choice.selectedUrls.push(checkbox.value);
    } else choice.selectedUrls = choice.selectedUrls.filter((url) => url !== checkbox.value);
    choice.items = [];
    choice.previewLoading = choice.selectedUrls.length > 0;
    sourceAuthStatus.textContent = `Loading ${choice.name} images from your selection…`;
    updateSourcePreview();
    await refreshPublicSources(checkbox.dataset.sourceChoice, false);
  });

  function addLocalPhotos(input) {
    const files = [...input.files].filter((file) => /^(image\/(jpeg|png|webp|gif|avif|heic|heif))$/.test(file.type) && file.size <= 10 * 1024 * 1024);
    if (files.length !== input.files.length) photoSelectionStatus.textContent = 'Some files were skipped. Choose supported images up to 10 MB each.';
    const known = new Set(localPhotoFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    let added = 0;
    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (known.has(key) || localPhotoUrls.length >= 200) continue;
      known.add(key);
      localPhotoFiles.push(file);
      localPhotoUrls.push(URL.createObjectURL(file));
      added++;
    }
    const capped = files.length > added && localPhotoUrls.length >= 200;
    const message = localPhotoUrls.length
      ? `${localPhotoUrls.length} image${localPhotoUrls.length === 1 ? '' : 's'} ready to use in your rings.${capped ? ' This preview holds up to 200 images.' : ''}`
      : 'No images were found in that selection.';
    photoSelectionStatus.textContent = message;
    sourceAuthStatus.textContent = added ? `${added} photo${added === 1 ? '' : 's'} added. You can place them in a ring below.` : message;
    clearPhotos.hidden = !localPhotoUrls.length;
    input.value = '';
    syncSourceButtons();
    updateSourcePreview();
    if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
    document.body.classList.toggle('orbit-empty', !approvedSourceItems().length);
  }

  albumInput.addEventListener('change', () => addLocalPhotos(albumInput));
  folderInput.addEventListener('change', () => addLocalPhotos(folderInput));
  clearPhotos.addEventListener('click', () => {
    localPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    localPhotoUrls = [];
    localPhotoFiles = [];
    photoSelectionStatus.textContent = 'No photos selected yet.';
    sourceAuthStatus.textContent = 'Photos removed from your orbit preview.';
    clearPhotos.hidden = true;
    syncSourceButtons();
    updateSourcePreview();
    if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
    document.body.classList.toggle('orbit-empty', !approvedSourceItems().length);
  });

  birthInputs.forEach((input) => input.addEventListener('input', () => {
    const level = birthInputs.filter((field) => field.value).length;
    constellation.classList.remove('birth-level-1', 'birth-level-2', 'birth-level-3');
    if (level) constellation.classList.add(`birth-level-${level}`);
    scheduleBirthSkyCalculation();
  }));

  constellationPicker.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const placement = chartPlacements.find((item) => item.name === action.dataset.placement);
    if (!placement || !placement.available) return;
    placement.featured = action.dataset.action === 'feature';
    if (placement.featured) {
      if (placement.strength <= 24) placement.strength = 72;
      if (placement.opacity <= 20) placement.opacity = 72;
    } else {
      placement.interactive = false;
    }
    renderBirthSky();
  });

  constellationPicker.addEventListener('input', (event) => {
    const card = event.target.closest('[data-placement-name]');
    const placement = card && chartPlacements.find((item) => item.name === card.dataset.placementName);
    if (!placement || !event.target.dataset.setting) return;
    const setting = event.target.dataset.setting;
    if (setting === 'interactive') {
      placement.interactive = event.target.checked;
      const reveal = card.querySelector('[data-setting="reveal"]');
      if (reveal) reveal.disabled = !placement.interactive;
      const state = card.querySelector('.featured-state');
      if (state) state.textContent = placement.interactive ? 'opens' : 'ambient';
    } else if (setting === 'reveal') {
      placement.reveal = event.target.value;
    } else {
      placement[setting] = Number(event.target.value);
      const output = event.target.previousElementSibling;
      if (output) output.textContent = `${event.target.value}%`;
    }
    updateConstellationPreview();
  });

  constellation.addEventListener('click', (event) => {
    const star = event.target.closest('[data-sky-placement]');
    if (!star) return;
    const placement = chartPlacements.find((item) => item.name === star.dataset.skyPlacement);
    if (!placement || !placement.interactive) return;
    setupHiddenThought.textContent = placement.reveal.trim() || `${placement.name} in ${placement.sign} · ${placementMeanings[placement.name]}`;
    setupHiddenThought.hidden = false;
  });

  hiddenStarChoices.innerHTML = hiddenStarPositions.map((position, index) =>
    `<button class="hidden-star-choice" type="button" aria-pressed="false" aria-label="${position.name} placement, empty" data-hidden-star-position="${index}" style="left:${position.left}%;top:${position.top}%"><span class="hidden-star-choice__halo" aria-hidden="true"></span><span class="hidden-star-choice__core" aria-hidden="true"></span></button>`
  ).join('');

  hiddenStarChoices.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-hidden-star-position]');
    if (!choice) return;
    const starIndex = Number(choice.dataset.hiddenStarPosition);
    const assignedTo = hiddenMessages.findIndex((message) => message.starIndex === starIndex);
    if (assignedTo !== -1 && assignedTo !== activeHiddenMessage) {
      activeHiddenMessage = assignedTo;
    } else {
      hiddenMessages[activeHiddenMessage].starIndex = starIndex;
    }
    renderHiddenMessages();
    setupHiddenThought.textContent = hiddenMessages[activeHiddenMessage].text.trim() || `Message ${activeHiddenMessage + 1} will live here.`;
    setupHiddenThought.hidden = false;
    setupHiddenThought.style.left = `${Math.min(60, hiddenStarPositions[starIndex].left)}%`;
    setupHiddenThought.style.top = `${Math.min(70, hiddenStarPositions[starIndex].top + 6)}%`;
  });

  hiddenStarEnabled.addEventListener('change', () => {
    setupHiddenThought.hidden = true;
    updateHiddenStarSelection();
    if (hiddenStarEnabled.checked) hiddenMessageList.querySelector('textarea')?.focus();
  });

  hiddenMessageList.addEventListener('input', (event) => {
    const textarea = event.target.closest('[data-message-text]');
    if (!textarea) return;
    const index = Number(textarea.dataset.messageText);
    hiddenMessages[index].text = textarea.value;
    if (index === activeHiddenMessage && !setupHiddenThought.hidden) {
      setupHiddenThought.textContent = textarea.value.trim() || `Message ${index + 1} will live here.`;
    }
  });

  hiddenMessageList.addEventListener('focusin', (event) => {
    const textarea = event.target.closest('[data-message-text]');
    if (!textarea) return;
    activeHiddenMessage = Number(textarea.dataset.messageText);
    hiddenMessageList.querySelectorAll('.hidden-message-card').forEach((card, index) => {
      card.classList.toggle('is-active', index === activeHiddenMessage);
      card.querySelector('[data-edit-message]')?.setAttribute('aria-pressed', String(index === activeHiddenMessage));
    });
    updateHiddenStarSelection();
  });

  hiddenMessageList.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-message]');
    if (remove) {
      hiddenMessages.splice(Number(remove.dataset.removeMessage), 1);
      activeHiddenMessage = Math.min(activeHiddenMessage, hiddenMessages.length - 1);
      setupHiddenThought.hidden = true;
      renderHiddenMessages();
      return;
    }
    const edit = event.target.closest('[data-edit-message]');
    if (!edit) return;
    activeHiddenMessage = Number(edit.dataset.editMessage);
    setupHiddenThought.hidden = true;
    renderHiddenMessages();
  });

  addHiddenMessage.addEventListener('click', () => {
    if (hiddenMessages.length >= hiddenStarPositions.length) return;
    hiddenMessages.push({ text: '', starIndex: null });
    activeHiddenMessage = hiddenMessages.length - 1;
    setupHiddenThought.hidden = true;
    renderHiddenMessages();
    hiddenMessageList.querySelector(`[data-message-text="${activeHiddenMessage}"]`)?.focus();
  });

  skyTitleFirst.addEventListener('input', updateSkyTitle);
  skyTitleSecond.addEventListener('input', updateSkyTitle);
  skyBio.addEventListener('input', updateSkyTitle);
  skyTitleSecondColor.addEventListener('input', updateSkyTitle);
  skyTitleSecondColor.addEventListener('change', updateSkyTitle);
  lightUpSpace.addEventListener('change', () => {
    document.body.classList.toggle('orbit-sky-unlit', !lightUpSpace.checked);
  });
  combineSkyWithFriends.addEventListener('change', () => {
    friendSkyPicker.hidden = !combineSkyWithFriends.checked;
    if (combineSkyWithFriends.checked) loadFriendSkies();
    renderSharedSky();
  });
  friendSkyChoices.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    if (checkbox.checked) friendSkyIds.add(checkbox.value);
    else friendSkyIds.delete(checkbox.value);
    renderSharedSky();
  });
  document.getElementById('refreshFriendSkies').addEventListener('click', () => loadFriendSkies(true));
  window.addEventListener('orbiting:following-changed', () => {
    friendSkiesLoaded = false;
    loadFriendSkies(true);
  });
  renderHiddenMessages();
  updateSkyTitle();

  ringBuilder.addEventListener('click', (event) => {
    const move = event.target.closest('[data-move-ring]');
    if (move) {
      const row = move.closest('.ring-row');
      const rows = [...ringBuilder.querySelectorAll('.ring-row')];
      const index = rows.indexOf(row);
      const destination = index + (move.dataset.moveRing === 'up' ? -1 : 1);
      if (destination < 0 || destination >= rows.length) return;
      ringBuilder.insertBefore(row, destination < index ? rows[destination] : rows[destination + 1] || null);
      syncRingRows();
      renderSetupRings();
      if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
      document.getElementById('ringOrderStatus').textContent = `${ringLabel(row)} moved to position ${destination + 1} of ${rows.length}.`;
      (move.disabled ? row.querySelector(`[data-move-ring="${move.dataset.moveRing === 'up' ? 'down' : 'up'}"]`) : move).focus();
      return;
    }
    const remove = event.target.closest('[data-remove-ring]');
    if (remove) {
      const row = remove.closest('.ring-row');
      ringSourceList(row).forEach((source) => excludedRingSources.add(source));
      row?.remove();
      syncRingRows();
      renderSetupRings();
      if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
      return;
    }
    const sourceChoice = event.target.closest('[data-ring-source-choice]');
    if (sourceChoice) {
      const row = sourceChoice.closest('.ring-row');
      const source = sourceChoice.dataset.ringSourceChoice;
      const sources = ringSourceList(row);
      if (sources.includes(source)) excludedRingSources.add(source);
      else {
        excludedRingSources.delete(source);
        [...ringBuilder.querySelectorAll('.ring-row')].filter((other) => other !== row).forEach((other) => {
          const remaining = ringSourceList(other).filter((item) => item !== source);
          other.dataset.ringSources = remaining.join(',');
          if (!remaining.length) other.remove();
        });
      }
      row.dataset.ringSources = (sources.includes(source) ? sources.filter((item) => item !== source) : [...sources, source]).join(',');
      syncRingRows();
      renderSetupRings();
      if (window.HuesOrbit?.setPersonalImages) window.HuesOrbit.setPersonalImages(ringGroups());
      return;
    }
    const option = event.target.closest('[role="radio"]');
    if (!option) return;
    option.parentElement.querySelectorAll('[role="radio"]').forEach((button) => button.setAttribute('aria-checked', String(button === option)));
  });

  ringBuilder.addEventListener('input', () => syncRingLabels());
  ringBuilder.addEventListener('change', () => syncRingLabels());

  const adjustPlanet = document.getElementById('adjustPlanet');
  const wanderControls = document.getElementById('wanderControls');
  function setPlanetControls(open) {
    wanderControls.hidden = !open;
    adjustPlanet.setAttribute('aria-expanded', String(open));
  }
  adjustPlanet.addEventListener('click', () => setPlanetControls(wanderControls.hidden));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.wander-adjust')) setPlanetControls(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !wanderControls.hidden) {
      const hadFocus = wanderControls.contains(document.activeElement);
      setPlanetControls(false);
      if (hadFocus) adjustPlanet.focus();
    }
  });
  function updateWanderSize() {
    const size = Number(wanderSize.value);
    wanderSizeValue.textContent = `${size}%`;
    wanderSize.setAttribute('aria-valuetext', `${size} percent`);
    document.getElementById('explorePlanet').style.setProperty('--wander-size', size / 100);
  }
  wanderSize.addEventListener('input', updateWanderSize);
  updateWanderSize();
  function updateWanderSpeed() {
    const speed = Number(wanderSpeed.value) / 100;
    wanderSpeedValue.textContent = speed === 1 ? 'normal' : `${speed.toFixed(2).replace(/0$/, '')}×`;
    wanderSpeed.setAttribute('aria-valuetext', speed === 1 ? 'normal speed' : `${wanderSpeedValue.textContent} normal speed`);
    window.OrbitingExplore?.setSpeed(speed);
  }
  wanderSpeed.addEventListener('input', updateWanderSpeed);
  updateWanderSpeed();

  addRing.addEventListener('click', () => {
    const sources = availableRingSources();
    if (!sources.length) return;
    const assigned = new Set([...ringBuilder.querySelectorAll('.ring-row')].flatMap(ringSourceList));
    const combined = [...ringBuilder.querySelectorAll('.ring-row')].find((row) => ringSourceList(row).length > 1);
    const source = sources.find(({ value }) => !assigned.has(value))?.value || (combined && ringSourceList(combined).at(-1));
    if (!source) return;
    if (combined && ringSourceList(combined).includes(source)) combined.dataset.ringSources = ringSourceList(combined).filter((item) => item !== source).join(',');
    excludedRingSources.delete(source);
    const row = createRingRow({ sources: [source] });
    syncRingRows();
    renderSetupRings();
    (row.querySelector('.ring-words-field:not([hidden]) input') || row.querySelector('[data-ring-source-choice]'))?.focus();
  });

  document.getElementById('finishSources').addEventListener('click', () => {
    if (settingsMode) document.getElementById('sourceAccordion').open = false;
    else setSourceStage('arrange');
    document.getElementById('sourceRingsTitle').focus();
  });

  sourcePanel.addEventListener('click', (event) => {
    if (event.target.closest('#launchEmptySky')) { showStep(2); return; }
    const go = event.target.closest('[data-source-stage-go]');
    if (!go) return;
    const stage = go.dataset.sourceStageGo;
    setSourceStage(stage);
    if (stage === 'pick') sourcePanel.querySelector('.source-option')?.focus();
    if (stage === 'arrange') document.getElementById('sourceRingsTitle').focus();
  });

  syncRingRows();
  calculateBirthSky();
  showStep(0);
  // Account restoration decides whether setup is needed.

  const hero = document.getElementById('hero');
  const depthControl = document.getElementById('cosmosDepthControl');
  const depthControlText = document.getElementById('cosmosDepthControlText');
  const brandonPlanet = document.getElementById('brandonPlanet');
  const brandonFullOrbit = document.getElementById('brandonFullOrbit');
  const friendPortal = document.getElementById('friendPortal');
  const friendPortalBack = document.getElementById('friendPortalBack');
  const settingsButton = document.getElementById('openOrbitSettings');
  const resourcesButton = document.getElementById('openOrbitResources');
  const resourcesPage = document.getElementById('resourcesPage');
  const resourcesClose = document.getElementById('closeOrbitResources');
  const exploreLayer = document.getElementById('exploreLayer');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cosmosDepth = 0;
  let touchStartY = null;
  let touchStartDepth = 0;
  let brandonNearOrbitBuilt = false;
  let brandonFullOrbitBuilt = false;

  settingsButton.addEventListener('click', () => {
    settingsMode = true;
    window.clearTimeout(setupCloseTimer);
    setupWordmark.textContent = 'Orbit editor';
    setup.setAttribute('aria-label', 'Edit your orbit');
    document.querySelector('.setup-steps').setAttribute('aria-label', 'Edit sections');
    stepButtons[1].querySelector('.op-step-edit').textContent = 'connections';
    document.querySelector('.sky-title-builder p').textContent = 'Give your sky a two-line title. The second line can have its own color.';
    skipButton.textContent = 'save changes';
    setup.inert = false;
    setup.setAttribute('aria-hidden', 'false');
    setup.classList.remove('is-leaving');
    setup.classList.add('is-settings');
    editorHotspots.hidden = false;
    hero.inert = true;
    showStep(0);
    stepButtons[0].focus();
  });

  resourcesButton.addEventListener('click', () => {
    resourcesPage.hidden = false;
    hero.inert = true;
    resourcesClose.focus();
  });

  function closeResources() {
    resourcesPage.hidden = true;
    hero.inert = false;
    resourcesButton.focus();
  }
  resourcesClose.addEventListener('click', closeResources);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !resourcesPage.hidden) closeResources();
  });

  function buildBrandonOrbit(container, near) {
    if (!window.HuesOrbit || !window.BRANDON_ORBIT_DATA) return false;
    const width = container.getBoundingClientRect().width;
    if (!width) return false;
    ['art', 'arena', 'cosmos'].forEach((ring, index) => {
      const images = window.BRANDON_ORBIT_DATA[index];
      const back = container.querySelector(`[data-brandon-ring="${ring}-back"]`);
      const front = container.querySelector(`[data-brandon-ring="${ring}-front"]`);
      window.HuesOrbit.buildRing(
        images, back, front, width * [0.35, 0.52, 0.70][index],
        [[38, 52], [32, 46], [35, 50]][index],
        [[50, 70], [70, 100], [120, 170]][index],
        images, { previewOnly: true, sizeScale: near ? 0.56 : 1 }
      );
    });
    return true;
  }

  function setCosmosDepth(value) {
    const requestedDepth = Math.max(0, Math.min(2, value));
    cosmosDepth = requestedDepth;
    if (hasDemoFriend && cosmosDepth > .08 && !brandonNearOrbitBuilt) {
      brandonNearOrbitBuilt = buildBrandonOrbit(brandonPlanet, true);
    }
    const friendDepth = Math.min(1, cosmosDepth);
    const exploreDepth = Math.max(0, cosmosDepth - 1);
    const exploreFade = Math.min(1, Math.max(0, (exploreDepth - .08) / .82));
    const easedExploreFade = exploreFade * exploreFade * (3 - 2 * exploreFade);
    const closeEnough = cosmosDepth >= .72 && exploreDepth < .6;
    const exploreActive = exploreDepth >= .6;
    // Signed in, you stay at the center and friends turn around you; the demo keeps its side-by-side neighbor.
    const shift = hasDemoFriend ? (window.innerWidth < 680 ? -24 : -23) * friendDepth : 0;
    hero.style.setProperty('--orbit-shift', `${shift}vw`);
    hero.style.setProperty('--orbit-scale', String(1 - friendDepth * (hasDemoFriend ? .58 : .45)));
    hero.style.setProperty('--orbit-camera-opacity', String(1 - easedExploreFade));
    hero.style.setProperty('--orbit-chrome-opacity', String(1 - friendDepth));
    hero.style.setProperty('--friend-opacity', String(Math.max(0, (friendDepth - .12) / .88) * (1 - exploreDepth)));
    hero.style.setProperty('--friend-scale', String(.7 + friendDepth * .3));
    hero.style.setProperty('--cosmos-label-opacity', String(Math.max(0, (friendDepth - .55) / .45) * (1 - exploreDepth)));
    exploreLayer.style.setProperty('--explore-opacity', String(easedExploreFade));
    exploreLayer.classList.toggle('is-active', exploreActive);
    exploreLayer.inert = !exploreActive;
    exploreLayer.setAttribute('aria-hidden', String(!exploreActive));
    document.body.classList.toggle('is-explore', exploreActive);
    window.OrbitingExplore?.setVisible(exploreDepth > .08);
    document.body.classList.toggle('is-cosmos', closeEnough);
    brandonPlanet.tabIndex = closeEnough ? 0 : -1;
    brandonPlanet.setAttribute('aria-hidden', String(!closeEnough));
    depthControlText.textContent = exploreActive ? 'back to friends in the cosmos' : closeEnough ? 'wander farther' : 'pull back into the cosmos';
    depthControl.setAttribute('aria-label', exploreActive ? 'Return to friends in the cosmos' : closeEnough ? 'Pull back to Wander' : 'Pull back into the cosmos');
    window.dispatchEvent(new CustomEvent('orbiting:depth-changed', { detail: { depth: cosmosDepth, active: closeEnough, demo: hasDemoFriend } }));
  }

  function canChangeDepth() {
    return setup.getAttribute('aria-hidden') === 'true' && resourcesPage.hidden && friendPortal.hidden && !document.body.classList.contains('immersive-active');
  }

  hero.addEventListener('wheel', (event) => {
    if (!canChangeDepth() || event.target.closest('.people-search, .wander-controls, .following-cosmos') || (!cosmosDepth && event.deltaY < 0)) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    const step = Math.min(.18, Math.abs(delta) / 650);
    setCosmosDepth(cosmosDepth + (event.deltaY > 0 ? step : -step));
  }, { passive: false });

  hero.addEventListener('touchstart', (event) => {
    if (!canChangeDepth() || event.touches.length !== 1 || event.target.closest('.people-search, .wander-controls, .following-cosmos, button, input, a')) return;
    touchStartY = event.touches[0].clientY;
    touchStartDepth = cosmosDepth;
  }, { passive: true });
  hero.addEventListener('touchmove', (event) => {
    if (touchStartY === null || !canChangeDepth() || event.touches.length !== 1) return;
    const distance = event.touches[0].clientY - touchStartY;
    if (Math.abs(distance) < 8) return;
    event.preventDefault();
    setCosmosDepth(Math.max(touchStartDepth - 1, Math.min(touchStartDepth + 1, touchStartDepth - distance / 360)));
  }, { passive: false });
  hero.addEventListener('touchend', () => { touchStartY = null; });
  depthControl.addEventListener('click', () => setCosmosDepth(cosmosDepth < .72 ? 1 : cosmosDepth < 1.6 ? 2 : 1));
  window.addEventListener('orbiting:open-cosmos', () => { setCosmosDepth(1); depthControl.focus(); });
  if (!hasDemoFriend) document.getElementById('cosmosDepthLabel').textContent = 'friends in the cosmos';

  function closeFriendPortal() {
    friendPortal.hidden = true;
    hero.inert = false;
    document.body.classList.remove('friend-entering');
    document.body.style.overflow = '';
    brandonPlanet.focus();
  }
  brandonPlanet.addEventListener('click', () => {
    if (cosmosDepth < .72 || cosmosDepth > 1.6) return;
    document.body.classList.add('friend-entering');
    window.setTimeout(() => {
      friendPortal.hidden = false;
      if (!brandonFullOrbitBuilt) brandonFullOrbitBuilt = buildBrandonOrbit(brandonFullOrbit, false);
      hero.inert = true;
      document.body.style.overflow = 'hidden';
      friendPortalBack.focus();
    }, reducedMotion.matches ? 0 : 580);
  });
  friendPortalBack.addEventListener('click', closeFriendPortal);
  if (window.OrbitingExplore) {
    window.OrbitingExplore.onEnterSelf = () => setCosmosDepth(0);
    window.OrbitingExplore.onEnterFriend = (item) => {
      setCosmosDepth(1);
      // A followed friend's clipping opens their orbit; the demo's sample clippings open Brandon's world.
      if (item?.personId && window.OrbitingFriends?.open?.(item.personId)) return;
      brandonPlanet.click();
    };
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !friendPortal.hidden) closeFriendPortal();
  });
  brandonPlanet.hidden = !hasDemoFriend;
  setCosmosDepth(sharedWander ? 2 : 0);
})();
