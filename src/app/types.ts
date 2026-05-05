import type { AreaNotamCsv, RotaAnalisada } from "../types"

export type AreaMapaSelecionada =
  | { tipo: "FIXA"; chave: string; nome: string }
  | { tipo: "NOTAM"; chave: string; nome: string }
  | { tipo: "MANUAL"; chave: string; nome: string }
  | null

export type AreaSelecionadaNaoNula = NonNullable<AreaMapaSelecionada>

export type SelecionarAreaHandler = (
  area: AreaMapaSelecionada,
  rotasAfetadas: RotaAnalisada[]
) => void

export type SelecionarNotamHandler = (notam: AreaNotamCsv) => void