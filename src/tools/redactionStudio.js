/**
 * Herramienta: Redaction Studio (Redactor y Censurador de Información Sensible)
 * Detecta y censura automáticamente información confidencial (DNI, CUIT/CUIL, emails, teléfonos, tarjetas)
 * con barras negras de privacidad (████████) 100% en memoria del navegador.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

// Configuración de Worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Funciones de Redacción y Detección de Datos Sensibles
 */
function redactAll(rawText, options) {
  let text = rawText || '';
  let counts = {
    cuit: 0,
    email: 0,
    card: 0,
    phone: 0,
    dni: 0
  };

  const mask = (str) => '█'.repeat(Math.max(str.length, 6));

  // 1. EMAILS
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
  const emails = text.match(emailRegex) || [];
  counts.email = emails.length;
  if (options.email) {
    text = text.replace(emailRegex, m => mask(m));
  }

  // 2. CUIT / CUIL (Formato 20-xxxxxxxx-x o 20xxxxxxxx0)
  const cuitRegex = /\b(?:C\.?U\.?I\.?[TL]\.?\s*(?:N[°º]?)?\s*)?(\d{2}[-.]\d{8}[-.]\d)\b/gi;
  const cuits = text.match(cuitRegex) || [];
  counts.cuit = cuits.length;
  if (options.cuit) {
    text = text.replace(cuitRegex, m => mask(m));
  }

  // 3. TARJETAS / CBU (16 dígitos en grupos de 4 o 22 dígitos CBU)
  const cardCbuRegex = /\b(?:\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}|\d{22})\b/g;
  const cards = text.match(cardCbuRegex) || [];
  counts.card = cards.length;
  if (options.card) {
    text = text.replace(cardCbuRegex, m => mask(m));
  }

  // 4. TELÉFONOS (Formatos con prefijo, internacionales +54, celulares argentinos, 3496-462576, con guiones, espacios, paréntesis o 10 dígitos)
  const phonePatterns = [
    // Con prefijo explícito: Tel, Cel, Whatsapp, Movil, Contacto, etc.
    /(?:(?:tel(?:[ée]fono)?|cel(?:ular)?|m[óo]vil|whatsapp|wsp|mobile|phone|telf?|contacto|wa)\.?\s*[:#-]?\s*)(\+?[\d\s()./-]{6,22}\d)/gi,
    // Internacional +54 9 ..., +1 ..., +34 ..., 0054 ...
    /(?:\+|00)\d{1,3}(?:[\s.-]*\(?\d{1,4}\)?)*[\s.-]*\d{2,4}[\s.-]*\d{2,4}(?:[\s.-]*\d{2,4})?\b/gi,
    // Formato 2 bloques: Característica (2 a 4 dígitos) + Número local (6 a 8 dígitos), ej: 3496-462576, 03496-462576, 342-4567890, 11-45678901
    /\b(?:0?[1-9]\d{1,3})[-.\s]+(?:15[-.\s]*)?\d{6,8}\b/g,
    // Formato 3 bloques: ej: 3496-46-2576, 342-509-3453, 011-4567-8901
    /\b(?:0?[1-9]\d{1,3})[-.\s]+(?:15[-.\s]+)?\d{2,4}[-.\s]+\d{3,4}\b/g,
    // Área con paréntesis: (03496) 462576, (0342) 154-123456, (342) 5093453, (011) 4567-8901
    /\(\s*0?\d{2,4}\s*\)[\s.-]*(?:15[\s.-]*)?\d{3,4}[\s.-]?\d{3,4}\b/gi,
    // Celular argentino con o sin +54, 9, 15
    /(?:\+?54[\s.-]*)?(?:9[\s.-]*)?(?:\(?\s*0?[1-9]\d{1,3}\s*\)?[\s.-]*)?(?:15[\s.-]*)?\d{3,4}[\s.-]?\d{4}\b/gi,
    // Números de 10 a 11 dígitos corridos o con espacios simples (ej: 3496462576, 03496462576, 3425093453, 1150934530)
    /\b0?[1-9]\d{1,3}\d{6,8}\b/g,
    /\b0?[1-9]\d{1,3}\s+\d{3,4}\s+\d{3,4}\b/g
  ];

  let detectedPhones = new Set();

  phonePatterns.forEach(pat => {
    let match;
    const regexClone = new RegExp(pat.source, pat.flags);
    while ((match = regexClone.exec(text)) !== null) {
      const val = match[1] || match[0];
      // Validar que tenga entre 6 y 15 dígitos numéricos
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 6 && digits.length <= 15) {
        detectedPhones.add(val.trim());
      }
    }
  });

  counts.phone = detectedPhones.size;

  if (options.phone) {
    // Censurar teléfonos encontrados
    detectedPhones.forEach(ph => {
      text = text.split(ph).join(mask(ph));
    });
  }

  // 5. DNI (Con DNI explícito o con puntos 10.153.209 / 26.924.391)
  const dniRegex = /\b(?:D\.?N\.?I\.?\s*(?:N[°º]?)?\s*)?(\d{1,2}\.\d{3}\.\d{3})\b/gi;
  const dniExplicitRegex = /\b(?:D\.?N\.?I\.?\s*(?:N[°º]?)?\s*)(\d{7,8})\b/gi;

  const dnis = [...(text.match(dniRegex) || []), ...(text.match(dniExplicitRegex) || [])];
  counts.dni = dnis.length;

  if (options.dni) {
    text = text.replace(dniRegex, m => mask(m));
    text = text.replace(dniExplicitRegex, m => mask(m));
  }

  return {
    redactedText: text,
    counts
  };
}

export function initRedactionStudio({ onUsageUpdated, onProModalRequested }) {
  const dropzone = document.getElementById('redact-dropzone');
  const fileInput = document.getElementById('redact-file-input');
  const inputTextarea = document.getElementById('redact-input-text');
  const outputTextarea = document.getElementById('redact-output-text');
  const btnClear = document.getElementById('btn-redact-clear');

  // Interruptores
  const checkDni = document.getElementById('check-redact-dni');
  const checkCuit = document.getElementById('check-redact-cuit');
  const checkEmail = document.getElementById('check-redact-email');
  const checkPhone = document.getElementById('check-redact-phone');
  const checkCard = document.getElementById('check-redact-card');

  // Badges y Métricas
  const badgeDni = document.getElementById('badge-count-dni');
  const badgeCuit = document.getElementById('badge-count-cuit');
  const badgeEmail = document.getElementById('badge-count-email');
  const badgePhone = document.getElementById('badge-count-phone');
  const badgeCard = document.getElementById('badge-count-card');
  const totalRedactedBadge = document.getElementById('badge-total-redacted');

  // Botones de acción
  const btnCopyRedacted = document.getElementById('btn-copy-redacted');
  const btnDownloadTxt = document.getElementById('btn-download-redacted-txt');

  if (!inputTextarea || !outputTextarea) return;

  // Iniciar completamente vacío
  inputTextarea.value = '';
  outputTextarea.value = '';

  async function handleFile(file) {
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
          isEvalSupported: false
        });
        const pdfDoc = await loadingTask.promise;
        const pages = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          pages.push(content.items.map(i => i.str || '').join(' '));
        }
        inputTextarea.value = pages.join('\n\n');
      } catch (err) {
        console.error('Error leyendo PDF para redacción:', err);
        showToast({ message: 'Error al leer el texto del PDF.', type: 'error' });
      }
    } else {
      inputTextarea.value = await file.text();
    }

    updateRedactedOutput();
  }

  function updateRedactedOutput() {
    const raw = inputTextarea.value || '';

    if (!raw.trim()) {
      outputTextarea.value = '';
      if (badgeDni) badgeDni.textContent = '0';
      if (badgeCuit) badgeCuit.textContent = '0';
      if (badgeEmail) badgeEmail.textContent = '0';
      if (badgePhone) badgePhone.textContent = '0';
      if (badgeCard) badgeCard.textContent = '0';
      if (totalRedactedBadge) {
        totalRedactedBadge.textContent = '0 datos censurados';
        totalRedactedBadge.className = 'tier-badge free';
      }
      return;
    }

    const options = {
      dni: checkDni?.checked ?? true,
      cuit: checkCuit?.checked ?? true,
      email: checkEmail?.checked ?? true,
      phone: checkPhone?.checked ?? true,
      card: checkCard?.checked ?? true
    };

    const { redactedText, counts } = redactAll(raw, options);

    outputTextarea.value = redactedText;

    if (badgeDni) badgeDni.textContent = `${counts.dni}`;
    if (badgeCuit) badgeCuit.textContent = `${counts.cuit}`;
    if (badgeEmail) badgeEmail.textContent = `${counts.email}`;
    if (badgePhone) badgePhone.textContent = `${counts.phone}`;
    if (badgeCard) badgeCard.textContent = `${counts.card}`;

    const total = (options.dni ? counts.dni : 0) +
                  (options.cuit ? counts.cuit : 0) +
                  (options.email ? counts.email : 0) +
                  (options.phone ? counts.phone : 0) +
                  (options.card ? counts.card : 0);

    if (totalRedactedBadge) {
      totalRedactedBadge.textContent = `${total} datos censurados`;
      totalRedactedBadge.className = total > 0 ? 'tier-badge pro' : 'tier-badge free';
    }
  }

  // Eventos Dropzone
  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

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
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  inputTextarea.addEventListener('input', updateRedactedOutput);

  [checkDni, checkCuit, checkEmail, checkPhone, checkCard].forEach(c => {
    c?.addEventListener('change', updateRedactedOutput);
  });

  btnClear?.addEventListener('click', () => {
    inputTextarea.value = '';
    outputTextarea.value = '';
    if (fileInput) fileInput.value = '';
    updateRedactedOutput();
  });

  btnCopyRedacted?.addEventListener('click', () => {
    if (!outputTextarea.value) return;
    navigator.clipboard.writeText(outputTextarea.value);
    btnCopyRedacted.classList.add('copied-success');
    btnCopyRedacted.innerHTML = '<span>Copiado con éxito</span>';
    setTimeout(() => {
      btnCopyRedacted.classList.remove('copied-success');
      btnCopyRedacted.innerHTML = '<span>Copiar Texto Censurado</span>';
    }, 2000);
  });

  btnDownloadTxt?.addEventListener('click', () => {
    if (!outputTextarea.value) return;

    if (!canPerformDownload()) {
      if (onProModalRequested) onProModalRequested('daily_limit');
      return;
    }

    const blob = new Blob([outputTextarea.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documento-censurado-privacidad.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    consumeDailyUse();
    if (onUsageUpdated) onUsageUpdated();
  });

  // Estado inicial limpio
  updateRedactedOutput();
}
