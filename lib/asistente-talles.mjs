/* ============================================================
   Equivalencias de talles de calzado por marca — para Matts (23/09/2026)
   ------------------------------------------------------------
   Cada marca rotula en una escala distinta y Matts tenía prohibido convertir de
   memoria («confirmá con la etiqueta»). Acá va la tabla de cada marca tal como
   ROTULA en el stock de Mateu (verificado el 23/09/2026 contra los talles cargados
   en el Buscador de las 8 sucursales: Adidas, Nike, New Balance, Asics, ON, Salomon,
   Skechers, Under Armour, Vans, Converse y Crocs rotulan US; Puma rotula UK; Head,
   Atomik, Fila, Le Coq Sportif, Montagne, Topper, Umbro, Timberland, 47 Street,
   Olympikus, Kappa, Penalty y Quiksilver rotulan en número AR/EU; Havaianas, Rider,
   Bagunza y Hang Loose en BR, con talles dobles «35/36»).

   Fila = [rótulo de la marca, AR/EU, US, UK, cm]. AR = el número que usa la gente
   acá (coincide con el EU de la caja). Las filas salen de las tablas oficiales de
   cada marca y del criterio de la casa (tabla US Men / US Women / AR de New
   Balance que Juli aplicó a todas el 15/09/2026: dama US 7·7.5·8 = AR 37–38.5,
   hombre US 8.5·9·9.5 = AR 41–42; Puma UK dama 4.5·5·5.5 y hombre 8·8.5·9).
   ⚠ Las escribió Claude sin validar con la gente de la casa: si una marca calza
   distinto, se corrige acá. El cm de la caja es siempre la medida que no engaña.
   Test: node --test lib/asistente-talles.test.mjs
   ============================================================ */

// [rótulo, AR/EU, US, UK, cm]
const NB_HOMBRE = [['6', 38.5, 6, 5.5, 24], ['6.5', 39.5, 6.5, 6, 24.5], ['7', 40, 7, 6.5, 25], ['7.5', 40.5, 7.5, 7, 25.5], ['8', 41.5, 8, 7.5, 26], ['8.5', 42, 8.5, 8, 26.5], ['9', 42.5, 9, 8.5, 27], ['9.5', 43, 9.5, 9, 27.5], ['10', 44, 10, 9.5, 28], ['10.5', 44.5, 10.5, 10, 28.5], ['11', 45, 11, 10.5, 29], ['11.5', 45.5, 11.5, 11, 29.5], ['12', 46.5, 12, 11.5, 30], ['13', 47.5, 13, 12.5, 31]];
const NB_DAMA = [['5', 35.5, 5, 3, 22], ['5.5', 36, 5.5, 3.5, 22.5], ['6', 36.5, 6, 4, 23], ['6.5', 37, 6.5, 4.5, 23.5], ['7', 37.5, 7, 5, 24], ['7.5', 38, 7.5, 5.5, 24.5], ['8', 39, 8, 6, 25], ['8.5', 39.5, 8.5, 6.5, 25.5], ['9', 40.5, 9, 7, 26], ['9.5', 41, 9.5, 7.5, 26.5], ['10', 41.5, 10, 8, 27], ['10.5', 42, 10.5, 8.5, 27.5]];
const NIKE_HOMBRE = [['6', 38.5, 6, 5.5, 24], ['6.5', 39, 6.5, 6, 24.5], ['7', 40, 7, 6, 25], ['7.5', 40.5, 7.5, 6.5, 25.5], ['8', 41, 8, 7, 26], ['8.5', 42, 8.5, 7.5, 26.5], ['9', 42.5, 9, 8, 27], ['9.5', 43, 9.5, 8.5, 27.5], ['10', 44, 10, 9, 28], ['10.5', 44.5, 10.5, 9.5, 28.5], ['11', 45, 11, 10, 29], ['11.5', 45.5, 11.5, 10.5, 29.5], ['12', 46, 12, 11, 30], ['13', 47.5, 13, 12, 31]];
const NIKE_DAMA = [['5', 35.5, 5, 2.5, 22], ['5.5', 36, 5.5, 3, 22.5], ['6', 36.5, 6, 3.5, 23], ['6.5', 37.5, 6.5, 4, 23.5], ['7', 38, 7, 4.5, 24], ['7.5', 38.5, 7.5, 5, 24.5], ['8', 39, 8, 5.5, 25], ['8.5', 40, 8.5, 6, 25.5], ['9', 40.5, 9, 6.5, 26], ['9.5', 41, 9.5, 7, 26.5], ['10', 42, 10, 7.5, 27], ['10.5', 42.5, 10.5, 8, 27.5]];
const ADI_HOMBRE = [['6', 38.7, 6, 5.5, 24], ['6.5', 39.3, 6.5, 6, 24.5], ['7', 40, 7, 6.5, 25], ['7.5', 40.7, 7.5, 7, 25.5], ['8', 41.3, 8, 7.5, 26], ['8.5', 42, 8.5, 8, 26.5], ['9', 42.7, 9, 8.5, 27], ['9.5', 43.3, 9.5, 9, 27.5], ['10', 44, 10, 9.5, 28], ['10.5', 44.7, 10.5, 10, 28.5], ['11', 45.3, 11, 10.5, 29], ['11.5', 46, 11.5, 11, 29.5], ['12', 46.7, 12, 11.5, 30], ['13', 48, 13, 12.5, 31]];
const ADI_DAMA = [['5', 36, 5, 3.5, 22], ['5.5', 36.7, 5.5, 4, 22.5], ['6', 37.3, 6, 4.5, 23], ['6.5', 38, 6.5, 5, 23.5], ['7', 38.7, 7, 5.5, 24], ['7.5', 39.3, 7.5, 6, 24.5], ['8', 40, 8, 6.5, 25], ['8.5', 40.7, 8.5, 7, 25.5], ['9', 41.3, 9, 7.5, 26], ['9.5', 42, 9.5, 8, 26.5], ['10', 42.7, 10, 8.5, 27]];
const PUMA_HOMBRE = [['6', 39, 7, 6, 25], ['6.5', 40, 7.5, 6.5, 25.5], ['7', 40.5, 8, 7, 26], ['7.5', 41, 8.5, 7.5, 26.5], ['8', 42, 9, 8, 27], ['8.5', 42.5, 9.5, 8.5, 27.5], ['9', 43, 10, 9, 28], ['9.5', 44, 10.5, 9.5, 28.5], ['10', 44.5, 11, 10, 29], ['10.5', 45, 11.5, 10.5, 29.5], ['11', 46, 12, 11, 30], ['12', 47, 13, 12, 31]];
const PUMA_DAMA = [['3', 35.5, 5.5, 3, 22], ['3.5', 36, 6, 3.5, 22.5], ['4', 37, 6.5, 4, 23], ['4.5', 37.5, 7, 4.5, 23.5], ['5', 38, 7.5, 5, 24], ['5.5', 38.5, 8, 5.5, 24.5], ['6', 39, 8.5, 6, 25], ['6.5', 40, 9, 6.5, 25.5], ['7', 40.5, 9.5, 7, 26], ['7.5', 41, 10, 7.5, 26.5], ['8', 42, 10.5, 8, 27]];
// número AR/EU directo (Head, Atomik, Fila, Le Coq, Montagne, Topper, Umbro, Timberland, 47 Street, Olympikus…): tabla general
const AR_HOMBRE = [['39', 39, 7, 6.5, 25], ['40', 40, 7.5, 7, 25.5], ['41', 41, 8.5, 8, 26.5], ['41.5', 41.5, 9, 8.5, 27], ['42', 42, 9.5, 9, 27.5], ['43', 43, 10, 9.5, 28], ['44', 44, 10.5, 10, 28.5], ['45', 45, 11.5, 11, 29.5], ['46', 46, 12, 11.5, 30], ['47', 47, 13, 12.5, 31]];
const AR_DAMA = [['34', 34, 5, 3, 22], ['35', 35, 5.5, 3.5, 22.5], ['36', 36, 6.5, 4.5, 23.5], ['37', 37, 7, 5, 24], ['37.5', 37.5, 7.5, 5.5, 24.5], ['38', 38, 8, 6, 25], ['39', 39, 8.5, 6.5, 25.5], ['40', 40, 9, 7, 26], ['41', 41, 9.5, 7.5, 26.5]];
// Havaianas / Rider / Bagunza / Hang Loose: número BR, casi siempre doble («35/36»); el BR es ~2 números menos que el AR
const BR_UNISEX = [['33/34', 35.5, 4.5, 3, 22.5], ['35/36', 37.5, 6, 4.5, 24], ['37/38', 39.5, 7.5, 6, 25.5], ['39/40', 41.5, 8.5, 7.5, 26.5], ['41/42', 43.5, 10, 9, 28], ['43/44', 45.5, 11.5, 10.5, 29.5], ['45/46', 47.5, 13, 12, 31]];
const CROCS_HOMBRE = [['7', 39.5, 7, 6, 25], ['8', 41, 8, 7, 26], ['9', 42.5, 9, 8, 27], ['10', 43.5, 10, 9, 28], ['11', 45, 11, 10, 29], ['12', 46.5, 12, 11, 30], ['13', 48, 13, 12, 31]];
const CROCS_DAMA = [['4', 34.5, 4, 2, 21], ['5', 36, 5, 3, 22], ['6', 37.5, 6, 4, 23], ['7', 38.5, 7, 5, 24], ['8', 39.5, 8, 6, 25], ['9', 41, 9, 7, 26], ['10', 42, 10, 8, 27]];

export const MARCAS = {
  'new balance': { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA, nota: 'la curva unisex rotula US Men: para dama restar 1,5 (US Women 7 = US Men 5.5)' },
  nike: { escala: 'US', hombre: NIKE_HOMBRE, dama: NIKE_DAMA, nota: 'unisex rotula US Men; niño en US Y (5 Y ≈ AR 37)' },
  adidas: { escala: 'US', hombre: ADI_HOMBRE, dama: ADI_DAMA, nota: 'la caja trae UK · US · FR (=AR/EU) · JP (cm): FR y JP son los que no fallan' },
  puma: { escala: 'UK', hombre: PUMA_HOMBRE, dama: PUMA_DAMA, nota: 'Puma rotula UK (la caja también trae EUR y cm)' },
  asics: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA }, on: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA },
  salomon: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA }, skechers: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA },
  'under armour': { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA }, vans: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA, nota: 'unisex rotula US Men' },
  converse: { escala: 'US', hombre: NB_HOMBRE, dama: NB_DAMA, nota: 'Chuck Taylor rotula US Men aunque sea unisex: dama = US Men + 1,5' },
  crocs: { escala: 'US', hombre: CROCS_HOMBRE, dama: CROCS_DAMA, nota: 'los unisex vienen M/W («M9/W11»); calzan grandes, muchos bajan un talle' },
  havaianas: { escala: 'BR', hombre: BR_UNISEX, dama: BR_UNISEX, nota: 'número BR doble: 37/38 BR ≈ 39/40 AR' },
  rider: { escala: 'BR', hombre: BR_UNISEX, dama: BR_UNISEX, nota: 'número BR: 39/40 BR ≈ 41/42 AR' },
  bagunza: { escala: 'BR', hombre: BR_UNISEX, dama: BR_UNISEX }, 'hang loose': { escala: 'BR', hombre: BR_UNISEX, dama: BR_UNISEX },
  _ar: { escala: 'AR', hombre: AR_HOMBRE, dama: AR_DAMA }   // el resto: número AR/EU directo
};
export const ESCALAS = ['AR', 'US', 'UK', 'CM'];   // columnas 1..4 de la fila, en este orden
const COL = { AR: 1, EU: 1, EUR: 1, ARG: 1, US: 2, USA: 2, UK: 3, CM: 4, JP: 4, BR: 0 };

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function tablaDe(marca) {
  const m = norm(marca);
  for (const k in MARCAS) if (k !== '_ar' && (m === k || m.indexOf(k) >= 0)) return Object.assign({ marca: k }, MARCAS[k]);
  return Object.assign({ marca: 'general' }, MARCAS._ar);
}
function filasDe(t, genero) {
  const g = norm(genero);
  if (/dama|mujer|femen|wns|women/.test(g)) return t.dama;
  if (/hombre|masc|men\b|varon/.test(g)) return t.hombre;
  return null;   // unisex / sin dato: se prueban las dos
}
const num = v => { const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\/]/g, '').split('/')[0]); return isFinite(n) ? n : null; };

/* Convierte un talle de una escala a la escala con que ROTULA la marca.
   → { rotulo, fila:[…], genero, aprox } o null si no hay fila (talle fuera de la tabla). */
export function aLaMarca(marca, genero, talle, escala) {
  const t = tablaDe(marca), col = COL[String(escala || '').toUpperCase()];
  const n = num(talle); if (n == null) return null;
  const grupos = filasDe(t, genero) ? [[filasDe(t, genero), genero]] : [[t.hombre, 'hombre'], [t.dama, 'dama']];
  if (col === undefined || col === 0 || (String(escala || '').toUpperCase() === t.escala)) {
    // ya viene en la escala de la marca (o sin escala): buscar el rótulo tal cual
    for (const [filas, g] of grupos) { const f = filas.find(x => num(x[0]) === n); if (f) return { rotulo: f[0], fila: f, genero: g, aprox: false }; }
    return null;
  }
  let mejor = null;
  for (const [filas, g] of grupos) for (const f of filas) { const d = Math.abs(f[col] - n); if (!mejor || d < mejor.d) mejor = { d, f, g }; }
  if (!mejor || mejor.d > (col === 4 ? 0.6 : 0.8)) return null;
  return { rotulo: mejor.f[0], fila: mejor.f, genero: mejor.g, aprox: mejor.d > 0.05 };
}

/* Texto de la fila para el prompt: «Adidas rotula US · hombre US 9 = AR/EU 42.7 · UK 8.5 · 27 cm» */
export function filaTexto(t, f, genero) {
  return (t.marca === 'general' ? 'Marcas con número AR/EU' : t.marca[0].toUpperCase() + t.marca.slice(1)) + ' (rotula ' + t.escala + ') · ' + genero + ' ' + t.escala + ' ' + f[0] + ' = AR/EU ' + f[1] + ' · US ' + f[2] + ' · UK ' + f[3] + ' · ' + f[4] + ' cm';
}

/* Bloque para el prompt cuando el usuario habla de un talle: la equivalencia en cada marca de interés. */
export function bloqueTalle(talle, escala, marcas, genero) {
  const n = num(talle); if (n == null) return '';
  const lista = (marcas && marcas.length ? marcas : ['Adidas', 'Nike', 'Puma', 'New Balance', 'general']);
  const vistas = {}, lineas = [];
  lista.forEach(m => {
    const t = tablaDe(m); if (vistas[t.marca]) return; vistas[t.marca] = 1;
    const r = aLaMarca(m, genero, talle, escala);
    if (r) lineas.push('- ' + filaTexto(t, r.fila, r.genero) + (r.aprox ? ' (aprox.)' : '') + (t.nota ? ' — ' + t.nota : ''));
    else lineas.push('- ' + (t.marca === 'general' ? 'número AR/EU' : t.marca) + ': ese talle no está en la tabla');
  });
  const esc = String(escala || '').toUpperCase();
  return 'EQUIVALENCIAS DE TALLE (tabla de la casa) para «' + talle + (esc ? ' ' + esc : '') + '»' + (esc ? '' : ' (sin escala: se toma como el rótulo de cada marca)') + ':\n' + lineas.join('\n') + '\nCada marca rotula en su escala y el stock del Buscador está en ESA escala: para buscar el talle de un artículo usá el rótulo de su marca. Decí la equivalencia como orientativa y que el cm de la caja es lo que manda; nunca inventes una que no esté acá.';
}

/* Detecta en la pregunta un talle con su escala: «6 uk», «talle 42», «calzo 9.5 us», «40 argentino». */
export function talleEnTexto(texto) {
  const s = norm(texto);
  let m = s.match(/(\d{1,2}(?:[.,]5)?)\s*(uk|us|usa|eu|eur|ar|arg|argentino|cm|br|brasil)\b/);
  if (m) return { talle: m[1].replace(',', '.'), escala: { arg: 'AR', argentino: 'AR', eur: 'EU', usa: 'US', brasil: 'BR' }[m[2]] || m[2].toUpperCase() };
  m = s.match(/\b(?:talle|talla|numero|nro|calzo|calza|calzas|equivale[a-z]*)\b[^\d]{0,14}(\d{1,2}(?:[.,]5)?)\b/) || s.match(/\b(\d{1,2}(?:[.,]5)?)\s*(?:de|en)?\s*(?:hombre|dama|mujer)\b/);
  if (!m) m = s.match(/\b(3[3-9]|4[0-7])(?:[.,]5)?\b/);   // un 33–47 suelto es un número AR/EU
  if (!m) m = s.match(/\ben (\d{1,2}(?:[.,]5)?)\b/);   // «la questar en 9»: talle en la escala de la marca
  if (m) { const t = String(m[1]).replace(',', '.') + (m[0].indexOf(m[1] + '.5') >= 0 || m[0].indexOf(m[1] + ',5') >= 0 ? '.5' : ''); const n = parseFloat(t); return { talle: t, escala: n >= 33 && n <= 47 ? 'AR' : '' }; }
  return null;
}
