/**
 * Nuvexa - Codificador Binario de Archivos .ICO (Windows Icon & Favicon)
 * Genera archivos .ico multi-resolución válidos (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
 * compatibles con Windows Vista/7/8/10/11 y todos los navegadores web modernos.
 * 
 * Procesamiento 100% en memoria en el cliente sin servidores.
 */

/**
 * Convierte un elemento canvas a un ArrayBuffer PNG
 * @param {HTMLCanvasElement} canvas 
 * @returns {Promise<ArrayBuffer>}
 */
async function canvasToPngBuffer(canvas) {
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('No se pudo generar el buffer PNG.');
  return await blob.arrayBuffer();
}

/**
 * Escala una imagen o canvas origen a una dimensión cuadrada específica con suavizado de alta calidad
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} source 
 * @param {number} size 
 * @returns {HTMLCanvasElement}
 */
export function scaleToSquareCanvas(source, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Calcular encaje proporcional centrado (contain) con fondo transparente
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

/**
 * Genera un archivo binario .ICO a partir de un Canvas o Imagen
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage 
 * @param {number[]} sizes Lista de resoluciones a incluir (ej: [16, 32, 48, 64, 128, 256])
 * @returns {Promise<Blob>} Blob con el archivo .ico
 */
export async function createIcoBlob(sourceImage, sizes = [16, 32, 48, 64, 128, 256]) {
  if (!sizes || sizes.length === 0) {
    sizes = [16, 32, 48, 64, 128, 256];
  }

  // Ordenar tamaños de menor a mayor
  const sortedSizes = [...new Set(sizes)].sort((a, b) => a - b);
  const imageBuffers = [];

  // Renderizar cada resolución y obtener su buffer PNG
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

  // Calcular tamaño total del archivo .ico
  let totalIcoBytes = currentOffset;
  for (const img of imageBuffers) {
    totalIcoBytes += img.byteLength;
  }

  const icoBuffer = new ArrayBuffer(totalIcoBytes);
  const dataView = new DataView(icoBuffer);
  const uint8View = new Uint8Array(icoBuffer);

  // 1. Cabecera ICO (ICONDIR - 6 bytes)
  dataView.setUint16(0, 0, true);          // idReserved (debe ser 0)
  dataView.setUint16(2, 1, true);          // idType (1 para .ICO)
  dataView.setUint16(4, numImages, true);  // idCount (número de imágenes)

  // 2. Entradas de Directorio (ICONDIRENTRY - 16 bytes por imagen)
  for (let i = 0; i < numImages; i++) {
    const img = imageBuffers[i];
    const entryOffset = headerSize + (i * directoryEntrySize);

    // bWidth y bHeight: 0 representa 256 píxeles en el estándar ICO
    const widthByte = img.size >= 256 ? 0 : img.size;
    const heightByte = img.size >= 256 ? 0 : img.size;

    dataView.setUint8(entryOffset + 0, widthByte);        // bWidth
    dataView.setUint8(entryOffset + 1, heightByte);       // bHeight
    dataView.setUint8(entryOffset + 2, 0);                // bColorCount (0 para >= 8bpp)
    dataView.setUint8(entryOffset + 3, 0);                // bReserved (debe ser 0)
    dataView.setUint16(entryOffset + 4, 1, true);         // wPlanes (1)
    dataView.setUint16(entryOffset + 6, 32, true);        // wBitCount (32 bits RGBA)
    dataView.setUint32(entryOffset + 8, img.byteLength, true); // dwBytesInRes
    dataView.setUint32(entryOffset + 12, currentOffset, true); // dwImageOffset

    // Copiar los bytes del PNG en la posición de currentOffset
    uint8View.set(new Uint8Array(img.buffer), currentOffset);
    currentOffset += img.byteLength;
  }

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}
