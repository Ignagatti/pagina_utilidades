let libheifModule = null;

async function getHeifDecoderClass() {
  if (!libheifModule) {
    try {

      const mod = await import('libheif-js/wasm-bundle.js');
      libheifModule = mod?.default || mod;
    } catch (e) {
      console.warn('Fallo al cargar libheif-js/wasm-bundle.js, intentando libheif-js:', e);
      try {
        const mod = await import('libheif-js');
        libheifModule = mod?.default || mod;
      } catch (err2) {
        console.error('No se pudo cargar libheif:', err2);
      }
    }
  }

  let mod = libheifModule;
  if (mod?.HeifDecoder) return mod.HeifDecoder;
  if (mod?.default?.HeifDecoder) return mod.default.HeifDecoder;
  if (typeof mod === 'function') {
    try {
      const res = mod();
      if (res?.HeifDecoder) return res.HeifDecoder;
    } catch (_) {}
  }
  if (typeof mod?.default === 'function') {
    try {
      const res = mod.default();
      if (res?.HeifDecoder) return res.HeifDecoder;
    } catch (_) {}
  }
  return null;
}

export function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic|heif|tiff?|ico)$/i.test(file.name || '');
}

export function isHeicFile(file) {
  if (!file) return false;
  const name = file.name || '';
  const type = file.type || '';
  return /\.(heic|heif)$/i.test(name) || type === 'image/heic' || type === 'image/heif';
}

async function decodeHeicToJpegBlob(file) {
  const buffer = await file.arrayBuffer();

  const HeifDecoderClass = await getHeifDecoderClass();
  if (!HeifDecoderClass) {
    throw new Error('Motor de decodificación HEIC no disponible.');
  }

  const decoder = new HeifDecoderClass();
  const data = decoder.decode(new Uint8Array(buffer));

  if (!data || data.length === 0) {
    throw new Error('No se pudo encontrar ninguna pista de imagen en el archivo HEIC.');
  }

  const image = data[0];
  const width = image.get_width();
  const height = image.get_height();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  await new Promise((resolve, reject) => {
    image.display(imageData, (displayData) => {
      if (!displayData) {
        return reject(new Error('Fallo al extraer píxeles del archivo HEIC'));
      }
      resolve();
    });
  });

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Error al convertir canvas HEIC a JPEG'));
    }, 'image/jpeg', 0.95);
  });
}

export async function normalizeImageFile(file) {
  if (!file) throw new Error('No se especificó un archivo');

  if (isHeicFile(file)) {
    try {
      const convertedBlob = await decodeHeicToJpegBlob(file);
      const cleanName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

      const normalizedFile = new File([convertedBlob], cleanName, { type: 'image/jpeg' });
      const url = URL.createObjectURL(normalizedFile);

      return {
        file: normalizedFile,
        url,
        isConvertedFromHeic: true,
        originalName: file.name
      };
    } catch (err) {
      console.error('Error detallado al decodificar HEIC con libheif:', err);
      throw new Error(`No se pudo decodificar la foto HEIC: ${err.message || 'Formato incompatible'}`);
    }
  }

  const url = URL.createObjectURL(file);
  return {
    file,
    url,
    isConvertedFromHeic: false,
    originalName: file.name
  };
}
