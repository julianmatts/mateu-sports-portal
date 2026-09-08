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
  fnSrc('eanDigits'), fnSrc('gtin13'), fnSrc('eanSuf'), fnSrc('eansDeCelda'),
  fnSrc('columnaEsEan'), fnSrc('colEanPorContenido'),
  fnSrc('parseUbicacionTexto'), fnSrc('detectarEncabezado'), fnSrc('detectarColumnasDatos'),
].join('\n');
const R = new Function(codigo +
  '\nreturn {eanDigits,gtin13,eansDeCelda,columnaEsEan,detectarEncabezado,detectarColumnasDatos};')();

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
