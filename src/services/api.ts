import type {
  AreaTemporaria,
  AreaNotamCsv,
  BootstrapResponse,
  LatLon,
  RotaAnalisada,
  Airport,
  AeroviaLinha
} from "../types"

type TipoImpacto = "NENHUM" | "TEMPORARIA" | "PERMANENTE" | "AMBAS"

export type NotamReadState = {
  sourceId: string
  numeroNotam: string
  fir?: string | null
  lido: boolean
  updatedAt?: string
}

const API_URL = import.meta.env.VITE_API_URL || "https://rpl-back.vercel.app"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Erro HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

function dmsParaDecimal(g: string, m: string, s: string, h: string): number {
  const valor = Number(g) + Number(m) / 60 + Number(s) / 3600
  return h === "S" || h === "W" ? -valor : valor
}

function parseCompactToken(token: string): LatLon | null {
  const t = token.toUpperCase().replace(/\s+/g, "").replace("/", "")
  const match = t.match(
    /^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])$/
  )

  if (!match) return null

  const lat = dmsParaDecimal(match[1], match[2], match[3], match[4])
  const lon = dmsParaDecimal(match[5], match[6], match[7], match[8])

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

  return [lat, lon]
}

function extractCoordsFromText(text?: string | null): LatLon[] {
  const value = String(text ?? "").trim()
  if (!value) return []

  const matches = value.match(/\d{6}(?:\.\d+)?[NS]\/?\d{7}(?:\.\d+)?[EW]/gi)
  if (!matches || matches.length < 1) return []

  const coords = matches
    .map(parseCompactToken)
    .filter(Boolean) as LatLon[]

  if (coords.length >= 3) {
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push(first)
    }
  }

  return coords
}

function normalizeCoords(coords: unknown): LatLon[] {
  if (!Array.isArray(coords)) return []

  const normalized = coords
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null

      const lat = Number(point[0])
      const lon = Number(point[1])

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

      return [lat, lon] as LatLon
    })
    .filter(Boolean) as LatLon[]

  if (normalized.length >= 3) {
    const first = normalized[0]
    const last = normalized[normalized.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      normalized.push(first)
    }
  }

  return normalized
}

function parseGeoCircle(raw?: string | null): { center: LatLon; radius_m: number } | null {
  const value = String(raw ?? "").trim().toUpperCase()
  if (!value) return null

  const match = value.match(
    /^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])(\d{3})$/
  )

  if (!match) return null

  const latDeg = Number(match[1])
  const latMin = Number(match[2])
  const latHem = match[3]
  const lonDeg = Number(match[4])
  const lonMin = Number(match[5])
  const lonHem = match[6]
  const radiusNm = Number(match[7])

  const lat = (latDeg + latMin / 60) * (latHem === "S" ? -1 : 1)
  const lon = (lonDeg + lonMin / 60) * (lonHem === "W" ? -1 : 1)
  const radius_m = radiusNm * 1852

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius_m)) {
    return null
  }

  return {
    center: [lat, lon],
    radius_m
  }
}

function normalizeNotam(notam: any): AreaNotamCsv | null {
  const coordsFromPayload = normalizeCoords(notam?.coords_latlon)
  const coordsFromText = extractCoordsFromText(
    notam?.textE ?? notam?.texto_notam ?? notam?.text ?? notam?.e
  )

  const qLine = String(
    notam?.q_line ??
      notam?.qcode ??
      notam?.cod ??
      ""
  )
    .trim()
    .toUpperCase()

  if (qLine === "QAFTT") {
    return null
  }

  const sourceId = String(notam?.source_id ?? notam?.sourceId ?? notam?.id ?? "").trim()

  if (coordsFromPayload.length >= 3 || coordsFromText.length >= 3) {
    return {
      nome:
        notam?.nome ??
        notam?.number ??
        notam?.numero_notam ??
        notam?.id ??
        "NOTAM",
      numero_notam:
        String(
          notam?.numero_notam ??
          notam?.number ??
          notam?.n ??
          ""
        ).trim().toUpperCase(),
      fir_match:
        notam?.fir_match ??
        notam?.fir ??
        notam?.location ??
        notam?.loc ??
        "",
      area_type:
        notam?.area_type ??
        notam?.qcode ??
        notam?.cod ??
        "",
      valid_from:
        notam?.valid_from ??
        notam?.validFromRaw ??
        notam?.validFrom ??
        notam?.b ??
        "",
      valid_to:
        notam?.valid_to ??
        notam?.validToRaw ??
        notam?.validTo ??
        notam?.c ??
        "",
      q_line: qLine,
      coords_latlon:
        coordsFromPayload.length >= 3 ? coordsFromPayload : coordsFromText,
      texto_notam:
        notam?.texto_notam ??
        notam?.textE ??
        notam?.text ??
        notam?.e ??
        "",
      geometry_type: "POLYGON",
      center: null,
      radius_m: null,
      source_id: sourceId,
      lido: Boolean(notam?.lido)
    }
  }

  const parsedCircle = parseGeoCircle(notam?.geo)
  if (parsedCircle) {
    return {
      nome:
        notam?.nome ??
        notam?.number ??
        notam?.numero_notam ??
        notam?.id ??
        "NOTAM",
      numero_notam:
        String(
          notam?.numero_notam ??
          notam?.number ??
          notam?.n ??
          ""
        ).trim().toUpperCase(),
      fir_match:
        notam?.fir_match ??
        notam?.fir ??
        notam?.location ??
        notam?.loc ??
        "",
      area_type:
        notam?.area_type ??
        notam?.qcode ??
        notam?.cod ??
        "",
      valid_from:
        notam?.valid_from ??
        notam?.validFromRaw ??
        notam?.validFrom ??
        notam?.b ??
        "",
      valid_to:
        notam?.valid_to ??
        notam?.validToRaw ??
        notam?.validTo ??
        notam?.c ??
        "",
      q_line: qLine,
      coords_latlon: [],
      texto_notam:
        notam?.texto_notam ??
        notam?.textE ??
        notam?.text ??
        notam?.e ??
        "",
      geometry_type: "CIRCLE",
      center: parsedCircle.center,
      radius_m: parsedCircle.radius_m,
      source_id: sourceId,
      lido: Boolean(notam?.lido)
    }
  }

  return null
}

function flattenGroupedNotams(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== "object") {
    return []
  }

  const result: any[] = []

  for (const [fir, areas] of Object.entries(payload)) {
    if (!Array.isArray(areas)) continue

    for (const area of areas) {
      result.push({
        ...area,
        fir_match: area?.fir_match ?? fir
      })
    }
  }

  return result
}

function normalizeAerovia(aerovia: any): AeroviaLinha {
  const coords = Array.isArray(aerovia?.coords_latlon)
    ? aerovia.coords_latlon
        .map((point: any) => {
          if (!Array.isArray(point) || point.length < 2) return null
          const lat = Number(point[0])
          const lon = Number(point[1])
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
          return [lat, lon] as LatLon
        })
        .filter(Boolean) as LatLon[]
    : []

  return {
    nome: String(aerovia?.nome ?? "AEROVIA"),
    coords_latlon: coords
  }
}

function normalizeAeroporto(aeroporto: any): Airport {
  return {
    icao: String(aeroporto?.icao ?? "").toUpperCase(),
    latitude: Number(aeroporto?.latitude ?? 0),
    longitude: Number(aeroporto?.longitude ?? 0)
  }
}

function normalizeRpl(rota: any): RotaAnalisada {
  const coords =
    Array.isArray(rota?.coords_latlon)
      ? rota.coords_latlon
          .map((point: any) => {
            if (!Array.isArray(point) || point.length < 2) return null
            const lat = Number(point[0])
            const lon = Number(point[1])
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
            return [lat, lon] as LatLon
          })
          .filter(Boolean) as LatLon[]
      : []

  return {
    ident: rota?.ident ?? "",
    tipo_anv: rota?.tipo_anv ?? "",
    nivel_voo: rota?.nivel_voo ?? "",
    origem: rota?.origem ?? "",
    destino: rota?.destino ?? "",
    eobt: rota?.eobt ?? "",
    eet: rota?.eet ?? "",
    eta: rota?.eta ?? "",
    rota_texto: rota?.rota_texto ?? "",
    linha_original: rota?.linha_original ?? "",
    coords_latlon: coords,
    impactos_temporarias: [],
    impactos_fixas: [],
    impactada: false,
    impactada_fixa: false,
    impactada_temporaria: false,
    tipo_impacto: "NENHUM"
  }
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
    if (pointOnSegment(point, ring[i], ring[i + 1])) {
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

function lineIntersectsPolygon(route: LatLon[], polygon: LatLon[]): boolean {
  if (route.length < 2) return false

  const ring = closeRing(polygon)
  if (ring.length < 4) return false

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

function analyzeRoutesWithAreas(
  rotas: RotaAnalisada[],
  areas: AreaNotamCsv[]
): RotaAnalisada[] {
  return rotas.map((rota) => {
    const rotaCoords = Array.isArray(rota.coords_latlon) ? rota.coords_latlon : []

    const impactosTemporarias = areas.filter((area) => {
      if (rotaCoords.length < 2) return false

      if (
        area.geometry_type === "CIRCLE" &&
        Array.isArray(area.center) &&
        area.center.length >= 2 &&
        typeof area.radius_m === "number"
      ) {
        return lineIntersectsCircle(rotaCoords, area.center, area.radius_m)
      }

      const areaCoords = Array.isArray(area.coords_latlon) ? area.coords_latlon : []
      if (areaCoords.length < 3) return false

      return lineIntersectsPolygon(rotaCoords, areaCoords)
    })

    const impactadaTemporaria = impactosTemporarias.length > 0
    const impactadaFixa = false
    const impactada = impactadaTemporaria || impactadaFixa

    let tipoImpacto: TipoImpacto = "NENHUM"
    if (impactadaTemporaria && impactadaFixa) tipoImpacto = "AMBAS"
    else if (impactadaTemporaria) tipoImpacto = "TEMPORARIA"
    else if (impactadaFixa) tipoImpacto = "PERMANENTE"

    return {
      ...rota,
      impactos_temporarias: impactosTemporarias,
      impactos_fixas: [],
      impactada,
      impactada_fixa: impactadaFixa,
      impactada_temporaria: impactadaTemporaria,
      tipo_impacto: tipoImpacto
    }
  })
}

function toBootstrapResponse(
  notams: any,
  aeroviasAlta: any[],
  aeroviasBaixa: any[],
  aeroviasUruguay: any[],
  aeroportos: any[],
  rotasRpl: any[]
): BootstrapResponse {
  const flattenedNotams = flattenGroupedNotams(notams)

  const normalizedNotams: AreaNotamCsv[] = Array.isArray(flattenedNotams)
    ? flattenedNotams
        .map(normalizeNotam)
        .filter(Boolean) as AreaNotamCsv[]
    : []

  const normalizedAlta: AeroviaLinha[] = Array.isArray(aeroviasAlta)
    ? aeroviasAlta.map(normalizeAerovia)
    : []

  const normalizedBaixa: AeroviaLinha[] = Array.isArray(aeroviasBaixa)
    ? aeroviasBaixa.map(normalizeAerovia)
    : []

  const normalizedUruguay: AeroviaLinha[] = Array.isArray(aeroviasUruguay)
    ? aeroviasUruguay.map(normalizeAerovia)
    : []

  const normalizedAeroportos: Airport[] = Array.isArray(aeroportos)
    ? aeroportos.map(normalizeAeroporto)
    : []

  const normalizedRplBase: RotaAnalisada[] = Array.isArray(rotasRpl)
    ? rotasRpl.map(normalizeRpl)
    : []

  const normalizedRpl = analyzeRoutesWithAreas(normalizedRplBase, normalizedNotams)

  return {
    aeroportos: normalizedAeroportos,
    waypoints: [],
    areas_fixas: [],
    areas_notam_csv: normalizedNotams,
    areas_temporarias: [],
    rotas_analisadas: normalizedRpl,
    aerovias_alta: normalizedAlta,
    aerovias_baixa: normalizedBaixa,
    aerovias_uruguay: normalizedUruguay,
    impactos_aerovias: []
  }
}

async function loadNotams(includeRead = true): Promise<any> {
  return request<any>(`/api/notams/areas?includeRead=${includeRead ? "true" : "false"}`)
}

async function loadAeroviasAlta(): Promise<any[]> {
  const data = await request<any[]>("/api/notams/aerovias/alta")
  return Array.isArray(data) ? data : []
}

async function loadAeroviasBaixa(): Promise<any[]> {
  const data = await request<any[]>("/api/notams/aerovias/baixa")
  return Array.isArray(data) ? data : []
}

async function loadAeroviasUruguay(): Promise<any[]> {
  return []
}

async function loadAeroportos(): Promise<any[]> {
  const data = await request<any[]>("/api/notams/aeroportos")
  return Array.isArray(data) ? data : []
}

async function loadRpl(): Promise<any[]> {
  const data = await request<any[]>("/api/notams/rpl")
  return Array.isArray(data) ? data : []
}

export async function getBootstrap(includeRead = true): Promise<BootstrapResponse> {
  const [notams, aeroviasAlta, aeroviasBaixa, aeroviasUruguay, aeroportos, rotasRpl] = await Promise.all([
    loadNotams(includeRead),
    loadAeroviasAlta(),
    loadAeroviasBaixa(),
    loadAeroviasUruguay(),
    loadAeroportos(),
    loadRpl()
  ])

  return toBootstrapResponse(
    notams,
    aeroviasAlta,
    aeroviasBaixa,
    aeroviasUruguay,
    aeroportos,
    rotasRpl
  )
}

export async function getApiRoot(): Promise<any> {
  return request("/api")
}

export async function getNotams(includeRead = true): Promise<any> {
  return loadNotams(includeRead)
}

export async function getNotamsHealth(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/notams/health")
}

export async function getNotamReadStates(fir?: string): Promise<NotamReadState[]> {
  const qs = fir ? `?fir=${encodeURIComponent(fir)}` : ""
  return request<NotamReadState[]>(`/api/notams/read-state${qs}`)
}

export async function setNotamReadState(payload: {
  sourceId: string
  numeroNotam: string
  fir?: string
  lido: boolean
}): Promise<NotamReadState> {
  return request<NotamReadState>("/api/notams/read-state", {
    method: "PATCH",
    body: JSON.stringify(payload)
  })
}

export function formatarHora(value?: string | null): string {
  const v = String(value ?? "").trim()
  if (!/^\d{4}$/.test(v)) return v || "-"
  return `${v.slice(0, 2)}:${v.slice(2, 4)}`
}

export function buildAreaLabel(area: AreaTemporaria): string {
  return `${area.nome} (${area.coords_latlon.length} pts)`
}

export function parseCoordsInput(input: string): LatLon[] {
  const matches = String(input ?? "")
    .match(/\d{6}(?:\.\d+)?[NS]\/?\d{7}(?:\.\d+)?[EW]/gi)

  if (!matches || matches.length < 3) {
    throw new Error("Coordenadas inválidas. Use ao menos 3 pontos no formato 253231.67S/0542325.98W")
  }

  const coords = matches
    .map(parseCompactToken)
    .filter(Boolean) as LatLon[]

  if (coords.length < 3) {
    throw new Error("Coordenadas inválidas")
  }

  const first = coords[0]
  const last = coords[coords.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push(first)
  }

  return coords
}