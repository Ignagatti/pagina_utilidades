import { isProUser, activateProLicense, deactivatePro, resetDailyUsage, getUsageStatus, isElectronEnv } from '../services/storage.js';
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

// Enlaces de pago oficiales de Lemon Squeezy para cada plan de Nuvexa
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

/**
 * Selecciona interactivamente una tarjeta de plan en el modal
 */
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

/**
 * Actualiza la barra superior de estado de la cuenta dentro del modal
 */
export function updateModalStatusBar() {
  const statusBar = document.getElementById('pro-modal-status-bar');
  if (!statusBar) return;

  const isPro = isProUser();
  const usage = getUsageStatus();

  if (isPro) {
    statusBar.innerHTML = `
      <div class="modal-status-pill pro">
        <span>Estado actual: <strong>Suscripción Pro Activa (Ilimitada)</strong></span>
        <button type="button" id="btn-quick-deactivate-pro" class="btn-status-toggle danger" title="Cambiar a plan gratuito para probar">
          Volver a Plan Gratuito
        </button>
      </div>
    `;

    document.getElementById('btn-quick-deactivate-pro')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deactivatePro();
      updateModalStatusBar();
      if (onStatusChangeCallback) onStatusChangeCallback();
    });
  } else {
    statusBar.innerHTML = `
      <div class="modal-status-pill free">
        <span>Estado actual: <strong>Plan Gratuito</strong> (${usage.remaining} de ${usage.max} descargas restantes hoy)</span>
      </div>
    `;
  }
}

/**
 * Abre el modal promocional de Nuvexa Pro
 * @param {'daily_limit' | 'logo' | 'svg' | 'general'} reason 
 */
export function openProModal(reason = 'general') {
  // En la versión de escritorio de Electron nunca se abre el modal de venta/licencia
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

  // Habilitar selección interactiva al hacer clic en cualquier tarjeta de plan
  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const plan = card.dataset.plan;
      if (plan && plan !== selectedPlan) {
        selectPlan(plan);
      }
    });
  });

  // Escuchar botones de compra de cada plan
  document.querySelectorAll('.btn-buy-plan').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const planKey = btn.dataset.plan || selectedPlan || 'Monthly';
      selectPlan(planKey);

      const planInfo = PLAN_DETAILS[planKey] || PLAN_DETAILS.Annual;
      const targetUrl = CHECKOUT_URLS[planKey] || (import.meta.env.VITE_CHECKOUT_URL ? `${import.meta.env.VITE_CHECKOUT_URL}?plan=${planKey.toLowerCase()}` : '');

      if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('test_demo') && !targetUrl.includes('...')) {
        window.location.href = targetUrl;
      } else {
        const confirmBuy = await showConfirmModal({
          title: `Checkout - ${planInfo.name}`,
          message: `Precio: ${planInfo.price} (${planInfo.period})\n\n[Modo Demostración / Configuración]\nAún no has vinculado tu enlace real de Stripe/Lemon Squeezy para este plan.\n\n¿Deseas simular el pago y activar el acceso Pro ilimitado ahora mismo para probar la plataforma?`,
          confirmText: 'Simular y Activar Pro',
          cancelText: 'Cancelar',
          type: 'info'
        });
        if (confirmBuy) {
          activateProLicense(`PRO-${planKey.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);
          closeProModal();
          if (onStatusChangeCallback) onStatusChangeCallback();
          showAlertModal({
            title: '¡Felicitaciones!',
            message: `Has activado ${planInfo.name} con éxito. Ya tienes acceso ilimitado a todas las herramientas.`,
            type: 'success'
          });
        }
      }
    });
  });

  // Validación de clave de licencia
  const licenseInput = document.getElementById('input-license-key');
  const btnActivateLicense = document.getElementById('btn-activate-license');
  const licenseMsg = document.getElementById('license-feedback-msg');

  btnActivateLicense?.addEventListener('click', () => {
    const key = licenseInput?.value.trim();
    if (!key) {
      if (licenseMsg) {
        licenseMsg.textContent = 'Introduce un código de licencia válido.';
        licenseMsg.className = 'license-msg error';
      }
      return;
    }

    activateProLicense(key);
    if (licenseMsg) {
      licenseMsg.textContent = 'Licencia validada con éxito.';
      licenseMsg.className = 'license-msg success';
    }

    setTimeout(() => {
      closeProModal();
      if (onStatusChangeCallback) onStatusChangeCallback();
    }, 800);
  });

  // Herramientas de prueba en la parte inferior
  document.getElementById('btn-toggle-demo-pro')?.addEventListener('click', () => {
    if (isProUser()) {
      deactivatePro();
      showToast({ message: 'Modo Pro desactivado. Cuenta en plan gratuito.', type: 'info' });
    } else {
      activateProLicense('DEMO-PRO');
      showToast({ message: 'Modo Pro activado para demostración.', type: 'success' });
    }
    closeProModal();
    if (onStatusChangeCallback) onStatusChangeCallback();
  });

  document.getElementById('btn-reset-demo-usage')?.addEventListener('click', () => {
    resetDailyUsage();
    showToast({ message: 'Contador de descargas diarias restablecido a 0.', type: 'success' });
    if (onStatusChangeCallback) onStatusChangeCallback();
  });
}

