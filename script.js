

const CONFIG = {
  // Fail logo (letak dalam folder assets/)
  logoVideo: "assets/logo-animation.mp4", // pilihan utama
  logoGif: "assets/logo-animation.gif",   // kalau mp4 tiada
  logoStatic: "assets/logo.png",          // logo biasa (untuk slide / fallback)

  gifDurationMs: 2800,   // berapa lama GIF dimainkan sebelum pop
  minSplashMs: 2200,     // masa minimum splash bila guna logo statik / wordmark
  maxSplashMs: 7000,     // had keselamatan, splash tidak akan tersangkut
  popMs: 700,            // mesti sama dengan --pop dalam style.css
  fadeMs: 800,           // mesti sama dengan --fade dalam style.css
  autoplayMs: 5000       // selang tukar banner
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- Logo helpers ---------- */

function createWordmark() {
  const el = document.createElement("span");
  el.className = "wordmark";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Meow Mito Alert!");
  el.innerHTML =
    '<span class="wordmark__main">Meow</span>' +
    '<span class="wordmark__tag">Mito<br>Alert!</span>';
  return el;
}

// Letak wordmark dulu, tukar kepada logo.png bila fail wujud.
function mountStaticLogo(slot) {
  slot.replaceChildren(createWordmark());
  const img = new Image();
  img.className = "logo-img";
  img.alt = "Meow Mito Alert!";
  img.onload = () => slot.replaceChildren(img);
  img.src = CONFIG.logoStatic;
}

// Splash: cuba mp4, kemudian gif, kemudian wordmark.
// Promise selesai bila animasi logo habis dimainkan.
function mountSplashLogo(slot) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };

    const useWordmark = () => {
      slot.replaceChildren(createWordmark());
      wait(CONFIG.minSplashMs).then(finish);
    };

    const useGif = () => {
      const img = new Image();
      img.className = "logo-img";
      img.alt = "Meow Mito Alert!";
      img.onload = () => {
        slot.replaceChildren(img);
        wait(CONFIG.gifDurationMs).then(finish);
      };
      img.onerror = useWordmark;
      img.src = CONFIG.logoGif;
    };

    const video = document.createElement("video");
    video.className = "logo-video";
    video.src = CONFIG.logoVideo;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";
    video.setAttribute("aria-label", "Meow Mito Alert!");

    let videoStarted = false;
    video.addEventListener("loadeddata", () => {
      videoStarted = true;
      slot.replaceChildren(video);
      video.play().catch(() => finish());
    });
    video.addEventListener("ended", () => wait(250).then(finish));
    video.addEventListener("error", () => { if (!videoStarted) useGif(); });

    // Kalau video lambat/tak load dalam 2.5s, guna gif
    wait(2500).then(() => { if (!videoStarted && !settled) useGif(); });
  });
}

/* ---------- Splash sequence ---------- */

async function runSplash() {
  const splash = document.getElementById("splash");
  const slot = document.getElementById("splashLogo");
  const site = document.getElementById("site");

  const skipped = new Promise((resolve) => {
    splash.addEventListener("click", resolve, { once: true });
  });

  const logoDone = mountSplashLogo(slot);

  // tunggu: animasi logo habis / user tap / had masa
  await Promise.race([logoDone, skipped, wait(CONFIG.maxSplashMs)]);

  if (!prefersReducedMotion) {
    splash.classList.add("is-pop");        // 1) pop: zoom in melantun
    await wait(CONFIG.popMs * 0.75);
  }

  splash.classList.add("is-leaving");      // 2) zoom terus + fade out
  site.classList.add("is-in");             //    page 2 masuk
  await wait(prefersReducedMotion ? 250 : CONFIG.fadeMs);

  splash.remove();
  document.body.classList.remove("is-loading");
  window.scrollTo(0, 0);
  document.dispatchEvent(new Event("splash:done"));
}

/* ---------- Hero slider ---------- */

function initSlider() {
  const slider = document.getElementById("slider");
  if (!slider) return;

  const track = slider.querySelector(".slider-track");
  const slides = Array.from(slider.querySelectorAll(".slide"));
  const dotsWrap = slider.querySelector(".slider-dots");
  const prevBtn = slider.querySelector(".slider-btn--prev");
  const nextBtn = slider.querySelector(".slider-btn--next");
  const total = slides.length;

  let index = 0;
  let timer = null;
  let startX = 0;
  let dragX = 0;
  let dragging = false;

  const dots = slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", "Banner " + (i + 1));
    dot.addEventListener("click", () => { goTo(i); restartAutoplay(); });
    dotsWrap.appendChild(dot);
    return dot;
  });

  function render() {
    track.style.transform = "translateX(" + (-index * 100) + "%)";
    dots.forEach((dot, i) => dot.setAttribute("aria-selected", String(i === index)));
    slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== index)));
  }

  function goTo(i) {
    index = (i + total) % total;
    render();
  }

  function startAutoplay() {
    if (prefersReducedMotion || timer) return;
    timer = setInterval(() => goTo(index + 1), CONFIG.autoplayMs);
  }
  function stopAutoplay() { clearInterval(timer); timer = null; }
  function restartAutoplay() { stopAutoplay(); startAutoplay(); }

  prevBtn.addEventListener("click", () => { goTo(index - 1); restartAutoplay(); });
  nextBtn.addEventListener("click", () => { goTo(index + 1); restartAutoplay(); });

  // Swipe / drag
  slider.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    startX = e.clientX;
    dragX = 0;
    slider.classList.add("is-dragging");
    slider.setPointerCapture(e.pointerId);
    stopAutoplay();
  });

  slider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragX = e.clientX - startX;
    track.style.transform =
      "translateX(calc(" + (-index * 100) + "% + " + dragX + "px))";
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove("is-dragging");
    const threshold = Math.min(80, slider.offsetWidth * 0.15);
    if (dragX < -threshold) goTo(index + 1);
    else if (dragX > threshold) goTo(index - 1);
    else render();
    startAutoplay();
  };
  slider.addEventListener("pointerup", endDrag);
  slider.addEventListener("pointercancel", endDrag);

  // Papan kekunci
  slider.tabIndex = 0;
  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { goTo(index - 1); restartAutoplay(); }
    if (e.key === "ArrowRight") { goTo(index + 1); restartAutoplay(); }
  });

  // Jeda bila hover / tab disembunyikan
  slider.addEventListener("mouseenter", stopAutoplay);
  slider.addEventListener("mouseleave", startAutoplay);
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stopAutoplay() : startAutoplay();
  });

  render();
  // autoplay bermula selepas splash habis
  document.addEventListener("splash:done", startAutoplay, { once: true });
}

/* ---------- Start ---------- */

document.querySelectorAll(".logo-slot").forEach(mountStaticLogo);
initSlider();
runSplash();
