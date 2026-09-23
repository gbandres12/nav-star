import { Ship } from "lucide-react";
import { dateShort, duration, time, weekday } from "@/lib/format";

type Parada = { cidade: { nome: string; uf: string }; porto: { nome: string } };

export function TripSummary({ origem, destino, saida, chegada, embarcacao }: { origem: Parada; destino: Parada; saida: Date; chegada: Date; embarcacao: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-rio-200 uppercase">
        <Ship size={14} /> {embarcacao}
      </p>
      <div className="mt-4 space-y-4">
        {[
          { p: origem, t: saida, l: "Embarque" },
          { p: destino, t: chegada, l: "Desembarque (previsão)" },
        ].map((x, i) => (
          <div key={i} className="flex gap-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${i === 0 ? "bg-rio-400" : "border-2 border-rio-400"}`} />
            <div>
              <p className="text-xs text-rio-200">{x.l}</p>
              <p className="font-bold">{x.p.cidade.nome}/{x.p.cidade.uf}</p>
              <p className="text-sm text-rio-100">
                {weekday(x.t)} {dateShort(x.t)} · {time(x.t)} · {x.p.porto.nome}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-rio-200">Duração estimada {duration((chegada.getTime() - saida.getTime()) / 60000)}</p>
    </div>
  );
}
