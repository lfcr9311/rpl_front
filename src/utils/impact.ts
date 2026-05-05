import type { AreaNotamCsv, FiltroImpacto, RotaAnalisada, LatLon } from "../types"
import { lineIntersectsCircle, lineIntersectsPolygon } from "./geometry"
import { normalizeLine, normalizeRing } from "./normalizers"

export function rotaCasaNoFiltro(rota: RotaAnalisada, filtro: FiltroImpacto): boolean {
  if (filtro === "TODAS") return true
  if (filtro === "PERMANENTE") return !!rota.impactada_fixa
  if (filtro === "TEMPORARIA") return !!rota.impactada_temporaria
  if (filtro === "AMBAS") return !!rota.impactada_fixa && !!rota.impactada_temporaria
  return true
}

export function calcularRotasAfetadasPorNotam(
  notam: AreaNotamCsv,
  rotas: RotaAnalisada[],
  filtroImpacto: FiltroImpacto
): RotaAnalisada[] {
  return rotas
    .filter((rota) => rotaCasaNoFiltro(rota, filtroImpacto))
    .map((rota) => ({
      ...rota,
      coords_latlon: normalizeLine(rota.coords_latlon)
    }))
    .filter((rota) => {
      if (
        notam.geometry_type === "CIRCLE" &&
        Array.isArray(notam.center) &&
        notam.center.length >= 2 &&
        typeof notam.radius_m === "number"
      ) {
        const center: LatLon = [Number(notam.center[0]), Number(notam.center[1])]

        return lineIntersectsCircle(
          rota.coords_latlon,
          center,
          notam.radius_m
        )
      }

      const polygon = normalizeRing(notam.coords_latlon)
      if (polygon.length < 3) return false

      return lineIntersectsPolygon(rota.coords_latlon, polygon)
    })
}