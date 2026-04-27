import { expect, test } from "@playwright/test";

const clientePath = process.env.E2E_CLIENTE_PATH || "/clienti/CLIENTE_E2E";

test("Invio avviso aggiorna stato a AVVISATO (E2E seed)", async ({ page }) => {
  await page.goto(clientePath);

  await expect(page.getByRole("heading", { name: "Scadenze & Rinnovi" })).toBeVisible();

  const fullManagement = page.getByText("Gestione completa scadenze e rinnovi").first();
  await expect(fullManagement).toBeVisible();
  await fullManagement.click();

  const table = page.getByTestId("renewals-table");
  await expect(table).toBeVisible();

  const saasRow = page.locator('[data-testid="renewal-row"][data-item-tipo="SAAS"]').first();
  await expect(saasRow).toBeVisible();

  await expect(saasRow.getByTestId("workflow-badge")).toContainText(/DA_AVVISARE|AVVISATO/i);

  await saasRow.getByTestId("send-alert-btn").click();

  const alertModalTitle = page
    .getByText(/^Invia avviso scadenza$/i)
    .first();
  await expect(alertModalTitle).toBeVisible();

  const modal = page.getByTestId("renewals-alert-modal");
  await expect(modal).toBeVisible();
  await page.waitForLoadState("networkidle");

  const manualEmailRadio = modal.locator('input[name="renewals-alert-art-tech-mode"]').nth(1);
  await manualEmailRadio.click({ force: true });
  await expect(manualEmailRadio).toBeChecked();
  await expect(modal.getByPlaceholder("Email")).toBeVisible();
  await modal.getByPlaceholder("Email").fill("qa-e2e@arttech.local");
  await modal.getByRole("button", { name: /^Invia$/ }).click();

  await expect(saasRow.getByTestId("workflow-badge")).toContainText("AVVISATO");
});
