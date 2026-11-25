import { test, expect } from "./fixtures";

// Listing detail glass (#753): CSS-only glass on the price and Suggestions
// cards over the dashboard backdrop, with solid fallbacks.
for (const theme of ["light", "dark"] as const) {
  test.describe(`rental detail glass (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (t) => localStorage.setItem("safetrust-theme", t),
        theme,
      );
      await page.goto("/rent/1");
      await expect(page.getByTestId("listing-price-card")).toBeVisible();
    });

    test("cards use the CSS glass over the soft backdrop", async ({ page }) => {
      await expect(page.locator(".listing-detail.dashboard-shell")).toHaveCount(
        1,
      );
      const cards = [
        page.getByTestId("listing-price-card"),
        page.getByTestId("suggestion-card").first(),
      ];
      for (const card of cards) {
        await expect(card).toHaveClass(/dashboard-glass-card/);
        const style = await card.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { filter: cs.backdropFilter, background: cs.backgroundColor };
        });
        expect(style.filter).toContain("blur");
        // Translucent: the backdrop shows through.
        expect(style.background).toMatch(/^rgba\(.*, 0\.\d+\)$/);
      }
      // No WebGL GlassSurface on this route.
      await expect(page.locator(".dashboard-glass-effect")).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
    });

    test("reduced transparency turns the glass solid", async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
      for (const card of [
        page.getByTestId("listing-price-card"),
        page.getByTestId("suggestion-card").first(),
      ]) {
        await expect
          .poll(() =>
            card.evaluate((el) => {
              const cs = getComputedStyle(el);
              return `${cs.backgroundColor} ${cs.backdropFilter}`;
            }),
          )
          .toMatch(/^rgb\(\d+, \d+, \d+\) none$/);
      }
    });

    test("keyboard focus marks the Suggestions card", async ({ page }) => {
      const card = page.getByTestId("suggestion-card").first();
      const view = card.getByRole("button", { name: /^View / });
      const before = await card.evaluate(
        (el) => getComputedStyle(el).borderTopColor,
      );
      await view.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(view).toBeFocused();
      await expect
        .poll(() => card.evaluate((el) => getComputedStyle(el).borderTopColor))
        .not.toBe(before);
    });

    test("no horizontal overflow at 360px", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(360);
    });
  });
}
