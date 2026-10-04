// Person segmentation runs in the visitor's browser; the uploaded photo is never sent to us.
const VERSION = '0.10.18';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
let segmenterPromise;

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(`${BASE}/vision_bundle.mjs`);
      const vision = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true
      });
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the cutout.')), 'image/png');
  });
}

export async function cutOutPortrait(file, onProgress = () => {}) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  onProgress('Reading your photo…');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const source = document.createElement('canvas');
  source.width = Math.max(1, Math.round(bitmap.width * scale));
  source.height = Math.max(1, Math.round(bitmap.height * scale));
  source.getContext('2d').drawImage(bitmap, 0, 0, source.width, source.height);
  bitmap.close();

  onProgress('Finding your outline… The first cutout may take a moment.');
  let confidence = null;
  let maskWidth = 0;
  let maskHeight = 0;
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

  async function render(edge = 45) {
    if (!confidence) throw new Error('Automatic cutout is unavailable for this photo.');
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
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
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d');
    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.imageSmoothingEnabled = true;
    context.drawImage(maskCanvas, 0, 0, output.width, output.height);
    return URL.createObjectURL(await canvasBlob(output));
  }

  // Cut It Out's freehand lasso approach, applied as a portrait alpha mask.
  async function renderLasso(points, edge = 45, refineAutomatically = false) {
    if (!Array.isArray(points) || points.length < 3) throw new Error('Draw a complete outline first.');
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = source.width;
    maskCanvas.height = source.height;
    const maskContext = maskCanvas.getContext('2d');
    maskContext.fillStyle = '#fff';
    maskContext.beginPath();
    points.forEach(({ x, y }, index) => {
      const px = Math.max(0, Math.min(1, x)) * source.width;
      const py = Math.max(0, Math.min(1, y)) * source.height;
      if (index === 0) maskContext.moveTo(px, py);
      else maskContext.lineTo(px, py);
    });
    maskContext.closePath();
    maskContext.fill();
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d');
    context.drawImage(source, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.filter = `blur(${Math.max(.5, (80 - edge) / 25)}px)`;
    context.drawImage(maskCanvas, 0, 0);
    if (refineAutomatically) {
      if (!confidence) throw new Error('Automatic refinement is not ready. Use the drawn outline or try again.');
      const automaticUrl = await render(edge);
      try {
        const bitmap = await createImageBitmap(await (await fetch(automaticUrl)).blob());
        context.filter = 'none';
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
      } finally { URL.revokeObjectURL(automaticUrl); }
    }
    return URL.createObjectURL(await canvasBlob(output));
  }

  return { render, renderLasso, get automaticAvailable() { return Boolean(confidence); }, automaticReady };
}
