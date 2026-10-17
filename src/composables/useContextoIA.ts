import { ref } from 'vue'
import { chamadosApi } from '@/api/http'
import { listarEquipamentosGlobal, listarUnidadesResumo } from '@/api/sce'

/**
 * Contexto que a CaféIA leva para a IA: agregados dos DOIS backends do portal.
 *
 * Estado no módulo (e não dentro da view) porque o resumo é caro — varre todos
 * os chamados e todos os equipamentos — e o usuário não deve pagar esse custo
 * de novo a cada entrada na tela de chat. Carregado uma vez por sessão da aba,
 * reaproveitado por qualquer tela que precisar.
 *
 * Quem dispara o carregamento é o `App.vue`, logo na subida do portal: quando a
 * pessoa abrir o chat o resumo já está pronto (ou pelo menos em andamento).
 */

const resumo = ref('')
const carregando = ref(false)
const carregado = ref(false)
const status = ref('')

/** Roda uma única vez enquanto não houver resumo. Chamadas concorrentes compartilham a mesma promessa. */
let emVoo: Promise<void> | null = null

function ordenar(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
}

async function montarResumo() {
  // Agregados vêm do backend (SQL groupBy) em uma única chamada — sem paginação.
  // Equipamentos: /unidades-resumo já traz disponiveis por unidade (servidor);
  // /equipamentos-global?limite=1 traz total + porStatus agregado.
  const [resumoCh, unidadesResumo, rEq] = await Promise.all([
    chamadosApi.get('/ia/resumo'),
    listarUnidadesResumo(),
    listarEquipamentosGlobal({ limite: 1, offset: 0 }),
  ])

  const d = resumoCh.data || {}
  const statusChamados: Record<string, number> = d.statusChamados || {}
  const abertosPorEscola: Record<string, number> = d.abertosPorEscola || {}
  const resolvidosPorTecnico: Record<string, number> = d.resolvidosPorTecnico || {}
  const tecnicoEscolas: Record<string, string> = d.tecnicoEscolas || {}
  const totalCh = Number(d.totalCh ?? 0)

  const disponiveisPorUnidade: Record<string, number> = {}
  for (const u of unidadesResumo || []) {
    if (u && u.disponiveis > 0) disponiveisPorUnidade[u.nome] = u.disponiveis
  }
  const topDisp = Object.entries(disponiveisPorUnidade).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const totalEq = Number(rEq?.total ?? 0)
  const porStatusEq = rEq?.stats?.porStatus || {}

  resumo.value = [
    `TOTAL chamados: ${totalCh}`,
    `Chamados por status (geral): ${JSON.stringify(ordenar(statusChamados))}`,
    `Chamados abertos por escola: ${JSON.stringify(ordenar(abertosPorEscola))}`,
    `Chamados resolvidos por tecnico: ${JSON.stringify(ordenar(resolvidosPorTecnico))}`,
    `Tecnicos e escolas cadastradas (filial): ${JSON.stringify(tecnicoEscolas)}`,
    `EQUIPAMENTOS total: ${totalEq}`,
    `Equipamentos por status (geral): ${JSON.stringify(porStatusEq)}`,
    `Top 10 unidades por equipamentos disponiveis: ${JSON.stringify(topDisp)}`,
  ].join('\n')

  status.value = `Base carregada: ${totalCh} chamados, ${totalEq} equipamentos.`
}

async function carregar(forcar = false) {
  if (carregado.value && !forcar) return
  if (emVoo && !forcar) return emVoo
  if (forcar) {
    carregado.value = false
  }

  carregando.value = true
  status.value = 'Carregando base de dados...'
  emVoo = (async () => {
    try {
      await montarResumo()
      carregado.value = true
    } catch (e) {
      status.value = 'Erro ao carregar base de dados: ' + ((e as Error)?.message || e)
    } finally {
      carregando.value = false
      emVoo = null
    }
  })()
  return emVoo
}

export function useContextoIA() {
  return {
    resumo,
    carregando,
    carregado,
    status,
    carregar,
    recarregar: () => carregar(true),
  }
}