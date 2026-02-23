import { expect, test } from "@playwright/test";

const clientePath = process.env.E2E_CLIENTE_PATH || "/clienti/CLIENTE_E2E";

test("Invio avviso aggiorna stato a AVVISATO (E2E seed)", async ({ page }) => {
  await page.goto(clientePath);

  const table = page.getByTestId("renewals-table");
  await expect(table).toBeVisible();

  const saasRow = page.locator('[data-testid="renewal-row"][data-item-tipo="SAAS"]').first();
  await expect(saasRow).toBeVisible();

  await expect(saasRow.getByTestId("workflow-badge")).toContainText(/DA_AVVISARE|AVVISATO/i);

  await saasRow.getByTestId("send-alert-btn").click();

  const alertModalTitle = page
    .getByText(/Invia avviso rinnovi|Invia alert fatturazione rinnovi/i)
    .first();
  await expect(alertModalTitle).toBeVisible();

  await page.getByLabel(/Email manuale/i).check();
  await page.getByPlaceholder("Email").fill("qa-e2e@arttech.local");
  await page.getByRole("button", { name: /^Invia$/ }).first().click();

  await expect(saasRow.getByTestId("workflow-badge")).toContainText("AVVISATO");
});
