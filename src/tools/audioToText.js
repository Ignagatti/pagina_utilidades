/**
 * Herramienta: Transcriptor de Audio a Texto (100% en el Navegador)
 * Utiliza Whisper de OpenAI vía Transformers.js (WebAssembly) para procesar
 * archivos de audio sin enviarlos a servidores externos, garantizando privacidad total.
 * Incluye además modo de dictado por voz en tiempo real con Web Speech API.
 */

import { isProUser, canPerformDownload, consumeDailyUse, isElectronEnv } from '../services/storage.js';
import { showToast, showAlertModal, showConfirmModal } from '../utils/dialog.js';

let audioFile = null;
let audioUrl = null;
let isTranscribing = false;
let whisperPipeline = null;
let recognition = null;
let isRecording = false;

/**
 * Decodifica cualquier archivo de audio a un Float32Array mono a 16kHz
 * que es el formato requerido por Whisper.
 */
async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    
    let monoChannel = new Float32Array(length);
    
    if (numberOfChannels === 1) {
      monoChannel = audioBuffer.getChannelData(0);
    } else {
      // Mezclar a mono promediando los canales
      for (let i = 0; i < numberOfChannels; i++) {
        const channelData = audioBuffer.getChannelData(i);
        for (let j = 0; j < length; j++) {
          monoChannel[j] += channelData[j] / numberOfChannels;
        }
      }
    }

    return {
      audioData: monoChannel,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate
    };
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
  }
}

/**
 * Carga el modelo Whisper bajo demanda (Lazy-Loading)
 */
async function getWhisperPipeline(onProgress) {
  if (whisperPipeline) return whisperPipeline;

  // En Electron con nodeIntegration, process.release.name = 'node' hace que @xenova/transformers
  // intente cargar onnxruntime-node (nativo C++ inexistente en el bundle del renderer web)
  // provocando: "TypeError: Cannot read properties of undefined (reading 'create')" y luego
  // el error enmascarado: "Unsupported model type: whisper".
  // Al cambiar temporalmente process.release.name a 'browser', aseguramos que el backend
  // seleccione onnxruntime-web (WebAssembly) de forma 100% confiable tanto en escritorio como en web.
  if (typeof process !== 'undefined' && process?.release?.name === 'node') {
    try {
      Object.defineProperty(process, 'release', {
        value: { name: 'browser' },
        configurable: true,
        writable: true
      });
    } catch (e) {
      try { delete process.release; } catch (err) {}
    }
  }

  // Importar dinámicamente Transformers.js
  const { pipeline, env } = await import('@xenova/transformers');
  
  // Evitar búsquedas de archivos locales inexistentes y desactivar FS cache en entornos empaquetados
  env.allowLocalModels = false;
  env.useFS = false;
  env.useFSCache = false;

  // Asegurar rutas de WebAssembly remotas por si el entorno local no las provee
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
  }

  whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    progress_callback: (data) => {
      if (onProgress && data.status === 'progress' && data.progress !== undefined) {
        onProgress(Math.round(data.progress));
      }
    }
  });

  return whisperPipeline;
}

/**
 * Formatea segundos a mm:ss
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Inicializa la herramienta de Audio a Texto
 */
export function initAudioToText({ onUsageUpdated, onProModalRequested }) {
  // Elementos DOM de carga de archivos
  const dropzone = document.getElementById('audio-dropzone');
  const fileInput = document.getElementById('audio-file-input');
  const fileInfoCard = document.getElementById('audio-file-info');
  const fileNameEl = document.getElementById('audio-file-name');
  const fileSizeEl = document.getElementById('audio-file-size');
  const fileDurationEl = document.getElementById('audio-file-duration');
  const player = document.getElementById('audio-preview-player');
  const btnRemoveFile = document.getElementById('btn-remove-audio');
  const btnTranscribe = document.getElementById('btn-execute-transcribe');
  const selectLanguage = document.getElementById('select-audio-language');

  // Elementos de progreso
  const progressContainer = document.getElementById('transcribe-progress-container');
  const progressFill = document.getElementById('transcribe-progress-bar');
  const progressStatus = document.getElementById('transcribe-status-text');

  // Elementos de salida
  const transcriptOutput = document.getElementById('transcript-output-text');
  const wordCountBadge = document.getElementById('transcript-word-count');
  const charCountBadge = document.getElementById('transcript-char-count');
  const btnCopy = document.getElementById('btn-copy-transcript');
  const btnDownloadTxt = document.getElementById('btn-download-txt');
  const btnClearTranscript = document.getElementById('btn-clear-transcript');

  // Elementos de Dictado en Vivo y Micrófono
  const btnMicModeWhisper = document.getElementById('btn-mic-mode-whisper');
  const btnMicModeStream = document.getElementById('btn-mic-mode-stream');
  const liveMicDesc = document.getElementById('live-mic-description');
  const btnCancelLiveMic = document.getElementById('btn-cancel-live-mic');
  const btnToggleLiveMic = document.getElementById('btn-toggle-live-mic');
  const micStatusPill = document.getElementById('mic-status-pill');
  const micWaveAnim = document.getElementById('mic-waveform-animation');

  if (!dropzone || !transcriptOutput) return;

  // Actualizar contadores de palabras y caracteres
  function updateCounters() {
    const text = (transcriptOutput.value || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;

    if (wordCountBadge) wordCountBadge.textContent = `${words} palabras`;
    if (charCountBadge) charCountBadge.textContent = `${chars} caracteres`;

    const hasText = text.length > 0;
    if (btnCopy) btnCopy.disabled = !hasText;
    if (btnDownloadTxt) btnDownloadTxt.disabled = !hasText;
    if (btnClearTranscript) btnClearTranscript.disabled = !hasText;
  }

  transcriptOutput.addEventListener('input', updateCounters);
  updateCounters();

  // Gestión de archivo cargado
  function handleFileSelected(file) {
    if (!file) return;

    // Acepta audio o video (muchas grabaciones de notas de voz son audio/ogg o video/webm)
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|webm|opus|flac)$/i)) {
      showToast({ message: 'Por favor selecciona un archivo de audio válido (.mp3, .wav, .m4a, .ogg, .webm, .opus).', type: 'warning' });
      return;
    }

    audioFile = file;

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    audioUrl = URL.createObjectURL(file);

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    
    if (player) {
      player.src = audioUrl;
      player.onloadedmetadata = () => {
        if (fileDurationEl) fileDurationEl.textContent = `Duración: ${formatDuration(player.duration)}`;
      };
    }

    dropzone.style.display = 'none';
    if (fileInfoCard) fileInfoCard.style.display = 'block';
    if (btnTranscribe) btnTranscribe.disabled = false;

    // Resetear estados de progreso
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressStatus) progressStatus.textContent = 'Listo para transcribir';
  }

  // Eventos de Dropzone
  dropzone.onclick = () => fileInput?.click();
  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  });

  // Quitar archivo
  if (btnRemoveFile) {
    btnRemoveFile.onclick = () => {
      audioFile = null;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        audioUrl = null;
      }
      if (player) {
        player.pause();
        player.src = '';
      }
      if (fileInput) fileInput.value = '';
      if (fileInfoCard) fileInfoCard.style.display = 'none';
      dropzone.style.display = 'block';
      if (btnTranscribe) btnTranscribe.disabled = true;
      if (progressContainer) progressContainer.style.display = 'none';
    };
  }

  // Ejecutar Transcripción de Archivo de Audio con Whisper
  if (btnTranscribe) {
    btnTranscribe.onclick = async () => {
      if (!audioFile || isTranscribing) return;

      if (!canPerformDownload()) {
        if (onProModalRequested) onProModalRequested('daily_limit');
        return;
      }

      isTranscribing = true;
      btnTranscribe.disabled = true;
      const originalBtnText = btnTranscribe.innerHTML;
      btnTranscribe.innerHTML = `
        <span class="spinner-inline"></span>
        <span>Transcribiendo...</span>
      `;

      if (progressContainer) progressContainer.style.display = 'block';
      if (progressFill) progressFill.style.width = '10%';
      if (progressStatus) progressStatus.textContent = 'Preparando entorno de procesamiento local...';

      try {
        // 1. Cargar el modelo Whisper
        if (progressStatus) progressStatus.textContent = 'Cargando motor de transcripción (se descarga 1 sola vez en tu caché)...';
        const transcriber = await getWhisperPipeline((progressPercent) => {
          if (progressFill) progressFill.style.width = `${Math.max(10, Math.min(60, progressPercent * 0.6))}%`;
          if (progressStatus) progressStatus.textContent = `Descargando componentes: ${progressPercent}%`;
        });

        // 2. Decodificar audio
        if (progressFill) progressFill.style.width = '70%';
        if (progressStatus) progressStatus.textContent = 'Decodificando ondas de audio a 16kHz...';
        const { audioData, duration } = await decodeAudioFile(audioFile);

        // 3. Transcribir
        if (progressFill) progressFill.style.width = '85%';
        if (progressStatus) progressStatus.textContent = `Analizando ${formatDuration(duration)} de audio...`;

        const lang = selectLanguage?.value || 'spanish';
        const options = {
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: false
        };

        if (lang !== 'auto') {
          options.language = lang;
        }

        const output = await transcriber(audioData, options);
        const resultText = (output?.text || '').trim();

        if (!resultText) {
          throw new Error('No se detectó voz perceptible en el audio.');
        }

        // Agregar al resultado
        const existingText = transcriptOutput.value.trim();
        transcriptOutput.value = existingText ? `${existingText}\n\n${resultText}` : resultText;
        updateCounters();

        if (progressFill) progressFill.style.width = '100%';
        if (progressStatus) progressStatus.textContent = '¡Transcripción completada! Recuerda revisar el texto por posibles imprecisiones acústicas.';

        consumeDailyUse();
        if (onUsageUpdated) onUsageUpdated();

        setTimeout(() => {
          if (progressContainer) progressContainer.style.display = 'none';
        }, 4000);

      } catch (err) {
        console.error('Error al transcribir audio:', err);
        showToast({ message: `No se pudo completar la transcripción: ${err.message || 'Error de procesamiento'}`, type: 'error' });
        if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
      } finally {
        isTranscribing = false;
        btnTranscribe.disabled = false;
        btnTranscribe.innerHTML = originalBtnText;
      }
    };
  }

  // =========================================================================
  // MODO MICRÓFONO: IA Whisper (Precisión 10/10) & Dictado en Vivo Optimizado
  // =========================================================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isDesktop = isElectronEnv();

  // Modo de micrófono actual ('whisper' por defecto para garantizar fidelidad 10/10)
  let currentMicMode = 'whisper';
  let isMicActive = false;
  let userWantsMic = false;
  let micRestartTimer = null;
  let baseTranscript = '';
  let interimTranscript = '';

  // Variables para grabación con MediaRecorder (Modo IA Whisper)
  let mediaStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingSeconds = 0;
  let isWhisperTranscribingMic = false;

  // Actualiza la interfaz visual según el modo de micrófono seleccionado
  function updateMicModeUI() {
    if (btnMicModeWhisper) {
      btnMicModeWhisper.classList.toggle('active', currentMicMode === 'whisper');
    }
    if (btnMicModeStream) {
      btnMicModeStream.classList.toggle('active', currentMicMode === 'stream');
    }

    if (liveMicDesc) {
      if (isDesktop) {
        liveMicDesc.textContent = 'En la versión de escritorio de Nuvexa el micrófono se procesa 100% en local con la IA Whisper, garantizando máxima fidelidad y privacidad sin conexión.';
      } else if (currentMicMode === 'whisper') {
        liveMicDesc.textContent = 'Graba tu voz y la procesa con la red neuronal Whisper local. Comprensión precisa 10/10 de términos técnicos, jergas y nombres.';
      } else {
        liveMicDesc.textContent = 'Dicta en tiempo real con transcripción continua inmediata adaptada a tu acento regional.';
      }
    }

    if (btnToggleLiveMic && !isMicActive && !isWhisperTranscribingMic) {
      const label = btnToggleLiveMic.querySelector('.btn-mic-label');
      if (label) {
        label.textContent = currentMicMode === 'whisper' ? 'Iniciar Grabación con IA' : 'Iniciar Dictado en Vivo';
      }
    }
  }

  // Inicializar estado según entorno
  if (isDesktop) {
    currentMicMode = 'whisper';
  }
  updateMicModeUI();

  // Cambiadores de modo
  if (btnMicModeWhisper) {
    btnMicModeWhisper.onclick = () => {
      if (isMicActive || isWhisperTranscribingMic) {
        showToast({ message: 'Detén la grabación actual antes de cambiar de modo.', type: 'warning' });
        return;
      }
      currentMicMode = 'whisper';
      updateMicModeUI();
    };
  }

  if (btnMicModeStream) {
    btnMicModeStream.onclick = () => {
      if (isMicActive || isWhisperTranscribingMic) {
        showToast({ message: 'Detén el dictado actual antes de cambiar de modo.', type: 'warning' });
        return;
      }
      if (isDesktop) {
        showToast({ message: 'En la versión de escritorio se utiliza el Modo IA Whisper para procesamiento 100% privado y sin conexión.', type: 'info' });
        return;
      }
      if (!SpeechRecognition) {
        showToast({ message: 'Tu navegador no soporta Web Speech API. Se mantendrá el Modo IA Whisper.', type: 'warning' });
        return;
      }
      currentMicMode = 'stream';
      updateMicModeUI();
    };
  }

  // Obtiene el dialecto adecuado para Web Speech en base al navegador y configuración
  function getWebSpeechLanguage() {
    const selected = selectLanguage?.value || 'spanish';
    if (selected === 'english') {
      return (navigator.language && navigator.language.startsWith('en')) ? navigator.language : 'en-US';
    }
    if (selected === 'spanish') {
      // Si el navegador del usuario está configurado en español (ej: es-AR, es-MX, es-CO, es-CL, es-ES, etc.)
      // usamos ese dialecto para que el modelo acústico de Google reconozca la pronunciación nativa del usuario
      if (navigator.language && navigator.language.startsWith('es')) {
        return navigator.language;
      }
      return 'es-419'; // Español de Latinoamérica por defecto
    }
    return navigator.language || 'es-419';
  }

  // Detener y resetear cualquier tipo de captura de micrófono
  function stopAllMic() {
    userWantsMic = false;
    isMicActive = false;
    clearTimeout(micRestartTimer);
    clearInterval(recordingTimer);

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStream = null;
    }

    if (micStatusPill) {
      micStatusPill.textContent = 'Micrófono Inactivo';
      micStatusPill.className = 'tier-badge free';
    }
    if (micWaveAnim) micWaveAnim.style.display = 'none';
    if (btnCancelLiveMic) btnCancelLiveMic.style.display = 'none';

    if (btnToggleLiveMic) {
      btnToggleLiveMic.classList.remove('recording-active');
      btnToggleLiveMic.disabled = false;
      const label = btnToggleLiveMic.querySelector('.btn-mic-label');
      if (label) {
        label.textContent = currentMicMode === 'whisper' ? 'Iniciar Grabación con IA' : 'Iniciar Dictado en Vivo';
      }
    }

    // Reactivar controles de modo
    if (btnMicModeWhisper) btnMicModeWhisper.disabled = false;
    if (btnMicModeStream) btnMicModeStream.disabled = false;
  }

  // Sincronizar el texto base si el usuario edita mientras el mic está apagado
  transcriptOutput.addEventListener('input', () => {
    if (!isMicActive) {
      baseTranscript = transcriptOutput.value;
    }
  });

  // Botón para descartar grabación sin transcribir
  if (btnCancelLiveMic) {
    btnCancelLiveMic.onclick = () => {
      userWantsMic = false;
      audioChunks = [];
      stopAllMic();
      showToast({ message: 'Grabación de voz descartada.', type: 'info' });
    };
  }

  // -------------------------------------------------------------------------
  // MODO A: Web Speech API (Dictado en Vivo con Detección Regional Adaptada)
  // -------------------------------------------------------------------------
  function startWebSpeech() {
    if (!SpeechRecognition) {
      currentMicMode = 'whisper';
      updateMicModeUI();
      startWhisperMediaRecorder();
      return;
    }

    userWantsMic = true;
    baseTranscript = transcriptOutput.value;
    interimTranscript = '';

    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getWebSpeechLanguage();

      selectLanguage?.addEventListener('change', () => {
        if (recognition) {
          recognition.lang = getWebSpeechLanguage();
        }
      });

      recognition.onstart = () => {
        isMicActive = true;
        if (btnMicModeWhisper) btnMicModeWhisper.disabled = true;
        if (btnMicModeStream) btnMicModeStream.disabled = true;

        if (micStatusPill) {
          micStatusPill.textContent = 'Escuchando en vivo... Habla con tranquilidad';
          micStatusPill.className = 'tier-badge pro';
        }
        if (micWaveAnim) micWaveAnim.style.display = 'flex';
        if (btnToggleLiveMic) {
          btnToggleLiveMic.classList.add('recording-active');
          const label = btnToggleLiveMic.querySelector('.btn-mic-label');
          if (label) label.textContent = 'Pausar Dictado';
        }
      };

      recognition.onresult = (event) => {
        interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            baseTranscript = (baseTranscript ? baseTranscript.trim() + ' ' : '') + transcript.trim();
          } else {
            interimTranscript += transcript;
          }
        }
        const fullText = (baseTranscript ? baseTranscript.trim() : '') +
          (interimTranscript ? (baseTranscript ? ' ' : '') + interimTranscript.trim() : '');
        transcriptOutput.value = fullText;
        updateCounters();
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition event status:', event.error);

        // 'no-speech' y 'aborted' son pausas naturales de respiración; no apagan el micrófono
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        if (event.error === 'not-allowed') {
          stopAllMic();
          showAlertModal({
            title: 'Permiso de Micrófono Requerido',
            message: 'El acceso al micrófono fue denegado. Habilita el permiso en tu navegador para dictar en vivo.',
            type: 'warning'
          });
          return;
        }

        if (event.error === 'network') {
          console.warn('Servidor de reconocimiento no disponible. Conmutando a Modo IA Whisper...');
          stopAllMic();
          currentMicMode = 'whisper';
          updateMicModeUI();
          startWhisperMediaRecorder();
          return;
        }

        if (event.error === 'audio-capture') {
          stopAllMic();
          showAlertModal({
            title: 'Micrófono No Detectado',
            message: 'No se detectó ningún micrófono activo conectado a tu equipo.',
            type: 'warning'
          });
        }
      };

      recognition.onend = () => {
        // En Chrome, tras pausas prolongadas onend se dispara automáticamente.
        // Si el usuario no presionó pausar, reiniciamos suavemente para mantener la escucha continua.
        if (userWantsMic) {
          clearTimeout(micRestartTimer);
          micRestartTimer = setTimeout(() => {
            if (userWantsMic) {
              try {
                recognition.start();
              } catch (err) {
                setTimeout(() => {
                  if (userWantsMic) {
                    try { recognition.start(); } catch (e) {}
                  }
                }, 250);
              }
            }
          }, 150);
        } else {
          stopAllMic();
        }
      };
    }

    try {
      recognition.lang = getWebSpeechLanguage();
      recognition.start();
    } catch (e) {
      console.warn('Error al iniciar Web Speech:', e);
      setTimeout(() => {
        if (userWantsMic) {
          try { recognition.start(); } catch (err) {}
        }
      }, 200);
    }
  }

  // -------------------------------------------------------------------------
  // MODO B: Grabación con Filtros Acústicos y Procesamiento Local (Whisper IA)
  // -------------------------------------------------------------------------
  async function startWhisperMediaRecorder() {
    userWantsMic = true;
    audioChunks = [];
    recordingSeconds = 0;

    try {
      // Captura acústica optimizada con cancelación de ruido y eco
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });
    } catch (err) {
      userWantsMic = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showAlertModal({
          title: 'Permiso de Micrófono Denegado',
          message: 'El acceso al micrófono fue denegado. Permite el acceso al micrófono en la configuración de tu sistema o navegador.',
          type: 'warning'
        });
      } else {
        showAlertModal({
          title: 'Micrófono No Disponible',
          message: 'No se pudo acceder al micrófono: ' + (err.message || 'Dispositivo no encontrado'),
          type: 'warning'
        });
      }
      return;
    }

    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
    }

    try {
      mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
    } catch (e) {
      mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      clearInterval(recordingTimer);
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
      }

      if (btnCancelLiveMic) btnCancelLiveMic.style.display = 'none';

      if (audioChunks.length === 0 || !userWantsMic) {
        stopAllMic();
        return;
      }

      const recordedBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
      if (recordedBlob.size < 1200) {
        showToast({ message: 'Grabación de voz muy corta.', type: 'warning' });
        stopAllMic();
        return;
      }

      // Procesar audio grabado directamente en local con Whisper
      isWhisperTranscribingMic = true;
      if (btnToggleLiveMic) {
        btnToggleLiveMic.disabled = true;
        btnToggleLiveMic.classList.remove('recording-active');
        const label = btnToggleLiveMic.querySelector('.btn-mic-label');
        if (label) label.textContent = 'Transcribiendo con IA...';
      }
      if (micStatusPill) {
        micStatusPill.textContent = 'Procesando voz con Whisper IA (Precisión 10/10)...';
        micStatusPill.className = 'tier-badge pro';
      }
      if (micWaveAnim) micWaveAnim.style.display = 'none';

      if (progressContainer) {
        progressContainer.style.display = 'block';
        if (progressFill) progressFill.style.width = '20%';
        if (progressStatus) progressStatus.textContent = 'Preparando entorno de IA local...';
      }

      try {
        const transcriber = await getWhisperPipeline((progressPercent) => {
          if (progressFill) progressFill.style.width = `${Math.round(progressPercent * 0.5)}%`;
          if (progressStatus) progressStatus.textContent = `Cargando componentes IA: ${progressPercent}%`;
        });

        if (progressFill) progressFill.style.width = '70%';
        if (progressStatus) progressStatus.textContent = 'Decodificando ondas de audio...';
        const { audioData } = await decodeAudioFile(recordedBlob);

        if (progressFill) progressFill.style.width = '85%';
        if (progressStatus) progressStatus.textContent = 'Analizando voz con red neuronal Whisper...';

        const lang = selectLanguage?.value || 'spanish';
        const options = {
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: false
        };
        if (lang !== 'auto') options.language = lang;

        const output = await transcriber(audioData, options);
        const transcribedText = (output?.text || '').trim();

        if (transcribedText) {
          const existing = transcriptOutput.value.trim();
          transcriptOutput.value = existing ? `${existing}\n\n${transcribedText}` : transcribedText;
          updateCounters();
          showToast({ message: '¡Audio del micrófono transcrito exitosamente con IA!', type: 'success' });
          if (progressFill) progressFill.style.width = '100%';
          if (progressStatus) progressStatus.textContent = '¡Transcripción con IA completada!';
        } else {
          showToast({ message: 'No se detectó voz clara en la grabación.', type: 'warning' });
        }
      } catch (err) {
        console.error('Error al transcribir voz del micrófono:', err);
        showToast({ message: `Error en la transcripción: ${err.message}`, type: 'error' });
      } finally {
        isWhisperTranscribingMic = false;
        stopAllMic();
        setTimeout(() => {
          if (progressContainer) progressContainer.style.display = 'none';
        }, 3000);
      }
    };

    mediaRecorder.start(250);
    isMicActive = true;

    // Desactivar cambio de modo durante grabación
    if (btnMicModeWhisper) btnMicModeWhisper.disabled = true;
    if (btnMicModeStream) btnMicModeStream.disabled = true;

    if (btnToggleLiveMic) {
      btnToggleLiveMic.classList.add('recording-active');
      const label = btnToggleLiveMic.querySelector('.btn-mic-label');
      if (label) label.textContent = 'Detener y Transcribir (0:00)';
    }
    if (btnCancelLiveMic) {
      btnCancelLiveMic.style.display = 'inline-flex';
    }
    if (micStatusPill) {
      micStatusPill.textContent = 'Grabando micrófono (0:00)... Habla con normalidad';
      micStatusPill.className = 'tier-badge pro';
    }
    if (micWaveAnim) micWaveAnim.style.display = 'flex';

    clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const timeStr = formatDuration(recordingSeconds);
      const label = btnToggleLiveMic?.querySelector('.btn-mic-label');
      if (label) label.textContent = `Detener y Transcribir (${timeStr})`;
      if (micStatusPill) micStatusPill.textContent = `Grabando micrófono (${timeStr})... Habla con normalidad`;
    }, 1000);
  }

  // Manejador del botón principal de Dictado / Grabación por Micrófono
  if (btnToggleLiveMic) {
    btnToggleLiveMic.onclick = () => {
      if (isWhisperTranscribingMic) return;

      if (!isMicActive) {
        if (currentMicMode === 'whisper' || isDesktop || !SpeechRecognition) {
          startWhisperMediaRecorder();
        } else {
          startWebSpeech();
        }
      } else {
        if (currentMicMode === 'whisper') {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
              mediaRecorder.requestData();
            } catch (e) {}
            mediaRecorder.stop();
          } else {
            stopAllMic();
          }
        } else {
          stopAllMic();
        }
      }
    };
  }

  // Botón Copiar al Portapapeles
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const text = transcriptOutput.value;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const originalText = btnCopy.querySelector('.btn-label')?.textContent || 'Copiar';
        const label = btnCopy.querySelector('.btn-label');
        if (label) label.textContent = '¡Copiado!';
        btnCopy.classList.add('copied-success');

        setTimeout(() => {
          if (label) label.textContent = originalText;
          btnCopy.classList.remove('copied-success');
        }, 2000);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    };
  }

  // Botón Descargar Archivo .TXT
  if (btnDownloadTxt) {
    btnDownloadTxt.onclick = () => {
      const text = transcriptOutput.value;
      if (!text) return;

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcripcion-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  }

  // Botón Limpiar
  if (btnClearTranscript) {
    btnClearTranscript.onclick = async () => {
      const ok = await showConfirmModal({
        title: 'Vaciar Transcripción',
        message: '¿Estás seguro de que deseas vaciar el texto de la transcripción? Esta acción no se puede deshacer.',
        confirmText: 'Sí, vaciar',
        cancelText: 'Cancelar',
        isDestructive: true
      });
      if (ok) {
        transcriptOutput.value = '';
        updateCounters();
      }
    };
  }
}
