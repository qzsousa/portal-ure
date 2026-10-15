import { ref } from 'vue'
import { listarChamados } from '@/api/chamados'
import { listarUsuarios } from '@/api/usuarios'
import { listarEquipamentosGlobal } from '@/api/sce'

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
  const statusChamados: Record<string, number> = {}
  const abertosPorEscola: Record<string, number> = {}
  const resolvidosPorTecnico: Record<string, number> = {}

  let totalCh = 0
  let page = 1
  let paginas = 0
  while (paginas < 40) {
    const r = await listarChamados({ page, limit: 100 })
    const arr = r.data || []
    if (!arr.length) break
    totalCh = r.meta?.total ?? totalCh
    for (const c of arr) {
      const st = c.status || 'sem status'
      statusChamados[st] = (statusChamados[st] || 0) + 1
      if (st === 'ABERTO') abertosPorEscola[c.unidade] = (abertosPorEscola[c.unidade] || 0) + 1
      if (st === 'RESOLVIDO' && c.responsavel) {
        resolvidosPorTecnico[c.responsavel] = (resolvidosPorTecnico[c.responsavel] || 0) + 1
      }
    }
    page++
    paginas++
    if (arr.length < 100) break
  }

  //TECNICOS CADASTRADOS: quem atende quais escolas vem daqui (filial),
  // e nao do historico de chamados - uma escola pode ter tecnico sem chamado.
  const tecnicoEscolas: Record<string, string> = {}
  let pu = 1
  let puPaginas = 0
  while (puPaginas < 40) {
    const ru = await listarUsuarios({ page: pu, limit: 100 })
    const arrU = ru.data || []
    if (!arrU.length) break
    for (const u of arrU) {
      if (u.nivel === 'TECNICO' && u.filial) tecnicoEscolas[u.nome] = u.filial
    }
    pu++
    puPaginas++
    if (arrU.length < 100) break
  }

  //Top 10 unidades por equipamento disponivel: o SCE so devolve o agregado de
  // status geral, entao a contagem por unidade e feita aqui.
  const disponiveisPorUnidade: Record<string, number> = {}
  let off = 0
  let pp = 0
  while (pp < 60) {
    const re = await listarEquipamentosGlobal({ limite: 500, offset: off })
    const arrE = re.data || []
    if (!arrE.length) break
    for (const e of arrE) {
      if (String(e.status || '').toLowerCase().includes('dispon')) {
        disponiveisPorUnidade[e.unidade] = (disponiveisPorUnidade[e.unidade] || 0) + 1
      }
    }
    off += 500
    pp++
    if (arrE.length < 500) break
  }
  const topDisp = Object.entries(disponiveisPorUnidade).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const rEq = await listarEquipamentosGlobal({ limite: 1, offset: 0 })

  resumo.value = [
    `TOTAL chamados: ${totalCh}`,
    `Chamados por status (geral): ${JSON.stringify(ordenar(statusChamados))}`,
    `Chamados abertos por escola: ${JSON.stringify(ordenar(abertosPorEscola))}`,
    `Chamados resolvidos por tecnico: ${JSON.stringify(ordenar(resolvidosPorTecnico))}`,
    `Tecnicos e escolas cadastradas (filial): ${JSON.stringify(tecnicoEscolas)}`,
    `EQUIPAMENTOS total: ${rEq.total}`,
    `Equipamentos por status (geral): ${JSON.stringify(rEq.stats?.porStatus || {})}`,
    `Top 10 unidades por equipamentos disponiveis: ${JSON.stringify(topDisp)}`,
  ].join('\n')

  status.value = `Base carregada: ${totalCh} chamados, ${rEq.total} equipamentos.`
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