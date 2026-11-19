// Motion for both pages. One idea carries it: the air over the city.
// Landing: the smog clears as you read (sky scrub, particles, inversion diagram).
// Planner: motion answers what you do (rows ease in, sections slide open, results rise in),
// and the sky settles to match the real AQI category of your plan.
// With prefers-reduced-motion nothing here runs: the sky is still and scrolling is native.
// No ScrollTrigger pinning: it writes style attributes, which the CSP blocks.
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { gsap, ScrollTrigger, Lenis } = window;
  const topbar = document.querySelector(".topbar");
  const offset = () => -((topbar?.offsetHeight || 0) + 12);
  let lenis = null;
  let tick = null;
  let drawParticles = null;
  const air = { density: 0 };

  // In-page links move focus as well as scroll. Modified clicks are left to the browser.
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
        lenis.scrollTo(target, { offset: offset() });
        target.focus({ preventScroll: true });
      } else {
        target.focus();
        target.scrollIntoView({ block: "start" });
      }
    });
  });

  if (reduced.matches || !gsap || !ScrollTrigger || !Lenis) {
    root.classList.add("sky-is-clear");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  // ------------------------------------------------------------ shared: headline reveal
  // Words rise into place once. The heading keeps its full text as its accessible name.
  document.querySelectorAll(".reveal-words").forEach((h) => {
    const text = h.textContent.trim();
    const words = text.split(/\s+/);
    h.setAttribute("aria-label", text);
    h.replaceChildren(...words.flatMap((word, i) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      inner.textContent = word;
      outer.append(inner);
      return i < words.length - 1 ? [outer, document.createTextNode(" ")] : [outer];
    }));
    gsap.from(h.querySelectorAll(".word > span"), { yPercent: 110, duration: 0.9, ease: "power3.out", stagger: 0.045, delay: 0.1 });
  });

  // ------------------------------------------------------------ shared: particles
  // Drifting specks of "PM2.5"; their density follows air.density (0 clear, 1 thick smog).
  const canvas = document.querySelector(".particles");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const specks = [];
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    drawParticles = () => {
      ctx.clearRect(0, 0, w, h);
      if (air.density < 0.02) return;
      ctx.fillStyle = "rgb(232, 214, 186)";
      specks.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4;
        if (s.y > h + 4) s.y = -4;
        ctx.globalAlpha = s.a * air.density;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(drawParticles);
  }

  // ------------------------------------------------------------ landing
  if (document.querySelector(".hero")) {
    air.density = 1;
    gsap.from(".hero-lede, .hero-actions, .hero-note", { opacity: 0, y: 16, duration: 0.7, ease: "power2.out", stagger: 0.08, delay: 0.45 });

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
      .to(air, { density: 0 }, 0);

    // The cue goes as soon as scrolling starts; autoAlpha hides it fully at zero, so a
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
  }

  // ------------------------------------------------------------ planner
  const form = document.getElementById("plan-form");
  const results = document.getElementById("results");
  if (form && results) {
    // Entrance: the panel glides up. Transform only (no fading), so text is never shown at
    // reduced contrast while it moves.
    gsap.from(".planner > .glass", { y: 36, duration: 0.9, ease: "power3.out" });

    // New household or plan rows ease open; removals stay instant so focus moves at once.
    const grow = (node) => gsap.from(node, { height: 0, y: -10, paddingTop: 0, paddingBottom: 0, overflow: "hidden", duration: 0.45, ease: "power2.out", clearProps: "height,transform,paddingTop,paddingBottom,overflow", overwrite: true });
    ["members", "activities"].forEach((id) => {
      const list = document.getElementById(id);
      let ready = false;
      new MutationObserver((changes) => {
        if (!ready) return;
        changes.forEach((c) => c.addedNodes.forEach((n) => n.nodeType === 1 && grow(n)));
      }).observe(list, { childList: true });
      // Rows restored on page load appear with the panel, not one by one.
      requestAnimationFrame(() => { ready = true; });
    });

    // Optional sections slide open.
    form.querySelectorAll("details.section").forEach((d) => {
      d.addEventListener("toggle", () => {
        if (!d.open) return;
        const body = d.querySelector(".grid");
        if (body) gsap.from(body, { height: 0, y: -8, overflow: "hidden", duration: 0.4, ease: "power2.out", clearProps: "height,transform,overflow" });
      });
    });

    // The sky follows the real AQI category of the plan: clear for Good, smog for Unhealthy+.
    const HAZE = [
      { max: 50, level: 0 }, { max: 100, level: 0.25 }, { max: 150, level: 0.5 },
      { max: 200, level: 0.75 }, { max: Infinity, level: 1 },
    ];
    const settleSky = (aqi) => {
      const level = HAZE.find((b) => aqi <= b.max).level;
      gsap.to(".sky-clear", { opacity: 1 - level * 0.85, duration: 2.4, ease: "power2.inOut" });
      gsap.to(".haze-1", { opacity: level * 0.85, duration: 2.4, ease: "power2.inOut" });
      gsap.to(".haze-2", { opacity: level * 0.8, duration: 2.6, ease: "power2.inOut" });
      gsap.to(".haze-3", { opacity: 0.15 + level * 0.55, duration: 2.8, ease: "power2.inOut" });
      gsap.to(".sun", { opacity: 1 - level * 0.6, duration: 2.4, ease: "power2.inOut" });
      gsap.to(air, { density: level, duration: 2.4, ease: "power2.inOut" });
    };

    // Results: glide down to them, then the cards rise in turn and the forecast bars grow.
    // data-animating marks the short entrance so tests can wait for it to settle.
    document.addEventListener("aether:results", (event) => {
      // The results just grew the page; Lenis must re-measure before scrolling past the old end.
      lenis.resize();
      ScrollTrigger.refresh();
      lenis.scrollTo(results, { offset: offset(), duration: 1.1 });
      results.dataset.animating = "true";
      gsap.timeline({ onComplete: () => delete results.dataset.animating })
        .from(results.children, { y: 28, duration: 0.65, ease: "power3.out", stagger: 0.08, clearProps: "transform" }, 0.15)
        .from(results.querySelectorAll(".chart .bar"), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.6, ease: "power2.out", stagger: 0.015 }, 0.5);
      if (typeof event.detail?.aqi === "number") settleSky(event.detail.aqi);
    });
  }

  // ------------------------------------------------------------ reduced motion mid-visit
  reduced.addEventListener("change", (event) => {
    if (!event.matches) return;
    ScrollTrigger.getAll().forEach((t) => {
      t.animation?.progress(1);
      t.kill();
    });
    gsap.globalTimeline.getChildren().forEach((a) => a.progress(1));
    gsap.ticker.remove(tick);
    if (drawParticles) gsap.ticker.remove(drawParticles);
    canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    lenis.destroy();
    lenis = null;
    document.querySelectorAll(".phase").forEach((p) => p.classList.add("is-active"));
    root.classList.add("sky-is-clear");
  });
})();
