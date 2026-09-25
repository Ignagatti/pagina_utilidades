import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

let queueFiles = [];
let isCompressing = false;
let selectedPreset = 'recommended'; // 'recommended' | 'extreme' | 'low'
let generatedZipBlob = null;

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
  const addFileInput = document.getElementById('compress-pdf-add-input');
  const btnAddMore = document.getElementById('btn-compress-add-more');
  const workspace = document.getElementById('compress-pdf-workspace');
  const resultCard = document.getElementById('compress-pdf-result-card');

  const filesListEl = document.getElementById('compress-pdf-files-list');
  const queueBadgeEl = document.getElementById('compress-pdf-queue-badge');
  const fileNameEl = document.getElementById('compress-pdf-file-name');
  const origSizeEl = document.getElementById('compress-pdf-orig-size');
  const btnChangeFile = document.getElementById('btn-compress-change-file');

  const presetBtns = document.querySelectorAll('.compress-level-btn');
  const btnExecute = document.getElementById('btn-execute-compress-pdf');

  const progressBox = document.getElementById('compress-progress-box');
  const progressBar = document.getElementById('compress-progress-bar');
  const progressText = document.getElementById('compress-progress-text');

  const resTitle = document.getElementById('compress-result-title');
  const resSubtitle = document.getElementById('compress-result-subtitle');
  const resOrigSize = document.getElementById('compress-res-orig-size');
  const resNewSize = document.getElementById('compress-res-new-size');
  const resSavedSize = document.getElementById('compress-res-saved-size');
  const resSavingsBadge = document.getElementById('compress-res-savings-badge');
  const btnDownloadCompressed = document.getElementById('btn-download-compressed-pdf');
  const btnDownloadZip = document.getElementById('btn-download-compressed-zip');
  const btnDownloadAllIndividual = document.getElementById('btn-download-all-individual');
  const btnCompressAnother = document.getElementById('btn-compress-another-pdf');
  const resultsListEl = document.getElementById('compress-results-list');

  function resetState() {
    queueFiles = [];
    generatedZipBlob = null;
    isCompressing = false;
    selectedPreset = 'recommended';

    if (fileInput) fileInput.value = '';
    if (addFileInput) addFileInput.value = '';
    if (dropzone) dropzone.style.display = 'block';
    if (workspace) workspace.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';
    if (progressBox) progressBox.style.display = 'none';
    if (resultsListEl) resultsListEl.innerHTML = '';
    if (btnExecute) {
      btnExecute.disabled = false;
      btnExecute.innerHTML = '<span>Comprimir PDF Ahora</span>';
    }

    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === 'recommended');
    });
  }

  function renderWorkspaceQueue() {
    if (!workspace) return;

    if (queueFiles.length === 0) {
      resetState();
      return;
    }

    if (dropzone) dropzone.style.display = 'none';
    if (workspace) workspace.style.display = 'block';
    if (resultCard) resultCard.style.display = 'none';
    if (progressBox) progressBox.style.display = 'none';

    const totalBytes = queueFiles.reduce((acc, item) => acc + (item.origSize || 0), 0);
    const totalCount = queueFiles.length;

    if (queueBadgeEl) {
      queueBadgeEl.textContent = totalCount === 1 ? '1 archivo listo' : `${totalCount} archivos listos`;
    }

    if (fileNameEl) {
      fileNameEl.textContent = totalCount === 1 
        ? queueFiles[0].name 
        : `${totalCount} archivos PDF seleccionados`;
    }

    if (origSizeEl) {
      origSizeEl.innerHTML = `Peso total: <strong style="color: var(--color-primary); font-size: 0.95rem;">${formatBytes(totalBytes)}</strong>`;
    }

    // Actualizar descripciones de niveles con estimación de peso previo a comprimir
    const pRecommended = document.querySelector('.compress-level-btn[data-level="recommended"] .compress-level-desc');
    const pExtreme = document.querySelector('.compress-level-btn[data-level="extreme"] .compress-level-desc');
    const pLow = document.querySelector('.compress-level-btn[data-level="low"] .compress-level-desc');

    if (pRecommended) pRecommended.textContent = `Ahorro estimado ~70% (quedará en aprox. ${formatBytes(Math.round(totalBytes * 0.3))}).`;
    if (pExtreme) pExtreme.textContent = `Máximo ahorro ~85% (quedará en aprox. ${formatBytes(Math.round(totalBytes * 0.15))}).`;
    if (pLow) pLow.textContent = `Alta calidad ~40% de ahorro (quedará en aprox. ${formatBytes(Math.round(totalBytes * 0.6))}).`;

    if (btnExecute) {
      btnExecute.disabled = false;
      const btnLabel = totalCount === 1 
        ? `Comprimir PDF Ahora (${formatBytes(totalBytes)})`
        : `Comprimir ${totalCount} PDFs Ahora (${formatBytes(totalBytes)})`;
      btnExecute.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <span>${btnLabel}</span>
      `;
    }

    // Render list of files
    if (filesListEl) {
      filesListEl.innerHTML = queueFiles.map(item => `
        <div class="compress-file-queue-item" data-id="${item.id}">
          <div class="compress-file-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-primary); flex-shrink: 0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="compress-file-name" title="${item.name}">${item.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="compress-file-size">${formatBytes(item.origSize)}</span>
            <button type="button" class="btn-remove-queue-item btn-danger-sm" data-id="${item.id}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; line-height: 1;" title="Eliminar este archivo">
              &times;
            </button>
          </div>
        </div>
      `).join('');

      filesListEl.querySelectorAll('.btn-remove-queue-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          queueFiles = queueFiles.filter(f => f.id !== id);
          renderWorkspaceQueue();
        });
      });
    }
  }

  async function addFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');

    if (validFiles.length === 0) {
      showToast('Por favor, selecciona uno o varios archivos PDF válidos.', 'warning');
      return;
    }

    for (const file of validFiles) {
      const id = 'pdf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      try {
        const bytes = await file.arrayBuffer();
        queueFiles.push({
          id,
          file,
          name: file.name,
          origSize: file.size,
          bytes,
          status: 'pending',
          compressedBlob: null,
          compressedSize: 0,
          savedBytes: 0,
          savedPercent: 0,
          error: null
        });
      } catch (err) {
        console.error('Error cargando archivo:', file.name, err);
      }
    }

    renderWorkspaceQueue();
  }

  async function compressSinglePdf(item, config, onPageProgress) {
    const origSize = item.origSize;
    const currentBytes = item.bytes;

    // Estrategia 1: Optimización nativa con pdf-lib (useObjectStreams)
    let nativeBlob = null;
    try {
      const nativeDoc = await PDFDocument.load(currentBytes, { ignoreEncryption: true });
      const nativeBytes = await nativeDoc.save({ useObjectStreams: true });
      nativeBlob = new Blob([nativeBytes], { type: 'application/pdf' });
    } catch (e) {
      console.warn('Optimización nativa no aplicable:', item.name, e);
    }

    // Si el archivo es muy pequeño (< 40 KB), la compresión nativa o el original es la mejor
    if (origSize < 40 * 1024) {
      if (nativeBlob && nativeBlob.size < origSize) {
        return nativeBlob;
      }
      return item.file;
    }

    // Estrategia 2: Compresión de páginas con renderizado a canvas JPEG
    let rasterBlob = null;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: currentBytes.slice(0) });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const outputPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        if (onPageProgress) onPageProgress(i, totalPages);

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

      const finalBytes = await outputPdfDoc.save({ useObjectStreams: true });
      rasterBlob = new Blob([finalBytes], { type: 'application/pdf' });
    } catch (err) {
      console.warn('Compresión rasterizada falló para:', item.name, err);
    }

    // Elegir SIEMPRE la opción que resulte en el menor tamaño
    const candidates = [
      ...(rasterBlob ? [{ blob: rasterBlob, size: rasterBlob.size }] : []),
      ...(nativeBlob ? [{ blob: nativeBlob, size: nativeBlob.size }] : []),
      { blob: item.file, size: origSize }
    ].sort((a, b) => a.size - b.size);

    return candidates[0].blob;
  }

  function renderResultsView() {
    if (workspace) workspace.style.display = 'none';
    if (resultCard) resultCard.style.display = 'block';

    const totalOrig = queueFiles.reduce((acc, f) => acc + (f.origSize || 0), 0);
    const totalNew = queueFiles.reduce((acc, f) => acc + (f.compressedSize || 0), 0);
    const totalSaved = Math.max(0, totalOrig - totalNew);
    const totalSavedPct = totalOrig > 0 ? Math.max(0, Math.round((totalSaved / totalOrig) * 100)) : 0;
    const isSingle = queueFiles.length === 1;

    if (resTitle) {
      resTitle.textContent = isSingle 
        ? '¡Tu PDF ha sido comprimido con éxito!'
        : `¡Tus ${queueFiles.length} PDFs han sido comprimidos con éxito!`;
    }

    if (resSubtitle) {
      resSubtitle.textContent = isSingle
        ? 'El archivo está optimizado y listo para ser descargado.'
        : 'Los archivos están listos para descargar individualmente o todos juntos en un ZIP.';
    }

    if (resOrigSize) resOrigSize.textContent = formatBytes(totalOrig);
    if (resNewSize) resNewSize.textContent = formatBytes(totalNew);
    if (resSavedSize) {
      resSavedSize.textContent = totalSavedPct > 0 ? `${formatBytes(totalSaved)} (-${totalSavedPct}%)` : '0 B (0%)';
    }

    if (resSavingsBadge) {
      if (totalSavedPct > 0) {
        resSavingsBadge.textContent = `¡Ahorro total de ${formatBytes(totalSaved)} (-${totalSavedPct}%)!`;
        resSavingsBadge.className = 'tier-badge pro';
      } else {
        resSavingsBadge.textContent = 'Archivos optimizados (ya se encontraban en tamaño mínimo)';
        resSavingsBadge.className = 'tier-badge pro';
      }
    }

    // Configurar botones de descarga globales
    if (isSingle) {
      const singleItem = queueFiles[0];
      if (btnDownloadCompressed) {
        btnDownloadCompressed.style.display = 'inline-flex';
        btnDownloadCompressed.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Descargar PDF Comprimido (${formatBytes(singleItem.compressedSize)})</span>
        `;
      }
      if (btnDownloadZip) btnDownloadZip.style.display = 'none';
      if (btnDownloadAllIndividual) btnDownloadAllIndividual.style.display = 'none';
    } else {
      if (btnDownloadCompressed) btnDownloadCompressed.style.display = 'none';
      if (btnDownloadZip) {
        btnDownloadZip.style.display = 'inline-flex';
        const zipSize = generatedZipBlob ? generatedZipBlob.size : totalNew;
        btnDownloadZip.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Descargar Todos en un ZIP (${formatBytes(zipSize)})</span>
        `;
      }
      if (btnDownloadAllIndividual) {
        btnDownloadAllIndividual.style.display = 'inline-flex';
        btnDownloadAllIndividual.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Descargar uno a uno</span>
        `;
      }
    }

    // Renderizar lista detallada de cada archivo individual
    if (resultsListEl) {
      resultsListEl.innerHTML = queueFiles.map((item, idx) => {
        const savedPct = item.savedPercent;
        const savedText = savedPct > 0 ? `-${savedPct}%` : 'Optimizado';
        return `
          <div class="compress-result-item" data-id="${item.id}">
            <div class="compress-result-meta">
              <span class="compress-result-name" title="${item.name}">${item.name}</span>
              <div class="compress-result-stats">
                <span>${formatBytes(item.origSize)} &rarr; <strong style="color: var(--color-success);">${formatBytes(item.compressedSize)}</strong></span>
                <span class="compress-badge-pct">${savedText}</span>
              </div>
            </div>
            <button type="button" class="btn-download-single-item btn-action-outline" data-id="${item.id}" style="padding: 0.4rem 0.85rem; font-size: 0.82rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.4rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Descargar</span>
            </button>
          </div>
        `;
      }).join('');

      resultsListEl.querySelectorAll('.btn-download-single-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const targetItem = queueFiles.find(f => f.id === id);
          if (!targetItem || !targetItem.compressedBlob) return;

          if (!consumeDailyUse()) {
            if (onProModalRequested) onProModalRequested('daily_limit');
            return;
          }
          if (onUsageUpdated) onUsageUpdated();

          const baseName = targetItem.name.replace(/\.pdf$/i, '');
          downloadBlob(targetItem.compressedBlob, `${baseName}-optimizado.pdf`);
          showToast(`Descargando "${targetItem.name}"`, 'success');
        });
      });
    }
  }

  async function executeCompression() {
    if (queueFiles.length === 0 || isCompressing) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    isCompressing = true;
    if (btnExecute) {
      btnExecute.disabled = true;
      btnExecute.textContent = 'Comprimiendo archivos...';
    }
    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Iniciando compresión...';

    const config = PRESET_CONFIG[selectedPreset] || PRESET_CONFIG.recommended;
    const zip = new JSZip();
    const usedNames = new Set();

    try {
      const totalFiles = queueFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const item = queueFiles[i];
        item.status = 'compressing';

        const filePercentStart = Math.round((i / totalFiles) * 100);
        if (progressBar) progressBar.style.width = `${filePercentStart}%`;
        if (progressText) {
          progressText.textContent = `Comprimiendo archivo ${i + 1} de ${totalFiles}: ${item.name}...`;
        }

        const compressedBlob = await compressSinglePdf(item, config, (page, totalPages) => {
          const pagePct = Math.round((i / totalFiles) * 100 + ((page / totalPages) * (100 / totalFiles)));
          if (progressBar) progressBar.style.width = `${pagePct}%`;
          if (progressText) {
            progressText.textContent = `Archivo ${i + 1}/${totalFiles} (${item.name}): procesando página ${page}/${totalPages}...`;
          }
        });

        item.status = 'done';
        item.compressedBlob = compressedBlob;
        item.compressedSize = compressedBlob.size;
        item.savedBytes = Math.max(0, item.origSize - compressedBlob.size);
        item.savedPercent = item.origSize > 0 ? Math.max(0, Math.round((item.savedBytes / item.origSize) * 100)) : 0;

        // Generar nombre de archivo único para el ZIP
        const baseName = item.name.replace(/\.pdf$/i, '');
        let outName = `${baseName}-optimizado.pdf`;
        let counter = 1;
        while (usedNames.has(outName.toLowerCase())) {
          outName = `${baseName}-optimizado-${counter}.pdf`;
          counter++;
        }
        usedNames.add(outName.toLowerCase());
        item.outName = outName;

        zip.file(outName, compressedBlob);
      }

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.textContent = 'Generando archivo ZIP...';

      if (totalFiles > 1) {
        generatedZipBlob = await zip.generateAsync({ type: 'blob' });
      } else {
        generatedZipBlob = null;
      }

      renderResultsView();
      showToast(totalFiles === 1 ? 'PDF comprimido exitosamente' : `${totalFiles} PDFs comprimidos exitosamente`, 'success');
    } catch (err) {
      console.error('Error durante la compresión del PDF:', err);
      showToast('Ocurrió un error al procesar los archivos PDF.', 'error');
      if (btnExecute) {
        btnExecute.disabled = false;
        btnExecute.textContent = 'Comprimir PDFs Ahora';
      }
    } finally {
      isCompressing = false;
    }
  }

  // Preset Buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPreset = btn.dataset.level || 'recommended';
    });
  });

  // Event Listeners for Dropzone and File Inputs
  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(files);
  });

  btnAddMore?.addEventListener('click', () => addFileInput?.click());
  addFileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(files);
    addFileInput.value = '';
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
    const files = e.dataTransfer.files;
    if (files && files.length > 0) addFiles(files);
  });

  btnChangeFile?.addEventListener('click', resetState);
  btnCompressAnother?.addEventListener('click', resetState);

  btnExecute?.addEventListener('click', executeCompression);

  // Single PDF download (when 1 file in results)
  btnDownloadCompressed?.addEventListener('click', () => {
    const item = queueFiles[0];
    if (!item || !item.compressedBlob) return;

    if (!consumeDailyUse()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }
    if (onUsageUpdated) onUsageUpdated();

    const baseName = item.name.replace(/\.pdf$/i, '');
    downloadBlob(item.compressedBlob, `${baseName}-optimizado.pdf`);
    showToast('Descarga iniciada con éxito', 'success');
  });

  // ZIP download (when multiple files)
  btnDownloadZip?.addEventListener('click', () => {
    if (!generatedZipBlob) return;

    if (!consumeDailyUse()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }
    if (onUsageUpdated) onUsageUpdated();

    downloadBlob(generatedZipBlob, 'pdfs-comprimidos.zip');
    showToast('Descargando archivo ZIP con todos los PDFs', 'success');
  });

  // Download all files individually one by one
  btnDownloadAllIndividual?.addEventListener('click', () => {
    if (queueFiles.length === 0) return;

    if (!consumeDailyUse()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }
    if (onUsageUpdated) onUsageUpdated();

    showToast(`Iniciando descarga individual de ${queueFiles.length} archivos...`, 'info');

    queueFiles.forEach((item, index) => {
      if (item.compressedBlob) {
        setTimeout(() => {
          const baseName = item.name.replace(/\.pdf$/i, '');
          downloadBlob(item.compressedBlob, `${baseName}-optimizado.pdf`);
        }, index * 350);
      }
    });
  });

  return {
    handleFile: (file) => addFiles([file]),
    handleFiles: (files) => addFiles(files),
    reset: resetState
  };
}
