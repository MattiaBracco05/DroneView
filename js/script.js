// Create transition overlay
const overlay = document.createElement('div');
overlay.className = 'transition-overlay';
overlay.innerHTML = `
    <div class="propeller-container">
        <div class="propeller"></div>
        <div class="propeller"></div>
        <div class="propeller"></div>
        <div class="propeller"></div>
    </div>
`;
document.body.appendChild(overlay);

// Shared navbar: pages/navbar.html replaces <nav id="site-nav"> on every page.
// Its links are written relative to the site root and resolved here.
const siteRoot = new URL('../', document.currentScript.src);

const loadNavbar = () => {
    const placeholder = document.getElementById('site-nav');
    if (!placeholder) return;

    fetch(new URL('pages/navbar.html', siteRoot))
        .then(response => response.ok ? response.text() : Promise.reject())
        .then(html => {
            const template = document.createElement('template');
            template.innerHTML = html;
            const nav = template.content.querySelector('nav');
            const currentPath = location.pathname.replace(/\/$/, '/index.html');

            nav.querySelectorAll('a[href]').forEach(link => {
                const url = new URL(link.getAttribute('href'), siteRoot);
                const samePage = url.pathname === currentPath;
                // Anchors on the current page scroll smoothly instead of reloading
                link.setAttribute('href', samePage && url.hash ? url.hash : url.href);
                if (samePage && !url.hash && link.closest('.nav-links')) link.setAttribute('aria-current', 'page');
            });

            placeholder.replaceWith(nav);
            initNav();
            initThemeSwitcher();
            initAnchorLinks();
            initPageTransitions();
        })
        .catch(() => {
            placeholder.innerHTML = `<div class="container"><div class="nav-container"><a href="${new URL('index.html', siteRoot).href}" class="logo"><span class="logo-word"><span class="logo-drone">DRONE</span><span class="logo-view">VIEW</span></span></a></div></div>`;
        });
};

loadNavbar();

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    initCustomCursor();
    initLazyLoading();
    initHeroParticles();
    initVideoHudPlayers();
    initBackgroundVideo();
});

const initBackgroundVideo = () => {
    const video = document.getElementById('bg-video');
    if (video) video.playbackRate = 0.5;
};

const initVideoHudPlayers = () => {
    document.querySelectorAll('.video-hud-player').forEach((card) => {
        if (card.dataset.hudInitialized === 'true') return;
        card.dataset.hudInitialized = 'true';

        const video = card.querySelector('video');
        if (!video) return;

        let hud = card.querySelector('.video-player-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.className = 'video-player-hud';
            hud.innerHTML = `
                <span class="live-badge"><span class="live-dot"></span> PRONTO</span>
                <div class="video-controls">
                    <button class="video-toggle" type="button" aria-label="Riproduci video"><i class="fas fa-play"></i></button>
                    <div class="video-progress" aria-label="Avanzamento video">
                        <span class="video-progress-bar"></span>
                    </div>
                    <button class="video-fullscreen" type="button" aria-label="Schermo intero"><i class="fas fa-expand"></i></button>
                </div>
            `;
            card.appendChild(hud);
        }

        const toggle = hud.querySelector('.video-toggle');
        const progress = hud.querySelector('.video-progress');
        const progressBar = hud.querySelector('.video-progress-bar');
        const fullscreen = hud.querySelector('.video-fullscreen');
        const liveBadge = hud.querySelector('.live-badge');
        if (!toggle || !progress || !progressBar) return;

        const playOverlay = document.createElement('button');
        const title = card.querySelector('.gallery-overlay h3')?.textContent.trim();
        playOverlay.className = 'video-start';
        playOverlay.type = 'button';
        playOverlay.setAttribute('aria-label', title ? `Riproduci ${title}` : 'Riproduci video');
        playOverlay.innerHTML = '<i class="fas fa-play" aria-hidden="true"></i>';
        card.appendChild(playOverlay);

        const updateHud = () => {
            const pct = Number.isFinite(video.duration) && video.duration > 0
                ? (video.currentTime / video.duration) * 100
                : 0;
            progressBar.style.width = pct + '%';
            const isPaused = video.paused;
            toggle.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            toggle.setAttribute('aria-label', isPaused ? 'Riproduci video' : 'Metti in pausa il video');
            playOverlay.hidden = !isPaused;
            card.classList.toggle('video-has-started', video.dataset.hasStarted === 'true');
            card.classList.toggle('is-playing', !isPaused);
            if (liveBadge) {
                liveBadge.classList.toggle('muted', isPaused);
                const status = video.dataset.hasStarted === 'true'
                    ? (isPaused ? 'IN PAUSA' : 'IN RIPRODUZIONE')
                    : 'PRONTO';
                liveBadge.innerHTML = `<span class="live-dot"></span> ${status}`;
            }
        };

        const togglePlayback = async () => {
            if (video.paused) {
                try {
                    video.dataset.hasStarted = 'true';
                    await video.play();
                } catch (error) {
                    console.warn('Video play blocked:', error);
                }
            } else {
                video.pause();
            }
            updateHud();
        };

        playOverlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlayback();
        });

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlayback();
        });

        video.addEventListener('timeupdate', updateHud);
        video.addEventListener('play', updateHud);
        video.addEventListener('pause', updateHud);
        video.addEventListener('loadedmetadata', updateHud);
        video.addEventListener('error', () => {
            card.classList.add('video-unavailable');
            playOverlay.disabled = true;
            playOverlay.setAttribute('aria-label', 'Video non disponibile');
            if (liveBadge) liveBadge.textContent = 'VIDEO NON DISPONIBILE';
        });

        progress.addEventListener('click', (e) => {
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;
            const rect = progress.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            video.currentTime = ratio * video.duration;
            updateHud();
        });

        if (fullscreen) {
            fullscreen.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    if (!document.fullscreenElement) {
                        await card.requestFullscreen();
                    } else {
                        await document.exitFullscreen();
                    }
                } catch (error) {
                    console.warn('Fullscreen unavailable:', error);
                }
            });
        }

        updateHud();
    });
};

const initHeroParticles = () => {
    const canvas = document.getElementById('hero-particles');
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    const particles = [];
    const particleCount = Math.min(70, Math.max(28, Math.round(window.innerWidth / 18)));

    const resizeCanvas = () => {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
        canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    const createParticle = () => ({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        radius: Math.random() * 2.1 + 0.5,
        alpha: Math.random() * 0.7 + 0.15,
        dx: (Math.random() - 0.5) * 0.35,
        dy: (Math.random() - 0.5) * 0.35,
        hue: Math.random() > 0.5 ? 190 : 210
    });

    const initParticles = () => {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push(createParticle());
        }
    };

    const draw = () => {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        particles.forEach((particle) => {
            particle.x += particle.dx;
            particle.y += particle.dy;

            if (particle.x < 0 || particle.x > canvas.clientWidth) particle.dx *= -1;
            if (particle.y < 0 || particle.y > canvas.clientHeight) particle.dy *= -1;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${particle.hue}, 100%, 70%, ${particle.alpha})`;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    };

    resizeCanvas();
    initParticles();
    draw();

    window.addEventListener('resize', () => {
        resizeCanvas();
        initParticles();
    }, { passive: true });
};

const initLazyLoading = () => {
    document.querySelectorAll('.gallery-item img, .hud-preview-popup img, .popup-media img').forEach(img => {
        if (img.hasAttribute('loading')) return;
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        img.setAttribute('fetchpriority', 'low');
    });
};

// Custom Drone Cursor
function initCustomCursor() {
    if (window.innerWidth <= 1024) return;

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.innerHTML = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="12" fill="var(--accent-color)"/>
            <path d="M20 20 L80 80 M80 20 L20 80" stroke="var(--accent-color)" stroke-width="6" stroke-linecap="round"/>
            <circle cx="20" cy="20" r="8" fill="none" stroke="var(--accent-color)" stroke-width="3"/>
            <circle cx="80" cy="20" r="8" fill="none" stroke="var(--accent-color)" stroke-width="3"/>
            <circle cx="20" cy="80" r="8" fill="none" stroke="var(--accent-color)" stroke-width="3"/>
            <circle cx="80" cy="80" r="8" fill="none" stroke="var(--accent-color)" stroke-width="3"/>
        </svg>
    `;
    document.body.appendChild(cursor);

    let previousX = null;
    let resetTiltTimeout;

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';

        if (previousX !== null && e.clientX !== previousX) {
            cursor.style.setProperty('--cursor-tilt', e.clientX > previousX ? '18deg' : '-18deg');
            clearTimeout(resetTiltTimeout);
            resetTiltTimeout = setTimeout(() => {
                cursor.style.setProperty('--cursor-tilt', '0deg');
            }, 140);
        }

        previousX = e.clientX;
    });

    // Delegated, so elements injected later (navbar, footer) get the hover state too
    const interactiveSelector = 'a, button, .gallery-item, .accessory-card, .feature-card, .social-card, .radar-waypoint';
    document.addEventListener('mouseover', (e) => {
        cursor.classList.toggle('hover', Boolean(e.target.closest(interactiveSelector)));
    });
}

// Handle page display & restoration from Back/Forward cache (bfcache)
window.addEventListener("pageshow", () => {
    document.body.style.opacity = "1";
    overlay.classList.add('active');
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 500);
});

window.addEventListener("pagehide", () => {
    overlay.classList.remove('active');
});

// Handle page transitions
const initPageTransitions = () => {
    document.querySelectorAll('a').forEach(link => {
        if (link.dataset.transitionInitialized) return;
        link.dataset.transitionInitialized = 'true';

        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const target = link.getAttribute('target');
            
            // Ignore if key modifier is pressed or external target
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || target === '_blank') return;

            if (href && href.includes('.html')) {
                e.preventDefault();
                
                // Create Splash
                const rect = link.getBoundingClientRect();
                const splash = document.createElement('div');
                splash.className = 'splash';
                
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                splash.style.left = `${x}px`;
                splash.style.top = `${y}px`;
                const size = Math.max(rect.width, rect.height) * 2;
                splash.style.width = splash.style.height = `${size}px`;
                splash.style.marginLeft = splash.style.marginTop = `-${size/2}px`;
                
                link.style.overflow = 'hidden';
                link.appendChild(splash);
                
                // Trigger global transition after a short delay
                setTimeout(() => {
                    overlay.classList.add('active');
                    setTimeout(() => {
                        window.location.href = href;
                    }, 600);
                }, 200);
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', initPageTransitions);
initPageTransitions();

// Smooth scrolling and Takeoff Animation
const initAnchorLinks = () => document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    if (anchor.dataset.anchorInitialized) return;
    anchor.dataset.anchorInitialized = 'true';
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        // Special case for "Esplora Lavori" (Gallery link)
        if (targetId === '#gallery') {
            // Create takeoff drone
            const drone = document.createElement('div');
            drone.innerHTML = `
                <svg width="120" height="80" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 30H80M50 10V50M10 10L30 30M10 50L30 30M90 10L70 30M90 50L70 30" stroke="#00d2ff" stroke-width="5" stroke-linecap="round"/>
                    <circle cx="50" cy="30" r="12" fill="#00d2ff" fill-opacity="0.3" stroke="#00d2ff" stroke-width="2"/>
                    <circle cx="20" cy="30" r="5" fill="white" fill-opacity="0.8">
                        <animate attributeName="opacity" values="1;0.2;1" dur="0.1s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="80" cy="30" r="5" fill="white" fill-opacity="0.8">
                        <animate attributeName="opacity" values="1;0.2;1" dur="0.1s" repeatCount="indefinite" />
                    </circle>
                </svg>
            `;
            drone.style.cssText = `
                position: fixed;
                left: 50%;
                bottom: 10%;
                transform: translateX(-50%);
                z-index: 10001;
                transition: all 1.2s cubic-bezier(0.45, 0, 0.55, 1);
                pointer-events: none;
                filter: drop-shadow(0 0 20px #00d2ff);
            `;
            document.body.appendChild(drone);
            
            // Trigger takeoff
            setTimeout(() => {
                drone.style.bottom = '120%';
                drone.style.opacity = '0';
            }, 50);
            
            // Scroll after takeoff
            setTimeout(() => {
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
                setTimeout(() => document.body.removeChild(drone), 1000);
            }, 800);
        } else {
            // Regular smooth scroll
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

initAnchorLinks();

// Reveal animations on scroll
const revealObserverOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            // Once revealed, we can stop observing if we want it to stay visible
            // revealObserver.unobserve(entry.target);
        }
    });
}, revealObserverOptions);

const initReveal = () => {
    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });

    // Compatibility for old classes if they exist elsewhere
    document.querySelectorAll('.gallery-item, .specs, .feature-card').forEach(el => {
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal', 'reveal-up');
            revealObserver.observe(el);
        }
    });
};

// Drone Scroll Effects
window.addEventListener('scroll', () => {
    const scroll = window.scrollY;
    
    // Navbar background change
    const nav = document.querySelector('nav');
    if (scroll > 50) {
        nav.style.background = 'rgba(5, 5, 5, 0.95)';
        nav.style.padding = '10px 0';
    } else {
        nav.style.background = 'rgba(5, 5, 5, 0.8)';
        nav.style.padding = '0';
    }
});

// Enhanced Lightbox with Navigation
const initLightbox = () => {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close" aria-label="Close">&times;</button>
            <button class="lightbox-nav prev" aria-label="Precedente">&#8249;</button>
            <button class="lightbox-nav next" aria-label="Successiva">&#8250;</button>
            <img class="lightbox-img" src="" alt="Full size image">
            <span class="lightbox-counter"></span>
        </div>
    `;
    document.body.appendChild(lb);

    const lbImg = lb.querySelector('.lightbox-img');
    const lbClose = lb.querySelector('.lightbox-close');
    const lbPrev = lb.querySelector('.lightbox-nav.prev');
    const lbNext = lb.querySelector('.lightbox-nav.next');
    const lbCounter = lb.querySelector('.lightbox-counter');

    let images = [];
    let currentIndex = 0;

    const collectImages = () => {
        images = [];
        document.querySelectorAll('.gallery-item').forEach(item => {
            const img = item.querySelector('img');
            const href = item.getAttribute('href');
            if (img && (!href || href === '#' || href.startsWith('#'))) {
                images.push({ src: img.src, alt: img.alt, element: item });
            }
        });
    };

    const showImage = (index) => {
        if (images.length === 0) return;
        currentIndex = index;
        lbImg.src = images[index].src;
        lbImg.alt = images[index].alt || 'Full size image';
        lbCounter.textContent = `${index + 1} / ${images.length}`;
        const hasMultiple = images.length > 1;
        lbPrev.style.display = hasMultiple ? 'block' : 'none';
        lbNext.style.display = hasMultiple ? 'block' : 'none';
        lbCounter.style.display = hasMultiple ? 'block' : 'none';
    };

    const showPrev = () => {
        if (images.length <= 1) return;
        showImage((currentIndex - 1 + images.length) % images.length);
    };

    const showNext = () => {
        if (images.length <= 1) return;
        showImage((currentIndex + 1) % images.length);
    };

    // Open lightbox
    document.querySelectorAll('.gallery-item').forEach(item => {
        const img = item.querySelector('img');
        if (!img) return;

        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (!href || href === '#' || href.startsWith('#')) {
                e.preventDefault();
                collectImages();
                const index = images.findIndex(i => i.element === item);
                if (index !== -1) {
                    showImage(index);
                    lb.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    });

    // Navigation
    lbPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
    lbNext.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

    // Close lightbox
    const closeLB = () => {
        if (!lb.classList.contains('active') || lb.classList.contains('closing')) return;

        lb.classList.add('closing');
        setTimeout(() => {
            lb.classList.remove('active', 'closing');
            document.body.style.overflow = 'auto';
            lbImg.src = '';
        }, 180);
    };

    lbClose.addEventListener('click', closeLB);
    lb.addEventListener('click', (e) => {
        if (e.target === lb) closeLB();
    });

    // Keyboard navigation (ESC + Arrows)
    window.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('active')) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeLB();
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            showPrev();
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            showNext();
        }
    });

    // Touch swipe support
    let touchStartX = null;
    lb.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lb.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const diff = touchStartX - e.changedTouches[0].screenX;
        touchStartX = null;
        if (Math.abs(diff) > 50) {
            if (diff > 0) showNext();
            else showPrev();
        }
    }, { passive: true });
};

initLightbox();
// Mobile Navigation Toggle
const initNav = () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (!navToggle || !navLinks || navToggle.dataset.initialized) return;
    navToggle.dataset.initialized = 'true';

    const toggleMenu = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const isOpen = navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        if (icon) {
            if (isOpen) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    };

    navToggle.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
            toggleMenu();
        }
    });
};

// 3D Tilt Effect for Gallery Cards
const initTilt = () => {
    const cards = document.querySelectorAll('.gallery-item');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within the element
            const y = e.clientY - rect.top;  // y position within the element
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate rotation values (max 15 degrees)
            const rotateX = (centerY - y) / 10;
            const rotateY = (x - centerX) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });
    });
};

initTilt();

// Interactive Flight Radar Waypoints & Preview Popup
const initRadarWaypoints = () => {
    document.querySelectorAll('.map-radar-wrapper').forEach(wrapper => {
        const popup = wrapper.querySelector('.hud-preview-popup');
        if (!popup) return;

        const popupTitle = popup.querySelector('.popup-title');
        const popupAlt = popup.querySelector('.popup-alt');
        const popupSpeed = popup.querySelector('.popup-speed');
        const popupMedia = popup.querySelector('.popup-media');
        const popupClose = popup.querySelector('.popup-close');
        const radarOverlay = wrapper.querySelector('.hud-radar-overlay');

        const waypoints = wrapper.querySelectorAll('.radar-waypoint');
        let suppressWaypointPopupUntil = 0;

        const closePopup = (suppressWaypointReopen = false) => {
            if (suppressWaypointReopen) {
                suppressWaypointPopupUntil = performance.now() + 1000;
            }
            popup.classList.remove('active');
            radarOverlay?.classList.remove('has-active-popup');
            popupMedia.querySelector('video')?.pause();
        };

        waypoints.forEach(wp => {
            const showPopup = () => {
                if (performance.now() < suppressWaypointPopupUntil) return;

                const title = wp.dataset.title || 'Punto di Volo';
                const alt = wp.dataset.alt || '50m';
                const speed = wp.dataset.speed || '12 km/h';
                const type = wp.dataset.type || 'image';
                const src = wp.dataset.src;

                popupTitle.textContent = title;
                popupAlt.textContent = alt;
                popupSpeed.textContent = speed;

                if (type === 'video') {
                    popupMedia.innerHTML = `<video src="${src}" autoplay loop muted playsinline></video>`;
                } else {
                    popupMedia.innerHTML = `<img src="${src}" alt="${title}">`;
                }

                popup.classList.add('active');
                radarOverlay?.classList.add('has-active-popup');
            };

            wp.addEventListener('mouseenter', showPopup);
            wp.addEventListener('click', showPopup);
        });

        if (popupClose) {
            popupClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopup(true);
            });
        }

        radarOverlay?.addEventListener('click', (e) => {
            if (e.target === radarOverlay && popup.classList.contains('active')) {
                closePopup(true);
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', initRadarWaypoints);
initRadarWaypoints();

// HUD Theme Switcher Logic
const initThemeSwitcher = () => {
    const savedTheme = localStorage.getItem('droneview_hud_theme') || 'cyan';
    
    const applyTheme = (themeName) => {
        if (themeName === 'cyan') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', themeName);
        }
        localStorage.setItem('droneview_hud_theme', themeName);

        // Update active class on theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.setTheme === themeName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };

    // Apply saved theme immediately
    applyTheme(savedTheme);

    // Event listeners for theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = btn.dataset.setTheme;
            applyTheme(theme);
        });
    });
};

document.addEventListener('DOMContentLoaded', initThemeSwitcher);
initThemeSwitcher();

// Scroll Progress Indicator
const initScrollProgress = () => {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
            const scrollPercent = (scrollTop / docHeight) * 100;
            progressBar.style.width = scrollPercent + '%';
        }
    }, { passive: true });
};

initScrollProgress();

// Animated Counter for Flight Stats
const initCounterAnimation = () => {
    const counterElements = document.querySelectorAll('[data-counter]');
    if (counterElements.length === 0) return;

    const animateCounter = (element) => {
        const target = parseFloat(element.dataset.counter);
        const suffix = element.dataset.suffix || '';
        const decimals = (target % 1 !== 0) ? (target.toString().split('.')[1] || '').length : 0;
        const decimalSeparator = element.dataset.decimalSeparator || '.';
        const formatValue = (value) => decimals > 0
            ? value.toFixed(decimals).replace('.', decimalSeparator)
            : Math.round(value);
        const duration = 1800;
        const startTime = performance.now();

        element.textContent = '0' + suffix;

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;

            const displayValue = formatValue(current);
            element.textContent = displayValue + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = formatValue(target) + suffix;
            }
        };

        requestAnimationFrame(update);
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counterDone) {
                entry.target.dataset.counterDone = 'true';
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counterElements.forEach(el => counterObserver.observe(el));
};

document.addEventListener('DOMContentLoaded', initCounterAnimation);
initCounterAnimation();
