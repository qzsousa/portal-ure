import { test, expect } from '@playwright/test'
import { entrarComoAdmin } from './helpers/login'

/**
 * Conversa nova automática.
 *
 * Quem abre o chat não precisa clicar em "Nova": a tela já entra numa conversa
 * limpa, e a anterior continua salva na lista. Conversa vazia não pode virar
 * lixo no histórico.
 */
test('abrir o chat ja cria uma conversa nova, sem clicar em Nova', async ({ page }) => {
  test.setTimeout(400_000)
  test.skip(!(await entrarComoAdmin(page)), 'sem PORTAL_EMAIL/PORTAL_SENHA')

  const conversaVazia = page.locator('.msg')
  // 1ª conversa: começa limpa
  await expect(conversaVazia).toHaveCount(0)

  await page.fill('.composer-field input', 'quais escolas tem mais chamados abertos')
  await page.press('.composer-field input', 'Enter')
  await expect(page.locator('.msg.user .bubble').first()).toBeVisible({ timeout: 20000 })

  // a conversa foi salva com o título da primeira pergunta
  await expect(page.locator('.conv-title').first()).toHaveText(/escolas tem mais chamad/i, { timeout: 20000 })
  await expect(page.locator('.conv')).toHaveCount(1)

  // 2ª visita: nova conversa em branco, sem clicar em nada
  await page.goto('/chat')
  await expect(page.locator('.msg')).toHaveCount(0, { timeout: 20000 })
  await expect(page.locator('.conv')).toHaveCount(2, { timeout: 20000 })

  // a conversa antiga continua salva, com a pergunta dentro
  await page.locator('.conv').nth(1).click()
  await expect(page.locator('.msg.user .bubble').first()).toHaveText(/escolas tem mais chamad/i, { timeout: 20000 })

  // recarregar sem perguntar nada não cria lixo
  await page.goto('/chat')
  await expect(page.locator('.conv')).toHaveCount(2, { timeout: 20000 })
})