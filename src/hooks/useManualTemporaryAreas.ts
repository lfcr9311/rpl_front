import { useCallback, useMemo, useState } from "react"
import { parseCoordsInput } from "../services/api"
import type { AreaTemporaria } from "../types"
import { INITIAL_COORDS, nextAreaName } from "../app/constants"
import type { AreaMapaSelecionada } from "../app/types"

export function useManualTemporaryAreas(
  areasTemporariasServidor: AreaTemporaria[],
  setError: React.Dispatch<React.SetStateAction<string>>,
  setAreaMapaSelecionada: React.Dispatch<React.SetStateAction<AreaMapaSelecionada>>,
  setRotasImpactadasPelaArea: React.Dispatch<React.SetStateAction<any[]>>
) {
  const [inputCoords, setInputCoords] = useState(INITIAL_COORDS)
  const [inputNome, setInputNome] = useState(nextAreaName(0))
  const [areaSelecionada, setAreaSelecionada] = useState<string | null>(null)
  const [areasTemporariasLocais, setAreasTemporariasLocais] = useState<AreaTemporaria[]>([])

  const areasTemporarias = useMemo(() => {
    return [...areasTemporariasLocais, ...areasTemporariasServidor]
  }, [areasTemporariasLocais, areasTemporariasServidor])

  const adicionarAreaTemporaria = useCallback(() => {
    try {
      const coords = parseCoordsInput(inputCoords)
      const nome = inputNome.trim() || nextAreaName(areasTemporariasLocais.length)

      setAreasTemporariasLocais((current) => [
        ...current,
        { nome, coords_latlon: coords }
      ])

      setInputNome(nextAreaName(areasTemporariasLocais.length + 1))
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar área")
    }
  }, [inputCoords, inputNome, areasTemporariasLocais.length, setError])

  const removerAreaTemporaria = useCallback(() => {
    if (!areaSelecionada) return

    setAreasTemporariasLocais((current) =>
      current.filter((area) => area.nome !== areaSelecionada)
    )

    setAreaSelecionada(null)
    setAreaMapaSelecionada(null)
    setRotasImpactadasPelaArea([])
  }, [areaSelecionada, setAreaMapaSelecionada, setRotasImpactadasPelaArea])

  const limparAreasTemporarias = useCallback(() => {
    setAreasTemporariasLocais([])
    setAreaSelecionada(null)
    setAreaMapaSelecionada(null)
    setRotasImpactadasPelaArea([])
  }, [setAreaMapaSelecionada, setRotasImpactadasPelaArea])

  return {
    inputCoords,
    setInputCoords,
    inputNome,
    setInputNome,
    areaSelecionada,
    setAreaSelecionada,
    areasTemporarias,
    adicionarAreaTemporaria,
    removerAreaTemporaria,
    limparAreasTemporarias
  }
}