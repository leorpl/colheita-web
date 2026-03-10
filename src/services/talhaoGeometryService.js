import shp from 'shpjs'

import { unprocessable } from '../errors.js'

function isPolygonGeometry(geom) {
  const type = String(geom?.type || '')
  return type === 'Polygon' || type === 'MultiPolygon'
}

function featureBounds(feature) {
  const coords = []
  const pushCoords = (arr) => {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      coords.push([Number(arr[0]), Number(arr[1])])
      return
    }
    for (const x of arr) pushCoords(x)
  }
  pushCoords(feature?.geometry?.coordinates)
  if (!coords.length) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  return { minLng, minLat, maxLng, maxLat }
}

function featureLabel(feature, index) {
  const props = feature?.properties || {}
  const keys = ['FIELD_NAME', 'field_name', 'NAME', 'name', 'NOME', 'nome', 'CODIGO', 'codigo', 'ID', 'id']
  const found = keys.find((k) => String(props[k] || '').trim())
  return found ? String(props[found]).trim() : `Poligono ${index + 1}`
}

function normalizeFeature(feature, index) {
  if (!feature || feature.type !== 'Feature' || !isPolygonGeometry(feature.geometry)) return null
  const bounds = featureBounds(feature)
  return {
    index,
    label: featureLabel(feature, index),
    properties: feature.properties || {},
    bounds,
    feature: {
      type: 'Feature',
      properties: feature.properties || {},
      geometry: feature.geometry,
    },
  }
}

function collectFeatures(parsed) {
  if (!parsed) return []
  const arr = Array.isArray(parsed) ? parsed : [parsed]
  const out = []
  for (const item of arr) {
    if (item?.type === 'FeatureCollection' && Array.isArray(item.features)) {
      out.push(...item.features)
    } else if (item?.type === 'Feature') {
      out.push(item)
    }
  }
  return out
}

export async function parseTalhaoGeometryZip(buffer, filename = 'arquivo.zip') {
  const name = String(filename || '').trim().toLowerCase()
  if (!name.endsWith('.zip')) {
    throw unprocessable('Envie um arquivo .zip contendo o shapefile completo (.shp, .shx, .dbf, .prj).')
  }

  let parsed
  try {
    parsed = await shp(buffer)
  } catch {
    throw unprocessable('Nao foi possivel ler o shapefile. Verifique se o .zip contem .shp, .shx, .dbf e .prj validos.')
  }

  const features = collectFeatures(parsed)
    .map((f, i) => normalizeFeature(f, i))
    .filter(Boolean)

  if (!features.length) {
    throw unprocessable('Nenhum poligono valido foi encontrado no shapefile enviado.')
  }

  return {
    source_name: filename,
    count: features.length,
    candidates: features,
    default_index: 0,
  }
}
