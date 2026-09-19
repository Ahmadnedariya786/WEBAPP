/**
 * nativeSave.ts
 * S49 — APK Download Bridge Utility
 *
 * On Android WebView, blob: URL anchor-clicks are silently ignored.
 * This utility detects the AndroidDownloader bridge and routes
 * downloads through it; on desktop it falls back to the standard approach.
 *
 * TOAST OWNERSHIP (D3):
 *   - On APK (bridge used): Kotlin shows exactly one native Toast.
 *     The JS caller must NOT show an additional success notification.
 *   - On desktop: nativeSave triggers a CustomEvent 'nativeSaveComplete'
 *     that callers listen to (or they check the returned 'bridge' flag).
 *   nativeSave returns: 'bridge' | 'desktop'
 *   Callers show JS toast ONLY when return === 'desktop'.
 *
 * VERBATIM SUCCESS TOAST (both Kotlin and desktop JS):
 *   "ફાઇલ Downloads ફોલ્ડરમાં સાચવી દીધી છે ✅"
 *
 * Usage:
 *   import { nativeSave } from '../lib/nativeSave';
 *   const route = await nativeSave(buf, 'report.xlsx', XLSX_MIME);
 *   if (route === 'desktop') showNotification('ફાઇલ Downloads ફોલ્ડરમાં સાચવી દીધી છે ✅');
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

/** Verbatim success message — used by callers on the desktop path. */
export const NATIVE_SAVE_SUCCESS = 'ફાઇલ Downloads ફોલ્ડરમાં સાચવી દીધી છે ✅';

/**
 * Convert a Uint8Array or ArrayBuffer to a base64 string (no data-URL prefix).
 */
function arrayToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  // Process in chunks to avoid call-stack overflow for large files
  const CHUNK = 8192;
  for (let i = 0; i < len; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
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
 * @param mimeType MIME type string
 * @returns        'bridge' if the Android native bridge was used (Kotlin shows Toast),
 *                 'desktop' if the standard browser download was triggered
 *                 (caller should show JS success notification).
 */
export async function nativeSave(
  data: Blob | Uint8Array | ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<'bridge' | 'desktop'> {
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
  // Kotlin's AndroidDownloader.saveBase64() shows its own Toast; caller must NOT add a second one.
  if (window.AndroidDownloader?.saveBase64) {
    window.AndroidDownloader.saveBase64(
      `data:${mimeType};base64,${base64}`,
      filename,
      mimeType
    );
    return 'bridge';
  }

  // --- MehnatBridge path (future-proof secondary bridge) ---
  if (window.MehnatBridge?.saveFile) {
    window.MehnatBridge.saveFile(base64, filename, mimeType);
    return 'bridge';
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
  return 'desktop';
}
