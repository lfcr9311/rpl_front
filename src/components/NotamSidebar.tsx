import { memo, useEffect, useMemo, useState } from "react"
import type { AreaNotamCsv } from "../types"
import type { AreaMapaSelecionada } from "../App"
import { Filter, Search, X, BellRing } from "lucide-react"
import { getNotamReadStates, setNotamReadState } from "../services/api"

type FilterType = "TODOS" | "VISTO" | "NAO_VISTO"

type Props = {
  notams?: AreaNotamCsv[]
  areaMapaSelecionada: AreaMapaSelecionada
  onSelectNotam: (area: AreaNotamCsv) => void
  onClose: () => void
  onReadStateChanged: () => void
}

function normalizarTexto(valor: unknown) {
  return String(valor ?? "").trim().toUpperCase()
}

function normalizarValor(valor: unknown) {
  return String(valor ?? "").trim()
}

function buildReadKey(area: AreaNotamCsv) {
  const sourceId = normalizarValor(area.source_id)
  const numeroNotam = normalizarTexto(area.numero_notam)
  const fir = normalizarTexto(area.fir_match)

  if (sourceId) {
    return `SRC::${sourceId}`
  }

  return `ALT::${numeroNotam}::${fir}`
}

function buildReadKeyFromState(item: {
  sourceId?: string | null
  numeroNotam?: string | null
  fir?: string | null
}) {
  const sourceId = normalizarValor(item.sourceId)
  const numeroNotam = normalizarTexto(item.numeroNotam)
  const fir = normalizarTexto(item.fir)

  if (sourceId) {
    return `SRC::${sourceId}`
  }

  return `ALT::${numeroNotam}::${fir}`
}

function areaNotamKeySidebar(area: AreaNotamCsv) {
  return `NOTAM|${area.numero_notam || area.nome}|${area.fir_match}|${area.geometry_type}|${area.source_id || ""}`
}

function isMarcadoNotam(area: AreaNotamCsv, marcados: Set<string>) {
  if (area.lido) return true
  return marcados.has(buildReadKey(area))
}

function NotamSidebarComponent({
  notams,
  areaMapaSelecionada,
  onSelectNotam,
  onClose,
  onReadStateChanged
}: Props) {
  const [filtro, setFiltro] = useState<FilterType>("TODOS")
  const [busca, setBusca] = useState("")
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState<Set<string>>(new Set())

  const listaBase = useMemo(() => {
    return Array.isArray(notams) ? notams : []
  }, [notams])

  useEffect(() => {
    let ativo = true

    async function carregarEstados() {
      try {
        const estados = await getNotamReadStates()
        if (!ativo) return

        const next = new Set<string>()

        for (const item of estados) {
          if (item.lido) {
            next.add(buildReadKeyFromState(item))
          }
        }

        setMarcados(next)
      } catch (error) {
        console.error("Erro ao carregar estados de leitura dos NOTAMs", error)
      }
    }

    void carregarEstados()

    return () => {
      ativo = false
    }
  }, [])

  const toggleMarcado = async (notam: AreaNotamCsv) => {
    const key = buildReadKey(notam)
    const marcadoAtual = isMarcadoNotam(notam, marcados)
    const novoValor = !marcadoAtual

    setSalvando((current) => {
      const next = new Set(current)
      next.add(key)
      return next
    })

    setMarcados((current) => {
      const next = new Set(current)
      if (novoValor) next.add(key)
      else next.delete(key)
      return next
    })

    try {
      await setNotamReadState({
        sourceId: notam.source_id,
        numeroNotam: notam.numero_notam,
        fir: notam.fir_match,
        lido: novoValor
      })

      onReadStateChanged()
    } catch (error) {
      console.error("Erro ao salvar leitura do NOTAM", error)

      setMarcados((current) => {
        const next = new Set(current)
        if (novoValor) next.delete(key)
        else next.add(key)
        return next
      })
    } finally {
      setSalvando((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  const listaFiltrada = useMemo(() => {
    const textoBusca = normalizarTexto(busca)

    return listaBase.filter((notam) => {
      const id = normalizarValor(notam.numero_notam || notam.nome || "")
      const idNormalizado = normalizarTexto(id)
      const nomeNormalizado = normalizarTexto(notam.nome)
      const firNormalizado = normalizarTexto(notam.fir_match)
      const tipoNormalizado = normalizarTexto(notam.area_type)
      const marcado = isMarcadoNotam(notam, marcados)

      if (filtro === "VISTO" && !marcado) return false
      if (filtro === "NAO_VISTO" && marcado) return false

      if (!textoBusca) return true

      return (
        idNormalizado.includes(textoBusca) ||
        nomeNormalizado.includes(textoBusca) ||
        firNormalizado.includes(textoBusca) ||
        tipoNormalizado.includes(textoBusca)
      )
    })
  }, [listaBase, filtro, marcados, busca])

  const stats = useMemo(() => {
    let vistos = 0
    let naoVistos = 0

    for (const notam of listaBase) {
      if (isMarcadoNotam(notam, marcados)) vistos += 1
      else naoVistos += 1
    }

    return {
      total: listaBase.length,
      vistos,
      naoVistos
    }
  }, [listaBase, marcados])

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
              {listaFiltrada.length} exibidos de {stats.total}
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
            <div className="notam-stat-value">{stats.vistos}</div>
          </div>

          <div className="notam-stat-card">
            <div className="notam-stat-label">Não vistos</div>
            <div className="notam-stat-value">{stats.naoVistos}</div>
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
            const id = normalizarValor(notam.numero_notam || notam.nome || `NOTAM-${index}`)
            const chaveNotam = areaNotamKeySidebar(notam)

            const isSelected =
              areaMapaSelecionada?.tipo === "NOTAM" &&
              normalizarTexto(areaMapaSelecionada?.chave) === normalizarTexto(chaveNotam)

            const isMarcado = isMarcadoNotam(notam, marcados)
            const isSaving = salvando.has(buildReadKey(notam))

            return (
              <div
                key={`${chaveNotam}-${index}`}
                className={`notam-card ${isSelected ? "selected active" : ""} ${isMarcado ? "visto" : ""}`}
                onClick={() => onSelectNotam(notam)}
              >
                <div className="notam-card-top">
                  <input
                    type="checkbox"
                    checked={isMarcado}
                    disabled={isSaving}
                    onChange={(e) => {
                      e.stopPropagation()
                      void toggleMarcado(notam)
                    }}
                    className="notam-checkbox"
                  />

                  <div className="notam-card-main">
                    <div className="notam-card-id">{id}</div>
                    <div className="notam-card-name">{notam.nome || "-"}</div>
                  </div>
                </div>

                <div className="notam-tags">
                  <span className="notam-tag">FIR {notam.fir_match || "-"}</span>
                  <span className="notam-tag">{notam.area_type || "SEM TIPO"}</span>
                  {notam.geometry_type === "CIRCLE" ? (
                    <span className="notam-tag highlight">
                      {Math.round((notam.radius_m ?? 0) / 1852)} NM
                    </span>
                  ) : null}
                  {isSaving ? <span className="notam-tag">SALVANDO</span> : null}
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