import { PDFDocument } from 'pdf-lib';
import { isProUser, canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

let currentPdfFile = null;
let currentPdfDoc = null;
let totalPages = 0;
let isSplitting = false;

function downloadBlob(blob, filename) {
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

/**
 * Parsea un rango de páginas en formato texto (ej: "1-3, 5") a índices 0-indexed
 */
function parsePageRange(rangeStr, maxPages) {
  const indices = new Set();
  const parts = rangeStr.split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(startStr) && !isNaN(endStr)) {
        const start = Math.max(1, Math.min(startStr, endStr));
        const end = Math.min(maxPages, Math.max(startStr, endStr));
        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        indices.add(pageNum - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

export function initPdfSplit({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('split-dropzone');
  const fileInput = document.getElementById('split-file-input');
  const docInfoBox = document.getElementById('split-doc-info');
  const fileNameEl = document.getElementById('split-doc-name');
  const pageCountEl = document.getElementById('split-doc-pages');
  const rangeInput = document.getElementById('input-split-range');
  const btnSplit = document.getElementById('btn-execute-split');
  const removeFileBtn = document.getElementById('btn-remove-split-file');

  async function loadPdf(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      currentPdfDoc = await PDFDocument.load(arrayBuffer);
      currentPdfFile = file;
      totalPages = currentPdfDoc.getPageCount();

      if (fileNameEl) fileNameEl.textContent = file.name;
      if (pageCountEl) pageCountEl.textContent = `${totalPages} páginas encontradas`;
      if (rangeInput) rangeInput.placeholder = `Ej: 1-${Math.min(totalPages, 3)}`;

      if (dropzone) dropzone.style.display = 'none';
      if (docInfoBox) docInfoBox.style.display = 'block';
      if (btnSplit) btnSplit.disabled = false;
    } catch (err) {
      showToast({ message: 'No se pudo cargar el archivo PDF. Asegúrate de que no esté dañado ni protegido por contraseña.', type: 'error' });
    }
  }

  function resetState() {
    currentPdfFile = null;
    currentPdfDoc = null;
    totalPages = 0;
    if (dropzone) dropzone.style.display = 'block';
    if (docInfoBox) docInfoBox.style.display = 'none';
    if (btnSplit) btnSplit.disabled = true;
    if (rangeInput) rangeInput.value = '';
    if (fileInput) fileInput.value = '';
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) loadPdf(file);
    };
  }

  if (dropzone) {
    dropzone.onclick = () => fileInput?.click();
    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    };
    dropzone.ondragleave = () => dropzone.classList.remove('drag-active');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.toLowerCase().endsWith('.pdf')) {
        loadPdf(file);
      }
    };
  }

  if (removeFileBtn) {
    removeFileBtn.onclick = resetState;
  }

  if (btnSplit) {
    btnSplit.onclick = async () => {
      if (isSplitting || !currentPdfDoc) return;

      if (!canPerformDownload()) {
        if (onProModalRequested) onProModalRequested('daily_limit');
        return;
      }

      const rawRange = rangeInput?.value.trim() || `1-${totalPages}`;
      const pageIndices = parsePageRange(rawRange, totalPages);

      if (pageIndices.length === 0) {
        showToast({ message: 'Por favor introduce un rango de páginas válido (ej: 1-3 o 2, 5).', type: 'warning' });
        return;
      }

      isSplitting = true;
      const originalText = btnSplit.textContent;
      btnSplit.textContent = 'Extrayendo páginas...';
      btnSplit.style.pointerEvents = 'none';

      try {
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(currentPdfDoc, pageIndices);
        copiedPages.forEach(p => newDoc.addPage(p));

        const newPdfBytes = await newDoc.save();
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
        downloadBlob(blob, `paginas-extraidas-${Date.now()}.pdf`);

        consumeDailyUse();
        if (onUsageUpdated) onUsageUpdated();

        btnSplit.textContent = 'Páginas Extraídas con Éxito';
        setTimeout(() => {
          btnSplit.textContent = originalText;
        }, 1500);
      } catch (err) {
        console.error('Error al dividir PDF:', err);
        showToast({ message: 'Ocurrió un error al extraer las páginas del documento.', type: 'error' });
        btnSplit.textContent = originalText;
      } finally {
        btnSplit.style.pointerEvents = '';
        setTimeout(() => { isSplitting = false; }, 600);
      }
    };
  }
}
