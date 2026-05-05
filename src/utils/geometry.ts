import type { LatLon } from "../types"

export function closeRing(coords: LatLon[]): LatLon[] {
  if (coords.length < 3) return coords

  const normalized = [...coords]
  const first = normalized[0]
  const last = normalized[normalized.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push(first)
  }

  return normalized
}

export function pointOnSegment(point: LatLon, a: LatLon, b: LatLon): boolean {
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

export function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
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

export function orientation(a: LatLon, b: LatLon, c: LatLon): number {
  const value =
    (b[1] - a[1]) * (c[0] - b[0]) -
    (b[0] - a[0]) * (c[1] - b[1])

  if (Math.abs(value) < 1e-10) return 0
  return value > 0 ? 1 : 2
}

export function segmentsIntersect(p1: LatLon, q1: LatLon, p2: LatLon, q2: LatLon): boolean {
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

export function distanceMeters(a: LatLon, b: LatLon): number {
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

export function pointInCircle(point: LatLon, center: LatLon, radius_m: number): boolean {
  return distanceMeters(point, center) <= radius_m
}

export function segmentDistanceToPointMeters(a: LatLon, b: LatLon, p: LatLon): number {
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

export function lineIntersectsPolygon(route: LatLon[], polygon: LatLon[]): boolean {
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

export function lineIntersectsCircle(route: LatLon[], center: LatLon, radius_m: number): boolean {
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