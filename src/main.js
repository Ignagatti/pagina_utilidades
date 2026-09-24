import { getUsageStatus, isProUser, deactivatePro, activateProLicense, isElectronEnv } from './services/storage.js';
import { initSmartActions } from './tools/smartActions.js';
import { initDocDiffStudio } from './tools/docDiffStudio.js';
import { initRedactionStudio } from './tools/redactionStudio.js';
import { initQRGenerator } from './tools/qrGenerator.js';
import { initPdfEditor } from './tools/pdfEditor.js';
import { initPdfConverter } from './tools/pdfConverter.js';
import { initPdfMerge } from './tools/pdfMerge.js';
import { initPdfSplit } from './tools/pdfSplit.js';
import { initImageStudio } from './tools/imageStudio.js';
import { initAudioToText } from './tools/audioToText.js';
import { initSecurityStudio } from './tools/securityStudio.js';
import { initArchiveStudio } from './tools/archiveStudio.js';
import { initProModal, openProModal } from './components/proModal.js';
import { initLegalModal } from './components/legalModal.js';
import { initGlobalDialogInterceptor, showAlertModal, showToast } from './utils/dialog.js';

initGlobalDialogInterceptor();

let qrToolInstance = null;

export function updateFreemiumUI(shouldRefreshQR = false) {
  const status = getUsageStatus();
  const isElectron = isElectronEnv();
  const usageBadge = document.getElementById('navbar-usage-badge');
  const proBtn = document.getElementById('navbar-pro-btn');
  const proStatusPill = document.getElementById('status-tier-pill');
  const logoNotice = document.getElementById('logo-pro-notice');
  const svgBadges = document.querySelectorAll('.badge-pro');

  if (isElectron) {

    if (usageBadge) {
      usageBadge.classList.add('is-pro');
      usageBadge.style.cursor = 'default';
      usageBadge.title = 'Nuvexa Desktop • Todas las herramientas ilimitadas';
      usageBadge.innerHTML = `
        <span class="pro-label" style="background: rgba(16, 185, 129, 0.15); color: #059669; border-color: rgba(16, 185, 129, 0.3);">Escritorio • Ilimitado</span>
      `;
    }
    if (proBtn) {

      proBtn.style.display = 'none';
    }
    if (proStatusPill) {
      proStatusPill.textContent = 'ESCRITORIO ILIMITADO';
      proStatusPill.className = 'tier-badge pro';
    }
    if (logoNotice) {
      logoNotice.textContent = 'Habilitado en versión de escritorio';
    }
  } else if (status.isPro) {

    if (usageBadge) {
      usageBadge.classList.add('is-pro');
      usageBadge.style.cursor = 'pointer';
      usageBadge.title = 'Cuenta Pro Activa';
      usageBadge.innerHTML = `
        <span class="pro-label">Cuenta Pro Activa</span>
      `;
    }
    if (proBtn) {
      proBtn.style.display = '';
      proBtn.textContent = 'Cuenta Pro';
      proBtn.classList.add('btn-is-pro');
    }
    if (proStatusPill) {
      proStatusPill.textContent = 'PRO ILIMITADO';
      proStatusPill.className = 'tier-badge pro';
    }
    if (logoNotice) {
      logoNotice.textContent = 'Logotipo habilitado en tu cuenta';
    }
  } else {

    if (usageBadge) {
      usageBadge.classList.remove('is-pro');
      usageBadge.style.cursor = 'pointer';
      usageBadge.title = 'Límite diario de descargas';
      usageBadge.innerHTML = `
        <span id="usage-counter-text">
          <span class="usage-text-desktop">${status.remaining} de ${status.max} descargas hoy</span>
          <span class="usage-text-mobile">${status.remaining}/${status.max} hoy</span>
        </span>
        <div class="mini-progress-track">
          <div class="mini-progress-fill" style="width: ${status.percentage}%;"></div>
        </div>
      `;
    }
    if (proBtn) {
      proBtn.style.display = '';
      proBtn.innerHTML = `
        <span class="btn-pro-desktop">Obtener Pro</span>
        <span class="btn-pro-mobile">Pro</span>
      `;
      proBtn.classList.remove('btn-is-pro');
    }
    if (proStatusPill) {
      proStatusPill.textContent = 'PLAN GRATUITO';
      proStatusPill.className = 'tier-badge free';
    }
    if (logoNotice) {
      logoNotice.textContent = 'Disponible en versión Pro';
    }
  }

  if (shouldRefreshQR && qrToolInstance?.refresh) {
    qrToolInstance.refresh();
  }
}

function initToolSwitcher() {
  const categoryButtons = document.querySelectorAll('.nav-cat-btn');
  const toolButtons = document.querySelectorAll('.nav-tool-btn');
  const pdfSubNav = document.getElementById('pdf-subnav-bar');

  const views = {
    'smart-actions': document.getElementById('view-smart-actions'),
    'qr': document.getElementById('view-qr-tool'),
    'pdf-editor': document.getElementById('view-pdf-editor'),
    'images-to-pdf': document.getElementById('view-images-to-pdf'),
    'merge-pdf': document.getElementById('view-merge-pdf'),
    'split-pdf': document.getElementById('view-split-pdf'),
    'doc-diff-studio': document.getElementById('view-doc-diff-studio'),
    'redaction-studio': document.getElementById('view-redaction-studio'),
    'image-studio': document.getElementById('view-image-studio'),
    'audio-to-text': document.getElementById('view-audio-to-text'),
    'security-studio': document.getElementById('view-security-studio'),
    'archive-studio': document.getElementById('view-archive-studio')
  };

  function switchView(targetTool) {
    Object.entries(views).forEach(([key, element]) => {
      if (element) {
        element.style.display = (key === targetTool) ? 'block' : 'none';
      }
    });

    const isPdfTool = ['pdf-editor', 'images-to-pdf', 'merge-pdf', 'split-pdf', 'doc-diff-studio', 'redaction-studio'].includes(targetTool);
    if (pdfSubNav) {
      pdfSubNav.style.display = isPdfTool ? 'flex' : 'none';
    }

    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === targetTool);
    });

    categoryButtons.forEach(btn => {
      const cat = btn.dataset.category;
      if (cat === 'pdf') {
        btn.classList.toggle('active', isPdfTool);
      } else {
        btn.classList.toggle('active', btn.dataset.tool === targetTool);
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  categoryButtons.forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.category;
      if (cat === 'pdf') {
        switchView('pdf-editor');
      } else {
        const tool = btn.dataset.tool;
        if (tool) switchView(tool);
      }
    };
  });

  toolButtons.forEach(btn => {
    btn.onclick = () => {
      const tool = btn.dataset.tool;
      if (tool) switchView(tool);
    };
  });

  return switchView;
}

document.addEventListener('DOMContentLoaded', () => {

  initProModal({
    onStatusChange: () => {
      updateFreemiumUI(true);
    }
  });
  initLegalModal();

  document.getElementById('navbar-pro-btn')?.addEventListener('click', () => {
    if (!isElectronEnv()) {
      openProModal(isProUser() ? 'general' : 'general');
    }
  });

  document.getElementById('navbar-usage-badge')?.addEventListener('click', () => {
    if (!isElectronEnv()) {
      openProModal(isProUser() ? 'general' : 'daily_limit');
    }
  });

  const switchToolView = initToolSwitcher();

  initSmartActions({
    onNavigateTool: (toolName) => {
      if (switchToolView) switchToolView(toolName);
    }
  });

  initDocDiffStudio({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initRedactionStudio({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  qrToolInstance = initQRGenerator({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initPdfEditor({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initPdfConverter({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initPdfMerge({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initPdfSplit({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initImageStudio({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initAudioToText({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initSecurityStudio({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  initArchiveStudio({
    onUsageUpdated: () => updateFreemiumUI(false),
    onProModalRequested: (reason) => openProModal(reason)
  });

  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (answer && !answer.querySelector('.faq-answer-inner')) {
      const inner = document.createElement('div');
      inner.className = 'faq-answer-inner';
      while (answer.firstChild) {
        inner.appendChild(answer.firstChild);
      }
      answer.appendChild(inner);
    }

    if (question) {
      question.setAttribute('role', 'button');
      question.setAttribute('tabindex', '0');
      question.setAttribute('aria-expanded', 'false');

      const toggleFAQ = () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => {
          i.classList.remove('open');
          i.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          question.setAttribute('aria-expanded', 'true');
        }
      };

      question.addEventListener('click', toggleFAQ);
      question.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleFAQ();
        }
      });
    }
  });

  checkPaymentReturnUrl();

  if ('serviceWorker' in navigator && !window.electronAPI?.isElectron) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
      }).catch((err) => {
        console.warn('SW registration warning:', err);
      });
    });
  }

  initCookieConsentBanner();

  updateFreemiumUI(false);
});

function initCookieConsentBanner() {
  const cookieBanner = document.getElementById('cookie-consent-banner');
  const acceptBtn = document.getElementById('btn-accept-cookies');
  if (!cookieBanner) return;

  const hasConsented = localStorage.getItem('nuvexa_cookie_consent');
  if (!hasConsented) {

    setTimeout(() => {
      cookieBanner.style.display = 'block';
    }, 1000);
  }

  acceptBtn?.addEventListener('click', () => {
    localStorage.setItem('nuvexa_cookie_consent', 'true');
    cookieBanner.style.display = 'none';
  });
}

function checkPaymentReturnUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const licenseParam = urlParams.get('license');

  if (paymentStatus === 'success') {
    const newLicenseKey = `PRO-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    activateProLicense(newLicenseKey);
    updateFreemiumUI(true);

    window.history.replaceState({}, document.title, window.location.pathname);

    setTimeout(() => {
      showAlertModal({
        title: '¡Suscripción Pro Activada con Éxito!',
        message: `Tu clave de licencia personal es:\n${newLicenseKey}\n\nSe ha guardado en este dispositivo. Consérvala en tu correo para activarla en otros navegadores o equipos.`,
        type: 'success'
      });
    }, 400);
  } else if (licenseParam) {
    activateProLicense(licenseParam);
    updateFreemiumUI(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      showToast({
        title: 'Licencia Nuvexa Pro',
        message: `Licencia activada correctamente con el código: ${licenseParam}`,
        type: 'success'
      });
    }, 400);
  }
}
