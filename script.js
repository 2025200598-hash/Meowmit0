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

/* ---------- Page 3 + 4: Menu carousel & Ingredients ---------- */

// Gambar dummy (SVG). Bila ada gambar sebenar, isi `img: "assets/xxx.png"`.
// Icon bahan: guna emoji dulu, atau letak `img` dalam array bahan.
const DRINKS = [
  { name: "Sky Whisker", mix: "Blue curacao syrup, sparkling water, lime", img src: "IMG/SKYWHISKERS.png",
    c1: "#aee6ff", c2: "#2f6fe0",
    ings: [{ icon: "🍋", label: "Lime" }, { icon: "🥤", label: "Sparkling" }, { icon: "🧊", label: "Ice" }] },
  { name: "Berry Bliss", mix: "Mixed berries syrup, sparkling water, lychee soda", img: "IMG/BERRYBLISS.png",
    c1: "#f9b9cd", c2: "#3a0f3a",
    ings: [{ icon: "🫐", label: "Mixed Berries" }, { icon: "🥤", label: "Lychee Soda" }, { icon: "🧊", label: "Ice" }] },
  { name: "Frostbite", mix: "Fresh mint, lime, sparkling water", img: "IMG/FROSTBITES.png",
    c1: "#e3fbd4", c2: "#6cc24a",
    ings: [{ icon: "🌿", label: "Mint" }, { icon: "🍋", label: "Lime" }, { icon: "🧊", label: "Ice" }] }
];

function dummyCup(c1, c2) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
    '<rect x="116" y="0" width="9" height="90" rx="4" fill="#fff" opacity=".9" transform="rotate(12 120 40)"/>' +
    '<path d="M28 62 L172 62 L156 300 Q100 316 44 300Z" fill="#fff" opacity=".35" stroke="#fff" stroke-width="3"/>' +
    '<path d="M36 110 L164 110 L154 296 Q100 310 46 296Z" fill="url(#g)"/>' +
    '<rect x="62" y="124" width="34" height="34" rx="7" fill="#fff" opacity=".45" transform="rotate(-12 79 141)"/>' +
    '<rect x="104" y="150" width="30" height="30" rx="7" fill="#fff" opacity=".4" transform="rotate(14 119 165)"/>' +
    '<rect x="20" y="48" width="160" height="20" rx="10" fill="#fff" opacity=".8"/></svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
const drinkImg = (d) => d.img || dummyCup(d.c1, d.c2);

function initMenu() {
  const wrap = document.getElementById("menuCards");
  const cup = document.getElementById("ingCup");
  const itemsWrap = document.getElementById("ingItems");
  if (!wrap || !cup || !itemsWrap) return;

  const n = DRINKS.length;
  let index = 1; // mula dengan Berry Bliss di tengah

  const cards = DRINKS.map((d, i) => {
    const card = document.createElement("article");
    card.className = "menu-card";
    card.innerHTML = '<img alt="" draggable="false"><h3></h3><small></small>';
    const img = card.querySelector("img");
    img.src = drinkImg(d);
    img.onerror = () => { img.onerror = null; img.src = dummyCup(d.c1, d.c2); };
    card.querySelector("h3").textContent = d.name;
    card.querySelector("small").textContent = "[ " + d.mix + " ]";
    card.addEventListener("click", () => { if (i !== index) goTo(i); });
    wrap.appendChild(card);
    return card;
  });

  function layout() {
    cards.forEach((card, i) => {
      const d = (i - index + n) % n;
      card.classList.toggle("is-active", d === 0);
      card.classList.toggle("is-next", d === 1);
      card.classList.toggle("is-prev", d === n - 1 && n > 2 || (n === 2 && d === 1));
      card.setAttribute("aria-hidden", String(d !== 0));
    });
  }

  let swapTimer;
  function renderIngredients(first) {
    const d = DRINKS[index];
    const build = () => {
      cup.src = drinkImg(d);
      cup.alt = d.name;
      cup.onerror = () => { cup.onerror = null; cup.src = dummyCup(d.c1, d.c2); };
      itemsWrap.innerHTML = "";
      d.ings.slice(0, 3).forEach((ing, k) => {
        const el = document.createElement("div");
        el.className = "ing-item slot-" + (k + 1);
        const icon = ing.img ? '<img src="' + ing.img + '" alt="">' : ing.icon;
        el.innerHTML = '<span class="ing-icon">' + icon + '<em></em></span><span class="ing-line"></span>';
        el.querySelector("em").textContent = ing.label;
        el.style.animationDelay = k * 120 + "ms";
        itemsWrap.appendChild(el);
      });
      cup.classList.remove("is-out");
    };
    if (first) return build();
    clearTimeout(swapTimer);
    cup.classList.add("is-out");
    itemsWrap.querySelectorAll(".ing-item").forEach((el) => el.classList.add("is-out"));
    swapTimer = setTimeout(build, 280);
  }

  function goTo(i) {
    index = (i + n) % n;
    layout();
    renderIngredients(false);
  }

  document.querySelector(".menu-arrow--prev").addEventListener("click", () => goTo(index - 1));
  document.querySelector(".menu-arrow--next").addEventListener("click", () => goTo(index + 1));

  // Swipe pada telefon
  let sx = null;
  wrap.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  wrap.addEventListener("pointerup", (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (dx < -40) goTo(index + 1); else if (dx > 40) goTo(index - 1);
  });
  wrap.style.touchAction = "pan-y";

  layout();
  renderIngredients(true);
}

/* ---------- Page 5: About (reveal bila scroll) ---------- */

function initAbout() {
  const img = document.getElementById("aboutImg");
  if (img) { // gambar dummy; tukar src kepada gambar sebenar nanti
    const d = DRINKS[1];
    img.src = "assets/about.jpg";
    img.onerror = () => { img.onerror = null; img.src = dummyCup("#a5b8ff", "#6a2fc0"); img.style.objectFit = "contain"; };
  }
  const els = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-visible")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
  }, { threshold: 0.25 });
  els.forEach((e) => io.observe(e));
}

initMenu();
initAbout();