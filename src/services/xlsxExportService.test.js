import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx'

import { xlsxExportService } from './xlsxExportService.js'

test('xlsxExportService.aoaToXlsxBuffer creates readable workbook', () => {
  const aoa = [
    ['ID', 'Nome', 'Valor'],
    [1, 'A', 10.5],
    [2, 'B', 0],
  ]
  const buf = xlsxExportService.aoaToXlsxBuffer({ sheetName: 'Teste', aoa })
  assert.ok(buf && buf.length > 50)

  const wb = XLSX.read(buf, { type: 'buffer' })
  assert.equal(wb.SheetNames[0], 'Teste')

  const ws = wb.Sheets['Teste']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  assert.deepEqual(rows[0], aoa[0])
  assert.deepEqual(rows[1], aoa[1])
})
