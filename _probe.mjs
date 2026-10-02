/**
 * Verificação de segurança contra os ambientes IMPLANTADOS.
 * Só GET/OPTIONS + login inválido (nenhuma escrita, nenhum dado alterado).
 */
const CHAMADOS = 'https://chamados-vxow.onrender.com';
const SCE = 'https://sce-nyjc-p6yj.onrender.com';

let ok = 0, ruim = 0;
const marcar = (bom, txt) => { bom ? ok++ : ruim++; console.log(`  ${bom ? 'OK  ' : 'FALHA'} ${txt}`); };
const h = { Origin: 'https://portal-exemplo.vercel.app' };

console.log(`\n${'='.repeat(70)}\n1. SAUDE\n${'='.repeat(70)}`);
for (const [nome, base] of [['chamados', CHAMADOS], ['sce', SCE]]) {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(90000) });
    marcar(r.ok, `${nome.padEnd(9)} /health -> HTTP ${r.status}`);
  } catch (e) { marcar(false, `${nome} /health -> ${e.message}`); }
}

console.log(`\n${'='.repeat(70)}\n2. ENDPOINTS QUE ANTES VAZAVAM DADOS SEM AUTENTICACAO\n${'='.repeat(70)}`);
const semAuth = [
  [CHAMADOS, '/api/usuarios'],
  [CHAMADOS, '/api/dashboard/stats'],
  [CHAMADOS, '/api/escolas/tecnicos'],
  [CHAMADOS, '/api/inventario'],
  [SCE, '/api/testar-planilha'],
  [SCE, '/api/testar-leitura-equipamentos'],
  [SCE, '/api/listas-cadastro'],
  [SCE, '/api/equipamentos-global'],
  [SCE, '/api/equipamentos-da-filial'],
  [SCE, '/api/listar-usuarios'],
  [SCE, '/api/exportar-csv'],
  [SCE, '/api/auditoria'],
  [SCE, '/api/registros-manutencao?equipamentoId=x'],
  [SCE, '/api/historico-equipamento?equipamentoId=x'],
  [SCE, '/api/anexo-url?path=boletins/x.pdf'],
];
for (const [base, rota] of semAuth) {
  try {
    const r = await fetch(`${base}${rota}`, { signal: AbortSignal.timeout(90000) });
    const corpo = await r.text();
    const seguro = r.status === 401 || r.status === 403 || r.status === 404;
    marcar(seguro, `${base === SCE ? 'SCE ' : 'CHAM'} ${rota.slice(0, 42).padEnd(42)} HTTP ${r.status}${seguro ? '' : '  <<< VAZOU'}`);
  } catch (e) { marcar(false, `${rota} -> ${e.message}`); }
}

console.log(`\n${'='.repeat(70)}\n3. TOKEN INVALIDO (antes: 500, agora 401)\n${'='.repeat(70)}`);
for (const [base, rota] of [[SCE, '/api/listas-cadastro'], [CHAMADOS, '/api/chamados']]) {
  const r = await fetch(`${base}${rota}`, { headers: { Authorization: 'Bearer aaa.bbb.ccc' }, signal: AbortSignal.timeout(90000) });
  marcar(r.status === 401, `${base === SCE ? 'SCE ' : 'CHAM'} ${rota.padEnd(24)} HTTP ${r.status}`);
}

console.log(`\n${'='.repeat(70)}\n4. CORS\n${'='.repeat(70)}`);
async function preflight(base, origin) {
  const r = await fetch(`${base}/api/listas-cadastro`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, signal: AbortSignal.timeout(90000) });
  return r.headers.get('access-control-allow-origin');
}
const ATACANTE = 'https://malicioso.example';
const PORTAL = 'https://portal-exemplo.vercel.app';

// Legado: a origem que ja esta no ar precisa continuar funcionando.
const legadoSce = await preflight(SCE, 'https://sce-ebon.vercel.app');
marcar(legadoSce !== null && legadoSce !== '*', `SCE   origem legada liberada  (${legadoSce ?? 'AUSENTE'})`);
const legadoCham = await preflight(CHAMADOS, 'https://sci-chamados-frontend.onrender.com');
marcar(legadoCham !== null && legadoCham !== '*', `CHAM  origem legada liberada  (${legadoCham ?? 'AUSENTE'})`);

// O portal entra via FRONTEND_URLS / EXTRA_CORS_ORIGINS: so responde se a
// variavel estiver configurada, entao aqui e informativo, nao OK/Falha.
const portalSce = await preflight(SCE, PORTAL);
console.log(`  INFO SCE   portal             -> ${portalSce ?? 'nao configurado'}`);
const portalCham = await preflight(CHAMADOS, PORTAL);
console.log(`  INFO CHAM  portal             -> ${portalCham ?? 'nao configurado'}`);

// O teste que importa: origem desconhecida nao pode receber o header.
const atrSce = await preflight(SCE, ATACANTE);
marcar(!atrSce, `SCE   BLOQUEia atacante     (${atrSce ?? 'sem header'})`);
const atrCham = await preflight(CHAMADOS, ATACANTE);
marcar(!atrCham, `CHAM  BLOQUEia atacante     (${atrCham ?? 'sem header'})`);

console.log(`\n${'='.repeat(70)}\n5. HEADERS DE SEGURANCA\n${'='.repeat(70)}`);
for (const [nome, base] of [['SCE', SCE], ['CHAM', CHAMADOS]]) {
  const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(90000) });
  const chk = (k) => Boolean(r.headers.get(k));
  marcar(chk('strict-transport-security'), `${nome} HSTS`);
  marcar(chk('x-content-type-options'), `${nome} nosniff`);
  marcar(chk('content-security-policy'), `${nome} CSP`);
  marcar(!chk('x-powered-by'), `${nome} sem X-Powered-By`);
}

console.log(`\n${'='.repeat(70)}\n6. PAINEL PUBLICO (deve abrir sem login, sem PII)\n${'='.repeat(70)}`);
try {
  const r = await fetch(`${CHAMADOS}/api/dashboard/matriz`, { signal: AbortSignal.timeout(90000) });
  const corpo = await r.json();
  marcar(r.status === 200, `CHAM  /dashboard/matriz sem login -> HTTP ${r.status}`);
  const vaz = JSON.stringify(corpo);
  const pii = ['descricao', 'solicitante', 'historico', 'emailSolicitante', 'anexoUrl'];
  const achados = pii.filter((p) => vaz.includes(`"${p}"`));
  marcar(achados.length === 0, `CHAM  sem PII no payload${achados.length ? '  <<< ' + achados.join(',') : ''}`);
  const primeiro = corpo.chamados?.[0];
  if (primeiro) console.log(`       campos por chamado: ${Object.keys(primeiro).join(', ')}`);
} catch (e) { marcar(false, `/dashboard/matriz -> ${e.message}`); }

console.log(`\n${'='.repeat(70)}\n7. RATE LIMIT (bloqueia login na 11a tentativa)\n${'='.repeat(70)}`);
const codes = [];
for (let i = 0; i < 13; i++) {
  const r = await fetch(`${SCE}/api/login-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'teste-probe@example.com', password: 'errada' }), signal: AbortSignal.timeout(90000) });
  codes.push(r.status);
}
const p = codes.indexOf(429);
marcar(p > 0, `SCE   /login-password: ${codes.join(',')}  -> corta na tentativa ${p + 1}`);

console.log(`\n${'='.repeat(70)}\n${ok} OK  /  ${ruim} FALHA\n${'='.repeat(70)}\n`);
