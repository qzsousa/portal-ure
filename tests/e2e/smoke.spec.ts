import { test, expect } from '@playwright/test'

test('portal carrega', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.*/)
})
