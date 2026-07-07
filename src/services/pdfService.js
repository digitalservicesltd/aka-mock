import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Convert a PDF file (ArrayBuffer) into an array of image Blobs (one per page).
 * Processes pages sequentially to avoid memory issues on large PDFs.
 *
 * @param {ArrayBuffer} fileArrayBuffer - The PDF file as an ArrayBuffer
 * @param {Function} onProgress - Callback: ({ currentPage, totalPages, status })
 * @returns {Promise<Blob[]>} Array of PNG Blobs, one per page
 */
export async function parsePDF(fileArrayBuffer, onProgress = () => {}) {
  const pdf = await pdfjsLib.getDocument({ data: fileArrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pageBlobs = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress({
      currentPage: pageNum,
      totalPages,
      status: 'rendering',
    });

    try {
      const page = await pdf.getPage(pageNum);
      const scale = 2.0; // 2x for better OCR quality
      const viewport = page.getViewport({ scale });

      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert canvas to Blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Failed to create blob for page ${pageNum}`));
          },
          'image/png',
          0.95
        );
      });

      pageBlobs.push(blob);

      // Clean up canvas
      canvas.width = 0;
      canvas.height = 0;

      onProgress({
        currentPage: pageNum,
        totalPages,
        status: 'done',
      });
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      // Push null for failed pages so we maintain page numbering
      pageBlobs.push(null);
      onProgress({
        currentPage: pageNum,
        totalPages,
        status: 'error',
        error: err.message,
      });
    }
  }

  return pageBlobs.filter(Boolean); // Remove null entries
}

/**
 * Read a file input as ArrayBuffer
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read a file input as data URL (for images)
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
