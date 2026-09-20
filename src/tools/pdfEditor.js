/**
 * Herramienta: Editor Visual de PDF (100% en el Navegador)
 * Permite rotar páginas individuales, reordenar, eliminar páginas,
 * agregar numeración y marcas de agua sin subir el archivo a ningún servidor.
 */

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';

let loadedPdfBytes = null;
let pdfFileName = 'documento.pdf';
let pagesState = []; // Array de { originalIndex, rotation: 0, isDeleted: false }
let isProcessing = false;

/**
 * Descarga el archivo PDF resultante
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Inicializa el Editor Visual de PDF
 */
export function initPdfEditor({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('editor-pdf-dropzone');
  const fileInput = document.getElementById('editor-pdf-file-input');
  const workspace = document.getElementById('editor-pdf-workspace');
  const pagesGrid = document.getElementById('editor-pages-grid');
  const docTitleEl = document.getElementById('editor-doc-title');
  const pageCountBadge = document.getElementById('editor-page-count-badge');
  const btnChangeDoc = document.getElementById('btn-editor-change-doc');
  const btnExportPdf = document.getElementById('btn-editor-export-pdf');

  // Controles de opciones de exportación
  const checkWatermark = document.getElementById('check-editor-watermark');
  const inputWatermarkText = document.getElementById('input-editor-watermark-text');
  const checkPageNumbers = document.getElementById('check-editor-page-numbers');
  const btnRotateAll = document.getElementById('btn-editor-rotate-all');
  const btnResetPages = document.getElementById('btn-editor-reset-pages');

  if (!dropzone || !workspace || !pagesGrid) return;

  // Manejo de carga de documento
  async function loadPdfFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Por favor selecciona un archivo PDF válido.');
      return;
    }

    try {
      pdfFileName = file.name;
      const buffer = await file.arrayBuffer();
      loadedPdfBytes = buffer;

      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      pagesState = [];
      for (let i = 0; i < totalPages; i++) {
        const page = pdfDoc.getPage(i);
        const initialRotation = page.getRotation().angle || 0;
        const { width, height } = page.getSize();
        pagesState.push({
          originalIndex: i,
          pageNumber: i + 1,
          rotation: initialRotation,
          width: Math.round(width),
          height: Math.round(height),
          isDeleted: false
        });
      }

      if (docTitleEl) docTitleEl.textContent = pdfFileName;
      dropzone.style.display = 'none';
      workspace.style.display = 'block';

      renderPagesGrid();
    } catch (err) {
      console.error('Error al cargar PDF:', err);
      alert('No se pudo abrir el PDF. Si está protegido por contraseña, desbloquéalo antes.');
    }
  }

  // Renderiza la cuadrícula interactiva de miniaturas de páginas
  function renderPagesGrid() {
    pagesGrid.innerHTML = '';
    const activePages = pagesState.filter(p => !p.isDeleted);

    if (pageCountBadge) {
      pageCountBadge.textContent = `${activePages.length} de ${pagesState.length} páginas`;
    }

    if (activePages.length === 0) {
      pagesGrid.innerHTML = `
        <div class="empty-pages-notice">
          Has eliminado todas las páginas. Haz clic en "Restablecer" para recuperarlas.
        </div>
      `;
      if (btnExportPdf) btnExportPdf.disabled = true;
      return;
    }

    if (btnExportPdf) btnExportPdf.disabled = false;

    pagesState.forEach((pageItem, index) => {
      if (pageItem.isDeleted) return;

      const card = document.createElement('div');
      card.className = 'pdf-page-card';
      card.dataset.index = index;

      const isLandscape = (pageItem.rotation % 180 !== 0) ? (pageItem.height > pageItem.width) : (pageItem.width > pageItem.height);

      card.innerHTML = `
        <div class="page-card-header">
          <span class="page-num-pill">Pág. ${pageItem.pageNumber}</span>
          <span class="page-rotation-pill">${pageItem.rotation}°</span>
        </div>
        <div class="page-card-preview-box ${isLandscape ? 'landscape' : 'portrait'}">
          <div class="page-sheet-mockup" style="transform: rotate(${pageItem.rotation}deg);">
            <div class="sheet-lines"></div>
            <div class="sheet-lines short"></div>
            <div class="sheet-lines"></div>
          </div>
        </div>
        <div class="page-card-actions">
          <button type="button" class="btn-page-action btn-rotate-page" title="Rotar 90°">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Rotar</span>
          </button>
          <button type="button" class="btn-page-action btn-move-prev" title="Mover antes" ${index === 0 ? 'disabled' : ''}>
            &larr;
          </button>
          <button type="button" class="btn-page-action btn-move-next" title="Mover después" ${index === pagesState.length - 1 ? 'disabled' : ''}>
            &rarr;
          </button>
          <button type="button" class="btn-page-action btn-delete-page danger" title="Eliminar página">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      // Eventos de la tarjeta
      card.querySelector('.btn-rotate-page').onclick = () => {
        pageItem.rotation = (pageItem.rotation + 90) % 360;
        renderPagesGrid();
      };

      card.querySelector('.btn-move-prev').onclick = () => {
        if (index > 0) {
          const temp = pagesState[index];
          pagesState[index] = pagesState[index - 1];
          pagesState[index - 1] = temp;
          renderPagesGrid();
        }
      };

      card.querySelector('.btn-move-next').onclick = () => {
        if (index < pagesState.length - 1) {
          const temp = pagesState[index];
          pagesState[index] = pagesState[index + 1];
          pagesState[index + 1] = temp;
          renderPagesGrid();
        }
      };

      card.querySelector('.btn-delete-page').onclick = () => {
        pageItem.isDeleted = true;
        renderPagesGrid();
      };

      pagesGrid.appendChild(card);
    });
  }

  // Eventos de Dropzone
  dropzone.onclick = () => fileInput?.click();
  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadPdfFile(file);
  };

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
    if (file) loadPdfFile(file);
  });

  // Cambiar documento
  if (btnChangeDoc) {
    btnChangeDoc.onclick = () => {
      loadedPdfBytes = null;
      pagesState = [];
      if (fileInput) fileInput.value = '';
      workspace.style.display = 'none';
      dropzone.style.display = 'block';
    };
  }

  // Rotar todas las páginas 90°
  if (btnRotateAll) {
    btnRotateAll.onclick = () => {
      pagesState.forEach(p => {
        if (!p.isDeleted) p.rotation = (p.rotation + 90) % 360;
      });
      renderPagesGrid();
    };
  }

  // Restablecer páginas eliminadas y rotaciones
  if (btnResetPages) {
    btnResetPages.onclick = () => {
      pagesState.forEach(p => {
        p.isDeleted = false;
        p.rotation = 0;
      });
      pagesState.sort((a, b) => a.originalIndex - b.originalIndex);
      renderPagesGrid();
    };
  }

  // Exportar el PDF editado
  if (btnExportPdf) {
    btnExportPdf.onclick = async () => {
      if (!loadedPdfBytes || isProcessing) return;

      const activePages = pagesState.filter(p => !p.isDeleted);
      if (activePages.length === 0) {
        alert('Debes conservar al menos una página para exportar.');
        return;
      }

      if (!canPerformDownload()) {
        if (onProModalRequested) onProModalRequested('daily_limit');
        return;
      }

      isProcessing = true;
      const originalText = btnExportPdf.textContent;
      btnExportPdf.textContent = 'Generando nuevo PDF...';
      btnExportPdf.disabled = true;

      try {
        const sourcePdfDoc = await PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });
        const newPdfDoc = await PDFDocument.create();
        const helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

        const addWatermark = checkWatermark?.checked && inputWatermarkText?.value.trim();
        const watermarkText = (inputWatermarkText?.value || '').trim();
        const addNumbering = checkPageNumbers?.checked;

        for (let newIdx = 0; newIdx < activePages.length; newIdx++) {
          const item = activePages[newIdx];
          const [copiedPage] = await newPdfDoc.copyPages(sourcePdfDoc, [item.originalIndex]);

          copiedPage.setRotation(degrees(item.rotation));

          const { width, height } = copiedPage.getSize();

          // Agregar Marca de Agua si está activa
          if (addWatermark) {
            copiedPage.drawText(watermarkText, {
              x: width * 0.15,
              y: height * 0.5,
              size: Math.min(width, height) * 0.08,
              font: helveticaFont,
              color: rgb(0.7, 0.7, 0.7),
              opacity: 0.35,
              rotate: degrees(45)
            });
          }

          // Agregar Numeración si está activa
          if (addNumbering) {
            const pageStr = `${newIdx + 1} / ${activePages.length}`;
            copiedPage.drawText(pageStr, {
              x: width - 70,
              y: 20,
              size: 9,
              font: helveticaFont,
              color: rgb(0.3, 0.3, 0.3),
              opacity: 0.8
            });
          }

          newPdfDoc.addPage(copiedPage);
        }

        const exportedBytes = await newPdfDoc.save();
        const blob = new Blob([exportedBytes], { type: 'application/pdf' });
        const cleanName = pdfFileName.replace(/\.pdf$/i, '') + '-editado.pdf';
        downloadBlob(blob, cleanName);

        consumeDailyUse();
        if (onUsageUpdated) onUsageUpdated();

        btnExportPdf.textContent = '¡PDF Exportado!';
        setTimeout(() => {
          btnExportPdf.textContent = originalText;
          btnExportPdf.disabled = false;
        }, 2000);

      } catch (err) {
        console.error('Error al exportar PDF:', err);
        alert('Ocurrió un error al guardar el documento. Intenta nuevamente.');
        btnExportPdf.textContent = originalText;
        btnExportPdf.disabled = false;
      } finally {
        isProcessing = false;
      }
    };
  }
}
