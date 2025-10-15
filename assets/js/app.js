document.addEventListener("DOMContentLoaded", (event) => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    const lenis = new Lenis({
        smooth: true,
        lerp: 0.08,
        wheelMultiplier: 1,
        gestureTarget: window
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);



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


});