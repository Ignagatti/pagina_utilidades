import { isProUser, activateProLicense, deactivatePro, resetDailyUsage, getUsageStatus, getProLicenseInfo, isElectronEnv } from '../services/storage.js';
import { showToast, showAlertModal, showConfirmModal } from '../utils/dialog.js';

let modalElement = null;
let onStatusChangeCallback = null;
let selectedPlan = 'Annual';

const PLAN_DETAILS = {
  Monthly: {
    name: 'Plan Mensual',
    price: '$3.99 / mes',
    badgeText: 'FLEXIBLE MES A MES',
    period: 'mes a mes, cancelable cuando quieras'
  },
  Annual: {
    name: 'Plan Anual',
    price: '$29.99 / año',
    badgeText: 'MÁS ELEGIDO • AHORRA 37%',
    period: '1 año completo (equivale a solo $2.50/mes)'
  },
  Lifetime: {
    name: 'Acceso de por Vida',
    price: '$49.99 pago único',
    badgeText: 'PAGO ÚNICO • PARA SIEMPRE',
    period: 'un solo pago de por vida, sin suscripciones'
  }
};

export const CHECKOUT_URLS = {
  Monthly: import.meta.env.VITE_CHECKOUT_MONTHLY_URL || 'https://nuvexa.lemonsqueezy.com/checkout/buy/819358f6-bb33-441e-b5f6-7e1a946e6f06',
  Annual: import.meta.env.VITE_CHECKOUT_ANNUAL_URL || 'https://nuvexa.lemonsqueezy.com/checkout/buy/7b4117d4-93c0-4e25-b22d-73a32bc34e65',
  Lifetime: import.meta.env.VITE_CHECKOUT_LIFETIME_URL || 'https://nuvexa.lemonsqueezy.com/checkout/buy/2084ec4e-d3a8-4c4f-8ca5-75fcf30c5093'
};

const REASON_TITLES = {
  daily_limit: 'Descargas ilimitadas con Nuvexa Pro',
  logo: 'Personalización con tu Logotipo',
  svg: 'Exportación Vectorial SVG',
  general: 'Nuvexa Pro • Herramientas digitales. Privadas. En un solo lugar.'
};

const REASON_DESCRIPTIONS = {
  daily_limit: 'Has completado tus descargas gratuitas de hoy. Pasa a Nuvexa Pro o continúa en modo gratuito mañana.',
  logo: 'Añade el logotipo de tu marca en tus códigos QR y trabaja sin límites en todas las herramientas de Nuvexa.',
  svg: 'Descarga códigos QR en formato SVG vectorial de máxima nitidez para cartelería e imprenta.',
  general: 'Todas las herramientas de Nuvexa (QR, PDF, imágenes, audio y seguridad) 100% privadas y sin límites.'
};

export function selectPlan(planKey) {
  if (!PLAN_DETAILS[planKey]) return;
  selectedPlan = planKey;

  const cards = document.querySelectorAll('.plan-card');
  cards.forEach(card => {
    const isThisPlan = card.dataset.plan === planKey;
    card.classList.toggle('featured', isThisPlan);
    card.classList.toggle('selected', isThisPlan);

    const btn = card.querySelector('.btn-buy-plan');
    if (btn) {
      if (isThisPlan) {
        btn.classList.remove('secondary');
        btn.classList.add('primary');
        btn.textContent = (planKey === 'Lifetime') ? 'Comprar de por Vida' : `Elegir ${PLAN_DETAILS[planKey].name}`;
      } else {
        btn.classList.remove('primary');
        btn.classList.add('secondary');
        btn.textContent = 'Seleccionar';
      }
    }
  });
}

export function updateModalStatusBar() {
  const statusBar = document.getElementById('pro-modal-status-bar');
  if (!statusBar) return;

  const isPro = isProUser();
  const usage = getUsageStatus();

  if (isPro) {
    const licenseInfo = getProLicenseInfo();
    const keyBadge = licenseInfo?.licenseKey
      ? `<div style="font-size:0.78rem; opacity:0.85; margin-top:2px;">Clave activa: <code style="font-family:monospace; background:rgba(0,0,0,0.15); padding:1px 5px; border-radius:4px;">${licenseInfo.licenseKey}</code></div>`
      : '';
    statusBar.innerHTML = `
      <div class="modal-status-pill pro">
        <span>Estado de cuenta: <strong>Suscripción Pro Activa (Acceso Ilimitado)</strong></span>
        ${keyBadge}
      </div>
    `;
  } else {
    statusBar.innerHTML = `
      <div class="modal-status-pill free">
        <span>Estado actual: <strong>Plan Gratuito</strong> (${usage.remaining} de ${usage.max} descargas restantes hoy)</span>
      </div>
    `;
  }
}

export function openProModal(reason = 'general') {
  if (isElectronEnv()) return;
  if (!modalElement) return;

  const titleEl = document.getElementById('pro-modal-title');
  const descEl = document.getElementById('pro-modal-desc');

  if (titleEl) {
    titleEl.textContent = REASON_TITLES[reason] || REASON_TITLES.general;
  }
  if (descEl) {
    descEl.textContent = REASON_DESCRIPTIONS[reason] || REASON_DESCRIPTIONS.general;
  }

  updateModalStatusBar();
  selectPlan(selectedPlan || 'Annual');

  modalElement.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

export function closeProModal() {
  if (!modalElement) return;
  modalElement.classList.remove('visible');
  document.body.style.overflow = '';
}

export function initProModal({ onStatusChange }) {
  modalElement = document.getElementById('pro-modal');
  onStatusChangeCallback = onStatusChange;

  if (!modalElement) return;

  document.getElementById('btn-close-pro-modal')?.addEventListener('click', closeProModal);
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
      closeProModal();
    }
  });

  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => {
      const plan = card.dataset.plan;
      if (plan && plan !== selectedPlan) {
        selectPlan(plan);
      }
    });
  });

  document.querySelectorAll('.btn-buy-plan').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const planKey = btn.dataset.plan || selectedPlan || 'Monthly';
      selectPlan(planKey);

      const planInfo = PLAN_DETAILS[planKey] || PLAN_DETAILS.Annual;
      const targetUrl = CHECKOUT_URLS[planKey] || (import.meta.env.VITE_CHECKOUT_URL ? `${import.meta.env.VITE_CHECKOUT_URL}?plan=${planKey.toLowerCase()}` : '');

      if (targetUrl && targetUrl.startsWith('http')) {
        window.location.href = targetUrl;
      } else {
        showAlertModal({
          title: 'Pasarela de Pago',
          message: 'El enlace de pago no se encuentra disponible momentáneamente. Por favor intenta de nuevo en unos instantes.',
          type: 'error'
        });
      }
    });
  });

  const licenseInput = document.getElementById('input-license-key');
  const btnActivateLicense = document.getElementById('btn-activate-license');
  const licenseMsg = document.getElementById('license-feedback-msg');

  btnActivateLicense?.addEventListener('click', () => {
    const key = licenseInput?.value.trim();
    if (!key) {
      if (licenseMsg) {
        licenseMsg.textContent = 'Introduce tu código de licencia.';
        licenseMsg.className = 'license-msg error';
      }
      return;
    }

    const result = activateProLicense(key);
    if (!result.success) {
      if (licenseMsg) {
        licenseMsg.textContent = result.message || 'Código de licencia no válido.';
        licenseMsg.className = 'license-msg error';
      }
      return;
    }

    if (licenseMsg) {
      licenseMsg.textContent = '¡Licencia Pro validada con éxito!';
      licenseMsg.className = 'license-msg success';
    }

    setTimeout(() => {
      closeProModal();
      if (onStatusChangeCallback) onStatusChangeCallback();
      showToast({
        title: 'Nuvexa Pro Activado',
        message: '¡Tu cuenta Pro ilimitada ha sido activada!',
        type: 'success'
      });
    }, 700);
  });
}
