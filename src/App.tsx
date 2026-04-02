import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "./components/Sidebar"
import { MapView } from "./components/MapView"
import {
  getBootstrap,
  parseCoordsInput,
  formatarHora
} from "./services/api"
import type {
  AreaTemporaria,
  BootstrapResponse,
  FiltroImpacto,
  RotaAnalisada
} from "./types"
import splashLogo from "./assets/splash.png"

const INITIAL_COORDS =
  "253231.67S/0542325.98W 253127.28S/0541434.07W 253311.64S/0541228.29W"

export type AreaMapaSelecionada =
  | { tipo: "FIXA"; chave: string; nome: string }
  | { tipo: "NOTAM"; chave: string; nome: string }
  | { tipo: "MANUAL"; chave: string; nome: string }
  | null

function nextAreaName(total: number) {
  return `AREA TEMPORARIA ${total + 1}`
}

function rotaKey(rota: RotaAnalisada) {
  return `${rota.ident}|${rota.origem}|${rota.destino}|${rota.rota_texto}|${rota.eobt}|${rota.eta}`
}

function textoTipoImpacto(rota: RotaAnalisada) {
  if (rota.tipo_impacto === "AMBAS") return "Permanente + Temporária"
  if (rota.tipo_impacto === "PERMANENTE") return "Permanente"
  if (rota.tipo_impacto === "TEMPORARIA") return "Temporária"
  return "Sem impacto"
}

function LoadingScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <img
          src={splashLogo}
          alt="Carregando"
          className="splash-logo"
        />
        <div className="splash-title">Carregando mapa</div>
        <div className="splash-subtitle">Buscando áreas, rotas e aerovias...</div>
      </div>
    </div>
  )
}

function ErrorScreen({
  error,
  onRetry
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="screen-center">
      <div className="error-box">
        <div>Falha ao carregar.</div>
        {error ? <div>{error}</div> : null}
        <button className="btn btn-primary" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

function RouteDetailsPanel({
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

function AreaImpactPanel({
  area,
  rotas,
  onClose,
  onSelecionarRota,
  rotaSelecionadaKeyAtual
}: {
  area: NonNullable<AreaMapaSelecionada>
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
                    <div>{rota.tipo_anv || "-"} | FL {rota.nivel_voo || "-"}</div>
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

export default function App() {
  const [data, setData] = useState<BootstrapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [inputNome, setInputNome] = useState("AREA TEMPORARIA 1")
  const [inputCoords, setInputCoords] = useState(INITIAL_COORDS)
  const [mostrarFixas, setMostrarFixas] = useState(true)
  const [mostrarNotamCsv, setMostrarNotamCsv] = useState(true)
  const [mostrarTemporarias, setMostrarTemporarias] = useState(true)
  const [areaSelecionada, setAreaSelecionada] = useState<string | null>(null)
  const [filtroImpacto, setFiltroImpacto] = useState<FiltroImpacto>("TODAS")
  const [rotaSelecionadaKey, setRotaSelecionadaKey] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [areasTemporariasManuais, setAreasTemporariasManuais] = useState<AreaTemporaria[]>([])
  const [areaMapaSelecionada, setAreaMapaSelecionada] = useState<AreaMapaSelecionada>(null)
  const [rotasImpactadasPelaArea, setRotasImpactadasPelaArea] = useState<RotaAnalisada[]>([])

  async function carregarBootstrap() {
    setLoading(true)
    setError("")

    try {
      const response = await getBootstrap()
      setData(response)

      if (!areaSelecionada && areasTemporariasManuais.length > 0) {
        setAreaSelecionada(areasTemporariasManuais[0].nome)
      }

      if (!areaSelecionada && response.areas_temporarias.length > 0) {
        setAreaSelecionada(response.areas_temporarias[0].nome)
      }

      setInputNome(nextAreaName(
        (response.areas_temporarias?.length ?? 0) + areasTemporariasManuais.length
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarBootstrap()
  }, [])

  async function handleAdicionar() {
    setLoading(true)
    setError("")

    try {
      const coords = parseCoordsInput(inputCoords)
      const nomeBase = inputNome.trim() || nextAreaName(areasTemporariasManuais.length)

      const nomeJaExisteNoFrontend = areasTemporariasManuais.some(
        (area) => area.nome.trim().toUpperCase() === nomeBase.trim().toUpperCase()
      )

      const nomeJaExisteNoBackend = (data?.areas_temporarias ?? []).some(
        (area) => area.nome.trim().toUpperCase() === nomeBase.trim().toUpperCase()
      )

      if (nomeJaExisteNoFrontend || nomeJaExisteNoBackend) {
        throw new Error("Já existe uma área com esse nome")
      }

      const novaArea: AreaTemporaria = {
        nome: nomeBase,
        coords_latlon: coords
      }

      setAreasTemporariasManuais((current) => [...current, novaArea])
      setAreaSelecionada(nomeBase)
      setInputNome(nextAreaName(
        (data?.areas_temporarias?.length ?? 0) + areasTemporariasManuais.length + 1
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar área")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemover() {
    if (!areaSelecionada) return

    setLoading(true)
    setError("")

    try {
      const proximoArray = areasTemporariasManuais.filter(
        (area) => area.nome !== areaSelecionada
      )

      setAreasTemporariasManuais(proximoArray)

      const backendAreas = data?.areas_temporarias ?? []
      const primeiraBackend = backendAreas[0]?.nome ?? null
      const primeiraFrontend = proximoArray[0]?.nome ?? null

      if (areaSelecionada && areasTemporariasManuais.some((a) => a.nome === areaSelecionada)) {
        setAreaSelecionada(primeiraFrontend ?? primeiraBackend)
      }

      setInputNome(nextAreaName(
        (data?.areas_temporarias?.length ?? 0) + proximoArray.length
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover área")
    } finally {
      setLoading(false)
    }
  }

  async function handleLimpar() {
    setLoading(true)
    setError("")

    try {
      setAreasTemporariasManuais([])
      setAreaSelecionada(data?.areas_temporarias?.[0]?.nome ?? null)
      setInputNome(nextAreaName(data?.areas_temporarias?.length ?? 0))
      setAreaMapaSelecionada(null)
      setRotasImpactadasPelaArea([])
      setRotaSelecionadaKey(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao limpar áreas")
    } finally {
      setLoading(false)
    }
  }

  const areasTemporariasCompletas = useMemo(() => {
    const backendAreas = data?.areas_temporarias ?? []
    return [...backendAreas, ...areasTemporariasManuais]
  }, [data, areasTemporariasManuais])

  const rotasTodas = useMemo(() => {
    return data?.rotas_analisadas ?? []
  }, [data])

  const rotaSelecionada = useMemo(() => {
    if (!data || !rotaSelecionadaKey) return null
    return data.rotas_analisadas.find((rota) => rotaKey(rota) === rotaSelecionadaKey) || null
  }, [data, rotaSelecionadaKey])

  useEffect(() => {
    if (!data || !rotaSelecionadaKey) return

    const existe = data.rotas_analisadas.some((rota) => rotaKey(rota) === rotaSelecionadaKey)

    if (!existe) {
      setRotaSelecionadaKey(null)
    }
  }, [data, rotaSelecionadaKey])

  function handleSelecionarRota(rota: RotaAnalisada | null) {
    if (!rota) {
      setRotaSelecionadaKey(null)
      return
    }

    const key = rotaKey(rota)
    setRotaSelecionadaKey((current) => (current === key ? null : key))
  }

  function handleSelecionarArea(
    area: AreaMapaSelecionada,
    rotasAfetadas: RotaAnalisada[]
  ) {
    if (!area) {
      setAreaMapaSelecionada(null)
      setRotasImpactadasPelaArea([])
      return
    }

    const mesmaAreaSelecionada =
      areaMapaSelecionada &&
      areaMapaSelecionada.tipo === area.tipo &&
      areaMapaSelecionada.chave === area.chave

    if (mesmaAreaSelecionada) {
      setAreaMapaSelecionada(null)
      setRotasImpactadasPelaArea([])
      setRotaSelecionadaKey(null)
      return
    }

    setAreaMapaSelecionada(area)
    setRotasImpactadasPelaArea(rotasAfetadas)
    setRotaSelecionadaKey(null)
  }

  function handleLimparSelecoes() {
    setRotaSelecionadaKey(null)
    setAreaMapaSelecionada(null)
    setRotasImpactadasPelaArea([])
  }

  if (!data && loading) {
    return <LoadingScreen />
  }

  if (!data) {
    return <ErrorScreen error={error} onRetry={() => void carregarBootstrap()} />
  }

  return (
    <div className={`app-layout ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((value) => !value)}
        inputNome={inputNome}
        setInputNome={setInputNome}
        inputCoords={inputCoords}
        setInputCoords={setInputCoords}
        mostrarFixas={mostrarFixas}
        setMostrarFixas={setMostrarFixas}
        mostrarNotamCsv={mostrarNotamCsv}
        setMostrarNotamCsv={setMostrarNotamCsv}
        mostrarTemporarias={mostrarTemporarias}
        setMostrarTemporarias={setMostrarTemporarias}
        areasTemporarias={areasTemporariasCompletas}
        areaSelecionada={areaSelecionada}
        setAreaSelecionada={setAreaSelecionada}
        rotasImpactadas={rotasTodas}
        filtroImpacto={filtroImpacto}
        setFiltroImpacto={setFiltroImpacto}
        rotaSelecionadaKey={rotaSelecionadaKey}
        onSelecionarRota={handleSelecionarRota}
        onAdicionar={() => void handleAdicionar()}
        onRemover={() => void handleRemover()}
        onLimpar={() => void handleLimpar()}
        loading={loading}
        error={error}
      />

      <main
        className={`content ${rotaSelecionada || areaMapaSelecionada ? "with-route-panel" : ""
          }`}
      >
        {!sidebarOpen ? (
          <button className="floating-sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
        ) : null}

        <MapView
          aeroportos={data.aeroportos}
          waypoints={data.waypoints}
          areasFixas={data.areas_fixas}
          areasNotamCsv={data.areas_notam_csv}
          areasTemporarias={areasTemporariasCompletas}
          rotasAnalisadas={data.rotas_analisadas}
          aeroviasAlta={data.aerovias_alta}
          aeroviasBaixa={data.aerovias_baixa}
          aeroviasUruguay={data.aerovias_uruguay}
          mostrarFixas={mostrarFixas}
          mostrarNotamCsv={mostrarNotamCsv}
          mostrarTemporarias={mostrarTemporarias}
          areaSelecionada={areaSelecionada}
          areaMapaSelecionada={areaMapaSelecionada}
          filtroImpacto={filtroImpacto}
          rotaSelecionada={rotaSelecionada}
          onSelecionarRota={handleSelecionarRota}
          onSelecionarArea={handleSelecionarArea}
          onLimparSelecoes={handleLimparSelecoes}
        />

        {rotaSelecionada ? (
          <RouteDetailsPanel
            rota={rotaSelecionada}
            onClose={() => handleSelecionarRota(null)}
          />
        ) : null}

        {!rotaSelecionada && areaMapaSelecionada ? (
          <AreaImpactPanel
            area={areaMapaSelecionada}
            rotas={rotasImpactadasPelaArea}
            onClose={handleLimparSelecoes}
            onSelecionarRota={handleSelecionarRota}
            rotaSelecionadaKeyAtual={rotaSelecionadaKey}
          />
        ) : null}
      </main>
    </div>
  )
}