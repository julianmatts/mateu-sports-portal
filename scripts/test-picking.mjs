/* ============================================================================
   Test de regresión del dato crítico del Picking.
   Corre con:  node --test scripts/test-picking.mjs
   Sin dependencias de npm (solo node:test + node:assert + node:fs).

   Protege lo que rompe silenciosamente el scan si se desincroniza:
   1) el maestro EAN de Adidas (recepciones/maestro-adidas.json) mantiene su
      estructura ({ean:{EAN:"MATERIAL\tSIZE"}, desc:{MATERIAL:desc}, n});
   2) la regla de resolución EAN de una variante que usa picking/ (código de
      barrida = "ADI"+material; talle exacto, o calzado decimal N.5 → grilla "N-").
   Si el maestro se regenera con otro formato o la regla cambia, este test avisa.
   ============================================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAESTRO_PATH = path.join(__dirname, '..', 'recepciones', 'maestro-adidas.json');

// ---- misma lógica que picking/index.html (mantener en sintonía) ----
function mapTalleCalzado(t){ t = String(t || ''); return /^\d+\.5$/.test(t) ? t.slice(0, -2) + '-' : t; }
function crearResolver(maestro){
  const sku2ean = {};
  for(const ean in maestro.ean){ sku2ean[maestro.ean[ean].replace('\t', '')] = ean; }
  return function(codigo, talle){
    const c = String(codigo || ''); if(!/^ADI/i.test(c)) return '';
    const material = c.slice(3), t = String(talle || '');
    return sku2ean[material + t] || sku2ean[material + mapTalleCalzado(t)] || '';
  };
}

// ---- fixtures (SKUs reales validados a mano contra los remitos/barrida) ----
const APPAREL = [ ['ADIKY5654','L','4067907129650'], ['ADIKY5654','M','4067907129582'], ['ADIKY5654','S','4067907129643'] ];
const CALZADO = [ ['ADIB75806','5','4059809047125'], ['ADIB75806','5.5','4059809047156'], ['ADIB75806','11.5','4059809047163'] ];

test('mapTalleCalzado: N.5 → N-, enteros iguales', () => {
  assert.equal(mapTalleCalzado('5'), '5');
  assert.equal(mapTalleCalzado('5.5'), '5-');
  assert.equal(mapTalleCalzado('6.5'), '6-');
  assert.equal(mapTalleCalzado('11.5'), '11-');
  assert.equal(mapTalleCalzado('XL'), 'XL');
});

test('el maestro existe y mantiene su estructura', () => {
  assert.ok(fs.existsSync(MAESTRO_PATH), 'falta recepciones/maestro-adidas.json — regeneralo con scripts/gen-maestro-adidas.js');
  const M = JSON.parse(fs.readFileSync(MAESTRO_PATH, 'utf8'));
  assert.equal(M.marca, 'ADIDAS');
  assert.ok(M.ean && typeof M.ean === 'object', 'falta el mapa ean');
  assert.ok(M.desc && typeof M.desc === 'object', 'falta el mapa desc');
  const nEan = Object.keys(M.ean).length;
  assert.ok(nEan > 100000, 'el maestro tiene sospechosamente pocos EAN: ' + nEan);
  assert.equal(nEan, M.n, 'M.n no coincide con la cantidad real de EAN');
  // el valor es "MATERIAL\tSIZE"
  const algun = M.ean[Object.keys(M.ean)[0]];
  assert.ok(algun.indexOf('\t') > 0, 'el valor del maestro debe ser MATERIAL\\tSIZE');
});

test('resuelve el EAN de variantes de indumentaria (talle exacto)', () => {
  const M = JSON.parse(fs.readFileSync(MAESTRO_PATH, 'utf8'));
  const ean = crearResolver(M);
  for(const [cod, talle, esperado] of APPAREL){
    assert.equal(ean(cod, talle), esperado, cod + ' T' + talle);
  }
});

test('resuelve el EAN de calzado (talle decimal → grilla)', () => {
  const M = JSON.parse(fs.readFileSync(MAESTRO_PATH, 'utf8'));
  const ean = crearResolver(M);
  for(const [cod, talle, esperado] of CALZADO){
    assert.equal(ean(cod, talle), esperado, cod + ' T' + talle);
  }
});

test('no resuelve marcas que no son Adidas (sin "ADI")', () => {
  const M = JSON.parse(fs.readFileSync(MAESTRO_PATH, 'utf8'));
  const ean = crearResolver(M);
  assert.equal(ean('NIKE123', '40'), '');   // otras marcas → sin EAN horneado (control manual)
  assert.equal(ean('KY5654', 'L'), '');       // sin prefijo ADI tampoco
});
