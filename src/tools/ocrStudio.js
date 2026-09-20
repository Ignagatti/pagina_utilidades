/**
 * Herramienta: OCR Studio (Reconocimiento Óptico de Caracteres 100% en el Navegador)
 * Utiliza Tesseract.js en un Web Worker para extraer texto de fotos, recibos,
 * capturas de pantalla y documentos escaneados sin enviar datos a servidores externos.
 */

import { canPerformDownload, consumeDailyUse } from '../services/storage.js';

let ocrWorker = null;
let currentOcrLang = null;
let isRecognizing = false;

async function getOcrWorker(lang, onProgress) {
  if (ocrWorker && currentOcrLang === lang) {
    return ocrWorker;
  }

  // Importar dinámicamente Tesseract.js para no ralentizar el inicio
  const { createWorker } = await import('tesseract.js');

  if (ocrWorker) {
    await ocrWorker.terminate();
  }

  ocrWorker = await createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text' && m.progress !== undefined) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  currentOcrLang = lang;
  return ocrWorker;
}

export function initOcrStudio({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('ocr-dropzone');
  const fileInput = document.getElementById('ocr-file-input');
  const previewImg = document.getElementById('ocr-image-preview');
  const previewBox = document.getElementById('ocr-preview-box');
  const selectLang = document.getElementById('select-ocr-lang');
  const btnExecuteOcr = document.getElementById('btn-execute-ocr');
  const btnChangeImage = document.getElementById('btn-ocr-change-image');

  const progressBox = document.getElementById('ocr-progress-box');
  const progressBar = document.getElementById('ocr-progress-bar');
  const progressText = document.getElementById('ocr-progress-text');

  const outputTextarea = document.getElementById('ocr-output-text');
  const wordsBadge = document.getElementById('ocr-word-count');
  const charsBadge = document.getElementById('ocr-char-count');
  const btnCopyOcr = document.getElementById('btn-copy-ocr');
  const btnDownloadTxt = document.getElementById('btn-download-ocr-txt');
  const btnClearOcr = document.getElementById('btn-clear-ocr');

  let selectedFile = null;

  if (!dropzone || !outputTextarea) return;

  function updateCounters() {
    const text = (outputTextarea.value || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;

    if (wordsBadge) wordsBadge.textContent = `${words} palabras`;
    if (charsBadge) charsBadge.textContent = `${chars} caracteres`;

    const hasText = text.length > 0;
    if (btnCopyOcr) btnCopyOcr.disabled = !hasText;
    if (btnDownloadTxt) btnDownloadTxt.disabled = !hasText;
    if (btnClearOcr) btnClearOcr.disabled = !hasText;
  }

  outputTextarea.addEventListener('input', updateCounters);
  updateCounters();

  function handleOcrFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen o captura de pantalla.');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      dropzone.style.display = 'none';
      if (previewBox) previewBox.style.display = 'block';
      if (btnExecuteOcr) btnExecuteOcr.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  dropzone.onclick = () => fileInput?.click();
  fileInput?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) handleOcrFile(f);
  });

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
    const f = e.dataTransfer.files?.[0];
    if (f) handleOcrFile(f);
  });

  btnChangeImage?.addEventListener('click', () => {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (previewBox) previewBox.style.display = 'none';
    dropzone.style.display = 'block';
    if (btnExecuteOcr) btnExecuteOcr.disabled = true;
    if (progressBox) progressBox.style.display = 'none';
  });

  btnExecuteOcr?.addEventListener('click', async () => {
    if (!selectedFile || isRecognizing) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    isRecognizing = true;
    btnExecuteOcr.disabled = true;
    const originalText = btnExecuteOcr.textContent;
    btnExecuteOcr.textContent = 'Iniciando motor OCR...';

    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) progressBar.style.width = '10%';
    if (progressText) progressText.textContent = 'Cargando motor de OCR en Web Worker...';

    try {
      const lang = selectLang?.value || 'spa';
      const worker = await getOcrWorker(lang, (percent) => {
        if (progressBar) progressBar.style.width = `${Math.max(15, percent)}%`;
        if (progressText) progressText.textContent = `Reconociendo texto: ${percent}%`;
      });

      if (progressText) progressText.textContent = 'Analizando caracteres ópticos...';
      const ret = await worker.recognize(selectedFile);
      const recognizedText = (ret?.data?.text || '').trim();

      if (!recognizedText) {
        alert('No se detectó texto legible en la imagen. Intenta con una imagen más nítida o con mayor iluminación.');
      } else {
        const current = outputTextarea.value.trim();
        outputTextarea.value = current ? `${current}\n\n${recognizedText}` : recognizedText;
        updateCounters();

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '¡Texto extraído con éxito!';

        consumeDailyUse();
        if (onUsageUpdated) onUsageUpdated();

        setTimeout(() => {
          if (progressBox) progressBox.style.display = 'none';
        }, 3000);
      }
    } catch (err) {
      console.error('Error en OCR:', err);
      alert('Hubo un error al procesar el OCR: ' + err.message);
      if (progressText) progressText.textContent = 'Error: ' + err.message;
    } finally {
      isRecognizing = false;
      btnExecuteOcr.disabled = false;
      btnExecuteOcr.textContent = originalText;
    }
  });

  btnCopyOcr?.addEventListener('click', async () => {
    if (outputTextarea?.value) {
      await navigator.clipboard.writeText(outputTextarea.value);
      const label = btnCopyOcr.querySelector('.btn-label') || btnCopyOcr;
      const original = label.textContent;
      label.textContent = '¡Copiado!';
      setTimeout(() => {
        label.textContent = original;
      }, 1500);
    }
  });

  btnDownloadTxt?.addEventListener('click', () => {
    const text = outputTextarea.value;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-texto-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  });

  btnClearOcr?.addEventListener('click', () => {
    if (confirm('¿Deseas vaciar el texto extraído?')) {
      outputTextarea.value = '';
      updateCounters();
    }
  });
}
