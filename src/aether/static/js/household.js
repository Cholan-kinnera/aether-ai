// Household and plan rows on the planner form, saved on this device only (localStorage).
import { el } from "./dom.js";

const STORE_KEY = "aether.household.v1";
const MAX_MEMBERS = 8;
const MAX_ACTIVITIES = 6;
export const HERE = "My current location";
export const DEFAULT_MEMBER = { name: "You" };
export const DEFAULT_ACTIVITY = { label: "Walk", activity: "walk", duration: "1", earliest: "6", latest: "22" };
const ACTIVITY_FIELDS = ["label", "activity", "duration", "earliest", "latest"];

const membersList = document.getElementById("members");
const activitiesList = document.getElementById("activities");
let rowId = 0;

function fillHours(select) {
  // API contract: earliest_hour 0-23, latest_hour 1-24.
  const first = select.dataset.id === "latest" ? 1 : 0;
  for (let h = first; h <= first + 23; h++) {
    const opt = el("option", `${String(h).padStart(2, "0")}:00`);
    opt.value = String(h);
    select.append(opt);
  }
  select.value = select.dataset.default;
}

// Clone a <template> row and give every field a unique id its label points to.
function newRow(templateId, prefix) {
  const li = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  const id = `${prefix}-${rowId++}`;
  li.querySelectorAll("[data-id]").forEach((input) => { input.id = `${id}-${input.dataset.id}`; });
  li.querySelectorAll("label[data-for]").forEach((label) => { label.htmlFor = `${id}-${label.dataset.for}`; });
  li.querySelectorAll("select.hour").forEach(fillHours);
  return li;
}

// The last person cannot be removed: a plan always has someone in it.
function syncRemoveButtons() {
  const only = membersList.children.length === 1;
  membersList.querySelectorAll(".remove").forEach((b) => { b.hidden = only; });
}

// Removing a row moves focus to its neighbour (or the add button), never to <body>.
function removeRow(li, parent) {
  const next = li.nextElementSibling || li.previousElementSibling;
  li.remove();
  syncRemoveButtons();
  (next?.querySelector("input, select") || parent.nextElementSibling)?.focus();
}

export function addMember(data = {}) {
  if (membersList.children.length >= MAX_MEMBERS) return null;
  const li = newRow("member-tpl", "m");
  li.querySelector("[data-id=name]").value = data.name || "";
  (data.groups || []).forEach((g) => {
    const box = li.querySelector(`input[type=checkbox][value="${CSS.escape(g)}"]`);
    if (box) box.checked = true;
  });
  li.querySelector(".remove").addEventListener("click", () => removeRow(li, membersList));
  membersList.append(li);
  syncRemoveButtons();
  return li;
}

export function addActivity(data = {}) {
  if (activitiesList.children.length >= MAX_ACTIVITIES) return null;
  const li = newRow("activity-tpl", "a");
  ACTIVITY_FIELDS.forEach((key) => {
    if (data[key] !== undefined) li.querySelector(`[data-id=${key}]`).value = data[key];
  });
  li.querySelector(".remove").addEventListener("click", () => removeRow(li, activitiesList));
  activitiesList.append(li);
  return li;
}

export function readMembers() {
  return [...membersList.children].map((li) => ({
    name: li.querySelector("[data-id=name]").value,
    groups: [...li.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value),
  }));
}

export function readActivities() {
  return [...activitiesList.children].map((li) =>
    Object.fromEntries(ACTIVITY_FIELDS.map((key) => [key, li.querySelector(`[data-id=${key}]`).value])));
}

export function save(location) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ location, members: readMembers(), activities: readActivities() }));
  } catch { /* storage unavailable (private mode): the plan still works */ }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? {};
  } catch {
    return {};
  }
}

const nonEmpty = (value, fallback) => (Array.isArray(value) && value.length ? value : [fallback]);

// Restore the saved household. A city from the landing page (/plan?city=Delhi) wins over the saved one.
export function restore(locationInput) {
  const saved = load();
  if (saved.location && saved.location !== HERE) locationInput.value = saved.location;
  const city = new URLSearchParams(window.location.search).get("city")?.trim();
  if (city) locationInput.value = city.slice(0, 100);
  nonEmpty(saved.members, DEFAULT_MEMBER).slice(0, MAX_MEMBERS).forEach((m) => addMember(m));
  nonEmpty(saved.activities, DEFAULT_ACTIVITY).slice(0, MAX_ACTIVITIES).forEach((a) => addActivity(a));
}

export function forget() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
  membersList.replaceChildren();
  activitiesList.replaceChildren();
  addMember(DEFAULT_MEMBER);
  addActivity(DEFAULT_ACTIVITY);
}
