/**
 * Nuvexa - Sistema Central de Notificaciones y Diálogos In-App
 * Reemplaza completamente los cuadros de diálogo nativos de Windows/navegador
 * (alert, confirm, prompt) por componentes modernos, elegantes y no bloqueantes.
 */

// Contenedor global de toasts
let toastContainer = null;

function getOrCreateToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.getElementById('nuvexa-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'nuvexa-toast-container';
      toastContainer.className = 'nuvexa-toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

const ICONS = {
  success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
};

/**
 * Muestra una notificación flotante (Toast) in-app
 * Puede invocarse como showToast("Mensaje", "success") o showToast({ message, type, title, duration })
 */
export function showToast(messageOrOptions, typeParam = 'info', durationParam = 4200) {
  let message = '';
  let type = 'info';
  let title = '';
  let duration = 4200;

  if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
    message = messageOrOptions.message || '';
    type = messageOrOptions.type || 'info';
    title = messageOrOptions.title || '';
    duration = messageOrOptions.duration !== undefined ? messageOrOptions.duration : 4200;
  } else {
    message = String(messageOrOptions || '');
    type = typeParam || 'info';
    duration = durationParam;
  }

  const container = getOrCreateToastContainer();
  const toast = document.createElement('div');
  toast.className = `nuvexa-toast toast-${type}`;

  const iconSvg = ICONS[type] || ICONS.info;

  toast.innerHTML = `
    <div class="nuvexa-toast-icon">${iconSvg}</div>
    <div class="nuvexa-toast-content">
      ${title ? `<div class="nuvexa-toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="nuvexa-toast-msg">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="nuvexa-toast-close" aria-label="Cerrar notificación">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.nuvexa-toast-close');
  let timeoutId = null;

  function dismiss() {
    if (toast.classList.contains('dismissing')) return;
    toast.classList.add('dismissing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 280);
  }

  closeBtn?.addEventListener('click', () => {
    if (timeoutId) clearTimeout(timeoutId);
    dismiss();
  });

  if (duration > 0) {
    timeoutId = setTimeout(dismiss, duration);

    // Pausar al pasar el mouse por encima
    toast.addEventListener('mouseenter', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
    toast.addEventListener('mouseleave', () => {
      timeoutId = setTimeout(dismiss, 2000);
    });
  }

  container.appendChild(toast);
  return toast;
}

/**
 * Diálogo modal para avisos importantes o informativos
 * @returns {Promise<void>}
 */
export function showAlertModal({
  title = 'Aviso',
  message = '',
  detailHtml = '',
  type = 'info',
  confirmText = 'Entendido'
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'nuvexa-dialog-overlay';

    const iconSvg = ICONS[type] || ICONS.info;

    overlay.innerHTML = `
      <div class="nuvexa-dialog-card type-${type}" role="dialog" aria-modal="true">
        <div class="nuvexa-dialog-header">
          <div class="nuvexa-dialog-icon-badge badge-${type}">
            ${iconSvg}
          </div>
          <h3 class="nuvexa-dialog-title">${escapeHtml(title)}</h3>
        </div>
        <div class="nuvexa-dialog-body">
          ${message ? `<p class="nuvexa-dialog-text">${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}
          ${detailHtml ? `<div class="nuvexa-dialog-detail">${detailHtml}</div>` : ''}
        </div>
        <div class="nuvexa-dialog-actions">
          <button type="button" class="btn-download-primary nuvexa-dialog-btn-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    function closeDialog() {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve();
      }, 200);
    }

    const btnConfirm = overlay.querySelector('.nuvexa-dialog-btn-confirm');
    btnConfirm?.addEventListener('click', closeDialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        document.removeEventListener('keydown', handleKeydown);
        closeDialog();
      }
    };
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    btnConfirm?.focus();
  });
}

/**
 * Diálogo modal interactivo para confirmaciones
 * @returns {Promise<boolean>} Resuelve true si el usuario confirmó, false si canceló
 */
export function showConfirmModal({
  title = '¿Confirmar acción?',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning',
  isDestructive = false
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'nuvexa-dialog-overlay';

    const iconSvg = ICONS[type] || ICONS.warning;
    const confirmBtnClass = isDestructive ? 'btn-danger-primary' : 'btn-download-primary';

    overlay.innerHTML = `
      <div class="nuvexa-dialog-card type-${type}" role="dialog" aria-modal="true">
        <div class="nuvexa-dialog-header">
          <div class="nuvexa-dialog-icon-badge badge-${type}">
            ${iconSvg}
          </div>
          <h3 class="nuvexa-dialog-title">${escapeHtml(title)}</h3>
        </div>
        <div class="nuvexa-dialog-body">
          <p class="nuvexa-dialog-text">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="nuvexa-dialog-actions">
          <button type="button" class="btn-action-outline nuvexa-dialog-btn-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="${confirmBtnClass} nuvexa-dialog-btn-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    function closeDialog(confirmed) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(confirmed);
      }, 200);
    }

    overlay.querySelector('.nuvexa-dialog-btn-cancel')?.addEventListener('click', () => closeDialog(false));
    overlay.querySelector('.nuvexa-dialog-btn-confirm')?.addEventListener('click', () => closeDialog(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog(false);
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleKeydown);
        closeDialog(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.querySelector('.nuvexa-dialog-btn-confirm')?.focus();
  });
}

/**
 * Intercepta globalmente window.alert, window.confirm y window.prompt
 * para garantizar que ninguna llamada nativa de Windows se dispare jamás.
 */
export function initGlobalDialogInterceptor() {
  if (typeof window === 'undefined') return;

  // Interceptar alert nativo de Windows / navegador
  window.alert = (msg) => {
    const text = String(msg || '');
    // Si el texto es muy largo o contiene saltos de línea múltiples, usar modal, de lo contrario toast
    if (text.length > 120 || text.includes('\n\n')) {
      showAlertModal({
        title: 'Aviso del Sistema',
        message: text,
        type: 'info'
      });
    } else {
      showToast({
        message: text,
        type: 'info',
        duration: 4500
      });
    }
  };

  // Interceptar confirm nativo de Windows
  window.confirm = (msg) => {
    console.warn('[Nuvexa] Se bloqueó llamada síncrona a window.confirm nativo de Windows. Usa showConfirmModal() asíncrono en su lugar.');
    // Muestra un toast informativo para que el usuario no quede a oscuras
    showToast({
      title: 'Acción requerida',
      message: String(msg || 'Confirmación bloqueada por seguridad.'),
      type: 'warning'
    });
    return false;
  };

  // Interceptar prompt nativo de Windows
  window.prompt = () => {
    console.warn('[Nuvexa] Se bloqueó llamada a window.prompt nativo de Windows.');
    return null;
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
