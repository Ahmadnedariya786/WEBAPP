/**
 * Utilities for client-side image processing:
 * 1. EXIF orientation normalization
 * 2. Max 1200px aspect-ratio preserving downscaling
 * 3. JPEG compression at quality 0.75 via async canvas.toBlob()
 * 4. Base64 encoding via FileReader
 */

export class UnsupportedFormatError extends Error {
  readonly isFormatError = true;
  constructor(message = 'ફોટો ફોર્મેટ સપોર્ટેડ નથી') {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export interface ProcessedImage {
  base64: string; // pure base64 without data URI prefix
  dataUrl: string; // full data URL for preview
  canvas: HTMLCanvasElement;
  mimeType: string;
  width: number;
  height: number;
  durationMs?: number;
  sizeKb?: number;
}

export async function processImageFile(file: File, source?: 'camera' | 'gallery'): Promise<ProcessedImage> {
  const startTime = performance.now();

  const isHeic = /\.(heic|heif)$/i.test(file.name) || (file.type && (file.type.includes('heic') || file.type.includes('heif')));

  if (file.type && !file.type.startsWith('image/') && !isHeic) {
    throw new UnsupportedFormatError('ફોટો ફોર્મેટ સપોર્ટેડ નથી');
  }

  let imgSource: ImageBitmap | HTMLImageElement;
  let naturalWidth = 0;
  let naturalHeight = 0;

  // D2 & D5: Detect createImageBitmap in window
  const hasCreateImageBitmap = typeof window !== 'undefined' && 'createImageBitmap' in window;

  try {
    if (hasCreateImageBitmap) {
      try {
        // Primary: imageOrientation 'from-image' for EXIF normalization
        imgSource = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
        naturalWidth = imgSource.width;
        naturalHeight = imgSource.height;
      } catch {
        // Retry createImageBitmap without options
        try {
          imgSource = await window.createImageBitmap(file);
          naturalWidth = imgSource.width;
          naturalHeight = imgSource.height;
        } catch {
          // Fallback to Image() path (HEIC/unsupported format or broken bitmap)
          imgSource = await loadImageElement(file);
          naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
          naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
        }
      }
    } else {
      imgSource = await loadImageElement(file);
      naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
      naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
    }
  } catch {
    // Decoding failed (e.g. unsupported HEIC, corrupt file, invalid image)
    throw new UnsupportedFormatError('ફોટો ફોર્મેટ સપોર્ટેડ નથી');
  }

  if (!naturalWidth || !naturalHeight) {
    throw new UnsupportedFormatError('ફોટો ફોર્મેટ સપોર્ટેડ નથી');
  }

  // F3: OCR PREPROCESSING FOR PRINT:
  // Replace the 1600px downscale with: grayscale convert, Otsu binarization,
  // then UPSCALE so median text height is 30-40px (about 2-3x for A4 photos)
  // For standard A4 documents, ~45-50 lines means a document height of ~1800-2000px yields 30-40px line/character height.
  let scale = 1.0;
  if (naturalHeight < 1100) {
    scale = 2.4; // 2-3x upscale for small mobile camera captures
  } else if (naturalHeight < 1600) {
    scale = 1800 / naturalHeight; // target ~1800px height so text is ~35px
  } else if (naturalHeight > 2200) {
    scale = 2000 / naturalHeight; // normalize oversized captures to ~2000px
  } else {
    scale = 1.0;
  }

  const targetWidth = Math.round(naturalWidth * scale);
  const targetHeight = Math.round(naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas context could not be created');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imgSource, 0, 0, targetWidth, targetHeight);

  // Apply Grayscale + Otsu binarization for clean print text recognition
  applyOtsuBinarization(canvas);

  // Close ImageBitmap if used to release memory promptly
  if ('close' in imgSource && typeof imgSource.close === 'function') {
    imgSource.close();
  }

  const mimeType = 'image/jpeg';

  // D2: Async canvas.toBlob() (0.75 quality) + FileReader.readAsDataURL — NEVER canvas.toDataURL()
  let quality = 0.75;
  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });

  // D3 Assert outgoing payload < 400KB: base64 string overhead is ~4/3 of blob size
  // 400KB payload limit = ~300KB blob limit. If exceeding, adaptively reduce quality.
  while (blob.size > 295 * 1024 && quality > 0.4) {
    quality -= 0.08;
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        },
        mimeType,
        quality
      );
    });
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ફાઇલ વાંચવામાં નિષ્ફળ'));
    reader.readAsDataURL(blob);
  });

  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  const durationMs = Math.round(performance.now() - startTime);
  const payloadBytes = base64.length;
  const payloadKb = Math.round(payloadBytes / 1024);

  // D3: Log size in dev
  if (import.meta.env.DEV) {
    console.log(`[ScanPath] ${source || 'image'} | payload ${payloadKb} KB`);
    console.log(`[ScanPayload] Outgoing payload size: ${payloadKb} KB (< 400KB: ${payloadBytes < 400 * 1024}) in ${durationMs}ms`);
  }

  return {
    base64,
    dataUrl,
    canvas,
    mimeType,
    width: targetWidth,
    height: targetHeight,
    durationMs,
    sizeKb: payloadKb
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ફોટો લોડ કરવામાં નિષ્ફળ'));
    };
    img.src = url;
  });
}

/**
 * F3. Otsu binarization algorithm:
 * Converts canvas to high-contrast pure black and white.
 * Maximizes inter-class variance between background paper and foreground ink/text.
 */
export function applyOtsuBinarization(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const numPixels = width * height;

  const histogram = new Int32Array(256);
  const grayArray = new Uint8Array(numPixels);
  let totalSum = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    grayArray[i] = gray;
    histogram[gray]++;
    totalSum += gray;
  }

  let weightBackground = 0;
  let sumBackground = 0;
  let maxVariance = 0;
  let optimalThreshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = numPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (totalSum - sumBackground) / weightForeground;
    const diff = meanBackground - meanForeground;
    const variance = weightBackground * weightForeground * diff * diff;

    if (variance > maxVariance) {
      maxVariance = variance;
      optimalThreshold = t;
    }
  }

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const val = grayArray[i] < optimalThreshold ? 0 : 255;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

