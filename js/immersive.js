// Drone View - Immersive flight layer
// Preflight boot, live telemetry HUD, engine audio, scroll-driven ascent,
// 360° panorama viewer and small motion details shared by every page.
(() => {
    'use strict';

    const logoMarkUrl = new URL('../assets/images/logo-mark.svg', document.currentScript.src).href;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const root = document.documentElement;

    const safe = (fn, fallback = null) => {
        try { return fn(); } catch (error) { return fallback; }
    };
    const session = {
        get: (key) => safe(() => sessionStorage.getItem(key)),
        set: (key, value) => safe(() => sessionStorage.setItem(key, value))
    };
    const local = {
        get: (key) => safe(() => localStorage.getItem(key)),
        set: (key, value) => safe(() => localStorage.setItem(key, value))
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const lerp = (a, b, t) => a + (b - a) * t;
    const pad = (value, size = 2) => String(Math.floor(value)).padStart(size, '0');

    // Shared pointer / scroll state, smoothed once per frame
    const state = {
        mx: 0, my: 0, tmx: 0, tmy: 0,
        scrollY: window.scrollY,
        lastScrollY: window.scrollY,
        speed: 0
    };

    window.addEventListener('pointermove', (e) => {
        state.tmx = (e.clientX / window.innerWidth) * 2 - 1;
        state.tmy = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    let flightStart = Number(session.get('dv_flight_start'));
    if (!flightStart) {
        flightStart = Date.now();
        session.set('dv_flight_start', String(flightStart));
    }

    /* ------------------------------------------------------------------
       Engine audio: synthesised propeller hum, no audio files needed
    ------------------------------------------------------------------ */
    const DroneAudio = (() => {
        let ctx = null;
        let master, filter, noiseGain, chopLfo;
        const rotors = [];
        let enabled = false;

        const build = () => {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return false;
            ctx = new AudioCtx();

            master = ctx.createGain();
            master.gain.value = 0;
            master.connect(ctx.destination);

            const chop = ctx.createGain();
            chop.gain.value = 0.7;
            chop.connect(master);

            chopLfo = ctx.createOscillator();
            chopLfo.frequency.value = 34;
            const chopDepth = ctx.createGain();
            chopDepth.gain.value = 0.28;
            chopLfo.connect(chopDepth).connect(chop.gain);
            chopLfo.start();

            filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 650;
            filter.Q.value = 0.8;
            filter.connect(chop);

            [1, 1.013, 0.988, 1.024].forEach((ratio) => {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = 160 * ratio;
                const gain = ctx.createGain();
                gain.gain.value = 0.16;
                osc.connect(gain).connect(filter);
                osc.start();
                rotors.push({ osc, ratio });
            });

            const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const band = ctx.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = 1100;
            band.Q.value = 0.6;
            noiseGain = ctx.createGain();
            noiseGain.gain.value = 0.04;
            noise.connect(band).connect(noiseGain).connect(master);
            noise.start();
            return true;
        };

        const setEnabled = (value) => {
            if (value && !ctx && !build()) return false;
            if (!ctx) return false;
            enabled = value;
            if (value) ctx.resume();
            master.gain.setTargetAtTime(value ? 0.07 : 0, ctx.currentTime, value ? 0.6 : 0.15);
            return true;
        };

        const setThrottle = (t) => {
            if (!ctx || !enabled) return;
            const now = ctx.currentTime;
            rotors.forEach(({ osc, ratio }) => {
                osc.frequency.setTargetAtTime((150 + t * 110) * ratio, now, 0.25);
            });
            chopLfo.frequency.setTargetAtTime(30 + t * 22, now, 0.25);
            filter.frequency.setTargetAtTime(600 + t * 1100, now, 0.25);
            noiseGain.gain.setTargetAtTime(0.035 + t * 0.11, now, 0.25);
        };

        const shutter = () => {
            if (!ctx || !enabled) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        };

        document.addEventListener('visibilitychange', () => {
            if (!ctx) return;
            if (document.hidden) ctx.suspend();
            else if (enabled) ctx.resume();
        });

        return { setEnabled, setThrottle, shutter, isEnabled: () => enabled };
    })();

    const soundButtons = new Set();
    const syncSoundButtons = () => {
        const on = DroneAudio.isEnabled();
        soundButtons.forEach((btn) => {
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', on ? 'Disattiva audio motori' : 'Attiva audio motori');
            btn.innerHTML = on ? '<i class="fas fa-volume-high"></i>' : '<i class="fas fa-volume-xmark"></i>';
        });
    };
    const setSound = (on) => {
        DroneAudio.setEnabled(on);
        local.set('dv_sound', on ? '1' : '0');
        syncSoundButtons();
    };

    // Browsers only start audio after a gesture: resume the saved preference on the first one
    if (local.get('dv_sound') === '1') {
        const resume = () => {
            setSound(true);
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
        };
        window.addEventListener('pointerdown', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
    }

    /* ------------------------------------------------------------------
       Preflight boot sequence (once per browser session)
    ------------------------------------------------------------------ */
    const takeoff = () => {
        root.classList.add('dv-airborne');
        document.dispatchEvent(new CustomEvent('dv:takeoff'));
    };

    const initBoot = () => {
        if (session.get('dv_booted')) {
            takeoff();
            return;
        }
        session.set('dv_booted', '1');

        const steps = [
            ['Calibrazione IMU', 'OK'],
            ['Bussola', 'OK'],
            ['Segnale GPS', '14 SAT'],
            ['Gimbal 3 assi', 'OK'],
            ['Batteria', '100%'],
            ['Trasmissione video 4K', 'LINK']
        ];

        const boot = document.createElement('div');
        boot.className = 'dv-boot';
        boot.setAttribute('role', 'dialog');
        boot.setAttribute('aria-label', 'Controllo pre-volo');
        boot.innerHTML = `
            <div class="dv-boot-grid" aria-hidden="true"></div>
            <div class="dv-boot-radar" aria-hidden="true"><span></span></div>
            <div class="dv-boot-inner">
                <p class="dv-boot-kicker">Sistema di volo · Preflight check</p>
                <div class="dv-boot-logo"><img src="${logoMarkUrl}" alt=""><span>DRONE <b>VIEW</b></span></div>
                <ul class="dv-boot-log"></ul>
                <div class="dv-boot-bar"><span></span></div>
                <div class="dv-boot-actions">
                    <button type="button" class="dv-boot-go" data-sound="1"><i class="fas fa-volume-high"></i> Decolla con audio</button>
                    <button type="button" class="dv-boot-go dv-ghost" data-sound="0">Decolla in silenzio</button>
                </div>
            </div>
            <button type="button" class="dv-boot-skip">Salta <i class="fas fa-forward"></i></button>
        `;
        document.body.appendChild(boot);
        root.classList.add('dv-booting');

        const log = boot.querySelector('.dv-boot-log');
        const bar = boot.querySelector('.dv-boot-bar span');
        const actions = boot.querySelector('.dv-boot-actions');
        let finished = false;
        let autoTimer;
        const timers = [];

        const finish = (withSound) => {
            if (finished) return;
            finished = true;
            timers.forEach(clearTimeout);
            clearTimeout(autoTimer);
            if (withSound) setSound(true);
            boot.classList.add('dv-boot-out');
            root.classList.remove('dv-booting');
            takeoff();
            setTimeout(() => boot.remove(), 1000);
        };

        const stepDelay = reduceMotion ? 0 : 260;
        steps.forEach(([label, value], index) => {
            timers.push(setTimeout(() => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${label}</span><i></i><b>${value}</b>`;
                log.appendChild(li);
                bar.style.width = `${((index + 1) / steps.length) * 100}%`;
            }, 350 + index * stepDelay));
        });

        timers.push(setTimeout(() => {
            boot.classList.add('dv-boot-ready');
            actions.querySelector('.dv-boot-go')?.focus({ preventScroll: true });
            autoTimer = setTimeout(() => finish(false), 4500);
        }, 450 + steps.length * stepDelay));

        boot.querySelectorAll('.dv-boot-go').forEach((btn) => {
            btn.addEventListener('click', () => finish(btn.dataset.sound === '1'));
        });
        boot.querySelector('.dv-boot-skip').addEventListener('click', () => finish(false));
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') finish(false);
        });
    };

    /* ------------------------------------------------------------------
       Live telemetry HUD + altitude tape
    ------------------------------------------------------------------ */
    const MAX_ALT = 120; // EU open category ceiling, metres

    const initHud = () => {
        const hud = document.createElement('aside');
        hud.className = 'dv-hud';
        hud.setAttribute('aria-label', 'Telemetria di volo');
        const gps = document.body.dataset.gps;
        hud.innerHTML = `
            <div class="dv-hud-top">
                <span class="dv-rec"><span class="dv-rec-dot"></span>IN VOLO <b data-hud="time">00:00:00</b></span>
                <button type="button" class="dv-hud-btn" data-hud-action="sound"></button>
                <button type="button" class="dv-hud-btn" data-hud-action="collapse" aria-label="Riduci telemetria"><i class="fas fa-chevron-down"></i></button>
            </div>
            <div class="dv-hud-body">
                <div class="dv-hud-grid">
                    <div><span>ALT</span><b data-hud="alt">0</b><em>m</em></div>
                    <div><span>VEL</span><b data-hud="spd">0</b><em>km/h</em></div>
                    <div><span>HDG</span><b data-hud="hdg">000</b><em>°</em></div>
                    <div><span>BAT</span><b data-hud="bat">100</b><em>%</em></div>
                </div>
                <div class="dv-hud-bat"><span></span></div>
                <div class="dv-hud-gps"><i class="fas fa-satellite"></i> ${gps ? gps : 'GPS · 14 SAT'}</div>
            </div>
        `;
        document.body.appendChild(hud);

        const soundBtn = hud.querySelector('[data-hud-action="sound"]');
        soundButtons.add(soundBtn);
        syncSoundButtons();
        soundBtn.addEventListener('click', () => setSound(!DroneAudio.isEnabled()));

        const collapseBtn = hud.querySelector('[data-hud-action="collapse"]');
        const applyCollapsed = (collapsed) => {
            hud.classList.toggle('is-collapsed', collapsed);
            collapseBtn.setAttribute('aria-expanded', String(!collapsed));
            collapseBtn.setAttribute('aria-label', collapsed ? 'Espandi telemetria' : 'Riduci telemetria');
            collapseBtn.innerHTML = collapsed ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
        };
        const savedCollapsed = local.get('dv_hud_collapsed');
        applyCollapsed(savedCollapsed === null ? window.innerWidth < 768 : savedCollapsed === '1');
        collapseBtn.addEventListener('click', () => {
            const collapsed = !hud.classList.contains('is-collapsed');
            applyCollapsed(collapsed);
            local.set('dv_hud_collapsed', collapsed ? '1' : '0');
        });

        // Altitude tape on the right edge (desktop)
        const tape = document.createElement('div');
        tape.className = 'dv-alt-tape';
        tape.setAttribute('aria-hidden', 'true');
        let ticks = '';
        for (let m = MAX_ALT; m >= 0; m -= 5) {
            ticks += `<li class="${m % 10 === 0 ? 'major' : ''}">${m % 10 === 0 ? m : ''}</li>`;
        }
        tape.innerHTML = `<div class="dv-alt-window"><ul class="dv-alt-scale">${ticks}</ul></div><span class="dv-alt-pointer"><b>0</b>m</span>`;
        document.body.appendChild(tape);

        const els = {
            time: hud.querySelector('[data-hud="time"]'),
            alt: hud.querySelector('[data-hud="alt"]'),
            spd: hud.querySelector('[data-hud="spd"]'),
            hdg: hud.querySelector('[data-hud="hdg"]'),
            bat: hud.querySelector('[data-hud="bat"]'),
            batBar: hud.querySelector('.dv-hud-bat span'),
            scale: tape.querySelector('.dv-alt-scale'),
            pointer: tape.querySelector('.dv-alt-pointer b')
        };

        let heading = 0;
        const last = {};
        const write = (key, value) => {
            if (last[key] === value) return;
            last[key] = value;
            els[key].textContent = value;
        };

        return (alt) => {
            const elapsed = (Date.now() - flightStart) / 1000;
            write('time', `${pad(elapsed / 3600)}:${pad((elapsed / 60) % 60)}:${pad(elapsed % 60)}`);
            write('alt', String(Math.round(alt)));
            write('spd', String(Math.round(state.speed)));

            const targetHeading = (180 + state.mx * 140 + state.scrollY * 0.03) % 360;
            // Shortest way round the compass, so 359° -> 1° doesn't spin backwards
            const turn = ((((targetHeading - heading) % 360) + 540) % 360) - 180;
            heading = (heading + turn * 0.06 + 360) % 360;
            write('hdg', pad(heading, 3));

            // Drains 1% every 20 s and gets a fresh battery when it reaches 12%
            const battery = Math.round(100 - ((elapsed / 20) % 88));
            if (last.bat !== String(battery)) {
                els.batBar.style.width = `${battery}%`;
                hud.classList.toggle('is-low', battery <= 25);
            }
            write('bat', String(battery));

            // 25 ticks: the 0 m and 120 m tick centres are 24/25 of the scale apart
            els.scale.style.transform = `translateY(${(alt / MAX_ALT) * 96}%)`;
            write('pointer', String(Math.round(alt)));
        };
    };

    /* ------------------------------------------------------------------
       Homepage hero: viewfinder, mouse parallax, scroll climb
    ------------------------------------------------------------------ */
    const initHero = () => {
        const hero = document.querySelector('.dv-hero');
        if (!hero) return null;

        const horizon = hero.querySelector('.dv-horizon');
        const pitchLadder = hero.querySelector('.dv-pitch-ladder');

        return () => {
            const h = hero.offsetHeight || 1;
            const p = clamp(state.scrollY / h, 0, 1);
            hero.style.setProperty('--hero-p', p.toFixed(4));
            hero.style.setProperty('--mx', state.mx.toFixed(4));
            hero.style.setProperty('--my', state.my.toFixed(4));
            if (horizon) horizon.style.transform = `translateY(${state.my * 18 - p * 60}px) rotate(${state.mx * -6}deg)`;
            if (pitchLadder) pitchLadder.style.transform = `translateY(${state.my * 30 + p * 120}px)`;
        };
    };

    /* ------------------------------------------------------------------
       Scroll-driven ascent: the camera climbs from 0 to 120 m
    ------------------------------------------------------------------ */
    const initAscent = () => {
        const section = document.querySelector('.dv-ascent');
        if (!section) return null;

        const image = section.querySelector('.dv-ascent-img');
        const altValue = section.querySelector('[data-ascent-alt]');
        const bar = section.querySelector('.dv-ascent-bar span');
        const captions = [...section.querySelectorAll('[data-at]')];
        let lastAlt = -1;

        return () => {
            const rect = section.getBoundingClientRect();
            const travel = section.offsetHeight - window.innerHeight;
            const p = clamp(-rect.top / (travel || 1), 0, 1);
            const eased = 1 - Math.pow(1 - p, 2.2);

            const scale = lerp(3.4, 1.02, eased);
            const rotate = lerp(-14, 0, eased);
            image.style.transform = `scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(3)}deg)`;
            section.style.setProperty('--ascent-p', p.toFixed(4));

            const alt = Math.round(eased * MAX_ALT);
            if (alt !== lastAlt) {
                lastAlt = alt;
                altValue.textContent = alt;
                bar.style.height = `${p * 100}%`;
            }

            let active = captions[0];
            captions.forEach((caption) => {
                if (p >= Number(caption.dataset.at)) active = caption;
            });
            captions.forEach((caption) => caption.classList.toggle('is-active', caption === active));
        };
    };

    /* ------------------------------------------------------------------
       360° panorama viewer (raw WebGL, equirectangular projection)
    ------------------------------------------------------------------ */
    const initPano = () => {
        const wrap = document.querySelector('.dv-pano');
        if (!wrap) return;

        const canvas = wrap.querySelector('.dv-pano-canvas');
        const loading = wrap.querySelector('.dv-pano-loading');
        const shotsStrip = document.querySelector('.dv-shots');
        const readPitch = wrap.querySelector('[data-pano="pitch"]');
        const readZoom = wrap.querySelector('[data-pano="zoom"]');
        const readHdg = wrap.querySelector('[data-pano="hdg"]');
        const compassTape = wrap.querySelector('.dv-pano-compass-tape');
        const autoBtn = wrap.querySelector('[data-pano-action="auto"]');
        const gyroBtn = wrap.querySelector('[data-pano-action="gyro"]');
        const flash = wrap.querySelector('.dv-pano-flash');

        const view = {
            yaw: 0, pitch: -0.08, fov: 1.35,
            vyaw: 0, vpitch: 0,
            targetFov: 1.35,
            auto: !reduceMotion,
            lastInteraction: 0,
            dragging: false,
            gyro: null
        };
        const FOV_MIN = 0.45;
        const FOV_MAX = 1.75;

        // Compass tape: labels every 45°, repeated so it can wrap
        const points = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        let tapeHtml = '';
        for (let lap = 0; lap < 3; lap++) {
            points.forEach((point, i) => {
                tapeHtml += `<span class="${i % 2 === 0 ? 'major' : ''}">${point}</span>`;
            });
        }
        compassTape.innerHTML = tapeHtml;

        let gl = null;
        let program, uniforms;
        let started = false;
        let visible = false;
        let frameRequested = false;

        const vertexSrc = `
            attribute vec2 p;
            varying vec2 v;
            void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }
        `;
        const fragmentSrc = `
            precision highp float;
            uniform sampler2D tex;
            uniform float yaw;
            uniform float pitch;
            uniform float fov;
            uniform float aspect;
            varying vec2 v;
            const float PI = 3.141592653589793;
            void main() {
                float t = tan(fov * 0.5);
                vec3 d = normalize(vec3(v.x * t * aspect, v.y * t, -1.0));
                float cp = cos(pitch), sp = sin(pitch);
                d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
                float cy = cos(yaw), sy = sin(yaw);
                d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
                float lon = atan(d.x, -d.z);
                float lat = asin(clamp(d.y, -1.0, 1.0));
                vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
                vec3 col = texture2D(tex, uv).rgb;
                float vig = smoothstep(1.45, 0.35, length(v * vec2(aspect * 0.55, 1.0)));
                gl_FragColor = vec4(col * mix(0.72, 1.0, vig), 1.0);
            }
        `;

        const compile = (type, src) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        };

        const fail = (message) => {
            wrap.classList.add('is-failed');
            loading.innerHTML = `<span>${message}</span>`;
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        };

        const render = () => {
            resize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform1f(uniforms.yaw, view.yaw);
            gl.uniform1f(uniforms.pitch, view.pitch);
            gl.uniform1f(uniforms.fov, view.fov);
            gl.uniform1f(uniforms.aspect, canvas.width / canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        const headingDeg = () => ((view.yaw * 180 / Math.PI) % 360 + 360) % 360;

        const updateReadouts = () => {
            const hdg = headingDeg();
            readHdg.textContent = pad(hdg, 3) + '°';
            readPitch.textContent = `${Math.round(view.pitch * 180 / Math.PI)}°`;
            readZoom.textContent = `${(1.35 / view.fov).toFixed(1)}x`;
            // 8 labels per lap, each 64px wide: 360° = 512px
            compassTape.style.transform = `translateX(${-(512 + hdg / 360 * 512)}px)`;
        };

        const tick = () => {
            frameRequested = false;
            if (!visible) return;

            const idle = performance.now() - view.lastInteraction > 3500;
            if (!view.dragging && !view.gyro) {
                view.yaw += view.vyaw;
                view.pitch += view.vpitch;
                view.vyaw *= 0.92;
                view.vpitch *= 0.85;
                if (view.auto && idle) view.yaw += 0.0011;
            }
            view.pitch = clamp(view.pitch, -1.35, 1.35);
            view.fov = lerp(view.fov, view.targetFov, 0.12);

            render();
            updateReadouts();
            requestFrame();
        };

        const requestFrame = () => {
            if (frameRequested) return;
            frameRequested = true;
            requestAnimationFrame(tick);
        };

        const start = () => {
            if (started) return;
            started = true;

            gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false })
                || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
            if (!gl) {
                fail('WebGL non disponibile su questo dispositivo.');
                return;
            }

            try {
                program = gl.createProgram();
                gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
                gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
                gl.linkProgram(program);
                gl.useProgram(program);
            } catch (error) {
                fail('Impossibile avviare il visore 360°.');
                return;
            }

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

            uniforms = {
                yaw: gl.getUniformLocation(program, 'yaw'),
                pitch: gl.getUniformLocation(program, 'pitch'),
                fov: gl.getUniformLocation(program, 'fov'),
                aspect: gl.getUniformLocation(program, 'aspect')
            };

            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                let source = img;
                const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                if (img.naturalWidth > maxSize) {
                    const scaled = document.createElement('canvas');
                    scaled.width = maxSize;
                    scaled.height = maxSize / 2;
                    scaled.getContext('2d').drawImage(img, 0, 0, scaled.width, scaled.height);
                    source = scaled;
                }
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
                // Linear without mipmaps avoids a visible seam where longitude wraps
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                wrap.classList.add('is-ready');
                requestFrame();
            };
            img.onerror = () => fail('Impossibile caricare il panorama.');
            img.src = wrap.dataset.panoSrc;
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                visible = entry.isIntersecting;
                if (visible) {
                    start();
                    if (wrap.classList.contains('is-ready')) requestFrame();
                }
            });
        }, { rootMargin: '300px 0px' });
        observer.observe(wrap);

        // Drag to look around, with inertia
        let lastX = 0;
        let lastY = 0;
        let pointerId = null;
        const touched = () => {
            view.lastInteraction = performance.now();
            wrap.classList.add('has-interacted');
        };

        canvas.addEventListener('pointerdown', (e) => {
            if (pointerId !== null) return;
            pointerId = e.pointerId;
            view.dragging = true;
            view.vyaw = 0;
            view.vpitch = 0;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
            wrap.classList.add('is-dragging');
            touched();
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!view.dragging || e.pointerId !== pointerId) return;
            const factor = view.fov / canvas.clientHeight;
            const dx = (e.clientX - lastX) * factor;
            const dy = (e.clientY - lastY) * factor;
            lastX = e.clientX;
            lastY = e.clientY;
            view.yaw -= dx;
            view.pitch += dy;
            view.vyaw = clamp(-dx, -0.05, 0.05);
            view.vpitch = clamp(dy, -0.02, 0.02);
            touched();
            requestFrame();
        });
        const endDrag = (e) => {
            if (e.pointerId !== pointerId) return;
            pointerId = null;
            view.dragging = false;
            wrap.classList.remove('is-dragging');
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);

        const zoom = (direction) => {
            view.targetFov = clamp(view.targetFov * (direction > 0 ? 0.8 : 1.25), FOV_MIN, FOV_MAX);
            touched();
            requestFrame();
        };

        // Wheel zoom only in fullscreen, so the page keeps scrolling normally
        wrap.addEventListener('wheel', (e) => {
            if (document.fullscreenElement !== wrap) return;
            e.preventDefault();
            zoom(e.deltaY < 0 ? 1 : -1);
        }, { passive: false });

        wrap.addEventListener('keydown', (e) => {
            const step = 0.08;
            const actions = {
                ArrowLeft: () => { view.yaw -= step; },
                ArrowRight: () => { view.yaw += step; },
                ArrowUp: () => { view.pitch += step; },
                ArrowDown: () => { view.pitch -= step; },
                '+': () => zoom(1),
                '=': () => zoom(1),
                '-': () => zoom(-1)
            };
            if (!actions[e.key]) return;
            e.preventDefault();
            actions[e.key]();
            touched();
            requestFrame();
        });

        const setAuto = (on) => {
            view.auto = on;
            autoBtn.setAttribute('aria-pressed', String(on));
            autoBtn.classList.toggle('is-on', on);
        };
        setAuto(view.auto);

        // Photo mode: capture the current frame into the shots strip
        let shotCount = 0;
        const takeShot = () => {
            if (!wrap.classList.contains('is-ready')) return;
            render();
            const url = safe(() => canvas.toDataURL('image/jpeg', 0.9));
            if (!url) return;

            shotCount += 1;
            DroneAudio.shutter();
            flash.classList.remove('is-firing');
            void flash.offsetWidth;
            flash.classList.add('is-firing');

            shotsStrip.querySelector('.dv-shots-empty')?.remove();
            const link = document.createElement('a');
            link.className = 'dv-shot';
            link.href = url;
            link.download = `droneview-zante-360-${pad(shotCount)}.jpg`;
            link.setAttribute('aria-label', `Scarica scatto ${shotCount}`);
            link.innerHTML = `
                <img src="${url}" alt="Scatto ${shotCount} dal panorama di Zante">
                <span>#${pad(shotCount)} · HDG ${pad(headingDeg(), 3)}° <i class="fas fa-download"></i></span>
            `;
            shotsStrip.prepend(link);
            const shots = shotsStrip.querySelectorAll('.dv-shot');
            if (shots.length > 6) shots[shots.length - 1].remove();
            touched();
        };

        // Gyroscope look-around on phones
        const onOrientation = (e) => {
            if (e.alpha === null || !view.gyro) return;
            if (view.gyro.alpha0 === undefined) {
                view.gyro.alpha0 = e.alpha;
                view.gyro.yaw0 = view.yaw;
            }
            view.yaw = view.gyro.yaw0 - (e.alpha - view.gyro.alpha0) * Math.PI / 180;
            view.pitch = clamp((e.beta - 90) * Math.PI / 180, -1.35, 1.35);
            touched();
            requestFrame();
        };
        const toggleGyro = async () => {
            if (view.gyro) {
                view.gyro = null;
                window.removeEventListener('deviceorientation', onOrientation);
                gyroBtn.setAttribute('aria-pressed', 'false');
                gyroBtn.classList.remove('is-on');
                return;
            }
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                const result = await safe(() => DeviceOrientationEvent.requestPermission(), Promise.resolve('denied')).catch(() => 'denied');
                if (result !== 'granted') return;
            }
            view.gyro = {};
            window.addEventListener('deviceorientation', onOrientation);
            gyroBtn.setAttribute('aria-pressed', 'true');
            gyroBtn.classList.add('is-on');
        };
        if (!canHover && 'DeviceOrientationEvent' in window) gyroBtn.hidden = false;

        wrap.querySelectorAll('[data-pano-action]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.panoAction;
                if (action === 'zoom-in') zoom(1);
                if (action === 'zoom-out') zoom(-1);
                if (action === 'auto') setAuto(!view.auto);
                if (action === 'shot') takeShot();
                if (action === 'gyro') toggleGyro();
                if (action === 'fullscreen') {
                    try {
                        if (document.fullscreenElement) await document.exitFullscreen();
                        else await wrap.requestFullscreen();
                    } catch (error) {
                        wrap.classList.toggle('is-pseudo-fullscreen');
                        root.classList.toggle('dv-lock-scroll', wrap.classList.contains('is-pseudo-fullscreen'));
                    }
                    requestFrame();
                }
            });
        });

        window.addEventListener('resize', requestFrame, { passive: true });
    };

    // Runs a rAF loop only while the element is on screen
    const whileVisible = (el, frame) => {
        let visible = false;
        let running = false;
        const loop = (now) => {
            if (!visible) {
                running = false;
                return;
            }
            frame(now);
            requestAnimationFrame(loop);
        };
        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible && !running) {
                running = true;
                requestAnimationFrame(loop);
            }
        }, { rootMargin: '100px 0px' }).observe(el);
    };

    /* ------------------------------------------------------------------
       Services orbiting around the drone
    ------------------------------------------------------------------ */
    const initOrbit = () => {
        const orbit = document.querySelector('.dv-orbit');
        if (!orbit) return;

        const cards = [...orbit.querySelectorAll('.dv-orbit-card')];
        const status = orbit.querySelector('.dv-orbit-status');
        const count = cards.length;
        const step = (Math.PI * 2) / count;

        let angle = 0;
        let target = null;
        let velocity = 0;
        let hovering = false;
        let lastInteraction = 0;
        let front = -1;
        let radiusX = 400;

        const layout = () => {
            const width = orbit.clientWidth;
            const height = orbit.clientHeight;
            radiusX = Math.min(width * 0.4, 470);
            const radiusY = width < 600 ? 56 : Math.min(height * 0.16, 115);
            orbit.style.setProperty('--rx', `${radiusX}px`);
            orbit.style.setProperty('--ry', `${radiusY}px`);

            cards.forEach((card, i) => {
                const a = angle + i * step;
                const depth = Math.cos(a); // 1 = in front of the drone, -1 = behind it
                const near = (depth + 1) / 2;
                const x = Math.sin(a) * radiusX;
                const y = depth * radiusY;
                const scale = 0.58 + near * 0.42;
                card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateY(${(-Math.sin(a) * 30).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
                card.style.zIndex = String(Math.round(near * 100));
                card.style.opacity = (0.3 + near * 0.7).toFixed(3);
                card.style.filter = depth < -0.1 ? `blur(${((-depth - 0.1) * 3).toFixed(2)}px)` : 'none';
            });

            const index = ((Math.round(-angle / step) % count) + count) % count;
            if (index !== front) {
                front = index;
                cards.forEach((card, i) => card.classList.toggle('is-front', i === index));
                status.textContent = `${pad(index + 1)} / ${pad(count)} · ${cards[index].querySelector('h3').textContent}`;
            }
        };

        const goTo = (index) => {
            const base = -index * step;
            const turns = Math.round((angle - base) / (Math.PI * 2));
            target = base + turns * Math.PI * 2;
            velocity = 0;
            lastInteraction = performance.now();
        };

        whileVisible(orbit, (now) => {
            if (target !== null) {
                angle = lerp(angle, target, 0.09);
                if (Math.abs(angle - target) < 0.001) {
                    angle = target;
                    target = null;
                }
            } else if (!dragging) {
                angle += velocity;
                velocity *= 0.93;
                const idle = now - lastInteraction > 2500;
                if (!hovering && idle && !reduceMotion && Math.abs(velocity) < 0.001) angle -= 0.0028;
            }
            layout();
        });

        // Drag to spin; a short tap still counts as a click on the card
        let dragging = false;
        let startX = 0;
        let lastX = 0;
        let moved = 0;
        orbit.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            dragging = true;
            target = null;
            startX = lastX = e.clientX;
            moved = 0;
            velocity = 0;
            orbit.classList.add('is-dragging');
        });
        window.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            lastX = e.clientX;
            moved = Math.abs(e.clientX - startX);
            angle += dx / radiusX;
            velocity = dx / radiusX;
            lastInteraction = performance.now();
        });
        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            orbit.classList.remove('is-dragging');
            lastInteraction = performance.now();
        };
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);

        cards.forEach((card, i) => {
            card.addEventListener('click', () => {
                if (moved > 6) return;
                goTo(i);
            });
            card.addEventListener('focus', () => goTo(i));
            card.addEventListener('pointerenter', () => { if (card.classList.contains('is-front')) hovering = true; });
            card.addEventListener('pointerleave', () => { hovering = false; });
        });

        orbit.querySelector('[data-orbit="prev"]').addEventListener('click', () => goTo(front - 1));
        orbit.querySelector('[data-orbit="next"]').addEventListener('click', () => goTo(front + 1));
        orbit.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(front - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(front + 1); }
        });

        layout();
    };

    /* ------------------------------------------------------------------
       Fleet inspection: zoom on the camera, wind stability demo
    ------------------------------------------------------------------ */
    const initInspect = () => {
        const frame = document.querySelector('.dv-inspect');
        if (!frame) return;

        const triggers = [...document.querySelectorAll('[data-drone-highlight]')];
        const label = frame.querySelector('[data-inspect-label]');
        const canvas = frame.querySelector('.dv-wind-canvas');
        const ctx = canvas.getContext('2d');
        const windFrom = frame.querySelector('[data-wind-from]');
        const windSpeed = frame.querySelector('[data-wind-speed]');
        const windArrow = frame.querySelector('.dv-wind-arrow');
        const driftValue = frame.querySelector('[data-wind-drift]');

        const labels = {
            idle: 'Ispezione · vista completa',
            camera: 'Zoom camera · 1/2.3" CMOS',
            wind: 'Test vento · stabilizzazione attiva',
            weight: 'Bilancia · peso al decollo'
        };

        // Gusts from different directions; vx/vy is where the air is moving in the frame
        const gusts = [
            { from: 'Ovest', vx: 1, vy: 0.12 },
            { from: 'Est', vx: -1, vy: 0.05 },
            { from: 'Nord-Ovest', vx: 0.75, vy: 0.55 },
            { from: 'Sud-Est', vx: -0.8, vy: -0.35 },
            { from: 'Nord-Est', vx: -0.7, vy: 0.5 }
        ];

        let mode = 'idle';
        let locked = null;
        let gustIndex = 0;
        let gustStarted = 0;
        let speed = 0;
        let targetSpeed = 32;
        let tilt = 0;
        let flowX = 1;
        let flowY = 0.12;
        const particles = [];

        /* Weight mode: a two-pan balance comparing the drone with everyday objects */
        const DRONE_WEIGHT = 249;
        const scale = frame.querySelector('.dv-scale');
        const scaleDroneRead = frame.querySelector('[data-scale-drone]');
        const scaleObjectRead = frame.querySelector('[data-scale-object]');
        const scaleItem = frame.querySelector('[data-scale-item]');
        const scaleVerdict = frame.querySelector('[data-scale-verdict]');
        const scaleButtons = [...frame.querySelectorAll('[data-weight]')];
        const beam = { angle: 0, velocity: 0, target: 0 };
        let objectWeight = 0;
        const weightTimers = [];

        const placeObject = (btn) => {
            scaleButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
            if (!btn) {
                objectWeight = 0;
                scaleItem.textContent = '';
                scaleObjectRead.textContent = '— g';
                scaleVerdict.innerHTML = "Scegli un oggetto da mettere sull'altro piatto";
            } else {
                objectWeight = Number(btn.dataset.weight);
                scaleItem.textContent = btn.dataset.icon;
                scaleItem.classList.remove('is-dropping');
                void scaleItem.offsetWidth;
                scaleItem.classList.add('is-dropping');
                scaleObjectRead.textContent = `~${objectWeight} g`;
                const diff = Math.abs(DRONE_WEIGHT - objectWeight);
                if (diff <= 5) scaleVerdict.innerHTML = `<b>Praticamente in equilibrio</b> con ${btn.dataset.name}`;
                else if (objectWeight < DRONE_WEIGHT) scaleVerdict.innerHTML = `Il Mini 4K pesa <b>${diff} g in più</b> di ${btn.dataset.name}`;
                else scaleVerdict.innerHTML = `Il Mini 4K è <b>${diff} g più leggero</b> di ${btn.dataset.name}`;
            }
            // Positive angle tips the right pan (the object) down
            // Objects are all close to 249 g, so small differences need a visible tilt
            beam.target = clamp((objectWeight - DRONE_WEIGHT) * 0.25, -16, 16);
        };

        const countUp = (el, to, duration) => {
            const start = performance.now();
            const step = (now) => {
                const p = clamp((now - start) / duration, 0, 1);
                el.textContent = `${Math.round(to * (1 - Math.pow(1 - p, 3)))} g`;
                if (p < 1 && mode === 'weight') requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };

        const enterWeight = () => {
            weightTimers.forEach(clearTimeout);
            weightTimers.length = 0;
            placeObject(null);
            beam.target = 0;
            scaleDroneRead.textContent = '0 g';
            scale.classList.remove('has-drone');
            // Drone lands on the left pan, then a smartphone is placed for comparison
            weightTimers.push(setTimeout(() => {
                scale.classList.add('has-drone');
                beam.target = -16;
                countUp(scaleDroneRead, DRONE_WEIGHT, 900);
            }, 350));
            weightTimers.push(setTimeout(() => {
                if (objectWeight === 0) placeObject(scaleButtons.find((b) => b.dataset.default !== undefined) || scaleButtons[0]);
            }, 1700));
        };

        scaleButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                locked = 'weight';
                setMode('weight');
                weightTimers.forEach(clearTimeout);
                scale.classList.add('has-drone');
                scaleDroneRead.textContent = `${DRONE_WEIGHT} g`;
                placeObject(btn);
            });
        });

        const setMode = (next) => {
            if (next === mode) return;
            mode = next;
            frame.dataset.mode = next;
            label.textContent = labels[next];
            triggers.forEach((card) => card.classList.toggle('is-inspecting', card.dataset.droneHighlight === next));
            if (next === 'wind') {
                gustIndex = 0;
                gustStarted = 0;
                speed = 0;
            }
            if (next === 'weight') enterWeight();
            else weightTimers.forEach(clearTimeout);
        };

        // Leaving a card waits a moment, so the pointer can reach the frame (the balance has buttons)
        let leaveTimer;
        const scheduleIdle = () => {
            clearTimeout(leaveTimer);
            leaveTimer = setTimeout(() => { if (!locked) setMode('idle'); }, 300);
        };
        frame.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
        frame.addEventListener('focusin', () => clearTimeout(leaveTimer));
        frame.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse' && !locked) scheduleIdle();
        });

        triggers.forEach((card) => {
            const value = card.dataset.droneHighlight;
            card.addEventListener('pointerenter', (e) => {
                clearTimeout(leaveTimer);
                if (e.pointerType === 'mouse' && !locked) setMode(value);
            });
            card.addEventListener('pointerleave', (e) => {
                if (e.pointerType === 'mouse' && !locked) scheduleIdle();
            });
            card.addEventListener('focus', () => { if (!locked) setMode(value); });
            card.addEventListener('blur', () => { if (!locked) scheduleIdle(); });
            card.addEventListener('click', () => {
                locked = locked === value ? null : value;
                setMode(locked || value);
                // On narrow screens the visual sits above the cards: bring it into view
                const rect = frame.getBoundingClientRect();
                if (rect.bottom < 80 || rect.top > window.innerHeight - 80) {
                    frame.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
                }
            });
        });

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.round(canvas.clientWidth * dpr);
            const h = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };

        const spawn = (w, h, anywhere) => {
            // Enter from the upwind edge
            let x;
            let y;
            if (anywhere) {
                x = Math.random() * w;
                y = Math.random() * h;
            } else if (Math.abs(flowX) >= Math.abs(flowY)) {
                x = flowX > 0 ? -40 : w + 40;
                y = Math.random() * h;
            } else {
                x = Math.random() * w;
                y = flowY > 0 ? -40 : h + 40;
            }
            return { x, y, len: 20 + Math.random() * 60, speed: 0.6 + Math.random() * 0.8, alpha: 0.15 + Math.random() * 0.5 };
        };

        whileVisible(frame, (now) => {
            resize();
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            const windOn = mode === 'wind';

            if (windOn) {
                if (!gustStarted || now - gustStarted > 2800) {
                    if (gustStarted) gustIndex = (gustIndex + 1) % gusts.length;
                    gustStarted = now;
                    targetSpeed = 26 + Math.random() * 12; // within the Mini 4K's level 5 rating (38 km/h)
                    const gust = gusts[gustIndex];
                    windFrom.textContent = gust.from;
                    windArrow.style.transform = `rotate(${Math.atan2(gust.vy, gust.vx)}rad)`;
                }
                const gust = gusts[gustIndex];
                flowX = lerp(flowX, gust.vx, 0.04);
                flowY = lerp(flowY, gust.vy, 0.04);
                speed = lerp(speed, targetSpeed + Math.sin(now / 180) * 2.5, 0.05);
                windSpeed.textContent = Math.round(speed);
                // The drone leans into the wind to hold its position
                tilt = lerp(tilt, -flowX * (speed / 38) * 7, 0.06);
                driftValue.textContent = (Math.abs(Math.sin(now / 900)) * 0.04).toFixed(2);
            } else {
                speed = lerp(speed, 0, 0.08);
                tilt = lerp(tilt, 0, 0.08);
            }
            frame.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);

            // Damped spring for the balance beam
            if (mode !== 'weight') beam.target = 0;
            beam.velocity = (beam.velocity + (beam.target - beam.angle) * 0.06) * 0.86;
            beam.angle += beam.velocity;
            frame.style.setProperty('--beam', `${beam.angle.toFixed(2)}deg`);

            ctx.clearRect(0, 0, w, h);
            const density = windOn ? 90 : 0;
            while (particles.length < density) particles.push(spawn(w, h, particles.length < density / 2));
            if (!windOn && particles.length) particles.length = Math.max(0, particles.length - 4);

            const norm = Math.hypot(flowX, flowY) || 1;
            const dx = flowX / norm;
            const dy = flowY / norm;
            const pace = 4 + speed / 4;
            ctx.lineCap = 'round';
            const accent = getComputedStyle(frame).getPropertyValue('--accent-color').trim() || '#00d2ff';
            particles.forEach((p, i) => {
                p.x += dx * pace * p.speed;
                p.y += dy * pace * p.speed;
                const gradient = ctx.createLinearGradient(p.x, p.y, p.x - dx * p.len, p.y - dy * p.len);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${p.alpha})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.strokeStyle = i % 5 === 0 ? accent : gradient;
                ctx.globalAlpha = i % 5 === 0 ? p.alpha * 0.8 : 1;
                ctx.lineWidth = i % 7 === 0 ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - dx * p.len, p.y - dy * p.len);
                ctx.stroke();
                if (p.x < -80 || p.x > w + 80 || p.y < -80 || p.y > h + 80) particles[i] = spawn(w, h, false);
            });
            ctx.globalAlpha = 1;
        });
    };

    /* ------------------------------------------------------------------
       HUD-style text decode on headings
    ------------------------------------------------------------------ */
    const initDecode = () => {
        if (reduceMotion) return;
        // Match the case of each character so the scrambled line keeps roughly the same width
        const upper = 'ABCDEFGHKLMNOPRSTUVXYZ0123456789';
        const lower = 'abcdeghkmnopqrsuvxyz';
        const randomGlyph = (ch) => {
            const set = ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? lower : upper;
            return set[Math.floor(Math.random() * set.length)];
        };
        const targets = [...document.querySelectorAll('.section-title, .mission-title, [data-decode]')]
            .filter((el) => el.children.length === 0 && el.textContent.trim().length > 0);

        const run = (el) => {
            const finalText = el.textContent;
            const length = finalText.length;
            const totalFrames = 34;
            let frame = 0;
            el.style.height = `${el.offsetHeight}px`;
            el.classList.add('dv-decoding');

            const step = () => {
                let out = '';
                for (let i = 0; i < length; i++) {
                    const ch = finalText[i];
                    const revealAt = (i / length) * totalFrames * 0.75;
                    if (ch === ' ' || frame >= revealAt + 6) out += ch;
                    else out += randomGlyph(ch);
                }
                el.textContent = out;
                frame += 1;
                if (frame <= totalFrames) requestAnimationFrame(step);
                else {
                    el.textContent = finalText;
                    el.style.height = '';
                    el.classList.remove('dv-decoding');
                }
            };
            step();
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                run(entry.target);
            });
        }, { threshold: 0.6 });
        targets.forEach((el) => observer.observe(el));
    };

    /* ------------------------------------------------------------------
       Magnetic buttons
    ------------------------------------------------------------------ */
    const initMagnetic = () => {
        if (!canHover || reduceMotion) return;
        document.querySelectorAll('.btn, .dv-magnetic').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                el.style.transform = `translate(${x * 0.22}px, ${y * 0.35}px)`;
            });
            el.addEventListener('pointerleave', () => {
                el.style.transform = '';
            });
        });
    };

    /* ------------------------------------------------------------------
       Mission cards: live coordinates scan on hover
    ------------------------------------------------------------------ */
    const initMissionCards = () => {
        document.querySelectorAll('.dv-mission').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--px', `${((e.clientX - rect.left) / rect.width) * 100}%`);
                card.style.setProperty('--py', `${((e.clientY - rect.top) / rect.height) * 100}%`);
            });
        });
    };

    /* ------------------------------------------------------------------
       Main loop
    ------------------------------------------------------------------ */
    const start = () => {
        initBoot();
        const updateHud = initHud();
        const updateHero = initHero();
        const updateAscent = initAscent();
        initPano();
        initOrbit();
        initInspect();
        initDecode();
        initMagnetic();
        initMissionCards();

        let lastTime = performance.now();
        let audioThrottle = 0;
        let sentThrottle = -1;

        const loop = (now) => {
            const dt = Math.max(1, now - lastTime);
            lastTime = now;

            state.scrollY = window.scrollY;
            const delta = Math.abs(state.scrollY - state.lastScrollY);
            state.lastScrollY = state.scrollY;
            // px per ms -> a plausible km/h reading, capped at the Mini's top speed
            const instant = clamp((delta / dt) * 18, 0, 57);
            state.speed = lerp(state.speed, instant, instant > state.speed ? 0.25 : 0.05);

            const ease = reduceMotion ? 1 : 0.08;
            state.mx = lerp(state.mx, state.tmx, ease);
            state.my = lerp(state.my, state.tmy, ease);

            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const alt = docHeight > 0 ? clamp(state.scrollY / docHeight, 0, 1) * MAX_ALT : 0;

            updateHud(alt);
            if (updateHero) updateHero();
            if (updateAscent) updateAscent();

            audioThrottle = lerp(audioThrottle, clamp(state.speed / 40 + alt / MAX_ALT * 0.25, 0, 1), 0.1);
            if (Math.abs(audioThrottle - sentThrottle) > 0.02) {
                sentThrottle = audioThrottle;
                DroneAudio.setThrottle(audioThrottle);
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
