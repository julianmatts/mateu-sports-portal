/* Tests de la lectura de códigos de barras (EAN/UPC) del Buscador de Artículos.
   Correr con:  node --test lib/ean.test.js

   Las funciones NO viven acá: se extraen del propio ubicaciones/index.html
   (mismo patrón que lib/reparto.test.js) para que el test pruebe el código real.
   Cubre lo que decide si una carga de stock "toma bien" los EAN:
   - eanDigits / gtin13 / eansDeCelda  (la celda del Excel, con sus mañas)
   - columnaEsEan                      (¿la columna trae EAN o es el SKU?)
   - detectarEncabezado                (export con encabezados)
   - detectarColumnasDatos             (export pelado, sin encabezados)
*/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'ubicaciones', 'index.html'), 'utf8');

function fnSrc(name){
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'no encontré function ' + name + ' en ubicaciones/index.html');
  const b = src.indexOf('{', i);
  let depth = 1, j = b + 1;
  while (depth > 0 && j < src.length){
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    j++;
  }
  return src.slice(i, j);
}
function rxSrc(name){
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(/.*/[a-z]*);'));
  assert.ok(m, 'no encontré const ' + name);
  return 'const ' + name + '=' + m[1] + ';';
}

const codigo = [
  rxSrc('RX_COD'), rxSrc('RX_DESC'), rxSrc('RX_STK'), rxSrc('RX_UBI'), rxSrc('RX_TALLE'), rxSrc('RX_EAN'),
  fnSrc('eanDigits'), fnSrc('gtin13'), fnSrc('eanSuf'), fnSrc('eansDeCelda'), fnSrc('mismoEan'),
  rxSrc('RX_COD_BASURA'), fnSrc('eanCodigoBasura'),
  fnSrc('columnaEsEan'), fnSrc('colEanPorContenido'), fnSrc('colTallePorContenido'),
  fnSrc('esNA'), fnSrc('valsDeCol'), fnSrc('nColsDe'), fnSrc('colUbiPorContenido'),
  fnSrc('colDescPorContenido'), fnSrc('columnaEsIdItem'), fnSrc('colCodMarcaPorContenido'),
  fnSrc('parseUbicacionTexto'), fnSrc('detectarEncabezado'), fnSrc('detectarColumnasDatos'),
].join('\n');
const R = new Function(codigo + rxSrc('RX_VAL_TALLE') +
  '\nreturn {eanDigits,gtin13,eansDeCelda,mismoEan,eanCodigoBasura,columnaEsEan,detectarEncabezado,detectarColumnasDatos};')();

test('eanDigits: la celda del Excel llega de muchas formas', () => {
  assert.equal(R.eanDigits('7791234567890'), '7791234567890');   // texto
  assert.equal(R.eanDigits(7791234567890), '7791234567890');     // número
  assert.equal(R.eanDigits('7791234567890.0'), '7791234567890'); // decimal de más
  assert.equal(R.eanDigits('779 1234-567890'), '7791234567890'); // espacios y guiones
  assert.equal(R.eanDigits('7.791234567890E+12'), '7791234567890'); // científica completa
  assert.equal(R.eanDigits('7,7912E+12'), '');   // científica RECORTADA: no se inventa el EAN
  assert.equal(R.eanDigits('UA-1234'), '');
  assert.equal(R.gtin13('012345678905'), '0012345678905'); // UPC-A de 12 → EAN-13
});

test('eansDeCelda: una celda puede traer más de un código', () => {
  assert.deepEqual(R.eansDeCelda('7791234567890 / 7791234567906'), ['7791234567890', '7791234567906']);
  assert.deepEqual(R.eansDeCelda('7791234567890'), ['7791234567890']);
  assert.deepEqual(R.eansDeCelda('ABC123'), []);
});

const DRIVE = [
  ['Id.item', 'Código de barras', 'Artículo', 'Stock'],
  [104585, 'UA-1234', 'REMERA VANISH', 4],
  [104586, 'UA-1235', 'CALZA VANISH', 2],
  [104587, 'AD-9', 'ZAPATILLA DURAMO', 7],
];

test('detectarEncabezado: export con columna propia de código de barras', () => {
  const rows = [
    ['Código', 'Descripción', 'Talle', 'Código de barras', 'Stock'],
    ['UA-1234', 'Remera Vanish', 'M', '7791234567890', 3],
    ['UA-1234', 'Remera Vanish', 'L', 7791234567906, 1],
    ['AD-9', 'Zapatilla Duramo', '40', '7799999999999', 2],
  ];
  const d = R.detectarEncabezado(rows);
  assert.deepEqual([d.fila, d.iCod, d.iDesc, d.iTalle, d.iEan, d.iStk], [0, 0, 1, 2, 3, 4]);
});

test('detectarEncabezado: la hoja de Drive llama «Código de barras» al SKU → no es EAN', () => {
  const d = R.detectarEncabezado(DRIVE);
  assert.equal(d.iCod, 1);
  assert.equal(d.iEan, -1);
  assert.equal(R.columnaEsEan(DRIVE, 0, 1), false);
});

test('detectarEncabezado: reporte que identifica los artículos por EAN', () => {
  const rows = [
    ['Código de barras', 'Descripción', 'Stock'],
    ['7791234567890', 'Remera Vanish M', 3],
    ['7791234567906', 'Remera Vanish L', 1],
    ['7799999999999', 'Zapatilla Duramo 40', 2],
  ];
  const d = R.detectarEncabezado(rows);
  assert.deepEqual([d.iCod, d.iEan, d.iStk], [0, 0, 2]);   // el código ES el EAN: el modal ofrece resolverlos
  assert.equal(R.columnaEsEan(rows, 0, 0), true);
});

test('detectarColumnasDatos: sin encabezados, el EAN se reconoce por sus dígitos', () => {
  const rows = [
    [104585, 'UA-1234', 'REMERA VANISH TALLE M', '7791234567890', 3],
    [104586, 'UA-1235', 'CALZA VANISH TALLE L', '7791234567906', 1],
    [104587, 'AD-9', 'ZAPATILLA DURAMO 40', '7799999999999', 2],
    [104588, 'AD-10', 'ZAPATILLA RUNFALCON 41', '7799999999982', 5],
    [104589, 'AD-11', 'CAMPERA TIRO ESSENTIALS', '7799999999975', 8],
  ];
  const d = R.detectarColumnasDatos(rows);
  assert.deepEqual([d.iCod, d.iDesc, d.iEan, d.iStk, d.iArt], [1, 2, 3, 4, 0]);
});

/* La planilla de ubicaciones que la sucursal lleva en Drive (modelo de Berisso):
   una fila por artículo, encabezado SOLO en algunas columnas («Articulo» es el
   Id.item, no el código) y la ubicación cargada en pocas filas. */
test('detectarEncabezado: planilla de la sucursal (código sin rótulo, «Articulo» = Id.item)', () => {
  const rows = [
    ['', 'Articulo', '', 'STOCK', 'UBICACIÓN'],
    ['HAV70970001', 66655, 'OJOTA BRASIL BLANCO', '5,00', ''],
    ['TOP21871', 75487, 'X FORCER BCO/AZUL/ROJO', '9,00', 'E20-M26'],
    ['PRO323', 80869, 'VENDA COLOR LONG.10 CM', 1, ''],
    ['LEJ356', 81403, 'PALETA P.PONG DOLVOR', 1, ''],
    ['CON157002C', '', '', '', 'E23-M25'],   // sin Id.item: igual tiene que entrar
    ['ADIJD1874', 220027, 'BUZO 3S FT HD C/CAP', 1, 'E2-M19'],
    ['NIKSX4120401', 116769, 'MEDIAS CLASSIC', 1, ''],
    ['CRC10001C410', 106326, 'CROCS CLASSIC', '10,00', 'E13-M8'],
  ];
  const d = R.detectarEncabezado(rows);
  assert.equal(d.fila, 0);
  assert.deepEqual([d.iCod, d.iArt, d.iDesc, d.iStk, d.iUbi], [0, 1, 2, 3, 4]);
});

test('detectarEncabezado: el #N/A del BUSCARV no desarma la columna de Id.item', () => {
  const rows = [
    ['-', 'ARTICULO', 'DESCRIPCION', 'STOCK', 'UBICACION'],
    ['ALARMAS', 159550, 'ALARMAS', 3659, ''],
    ['PERCHAS', 129961, 'PERCHAS MATEU', 2582, 'E1-M1'],
    ['ADIJM5900', '#N/A', 'CAMPERA TIRO', 4, 'E2-M3'],
    ['NIKDH2987', '#N/A', 'COURT VISION LOW', 2, ''],
    ['PUM31273108', 224580, 'CARINA MIA', 6, 'E5-M11'],
    ['MED25', 160743, 'BIPACK MEDIA TENIS BCO', 12, ''],
    ['CON157196C', 140816, 'CHUCK TAYLOR', 3, 'E23-M26'],
  ];
  const d = R.detectarEncabezado(rows);
  assert.deepEqual([d.iCod, d.iArt, d.iDesc, d.iStk, d.iUbi], [0, 1, 2, 3, 4]);
});

test('detectarColumnasDatos: la ubicación de pocas filas también se reconoce', () => {
  const rows = [
    ['HAV70970001', 66655, 'OJOTA BRASIL BLANCO', 5, ''],
    ['TOP21871', 75487, 'X FORCER BCO/AZUL/ROJO', 9, 'E20-M26'],
    ['PRO323', 80869, 'VENDA COLOR LONG.10 CM', 1, ''],
    ['LEJ356', 81403, 'PALETA P.PONG DOLVOR', 1, ''],
    ['LEJ43', 81531, 'INFLADOR DE PIE', 2, ''],
    ['ATL114', 83247, 'PROTECTOR BUCAL', 1, ''],
    ['MIR1010', 88676, 'COLCHONETA MAT', 1, 'EST 3 - MOD 37'],
    ['HEA60030', 94926, 'MUÑEQUERA LARGA', 4, 'E13-M8'],
  ];
  const d = R.detectarColumnasDatos(rows);
  assert.deepEqual([d.iCod, d.iArt, d.iDesc, d.iStk, d.iUbi], [0, 1, 2, 3, 4]);
});

test('detectarColumnasDatos: sin filas repetidas no hay talle (el stock no se confunde)', () => {
  const rows = [
    ['ALARMAS', 159550, 'ALARMAS', 36],
    ['PERCHAS', 129961, 'PERCHAS MATEU', 25],
    ['CUPON15', 224580, 'CUPON DE DESCUENTO 15%OFF', 33],
    ['MED25', 160743, 'BIPACK MEDIA TENIS BCO', 24],
    ['ADIJD1874', 220027, 'BUZO 3S FT HD C/CAP', 41],
    ['NIKSX4120401', 116769, 'MEDIAS CLASSIC NEGRO', 38],
  ];
  const d = R.detectarColumnasDatos(rows);
  assert.deepEqual([d.iCod, d.iArt, d.iDesc, d.iStk, d.iTalle], [0, 1, 2, 3, -1]);
});

/* Berisso, 23/09/2026: el export «stock diario» del sistema trae DOS columnas que
   suenan a código de barras — «Código barras» (que es el SKU de la marca) y
   «Código EAN» (el EAN real) — y, ordenado por código, las primeras marcas traen
   en esa columna la etiqueta del proveedor con el talle pegado, no un número.
   La carga de ese día quedó sin ningún EAN por eso. */
test('detectarEncabezado: «Código barras» = SKU y «Código EAN» = EAN, con etiquetas de proveedor al principio', () => {
  const rows = [['Código barras','Id.item','Artículo','Código EAN','Talle','Stock']];
  // primero 150 filas de Addnice con la etiqueta del proveedor (no es EAN)
  for (let i = 0; i < 150; i++) rows.push(['ADDADUC1890'+i, String(232000+i), 'NAPOLI TF '+i, 'ADUC18903A29!03!'+(30+(i%9)), String(30+(i%9)), 1]);
  // después 400 filas de Adidas/Nike con EAN de verdad
  for (let i = 0; i < 400; i++) rows.push([i%2 ? 'ADIF35539' : 'NIKAC3444001', '169314', 'CHINELA '+i, i%2 ? String(4060509397311+i) : String(885178184512+i), String(35+(i%8)), 2]);
  const d = R.detectarEncabezado(rows);
  assert.ok(d, 'tiene que detectar el encabezado');
  assert.equal(d.iCod, 0, 'el código es «Código barras» (el SKU)');
  assert.equal(d.iEan, 3, 'el EAN es «Código EAN», no «Código barras»');
  assert.equal(d.iArt, 1);
  assert.equal(d.iTalle, 4);
  assert.equal(d.iStk, 5);
  // muestreo de toda la columna: las primeras 150 filas no la descartan
  assert.equal(R.columnaEsEan(rows, 0, 3), true);
  assert.equal(R.columnaEsEan(rows, 0, 0), false, 'el SKU no es EAN');
});

test('mismoEan: tolera la lectora que recorta el primer dígito, también de un EAN-13', () => {
  assert.equal(R.mismoEan('4060509397311', '4060509397311'), true);
  assert.equal(R.mismoEan('4060509397311', '060509397311'), true);   // EAN-13 leído con 12 dígitos
  assert.equal(R.mismoEan('4060509397311', '60509397311'), true);    // con 11
  assert.equal(R.mismoEan('0885178184512', '885178184512'), true);   // UPC-A guardado como EAN-13
  assert.equal(R.mismoEan('4060509397311', '4060509397328'), false); // otro talle
  assert.equal(R.mismoEan('4060509397311', '5060509397311'), false); // dos EAN-13 completos distintos
  assert.equal(R.mismoEan('4060509397311', 'ADIF35539'), false);
});

test('eanCodigoBasura: el género o el subrubro no son un artículo', () => {
  for (const c of ['02-HOMBRE', '03-DAMA', '06-UNISEX', 'VARIOS', 'UNISEX', 'Niño', '', ' ', 'CALZADO']) assert.equal(R.eanCodigoBasura(c), true, c);
  for (const c of ['NIKAC3444001', 'ADIF35539', '47S2511470278106', 'CLZCOGR', '330-380S']) assert.equal(R.eanCodigoBasura(c), false, c);
});
