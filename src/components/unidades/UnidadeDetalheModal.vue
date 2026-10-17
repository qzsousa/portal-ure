<script setup lang="ts">
/**
 * Detalhe de UMA unidade escolar (na prática, um prédio do grupo mãe/irmã).
 *
 * Duas bandas de métrica em vez de três listas: o parque tem um número-herói
 * (o total é o número que a pessoa procura) com a proporção embaixo; chamados
 * e usuários ficam na mesma fileira, com o MESMO peso visual — antes eram
 * grupos separados e a pessoa tinha que varrer a tela para achar o número.
 *
 * Os KPIs são os mesmos que a tabela já carregou — nada aqui busca por padrão.
 * O DRILL-DOWN só busca quando a pessoa clica num KPI: equipamentos e usuários
 * vêm dos dois backends, chamados do de chamados. Nada de contrato novo.
 *
 * A caixa é larga de propósito: o uso é de mesa (monitor), com a lista do
 * recorte logo abaixo das métricas.
 */
import { computed, ref, watch } from 'vue'
import { ClipboardList, Loader2, Users, X } from '@lucide/vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { ROTULO_INVENTARIO, type UnidadePainel } from '@/api/escolas'
import { listarChamados, STATUS_FLUXO, rotuloStatusChamado } from '@/api/chamados'
import { listarEquipamentosGlobal } from '@/api/sce'
import { listarUsuarios } from '@/api/usuarios'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { chaveEscola } from '@/utils/escola'
import { buscarLinkInternetPorEscola } from '@/utils/linksInternet'
import { formatDateTime } from '@/utils/format'
import type { LinkInternetUnidade } from '@/data/linksInternetData'
import { apiError } from '@/utils/apiError'
import { rotuloPerfil, type Chamado, type Equipamento, type StatusChamado, type User } from '@/types'

/** Parque do prédio, mesclado do resumo do SCE (ver `mesclarEquipamentos`). */
interface EquipUnidade {
  total: number
  disponiveis: number
  manutencao: number
  quebrados: number
  extraviados: number
}

const props = defineProps<{
  aberto: boolean
  unidade: (UnidadePainel & { cie: string; equip: EquipUnidade }) | null
}>()

const emit = defineEmits<{ (e: 'fechar'): void }>()

const auth = useAuthStore()
const ui = useUiStore()

/**
 * Copia o CIE.
 *
 * DEFESA: `navigator.clipboard` só existe em contexto SEGURO (https ou
 * localhost). Aberta por IP em http — como o portal é acessado na rede interna
 * — a API não existe e o clique viraria no-op silencioso. O caminho legado com
 * um `<textarea>` fora da tela é o mesmo fallback que os navegadores aceitam
 * fora do secure context.
 */
async function copiarCie() {
  const cie = props.unidade?.cie
  if (!cie) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(cie)
    } else {
      const area = document.createElement('textarea')
      area.value = cie
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      if (!ok) throw new Error('execCommand indisponível')
    }
    ui.success(`CIE ${cie} copiado.`)
  } catch {
    ui.error('Não foi possível copiar. Selecione o código e copie com Ctrl+C.')
  }
}

/**
 * `/usuarios` é ADMIN + GESTOR (ver `router/index.ts`), mas esta tela é
 * ADMIN + TECNICO. O cartão fica visível com o número — esconder o KPI só
 * confunde — mas não é clicável para quem levaria 403.
 */
const podeListarUsuarios = computed(() => auth.user?.nivel === 'ADMIN' || auth.user?.nivel === 'GESTOR')

const linksInternet = computed(() => {
  const u = props.unidade
  if (!u) return [] as { nome: string; link: LinkInternetUnidade }[]
  const nomes = [u.nome, u.irma].filter((n): n is string => !!n && !!n.trim())
  const out: { nome: string; link: LinkInternetUnidade }[] = []
  const vistos = new Set<string>()
  for (const nome of nomes) {
    const link = buscarLinkInternetPorEscola(nome)
    if (link && !vistos.has(link.escola)) {
      vistos.add(link.escola)
      out.push({ nome, link })
    }
  }
  return out
})

function firewallUrl(cie: string | null): string | null {
  const code = (cie || '').trim()
  return code ? `https://fw-${code}/login` : null
}

function abrirFirewall(cie: string | null) {
  const url = firewallUrl(cie)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

type Painel = 'equipamentos' | 'chamados' | 'usuarios'

const painel = ref<Painel | null>(null)
const carregando = ref(false)
const erro = ref('')

/* ---------- Identificação ---------- */

const inventario = computed(() => {
  const s = props.unidade?.inventarioStatus || ''
  return ROTULO_INVENTARIO[s] || s || 'Não informado'
})

function pct(parte: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((parte / total) * 100)}%`
}

/* ---------- KPIs ----------
 *
 * `statusSce` é o valor EXATO que o SCE usa no campo `status` do equipamento
 * (o mesmo vocabulário de EquipamentosView → "Alterar status em lote").
 * `statusChamado` é o enum do backend de chamados.
 */
interface Kpi {
  chave: string
  rotulo: string
  valor: number
  tom: 'blue' | 'green' | 'yellow' | 'red' | 'slate' | 'purple'
  detail: string
  /** Palavra ao lado do número: distingue "3 ativos" de "3 no total". */
  sufixo?: string
  statusSce?: string
  statusChamado?: StatusChamado | ''
  indisponivel?: boolean
}

/** Número-herói do parque. Sem `statusSce` = abre a lista inteira. */
const kpiParqueTotal = computed<Kpi | null>(() => {
  const e = props.unidade?.equip
  if (!e) return null
  return { chave: 'total', rotulo: 'no prédio', valor: e.total, tom: 'blue', detail: 'Ver todos' }
})

const kpiParqueEstados = computed<Kpi[]>(() => {
  const e = props.unidade?.equip
  if (!e) return []
  return [
    { chave: 'disp', rotulo: 'Disponíveis', valor: e.disponiveis, tom: 'green', detail: pct(e.disponiveis, e.total), statusSce: 'Disponível' },
    { chave: 'man', rotulo: 'Manutenção', valor: e.manutencao, tom: 'yellow', detail: pct(e.manutencao, e.total), statusSce: 'Manutenção' },
    { chave: 'que', rotulo: 'Quebrados', valor: e.quebrados, tom: 'red', detail: pct(e.quebrados, e.total), statusSce: 'Quebrado' },
    { chave: 'ext', rotulo: 'Extraviados', valor: e.extraviados, tom: 'slate', detail: pct(e.extraviados, e.total), statusSce: 'Extraviado' },
  ]
})

const kpiChamados = computed<Kpi[]>(() => {
  const u = props.unidade
  if (!u) return []
  const encerrados = Math.max(u.chamadosTotal - u.chamadosAbertos, 0)
  return [
    { chave: 'cham', rotulo: 'Chamados', valor: u.chamadosTotal, tom: 'blue', detail: 'Histórico completo' },
    { chave: 'abertos', rotulo: 'Em aberto', valor: u.chamadosAbertos, tom: 'red', detail: pct(u.chamadosAbertos, u.chamadosTotal) },
    {
      chave: 'encerrados',
      rotulo: 'Encerrados',
      valor: encerrados,
      tom: 'green',
      detail: pct(encerrados, u.chamadosTotal),
      statusChamado: 'RESOLVIDO',
    },
  ]
})

const kpiUsuarios = computed<Kpi | null>(() => {
  const u = props.unidade
  if (!u) return null
  const exato = usuariosExatos.value
  return {
    chave: 'usuarios',
    rotulo: 'Usuários',
    valor: exato ? usuariosDaEscolaAtivos.value : u.usuariosAtivos,
    sufixo: 'ativos',
    tom: 'purple',
    detail: !podeListarUsuarios.value
      ? 'Só ADMIN e GESTOR'
      : exato
        ? 'Ver lista'
        : 'Contagem do painel',
    indisponivel: !podeListarUsuarios.value,
  }
})

/** Segmentos da barra de proporção. A sobra fica no trilho — ver o aviso no painel. */
const segmentosParque = computed(() => kpiParqueEstados.value.map((k) => ({ ...k, tom: k.tom })))

/* ---------- Estado do drill-down ---------- */

const PAGE = 20

const equipLista = ref<Equipamento[]>([])
const equipTotal = ref(0)
const equipPagina = ref(1)
const equipStatus = ref('')
const equipAviso = ref('')

const chamadosLista = ref<Chamado[]>([])
const chamadosTotal = ref(0)
const chamadosPagina = ref(1)
const chamadosStatus = ref<StatusChamado | ''>('')
const chamadosAviso = ref('')

const usuariosLista = ref<User[]>([])
const usuariosPagina = ref(1)
const usuariosAviso = ref('')
/** A lista já veio do servidor? Sem isso o tile mostraria 0 em vez de "ainda não sei". */
const usuariosCarregados = ref(false)

/* ---------- Carregamento ---------- */

/**
 * Nomes que o SCE pode estar usando para o mesmo prédio.
 *
 * A tela de unidades já conta o equipamento cadastrado tanto no nome da mãe
 * quanto no do grupo (`mesclarEquipamentos`), então o drill-down precisa
 * consultar os mesmos nomes — senão o KPI diria 61 e a lista mostraria 0.
 */
function nomesDoPredio(): string[] {
  const u = props.unidade
  if (!u) return []
  return [...new Set([u.nome, u.grupo, u.irma].filter((n): n is string => !!n && !!n.trim()))]
}

/** Teto por nome na consulta ao SCE. Acima disso a lista nasce incompleta. */
const LIMITE_SCE = 300

async function carregarEquipamentos() {
  const nomes = nomesDoPredio()
  if (!nomes.length) return
  carregando.value = true
  erro.value = ''
  equipAviso.value = ''
  try {
    const respostas = await Promise.all(
      nomes.map((nome) =>
        listarEquipamentosGlobal({
          unidade: nome,
          status: equipStatus.value || undefined,
          limite: LIMITE_SCE,
        }),
      ),
    )
    const vistos = new Map<string, Equipamento>()
    let truncou = false
    for (const r of respostas) {
      if (r.total > r.data.length) truncou = true
      for (const eq of r.data) if (!vistos.has(eq.id)) vistos.set(eq.id, eq)
    }
    equipLista.value = [...vistos.values()].sort((a, b) =>
      `${a.categoria} ${a.marca} ${a.modelo}`.localeCompare(`${b.categoria} ${b.marca} ${b.modelo}`, 'pt-BR'),
    )
    equipTotal.value = equipLista.value.length
    if (truncou) {
      equipAviso.value = `O SCE tem mais de ${LIMITE_SCE} equipamentos neste recorte — a lista mostra só os ${equipTotal.value} primeiros.`
    }
  } catch (e) {
    equipLista.value = []
    equipTotal.value = 0
    erro.value = apiError(e, 'Não foi possível carregar os equipamentos desta unidade.')
  } finally {
    carregando.value = false
  }
}

/**
 * Chamados: só o nome da própria escola.
 *
 * DEFESA: quando o prédio é compartilhado, o KPI acima é do GRUPO (vem de
 * `/escolas/painel`) mas `/chamados?unidade=` casa um nome só. A diferença é
 * dita na tela em vez de a lista parecer completa e estar faltando coisa.
 */
async function carregarChamados() {
  const u = props.unidade
  if (!u) return
  carregando.value = true
  erro.value = ''
  try {
    const r = await listarChamados({
      unidade: u.nome,
      status: chamadosStatus.value || '',
      page: chamadosPagina.value,
      limit: PAGE,
    })
    chamadosLista.value = r.data
    chamadosTotal.value = r.meta.total
    chamadosAviso.value = u.irma
      ? `Filtro aplicado apenas a "${u.nome}": a API de chamados não aceita o grupo, então os chamados da irmã (${u.irma}) não entram nesta lista.`
      : ''
  } catch (e) {
    chamadosLista.value = []
    chamadosTotal.value = 0
    erro.value = apiError(e, 'Não foi possível carregar os chamados desta unidade.')
  } finally {
    carregando.value = false
  }
}

/**
 * Usuários: busca por `filial` e refina no cliente.
 *
 * DEFESA: o backend casa `filial` por `contains` — e "E.E. A" é substring de
 * "E.E. ANDRÉ NUNES JUNIOR". Sem o refinamento por `chaveEscola`, a lista
 * traria usuário de outra escola. A paginação é no cliente de propósito: são
 * duas requisições curtas (uma por escola do prédio), não uma por página.
 */
const LIMITE_USUARIOS = 200

/**
 * Unidades às quais o usuário pertence.
 *
 * DEFESA: `filial` NÃO é uma escola só. O TÉCNICO carrega uma lista separada
 * por vírgula ("E.E. ADHEMAR ANTONIO PRADO, E.E. BELIZE") — é o mesmo formato
 * que `separarUnidades` quebra em `UsuariosView` — e `grupo` traz o composto do
 * prédio ("E.E. A / E.E. B"). Comparar o `filial` INTEIRO com o nome da escola
 * descartava exatamente quem atende a escola: o KPI marcava 3 usuários e a
 * lista trazia 2, porque o técnico que cobre Adhemar junto com outras
 * escolas não casava com nenhuma chave.
 */
function unidadesDoUsuario(usr: User): string[] {
  return [usr.filial, usr.grupo || '']
    .flatMap((texto) => texto.split(/[,/]/))
    .map((t) => t.trim())
    .filter(Boolean)
}

async function carregarUsuarios(silencioso = false) {
  const nomes = nomesDoPredio()
  if (!nomes.length) return
  carregando.value = true
  // No carregamento de fundo (só para contar) o erro não é mostrado: o painel
  // nem está aberto, e um erro guardado "explodiria" na tela ao abrir depois.
  if (!silencioso) {
    erro.value = ''
    usuariosAviso.value = ''
  }
  try {
    const respostas = await Promise.all(
      nomes.map((nome) => listarUsuarios({ filial: nome, page: 1, limit: LIMITE_USUARIOS })),
    )
    const alvo = new Set(nomes.map(chaveEscola))
    const vistos = new Map<string, User>()
    let truncou = false
    for (const r of respostas) {
      if (r.meta.total > r.data.length) truncou = true
      for (const usr of r.data) {
        if (vistos.has(usr.id)) continue
        if (!unidadesDoUsuario(usr).some((nome) => alvo.has(chaveEscola(nome)))) continue
        vistos.set(usr.id, usr)
      }
    }
    usuariosLista.value = [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    usuariosCarregados.value = true
    if (truncou && !silencioso) {
      usuariosAviso.value = `Há mais de ${LIMITE_USUARIOS} usuários neste recorte — a lista mostra só os primeiros.`
    }
  } catch (e) {
    usuariosLista.value = []
    if (!silencioso) erro.value = apiError(e, 'Não foi possível carregar os usuários desta unidade.')
  } finally {
    carregando.value = false
  }
}

/* ---------- Como se conta "usuário da unidade" ----------
 *
 * DEFESA: o `usuariosAtivos` do `/escolas/painel` inclui o TÉCNICO atendente,
 * porque para a cota da Matriz ele é uma vaga ocupada (ver
 * `LIMITE_USUARIOS_UNIDADE` em `UsuariosView`). Para quem pergunta "quantas
 * pessoas usam esta escola", o técnico não é usuário da escola — e ver "3
 * ativos" e depois achar o técnico na lista é pior que um número menor.
 *
 * Por isso o tile conta a lista, não o painel. Quem não pode listar
 * (técnico logado) fica com o número do painel, marcado como tal.
 */
const usuariosDaEscolaAtivos = computed(
  () => usuariosLista.value.filter((u) => u.status !== 'INATIVO' && u.nivel !== 'TECNICO').length,
)
const usuariosTecnicos = computed(() => usuariosLista.value.filter((u) => u.nivel === 'TECNICO').length)
const usuariosInativos = computed(() => usuariosLista.value.filter((u) => u.status === 'INATIVO').length)

const usuariosExatos = computed(() => podeListarUsuarios.value && usuariosCarregados.value)

/** Conciliação no cabeçalho da lista: a soma fecha com o que a pessoa vê. */
const usuariosResumo = computed(() => {
  const partes = [`${usuariosDaEscolaAtivos.value} ativo(s) da escola`]
  if (usuariosTecnicos.value) partes.push(`${usuariosTecnicos.value} atendente(s)`)
  if (usuariosInativos.value) partes.push(`${usuariosInativos.value} inativo(s)`)
  return partes.join('  ·  ')
})

/* ---------- Navegação entre painéis ---------- */

function abrirKpi(p: Painel, k: Kpi) {
  if (k.indisponivel) return
  if (p === 'equipamentos') {
    equipStatus.value = k.statusSce || ''
    equipPagina.value = 1
  } else if (p === 'chamados') {
    chamadosStatus.value = k.statusChamado || ''
    chamadosPagina.value = 1
  } else {
    usuariosPagina.value = 1
  }
  painel.value = p
  erro.value = ''
  if (p === 'equipamentos') void carregarEquipamentos()
  else if (p === 'chamados') void carregarChamados()
  else void carregarUsuarios()
}

function fecharPainel() {
  painel.value = null
  erro.value = ''
}

/** Recorte exibido. São três computeds separados (e não um só) porque cada
 *  painel tem um tipo de linha — um union forçaria `v-for` sem tipar. */
function fatiar<T>(lista: T[], pagina: number): T[] {
  const ini = pagina <= 0 ? 0 : (pagina - 1) * PAGE
  return lista.slice(ini, ini + PAGE)
}

const usuariosCorte = computed(() => fatiar(usuariosLista.value, usuariosPagina.value))
const equipCorte = computed(() => fatiar(equipLista.value, equipPagina.value))
/** Os chamados já vêm paginados pelo servidor — a página é a resposta inteira. */
const chamadosCorte = computed(() => chamadosLista.value)

const totalPainel = computed(() => {
  if (painel.value === 'usuarios') return usuariosLista.value.length
  if (painel.value === 'chamados') return chamadosTotal.value
  return equipTotal.value
})

const paginaAtual = computed(() => {
  if (painel.value === 'usuarios') return usuariosPagina.value
  if (painel.value === 'chamados') return chamadosPagina.value
  return equipPagina.value
})

function irParaPagina(p: number) {
  if (painel.value === 'usuarios') usuariosPagina.value = p
  else if (painel.value === 'chamados') {
    chamadosPagina.value = p
    void carregarChamados()
  } else {
    equipPagina.value = p
    void carregarEquipamentos()
  }
}

function mudarStatusEquip(status: string) {
  equipStatus.value = status
  equipPagina.value = 1
  void carregarEquipamentos()
}

function mudarStatusChamado(status: string) {
  chamadosStatus.value = status as StatusChamado | ''
  chamadosPagina.value = 1
  void carregarChamados()
}

const tituloPainel = computed(() => {
  if (painel.value === 'equipamentos') return equipStatus.value ? `Equipamentos — ${equipStatus.value}` : 'Equipamentos do prédio'
  if (painel.value === 'chamados') return 'Chamados da unidade'
  return 'Usuários da unidade'
})

/** Trocar de unidade descarta o recorte: número de página de outra escola não vale. */
watch(
  () => props.unidade?.nome,
  () => {
    painel.value = null
    equipLista.value = []
    equipTotal.value = 0
    equipPagina.value = 1
    equipStatus.value = ''
    equipAviso.value = ''
    chamadosLista.value = []
    chamadosTotal.value = 0
    chamadosPagina.value = 1
    chamadosStatus.value = ''
    chamadosAviso.value = ''
    usuariosLista.value = []
    usuariosPagina.value = 1
    usuariosAviso.value = ''
    usuariosCarregados.value = false
    erro.value = ''
  },
)

/**
 * Carrega os usuários em silêncio ao abrir, só para o tile contar certo.
 *
 * Sem isso o número viria do painel (com o técnico dentro) e só seria
 * corrigido depois que a pessoa abrisse a lista — e aí a primeira leitura já
 * estaria errada.
 */
watch(
  [() => props.aberto, () => props.unidade?.nome],
  ([aberto, nome]) => {
    if (aberto && nome && podeListarUsuarios.value && !usuariosCarregados.value) {
      void carregarUsuarios(true)
    }
  },
)
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="unidade?.nome ?? 'Unidade escolar'"
    largura="min(1180px, 96vw)"
    @fechar="emit('fechar')"
  >
    <div v-if="unidade" class="detalhe">
      <!-- ---------- Identidade ---------- -->
      <div class="faixa-id">
        <div class="id-esquerda">
          <div class="cie-caixa">
            <span class="cie-rotulo">CIE</span>
            <button
              v-if="unidade.cie"
              type="button"
              class="cie"
              title="Copiar código CIE"
              :aria-label="`Copiar código CIE ${unidade.cie}`"
              @click="copiarCie"
            >
              {{ unidade.cie }}
            </button>
            <span v-else class="cie vazio">sem código</span>
          </div>
          <div class="id-nome">
            <strong>{{ unidade.grupo }}</strong>
            <span v-if="unidade.irma" class="id-nota">divide o prédio com {{ unidade.irma }}</span>
            <span v-else class="id-nota">prédio exclusivo</span>
          </div>
        </div>

        <div class="id-direita">
          <div class="id-campo">
            <span class="id-rotulo">Técnico</span>
            <strong>{{ unidade.tecnico || 'Não atribuído' }}</strong>
          </div>
          <div class="id-campo">
            <span class="id-rotulo">Inventário</span>
            <StatusPill :status="inventario" />
          </div>
        </div>
      </div>

      <!-- ---------- 2º link de internet ---------- -->
      <section v-if="linksInternet.length" class="banda">
        <h4 class="rotulo-secao">2º link de internet</h4>
        <div v-for="{ nome, link } in linksInternet" :key="link.escola" class="link-card">
          <div v-if="linksInternet.length > 1" class="link-escola">{{ nome }}</div>
          <div class="link-grid">
            <div class="link-campo">
              <span class="link-rotulo">Possui 2º link</span>
              <span class="pill-mini" :class="link.possuiSegundoLink ? 'pill-sim' : 'pill-nao'">
                {{ link.possuiLabel || (link.possuiSegundoLink ? 'Sim' : 'Não') }}
              </span>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">Empresa</span>
              <strong>{{ link.empresa || '—' }}</strong>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">Velocidade</span>
              <strong>{{ link.velocidadeMbps != null ? `${link.velocidadeMbps} Mbps` : '—' }}</strong>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">Status</span>
              <strong>{{ link.status || '—' }}</strong>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">Data prev./inst.</span>
              <strong>{{ link.dataPrevistaInstalacao ? new Date(link.dataPrevistaInstalacao).toLocaleDateString('pt-BR') : '—' }}</strong>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">Responsável</span>
              <strong>{{ link.responsavel || '—' }}</strong>
            </div>
            <div class="link-campo">
              <span class="link-rotulo">CIE</span>
              <strong>{{ link.cie || '—' }}</strong>
            </div>
          </div>
          <p v-if="link.observacoes" class="link-obs">{{ link.observacoes }}</p>
          <div class="link-acoes">
            <button v-if="firewallUrl(link.cie)" class="btn btn-mini" type="button" @click="abrirFirewall(link.cie)" title="Acessar Firewall">
              Acessar Firewall
            </button>
          </div>
        </div>
      </section>

      <!-- ---------- Parque ---------- -->
      <section class="banda">
        <h4 class="rotulo-secao">Equipamentos da unidade</h4>

        <div class="parque">
          <button
            v-if="kpiParqueTotal"
            type="button"
            class="hero"
            :class="{ ativo: painel === 'equipamentos' && equipStatus === '' }"
            @click="abrirKpi('equipamentos', kpiParqueTotal)"
          >
            <span class="hero-valor">{{ kpiParqueTotal.valor.toLocaleString('pt-BR') }}</span>
            <span class="hero-rotulo">{{ kpiParqueTotal.rotulo }}</span>
            <span class="hero-acao">
              {{ painel === 'equipamentos' && equipStatus === '' ? 'listando' : 'ver todos' }}
            </span>
          </button>

          <div class="parque-lado">
            <div class="barra" aria-hidden="true">
              <span
                v-for="s in segmentosParque"
                :key="s.chave"
                class="barra-seg"
                :class="`tom-${s.tom}`"
                :style="{ flexGrow: s.valor }"
              />
            </div>

            <div class="tiles">
              <button
                v-for="k in kpiParqueEstados"
                :key="k.chave"
                type="button"
                class="tile"
                :class="[`tom-${k.tom}`, { ativo: painel === 'equipamentos' && equipStatus === k.statusSce }]"
                @click="abrirKpi('equipamentos', k)"
              >
                <span class="tile-topo">
                  <span class="ponto" />{{ k.rotulo }}
                </span>
                <span class="tile-valor">{{ k.valor.toLocaleString('pt-BR') }}</span>
                <span class="tile-pct">{{ k.detail }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ---------- Chamados e pessoas ---------- -->
      <section class="banda">
        <h4 class="rotulo-secao">Chamados e Usuários</h4>

        <div class="tiles tiles-4">
          <button
            v-for="k in kpiChamados"
            :key="k.chave"
            type="button"
            class="tile"
            :class="[`tom-${k.tom}`, { ativo: painel === 'chamados' && chamadosStatus === (k.statusChamado || '') }]"
            @click="abrirKpi('chamados', k)"
          >
            <span class="tile-topo">
              <ClipboardList :size="13" />{{ k.rotulo }}
            </span>
            <span class="tile-valor">{{ k.valor.toLocaleString('pt-BR') }}</span>
            <span class="tile-pct">{{ k.detail }}</span>
          </button>

          <button
            v-if="kpiUsuarios"
            type="button"
            class="tile"
            :class="[`tom-${kpiUsuarios.tom}`, { ativo: painel === 'usuarios', bloqueado: kpiUsuarios.indisponivel }]"
            :disabled="kpiUsuarios.indisponivel"
            :title="kpiUsuarios.indisponivel ? 'Disponível apenas para ADMIN e GESTOR' : 'Ver usuários da unidade'"
            @click="abrirKpi('usuarios', kpiUsuarios)"
          >
            <span class="tile-topo">
              <Users :size="13" />{{ kpiUsuarios.rotulo }}
            </span>
            <span class="tile-valor">
              {{ kpiUsuarios.valor.toLocaleString('pt-BR') }}
              <em class="tile-sufixo">{{ kpiUsuarios.sufixo }}</em>
            </span>
            <span class="tile-pct">{{ kpiUsuarios.detail }}</span>
          </button>
        </div>
      </section>

      <!-- ---------- Drill-down ---------- -->
      <section v-if="painel" class="painel">
        <header class="painel-topo">
          <h4>
            {{ tituloPainel }}
            <span class="painel-total">{{ totalPainel.toLocaleString('pt-BR') }}</span>
            <span v-if="painel === 'usuarios' && !carregando && !erro && usuariosLista.length" class="painel-nota">
              {{ usuariosResumo }}
            </span>
          </h4>

          <div class="painel-controles">
            <select
              v-if="painel === 'equipamentos'"
              :value="equipStatus"
              class="select-input slim"
              @change="mudarStatusEquip(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos os status</option>
              <option value="Disponível">Disponível</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Quebrado">Quebrado</option>
              <option value="Extraviado">Extraviado</option>
              <option value="Emprestado">Emprestado</option>
              <option value="Em Verificação">Em Verificação</option>
            </select>

            <select
              v-if="painel === 'chamados'"
              :value="chamadosStatus"
              class="select-input slim"
              @change="mudarStatusChamado(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Todos os status</option>
              <option v-for="s in STATUS_FLUXO" :key="s" :value="s">{{ rotuloStatusChamado(s) }}</option>
            </select>

            <button class="btn btn-outline btn-pequeno" type="button" @click="fecharPainel">
              <X :size="14" /> Fechar recorte
            </button>
          </div>
        </header>

        <p v-if="carregando" class="painel-msg"><Loader2 :size="16" class="spin" /> Carregando...</p>
        <p v-else-if="erro" class="painel-msg erro-msg">{{ erro }}</p>

        <template v-else>
          <p v-if="equipAviso && painel === 'equipamentos'" class="painel-aviso">{{ equipAviso }}</p>
          <p v-if="chamadosAviso && painel === 'chamados'" class="painel-aviso">{{ chamadosAviso }}</p>
          <p v-if="usuariosAviso && painel === 'usuarios'" class="painel-aviso">{{ usuariosAviso }}</p>

          <div v-if="totalPainel === 0" class="painel-msg">Nada encontrado neste recorte.</div>

          <template v-else>
            <!-- Usuários -->
            <table v-if="painel === 'usuarios'" class="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Unidade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="usr in usuariosCorte" :key="usr.id">
                  <td><strong>{{ usr.nome }}</strong></td>
                  <td>{{ usr.email }}</td>
                  <td>{{ rotuloPerfil(usr.nivel) }}</td>
                  <td>{{ usr.filial }}</td>
                  <td><StatusPill :status="usr.status === 'INATIVO' ? 'Inativo' : 'Ativo'" /></td>
                </tr>
              </tbody>
            </table>

            <!-- Chamados -->
            <table v-else-if="painel === 'chamados'" class="table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Aberto em</th>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Responsável</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in chamadosCorte" :key="c.id">
                  <td class="nowrap"><strong>#{{ c.protocolo }}</strong></td>
                  <td class="nowrap">{{ formatDateTime(c.timestamp) }}</td>
                  <td>{{ c.tipo }}</td>
                  <td>{{ c.solicitante }}</td>
                  <td>{{ c.responsavel || '—' }}</td>
                  <td><StatusPill :status="rotuloStatusChamado(c.status)" /></td>
                </tr>
              </tbody>
            </table>

            <!-- Equipamentos -->
            <table v-else class="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Patrimônio</th>
                  <th>Responsável atual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="eq in equipCorte" :key="eq.id">
                  <td>{{ eq.categoria }}</td>
                  <td>{{ eq.marca }}</td>
                  <td>{{ eq.modelo }}</td>
                  <td class="nowrap">{{ eq.patrimonio || '—' }}</td>
                  <td>{{ eq.responsavelAtual || '—' }}</td>
                  <td><StatusPill :status="eq.status" /></td>
                </tr>
              </tbody>
            </table>

            <PaginationBar
              v-if="totalPainel > PAGE"
              :page="paginaAtual"
              :page-size="PAGE"
              :total="totalPainel"
              @change="irParaPagina"
            />
          </template>
        </template>
      </section>
    </div>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('fechar')">Fechar</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.detalhe {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.tom-blue { --tom: var(--blue); --tom-soft: var(--blue-soft); }
.tom-green { --tom: var(--green); --tom-soft: var(--green-soft); }
.tom-yellow { --tom: var(--yellow); --tom-soft: var(--yellow-soft); }
.tom-red { --tom: var(--red); --tom-soft: var(--red-soft); }
.tom-slate { --tom: var(--slate); --tom-soft: var(--slate-soft); }
.tom-purple { --tom: var(--purple); --tom-soft: var(--purple-soft); }

/* ---------- Identidade: placa de identificação da unidade ---------- */

.faixa-id {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.id-esquerda {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.cie-caixa {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}

.cie-rotulo {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  padding-left: 2px;
}

/* O CIE é o identificador que a pessoa leva para o sistema da Matriz, então
   é clicável. A fonte é a do portal, não uma mono: com 6 dígitos a mono ficava
   pequena demais e era ruim de ler — o peso e o espaçamento é que carregam o
   ar de "código", não a família tipográfica. */
.cie {
  font-family: var(--font-sans);
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--sidebar-bg);
  border-radius: 8px;
  padding: 7px 11px;
  cursor: copy;
  transition: background 0.12s ease, transform 0.12s ease;
}

.cie:hover {
  background: var(--sidebar-bg-deep);
  transform: translateY(-1px);
}

.cie:active {
  transform: translateY(0);
}

.cie:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.cie.vazio {
  cursor: default;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px dashed var(--border-strong);
}

.id-nome {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.id-nome strong {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
}

.id-nota {
  font-size: 12px;
  color: var(--text-muted);
}

.id-direita {
  display: flex;
  align-items: center;
  gap: 26px;
  flex-wrap: wrap;
}

.id-campo {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
}

.id-rotulo {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.id-campo strong {
  font-size: 13px;
  font-weight: 600;
}

/* ---------- Bandas de métrica ---------- */

.banda {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Rótulo com fio: dá a régua da banda sem roubar altura das métricas. */
.rotulo-secao {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--text-muted);
}

.rotulo-secao::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.parque {
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: 18px;
  align-items: stretch;
}

@media (max-width: 860px) {
  .parque {
    grid-template-columns: 1fr;
  }
}

/* Número-herói: o total do parque é o número que a pessoa procura primeiro. */
.hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 2px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.hero-valor {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--blue);
  font-variant-numeric: tabular-nums;
}

.hero-rotulo {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.hero-acao {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.hero:hover {
  border-color: var(--blue);
  box-shadow: var(--shadow-md);
}

.hero.ativo {
  border-color: var(--blue);
  box-shadow: inset 0 0 0 1px var(--blue);
}

.hero:focus-visible,
.tile:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.parque-lado {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}

/* A sobra entre as quatro colunas e o total fica no trilho, visível. */
.barra {
  display: flex;
  height: 10px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.barra-seg {
  background: var(--tom);
  min-width: 0;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
  gap: 10px;
}

.tiles-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 860px) {
  .tiles-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 13px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
}

.tile-topo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tom);
  flex-shrink: 0;
}

.tile-valor {
  font-size: 21px;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

/* "3 ativos" — o número sozinho não diz se conta só os ATIVOS. */
.tile-sufixo {
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  color: var(--text-muted);
}

.tile-pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--tom);
}

.tile:hover:not(:disabled) {
  border-color: var(--tom);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.tile.ativo {
  border-color: var(--tom);
  box-shadow: inset 0 0 0 1px var(--tom), 0 0 0 3px var(--tom-soft);
}

.tile.bloqueado,
.tile:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

/* ---------- Painel de drill-down ---------- */

.painel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
}

.painel-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-muted);
}

.painel-topo h4 {
  font-size: 13.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.painel-total {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 9px;
  font-variant-numeric: tabular-nums;
}

.painel-controles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.painel-nota {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

/* `slim` e `spin` são reimplementados aqui: nas views que os usam eles são
   `<style scoped>` e não vazam para este componente. */
.select-input.slim {
  width: auto;
  min-width: 150px;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-pequeno {
  padding: 6px 10px;
  font-size: 12.5px;
}

.painel-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 26px 14px;
  color: var(--text-muted);
  font-size: 13px;
}

.erro-msg {
  color: var(--red);
  background: var(--red-soft);
}

.painel-aviso {
  padding: 9px 14px;
  font-size: 12.5px;
  color: #92400e;
  background: #fffbeb;
  border-bottom: 1px solid var(--border);
}

.painel :deep(.table) {
  font-size: 13px;
}

.painel :deep(.table thead th) {
  background: var(--surface);
}

/* ---------- 2º link de internet ---------- */
.link-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.link-escola {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}
.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.link-campo {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.link-rotulo {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.link-campo strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.link-obs {
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: pre-line;
  margin: 0;
}
.link-acoes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pill-mini {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}
.pill-sim { background: var(--green-soft); color: var(--green); }
.pill-nao { background: var(--red-soft); color: var(--red); }
</style>
