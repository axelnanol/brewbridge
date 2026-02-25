import QRCode from 'qrcode';

/**
 * Renders a QR code for the given URL into a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {string} url
 */
export async function renderQR(canvas, url) {
  await QRCode.toCanvas(canvas, url, { width: 220, margin: 2 });
}
