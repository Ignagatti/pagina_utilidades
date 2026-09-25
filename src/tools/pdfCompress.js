import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

let currentPdfFile = null;
let currentPdfBytes = null;
let isCompressing = false;
let selectedPreset = 'recommended'; // 'recommended' | 'extreme' | 'low'

const PRESET_CONFIG = {
  recommended: {
    scale: 1.5,
    quality: 0.75,
    name: 'Compresión Recomendada'
  },
  extreme: {
    scale: 1.0,
    quality: 0.55,
    name: 'Compresión Extrema'
  },
  low: {
    scale: 2.0,
    quality: 0.90,
    name: 'Baja Compresión'
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

export function initPdfCompress({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('compress-pdf-dropzone');
  const fileInput = document.getElementById('compress-pdf-file-input');
  const workspace = document.getElementById('compress-pdf-workspace');
  const resultCard = document.getElementById('compress-pdf-result-card');

  const fileNameEl = document.getElementById('compress-pdf-file-name');
  const origSizeEl = document.getElementById('compress-pdf-orig-size');
  const btnChangeFile = document.getElementById('btn-compress-change-file');

  const presetBtns = document.querySelectorAll('.compress-level-btn');
  const btnExecute = document.getElementById('btn-execute-compress-pdf');

  const progressBox = document.getElementById('compress-progress-box');
  const progressBar = document.getElementById('compress-progress-bar');
  const progressText = document.getElementById('compress-progress-text');

  const resOrigSize = document.getElementById('compress-res-orig-size');
  const resNewSize = document.getElementById('compress-res-new-size');
  const resSavedSize = document.getElementById('compress-res-saved-size');
  const resSavingsBadge = document.getElementById('compress-res-savings-badge');
  const btnDownloadCompressed = document.getElementById('btn-download-compressed-pdf');
  const btnCompressAnother = document.getElementById('btn-compress-another-pdf');

  let compressedPdfBlob = null;

  function resetState() {
    currentPdfFile = null;
    currentPdfBytes = null;
    compressedPdfBlob = null;
    isCompressing = false;
    selectedPreset = 'recommended';

    if (fileInput) fileInput.value = '';
    if (dropzone) dropzone.style.display = 'block';
    if (workspace) workspace.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';
    if (progressBox) progressBox.style.display = 'none';
    if (btnExecute) {
      btnExecute.disabled = false;
      btnExecute.textContent = 'Comprimir PDF Ahora';
    }

    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === 'recommended');
    });
  }

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Por favor, selecciona un archivo en formato PDF válido.', 'warning');
      return;
    }

    currentPdfFile = file;
    try {
      currentPdfBytes = await file.arrayBuffer();
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (origSizeEl) {
        origSizeEl.innerHTML = `Peso actual del archivo: <strong style="color: var(--color-primary); font-size: 0.95rem;">${formatBytes(file.size)}</strong>`;
      }

      // Actualizar descripciones de niveles con estimación de peso previo a comprimir
      const pRecommended = document.querySelector('.compress-level-btn[data-level="recommended"] .compress-level-desc');
      const pExtreme = document.querySelector('.compress-level-btn[data-level="extreme"] .compress-level-desc');
      const pLow = document.querySelector('.compress-level-btn[data-level="low"] .compress-level-desc');

      if (pRecommended) pRecommended.textContent = `Ahorro estimado ~70% (quedará en aprox. ${formatBytes(Math.round(file.size * 0.3))}).`;
      if (pExtreme) pExtreme.textContent = `Máximo ahorro ~85% (quedará en aprox. ${formatBytes(Math.round(file.size * 0.15))}).`;
      if (pLow) pLow.textContent = `Alta calidad ~40% de ahorro (quedará en aprox. ${formatBytes(Math.round(file.size * 0.6))}).`;

      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <span>Comprimir PDF Ahora (Pesa ${formatBytes(file.size)})</span>
        `;
      }

      if (dropzone) dropzone.style.display = 'none';
      if (workspace) workspace.style.display = 'block';
      if (resultCard) resultCard.style.display = 'none';
      if (progressBox) progressBox.style.display = 'none';
    } catch (err) {
      console.error('Error al cargar PDF:', err);
      showToast('No se pudo leer el archivo PDF.', 'error');
    }
  }

  function displayCompressionResults(origSize, newSize) {
    const savedBytes = Math.max(0, origSize - newSize);
    const savedPercent = Math.max(0, Math.round((savedBytes / origSize) * 100));

    if (resOrigSize) resOrigSize.textContent = formatBytes(origSize);
    if (resNewSize) resNewSize.textContent = formatBytes(newSize);
    if (resSavedSize) {
      resSavedSize.textContent = savedPercent > 0 ? `${formatBytes(savedBytes)} (-${savedPercent}%)` : '0 B (0%)';
    }

    if (resSavingsBadge) {
      if (savedPercent > 0) {
        resSavingsBadge.textContent = `¡Ahorraste ${formatBytes(savedBytes)} de peso (-${savedPercent}%)!`;
        resSavingsBadge.className = 'tier-badge pro';
      } else {
        resSavingsBadge.textContent = 'Archivo optimizado (ya se encontraba en tamaño mínimo)';
        resSavingsBadge.className = 'tier-badge pro';
      }
    }

    if (btnDownloadCompressed) {
      btnDownloadCompressed.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Descargar PDF Comprimido (${formatBytes(newSize)})</span>
      `;
    }

    if (workspace) workspace.style.display = 'none';
    if (resultCard) resultCard.style.display = 'block';
  }

  async function executeCompression() {
    if (!currentPdfBytes || isCompressing) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    isCompressing = true;
    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Analizando estructura del documento...';

    try {
      const origSize = currentPdfFile.size;

      // Estrategia 1: Optimización nativa de objetos y flujos (sin rasterizar texto)
      let nativeBlob = null;
      try {
        const nativeDoc = await PDFDocument.load(currentPdfBytes, { ignoreEncryption: true });
        const nativeBytes = await nativeDoc.save({ useObjectStreams: true });
        nativeBlob = new Blob([nativeBytes], { type: 'application/pdf' });
      } catch (e) {
        console.warn('Optimización nativa no aplicable:', e);
      }

      // Si el archivo es diminuto (< 40 KB), la optimización nativa o el archivo original ya es el menor posible
      if (origSize < 40 * 1024) {
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = 'Documento listo';

        if (nativeBlob && nativeBlob.size < origSize) {
          compressedPdfBlob = nativeBlob;
        } else {
          compressedPdfBlob = currentPdfFile;
        }

        displayCompressionResults(origSize, compressedPdfBlob.size);
        showToast('PDF optimizado correctamente', 'success');
        return;
      }

      // Estrategia 2: Compresión avanzada de páginas (ideal para PDFs pesados con fotos y escaneos)
      const config = PRESET_CONFIG[selectedPreset] || PRESET_CONFIG.recommended;
      const loadingTask = pdfjsLib.getDocument({ data: currentPdfBytes });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const outputPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        const percent = Math.round(((i - 1) / totalPages) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `Optimizando página ${i} de ${totalPages}...`;

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: config.scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', config.quality));
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

        const embeddedImage = await outputPdfDoc.embedJpg(jpegBytes);
        const newPage = outputPdfDoc.addPage([page.view[2] - page.view[0], page.view[3] - page.view[1]]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight()
        });
      }

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'Finalizando documento...';

      const finalBytes = await outputPdfDoc.save({ useObjectStreams: true });
      const rasterBlob = new Blob([finalBytes], { type: 'application/pdf' });

      // Elegir SIEMPRE la opción que resulte en el menor tamaño real
      const candidates = [
        { blob: rasterBlob, size: rasterBlob.size },
        { blob: nativeBlob || currentPdfFile, size: (nativeBlob || currentPdfFile).size },
        { blob: currentPdfFile, size: origSize }
      ].sort((a, b) => a.size - b.size);

      compressedPdfBlob = candidates[0].blob;
      displayCompressionResults(origSize, compressedPdfBlob.size);

      showToast('PDF comprimido exitosamente', 'success');
    } catch (err) {
      console.error('Error durante la compresión del PDF:', err);
      showToast('Ocurrió un error al procesar el PDF.', 'error');
    } finally {
      isCompressing = false;
    }
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPreset = btn.dataset.level || 'recommended';
    });
  });

  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach(ev => {
    dropzone?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzone?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  btnChangeFile?.addEventListener('click', resetState);
  btnCompressAnother?.addEventListener('click', resetState);

  btnExecute?.addEventListener('click', async () => {
    if (!currentPdfBytes || isCompressing) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    isCompressing = true;
    btnExecute.disabled = true;
    btnExecute.textContent = 'Comprimiendo páginas...';
    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Iniciando optimización...';

    try {
      const config = PRESET_CONFIG[selectedPreset] || PRESET_CONFIG.recommended;
      const loadingTask = pdfjsLib.getDocument({ data: currentPdfBytes });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const outputPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        const percent = Math.round(((i - 1) / totalPages) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `Optimizando página ${i} de ${totalPages}...`;

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: config.scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', config.quality));
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

        const embeddedImage = await outputPdfDoc.embedJpg(jpegBytes);
        const newPage = outputPdfDoc.addPage([page.view[2] - page.view[0], page.view[3] - page.view[1]]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: newPage.getWidth(),
          height: newPage.getHeight()
        });
      }

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'Guardando documento final...';

      const finalBytes = await outputPdfDoc.save();
      compressedPdfBlob = new Blob([finalBytes], { type: 'application/pdf' });

      // Calculate savings
      const origSize = currentPdfFile.size;
      const newSize = compressedPdfBlob.size;
      const savedBytes = origSize - newSize;
      const savedPercent = Math.round((savedBytes / origSize) * 100);

      if (resOrigSize) resOrigSize.textContent = formatBytes(origSize);
      if (resNewSize) resNewSize.textContent = formatBytes(newSize);

      if (resSavingsBadge) {
        if (savedPercent > 0) {
          resSavingsBadge.textContent = `Ahorro del ${savedPercent}% de espacio`;
          resSavingsBadge.className = 'tier-badge pro';
        } else {
          resSavingsBadge.textContent = 'Documento optimizado';
          resSavingsBadge.className = 'tier-badge free';
        }
      }

      if (workspace) workspace.style.display = 'none';
      if (resultCard) resultCard.style.display = 'block';

      showToast('PDF comprimido exitosamente', 'success');
    } catch (err) {
      console.error('Error durante la compresión del PDF:', err);
      showToast('Ocurrió un error al procesar el PDF.', 'error');
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.textContent = 'Comprimir PDF Ahora';
      }
    } finally {
      isCompressing = false;
    }
  });

  btnDownloadCompressed?.addEventListener('click', () => {
    if (!compressedPdfBlob) return;

    if (!consumeDailyUse()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    if (onUsageUpdated) onUsageUpdated();

    const baseName = (currentPdfFile?.name || 'documento').replace(/\.pdf$/i, '');
    downloadBlob(compressedPdfBlob, `${baseName}-optimizado.pdf`);
    showToast('Descarga iniciada con éxito', 'success');
  });

  return {
    handleFile,
    reset: resetState
  };
}
