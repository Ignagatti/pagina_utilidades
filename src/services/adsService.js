import { isProUser, isElectronEnv } from './storage.js';

let isAdsScriptLoaded = false;

/**
 * Inicializa Google AdSense únicamente para usuarios de la web en el plan gratuito.
 * Los usuarios Pro y la versión de escritorio Electron nunca cargan anuncios.
 * @param {string} [publisherId] - ID de editor de AdSense (ej: 'ca-pub-XXXXXXXXXXXXXXXX')
 */
export function initGoogleAds(publisherId) {
  if (isElectronEnv() || isProUser()) {
    removeExistingAds();
    return;
  }

  const clientPubId = publisherId || import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-2269676212469864';
  if (!clientPubId) {
    return;
  }

  if (isAdsScriptLoaded) return;

  const script = document.createElement('script');
  script.id = 'google-adsense-script';
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientPubId}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
  isAdsScriptLoaded = true;
}

/**
 * Remueve inmediatamente cualquier anuncio o contenedor publicitario del DOM
 * cuando el usuario activa su licencia Pro.
 */
export function removeExistingAds() {
  const adScript = document.getElementById('google-adsense-script');
  if (adScript) {
    adScript.remove();
    isAdsScriptLoaded = false;
  }

  const adElements = document.querySelectorAll('.adsbygoogle, .nuvexa-ad-slot, ins[data-ad-client]');
  adElements.forEach((el) => {
    el.style.display = 'none';
    el.innerHTML = '';
  });
}
