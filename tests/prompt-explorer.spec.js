const { test, expect } = require('@playwright/test');

const FAVORITES_STORAGE_KEY = 'aspaPromptExplorer.favorites.v1';

async function waitForLoadedState(page) {
  await expect(page.getByRole('status')).toContainText('Showing');
  await expect(page.locator('#prompt-list .prompt-card')).toHaveCount(21);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoadedState(page);
});

test('renders prompts and opens a prompt from the list', async ({ page }) => {
  const targetCard = page.locator('.prompt-card', { hasText: 'Heuristic Review' });
  await targetCard.click();

  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#viewer-title')).toHaveText('Heuristic Review');
  await expect(page.locator('#viewer-meta')).toContainText('Category: Evaluation');
  await expect(page).toHaveURL(/selectedPath=prompts%2Fevaluation%2Fheuristic-review\.md/);
});

test('search filter syncs URL and opens the first matching result', async ({ page }) => {
  const searchInput = page.getByLabel('Search prompts');
  await searchInput.fill('sql');

  await expect(page.locator('#prompt-list .prompt-card')).toHaveCount(1);
  await expect(page.locator('#viewer-title')).toHaveText('Content Analytics Query Builder');
  await expect(page.getByRole('status')).toContainText('Showing 1 of 21 prompts.');

  await expect(page).toHaveURL(/search=sql/);
  await expect(page).toHaveURL(/selectedPath=prompts%2Fcoding%2Fsql-query-builder\.md/);
});

test('favorites only mode persists and can be restored after reload', async ({ page }) => {
  const targetPath = 'prompts/research/interview-guide-generator.md';
  const card = page.locator('.prompt-card', { hasText: 'Interview Guide Generator' });

  await card.getByRole('button', { name: /Save Interview Guide Generator for quick access/i }).click();
  await page.locator('#show-favorites-only').check();

  await expect(page.locator('#prompt-list .prompt-card')).toHaveCount(1);
  await expect(page.locator('.prompt-card')).toContainText('Interview Guide Generator');

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), FAVORITES_STORAGE_KEY);
  expect(saved).toContain(targetPath);

  await page.reload();
  await expect(page.getByRole('status')).toContainText('Showing');

  await page.locator('#show-favorites-only').check();
  await expect(page.locator('#prompt-list .prompt-card')).toHaveCount(1);
  await expect(page.locator('.prompt-card')).toContainText('Interview Guide Generator');
});

test('supports keyboard navigation in results list', async ({ page }) => {
  const resultsList = page.locator('#prompt-list');
  await resultsList.focus();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#viewer-title')).toHaveText('HHS ASPA Digital Improvement Ideation');
  await expect(page.locator('.prompt-card[data-selected="true"]')).toContainText('HHS ASPA Digital Improvement Ideation');
});

test('loads selected prompt from URL state', async ({ page }) => {
  await page.goto('/?selectedPath=prompts%2Fsupport%2Fcustomer-support-reply.md&sort=path-asc&category=not-real');

  await expect(page.getByRole('status')).toContainText('Showing');
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#viewer-title')).toHaveText('Internal Stakeholder Response Draft');

  await expect(page.locator('#category')).toHaveValue('');
  await expect(page.locator('#sort')).toHaveValue('path-asc');
});
