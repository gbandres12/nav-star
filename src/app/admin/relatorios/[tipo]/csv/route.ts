import type { NextRequest } from "next/server";
import { podeAcessar } from "@/lib/permissoes";
import { gerarRelatorio, lerFiltros, paraCsv } from "@/lib/relatorios";
import { operadorAtual } from "@/lib/sessao";

/** Exporta o relatório com os mesmos filtros da tela, pronto para abrir no Excel */
export async function GET(req: NextRequest, ctx: RouteContext<"/admin/relatorios/[tipo]/csv">) {
  const op = await operadorAtual();
  if (!podeAcessar(op.papel, "/admin/relatorios")) return new Response("Sem permissão", { status: 403 });
  const { tipo } = await ctx.params;
  const f = lerFiltros(Object.fromEntries(req.nextUrl.searchParams));
  const r = gerarRelatorio(tipo, f);
  if (!r) return new Response("Relatório não encontrado", { status: 404 });
  return new Response(paraCsv(r), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${tipo}-${f.de}_a_${f.ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
