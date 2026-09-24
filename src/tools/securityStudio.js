import { canPerformDownload, consumeDailyUse } from '../services/storage.js';
import { showToast, showAlertModal } from '../utils/dialog.js';

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function initSecurityStudio({ onUsageUpdated, onProModalRequested }) {

  const secTabs = document.querySelectorAll('.sec-tab-btn');
  const secPanels = document.querySelectorAll('.sec-tab-panel');

  secTabs.forEach(btn => {
    btn.onclick = () => {
      secTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.sectab;
      secPanels.forEach(p => {
        p.classList.toggle('active', p.dataset.sectab === target);
      });
    };
  });

  const encFileInput = document.getElementById('enc-file-input');
  const encDropzone = document.getElementById('enc-file-dropzone');
  const encFileName = document.getElementById('enc-file-name');
  const encPasswordInput = document.getElementById('enc-password');
  const btnExecuteEncrypt = document.getElementById('btn-execute-encrypt');

  const decFileInput = document.getElementById('dec-file-input');
  const decDropzone = document.getElementById('dec-file-dropzone');
  const decFileName = document.getElementById('dec-file-name');
  const decPasswordInput = document.getElementById('dec-password');
  const btnExecuteDecrypt = document.getElementById('btn-execute-decrypt');

  let fileToEncrypt = null;
  let fileToDecrypt = null;

  if (encDropzone) {
    encDropzone.onclick = () => encFileInput?.click();
    encFileInput?.addEventListener('change', (e) => {
      fileToEncrypt = e.target.files?.[0];
      if (fileToEncrypt && encFileName) {
        encFileName.textContent = `Archivo seleccionado: ${fileToEncrypt.name} (${(fileToEncrypt.size / 1024).toFixed(1)} KB)`;
      }
    });
  }

  if (decDropzone) {
    decDropzone.onclick = () => decFileInput?.click();
    decFileInput?.addEventListener('change', (e) => {
      fileToDecrypt = e.target.files?.[0];
      if (fileToDecrypt && decFileName) {
        decFileName.textContent = `Archivo cifrado seleccionado: ${fileToDecrypt.name}`;
      }
    });
  }

  btnExecuteEncrypt?.addEventListener('click', async () => {
    if (!fileToEncrypt) {
      showToast({ message: 'Selecciona un archivo para cifrar.', type: 'warning' });
      return;
    }
    const password = encPasswordInput?.value;
    if (!password || password.length < 4) {
      showToast({ message: 'Ingresa una contraseña segura de al menos 4 caracteres.', type: 'warning' });
      return;
    }

    try {
      const fileBuffer = await fileToEncrypt.arrayBuffer();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);

      const enc = new TextEncoder();
      const metaJson = JSON.stringify({ name: fileToEncrypt.name, type: fileToEncrypt.type });
      const metaBytes = enc.encode(metaJson);
      const metaLen = new Uint16Array([metaBytes.length]);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        fileBuffer
      );

      const finalBlob = new Blob([salt, iv, metaLen, metaBytes, ciphertext], { type: 'application/octet-stream' });

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileToEncrypt.name}.enc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      showAlertModal({
        title: '¡Archivo Cifrado con Éxito!',
        message: 'Tu archivo ha sido protegido con AES-256 militar. Guarda tu contraseña en un lugar seguro: sin ella no podrás recuperarlo jamás.',
        type: 'success'
      });
    } catch (err) {
      console.error('Error al cifrar:', err);
      showToast({ message: 'Error al cifrar el archivo: ' + err.message, type: 'error' });
    }
  });

  btnExecuteDecrypt?.addEventListener('click', async () => {
    if (!fileToDecrypt) {
      showToast({ message: 'Selecciona un archivo protegido (.enc) para descifrar.', type: 'warning' });
      return;
    }
    const password = decPasswordInput?.value;
    if (!password) {
      showToast({ message: 'Introduce la contraseña que utilizaste al cifrar el archivo.', type: 'warning' });
      return;
    }

    try {
      const fullBuffer = await fileToDecrypt.arrayBuffer();
      const bytes = new Uint8Array(fullBuffer);

      if (bytes.length < 30) {
        throw new Error('El archivo no tiene el formato cifrado válido.');
      }

      const salt = bytes.slice(0, 16);
      const iv = bytes.slice(16, 28);
      const metaLen = new Uint16Array(fullBuffer.slice(28, 30))[0];

      const metaBytes = bytes.slice(30, 30 + metaLen);
      const dec = new TextDecoder();
      const metaJson = dec.decode(metaBytes);
      const meta = JSON.parse(metaJson);

      const ciphertext = bytes.slice(30 + metaLen);

      const key = await deriveKey(password, salt);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );

      const restoredBlob = new Blob([decryptedBuffer], { type: meta.type || 'application/octet-stream' });
      const url = URL.createObjectURL(restoredBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.name || 'archivo-descifrado';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      showToast({ message: '¡Archivo descifrado correctamente!', type: 'success' });
    } catch (err) {
      console.error('Error al descifrar:', err);
      showToast({ message: 'Contraseña incorrecta o archivo dañado. No se pudo descifrar.', type: 'error' });
    }
  });

  const hashFileInput = document.getElementById('hash-file-input');
  const hashDropzone = document.getElementById('hash-dropzone');
  const hashFileName = document.getElementById('hash-file-name');
  const sha256Output = document.getElementById('hash-sha256');
  const sha512Output = document.getElementById('hash-sha512');
  const sha1Output = document.getElementById('hash-sha1');

  function buf2hex(buffer) {
    return [...new Uint8Array(buffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }

  async function calculateFileHashes(file) {
    if (!file) return;
    if (hashFileName) hashFileName.textContent = `Archivo: ${file.name} (${formatBytes(file.size)})`;

    if (sha256Output) sha256Output.textContent = 'Calculando...';
    if (sha512Output) sha512Output.textContent = 'Calculando...';
    if (sha1Output) sha1Output.textContent = 'Calculando...';

    const buffer = await file.arrayBuffer();

    const [sha256, sha512, sha1] = await Promise.all([
      crypto.subtle.digest('SHA-256', buffer),
      crypto.subtle.digest('SHA-512', buffer),
      crypto.subtle.digest('SHA-1', buffer)
    ]);

    if (sha256Output) sha256Output.textContent = buf2hex(sha256);
    if (sha512Output) sha512Output.textContent = buf2hex(sha512);
    if (sha1Output) sha1Output.textContent = buf2hex(sha1);
  }

  if (hashDropzone) {
    hashDropzone.onclick = () => hashFileInput?.click();
    hashFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) calculateFileHashes(file);
    });
  }

  const passLengthSlider = document.getElementById('pass-length-slider');
  const passLengthVal = document.getElementById('pass-length-val');
  const checkUpper = document.getElementById('pass-check-upper');
  const checkLower = document.getElementById('pass-check-lower');
  const checkNum = document.getElementById('pass-check-num');
  const checkSym = document.getElementById('pass-check-sym');
  const generatedPassInput = document.getElementById('generated-pass-input');
  const passStrengthLabel = document.getElementById('pass-strength-label');
  const passStrengthBar = document.getElementById('pass-strength-bar');
  const btnRegenPass = document.getElementById('btn-regen-pass');
  const btnCopyPass = document.getElementById('btn-copy-pass');

  function generateSecurePassword() {
    const len = parseInt(passLengthSlider?.value) || 16;
    if (passLengthVal) passLengthVal.textContent = len;

    let chars = '';
    if (checkUpper?.checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (checkLower?.checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (checkNum?.checked) chars += '0123456789';
    if (checkSym?.checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    const array = new Uint32Array(len);
    crypto.getRandomValues(array);

    let password = '';
    for (let i = 0; i < len; i++) {
      password += chars[array[i] % chars.length];
    }

    if (generatedPassInput) generatedPassInput.value = password;

    let strength = 0;
    if (len >= 12) strength += 25;
    if (len >= 16) strength += 25;
    if (checkUpper?.checked && checkLower?.checked) strength += 20;
    if (checkNum?.checked) strength += 15;
    if (checkSym?.checked) strength += 15;

    strength = Math.min(100, strength);

    if (passStrengthBar) passStrengthBar.style.width = `${strength}%`;
    if (passStrengthLabel) {
      if (strength > 80) {
        passStrengthLabel.textContent = 'Ultra Segura';
        passStrengthBar.style.background = 'var(--color-success)';
      } else if (strength > 50) {
        passStrengthLabel.textContent = 'Fuerte';
        passStrengthBar.style.background = 'var(--color-primary)';
      } else {
        passStrengthLabel.textContent = 'Moderada';
        passStrengthBar.style.background = '#FFAB00';
      }
    }
  }

  passLengthSlider?.addEventListener('input', generateSecurePassword);
  [checkUpper, checkLower, checkNum, checkSym].forEach(c => c?.addEventListener('change', generateSecurePassword));
  btnRegenPass?.addEventListener('click', generateSecurePassword);

  btnCopyPass?.addEventListener('click', async () => {
    if (generatedPassInput?.value) {
      await navigator.clipboard.writeText(generatedPassInput.value);
      btnCopyPass.textContent = '¡Copiada!';
      setTimeout(() => {
        btnCopyPass.textContent = 'Copiar';
      }, 1500);
    }
  });

  generateSecurePassword();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
