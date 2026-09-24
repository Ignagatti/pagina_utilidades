const USAGE_KEY = 'quicktools_daily_usage';
const PRO_KEY = 'quicktools_pro_license';
const MAX_FREE_DAILY_USES = 3;

export function isElectronEnv() {
  return typeof window !== 'undefined' && (
    Boolean(window.electronAPI?.isElectron) ||
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) ||
    (typeof window.process !== 'undefined' && Boolean(window.process?.versions?.electron))
  );
}

function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

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
    return false;
  }
}

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
        usage = { date: today, count: 0 };
        localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
      }
    }
  } catch (e) {
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

export function canPerformDownload() {
  if (isElectronEnv() || isProUser()) return true;
  const status = getUsageStatus();
  return status.remaining > 0;
}

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
  }

  return getUsageStatus();
}

export function getProLicenseInfo() {
  try {
    const raw = localStorage.getItem(PRO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isValidLicenseKey(key) {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toUpperCase();

  const nuvexaPattern = /^(PRO|NUV|NUVEXA)-[A-Z0-9]{4,8}-[A-Z0-9]{4,8}(-[A-Z0-9]+)?$/i;
  const uuidPattern = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

  return nuvexaPattern.test(cleanKey) || uuidPattern.test(cleanKey);
}

export function activateProLicense(key = '') {
  const cleanKey = (key || '').trim().toUpperCase();

  if (!isValidLicenseKey(cleanKey)) {
    return {
      success: false,
      message: 'Código de licencia no válido. Introduce el código que recibiste en el recibo de compra.'
    };
  }

  try {
    const proPayload = {
      active: true,
      licenseKey: cleanKey,
      activatedAt: new Date().toISOString(),
      plan: cleanKey.includes('ANNUAL') ? 'Plan Anual' : cleanKey.includes('MONTH') ? 'Plan Mensual' : 'Nuvexa Pro Ilimitado'
    };
    localStorage.setItem(PRO_KEY, JSON.stringify(proPayload));
    return { success: true, message: '¡Plan PRO activado con éxito!' };
  } catch (e) {
    return { success: false, message: 'Error al registrar la licencia en el dispositivo' };
  }
}

export function deactivatePro() {
  localStorage.removeItem(PRO_KEY);
}

export function resetDailyUsage() {
  const today = getTodayString();
  localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: 0 }));
}
