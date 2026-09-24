import { PDFDocument } from 'pdf-lib';
import { isImageFile, isHeicFile, normalizeImageFile } from '../utils/imageDecoder.js';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function initSmartActions({ onNavigateTool }) {
  const dropzone = document.getElementById('smart-actions-dropzone');
  const fileInput = document.getElementById('smart-actions-file-input');
  const cardResult = document.getElementById('smart-actions-card');
  const emptyState = document.getElementById('smart-actions-empty');

  const fileNameEl = document.getElementById('smart-file-name');
  const fileMetaEl = document.getElementById('smart-file-meta');
  const fileBadgeEl = document.getElementById('smart-file-badge');
  const actionsListEl = document.getElementById('smart-actions-list');
  const btnChangeFile = document.getElementById('btn-smart-change-file');

  if (!dropzone || !cardResult) return;

  async function handleFile(file) {
    if (!file) return;

    if (emptyState) emptyState.style.display = 'none';
    if (cardResult) cardResult.style.display = 'block';

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = isImageFile(file);
    const isHeic = isHeicFile(file);
    const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/i);
    const isCsvOrText = file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt');

    let metaDetails = `${formatBytes(file.size)}`;
    let badgeText = 'Archivo';
    let actions = [];

    if (isPdf) {
      badgeText = 'Documento PDF';
      try {
        const buf = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = pdfDoc.getPageCount();
        metaDetails += ` • ${pages} página(s)`;
      } catch (e) {
        metaDetails += ` • Documento PDF`;
      }

      actions = [
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
          title: 'Censurar Datos Sensibles (DNI / CUIT / Emails)',
          desc: 'Detecta y tapa información confidencial con barras negras antes de compartir.',
          tool: 'redaction-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"></path><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"></path></svg>',
          title: 'Comparar con Otra Versión (PDF Diff)',
          desc: 'Detecta cláusulas agregadas, párrafos eliminados o modificados.',
          tool: 'doc-diff-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
          title: 'Editor Visual y Separador de Páginas',
          desc: 'Reorganiza, rota, elimina hojas o divide el documento.',
          tool: 'pdf-editor'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
          title: 'Cifrar con Clave Militar (AES-256-GCM)',
          desc: 'Protege el documento con contraseña privada de alta seguridad.',
          tool: 'security-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
          title: 'Comprimir en Archivo .ZIP',
          desc: 'Empaqueta este PDF junto con otros archivos sin salir del navegador.',
          tool: 'archive-studio'
        }
      ];
    } else if (isImage) {
      badgeText = isHeic ? 'Foto Apple HEIC' : 'Imagen';
      try {
        let previewFile = file;
        if (isHeic) {
          const res = await normalizeImageFile(file);
          previewFile = res.file;
          metaDetails += ' • Formato Apple HEIC/HEIF';
        }
        const img = new Image();
        const objUrl = URL.createObjectURL(previewFile);
        await new Promise(r => {
          img.onload = () => {
            metaDetails += ` • ${img.naturalWidth} × ${img.naturalHeight} px`;
            r();
          };
          img.onerror = r;
          img.src = objUrl;
        });
      } catch (e) {
        console.warn('SmartActions img decode:', e);
      }

      actions = [
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
          title: isHeic ? 'Convertir HEIC a JPG / PNG / WebP' : 'Convertir Formato Real (PNG ⇄ JPG / WebP / AVIF)',
          desc: isHeic ? 'Transforma fotos de iPhone en formatos universales JPG o PNG sin perder nitidez.' : 'Cambia a JPG con fondo blanco limpio o a WebP para máxima compresión.',
          tool: 'image-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
          title: 'Convertir a Documento PDF',
          desc: 'Crea un PDF imprimible con esta imagen o únelas en un solo documento.',
          tool: 'images-to-pdf'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
          title: 'Convertir a Icono .ICO y Favicons Web',
          desc: 'Genera un archivo .ico auténtico con todas las medidas (16 a 256px) para Windows o tu web.',
          tool: 'image-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
          title: 'Cifrar Imagen con Contraseña Privada (AES-256)',
          desc: 'Oculta la imagen completamente bajo cifrado de grado militar.',
          tool: 'security-studio'
        }
      ];
    } else if (isAudio) {
      badgeText = 'Archivo de Audio';
      actions = [
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>',
          title: 'Transcribir Audio a Texto',
          desc: 'Convierte voz a texto 100% en tu navegador con exportación a TXT.',
          tool: 'audio-to-text'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
          title: 'Cifrar Archivo de Audio (AES-256)',
          desc: 'Protege notas de voz confidenciales o reuniones grabadas.',
          tool: 'security-studio'
        }
      ];
    } else if (isCsvOrText) {
      badgeText = 'Datos / Texto';
      actions = [
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
          title: 'Ocultar Información Sensible (DNI, Teléfonos)',
          desc: 'Censura datos personales con barras negras de privacidad.',
          tool: 'redaction-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"></path><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"></path></svg>',
          title: 'Comparar con Otra Versión de Texto',
          desc: 'Compara diferencias línea por línea y detecta cambios.',
          tool: 'doc-diff-studio'
        }
      ];
    } else {
      badgeText = 'Archivo Genérico';
      actions = [
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
          title: 'Cifrar y Proteger con Clave (AES-256-GCM)',
          desc: 'Protege cualquier archivo con seguridad criptográfica militar.',
          tool: 'security-studio'
        },
        {
          icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
          title: 'Empaquetar y Comprimir en .ZIP',
          desc: 'Crea un archivo comprimido descargable al instante.',
          tool: 'archive-studio'
        }
      ];
    }

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileMetaEl) fileMetaEl.textContent = metaDetails;
    if (fileBadgeEl) fileBadgeEl.textContent = badgeText;

    if (actionsListEl) {
      actionsListEl.innerHTML = '';
      actions.forEach(act => {
        const item = document.createElement('div');
        item.className = 'smart-action-item';
        item.innerHTML = `
          <div class="smart-action-icon">${act.icon}</div>
          <div class="smart-action-info">
            <h4 class="smart-action-title">${act.title}</h4>
            <p class="smart-action-desc">${act.desc}</p>
          </div>
          <button type="button" class="btn-action-outline smart-action-btn" data-tool="${act.tool}">
            <span>Ejecutar</span>
          </button>
        `;

        item.querySelector('.smart-action-btn')?.addEventListener('click', () => {
          if (onNavigateTool) onNavigateTool(act.tool);
        });

        actionsListEl.appendChild(item);
      });
    }
  }

  dropzone.onclick = () => fileInput?.click();
  fileInput.onchange = (e) => handleFile(e.target.files?.[0]);

  ['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  btnChangeFile?.addEventListener('click', () => {
    if (fileInput) fileInput.value = '';
    if (cardResult) cardResult.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
  });
}
