/**
 * Utilities for client-side image processing:
 * 1. EXIF orientation normalization
 * 2. Max 1200px aspect-ratio preserving downscaling
 * 3. JPEG compression at quality 0.75 via async canvas.toBlob()
 * 4. Base64 encoding via FileReader
 */

export interface ProcessedImage {
  base64: string; // pure base64 without data URI prefix
  dataUrl: string; // full data URL for preview
  mimeType: string;
  width: number;
  height: number;
  durationMs?: number;
  sizeKb?: number;
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  const startTime = performance.now();

  if (!file.type.startsWith('image/')) {
    throw new Error('અમાન્ય ફાઇલ પ્રકાર: કૃપા કરીને ફોટો અપલોડ કરો');
  }

  let imgSource: ImageBitmap | HTMLImageElement;
  let naturalWidth = 0;
  let naturalHeight = 0;

  // D2 & D5: Detect createImageBitmap in window
  const hasCreateImageBitmap = typeof window !== 'undefined' && 'createImageBitmap' in window;

  if (hasCreateImageBitmap) {
    try {
      // Primary: imageOrientation 'from-image' for EXIF normalization
      imgSource = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
      naturalWidth = imgSource.width;
      naturalHeight = imgSource.height;
    } catch {
      // N2: On TypeError (older Safari) retry createImageBitmap without options
      try {
        imgSource = await window.createImageBitmap(file);
        naturalWidth = imgSource.width;
        naturalHeight = imgSource.height;
      } catch {
        // Fallback to Image() path
        imgSource = await loadImageElement(file);
        naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
        naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
      }
    }
  } else {
    // D5: Fallback for older browsers
    imgSource = await loadImageElement(file);
    naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
    naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
  }

  // D2: Reduce MAX_DIM from 1600 to 1200px
  const MAX_DIM = 1200;
  const longest = Math.max(naturalWidth, naturalHeight);
  const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
  const targetWidth = Math.round(naturalWidth * scale);
  const targetHeight = Math.round(naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context could not be created');
  }

  ctx.drawImage(imgSource, 0, 0, targetWidth, targetHeight);

  // Close ImageBitmap if used to release memory promptly
  if ('close' in imgSource && typeof imgSource.close === 'function') {
    imgSource.close();
  }

  const mimeType = 'image/jpeg';

  // D2: Async canvas.toBlob() (0.75 quality) + FileReader.readAsDataURL — NEVER canvas.toDataURL()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      0.75
    );
  });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ફાઇલ વાંચવામાં નિષ્ફળ'));
    reader.readAsDataURL(blob);
  });

  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  const durationMs = Math.round(performance.now() - startTime);
  const sizeKb = Math.round((base64.length * 3) / 4 / 1024);

  return {
    base64,
    dataUrl,
    mimeType,
    width: targetWidth,
    height: targetHeight,
    durationMs,
    sizeKb
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
