import { test, expect } from '@playwright/test';

test.describe('Quality Gate Lab - E2E', () => {

  test('User can login successfully', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await page.fill('#email', 'qa@demo.com');
    await page.fill('#password', 'Password123');

    await page.click('#btnLogin');

    await expect(page.locator('#loginStatus'))
      .toHaveText(/Logged in as qa@demo.com/);
  });

  test('User can load products list', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await page.click('#btnLoad');

    await expect(page.locator('#products li')).toHaveCount(3);

  });

});
