import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "./components/Sidebar"
import { MapView } from "./components/MapView"
import { NotamSidebar } from "./components/NotamSidebar"
import { LoadingScreen } from "./components/LoadingScreen"
import { ErrorScreen } from "./components/ErrorScreen"
import { RouteDetailsPanel } from "./components/RouteDetailsPanel"
import { AreaImpactPanel } from "./components/AreaImpactPanel"
import { useBootstrapData } from "./hooks/useBootstrapData"
import { useRouteSelection } from "./hooks/useRouteSelection"
import { useAreaSelection } from "./hooks/useAreaSelection"
import { useManualTemporaryAreas } from "./hooks/useManualTemporaryAreas"
import type { AreaMapaSelecionada } from "./app/types"
import type { AreaNotamCsv, FiltroImpacto, RotaAnalisada } from "./types"
import { areaNotamKey, rotaKey } from "./app/keys"
import { normalizarTexto } from "./utils/normalizers"
import { calcularRotasAfetadasPorNotam } from "./utils/impact"

export default function App() {
  const { data, loading, error, setError, carregar } = useBootstrapData()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mostrarFixas, setMostrarFixas] = useState(true)
  const [mostrarNotamCsv, setMostrarNotamCsv] = useState(true)
  const [mostrarTemporarias, setMostrarTemporarias] = useState(true)
  const [filtroImpacto, setFiltroImpacto] = useState<FiltroImpacto>("TODAS")
  const [rotaSelecionadaKey, setRotaSelecionadaKey] = useState<string | null>(null)
  const [areaMapaSelecionada, setAreaMapaSelecionada] = useState<AreaMapaSelecionada>(null)
  const [rotasImpactadasPelaArea, setRotasImpactadasPelaArea] = useState<RotaAnalisada[]>([])
  const [mostrarSidebarNotam, setMostrarSidebarNotam] = useState(false)

  const rotasTodas = useMemo(() => {
    return data?.rotas_analisadas ?? []
  }, [data])

  const areasTemporariasServidor = useMemo(() => {
    return data?.areas_temporarias ?? []
  }, [data])

  const {
    rotaSelecionada,
    selecionarRota
  } = useRouteSelection(rotasTodas, rotaSelecionadaKey, setRotaSelecionadaKey)

  const {
    selecionarArea,
    limparSelecoes
  } = useAreaSelection(
    setAreaMapaSelecionada,
    setRotasImpactadasPelaArea,
    setRotaSelecionadaKey
  )

  const {
    inputCoords,
    setInputCoords,
    inputNome,
    setInputNome,
    areaSelecionada,
    setAreaSelecionada,
    areasTemporarias,
    adicionarAreaTemporaria,
    removerAreaTemporaria,
    limparAreasTemporarias
  } = useManualTemporaryAreas(
    areasTemporariasServidor,
    setError,
    setAreaMapaSelecionada,
    setRotasImpactadasPelaArea
  )

  useEffect(() => {
    if (!data || !rotaSelecionadaKey) return

    const existe = data.rotas_analisadas.some((rota) => rotaKey(rota) === rotaSelecionadaKey)

    if (!existe) {
      setRotaSelecionadaKey(null)
    }
  }, [data, rotaSelecionadaKey])

  const selecionarNotamSidebar = useCallback((notam: AreaNotamCsv) => {
    const chave = areaNotamKey(notam)
    const rotasAfetadas = calcularRotasAfetadasPorNotam(notam, rotasTodas, filtroImpacto)

    setAreaMapaSelecionada((current) => {
      const mesmaArea =
        current?.tipo === "NOTAM" &&
        normalizarTexto(current.chave) === normalizarTexto(chave)

      if (mesmaArea) {
        setRotasImpactadasPelaArea([])
        setRotaSelecionadaKey(null)
        return null
      }

      setRotasImpactadasPelaArea(rotasAfetadas)
      setRotaSelecionadaKey(null)

      return {
        tipo: "NOTAM",
        chave,
        nome: notam.nome
      }
    })
  }, [rotasTodas, filtroImpacto])

  if (!data && loading) {
    return <LoadingScreen />
  }

  if (!data && error) {
    return <ErrorScreen error={error} onRetry={() => void carregar()} />
  }

  if (!data) {
    return null
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((current) => !current)}
        inputCoords={inputCoords}
        setInputCoords={setInputCoords}
        inputNome={inputNome}
        setInputNome={setInputNome}
        mostrarFixas={mostrarFixas}
        setMostrarFixas={setMostrarFixas}
        mostrarNotamCsv={mostrarNotamCsv}
        setMostrarNotamCsv={setMostrarNotamCsv}
        mostrarTemporarias={mostrarTemporarias}
        setMostrarTemporarias={setMostrarTemporarias}
        areasTemporarias={areasTemporarias}
        areaSelecionada={areaSelecionada}
        setAreaSelecionada={setAreaSelecionada}
        rotasImpactadas={rotasTodas}
        filtroImpacto={filtroImpacto}
        setFiltroImpacto={setFiltroImpacto}
        rotaSelecionadaKey={rotaSelecionadaKey}
        onSelecionarRota={selecionarRota}
        onAdicionar={adicionarAreaTemporaria}
        onRemover={removerAreaTemporaria}
        onLimpar={limparAreasTemporarias}
        loading={loading}
        error={error}
      />

      <main className={`content ${rotaSelecionada || areaMapaSelecionada ? "with-route-panel" : ""}`}>
        {!sidebarOpen && (
          <button
            type="button"
            className="sidebar-floating-button"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
        )}

        <button
          type="button"
          className="notam-floating-button"
          onClick={() => setMostrarSidebarNotam((current) => !current)}
        >
          NOTAMs
        </button>

        <MapView
          aeroportos={data.aeroportos}
          waypoints={data.waypoints}
          areasFixas={data.areas_fixas}
          areasNotamCsv={data.areas_notam_csv}
          areasTemporarias={areasTemporarias}
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
          onSelecionarRota={selecionarRota}
          onSelecionarArea={selecionarArea}
          onLimparSelecoes={limparSelecoes}
        />

        {mostrarSidebarNotam && (
          <NotamSidebar
            notams={data.areas_notam_csv}
            areaMapaSelecionada={areaMapaSelecionada}
            onSelectNotam={selecionarNotamSidebar}
            onClose={() => setMostrarSidebarNotam(false)}
            onReadStateChanged={() => void carregar()}
          />
        )}

        {rotaSelecionada && (
          <RouteDetailsPanel
            rota={rotaSelecionada}
            onClose={() => setRotaSelecionadaKey(null)}
          />
        )}

        {!rotaSelecionada && areaMapaSelecionada && (
          <AreaImpactPanel
            area={areaMapaSelecionada}
            rotas={rotasImpactadasPelaArea}
            onClose={limparSelecoes}
            onSelecionarRota={selecionarRota}
            rotaSelecionadaKeyAtual={rotaSelecionadaKey}
          />
        )}
      </main>
    </div>
  )
}