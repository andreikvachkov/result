document.addEventListener("DOMContentLoaded", (event) => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
        smooth: true,
        lerp: 0.08,
        wheelMultiplier: 1,
        gestureTarget: window
    });
    window.lenis = lenis;

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', ScrollTrigger.update);

    ScrollTrigger.scrollerProxy(document.documentElement, {
        scrollTop(value) {
            if (arguments.length) {
                lenis.scrollTo(value, { immediate: true });
            }
            return lenis.scroll;
        },
        getBoundingClientRect() {
            return { top: 0, left: 0, width: innerWidth, height: innerHeight };
        },
        pinType: document.documentElement.style.transform ? 'transform' : 'fixed'
    });

    ScrollTrigger.addEventListener('refresh', () => {
        requestAnimationFrame(() => lenis.raf(performance.now()));
    });

    ScrollTrigger.refresh();


    // Подложка шапки при скроле 
    (() => {
        const header = document.querySelector('header');
        if (!header) return;

        const THRESHOLD = 100;
        const apply = (y) => header.classList.toggle('scroll', y > THRESHOLD);


        if (lenis && typeof lenis.on === 'function') {
            apply(lenis.scroll || window.scrollY || 0);
            lenis.on('scroll', ({ scroll }) => apply(scroll));
        } else {
            const update = () => apply(window.scrollY || 0);
            window.addEventListener('scroll', update, { passive: true });
            update();
        }
    })();

    // Прелоадер 
    function lockScrollGlobal() {
        if (window.lenis && typeof window.lenis.stop === 'function') {
            try { window.lenis.stop(); } catch (_) { }
        }

        const cancel = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        const cancelKeys = (e) => {
            const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '];
            if (codes.includes(e.key)) cancel(e);
        };

        window.addEventListener('wheel', cancel, { passive: false });
        window.addEventListener('touchmove', cancel, { passive: false, capture: true });
        document.addEventListener('scroll', cancel, { passive: false, capture: true });
        document.addEventListener('keydown', cancelKeys, { passive: false });

        document.documentElement.classList.add('scroll-locked');
        document.body.classList.add('scroll-locked');

        return () => {
            document.documentElement.classList.remove('scroll-locked');
            document.body.classList.remove('scroll-locked');

            window.removeEventListener('wheel', cancel, { passive: false });
            window.removeEventListener('touchmove', cancel, { passive: false, capture: true });
            document.removeEventListener('scroll', cancel, { passive: false, capture: true });
            document.removeEventListener('keydown', cancelKeys, { passive: false });

            if (window.lenis && typeof window.lenis.start === 'function') {
                try { window.lenis.start(); } catch (_) { }
            }
        };
    }


    // ===== Прелоадер (с блокировкой скролла) =====
    function runPreloader() {
        const preloader = document.querySelector('.preloader');
        const percentEl = preloader?.querySelector('.preloader__right p:last-child');
        if (!preloader || !percentEl) return Promise.resolve();

        const DURATION = 3000;

        return new Promise(resolve => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (reduce) {
                percentEl.textContent = '100%';
                preloader.classList.add('is-out');
                setTimeout(() => {
                    preloader.style.display = 'none';
                    resolve();
                }, 0);
                return;
            }

            const unlockScroll = lockScrollGlobal();

            preloader.classList.add('is-running');

            const start = performance.now();
            function tick(now) {
                const t = Math.min(1, (now - start) / DURATION);
                percentEl.textContent = Math.round(t * 100) + '%';
                if (t < 1) requestAnimationFrame(tick);
                else finish();
            }
            requestAnimationFrame(tick);

            function finish() {
                setTimeout(() => {
                    preloader.classList.add('is-out');

                    const cleanup = () => {
                        preloader.style.display = 'none';
                        preloader.removeEventListener('transitionend', cleanup);

                        unlockScroll();

                        resolve();
                    };
                    preloader.addEventListener('transitionend', cleanup);
                    setTimeout(cleanup, 1200);
                }, 150);
            }
        });
    }


    /* ===========================================
       Параллакс первого экрана (после прелоадера)
       =========================================== */
    function startHeroParallaxResponsive() {
        if (!window.gsap) return;

        function initParallax({ containerSel, shapeSel, pointer = true }) {
            const container = document.querySelector(containerSel);
            if (!container) return () => { };

            const shapes = Array.from(container.querySelectorAll(shapeSel));
            if (!shapes.length) return () => { };

            gsap.set(shapes, {
                opacity: 0,
                willChange: 'transform,opacity',
                transform: 'translateZ(0)',
                pointerEvents: 'none'
            });

            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            const waitImages = () =>
                Promise.all(
                    shapes.map(img =>
                        img.complete
                            ? Promise.resolve()
                            : (img.decode?.().catch(() => { }) || new Promise(res => (img.onload = img.onerror = res)))
                    )
                );

            let landed = false;
            let pointerHandler = null;

            function enableIdleBreath(nodes, { ampY = 10, rot = 6, scaleAmp = 0.035 } = {}) {
                nodes.forEach(el => {
                    const dur = gsap.utils.random(2.2, 3.8);
                    const delay = gsap.utils.random(0, 0.4);
                    const rotDir = gsap.utils.random([-1, 1]);
                    gsap.to(el, {
                        yPercent: `+=${ampY}`,
                        rotation: `+=${rot * rotDir}`,
                        scale: gsap.utils.random(1 - scaleAmp, 1 + scaleAmp),
                        duration: dur,
                        ease: 'sine.inOut',
                        yoyo: true,
                        repeat: -1,
                        repeatDelay: delay,
                        overwrite: false
                    });
                });
            }

            (async () => {
                await waitImages();

                if (reduce) {
                    gsap.set(shapes, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, clearProps: 'willChange' });
                    return;
                }

                gsap.set(shapes, {
                    x: () => gsap.utils.random(-160, 160),
                    y: () => -window.innerHeight * gsap.utils.random(0.4, 1.2),
                    rotation: () => gsap.utils.random(-220, 220),
                    scale: () => gsap.utils.random(0.85, 1.15),
                    opacity: 0
                });

                gsap.to(shapes, {
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scale: 1,
                    opacity: 1,
                    duration: () => gsap.utils.random(1.1, 1.9),
                    delay: () => gsap.utils.random(0, 0.35),
                    ease: 'back.out(1.7)',
                    stagger: { each: 0.03, from: 'random' },
                    onComplete: () => {
                        landed = true;
                        enableIdleBreath(shapes, { ampY: 10, rot: 6, scaleAmp: 0.035 });
                    }
                });

                const canPointerFollow =
                    pointer && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

                if (canPointerFollow) {
                    const controllers = shapes.map(el => ({
                        mult: parseFloat(el.dataset.animation || '1'),
                        toX: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power2.out' }),
                        toY: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power2.out' })
                    }));

                    pointerHandler = e => {
                        if (!landed) return;
                        const cx = window.innerWidth / 2;
                        const cy = window.innerHeight / 2;
                        const dx = e.clientX - cx;
                        const dy = e.clientY - cy;
                        const strength = 0.04;
                        controllers.forEach(({ mult, toX, toY }) => {
                            toX(dx * strength * mult);
                            toY(dy * strength * mult);
                        });
                    };

                    window.addEventListener('pointermove', pointerHandler, { passive: true });
                }
            })();

            return () => {
                if (pointerHandler) window.removeEventListener('pointermove', pointerHandler);
                gsap.killTweensOf(shapes);
                gsap.set(shapes, { clearProps: 'all' });
            };
        }

        const mm = gsap.matchMedia();

        mm.add('(min-width: 769px)', () => {
            const cleanup = initParallax({
                containerSel: '.hero__paralax',
                shapeSel: '.shape',
                pointer: true
            });
            return cleanup;
        });

        mm.add('(max-width: 768px)', () => {
            const cleanup = initParallax({
                containerSel: '.hero__paralax_mobile',
                shapeSel: '.shape-mobile',
                pointer: false
            });
            return cleanup;
        });
    }

    /* =============================================
    Прелоадер — тестовый режим
    ============================================= */
    const FIRST_VISIT_KEY = 'preloader_seen_v1';
    const FORCE_PRELOADER = false;

    function skipPreloader() {
        const preloader = document.querySelector('.preloader');
        if (preloader) preloader.style.display = 'none';
    }

    function boot() {
        if (FORCE_PRELOADER) {
            try { localStorage.removeItem(FIRST_VISIT_KEY); } catch (e) { }
            runPreloader().then(startHeroParallaxResponsive);
            return;
        }

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
            skipPreloader();
            startHeroParallaxResponsive();
            return;
        }

        const isFirstVisit = !localStorage.getItem(FIRST_VISIT_KEY);
        if (isFirstVisit) {
            runPreloader().then(() => {
                try { localStorage.setItem(FIRST_VISIT_KEY, '1'); } catch (e) { }
                startHeroParallaxResponsive();
            });
        } else {
            skipPreloader();
            startHeroParallaxResponsive();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }


    // Бегущая строка на первом блоке 
    (() => {
        const topSlider = document.querySelector('.hero__line');
        if (!topSlider) return;

        const originalImages = Array.from(topSlider.querySelectorAll('img'));
        if (originalImages.length === 0) return;

        const carouselTrack = document.createElement('div');
        carouselTrack.className = 'carousel-track';
        topSlider.innerHTML = '';
        topSlider.appendChild(carouselTrack);

        const minItems = 12;
        let allItems = [];

        if (originalImages.length < minItems) {
            while (allItems.length < minItems) {
                for (const img of originalImages) {
                    if (allItems.length >= minItems) break;
                    allItems.push(img.cloneNode(true));
                }
            }
        } else {
            allItems = originalImages.map(img => img.cloneNode(true));
        }

        allItems.forEach(img => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.appendChild(img);
            carouselTrack.appendChild(item);
        });

        allItems.forEach(img => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.appendChild(img.cloneNode(true));
            carouselTrack.appendChild(item);
        });

        const items = carouselTrack.querySelectorAll('.carousel-item');
        if (!items.length) return;

        const gap = 30;
        const itemWidth = items[0].offsetWidth + gap;
        const segmentWidth = itemWidth * allItems.length;

        const pixelsPerSecond = 50;

        gsap.to(carouselTrack, {
            x: -segmentWidth,
            duration: segmentWidth / pixelsPerSecond,
            ease: "none",
            repeat: -1,
            modifiers: {
                x: gsap.utils.unitize(gsap.utils.wrap(-segmentWidth, 0))
            }
        });
    })();

    // Бегущая строка на первом блоке 
    (() => {
        const topSlider = document.querySelector('.about-marquee__line');
        if (!topSlider) return;

        const originalImages = Array.from(topSlider.querySelectorAll('img'));
        if (originalImages.length === 0) return;

        const carouselTrack = document.createElement('div');
        carouselTrack.className = 'carousel-track';
        topSlider.innerHTML = '';
        topSlider.appendChild(carouselTrack);

        const minItems = 12;
        let allItems = [];

        if (originalImages.length < minItems) {
            while (allItems.length < minItems) {
                for (const img of originalImages) {
                    if (allItems.length >= minItems) break;
                    allItems.push(img.cloneNode(true));
                }
            }
        } else {
            allItems = originalImages.map(img => img.cloneNode(true));
        }

        allItems.forEach(img => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.appendChild(img);
            carouselTrack.appendChild(item);
        });

        allItems.forEach(img => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.appendChild(img.cloneNode(true));
            carouselTrack.appendChild(item);
        });

        const items = carouselTrack.querySelectorAll('.carousel-item');
        if (!items.length) return;

        const gap = 30;
        const itemWidth = items[0].offsetWidth + gap;
        const segmentWidth = itemWidth * allItems.length;

        const pixelsPerSecond = 50;

        gsap.to(carouselTrack, {
            x: -segmentWidth,
            duration: segmentWidth / pixelsPerSecond,
            ease: "none",
            repeat: -1,
            modifiers: {
                x: gsap.utils.unitize(gsap.utils.wrap(-segmentWidth, 0))
            }
        });
    })();


    // Слайдеры
    const result_section__swiper = new Swiper('.result-section__swiper', {
        slidesPerView: 1,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        breakpoints: {
            769: { slidesPerView: 3 }
        },
        navigation: {
            nextEl: '.result-section__swiper__next',
            prevEl: '.result-section__swiper__prev',
        },
        pagination: {
            el: '.result-section__swiper-pagination',
            clickable: true,
        }

    });
    (() => {
        const SLIDER_SEL = '.about-team__swiper';
        const NEXT_SEL = '.about-team__swiper__next';
        const PREV_SEL = '.about-team__swiper__prev';
        const BP_QUERY = '(min-width: 769px)';
        const GAP_REM = 6.875;

        let swiper = null;

        const remPx = (r) => {
            const root = document.documentElement;
            const fs = parseFloat(getComputedStyle(root).fontSize) || 16;
            return r * fs;
        };

        const enable = () => {
            if (swiper || !window.Swiper) return;
            const el = document.querySelector(SLIDER_SEL);
            if (!el) return;

            try {
                swiper = new Swiper(el, {
                    slidesPerView: 4,
                    loop: false,
                    spaceBetween: remPx(GAP_REM),
                    speed: 700,
                    navigation: { nextEl: NEXT_SEL, prevEl: PREV_SEL },
                });
            } catch (_) { swiper = null; }
        };

        const disable = () => {
            if (!swiper) return;
            try { swiper.destroy(true, true); } catch (_) { }
            swiper = null;
        };

        const mql = window.matchMedia ? window.matchMedia(BP_QUERY) : { matches: true, addEventListener: null, addListener: null };
        const apply = () => (mql.matches ? enable() : disable());

        const start = () => {
            const schedule = window.requestIdleCallback || ((cb) => requestAnimationFrame(cb));
            schedule(apply);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }

        if (mql.addEventListener) mql.addEventListener('change', apply);
        else if (mql.addListener) mql.addListener(apply);

        let rafId = 0;
        window.addEventListener('resize', () => {
            if (!swiper) return;
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                swiper.params.spaceBetween = remPx(GAP_REM);
                swiper.update();
            });
        }, { passive: true });
    })();

    const cases_ection__swiper = new Swiper('.cases-section__swiper', {
        slidesPerView: 1,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        navigation: {
            nextEl: '.cases-section__swiper__next',
            prevEl: '.cases-section__swiper__prev',
        },
        breakpoints: {
            769: { slidesPerView: 3 }
        },
        pagination: {
            el: '.cases-section__swiper-pagination',
            clickable: true,
        }

    });
    const reviews_section__swiper = new Swiper('.reviews-section__swiper', {
        slidesPerView: 1,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        autoHeight: true,
        navigation: {
            nextEl: '.reviews-section__swiper__next',
            prevEl: '.reviews-section__swiper__prev',
        },
        breakpoints: {
            769: { slidesPerView: 3 }
        },
        pagination: {
            el: '.reviews-section__swiper-pagination',
            clickable: true,
        }
    });



    // Выпадающее меню 
    document.querySelectorAll(".feedback-section__form-drop, .feedbackv2-section__form-drop, .feedback-popup__form-drop").forEach(dropdown => {
        const btn = dropdown.querySelector(".dropdown-btn");
        const content = dropdown.querySelector(".dropdown__content");
        if (!btn || !content) return;

        const open = () => {
            btn.classList.add("active");
            content.style.maxHeight = content.scrollHeight + "px";
            const onEnd = (e) => {
                if (e.propertyName === "max-height") {
                    content.style.maxHeight = "none";
                    content.removeEventListener("transitionend", onEnd);
                }
            };
            content.addEventListener("transitionend", onEnd);
        };

        const close = () => {
            if (getComputedStyle(content).maxHeight === "none") {
                content.style.maxHeight = content.scrollHeight + "px";
                content.offsetHeight;
            }
            btn.classList.remove("active");
            content.style.maxHeight = "0px";
        };

        btn.addEventListener("click", () => {
            btn.classList.contains("active") ? close() : open();
        });

        content.addEventListener("change", (e) => {
            const input = e.target.closest(".radio-input");
            if (!input) return;
            const label = content.querySelector(`label[for="${input.id}"]`);
            if (label) btn.textContent = label.textContent.trim();
            close();
        });

        content.addEventListener("click", (e) => {
            const label = e.target.closest(".radio-label");
            if (!label) return;
            const id = label.getAttribute("for");
            const input = id ? document.getElementById(id) : null;
            if (input) input.checked = true;
            btn.textContent = label.textContent.trim();
            close();
        });
    });




    // FEEDBACK: "дыхание" слева — без поворота
    (() => {
        const items = document.querySelectorAll('.feedback-section__left .feedback-section__item');
        if (!items.length) return;

        gsap.set(items, { willChange: 'transform', transform: 'translateZ(0)', rotation: 0 });

        items.forEach(el => {
            const dur = gsap.utils.random(2.6, 4.4);
            const delay = gsap.utils.random(0, 0.35);

            gsap.to(el, {
                yPercent: `+=${gsap.utils.random(16, 24)}`,
                xPercent: `+=${gsap.utils.random(-4, 4)}`,
                scale: gsap.utils.random(0.985, 1.03),
                duration: dur,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                repeatDelay: delay,
                overwrite: false
            });
        });

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.killTweensOf(items);
            gsap.set(items, { clearProps: 'transform' });
        }
    })();




    // === GOAL: параллакс-картинок при скролле ===
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;
        const { gsap, ScrollTrigger } = window;

        const section = document.querySelector('.goal-section');
        if (!section) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;

        const waitImages = root =>
            Promise.all(
                [...root.querySelectorAll('img')].map(img =>
                    img.complete
                        ? Promise.resolve()
                        : (img.decode?.().catch(() => { }) ||
                            new Promise(res => (img.onload = img.onerror = res)))
                )
            );

        function initParallax({ layers, baseDist }) {
            const triggers = [];

            layers.forEach(({ sel, speed }) => {
                const el = section.querySelector(sel);
                if (!el) return;

                const dist = baseDist * speed;
                gsap.set(el, { willChange: 'transform', force3D: true });

                const tween = gsap.fromTo(
                    el,
                    { y: -dist / 2 },
                    {
                        y: dist / 2,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: section,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: 0.6,
                            invalidateOnRefresh: true
                        }
                    }
                );

                triggers.push(tween.scrollTrigger);
            });

            return () => {
                triggers.forEach(st => st && st.kill());
            };
        }

        const mm = gsap.matchMedia();

        mm.add('(min-width: 769px)', async () => {
            await waitImages(section);

            const cleanup = initParallax({
                baseDist: 260,
                layers: [
                    { sel: '.goal-section__img-1', speed: 0.7 },
                    { sel: '.goal-section__img-2', speed: 1.2 },
                    { sel: '.goal-section__img-3', speed: 0.5 },
                    { sel: '.goal-section__img-4', speed: 1.0 },
                ]
            });

            ScrollTrigger.refresh();
            return cleanup;
        });

        mm.add('(max-width: 768px)', async () => {
            await waitImages(section);

            const cleanup = initParallax({
                baseDist: 180,
                layers: [
                    { sel: '.goal-section__img-mob-1', speed: 0.7 },
                    { sel: '.goal-section__img-mob-2', speed: 1.2 },
                    { sel: '.goal-section__img-mob-3', speed: 0.5 },
                    { sel: '.goal-section__img-mob-4', speed: 1.0 },
                ]
            });

            ScrollTrigger.refresh();
            return cleanup;
        });
    })();

    // === PARTNERSHIP: лёгкое «дыхание» карточек (чуть больше амплитуда) ===
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const section = document.querySelector('.partnership-section');
        if (!section) return;

        const mm = gsap.matchMedia();

        mm.add("(min-width: 769px)", () => {
            const cards = Array.from(section.querySelectorAll('.partnership-section__item'));
            if (!cards.length) return;

            gsap.set(cards, { willChange: 'transform', force3D: true });

            const tweens = cards.map(el => {
                const dx = gsap.utils.random(-8, 8);
                const dy = gsap.utils.random(-10, 10);
                const drot = gsap.utils.random(-0.75, 0.75);
                const dur = gsap.utils.random(3.2, 5.2);
                const dly = gsap.utils.random(0, 0.6);

                return gsap.to(el, {
                    x: `+=${dx}`,
                    y: `+=${dy}`,
                    rotation: `+=${drot}`,
                    duration: dur,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    delay: dly,
                    overwrite: false
                });
            });

            const st = ScrollTrigger.create({
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                onEnter: () => tweens.forEach(t => t.resume()),
                onEnterBack: () => tweens.forEach(t => t.resume()),
                onLeave: () => tweens.forEach(t => t.pause()),
                onLeaveBack: () => tweens.forEach(t => t.pause())
            });

            return () => {
                tweens.forEach(t => t.kill());
                st.kill();
                gsap.set(cards, { clearProps: "transform,will-change" });
            };
        });
    })();



    // === USLUGI: ползунок справа + пин левого контента до касания низа ===
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const { gsap, ScrollTrigger } = window;

        const mm = gsap.matchMedia();

        mm.add('(min-width: 769px)', () => {
            const section = document.querySelector('.uslugi-section');
            const wrap = section?.querySelector('.uslugi-section__wrap');
            const rightWrap = section?.querySelector('.uslugi-section__right__content');
            const leftCol = section?.querySelector('.uslugi-section__left');
            const leftContent = section?.querySelector('.uslugi-section__left__content');
            if (!wrap || !rightWrap || !leftCol || !leftContent) return;

            gsap.set(leftCol, { width: leftCol.getBoundingClientRect().width });

            const waitImages = (root) =>
                Promise.all(
                    [...root.querySelectorAll('img')].map(img =>
                        img.complete
                            ? Promise.resolve()
                            : (img.decode?.().catch(() => { }) || new Promise(res => (img.onload = img.onerror = res)))
                    )
                );

            let maxY = 0, thumbH = 0;
            const recalcThumb = () => {
                const trackH = rightWrap.clientHeight;
                const after = getComputedStyle(rightWrap, '::after');
                thumbH = parseFloat(after.height) || 0;
                maxY = Math.max(0, trackH - thumbH);
            };

            const calcPinDistance = () => {
                const travel = leftCol.clientHeight - (leftContent.offsetTop + leftContent.offsetHeight);
                return Math.max(0, travel);
            };

            let thumbST;
            let resizeHandler;

            const init = () => {
                recalcThumb();

                thumbST = ScrollTrigger.create({
                    trigger: wrap,
                    start: 'top top+=170',
                    end: 'bottom bottom-=80',
                    scrub: 0.35,
                    onUpdate: self => {
                        rightWrap.style.setProperty('--thumbY', (self.progress * maxY) + 'px');
                    },
                    onRefreshInit: recalcThumb,
                    invalidateOnRefresh: true
                });

                gsap.set(leftContent, { willChange: 'transform', force3D: true });
                ScrollTrigger.create({
                    trigger: wrap,
                    start: 'top top+=170',
                    end: () => '+=' + calcPinDistance(),
                    pin: leftContent,
                    pinSpacing: true,
                    pinType: 'transform',
                    anticipatePin: 2,
                    invalidateOnRefresh: true
                });

                resizeHandler = () => {
                    gsap.set(leftCol, { width: leftCol.getBoundingClientRect().width });
                    recalcThumb();
                    if (thumbST) {
                        rightWrap.style.setProperty('--thumbY', (thumbST.progress || 0) * maxY + 'px');
                    }
                    ScrollTrigger.refresh();
                };
                window.addEventListener('resize', resizeHandler, { passive: true });

                ScrollTrigger.refresh();
            };

            Promise.all([waitImages(wrap), waitImages(rightWrap), waitImages(leftCol)]).then(init);

            return () => {
                window.removeEventListener('resize', resizeHandler);
                ScrollTrigger.getAll()
                    .filter(st => st.trigger === wrap)
                    .forEach(st => st.kill());
                rightWrap.style.removeProperty('--thumbY');
                gsap.set(leftCol, { clearProps: 'width' });
                gsap.set(leftContent, { clearProps: 'willChange,transform' });
            };
        });
    })();


    // Анимация заполнения текста при скролле (финиш на 9.375rem от верха)
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;

        const title = document.querySelector('.method-section__title');
        if (!title || title.dataset.lettersWrapped) return;

        const textNodes = [];
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const raw = node.nodeValue;
            const parts = raw.split(/(\s+)/);
            const frag = document.createDocumentFragment();

            parts.forEach(part => {
                if (part.trim() === '') {
                    frag.appendChild(document.createTextNode(part));
                } else {
                    const word = document.createElement('span');
                    word.className = 'ms-word';
                    for (const ch of part) {
                        const s = document.createElement('span');
                        s.className = 'ms-letter';
                        s.textContent = ch;
                        word.appendChild(s);
                    }
                    frag.appendChild(word);
                }
            });

            node.parentNode.replaceChild(frag, node);
        });

        title.dataset.lettersWrapped = 'true';

        const letters = title.querySelectorAll('.ms-letter');

        const remToPx = rem => rem * parseFloat(getComputedStyle(document.documentElement).fontSize);

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: title,
                start: 'top 80%',
                end: () => `top ${remToPx(5.375)}px`,
                scrub: true,
                invalidateOnRefresh: true
            }
        });

        letters.forEach((el, i) => {
            tl.to(el, { color: '#ffffff', duration: 0.15, ease: 'none' }, i * 0.02);
        });
    })();


    // Мобильное меню
    (() => {
        const btn = document.querySelector('.header__menu-btn');
        const menu = document.querySelector('.mobile-menu');
        if (!btn || !menu) return;

        const OPEN_CLASS = 'active';

        function openMenu() {
            btn.classList.add(OPEN_CLASS);
            btn.setAttribute('aria-expanded', 'true');
            menu.classList.add(OPEN_CLASS);
        }

        function closeMenu() {
            btn.classList.remove(OPEN_CLASS);
            btn.setAttribute('aria-expanded', 'false');
            menu.classList.remove(OPEN_CLASS);
        }

        function toggleMenu() {
            if (menu.classList.contains(OPEN_CLASS)) closeMenu();
            else openMenu();
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMenu();
        });

        menu.addEventListener('click', (e) => {
            if (e.target.closest('a, .mobile-menu__btn')) closeMenu();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains(OPEN_CLASS)) closeMenu();
        });

        document.addEventListener('click', (e) => {
            if (!menu.classList.contains(OPEN_CLASS)) return;
            const clickInsideMenu = e.target.closest('.mobile-menu');
            const clickOnButton = e.target.closest('.header__menu-btn');
            if (!clickInsideMenu && !clickOnButton) closeMenu();
        });

        const mq = window.matchMedia('(min-width: 1025px)');
        const onBpChange = () => { if (mq.matches) closeMenu(); };
        mq.addEventListener?.('change', onBpChange);
        mq.addListener?.(onBpChange);
    })();


    // Попапы
    (() => {
        const bg = document.querySelector('.popup-background');
        const ACTIVE = 'active';

        const OPEN_MAP = {
            '.feedback-popup__open': '#popup-lead',
            '.feedback-popup__audit-open': '#popup-audit',
            '.feedback-popup__presentation-open': '#popup-presentation',
        };

        function lockScroll() {
            if (window.lenis?.stop) window.lenis.stop();
            document.documentElement.classList.add('no-scroll');
            document.body.classList.add('no-scroll');
        }
        function unlockScroll() {
            if (window.lenis?.start) window.lenis.start();
            document.documentElement.classList.remove('no-scroll');
            document.body.classList.remove('no-scroll');
        }

        const getActivePopup = () => document.querySelector('.feedback-popup.' + ACTIVE);

        function openPopup(sel) {
            const popup = document.querySelector(sel);
            if (!popup) return;
            const opened = getActivePopup();
            if (opened && opened !== popup) opened.classList.remove(ACTIVE);
            popup.classList.add(ACTIVE);
            bg?.classList.add(ACTIVE);
            lockScroll();
        }

        function closePopup() {
            getActivePopup()?.classList.remove(ACTIVE);
            bg?.classList.remove(ACTIVE);
            unlockScroll();
        }

        document.addEventListener('click', (e) => {
            for (const openerClass in OPEN_MAP) {
                const opener = e.target.closest(openerClass);
                if (opener) {
                    e.preventDefault();
                    openPopup(OPEN_MAP[openerClass]);
                    return;
                }
            }

            const closeBtn = e.target.closest('.feedback-popup__close');
            if (closeBtn) {
                e.preventDefault();
                closePopup();
            }
        });

        bg?.addEventListener('click', closePopup);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && getActivePopup()) closePopup();
        });
    })();

    (() => {
        const popup = document.getElementById('partner-popup');
        if (!popup) return;

        const openBtns = document.querySelectorAll('.partner-popup-open');
        const closeBtn = popup.querySelector('.partner-popup__close');
        const bg = document.querySelector('.popup-background');
        const ACTIVE = 'active';

        const lock = () => {
            if (window.lenis?.stop) window.lenis.stop();
            document.documentElement.classList.add('no-scroll');
            document.body.classList.add('no-scroll');
        };
        const unlock = () => {
            if (window.lenis?.start) window.lenis.start();
            document.documentElement.classList.remove('no-scroll');
            document.body.classList.remove('no-scroll');
        };

        const open = () => { popup.classList.add(ACTIVE); bg?.classList.add(ACTIVE); lock(); };
        const close = () => { popup.classList.remove(ACTIVE); bg?.classList.remove(ACTIVE); unlock(); };

        openBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); open(); }));
        closeBtn?.addEventListener('click', (e) => { e.preventDefault(); close(); });

        bg?.addEventListener('click', () => { if (popup.classList.contains(ACTIVE)) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup.classList.contains(ACTIVE)) close(); });
    })();



    (() => {
        if (!window.gsap) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;

        const section = document.querySelector('.uslugi-hero');
        if (!section) return;

        const cards = Array.from(section.querySelectorAll('.uslugi-hero__cart'));
        if (!cards.length) return;

        gsap.set(cards, { willChange: 'transform', force3D: true });

        const tweens = cards.map((el, i) => {
            const dx = gsap.utils.random(-8, 8);     // смещение по X
            const dy = gsap.utils.random(-10, 10);   // смещение по Y
            const drot = gsap.utils.random(-1.2, 1.2); // лёгкий докрут (в градусах)
            const dur = gsap.utils.random(3.5, 6.0);  // длительность
            const dly = gsap.utils.random(0, 0.8);    // задержка старта

            return gsap.to(el, {
                x: `+=${dx}`,
                y: `+=${dy}`,
                rotation: `+=${drot}`,
                ease: 'sine.inOut',
                duration: dur,
                delay: dly,
                yoyo: true,
                repeat: -1,
                overwrite: false
            });
        });

        if (window.ScrollTrigger) {
            ScrollTrigger.create({
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                onEnter: () => tweens.forEach(t => t.resume()),
                onEnterBack: () => tweens.forEach(t => t.resume()),
                onLeave: () => tweens.forEach(t => t.pause()),
                onLeaveBack: () => tweens.forEach(t => t.pause())
            });
        }

        let resizeTO;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTO);
            resizeTO = setTimeout(() => {
                tweens.forEach(t => {
                    const el = t.targets()[0];
                    const ndx = gsap.utils.random(-6, 6);
                    const ndy = gsap.utils.random(-8, 8);
                    const nrot = gsap.utils.random(-1, 1);
                    gsap.to(el, { x: `+=${ndx}`, y: `+=${ndy}`, rotation: `+=${nrot}`, duration: 1.2, ease: 'sine.inOut' });
                });
            }, 200);
        }, { passive: true });
    })();


    // service-hero: чуть заметнее "плавание" картинки
    (() => {
        if (!window.gsap) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const section = document.querySelector('.service-hero');
        const img = section?.querySelector('.service-hero__img');
        if (!img) return;

        gsap.set(img, { willChange: 'transform', force3D: true });

        const tween = gsap.to(img, {
            x: '+=18',
            y: '+=26',
            rotation: '+=2.2',
            scale: 1.02,
            ease: 'sine.inOut',
            duration: 4.2,
            yoyo: true,
            repeat: -1,
            overwrite: false
        });

        if (window.ScrollTrigger) {
            ScrollTrigger.create({
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                onEnter: () => tween.resume(),
                onEnterBack: () => tween.resume(),
                onLeave: () => tween.pause(),
                onLeaveBack: () => tween.pause()
            });
        }
    })();


    // Анимация заполнения текста при скролле
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;

        const title = document.querySelector('.service-stages__title');
        if (!title || title.dataset.lettersWrapped) return;

        const textNodes = [];
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const raw = node.nodeValue;
            const parts = raw.split(/(\s+)/);

            const frag = document.createDocumentFragment();
            parts.forEach(part => {
                if (part.trim() === '') {
                    frag.appendChild(document.createTextNode(part));
                } else {
                    const w = document.createElement('span');
                    w.className = 'ms-word';
                    for (const ch of part) {
                        const s = document.createElement('span');
                        s.className = 'ms-letter';
                        s.textContent = ch;
                        w.appendChild(s);
                    }
                    frag.appendChild(w);
                }
            });

            node.parentNode.replaceChild(frag, node);
        });

        title.dataset.lettersWrapped = 'true';

        const letters = title.querySelectorAll('.ms-letter');

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: title,
                start: 'top 80%',
                end: 'bottom 20%',
                scrub: true,
                invalidateOnRefresh: true
            }
        });

        letters.forEach((el, i) => {
            tl.to(el, { color: '#ffffff', duration: 0.15, ease: 'none' }, i * 0.02);
        });

    })();


    // === SERVICE-LAUNCH: поочерёдный выезд снизу (только десктоп ≥769px) ===
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;

        const { gsap, ScrollTrigger } = window;
        const section = document.querySelector('.service-launch');
        if (!section) return;

        const mm = gsap.matchMedia();

        mm.add('(max-width: 768px)', () => {
            const items = section.querySelectorAll('.service-launch__item');
            gsap.set(items, { opacity: 1, y: 0, clearProps: 'all' });
        });

        mm.add('(min-width: 769px)', () => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const items = Array.from(section.querySelectorAll('.service-launch__item'));
            if (!items.length) return;

            if (reduce) {
                gsap.set(items, { opacity: 1, y: 0, clearProps: 'all' });
                return;
            }

            gsap.set(items, { y: 80, opacity: 0, willChange: 'transform,opacity' });

            const tl = gsap.timeline({ paused: true });
            tl.to(items, {
                y: 0,
                opacity: 1,
                duration: 0.85,
                ease: 'power2.out',
                stagger: 0.16,
                onComplete: () => gsap.set(items, { clearProps: 'transform,opacity,willChange' })
            });

            const st = ScrollTrigger.create({
                trigger: section,
                start: 'top 75%',
                once: true,
                onEnter: () => tl.play()
            });

            return () => {
                st.kill();
                tl.kill();
                gsap.set(items, { clearProps: 'all' });
            };
        });
    })();



    (() => {
        const section = document.querySelector('.service-marquee');
        const track = section?.querySelector('.service-marquee__line');
        if (!track) return;

        const originals = Array.from(track.children);
        if (!originals.length) return;

        const getGap = () => {
            const cs = getComputedStyle(track);
            const g1 = parseFloat(cs.gap) || 0;
            const g2 = parseFloat(cs.columnGap) || 0;
            return Math.max(g1, g2);
        };

        const makeSegment = () => originals.map(n => n.cloneNode(true));

        let tween;
        const rebuild = () => {
            track.innerHTML = '';
            const segA = makeSegment();
            segA.forEach(n => track.appendChild(n));

            const gap = getGap();
            const segAWidth =
                segA.reduce((sum, el) => sum + el.offsetWidth, 0) + gap * Math.max(0, segA.length - 1);

            const segB = segA.map(n => n.cloneNode(true));
            segB.forEach(n => track.appendChild(n));

            if (tween) tween.kill();
            const pxPerSec = 60;
            tween = gsap.to(track, {
                x: -segAWidth,
                duration: segAWidth / pxPerSec,
                ease: 'none',
                repeat: -1,
                modifiers: {
                    x: gsap.utils.unitize(gsap.utils.wrap(-segAWidth, 0))
                }
            });
        };

        rebuild();

        let to;
        window.addEventListener('resize', () => {
            clearTimeout(to);
            to = setTimeout(rebuild, 150);
        }, { passive: true });
    })();

    // === ABOUT-HERO: дрейф всегда, пульс — случайными всплесками ===
    (() => {
        if (!window.gsap) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const section = document.querySelector('.about-hero');
        if (!section) return;

        const items = Array.from(section.querySelectorAll('.about-hero__item'));
        if (!items.length) return;

        gsap.set(items, {
            willChange: 'transform',
            force3D: true,
            transformOrigin: '50% 50%',
            scale: 1
        });

        const driftTweens = items.map((el) => {
            const dx = gsap.utils.random(-14, 14);
            const dy = gsap.utils.random(-18, 18);
            const rot = gsap.utils.random(-2, 2);
            const dur = gsap.utils.random(2.6, 4.2);
            const dly = gsap.utils.random(0, 0.7);

            return gsap.to(el, {
                x: `+=${dx}`,
                y: `+=${dy}`,
                rotation: `+=${rot}`,
                duration: dur,
                delay: dly,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                overwrite: false
            });
        });

        function schedulePulse(el) {
            const wait = gsap.utils.random(3.0, 7.0);
            gsap.delayedCall(wait, () => {
                const shouldPulse = Math.random() < 0.35;
                if (!shouldPulse || el.__isPulsing) {
                    schedulePulse(el);
                    return;
                }

                el.__isPulsing = true;

                gsap.to(el, {
                    scale: gsap.utils.random(1.008, 1.024),
                    duration: gsap.utils.random(0.35, 0.5),
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => {
                        el.__isPulsing = false;
                        schedulePulse(el);
                    }
                });
            });
        }

        items.forEach(schedulePulse);

        if (window.ScrollTrigger) {
            ScrollTrigger.create({
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                onEnter: () => { driftTweens.forEach(t => t.resume()); },
                onEnterBack: () => { driftTweens.forEach(t => t.resume()); },
                onLeave: () => { driftTweens.forEach(t => t.pause()); },
                onLeaveBack: () => { driftTweens.forEach(t => t.pause()); }
            });
        }
    })();



});