/**
 * Utilidades de Seguridad y Sanitización (OWASP Top 10)
 */

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB máximo

/**
 * Sanitiza y valida entradas para el generador de QR
 * Previene Cross-Site Scripting (XSS) y esquemas maliciosos
 */
export function sanitizeQRInput(type, rawData) {
  if (type === 'url') {
    const trimmed = (rawData || '').trim();
    if (!trimmed) return 'https://google.com';

    // Bloquear esquemas peligrosos como javascript:, data:, vbscript:
    const dangerousSchemes = /^([a-z0-9+.-]+):/i;
    const match = trimmed.match(dangerousSchemes);
    if (match) {
      const scheme = match[1].toLowerCase();
      if (!['http', 'https'].includes(scheme)) {
        throw new Error(`Esquema '${scheme}:' no permitido por motivos de seguridad. Usa http o https.`);
      }
    }

    try {
      const normalizedUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      
      const parsed = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Solo se permiten enlaces con protocolo HTTP o HTTPS.');
      }
      return parsed.toString();
    } catch (e) {
      throw new Error(e.message || 'La dirección URL introducida no es válida.');
    }
  }

  if (type === 'wifi') {
    const { ssid, pass, enc, hidden } = rawData;
    // Escapar caracteres especiales según la especificación de códigos QR Wi-Fi
    const escapeWifi = (str) => (str || '').replace(/([\\;,:"])/g, '\\$1');
    const safeSsid = escapeWifi(ssid.trim().slice(0, 64));
    const safePass = escapeWifi(pass.slice(0, 64));
    const safeEnc = ['WPA', 'WEP', 'nopass'].includes(enc) ? enc : 'WPA';
    const isHidden = Boolean(hidden);

    return `WIFI:T:${safeEnc};S:${safeSsid};P:${safePass};H:${isHidden};;`;
  }

  if (type === 'whatsapp') {
    const { phone, msg } = rawData;
    // Solo permitir dígitos y longitud estándar internacional (7 a 15 números)
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '').slice(0, 15);
    const cleanMsg = encodeURIComponent((msg || '').trim().slice(0, 500));
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${cleanMsg}` : 'https://wa.me/';
  }

  if (type === 'text') {
    // Truncar a un máximo de 1200 caracteres para evitar ataques de denegación de servicio por memoria
    return (rawData || '').slice(0, 1200);
  }

  if (type === 'contact') {
    const { firstName, lastName, mobile, phone, email, org, title, url, notes } = rawData || {};

    // Escapar caracteres reservados de vCard (\, ;, ,, saltos de línea)
    const escapeVCard = (str) => (str || '').toString().trim().replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');

    const safeFirst = escapeVCard(firstName).slice(0, 80);
    const safeLast = escapeVCard(lastName).slice(0, 80);
    const fullName = [safeFirst, safeLast].filter(Boolean).join(' ') || 'Contacto';

    let lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
      `N:${safeLast};${safeFirst};;;`
    ];

    if (org) lines.push(`ORG:${escapeVCard(org).slice(0, 100)}`);
    if (title) lines.push(`TITLE:${escapeVCard(title).slice(0, 100)}`);

    if (mobile) {
      const cleanMobile = mobile.replace(/[^0-9+()-\s]/g, '').trim().slice(0, 25);
      if (cleanMobile) lines.push(`TEL;TYPE=CELL:${cleanMobile}`);
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9+()-\s]/g, '').trim().slice(0, 25);
      if (cleanPhone) lines.push(`TEL;TYPE=WORK,VOICE:${cleanPhone}`);
    }

    if (email) {
      const cleanEmail = email.trim().slice(0, 100);
      if (cleanEmail) lines.push(`EMAIL;TYPE=PREF,INTERNET:${cleanEmail}`);
    }

    if (url) {
      const cleanUrl = url.trim().slice(0, 200);
      if (cleanUrl) lines.push(`URL:${cleanUrl}`);
    }

    if (notes) {
      lines.push(`NOTE:${escapeVCard(notes).slice(0, 300)}`);
    }

    lines.push('END:VCARD');
    return lines.join('\n');
  }

  return 'https://google.com';
}

/**
 * Valida un archivo de imagen en el navegador verificando sus Magic Bytes (Firma Binaria Real)
 * Previene la subida de ejecutables o scripts camuflados como imágenes
 */
export async function validateImageFile(file) {
  if (!file) throw new Error('No se ha seleccionado ningún archivo.');

  // 1. Verificación de tamaño
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('El archivo supera el límite de 2 MB permitido.');
  }

  // 2. Leer los primeros 12 bytes del archivo
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Firmas Magic Bytes
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  
  // JPEG / JPG: FF D8 FF
  const isJpg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;

  // WebP: RIFF ... WEBP (bytes 0-3 son 'RIFF' y 8-11 son 'WEBP')
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                 bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

  // HEIC / HEIF / ISO Base Media: bytes 4..7 'ftyp' y marcas 'heic', 'heix', 'mif1', 'msf1', 'hevc'
  const isFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  const isHeic = isFtyp || /\.(heic|heif)$/i.test(file.name || '');

  if (!isPng && !isJpg && !isWebp && !isHeic) {
    throw new Error('Firma de archivo inválida. Solo se admiten imágenes legítimas JPG, PNG, WebP o HEIC.');
  }

  return true;
}
