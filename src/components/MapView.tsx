import {
  MapContainer,
  TileLayer,
  LayersControl,
  FeatureGroup,
  Polygon,
  Polyline,
  Circle,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents
} from "react-leaflet"
import L from "leaflet"
import { useEffect, useMemo, useState } from "react"
import {
  getFirs,
  type FirArea,
  type ManualRouteResponse,
  type Navaid,
  type NavaidType,
  type Waypoint
} from "../services/api"
import {
  getSpecialAreas,
  type SpecialArea
} from "../services/specialAreasApi"
import type {
  Airport,
  AreaFixa,
  AreaNotamCsv,
  AreaTemporaria,
  RotaAnalisada,
  LatLon,
  FiltroImpacto
} from "../types"
import type { AreaMapaSelecionada } from "../app/types"

type Props = {
  aeroportos: Airport[]
  waypoints: Waypoint[]
  navaids: Navaid[]
  areasFixas: AreaFixa[]
  areasNotamCsv: AreaNotamCsv[]
  areasTemporarias: AreaTemporaria[]
  rotasAnalisadas: RotaAnalisada[]
  aeroviasAlta: { nome: string; coords_latlon: LatLon[] }[]
  aeroviasBaixa: { nome: string; coords_latlon: LatLon[] }[]
  aeroviasUruguay: { nome: string; coords_latlon: LatLon[] }[]
  mostrarFixas: boolean
  mostrarNotamCsv: boolean
  mostrarTemporarias: boolean
  areaSelecionada: string | null
  manualRoute: ManualRouteResponse | null
  areaMapaSelecionada: AreaMapaSelecionada
  filtroImpacto: FiltroImpacto
  rotaSelecionada: RotaAnalisada | null
  notamsLidos?: Set<string>
  onSelecionarRota: (rota: RotaAnalisada | null) => void
  onSelecionarArea: (
    area: AreaMapaSelecionada,
    rotasAfetadas: RotaAnalisada[]
  ) => void
  onLimparSelecoes: () => void
}

type AreaImpactadaRotaManual = {
  tipo: "FIXA" | "NOTAM" | "MANUAL"
  chave: string
  nome: string
  detalhe: string
}

type Bounds = {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

const COR_AEROVIA_ALTA = "#60a5fa"
const COR_AEROVIA_BAIXA = "#34d399"
const COR_AEROVIA_URUGUAY = "#f59e0b"
const COR_WAYPOINT = "#22c55e"
const COR_VOR = "#60a5fa"
const COR_DVOR = "#38bdf8"
const COR_VOR_DME = "#22c55e"
const COR_DVOR_DME = "#16a34a"
const COR_NDB = "#f59e0b"
const COR_AEROPORTO = "#ef4444"
const COR_ROTA_BASE = "#60a5fa"
const COR_ROTA_IMPACTADA = "#fb923c"
const COR_ROTA_SELECIONADA = "#ffffff"
const COR_ROTA_MANUAL = "#eab308"
const COR_AREA_RESTRICTED = "#f59e0b"
const COR_AREA_PROHIBITED = "#ef4444"
const COR_AREA_DANGER = "#a855f7"
const COR_AREA_DEFAULT = "#94a3b8"
const COR_TEMPORARIA = "#ffd60a"
const COR_TEMPORARIA_LIDA = "#16a34a"
const COR_TEMPORARIA_SELECIONADA = "#00ffff"
const COR_AREA_DESTACADA = "#fde047"
const COR_AEROVIA_HOVER = "#ffffff"
const COR_FIR = "#ffffff"
const COR_NOTAM_ALTO = "#f43f5e"
const COR_EAC_D = "#a855f7"
const COR_EAC_P = "#ef4444"
const COR_EAC_R = "#f59e0b"

function corNavaid(type: NavaidType): string {
  if (type === "DVOR") return COR_DVOR
  if (type === "VOR_DME") return COR_VOR_DME
  if (type === "DVOR_DME") return COR_DVOR_DME
  if (type === "NDB") return COR_NDB
  return COR_VOR
}

function isVorType(type: NavaidType): boolean {
  return type === "VOR" || type === "DVOR" || type === "VOR_DME" || type === "DVOR_DME"
}

function isValidCoord(point: unknown): point is LatLon {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(Number(point[0])) &&
    Number.isFinite(Number(point[1])) &&
    Math.abs(Number(point[0])) <= 90 &&
    Math.abs(Number(point[1])) <= 180
  )
}

function normalizeBase(coords: unknown): LatLon[] {
  if (!Array.isArray(coords)) return []

  return coords
    .map((point) => {
      if (!isValidCoord(point)) return null
      return [Number(point[0]), Number(point[1])] as LatLon
    })
    .filter(Boolean) as LatLon[]
}

function normalizeRing(coords: unknown): LatLon[] {
  const normalized = normalizeBase(coords)

  if (normalized.length >= 3) {
    const first = normalized[0]
    const last = normalized[normalized.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      normalized.push(first)
    }
  }

  return normalized
}

function normalizeLine(coords: unknown): LatLon[] {
  return normalizeBase(coords)
}

function corAreaPorTipo(areaType: string): string {
  const t = areaType.trim().toUpperCase()
  if (t === "RESTRICTED") return COR_AREA_RESTRICTED
  if (t === "PROHIBITED") return COR_AREA_PROHIBITED
  if (t === "DANGER") return COR_AREA_DANGER
  return COR_AREA_DEFAULT
}

function corAreaEspecial(type: string): string {
  if (type === "D") return COR_EAC_D
  if (type === "P") return COR_EAC_P
  if (type === "R") return COR_EAC_R
  return COR_AREA_DEFAULT
}

function specialAreaKey(area: SpecialArea) {
  return `SPECIAL|${area.source}|${area.id}|${area.ident}`
}

function formatLimitEspecial(value: string, unit: string) {
  const text = String(value || "").trim()
  const unitText = String(unit || "").trim()

  if (!text && !unitText) return "-"
  if (!text) return unitText
  if (!unitText) return text

  return `${text} ${unitText}`
}

function parseAltitudeFeet(value?: string | null): number | null {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return null

  if (raw === "UNL" || raw === "UNLIMITED") return 999999
  if (raw === "SFC" || raw === "GND" || raw.includes("AGL")) return 0

  const flMatch = raw.match(/\bFL\s*(\d{2,3})\b/)
  if (flMatch) return Number(flMatch[1]) * 100

  const fMatch = raw.match(/\bF(\d{2,3})\b/)
  if (fMatch) return Number(fMatch[1]) * 100

  const ftMatch = raw.match(/\b(\d{4,6})\s*FT\b/)
  if (ftMatch) return Number(ftMatch[1])

  const plainNumber = raw.match(/\b(\d{3,6})\b/)
  if (plainNumber) {
    const valueNum = Number(plainNumber[1])
    if (valueNum <= 999) return valueNum * 100
    return valueNum
  }

  return null
}

function isUpperLimitHigh(area: AreaNotamCsv): boolean {
  const feet = parseAltitudeFeet(area.g)
  return feet !== null && feet > 10000
}

function corNotam(area: AreaNotamCsv, notamsLidos?: Set<string>): string {
  if (isNotamLido(area, notamsLidos)) return COR_TEMPORARIA_LIDA
  if (isUpperLimitHigh(area)) return COR_NOTAM_ALTO
  return COR_TEMPORARIA
}

function rotaCasaNoFiltro(rota: RotaAnalisada, filtro: FiltroImpacto): boolean {
  if (filtro === "TODAS") return true
  if (filtro === "PERMANENTE") return !!rota.impactada_fixa
  if (filtro === "TEMPORARIA") return !!rota.impactada_temporaria
  if (filtro === "AMBAS") return !!rota.impactada_fixa && !!rota.impactada_temporaria
  return true
}

function textoTipoImpacto(rota: RotaAnalisada): string {
  if (rota.tipo_impacto === "AMBAS") return "Permanente + Temporária"
  if (rota.tipo_impacto === "PERMANENTE") return "Permanente"
  if (rota.tipo_impacto === "TEMPORARIA") return "Temporária"
  return "Sem impacto"
}

function formatHhmm(value?: string | number | null): string {
  const text = String(value ?? "").trim()

  if (!text) return "-"

  if (/^\d{4}$/.test(text)) {
    return `${text.slice(0, 2)}:${text.slice(2, 4)}`
  }

  if (/^\d{3}$/.test(text)) {
    const padded = text.padStart(4, "0")
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
  }

  return text
}

function getRouteEstimatedPoints(rota: RotaAnalisada) {
  const estimados = (rota as unknown as { estimados?: unknown }).estimados

  if (!Array.isArray(estimados)) return []

  return estimados
    .map((point) => {
      const item = point as Record<string, unknown>
      const latitude = Number(item.latitude)
      const longitude = Number(item.longitude)

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      return {
        ident: String(item.ident ?? "").trim().toUpperCase(),
        latitude,
        longitude,
        distancia_acumulada_nm: Number(item.distancia_acumulada_nm ?? 0),
        tempo_acumulado_min: Number(item.tempo_acumulado_min ?? 0),
        estimado: String(item.estimado ?? "").trim()
      }
    })
    .filter(Boolean) as Array<{
      ident: string
      latitude: number
      longitude: number
      distancia_acumulada_nm: number
      tempo_acumulado_min: number
      estimado: string
    }>
}


function estimatedPointLabelIcon(pointIdent: string, estimado: string) {
  const safeIdent = escapeHtml(pointIdent || "PONTO")
  const safeEstimado = escapeHtml(estimado || "-")

  return L.divIcon({
    className: "estimated-point-label",
    html: `
      <div style="
        display: flex;
        align-items: center;
        gap: 5px;
        transform: translate(8px, -18px);
        pointer-events: none;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #fb923c;
          border: 1px solid #ffffff;
          box-shadow: 0 0 8px rgba(251,146,60,0.95);
        "></div>
        <div style="
          background: rgba(15, 23, 42, 0.96);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.45);
          border-radius: 6px;
          padding: 3px 6px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.45);
        ">
          ${safeIdent} ${safeEstimado}
        </div>
      </div>
    `,
    iconSize: [1, 1],
    iconAnchor: [0, 0]
  })
}

function rotaKey(rota: RotaAnalisada) {
  return `${rota.ident}|${rota.origem}|${rota.destino}|${rota.rota_texto}|${rota.eobt}|${rota.eta}`
}

function areaFixaKey(area: AreaFixa) {
  return `FIXA|${area.nome}|${area.area_type}|${area.fir_match}`
}

function areaNotamKey(area: AreaNotamCsv) {
  return `NOTAM|${area.numero_notam || area.nome}|${area.fir_match}|${area.geometry_type}|${area.source_id || ""}`
}

function areaManualKey(area: AreaTemporaria) {
  return `MANUAL|${area.nome}`
}

function closeRing(coords: LatLon[]): LatLon[] {
  if (coords.length < 3) return coords

  const normalized = [...coords]
  const first = normalized[0]
  const last = normalized[normalized.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push(first)
  }

  return normalized
}

function pointOnSegment(point: LatLon, a: LatLon, b: LatLon): boolean {
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

function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
  const ring = closeRing(polygon)
  if (ring.length < 4) return false

  for (let i = 0; i < ring.length - 1; i++) {
    if (pointOnSegment(point, ring[i], ring[i + 1])) return true
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

function orientation(a: LatLon, b: LatLon, c: LatLon): number {
  const value =
    (b[1] - a[1]) * (c[0] - b[0]) -
    (b[0] - a[0]) * (c[1] - b[1])

  if (Math.abs(value) < 1e-10) return 0
  return value > 0 ? 1 : 2
}

function segmentsIntersect(p1: LatLon, q1: LatLon, p2: LatLon, q2: LatLon): boolean {
  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && pointOnSegment(p2, p1, q1)) return true
  if (o2 === 0 && pointOnSegment(q2, p1, q1)) return true
  if (o3 === 0 && pointOnSegment(p1, p2, q2)) return true
  if (o4 === 0 && pointOnSegment(q1, p2, q2)) return true

  return false
}

function distanceMeters(a: LatLon, b: LatLon): number {
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

function pointInCircle(point: LatLon, center: LatLon, radius_m: number): boolean {
  return distanceMeters(point, center) <= radius_m
}

function segmentDistanceToPointMeters(a: LatLon, b: LatLon, p: LatLon): number {
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
  if (ab2 === 0) return distanceMeters(a, p)

  let t = (apx * abx + apy * aby) / ab2
  t = Math.max(0, Math.min(1, t))

  const closest: LatLon = [ay + aby * t, ax + abx * t]
  return distanceMeters(closest, p)
}

function boundsFromCoords(coords: LatLon[]): Bounds | null {
  if (!coords.length) return null

  let minLat = coords[0][0]
  let maxLat = coords[0][0]
  let minLon = coords[0][1]
  let maxLon = coords[0][1]

  for (const [lat, lon] of coords) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
  }

  return { minLat, maxLat, minLon, maxLon }
}

function boundsFromCircle(center: LatLon, radius_m: number): Bounds {
  const latMargin = radius_m / 111320
  const cosLat = Math.cos((center[0] * Math.PI) / 180)
  const lonMargin = radius_m / (111320 * Math.max(0.01, Math.abs(cosLat)))

  return {
    minLat: center[0] - latMargin,
    maxLat: center[0] + latMargin,
    minLon: center[1] - lonMargin,
    maxLon: center[1] + lonMargin
  }
}

function expandBounds(bounds: Bounds, marginMeters: number): Bounds {
  const latMargin = marginMeters / 111320
  const centerLat = (bounds.minLat + bounds.maxLat) / 2
  const cosLat = Math.cos((centerLat * Math.PI) / 180)
  const lonMargin = marginMeters / (111320 * Math.max(0.01, Math.abs(cosLat)))

  return {
    minLat: bounds.minLat - latMargin,
    maxLat: bounds.maxLat + latMargin,
    minLon: bounds.minLon - lonMargin,
    maxLon: bounds.maxLon + lonMargin
  }
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return !(
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat ||
    a.maxLon < b.minLon ||
    a.minLon > b.maxLon
  )
}

function routeCouldHitPolygon(route: LatLon[], polygon: LatLon[]): boolean {
  const routeBounds = boundsFromCoords(route)
  const polygonBounds = boundsFromCoords(polygon)

  if (!routeBounds || !polygonBounds) return false

  return boundsOverlap(
    expandBounds(routeBounds, 10000),
    expandBounds(polygonBounds, 10000)
  )
}

function routeCouldHitCircle(route: LatLon[], center: LatLon, radius_m: number): boolean {
  const routeBounds = boundsFromCoords(route)
  if (!routeBounds) return false

  const circleBounds = boundsFromCircle(center, radius_m)

  return boundsOverlap(
    expandBounds(routeBounds, 10000),
    expandBounds(circleBounds, 10000)
  )
}

function lineIntersectsPolygon(route: LatLon[], polygon: LatLon[]): boolean {
  if (route.length < 2) return false

  const ring = closeRing(polygon)
  if (ring.length < 4) return false
  if (!routeCouldHitPolygon(route, ring)) return false

  for (const point of route) {
    if (pointInPolygon(point, ring)) return true
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]

    for (let j = 0; j < ring.length - 1; j++) {
      const c = ring[j]
      const d = ring[j + 1]

      if (segmentsIntersect(a, b, c, d)) return true
    }
  }

  return false
}

function lineIntersectsCircle(route: LatLon[], center: LatLon, radius_m: number): boolean {
  if (route.length < 2) return false
  if (!routeCouldHitCircle(route, center, radius_m)) return false

  for (const point of route) {
    if (pointInCircle(point, center, radius_m)) return true
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]
    if (segmentDistanceToPointMeters(a, b, center) <= radius_m) return true
  }

  return false
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatarTextoNotam(area: AreaNotamCsv) {
  const partes: string[] = []

  if (area.f) {
    partes.push(`<strong>Limite inferior (F):</strong> ${escapeHtml(area.f)}`)
  }

  if (area.g) {
    partes.push(`<strong>Limite superior (G):</strong> ${escapeHtml(area.g)}`)
  }

  partes.push(escapeHtml(area.texto_notam || "-").replace(/\n/g, "<br>"))

  return partes.join("<br>")
}

function hasCircleGeometry(area: AreaNotamCsv): area is AreaNotamCsv & {
  geometry_type: "CIRCLE"
  center: LatLon
  radius_m: number
} {
  return (
    area.geometry_type === "CIRCLE" &&
    Array.isArray(area.center) &&
    area.center.length >= 2 &&
    Number.isFinite(area.center[0]) &&
    Number.isFinite(area.center[1]) &&
    typeof area.radius_m === "number" &&
    Number.isFinite(area.radius_m)
  )
}

function isNotamLido(area: AreaNotamCsv, notamsLidos?: Set<string>): boolean {
  if (notamsLidos?.has(areaNotamKey(area))) return true
  return !!area.lido
}

function FitToSelectedArea({
  areaManual,
  areaNotam,
  areaFixa
}: {
  areaManual?: AreaTemporaria | null
  areaNotam?: AreaNotamCsv | null
  areaFixa?: AreaFixa | null
}) {
  const map = useMap()

  useEffect(() => {
    if (areaNotam) {
      if (hasCircleGeometry(areaNotam)) {
        const centerLatLng = L.latLng(areaNotam.center[0], areaNotam.center[1])
        const bounds = centerLatLng.toBounds(areaNotam.radius_m * 2)

        const timer = window.setTimeout(() => {
          map.fitBounds(bounds, { padding: [30, 30] })
        }, 80)

        return () => window.clearTimeout(timer)
      }

      const coords = normalizeRing(areaNotam.coords_latlon)
      if (coords.length >= 3) {
        const timer = window.setTimeout(() => {
          map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] })
        }, 80)

        return () => window.clearTimeout(timer)
      }
    }

    if (areaManual) {
      const coords = normalizeRing(areaManual.coords_latlon)
      if (coords.length >= 3) {
        const timer = window.setTimeout(() => {
          map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] })
        }, 80)

        return () => window.clearTimeout(timer)
      }
    }

    if (areaFixa) {
      const allPoints = areaFixa.coords_latlon.flatMap((anel) => normalizeRing(anel))
      if (allPoints.length >= 3) {
        const timer = window.setTimeout(() => {
          map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] })
        }, 80)

        return () => window.clearTimeout(timer)
      }
    }
  }, [map, areaManual, areaNotam, areaFixa])

  return null
}

function ResizeAwareMap() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    if (!container) return

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false })
    })

    observer.observe(container)

    const t1 = window.setTimeout(() => map.invalidateSize({ pan: false }), 0)
    const t2 = window.setTimeout(() => map.invalidateSize({ pan: false }), 150)

    return () => {
      observer.disconnect()
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [map])

  return null
}

function MapClickHandler({ onClear }: { onClear: () => void }) {
  useMapEvents({
    click() {
      onClear()
    }
  })

  return null
}

function estiloAreaBase({
  cor,
  selecionada
}: {
  cor: string
  selecionada: boolean
}) {
  return {
    color: selecionada ? COR_AREA_DESTACADA : cor,
    weight: selecionada ? 3 : 1.5,
    opacity: selecionada ? 1 : 0.85,
    fillColor: selecionada ? COR_AREA_DESTACADA : cor,
    fillOpacity: selecionada ? 0.24 : 0.12
  }
}

function renderSpecialArea(area: SpecialArea) {
  const color = corAreaEspecial(area.type)

  return (
    <Polygon
      key={specialAreaKey(area)}
      positions={area.coords_latlon}
      pathOptions={{
        color,
        weight: 1.8,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: area.type === "P" ? 0.18 : 0.14
      }}
    >
      <Tooltip sticky>
        {area.ident || area.name} | {area.typeLabel}
      </Tooltip>

      <Popup>
        <div>
          <div><strong>Ident:</strong> {area.ident || "-"}</div>
          <div><strong>Nome:</strong> {area.name || "-"}</div>
          <div><strong>Tipo:</strong> {area.typeLabel || "-"}</div>
          <div><strong>Limite inferior:</strong> {formatLimitEspecial(area.lowerLimit, area.lowerUnit)}</div>
          <div><strong>Limite superior:</strong> {formatLimitEspecial(area.upperLimit, area.upperUnit)}</div>
          <div><strong>Efetiva desde:</strong> {area.effectived || "-"}</div>
          <div><strong>Pontos:</strong> {area.coords_latlon.length}</div>
        </div>
      </Popup>
    </Polygon>
  )
}

export function MapView(props: Props) {
  const [aeroviaAltaHover, setAeroviaAltaHover] = useState<string | null>(null)
  const [aeroviaBaixaHover, setAeroviaBaixaHover] = useState<string | null>(null)
  const [aeroviaUruguayHover, setAeroviaUruguayHover] = useState<string | null>(null)
  const [firs, setFirs] = useState<FirArea[]>([])
  const [specialAreas, setSpecialAreas] = useState<SpecialArea[]>([])

  useEffect(() => {
    let mounted = true

    getFirs()
      .then((data) => {
        if (!mounted) return
        console.log("FIRS BACKEND:", data)
        setFirs(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error("Erro ao carregar FIRs:", err)
        if (!mounted) return
        setFirs([])
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    getSpecialAreas()
      .then((data) => {
        if (!mounted) return
        console.log("ÁREAS ESPECIAIS BACKEND:", data)
        setSpecialAreas(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error("Erro ao carregar áreas especiais:", err)
        if (!mounted) return
        setSpecialAreas([])
      })

    return () => {
      mounted = false
    }
  }, [])

  const navaidsNormalizados = useMemo(() => {
    return props.navaids
      .map((navaid) => ({
        ident: String(navaid.ident ?? "").trim().toUpperCase(),
        latitude: Number(navaid.latitude),
        longitude: Number(navaid.longitude),
        type: navaid.type,
        name: navaid.name,
        frequency: navaid.frequency
      }))
      .filter((navaid) => {
        return (
          navaid.ident &&
          Number.isFinite(navaid.latitude) &&
          Number.isFinite(navaid.longitude) &&
          Math.abs(navaid.latitude) <= 90 &&
          Math.abs(navaid.longitude) <= 180
        )
      })
  }, [props.navaids])

  const navaidsVor = useMemo(() => {
    return navaidsNormalizados.filter((navaid) => isVorType(navaid.type))
  }, [navaidsNormalizados])

  const navaidsNdb = useMemo(() => {
    return navaidsNormalizados.filter((navaid) => navaid.type === "NDB")
  }, [navaidsNormalizados])

  const selectedAreaManualSidebar =
    props.areasTemporarias.find((a) => a.nome === props.areaSelecionada) ?? null

  const areasNotamNormalizadas = useMemo(() => {
    return props.areasNotamCsv.filter((area) => {
      if (hasCircleGeometry(area)) return true
      return normalizeRing(area.coords_latlon).length >= 3
    })
  }, [props.areasNotamCsv])

  const areasFixasNormalizadas = useMemo(() => {
    return props.areasFixas
      .map((area) => ({
        ...area,
        coords_latlon: Array.isArray(area.coords_latlon)
          ? area.coords_latlon
              .map((anel) => normalizeRing(anel))
              .filter((anel) => anel.length >= 3)
          : []
      }))
      .filter((area) => area.coords_latlon.length > 0)
  }, [props.areasFixas])

  const areasTemporariasNormalizadas = useMemo(() => {
    return props.areasTemporarias
      .map((area) => ({
        ...area,
        coords_latlon: normalizeRing(area.coords_latlon)
      }))
      .filter((area) => area.coords_latlon.length >= 3)
  }, [props.areasTemporarias])

  const specialAreasNormalizadas = useMemo(() => {
    return specialAreas
      .map((area) => ({
        ...area,
        coords_latlon: normalizeRing(area.coords_latlon)
      }))
      .filter((area) => area.coords_latlon.length >= 3)
  }, [specialAreas])

  const areasPerigosas = useMemo(() => {
    return specialAreasNormalizadas.filter((area) => area.type === "D")
  }, [specialAreasNormalizadas])

  const areasProibidas = useMemo(() => {
    return specialAreasNormalizadas.filter((area) => area.type === "P")
  }, [specialAreasNormalizadas])

  const areasRestritas = useMemo(() => {
    return specialAreasNormalizadas.filter((area) => area.type === "R")
  }, [specialAreasNormalizadas])

  const rotasNormalizadas = useMemo(() => {
    return props.rotasAnalisadas
      .map((rota) => ({
        ...rota,
        coords_latlon: normalizeLine(rota.coords_latlon)
      }))
      .filter((rota) => rota.coords_latlon.length >= 2)
  }, [props.rotasAnalisadas])

  const rotasFiltradasPorImpacto = useMemo(() => {
    return rotasNormalizadas.filter((rota) => rotaCasaNoFiltro(rota, props.filtroImpacto))
  }, [rotasNormalizadas, props.filtroImpacto])

  const manualRouteNormalizada = useMemo(() => {
    if (!props.manualRoute) return null

    const coords = normalizeLine(props.manualRoute.coords_latlon)
    if (coords.length < 2) return null

    return {
      ...props.manualRoute,
      coords_latlon: coords
    }
  }, [props.manualRoute])

  const areasImpactadasRotaManual = useMemo<AreaImpactadaRotaManual[]>(() => {
    if (!manualRouteNormalizada) return []

    const route = manualRouteNormalizada.coords_latlon
    const result: AreaImpactadaRotaManual[] = []

    areasFixasNormalizadas.forEach((area) => {
      const impactada = area.coords_latlon.some((anel) =>
        lineIntersectsPolygon(route, anel)
      )

      if (impactada) {
        result.push({
          tipo: "FIXA",
          chave: areaFixaKey(area),
          nome: area.nome,
          detalhe: area.area_type || area.fir_match || "-"
        })
      }
    })

    areasNotamNormalizadas.forEach((area) => {
      const impactada = hasCircleGeometry(area)
        ? lineIntersectsCircle(route, area.center, area.radius_m)
        : lineIntersectsPolygon(route, area.coords_latlon)

      if (impactada) {
        result.push({
          tipo: "NOTAM",
          chave: areaNotamKey(area),
          nome: area.nome,
          detalhe: area.numero_notam || area.fir_match || "-"
        })
      }
    })

    areasTemporariasNormalizadas.forEach((area) => {
      const impactada = lineIntersectsPolygon(route, area.coords_latlon)

      if (impactada) {
        result.push({
          tipo: "MANUAL",
          chave: areaManualKey(area),
          nome: area.nome,
          detalhe: "Área manual"
        })
      }
    })

    return result
  }, [
    manualRouteNormalizada,
    areasFixasNormalizadas,
    areasNotamNormalizadas,
    areasTemporariasNormalizadas
  ])

  const notamsImpactandoRotaManual = useMemo(() => {
    return areasImpactadasRotaManual.filter((area) => area.tipo === "NOTAM")
  }, [areasImpactadasRotaManual])

  const chavesAreasImpactadasRotaManual = useMemo(() => {
    return new Set(areasImpactadasRotaManual.map((area) => area.chave))
  }, [areasImpactadasRotaManual])

  const rotaSelecionadaNormalizada = useMemo(() => {
    if (!props.rotaSelecionada) return null

    const coords = normalizeLine(props.rotaSelecionada.coords_latlon)
    if (coords.length < 2) return null

    return {
      ...props.rotaSelecionada,
      coords_latlon: coords
    }
  }, [props.rotaSelecionada])

  const rotaSelecionadaKeyAtual = rotaSelecionadaNormalizada
    ? rotaKey(rotaSelecionadaNormalizada)
    : null

  const areaMapaNotamSelecionada = useMemo(() => {
    if (!props.areaMapaSelecionada || props.areaMapaSelecionada.tipo !== "NOTAM") return null

    return (
      areasNotamNormalizadas.find((area) => areaNotamKey(area) === props.areaMapaSelecionada?.chave) ??
      null
    )
  }, [areasNotamNormalizadas, props.areaMapaSelecionada])

  const areaMapaManualSelecionada = useMemo(() => {
    if (!props.areaMapaSelecionada || props.areaMapaSelecionada.tipo !== "MANUAL") return null

    return (
      areasTemporariasNormalizadas.find((area) => areaManualKey(area) === props.areaMapaSelecionada?.chave) ??
      null
    )
  }, [areasTemporariasNormalizadas, props.areaMapaSelecionada])

  const areaMapaFixaSelecionada = useMemo(() => {
    if (!props.areaMapaSelecionada || props.areaMapaSelecionada.tipo !== "FIXA") return null

    return (
      areasFixasNormalizadas.find((area) => areaFixaKey(area) === props.areaMapaSelecionada?.chave) ??
      null
    )
  }, [areasFixasNormalizadas, props.areaMapaSelecionada])

  function calcularRotasAfetadas(area: NonNullable<AreaMapaSelecionada>): RotaAnalisada[] {
    return rotasFiltradasPorImpacto.filter((rota) => {
      if (area.tipo === "MANUAL") {
        const encontrada = areasTemporariasNormalizadas.find(
          (item) => areaManualKey(item) === area.chave
        )
        if (!encontrada) return false
        return lineIntersectsPolygon(rota.coords_latlon, encontrada.coords_latlon)
      }

      if (area.tipo === "NOTAM") {
        const encontrada = areasNotamNormalizadas.find(
          (item) => areaNotamKey(item) === area.chave
        )
        if (!encontrada) return false

        if (hasCircleGeometry(encontrada)) {
          return lineIntersectsCircle(
            rota.coords_latlon,
            encontrada.center,
            encontrada.radius_m
          )
        }

        return lineIntersectsPolygon(rota.coords_latlon, encontrada.coords_latlon)
      }

      if (area.tipo === "FIXA") {
        const encontrada = areasFixasNormalizadas.find(
          (item) => areaFixaKey(item) === area.chave
        )
        if (!encontrada) return false

        return encontrada.coords_latlon.some((anel) =>
          lineIntersectsPolygon(rota.coords_latlon, anel)
        )
      }

      return false
    })
  }

  const chavesRotasImpactadasPelaArea = useMemo(() => {
    if (!props.areaMapaSelecionada) return new Set<string>()

    return new Set(
      calcularRotasAfetadas(props.areaMapaSelecionada).map((rota) => rotaKey(rota))
    )
  }, [
    props.areaMapaSelecionada,
    rotasFiltradasPorImpacto,
    areasNotamNormalizadas,
    areasTemporariasNormalizadas,
    areasFixasNormalizadas
  ])

  const center: LatLon =
    props.aeroportos.length > 0
      ? [
          props.aeroportos.reduce((acc, a) => acc + a.latitude, 0) / props.aeroportos.length,
          props.aeroportos.reduce((acc, a) => acc + a.longitude, 0) / props.aeroportos.length
        ]
      : [-15, -55]

  const aeroviasAltaNormalizadas = useMemo(() => {
    return props.aeroviasAlta
      .map((a) => ({
        ...a,
        coords_latlon: normalizeLine(a.coords_latlon)
      }))
      .filter((a) => a.coords_latlon.length >= 2)
  }, [props.aeroviasAlta])

  const aeroviasBaixaNormalizadas = useMemo(() => {
    return props.aeroviasBaixa
      .map((a) => ({
        ...a,
        coords_latlon: normalizeLine(a.coords_latlon)
      }))
      .filter((a) => a.coords_latlon.length >= 2)
  }, [props.aeroviasBaixa])

  const aeroviasUruguayNormalizadas = useMemo(() => {
    return props.aeroviasUruguay
      .map((a) => ({
        ...a,
        coords_latlon: normalizeLine(a.coords_latlon)
      }))
      .filter((a) => a.coords_latlon.length >= 2)
  }, [props.aeroviasUruguay])

  return (
    <MapContainer
      center={center}
      zoom={5}
      maxZoom={12}
      maxBounds={[
        [-60, -170],
        [70, 30]
      ]}
      maxBoundsViscosity={1.0}
      style={{ width: "100%", height: "100%" }}
      preferCanvas
    >
      <ResizeAwareMap />
      <MapClickHandler onClear={props.onLimparSelecoes} />
      <FitToSelectedArea
        areaManual={areaMapaManualSelecionada ?? selectedAreaManualSidebar}
        areaNotam={areaMapaNotamSelecionada}
        areaFixa={areaMapaFixaSelecionada}
      />

      {manualRouteNormalizada && (
        <div
          style={{
            position: "absolute",
            top: 72,
            right: 16,
            zIndex: 1000,
            width: 360,
            maxHeight: 520,
            overflowY: "auto",
            background: "rgba(15, 23, 42, 0.97)",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 12,
            color: "#e5e7eb",
            boxShadow: "0 18px 45px rgba(0,0,0,0.5)"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
            Áreas impactando a rota manual
          </div>

          <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
            Total: {areasImpactadasRotaManual.length} | NOTAMs: {notamsImpactandoRotaManual.length}
          </div>

          {areasImpactadasRotaManual.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              Nenhuma área impactando.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {areasImpactadasRotaManual.map((area) => (
                <div
                  key={`${area.tipo}-${area.chave}`}
                  style={{
                    border: area.tipo === "NOTAM" ? "1px solid #facc15" : "1px solid #475569",
                    borderRadius: 10,
                    padding: 10,
                    background: "rgba(30, 41, 59, 0.92)"
                  }}
                >
                  <div style={{ fontWeight: 800, color: area.tipo === "NOTAM" ? "#facc15" : "#e5e7eb" }}>
                    {area.tipo} | {area.detalhe}
                  </div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 3 }}>
                    {area.nome}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked name="Escuro">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Claro">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="FIRs">
          <FeatureGroup>
            {firs.map((fir) => (
              <Polygon
                key={`fir-${fir.id || fir.icaocode || fir.ident || fir.nome}`}
                positions={fir.coords_latlon}
                pathOptions={{
                  color: COR_FIR,
                  weight: 1,
                  opacity: 0.18,
                  fillColor: COR_FIR,
                  fillOpacity: 0.015
                }}
              >
                <Tooltip sticky>{fir.nome || fir.ident || fir.icaocode}</Tooltip>
                <Popup>
                  <div>
                    <div><strong>Nome:</strong> {fir.nome || "-"}</div>
                    <div><strong>Ident:</strong> {fir.ident || "-"}</div>
                    <div><strong>ICAO:</strong> {fir.icaocode || "-"}</div>
                    <div><strong>Related FIR:</strong> {fir.relatedfir || "-"}</div>
                    <div><strong>Tipo:</strong> {fir.tipo || "-"}</div>
                    <div><strong>Pontos:</strong> {fir.coords_latlon.length}</div>
                  </div>
                </Popup>
              </Polygon>
            ))}
          </FeatureGroup>
        </LayersControl.Overlay>

        {areasPerigosas.length > 0 && (
          <LayersControl.Overlay checked={false} name={`Áreas perigosas (${areasPerigosas.length})`}>
            <FeatureGroup>
              {areasPerigosas.map(renderSpecialArea)}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {areasProibidas.length > 0 && (
          <LayersControl.Overlay checked={false} name={`Áreas proibidas (${areasProibidas.length})`}>
            <FeatureGroup>
              {areasProibidas.map(renderSpecialArea)}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {areasRestritas.length > 0 && (
          <LayersControl.Overlay checked={false} name={`Áreas restritas (${areasRestritas.length})`}>
            <FeatureGroup>
              {areasRestritas.map(renderSpecialArea)}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        <LayersControl.Overlay checked name="Aerovias altas">
          <FeatureGroup>
            {aeroviasAltaNormalizadas.map((aerovia, index) => (
              <Polyline
                key={`alta-${aerovia.nome}-${index}`}
                positions={aerovia.coords_latlon}
                pathOptions={{
                  color:
                    aeroviaAltaHover === `${aerovia.nome}-${index}`
                      ? COR_AEROVIA_HOVER
                      : COR_AEROVIA_ALTA,
                  weight: aeroviaAltaHover === `${aerovia.nome}-${index}` ? 3 : 1.2,
                  opacity: 0.8
                }}
                eventHandlers={{
                  mouseover: () => setAeroviaAltaHover(`${aerovia.nome}-${index}`),
                  mouseout: () => setAeroviaAltaHover(null)
                }}
              >
                <Tooltip sticky>{aerovia.nome}</Tooltip>
              </Polyline>
            ))}
          </FeatureGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Aerovias baixas">
          <FeatureGroup>
            {aeroviasBaixaNormalizadas.map((aerovia, index) => (
              <Polyline
                key={`baixa-${aerovia.nome}-${index}`}
                positions={aerovia.coords_latlon}
                pathOptions={{
                  color:
                    aeroviaBaixaHover === `${aerovia.nome}-${index}`
                      ? COR_AEROVIA_HOVER
                      : COR_AEROVIA_BAIXA,
                  weight: aeroviaBaixaHover === `${aerovia.nome}-${index}` ? 3 : 1.2,
                  opacity: 0.8
                }}
                eventHandlers={{
                  mouseover: () => setAeroviaBaixaHover(`${aerovia.nome}-${index}`),
                  mouseout: () => setAeroviaBaixaHover(null)
                }}
              >
                <Tooltip sticky>{aerovia.nome}</Tooltip>
              </Polyline>
            ))}
          </FeatureGroup>
        </LayersControl.Overlay>

        {aeroviasUruguayNormalizadas.length > 0 && (
          <LayersControl.Overlay checked name="Aerovias Uruguay">
            <FeatureGroup>
              {aeroviasUruguayNormalizadas.map((aerovia, index) => (
                <Polyline
                  key={`uru-${aerovia.nome}-${index}`}
                  positions={aerovia.coords_latlon}
                  pathOptions={{
                    color:
                      aeroviaUruguayHover === `${aerovia.nome}-${index}`
                        ? COR_AEROVIA_HOVER
                        : COR_AEROVIA_URUGUAY,
                    weight: aeroviaUruguayHover === `${aerovia.nome}-${index}` ? 3 : 1.2,
                    opacity: 0.8
                  }}
                  eventHandlers={{
                    mouseover: () => setAeroviaUruguayHover(`${aerovia.nome}-${index}`),
                    mouseout: () => setAeroviaUruguayHover(null)
                  }}
                >
                  <Tooltip sticky>{aerovia.nome}</Tooltip>
                </Polyline>
              ))}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        <LayersControl.Overlay checked name="Aeroportos">
          <FeatureGroup>
            {props.aeroportos.map((aeroporto) => (
              <CircleMarker
                key={`aeroporto-${aeroporto.icao}`}
                center={[aeroporto.latitude, aeroporto.longitude]}
                radius={3}
                pathOptions={{
                  color: COR_AEROPORTO,
                  fillColor: COR_AEROPORTO,
                  fillOpacity: 0.9,
                  weight: 1
                }}
              >
                <Tooltip sticky>{aeroporto.icao}</Tooltip>
              </CircleMarker>
            ))}
          </FeatureGroup>
        </LayersControl.Overlay>

        {props.waypoints.length > 0 && (
          <LayersControl.Overlay checked name="Waypoints">
            <FeatureGroup>
              {props.waypoints.map((waypoint) => (
                <CircleMarker
                  key={`waypoint-${waypoint.ident}`}
                  center={[waypoint.latitude, waypoint.longitude]}
                  radius={2}
                  pathOptions={{
                    color: COR_WAYPOINT,
                    fillColor: COR_WAYPOINT,
                    fillOpacity: 0.8,
                    weight: 1
                  }}
                >
                  <Tooltip sticky>{waypoint.ident}</Tooltip>
                </CircleMarker>
              ))}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {navaidsVor.length > 0 && (
          <LayersControl.Overlay checked name={`VOR (${navaidsVor.length})`}>
            <FeatureGroup>
              {navaidsVor.map((navaid, index) => {
                const color = corNavaid(navaid.type)

                return (
                  <CircleMarker
                    key={`vor-${navaid.type}-${navaid.ident}-${index}`}
                    center={[navaid.latitude, navaid.longitude]}
                    radius={3}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.9,
                      weight: 1
                    }}
                  >
                    <Tooltip sticky>
                      {navaid.ident} | {navaid.type}
                    </Tooltip>

                    <Popup>
                      <div>
                        <div><strong>Ident:</strong> {navaid.ident}</div>
                        <div><strong>Tipo:</strong> {navaid.type}</div>
                        {navaid.name ? <div><strong>Nome:</strong> {navaid.name}</div> : null}
                        {navaid.frequency ? <div><strong>Frequência:</strong> {navaid.frequency}</div> : null}
                        <div><strong>Latitude:</strong> {navaid.latitude}</div>
                        <div><strong>Longitude:</strong> {navaid.longitude}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {navaidsNdb.length > 0 && (
          <LayersControl.Overlay checked name={`NDB (${navaidsNdb.length})`}>
            <FeatureGroup>
              {navaidsNdb.map((navaid, index) => {
                const color = corNavaid(navaid.type)

                return (
                  <CircleMarker
                    key={`ndb-${navaid.type}-${navaid.ident}-${index}`}
                    center={[navaid.latitude, navaid.longitude]}
                    radius={3}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.9,
                      weight: 1
                    }}
                  >
                    <Tooltip sticky>
                      {navaid.ident} | {navaid.type}
                    </Tooltip>

                    <Popup>
                      <div>
                        <div><strong>Ident:</strong> {navaid.ident}</div>
                        <div><strong>Tipo:</strong> {navaid.type}</div>
                        {navaid.name ? <div><strong>Nome:</strong> {navaid.name}</div> : null}
                        {navaid.frequency ? <div><strong>Frequência:</strong> {navaid.frequency}</div> : null}
                        <div><strong>Latitude:</strong> {navaid.latitude}</div>
                        <div><strong>Longitude:</strong> {navaid.longitude}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {manualRouteNormalizada && manualRouteNormalizada.coords_latlon.length >= 2 && (
          <LayersControl.Overlay checked name="Rota manual">
            <FeatureGroup>
              <Polyline
                positions={manualRouteNormalizada.coords_latlon}
                pathOptions={{
                  color: areasImpactadasRotaManual.length > 0 ? COR_ROTA_IMPACTADA : COR_ROTA_MANUAL,
                  weight: 4,
                  opacity: 1
                }}
              >
                <Popup>
                  <div>
                    <div><strong>Origem:</strong> {manualRouteNormalizada.origem}</div>
                    <div><strong>Destino:</strong> {manualRouteNormalizada.destino}</div>
                    <div><strong>Rota:</strong> {manualRouteNormalizada.rota}</div>
                    <div><strong>Distância:</strong> {manualRouteNormalizada.distancia_total_nm} NM</div>
                    <div><strong>Pontos:</strong> {manualRouteNormalizada.pontos_resolvidos.join(" → ")}</div>
                    <hr />
                    <div><strong>Áreas impactadas:</strong> {areasImpactadasRotaManual.length}</div>
                    {areasImpactadasRotaManual.length > 0 ? (
                      <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                        {areasImpactadasRotaManual.map((area) => (
                          <li key={`${area.tipo}-${area.chave}`}>
                            <strong>{area.tipo}</strong> | {area.nome} | {area.detalhe}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>Nenhuma área impactada.</div>
                    )}
                  </div>
                </Popup>

                <Tooltip sticky>
                  {manualRouteNormalizada.origem} → {manualRouteNormalizada.destino}
                  {areasImpactadasRotaManual.length > 0
                    ? ` | ${areasImpactadasRotaManual.length} área(s) impactada(s)`
                    : ""}
                </Tooltip>
              </Polyline>
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        <LayersControl.Overlay checked name="Rotas">
          <FeatureGroup>
            {rotasFiltradasPorImpacto.map((rota) => {
              const key = rotaKey(rota)
              const selecionada = rotaSelecionadaKeyAtual === key
              const algumaRotaSelecionada = !!rotaSelecionadaKeyAtual
              const afetadaPelaArea = chavesRotasImpactadasPelaArea.has(key)
              const estimados = getRouteEstimatedPoints(rota)

              let color = COR_ROTA_BASE
              let weight = 2
              let opacity = 0.9

              if (selecionada) {
                color = COR_ROTA_SELECIONADA
                weight = 5
                opacity = 1
              } else if (algumaRotaSelecionada) {
                color = rota.impactada ? COR_ROTA_IMPACTADA : COR_ROTA_BASE
                weight = 2
                opacity = 0.12
              } else if (props.areaMapaSelecionada) {
                color = afetadaPelaArea ? COR_ROTA_IMPACTADA : COR_ROTA_BASE
                weight = afetadaPelaArea ? 3 : 2
                opacity = afetadaPelaArea ? 0.95 : 0.12
              } else if (rota.impactada) {
                color = COR_ROTA_IMPACTADA
                weight = 2
                opacity = 0.9
              } else {
                color = COR_ROTA_BASE
                weight = 2
                opacity = 0.75
              }

              return (
                <FeatureGroup key={key}>
                  <Polyline
                    positions={rota.coords_latlon}
                    pathOptions={{ color, weight, opacity }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e)
                        props.onSelecionarRota(selecionada ? null : rota)
                      }
                    }}
                  >
                    <Tooltip sticky>
                      {rota.ident || `${rota.origem}-${rota.destino}`} | {formatHhmm(rota.eobt)}
                    </Tooltip>
                  </Polyline>

                  {selecionada && estimados.map((point, pointIndex) => {
                    const ident = point.ident || `P${pointIndex + 1}`
                    const estimado = formatHhmm(point.estimado)

                    return (
                      <Marker
                        key={`${key}-estimado-label-${ident}-${pointIndex}-${estimado}`}
                        position={[point.latitude, point.longitude]}
                        icon={estimatedPointLabelIcon(ident, estimado)}
                        interactive={false}
                      />
                    )
                  })}
                </FeatureGroup>
              )
            })}
          </FeatureGroup>
        </LayersControl.Overlay>

        {props.mostrarFixas && (
          <LayersControl.Overlay checked name="Áreas fixas">
            <FeatureGroup>
              {areasFixasNormalizadas.flatMap((area, areaIndex) =>
                area.coords_latlon.map((anel, anelIndex) => {
                  const selecionadaNoMapa =
                    props.areaMapaSelecionada?.tipo === "FIXA" &&
                    props.areaMapaSelecionada.chave === areaFixaKey(area)

                  const impactadaRotaManual = chavesAreasImpactadasRotaManual.has(areaFixaKey(area))

                  const style = estiloAreaBase({
                    cor: corAreaPorTipo(area.area_type),
                    selecionada: selecionadaNoMapa || impactadaRotaManual
                  })

                  return (
                    <Polygon
                      key={`${area.nome}-${areaIndex}-${anelIndex}`}
                      positions={anel}
                      pathOptions={style}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)

                          const areaSel: NonNullable<AreaMapaSelecionada> = {
                            tipo: "FIXA",
                            chave: areaFixaKey(area),
                            nome: area.nome
                          }

                          props.onSelecionarArea(areaSel, calcularRotasAfetadas(areaSel))
                        }
                      }}
                    >
                      <Popup>
                        <div>
                          <div><strong>Nome:</strong> {area.nome}</div>
                          <div><strong>Tipo:</strong> {area.area_type || "-"}</div>
                          <div><strong>FIR:</strong> {area.fir_match || "-"}</div>
                          {impactadaRotaManual && (
                            <div><strong>Impacta rota manual:</strong> SIM</div>
                          )}
                        </div>
                      </Popup>
                      <Tooltip sticky>
                        {area.nome}
                        {impactadaRotaManual ? " | Impacta rota manual" : ""}
                      </Tooltip>
                    </Polygon>
                  )
                })
              )}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {props.mostrarNotamCsv && (
          <LayersControl.Overlay checked name="Áreas NOTAM">
            <FeatureGroup>
              {areasNotamNormalizadas.map((area, index) => {
                const selecionadaNoMapa =
                  props.areaMapaSelecionada?.tipo === "NOTAM" &&
                  props.areaMapaSelecionada.chave === areaNotamKey(area)

                const impactadaRotaManual = chavesAreasImpactadasRotaManual.has(areaNotamKey(area))

                const style = estiloAreaBase({
                  cor: corNotam(area, props.notamsLidos),
                  selecionada: selecionadaNoMapa || impactadaRotaManual
                })

                if (hasCircleGeometry(area)) {
                  return (
                    <Circle
                      key={`${area.nome}-${index}-${area.source_id}`}
                      center={area.center}
                      radius={area.radius_m}
                      pathOptions={style}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)

                          const areaSel: NonNullable<AreaMapaSelecionada> = {
                            tipo: "NOTAM",
                            chave: areaNotamKey(area),
                            nome: area.nome
                          }

                          props.onSelecionarArea(areaSel, calcularRotasAfetadas(areaSel))
                        }
                      }}
                    >
                      <Popup>
                        <div>
                          <div><strong>Nome:</strong> {area.nome}</div>
                          <div><strong>NOTAM:</strong> {area.numero_notam || "-"}</div>
                          <div><strong>Q-line:</strong> {area.q_line || "-"}</div>
                          <div><strong>Início:</strong> {area.valid_from || "-"}</div>
                          <div><strong>Fim:</strong> {area.valid_to || "-"}</div>
                          <div><strong>Faixa alta:</strong> {isUpperLimitHigh(area) ? "SIM" : "NÃO"}</div>
                          {impactadaRotaManual && (
                            <div><strong>Impacta rota manual:</strong> SIM</div>
                          )}
                          <div
                            dangerouslySetInnerHTML={{
                              __html: formatarTextoNotam(area)
                            }}
                          />
                        </div>
                      </Popup>
                      <Tooltip sticky>
                        {area.nome}
                        {impactadaRotaManual ? " | Impacta rota manual" : ""}
                      </Tooltip>
                    </Circle>
                  )
                }

                return (
                  <Polygon
                    key={`${area.nome}-${index}-${area.source_id}`}
                    positions={area.coords_latlon}
                    pathOptions={style}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e)

                        const areaSel: NonNullable<AreaMapaSelecionada> = {
                          tipo: "NOTAM",
                          chave: areaNotamKey(area),
                          nome: area.nome
                        }

                        props.onSelecionarArea(areaSel, calcularRotasAfetadas(areaSel))
                      }
                    }}
                  >
                    <Popup>
                      <div>
                        <div><strong>Nome:</strong> {area.nome}</div>
                        <div><strong>NOTAM:</strong> {area.numero_notam || "-"}</div>
                        <div><strong>Q-line:</strong> {area.q_line || "-"}</div>
                        <div><strong>Início:</strong> {area.valid_from || "-"}</div>
                        <div><strong>Fim:</strong> {area.valid_to || "-"}</div>
                        <div><strong>Faixa alta:</strong> {isUpperLimitHigh(area) ? "SIM" : "NÃO"}</div>
                        {impactadaRotaManual && (
                          <div><strong>Impacta rota manual:</strong> SIM</div>
                        )}
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatarTextoNotam(area)
                          }}
                        />
                      </div>
                    </Popup>
                    <Tooltip sticky>
                      {area.nome}
                      {impactadaRotaManual ? " | Impacta rota manual" : ""}
                    </Tooltip>
                  </Polygon>
                )
              })}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}

        {props.mostrarTemporarias && (
          <LayersControl.Overlay checked name="Áreas temporárias">
            <FeatureGroup>
              {areasTemporariasNormalizadas.map((area, index) => {
                const selecionadaNoMapa =
                  props.areaMapaSelecionada?.tipo === "MANUAL" &&
                  props.areaMapaSelecionada.chave === areaManualKey(area)

                const impactadaRotaManual = chavesAreasImpactadasRotaManual.has(areaManualKey(area))
                const destacada = selecionadaNoMapa || impactadaRotaManual

                return (
                  <Polygon
                    key={`${area.nome}-${index}`}
                    positions={area.coords_latlon}
                    pathOptions={{
                      color: destacada ? COR_TEMPORARIA_SELECIONADA : COR_TEMPORARIA,
                      weight: destacada ? 3 : 1.5,
                      opacity: 1,
                      fillColor: destacada ? COR_TEMPORARIA_SELECIONADA : COR_TEMPORARIA,
                      fillOpacity: destacada ? 0.28 : 0.2
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e)

                        const areaSel: NonNullable<AreaMapaSelecionada> = {
                          tipo: "MANUAL",
                          chave: areaManualKey(area),
                          nome: area.nome
                        }

                        props.onSelecionarArea(areaSel, calcularRotasAfetadas(areaSel))
                      }
                    }}
                  >
                    <Popup>
                      <div>
                        <div><strong>Nome:</strong> {area.nome}</div>
                        {impactadaRotaManual && (
                          <div><strong>Impacta rota manual:</strong> SIM</div>
                        )}
                      </div>
                    </Popup>
                    <Tooltip sticky>
                      {area.nome}
                      {impactadaRotaManual ? " | Impacta rota manual" : ""}
                    </Tooltip>
                  </Polygon>
                )
              })}
            </FeatureGroup>
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  )
}