import { PDFDocument } from 'pdf-lib';
import { isProUser, canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { validateImageFile } from '../utils/security.js';
import { normalizeImageFile, isHeicFile } from '../utils/imageDecoder.js';
import { showToast } from '../utils/dialog.js';

let images = [];
let isConverting = false;

const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612.0, height: 792.0 }
};

async function processImageToEmbeddable(file) {
  let targetFile = file;
  if (isHeicFile(file)) {
    const res = await normalizeImageFile(file);
    targetFile = res.file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const isJpg = targetFile.type === 'image/jpeg' || targetFile.name.match(/\.jpe?g$/i);
        const format = isJpg ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(format, 0.95);

        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        resolve({
          bytes,
          format: isJpg ? 'jpg' : 'png',
          width: img.width,
          height: img.height
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(targetFile);
  });
}

function downloadPdfBlob(blob, filename = 'documento.pdf') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function initPdfConverter({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const imagesListContainer = document.getElementById('pdf-images-list');
  const btnConvertPdf = document.getElementById('btn-convert-pdf');
  const clearAllBtn = document.getElementById('btn-clear-pdf-images');
  const imagesCountBadge = document.getElementById('pdf-images-count-badge');

  function renderImagesList() {
    if (!imagesListContainer) return;

    if (images.length === 0) {
      imagesListContainer.innerHTML = `
        <div class="empty-list-notice">
          No hay imágenes añadidas aún. Selecciona o arrastra fotos para comenzar.
        </div>
      `;
      if (btnConvertPdf) btnConvertPdf.disabled = true;
      if (clearAllBtn) clearAllBtn.style.display = 'none';
      if (imagesCountBadge) imagesCountBadge.textContent = '0 imágenes';
      return;
    }

    if (btnConvertPdf) btnConvertPdf.disabled = false;
    if (clearAllBtn) clearAllBtn.style.display = 'inline-block';
    if (imagesCountBadge) {
      const isPro = isProUser();
      imagesCountBadge.textContent = `${images.length} ${images.length === 1 ? 'imagen' : 'imágenes'}${!isPro && images.length >= 3 ? ' (Máximo gratuito)' : ''}`;
    }

    imagesListContainer.innerHTML = images.map((item, index) => `
      <div class="pdf-image-item" data-id="${item.id}">
        <div class="pdf-image-thumb">
          <img src="${item.previewUrl}" alt="${item.file.name}" />
        </div>
        <div class="pdf-image-meta">
          <span class="pdf-image-name" title="${item.file.name}">${item.file.name}</span>
          <span class="pdf-image-size">${(item.file.size / 1024).toFixed(0)} KB • Página ${index + 1}</span>
        </div>
        <button type="button" class="btn-remove-image-item" data-id="${item.id}" title="Eliminar de la lista">
          &times;
        </button>
      </div>
    `).join('');

    imagesListContainer.querySelectorAll('.btn-remove-image-item').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        images = images.filter(img => img.id !== id);
        renderImagesList();
      };
    });
  }

  async function handleFiles(newFiles) {
    const isPro = isProUser();
    const filesArray = Array.from(newFiles);

    for (const file of filesArray) {

      if (!isPro && images.length >= 3) {
        if (onProModalRequested) {
          onProModalRequested('general');
        }
        break;
      }

      try {
        await validateImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        images.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          file,
          previewUrl
        });
      } catch (err) {
        showToast({ message: `No se pudo añadir "${file.name}": ${err.message}`, type: 'error' });
      }
    }

    renderImagesList();
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        fileInput.value = '';
      }
    };
  }

  if (dropzone) {
    dropzone.onclick = () => fileInput?.click();

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    };

    dropzone.ondragleave = () => {
      dropzone.classList.remove('drag-active');
    };

    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    };
  }

  if (clearAllBtn) {
    clearAllBtn.onclick = () => {
      images = [];
      renderImagesList();
    };
  }

  if (btnConvertPdf) {
    btnConvertPdf.onclick = async () => {
      if (isConverting || images.length === 0) return;

      if (!canPerformDownload()) {
        if (onProModalRequested) {
          onProModalRequested('daily_limit');
        }
        return;
      }

      isConverting = true;
      const originalText = btnConvertPdf.textContent;
      btnConvertPdf.textContent = 'Generando PDF...';
      btnConvertPdf.style.pointerEvents = 'none';

      try {
        const pageSizeType = document.getElementById('select-pdf-page-size')?.value || 'A4';
        const orientation = document.getElementById('select-pdf-orientation')?.value || 'portrait';
        const marginOption = document.getElementById('select-pdf-margin')?.value || 'standard';

        const baseDimensions = PAGE_SIZES[pageSizeType] || PAGE_SIZES.A4;
        const pageWidth = orientation === 'landscape' ? baseDimensions.height : baseDimensions.width;
        const pageHeight = orientation === 'landscape' ? baseDimensions.width : baseDimensions.height;
        const margin = marginOption === 'none' ? 0 : 36;

        const pdfDoc = await PDFDocument.create();

        for (const item of images) {
          const processed = await processImageToEmbeddable(item.file);
          const embeddedImage = processed.format === 'jpg'
            ? await pdfDoc.embedJpg(processed.bytes)
            : await pdfDoc.embedPng(processed.bytes);

          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          const availableWidth = pageWidth - (margin * 2);
          const availableHeight = pageHeight - (margin * 2);

          const scaleFactor = Math.min(
            availableWidth / embeddedImage.width,
            availableHeight / embeddedImage.height,
            1
          );

          const drawWidth = embeddedImage.width * scaleFactor;
          const drawHeight = embeddedImage.height * scaleFactor;

          const x = (pageWidth - drawWidth) / 2;
          const y = (pageHeight - drawHeight) / 2;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight
          });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        downloadPdfBlob(pdfBlob, `documento-imagenes-${Date.now()}.pdf`);

        consumeDailyUse();
        if (onUsageUpdated) {
          onUsageUpdated();
        }

        btnConvertPdf.textContent = 'PDF Descargado';
        setTimeout(() => {
          btnConvertPdf.textContent = originalText;
        }, 1500);
      } catch (err) {
        console.error('Error al generar PDF:', err);
        showToast({ message: 'Ocurrió un error al procesar las imágenes en PDF.', type: 'error' });
        btnConvertPdf.textContent = originalText;
      } finally {
        btnConvertPdf.style.pointerEvents = '';
        setTimeout(() => {
          isConverting = false;
        }, 600);
      }
    };
  }

  renderImagesList();
}
