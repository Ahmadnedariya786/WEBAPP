/**
 * nativeSave.ts
 * S49 — APK Download Bridge Utility
 *
 * On Android WebView, blob: URL anchor-clicks are silently ignored.
 * This utility detects the MehnatBridge (AndroidDownloader) and routes
 * downloads through it; on desktop it falls back to the standard approach.
 *
 * Usage:
 *   import { nativeSave } from '../lib/nativeSave';
 *   nativeSave(blobOrUint8Array, 'filename.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 */

declare global {
  interface Window {
    AndroidDownloader?: {
      saveBase64: (base64Data: string, filename: string, mimeType: string) => void;
    };
    MehnatBridge?: {
      saveFile: (base64: string, fileName: string, mimeType: string) => string;
    };
  }
}

/**
 * Convert a Uint8Array or ArrayBuffer to a base64 string (no data-URL prefix).
 */
function arrayToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Read a Blob as an ArrayBuffer (Promise-based).
 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * nativeSave — save a file using the best available mechanism.
 *
 * @param data     Blob, Uint8Array, or ArrayBuffer containing the file bytes
 * @param filename Desired file name (e.g. "report_2025.xlsx")
 * @param mimeType MIME type string (e.g. "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
 * @returns        Promise<void> — resolves when the save has been initiated/completed
 */
export async function nativeSave(
  data: Blob | Uint8Array | ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<void> {
  // Normalise to Uint8Array
  let bytes: Uint8Array;
  if (data instanceof Blob) {
    const ab = await blobToArrayBuffer(data);
    bytes = new Uint8Array(ab);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }

  const base64 = arrayToBase64(bytes);

  // --- Android APK path (preferred bridge) ---
  if (window.AndroidDownloader?.saveBase64) {
    // Pass as data-URL so the Kotlin side can strip the prefix safely
    window.AndroidDownloader.saveBase64(
      `data:${mimeType};base64,${base64}`,
      filename,
      mimeType
    );
    return;
  }

  // --- MehnatBridge path (future-proof secondary bridge) ---
  if (window.MehnatBridge?.saveFile) {
    window.MehnatBridge.saveFile(base64, filename, mimeType);
    return;
  }

  // --- Desktop / standard browser path ---
  // In browser context the underlying buffer is always a plain ArrayBuffer; cast to satisfy TS strict lib.
  const blobBuffer = bytes.buffer.slice(
    bytes.byteOffset, bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const blob = data instanceof Blob ? data : new Blob([blobBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Delay revoke so the browser has time to start the download
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}
