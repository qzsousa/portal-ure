/**
 * Primeiro acesso: código gerado pelo ADMIN + criação da senha pela pessoa.
 *
 * Reproduz no portal o fluxo que o SCE antigo tinha (verificar o e-mail →
 * primeiro acesso), com a etapa que faltava lá: um código que só o ADMIN pode
 * emitir. Sem ele o `/definir-senha` aceitaria "e-mail + senha nova" de
 * qualquer um, e quem soubesse o endereço institucional de um colega sem
 * senha tomava a conta.
 *
 * Não há envio de e-mail em lugar nenhum: o ADMIN lê o código na tela de
 * Usuários e repassa à pessoa, que o digita aqui.
 */

import { chamadosApi } from './http'
import type {
  ConfirmarCodigoResponse,
  DefinirSenhaPrimeiroAcessoRequest,
  LoginResponse,
  VerificarEmailResponse,
} from '@/types'

/**
 * Diz qual passo a tela de acesso deve mostrar para este e-mail.
 *
 * Nunca lança por e-mail inexistente: o backend responde `200` com
 * `primeiroAcesso: false` nesse caso, para não permitir enumerar contas.
 */
export async function verificarEmail(email: string): Promise<VerificarEmailResponse> {
  const { data } = await chamadosApi.post<VerificarEmailResponse>('/auth/verificar-email', {
    email: email.trim().toLowerCase(),
  })
  return data
}

/** Confere o código e recebe o token que libera a criação da senha. */
export async function confirmarCodigo(email: string, codigo: string): Promise<ConfirmarCodigoResponse> {
  const { data } = await chamadosApi.post<ConfirmarCodigoResponse>('/auth/primeiro-acesso/confirmar', {
    email: email.trim().toLowerCase(),
    codigo: codigo.trim(),
  })
  return data
}

/**
 * Cria a senha e devolve a sessão pronta.
 *
 * O backend já devolve `accessToken` e o cookie de refresh: quem acabou de
 * mostrar o código e de escolher a senha não precisa entrar de novo.
 */
export async function definirSenhaPrimeiroAcesso(
  payload: DefinirSenhaPrimeiroAcessoRequest,
): Promise<LoginResponse> {
  const { data } = await chamadosApi.post<LoginResponse>('/auth/primeiro-acesso/definir-senha', payload)
  return data
}