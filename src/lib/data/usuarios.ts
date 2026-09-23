import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { mapUsuario, type DbPerfil } from "./map";
import type { PapelUsuario, Usuario } from "../types";

export type ResultadoUsuario<T = unknown> =
  | { ok: true; data: T; mensagem?: string }
  | { ok: false; erro: string };

/**
 * Lista todos os usuários da empresa autenticada.
 */
export const usuarios = cache(async (): Promise<Usuario[]> => {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Busca perfis e suas linhas
  const { data: perfis, error } = await supabase
    .from("perfis")
    .select(`*, perfis_linhas (*)`)
    .order("nome");

  if (error || !perfis) return [];

  // 2. Busca e-mails no Supabase Auth usando admin client
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>();
  if (authData?.users) {
    for (const u of authData.users) {
      if (u.email) emailMap.set(u.id, u.email);
    }
  }

  return perfis.map((p) => {
    const linhas = ((p.perfis_linhas as unknown as Array<{ linha_id: string }>) || []).map(
      (pl) => pl.linha_id
    );
    const email = emailMap.get(p.id) || "";
    return mapUsuario(p as unknown as DbPerfil, linhas, email);
  });
});

/**
 * Busca um usuário por ID.
 */
export const usuario = cache(async (id: string): Promise<Usuario | null> => {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: perfil, error } = await supabase
    .from("perfis")
    .select(`*, perfis_linhas (*)`)
    .eq("id", id)
    .maybeSingle();

  if (error || !perfil) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser?.user?.email || "";

  const linhas = ((perfil.perfis_linhas as unknown as Array<{ linha_id: string }>) || []).map(
    (pl) => pl.linha_id
  );

  return mapUsuario(perfil as unknown as DbPerfil, linhas, email);
});

/**
 * Cria um novo usuário no Supabase Auth + Perfis + Linhas, gerando link de convite.
 */
export async function criarUsuarioComConvite(dados: {
  nome: string;
  email: string;
  papel: PapelUsuario;
  agenciaId?: string;
  linhasPermitidas: string[];
  telefone?: string;
  origin?: string;
}): Promise<ResultadoUsuario<{ id: string; linkAtivacao?: string }>> {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  const papel = dados.papel;
  const telefone = dados.telefone?.trim() || null;
  const agenciaId = dados.agenciaId?.trim() || null;
  const linhasPermitidas = dados.linhasPermitidas || [];

  if (nome.length < 3) return { ok: false, erro: "Informe o nome completo do operador." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: "E-mail funcional inválido." };
  if (!["ADMIN", "GERENTE", "VENDEDOR", "CONFERENTE"].includes(papel)) {
    return { ok: false, erro: "Perfil de acesso inválido." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Identifica a empresa do usuário autenticado (ADMIN)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) return { ok: false, erro: "Sessão expirada. Faça login novamente." };

  const { data: currentPerfil } = await supabase
    .from("perfis")
    .select("empresa_id")
    .eq("id", currentUser.id)
    .single();

  if (!currentPerfil?.empresa_id) {
    return { ok: false, erro: "Empresa do administrador não identificada." };
  }

  const empresaId = currentPerfil.empresa_id;
  const baseUrl = dados.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${baseUrl}/primeiro-acesso`;

  // 1. Gera o link de convite / primeiro acesso no Supabase Auth
  let authUserId: string;
  let linkAtivacao: string | undefined;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { nome, papel, telefone },
      redirectTo,
    },
  });

  if (linkError) {
    // Se o usuário já existir no Auth, tenta verificar se o perfil já existe
    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = listData?.users.find((u) => u.email === email);
    if (!existing) {
      return { ok: false, erro: `Falha na autenticação: ${linkError.message}` };
    }
    authUserId = existing.id;

    // Gera link de recuperação/primeiro acesso para o usuário existente
    const { data: recData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    linkAtivacao = recData?.properties?.action_link;
  } else {
    authUserId = linkData.user.id;
    linkAtivacao = linkData.properties?.action_link;
  }

  // 2. Insere/atualiza o perfil em public.perfis
  const { error: perfilError } = await admin.from("perfis").upsert({
    id: authUserId,
    empresa_id: empresaId,
    agencia_id: agenciaId,
    nome,
    papel,
    telefone,
    ativo: true,
    onboarding_concluido: false,
    onboarding_passo: 0,
    convite_enviado_em: new Date().toISOString(),
  });

  if (perfilError) {
    return { ok: false, erro: `Erro ao salvar perfil: ${perfilError.message}` };
  }

  // 3. Atualiza linhas permitidas
  await admin.from("perfis_linhas").delete().eq("perfil_id", authUserId);

  if (linhasPermitidas.length > 0) {
    const rows = linhasPermitidas.map((linha_id) => ({
      perfil_id: authUserId,
      linha_id,
    }));
    const { error: linhasError } = await admin.from("perfis_linhas").insert(rows);
    if (linhasError) {
      console.warn("Aviso ao vincular linhas permitidas:", linhasError.message);
    }
  }

  return {
    ok: true,
    data: { id: authUserId, linkAtivacao },
    mensagem: "Usuário cadastrado com sucesso!",
  };
}

/**
 * Atualiza um usuário existente.
 */
export async function atualizarUsuario(dados: {
  id: string;
  nome: string;
  papel: PapelUsuario;
  agenciaId?: string;
  linhasPermitidas: string[];
  ativo: boolean;
  telefone?: string;
}): Promise<ResultadoUsuario<{ id: string }>> {
  const nome = dados.nome.trim();
  const papel = dados.papel;
  const telefone = dados.telefone?.trim() || null;
  const agenciaId = dados.agenciaId?.trim() || null;
  const linhasPermitidas = dados.linhasPermitidas || [];

  if (nome.length < 3) return { ok: false, erro: "Informe o nome completo do operador." };

  const admin = createAdminClient();

  // Verifica proteção de manter ao menos um ADMIN ativo
  const { data: usuarioAtual } = await admin
    .from("perfis")
    .select("papel, ativo, empresa_id")
    .eq("id", dados.id)
    .single();

  if (usuarioAtual?.papel === "ADMIN" && (papel !== "ADMIN" || !dados.ativo)) {
    const { count } = await admin
      .from("perfis")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", usuarioAtual.empresa_id)
      .eq("papel", "ADMIN")
      .eq("ativo", true);

    if ((count || 0) <= 1) {
      return { ok: false, erro: "Precisa existir ao menos um administrador ativo na empresa." };
    }
  }

  // Atualiza perfil
  const { error: perfilError } = await admin
    .from("perfis")
    .update({
      nome,
      papel,
      agencia_id: agenciaId,
      telefone,
      ativo: dados.ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dados.id);

  if (perfilError) {
    return { ok: false, erro: `Erro ao atualizar perfil: ${perfilError.message}` };
  }

  // Atualiza linhas permitidas
  await admin.from("perfis_linhas").delete().eq("perfil_id", dados.id);

  if (linhasPermitidas.length > 0) {
    const rows = linhasPermitidas.map((linha_id) => ({
      perfil_id: dados.id,
      linha_id,
    }));
    await admin.from("perfis_linhas").insert(rows);
  }

  return { ok: true, data: { id: dados.id }, mensagem: "Usuário atualizado com sucesso." };
}

/**
 * Reenvia / regera o link de ativação para um operador.
 */
export async function reenviarConvite(
  usuarioId: string,
  origin?: string
): Promise<ResultadoUsuario<{ linkAtivacao?: string }>> {
  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(usuarioId);
  if (authError || !authUser?.user?.email) {
    return { ok: false, erro: "Usuário de autenticação não encontrado." };
  }

  const baseUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${baseUrl}/primeiro-acesso`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: authUser.user.email,
    options: { redirectTo },
  });

  let linkAtivacao = linkData?.properties?.action_link;

  if (linkError) {
    // Tenta recovery caso já tenha sido confirmado
    const { data: recData, error: recError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: authUser.user.email,
      options: { redirectTo },
    });
    if (recError) {
      return { ok: false, erro: `Não foi possível gerar link: ${recError.message}` };
    }
    linkAtivacao = recData?.properties?.action_link;
  }

  await admin
    .from("perfis")
    .update({ convite_enviado_em: new Date().toISOString() })
    .eq("id", usuarioId);

  return {
    ok: true,
    data: { linkAtivacao },
    mensagem: "Link de ativação gerado com sucesso.",
  };
}

/**
 * Atualiza o progresso do onboarding do operador autenticado.
 */
export async function registrarProgressoOnboarding(
  passo: number,
  concluido = false,
  telefone?: string
): Promise<ResultadoUsuario<void>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("atualizar_onboarding", {
    p_passo: passo,
    p_concluido: concluido,
    p_telefone: telefone || undefined,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }

  return { ok: true, data: undefined };
}
