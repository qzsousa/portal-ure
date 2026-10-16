import { expect, type Page } from '@playwright/test'

/**
 * Login do portal pelo formulário de duas etapas (e-mail -> senha).
 *
 * As credenciais vêm do ambiente (`PORTAL_EMAIL` / `PORTAL_SENHA`): nada de
 * senha no repositório. Sem elas, devolve `null` e o chamador pula o teste.
 */
export async function entrarComoAdmin(page: Page): Promise<boolean> {
  const email = process.env.PORTAL_EMAIL
  const senha = process.env.PORTAL_SENHA
  if (!email || !senha) return false

  await page.goto('/login')
  await page.fill('#email', email)
  await page.click('button.login-submit')
  await page.waitForSelector('#senha', { timeout: 20000 })
  await page.fill('#senha', senha)
  await page.click('button:has-text("Entrar")')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })

  await page.goto('/chat')
  await expect(page.getByRole('button', { name: /Modelos NIM/i })).toBeVisible({ timeout: 20000 })
  return true
}