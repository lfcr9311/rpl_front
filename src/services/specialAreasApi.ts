export type SpecialAreaType = 'D' | 'P' | 'R'

export type LatLon = [number, number]

export interface SpecialArea {
  id: string
  source: string
  type: SpecialAreaType
  typeLabel: string
  ident: string
  name: string
  upperLimit: string
  lowerLimit: string
  upperUnit: string
  lowerUnit: string
  effectived: string
  coords_latlon: LatLon[]
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000/api'

export async function getSpecialAreas(type?: SpecialAreaType): Promise<SpecialArea[]> {
  const url = type
    ? `${API_BASE_URL}/api/special-areas?type=${type}`
    : `${API_BASE_URL}/api/special-areas`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Erro ao buscar áreas especiais. HTTP ${response.status}`)
  }

  return response.json()
}