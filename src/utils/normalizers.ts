import type { LatLon } from "../types"

export function normalizarTexto(valor: unknown) {
  return String(valor ?? "").trim().toUpperCase()
}

export function isValidCoord(point: unknown): point is LatLon {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(Number(point[0])) &&
    Number.isFinite(Number(point[1])) &&
    Math.abs(Number(point[0])) <= 90 &&
    Math.abs(Number(point[1])) <= 180
  )
}

export function normalizeBase(coords: unknown): LatLon[] {
  if (!Array.isArray(coords)) return []

  return coords
    .map((point) => {
      if (!isValidCoord(point)) return null
      return [Number(point[0]), Number(point[1])] as LatLon
    })
    .filter(Boolean) as LatLon[]
}

export function normalizeRing(coords: unknown): LatLon[] {
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

export function normalizeLine(coords: unknown): LatLon[] {
  return normalizeBase(coords)
}