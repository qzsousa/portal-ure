import { test, expect } from '@playwright/test'
import { entrarComoAdmin } from './helpers/login'

/**
 * Seletor de modelo da Caf&eacute;IA.
 *
 * Precisa de credencial de ADMIN: a rota `/api/ia/modelos` &eacute; do backend de
 * chamados. Sem `PORTAL_EMAIL`/`PORTAL_SENHA` no ambiente, o teste e pulado em
 * vez de falhar.
 */
test('lista, filtra e escolhe modelo NIM', async ({ page }) => {
  test.skip(!(await entrarComoAdmin(page)), 'sem PORTAL_EMAIL/PORTAL_SENHA')

  const resposta = page.waitForResponse((r) => r.url().includes('/ia/modelos'))
  await page.getByRole('button', { name: /Modelos NIM/i }).click()
  expect((await resposta).status()).toBe(200)

  const itens = page.locator('.model-item')
  await expect(itens.first()).toBeVisible()
  expect(await itens.count()).toBeGreaterThan(0)

  await page.fill('.model-search', 'glm')
  await expect(itens).toHaveCount(2)

  await itens.filter({ hasText: 'glm-5.3-flash' }).click()
  await expect(page.locator('.model-atual')).toHaveText(/glm-5.3-flash/)
})