/**
 * Herramienta: Transcriptor de Audio a Texto (100% en el Navegador)
 * Utiliza Whisper de OpenAI vía Transformers.js (WebAssembly) para procesar
 * archivos de audio sin enviarlos a servidores externos, garantizando privacidad total.
 * Incluye además modo de dictado por voz en tiempo real con Web Speech API.
 */

import { isProUser, canPerformDownload, consumeDailyUse } from '../services/storage.js';

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

  // Importar dinámicamente Transformers.js
  const { pipeline, env } = await import('@xenova/transformers');
  
  // Evitar búsquedas de archivos locales inexistentes
  env.allowLocalModels = false;

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

  // Elementos de Dictado en Vivo (Micrófono)
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
      alert('Por favor selecciona un archivo de audio válido (.mp3, .wav, .m4a, .ogg, .webm, .opus).');
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
      if (progressStatus) progressStatus.textContent = 'Preparando entorno de IA local...';

      try {
        // 1. Cargar el modelo Whisper
        if (progressStatus) progressStatus.textContent = 'Cargando modelo Whisper de IA (se descarga 1 sola vez en tu caché)...';
        const transcriber = await getWhisperPipeline((progressPercent) => {
          if (progressFill) progressFill.style.width = `${Math.max(10, Math.min(60, progressPercent * 0.6))}%`;
          if (progressStatus) progressStatus.textContent = `Descargando modelo: ${progressPercent}%`;
        });

        // 2. Decodificar audio
        if (progressFill) progressFill.style.width = '70%';
        if (progressStatus) progressStatus.textContent = 'Decodificando ondas de audio a 16kHz...';
        const { audioData, duration } = await decodeAudioFile(audioFile);

        // 3. Transcribir
        if (progressFill) progressFill.style.width = '85%';
        if (progressStatus) progressStatus.textContent = `Analizando ${formatDuration(duration)} de audio con Whisper...`;

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
        alert(`No se pudo completar la transcripción: ${err.message || 'Error de procesamiento'}`);
        if (progressStatus) progressStatus.textContent = `Error: ${err.message}`;
      } finally {
        isTranscribing = false;
        btnTranscribe.disabled = false;
        btnTranscribe.innerHTML = originalBtnText;
      }
    };
  }

  // =========================================================================
  // MODO SECUNDARIO: Dictado por Voz en Vivo (Web Speech API)
  // =========================================================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition && btnToggleLiveMic) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectLanguage?.value === 'english' ? 'en-US' : 'es-ES';

    selectLanguage?.addEventListener('change', () => {
      if (recognition) {
        recognition.lang = selectLanguage.value === 'english' ? 'en-US' : 'es-ES';
      }
    });

    recognition.onstart = () => {
      isRecording = true;
      if (micStatusPill) {
        micStatusPill.textContent = 'Escuchando en vivo... Habla ahora';
        micStatusPill.className = 'tier-badge pro';
      }
      if (micWaveAnim) micWaveAnim.style.display = 'flex';
      btnToggleLiveMic.classList.add('recording-active');
      btnToggleLiveMic.querySelector('.btn-mic-label').textContent = 'Pausar Dictado';
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalPart = event.results[i][0].transcript;
          const current = transcriptOutput.value.trim();
          transcriptOutput.value = current ? `${current} ${finalPart}` : finalPart;
        }
      }
      updateCounters();
    };

    recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Permiso de micrófono denegado. Habilita el acceso al micrófono en tu navegador para dictar en vivo.');
      }
      stopLiveMic();
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          stopLiveMic();
        }
      } else {
        stopLiveMic();
      }
    };

    function stopLiveMic() {
      isRecording = false;
      try {
        recognition.stop();
      } catch (e) {}

      if (micStatusPill) {
        micStatusPill.textContent = 'Micrófono Inactivo';
        micStatusPill.className = 'tier-badge free';
      }
      if (micWaveAnim) micWaveAnim.style.display = 'none';
      if (btnToggleLiveMic) {
        btnToggleLiveMic.classList.remove('recording-active');
        const label = btnToggleLiveMic.querySelector('.btn-mic-label');
        if (label) label.textContent = 'Iniciar Dictado en Vivo';
      }
    }

    btnToggleLiveMic.onclick = () => {
      if (!isRecording) {
        try {
          recognition.start();
        } catch (e) {
          console.error(e);
        }
      } else {
        stopLiveMic();
      }
    };
  } else if (btnToggleLiveMic) {
    btnToggleLiveMic.onclick = () => {
      alert('Tu navegador no soporta la Web Speech API nativa. Te recomendamos usar Google Chrome, Edge o Safari para el dictado por micrófono.');
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
    btnClearTranscript.onclick = () => {
      if (confirm('¿Deseas vaciar el texto de la transcripción?')) {
        transcriptOutput.value = '';
        updateCounters();
      }
    };
  }
}
