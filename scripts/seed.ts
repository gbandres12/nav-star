import { createClient } from "@supabase/supabase-js";
import { seed as generateSeedData } from "../src/lib/seed";
import type { Database } from "../src/lib/supabase/database.types";

/**
 * Script de Seed para o Supabase (NavStar)
 * Popula o banco com os dados determinísticos gerados por src/lib/seed.ts.
 *
 * NOTA DE SEGURANÇA:
 * A senha padrão 'navstar123' é utilizada EXCLUSIVAMENTE para desenvolvimento e testes locais.
 */

async function runSeed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error("❌ ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY devem estar definidas.");
    process.exit(1);
  }

  // Proteção contra execução acidental em produção sem flag explícita
  const isLocal = supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1");
  if (!isLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
    console.warn("⚠️ AVISO: A URL aponta para um ambiente não local:", supabaseUrl);
    console.warn("Para executar o seed no ambiente remoto conscientemente, defina ALLOW_REMOTE_SEED=true.");
    process.exit(0);
  }

  console.log("🌱 Iniciando seed no Supabase...");
  const supabase = createClient<Database>(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const raw = generateSeedData();
  const idMap = new Map<string, string>();

  // Helper para obter ou gerar UUID para chaves do protótipo
  function toUuid(oldId: string): string {
    if (!idMap.has(oldId)) {
      idMap.set(oldId, crypto.randomUUID());
    }
    return idMap.get(oldId)!;
  }

  // 1. Empresa
  console.log("1/12 Inserindo Empresa...");
  const empresaId = toUuid("empresa-sao-tome");
  const { error: errEmpresa } = await supabase.from("empresas").upsert(
    {
      id: empresaId,
      razao_social: raw.config.empresa.razaoSocial,
      nome_fantasia: raw.config.empresa.nome,
      cnpj: raw.config.empresa.cnpj,
      email: raw.config.empresa.email,
      telefone: raw.config.empresa.whatsapps[0]?.numero || "(92) 99127-4661",
      whatsapp: raw.config.empresa.whatsapp,
      minutos_reserva_site: raw.config.empresa.minutosReservaSite,
    },
    { onConflict: "cnpj" }
  );
  if (errEmpresa) throw new Error(`Erro ao criar empresa: ${errEmpresa.message}`);

  // 2. Cidades
  console.log("2/12 Inserindo Cidades...");
  for (const c of raw.cidades) {
    const cId = toUuid(c.id);
    const { error } = await supabase.from("cidades").upsert(
      {
        id: cId,
        nome: c.nome,
        uf: c.uf,
        sigla: c.sigla,
        slug: c.id,
      },
      { onConflict: "slug" }
    );
    if (error) throw new Error(`Erro ao inserir cidade ${c.nome}: ${error.message}`);
  }

  // 3. Portos
  console.log("3/12 Inserindo Portos...");
  for (const p of raw.portos) {
    const pId = toUuid(p.id);
    const { error } = await supabase.from("portos").upsert(
      {
        id: pId,
        cidade_id: toUuid(p.cidadeId),
        nome: p.nome,
        endereco: p.endereco || null,
        taxa_embarque: p.taxaEmbarque,
        ativo: p.ativo,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Erro ao inserir porto ${p.nome}: ${error.message}`);
  }

  // 4. Embarcações e Assentos
  console.log("4/12 Inserindo Embarcações e Assentos...");
  for (const e of raw.embarcacoes) {
    const eId = toUuid(e.id);
    const { error: errEmb } = await supabase.from("embarcacoes").upsert(
      {
        id: eId,
        empresa_id: empresaId,
        nome: e.nome,
        tipo: e.tipo,
        capacidade_passageiros: e.capacidadePassageiros,
        capacidade_carga_kg: e.capacidadeCargaKg ?? null,
        colunas_mapa: e.colunasMapa,
        status: e.status,
      },
      { onConflict: "id" }
    );
    if (errEmb) throw new Error(`Erro ao inserir embarcação ${e.nome}: ${errEmb.message}`);

    const assentosRows = e.assentos.map((a) => ({
      id: toUuid(a.id),
      embarcacao_id: eId,
      codigo: a.codigo,
      fileira: a.fileira,
      coluna: a.coluna,
      tipo: a.tipo,
      ativo: true,
    }));

    const { error: errAss } = await supabase.from("assentos").upsert(assentosRows, {
      onConflict: "embarcacao_id,codigo",
    });
    if (errAss) throw new Error(`Erro ao inserir assentos de ${e.nome}: ${errAss.message}`);
  }

  // 5. Linhas, Paradas, Horários e Tarifas
  console.log("5/12 Inserindo Linhas, Paradas, Horários e Tarifas...");
  for (const l of raw.linhas) {
    const lId = toUuid(l.id);
    const { error: errLinha } = await supabase.from("linhas").upsert(
      {
        id: lId,
        empresa_id: empresaId,
        nome: l.nome,
        ativa: l.ativa,
      },
      { onConflict: "id" }
    );
    if (errLinha) throw new Error(`Erro ao inserir linha ${l.nome}: ${errLinha.message}`);

    // Paradas
    for (const p of l.paradas) {
      const { error: errParada } = await supabase.from("paradas_linha").upsert(
        {
          id: toUuid(`${lId}_parada_${p.ordem}`),
          linha_id: lId,
          porto_id: toUuid(p.portoId),
          ordem: p.ordem,
          minutos_desde_origem: p.minutosDesdeOrigem,
        },
        { onConflict: "linha_id,ordem" }
      );
      if (errParada) throw new Error(`Erro ao inserir parada ${p.ordem}: ${errParada.message}`);
    }

    // Horários
    for (const h of l.horarios) {
      const { error: errHorario } = await supabase.from("horarios_linha").upsert(
        {
          id: toUuid(`${lId}_horario_${h.diaSemana}_${h.horaSaida}`),
          linha_id: lId,
          embarcacao_id: toUuid(h.embarcacaoId),
          dia_semana: h.diaSemana,
          hora_saida: `${h.horaSaida}:00`,
          ativo: true,
        },
        { onConflict: "id" }
      );
      if (errHorario) throw new Error(`Erro ao inserir horário: ${errHorario.message}`);
    }

    // Tarifas
    for (let o = 0; o < l.paradas.length; o++) {
      for (let d = o + 1; d < l.paradas.length; d++) {
        const val = l.tarifas?.[o]?.[d] ?? 100;
        const valEncomenda = (l as unknown as { tarifasEncomendaKg?: number[][] }).tarifasEncomendaKg?.[o]?.[d] ?? 5;
        const { error: errTarifa } = await supabase.from("tarifas_trecho").upsert(
          {
            id: crypto.randomUUID(),
            linha_id: lId,
            origem_parada_id: toUuid(`${lId}_parada_${l.paradas[o].ordem}`),
            destino_parada_id: toUuid(`${lId}_parada_${l.paradas[d].ordem}`),
            valor: val,
            valor_encomenda_kg: valEncomenda,
          },
          { onConflict: "origem_parada_id,destino_parada_id" }
        );
        if (errTarifa) throw new Error(`Erro ao inserir tarifa: ${errTarifa.message}`);
      }
    }
  }

  // 6. Agências
  console.log("6/12 Inserindo Agências...");
  for (const a of raw.agencias) {
    const aId = toUuid(a.id);
    const { error } = await supabase.from("agencias").upsert(
      {
        id: aId,
        empresa_id: empresaId,
        cidade_id: toUuid(a.cidadeId),
        nome: a.nome,
        comissao_percentual: a.comissaoPercentual,
        ativa: a.ativa,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Erro ao inserir agência ${a.nome}: ${error.message}`);
  }

  // 7. Usuários e Perfis
  console.log("7/12 Inserindo Usuários no Auth e Perfis...");
  for (const u of raw.usuarios) {
    let authUserId: string;

    // Tenta criar usuário no Supabase Auth
    const { data: newUser, error: errCreate } = await supabase.auth.admin.createUser({
      email: u.email,
      password: "navstar123", // Apenas para ambiente de desenvolvimento local
      email_confirm: true,
      user_metadata: { nome: u.nome },
    });

    if (errCreate) {
      // Se já existir, busca pelo email
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users.find((x) => x.email === u.email);
      if (!existingUser) {
        throw new Error(`Erro ao criar ou localizar usuário ${u.email}: ${errCreate.message}`);
      }
      authUserId = existingUser.id;
    } else {
      authUserId = newUser.user.id;
    }

    idMap.set(u.id, authUserId);

    const { error: errPerfil } = await supabase.from("perfis").upsert(
      {
        id: authUserId,
        empresa_id: empresaId,
        agencia_id: u.agenciaId ? toUuid(u.agenciaId) : null,
        nome: u.nome,
        papel: u.papel,
        ativo: u.ativo,
      },
      { onConflict: "id" }
    );
    if (errPerfil) throw new Error(`Erro ao inserir perfil para ${u.email}: ${errPerfil.message}`);

    // Linhas permitidas
    if (u.linhasPermitidas && u.linhasPermitidas.length > 0) {
      for (const linhaId of u.linhasPermitidas) {
        await supabase.from("perfis_linhas").upsert(
          {
            perfil_id: authUserId,
            linha_id: toUuid(linhaId),
          },
          { onConflict: "perfil_id,linha_id" }
        );
      }
    }
  }

  // 8. Viagens
  console.log("8/12 Inserindo Viagens...");
  for (const v of raw.viagens) {
    const vId = toUuid(v.id);
    const { error } = await supabase.from("viagens").upsert(
      {
        id: vId,
        empresa_id: empresaId,
        linha_id: toUuid(v.linhaId),
        embarcacao_id: toUuid(v.embarcacaoId),
        partida: v.partida,
        status: v.status,
        comandante: v.comandante || null,
        vendas_abertas: v.vendasAbertas,
        observacao: v.observacao || null,
      },
      { onConflict: "linha_id,partida" }
    );
    if (error) throw new Error(`Erro ao inserir viagem ${v.id}: ${error.message}`);
  }

  // 9. Encomendas e Histórico
  console.log("9/12 Inserindo Encomendas e Eventos...");
  for (const enc of raw.encomendas) {
    const encId = toUuid(enc.id);
    const { error: errEnc } = await supabase.from("encomendas").upsert(
      {
        id: encId,
        empresa_id: empresaId,
        codigo: enc.codigo,
        viagem_id: enc.viagemId ? toUuid(enc.viagemId) : null,
        origem_cidade_id: toUuid(enc.origemCidadeId),
        destino_cidade_id: toUuid(enc.destinoCidadeId),
        remetente_nome: enc.remetenteNome,
        remetente_doc: enc.remetenteDoc,
        remetente_tel: enc.remetenteTel,
        destinatario_nome: enc.destinatarioNome,
        destinatario_doc: (enc as unknown as { destinatarioDoc?: string }).destinatarioDoc || null,
        destinatario_tel: enc.destinatarioTel,
        descricao: enc.descricao,
        volumes: enc.volumes,
        peso_kg: enc.pesoKg,
        valor_declarado: enc.valorDeclarado ?? null,
        frete: enc.frete,
        pagador: enc.pagador,
        frete_pago: enc.fretePago,
        status: enc.status,
        entregue_a: (enc as unknown as { entregueA?: string }).entregueA || null,
      },
      { onConflict: "codigo" }
    );
    if (errEnc) throw new Error(`Erro ao inserir encomenda ${enc.codigo}: ${errEnc.message}`);

    const historico = (enc as unknown as { historico?: Array<{ status: any; descricao?: string; usuarioId?: string; data: string }> }).historico;
    if (historico && historico.length > 0) {
      for (const ev of historico) {
        await supabase.from("encomenda_eventos").insert({
          id: crypto.randomUUID(),
          encomenda_id: encId,
          status: ev.status,
          descricao: ev.descricao || null,
          usuario_id: ev.usuarioId ? toUuid(ev.usuarioId) : null,
          created_at: ev.data,
        });
      }
    }
  }

  console.log("✅ Seed concluído com sucesso no Supabase!");
}

runSeed().catch((err) => {
  console.error("❌ Falha no seed:", err);
  process.exit(1);
});
