import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "./components/Sidebar"
import { MapView } from "./components/MapView"
import { NotamSidebar } from "./components/NotamSidebar"
import {
  getBootstrap,
  parseCoordsInput,
  formatarHora
} from "./services/api"
import type {
  AreaTemporaria,
  BootstrapResponse,
  FiltroImpacto,
  RotaAnalisada,
  AreaNotamCsv,
  LatLon
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

function normalizarTexto(valor: unknown) {
  return String(valor ?? "").trim().toUpperCase()
}

function areaNotamKeyApp(area: AreaNotamCsv) {
  return `NOTAM|${area.numero_notam || area.nome}|${area.fir_match}|${area.geometry_type}`
}

function isValidCoordApp(point: unknown): point is LatLon {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(Number(point[0])) &&
    Number.isFinite(Number(point[1])) &&
    Math.abs(Number(point[0])) <= 90 &&
    Math.abs(Number(point[1])) <= 180
  )
}

function normalizeBaseApp(coords: unknown): LatLon[] {
  if (!Array.isArray(coords)) return []

  return coords
    .map((point) => {
      if (!isValidCoordApp(point)) return null
      return [Number(point[0]), Number(point[1])] as LatLon
    })
    .filter(Boolean) as LatLon[]
}

function normalizeRingApp(coords: unknown): LatLon[] {
  const normalized = normalizeBaseApp(coords)

  if (normalized.length >= 3) {
    const first = normalized[0]
    const last = normalized[normalized.length - 1]

    if (first[0] !== last[0] || first[1] !== last[1]) {
      normalized.push(first)
    }
  }

  return normalized
}

function normalizeLineApp(coords: unknown): LatLon[] {
  return normalizeBaseApp(coords)
}

function pointOnSegmentApp(point: LatLon, a: LatLon, b: LatLon): boolean {
  const [py, px] = point
  const [ay, ax] = a
  const [by, bx] = b

  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
  if (Math.abs(cross) > 1e-10) return false

  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay)
  if (dot < 0) return false

  const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay)
  if (dot > lenSq) return false

  return true
}

function closeRingApp(coords: LatLon[]): LatLon[] {
  if (coords.length < 3) return coords

  const normalized = [...coords]
  const first = normalized[0]
  const last = normalized[normalized.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push(first)
  }

  return normalized
}

function pointInPolygonApp(point: LatLon, polygon: LatLon[]): boolean {
  const ring = closeRingApp(polygon)
  if (ring.length < 4) return false

  for (let i = 0; i < ring.length - 1; i++) {
    if (pointOnSegmentApp(point, ring[i], ring[i + 1])) {
      return true
    }
  }

  const [py, px] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]
    const [yj, xj] = ring[j]

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi

    if (intersect) inside = !inside
  }

  return inside
}

function orientationApp(a: LatLon, b: LatLon, c: LatLon): number {
  const value =
    (b[1] - a[1]) * (c[0] - b[0]) -
    (b[0] - a[0]) * (c[1] - b[1])

  if (Math.abs(value) < 1e-10) return 0
  return value > 0 ? 1 : 2
}

function segmentsIntersectApp(p1: LatLon, q1: LatLon, p2: LatLon, q2: LatLon): boolean {
  const o1 = orientationApp(p1, q1, p2)
  const o2 = orientationApp(p1, q1, q2)
  const o3 = orientationApp(p2, q2, p1)
  const o4 = orientationApp(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && pointOnSegmentApp(p2, p1, q1)) return true
  if (o2 === 0 && pointOnSegmentApp(q2, p1, q1)) return true
  if (o3 === 0 && pointOnSegmentApp(p1, p2, q2)) return true
  if (o4 === 0 && pointOnSegmentApp(q1, p2, q2)) return true

  return false
}

function distanceMetersApp(a: LatLon, b: LatLon): number {
  const R = 6371000
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

function pointInCircleApp(point: LatLon, center: LatLon, radius_m: number): boolean {
  return distanceMetersApp(point, center) <= radius_m
}

function segmentDistanceToPointMetersApp(a: LatLon, b: LatLon, p: LatLon): number {
  const ax = a[1]
  const ay = a[0]
  const bx = b[1]
  const by = b[0]
  const px = p[1]
  const py = p[0]

  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay

  const ab2 = abx * abx + aby * aby
  if (ab2 === 0) return distanceMetersApp(a, p)

  let t = (apx * abx + apy * aby) / ab2
  t = Math.max(0, Math.min(1, t))

  const closest: LatLon = [ay + aby * t, ax + abx * t]
  return distanceMetersApp(closest, p)
}

function lineIntersectsPolygonApp(route: LatLon[], polygon: LatLon[]): boolean {
  if (route.length < 2) return false

  const ring = closeRingApp(polygon)
  if (ring.length < 4) return false

  for (const point of route) {
    if (pointInPolygonApp(point, ring)) return true
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]

    for (let j = 0; j < ring.length - 1; j++) {
      const c = ring[j]
      const d = ring[j + 1]

      if (segmentsIntersectApp(a, b, c, d)) return true
    }
  }

  return false
}

function lineIntersectsCircleApp(route: LatLon[], center: LatLon, radius_m: number): boolean {
  if (route.length < 2) return false

  for (const point of route) {
    if (pointInCircleApp(point, center, radius_m)) return true
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]

    if (segmentDistanceToPointMetersApp(a, b, center) <= radius_m) return true
  }

  return false
}

function rotaCasaNoFiltroApp(rota: RotaAnalisada, filtro: FiltroImpacto): boolean {
  if (filtro === "TODAS") return true
  if (filtro === "PERMANENTE") return !!rota.impactada_fixa
  if (filtro === "TEMPORARIA") return !!rota.impactada_temporaria
  if (filtro === "AMBAS") return !!rota.impactada_fixa && !!rota.impactada_temporaria
  return true
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
  const [notamSidebarOpen, setNotamSidebarOpen] = useState(false)
  const [areasTemporariasManuais, setAreasTemporariasManuais] = useState<AreaTemporaria[]>([])
  const [areaMapaSelecionada, setAreaMapaSelecionada] = useState<AreaMapaSelecionada>(null)
  const [rotasImpactadasPelaArea, setRotasImpactadasPelaArea] = useState<RotaAnalisada[]>([])

  const carregarBootstrap = useCallback(async () => {
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

      setInputNome(
        nextAreaName(
          (response.areas_temporarias?.length ?? 0) + areasTemporariasManuais.length
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [areaSelecionada, areasTemporariasManuais])

  useEffect(() => {
    void carregarBootstrap()
  }, [carregarBootstrap])

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
      setInputNome(
        nextAreaName((data?.areas_temporarias?.length ?? 0) + areasTemporariasManuais.length + 1)
      )
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

      setInputNome(nextAreaName((data?.areas_temporarias?.length ?? 0) + proximoArray.length))
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

  const handleSelecionarRota = useCallback((rota: RotaAnalisada | null) => {
    if (!rota) {
      setRotaSelecionadaKey(null)
      return
    }

    const key = rotaKey(rota)
    setRotaSelecionadaKey((current) => (current === key ? null : key))
  }, [])

  const handleSelecionarArea = useCallback((
    area: AreaMapaSelecionada,
    rotasAfetadas: RotaAnalisada[]
  ) => {
    if (!area) {
      setAreaMapaSelecionada(null)
      setRotasImpactadasPelaArea([])
      return
    }

    setAreaMapaSelecionada((current) => {
      const mesmaAreaSelecionada =
        current &&
        current.tipo === area.tipo &&
        current.chave === area.chave

      if (mesmaAreaSelecionada) {
        setRotasImpactadasPelaArea([])
        setRotaSelecionadaKey(null)
        return null
      }

      setRotasImpactadasPelaArea(rotasAfetadas)
      setRotaSelecionadaKey(null)
      return area
    })
  }, [])

  const handleSelecionarNotamSidebar = useCallback((notam: AreaNotamCsv) => {
    const chave = areaNotamKeyApp(notam)

    const rotasAfetadas = rotasTodas
      .filter((rota) => rotaCasaNoFiltroApp(rota, filtroImpacto))
      .map((rota) => ({
        ...rota,
        coords_latlon: normalizeLineApp(rota.coords_latlon)
      }))
      .filter((rota) => {
        if (
          notam.geometry_type === "CIRCLE" &&
          Array.isArray(notam.center) &&
          notam.center.length >= 2 &&
          typeof notam.radius_m === "number"
        ) {
          return lineIntersectsCircleApp(
            rota.coords_latlon,
            [Number(notam.center[0]), Number(notam.center[1])],
            notam.radius_m
          )
        }

        const polygon = normalizeRingApp(notam.coords_latlon)
        if (polygon.length < 3) return false

        return lineIntersectsPolygonApp(rota.coords_latlon, polygon)
      })

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

  const handleLimparSelecoes = useCallback(() => {
    setRotaSelecionadaKey(null)
    setAreaMapaSelecionada(null)
    setRotasImpactadasPelaArea([])
  }, [])

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

      <main className={`content relative ${rotaSelecionada || areaMapaSelecionada ? "with-route-panel" : ""}`}>
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

        <button
          type="button"
          onClick={() => setNotamSidebarOpen((value) => !value)}
          className="notam-floating-button"
          title={notamSidebarOpen ? "Fechar NOTAMs" : "Abrir NOTAMs"}
        >
          {notamSidebarOpen ? "×" : "NOTAMs"}
        </button>

        {notamSidebarOpen ? (
          <div className="notam-sidebar-shell">
            <NotamSidebar
              notams={Array.isArray(data?.areas_notam_csv) ? data.areas_notam_csv : []}
              areaMapaSelecionada={areaMapaSelecionada}
              onSelectNotam={handleSelecionarNotamSidebar}
              onClose={() => setNotamSidebarOpen(false)}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}