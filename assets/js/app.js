document.addEventListener("DOMContentLoaded", (event) => {
    gsap.registerPlugin(ScrollTrigger);

    // 1) Lenis
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

    // 2) Сообщаем ST о скролле Lenis
    lenis.on('scroll', ScrollTrigger.update);

    // 3) Прокси для виртуального скролла
    ScrollTrigger.scrollerProxy(document.documentElement, {
        scrollTop(value) {
            if (arguments.length) {
                // мгновенно прокрутить к value (без инерции)
                lenis.scrollTo(value, { immediate: true });
            }
            return lenis.scroll;
        },
        getBoundingClientRect() {
            return { top: 0, left: 0, width: innerWidth, height: innerHeight };
        },
        pinType: document.documentElement.style.transform ? 'transform' : 'fixed'
    });

    // 4) Рефреш без lenis.update()
    ScrollTrigger.addEventListener('refresh', () => {
        // на всякий, синхронизируем кадр Lenis
        requestAnimationFrame(() => lenis.raf(performance.now()));
    });

    ScrollTrigger.refresh();



    (() => {
        const header = document.querySelector('header');
        if (!header) return;

        const THRESHOLD = 100;
        const apply = (y) => header.classList.toggle('scroll', y > THRESHOLD);

        // ✅ опираемся на локальный lenis
        if (lenis && typeof lenis.on === 'function') {
            apply(lenis.scroll || window.scrollY || 0);
            lenis.on('scroll', ({ scroll }) => apply(scroll));
        } else {
            const update = () => apply(window.scrollY || 0);
            window.addEventListener('scroll', update, { passive: true });
            update();
        }
    })();



    const container = document.querySelector('.hero__paralax');
    if (!container) return;

    const shapes = Array.from(container.querySelectorAll('.shape'));
    if (!shapes.length) return;

    // ждём, пока картинки готовы (decode быстрее onload)
    const waitImages = () =>
        Promise.all(
            shapes.map(img =>
                img.complete
                    ? Promise.resolve()
                    : (img.decode?.().catch(() => { }) || new Promise(res => (img.onload = img.onerror = res)))
            )
        );

    // небольшая оптимизация отрисовки
    gsap.set(shapes, { willChange: 'transform', transform: 'translateZ(0)', pointerEvents: 'none' });

    let landed = false;

    // ==== "Дыхание": усиленная амплитуда ====
    // ampY — амплитуда по вертикали (в %, безопасно для параллакса по y в px)
    // rot  — амплитуда покачивания (в градусах)
    // scaleAmp — пульсация масштаба (0.03 = ±3%)
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
    // ========================

    (async function init() {
        await waitImages();

        // Анимация "падения" к своим местам (from => к текущему top/left)
        gsap.from(shapes, {
            y: () => -window.innerHeight * gsap.utils.random(0.4, 1.2),
            x: () => gsap.utils.random(-160, 160),
            rotation: () => gsap.utils.random(-220, 220),
            scale: () => gsap.utils.random(0.85, 1.15),
            opacity: 0,

            // было 0.9–1.7 → стало немного медленнее
            duration: () => gsap.utils.random(1.1, 1.9),

            delay: () => gsap.utils.random(0, 0.35),
            ease: 'back.out(1.7)',
            stagger: { each: 0.03, from: 'random' },
            onComplete: () => {
                landed = true;
                enableIdleBreath(shapes, { ampY: 10, rot: 6, scaleAmp: 0.035 });
            }
        });


        // Параллакс на курсор — плавно и без дёрганий
        const controllers = shapes.map(el => ({
            mult: parseFloat(el.dataset.animation || '1'),
            toX: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power2.out' }),
            toY: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power2.out' })
        }));

        // одна функция на все указатели
        const onPointerMove = (e) => {
            if (!landed) return;

            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const dx = (e.clientX - cx);
            const dy = (e.clientY - cy);

            const strength = 0.04; // ~4% от расстояния до центра

            controllers.forEach(({ mult, toX, toY }) => {
                toX(dx * strength * mult);
                toY(dy * strength * mult);
            });
        };

        // поддержка мыши/тача/пера
        window.addEventListener('pointermove', onPointerMove, { passive: true });

        // reduce-motion — отключаем движение
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.removeEventListener('pointermove', onPointerMove);
            gsap.killTweensOf(shapes);
            gsap.set(shapes, { clearProps: 'all' });
        }
    })();




    const topSlider = document.querySelector('.hero__line');
    const originalImages = Array.from(topSlider.querySelectorAll('img'));

    if (originalImages.length === 0) return;

    // Создаем контейнер для трека
    const carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';
    topSlider.innerHTML = '';
    topSlider.appendChild(carouselTrack);

    // Минимальное количество элементов для плавной анимации
    const minItems = 12; // Увеличиваем для большей плавности
    let allItems = [];

    // Повторяем изображения если их мало
    if (originalImages.length < minItems) {
        while (allItems.length < minItems) {
            originalImages.forEach(img => {
                if (allItems.length < minItems) {
                    const clone = img.cloneNode(true);
                    allItems.push(clone);
                }
            });
        }
    } else {
        allItems = originalImages.map(img => img.cloneNode(true));
    }

    // Добавляем элементы в трек (дважды для бесшовности)
    allItems.forEach(img => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.appendChild(img);
        carouselTrack.appendChild(item);
    });

    // Дублируем элементы для бесшовного перехода
    allItems.forEach(img => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.appendChild(img.cloneNode(true));
        carouselTrack.appendChild(item);
    });

    // Настраиваем анимацию
    const items = carouselTrack.querySelectorAll('.carousel-item');
    const itemWidth = items[0].offsetWidth + 30;
    const segmentWidth = itemWidth * allItems.length; // Ширина одного сегмента (оригинальные элементы)
    const totalWidth = segmentWidth * 2; // Общая ширина (оригинал + клон)

    // Скорость анимации (пикселей в секунду)
    const pixelsPerSecond = 50; // Настройте под нужную скорость

    // Анимация с использованием модулятора для бесшовного цикла
    gsap.to(carouselTrack, {
        x: -segmentWidth, // Двигаем на ширину одного сегмента
        duration: segmentWidth / pixelsPerSecond,
        ease: "none",
        repeat: -1,
        modifiers: {
            x: gsap.utils.unitize(gsap.utils.wrap(-segmentWidth, 0))
        }
    });


    const result_section__swiper = new Swiper('.result-section__swiper', {
        slidesPerView: 3,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        navigation: {
            nextEl: '.result-section__swiper__next',
            prevEl: '.result-section__swiper__prev',
        },

    });

    const cases_ection__swiper = new Swiper('.cases-section__swiper', {
        slidesPerView: 3,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        navigation: {
            nextEl: '.cases-section__swiper__next',
            prevEl: '.cases-section__swiper__prev',
        },

    });

    const reviews_section__swiper = new Swiper('.reviews-section__swiper', {
        slidesPerView: 3,
        loop: false,
        spaceBetween: 16,
        speed: 700,
        autoHeight: true,
        navigation: {
            nextEl: '.reviews-section__swiper__next',
            prevEl: '.reviews-section__swiper__prev',
        },

    });




    document.querySelectorAll(".feedback-section__form-drop, .feedbackv2-section__form-drop").forEach(dropdown => {
        const btn = dropdown.querySelector(".dropdown-btn");
        const content = dropdown.querySelector(".dropdown__content");
        if (!btn || !content) return;

        const open = () => {
            btn.classList.add("active");
            // ставим точную высоту контента, чтобы анимировалось
            content.style.maxHeight = content.scrollHeight + "px";
            // после анимации фиксируем auto — чтобы корректно реагировать на брейкпоинты
            const onEnd = (e) => {
                if (e.propertyName === "max-height") {
                    content.style.maxHeight = "none";
                    content.removeEventListener("transitionend", onEnd);
                }
            };
            content.addEventListener("transitionend", onEnd);
        };

        const close = () => {
            // из auto → px → 0, чтобы была плавная анимация закрытия
            if (getComputedStyle(content).maxHeight === "none") {
                content.style.maxHeight = content.scrollHeight + "px";
                content.offsetHeight; // reflow
            }
            btn.classList.remove("active");
            content.style.maxHeight = "0px";
        };

        btn.addEventListener("click", () => {
            btn.classList.contains("active") ? close() : open();
        });

        // изменение радио: подставить текст из label и закрыть
        content.addEventListener("change", (e) => {
            const input = e.target.closest(".radio-input");
            if (!input) return;
            const label = content.querySelector(`label[for="${input.id}"]`);
            if (label) btn.textContent = label.textContent.trim();
            close();
        });

        // на случай клика именно по лейблу (без события change)
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
                yPercent: `+=${gsap.utils.random(16, 24)}`,   // вертикальное «дыхание»
                xPercent: `+=${gsap.utils.random(-4, 4)}`,    // лёгкий дрейф по X
                scale: gsap.utils.random(0.985, 1.03),        // мягкая пульсация
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
        const goalSection = document.querySelector('.goal-section');
        if (!goalSection) return;

        // разные “скорости” для слоёв (множитель смещения)
        const goalLayers = [
            { sel: '.goal-section__img-1', speed: 0.7 },
            { sel: '.goal-section__img-2', speed: 1.2 },
            { sel: '.goal-section__img-3', speed: 0.5 },
            { sel: '.goal-section__img-4', speed: 1.0 },
        ];

        // базовая амплитуда (px)
        const goalBaseDist = 260;

        goalLayers.forEach(({ sel, speed }) => {
            const el = goalSection.querySelector(sel);
            if (!el) return;

            const dist = goalBaseDist * speed;

            gsap.set(el, { willChange: 'transform', force3D: true });

            gsap.fromTo(
                el,
                { y: -dist / 2 },
                {
                    y: dist / 2,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: goalSection,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 0.6,
                        invalidateOnRefresh: true
                    }
                }
            );
        });
    })();

    // === PARTNERSHIP: лёгкое «дыхание» карточек (чуть больше амплитуда) ===
    (() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const partnerSection = document.querySelector('.partnership-section');
        if (!partnerSection) return;

        const partnerCards = Array.from(
            partnerSection.querySelectorAll('.partnership-section__item')
        );
        if (!partnerCards.length) return;

        gsap.set(partnerCards, { willChange: 'transform', force3D: true });

        const partnerTweens = partnerCards.map(el => {
            const dx = gsap.utils.random(-8, 8);      // было -6..6 → немного больше
            const dy = gsap.utils.random(-10, 10);    // było -8..8 → немного больше
            const drot = gsap.utils.random(-0.75, 0.75); // было -0.6..0.6
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

        ScrollTrigger.create({
            trigger: partnerSection,
            start: 'top bottom',
            end: 'bottom top',
            onEnter: () => partnerTweens.forEach(t => t.resume()),
            onEnterBack: () => partnerTweens.forEach(t => t.resume()),
            onLeave: () => partnerTweens.forEach(t => t.pause()),
            onLeaveBack: () => partnerTweens.forEach(t => t.pause())
        });
    })();

    // // === USLUGI: sticky через GSAP (top: 100px), корректно и при загрузке "ниже" ===
    // (() => {
    //     if (!window.gsap || !window.ScrollTrigger) return;

    //     const section = document.querySelector('.uslugi-section');
    //     const wrap = section?.querySelector('.uslugi-section__wrap');
    //     const leftContent = section?.querySelector('.uslugi-section__left__content');
    //     if (!section || !wrap || !leftContent) return;

    //     const TOP_OFFSET = 100; // как у sticky: top: 100px

    //     // ждём картинки, чтобы размеры были точные
    //     const waitImages = (root) =>
    //         Promise.all(
    //             [...root.querySelectorAll('img')].map(img =>
    //                 img.complete
    //                     ? Promise.resolve()
    //                     : (img.decode?.().catch(() => { }) || new Promise(res => (img.onload = img.onerror = res)))
    //             )
    //         );

    //     const docTop = el => el.getBoundingClientRect().top + window.scrollY;

    //     const getStart = () => docTop(leftContent) - TOP_OFFSET;

    //     // отлип, когда НИЗ leftContent совпал с НИЗОМ wrap:
    //     // scrollY + TOP_OFFSET + Hc = wrapTop + wrapH
    //     // => scrollY = wrapTop + wrapH - Hc - TOP_OFFSET
    //     const getEnd = () =>
    //         docTop(wrap) + wrap.offsetHeight - leftContent.offsetHeight - TOP_OFFSET;

    //     let st;

    //     const build = () => {
    //         if (st) st.kill();

    //         st = ScrollTrigger.create({
    //             start: getStart,
    //             end: getEnd,
    //             pin: leftContent,
    //             pinReparent: true,
    //             invalidateOnRefresh: true,
    //         });

    //         // На случай, если пришли на страницу уже «ниже»
    //         ScrollTrigger.refresh();
    //         st.update();
    //     };

    //     Promise.all([waitImages(wrap), waitImages(leftContent)]).then(() => {
    //         build();
    //         // пересчёт при ресайзе/шрифты/ленивая загрузка
    //         ScrollTrigger.addEventListener('refreshInit', () => st && st.refresh());
    //         window.addEventListener('resize', () => ScrollTrigger.refresh(), { passive: true });
    //     });

    //     // ещё один refresh, когда всё (включая шрифты) загрузилось
    //     window.addEventListener('load', () => {
    //         ScrollTrigger.refresh();
    //         st && st.update();
    //     });
    // })();


    // === USLUGI: ползунок справа + пин левого контента до касания низа ===
    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const section = document.querySelector('.uslugi-section');
        const wrap = section?.querySelector('.uslugi-section__wrap');
        const rightWrap = section?.querySelector('.uslugi-section__right__content');
        const leftCol = section?.querySelector('.uslugi-section__left');
        const leftContent = section?.querySelector('.uslugi-section__left__content');
        if (!wrap || !rightWrap || !leftCol || !leftContent) return;

        // помогаем layout-у: фикс ширины левой колонки, чтобы не прыгала при pinSpacing:false
        gsap.set(leftCol, { width: leftCol.getBoundingClientRect().width });

        // ждем картинки внутри колонок для корректных размеров
        const waitImages = (root) =>
            Promise.all([...root.querySelectorAll('img')].map(img =>
                img.complete ? Promise.resolve()
                    : (img.decode?.().catch(() => { }) || new Promise(res => (img.onload = img.onerror = res)))
            ));

        // ---------- 1) Прогресс-ползунок справа ----------
        let maxY = 0, thumbH = 0;
        const recalcThumb = () => {
            const trackH = rightWrap.clientHeight;
            const after = getComputedStyle(rightWrap, '::after');
            thumbH = parseFloat(after.height) || 0;
            maxY = Math.max(0, trackH - thumbH);
        };

        // ---------- 2) Пин левого контента до касания низа ----------
        // сколько пикселей можем «везти» pinned-контент, пока низ контента не коснется низа левой колонки
        const calcPinDistance = () => {
            // всё в «внутренних» координатах колонки
            const travel = leftCol.clientHeight - (leftContent.offsetTop + leftContent.offsetHeight);
            return Math.max(0, travel); // если контент выше — пинить некуда
        };

        const init = () => {
            // ползунок
            recalcThumb();
            const thumbST = ScrollTrigger.create({
                trigger: wrap,
                start: 'top top+=150',       // старт в 100px от верха
                end: 'bottom bottom-=70',  // финиш в 50px от низа
                scrub: 0.35,
                onUpdate: self => {
                    rightWrap.style.setProperty('--thumbY', (self.progress * maxY) + 'px');
                },
                onRefreshInit: recalcThumb,
                invalidateOnRefresh: true
            });

            // пин левого контента до касания низа
            gsap.set(leftContent, { willChange: 'transform', force3D: true });

            // ПИН ЛЕВОГО КОНТЕНТА — максимально плавно
            ScrollTrigger.create({
                trigger: wrap,
                start: 'top top+=100',                 // фиксируем, когда wrap на 100px ниже верха
                end: () => '+=' + calcPinDistance(), // отлип — ровно при касании низа left__content о низ .uslugi-section__left
                pin: leftContent,
                pinSpacing: true,                      // ← включаем прокладку (гладко)
                pinType: 'transform',                  // ← пин через transform (без рывков с Lenis)
                anticipatePin: 2,                      // ← сгладить момент старта
                invalidateOnRefresh: true
            });

            // пересчёты
            const onResize = () => {
                // обновим ширину колонки (флекс может менять)
                gsap.set(leftCol, { width: leftCol.getBoundingClientRect().width });

                recalcThumb();
                // подвинем ползунок в текущую позицию
                rightWrap.style.setProperty('--thumbY', (thumbST.progress || 0) * maxY + 'px');

                ScrollTrigger.refresh();
            };

            window.addEventListener('resize', onResize, { passive: true });
            ScrollTrigger.refresh();
        };

        Promise.all([waitImages(wrap), waitImages(rightWrap), waitImages(leftCol)]).then(init);
    })();





    (() => {
        if (!window.gsap || !window.ScrollTrigger) return;

        const title = document.querySelector('.method-section__title');
        if (!title || title.dataset.lettersWrapped) return;

        // 1) Разворачиваем в спаны, сохранив пробелы и переносы
        const textNodes = [];
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const raw = node.nodeValue;
            // Разбиваем на "слово | пробельный фрагмент", чтобы ничего не потерять
            const parts = raw.split(/(\s+)/);

            const frag = document.createDocumentFragment();
            parts.forEach(part => {
                if (part.trim() === '') {
                    // чистые пробелы/переносы — как есть
                    frag.appendChild(document.createTextNode(part));
                } else {
                    // слово → обернуть каждую букву
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

        // 2) Анимация по скроллу: «заливаем» буквы в белый с небольшим стэггером
        const letters = title.querySelectorAll('.ms-letter');

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: title,
                start: 'top 80%',     // когда заголовок почти вошёл
                end: 'bottom 20%',  // до почти выхода
                scrub: true,
                invalidateOnRefresh: true
                // markers: true
            }
        });

        // Плавный «поток»: каждая буква получает своё время старта
        letters.forEach((el, i) => {
            tl.to(el, { color: '#ffffff', duration: 0.15, ease: 'none' }, i * 0.02);
        });

    })();







    document.querySelectorAll('.video-section').forEach(wrap => {
        const video = wrap.querySelector('.video-section__video');
        const playButton = wrap.querySelector('.video-section__video-play');

        if (!video || !playButton) return;

        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.paused) {
                video.play();
                video.classList.add('pointer');
                playButton.classList.add('playing');
            } else {
                video.pause();
                video.classList.remove('pointer');
                playButton.classList.remove('playing');
            }
        });

        video.addEventListener('click', () => {
            if (!video.paused) {
                video.pause();
                video.classList.remove('pointer');
                playButton.classList.remove('playing');
            }
        });
    });


});