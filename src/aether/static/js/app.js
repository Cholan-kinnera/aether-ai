// DOM layer. Writes text only via textContent (no innerHTML), so API data cannot inject markup.
import {
  VERDICTS, ageText, buildPayload, categoryOf, errorMessage, fmt, hourLabel,
} from "./format.js";

const $ = (id) => document.getElementById(id);
const form = $("plan-form");
const results = $("results");
const membersList = $("members");
const activitiesList = $("activities");
const STORE_KEY = "aether.household.v1";
const MAX_MEMBERS = 8;
const MAX_ACTIVITIES = 6;
let coords = null;
let uid = 0;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function list(items, className) {
  const ul = el("ul", undefined, className);
  items.forEach((item) => ul.append(el("li", item)));
  return ul;
}

// ------------------------------------------------------------------ form rows

function wireRow(li, prefix) {
  const id = `${prefix}-${uid++}`;
  li.querySelectorAll("[data-id]").forEach((input) => {
    input.id = `${id}-${input.dataset.id}`;
  });
  li.querySelectorAll("label[data-for]").forEach((label) => {
    label.htmlFor = `${id}-${label.dataset.for}`;
  });
  li.querySelectorAll("select.hour").forEach((select) => {
    // API contract: earliest_hour 0-23, latest_hour 1-24.
    const latest = select.dataset.id === "latest";
    for (let h = latest ? 1 : 0; h <= (latest ? 24 : 23); h++) {
      const opt = el("option", `${String(h).padStart(2, "0")}:00`);
      opt.value = String(h);
      select.append(opt);
    }
    select.value = select.dataset.default;
  });
}

function addMember(data = {}) {
  if (membersList.children.length >= MAX_MEMBERS) return null;
  const li = $("member-tpl").content.firstElementChild.cloneNode(true);
  wireRow(li, "m");
  li.querySelector("[data-id=name]").value = data.name || "";
  (data.groups || []).forEach((g) => {
    const box = li.querySelector(`input[type=checkbox][value="${g}"]`);
    if (box) box.checked = true;
  });
  li.querySelector(".remove").addEventListener("click", () => removeRow(li, membersList));
  membersList.append(li);
  syncRemoveButtons(membersList);
  return li;
}

function addActivity(data = {}) {
  if (activitiesList.children.length >= MAX_ACTIVITIES) return null;
  const li = $("activity-tpl").content.firstElementChild.cloneNode(true);
  wireRow(li, "a");
  for (const key of ["label", "activity", "duration", "earliest", "latest"]) {
    if (data[key] !== undefined) li.querySelector(`[data-id=${key}]`).value = data[key];
  }
  li.querySelector(".remove").addEventListener("click", () => removeRow(li, activitiesList));
  activitiesList.append(li);
  return li;
}

function removeRow(li, parent) {
  const next = li.nextElementSibling || li.previousElementSibling;
  li.remove();
  syncRemoveButtons(membersList);
  (next?.querySelector("input, select") || parent.nextElementSibling)?.focus();
}

function syncRemoveButtons(parent) {
  const only = parent.children.length === 1;
  parent.querySelectorAll(".remove").forEach((b) => { b.hidden = only; });
}

function readMembers() {
  return [...membersList.children].map((li) => ({
    name: li.querySelector("[data-id=name]").value,
    groups: [...li.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value),
  }));
}

function readActivities() {
  return [...activitiesList.children].map((li) => {
    const v = (k) => li.querySelector(`[data-id=${k}]`).value;
    return {
      label: v("label"), activity: v("activity"), duration: v("duration"),
      earliest: v("earliest"), latest: v("latest"),
    };
  });
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      location: $("location").value, members: readMembers(), activities: readActivities(),
    }));
  } catch { /* storage unavailable: nothing to do */ }
}

function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { saved = null; }
  if (saved?.location && saved.location !== "My current location") $("location").value = saved.location;
  // A city chosen on the landing page (/plan?city=Delhi) wins over the saved one.
  const city = new URLSearchParams(window.location.search).get("city");
  if (city && city.trim()) $("location").value = city.trim().slice(0, 100);
  const members = Array.isArray(saved?.members) && saved.members.length ? saved.members : [{ name: "You" }];
  members.slice(0, MAX_MEMBERS).forEach((m) => addMember(m));
  const activities = Array.isArray(saved?.activities) && saved.activities.length
    ? saved.activities
    : [{ label: "Walk", activity: "walk", duration: "1", earliest: "6", latest: "22" }];
  activities.slice(0, MAX_ACTIVITIES).forEach((a) => addActivity(a));
}

// ------------------------------------------------------------------ results

function card(title, className) {
  const section = el("section", undefined, `card ${className || ""}`.trim());
  const h = el("h2", title);
  const hid = `h-${uid++}`;
  h.id = hid;
  section.setAttribute("aria-labelledby", hid);
  section.append(h);
  return section;
}

function verdictBadge(verdict) {
  const v = VERDICTS[verdict];
  const badge = el("span", undefined, `badge verdict-${verdict}`);
  const icon = el("span", v.icon + " ");
  icon.setAttribute("aria-hidden", "true");
  badge.append(icon, document.createTextNode(v.label));
  return badge;
}

function categoryBadge(aqi) {
  const c = categoryOf(aqi);
  const badge = el("span", undefined, `badge cat-${c.key}`);
  const icon = el("span", c.icon + " ");
  icon.setAttribute("aria-hidden", "true");
  badge.append(icon, document.createTextNode(c.name));
  return badge;
}

function renderOverview(d) {
  const section = card(d.location, "overview");
  const p = d.provenance;
  const top = el("div", undefined, "overview-top");
  const num = el("p", undefined, `aqi-number cat-${categoryOf(d.aqi).key}`);
  num.append(el("span", String(Math.round(d.aqi))), el("span", "US AQI", "unit"));
  const side = el("div");
  side.append(categoryBadge(d.aqi), el("p", "Household verdict:", "label"), verdictBadge(d.household_verdict));
  top.append(num, side);
  section.append(top);

  const meta = el("p", undefined, "meta");
  meta.append(document.createTextNode(
    `Model estimate (${p.model}) for ${p.observed_at.replace("T", " ")} local time · fetched ${ageText(p.data_age_minutes)}. `,
  ));
  if (p.stale) meta.append(el("strong", "Stale: older than 3 hours.", "stale"));
  section.append(meta);

  const rows = Object.entries(d.pollutants).filter(([, v]) => v !== null);
  if (rows.length) {
    const labels = { pm2_5: "PM2.5", pm10: "PM10", nitrogen_dioxide: "NO₂", ozone: "O₃", sulphur_dioxide: "SO₂", carbon_monoxide: "CO" };
    const dl = el("dl", undefined, "pollutants");
    rows.forEach(([k, v]) => {
      const div = el("div");
      div.append(el("dt", labels[k] || k), el("dd", `${fmt(v, 1)} µg/m³`));
      if (k === d.dominant_pollutant) div.className = "dominant";
      dl.append(div);
    });
    section.append(dl);
  }
  if (d.weather && d.weather.boundary_layer_m !== null) {
    const w = d.weather;
    let text = `Wind ${fmt(w.wind_speed_kmh)} km/h, mixing layer ${fmt(w.boundary_layer_m)} m.`;
    if (w.peak_mixing_time && w.peak_boundary_layer_m > w.boundary_layer_m) {
      text += ` Smog disperses better when this layer is deeper; it is forecast to be deepest around ${hourLabel(w.peak_mixing_time)} (${fmt(w.peak_boundary_layer_m)} m).`;
    }
    section.append(el("p", text, "weather"));
  }
  return section;
}

const STATION_STATUS = {
  none_nearby: "No monitoring station within 25 km has reported in the last 24 hours, so only the model estimate above is available.",
  unavailable: "Station measurements are unavailable right now; the model estimate above is unaffected.",
};

function renderStation(d) {
  if (d.station_status === "not_configured") return null;
  const section = card("Nearest monitoring station", "station");
  const s = d.station;
  if (!s) {
    section.append(el("p", STATION_STATUS[d.station_status], "help"));
    return section;
  }
  const kind = s.is_reference_monitor ? "reference monitor" : "sensor";
  section.append(el("p", `Measured at ${s.station_name} (${s.provider} ${kind}), ${fmt(s.distance_km, 1)} km away. Station measurement, shown beside the model estimate and never mixed into it; units as reported by the provider.`, "meta"));
  const dl = el("dl", undefined, "pollutants");
  s.readings.forEach((r) => {
    const div = el("div");
    const value = r.value === null ? "no valid reading" : `${fmt(r.value, r.value < 1 ? 3 : 1)} ${r.unit}`;
    const age = r.data_age_minutes === null ? "time unknown" : ageText(r.data_age_minutes);
    div.append(el("dt", r.label), el("dd", value), el("dd", age, "help"));
    if (r.stale) div.append(el("dd", "Stale: older than 3 hours.", "stale"));
    dl.append(div);
  });
  section.append(dl, el("p", s.attribution, "help"));
  return section;
}

const SOURCE_TEXT = {
  gemini: "Written by Google Gemini from the computed plan; it cannot change verdicts or numbers.",
  rules: "Rule-based briefing.",
  pending: "Rule-based briefing; asking Google Gemini for a personalised version…",
};

function renderBriefing(d) {
  const section = card("Your briefing", "briefing");
  section.append(el("p", d.explanation, "lead briefing-text"));
  section.append(el("p", SOURCE_TEXT[d.briefing_id ? "pending" : d.explanation_source], "help briefing-source"));
  return section;
}

async function upgradeBriefing(id) {
  const source = results.querySelector(".briefing-source");
  try {
    const response = await fetch(`/api/briefing/${encodeURIComponent(id)}`, { method: "POST" });
    const data = response.ok ? await response.json() : null;
    if (data?.explanation_source === "gemini") {
      results.querySelector(".briefing-text").textContent = data.explanation;
    }
    source.textContent = SOURCE_TEXT[data?.explanation_source === "gemini" ? "gemini" : "rules"];
  } catch {
    source.textContent = SOURCE_TEXT.rules;
  }
}

function renderMembers(d) {
  const section = card("Who should do what");
  const grid = el("div", undefined, "members-grid");
  d.members.forEach((m) => {
    const art = el("article", undefined, `member verdict-border-${m.verdict}`);
    const h = el("h3", m.name);
    art.append(h, verdictBadge(m.verdict), list(m.reasons, "reasons"), list(m.actions));
    grid.append(art);
  });
  section.append(grid);
  return section;
}

function renderSchedule(d) {
  const section = card("Your low-exposure day");
  if (d.best_window) {
    const w = d.best_window;
    section.append(el("p", w.starts_now
      ? "Right now is the cleanest time in the next 24 hours."
      : `Cleanest 2 hours in the next day: ${hourLabel(w.start)} to ${hourLabel(w.end)} (average AQI ${fmt(w.mean_aqi)}).`, "lead"));
  }
  if (d.schedule.length) {
    const ol = el("ol", undefined, "schedule");
    d.schedule.forEach((s) => {
      const li = el("li");
      li.append(el("strong", s.label));
      if (s.window) {
        li.append(document.createTextNode(` · ${hourLabel(s.window.start)} to ${hourLabel(s.window.end)} · AQI ${fmt(s.window.mean_aqi)} `));
        li.append(verdictBadge(s.verdict));
      }
      li.append(el("p", s.advice));
      if (s.exposure_note) li.append(el("p", s.exposure_note, "help"));
      ol.append(li);
    });
    section.append(ol);
  }
  section.append(renderChart(d.hourly));
  return section;
}

function renderChart(hourly) {
  const wrap = el("figure", undefined, "chart");
  const cap = el("figcaption", "US AQI forecast, next 24 hours");
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  const width = 24 * 14;
  const max = Math.max(100, ...hourly.map((p) => p.us_aqi || 0));
  svg.setAttribute("viewBox", `0 0 ${width} 130`);
  svg.setAttribute("aria-hidden", "true");
  hourly.forEach((p, i) => {
    if (p.us_aqi === null) return;
    const h = (p.us_aqi / max) * 110;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", String(i * 14 + 1));
    rect.setAttribute("y", String(115 - h));
    rect.setAttribute("width", "12");
    rect.setAttribute("height", String(h));
    rect.setAttribute("class", `bar cat-${categoryOf(p.us_aqi).key}`);
    svg.append(rect);
    if (i % 3 === 0) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", String(i * 14 + 7));
      t.setAttribute("y", "128");
      t.setAttribute("text-anchor", "middle");
      t.textContent = hourLabel(p.time);
      svg.append(t);
    }
  });
  wrap.append(cap, svg);

  const details = el("details");
  details.append(el("summary", "Hourly values (table)"));
  const table = el("table");
  table.append(el("caption", "US AQI and PM2.5 by hour (model forecast)", "sr-only"));
  const head = table.createTHead().insertRow();
  ["Time", "US AQI", "Category", "PM2.5 µg/m³"].forEach((h) => {
    const th = el("th", h); th.scope = "col"; head.append(th);
  });
  const body = table.createTBody();
  hourly.forEach((p) => {
    const row = body.insertRow();
    row.insertCell().textContent = hourLabel(p.time);
    row.insertCell().textContent = fmt(p.us_aqi);
    row.insertCell().textContent = categoryOf(p.us_aqi)?.name || "n/a";
    row.insertCell().textContent = fmt(p.pm2_5, 1);
  });
  details.append(table);
  wrap.append(details);
  return wrap;
}

function renderIndoor(i) {
  const section = card("Indoor air plan");
  const facts = [];
  facts.push(`Room volume: ${fmt(i.room_volume_m3)} m³. Recommended purifier CADR: about ${fmt(i.recommended_cadr_m3h)} m³/h (EPA sizing chart).`);
  if (i.purifier_cadr_m3h) {
    facts.push(`Your purifier gives about ${fmt(i.clean_air_changes_per_hour, 1)} clean-air changes per hour and could cut particles by 90% in roughly ${i.minutes_to_cut_particles_90pct} minutes (ideal conditions). ${i.purifier_adequate ? "It is suitably sized." : "It is undersized for this room."}`);
  }
  section.append(list(facts, "facts"));
  section.append(el("h3", "Steps for today"), list(i.tips));
  const details = el("details");
  details.append(el("summary", "Assumptions"), list(i.assumptions));
  section.append(details);
  return section;
}

function renderCommute(c) {
  const section = card("Greener commute: the impact of your choice");
  section.append(el("p", c.summary, "lead"));
  const table = el("table", undefined, "commute");
  table.append(el("caption", "Two separate impacts: climate emissions (whole week) and the PM2.5 you personally breathe in (per trip, at today's levels)."));
  const head = table.createTHead();
  const r1 = head.insertRow();
  const th = (text, attrs = {}) => {
    const cell = el("th", text);
    Object.entries(attrs).forEach(([k, v]) => cell.setAttribute(k, v));
    return cell;
  };
  r1.append(th("Mode", { rowspan: "2", scope: "col" }), th("Time per trip", { rowspan: "2", scope: "col" }),
    th("Climate impact", { colspan: "2", scope: "colgroup" }), th("Your exposure", { scope: "col" }));
  const r2 = head.insertRow();
  r2.append(th("kg CO2e / week", { scope: "col" }), th("kg CO2e avoided / week", { scope: "col" }), th("µg PM2.5 inhaled / trip", { scope: "col" }));
  const body = table.createTBody();
  c.options.forEach((o) => {
    const row = body.insertRow();
    const name = el("th", o.is_current ? `${o.label} (current)` : o.label);
    name.scope = "row";
    row.append(name);
    row.insertCell().textContent = `${o.minutes_per_trip} min`;
    row.insertCell().textContent = fmt(o.emissions_kg_co2e_per_week, 2);
    row.insertCell().textContent = o.is_current ? "–" : fmt(o.emissions_avoided_kg_co2e_per_week, 2);
    row.insertCell().textContent = fmt(o.inhaled_pm25_ug_per_trip, 1);
    if (o.is_current) row.className = "current";
  });
  const scroll = el("div", undefined, "table-scroll");
  scroll.setAttribute("tabindex", "0");
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "Commute comparison table");
  scroll.append(table);
  section.append(scroll);
  const details = el("details");
  details.append(el("summary", "Assumptions and sources"), list([...c.assumptions, ...c.sources]));
  section.append(details);
  return section;
}

function render(d) {
  const nodes = [renderOverview(d), renderStation(d), renderBriefing(d), renderMembers(d), renderSchedule(d)].filter(Boolean);
  if (d.indoor) nodes.push(renderIndoor(d.indoor));
  if (d.commute) nodes.push(renderCommute(d.commute));
  nodes.push(el("p", d.disclaimer, "help disclaimer"));
  results.replaceChildren(...nodes);
  results.focus();
  if (d.briefing_id) upgradeBriefing(d.briefing_id);
}

function showError(message) {
  const p = el("p", message, "error");
  p.setAttribute("role", "alert");
  results.replaceChildren(p);
}

// ------------------------------------------------------------------ events

$("add-member").addEventListener("click", () => addMember()?.querySelector("input")?.focus());
$("add-activity").addEventListener("click", () => addActivity()?.querySelector("input")?.focus());
$("forget-btn").addEventListener("click", () => {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  membersList.replaceChildren();
  activitiesList.replaceChildren();
  addMember({ name: "You" });
  addActivity({ label: "Walk", activity: "walk" });
  showError("Saved household removed from this device.");
  results.firstChild.setAttribute("role", "status");
  results.firstChild.className = "help";
});

$("geo-btn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Your browser does not support location. Please type a city instead.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { latitude: +pos.coords.latitude.toFixed(3), longitude: +pos.coords.longitude.toFixed(3) };
      $("location").value = "My current location";
    },
    () => showError("Could not get your location. Please type a city instead."),
    { timeout: 10000 },
  );
});

$("location").addEventListener("input", () => {
  if ($("location").value !== "My current location") coords = null;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const loc = $("location");
  const locError = $("location-error");
  locError.hidden = true;
  loc.removeAttribute("aria-invalid");
  if (!coords && loc.value.trim().length < 2) {
    locError.textContent = "Please enter a city or use your location.";
    locError.hidden = false;
    loc.setAttribute("aria-invalid", "true");
    loc.focus();
    return;
  }
  const payload = buildPayload({
    coords, location: loc.value, members: readMembers(), activities: readActivities(),
    home: { area: $("area").value, ceiling: $("ceiling").value, cadr: $("cadr").value, unit: $("cadr-unit").value },
    commute: { distance: $("distance").value, mode: $("mode").value, occupants: $("occupants").value, trips: $("trips").value },
    note: $("note").value,
  });
  save();
  const btn = $("submit-btn");
  btn.disabled = true;
  results.setAttribute("aria-busy", "true");
  results.replaceChildren(el("p", "Building your plan…", "help"));
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data) render(data);
    else showError(errorMessage(response.status, data));
  } catch {
    showError("Network problem. Please check your connection and try again.");
  } finally {
    btn.disabled = false;
    results.setAttribute("aria-busy", "false");
  }
});

restore();
