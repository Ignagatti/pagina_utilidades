/**
 * Herramienta: DocDiff Studio (Comparador de Documentos y PDFs en el Navegador)
 * Permite comparar Documento A vs Documento B (PDF, TXT o texto pegado)
 * extrayendo texto de forma 100% local, analizando cambios cláusula por cláusula,
 * detectando páginas modificadas y calculando hashes criptográficos.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

// Configuración del worker de PDF.js para Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

let fileA = null;
let fileB = null;
let docTextA = '';
let docTextB = '';
let pagesTextA = [];
let pagesTextB = [];
let hashA = '';
let hashB = '';

/**
 * Calcula el Hash SHA-256 de un ArrayBuffer con Web Crypto API
 */
async function calculateFileHash(buffer) {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Formatea bytes
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extrae texto página por página de un archivo PDF usando PDF.js
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    isEvalSupported: false
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const pageStrings = content.items.map(item => item.str || '');
    pages.push(pageStrings.join(' '));
  }

  return {
    numPages,
    pages,
    fullText: pages.join('\n\n')
  };
}

/**
 * Algoritmo LCS (Longest Common Subsequence) para Diff de líneas
 */
function computeDiff(linesA, linesB) {
  const N = linesA.length;
  const M = linesB.length;
  const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = N;
  let j = M;
  const diff = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diff.unshift({ type: 'equal', text: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: linesB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'deleted', text: linesA[i - 1] });
      i--;
    }
  }

  return diff;
}

export function initDocDiffStudio({ onUsageUpdated, onProModalRequested }) {
  const dropzoneA = document.getElementById('diff-dropzone-a');
  const fileInputA = document.getElementById('diff-file-a');
  const textareaA = document.getElementById('diff-text-input-a');
  const dropzoneB = document.getElementById('diff-dropzone-b');
  const fileInputB = document.getElementById('diff-file-b');
  const textareaB = document.getElementById('diff-text-input-b');

  const metaBoxA = document.getElementById('diff-meta-a');
  const metaBoxB = document.getElementById('diff-meta-b');
  const btnChangeA = document.getElementById('btn-diff-change-a');
  const btnChangeB = document.getElementById('btn-diff-change-b');

  const btnExecuteDiff = document.getElementById('btn-execute-diff');
  const btnClearAll = document.getElementById('btn-diff-clear-all');

  // Resultados
  const resultsContainer = document.getElementById('diff-results-container');
  const summaryPill = document.getElementById('diff-summary-pill');
  const statAddedEl = document.getElementById('diff-stat-added');
  const statDeletedEl = document.getElementById('diff-stat-deleted');
  const statPagesA = document.getElementById('diff-stat-pages-a');
  const statPagesB = document.getElementById('diff-stat-pages-b');

  const pagesDiffList = document.getElementById('diff-pages-breakdown');
  const diffViewerSideA = document.getElementById('diff-viewer-side-a');
  const diffViewerSideB = document.getElementById('diff-viewer-side-b');

  const btnCopyDiff = document.getElementById('btn-copy-diff');
  const btnDownloadDiffTxt = document.getElementById('btn-download-diff-txt');

  if (!dropzoneA || !dropzoneB) return;

  // Estado inicial completamente vacío
  resetAll();

  function resetAll() {
    fileA = null;
    fileB = null;
    docTextA = '';
    docTextB = '';
    pagesTextA = [];
    pagesTextB = [];
    hashA = '';
    hashB = '';

    if (fileInputA) fileInputA.value = '';
    if (fileInputB) fileInputB.value = '';
    if (textareaA) textareaA.value = '';
    if (textareaB) textareaB.value = '';

    if (metaBoxA) metaBoxA.style.display = 'none';
    if (metaBoxB) metaBoxB.style.display = 'none';
    if (btnChangeA) btnChangeA.style.display = 'none';
    if (btnChangeB) btnChangeB.style.display = 'none';

    if (dropzoneA) dropzoneA.style.display = 'block';
    if (dropzoneB) dropzoneB.style.display = 'block';

    if (resultsContainer) resultsContainer.style.display = 'none';
    checkReadyState();
  }

  async function handleFileA(file) {
    if (!file) return;
    fileA = file;
    if (metaBoxA) {
      metaBoxA.innerHTML = `<span>Cargando y leyendo ${file.name}...</span>`;
      metaBoxA.style.display = 'block';
    }

    try {
      const buf = await file.arrayBuffer();
      hashA = await calculateFileHash(buf);

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const res = await extractTextFromPdf(file);
        pagesTextA = res.pages;
        docTextA = res.fullText;
      } else {
        docTextA = await file.text();
        pagesTextA = [docTextA];
      }

      if (textareaA) textareaA.value = docTextA;

      if (metaBoxA) {
        metaBoxA.innerHTML = `
          <strong>${file.name}</strong><br>
          <small>${formatBytes(file.size)} • ${pagesTextA.length} pág(s)</small>
        `;
        metaBoxA.style.display = 'block';
      }
      if (dropzoneA) dropzoneA.style.display = 'none';
      if (btnChangeA) btnChangeA.style.display = 'inline-block';

    } catch (err) {
      console.error('Error leyendo archivo A:', err);
      showToast({ message: 'Error al leer el archivo A. Si es un PDF escaneado sin texto seleccionable, asegúrate de que tenga texto incrustado.', type: 'error' });
      if (metaBoxA) metaBoxA.style.display = 'none';
      if (dropzoneA) dropzoneA.style.display = 'block';
    }

    checkReadyState();
  }

  async function handleFileB(file) {
    if (!file) return;
    fileB = file;
    if (metaBoxB) {
      metaBoxB.innerHTML = `<span>Cargando y leyendo ${file.name}...</span>`;
      metaBoxB.style.display = 'block';
    }

    try {
      const buf = await file.arrayBuffer();
      hashB = await calculateFileHash(buf);

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const res = await extractTextFromPdf(file);
        pagesTextB = res.pages;
        docTextB = res.fullText;
      } else {
        docTextB = await file.text();
        pagesTextB = [docTextB];
      }

      if (textareaB) textareaB.value = docTextB;

      if (metaBoxB) {
        metaBoxB.innerHTML = `
          <strong>${file.name}</strong><br>
          <small>${formatBytes(file.size)} • ${pagesTextB.length} pág(s)</small>
        `;
        metaBoxB.style.display = 'block';
      }
      if (dropzoneB) dropzoneB.style.display = 'none';
      if (btnChangeB) btnChangeB.style.display = 'inline-block';

    } catch (err) {
      console.error('Error leyendo archivo B:', err);
      showToast({ message: 'Error al leer el archivo B. Si es un PDF escaneado sin texto seleccionable, asegúrate de que tenga texto incrustado.', type: 'error' });
      if (metaBoxB) metaBoxB.style.display = 'none';
      if (dropzoneB) dropzoneB.style.display = 'block';
    }

    checkReadyState();
  }

  function checkReadyState() {
    const hasTextA = (textareaA?.value?.trim() || docTextA?.trim() || '').length > 0;
    const hasTextB = (textareaB?.value?.trim() || docTextB?.trim() || '').length > 0;

    if (btnExecuteDiff) {
      btnExecuteDiff.disabled = !(hasTextA && hasTextB);
    }
  }

  // Eventos Dropzone A
  dropzoneA.onclick = () => fileInputA?.click();
  fileInputA?.addEventListener('change', (e) => handleFileA(e.target.files?.[0]));

  ['dragenter', 'dragover'].forEach(ev => {
    dropzoneA?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneA.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzoneA?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneA.classList.remove('drag-active');
    });
  });

  dropzoneA?.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileA(file);
  });

  btnChangeA?.addEventListener('click', () => {
    fileA = null;
    docTextA = '';
    pagesTextA = [];
    if (fileInputA) fileInputA.value = '';
    if (textareaA) textareaA.value = '';
    if (metaBoxA) metaBoxA.style.display = 'none';
    if (btnChangeA) btnChangeA.style.display = 'none';
    if (dropzoneA) dropzoneA.style.display = 'block';
    checkReadyState();
  });

  // Eventos Dropzone B
  dropzoneB.onclick = () => fileInputB?.click();
  fileInputB?.addEventListener('change', (e) => handleFileB(e.target.files?.[0]));

  ['dragenter', 'dragover'].forEach(ev => {
    dropzoneB?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneB.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzoneB?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneB.classList.remove('drag-active');
    });
  });

  dropzoneB?.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileB(file);
  });

  btnChangeB?.addEventListener('click', () => {
    fileB = null;
    docTextB = '';
    pagesTextB = [];
    if (fileInputB) fileInputB.value = '';
    if (textareaB) textareaB.value = '';
    if (metaBoxB) metaBoxB.style.display = 'none';
    if (btnChangeB) btnChangeB.style.display = 'none';
    if (dropzoneB) dropzoneB.style.display = 'block';
    checkReadyState();
  });

  // Escuchar edición manual de texto en las áreas de texto
  textareaA?.addEventListener('input', () => {
    docTextA = textareaA.value;
    if (pagesTextA.length === 0) pagesTextA = [docTextA];
    checkReadyState();
  });

  textareaB?.addEventListener('input', () => {
    docTextB = textareaB.value;
    if (pagesTextB.length === 0) pagesTextB = [docTextB];
    checkReadyState();
  });

  btnClearAll?.addEventListener('click', resetAll);

  // Ejecutar Comparación
  btnExecuteDiff?.addEventListener('click', executeComparison);

  function executeComparison() {
    const currentA = textareaA?.value || docTextA || '';
    const currentB = textareaB?.value || docTextB || '';

    if (!currentA.trim() || !currentB.trim()) {
      showToast({ message: 'Por favor carga dos documentos o escribe texto en ambos campos para comparar.', type: 'warning' });
      return;
    }

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const linesA = currentA.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const linesB = currentB.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const diffResults = computeDiff(linesA, linesB);

    let addedCount = 0;
    let deletedCount = 0;
    let htmlA = '';
    let htmlB = '';

    diffResults.forEach(item => {
      if (item.type === 'added') {
        addedCount++;
        htmlB += `<div class="diff-line diff-line-added"><span class="diff-sign">+</span> ${escapeHtml(item.text)}</div>`;
      } else if (item.type === 'deleted') {
        deletedCount++;
        htmlA += `<div class="diff-line diff-line-deleted"><span class="diff-sign">-</span> ${escapeHtml(item.text)}</div>`;
      } else {
        htmlA += `<div class="diff-line diff-line-equal">${escapeHtml(item.text)}</div>`;
        htmlB += `<div class="diff-line diff-line-equal">${escapeHtml(item.text)}</div>`;
      }
    });

    if (statAddedEl) statAddedEl.textContent = `+${addedCount} líneas`;
    if (statDeletedEl) statDeletedEl.textContent = `-${deletedCount} líneas`;
    if (statPagesA) statPagesA.textContent = `${pagesTextA.length || 1} pág(s)`;
    if (statPagesB) statPagesB.textContent = `${pagesTextB.length || 1} pág(s)`;

    if (summaryPill) {
      if (addedCount === 0 && deletedCount === 0) {
        summaryPill.textContent = 'Documentos 100% Idénticos';
        summaryPill.className = 'tier-badge pro';
      } else {
        summaryPill.textContent = `${addedCount + deletedCount} cambios detectados`;
        summaryPill.className = 'tier-badge free';
      }
    }

    // Desglose por páginas si hay datos de páginas
    if (pagesDiffList) {
      pagesDiffList.innerHTML = '';
      const maxPages = Math.max(pagesTextA.length, pagesTextB.length);
      for (let p = 0; p < maxPages; p++) {
        const textPageA = pagesTextA[p] || '';
        const textPageB = pagesTextB[p] || '';
        const isModified = textPageA.trim() !== textPageB.trim();

        const itemDiv = document.createElement('div');
        itemDiv.className = 'diff-page-item';
        itemDiv.innerHTML = `
          <span>Pág. ${p + 1}:</span>
          <strong style="color: ${isModified ? 'var(--color-danger)' : 'var(--color-success)'}">
            ${isModified ? 'Modificada' : 'Sin cambios'}
          </strong>
        `;
        pagesDiffList.appendChild(itemDiv);
      }
    }

    if (diffViewerSideA) diffViewerSideA.innerHTML = htmlA || '<em>Sin contenido</em>';
    if (diffViewerSideB) diffViewerSideB.innerHTML = htmlB || '<em>Sin contenido</em>';

    if (resultsContainer) {
      resultsContainer.style.display = 'block';
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    consumeDailyUse();
    if (onUsageUpdated) onUsageUpdated();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  btnCopyDiff?.addEventListener('click', () => {
    const currentA = textareaA?.value || docTextA || '';
    const currentB = textareaB?.value || docTextB || '';
    const textReport = `INFORME DE COMPARACIÓN DE DOCUMENTOS\nDocumento A: ${fileA?.name || 'A'}\nDocumento B: ${fileB?.name || 'B'}\n\n--- Documento A ---\n${currentA}\n\n--- Documento B ---\n${currentB}`;
    navigator.clipboard.writeText(textReport);
    showToast({ message: 'Informe de comparación copiado al portapapeles.', type: 'success' });
  });

  btnDownloadDiffTxt?.addEventListener('click', () => {
    const currentA = textareaA?.value || docTextA || '';
    const currentB = textareaB?.value || docTextB || '';
    const textReport = `INFORME DE COMPARACIÓN DE DOCUMENTOS\nDocumento A: ${fileA?.name || 'A'} (Hash: ${hashA})\nDocumento B: ${fileB?.name || 'B'} (Hash: ${hashB})\n\n--- Documento A ---\n${currentA}\n\n--- Documento B ---\n${currentB}`;
    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparacion-${fileA?.name || 'docA'}-vs-${fileB?.name || 'docB'}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  });
}
