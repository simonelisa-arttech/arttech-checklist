import { expect, test } from "@playwright/test";

const clientePath = process.env.E2E_CLIENTE_PATH || "/clienti/CLIENTE_E2E";

test("GARANZIA può diventare NON_RINNOVATO senza errori", async ({ page }) => {
  await page.goto(clientePath);

  const garanziaRow = page.locator('[data-testid="renewal-row"][data-item-tipo="GARANZIA"]').first();
  await expect(garanziaRow).toBeVisible();

  await garanziaRow.getByTestId("set-status-NON_RINNOVATO").click();

  await expect(page.getByText(/violates check constraint/i)).toHaveCount(0);
  await expect(garanziaRow.getByTestId("workflow-badge")).toContainText(/NON_RINNOVATO|SCADUTO/i);
});
