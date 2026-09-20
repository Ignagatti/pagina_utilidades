import { PDFDocument } from 'pdf-lib';
import { isProUser, canPerformDownload, consumeDailyUse } from '../services/storage.js';

let mergeFiles = [];
let isMerging = false;

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

export function initPdfMerge({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('merge-dropzone');
  const fileInput = document.getElementById('merge-file-input');
  const listContainer = document.getElementById('merge-files-list');
  const btnMerge = document.getElementById('btn-execute-merge');
  const clearBtn = document.getElementById('btn-clear-merge-files');
  const countBadge = document.getElementById('merge-count-badge');

  function renderList() {
    if (!listContainer) return;

    if (mergeFiles.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-list-notice">
          No hay archivos PDF añadidos aún. Selecciona o arrastra al menos 2 documentos para combinarlos.
        </div>
      `;
      if (btnMerge) btnMerge.disabled = true;
      if (clearBtn) clearBtn.style.display = 'none';
      if (countBadge) countBadge.textContent = '0 archivos';
      return;
    }

    if (btnMerge) btnMerge.disabled = mergeFiles.length < 2;
    if (clearBtn) clearBtn.style.display = 'inline-block';
    if (countBadge) {
      countBadge.textContent = `${mergeFiles.length} ${mergeFiles.length === 1 ? 'archivo' : 'archivos'}`;
    }

    listContainer.innerHTML = mergeFiles.map((item, index) => `
      <div class="pdf-image-item" data-id="${item.id}">
        <div class="pdf-doc-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="pdf-image-meta">
          <span class="pdf-image-name" title="${item.file.name}">${item.file.name}</span>
          <span class="pdf-image-size">${(item.file.size / 1024).toFixed(0)} KB • Posición ${index + 1}</span>
        </div>
        <div class="item-reorder-actions">
          <button type="button" class="btn-move-file btn-move-up" data-id="${item.id}" ${index === 0 ? 'disabled' : ''} title="Mover arriba">↑</button>
          <button type="button" class="btn-move-file btn-move-down" data-id="${item.id}" ${index === mergeFiles.length - 1 ? 'disabled' : ''} title="Mover abajo">↓</button>
        </div>
        <button type="button" class="btn-remove-image-item" data-id="${item.id}" title="Eliminar">&times;</button>
      </div>
    `).join('');

    // Reordenamiento arriba / abajo
    listContainer.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const idx = mergeFiles.findIndex(f => f.id === id);
        if (idx > 0) {
          const temp = mergeFiles[idx];
          mergeFiles[idx] = mergeFiles[idx - 1];
          mergeFiles[idx - 1] = temp;
          renderList();
        }
      };
    });

    listContainer.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const idx = mergeFiles.findIndex(f => f.id === id);
        if (idx < mergeFiles.length - 1) {
          const temp = mergeFiles[idx];
          mergeFiles[idx] = mergeFiles[idx + 1];
          mergeFiles[idx + 1] = temp;
          renderList();
        }
      };
    });

    listContainer.querySelectorAll('.btn-remove-image-item').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        mergeFiles = mergeFiles.filter(f => f.id !== id);
        renderList();
      };
    });
  }

  function handleFiles(files) {
    const isPro = isProUser();
    const arr = Array.from(files);

    for (const f of arr) {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        alert(`"${f.name}" no es un archivo PDF válido.`);
        continue;
      }

      // Regla plan gratuito: hasta 4 archivos PDF para unir
      if (!isPro && mergeFiles.length >= 4) {
        if (onProModalRequested) onProModalRequested('general');
        break;
      }

      mergeFiles.push({
        id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        file: f
      });
    }

    renderList();
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
    dropzone.ondragleave = () => dropzone.classList.remove('drag-active');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      mergeFiles = [];
      renderList();
    };
  }

  if (btnMerge) {
    btnMerge.onclick = async () => {
      if (isMerging || mergeFiles.length < 2) return;

      if (!canPerformDownload()) {
        if (onProModalRequested) onProModalRequested('daily_limit');
        return;
      }

      isMerging = true;
      const originalText = btnMerge.textContent;
      btnMerge.textContent = 'Uniendo documentos...';
      btnMerge.style.pointerEvents = 'none';

      try {
        const mergedDoc = await PDFDocument.create();

        for (const item of mergeFiles) {
          const fileBytes = await item.file.arrayBuffer();
          const doc = await PDFDocument.load(fileBytes);
          const pageIndices = doc.getPageIndices();
          const copiedPages = await mergedDoc.copyPages(doc, pageIndices);
          copiedPages.forEach(p => mergedDoc.addPage(p));
        }

        const mergedBytes = await mergedDoc.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        downloadBlob(blob, `documentos-unidos-${Date.now()}.pdf`);

        consumeDailyUse();
        if (onUsageUpdated) onUsageUpdated();

        btnMerge.textContent = 'PDFs Unidos con Éxito';
        setTimeout(() => {
          btnMerge.textContent = originalText;
        }, 1500);
      } catch (err) {
        console.error('Error al unir PDFs:', err);
        alert('Ocurrió un error al combinar los archivos PDF.');
        btnMerge.textContent = originalText;
      } finally {
        btnMerge.style.pointerEvents = '';
        setTimeout(() => { isMerging = false; }, 600);
      }
    };
  }

  renderList();
}
