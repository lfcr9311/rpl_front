import { useCallback, useMemo } from "react"
import type { RotaAnalisada } from "../types"
import { rotaKey } from "../app/keys"

export function useRouteSelection(
  rotasTodas: RotaAnalisada[],
  rotaSelecionadaKey: string | null,
  setRotaSelecionadaKey: React.Dispatch<React.SetStateAction<string | null>>
) {
  const rotaSelecionada = useMemo(() => {
    if (!rotaSelecionadaKey) return null
    return rotasTodas.find((rota) => rotaKey(rota) === rotaSelecionadaKey) ?? null
  }, [rotasTodas, rotaSelecionadaKey])

  const selecionarRota = useCallback((rota: RotaAnalisada | null) => {
    if (!rota) {
      setRotaSelecionadaKey(null)
      return
    }

    const key = rotaKey(rota)
    setRotaSelecionadaKey((current) => (current === key ? null : key))
  }, [setRotaSelecionadaKey])

  return {
    rotaSelecionada,
    selecionarRota
  }
}