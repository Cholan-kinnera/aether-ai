// Landing motion. One idea carries it: the smog clears as you read.
// - a short headline reveal on load
// - PM2.5-like particles that thin out as the haze lifts (canvas)
// - the sky scrub (GSAP ScrollTrigger) and the winter-inversion diagram scrub
// - Lenis smooth scrolling
// With prefers-reduced-motion none of this runs: the sky is clear and scrolling is native.
// No ScrollTrigger pinning: it writes style attributes, which the CSP blocks; the diagram
// uses CSS position: sticky instead.
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { gsap, ScrollTrigger, Lenis } = window;
  const topbar = document.querySelector(".topbar");
  let lenis = null;
  let tick = null;
  let particles = null;

  // In-page links move focus as well as scroll, so keyboard and screen-reader users land
  // where they were sent. Modified clicks (new tab etc.) are left to the browser.
  document.querySelectorAll("a[data-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const hash = link.getAttribute("href");
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      if (window.location.hash !== hash) history.pushState(null, "", hash);
      if (lenis) {
        lenis.scrollTo(target, { offset: -((topbar?.offsetHeight || 0) + 12) });
        target.focus({ preventScroll: true });
      } else {
        target.focus();
        target.scrollIntoView({ block: "start" });
      }
    });
  });

  function stillSky() {
    root.classList.add("sky-is-clear");
  }

  if (reduced.matches || !gsap || !ScrollTrigger || !Lenis) {
    stillSky();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  // Headline reveal: words rise into place once. The h1 text itself is unchanged for
  // assistive technology; only presentational spans are added around each word.
  const h1 = document.querySelector(".reveal-words");
  if (h1) {
    const words = h1.textContent.trim().split(/\s+/);
    h1.setAttribute("aria-label", h1.textContent.trim());
    h1.replaceChildren(...words.flatMap((word, i) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      inner.textContent = word;
      outer.append(inner);
      return i < words.length - 1 ? [outer, document.createTextNode(" ")] : [outer];
    }));
    gsap.from(".reveal-words .word > span", { yPercent: 110, duration: 0.9, ease: "power3.out", stagger: 0.045, delay: 0.1 });
    gsap.from(".hero-lede, .hero-actions, .hero-note", { opacity: 0, y: 16, duration: 0.7, ease: "power2.out", stagger: 0.08, delay: 0.45 });
  }

  // Particles: drifting specks of "PM2.5". Their density follows the haze (state.density).
  const canvas = document.querySelector(".particles");
  const state = { density: 1 };
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const specks = [];
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const count = Math.round(Math.min(140, (w * h) / 9000));
    for (let i = 0; i < count; i++) {
      specks.push({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.9, vx: 0.08 + Math.random() * 0.25, vy: -0.05 + Math.random() * 0.1, a: 0.25 + Math.random() * 0.45 });
    }
    particles = () => {
      ctx.clearRect(0, 0, w, h);
      if (state.density < 0.02) return;
      ctx.fillStyle = "rgb(232, 214, 186)";
      specks.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4;
        if (s.y > h + 4) s.y = -4;
        ctx.globalAlpha = s.a * state.density;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(particles);
  }

  // The sky clears between the top of the page and "One plan for everyone at home".
  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".hero", start: "top top", endTrigger: "#features", end: "top 35%", scrub: 0.8 },
  })
    .to(".sky-clear", { opacity: 1 }, 0)
    .to(".haze-1", { opacity: 0, yPercent: -30 }, 0)
    .to(".haze-2", { opacity: 0, yPercent: -18 }, 0.1)
    .to(".haze-3", { opacity: 0.15, yPercent: -10 }, 0.2)
    .to(".sun", { opacity: 1, scale: 1.12, yPercent: -60 }, 0)
    .to(".city-far", { opacity: 0.55 }, 0)
    .to(".city-mid", { opacity: 0.8 }, 0)
    .to(state, { density: 0 }, 0);

  // The cue goes as soon as scrolling starts, and autoAlpha hides it fully at zero, so a
  // half-faded, low-contrast cue never lingers on screen.
  gsap.to(".scroll-cue", {
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "+=150", scrub: true },
  });

  // Winter inversion: the warm-air lid lifts and the smog spreads out as you scroll through.
  const phases = [...document.querySelectorAll(".phase")];
  const wide = window.matchMedia("(min-width: 48rem)").matches;
  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".winter",
      // Wide screens scroll through a tall sticky section; small screens just pass by it.
      start: wide ? "top top" : "top 75%",
      end: wide ? "bottom bottom" : "bottom 25%",
      scrub: 0.6,
      onUpdate: (self) => {
        const active = Math.min(phases.length - 1, Math.floor(self.progress * phases.length));
        phases.forEach((p, i) => p.classList.toggle("is-active", i === active));
      },
    },
  })
    .to(".inv-lid", { attr: { y1: 70, y2: 70 } }, 0)
    .to(".inv-label", { attr: { y: 62 } }, 0)
    .to(".inv-smog", { attr: { y: 70, height: 210 }, opacity: 0.35 }, 0)
    .to(".inv-sun", { attr: { cy: 70 } }, 0)
    .to(".inv-sky", { opacity: 1 }, 0);

  // Reduced motion switched on mid-visit: stop everything and fall back to native scrolling.
  reduced.addEventListener("change", (event) => {
    if (!event.matches) return;
    ScrollTrigger.getAll().forEach((t) => {
      t.animation?.progress(1);
      t.kill();
    });
    gsap.ticker.remove(tick);
    if (particles) gsap.ticker.remove(particles);
    lenis.destroy();
    lenis = null;
    phases.forEach((p) => p.classList.add("is-active"));
    stillSky();
  });
})();
