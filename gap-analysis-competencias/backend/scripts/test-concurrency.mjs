#!/usr/bin/env node
/**
 * Prova, com pedidos HTTP verdadeiramente concorrentes (Promise.all, não
 * sequenciais), que o locking otimista evita perder alterações quando
 * dois utilizadores editam o mesmo registo ao mesmo tempo — o requisito
 * central do Prompt 5. Um teste sequencial (pedido A, espera resposta,
 * depois pedido B) não prova nada aqui: só a concorrência real revela a
 * janela de corrida entre o SELECT de verificação e o INSERT/UPDATE.
 *
 * Autossuficiente: cria o seu próprio fixture mínimo via Prisma Client
 * (sem depender de dados já existentes na BD) e não o remove no fim, para
 * poderes inspecionar o `audit_log` resultante — corre outra vez para
 * limpar (usa `--reset` para truncar tudo primeiro).
 *
 * Requer o servidor a correr (`npm run start:dev` ou `node dist/src/main.js`)
 * e `ADMIN_EMAIL`/`ADMIN_PASSWORD` já seedados (`npm run seed:admin`).
 *
 * Uso:
 *   npm run start:dev &          # noutro terminal, ou já a correr
 *   node scripts/test-concurrency.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.API_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login falhou para ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).accessToken;
}

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function checkExactlyOneWins(label, statuses, winCode) {
  const sorted = [...statuses].sort();
  const ok = sorted[0] === winCode && sorted[1] === 409;
  console.log(ok ? `  ✅ ${label}` : `  ❌ FALHOU (${label}) — status recebidos: ${statuses.join(', ')}`);
  return ok;
}

async function seedFixture() {
  const nivel = (id, nome) => prisma.nivel.upsert({ where: { id }, create: { id, nome, descricao: nome }, update: {} });
  await Promise.all([0, 1, 2, 3, 4, 5].map((id) => nivel(id, `Nivel ${id}`)));
  await prisma.area.upsert({ where: { id: 900 }, create: { id: 900, nome: 'ÁreaTesteConcorrência', updatedAt: new Date() }, update: {} });
  await prisma.competencia.upsert({
    where: { id: 900 },
    create: { id: 900, nome: 'CompetênciaTesteConcorrência', areaId: 900, updatedAt: new Date() },
    update: {},
  });
  await prisma.certificacao.upsert({
    where: { id: 'C_TESTE_CONCORRENCIA' },
    create: { id: 'C_TESTE_CONCORRENCIA', nome: 'CertificaçãoTesteConcorrência', updatedAt: new Date() },
    update: {},
  });
  await prisma.carreira.upsert({ where: { id: 'TST' }, create: { id: 'TST', nome: 'Teste', updatedAt: new Date() }, update: {} });
  await prisma.categoria.upsert({ where: { id: 'TST' }, create: { id: 'TST', nome: 'Teste', updatedAt: new Date() }, update: {} });
  await prisma.cargo.upsert({
    where: { id: 'TST_TST' },
    create: { id: 'TST_TST', nome: 'Cargo Teste', carreiraId: 'TST', categoriaId: 'TST', updatedAt: new Date() },
    update: {},
  });

  const gestor = await prisma.colaborador.upsert({
    where: { id: 900001 },
    create: { id: 900001, nome: 'Gestor Teste Concorrência', cargoId: 'TST_TST', updatedAt: new Date() },
    update: {},
  });
  const subordinado = await prisma.colaborador.upsert({
    where: { id: 900002 },
    create: { id: 900002, nome: 'Subordinado Teste Concorrência', cargoId: 'TST_TST', managerId: gestor.id, updatedAt: new Date() },
    update: { managerId: gestor.id },
  });
  const semGestor = await prisma.colaborador.upsert({
    where: { id: 900003 },
    create: { id: 900003, nome: 'Colaborador Teste Concorrência (sem gestor)', updatedAt: new Date() },
    update: {},
  });

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('senha-teste-concorrencia-123', 12);
  await prisma.user.upsert({
    where: { email: 'gestor.concorrencia@teste.local' },
    create: { email: 'gestor.concorrencia@teste.local', passwordHash, role: 'MANAGER', colaboradorId: gestor.id },
    update: { passwordHash, colaboradorId: gestor.id },
  });

  return { subordinadoId: subordinado.id, semGestorId: semGestor.id };
}

async function main() {
  if (process.argv.includes('--reset')) {
    console.log('A limpar o fixture de teste de concorrência…');
    await prisma.colaboradorCertificacao.deleteMany({ where: { colaboradorId: { in: [900001, 900002] } } });
    await prisma.colaboradorCompetencia.deleteMany({ where: { colaboradorId: { in: [900001, 900002] } } });
    await prisma.colaborador.deleteMany({ where: { id: { in: [900001, 900002, 900003] } } });
    console.log('Feito. Corre sem --reset para testar de novo.');
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Define ADMIN_EMAIL e ADMIN_PASSWORD no .env (o mesmo utilizador criado por npm run seed:admin).');
  }

  console.log('A preparar o fixture…');
  const { subordinadoId } = await seedFixture();

  const admin = await login(adminEmail, adminPassword);
  const manager = await login('gestor.concorrencia@teste.local', 'senha-teste-concorrencia-123');

  let tudoOk = true;

  console.log('\n=== Teste 1: dois PUT concorrentes à mesma certificação ===');
  {
    // Estado conhecido e determinístico mesmo em corridas repetidas: apaga
    // via Prisma (não via API, que exigiria já saber a version atual) e
    // recria a version=0 com um PUT normal.
    await prisma.colaboradorCertificacao.deleteMany({ where: { colaboradorId: subordinadoId, certificacaoId: 'C_TESTE_CONCORRENCIA' } });
    await req('PUT', `/colaboradores/${subordinadoId}/certificacoes/C_TESTE_CONCORRENCIA`, admin, { dataValidade: '2030-01-01' });
    const [r1, r2] = await Promise.all([
      req('PUT', `/colaboradores/${subordinadoId}/certificacoes/C_TESTE_CONCORRENCIA`, admin, { dataValidade: '2033-01-01', version: 0 }),
      req('PUT', `/colaboradores/${subordinadoId}/certificacoes/C_TESTE_CONCORRENCIA`, manager, { dataValidade: '2034-01-01', version: 0 }),
    ]);
    console.log('  pedido A (admin):', r1.status, r1.status === 200 ? `dataValidade=${r1.body.dataValidade}` : r1.body.message);
    console.log('  pedido B (gestor):', r2.status, r2.status === 200 ? `dataValidade=${r2.body.dataValidade}` : r2.body.message);
    tudoOk = checkExactlyOneWins('exatamente um ganhou, o outro recebeu 409 em vez de sobrescrever silenciosamente', [r1.status, r2.status], 200) && tudoOk;
  }

  console.log('\n=== Teste 2: dois POST concorrentes a criar a PRIMEIRA avaliação da mesma competência ===');
  {
    await prisma.colaboradorCompetencia.deleteMany({ where: { colaboradorId: subordinadoId, competenciaId: 900 } });
    const [r1, r2] = await Promise.all([
      req('POST', `/colaboradores/${subordinadoId}/competencias`, admin, { competenciaId: 900, nivelId: 3, baseAssessmentId: null, origem: 'FORMAL' }),
      req('POST', `/colaboradores/${subordinadoId}/competencias`, manager, { competenciaId: 900, nivelId: 5, baseAssessmentId: null }),
    ]);
    console.log('  pedido A (admin):', r1.status, r1.status === 201 ? `nivelId=${r1.body.nivelId}` : r1.body.message);
    console.log('  pedido B (gestor):', r2.status, r2.status === 201 ? `nivelId=${r2.body.nivelId}` : r2.body.message);
    tudoOk = checkExactlyOneWins('exatamente um criou a avaliação (proteção via advisory lock — ver colaboradores.service.ts)', [r1.status, r2.status], 201) && tudoOk;
  }

  console.log('\n=== Teste 3: dois PATCH concorrentes ao mesmo colaborador (ADMIN_RH) ===');
  {
    const atual = await prisma.colaborador.findUniqueOrThrow({ where: { id: subordinadoId } });
    const [r1, r2] = await Promise.all([
      req('PATCH', `/colaboradores/${subordinadoId}`, admin, { nucleoId: null, version: atual.version }),
      req('PATCH', `/colaboradores/${subordinadoId}`, admin, { cargoId: 'TST_TST', version: atual.version }),
    ]);
    console.log('  pedido A:', r1.status, r1.status === 200 ? `version=${r1.body.version}` : r1.body.message);
    console.log('  pedido B:', r2.status, r2.status === 200 ? `version=${r2.body.version}` : r2.body.message);
    tudoOk = checkExactlyOneWins('exatamente um aplicou a alteração', [r1.status, r2.status], 200) && tudoOk;
  }

  console.log('\n=== Teste 4: RBAC — MANAGER não consegue escrever num colaborador fora da equipa ===');
  {
    const { semGestorId } = await seedFixture(); // idempotente, só para ter o id à mão
    const r = await req('POST', `/colaboradores/${semGestorId}/competencias`, manager, { competenciaId: 900, nivelId: 1, baseAssessmentId: null });
    const ok = r.status === 403;
    console.log(ok ? '  ✅ bloqueado com 403 como esperado' : `  ❌ FALHOU — status ${r.status}`);
    tudoOk = ok && tudoOk;
  }

  console.log('\n' + (tudoOk ? '✅ TODOS OS TESTES DE CONCORRÊNCIA/RBAC PASSARAM' : '❌ ALGUM TESTE FALHOU'));
  await prisma.$disconnect();
  process.exit(tudoOk ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
