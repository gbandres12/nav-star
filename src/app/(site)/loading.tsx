import { EsqueletoPagina } from "@/components/ui-skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <EsqueletoPagina cards={2} />
    </div>
  );
}
