import { expect, test } from "@playwright/test";

test("Duplica progetto: modal, conferma, redirect e task reset", async ({ page }) => {
  await page.goto("/");

  const dupBtn = page.getByTestId("project-duplicate-btn").first();
  if ((await dupBtn.count()) === 0) {
    test.skip(true, "Nessun progetto disponibile in dashboard per duplicazione");
  }
  await dupBtn.click();

  const modal = page.getByTestId("duplicate-modal");
  await expect(modal).toBeVisible();

  await modal.getByTestId("duplicate-name-input").fill(`COPIA E2E ${Date.now()}`);
  await modal.getByTestId("duplicate-confirm-btn").click();

  await expect(page).toHaveURL(/\/checklists\/.+/);
  await expect(page.getByText("DA FARE").first()).toBeVisible();
});
