import { memo, useMemo, useState } from "react"
import type { AreaNotamCsv } from "../types"
import type { AreaMapaSelecionada } from "../App"
import { Eye, EyeOff, Filter, Search, X, BellRing } from "lucide-react"

type FilterType = "TODOS" | "VISTO" | "NAO_VISTO"

type Props = {
  notams?: AreaNotamCsv[]
  areaMapaSelecionada: AreaMapaSelecionada
  onSelectNotam: (area: AreaNotamCsv) => void
  onClose: () => void
}

function normalizarTexto(valor: unknown) {
  return String(valor ?? "").trim().toUpperCase()
}

function areaNotamKeySidebar(area: AreaNotamCsv) {
  return `NOTAM|${area.numero_notam || area.nome}|${area.fir_match}|${area.geometry_type}`
}

function NotamSidebarComponent({
  notams,
  areaMapaSelecionada,
  onSelectNotam,
  onClose
}: Props) {
  const [filtro, setFiltro] = useState<FilterType>("TODOS")
  const [busca, setBusca] = useState("")
  const [vistos, setVistos] = useState<Set<string>>(new Set())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const listaBase = useMemo(() => {
    return Array.isArray(notams) ? notams : []
  }, [notams])

  const toggleVisto = (id: string) => {
    setVistos((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelecionados((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const listaFiltrada = useMemo(() => {
    const textoBusca = normalizarTexto(busca)

    return listaBase.filter((notam) => {
      const id = String(notam.numero_notam || notam.nome || "").trim()
      const idNormalizado = normalizarTexto(id)
      const nomeNormalizado = normalizarTexto(notam.nome)
      const firNormalizado = normalizarTexto(notam.fir_match)
      const tipoNormalizado = normalizarTexto(notam.area_type)

      if (filtro === "VISTO" && !vistos.has(id)) return false
      if (filtro === "NAO_VISTO" && vistos.has(id)) return false

      if (!textoBusca) return true

      return (
        idNormalizado.includes(textoBusca) ||
        nomeNormalizado.includes(textoBusca) ||
        firNormalizado.includes(textoBusca) ||
        tipoNormalizado.includes(textoBusca)
      )
    })
  }, [listaBase, filtro, vistos, busca])

  return (
    <aside className="notam-sidebar-panel">
      <div className="notam-sidebar-header">
        <div className="notam-sidebar-title-row">
          <div>
            <div className="notam-sidebar-title">
              <BellRing size={18} />
              <span>NOTAMs</span>
            </div>
            <div className="notam-sidebar-subtitle">
              {listaFiltrada.length} exibidos de {listaBase.length}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="notam-close-btn"
            title="Fechar painel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="notam-stats">
          <div className="notam-stat-card">
            <div className="notam-stat-label">Vistos</div>
            <div className="notam-stat-value">{vistos.size}</div>
          </div>

          <div className="notam-stat-card">
            <div className="notam-stat-label">Marcados</div>
            <div className="notam-stat-value">{selecionados.size}</div>
          </div>
        </div>

        <div className="notam-search-box">
          <Search size={16} className="notam-search-icon" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar NOTAM, FIR, tipo..."
            className="notam-search-input"
          />
        </div>

        <div className="notam-filter-title">
          <Filter size={14} />
          <span>Filtro</span>
        </div>

        <div className="notam-filter-row">
          {(["TODOS", "VISTO", "NAO_VISTO"] as FilterType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFiltro(item)}
              className={`notam-filter-btn ${filtro === item ? "active" : ""}`}
            >
              {item === "NAO_VISTO" ? "NÃO VISTO" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="notam-sidebar-list">
        {listaBase.length === 0 ? (
          <div className="notam-empty-state">
            Nenhum NOTAM recebido em <strong>areas_notam_csv</strong>.
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="notam-empty-state">
            Nenhum NOTAM encontrado com o filtro atual.
          </div>
        ) : (
          listaFiltrada.map((notam, index) => {
            const id = String(notam.numero_notam || notam.nome || `NOTAM-${index}`).trim()
            const chaveNotam = areaNotamKeySidebar(notam)

            const isSelected =
              areaMapaSelecionada?.tipo === "NOTAM" &&
              normalizarTexto(areaMapaSelecionada?.chave) === normalizarTexto(chaveNotam)

            const isVisto = vistos.has(id)
            const isMarcado = selecionados.has(id)

            return (
              <div
                key={`${chaveNotam}-${index}`}
                className={`notam-card ${isSelected ? "selected active" : ""} ${isVisto ? "visto" : ""}`}
                onClick={() => onSelectNotam(notam)}
              >
                <div className="notam-card-top">
                  <input
                    type="checkbox"
                    checked={isMarcado}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelect(id)
                    }}
                    className="notam-checkbox"
                  />

                  <div className="notam-card-main">
                    <div className="notam-card-id">{id}</div>
                    <div className="notam-card-name">{notam.nome || "-"}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleVisto(id)
                    }}
                    className={`notam-eye-btn ${isVisto ? "seen" : ""}`}
                    title={isVisto ? "Marcar como não visto" : "Marcar como visto"}
                  >
                    {isVisto ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                <div className="notam-tags">
                  <span className="notam-tag">FIR {notam.fir_match || "-"}</span>
                  <span className="notam-tag">{notam.area_type || "SEM TIPO"}</span>
                  {notam.geometry_type === "CIRCLE" ? (
                    <span className="notam-tag highlight">
                      {Math.round((notam.radius_m ?? 0) / 1852)} NM
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

export const NotamSidebar = memo(NotamSidebarComponent)