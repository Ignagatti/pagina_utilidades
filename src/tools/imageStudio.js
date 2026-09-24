/**
 * Herramienta: Image Studio & Conversor Masivo 2.0 (100% en el Navegador)
 * Permite comprimir con control de calidad y cálculo de ahorro, redimensionar,
 * convertir entre formatos reales (JPG, PNG, WebP, AVIF, Favicons), pasar a blanco y negro,
 * gestionar transparencias (fondo blanco para JPG) y procesar lotes masivos de imágenes a .ZIP.
 */

import JSZip from 'jszip';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';
import { isImageFile, isHeicFile, normalizeImageFile } from '../utils/imageDecoder.js';
import { createIcoBlob } from '../utils/icoEncoder.js';
import { showToast } from '../utils/dialog.js';

let originalImage = null;
let originalFile = null;
let originalWidth = 0;
let originalHeight = 0;
let rotationAngle = 0;
let flipH = false;
let flipV = false;

// Estado del Conversor Masivo por Lotes
let batchFiles = []; // Array de { id, file, img, origSize, status, convertedBlob, convertedUrl, outName }

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
  // Pestañas de modo (Individual vs Masivo)
  const tabBtnSingle = document.getElementById('btn-img-tab-single');
  const tabBtnBatch = document.getElementById('btn-img-tab-batch');
  const panelSingle = document.getElementById('img-panel-single');
  const panelBatch = document.getElementById('img-panel-batch');

  // MODO INDIVIDUAL
  const dropzoneSingle = document.getElementById('image-studio-dropzone');
  const fileInputSingle = document.getElementById('image-studio-file-input');
  const workspaceSingle = document.getElementById('image-studio-workspace');

  const previewImg = document.getElementById('img-preview-canvas');
  const origSizeEl = document.getElementById('img-orig-size');
  const estSizeEl = document.getElementById('img-est-size');
  const savingsPill = document.getElementById('img-savings-pill');
  const origDimEl = document.getElementById('img-orig-dim');

  const sliderQuality = document.getElementById('slider-img-quality');
  const qualityValueLabel = document.getElementById('img-quality-val');
  const selectFormat = document.getElementById('select-img-format');
  const inputBgColor = document.getElementById('input-img-bg-color');
  const wrapBgColor = document.getElementById('wrap-img-bg-color');
  const wrapIcoSizes = document.getElementById('wrap-ico-sizes');
  const btnIcoSelectAll = document.getElementById('btn-ico-select-all-sizes');
  const checkIcoSizes = document.querySelectorAll('.check-ico-size');
  const btnExportIco = document.getElementById('btn-export-ico');
  const inputWidth = document.getElementById('input-img-width');
  const inputHeight = document.getElementById('input-img-height');
  const checkKeepAspect = document.getElementById('check-keep-aspect');
  const checkGrayscale = document.getElementById('check-img-grayscale');

  // Controles de Realce y Calidad
  const checkAutoEnhance = document.getElementById('check-img-auto-enhance');
  const checkDocMode = document.getElementById('check-img-doc-mode');
  const sliderSharpen = document.getElementById('slider-img-sharpen');
  const sharpenValLabel = document.getElementById('img-sharpen-val');
  const sliderBrightness = document.getElementById('slider-img-brightness');
  const brightnessValLabel = document.getElementById('img-brightness-val');
  const sliderContrast = document.getElementById('slider-img-contrast');
  const contrastValLabel = document.getElementById('img-contrast-val');

  const btnRotateLeft = document.getElementById('btn-img-rotate-left');
  const btnRotateRight = document.getElementById('btn-img-rotate-right');
  const btnFlipH = document.getElementById('btn-img-flip-h');
  const btnFlipV = document.getElementById('btn-img-flip-v');
  const presetBtns = document.querySelectorAll('.img-scale-btn');

  const btnDownloadImage = document.getElementById('btn-download-processed-img');
  const btnExportFavicons = document.getElementById('btn-export-favicons');
  const btnChangeImage = document.getElementById('btn-img-change-file');

  // Botones de presets rápidos de formato
  const formatPresetBtns = document.querySelectorAll('.btn-format-preset');

  // MODO MASIVO POR LOTES
  const dropzoneBatch = document.getElementById('img-batch-dropzone');
  const fileInputBatch = document.getElementById('img-batch-file-input');
  const batchListContainer = document.getElementById('img-batch-list-container');
  const batchTableBody = document.getElementById('img-batch-table-body');
  const batchCountBadge = document.getElementById('img-batch-count-badge');
  const selectBatchFormat = document.getElementById('select-batch-format');
  const sliderBatchQuality = document.getElementById('slider-batch-quality');
  const batchQualityVal = document.getElementById('batch-quality-val');
  const selectBatchResize = document.getElementById('select-batch-resize');
  const checkBatchWhiteBg = document.getElementById('check-batch-white-bg');
  const btnConvertBatchAll = document.getElementById('btn-convert-batch-all');
  const btnClearBatch = document.getElementById('btn-clear-batch');
  const batchProgressBox = document.getElementById('batch-progress-box');
  const batchProgressBar = document.getElementById('batch-progress-bar');
  const batchProgressText = document.getElementById('batch-progress-text');


  function getSelectedIcoSizes() {
    const sizes = [];
    document.querySelectorAll('.check-ico-size').forEach(cb => {
      if (cb.checked) {
        const val = parseInt(cb.value);
        if (!isNaN(val)) sizes.push(val);
      }
    });
    return sizes.length > 0 ? sizes : [16, 32, 48, 64, 128, 256];
  }

  btnIcoSelectAll?.addEventListener('click', () => {
    document.querySelectorAll('.check-ico-size').forEach(cb => cb.checked = true);
  });

  // 1. Cambio de pestañas
  tabBtnSingle?.addEventListener('click', () => {
    tabBtnSingle.classList.add('active');
    tabBtnBatch?.classList.remove('active');
    if (panelSingle) panelSingle.style.display = 'block';
    if (panelBatch) panelBatch.style.display = 'none';
  });

  tabBtnBatch?.addEventListener('click', () => {
    tabBtnBatch.classList.add('active');
    tabBtnSingle?.classList.remove('active');
    if (panelSingle) panelSingle.style.display = 'none';
    if (panelBatch) panelBatch.style.display = 'block';
  });

  // 2. Procesamiento Individual
  async function handleSingleFile(file) {
    if (!file || !isImageFile(file)) {
      showToast({ message: 'Por favor selecciona una imagen válida (JPG, PNG, WebP, AVIF, HEIC, etc.).', type: 'warning' });
      return;
    }

    originalFile = file;
    const isHeic = isHeicFile(file);

    if (dropzoneSingle && isHeic) {
      const p = dropzoneSingle.querySelector('p');
      if (p) p.textContent = 'Decodificando foto HEIC de Apple en el navegador...';
    }

    try {
      const { url } = await normalizeImageFile(file);
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

        if (selectFormat) {
          if (file.type === 'image/png') selectFormat.value = 'image/jpeg'; // Sugerir conversión a JPG
          else if (file.type === 'image/webp') selectFormat.value = 'image/jpeg';
          else if (isHeic) selectFormat.value = 'image/jpeg';
          else selectFormat.value = 'image/webp';
        }

        checkBgColorVisibility();

        if (dropzoneSingle) {
          dropzoneSingle.style.display = 'none';
          const p = dropzoneSingle.querySelector('p');
          if (p) p.textContent = 'Soporta PNG, JPG, WebP, AVIF, HEIC / iPhone, GIF y BMP';
        }
        if (workspaceSingle) workspaceSingle.style.display = 'block';

        updateProcessedImage();
      };
      img.onerror = () => {
        showToast({ message: 'No se pudo cargar la imagen.', type: 'error' });
        if (dropzoneSingle) {
          const p = dropzoneSingle.querySelector('p');
          if (p) p.textContent = 'Soporta PNG, JPG, WebP, AVIF, HEIC / iPhone, GIF y BMP';
        }
      };
      img.src = url;
    } catch (err) {
      console.error('Error procesando imagen individual:', err);
      showToast({ message: 'No se pudo procesar la imagen: ' + (err.message || 'Error desconocido'), type: 'error' });
      if (dropzoneSingle) {
        const p = dropzoneSingle.querySelector('p');
        if (p) p.textContent = 'Soporta PNG, JPG, WebP, AVIF, HEIC / iPhone, GIF y BMP';
      }
    }
  }

  function checkBgColorVisibility() {
    if (!wrapBgColor || !selectFormat) return;
    const isJpg = selectFormat.value === 'image/jpeg';
    wrapBgColor.style.display = isJpg ? 'block' : 'none';
  }

  /**
   * Aplica un kernel de convolución 3x3 de nitidez optimizado de alto rendimiento
   */
  function applySharpen(imageData, strength) {
    if (strength <= 0) return imageData;
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;
    const output = new ImageData(sw, sh);
    const dst = output.data;
    const wCenter = 1 + (4 * strength);
    const wEdge = -strength;

    // Copia inicial rápida
    dst.set(src);

    // Procesamiento directo de píxeles interiores sin bucles 2D anidados ni llamadas Math.min/max
    for (let y = 1; y < sh - 1; y++) {
      const ySw = y * sw;
      const yPrevSw = (y - 1) * sw;
      const yNextSw = (y + 1) * sw;

      for (let x = 1; x < sw - 1; x++) {
        const idx = (ySw + x) << 2;
        const top = (yPrevSw + x) << 2;
        const bottom = (yNextSw + x) << 2;
        const left = (ySw + x - 1) << 2;
        const right = (ySw + x + 1) << 2;

        const r = src[idx] * wCenter + (src[top] + src[bottom] + src[left] + src[right]) * wEdge;
        const g = src[idx + 1] * wCenter + (src[top + 1] + src[bottom + 1] + src[left + 1] + src[right + 1]) * wEdge;
        const b = src[idx + 2] * wCenter + (src[top + 2] + src[bottom + 2] + src[left + 2] + src[right + 2]) * wEdge;

        dst[idx] = r < 0 ? 0 : (r > 255 ? 255 : r);
        dst[idx + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        dst[idx + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
      }
    }
    return output;
  }

  /**
   * Auto-realce inteligente de balance de iluminación y contraste
   */
  function applyAutoEnhance(imageData) {
    const d = imageData.data;
    const len = d.length;
    let minL = 255, maxL = 0;

    for (let i = 0; i < len; i += 4) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
    }

    const range = (maxL - minL) || 1;
    for (let i = 0; i < len; i += 4) {
      d[i] = Math.min(255, Math.max(0, ((d[i] - minL) / range) * 255 * 1.05));
      d[i + 1] = Math.min(255, Math.max(0, ((d[i + 1] - minL) / range) * 255 * 1.05));
      d[i + 2] = Math.min(255, Math.max(0, ((d[i + 2] - minL) / range) * 255 * 1.05));
    }
    return imageData;
  }

  /**
   * Modo documento / DNI: resalta texto oscuro y blanquea fondo grisáceo
   */
  function applyDocumentMode(imageData) {
    const d = imageData.data;
    const len = d.length;
    for (let i = 0; i < len; i += 4) {
      const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      let val;
      if (gray > 165) {
        val = 255;
      } else if (gray < 85) {
        val = Math.max(0, gray * 0.4);
      } else {
        val = ((gray - 85) / 80) * 255;
      }
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    return imageData;
  }

  /**
   * Genera el canvas procesado.
   * Si isExport es false (modo previsualización en vivo mientras se mueven sliders),
   * limita el tamaño a un máximo de 1000px para que mover sliders sea 100% fluido (60 FPS) en móviles.
   * Si isExport es true (al descargar), procesa la imagen a su máxima resolución original completa.
   */
  function getProcessedCanvas(isExport = false) {
    if (!originalImage) return null;

    let targetW = parseInt(inputWidth?.value) || originalWidth;
    let targetH = parseInt(inputHeight?.value) || originalHeight;

    targetW = Math.max(1, Math.min(8000, targetW));
    targetH = Math.max(1, Math.min(8000, targetH));

    let renderW = targetW;
    let renderH = targetH;

    // En previsualización interactiva rápida en móviles/pantallas, limitar a 1000px máx
    if (!isExport) {
      const maxPreviewDim = 1000;
      if (renderW > maxPreviewDim || renderH > maxPreviewDim) {
        if (renderW >= renderH) {
          renderH = Math.max(1, Math.round((renderH * maxPreviewDim) / renderW));
          renderW = maxPreviewDim;
        } else {
          renderW = Math.max(1, Math.round((renderW * maxPreviewDim) / renderH));
          renderH = maxPreviewDim;
        }
      }
    }

    const canvas = document.createElement('canvas');
    const isSideways = (rotationAngle % 180 !== 0);

    canvas.width = isSideways ? renderH : renderW;
    canvas.height = isSideways ? renderW : renderH;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isExport ? 'high' : 'medium';

    const format = selectFormat?.value || 'image/jpeg';
    if (format === 'image/jpeg') {
      const bgColor = inputBgColor?.value || '#FFFFFF';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Filtros CSS de canvas para brillo y contraste (hardware-accelerated)
    const brightnessVal = parseInt(sliderBrightness?.value) || 0;
    const contrastVal = parseInt(sliderContrast?.value) || 0;
    const bFactor = 1 + (brightnessVal / 100);
    const cFactor = 1 + (contrastVal / 100);

    let filters = [];
    if (checkGrayscale?.checked) filters.push('grayscale(100%)');
    if (brightnessVal !== 0) filters.push(`brightness(${bFactor})`);
    if (contrastVal !== 0) filters.push(`contrast(${cFactor})`);

    if (filters.length > 0) {
      ctx.filter = filters.join(' ');
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    ctx.drawImage(originalImage, -renderW / 2, -renderH / 2, renderW, renderH);
    ctx.restore();

    // Procesamiento por píxeles (Auto-Realce, Modo Documento, Nitidez)
    const isDoc = checkDocMode?.checked;
    const isAuto = checkAutoEnhance?.checked;
    const sharpenLevel = parseInt(sliderSharpen?.value) || 0;

    if (isDoc || isAuto || sharpenLevel > 0) {
      try {
        let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (isDoc) {
          imgData = applyDocumentMode(imgData);
        } else if (isAuto) {
          imgData = applyAutoEnhance(imgData);
        }
        if (sharpenLevel > 0) {
          const strength = (sharpenLevel / 100) * 0.7;
          imgData = applySharpen(imgData, strength);
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        console.warn('No se pudo aplicar procesamiento de píxeles:', err);
      }
    }

    return canvas;
  }

  let isUpdatingPreview = false;
  let pendingUpdate = false;
  let toBlobDebounceTimer = null;

  /**
   * Actualiza la previsualización de forma suave y sin tirones mediante requestAnimationFrame
   */
  function updateProcessedImage(immediate = false) {
    if (immediate) {
      renderCurrentPreview();
      return;
    }

    if (isUpdatingPreview) {
      pendingUpdate = true;
      return;
    }

    isUpdatingPreview = true;
    requestAnimationFrame(() => {
      renderCurrentPreview();
      isUpdatingPreview = false;
      if (pendingUpdate) {
        pendingUpdate = false;
        updateProcessedImage(false);
      }
    });
  }

  function renderCurrentPreview() {
    const canvas = getProcessedCanvas(false);
    if (!canvas) return;

    if (previewImg) {
      previewImg.width = canvas.width;
      previewImg.height = canvas.height;
      const ctx = previewImg.getContext('2d');
      ctx.clearRect(0, 0, previewImg.width, previewImg.height);
      ctx.drawImage(canvas, 0, 0);
    }

    // Debounce del cálculo de tamaño (evita sobrecargar el encoder en cada movimiento táctil)
    if (toBlobDebounceTimer) clearTimeout(toBlobDebounceTimer);
    toBlobDebounceTimer = setTimeout(() => {
      const format = selectFormat?.value || 'image/jpeg';
      const quality = (parseInt(sliderQuality?.value) || 85) / 100;

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
    }, 180);
  }

  // Presets rápidos de formato (A JPG, A PNG, A WebP, A AVIF)
  formatPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetFormat = btn.dataset.format;
      if (selectFormat && targetFormat) {
        selectFormat.value = targetFormat;
        checkBgColorVisibility();
        updateProcessedImage();
      }
    });
  });

  dropzoneSingle?.addEventListener('click', () => fileInputSingle?.click());
  fileInputSingle?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleSingleFile(file);
  });

  ['dragenter', 'dragover'].forEach(ev => {
    dropzoneSingle?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneSingle.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzoneSingle?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneSingle.classList.remove('drag-active');
    });
  });

  dropzoneSingle?.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleSingleFile(file);
  });

  sliderQuality?.addEventListener('input', () => {
    if (qualityValueLabel) qualityValueLabel.textContent = `${sliderQuality.value}%`;
    updateProcessedImage();
  });

  selectFormat?.addEventListener('change', () => {
    checkBgColorVisibility();
    updateProcessedImage();
  });

  inputBgColor?.addEventListener('input', updateProcessedImage);
  checkGrayscale?.addEventListener('change', updateProcessedImage);

  checkAutoEnhance?.addEventListener('change', () => {
    if (checkAutoEnhance.checked && checkDocMode) {
      checkDocMode.checked = false;
    }
    updateProcessedImage();
  });

  checkDocMode?.addEventListener('change', () => {
    if (checkDocMode.checked && checkAutoEnhance) {
      checkAutoEnhance.checked = false;
    }
    updateProcessedImage();
  });

  sliderSharpen?.addEventListener('input', () => {
    if (sharpenValLabel) sharpenValLabel.textContent = `${sliderSharpen.value}%`;
    updateProcessedImage();
  });

  sliderBrightness?.addEventListener('input', () => {
    if (brightnessValLabel) brightnessValLabel.textContent = sliderBrightness.value > 0 ? `+${sliderBrightness.value}` : sliderBrightness.value;
    updateProcessedImage();
  });

  sliderContrast?.addEventListener('input', () => {
    if (contrastValLabel) contrastValLabel.textContent = sliderContrast.value > 0 ? `+${sliderContrast.value}` : sliderContrast.value;
    updateProcessedImage();
  });

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

  btnChangeImage?.addEventListener('click', () => {
    originalImage = null;
    originalFile = null;
    if (fileInputSingle) fileInputSingle.value = '';
    if (workspaceSingle) workspaceSingle.style.display = 'none';
    if (dropzoneSingle) dropzoneSingle.style.display = 'block';
  });

  btnDownloadImage?.addEventListener('click', async () => {
    const canvas = getProcessedCanvas(true);
    if (!canvas) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const format = selectFormat?.value || 'image/jpeg';
    const quality = (parseInt(sliderQuality?.value) || 85) / 100;

    const cleanBaseName = (originalFile?.name || 'imagen').replace(/\.[^/.]+$/, '');

    if (format === 'image/x-icon') {
      const icoSizes = getSelectedIcoSizes();
      const icoBlob = await createIcoBlob(canvas, icoSizes);
      const url = URL.createObjectURL(icoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanBaseName}.ico`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      consumeDailyUse();
      if (onUsageUpdated) onUsageUpdated();
      return;
    }

    let ext = 'jpg';
    if (format === 'image/png') ext = 'png';
    else if (format === 'image/webp') ext = 'webp';
    else if (format === 'image/avif') ext = 'avif';

    const outFileName = `${cleanBaseName}-convertido.${ext}`;

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

  btnExportIco?.addEventListener('click', async () => {
    if (!originalImage) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const canvas = previewImg;
    const cleanBaseName = (originalFile?.name || 'icono').replace(/\.[^/.]+$/, '');
    const icoSizes = getSelectedIcoSizes();
    const icoBlob = await createIcoBlob(canvas, icoSizes);

    const url = URL.createObjectURL(icoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanBaseName}.ico`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    consumeDailyUse();
    if (onUsageUpdated) onUsageUpdated();
  });

  btnExportFavicons?.addEventListener('click', async () => {
    if (!originalImage) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const zip = new JSZip();

    // 1. Generar archivo .ico multi-resolución (16, 32, 48)
    try {
      const icoBlob = await createIcoBlob(originalImage, [16, 32, 48]);
      zip.file('favicon.ico', icoBlob);
    } catch (err) {
      console.warn('No se pudo generar favicon.ico en el zip', err);
    }

    // 2. Generar tamaños PNG estándar
    const sizes = [16, 32, 48, 64, 180, 512];
    for (const s of sizes) {
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(originalImage, 0, 0, s, s);

      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      if (s === 180) {
        zip.file('apple-touch-icon.png', blob);
      } else {
        zip.file(`favicon-${s}x${s}.png`, blob);
      }
    }

    // 3. Snippet HTML listo para copiar en la web
    const htmlSnippet = `<!-- Nuvexa Favicon Pack -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
`;
    zip.file('instrucciones-html.txt', htmlSnippet);

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipContent);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pack-favicons-completo.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    consumeDailyUse();
  });

  // ==========================================
  // 3. MODO CONVERSOR MASIVO POR LOTES (BATCH)
  // ==========================================
  dropzoneBatch?.addEventListener('click', () => fileInputBatch?.click());

  fileInputBatch?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []).filter(f => isImageFile(f));
    if (files.length > 0) {
      addBatchFiles(files);
    }
  });

  ['dragenter', 'dragover'].forEach(ev => {
    dropzoneBatch?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneBatch.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropzoneBatch?.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzoneBatch.classList.remove('drag-active');
    });
  });

  dropzoneBatch?.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || []).filter(f => isImageFile(f));
    if (files.length > 0) {
      addBatchFiles(files);
    }
  });

  sliderBatchQuality?.addEventListener('input', () => {
    if (batchQualityVal) batchQualityVal.textContent = `${sliderBatchQuality.value}%`;
  });

  function addBatchFiles(files) {
    files.forEach(file => {
      if (!isImageFile(file)) return;
      const isHeic = isHeicFile(file);
      const id = 'batch-' + Math.random().toString(36).substring(2, 9);
      const fileObj = {
        id,
        file,
        name: file.name,
        origSize: file.size,
        thumbUrl: isHeic ? '' : URL.createObjectURL(file),
        status: isHeic ? 'heic_loading' : 'pending',
        convertedBlob: null,
        outName: ''
      };
      batchFiles.push(fileObj);

      if (isHeic) {
        normalizeImageFile(file).then(res => {
          fileObj.thumbUrl = res.url;
          fileObj.status = 'pending';
          fileObj.normalizedFile = res.file;
          renderBatchList();
        }).catch(err => {
          console.warn('Error decodificando miniatura HEIC:', err);
          fileObj.status = 'error';
          renderBatchList();
        });
      }
    });

    renderBatchList();
  }

  function renderBatchList() {
    if (!batchTableBody || !batchListContainer) return;

    if (batchFiles.length === 0) {
      batchListContainer.style.display = 'none';
      if (batchCountBadge) batchCountBadge.textContent = '0 archivos';
      return;
    }

    batchListContainer.style.display = 'block';
    if (batchCountBadge) batchCountBadge.textContent = `${batchFiles.length} imágenes`;

    const targetFormat = selectBatchFormat?.value || 'image/jpeg';
    let targetExt = 'JPG';
    if (targetFormat === 'image/png') targetExt = 'PNG';
    else if (targetFormat === 'image/webp') targetExt = 'WebP';
    else if (targetFormat === 'image/avif') targetExt = 'AVIF';

    batchTableBody.innerHTML = '';

    batchFiles.forEach((item) => {
      const tr = document.createElement('tr');
      tr.className = 'batch-table-row';

      let statusHtml = `<span class="tier-badge free">Listo para convertir</span>`;
      let actionBtnHtml = `<button type="button" class="btn-danger-sm btn-batch-remove" data-id="${item.id}" title="Quitar">Eliminar</button>`;

      if (item.status === 'heic_loading') {
        statusHtml = `<span class="tier-badge free" style="background:#fef3c7; color:#b45309;">Decodificando HEIC...</span>`;
      } else if (item.status === 'converting') {
        statusHtml = `<span class="tier-badge free" style="background:#e0f2fe; color:#0369a1;">Convirtiendo...</span>`;
      } else if (item.status === 'done') {
        const outSize = item.convertedBlob ? formatBytes(item.convertedBlob.size) : '';
        statusHtml = `<span class="tier-badge pro">Convertido (${outSize})</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-action-outline btn-batch-dl" data-id="${item.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
            Descargar
          </button>
          <button type="button" class="btn-danger-sm btn-batch-remove" data-id="${item.id}" title="Quitar">Eliminar</button>
        `;
      } else if (item.status === 'error') {
        statusHtml = `<span class="tier-badge free" style="background:#fee2e2; color:#b91c1c;">Error al decodificar</span>`;
      }

      const thumbImgHtml = item.thumbUrl
        ? `<img src="${item.thumbUrl}" class="batch-thumb-img" alt="${item.name}" />`
        : `<div class="batch-thumb-img" style="display:flex;align-items:center;justify-content:center;background:var(--color-surface);font-size:0.65rem;color:var(--color-primary);font-weight:700;">HEIC</div>`;

      tr.innerHTML = `
        <td style="width: 50px;">
          ${thumbImgHtml}
        </td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong>${item.name}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${formatBytes(item.origSize)}</div>
        </td>
        <td style="text-align: center;">
          <span style="font-weight: 600; font-size: 0.82rem; color: var(--color-primary);">${targetExt}</span>
        </td>
        <td>${statusHtml}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${actionBtnHtml}
        </td>
      `;

      batchTableBody.appendChild(tr);
    });

    // Eventos de botones individuales
    batchTableBody.querySelectorAll('.btn-batch-remove').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        batchFiles = batchFiles.filter(f => f.id !== id);
        renderBatchList();
      };
    });

    batchTableBody.querySelectorAll('.btn-batch-dl').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = batchFiles.find(f => f.id === id);
        if (item && item.convertedBlob) {
          const url = URL.createObjectURL(item.convertedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.outName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1000);
        }
      };
    });
  }

  selectBatchFormat?.addEventListener('change', renderBatchList);

  btnClearBatch?.addEventListener('click', () => {
    batchFiles = [];
    if (fileInputBatch) fileInputBatch.value = '';
    renderBatchList();
  });

  // Convertir todo el lote y descargar en ZIP
  btnConvertBatchAll?.addEventListener('click', async () => {
    if (batchFiles.length === 0) {
      showToast({ message: 'Por favor agrega imágenes para convertir.', type: 'warning' });
      return;
    }

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const targetFormat = selectBatchFormat?.value || 'image/jpeg';
    const quality = (parseInt(sliderBatchQuality?.value) || 85) / 100;
    const maxDimension = parseInt(selectBatchResize?.value) || 0;
    const forceWhiteBg = checkBatchWhiteBg?.checked ?? true;

    let targetExt = 'jpg';
    if (targetFormat === 'image/png') targetExt = 'png';
    else if (targetFormat === 'image/x-icon') targetExt = 'ico';
    else if (targetFormat === 'image/webp') targetExt = 'webp';
    else if (targetFormat === 'image/avif') targetExt = 'avif';

    btnConvertBatchAll.disabled = true;
    if (batchProgressBox) batchProgressBox.style.display = 'block';

    const zip = new JSZip();

    for (let i = 0; i < batchFiles.length; i++) {
      const item = batchFiles[i];
      item.status = 'converting';
      renderBatchList();

      if (batchProgressText) {
        batchProgressText.textContent = `Convirtiendo imagen ${i + 1} de ${batchFiles.length}: ${item.name}`;
      }
      if (batchProgressBar) {
        batchProgressBar.style.width = `${Math.round(((i + 1) / batchFiles.length) * 100)}%`;
      }

      try {
        const fileToConvert = item.normalizedFile || item.file;
        const convertedBlob = await convertSingleImageBlob(fileToConvert, {
          targetFormat,
          quality,
          maxDimension,
          forceWhiteBg
        });

        const cleanBase = item.name.replace(/\.[^/.]+$/, '');
        const outName = `${cleanBase}.${targetExt}`;

        item.status = 'done';
        item.convertedBlob = convertedBlob;
        item.outName = outName;

        zip.file(outName, convertedBlob);
      } catch (err) {
        console.error('Error convirtiendo imagen del lote:', err);
        item.status = 'error';
      }
    }

    renderBatchList();

    if (batchProgressText) batchProgressText.textContent = 'Generando archivo .ZIP...';

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imagenes-convertidas-${targetExt}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    consumeDailyUse();
    if (onUsageUpdated) onUsageUpdated();

    btnConvertBatchAll.disabled = false;
    if (batchProgressBox) {
      setTimeout(() => {
        batchProgressBox.style.display = 'none';
      }, 2500);
    }
  });

  /**
   * Decodifica y recodifica una imagen en memoria
   */
  async function convertSingleImageBlob(file, { targetFormat, quality, maxDimension, forceWhiteBg }) {
    let sourceFile = file;
    if (isHeicFile(file)) {
      const res = await normalizeImageFile(file);
      sourceFile = res.file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          if (maxDimension > 0 && (w > maxDimension || h > maxDimension)) {
            if (w >= h) {
              h = Math.round((maxDimension / w) * h);
              w = maxDimension;
            } else {
              w = Math.round((maxDimension / h) * w);
              h = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          // Si el formato es JPEG o se pide fondo blanco, pintar blanco primero
          if (targetFormat === 'image/jpeg' || forceWhiteBg) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
          }

          ctx.drawImage(img, 0, 0, w, h);

          if (targetFormat === 'image/x-icon') {
            createIcoBlob(canvas, [16, 32, 48, 64, 128, 256])
              .then(resolve)
              .catch(reject);
            return;
          }

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Fallo en la compresión'));
          }, targetFormat, quality);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(sourceFile);
    });
  }
}
