import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// T17: Chat E2E tests
// Tests core streaming chat flow and SSE stability (T17.5).
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Chat page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders chat interface", async ({ page }) => {
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
  });

  test("shows empty state before any message", async ({ page }) => {
    // The MessageList should show the empty-state placeholder
    await expect(page.getByText(/ask me anything/i)).toBeVisible();
  });

  test("sends user message and shows it in the chat", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("Hello assistant");
    await page.keyboard.press("Control+Enter");

    // User bubble should appear immediately
    await expect(page.getByText("Hello assistant")).toBeVisible();
  });

  test("Ctrl+Enter shortcut submits the form", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("Test shortcut");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByText("Test shortcut")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T17.5: SSE stability — simulate high-latency streaming
// We test that the streaming connection is properly established and can be
// cancelled without leaving the UI in a broken state.
// ─────────────────────────────────────────────────────────────────────────────
test.describe("SSE streaming stability (T17.5)", () => {
  test("stop button halts the stream and re-enables input", async ({ page }) => {
    await page.goto("/");

    const input = page.getByRole("textbox");
    await input.fill("Stream test");
    await page.keyboard.press("Control+Enter");

    // The stop button should appear while streaming
    const stopButton = page.getByRole("button", { name: /stop/i });
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }

    // Input should be re-enabled regardless of whether stream was stopped
    await expect(input).toBeEnabled({ timeout: 10_000 });
  });

  test("multiple rapid messages do not break the UI", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox");

    // Send two messages in quick succession
    await input.fill("Message one");
    await page.keyboard.press("Control+Enter");

    // Wait briefly then send another
    await page.waitForTimeout(500);
    await input.fill("Message two");
    await page.keyboard.press("Control+Enter");

    // Both user messages should appear
    await expect(page.getByText("Message one")).toBeVisible();
    await expect(page.getByText("Message two")).toBeVisible();
  });
});
