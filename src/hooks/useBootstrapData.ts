import { useCallback, useEffect, useState } from "react"
import { getBootstrap } from "../services/api"
import type { BootstrapResponse } from "../types"

export function useBootstrapData() {
  const [data, setData] = useState<BootstrapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const bootstrap = await getBootstrap(true)
      setData(bootstrap)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return {
    data,
    loading,
    error,
    setError,
    carregar
  }
}