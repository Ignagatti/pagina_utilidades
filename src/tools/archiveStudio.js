/**
 * Herramienta: Archive Studio (Empaquetador y Extractor ZIP 100% en el Navegador)
 * Permite crear archivos ZIP a partir de múltiples documentos, descomprimir archivos ZIP
 * y convertir archivos a Base64 y viceversa sin servidores.
 */

import JSZip from 'jszip';
import { canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

let filesToZip = [];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function initArchiveStudio({ onUsageUpdated, onProModalRequested }) {
  // Pestañas internas
  const archTabs = document.querySelectorAll('.arch-tab-btn');
  const archPanels = document.querySelectorAll('.arch-tab-panel');

  archTabs.forEach(btn => {
    btn.onclick = () => {
      archTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.archtab;
      archPanels.forEach(p => {
        p.classList.toggle('active', p.dataset.archtab === target);
      });
    };
  });

  // =========================================================================
  // 1. CREAR ARCHIVO ZIP
  // =========================================================================
  const zipDropzone = document.getElementById('zip-create-dropzone');
  const zipFileInput = document.getElementById('zip-create-file-input');
  const zipFilesList = document.getElementById('zip-files-list');
  const zipCountBadge = document.getElementById('zip-files-count-badge');
  const inputZipName = document.getElementById('input-zip-filename');
  const btnExecuteZip = document.getElementById('btn-execute-create-zip');
  const btnClearZip = document.getElementById('btn-clear-zip-files');

  function renderZipList() {
    if (!zipFilesList) return;
    zipFilesList.innerHTML = '';

    if (zipCountBadge) {
      zipCountBadge.textContent = `${filesToZip.length} archivos`;
    }

    if (filesToZip.length === 0) {
      zipFilesList.innerHTML = `
        <div class="empty-list-notice">
          No hay archivos añadidos aún. Selecciona o arrastra documentos para empaquetarlos en un ZIP.
        </div>
      `;
      if (btnExecuteZip) btnExecuteZip.disabled = true;
      if (btnClearZip) btnClearZip.style.display = 'none';
      return;
    }

    if (btnExecuteZip) btnExecuteZip.disabled = false;
    if (btnClearZip) btnClearZip.style.display = 'inline-flex';

    filesToZip.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'pdf-image-item';
      item.innerHTML = `
        <div class="pdf-doc-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="pdf-image-meta">
          <span class="pdf-image-name">${file.name}</span>
          <span class="pdf-image-size">${formatBytes(file.size)}</span>
        </div>
        <button type="button" class="btn-remove-item" data-index="${index}" title="Eliminar">&times;</button>
      `;

      item.querySelector('.btn-remove-item').onclick = () => {
        filesToZip.splice(index, 1);
        renderZipList();
      };

      zipFilesList.appendChild(item);
    });
  }

  function addFilesToZip(newFiles) {
    for (const f of newFiles) {
      filesToZip.push(f);
    }
    renderZipList();
  }

  if (zipDropzone) {
    zipDropzone.onclick = () => zipFileInput?.click();
    zipFileInput?.addEventListener('change', (e) => {
      if (e.target.files?.length) {
        addFilesToZip(e.target.files);
        zipFileInput.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach(ev => {
      zipDropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        zipDropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(ev => {
      zipDropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        zipDropzone.classList.remove('drag-active');
      });
    });

    zipDropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files?.length) {
        addFilesToZip(e.dataTransfer.files);
      }
    });
  }

  btnClearZip?.addEventListener('click', () => {
    filesToZip = [];
    renderZipList();
  });

  btnExecuteZip?.addEventListener('click', async () => {
    if (filesToZip.length === 0) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const zip = new JSZip();
    const originalText = btnExecuteZip.textContent;
    btnExecuteZip.textContent = 'Comprimiendo archivos en ZIP...';
    btnExecuteZip.disabled = true;

    try {
      for (const file of filesToZip) {
        zip.file(file.name, file);
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const zipName = (inputZipName?.value.trim() || 'archivos-comprimidos') + '.zip';

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      consumeDailyUse();
      if (onUsageUpdated) onUsageUpdated();

      btnExecuteZip.textContent = '¡ZIP Creado!';
      setTimeout(() => {
        btnExecuteZip.textContent = originalText;
        btnExecuteZip.disabled = false;
      }, 2000);

    } catch (err) {
      console.error('Error al generar ZIP:', err);
      showToast({ message: 'Error al comprimir archivos: ' + err.message, type: 'error' });
      btnExecuteZip.textContent = originalText;
      btnExecuteZip.disabled = false;
    }
  });

  // =========================================================================
  // 2. EXTRAER ARCHIVO ZIP
  // =========================================================================
  const zipExtractDropzone = document.getElementById('zip-extract-dropzone');
  const zipExtractInput = document.getElementById('zip-extract-file-input');
  const zipExtractList = document.getElementById('zip-extracted-files-list');

  async function handleZipToExtract(file) {
    if (!file || !file.name.endsWith('.zip')) {
      showToast({ message: 'Por favor selecciona un archivo comprimido .zip', type: 'warning' });
      return;
    }

    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);

      if (!zipExtractList) return;
      zipExtractList.innerHTML = '';

      const entries = Object.keys(zipData.files);
      if (entries.length === 0) {
        zipExtractList.innerHTML = '<div class="empty-list-notice">El archivo ZIP está vacío.</div>';
        return;
      }

      for (const filename of entries) {
        const zipEntry = zipData.files[filename];
        if (zipEntry.dir) continue; // Saltar directorios

        const item = document.createElement('div');
        item.className = 'pdf-image-item';
        item.innerHTML = `
          <div class="pdf-doc-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="pdf-image-meta">
            <span class="pdf-image-name">${filename}</span>
            <span class="pdf-image-size">Listo para descargar</span>
          </div>
          <button type="button" class="btn-demo-pill btn-dl-entry" style="font-size: 0.75rem;">Descargar</button>
        `;

        item.querySelector('.btn-dl-entry').onclick = async () => {
          const blob = await zipEntry.async('blob');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.split('/').pop();
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1000);
        };

        zipExtractList.appendChild(item);
      }

    } catch (err) {
      console.error('Error al extraer ZIP:', err);
      showToast({ message: 'No se pudo leer el archivo ZIP: ' + err.message, type: 'error' });
    }
  }

  if (zipExtractDropzone) {
    zipExtractDropzone.onclick = () => zipExtractInput?.click();
    zipExtractInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleZipToExtract(file);
    });
  }

  // =========================================================================
  // 3. CONVERSOR BASE64
  // =========================================================================
  const b64FileInput = document.getElementById('b64-file-input');
  const b64Dropzone = document.getElementById('b64-dropzone');
  const b64Output = document.getElementById('b64-output-text');
  const btnCopyB64 = document.getElementById('btn-copy-b64');

  if (b64Dropzone) {
    b64Dropzone.onclick = () => b64FileInput?.click();
    b64FileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (b64Output) b64Output.value = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  btnCopyB64?.addEventListener('click', async () => {
    if (b64Output?.value) {
      await navigator.clipboard.writeText(b64Output.value);
      btnCopyB64.textContent = '¡Copiado!';
      setTimeout(() => {
        btnCopyB64.textContent = 'Copiar Base64';
      }, 1500);
    }
  });
}
