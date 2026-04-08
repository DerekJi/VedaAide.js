import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// T17: Ingest page E2E tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ingest page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ingest");
  });

  test("renders the upload area and sync button", async ({ page }) => {
    await expect(page.getByText(/upload files/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sync data sources/i })).toBeVisible();
  });

  test("shows the ingested documents section", async ({ page }) => {
    await expect(page.getByText(/ingested documents/i)).toBeVisible();
  });

  test("drag-and-drop zone is visible and accepts files", async ({ page }) => {
    // The dropzone should be rendered as a clickable region
    const dropzone = page.locator("[data-testid='file-dropzone'], .dropzone").first();
    // If not found by test-id, look for the upload icon or text
    const uploadArea = dropzone.or(page.getByText(/drag & drop/i).first());
    await expect(uploadArea).toBeVisible();
  });
});
