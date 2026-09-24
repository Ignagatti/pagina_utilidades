import QRCodeStyling from 'qr-code-styling';
import { isProUser, canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { sanitizeQRInput, validateImageFile } from '../utils/security.js';
import { generateQRPdf } from '../utils/pdfExport.js';
import { showToast } from '../utils/dialog.js';

let qrCodeInstance = null;
let currentLogoUrl = null;
let isDownloading = false;
let selectedExportFormat = 'png';

const defaultOptions = {
  width: 500,
  height: 500,
  type: 'canvas',
  data: 'https://google.com',
  image: '',
  margin: 15,
  qrOptions: {
    typeNumber: 0,
    mode: 'Byte',
    errorCorrectionLevel: 'Q'
  },
  imageOptions: {
    saveAsBlob: false,
    hideBackgroundDots: true,
    imageSize: 0.28,
    margin: 4
  },
  dotsOptions: {
    color: '#172B4D',
    type: 'rounded'
  },
  backgroundOptions: {
    color: '#ffffff',
  },
  cornersSquareOptions: {
    color: '#172B4D',
    type: 'extra-rounded'
  },
  cornersDotOptions: {
    color: '#0052CC',
    type: 'dot'
  }
};

function getSanitizedData() {
  const activeTab = document.querySelector('.type-btn.active')?.dataset.type || 'url';
  const errorBanner = document.getElementById('input-security-alert');

  try {
    let result = 'https://google.com';

    if (activeTab === 'url') {
      const url = document.getElementById('input-url')?.value || '';
      result = sanitizeQRInput('url', url);
    } else if (activeTab === 'text') {
      const text = document.getElementById('input-text')?.value || '';
      result = sanitizeQRInput('text', text);
    } else if (activeTab === 'wifi') {
      const ssid = document.getElementById('wifi-ssid')?.value || '';
      const pass = document.getElementById('wifi-pass')?.value || '';
      const enc = document.getElementById('wifi-enc')?.value || 'WPA';
      const hidden = document.getElementById('wifi-hidden')?.checked || false;
      result = sanitizeQRInput('wifi', { ssid, pass, enc, hidden });
    } else if (activeTab === 'whatsapp') {
      const phone = document.getElementById('wa-phone')?.value || '';
      const msg = document.getElementById('wa-msg')?.value || '';
      result = sanitizeQRInput('whatsapp', { phone, msg });
    } else if (activeTab === 'contact') {
      const firstName = document.getElementById('contact-first-name')?.value || '';
      const lastName = document.getElementById('contact-last-name')?.value || '';
      const mobile = document.getElementById('contact-mobile')?.value || '';
      const phone = document.getElementById('contact-phone')?.value || '';
      const email = document.getElementById('contact-email')?.value || '';
      const org = document.getElementById('contact-org')?.value || '';
      const title = document.getElementById('contact-title')?.value || '';
      const url = document.getElementById('contact-url')?.value || '';
      const notes = document.getElementById('contact-notes')?.value || '';
      result = sanitizeQRInput('contact', { firstName, lastName, mobile, phone, email, org, title, url, notes });
    }

    if (errorBanner) {
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';
    }

    return result;
  } catch (err) {
    if (errorBanner) {
      errorBanner.style.display = 'block';
      errorBanner.textContent = `Aviso: ${err.message}`;
    }
    return 'https://google.com';
  }
}

function triggerDirectDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
  }, 1000);
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function prepareLogoForQR(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 240;
          let w = img.width || 200;
          let h = img.height || 200;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          resolve(e.target.result);
        }
      };
      img.onerror = () => reject(new Error('Formato de imagen no legible'));
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function initQRGenerator({ onUsageUpdated, onProModalRequested }) {
  const previewContainer = document.getElementById('qr-preview-container');
  const canvasHolder = document.getElementById('qr-canvas-holder');
  if (!previewContainer) return;

  qrCodeInstance = new QRCodeStyling(defaultOptions);
  previewContainer.innerHTML = '';
  qrCodeInstance.append(previewContainer);

  function updateQR() {
    try {
      const data = getSanitizedData();
      const dotsColor = document.getElementById('color-dots')?.value || '#172B4D';
      const isTransparent = document.getElementById('check-transparent-bg')?.checked || false;
      const bgPicker = document.getElementById('color-bg');

      const bgColor = isTransparent ? 'transparent' : (bgPicker?.value || '#ffffff');

      if (canvasHolder) {
        canvasHolder.classList.toggle('checkerboard-pattern', isTransparent);
      }
      if (bgPicker) {
        bgPicker.disabled = isTransparent;
        bgPicker.style.opacity = isTransparent ? '0.4' : '1';
      }

      const dotType = document.getElementById('select-dots-style')?.value || 'rounded';
      const cornerSquareType = document.getElementById('select-corners-style')?.value || 'extra-rounded';
      const errorCorrectionLevel = document.getElementById('select-ecc')?.value || 'Q';

      const isPro = isProUser();
      const logoToUse = (isPro && currentLogoUrl) ? currentLogoUrl : '';

      qrCodeInstance.update({
        data: data,
        dotsOptions: {
          color: dotsColor,
          type: dotType
        },
        backgroundOptions: {
          color: bgColor
        },
        cornersSquareOptions: {
          color: dotsColor,
          type: cornerSquareType
        },
        cornersDotOptions: {
          color: dotsColor,
          type: 'dot'
        },
        qrOptions: {
          errorCorrectionLevel: logoToUse ? 'H' : errorCorrectionLevel
        },
        imageOptions: {
          saveAsBlob: false,
          hideBackgroundDots: true,
          imageSize: 0.28,
          margin: 4
        },
        image: logoToUse || ''
      });
    } catch (qrErr) {
      console.error('Error al actualizar QR:', qrErr);
    }
  }

  const dataInputs = document.querySelectorAll('.qr-data-input');
  dataInputs.forEach(input => {
    input.oninput = updateQR;
  });

  const colorDots = document.getElementById('color-dots');
  if (colorDots) colorDots.oninput = updateQR;

  const colorBg = document.getElementById('color-bg');
  if (colorBg) colorBg.oninput = updateQR;

  const checkTransparent = document.getElementById('check-transparent-bg');
  if (checkTransparent) checkTransparent.onchange = updateQR;

  const selectDots = document.getElementById('select-dots-style');
  if (selectDots) selectDots.onchange = updateQR;

  const selectCorners = document.getElementById('select-corners-style');
  if (selectCorners) selectCorners.onchange = updateQR;

  const selectEcc = document.getElementById('select-ecc');
  if (selectEcc) selectEcc.onchange = updateQR;

  const tabButtons = document.querySelectorAll('.type-btn');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetType = btn.dataset.type;
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.type === targetType);
      });

      updateQR();
    };
  });

  const logoInput = document.getElementById('logo-upload-input');
  const removeLogoBtn = document.getElementById('btn-remove-logo');
  const logoNotice = document.getElementById('logo-pro-notice');

  if (logoInput) {
    logoInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isProUser()) {
        logoInput.value = '';
        if (onProModalRequested) {
          onProModalRequested('logo');
        }
        return;
      }

      try {
        await validateImageFile(file);
        const preparedDataUrl = await prepareLogoForQR(file);
        currentLogoUrl = preparedDataUrl;
        if (removeLogoBtn) removeLogoBtn.style.display = 'inline-flex';
        if (logoNotice) logoNotice.textContent = `Logo activo: ${file.name}`;
        updateQR();
      } catch (validationErr) {
        showToast({ message: `Archivo no válido: ${validationErr.message}`, type: 'error' });
        logoInput.value = '';
      }
    };
  }

  if (removeLogoBtn) {
    removeLogoBtn.onclick = () => {
      currentLogoUrl = null;
      if (logoInput) logoInput.value = '';
      if (removeLogoBtn) removeLogoBtn.style.display = 'none';
      if (logoNotice) logoNotice.textContent = 'Disponible en versión Pro';
      updateQR();
    };
  }

  const formatButtons = document.querySelectorAll('.format-choice-btn');
  const btnDownloadAction = document.getElementById('btn-main-qr-download');
  const btnDownloadLabel = document.getElementById('main-qr-download-label');

  function updateFormatUI(format) {
    selectedExportFormat = format;
    formatButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.format === format);
    });

    if (btnDownloadLabel) {
      if (format === 'png') {
        btnDownloadLabel.textContent = 'Descargar imagen PNG';
      } else if (format === 'pdf') {
        btnDownloadLabel.textContent = 'Descargar documento PDF (A4)';
      } else if (format === 'svg') {
        btnDownloadLabel.textContent = 'Exportar SVG Vectorial';
      }
    }
  }

  formatButtons.forEach(btn => {
    btn.onclick = () => {
      const format = btn.dataset.format || 'png';
      if (format === 'svg' && !isProUser()) {
        if (onProModalRequested) onProModalRequested('svg');
        return;
      }
      updateFormatUI(format);
    };
  });

  if (btnDownloadAction) {
    btnDownloadAction.onclick = async (e) => {
      e.preventDefault();
      if (isDownloading) return;

      const format = selectedExportFormat;
      const isPro = isProUser();

      if (format === 'svg' && !isPro) {
        if (onProModalRequested) onProModalRequested('svg');
        return;
      }

      if (!canPerformDownload()) {
        if (onProModalRequested) onProModalRequested('daily_limit');
        return;
      }

      isDownloading = true;
      const originalText = btnDownloadLabel ? btnDownloadLabel.textContent : 'Descargar';
      if (btnDownloadLabel) btnDownloadLabel.textContent = 'Generando archivo...';
      btnDownloadAction.style.pointerEvents = 'none';

      try {
        let pngDataUrl = null;
        const canvas = previewContainer.querySelector('canvas');
        if (canvas) {
          try {
            pngDataUrl = canvas.toDataURL('image/png');
          } catch (err) {
            console.warn('Canvas toDataURL:', err);
          }
        }

        if (!pngDataUrl || pngDataUrl === 'data:,') {
          const blob = await qrCodeInstance.getRawData('png');
          if (blob) {
            pngDataUrl = await blobToDataUrl(blob);
          }
        }

        if (format === 'png') {
          if (!pngDataUrl) throw new Error('No se pudo generar el PNG');
          triggerDirectDownload(pngDataUrl, 'codigo-qr.png');
        } else if (format === 'pdf') {
          if (!pngDataUrl) throw new Error('No se pudo procesar la imagen para el PDF');

          const pdfBlob = await generateQRPdf(pngDataUrl, {
            title: 'Código QR Imprimible',
            subtitle: 'Escanea con la cámara de tu teléfono móvil'
          });
          triggerBlobDownload(pdfBlob, 'codigo-qr.pdf');
        } else if (format === 'svg') {
          const blob = await qrCodeInstance.getRawData('svg');
          const svgDataUrl = await blobToDataUrl(blob);
          triggerDirectDownload(svgDataUrl, 'codigo-qr.svg');
        }

        consumeDailyUse();
        if (onUsageUpdated) {
          onUsageUpdated();
        }

        if (btnDownloadLabel) btnDownloadLabel.textContent = 'Descargado correctamente';
        setTimeout(() => {
          if (btnDownloadLabel) btnDownloadLabel.textContent = originalText;
        }, 1500);
      } catch (err) {
        console.error('Error al generar la descarga:', err);
        showToast({ message: 'Hubo un error al procesar el archivo. Por favor intenta de nuevo.', type: 'error' });
        if (btnDownloadLabel) btnDownloadLabel.textContent = originalText;
      } finally {
        btnDownloadAction.style.pointerEvents = '';
        setTimeout(() => {
          isDownloading = false;
        }, 800);
      }
    };
  }

  updateFormatUI('png');
  updateQR();

  return {
    refresh: updateQR
  };
}
