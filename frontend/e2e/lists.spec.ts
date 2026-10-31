import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { tileFitProblems } from './helpers';

interface State {
  shopping: { id: string; title: string }[];
  todos: { id: string; title: string }[];
  categories: { id: string; builtin: boolean }[];
}

const uuid = () => crypto.randomUUID();

async function readState(request: APIRequestContext): Promise<State> {
  return (await (await request.get('/api/v1/lists')).json()) as State;
}

async function resetLists(request: APIRequestContext): Promise<void> {
  const state = await readState(request);
  for (const item of [...state.shopping, ...state.todos])
    await request.delete(`/api/v1/lists/items/${item.id}`);
  for (const category of state.categories.filter(
    (entry) => !entry.builtin && !/^[a-z-]+$/.test(entry.id),
  )) {
    await request.delete(`/api/v1/lists/categories/${category.id}`);
  }
}

async function fill(request: APIRequestContext, shopping: number, todos: number): Promise<void> {
  for (let index = 0; index < shopping; index += 1) {
    await request.post('/api/v1/lists/items', {
      data: { id: uuid(), list: 'shopping', title: `Artikel ${index} mit einem langen Namen` },
    });
  }
  for (let index = 0; index < todos; index += 1) {
    const response = await request.post('/api/v1/lists/items', {
      data: {
        id: uuid(),
        list: 'todo',
        title: `Aufgabe ${index} mit einem sehr langen Titel für den Test der Zeilenkürzung`,
        categoryId: index % 2 === 0 ? 'wohnzimmer' : 'buero',
        priority: ['high', 'medium', 'low'][index % 3],
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
}

// All tests share one real backend and database, so they must not run in parallel.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => resetLists(request));
test.afterEach(async ({ request }) => resetLists(request));

const tile = (page: Page) => page.getByRole('region', { name: 'Einkaufsliste & To-dos' });
const column = (page: Page, name: string) => tile(page).getByRole('region', { name, exact: true });
const openDetail = async (page: Page) => {
  await page.goto('/');
  await expect(column(page, 'Einkauf')).toBeVisible();
  await page.waitForTimeout(1200);
  await tile(page).getByRole('button', { name: 'Listen öffnen' }).click();
  return page.getByRole('dialog', { name: 'Listen öffnen' });
};

// Covers: FR-2, FR-5, FR-7, FR-12, NFR-2, AC-8, AC-9, AC-12, AC-36, AC-37, AC-43, AC-52, AC-53, AC-54
test.describe('lists on the wall tablet', () => {
  test('adds, checks and removes entries through the detail view', async ({ page }) => {
    const dialog = await openDetail(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Was fehlt?' }).fill('Käse');
    await dialog.getByRole('textbox', { name: 'Was fehlt?' }).press('Enter');
    const row = dialog.getByTestId('editor-row').filter({ hasText: 'Käse' });
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').click({ delay: 120 });
    await expect(row.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    await row.getByRole('button', { name: /Löschen/ }).click();
    await expect(dialog.getByRole('status')).toContainText('Eintrag entfernt');
    await dialog.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(dialog.getByTestId('editor-row').filter({ hasText: 'Käse' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Zurück' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('adds a to-do with category and priority and shows it on the tile', async ({ page }) => {
    const dialog = await openDetail(page);
    await dialog.getByRole('button', { name: 'Aufgabe hinzufügen' }).click();
    const sheet = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await sheet.getByLabel('Aufgabe', { exact: true }).fill('Regal aufbauen');
    await sheet.getByLabel('Kategorie').selectOption('balkon');
    await sheet.getByRole('radio', { name: 'Hoch' }).check({ force: true });
    await sheet.getByRole('button', { name: 'Hinzufügen' }).click();
    await dialog.getByRole('button', { name: 'Zurück' }).click();
    const row = column(page, 'To-dos')
      .getByTestId('list-row')
      .filter({ hasText: 'Regal aufbauen' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Balkon');
  });

  test('shows a change from a second browser context within 30 seconds', async ({
    page,
    browser,
    request,
  }) => {
    await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') });
    await page.goto('/');
    await expect(column(page, 'Einkauf')).toBeVisible();
    const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const otherPage = await other.newPage();
    await otherPage.request.post('/api/v1/lists/items', {
      data: { id: uuid(), list: 'shopping', title: 'Von nebenan' },
    });
    await page.clock.runFor(31_000);
    await expect(
      column(page, 'Einkauf').getByTestId('list-row').filter({ hasText: 'Von nebenan' }),
    ).toBeVisible();
    await other.close();
    expect((await readState(request)).shopping.some((item) => item.title === 'Von nebenan')).toBe(
      true,
    );
  });

  test('closes the detail view after two minutes without input and with Escape', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') });
    const dialog = await openDetail(page);
    await expect(dialog).toBeVisible();
    await page.clock.runFor(125_000);
    await expect(dialog).toHaveCount(0);
    await tile(page).getByRole('button', { name: 'Listen öffnen' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('has check circles of at least 56px and no text below 28px in the tile', async ({
    page,
    request,
  }) => {
    await fill(request, 3, 3);
    await page.goto('/');
    await expect(column(page, 'Einkauf').getByTestId('list-row').first()).toBeVisible();
    await page.waitForTimeout(1200);
    const heights = await column(page, 'Einkauf')
      .getByRole('checkbox')
      .evaluateAll((boxes) => boxes.map((box) => box.getBoundingClientRect().height));
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(55.5);
    const small = await tile(page).evaluate((section) =>
      Array.from(section.querySelectorAll('*'))
        .filter((element) => !element.closest('.sr-only, [class*="sr-only"], [aria-hidden="true"]'))
        .filter(
          (element) => element.children.length === 0 && (element.textContent ?? '').trim() !== '',
        )
        .map((element) => ({
          text: (element.textContent ?? '').slice(0, 20),
          size: parseFloat(getComputedStyle(element).fontSize),
        }))
        .filter((entry) => entry.size < 27.9),
    );
    expect(small).toEqual([]);
  });

  test('makes no request to any other origin', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (!['127.0.0.1', 'localhost'].includes(host)) foreign.push(host);
    });
    await openDetail(page);
    expect(foreign).toEqual([]);
  });

  for (const size of [
    { width: 1024, height: 750 },
    { width: 1180, height: 700 },
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
    { width: 2048, height: 1536 },
  ]) {
    test(`keeps 30 to-dos and long titles inside the card at ${size.width}x${size.height}`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize(size);
      await fill(request, 12, 30);
      await page.goto('/');
      await expect(column(page, 'To-dos').getByRole('button', { name: /weitere/ })).toBeVisible();
      await expect.poll(() => tileFitProblems(page), { timeout: 5000 }).toEqual([]);
      await expect(column(page, 'To-dos').getByRole('heading', { level: 3 })).toContainText('30');
    });
  }
});

// Covers: FR-7, AC-35, AC-38, AC-51
test.describe('list page on the phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('opens at /listen without horizontal scrolling and adds an entry with suggestions', async ({
    page,
    request,
  }) => {
    await fill(request, 2, 4);
    await page.goto('/listen');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Einkaufsliste & To-dos' }),
    ).toBeVisible();
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const chips = await page
      .getByRole('button', { name: /Alle Kategorien/ })
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    for (const height of chips) expect(height).toBeGreaterThanOrEqual(43.5);
    const input = page.getByRole('textbox', { name: 'Was fehlt?' });
    await input.fill('Butter');
    await input.press('Enter');
    await expect(page.getByTestId('editor-row').filter({ hasText: 'Butter' })).toBeVisible();
    await input.fill('butt');
    await expect(page.getByTestId('suggestion')).toHaveCount(0); // Butter is open, so it is not offered again
    expect((await readState(request)).shopping.some((item) => item.title === 'Butter')).toBe(true);
  });

  test('filters the to-dos by category and shows the counts', async ({ page, request }) => {
    await fill(request, 0, 6);
    await page.goto('/listen');
    await expect(page.getByText('6 offen')).toBeVisible();
    await page.getByRole('button', { name: /Büro/ }).click();
    await expect(page.getByTestId('editor-row')).toHaveCount(3);
  });
});
