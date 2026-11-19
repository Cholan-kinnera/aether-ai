// Planner page wiring: the form, location, submit and the AI briefing upgrade.
import { buildPayload, errorMessage } from "./format.js";
import { el } from "./dom.js";
import { HERE, addActivity, addMember, forget, readActivities, readMembers, restore, save } from "./household.js";
import { SOURCE_TEXT, renderPlan } from "./render.js";

const $ = (id) => document.getElementById(id);
const form = $("plan-form");
const results = $("results");
const locationInput = $("location");
let coords = null;

function showMessage(text, role = "alert", className = "error") {
  const p = el("p", text, className);
  p.setAttribute("role", role);
  results.replaceChildren(p);
}

// The plan arrives with a rule-based briefing; swap in Gemini's version if it comes back.
async function upgradeBriefing(id) {
  const source = results.querySelector(".briefing-source");
  try {
    const response = await fetch(`/api/briefing/${encodeURIComponent(id)}`, { method: "POST" });
    const data = response.ok ? await response.json() : null;
    const fromGemini = data?.explanation_source === "gemini";
    if (fromGemini) results.querySelector(".briefing-text").textContent = data.explanation;
    source.textContent = SOURCE_TEXT[fromGemini ? "gemini" : "rules"];
  } catch {
    source.textContent = SOURCE_TEXT.rules;
  }
}

function render(d) {
  results.replaceChildren(...renderPlan(d));
  results.focus({ preventScroll: true });
  // motion.js glides to the results when smooth scrolling is on; otherwise jump there.
  if (!document.documentElement.classList.contains("lenis")) results.scrollIntoView({ block: "start" });
  document.dispatchEvent(new CustomEvent("aether:results", { detail: { aqi: d.aqi } }));
  if (d.briefing_id) upgradeBriefing(d.briefing_id);
}

function locationIsValid() {
  const error = $("location-error");
  const ok = Boolean(coords) || locationInput.value.trim().length >= 2;
  error.hidden = ok;
  error.textContent = ok ? "" : "Please enter a city or use your location.";
  if (ok) {
    locationInput.removeAttribute("aria-invalid");
  } else {
    locationInput.setAttribute("aria-invalid", "true");
    locationInput.focus();
  }
  return ok;
}

function payload() {
  const value = (id) => $(id).value;
  return buildPayload({
    coords,
    location: locationInput.value,
    members: readMembers(),
    activities: readActivities(),
    home: { area: value("area"), ceiling: value("ceiling"), cadr: value("cadr"), unit: value("cadr-unit") },
    commute: { distance: value("distance"), mode: value("mode"), occupants: value("occupants"), trips: value("trips") },
    note: value("note"),
  });
}

function setBusy(busy) {
  const button = $("submit-btn");
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  results.setAttribute("aria-busy", String(busy));
}

async function submit(event) {
  event.preventDefault();
  if (!locationIsValid()) return;
  const body = payload();
  save(locationInput.value);
  setBusy(true);
  results.replaceChildren(el("p", "Building your plan…", "help"));
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) render(data);
    else showMessage(errorMessage(response.status, data));
  } catch {
    showMessage("Network problem. Please check your connection and try again.");
  } finally {
    setBusy(false);
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    showMessage("Your browser does not support location. Please type a city instead.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      // Three decimals (about 100 m) is enough for an air forecast and keeps the request coarse.
      coords = { latitude: +pos.coords.latitude.toFixed(3), longitude: +pos.coords.longitude.toFixed(3) };
      locationInput.value = HERE;
    },
    () => showMessage("Could not get your location. Please type a city instead."),
    { timeout: 10000 },
  );
}

$("add-member").addEventListener("click", () => addMember()?.querySelector("input")?.focus());
$("add-activity").addEventListener("click", () => addActivity()?.querySelector("input")?.focus());
$("forget-btn").addEventListener("click", () => {
  forget();
  showMessage("Saved household removed from this device.", "status", "help");
});
$("geo-btn").addEventListener("click", useMyLocation);
locationInput.addEventListener("input", () => {
  if (locationInput.value !== HERE) coords = null;
});
form.addEventListener("submit", submit);

restore(locationInput);
