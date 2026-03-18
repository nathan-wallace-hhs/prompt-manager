const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('captures prompt explorer screenshot for Codex artifacts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Showing');

  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  await page.screenshot({
    path: path.join(artifactsDir, 'prompt-explorer.png'),
    fullPage: true,
  });
});
