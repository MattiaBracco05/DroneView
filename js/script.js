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

window.addEventListener("DOMContentLoaded", () => {
    document.body.style.opacity = "1";
    setTimeout(() => overlay.classList.remove('active'), 500);
});

// Handle page transitions
document.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
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

initReveal();

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

// Lightbox Functionality
const initLightbox = () => {
    // Create lightbox elements
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close" aria-label="Close">&times;</button>
            <img class="lightbox-img" src="" alt="Full size image">
        </div>
    `;
    document.body.appendChild(lb);

    const lbImg = lb.querySelector('.lightbox-img');
    const lbClose = lb.querySelector('.lightbox-close');

    // Open lightbox
    document.querySelectorAll('.gallery-item').forEach(item => {
        const img = item.querySelector('img');
        if (!img) return;

        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            // If it's not a link to another page, open lightbox
            if (!href || href === '#' || href.startsWith('#')) {
                e.preventDefault();
                lbImg.src = img.src;
                lb.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    });

    // Close lightbox
    const closeLB = (withAnimation = false) => {
        if (withAnimation) {
            lb.classList.add('closing');
            // Wait for the take-off animation to finish
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
        if (e.target === lb) closeLB(false); // Quick close when clicking outside
    });

    // ESC key to close
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLB(false);
    });
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

    if (!navToggle || !navLinks) return;

    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = navToggle.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = navToggle.querySelector('i');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
        });
    });
};

initNav();

initNav();

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

