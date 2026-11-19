// Pure presentation helpers (no DOM), unit-tested with `node --test`.
/** @typedef {import("./api").FormValues} FormValues */
/** @typedef {import("./api").PlanRequest} PlanRequest */
/** @typedef {import("./api").Verdict} Verdict */
/** @typedef {{ max: number, name: string, key: string, icon: string }} Category */

/** @type {readonly Category[]} */

export const CATEGORIES = [
  { max: 50, name: "Good", key: "good", icon: "●" },
  { max: 100, name: "Moderate", key: "moderate", icon: "◆" },
  { max: 150, name: "Unhealthy for Sensitive Groups", key: "usg", icon: "▲" },
  { max: 200, name: "Unhealthy", key: "unhealthy", icon: "■" },
  { max: 300, name: "Very Unhealthy", key: "very-unhealthy", icon: "✖" },
  { max: Infinity, name: "Hazardous", key: "hazardous", icon: "☠" },
];

/** @type {Record<Verdict, { icon: string, label: string }>} */
export const VERDICTS = {
  go: { icon: "✔", label: "Good to go" },
  caution: { icon: "⚠", label: "Take some care" },
  limit: { icon: "⛔", label: "Limit time outdoors" },
  avoid: { icon: "✖", label: "Stay indoors" },
};

export const CFM_TO_M3H = 1.69901;

/**
 * EPA category for an AQI value; null when the value is missing.
 * @param {number | null | undefined} aqi
 * @returns {Category | null}
 */
export function categoryOf(aqi) {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi)) return null;
  return CATEGORIES.find((c) => aqi <= c.max) ?? null;
}

/**
 * "HH:MM" from an ISO local time, or an en dash when unknown.
 * @param {unknown} iso
 */
export function hourLabel(iso) {
  return typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : "–";
}

/** @param {number} minutes */
export function ageText(minutes) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min ago`;
}

/**
 * Locale number with at most `digits` decimals; "n/a" when missing.
 * @param {number | null | undefined} value
 * @param {number} [digits]
 */
export function fmt(value, digits = 0) {
  if (value === null || value === undefined) return "n/a";
  return Number(value).toLocaleString("en", { maximumFractionDigits: digits });
}

/**
 * Purifier CADR in m³/h from a form value in m³/h or CFM; null when empty or invalid.
 * @param {string} value
 * @param {string} unit
 * @returns {number | null}
 */
export function toM3h(value, unit) {
  const n = Number(value);
  if (!value || Number.isNaN(n) || n <= 0) return null;
  return unit === "cfm" ? Math.round(n * CFM_TO_M3H) : Math.round(n);
}

/**
 * Build the /api/plan payload from plain form values; drops empty optional sections.
 * @param {FormValues} v
 * @returns {PlanRequest}
 */
export function buildPayload(v) {
  /** @type {PlanRequest} */
  const payload = {
    members: v.members.map((m) => ({ name: m.name.trim() || "You", groups: m.groups })),
  };
  if (v.coords) Object.assign(payload, v.coords);
  else payload.location = v.location.trim();
  payload.activities = v.activities
    .filter((a) => a.label.trim())
    .map((a) => ({
      label: a.label.trim(),
      activity: a.activity,
      duration_hours: Number(a.duration),
      earliest_hour: Number(a.earliest),
      latest_hour: Number(a.latest),
    }));
  if (Number(v.home.area) > 0) {
    payload.home = { floor_area_m2: Number(v.home.area), ceiling_height_m: Number(v.home.ceiling) };
    const cadr = toM3h(v.home.cadr, v.home.unit);
    if (cadr) payload.home.purifier_cadr_m3h = cadr;
  }
  if (Number(v.commute.distance) > 0) {
    payload.commute = {
      distance_km: Number(v.commute.distance),
      current_mode: v.commute.mode,
      occupants: Number(v.commute.occupants),
      trips_per_week: Number(v.commute.trips),
    };
  }
  if (v.note.trim()) payload.note = v.note.trim();
  return payload;
}

/**
 * User-facing message for a failed /api/plan call.
 * @param {number} status
 * @param {{ detail?: unknown } | null} data
 */
export function errorMessage(status, data) {
  if (status === 422) return "Please check the highlighted values and try again.";
  if (status === 429) return "Too many requests. Please wait a minute and try again.";
  if (data && typeof data.detail === "string") return data.detail;
  return "Something went wrong. Please try again.";
}
