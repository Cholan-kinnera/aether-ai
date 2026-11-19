// "Right now" on the landing page: live forecast + nearest station for a few cities.
// Real data only (POST /api/plan, cached server-side); text via textContent, never innerHTML.
import { ageText, categoryOf, fmt, hourLabel } from "./format.js";
import { categoryBadge, el, svg } from "./dom.js";

const box = document.getElementById("live");
const chips = [...document.querySelectorAll(".chip[data-city]")];
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const cache = new Map();
let current = 0;

function countUp(node, target) {
  if (reduced.matches) {
    node.textContent = String(target);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 900);
    node.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function chart(d) {
  const hours = d.hourly.slice(0, 24);
  const fig = el("figure", undefined, "live-chart");
  const w = 24 * 14;
  const max = Math.max(200, ...hours.map((h) => h.us_aqi || 0));
  const plot = svg("svg", { viewBox: `0 0 ${w} 132`, "aria-hidden": "true", focusable: "false" });
  const win = d.best_window;
  hours.forEach((h, i) => {
    if (h.us_aqi === null) return;
    const height = Math.max(2, (h.us_aqi / max) * 104);
    const bar = svg("rect", { x: i * 14 + 2, y: 108 - height, width: 10, height, rx: 2 });
    const cat = categoryOf(h.us_aqi);
    bar.setAttribute("class", `bar cat-${cat.key}`);
    bar.style.transitionDelay = `${i * 25}ms`;
    plot.append(bar);
    if (i % 6 === 0) {
      const label = svg("text", { x: i === 0 ? 2 : i * 14 + 7, y: 124, "text-anchor": i === 0 ? "start" : "middle" });
      label.textContent = hourLabel(h.time);
      plot.append(label);
    }
  });
  if (win) {
    const i = hours.findIndex((h) => h.time === win.start);
    if (i >= 0) {
      plot.append(svg("rect", { x: i * 14, y: 0, width: 28, height: 110, rx: 4, class: "window" }));
    }
  }
  const cap = el("figcaption");
  cap.textContent = win
    ? `Next 24 hours of forecast US AQI. Cleanest two hours: ${hourLabel(win.start)} to ${hourLabel(win.end)}, average ${fmt(win.mean_aqi)}.`
    : "Next 24 hours of forecast US AQI.";
  fig.append(plot, cap);
  return fig;
}

function render(d, city) {
  const cat = categoryOf(d.aqi);
  const left = el("div", undefined, "live-now");
  const num = el("p", undefined, `live-aqi cat-${cat.key}`);
  const value = el("span", "0");
  num.append(value, el("span", "US AQI forecast now", "unit"));
  left.append(el("p", d.location, "live-place"), num, categoryBadge(d.aqi));
  const p = d.provenance;
  left.append(el("p", `Model estimate (CAMS), fetched ${ageText(p.data_age_minutes)}.${p.stale ? " Stale: older than 3 hours." : ""}`, "meta"));
  const pm = d.station?.readings.find((r) => r.pollutant === "pm25" && r.value !== null);
  if (pm) {
    left.append(el("p", `Measured at ${d.station.station_name} (${d.station.provider}), ${fmt(d.station.distance_km, 1)} km away: PM2.5 ${fmt(pm.value, 1)} ${pm.unit}, ${pm.data_age_minutes === null ? "time unknown" : ageText(pm.data_age_minutes)}.`, "meta"));
  }
  const cta = el("a", `Plan a day in ${city}`, "button");
  cta.href = `/plan?city=${encodeURIComponent(city)}`;
  left.append(cta);
  box.replaceChildren(left, chart(d));
  box.setAttribute("aria-busy", "false");
  countUp(value, Math.round(d.aqi));
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));
}

async function show(city) {
  const token = ++current;
  box.classList.remove("is-in");
  box.setAttribute("aria-busy", "true");
  box.replaceChildren(el("p", `Fetching the latest forecast for ${city}.`, "help"));
  try {
    if (!cache.has(city)) {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: city }),
      });
      if (!response.ok) throw new Error(String(response.status));
      cache.set(city, await response.json());
    }
    if (token === current) render(cache.get(city), city);
  } catch {
    if (token !== current) return;
    box.setAttribute("aria-busy", "false");
    box.replaceChildren(el("p", `The forecast for ${city} is unavailable right now. Try another city, or plan your own day.`, "error"));
  }
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    show(chip.dataset.city);
  });
});

// Fetch only when the section comes near the viewport, so a quick visit costs no API call.
const watcher = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) {
    watcher.disconnect();
    show(chips.find((c) => c.getAttribute("aria-pressed") === "true").dataset.city);
  }
}, { rootMargin: "300px" });
watcher.observe(box);
