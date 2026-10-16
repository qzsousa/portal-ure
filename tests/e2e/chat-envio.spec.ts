import { test, expect } from '@playwright/test'
import { entrarComoAdmin } from './helpers/login'

/**
 * Regressão do envio pelo composer: a mensagem do usuário precisa aparecer na
 * tela e o campo limpar. Sem isso o Enter "não faz nada" — a chamada saía, mas
 * nada era renderizado.
 */
test('Enter envia a pergunta e mostra na conversa', async ({ page }) => {
  // a pergunta com tools varre a base inteira: 30 s de teste é pouco
  test.setTimeout(240_000)
  test.skip(!(await entrarComoAdmin(page)), 'sem PORTAL_EMAIL/PORTAL_SENHA')

  const pergunta = 'quantos chamados tem em aberto'
  await page.fill('.composer-field input', pergunta)
  await page.press('.composer-field input', 'Enter')

  // a bolha do usuário entra na tela e o campo esvazia
  await expect(page.locator('.msg.user .bubble')).toHaveText(pergunta, { timeout: 15000 })
  await expect(page.locator('.composer-field input')).toHaveValue('')

  // o modelo responde (ou avisa que não conseguiu) e o composer volta a aceitar
  await expect(page.locator('.msg.assistant .bubble').last()).toBeVisible({ timeout: 90000 })
  await expect(page.locator('.composer-field input')).toBeEnabled({ timeout: 90000 })

  // a segunda pergunta também entra: o composer não ficou travado
  await page.fill('.composer-field input', 'e quais escolas tem mais')
  await page.press('.composer-field input', 'Enter')
  await expect(page.locator('.msg.user .bubble')).toHaveCount(2, { timeout: 15000 })
})