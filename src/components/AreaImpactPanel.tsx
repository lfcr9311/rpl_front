import type { RotaAnalisada } from "../types"
import type { AreaSelecionadaNaoNula } from "../app/types"
import { rotaKey } from "../app/keys"
import { textoTipoImpacto } from "../utils/route"

export function AreaImpactPanel({
  area,
  rotas,
  onClose,
  onSelecionarRota,
  rotaSelecionadaKeyAtual
}: {
  area: AreaSelecionadaNaoNula
  rotas: RotaAnalisada[]
  onClose: () => void
  onSelecionarRota: (rota: RotaAnalisada) => void
  rotaSelecionadaKeyAtual: string | null
}) {
  return (
    <aside className="route-details-panel">
      <div className="route-details-header">
        <div>
          <div className="route-details-title">Área selecionada</div>
          <div className="route-details-subtitle">{area.nome}</div>
        </div>

        <button className="route-details-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="route-details-body">
        <div className="route-details-block">
          <div><strong>Tipo:</strong> {area.tipo}</div>
          <div><strong>Total de voos afetados:</strong> {rotas.length}</div>
        </div>

        <div className="route-details-block">
          <div className="route-details-section-title">Voos afetados</div>

          {rotas.length > 0 ? (
            <div className="route-details-list">
              {rotas.map((rota) => {
                const key = rotaKey(rota)
                const selecionada = rotaSelecionadaKeyAtual === key

                return (
                  <button
                    key={key}
                    type="button"
                    className={`route-impact-item ${selecionada ? "selected" : ""}`}
                    onClick={() => onSelecionarRota(rota)}
                  >
                    <div><strong>{rota.ident || "-"}</strong></div>
                    <div>{rota.origem} → {rota.destino}</div>
                    <div>{textoTipoImpacto(rota)}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="empty">Nenhum voo afetado</div>
          )}
        </div>
      </div>
    </aside>
  )
}