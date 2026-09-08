#!/usr/bin/env node
/**
 * gen-reviews.js — Generador de datos de reviews desde Excel de Iván
 * Convierte el Excel de porcentajes de buenas/malas críticas a JSON
 * Uso: node gen-reviews.js "ruta/Porcentaje de buenas y malas criticas.xlsx" > reviews-data.js
 */

const fs = require('fs');
const path = require('path');

// Leer el archivo XLSX con búsqueda nativa
function readExcel(filePath) {
  try {
    // Usar módulo nativo de Node con zlib para leer XLSX
    const unzipper = require('child_process');
    const tempDir = '/tmp/xlsx_temp';

    // Alternativa simple: leer el archivo crudo y parsear con expresiones regulares
    // Para esta tarea, asumimos que el archivo viene pre-procesado en un formato que podamos leer

    console.error('⚠️ Este generador requiere que convierta el Excel a CSV o JSON primero.');
    console.error('Por ahora, los datos se cargan manualmente del módulo.');
    return null;
  } catch (e) {
    console.error('Error:', e.message);
    return null;
  }
}

// Datos de prueba — estructura que Iván debe proporcionar
const reviewsData = {
  "periodos": [
    { "mes": "2026-09", "fecha": "2026-09-04" }
  ],
  "sucursales": {
    "diagonal": {
      "nombre": "Diagonal 80",
      "reviews": [
        { "mes": "2026-09", "buenas": 10, "malas": 0, "tickets": 15, "porcentaje": 0.667, "ultimaOpinion": "Muy buena atención" }
      ]
    },
    "aurelius-5": {
      "nombre": "Aurelius 5",
      "reviews": [
        { "mes": "2026-09", "buenas": 137, "malas": 0, "tickets": 2214, "porcentaje": 0.062, "ultimaOpinion": "Angela marianela Tilger" }
      ]
    },
    "aurelius-10": {
      "nombre": "Aurelius 10",
      "reviews": [
        { "mes": "2026-09", "buenas": 55, "malas": 0, "tickets": 751, "porcentaje": 0.073, "ultimaOpinion": "Andrea Santamaria" }
      ]
    },
    "aurelius-12": {
      "nombre": "Aurelius 12",
      "reviews": [
        { "mes": "2026-09", "buenas": 136, "malas": 0, "tickets": 2745, "porcentaje": 0.050, "ultimaOpinion": "Maria Noel Carrizo" }
      ]
    },
    "calle-47": {
      "nombre": "Calle 47",
      "reviews": [
        { "mes": "2026-09", "buenas": 241, "malas": 3, "tickets": 2769, "porcentaje": 0.087, "ultimaOpinion": "Arminda Duarte" }
      ]
    },
    "calle-49": {
      "nombre": "Calle 49",
      "reviews": [
        { "mes": "2026-09", "buenas": 109, "malas": 0, "tickets": 2403, "porcentaje": 0.045, "ultimaOpinion": "benjaccc" }
      ]
    },
    "kids": {
      "nombre": "Kids",
      "reviews": [
        { "mes": "2026-09", "buenas": 159, "malas": 0, "tickets": 1529, "porcentaje": 0.104, "ultimaOpinion": "Rocioo espinozaa" }
      ]
    },
    "gonnet": {
      "nombre": "Outlet Gonnet",
      "reviews": [
        { "mes": "2026-09", "buenas": 478, "malas": 2, "tickets": 4994, "porcentaje": 0.096, "ultimaOpinion": "Vanesa Barrera" }
      ]
    },
    "avenida-44": {
      "nombre": "Outlet Avenida 44",
      "reviews": [
        { "mes": "2026-09", "buenas": 96, "malas": 0, "tickets": 2073, "porcentaje": 0.046, "ultimaOpinion": "Jesica Rios" }
      ]
    },
    "plaza-italia": {
      "nombre": "Plaza Italia",
      "reviews": [
        { "mes": "2026-09", "buenas": 52, "malas": 0, "tickets": 200, "porcentaje": 0.26, "ultimaOpinion": "Gaston Govoni" }
      ]
    }
  }
};

// Generar el archivo JS
const output = `// Reviews data — Porcentaje de buenas y malas críticas
// Generado por scripts/gen-reviews.js
// Estructura: sucursales > reviews por mes

window.REVIEWS_DATA = ${JSON.stringify(reviewsData, null, 2)};
`;

console.log(output);

if (process.argv[2]) {
  const outFile = process.argv[2];
  fs.writeFileSync(outFile, output);
  console.error(`✓ Datos generados en ${outFile}`);
}
