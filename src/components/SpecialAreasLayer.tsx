import { useEffect, useMemo, useState } from 'react'
import { FeatureGroup, LayersControl, Polygon, Popup, Tooltip } from 'react-leaflet'
import { getSpecialAreas, SpecialArea } from '../services/specialAreasApi'

function getAreaColor(type: string) {
  if (type === 'D') {
    return '#f97316'
  }

  if (type === 'P') {
    return '#dc2626'
  }

  if (type === 'R') {
    return '#eab308'
  }

  return '#64748b'
}

function formatLimit(value: string, unit: string) {
  const text = String(value || '').trim()
  const unitText = String(unit || '').trim()

  if (!text && !unitText) {
    return '-'
  }

  if (!text) {
    return unitText
  }

  if (!unitText) {
    return text
  }

  return `${text} ${unitText}`
}

function renderArea(area: SpecialArea) {
  const color = getAreaColor(area.type)

  return (
    <Polygon
      key={`${area.source}-${area.id}`}
      positions={area.coords_latlon}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.16,
        weight: 2,
      }}
    >
      <Tooltip sticky>
        {area.ident} | {area.typeLabel}
      </Tooltip>

      <Popup>
        <div style={{ minWidth: 220 }}>
          <div>
            <strong>{area.ident}</strong>
          </div>

          <div>{area.name}</div>

          <br />

          <div>
            <strong>Tipo:</strong> {area.typeLabel}
          </div>

          <div>
            <strong>Limite inferior:</strong> {formatLimit(area.lowerLimit, area.lowerUnit)}
          </div>

          <div>
            <strong>Limite superior:</strong> {formatLimit(area.upperLimit, area.upperUnit)}
          </div>

          {area.effectived ? (
            <div>
              <strong>Efetiva desde:</strong> {area.effectived}
            </div>
          ) : null}
        </div>
      </Popup>
    </Polygon>
  )
}

export function SpecialAreasLayer() {
  const [areas, setAreas] = useState<SpecialArea[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        setLoading(true)

        const data = await getSpecialAreas()

        if (!alive) {
          return
        }

        setAreas(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error(error)
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      alive = false
    }
  }, [])

  const dangerousAreas = useMemo(
    () => areas.filter((area) => area.type === 'D'),
    [areas],
  )

  const prohibitedAreas = useMemo(
    () => areas.filter((area) => area.type === 'P'),
    [areas],
  )

  const restrictedAreas = useMemo(
    () => areas.filter((area) => area.type === 'R'),
    [areas],
  )

  if (loading) {
    return null
  }

  return (
    <>
      <LayersControl.Overlay checked={false} name={`Áreas perigosas (${dangerousAreas.length})`}>
        <FeatureGroup>
          {dangerousAreas.map(renderArea)}
        </FeatureGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked={false} name={`Áreas proibidas (${prohibitedAreas.length})`}>
        <FeatureGroup>
          {prohibitedAreas.map(renderArea)}
        </FeatureGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked={false} name={`Áreas restritas (${restrictedAreas.length})`}>
        <FeatureGroup>
          {restrictedAreas.map(renderArea)}
        </FeatureGroup>
      </LayersControl.Overlay>
    </>
  )
}