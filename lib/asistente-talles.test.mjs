// node --test lib/asistente-talles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { aLaMarca, tablaDe, bloqueTalle, talleEnTexto } from './asistente-talles.mjs';

test('cada marca rotula en su escala', () => {
  assert.equal(tablaDe('Adidas').escala, 'US');
  assert.equal(tablaDe('PUMA').escala, 'UK');
  assert.equal(tablaDe('Head').escala, 'AR');
  assert.equal(tablaDe('Havaianas').escala, 'BR');
});

test('6 UK en Adidas hombre es US 6.5; en dama US 8', () => {
  assert.equal(aLaMarca('Adidas', 'HOMBRE', '6', 'UK').rotulo, '6.5');
  assert.equal(aLaMarca('Adidas', 'DAMA', '6', 'UK').rotulo, '7.5');
});

test('42 AR: Nike hombre US 8.5, Puma hombre UK 8, Head 42 tal cual', () => {
  assert.equal(aLaMarca('Nike', 'HOMBRE', '42', 'AR').rotulo, '8.5');
  assert.equal(aLaMarca('Puma', 'HOMBRE', '42', 'AR').rotulo, '8');
  assert.equal(aLaMarca('Head', 'HOMBRE', '42', 'AR').rotulo, '42');
});

test('la tabla de la casa: dama US 7-8 = AR 37-38.5, hombre US 8.5-9.5 = AR 41-42 (New Balance); Puma UK 4.5-5.5 y 8-9', () => {
  assert.equal(aLaMarca('New Balance', 'DAMA', '37', 'AR').rotulo, '6.5');
  assert.equal(aLaMarca('New Balance', 'DAMA', '38', 'AR').rotulo, '7.5');
  assert.equal(aLaMarca('New Balance', 'HOMBRE', '42', 'AR').rotulo, '8.5');
  assert.equal(aLaMarca('Puma', 'DAMA', '37.5', 'AR').rotulo, '4.5');
  assert.equal(aLaMarca('Puma', 'HOMBRE', '43', 'AR').rotulo, '9');
});

test('sin género prueba hombre y dama; sin escala toma el rótulo tal cual; fuera de tabla → null', () => {
  assert.equal(aLaMarca('Nike', '', '9.5', '').rotulo, '9.5');
  assert.equal(aLaMarca('Adidas', 'UNISEX', '27', 'CM').rotulo, '9');
  assert.equal(aLaMarca('Nike', 'HOMBRE', '60', 'AR'), null);
});

test('detecta el talle en la pregunta', () => {
  assert.deepEqual(talleEnTexto('response 2 en 6 uk'), { talle: '6', escala: 'UK' });
  assert.deepEqual(talleEnTexto('qué hay de dama en talle 37'), { talle: '37', escala: '' });
  assert.deepEqual(talleEnTexto('calzo 9.5 us'), { talle: '9.5', escala: 'US' });
  assert.equal(talleEnTexto('zapatilla para correr'), null);
});

test('el bloque para el prompt lista una línea por marca y avisa que el cm manda', () => {
  const b = bloqueTalle('42', 'AR', ['Nike', 'Puma', 'Head']);
  assert.match(b, /Nike \(rotula US\) · hombre US 8.5/);
  assert.match(b, /Puma \(rotula UK\) · hombre UK 8/);
  assert.match(b, /cm de la caja/);
});
