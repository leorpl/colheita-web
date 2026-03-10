import shp from 'shpjs'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { gpx as gpxToGeoJSON, kml as kmlToGeoJSON } from '@tmcw/togeojson'
import area from '@turf/area'

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
  const area_m2 = Number(area(feature) || 0)
  return {
    index,
    label: featureLabel(feature, index),
    properties: feature.properties || {},
    bounds,
    area_m2,
    area_ha: area_m2 > 0 ? area_m2 / 10000 : 0,
    feature: {
      type: 'Feature',
      properties: feature.properties || {},
      geometry: feature.geometry,
    },
  }
}

export function getGeometryAreaHa(feature) {
  if (!feature?.geometry || !isPolygonGeometry(feature.geometry)) return null
  const area_m2 = Number(area(feature) || 0)
  if (!Number.isFinite(area_m2) || area_m2 <= 0) return null
  return area_m2 / 10000
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

export function normalizeGeometryMatchText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toUpperCase()
}

function featureMatchCandidates(candidate) {
  const props = candidate?.properties || {}
  const keys = ['FIELD_NAME', 'field_name', 'NAME', 'name', 'NOME', 'nome', 'CODIGO', 'codigo', 'ID', 'id']
  const vals = [candidate?.label, ...keys.map((k) => props[k])]
    .map((v) => normalizeGeometryMatchText(v))
    .filter(Boolean)
  return Array.from(new Set(vals))
}

export function buildTalhaoGeometryBulkPreview({ talhoes, candidates, source_name }) {
  const talhaoList = Array.isArray(talhoes) ? talhoes : []
  const candList = Array.isArray(candidates) ? candidates : []
  const candidateInfo = candList.map((c) => ({
    ...c,
    _matches: featureMatchCandidates(c),
  }))

  const matched = []
  const unmatchedTalhoes = []
  const unmatchedPolygons = []
  const used = new Set()

  for (const t of talhaoList) {
    const code = normalizeGeometryMatchText(t?.codigo)
    if (!code) {
      unmatchedTalhoes.push({ id: t?.id, codigo: t?.codigo || '', nome: t?.nome || '', reason: 'Talhão sem código válido para comparação' })
      continue
    }
    const idx = candidateInfo.findIndex((c, i) => !used.has(i) && c._matches.includes(code))
    if (idx < 0) {
      unmatchedTalhoes.push({ id: t?.id, codigo: t?.codigo || '', nome: t?.nome || '', reason: 'Nenhum polígono com código correspondente' })
      continue
    }
    used.add(idx)
    const c = candidateInfo[idx]
    matched.push({
      talhao_id: t.id,
      talhao_codigo: t.codigo,
      talhao_nome: t.nome || '',
      candidate_index: c.index,
      candidate_label: c.label,
      area_ha: Number(c.area_ha || 0),
      geometry_geojson: c.feature,
      geometry_props_json: c.properties || {},
      geometry_source_name: source_name || null,
    })
  }

  candidateInfo.forEach((c, i) => {
    if (used.has(i)) return
    unmatchedPolygons.push({
      candidate_index: c.index,
      candidate_label: c.label,
      match_keys: c._matches,
    })
  })

  return {
    source_name: source_name || null,
    detected_count: candList.length,
    matched_count: matched.length,
    unmatched_talhoes: unmatchedTalhoes,
    unmatched_polygons: unmatchedPolygons,
    matched,
  }
}

function buildParsedResponse(features, filename) {
  const normalized = features
    .map((f, i) => normalizeFeature(f, i))
    .filter(Boolean)
  if (!normalized.length) {
    throw unprocessable('Nenhum poligono valido foi encontrado no arquivo enviado.')
  }
  return {
    source_name: filename,
    count: normalized.length,
    candidates: normalized,
    default_index: 0,
  }
}

async function parseZipShapefile(buffer, filename) {
  let parsed
  try {
    parsed = await shp(buffer)
  } catch {
    throw unprocessable('Nao foi possivel ler o shapefile. Verifique se o .zip contem .shp, .shx, .dbf e .prj validos.')
  }

  return buildParsedResponse(collectFeatures(parsed), filename)
}

function parseXmlGeoFile(text, kind, filename) {
  let doc
  try {
    doc = new DOMParser().parseFromString(text, 'text/xml')
  } catch {
    throw unprocessable(`Nao foi possivel ler o arquivo ${kind.toUpperCase()}.`)
  }
  const parsed = kind === 'gpx' ? gpxToGeoJSON(doc) : kmlToGeoJSON(doc)
  return buildParsedResponse(collectFeatures(parsed), filename)
}

async function parseKmz(buffer, filename) {
  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw unprocessable('Nao foi possivel ler o arquivo KMZ.')
  }
  const kmlEntry = Object.values(zip.files).find((f) => !f.dir && String(f.name || '').toLowerCase().endsWith('.kml'))
  if (!kmlEntry) throw unprocessable('O arquivo KMZ nao contem um KML valido.')
  const text = await kmlEntry.async('string')
  return parseXmlGeoFile(text, 'kml', filename)
}

function parseGeoJSONText(text, filename) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw unprocessable('Nao foi possivel ler o arquivo GeoJSON/JSON.')
  }
  return buildParsedResponse(collectFeatures(parsed), filename)
}

export async function parseTalhaoGeometryUpload(buffer, filename = 'arquivo.zip') {
  const name = String(filename || '').trim().toLowerCase()
  if (!name) throw unprocessable('Arquivo nao informado.')

  if (name.endsWith('.zip')) return parseZipShapefile(buffer, filename)
  if (name.endsWith('.kmz')) return parseKmz(buffer, filename)
  if (name.endsWith('.kml')) return parseXmlGeoFile(Buffer.from(buffer).toString('utf8'), 'kml', filename)
  if (name.endsWith('.gpx')) return parseXmlGeoFile(Buffer.from(buffer).toString('utf8'), 'gpx', filename)
  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    return parseGeoJSONText(Buffer.from(buffer).toString('utf8'), filename)
  }

  throw unprocessable('Formato nao suportado. Envie .zip (shapefile), .kml, .kmz, .gpx, .geojson ou .json.')
}

export async function parseTalhaoGeometryZip(buffer, filename = 'arquivo.zip') {
  return parseTalhaoGeometryUpload(buffer, filename)
}
