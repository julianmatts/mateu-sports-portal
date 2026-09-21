// node --test lib/asistente-fichas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FICHAS, fichasPara } from './asistente-fichas.mjs';

const ids = t => fichasPara(Array.isArray(t) ? t : [t]).map(f => f.id);

test('detecta la disciplina por lo que pregunta el salón', () => {
  assert.deepEqual(ids('Un cliente busca paleta de pádel para principiante'), ['padel']);
  assert.deepEqual(ids('Zapatilla para empezar a correr'), ['running']);
  assert.deepEqual(ids('botines para cancha de sintetico'), ['futbol']);
  assert.deepEqual(ids('que palo de hockey le doy a una nena de 1,40'), ['hockey']);
  assert.deepEqual(ids('raqueta para un chico de 9 años'), ['tenis']);
  assert.deepEqual(ids('guantes de box para empezar'), ['box']);
  assert.deepEqual(ids('zapatillas para el gimnasio'), ['training']);
});

test('tenis de mesa no trae la ficha de tenis ni la de pádel', () => {
  assert.deepEqual(ids('paletas de tenis de mesa'), []);
});

test('talles entra como segunda ficha, o sola', () => {
  assert.deepEqual(ids('zapatilla para correr, que talle le doy si calza 42'), ['running', 'talles']);
  assert.deepEqual(ids('a cuanto equivale un 9 US'), ['talles']);
});

test('sin deporte no trae nada, y una repregunta hereda el tema anterior', () => {
  assert.deepEqual(ids('¿cómo venimos esta semana?'), []);
  assert.deepEqual(ids(['paleta de padel para principiante', 'y para la mujer?']), ['padel']);
});

test('a lo sumo dos fichas, la más nueva primero', () => {
  assert.deepEqual(ids(['botines de futbol', 'y algo de hockey y de rugby']).length, 2);
  assert.equal(ids(['botines de futbol', 'ahora palo de hockey'])[0], 'hockey');
});

test('las fichas no hablan de precios y el principiante de pádel va con balance bajo', () => {
  FICHAS.forEach(f => assert.ok(!/\$|precio|barat|econ[oó]mic/i.test(f.texto), f.id));
  const p = FICHAS.find(f => f.id === 'padel').texto;
  assert.match(p, /Principiante: redonda, balance bajo/);
});
