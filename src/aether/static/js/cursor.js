// Custom cursor: a dot that sits exactly on the pointer (so precision is never lost) and a
// ring that trails it and grows over things you can click. Mouse users only; off for touch,
// pens and prefers-reduced-motion. Text fields keep the native caret cursor.
(() => {
  const fine = window.matchMedia("(pointer: fine) and (hover: hover)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || reduced.matches) return;

  const root = document.documentElement;
  const dot = document.createElement("div");
  const ring = document.createElement("div");
  dot.className = "cursor-dot";
  ring.className = "cursor-ring";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  document.body.append(dot, ring);
  root.classList.add("has-cursor");

  const CLICKABLE = "a, button, summary, label, [role='button'], .chip";
  const TEXT = "input, textarea, select, [contenteditable='true']";
  let x = -100, y = -100, rx = -100, ry = -100, frame = 0;

  function loop() {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    frame = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    x = event.clientX;
    y = event.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const target = event.target instanceof Element ? event.target : null;
    root.classList.toggle("cursor-text", Boolean(target?.closest(TEXT)));
    root.classList.toggle("cursor-hover", Boolean(target?.closest(CLICKABLE)));
    root.classList.add("cursor-visible");
    if (!frame) frame = requestAnimationFrame(loop);
  }, { passive: true });

  window.addEventListener("pointerdown", () => root.classList.add("cursor-down"));
  window.addEventListener("pointerup", () => root.classList.remove("cursor-down"));
  document.addEventListener("pointerleave", () => root.classList.remove("cursor-visible"));
  window.addEventListener("blur", () => root.classList.remove("cursor-visible"));

  reduced.addEventListener("change", (event) => {
    if (!event.matches) return;
    root.classList.remove("has-cursor", "cursor-visible");
    dot.remove();
    ring.remove();
  });
})();
