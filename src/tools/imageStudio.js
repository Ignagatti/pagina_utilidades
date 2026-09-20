/**
 * Herramienta: Image Studio (Laboratorio de Imágenes 100% en el Navegador)
 * Permite comprimir con control de calidad y cálculo de ahorro, redimensionar,
 * convertir entre formatos (JPG, PNG, WebP), pasar a blanco y negro,
 * rotar/voltear, eliminar metadatos EXIF y generar favicons.
 */

import { canPerformDownload, consumeDailyUse } from '../services/storage.js';

let originalImage = null;
let originalFile = null;
let originalWidth = 0;
let originalHeight = 0;
let rotationAngle = 0;
let flipH = false;
let flipV = false;

/**
 * Formatea bytes a KB o MB
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function initImageStudio({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('image-studio-dropzone');
  const fileInput = document.getElementById('image-studio-file-input');
  const workspace = document.getElementById('image-studio-workspace');

  // Preview y Métricas
  const previewImg = document.getElementById('img-preview-canvas');
  const origSizeEl = document.getElementById('img-orig-size');
  const estSizeEl = document.getElementById('img-est-size');
  const savingsPill = document.getElementById('img-savings-pill');
  const origDimEl = document.getElementById('img-orig-dim');

  // Controles
  const sliderQuality = document.getElementById('slider-img-quality');
  const qualityValueLabel = document.getElementById('img-quality-val');
  const selectFormat = document.getElementById('select-img-format');
  const inputWidth = document.getElementById('input-img-width');
  const inputHeight = document.getElementById('input-img-height');
  const checkKeepAspect = document.getElementById('check-keep-aspect');
  const checkGrayscale = document.getElementById('check-img-grayscale');
  const checkStripExif = document.getElementById('check-strip-exif');

  // Botones de orientación
  const btnRotateLeft = document.getElementById('btn-img-rotate-left');
  const btnRotateRight = document.getElementById('btn-img-rotate-right');
  const btnFlipH = document.getElementById('btn-img-flip-h');
  const btnFlipV = document.getElementById('btn-img-flip-v');

  // Presets de porcentaje
  const presetBtns = document.querySelectorAll('.img-scale-btn');

  // Acciones
  const btnDownloadImage = document.getElementById('btn-download-processed-img');
  const btnExportFavicons = document.getElementById('btn-export-favicons');
  const btnChangeImage = document.getElementById('btn-img-change-file');

  if (!dropzone || !workspace) return;

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (JPG, PNG, WebP).');
      return;
    }

    originalFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImage = img;
        originalWidth = img.naturalWidth;
        originalHeight = img.naturalHeight;
        rotationAngle = 0;
        flipH = false;
        flipV = false;

        if (inputWidth) inputWidth.value = originalWidth;
        if (inputHeight) inputHeight.value = originalHeight;
        if (origDimEl) origDimEl.textContent = `${originalWidth} x ${originalHeight} px`;
        if (origSizeEl) origSizeEl.textContent = formatBytes(file.size);

        // Seleccionar formato inicial según archivo
        if (selectFormat) {
          if (file.type === 'image/png') selectFormat.value = 'image/png';
          else if (file.type === 'image/webp') selectFormat.value = 'image/webp';
          else selectFormat.value = 'image/jpeg';
        }

        dropzone.style.display = 'none';
        workspace.style.display = 'block';

        updateProcessedImage();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Genera la imagen procesada en Canvas
  function getProcessedCanvas() {
    if (!originalImage) return null;

    let targetW = parseInt(inputWidth?.value) || originalWidth;
    let targetH = parseInt(inputHeight?.value) || originalHeight;

    targetW = Math.max(1, Math.min(8000, targetW));
    targetH = Math.max(1, Math.min(8000, targetH));

    const canvas = document.createElement('canvas');
    const isSideways = (rotationAngle % 180 !== 0);

    canvas.width = isSideways ? targetH : targetW;
    canvas.height = isSideways ? targetW : targetH;

    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    if (checkGrayscale?.checked) {
      ctx.filter = 'grayscale(100%)';
    }

    ctx.drawImage(originalImage, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();

    return canvas;
  }

  // Actualiza la vista previa y el cálculo de ahorro de peso
  async function updateProcessedImage() {
    const canvas = getProcessedCanvas();
    if (!canvas) return;

    const format = selectFormat?.value || 'image/jpeg';
    const quality = (parseInt(sliderQuality?.value) || 85) / 100;

    if (previewImg) {
      previewImg.width = canvas.width;
      previewImg.height = canvas.height;
      const ctx = previewImg.getContext('2d');
      ctx.clearRect(0, 0, previewImg.width, previewImg.height);
      ctx.drawImage(canvas, 0, 0);
    }

    // Calcular tamaño estimado de salida
    canvas.toBlob((blob) => {
      if (!blob) return;

      if (estSizeEl) estSizeEl.textContent = formatBytes(blob.size);

      if (savingsPill && originalFile) {
        const diff = originalFile.size - blob.size;
        const percent = Math.round((diff / originalFile.size) * 100);

        if (percent > 0) {
          savingsPill.textContent = `-${percent}% de ahorro`;
          savingsPill.className = 'tier-badge pro';
        } else if (percent < 0) {
          savingsPill.textContent = `+${Math.abs(percent)}% mayor`;
          savingsPill.className = 'tier-badge free';
        } else {
          savingsPill.textContent = 'Mismo tamaño';
          savingsPill.className = 'tier-badge free';
        }
      }
    }, format, quality);
  }

  // Eventos de Dropzone
  dropzone.onclick = () => fileInput?.click();
  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
    if (file) handleFile(file);
  });

  // Slider de calidad
  sliderQuality?.addEventListener('input', () => {
    if (qualityValueLabel) qualityValueLabel.textContent = `${sliderQuality.value}%`;
    updateProcessedImage();
  });

  selectFormat?.addEventListener('change', updateProcessedImage);
  checkGrayscale?.addEventListener('change', updateProcessedImage);

  // Redimensionado con bloqueo de aspecto
  inputWidth?.addEventListener('input', () => {
    if (checkKeepAspect?.checked && originalWidth && originalHeight) {
      const w = parseInt(inputWidth.value) || 1;
      const h = Math.round((w / originalWidth) * originalHeight);
      if (inputHeight) inputHeight.value = h;
    }
    updateProcessedImage();
  });

  inputHeight?.addEventListener('input', () => {
    if (checkKeepAspect?.checked && originalWidth && originalHeight) {
      const h = parseInt(inputHeight.value) || 1;
      const w = Math.round((h / originalHeight) * originalWidth);
      if (inputWidth) inputWidth.value = w;
    }
    updateProcessedImage();
  });

  // Presets de escala (25%, 50%, 75%, 100%)
  presetBtns.forEach(btn => {
    btn.onclick = () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const scale = parseFloat(btn.dataset.scale) || 1;
      if (inputWidth) inputWidth.value = Math.round(originalWidth * scale);
      if (inputHeight) inputHeight.value = Math.round(originalHeight * scale);
      updateProcessedImage();
    };
  });

  // Controles de Rotación y Volteo
  btnRotateLeft?.addEventListener('click', () => {
    rotationAngle = (rotationAngle - 90 + 360) % 360;
    updateProcessedImage();
  });

  btnRotateRight?.addEventListener('click', () => {
    rotationAngle = (rotationAngle + 90) % 360;
    updateProcessedImage();
  });

  btnFlipH?.addEventListener('click', () => {
    flipH = !flipH;
    updateProcessedImage();
  });

  btnFlipV?.addEventListener('click', () => {
    flipV = !flipV;
    updateProcessedImage();
  });

  // Cambiar imagen
  btnChangeImage?.addEventListener('click', () => {
    originalImage = null;
    originalFile = null;
    if (fileInput) fileInput.value = '';
    workspace.style.display = 'none';
    dropzone.style.display = 'block';
  });

  // Descargar imagen procesada
  btnDownloadImage?.addEventListener('click', () => {
    const canvas = getProcessedCanvas();
    if (!canvas) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const format = selectFormat?.value || 'image/jpeg';
    const quality = (parseInt(sliderQuality?.value) || 85) / 100;

    let ext = 'jpg';
    if (format === 'image/png') ext = 'png';
    else if (format === 'image/webp') ext = 'webp';

    const cleanBaseName = (originalFile?.name || 'imagen').replace(/\.[^/.]+$/, '');
    const outFileName = `${cleanBaseName}-optimizado.${ext}`;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outFileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      consumeDailyUse();
      if (onUsageUpdated) onUsageUpdated();
    }, format, quality);
  });

  // Generador de Favicons (descarga pack de tamaños 16x16, 32x32, 180x180)
  btnExportFavicons?.addEventListener('click', async () => {
    if (!originalImage) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const sizes = [16, 32, 64, 180];
    for (const s of sizes) {
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      ctx.drawImage(originalImage, 0, 0, s, s);

      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `favicon-${s}x${s}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 800);
      }, 'image/png');
    }

    consumeDailyUse();
    if (onUsageUpdated) onUsageUpdated();
    alert('Pack de favicons generado con éxito (16x16, 32x32, 64x64 y 180x180 PNG).');
  });
}
