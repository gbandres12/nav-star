import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { seed } from "../src/lib/seed";
import type { Database } from "../src/lib/supabase/database.types";

/**
 * Carga inicial do banco de PRODUÇÃO (NavStar / São Tomé Expresso).
 *
 * Diferente de scripts/seed.ts (dados fictícios para desenvolvimento), aqui entra só o cadastro real da operação:
 * empresa, cidades, portos, a lancha São Tomé Expresso com o mapa de poltronas, as linhas Manaus ↔ Santarém
 * (paradas, preços e horários), as viagens programadas dos próximos dias e o PRIMEIRO ADMINISTRADOR por convite.
 * Não cria pedidos, encomendas, caixas, agências, convênios, tripulantes nem senhas.
 *
 * É idempotente: os ids são derivados de chaves fixas, então rodar de novo só atualiza.
 *
 * Uso (precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local):
 *   npx tsx --env-file=.env.local scripts/carga-inicial-producao.ts \
 *     --admin-email voce@empresa.com --admin-nome "Seu Nome" --site https://nav-star.vercel.app --confirmar
 *
 * Sem --confirmar, só mostra o que seria feito.
 */

const args = process.argv.slice(2);
const arg = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const confirmar = args.includes("--confirmar");
// --sem-convite: não gera link novo para o administrador (um link novo invalida o anterior)
const semConvite = args.includes("--sem-convite");
const adminEmail = arg("admin-email")?.trim().toLowerCase();
const adminNome = arg("admin-nome")?.trim();
const site = (arg("site") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

// Só o que é operação real hoje (a linha de Maués, a 2ª lancha e os festivais do protótipo são exemplos)
const CIDADES = ["manaus", "itacoatiara", "parintins", "juruti", "obidos", "santarem"];
const EMBARCACOES = ["sao-tome-expresso"];
const LINHAS = ["manaus-santarem", "santarem-manaus"];

/** UUID estável a partir de uma chave (mesmo formato de uuid v5) */
function uuid(chave: string) {
  const h = createHash("sha1").update(`navstar:${chave}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.");
  if (!semConvite && (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail) || !adminNome)) throw new Error("Informe --admin-email e --admin-nome (ou use --sem-convite).");
  if (!/^https:\/\//.test(site)) throw new Error("Informe --site com o endereço público (ex.: https://nav-star.vercel.app).");

  const raw = seed();
  const agora = new Date();
  const cidades = raw.cidades.filter((c) => CIDADES.includes(c.id));
  const portos = raw.portos.filter((p) => CIDADES.includes(p.cidadeId));
  const embarcacoes = raw.embarcacoes.filter((e) => EMBARCACOES.includes(e.id));
  const linhas = raw.linhas.filter((l) => LINHAS.includes(l.id));
  const viagens = raw.viagens.filter((v) => LINHAS.includes(v.linhaId) && !v.avulsa && new Date(v.partida) > agora);

  console.log(`Destino: ${url}`);
  console.log(`Empresa: ${raw.config.empresa.razaoSocial} (${raw.config.empresa.cnpj})`);
  console.log(`${cidades.length} cidades, ${portos.length} portos, ${embarcacoes.length} embarcação(ões), ${linhas.length} linhas, ${viagens.length} viagens futuras`);
  console.log(`Primeiro administrador: ${adminNome} <${adminEmail}> · link de acesso para ${site}/primeiro-acesso`);
  if (!confirmar) {
    console.log("\nNada foi gravado. Rode de novo com --confirmar para aplicar.");
    return;
  }

  const sb = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const ok = <T extends { error: { message: string } | null }>(r: T, oque: string) => {
    if (r.error) throw new Error(`${oque}: ${r.error.message}`);
    return r;
  };

  const empresaId = uuid("empresa");
  ok(
    await sb.from("empresas").upsert(
      {
        id: empresaId,
        razao_social: raw.config.empresa.razaoSocial,
        nome_fantasia: raw.config.empresa.nome,
        cnpj: raw.config.empresa.cnpj,
        email: raw.config.empresa.email,
        telefone: raw.config.empresa.whatsapps[0]?.numero ?? "",
        whatsapp: raw.config.empresa.whatsapp,
        minutos_reserva_site: raw.config.empresa.minutosReservaSite,
      },
      { onConflict: "cnpj" },
    ),
    "empresa",
  );
  // Se a empresa já existia com outro id, usa o id que está no banco
  const { data: emp } = await sb.from("empresas").select("id").eq("cnpj", raw.config.empresa.cnpj).single();
  const eid = emp?.id ?? empresaId;
  // Campos criados pela migração …0010 (se ela ainda não foi aplicada, só avisa)
  const extra = await sb
    .from("empresas")
    .update({
      tipo_servico: raw.config.empresa.tipoServico,
      beneficios: raw.config.empresa.beneficios,
      whatsapps: raw.config.empresa.whatsapps.map(({ cidade, numero }) => ({ cidade, numero })),
    } as never)
    .eq("id", eid);
  if (extra.error) console.log(`  (aviso) dados extras da empresa não gravados: ${extra.error.message}`);
  const b = raw.config.bilhete;
  const bil = await sb.from("configuracoes_bilhete" as never).upsert(
    {
      empresa_id: eid,
      largura_mm: b.larguraMm,
      titulo: b.titulo,
      mostrar_logo: b.mostrarLogo,
      mostrar_valores: b.mostrarValores,
      mostrar_qr: b.mostrarQr,
      mostrar_beneficios: b.mostrarBeneficios,
      local_embarque: b.localEmbarque,
      antecedencia_embarque_min: b.antecedenciaEmbarqueMin,
      mensagens: b.mensagens,
    } as never,
    { onConflict: "empresa_id" },
  );
  if (bil.error) console.log(`  (aviso) modelo do bilhete não gravado: ${bil.error.message}`);
  console.log("✓ empresa");

  for (const c of cidades) ok(await sb.from("cidades").upsert({ id: uuid(`cidade:${c.id}`), nome: c.nome, uf: c.uf, sigla: c.sigla, slug: c.id }, { onConflict: "slug" }), `cidade ${c.nome}`);
  const { data: cidadesDb } = await sb.from("cidades").select("id,slug");
  const cidadeId = new Map((cidadesDb ?? []).map((c) => [c.slug, c.id]));
  console.log("✓ cidades");

  for (const p of portos)
    ok(
      await sb.from("portos").upsert(
        { id: uuid(`porto:${p.id}`), cidade_id: cidadeId.get(p.cidadeId)!, nome: p.nome, endereco: p.endereco || null, taxa_embarque: p.taxaEmbarque, ativo: true },
        { onConflict: "id" },
      ),
      `porto ${p.nome}`,
    );
  console.log("✓ portos");

  for (const e of embarcacoes) {
    ok(
      await sb.from("embarcacoes").upsert(
        { id: uuid(`embarcacao:${e.id}`), empresa_id: eid, nome: e.nome, tipo: e.tipo, capacidade_passageiros: e.assentos.length, capacidade_carga_kg: e.capacidadeCargaKg ?? null, colunas_mapa: e.colunasMapa, status: "ATIVA" },
        { onConflict: "id" },
      ),
      `embarcação ${e.nome}`,
    );
    ok(
      await sb.from("assentos").upsert(
        e.assentos.map((a) => ({ id: uuid(`assento:${e.id}:${a.codigo}`), embarcacao_id: uuid(`embarcacao:${e.id}`), codigo: a.codigo, fileira: a.fileira, coluna: a.coluna, tipo: a.tipo, ativo: true })),
        { onConflict: "embarcacao_id,codigo" },
      ),
      `poltronas da ${e.nome}`,
    );
  }
  console.log("✓ embarcação e poltronas");

  for (const l of linhas) {
    const lid = uuid(`linha:${l.id}`);
    ok(await sb.from("linhas").upsert({ id: lid, empresa_id: eid, nome: l.nome, ativa: true }, { onConflict: "id" }), `linha ${l.nome}`);
    for (const p of l.paradas)
      ok(
        await sb.from("paradas_linha").upsert(
          { id: uuid(`parada:${l.id}:${p.ordem}`), linha_id: lid, porto_id: uuid(`porto:${p.portoId}`), ordem: p.ordem, minutos_desde_origem: p.minutosDesdeOrigem },
          { onConflict: "linha_id,ordem" },
        ),
        `parada ${p.ordem} de ${l.nome}`,
      );
    const { data: paradasDb } = await sb.from("paradas_linha").select("id,ordem").eq("linha_id", lid);
    const paradaId = new Map((paradasDb ?? []).map((p) => [p.ordem, p.id]));
    for (let o = 0; o < l.paradas.length; o++)
      for (let d = o + 1; d < l.paradas.length; d++)
        ok(
          await sb.from("tarifas_trecho").upsert(
            { id: uuid(`tarifa:${l.id}:${o}:${d}`), linha_id: lid, origem_parada_id: paradaId.get(o)!, destino_parada_id: paradaId.get(d)!, valor: l.tarifas[o][d] },
            { onConflict: "origem_parada_id,destino_parada_id" },
          ),
          `tarifa ${o}→${d} de ${l.nome}`,
        );
    for (const h of l.horarios)
      ok(
        await sb.from("horarios_linha").upsert(
          { id: uuid(`horario:${l.id}:${h.diaSemana}:${h.horaSaida}`), linha_id: lid, embarcacao_id: uuid(`embarcacao:${h.embarcacaoId}`), dia_semana: h.diaSemana, hora_saida: `${h.horaSaida}:00`, ativo: true },
          { onConflict: "id" },
        ),
        `horário de ${l.nome}`,
      );
  }
  console.log("✓ linhas, paradas, preços e horários");

  for (const v of viagens)
    ok(
      await sb.from("viagens").upsert(
        { id: uuid(`viagem:${v.linhaId}:${v.partida}`), empresa_id: eid, linha_id: uuid(`linha:${v.linhaId}`), embarcacao_id: uuid(`embarcacao:${v.embarcacaoId}`), partida: v.partida, status: "PROGRAMADA", comandante: v.comandante, vendas_abertas: true },
        { onConflict: "linha_id,partida" },
      ),
      `viagem ${v.id}`,
    );
  console.log(`✓ ${viagens.length} viagens programadas (o job gerar-viagens do pg_cron cria as seguintes)`);

  if (semConvite) {
    console.log("✓ convite do administrador não gerado (--sem-convite)");
    return;
  }
  // Primeiro administrador: convite com link de primeiro acesso (sem senha definida por nós)
  const redirectTo = `${site}/primeiro-acesso`;
  // Mesmo formato de src/lib/site.ts#linkDeAcesso: validado no servidor, funciona em qualquer aparelho
  const acesso = (hash: string, tipo: "invite" | "recovery") => `${site}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${tipo}&next=/primeiro-acesso`;
  let userId: string;
  let link: string | undefined;
  const convite = await sb.auth.admin.generateLink({ type: "invite", email: adminEmail, options: { data: { nome: adminNome, papel: "ADMIN" }, redirectTo } });
  if (convite.error) {
    const existentes = await sb.auth.admin.listUsers({ perPage: 1000 });
    const u = existentes.data?.users.find((x) => x.email === adminEmail);
    if (!u) throw new Error(`convite do administrador: ${convite.error.message}`);
    userId = u.id;
    const rec = await sb.auth.admin.generateLink({ type: "recovery", email: adminEmail, options: { redirectTo } });
    link = rec.data?.properties?.hashed_token ? acesso(rec.data.properties.hashed_token, "recovery") : undefined;
  } else {
    userId = convite.data.user.id;
    link = convite.data.properties?.hashed_token ? acesso(convite.data.properties.hashed_token, "invite") : undefined;
  }
  ok(
    await sb.from("perfis").upsert({ id: userId, empresa_id: eid, nome: adminNome, papel: "ADMIN", ativo: true }, { onConflict: "id" }),
    "perfil do administrador",
  );
  console.log(`✓ administrador ${adminEmail}`);
  console.log(`\nLink de primeiro acesso (válido por tempo limitado, não compartilhe):\n${link ?? "(não gerado — use “Esqueci a senha” em /recuperar-senha)"}`);
  console.log(`\nConfira no Supabase → Authentication → URL Configuration: Site URL = ${site} e ${site}/** nas Redirect URLs.`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
