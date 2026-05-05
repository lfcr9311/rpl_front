import type { AreaNotamCsv, RotaAnalisada } from "../types"

export function rotaKey(rota: RotaAnalisada) {
  return `${rota.ident}|${rota.origem}|${rota.destino}|${rota.rota_texto}|${rota.eobt}|${rota.eta}`
}

export function areaNotamKey(area: AreaNotamCsv) {
  return `NOTAM|${area.numero_notam || area.nome}|${area.fir_match}|${area.geometry_type}|${area.source_id || ""}`
}