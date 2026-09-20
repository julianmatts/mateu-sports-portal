#!/usr/bin/env node
/* ============================================================
   Genera lo que lee Matts, el asistente del portal (shared/asistente.js
   + functions/api/asistente.js). Self-contained: solo fs + https.

   1) GUÍA DE USO  → shared/asistente-guia.json
      Sale del mapa TUT de shared/tutorial.js (un tutorial por módulo),
      así el contenido se mantiene en un solo lugar. Correr cada vez que
      se toque un tutorial:
          node scripts/gen-asistente.js guia

   2) CATÁLOGO     → Firebase recepciones-mateu, nodo asistente/catalogo/
      Parte el maestro de logística (logistica/arts) por disciplina y
      rubro, para que la Function baje solo el pedacito que necesita.
      NO es stock: es lo que se movió en el año. Correr después de la
      carga mensual de logística:
          node scripts/gen-asistente.js catalogo          (muestra, no escribe)
          node scripts/gen-asistente.js catalogo --publicar
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const RAIZ = path.join(__dirname, '..');
const DB = 'https://recepciones-mateu-default-rtdb.firebaseio.com';

function pedir(url, metodo, cuerpo) {
  return new Promise((ok, mal) => {
    const datos = cuerpo ? Buffer.from(JSON.stringify(cuerpo)) : null;
    const req = https.request(url, { method: metodo || 'GET', headers: datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {} }, res => {
      const partes = [];
      res.on('data', d => partes.push(d));
      res.on('end', () => {
        const txt = Buffer.concat(partes).toString('utf8');
        if (res.statusCode >= 300) return mal(new Error('HTTP ' + res.statusCode + ' ' + txt.slice(0, 200)));
        try { ok(JSON.parse(txt)); } catch (e) { mal(e); }
      });
    });
    req.on('error', mal);
    if (datos) req.write(datos);
    req.end();
  });
}

/* ---------- 1) guía de uso ---------- */
function generarGuia() {
  const src = fs.readFileSync(path.join(RAIZ, 'shared', 'tutorial.js'), 'utf8');
  const ini = src.indexOf('var TUT = {');
  if (ini < 0) throw new Error('No encontré «var TUT = {» en shared/tutorial.js');
  // el mapa termina en la primera línea que es solo «};» después del inicio
  const fin = src.indexOf('\n  };', ini);
  if (fin < 0) throw new Error('No encontré el cierre del mapa TUT');
  const TUT = (new Function('return ' + src.slice(ini + 'var TUT = '.length, fin + 4).replace(/;\s*$/, '')))();

  const modulos = {};
  Object.keys(TUT).forEach(k => {
    const t = TUT[k];
    modulos[k] = {
      nombre: t.nombre,
      pasos: (t.pasos || []).map(p => {
        const o = { t: p.t, d: p.d };
        if (p.roles) o.roles = p.roles;
        return o;
      })
    };
  });
  const salida = { generado: new Date().toISOString().slice(0, 10), fuente: 'shared/tutorial.js', modulos };
  const destino = path.join(RAIZ, 'shared', 'asistente-guia.json');
  fs.writeFileSync(destino, JSON.stringify(salida));
  console.log('Guía: ' + Object.keys(modulos).length + ' módulos → ' + path.relative(RAIZ, destino) + ' (' + Math.round(fs.statSync(destino).size / 1024) + ' KB)');
}

/* ---------- 2) catálogo por disciplina ---------- */
function clave(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function sinNN(s) { return String(s || '').replace(/^\d+\s*-\s*/, '').trim(); }

async function generarCatalogo(publicar) {
  console.log('Bajando logistica/arts…');
  const arts = await pedir(DB + '/logistica/arts.json');
  const RUBROS = { CALZADO: 1, INDUMENTARIA: 1, ACCESORIOS: 1 };
  const partes = {}, indice = {};
  Object.keys(arts || {}).forEach(k => {
    const v = arts[k]; // [rubro, sub, disc, marca, idItem, artículo, tipo, código]
    if (!v || !RUBROS[v[0]] || !v[2] || /desconocid/i.test(v[2])) return;
    const disc = clave(v[2]), nodo = disc + '__' + v[0];
    (partes[nodo] = partes[nodo] || []).push([v[7] || k, v[5] || '', v[3] || '', sinNN(v[1]), v[6] || '']);
    indice[disc] = indice[disc] || { nombre: v[2], rubros: {} };
    indice[disc].rubros[v[0]] = (indice[disc].rubros[v[0]] || 0) + 1;
  });
  const nodos = Object.keys(partes).sort();
  nodos.forEach(n => console.log('  ' + n + ': ' + partes[n].length));
  console.log(nodos.length + ' particiones · ' + nodos.reduce((s, n) => s + partes[n].length, 0) + ' artículos · ' + Object.keys(indice).length + ' disciplinas');
  if (!publicar) { console.log('\n(sin --publicar: no se escribió nada)'); return; }
  await pedir(DB + '/asistente/catalogo.json', 'PUT', { generado: new Date().toISOString(), indice, partes });
  console.log('Publicado en asistente/catalogo');
}

const modo = process.argv[2];
(async () => {
  if (modo === 'guia') generarGuia();
  else if (modo === 'catalogo') await generarCatalogo(process.argv.indexOf('--publicar') > 0);
  else { console.log('Uso: node scripts/gen-asistente.js guia | catalogo [--publicar]'); process.exit(1); }
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
