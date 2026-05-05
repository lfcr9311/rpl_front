import type { RotaAnalisada } from "../types"
import { formatarHora } from "../services/api"
import { textoTipoImpacto } from "../utils/route"

export function RouteDetailsPanel({
  rota,
  onClose
}: {
  rota: RotaAnalisada
  onClose: () => void
}) {
  return (
    <aside className="route-details-panel">
      <div className="route-details-header">
        <div>
          <div className="route-details-title">
            Número do voo: {rota.ident || "-"}
          </div>
          <div className="route-details-subtitle">
            {rota.origem} → {rota.destino}
          </div>
        </div>

        <button className="route-details-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="route-details-body">
        <div className="route-details-block">
          <div><strong>Número do voo:</strong> {rota.ident || "-"}</div>
          <div><strong>Aeronave:</strong> {rota.tipo_anv || "-"}</div>
          <div><strong>Nível de voo:</strong> {rota.nivel_voo || "-"}</div>
          <div><strong>Origem:</strong> {rota.origem}</div>
          <div><strong>Destino:</strong> {rota.destino}</div>
          <div><strong>EOBT:</strong> {formatarHora(rota.eobt)}</div>
          <div><strong>EET:</strong> {formatarHora(rota.eet)}</div>
          <div><strong>ETA:</strong> {formatarHora(rota.eta)}</div>
          <div><strong>Impacto:</strong> {textoTipoImpacto(rota)}</div>
        </div>

        <div className="route-details-block">
          <div className="route-details-section-title">Rota</div>
          <div className="route-details-pre">{rota.rota_texto}</div>
        </div>

        <div className="route-details-block">
          <div className="route-details-section-title">Áreas temporárias</div>
          {rota.impactos_temporarias.length > 0 ? (
            <div className="route-details-list">
              {rota.impactos_temporarias.map((item, index) => (
                <div key={`${item.nome}-${index}`} className="route-details-chip">
                  {item.nome}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhuma</div>
          )}
        </div>

        <div className="route-details-block">
          <div className="route-details-section-title">Áreas permanentes</div>
          {rota.impactos_fixas.length > 0 ? (
            <div className="route-details-list">
              {rota.impactos_fixas.map((item, index) => (
                <div key={`${item.nome}-${index}`} className="route-details-chip">
                  {item.nome} [{item.area_type}/{item.fir_match}]
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nenhuma</div>
          )}
        </div>

        <div className="route-details-block">
          <div className="route-details-section-title">Linha RPL</div>
          <div className="route-details-pre">{rota.linha_original}</div>
        </div>
      </div>
    </aside>
  )
}