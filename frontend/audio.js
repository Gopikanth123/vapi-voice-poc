/**
 * audio.js — Microphone Capture & Audio Playback for Vapi WebSocket
 *
 * AudioCapture: captures mic audio, resamples to 16kHz, converts Float32 → Int16 PCM
 * AudioPlayer:  receives Int16 PCM from Vapi, queues and plays via Web Audio API
 */

/* ============================================================
   AudioWorklet Processor (inline — created as a Blob URL)
   ============================================================ */
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buffer = [];
        this._bufferSize = 2048; // ~128ms at 16kHz
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const samples = input[0];
        for (let i = 0; i < samples.length; i++) {
            this._buffer.push(samples[i]);
        }

        while (this._buffer.length >= this._bufferSize) {
            const chunk = this._buffer.splice(0, this._bufferSize);
            this.port.postMessage({ pcmFloat: new Float32Array(chunk) });
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
`;

/* ============================================================
   AudioCapture
   ============================================================ */
class AudioCapture {
    constructor({ onPCM, targetSampleRate = 16000 }) {
        this.onPCM = onPCM;
        this.targetSampleRate = targetSampleRate;
        this.audioContext = null;
        this.stream = null;
        this.source = null;
        this.workletNode = null;
        this.analyser = null;
        this.running = false;
    }

    async start() {
        try {
            // Request microphone
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.targetSampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            this.audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            // Analyser for waveform visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.source.connect(this.analyser);

            // Create AudioWorklet from inline code
            const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);

            await this.audioContext.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);

            this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

            this.workletNode.port.onmessage = (event) => {
                if (!this.running) return;
                const float32 = event.data.pcmFloat;
                const int16 = this._float32ToInt16(float32);
                this.onPCM(int16.buffer);
            };

            this.source.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination); // needed to keep processing alive

            this.running = true;
            console.log('[AudioCapture] Started — sample rate:', this.audioContext.sampleRate);
        } catch (err) {
            console.error('[AudioCapture] Failed to start:', err);
            throw err;
        }
    }

    stop() {
        this.running = false;

        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }
        console.log('[AudioCapture] Stopped');
    }

    /** Get frequency data for visualization */
    getFrequencyData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    /** Get time domain data for waveform */
    getTimeDomainData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }

    /** Convert Float32 [-1, 1] to Int16 [-32768, 32767] */
    _float32ToInt16(float32) {
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return int16;
    }
}

/* ============================================================
   AudioPlayer
   ============================================================ */
class AudioPlayer {
    constructor({ sampleRate = 16000 } = {}) {
        this.sampleRate = sampleRate;
        this.audioContext = null;
        this.gainNode = null;
        this.queue = [];
        this.activeSources = []; // Track currently playing/scheduled sources
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.onPlayingChange = null; // callback(isPlaying)
    }

    init() {
        if (this.audioContext) return;
        this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;
        this.gainNode.connect(this.audioContext.destination);
        console.log('[AudioPlayer] Initialized — sample rate:', this.sampleRate);
    }

    /** Queue Int16 PCM data for playback */
    enqueue(int16Buffer) {
        if (!this.audioContext) this.init();

        const int16 = new Int16Array(int16Buffer);
        const float32 = this._int16ToFloat32(int16);

        const audioBuffer = this.audioContext.createBuffer(1, float32.length, this.sampleRate);
        audioBuffer.getChannelData(0).set(float32);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode);

        const currentTime = this.audioContext.currentTime;
        const startTime = Math.max(currentTime, this.nextStartTime);
        source.start(startTime);
        this.nextStartTime = startTime + audioBuffer.duration;

        this.activeSources.push(source);

        if (!this.isPlaying) {
            this.isPlaying = true;
            if (this.onPlayingChange) this.onPlayingChange(true);
        }

        source.onended = () => {
            // Remove source from activeSources
            this.activeSources = this.activeSources.filter((s) => s !== source);

            if (this.audioContext && this.audioContext.currentTime >= this.nextStartTime - 0.05) {
                this.isPlaying = false;
                if (this.onPlayingChange) this.onPlayingChange(false);
            }
        };
    }

    /** Stop all currently playing/scheduled audio immediately */
    interrupt() {
        console.log('[AudioPlayer] Interrupted, clearing active playback sources');
        this.activeSources.forEach((source) => {
            source.onended = null; // Prevent onended from firing and updating state
            try {
                source.stop();
            } catch (e) {
                // ignore if already stopped or not started
            }
        });
        this.activeSources = [];
        this.nextStartTime = 0;
        if (this.isPlaying) {
            this.isPlaying = false;
            if (this.onPlayingChange) this.onPlayingChange(false);
        }
    }

    stop() {
        // Stop all active sources first
        this.activeSources.forEach((source) => {
            source.onended = null;
            try {
                source.stop();
            } catch (e) {}
        });
        this.activeSources = [];

        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }
        this.gainNode = null;
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.queue = [];
        console.log('[AudioPlayer] Stopped');
    }

    /** Convert Int16 [-32768, 32767] to Float32 [-1, 1] */
    _int16ToFloat32(int16) {
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 0x8000;
        }
        return float32;
    }
}

// Export globally
window.AudioCapture = AudioCapture;
window.AudioPlayer = AudioPlayer;
