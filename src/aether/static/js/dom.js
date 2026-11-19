// Safe DOM builders shared by both pages. Text goes in via textContent only (never innerHTML),
// so provider or user data can never inject markup.
import { VERDICTS, categoryOf } from "./format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let headingId = 0;

export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function list(items, className) {
  const ul = el("ul", undefined, className);
  items.forEach((item) => ul.append(el("li", item)));
  return ul;
}

export function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

// A results card: a <section> labelled by its own heading.
export function card(title, className) {
  const section = el("section", undefined, `card ${className || ""}`.trim());
  const heading = el("h2", title);
  heading.id = `h-${headingId++}`;
  section.setAttribute("aria-labelledby", heading.id);
  section.append(heading);
  return section;
}

// Never colour alone: every badge carries an icon (hidden from screen readers) and a text label.
function badge(className, icon, label) {
  const node = el("span", undefined, `badge ${className}`);
  const mark = el("span", `${icon} `);
  mark.setAttribute("aria-hidden", "true");
  node.append(mark, document.createTextNode(label));
  return node;
}

export function verdictBadge(verdict) {
  const v = VERDICTS[verdict];
  return badge(`verdict-${verdict}`, v.icon, v.label);
}

export function categoryBadge(aqi) {
  const c = categoryOf(aqi);
  return badge(`cat-${c.key}`, c.icon, c.name);
}
