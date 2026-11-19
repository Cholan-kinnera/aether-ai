"use strict";

const form = document.getElementById("advice-form");
const results = document.getElementById("results");
const submitBtn = document.getElementById("submit-btn");
const geoBtn = document.getElementById("geo-btn");
const locationInput = document.getElementById("location");
const locationError = document.getElementById("location-error");

const VERDICTS = {
  go: { icon: "✔", label: "Good to go" },
  caution: { icon: "⚠", label: "Take some care" },
  limit: { icon: "⛔", label: "Limit time outdoors" },
  avoid: { icon: "✖", label: "Stay indoors" },
};

let coords = null;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function list(items) {
  const ul = document.createElement("ul");
  items.forEach((item) => ul.appendChild(el("li", item)));
  return ul;
}

function hourLabel(iso) {
  return iso.slice(11, 16);
}

function showError(message) {
  results.replaceChildren(el("p", message, "error"));
  results.firstChild.setAttribute("role", "alert");
}

function render(data) {
  const d = data.decision;
  const v = VERDICTS[d.verdict];
  const card = el("article", undefined, `card verdict verdict-${d.verdict}`);

  const heading = el("h2");
  heading.append(el("span", v.icon + " "), document.createTextNode(v.label));
  heading.firstChild.setAttribute("aria-hidden", "true");
  card.append(heading);

  card.append(el("p", `${data.location} • updated ${data.observed_at.replace("T", " ")}`));
  card.append(el("p", String(Math.round(d.aqi)), "aqi-number"));
  card.append(el("p", `US AQI – ${d.category}. Adjusted for you: ${Math.round(d.adjusted_aqi)}.`));
  card.append(el("p", data.explanation));

  card.append(el("h3", "Why"), list(d.reasons));
  card.append(el("h3", "What to do"), list(d.actions));

  if (d.best_window) {
    const w = d.best_window;
    const text = w.starts_now
      ? "Now is already the cleanest time in the next 24 hours."
      : `Cleanest time in the next 24 hours: ${hourLabel(w.start)}–${hourLabel(w.end)} (average AQI ${w.mean_aqi}).`;
    card.append(el("h3", "Best time"), el("p", text));
  }

  const details = el("details");
  details.append(el("summary", "Hourly forecast (table)"));
  const table = el("table");
  table.append(el("caption", "US AQI by hour", "sr-only"));
  const head = table.createTHead().insertRow();
  ["Time", "AQI"].forEach((h) => {
    const th = el("th", h);
    th.scope = "col";
    head.append(th);
  });
  const body = table.createTBody();
  data.hourly.forEach((p) => {
    const row = body.insertRow();
    row.insertCell().textContent = hourLabel(p.time);
    row.insertCell().textContent = p.us_aqi === null ? "n/a" : String(Math.round(p.us_aqi));
  });
  details.append(table);
  card.append(details);
  card.append(el("p", data.disclaimer, "help"));

  results.replaceChildren(card);
  results.focus();
}

geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Your browser does not support location. Please type a city instead.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      locationInput.value = "My current location";
    },
    () => showError("Could not get your location. Please type a city instead."),
  );
});

locationInput.addEventListener("input", () => {
  if (locationInput.value !== "My current location") coords = null;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  locationError.hidden = true;
  locationInput.removeAttribute("aria-invalid");
  const name = locationInput.value.trim();
  if (!coords && name.length < 2) {
    locationError.textContent = "Please enter a city or use your location.";
    locationError.hidden = false;
    locationInput.setAttribute("aria-invalid", "true");
    locationInput.focus();
    return;
  }

  const payload = {
    groups: [...form.querySelectorAll("input[name=groups]:checked")].map((c) => c.value),
  };
  if (coords) Object.assign(payload, coords);
  else payload.location = name;
  const activity = form.activity.value;
  if (activity) payload.activity = activity;
  const note = form.note.value.trim();
  if (note) payload.note = note;

  submitBtn.disabled = true;
  results.setAttribute("aria-busy", "true");
  results.replaceChildren(el("p", "Checking the air…"));
  try {
    const response = await fetch("/api/advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(data.detail) ? "Please check your input." : data.detail;
      showError(detail || "Something went wrong. Please try again.");
    } else {
      render(data);
    }
  } catch {
    showError("Network problem. Please check your connection and try again.");
  } finally {
    submitBtn.disabled = false;
    results.setAttribute("aria-busy", "false");
  }
});
