import { expect, test } from "@playwright/test";

// P3.3: la pagina /registrazione deve precompilare l'email dal deep-link ?email=
// (CTA landing LedCare / onboarding). Nessuna scrittura DB: il POST parte solo su submit.
test("registrazione precompila l'email dal query param", async ({ page }) => {
  await page.goto("/registrazione?email=cliente.e2e%40example.com");

  const emailInput = page.locator("#reg-email");
  await expect(emailInput).toBeVisible();
  await expect(emailInput).toHaveValue("cliente.e2e@example.com");
});

test("registrazione senza query param lascia l'email vuota", async ({ page }) => {
  await page.goto("/registrazione");

  const emailInput = page.locator("#reg-email");
  await expect(emailInput).toBeVisible();
  await expect(emailInput).toHaveValue("");
});
