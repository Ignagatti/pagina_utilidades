import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { canPerformDownload, consumeDailyUse, isProUser } from '../services/storage.js';
import { showToast } from '../utils/dialog.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
  const emails = text.match(emailRegex) || [];
  counts.email = emails.length;
  if (options.email) {
    text = text.replace(emailRegex, m => mask(m));
  }

  const cuitRegex = /\b(?:C\.?U\.?I\.?[TL]\.?\s*(?:N[°º]?)?\s*)?(\d{2}[-.]\d{8}[-.]\d)\b/gi;
  const cuits = text.match(cuitRegex) || [];
  counts.cuit = cuits.length;
  if (options.cuit) {
    text = text.replace(cuitRegex, m => mask(m));
  }

  const cardCbuRegex = /\b(?:\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}|\d{22})\b/g;
  const cards = text.match(cardCbuRegex) || [];
  counts.card = cards.length;
  if (options.card) {
    text = text.replace(cardCbuRegex, m => mask(m));
  }

  const phonePatterns = [

    /(?:(?:tel(?:[ée]fono)?|cel(?:ular)?|m[óo]vil|whatsapp|wsp|mobile|phone|telf?|contacto|wa)\.?\s*[:#-]?\s*)(\+?[\d\s()./-]{6,22}\d)/gi,

    /(?:\+|00)\d{1,3}(?:[\s.-]*\(?\d{1,4}\)?)*[\s.-]*\d{2,4}[\s.-]*\d{2,4}(?:[\s.-]*\d{2,4})?\b/gi,

    /\b(?:0?[1-9]\d{1,3})[-.\s]+(?:15[-.\s]*)?\d{6,8}\b/g,

    /\b(?:0?[1-9]\d{1,3})[-.\s]+(?:15[-.\s]+)?\d{2,4}[-.\s]+\d{3,4}\b/g,

    /\(\s*0?\d{2,4}\s*\)[\s.-]*(?:15[\s.-]*)?\d{3,4}[\s.-]?\d{3,4}\b/gi,

    /(?:\+?54[\s.-]*)?(?:9[\s.-]*)?(?:\(?\s*0?[1-9]\d{1,3}\s*\)?[\s.-]*)?(?:15[\s.-]*)?\d{3,4}[\s.-]?\d{4}\b/gi,

    /\b0?[1-9]\d{1,3}\d{6,8}\b/g,
    /\b0?[1-9]\d{1,3}\s+\d{3,4}\s+\d{3,4}\b/g
  ];

  let detectedPhones = new Set();

  phonePatterns.forEach(pat => {
    let match;
    const regexClone = new RegExp(pat.source, pat.flags);
    while ((match = regexClone.exec(text)) !== null) {
      const val = match[1] || match[0];

      const digits = val.replace(/\D/g, '');
      if (digits.length >= 6 && digits.length <= 15) {
        detectedPhones.add(val.trim());
      }
    }
  });

  counts.phone = detectedPhones.size;

  if (options.phone) {

    detectedPhones.forEach(ph => {
      text = text.split(ph).join(mask(ph));
    });
  }

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

  const checkDni = document.getElementById('check-redact-dni');
  const checkCuit = document.getElementById('check-redact-cuit');
  const checkEmail = document.getElementById('check-redact-email');
  const checkPhone = document.getElementById('check-redact-phone');
  const checkCard = document.getElementById('check-redact-card');

  const badgeDni = document.getElementById('badge-count-dni');
  const badgeCuit = document.getElementById('badge-count-cuit');
  const badgeEmail = document.getElementById('badge-count-email');
  const badgePhone = document.getElementById('badge-count-phone');
  const badgeCard = document.getElementById('badge-count-card');
  const totalRedactedBadge = document.getElementById('badge-total-redacted');

  const btnCopyRedacted = document.getElementById('btn-copy-redacted');
  const btnDownloadTxt = document.getElementById('btn-download-redacted-txt');

  if (!inputTextarea || !outputTextarea) return;

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

  updateRedactedOutput();
}
