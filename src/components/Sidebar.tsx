import { useMemo, useState } from "react"
import { SectionCard } from "./SectionCard"
import type {
  AreaTemporaria,
  FiltroImpacto,
  RotaAnalisada
} from "../types"
import type { ManualRouteResponse } from "../services/api"
import { buildAreaLabel, formatarHora } from "../services/api"

type Props = {
  isOpen: boolean
  onToggle: () => void
  inputNome: string
  setInputNome: (value: string) => void
  inputCoords: string
  setInputCoords: (value: string) => void
  mostrarFixas: boolean
  setMostrarFixas: (value: boolean) => void
  mostrarNotamCsv: boolean
  setMostrarNotamCsv: (value: boolean) => void
  mostrarTemporarias: boolean
  setMostrarTemporarias: (value: boolean) => void
  areasTemporarias: AreaTemporaria[]
  areaSelecionada: string | null
  setAreaSelecionada: (nome: string | null) => void
  rotasImpactadas: RotaAnalisada[]
  filtroImpacto: FiltroImpacto
  setFiltroImpacto: (value: FiltroImpacto) => void
  rotaSelecionadaKey: string | null
  onSelecionarRota: (rota: RotaAnalisada | null) => void
  onAdicionar: () => void
  onRemover: () => void
  onLimpar: () => void
  loading: boolean
  error: string
  manualRoute: ManualRouteResponse | null
  manualRouteLoading: boolean
  manualRouteError: string
  onGerarRotaManual: (payload: {
    origem: string
    destino: string
    rota: string
  }) => void
  onLimparRotaManual: () => void
}

export function rotaKey(rota: RotaAnalisada) {
  return `${rota.ident}|${rota.origem}|${rota.destino}|${rota.rota_texto}|${rota.eobt}|${rota.eta}`
}

export function rotaCasaNoFiltro(rota: RotaAnalisada, filtro: FiltroImpacto): boolean {
  if (filtro === "TODAS") return true
  if (filtro === "PERMANENTE") return !!rota.impactada_fixa
  if (filtro === "TEMPORARIA") return !!rota.impactada_temporaria
  if (filtro === "AMBAS") return !!rota.impactada_fixa && !!rota.impactada_temporaria
  return true
}

function Header() {
  return (
    <div className="sidebar-header sidebar-header-row">
      <div>
        <h1 className="app-title">NOTAM Map</h1>
        <p className="app-subtitle">Áreas, NOTAM e rotas</p>
      </div>
    </div>
  )
}

function ManualRouteSection(props: Props) {
  const [open, setOpen] = useState(true)
  const [origem, setOrigem] = useState("SBGR")
  const [destino, setDestino] = useState("SBRF")
  const [rota, setRota] = useState("NIBRU UZ171 KEVUN")

  function submit() {
    props.onGerarRotaManual({
      origem: origem.trim().toUpperCase(),
      destino: destino.trim().toUpperCase(),
      rota: rota.trim().toUpperCase()
    })
  }

  return (
    <SectionCard title="Rota manual">
      <button
        type="button"
        className="section-collapse-btn"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? "Fechar" : "Abrir"}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <>
          <label className="label">Origem</label>
          <input
            className="input"
            value={origem}
            onChange={(e) => setOrigem(e.target.value.toUpperCase())}
            placeholder="SBGR"
          />

          <label className="label">Destino</label>
          <input
            className="input"
            value={destino}
            onChange={(e) => setDestino(e.target.value.toUpperCase())}
            placeholder="SBRF"
          />

          <label className="label">Rota</label>
          <textarea
            className="textarea"
            value={rota}
            onChange={(e) => setRota(e.target.value.toUpperCase())}
            placeholder="NIBRU UZ171 KEVUN"
          />

          <div className="button-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={props.manualRouteLoading}
            >
              {props.manualRouteLoading ? "Gerando..." : "Gerar rota"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={props.onLimparRotaManual}
              disabled={props.manualRouteLoading || !props.manualRoute}
            >
              Limpar rota
            </button>
          </div>

          {props.manualRouteError ? (
            <div className="alert alert-error">{props.manualRouteError}</div>
          ) : null}

          {props.manualRoute ? (
            <div className="collapsed-summary">
              <div className="collapsed-summary-line">
                Pontos: <strong>{props.manualRoute.coords_latlon.length}</strong>
              </div>
              <div className="collapsed-summary-line">
                Distância: <strong>{props.manualRoute.distancia_total_nm} NM</strong>
              </div>
              <div className="collapsed-summary-line">
                Resolvido: <strong>{props.manualRoute.pontos_resolvidos.join(" → ")}</strong>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="collapsed-summary">
          <div className="collapsed-summary-line">
            Rota: <strong>{props.manualRoute?.rota || "-"}</strong>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function LayerVisibilityControls(
  props: Pick<
    Props,
    | "mostrarFixas"
    | "setMostrarFixas"
    | "mostrarNotamCsv"
    | "setMostrarNotamCsv"
    | "mostrarTemporarias"
    | "setMostrarTemporarias"
  >
) {
  return (
    <div className="checkbox-group">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={props.mostrarFixas}
          onChange={(e) => props.setMostrarFixas(e.target.checked)}
        />
        <span>Mostrar áreas permanentes</span>
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={props.mostrarNotamCsv}
          onChange={(e) => props.setMostrarNotamCsv(e.target.checked)}
        />
        <span>Mostrar áreas temporárias da API</span>
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={props.mostrarTemporarias}
          onChange={(e) => props.setMostrarTemporarias(e.target.checked)}
        />
        <span>Mostrar áreas temporárias manuais</span>
      </label>
    </div>
  )
}

function ManualAreaSection(props: Props) {
  const [open, setOpen] = useState(false)

  return (
    <SectionCard title="Área temporária manual">
      <button
        type="button"
        className="section-collapse-btn"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? "Fechar" : "Abrir"}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <>
          <label className="label">Nome</label>
          <input
            className="input"
            value={props.inputNome}
            onChange={(e) => props.setInputNome(e.target.value)}
          />

          <label className="label">Coordenadas</label>
          <textarea
            className="textarea"
            value={props.inputCoords}
            onChange={(e) => props.setInputCoords(e.target.value)}
          />

          <LayerVisibilityControls
            mostrarFixas={props.mostrarFixas}
            setMostrarFixas={props.setMostrarFixas}
            mostrarNotamCsv={props.mostrarNotamCsv}
            setMostrarNotamCsv={props.setMostrarNotamCsv}
            mostrarTemporarias={props.mostrarTemporarias}
            setMostrarTemporarias={props.setMostrarTemporarias}
          />

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={props.onAdicionar}
              disabled={props.loading}
            >
              Adicionar e analisar
            </button>

            <button
              className="btn btn-danger"
              onClick={props.onRemover}
              disabled={props.loading || !props.areaSelecionada}
            >
              Remover selecionada
            </button>

            <button
              className="btn btn-secondary"
              onClick={props.onLimpar}
              disabled={props.loading}
            >
              Limpar todas
            </button>
          </div>

          {props.error ? <div className="alert alert-error">{props.error}</div> : null}
        </>
      ) : (
        <div className="collapsed-summary">
          <div className="collapsed-summary-line">
            Áreas manuais: <strong>{props.areasTemporarias.length}</strong>
          </div>
          <div className="collapsed-summary-line">
            Selecionada: <strong>{props.areaSelecionada || "-"}</strong>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function AreasListSection({
  areasTemporarias,
  areaSelecionada,
  setAreaSelecionada
}: Pick<Props, "areasTemporarias" | "areaSelecionada" | "setAreaSelecionada">) {
  return (
    <SectionCard title="Áreas temporárias carregadas">
      <div className="list-scroll">
        {areasTemporarias.length === 0 ? (
          <div className="empty">Nenhuma área temporária manual carregada</div>
        ) : (
          areasTemporarias.map((area) => {
            const active = areaSelecionada === area.nome

            return (
              <button
                key={area.nome}
                className={`list-item ${active ? "active" : ""}`}
                onClick={() => setAreaSelecionada(active ? null : area.nome)}
              >
                {buildAreaLabel(area)}
              </button>
            )
          })
        )}
      </div>
    </SectionCard>
  )
}

function RotasImpactadasSection({
  rotasImpactadas,
  filtroImpacto,
  setFiltroImpacto,
  rotaSelecionadaKey,
  onSelecionarRota
}: Pick<
  Props,
  | "rotasImpactadas"
  | "filtroImpacto"
  | "setFiltroImpacto"
  | "rotaSelecionadaKey"
  | "onSelecionarRota"
>) {
  const [buscaVoo, setBuscaVoo] = useState("")

  const rotasFiltradas = useMemo(() => {
    const termo = buscaVoo.trim().toUpperCase()

    return rotasImpactadas
      .filter((rota) => rotaCasaNoFiltro(rota, filtroImpacto))
      .filter((rota) => {
        if (!termo) return true
        return String(rota.ident ?? "").toUpperCase().includes(termo)
      })
      .sort((a, b) => {
        const identCompare = String(a.ident ?? "").localeCompare(String(b.ident ?? ""))
        if (identCompare !== 0) return identCompare

        const origemCompare = String(a.origem ?? "").localeCompare(String(b.origem ?? ""))
        if (origemCompare !== 0) return origemCompare

        return String(a.destino ?? "").localeCompare(String(b.destino ?? ""))
      })
  }, [rotasImpactadas, filtroImpacto, buscaVoo])

  return (
    <SectionCard title="Rotas impactadas">
      <label className="label">Filtrar por tipo de impacto</label>

      <select
        className="input"
        value={filtroImpacto}
        onChange={(e) => setFiltroImpacto(e.target.value as FiltroImpacto)}
      >
        <option value="TODAS">Todas</option>
        <option value="PERMANENTE">Somente permanentes</option>
        <option value="TEMPORARIA">Somente temporárias</option>
        <option value="AMBAS">Permanente + temporária</option>
      </select>

      <label className="label">Buscar por número do voo</label>

      <div className="search-row">
        <input
          className="input"
          type="text"
          value={buscaVoo}
          onChange={(e) => setBuscaVoo(e.target.value)}
          placeholder="Ex: AZU1234"
        />

        {buscaVoo ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setBuscaVoo("")}
          >
            Limpar
          </button>
        ) : null}
      </div>

      <div className="section-mini-info">
        Resultados: <strong>{rotasFiltradas.length}</strong>
      </div>

      {rotaSelecionadaKey ? (
        <button className="btn btn-secondary" onClick={() => onSelecionarRota(null)}>
          Limpar seleção
        </button>
      ) : null}

      <div className="list-scroll">
        {rotasFiltradas.map((rota, index) => {
          const active = rotaSelecionadaKey === rotaKey(rota)

          return (
            <button
              key={`${rota.ident}-${rota.origem}-${rota.destino}-${rota.eobt}-${index}`}
              className={`route-list-item ${active ? "active" : ""}`}
              onClick={() => onSelecionarRota(active ? null : rota)}
            >
              <div><strong>Número do voo:</strong> {rota.ident || "-"}</div>
              <div><strong>Origem/Destino:</strong> {rota.origem} → {rota.destino}</div>
              <div><strong>Horários:</strong> {formatarHora(rota.eobt)} | {formatarHora(rota.eet)} | {formatarHora(rota.eta)}</div>
              <div><strong>Aeronave:</strong> {rota.tipo_anv || "-"}</div>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

export function Sidebar(props: Props) {
  return (
    <aside className={`sidebar ${props.isOpen ? "" : "hidden"}`}>
      <Header />

      <ManualRouteSection {...props} />

      <ManualAreaSection {...props} />

      <AreasListSection
        areasTemporarias={props.areasTemporarias}
        areaSelecionada={props.areaSelecionada}
        setAreaSelecionada={props.setAreaSelecionada}
      />

      <RotasImpactadasSection
        rotasImpactadas={props.rotasImpactadas}
        filtroImpacto={props.filtroImpacto}
        setFiltroImpacto={props.setFiltroImpacto}
        rotaSelecionadaKey={props.rotaSelecionadaKey}
        onSelecionarRota={props.onSelecionarRota}
      />
    </aside>
  )
}