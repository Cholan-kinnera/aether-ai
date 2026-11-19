// End-to-end: real browser, real front end, real API, fixed air data (see fixture_app.py).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoA11yViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}

async function planFor(page, place) {
  await page.getByLabel("City or neighbourhood").fill(place);
  await page.getByRole("button", { name: "Plan my day" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("empty form meets WCAG 2.1 AA and fits the viewport", async ({ page }) => {
  await expectNoA11yViolations(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("household plan shows verdicts, provenance, schedule, indoor and commute", async ({ page }) => {
  await page.getByRole("checkbox", { name: "Asthma / lung" }).check();
  await page.getByText("Home and purifier (optional)").click();
  await page.getByLabel("Main room floor area (m²)").fill("15");
  await page.getByLabel("Purifier CADR (leave blank if none)").fill("250");
  await page.getByText("Daily commute (optional)").click();
  await page.getByLabel("One-way distance (km)").fill("8");
  await planFor(page, "Delhi");

  const results = page.locator("#results");
  await expect(results.getByRole("heading", { name: "Delhi, Test State" })).toBeVisible();
  await expect(results).toBeFocused();
  // AQI is number + category text + icon, never colour alone.
  await expect(results.getByText("170", { exact: true }).first()).toBeVisible();
  await expect(results.getByText("Unhealthy").first()).toBeVisible();
  await expect(results.getByText("✖ Stay indoors").first()).toBeVisible();
  // Data honesty: model estimate label and data age.
  await expect(results.getByText(/Model estimate .* fetched 5 min ago/)).toBeVisible();
  // Each part of the plan.
  for (const name of ["Your briefing", "Who should do what", "Your low-exposure day", "Indoor air plan"]) {
    await expect(results.getByRole("heading", { name })).toBeVisible();
  }
  await expect(results.getByRole("heading", { name: /Greener commute/ })).toBeVisible();
  // Macro (kg CO2e) and micro (inhaled PM2.5) stay separate.
  await expect(results.getByText(/kg CO2e per week/).first()).toBeVisible();
  await expect(results.getByText(/breathe in more particles per trip/).first()).toBeVisible();
  // No API key in tests, so the rule-based briefing must remain.
  await expect(results.getByText("Rule-based briefing.")).toBeVisible();
  await expectNoA11yViolations(page);
});

test("unknown place is announced as an alert", async ({ page }) => {
  await planFor(page, "Nowhere");
  await expect(page.getByRole("alert")).toHaveText("could not find a place called 'Nowhere'");
});

test("keyboard: skip link is first and moves focus to main content", async ({ page }) => {
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("reduced motion disables animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.evaluate(
    () => getComputedStyle(document.querySelector("button")).transitionDuration,
  );
  expect(duration).toBe("0s");
});
