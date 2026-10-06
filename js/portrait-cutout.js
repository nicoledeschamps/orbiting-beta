// Person segmentation and face framing run in the visitor's browser; the uploaded photo is never sent to us.
const VERSION = '0.10.18';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const SEGMENTER_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';
const SEGMENT_SIZE = 1024;
const OUTPUT_SIZE = 2048;
// Every framed portrait puts the face where the demo portrait's sits: centred
// across, its centre 54% down, the face box 47% of the square crop's width.
// The finished orbit centres the image on the rings, so this keeps faces centred.
const FACE_SHARE = 0.467;
const FACE_CENTER_Y = 0.54;
let visionPromise;
let segmenterPromise;
let faceDetectorPromise;

function retryable(factory) {
  let promise;
  return () => {
    if (!promise) promise = factory().catch((error) => { promise = null; throw error; });
    return promise;
  };
}

const getVision = retryable(async () => {
  const { FilesetResolver, ImageSegmenter, FaceDetector } = await import(`${BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  return { fileset, ImageSegmenter, FaceDetector };
});

const getSegmenter = retryable(async () => {
  const { fileset, ImageSegmenter } = await getVision();
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true
  });
});

const getFaceDetector = retryable(async () => {
  const { fileset, FaceDetector } = await getVision();
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5
  });
});

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the cutout.')), 'image/png');
  });
}

// Square box placing the detected face like the demo, in 0–1 photo coordinates.
// It may reach past the photo's edges; that area stays transparent rather than
// sliding the face off centre.
function frameAroundFace(face, width, height) {
  const side = face.width / FACE_SHARE;
  const left = face.originX + face.width / 2 - side / 2;
  const top = face.originY + face.height / 2 - side * FACE_CENTER_Y;
  return { x: left / width, y: top / height, w: side / width, h: side / height };
}

// No face found (sunglasses, a profile, a hat's shadow, far away): frame the person's outline
// instead, centred, with a little room around it, so the portrait is still centred and sized.
const PERSON_MARGIN = 1.12;
function frameAroundPerson(person, width, height) {
  const side = Math.max(person.width, person.height) * PERSON_MARGIN;
  const left = person.x + person.width / 2 - side / 2;
  const top = person.y + person.height / 2 - side / 2;
  return { x: left / width, y: top / height, w: side / width, h: side / height, byFace: false };
}

// Draw the `box` region (0–1 coordinates, possibly past the edges) of `image` to fill the canvas.
export function drawRegion(context, image, box, width, height) {
  const scaleX = width / (box.w * image.width);
  const scaleY = height / (box.h * image.height);
  context.drawImage(image, -box.x * image.width * scaleX, -box.y * image.height * scaleY, image.width * scaleX, image.height * scaleY);
}

function largestFace(detector, image) {
  return detector.detect(image).detections
    .map((detection) => detection.boundingBox)
    .filter(Boolean)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
}

function tracePolygon(context, points, width, height) {
  context.beginPath();
  points.forEach(({ x, y }, index) => {
    const px = Math.max(0, Math.min(1, x)) * width;
    const py = Math.max(0, Math.min(1, y)) * height;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.closePath();
}

export async function cutOutPortrait(file, onProgress = () => {}) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  onProgress('Reading your photo…');
  const bitmap = await createImageBitmap(file);
  const fullScale = Math.min(1, OUTPUT_SIZE / Math.max(bitmap.width, bitmap.height));
  const full = canvasOf(bitmap.width * fullScale, bitmap.height * fullScale);
  full.getContext('2d').drawImage(bitmap, 0, 0, full.width, full.height);
  bitmap.close();
  const segmentScale = Math.min(1, SEGMENT_SIZE / Math.max(full.width, full.height));
  const source = canvasOf(full.width * segmentScale, full.height * segmentScale);
  source.getContext('2d').drawImage(full, 0, 0, source.width, source.height);

  onProgress('Removing your background… The first one may take a moment.');
  let confidence = null;
  let maskWidth = 0;
  let maskHeight = 0;
  let frame = null;
  const automaticReady = getSegmenter().then((segmenter) => {
    const result = segmenter.segment(source);
    const mask = result.confidenceMasks?.[0];
    if (mask) {
      const values = new Float32Array(mask.getAsFloat32Array());
      if (values.some((value) => value > 0.55)) {
        confidence = values;
        maskWidth = mask.width;
        maskHeight = mask.height;
      }
    }
    result.close();
    return Boolean(confidence);
  }).catch(() => false);
  const framingReady = Promise.all([getFaceDetector(), automaticReady]).then(([detector]) => {
    let face = largestFace(detector, source);
    // The face model sees a 128px image, so faces in full-body photos vanish. Look again at the person's upper body.
    const person = confidence && personBounds();
    if (!face && person) {
      const side = Math.min(person.width, person.height);
      const crop = canvasOf(side, side);
      const left = Math.max(0, person.x + person.width / 2 - side / 2);
      crop.getContext('2d').drawImage(source, left, person.y, side, side, 0, 0, side, side);
      const found = largestFace(detector, crop);
      if (found) face = { originX: found.originX + left, originY: found.originY + person.y, width: found.width, height: found.height };
    }
    frame = face ? { ...frameAroundFace(face, source.width, source.height), byFace: true }
      : person ? frameAroundPerson(person, source.width, source.height) : null;
    return Boolean(frame);
  }).catch(() => false);

  // Bounding box of the segmented person, in source pixels.
  function personBounds() {
    let minX = maskWidth, minY = maskHeight, maxX = -1, maxY = -1;
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        if (confidence[y * maskWidth + x] < 0.5) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    const sx = source.width / maskWidth;
    const sy = source.height / maskHeight;
    return { x: minX * sx, y: minY * sy, width: (maxX - minX + 1) * sx, height: (maxY - minY + 1) * sy };
  }

  function automaticMask(edge) {
    const maskCanvas = canvasOf(maskWidth, maskHeight);
    const maskContext = maskCanvas.getContext('2d');
    const pixels = maskContext.createImageData(maskWidth, maskHeight);
    const threshold = edge / 100;
    for (let i = 0; i < confidence.length; i++) {
      const alpha = Math.max(0, Math.min(1, (confidence[i] - threshold + 0.15) / 0.3));
      pixels.data[i * 4] = 255;
      pixels.data[i * 4 + 1] = 255;
      pixels.data[i * 4 + 2] = 255;
      pixels.data[i * 4 + 3] = Math.round(alpha * 255);
    }
    maskContext.putImageData(pixels, 0, 0);
    return maskCanvas;
  }

  // edits: [{ mode: 'keep' | 'erase' | 'restore', points: [{ x, y }] }] in 0–1 photo coordinates.
  function buildMask(removeBackground, edge, edits) {
    const mask = canvasOf(full.width, full.height);
    const context = mask.getContext('2d');
    context.imageSmoothingEnabled = true;
    if (removeBackground && confidence) context.drawImage(automaticMask(edge), 0, 0, mask.width, mask.height);
    else { context.fillStyle = '#fff'; context.fillRect(0, 0, mask.width, mask.height); }
    context.fillStyle = '#fff';
    for (const { mode, points } of edits) {
      if (!Array.isArray(points) || points.length < 3) continue;
      context.globalCompositeOperation = mode === 'keep' ? 'destination-in' : mode === 'erase' ? 'destination-out' : 'source-over';
      tracePolygon(context, points, mask.width, mask.height);
      context.fill();
    }
    return mask;
  }

  async function render({ removeBackground = true, edge = 45, edits = [], framed = false } = {}) {
    const output = canvasOf(full.width, full.height);
    const context = output.getContext('2d');
    context.drawImage(full, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(buildMask(removeBackground, edge, edits), 0, 0);
    if (!framed || !frame) return URL.createObjectURL(await canvasBlob(output));
    const crop = canvasOf(frame.w * full.width, frame.h * full.height);
    drawRegion(crop.getContext('2d'), output, frame, crop.width, crop.height);
    return URL.createObjectURL(await canvasBlob(crop));
  }

  return {
    render,
    drawRegion,
    automaticReady,
    framingReady,
    original: full,
    get automaticAvailable() { return Boolean(confidence); },
    get frame() { return frame; }
  };
}
