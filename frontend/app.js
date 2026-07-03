/**
 * app.js — Main Application Controller
 *
 * Orchestrates: WebSocket connection, audio streaming, UI state,
 * particle effects, waveform visualization, transcript, and timer.
 */

/* ============================================================
   Configuration
   ============================================================ */
const CONFIG = {
    backendUrl: '', // Empty string makes it use the same origin (works locally and on Render)
    sampleRate: 16000,
};

/* ============================================================
   App State
   ============================================================ */
const state = {
    socket: null,
    audioCapture: null,
    audioPlayer: null,
    status: 'idle',          // idle | connecting | listening | speaking | error
    timerInterval: null,
    timerSeconds: 0,
    animationFrame: null,
    particleAnimFrame: null,
};

/* ============================================================
   DOM References
   ============================================================ */
const dom = {
    orbContainer: document.getElementById('orbContainer'),
    orbCore: document.getElementById('orbCore'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    soundBars: document.getElementById('soundBars'),
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.getElementById('statusText'),
    callTimer: document.getElementById('callTimer'),
    btnStart: document.getElementById('btnStart'),
    btnEnd: document.getElementById('btnEnd'),
    transcriptBody: document.getElementById('transcriptBody'),
    transcriptEmpty: document.getElementById('transcriptEmpty'),
    connectionDot: document.getElementById('connectionDot'),
    headerStatus: document.getElementById('headerStatus'),
    particleCanvas: document.getElementById('particleCanvas'),
};

/* ============================================================
   Particle System (Background Effect)
   ============================================================ */
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.connections = [];
        this.mouse = { x: -1000, y: -1000 };
        this.resize();
        this._initParticles();
        this._bindEvents();
        this._animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _initParticles() {
        const count = Math.min(80, Math.floor((this.canvas.width * this.canvas.height) / 15000));
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                hue: Math.random() > 0.5 ? 250 : 200, // purple or blue
            });
        }
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this._initParticles();
        });
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }

    _animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const p of this.particles) {
            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Wrap
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;

            // Mouse attraction
            const dx = this.mouse.x - p.x;
            const dy = this.mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                p.vx += dx * 0.00005;
                p.vy += dy * 0.00005;
            }

            // Dampen velocity
            p.vx *= 0.999;
            p.vy *= 0.999;

            // Draw
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.opacity})`;
            this.ctx.fill();
        }

        // Draw connections
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const alpha = (1 - dist / 120) * 0.15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(a.x, a.y);
                    this.ctx.lineTo(b.x, b.y);
                    this.ctx.strokeStyle = `hsla(250, 60%, 65%, ${alpha})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }

        state.particleAnimFrame = requestAnimationFrame(() => this._animate());
    }
}

/* ============================================================
   Waveform Visualizer (inside the orb)
   ============================================================ */
class WaveformVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.running = false;
    }

    start(analyserGetter) {
        this.running = true;
        this._draw(analyserGetter);
    }

    stop() {
        this.running = false;
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _draw(analyserGetter) {
        if (!this.running) return;

        const timeDomain = analyserGetter();
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = w * 0.28;

        ctx.clearRect(0, 0, w, h);

        if (timeDomain) {
            const len = timeDomain.length;

            // Draw circular waveform
            for (let ring = 0; ring < 3; ring++) {
                const ringRadius = radius + ring * 8;
                const alpha = 0.6 - ring * 0.2;

                ctx.beginPath();
                for (let i = 0; i <= len; i++) {
                    const idx = i % len;
                    const val = (timeDomain[idx] - 128) / 128;
                    const angle = (i / len) * Math.PI * 2 - Math.PI / 2;
                    const amp = val * 15 * (1 + ring * 0.3);
                    const r = ringRadius + amp;
                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.strokeStyle = ring === 0
                    ? `rgba(108, 92, 231, ${alpha})`
                    : ring === 1
                        ? `rgba(56, 189, 248, ${alpha})`
                        : `rgba(168, 85, 247, ${alpha})`;
                ctx.lineWidth = 1.5 - ring * 0.3;
                ctx.stroke();
            }
        } else {
            // Idle — draw subtle breathing circle
            const t = Date.now() / 2000;
            const breathRadius = radius + Math.sin(t) * 3;
            ctx.beginPath();
            ctx.arc(cx, cy, breathRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(108, 92, 231, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        requestAnimationFrame(() => this._draw(analyserGetter));
    }
}

/* ============================================================
   Sound Bar Animator
   ============================================================ */
function animateSoundBars(freqGetter) {
    const bars = dom.soundBars.querySelectorAll('span');

    function update() {
        if (state.status !== 'listening' && state.status !== 'speaking') {
            bars.forEach((b) => (b.style.height = '4px'));
            return;
        }

        const freq = freqGetter();
        if (freq) {
            const step = Math.floor(freq.length / bars.length);
            bars.forEach((bar, i) => {
                const value = freq[i * step] || 0;
                const h = 4 + (value / 255) * 32;
                bar.style.height = `${h}px`;
            });
        }

        state.animationFrame = requestAnimationFrame(update);
    }

    update();
}

/* ============================================================
   UI State Management
   ============================================================ */
function setStatus(status, text) {
    state.status = status;

    // Badge
    dom.statusBadge.className = 'status-badge';
    if (status !== 'idle') dom.statusBadge.classList.add(status);
    dom.statusText.textContent = text || status;

    // Connection dot
    dom.connectionDot.className = 'connection-dot';
    if (status === 'listening' || status === 'speaking') {
        dom.connectionDot.classList.add('connected');
        dom.headerStatus.textContent = 'Connected';
    } else if (status === 'error') {
        dom.connectionDot.classList.add('error');
        dom.headerStatus.textContent = 'Error';
    } else if (status === 'connecting') {
        dom.headerStatus.textContent = 'Connecting...';
    } else {
        dom.headerStatus.textContent = 'Ready';
    }

    // Orb
    dom.orbContainer.classList.toggle('active', status === 'listening' || status === 'speaking' || status === 'connecting');
    dom.orbContainer.classList.toggle('speaking', status === 'speaking');

    // Buttons
    dom.btnStart.disabled = status !== 'idle' && status !== 'error';
    dom.btnEnd.disabled = status === 'idle' || status === 'error';
}

/* ============================================================
   Timer
   ============================================================ */
function startTimer() {
    state.timerSeconds = 0;
    dom.callTimer.classList.add('active');
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    dom.callTimer.classList.remove('active');
}

function updateTimerDisplay() {
    const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
    const s = String(state.timerSeconds % 60).padStart(2, '0');
    dom.callTimer.textContent = `${m}:${s}`;
}

/* ============================================================
   Transcript
   ============================================================ */
function addTranscriptMessage(role, text) {
    // Hide empty state
    if (dom.transcriptEmpty) {
        dom.transcriptEmpty.style.display = 'none';
    }

    const isAI = role === 'ai';
    const msg = document.createElement('div');
    msg.className = 'transcript-msg';
    msg.innerHTML = `
        <div class="msg-avatar ${isAI ? 'ai' : 'user'}">${isAI ? 'AI' : 'You'}</div>
        <div class="msg-content">
            <div class="msg-name ${isAI ? 'ai' : 'user'}">${isAI ? 'Ava — AI Assistant' : 'You'}</div>
            <div class="msg-text ${isAI ? 'ai' : 'user'}">${escapeHtml(text)}</div>
        </div>
    `;

    dom.transcriptBody.appendChild(msg);
    dom.transcriptBody.scrollTop = dom.transcriptBody.scrollHeight;
}

function clearTranscript() {
    dom.transcriptBody.innerHTML = '';
    if (dom.transcriptEmpty) {
        const empty = document.createElement('div');
        empty.className = 'transcript-empty';
        empty.id = 'transcriptEmpty';
        empty.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" opacity="0.4"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" opacity="0.4"/>
                <line x1="12" y1="19" x2="12" y2="23" opacity="0.4"/>
                <line x1="8" y1="23" x2="16" y2="23" opacity="0.4"/>
            </svg>
            <p>Start a conversation to see the live transcript</p>
        `;
        dom.transcriptBody.appendChild(empty);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ============================================================
   Main Conversation Flow
   ============================================================ */
async function startConversation() {
    try {
        setStatus('connecting', 'Connecting to AI...');

        // 1. Request WebSocket URL from backend
        const response = await fetch(`${CONFIG.backendUrl}/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Backend error: ${response.status}`);
        }

        const { websocketCallUrl } = await response.json();
        if (!websocketCallUrl) throw new Error('No websocketCallUrl received');

        console.log('[App] WebSocket URL:', websocketCallUrl);

        // 2. Connect WebSocket
        state.socket = new WebSocket(websocketCallUrl);
        state.socket.binaryType = 'arraybuffer';

        state.socket.onopen = () => {
            console.log('[App] WebSocket connected');
            setStatus('listening', 'Listening...');
            startTimer();
            startAudioCapture();
        };

        state.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                // Binary audio from Vapi — play it
                handleAudioData(event.data);
            } else {
                // JSON control message
                handleControlMessage(event.data);
            }
        };

        state.socket.onerror = (err) => {
            console.error('[App] WebSocket error:', err);
            setStatus('error', 'Connection Error');
            cleanup();
        };

        state.socket.onclose = (event) => {
            console.log('[App] WebSocket closed:', event.code, event.reason);
            if (state.status !== 'idle' && state.status !== 'error') {
                setStatus('idle', 'Ready to Connect');
            }
            cleanup();
        };
    } catch (err) {
        console.error('[App] Start error:', err);
        setStatus('error', err.message || 'Failed to connect');
        cleanup();
    }
}

function endConversation() {
    console.log('[App] Ending conversation');
    cleanup();
    setStatus('idle', 'Ready to Connect');
}

/* ============================================================
   Audio Capture (Microphone → WebSocket)
   ============================================================ */
function startAudioCapture() {
    state.audioPlayer = new window.AudioPlayer({ sampleRate: CONFIG.sampleRate });
    state.audioPlayer.init();

    state.audioPlayer.onPlayingChange = (isPlaying) => {
        if (isPlaying && state.status === 'listening') {
            setStatus('speaking', 'AI Speaking...');
        } else if (!isPlaying && state.status === 'speaking') {
            setStatus('listening', 'Listening...');
        }
    };

    state.audioCapture = new window.AudioCapture({
        targetSampleRate: CONFIG.sampleRate,
        onPCM: (pcmBuffer) => {
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(pcmBuffer);
            }
        },
    });

    state.audioCapture.start().then(() => {
        // Start waveform visualization
        if (waveformVis) {
            waveformVis.start(() => {
                if (state.audioCapture) {
                    return state.audioCapture.getTimeDomainData();
                }
                return null;
            });
        }

        // Start sound bar animation
        animateSoundBars(() => {
            if (state.audioCapture) {
                return state.audioCapture.getFrequencyData();
            }
            return null;
        });
    }).catch((err) => {
        console.error('[App] Mic access error:', err);
        setStatus('error', 'Microphone access denied');
        cleanup();
    });
}

/* ============================================================
   Incoming Audio (WebSocket → Speakers)
   ============================================================ */
function handleAudioData(arrayBuffer) {
    if (state.audioPlayer) {
        state.audioPlayer.enqueue(arrayBuffer);
    }
}

/* ============================================================
   Control Messages (JSON from Vapi)
   ============================================================ */
function handleControlMessage(rawData) {
    try {
        const msg = JSON.parse(rawData);
        console.log('[App] Control message:', msg.type, msg);

        switch (msg.type) {
            case 'conversation-update':
                handleConversationUpdate(msg);
                break;
            case 'transcript':
                handleTranscript(msg);
                break;
            case 'speech-update':
                handleSpeechUpdate(msg);
                break;
            case 'function-call':
                console.log('[App] Function call:', msg);
                break;
            case 'hang':
                console.log('[App] Call ended by Vapi');
                endConversation();
                break;
            default:
                console.log('[App] Unhandled message type:', msg.type);
        }
    } catch (e) {
        console.warn('[App] Non-JSON message:', rawData);
    }
}

function handleConversationUpdate(msg) {
    if (msg.conversation && Array.isArray(msg.conversation)) {
        // Display the latest message if we haven't already
        const latest = msg.conversation[msg.conversation.length - 1];
        if (latest) {
            const role = latest.role === 'assistant' ? 'ai' : 'user';
            // Only add if it looks like a final message
            if (latest.content && latest.content.trim()) {
                addTranscriptMessage(role, latest.content);
            }
        }
    }
}

function handleTranscript(msg) {
    if (msg.transcriptType === 'final' && msg.transcript) {
        const role = msg.role === 'assistant' ? 'ai' : 'user';
        addTranscriptMessage(role, msg.transcript);
    }
}

function handleSpeechUpdate(msg) {
    if (msg.status === 'started') {
        setStatus('speaking', 'AI Speaking...');
    } else if (msg.status === 'stopped') {
        setStatus('listening', 'Listening...');
    }
}

/* ============================================================
   Cleanup
   ============================================================ */
function cleanup() {
    stopTimer();

    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
        state.animationFrame = null;
    }

    if (state.audioCapture) {
        state.audioCapture.stop();
        state.audioCapture = null;
    }

    if (state.audioPlayer) {
        state.audioPlayer.stop();
        state.audioPlayer = null;
    }

    if (state.socket) {
        if (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING) {
            state.socket.close();
        }
        state.socket = null;
    }

    if (waveformVis) {
        waveformVis.stop();
    }

    dom.orbContainer.classList.remove('active', 'speaking');
}

/* ============================================================
   Initialize
   ============================================================ */

// Particle system
const particles = new ParticleSystem(dom.particleCanvas);

// Waveform visualizer
const waveformVis = new WaveformVisualizer(dom.waveformCanvas);

// Set initial state
setStatus('idle', 'Ready to Connect');

// Expose to global scope for button onclick handlers
window.app = {
    startConversation,
    endConversation,
    clearTranscript,
};

console.log('[App] Vapi Voice Assistant initialized');
