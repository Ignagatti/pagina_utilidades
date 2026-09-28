/**
 * Nuvexa SEO & Dedicated Route Management System
 * Handles long-tail keyword metadata, clean URL history routing,
 * and canonical tags across all suite tools.
 */

export const TOOL_ROUTES = {
  'smart-actions': {
    id: 'smart-actions',
    path: '/',
    aliases: ['/index.html', '/smart-actions'],
    title: 'Nuvexa | Herramientas digitales. Privadas. En un solo lugar.',
    h1: '¿Qué quieres hacer hoy con tus archivos?',
    metaDesc: 'Nuvexa: Suite de herramientas digitales privadas en tu navegador. Códigos QR con logo, editor y comparador de PDF, conversor HEIC, transcriptor de voz y cifrado AES-256.',
    keywords: 'herramientas digitales privadas, suite de oficina online, procesar archivos sin subir a internet, nuvexa'
  },
  'qr': {
    id: 'qr',
    path: '/generador-qr',
    aliases: ['/generador-qr.html', '/qr'],
    title: 'Generador de Código QR WiFi, WhatsApp y Logo Gratis Online | Nuvexa',
    h1: 'Generador de Códigos QR con Logo y WiFi Gratis Online',
    metaDesc: 'Crea códigos QR personalizados para WiFi, WhatsApp, enlaces y contactos gratis. Añade tu logotipo, descarga en PNG transparente o PDF sin caducidad y 100% privado.',
    keywords: 'generador de codigo qr wifi gratis online, crear codigo qr con logo transparente, generador qr whatsapp enlace directo, codigo qr vcard contacto gratis, crear qr permanente sin registrarse'
  },
  'pdf-editor': {
    id: 'pdf-editor',
    path: '/editor-pdf',
    aliases: ['/editor-pdf.html', '/editor-visual-pdf'],
    title: 'Editor Visual de Páginas PDF Online Gratis: Rotar, Organizar y Eliminar | Nuvexa',
    h1: 'Editor Visual de Páginas PDF Online y Reorganizador',
    metaDesc: 'Organiza, rota y elimina páginas de tus documentos PDF de forma visual y rápida. Agrega numeración y marcas de agua. Procesamiento 100% local en tu navegador.',
    keywords: 'organizar y rotar paginas de pdf gratis online, eliminar hojas de documento pdf sin programas, editor visual de paginas pdf, reordenar pdf arrastrando hojas gratis'
  },
  'compress-pdf': {
    id: 'compress-pdf',
    path: '/comprimir-pdf',
    aliases: ['/comprimir-pdf.html', '/reducir-pdf'],
    title: 'Comprimir PDF Gratis Sin Perder Calidad Online: Reducir Tamaño | Nuvexa',
    h1: 'Comprimir PDF Gratis Sin Perder Calidad Online',
    metaDesc: 'Reduce el tamaño de tus archivos PDF pesados para enviar por correo o WhatsApp. Compresión inteligente multinivel 100% confidencial sin subir archivos a ningún servidor.',
    keywords: 'comprimir pdf gratis sin perder calidad online, reducir tamano de archivo pdf para enviar por mail, compresor de pdf pesado rapido y privado, optimizar pdf en navegador'
  },
  'merge-pdf': {
    id: 'merge-pdf',
    path: '/unir-pdf',
    aliases: ['/unir-pdf.html', '/combinar-pdf'],
    title: 'Unir Archivos PDF Gratis Sin Límite Online: Juntar Varios PDF | Nuvexa',
    h1: 'Unir Archivos PDF Gratis Sin Límite Online',
    metaDesc: 'Combina y une múltiples documentos PDF en un solo archivo ordenado. Rápido, sin límites diarios y con privacidad total en la memoria de tu equipo.',
    keywords: 'unir archivos pdf gratis sin limite online, juntar varios pdf en uno solo orden personalizado, combinar documentos pdf confidenciales sin subir a la nube'
  },
  'split-pdf': {
    id: 'split-pdf',
    path: '/separar-pdf',
    aliases: ['/separar-pdf.html', '/dividir-pdf'],
    title: 'Separar Páginas de PDF Gratis Online: Extraer y Dividir Documentos | Nuvexa',
    h1: 'Separar Páginas de PDF Gratis Online',
    metaDesc: 'Extrae rangos específicos de páginas o divide un archivo PDF en documentos individuales listos para descargar. Seguro, gratuito e instantáneo.',
    keywords: 'separar paginas de pdf gratis online, extraer hojas de pdf y guardar por separado, dividir archivo pdf en paginas individuales, cortar pdf gratis'
  },
  'images-to-pdf': {
    id: 'images-to-pdf',
    path: '/imagenes-a-pdf',
    aliases: ['/imagenes-a-pdf.html', '/convertir-fotos-a-pdf'],
    title: 'Convertir Fotos JPG y PNG a PDF Online Gratis | Nuvexa',
    h1: 'Convertir Fotos JPG y PNG a Documento PDF Online',
    metaDesc: 'Transforma tus fotos, imágenes JPG, PNG y capturas en un documento PDF estructurado y listo para imprimir. Organiza márgenes y orientación en segundos.',
    keywords: 'convertir fotos jpg png a pdf online gratis, pasar imagenes de celular a documento pdf rapido, crear pdf con varias fotos ordenadas, unir fotos en un solo pdf'
  },
  'doc-diff-studio': {
    id: 'doc-diff-studio',
    path: '/comparar-pdf',
    aliases: ['/comparar-pdf.html', '/comparador-documentos'],
    title: 'Comparar Dos Documentos PDF Online Gratis: Ver Diferencias (Diff) | Nuvexa',
    h1: 'Comparar Dos Documentos PDF Online Gratis',
    metaDesc: 'Compara dos versiones de un contrato o documento PDF y detecta cambios de texto y diferencias visuales al instante con resaltado en color y 100% privado.',
    keywords: 'comparar dos documentos pdf online gratis, ver diferencias entre contratos y presupuestos pdf, comparador visual y de texto de archivos pdf, diff de pdf en navegador'
  },
  'redaction-studio': {
    id: 'redaction-studio',
    path: '/censurar-pdf',
    aliases: ['/censurar-pdf.html', '/tachar-pdf'],
    title: 'Censurar y Tachar Datos Confidenciales en PDF Gratis Online | Nuvexa',
    h1: 'Censurar y Tachar Información Confidencial en PDF',
    metaDesc: 'Oculta y tacha permanentemente DNIs, datos bancarios, nombres y firmas en archivos PDF antes de compartirlos. Cumple con GDPR sin dejar rastro digital.',
    keywords: 'censurar y tachar datos confidenciales en pdf gratis, ocultar dni nombres y tarjetas en pdf seguro, eliminar permanentemente informacion sensible de pdf, anonimizar pdf'
  },
  'image-studio': {
    id: 'image-studio',
    path: '/convertir-heic-a-jpg',
    aliases: ['/convertir-heic-a-jpg.html', '/optimizador-imagenes.html', '/convertir-imagenes'],
    title: 'Convertir Fotos HEIC de iPhone a JPG Online Gratis y Optimizar Imágenes | Nuvexa',
    h1: 'Convertidor HEIC de iPhone a JPG y Optimizador de Imágenes',
    metaDesc: 'Convierte fotos HEIC/HEIF de Apple a formato JPG o PNG de alta resolución. Comprime imágenes WebP, recorta y ajusta dimensiones en lote 100% privado.',
    keywords: 'convertir fotos heic de iphone a jpg online gratis, abrir archivos heic en windows y android, optimizar fotos webp png jpg en lote sin servidores, conversor heic gratis'
  },
  'audio-to-text': {
    id: 'audio-to-text',
    path: '/transcribir-audio-a-texto',
    aliases: ['/transcribir-audio-a-texto.html', '/transcriptor-audio'],
    title: 'Transcribir Audio a Texto Gratis Online: IA Whisper Local Sin Límites | Nuvexa',
    h1: 'Transcribir Audio y Notas de Voz a Texto con IA Whisper Local',
    metaDesc: 'Transcribe grabaciones de voz, notas de WhatsApp, archivos MP3 y WAV a texto editable con inteligencia artificial Whisper directamente en tu navegador sin enviar datos a servidores.',
    keywords: 'transcribir audio a texto gratis online sin limite, convertir notas de voz de whatsapp y mp3 a texto, transcriptor de voz a texto privado con whisper ia local, dictado por voz gratis'
  },
  'security-studio': {
    id: 'security-studio',
    path: '/cifrar-archivos-aes256',
    aliases: ['/cifrar-archivos-aes256.html', '/cifrador-archivos'],
    title: 'Cifrado de Archivos AES-256 Militar Gratis Online: Proteger con Clave | Nuvexa',
    h1: 'Cifrar Archivos y Documentos con Contraseña Militar AES-256',
    metaDesc: 'Encripta y protege archivos confidenciales, contratos y fotos con cifrado de grado militar AES-GCM 256 bits mediante Web Crypto API. Nadie podrá abrir tu archivo sin la clave.',
    keywords: 'encriptar archivos con clave de seguridad aes 256 gratis online, proteger documentos confidenciales con contrasena militar, cifrado client-side en navegador, descifrar archivo .nuvexa'
  },
  'archive-studio': {
    id: 'archive-studio',
    path: '/crear-archivos-zip',
    aliases: ['/crear-archivos-zip.html', '/compresor-zip'],
    title: 'Crear y Extraer Archivos ZIP Online Gratis y Conversor Base64 | Nuvexa',
    h1: 'Crear y Extraer Archivos ZIP y Conversor Base64',
    metaDesc: 'Empaqueta múltiples archivos en carpetas comprimidas .ZIP o descomprime archivos de forma instantánea en tu navegador. Incluye conversor de archivos a Base64.',
    keywords: 'crear y comprimir archivos zip online sin programas, descomprimir zip privado en navegador, convertidor de archivos a base64 data uri, empaquetar archivos zip gratis'
  }
};

/**
 * Identify the active tool from current URL pathname, hash, or body attributes.
 */
export function getToolFromCurrentUrl() {
  const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const hash = window.location.hash.toLowerCase().replace(/^#/, '');

  // 1. Match by pathname exact or aliases
  for (const [toolId, config] of Object.entries(TOOL_ROUTES)) {
    if (config.path === pathname) return toolId;
    if (config.aliases && config.aliases.some(a => a === pathname || pathname.endsWith(a))) {
      return toolId;
    }
  }

  // 2. Match by hash (e.g. #qr, #compress-pdf)
  if (hash) {
    if (TOOL_ROUTES[hash]) return hash;
    for (const [toolId, config] of Object.entries(TOOL_ROUTES)) {
      if (config.aliases && config.aliases.some(a => a.replace('/', '') === hash)) {
        return toolId;
      }
    }
  }

  // 3. Match from HTML data-active-tool attribute
  const bodyTool = document.body.dataset.activeTool;
  if (bodyTool && TOOL_ROUTES[bodyTool]) {
    return bodyTool;
  }

  return 'smart-actions';
}

/**
 * Updates browser metadata (title, meta description, canonical, OpenGraph)
 * and optionally pushes history state for dedicated URLs.
 */
export function applyToolSeoMetadata(toolId, updateHistory = true) {
  const config = TOOL_ROUTES[toolId] || TOOL_ROUTES['smart-actions'];
  if (!config) return;

  // Update document title
  document.title = config.title;

  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', config.metaDesc);
  }

  // Update meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords && config.keywords) {
    metaKeywords.setAttribute('content', config.keywords);
  }

  // Update canonical link
  const canonicalUrl = `https://www.nuvexatools.site${config.path === '/' ? '' : config.path}`;
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // Update OpenGraph
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', config.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', config.metaDesc);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

  // Update Twitter Cards
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', config.title);

  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', config.metaDesc);

  // Update history state if running on web
  const isElectron = window.electronAPI?.isElectron || (typeof process !== 'undefined' && process.versions?.electron);
  if (!isElectron && updateHistory && window.history?.pushState) {
    const currentPath = window.location.pathname;
    const targetPath = config.path;
    if (currentPath !== targetPath && currentPath !== `${targetPath}.html`) {
      window.history.pushState({ tool: toolId }, config.title, targetPath);
    }
  }
}
