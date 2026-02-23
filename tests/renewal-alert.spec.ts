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

  const sendModal = page.getByRole("button", { name: /^Invia$/ }).first();
  if (await sendModal.isVisible().catch(() => false)) {
    await sendModal.click();
  }

  await expect(saasRow.getByTestId("workflow-badge")).toContainText("AVVISATO");
});
