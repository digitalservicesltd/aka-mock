import { createWorker } from 'tesseract.js';

/**
 * Run OCR on an array of image Blobs using tesseract.js.
 * Processes images sequentially to avoid browser freeze.
 *
 * @param {(Blob|File|string)[]} images - Array of image Blobs, Files, or data URLs
 * @param {Function} onProgress - Callback: ({ currentImage, totalImages, pageText, status, ocrProgress })
 * @returns {Promise<Array<{ pageIndex: number, text: string }>>}
 */
export async function runOCR(images, onProgress = () => {}) {
  if (!images || images.length === 0) {
    return [];
  }

  const totalImages = images.length;
  const results = [];

  let worker = null;

  try {
    onProgress({
      currentImage: 0,
      totalImages,
      status: 'initializing',
      ocrProgress: 0,
    });

    // Create worker
    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({
            currentImage: results.length + 1,
            totalImages,
            status: 'recognizing',
            ocrProgress: Math.round(m.progress * 100),
          });
        }
      },
    });

    for (let i = 0; i < totalImages; i++) {
      onProgress({
        currentImage: i + 1,
        totalImages,
        status: 'processing',
        ocrProgress: 0,
      });

      try {
        const ret = await worker.recognize(images[i]);
        const text = ret.data.text || '';

        results.push({
          pageIndex: i,
          text: text.trim(),
        });

        onProgress({
          currentImage: i + 1,
          totalImages,
          status: 'done',
          ocrProgress: 100,
          pageText: text.trim(),
        });
      } catch (err) {
        console.error(`OCR error on image ${i + 1}:`, err);
        results.push({
          pageIndex: i,
          text: '',
          error: err.message,
        });

        onProgress({
          currentImage: i + 1,
          totalImages,
          status: 'error',
          ocrProgress: 0,
          error: err.message,
        });
      }
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }
  }

  return results;
}

/**
 * Combine OCR results into a single text string
 * @param {Array<{ pageIndex: number, text: string }>} ocrResults
 * @returns {string}
 */
export function combineOCRText(ocrResults) {
  return ocrResults
    .filter((r) => r.text)
    .map((r) => r.text)
    .join('\n\n--- Page Break ---\n\n');
}
