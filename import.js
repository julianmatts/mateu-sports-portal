/* ============================================================
 * import.js — Importación de Excel para Control de Recepciones.
 *
 * Self-contained, sin build. Se usa desde el navegador (cargado con
 * <script src="../import.js">, expone window.RecepImport) y también desde
 * Node para tests (module.exports). El parseo real de xlsx lo hace SheetJS:
 *   - navegador: se carga por CDN <script src=".../xlsx.full.min.js"> → window.XLSX
 *   - node:      npm i xlsx  →  require('xlsx')
 *
 * IDEA CLAVE — los formatos de Excel varían por marca. Cada marca tiene su
 * mapeo (MAPPINGS["<Marca>|pedido"]); los ingresos que exporta NUESTRO sistema
 * de stock tienen un formato fijo (MAPPINGS["ingreso"]). Un mapeo traduce el
 * Excel del proveedor a los CAMPOS CANÓNICOS que espera la API.
 *
 * Campos canónicos:
 *   cabecera:  nro, fecha, proveedor, marca, comprador?, pedido_nro?
 *   línea:     rubro, disciplina, tipo, cantidad, costo_unitario
 *
 * Estructura de un mapeo:
 *   {
 *     sheet:     'Hoja1' | 0,          // nombre o índice de hoja (default: primera)
 *     headerRow: 1,                    // fila (1-based) donde están los encabezados
 *     const:     { marca: 'Nike' },    // valores fijos que no vienen en el Excel
 *     fields:    { cantidad: 'Cant.', costo_unitario: 'Costo U$' , ... },
 *                                      // campo canónico -> encabezado REAL del Excel
 *     valueMap:  { tipo: { FTW:'Calzado', APP:'Indumentaria', ACC:'Accesorios' } },
 *                                      // traduce códigos del proveedor por campo
 *     defaults:  { disciplina: 'Sin disciplina' }  // si la celda viene vacía
 *   }
 *
 * ⚠️ Los encabezados reales de cada marca se completan cuando haya un Excel de
 * muestra por proveedor. Las plantillas de abajo están marcadas TODO con
 * placeholders — NO son definitivas.
 * ============================================================ */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;   // node
  if (typeof window !== 'undefined') window.RecepImport = mod;                 // browser
})(this, function () {
  'use strict';

  /* ---------- SheetJS resuelto según entorno ---------- */
  function getXLSX() {
    if (typeof window !== 'undefined' && window.XLSX) return window.XLSX;
    if (typeof require !== 'undefined') {
      try { return require('xlsx'); } catch (e) { /* fallthrough */ }
    }
    throw new Error('Falta SheetJS (XLSX). En el navegador cargá el <script> de xlsx por CDN; en node: npm i xlsx.');
  }

  /* ============================================================
   * MAPEOS
   * ============================================================ */

  // Ingreso: formato FIJO del Excel que exporta nuestro sistema de stock.
  // TODO: confirmar encabezados reales con un export de muestra del sistema.
  var INGRESO_MAPPING = {
    _pendiente: true,           // marcá false cuando estén confirmados los headers
    sheet: 0,
    headerRow: 1,
    const: {},
    fields: {
      // cabecera
      nro:        'TODO_NRO_REMITO',       // p.ej. 'Remito' / 'Comprobante'
      fecha:      'TODO_FECHA',            // p.ej. 'Fecha'
      proveedor:  'TODO_PROVEEDOR',        // p.ej. 'Proveedor'
      marca:      'TODO_MARCA',            // p.ej. 'Marca'
      pedido_nro: 'TODO_OC',              // p.ej. 'OC' / 'Orden de Compra' (opcional)
      // línea
      rubro:          'TODO_RUBRO',        // p.ej. 'Rubro'
      disciplina:     'TODO_DISCIPLINA',   // p.ej. 'Disciplina' / 'Deporte'
      tipo:           'TODO_TIPO',         // p.ej. 'Tipo' / 'Segmento'
      cantidad:       'TODO_CANTIDAD',     // p.ej. 'Cantidad' / 'Unidades'
      costo_unitario: 'TODO_COSTO'         // p.ej. 'Costo' / 'Precio Unit.'
    },
    valueMap: {
      // Nuestro sistema suele codificar el tipo de producto; traducir acá.
      tipo: { FTW: 'Calzado', APP: 'Indumentaria', ACC: 'Accesorios' }
    },
    defaults: { disciplina: '', tipo: '', rubro: '' }
  };

  // Plantilla base reutilizable para pedidos por marca (placeholders TODO).
  function pedidoTemplate(marca) {
    return {
      _pendiente: true,         // marcá false cuando estén confirmados los headers de esta marca
      sheet: 0,
      headerRow: 1,
      const: { marca: marca },
      fields: {
        // cabecera
        nro:       'TODO_NRO_OC',          // nº de OC del proveedor
        fecha:     'TODO_FECHA',
        proveedor: 'TODO_PROVEEDOR',
        comprador: 'TODO_COMPRADOR',       // opcional
        // línea
        rubro:          'TODO_RUBRO',
        disciplina:     'TODO_DISCIPLINA',
        tipo:           'TODO_TIPO',
        cantidad:       'TODO_CANTIDAD',
        costo_unitario: 'TODO_COSTO_UNITARIO'
      },
      // Cada proveedor codifica distinto: FTW/APP/ACC, MENS/WMNS, etc.
      valueMap: {
        tipo: { FTW: 'Calzado', APP: 'Indumentaria', ACC: 'Accesorios' }
      },
      defaults: { disciplina: '', tipo: '', rubro: '' }
    };
  }

  // Registro. Clave de pedido: "<Marca>|pedido". Clave de ingreso: "ingreso".
  // TODO: completar headers reales por marca a medida que llega un Excel muestra.
  var MAPPINGS = {
    'ingreso':        INGRESO_MAPPING,
    'Nike|pedido':    pedidoTemplate('Nike'),
    'adidas|pedido':  pedidoTemplate('adidas'),
    'Puma|pedido':    pedidoTemplate('Puma'),
    'Topper|pedido':  pedidoTemplate('Topper')
  };

  function mappingKey(marca, tipoDoc) {
    return tipoDoc === 'ingreso' ? 'ingreso' : (marca + '|pedido');
  }
  function getMapping(marca, tipoDoc) {
    return MAPPINGS[mappingKey(marca, tipoDoc)] || null;
  }
  function registerMapping(marca, tipoDoc, config) {
    MAPPINGS[mappingKey(marca, tipoDoc)] = config;
    return config;
  }
  function listMappings() {
    return Object.keys(MAPPINGS).map(function (k) {
      var parts = k.split('|');
      return {
        key: k,
        marca: parts.length > 1 ? parts[0] : '',
        tipo_doc: parts.length > 1 ? 'pedido' : 'ingreso',
        pendiente: !!MAPPINGS[k]._pendiente
      };
    });
  }

  /* ============================================================
   * HELPERS — Excel argentino (coma decimal, fechas dd/mm/aaaa)
   * ============================================================ */

  // Número con coma decimal y separador de miles con punto (formato AR).
  //  "1.234,50" -> 1234.5 · "$2.000" -> 2000 · "2,5" -> 2.5 · "2.5" -> 2.5
  function parseNumAr(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    var s = String(v).trim().replace(/[^\d.,\-]/g, '');   // saca $, espacios, letras
    if (s === '' || s === '-') return 0;
    var hasComma = s.indexOf(',') > -1, hasDot = s.indexOf('.') > -1;
    if (hasComma && hasDot) {
      // el separador más a la derecha es el decimal; el otro es de miles
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = s.replace(',', '.');                             // coma = decimal
    } else if (hasDot) {
      // punto solo: si son grupos de 3 (miles) → entero; si no, es decimal real
      if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // Fecha a ISO 'YYYY-MM-DD'. Acepta 'dd/mm/aaaa', 'dd-mm-aaaa',
  // serial de Excel (número) o Date.
  function parseDateAr(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return isoFromParts(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number' && isFinite(v)) {
      // serial de Excel (base 1899-12-30)
      var ms = Math.round((v - 25569) * 86400 * 1000);
      var d = new Date(ms);
      return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      var dd = +m[1], mm = +m[2], yy = +m[3];
      if (yy < 100) yy += 2000;
      return isoFromParts(yy, mm, dd);
    }
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);  // ya viene ISO-ish
    if (m) return isoFromParts(+m[1], +m[2], +m[3]);
    return s; // último recurso: dejarlo como está
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoFromParts(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

  /* ============================================================
   * PARSEO
   * ============================================================ */

  // Devuelve { rows: [{header:value,...}], headers: [...] } de la hoja indicada.
  function parseWorkbook(arrayBuffer, mapping) {
    var XLSX = getXLSX();
    var wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    var sheetName;
    if (typeof mapping.sheet === 'number') sheetName = wb.SheetNames[mapping.sheet];
    else if (mapping.sheet) sheetName = mapping.sheet;
    else sheetName = wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    if (!ws) throw new Error('No se encontró la hoja "' + mapping.sheet + '" en el archivo.');

    var headerRow = mapping.headerRow || 1;
    // Leemos como matriz para respetar headerRow, luego armamos objetos por header.
    var matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!matrix.length) return { rows: [], headers: [] };
    var headers = (matrix[headerRow - 1] || []).map(function (h) { return String(h).trim(); });
    var rows = [];
    for (var i = headerRow; i < matrix.length; i++) {
      var arr = matrix[i];
      if (!arr || !arr.length) continue;
      var allEmpty = arr.every(function (c) { return c === '' || c === null || c === undefined; });
      if (allEmpty) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = arr[c];
      rows.push(obj);
    }
    return { rows: rows, headers: headers };
  }

  // Normaliza filas crudas a campos canónicos según el mapeo.
  // Devuelve { lineas: [...], warnings: [...] }. Cada línea trae cabecera + línea
  // mezcladas (se separan en groupDocs).
  function normalizeRows(rows, mapping) {
    var fields = mapping.fields || {};
    var konst = mapping['const'] || {};
    var valueMap = mapping.valueMap || {};
    var defaults = mapping.defaults || {};
    var warnings = [];
    var missingHeaders = {};

    var lineas = rows.map(function (row, idx) {
      var out = {};
      // valores fijos primero
      Object.keys(konst).forEach(function (k) { out[k] = konst[k]; });
      // mapear cada campo canónico desde su header real
      Object.keys(fields).forEach(function (canon) {
        var header = fields[canon];
        var raw = row.hasOwnProperty(header) ? row[header] : undefined;
        if (raw === undefined && !isPlaceholder(header)) missingHeaders[header] = true;
        var val = (raw === undefined || raw === '') && defaults.hasOwnProperty(canon) ? defaults[canon] : raw;
        // traducción de códigos
        if (valueMap[canon] && val != null && valueMap[canon].hasOwnProperty(String(val).trim())) {
          val = valueMap[canon][String(val).trim()];
        }
        out[canon] = val;
      });
      // tipados canónicos
      out.cantidad = parseNumAr(out.cantidad);
      out.costo_unitario = parseNumAr(out.costo_unitario);
      out.fecha = parseDateAr(out.fecha);
      ['nro', 'proveedor', 'marca', 'comprador', 'pedido_nro', 'rubro', 'disciplina', 'tipo'].forEach(function (k) {
        if (out[k] != null) out[k] = String(out[k]).trim();
      });
      out._fila = idx + 1;
      return out;
    });

    var missing = Object.keys(missingHeaders);
    if (missing.length) {
      warnings.push('Encabezados no encontrados en el Excel: ' + missing.join(', ') +
        '. Revisá el mapeo (headerRow / nombres de columna).');
    }
    if (mapping._pendiente) {
      warnings.push('El mapeo de esta marca/tipo está marcado como PENDIENTE (headers placeholder). ' +
        'Ajustá los encabezados antes de confirmar.');
    }
    return { lineas: lineas, warnings: warnings };
  }
  function isPlaceholder(h) { return /^TODO_/.test(String(h || '')); }

  // Agrupa líneas normalizadas en documentos por `nro` de cabecera.
  // Devuelve [{ nro, fecha, proveedor, marca, comprador?, pedido_nro?, moneda?, lineas:[...] }]
  function groupDocs(lineas, opts) {
    opts = opts || {};
    var byNro = {};
    var order = [];
    lineas.forEach(function (l) {
      var nro = l.nro || '(sin-nro)';
      if (!byNro[nro]) {
        byNro[nro] = {
          nro: nro,
          fecha: l.fecha || '',
          proveedor: l.proveedor || '',
          marca: l.marca || '',
          comprador: l.comprador || '',
          pedido_nro: l.pedido_nro || '',
          moneda: l.moneda || opts.moneda || 'ARS',
          lineas: []
        };
        order.push(nro);
      }
      byNro[nro].lineas.push({
        rubro: l.rubro || '',
        disciplina: l.disciplina || '',
        tipo: l.tipo || '',
        cantidad: l.cantidad || 0,
        costo_unitario: l.costo_unitario || 0
      });
    });
    return order.map(function (n) { return byNro[n]; });
  }

  // Atajo: archivo → documentos listos para postear. Devuelve { docs, warnings }.
  function importFile(arrayBuffer, mapping, opts) {
    var parsed = parseWorkbook(arrayBuffer, mapping);
    var norm = normalizeRows(parsed.rows, mapping);
    var docs = groupDocs(norm.lineas, opts);
    return { docs: docs, warnings: norm.warnings, headers: parsed.headers };
  }

  return {
    MAPPINGS: MAPPINGS,
    getMapping: getMapping,
    registerMapping: registerMapping,
    listMappings: listMappings,
    mappingKey: mappingKey,
    pedidoTemplate: pedidoTemplate,
    parseWorkbook: parseWorkbook,
    normalizeRows: normalizeRows,
    groupDocs: groupDocs,
    importFile: importFile,
    parseNumAr: parseNumAr,
    parseDateAr: parseDateAr
  };
});
