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

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    initCustomCursor();
});

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

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    const interactiveElements = document.querySelectorAll('a, button, .gallery-item, .accessory-card, .feature-card, .social-card, .radar-waypoint');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
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
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
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
    const closeLB = (withAnimation = false) => {
        if (withAnimation) {
            lb.classList.add('closing');
            setTimeout(() => {
                lb.classList.remove('active');
                lb.classList.remove('closing');
                document.body.style.overflow = 'auto';
                setTimeout(() => { lbImg.src = ''; }, 400);
            }, 800);
        } else {
            lb.classList.remove('active');
            document.body.style.overflow = 'auto';
            setTimeout(() => { lbImg.src = ''; }, 400);
        }
    };

    lbClose.addEventListener('click', () => closeLB(true));
    lb.addEventListener('click', (e) => {
        if (e.target === lb) closeLB(false);
    });

    // Keyboard navigation (ESC + Arrows)
    window.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('active')) return;
        if (e.key === 'Escape') closeLB(false);
        if (e.key === 'ArrowLeft') showPrev();
        if (e.key === 'ArrowRight') showNext();
    });

    // Touch swipe support
    let touchStartX = 0;
    lb.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lb.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) showNext();
            else showPrev();
        }
    }, { passive: true });
};

initLightbox();

// Video Boomerang Control
const initVideoControl = () => {
    const video = document.getElementById('bg-video');
    if (!video) return;

    // Velocità dimezzata per un effetto più cinematografico
    video.playbackRate = 0.5;
    let isReversing = false;
    let lastTime = 0;

    const reversePlayback = (timestamp) => {
        if (!isReversing) return;
        
        if (!lastTime) lastTime = timestamp;
        const delta = timestamp - lastTime;
        lastTime = timestamp;

        // Simulazione riproduzione all'indietro a 0.5x
        if (video.currentTime > 0.05) {
            // Sottraiamo il tempo proporzionalmente al delta per mantenere la velocità costante
            video.currentTime -= (delta / 1000) * 0.5;
            requestAnimationFrame(reversePlayback);
        } else {
            video.currentTime = 0;
            isReversing = false;
            lastTime = 0;
            video.play();
        }
    };

    // Quando il video finisce (atterraggio completato), iniziamo il decollo (reverse)
    video.addEventListener('ended', () => {
        isReversing = true;
        lastTime = 0;
        requestAnimationFrame(reversePlayback);
    });

    // Controllo visibilità per risparmio risorse
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!isReversing) video.play();
            } else {
                video.pause();
            }
        });
    }, { threshold: 0.1 });

    videoObserver.observe(video);
};

initVideoControl();

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

        const waypoints = wrapper.querySelectorAll('.radar-waypoint');

        waypoints.forEach(wp => {
            const showPopup = () => {
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
            };

            wp.addEventListener('mouseenter', showPopup);
            wp.addEventListener('click', showPopup);
        });

        if (popupClose) {
            popupClose.addEventListener('click', (e) => {
                e.stopPropagation();
                popup.classList.remove('active');
            });
        }
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
        const suffix = element.dataset.counterSuffix || '';
        const decimals = (target % 1 !== 0) ? (target.toString().split('.')[1] || '').length : 0;
        const duration = 2000;
        const startTime = performance.now();

        element.textContent = '0' + suffix;

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;

            element.textContent = current.toFixed(decimals) + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target + suffix;
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

