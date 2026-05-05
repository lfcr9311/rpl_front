import { useCallback } from "react"
import type { RotaAnalisada } from "../types"
import type { AreaMapaSelecionada } from "../app/types"

export function useAreaSelection(
  setAreaMapaSelecionada: React.Dispatch<React.SetStateAction<AreaMapaSelecionada>>,
  setRotasImpactadasPelaArea: React.Dispatch<React.SetStateAction<RotaAnalisada[]>>,
  setRotaSelecionadaKey: React.Dispatch<React.SetStateAction<string | null>>
) {
  const selecionarArea = useCallback((
    area: AreaMapaSelecionada,
    rotasAfetadas: RotaAnalisada[]
  ) => {
    if (!area) {
      setAreaMapaSelecionada(null)
      setRotasImpactadasPelaArea([])
      return
    }

    setAreaMapaSelecionada((current) => {
      const mesmaAreaSelecionada =
        current &&
        current.tipo === area.tipo &&
        current.chave === area.chave

      if (mesmaAreaSelecionada) {
        setRotasImpactadasPelaArea([])
        setRotaSelecionadaKey(null)
        return null
      }

      setRotasImpactadasPelaArea(rotasAfetadas)
      setRotaSelecionadaKey(null)
      return area
    })
  }, [setAreaMapaSelecionada, setRotasImpactadasPelaArea, setRotaSelecionadaKey])

  const limparSelecoes = useCallback(() => {
    setRotaSelecionadaKey(null)
    setAreaMapaSelecionada(null)
    setRotasImpactadasPelaArea([])
  }, [setAreaMapaSelecionada, setRotasImpactadasPelaArea, setRotaSelecionadaKey])

  return {
    selecionarArea,
    limparSelecoes
  }
}