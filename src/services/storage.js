// Servicio de Almacenamiento y Control Freemium
const USAGE_KEY = 'quicktools_daily_usage';
const PRO_KEY = 'quicktools_pro_license';
const MAX_FREE_DAILY_USES = 3;

/**
 * Detecta si la aplicación se está ejecutando en la versión de escritorio (Electron)
 */
export function isElectronEnv() {
  return typeof window !== 'undefined' && (
    Boolean(window.electronAPI?.isElectron) ||
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) ||
    (typeof window.process !== 'undefined' && Boolean(window.process?.versions?.electron))
  );
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Verifica si el usuario tiene el pase PRO activo
 * En la versión de escritorio siempre es true ya que es distribuida libremente.
 * En la versión web (npm run dev) evalúa la licencia freemium.
 */
export function isProUser() {
  if (isElectronEnv()) {
    return true;
  }

  try {
    const proData = localStorage.getItem(PRO_KEY);
    if (!proData) return false;
    const parsed = JSON.parse(proData);
    return Boolean(parsed && parsed.active);
  } catch (e) {
    console.error('Error leyendo estado PRO:', e);
    return false;
  }
}

/**
 * Obtiene la información del uso diario actual
 */
export function getUsageStatus() {
  const isElectron = isElectronEnv();
  const isPro = isProUser();
  const today = getTodayString();

  if (isElectron || isPro) {
    return {
      isPro: true,
      isElectron,
      count: 0,
      max: Infinity,
      remaining: Infinity,
      percentage: 0
    };
  }

  let usage = { date: today, count: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        usage = parsed;
      } else {
        // Nuevo día: reiniciamos el contador
        usage = { date: today, count: 0 };
        localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
      }
    }
  } catch (e) {
    console.error('Error leyendo uso diario:', e);
  }

  const remaining = Math.max(0, MAX_FREE_DAILY_USES - usage.count);
  const percentage = Math.min(100, Math.round((usage.count / MAX_FREE_DAILY_USES) * 100));

  return {
    isPro: false,
    isElectron: false,
    count: usage.count,
    max: MAX_FREE_DAILY_USES,
    remaining,
    percentage
  };
}

/**
 * Valida si el usuario puede realizar una acción protegida (descargar)
 */
export function canPerformDownload() {
  if (isElectronEnv() || isProUser()) return true;
  const status = getUsageStatus();
  return status.remaining > 0;
}

/**
 * Registra y descuenta un uso diario
 */
export function consumeDailyUse() {
  if (isElectronEnv() || isProUser()) {
    return getUsageStatus();
  }

  const today = getTodayString();
  let usage = { date: today, count: 0 };

  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        usage = parsed;
      }
    }
    usage.count += 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch (e) {
    console.error('Error guardando consumo:', e);
  }

  return getUsageStatus();
}

/**
 * Activa la licencia PRO en el dispositivo
 * Acepta cualquier código de prueba o de compra
 */
export function activateProLicense(key = 'LICENCIA-PRO-DEMO') {
  try {
    const proPayload = {
      active: true,
      licenseKey: key,
      activatedAt: new Date().toISOString(),
      plan: 'Lifetime Pro'
    };
    localStorage.setItem(PRO_KEY, JSON.stringify(proPayload));
    return { success: true, message: '¡Plan PRO activado con éxito!' };
  } catch (e) {
    return { success: false, message: 'Error al activar la licencia' };
  }
}

/**
 * Desactiva el modo PRO (útil para pruebas)
 */
export function deactivatePro() {
  localStorage.removeItem(PRO_KEY);
}

/**
 * Restablece el contador a 0 (útil para pruebas)
 */
export function resetDailyUsage() {
  const today = getTodayString();
  localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: 0 }));
}
