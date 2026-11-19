// Landing motion: one scroll-driven moment (the smog over the skyline clears as you read)
// plus Lenis smooth scrolling. Both are skipped for prefers-reduced-motion; the page then
// shows the clear sky and native scrolling. Nothing here is needed to use the planner.
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { gsap, ScrollTrigger, Lenis } = window;

  // In-page links move focus as well as scroll, so keyboard and screen-reader users land
  // where they were sent. The skip link keeps its native behaviour.
  function focusTarget(target) {
    target.focus({ preventScroll: true });
  }

  if (reduced.matches || !gsap || !ScrollTrigger || !Lenis) {
    root.classList.add("sky-is-clear");
    document.querySelectorAll("a[data-scroll]").forEach((link) => {
      link.addEventListener("click", () => {
        const target = document.querySelector(link.getAttribute("href"));
        if (target) setTimeout(() => focusTarget(target), 0);
      });
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const topbar = document.querySelector(".topbar");
  document.querySelectorAll("a[data-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", hash);
      lenis.scrollTo(target, {
        offset: -(topbar ? topbar.offsetHeight + 12 : 0),
        onComplete: () => focusTarget(target),
      });
    });
  });

  // The smog clears between the top of the page and the "How it decides" section.
  const clearing = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      endTrigger: "#how",
      end: "top 30%",
      scrub: 0.8,
    },
  });
  clearing
    .to(".sky-clear", { opacity: 1 }, 0)
    .to(".haze-1", { opacity: 0, yPercent: -30 }, 0)
    .to(".haze-2", { opacity: 0, yPercent: -18 }, 0.1)
    .to(".haze-3", { opacity: 0.15, yPercent: -10 }, 0.2)
    .to(".sun", { opacity: 1, scale: 1.12, yPercent: -60 }, 0)
    .to(".city-far", { opacity: 0.55 }, 0)
    .to(".city-mid", { opacity: 0.8 }, 0)
    .to(".scroll-cue", { opacity: 0 }, 0);

  // If the visitor turns on reduced motion mid-visit, stop the scene in its clear state.
  reduced.addEventListener("change", (event) => {
    if (!event.matches) return;
    clearing.scrollTrigger.kill();
    clearing.progress(1);
    root.classList.add("sky-is-clear");
  });
})();
