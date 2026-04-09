export type LatLon = [number, number]

export type AreaType = "RESTRICTED" | "PROHIBITED" | "DANGER" | string
export type TipoImpacto = "NENHUM" | "PERMANENTE" | "TEMPORARIA" | "AMBAS"
export type FiltroImpacto = "TODAS" | "PERMANENTE" | "TEMPORARIA" | "AMBAS"

export interface Airport {
  icao: string
  latitude: number
  longitude: number
}

export interface Waypoint {
  ident: string
  latitude: number
  longitude: number
}

export interface AreaFixa {
  nome: string
  area_type: string
  fir_match: string
  coords_latlon: LatLon[][]
}

export interface AreaNotamCsv {
  nome: string
  numero_notam: string
  fir_match: string
  area_type: string
  valid_from: string
  valid_to: string
  q_line: string
  coords_latlon: [number, number][]
  texto_notam: string
  geometry_type?: "POLYGON" | "CIRCLE"
  center?: [number, number] | null
  radius_m?: number | null
}

export interface AreaTemporaria {
  nome: string
  coords_latlon: LatLon[]
}

export interface AeroviaLinha {
  nome: string
  coords_latlon: LatLon[]
}

export interface ImpactoAerovia {
  aerovia_nome: string
  area_nome: string
  area_tipo: string
}

export interface RotaAnalisada {
  ident: string
  tipo_anv: string
  nivel_voo: string
  origem: string
  destino: string
  eobt: string
  eet: string
  eta: string
  rota_texto: string
  linha_original: string
  coords_latlon: LatLon[]
  impactos_temporarias: AreaNotamCsv[]
  impactos_fixas: AreaFixa[]
  impactada: boolean
  impactada_fixa: boolean
  impactada_temporaria: boolean
  tipo_impacto: TipoImpacto
}

export interface BootstrapResponse {
  aeroportos: Airport[]
  waypoints: Waypoint[]
  areas_fixas: AreaFixa[]
  areas_notam_csv: AreaNotamCsv[]
  areas_temporarias: AreaTemporaria[]
  rotas_analisadas: RotaAnalisada[]
  aerovias_alta: AeroviaLinha[]
  aerovias_baixa: AeroviaLinha[]
  aerovias_uruguay: AeroviaLinha[]
  impactos_aerovias: ImpactoAerovia[]
}