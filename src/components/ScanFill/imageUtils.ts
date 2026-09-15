/**
 * Utilities for client-side image processing:
 * 1. EXIF orientation normalization
 * 2. Max 1600px aspect-ratio preserving downscaling
 * 3. JPEG compression at quality 0.8
 * 4. Base64 encoding
 */

export interface ProcessedImage {
  base64: string; // pure base64 without data URI prefix
  dataUrl: string; // full data URL for preview
  mimeType: string;
  width: number;
  height: number;
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('અમાન્ય ફાઇલ પ્રકાર: કૃપા કરીને ફોટો અપલોડ કરો');
  }

  let imgSource: ImageBitmap | HTMLImageElement;
  let naturalWidth = 0;
  let naturalHeight = 0;

  // Try createImageBitmap with EXIF orientation handling
  if (typeof createImageBitmap === 'function') {
    try {
      imgSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
      naturalWidth = imgSource.width;
      naturalHeight = imgSource.height;
    } catch {
      imgSource = await loadImageElement(file);
      naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
      naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
    }
  } else {
    imgSource = await loadImageElement(file);
    naturalWidth = (imgSource as HTMLImageElement).naturalWidth;
    naturalHeight = (imgSource as HTMLImageElement).naturalHeight;
  }

  // Calculate scaled dimensions (max 1600px)
  const MAX_DIM = 1600;
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

  // Close ImageBitmap if used to release memory
  if ('close' in imgSource && typeof imgSource.close === 'function') {
    imgSource.close();
  }

  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, 0.8);
  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  return {
    base64,
    dataUrl,
    mimeType,
    width: targetWidth,
    height: targetHeight
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('ફોટો લોડ કરવામાં નિષ્ફળ'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('ફાઇલ વાંચવામાં નિષ્ફળ'));
    reader.readAsDataURL(file);
  });
}
