async function canvasToPngBuffer(canvas) {
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('No se pudo generar el buffer PNG.');
  return await blob.arrayBuffer();
}

export function scaleToSquareCanvas(source, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let sWidth = source.width || source.videoWidth || size;
  let sHeight = source.height || source.videoHeight || size;

  let dWidth = size;
  let dHeight = size;
  let dx = 0;
  let dy = 0;

  if (sWidth > sHeight) {
    dHeight = Math.round((sHeight / sWidth) * size);
    dy = Math.round((size - dHeight) / 2);
  } else if (sHeight > sWidth) {
    dWidth = Math.round((sWidth / sHeight) * size);
    dx = Math.round((size - dWidth) / 2);
  }

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source, dx, dy, dWidth, dHeight);

  return canvas;
}

export async function createIcoBlob(sourceImage, sizes = [16, 32, 48, 64, 128, 256]) {
  if (!sizes || sizes.length === 0) {
    sizes = [16, 32, 48, 64, 128, 256];
  }

  const sortedSizes = [...new Set(sizes)].sort((a, b) => a - b);
  const imageBuffers = [];

  for (const size of sortedSizes) {
    const resizedCanvas = scaleToSquareCanvas(sourceImage, size);
    const buffer = await canvasToPngBuffer(resizedCanvas);
    imageBuffers.push({
      size,
      buffer,
      byteLength: buffer.byteLength
    });
  }

  const numImages = imageBuffers.length;
  const headerSize = 6;
  const directoryEntrySize = 16;
  const totalDirectorySize = numImages * directoryEntrySize;
  let currentOffset = headerSize + totalDirectorySize;

  let totalIcoBytes = currentOffset;
  for (const img of imageBuffers) {
    totalIcoBytes += img.byteLength;
  }

  const icoBuffer = new ArrayBuffer(totalIcoBytes);
  const dataView = new DataView(icoBuffer);
  const uint8View = new Uint8Array(icoBuffer);

  dataView.setUint16(0, 0, true);
  dataView.setUint16(2, 1, true);
  dataView.setUint16(4, numImages, true);

  for (let i = 0; i < numImages; i++) {
    const img = imageBuffers[i];
    const entryOffset = headerSize + (i * directoryEntrySize);

    const widthByte = img.size >= 256 ? 0 : img.size;
    const heightByte = img.size >= 256 ? 0 : img.size;

    dataView.setUint8(entryOffset + 0, widthByte);
    dataView.setUint8(entryOffset + 1, heightByte);
    dataView.setUint8(entryOffset + 2, 0);
    dataView.setUint8(entryOffset + 3, 0);
    dataView.setUint16(entryOffset + 4, 1, true);
    dataView.setUint16(entryOffset + 6, 32, true);
    dataView.setUint32(entryOffset + 8, img.byteLength, true);
    dataView.setUint32(entryOffset + 12, currentOffset, true);

    uint8View.set(new Uint8Array(img.buffer), currentOffset);
    currentOffset += img.byteLength;
  }

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}
