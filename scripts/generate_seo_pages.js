import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const baseHtmlPath = path.join(rootDir, 'index.html');
const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

const pages = [
  {
    filename: 'generador-qr.html',
    toolId: 'qr',
    viewId: 'view-qr-tool',
    path: '/generador-qr',
    title: 'Generador de Código QR WiFi, WhatsApp y Logo Gratis Online | Nuvexa',
    desc: 'Crea códigos QR personalizados para WiFi, WhatsApp, enlaces y contactos gratis. Añade tu logotipo, descarga en PNG transparente o PDF sin caducidad y 100% privado.',
    keywords: 'generador de codigo qr wifi gratis online, crear codigo qr con logo transparente, generador qr whatsapp enlace directo, codigo qr vcard contacto gratis, crear qr permanente sin registrarse'
  },
  {
    filename: 'editor-pdf.html',
    toolId: 'pdf-editor',
    viewId: 'view-pdf-editor',
    path: '/editor-pdf',
    title: 'Editor Visual de Páginas PDF Online Gratis: Rotar, Organizar y Eliminar | Nuvexa',
    desc: 'Organiza, rota y elimina páginas de tus documentos PDF de forma visual y rápida. Agrega numeración y marcas de agua. Procesamiento 100% local en tu navegador.',
    keywords: 'organizar y rotar paginas de pdf gratis online, eliminar hojas de documento pdf sin programas, editor visual de paginas pdf, reordenar pdf arrastrando hojas gratis'
  },
  {
    filename: 'comprimir-pdf.html',
    toolId: 'compress-pdf',
    viewId: 'view-compress-pdf',
    path: '/comprimir-pdf',
    title: 'Comprimir PDF Gratis Sin Perder Calidad Online: Reducir Tamaño | Nuvexa',
    desc: 'Reduce el tamaño de tus archivos PDF pesados para enviar por correo o WhatsApp. Compresión inteligente multinivel 100% confidencial sin subir archivos a ningún servidor.',
    keywords: 'comprimir pdf gratis sin perder calidad online, reducir tamano de archivo pdf para enviar por mail, compresor de pdf pesado rapido y privado, optimizar pdf en navegador'
  },
  {
    filename: 'unir-pdf.html',
    toolId: 'merge-pdf',
    viewId: 'view-merge-pdf',
    path: '/unir-pdf',
    title: 'Unir Archivos PDF Gratis Sin Límite Online: Juntar Varios PDF | Nuvexa',
    desc: 'Combina y une múltiples documentos PDF en un solo archivo ordenado. Rápido, sin límites diarios y con privacidad total en la memoria de tu equipo.',
    keywords: 'unir archivos pdf gratis sin limite online, juntar varios pdf en uno solo orden personalizado, combinar documentos pdf confidenciales sin subir a la nube'
  },
  {
    filename: 'separar-pdf.html',
    toolId: 'split-pdf',
    viewId: 'view-split-pdf',
    path: '/separar-pdf',
    title: 'Separar Páginas de PDF Gratis Online: Extraer y Dividir Documentos | Nuvexa',
    desc: 'Extrae rangos específicos de páginas o divide un archivo PDF en documentos individuales listos para descargar. Seguro, gratuito e instantáneo.',
    keywords: 'separar paginas de pdf gratis online, extraer hojas de pdf y guardar por separado, dividir archivo pdf en paginas individuales, cortar pdf gratis'
  },
  {
    filename: 'imagenes-a-pdf.html',
    toolId: 'images-to-pdf',
    viewId: 'view-images-to-pdf',
    path: '/imagenes-a-pdf',
    title: 'Convertir Fotos JPG y PNG a PDF Online Gratis | Nuvexa',
    desc: 'Transforma tus fotos, imágenes JPG, PNG y capturas en un documento PDF estructurado y listo para imprimir. Organiza márgenes y orientación en segundos.',
    keywords: 'convertir fotos jpg png a pdf online gratis, pasar imagenes de celular a documento pdf rapido, crear pdf con varias fotos ordenadas, unir fotos en un solo pdf'
  },
  {
    filename: 'comparar-pdf.html',
    toolId: 'doc-diff-studio',
    viewId: 'view-doc-diff-studio',
    path: '/comparar-pdf',
    title: 'Comparar Dos Documentos PDF Online Gratis: Ver Diferencias (Diff) | Nuvexa',
    desc: 'Compara dos versiones de un contrato o documento PDF y detecta cambios de texto y diferencias visuales al instante con resaltado en color y 100% privado.',
    keywords: 'comparar dos documentos pdf online gratis, ver diferencias entre contratos y presupuestos pdf, comparador visual y de texto de archivos pdf, diff de pdf en navegador'
  },
  {
    filename: 'censurar-pdf.html',
    toolId: 'redaction-studio',
    viewId: 'view-redaction-studio',
    path: '/censurar-pdf',
    title: 'Censurar y Tachar Datos Confidenciales en PDF Gratis Online | Nuvexa',
    desc: 'Oculta y tacha permanentemente DNIs, datos bancarios, nombres y firmas en archivos PDF antes de compartirlos. Cumple con GDPR sin dejar rastro digital.',
    keywords: 'censurar y tachar datos confidenciales en pdf gratis, ocultar dni nombres y tarjetas en pdf seguro, eliminar permanentemente informacion sensible de pdf, anonimizar pdf'
  },
  {
    filename: 'convertir-heic-a-jpg.html',
    toolId: 'image-studio',
    viewId: 'view-image-studio',
    path: '/convertir-heic-a-jpg',
    title: 'Convertir Fotos HEIC de iPhone a JPG Online Gratis y Optimizar Imágenes | Nuvexa',
    desc: 'Convierte fotos HEIC/HEIF de Apple a formato JPG o PNG de alta resolución. Comprime imágenes WebP, recorta y ajusta dimensiones en lote 100% privado.',
    keywords: 'convertir fotos heic de iphone a jpg online gratis, abrir archivos heic en windows y android, optimizar fotos webp png jpg en lote sin servidores, conversor heic gratis'
  },
  {
    filename: 'transcribir-audio-a-texto.html',
    toolId: 'audio-to-text',
    viewId: 'view-audio-to-text',
    path: '/transcribir-audio-a-texto',
    title: 'Transcribir Audio a Texto Gratis Online: IA Whisper Local Sin Límites | Nuvexa',
    desc: 'Transcribe grabaciones de voz, notas de WhatsApp, archivos MP3 y WAV a texto editable con inteligencia artificial Whisper directamente en tu navegador sin enviar datos a servidores.',
    keywords: 'transcribir audio a texto gratis online sin limite, convertir notas de voz de whatsapp y mp3 a texto, transcriptor de voz a texto privado con whisper ia local, dictado por voz gratis'
  },
  {
    filename: 'cifrar-archivos-aes256.html',
    toolId: 'security-studio',
    viewId: 'view-security-studio',
    path: '/cifrar-archivos-aes256',
    title: 'Cifrado de Archivos AES-256 Militar Gratis Online: Proteger con Clave | Nuvexa',
    desc: 'Encripta y protege archivos confidenciales, contratos y fotos con cifrado de grado militar AES-GCM 256 bits mediante Web Crypto API. Nadie podrá abrir tu archivo sin la clave.',
    keywords: 'encriptar archivos con clave de seguridad aes 256 gratis online, proteger documentos confidenciales con contrasena militar, cifrado client-side en navegador, descifrar archivo .nuvexa'
  },
  {
    filename: 'crear-archivos-zip.html',
    toolId: 'archive-studio',
    viewId: 'view-archive-studio',
    path: '/crear-archivos-zip',
    title: 'Crear y Extraer Archivos ZIP Online Gratis y Conversor Base64 | Nuvexa',
    desc: 'Empaqueta múltiples archivos en carpetas comprimidas .ZIP o descomprime archivos de forma instantánea en tu navegador. Incluye conversor de archivos a Base64.',
    keywords: 'crear y comprimir archivos zip online sin programas, descomprimir zip privado en navegador, convertidor de archivos a base64 data uri, empaquetar archivos zip gratis'
  }
];

for (const p of pages) {
  let html = baseHtml;

  // Set body active tool
  html = html.replace(/<body([^>]*)>/, `<body data-active-tool="${p.toolId}"$1>`);

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/, `<title>${p.title}</title>`);

  // Replace Meta Description
  html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${p.desc}" />`);

  // Replace Meta Keywords
  html = html.replace(/<meta name="keywords" content=".*?" \/>/, `<meta name="keywords" content="${p.keywords}" />`);

  // Replace Canonical Link
  html = html.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="https://www.nuvexatools.site${p.path}" />`);

  // Replace OG / Twitter tags
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${p.title}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${p.desc}" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="https://www.nuvexatools.site${p.path}" />`);
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${p.title}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${p.desc}" />`);

  // Make the specific view visible in static HTML, hide default smart-actions
  html = html.replace('id="view-smart-actions" class="tool-view-section active"', 'id="view-smart-actions" class="tool-view-section" style="display: none;"');
  html = html.replace(`id="${p.viewId}" class="tool-view-section" style="display: none;"`, `id="${p.viewId}" class="tool-view-section active" style="display: block;"`);

  const destPath = path.join(rootDir, p.filename);
  fs.writeFileSync(destPath, html, 'utf8');
  console.log(`Generated dedicated page: ${p.filename} -> ${p.path}`);
}

console.log('All dedicated SEO pages successfully generated!');
