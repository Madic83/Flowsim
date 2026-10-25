const tileCanvasCache = new Map();

export function isOpenStreetMapWaterColor(red, green, blue) {
  const waterFill = { red: 170, green: 211, blue: 223 };
  return Math.abs(red - waterFill.red) <= 24 &&
    Math.abs(green - waterFill.green) <= 24 &&
    Math.abs(blue - waterFill.blue) <= 24 &&
    blue - green >= 3;
}

async function getTileCanvas(src, fetchImpl) {
  if (tileCanvasCache.has(src)) return tileCanvasCache.get(src);
  const response = await fetchImpl(src, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('Kartplattan kunde inte läsas.');
  const imageBitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(imageBitmap, 0, 0);
  imageBitmap.close();
  tileCanvasCache.set(src, canvas);
  if (tileCanvasCache.size > 24) tileCanvasCache.delete(tileCanvasCache.keys().next().value);
  return canvas;
}

export async function checkOpenStreetMapTileColor(map, latlng, fetchImpl = fetch) {
  try {
    const container = map.getContainer();
    const containerRect = container.getBoundingClientRect();
    const point = map.latLngToContainerPoint(latlng);
    const clientX = containerRect.left + point.x;
    const clientY = containerRect.top + point.y;
    const tile = [...container.querySelectorAll('img.leaflet-tile')].find(image => {
      const rect = image.getBoundingClientRect();
      return image.complete && image.naturalWidth > 0 && clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom;
    });
    if (!tile) return null;

    const canvas = await getTileCanvas(tile.currentSrc || tile.src, fetchImpl);
    const rect = tile.getBoundingClientRect();
    const centerX = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const centerY = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    const startX = Math.max(0, centerX - 3);
    const startY = Math.max(0, centerY - 3);
    const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(
      startX,
      startY,
      Math.min(7, canvas.width - startX),
      Math.min(7, canvas.height - startY)
    ).data;
    let waterPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 200 && isOpenStreetMapWaterColor(pixels[index], pixels[index + 1], pixels[index + 2])) {
        waterPixels += 1;
      }
    }
    return waterPixels >= 8;
  } catch {
    return null;
  }
}