/**
 * Travas de anexo do cliente.
 *
 * COPIA MANUAL do contrato do backend (`shared/types/api.ts` no repo do
 * backend). O portal não importa `@shared/api` — não tem essa dependência no
 * package.json — então os valores vivem aqui.
 *
 * A duplicação é um risco real e conhecido: se o backend mudar a allowlist e o
 * portal não, o usuário aceita um arquivo que o servidor recusa (ou, pior,
 * o portal recusa algo que o servidor aceitaria). Por isso:
 *
 *  - o valor está numa constante só, `ANEXO_EXTENSOES`, igual ao backend;
 *  - as mensagens de erro dizem o mesmo que o servidor, para o usuário não ver
 *    "arquivo não permitido" aqui e "VALIDATION_ERROR" lá;
 *  - a validação aqui é conveniência (erro na hora, sem subir 8MB na memória).
 *    A decisão que vale é a do servidor.
 */

/** Limite por arquivo, em bytes. Bate com ANEXO_MAX_BYTES do backend. */
export const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024

/** Quantidade de anexos por envio. Bate com ANEXO_MAX_POR_PEDIDO. */
export const MAX_ANEXOS = 5

/**
 * Extensões permitidas, SEM o ponto e em minúsculas. Mesma lista e mesma ordem
 * do backend, para que a mensagem seja idêntica dos dois lados.
 */
export const ANEXO_EXTENSOES: readonly string[] = [
  // imagem
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic',
  // documento
  'pdf', 'txt', 'csv', 'rtf',
  // planilha/apresentação
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  // mídia
  'mp3', 'm4a', 'mp4', 'mov', 'webm',
  // compactado
  'zip',
]

/**
 * MIME aceito por extensão. O navegador nem sempre preenche `File.type` (o
 * `.heic` do iPhone costuma vir vazio), então a checagem do MIME é um
 * complemento da extensão, nunca um bloqueio por si: arquivo sem tipo
 * declarado passa, arquivo com tipo declaradamente errado não.
 */
export const MIME_POR_EXTENSAO: Record<string, readonly string[]> = {
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  bmp: ['image/bmp', 'image/x-ms-bmp'],
  heic: ['image/heic', 'image/heif'],
  pdf: ['application/pdf', 'application/x-pdf'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/csv'],
  rtf: ['application/rtf', 'text/rtf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odt: ['application/vnd.oasis.opendocument.text'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm', 'audio/webm'],
  zip: ['application/zip', 'application/x-zip-compressed'],
}

const MIME_NEUTRO = 'application/octet-stream'

/** Extensão em minúsculas, sem o ponto; '' quando não tem. */
export function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf('.')
  return i === -1 ? '' : nome.slice(i + 1).toLowerCase()
}

/**
 * Erros de um arquivo, no mesmo formato de texto do backend. Lista vazia = pode
 * subir.
 */
export function validarArquivo(arquivo: File): string[] {
  const problemas: string[] = []
  const nome = arquivo.name
  const ext = extensaoDe(nome)

  if (!ext) {
    problemas.push(`"${nome}" não tem extensão; envie um arquivo com extensão (ex.: foto.jpg)`)
  } else if (!ANEXO_EXTENSOES.includes(ext)) {
    problemas.push(
      `"${nome}" tem extensão não permitida (.${ext}). Envie um destes: ${ANEXO_EXTENSOES.join(', ')}`,
    )
  } else {
    const declarado = (arquivo.type || '').trim().toLowerCase().split(';')[0].trim()
    const aceitos = MIME_POR_EXTENSAO[ext] || []
    if (declarado && declarado !== MIME_NEUTRO && !aceitos.includes(declarado)) {
      problemas.push(`"${nome}" (${ext}) foi declarado como ${declarado}, que não é um ${aceitos[0]}`)
    }
  }

  if (arquivo.size > TAMANHO_MAX_ANEXO) {
    const mb = Math.round(TAMANHO_MAX_ANEXO / (1024 * 1024))
    problemas.push(`"${nome}" maior que ${mb}MB`)
  }

  return problemas
}

/**
 * Valida uma lista inteira e devolve o texto do primeiro erro.
 *
 * Conferir a lista toda antes de recusar evita o caso em que o usuário corrigiu
 * o primeiro arquivo e o aviso seguinte é de outro que também estava errado.
 */
export function validarArquivos(arquivos: File[]): string | null {
  if (arquivos.length > MAX_ANEXOS) {
    return `Máximo de ${MAX_ANEXOS} anexos por envio.`
  }
  for (const arquivo of arquivos) {
    const problemas = validarArquivo(arquivo)
    if (problemas.length) return problemas[0]
  }
  return null
}

/**
 * `accept` dos inputs, derivado da allowlist.
 *
 * Sem o ponto inicial o navegador entende igual (a especificação tolera os
 * dois), mas manter o ponto deixa a intenção explícita.
 */
export const ACCEPT_ANEXO = ANEXO_EXTENSOES.map((e) => `.${e}`).join(',')

/** Texto curto do limite, para legendas: "5 MB por arquivo". */
export const LIMITE_ANEXO_TEXTO = `${Math.round(TAMANHO_MAX_ANEXO / (1024 * 1024))} MB por arquivo`