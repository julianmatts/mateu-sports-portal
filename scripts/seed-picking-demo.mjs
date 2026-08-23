/* ============================================================================
   Siembra datos de PRUEBA para el módulo de Picking, para hacer una corrida de
   demostración de punta a punta. Escribe en la base recepciones-mateu, nodo
   picking/. Reutilizable: se puede volver a correr para resetear la demo.

   Uso:   node scripts/seed-picking-demo.mjs           (siembra)
          node scripts/seed-picking-demo.mjs --limpiar (borra SOLO lo de la demo)

   Los EAN de las variantes son reales (Adidas), así que el scan valida de verdad
   escaneando el producto físico O tipeando el EAN a mano (ver la guía).
   ============================================================================ */
const BASE = 'https://recepciones-mateu-default-rtdb.firebaseio.com';
const P = BASE + '/picking';
const limpiar = process.argv.includes('--limpiar');

const fbPut = (path, data) => fetch(BASE + path + '.json', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
const fbDel = (path) => fetch(BASE + path + '.json', { method:'DELETE' });

// operarios de prueba
const OPERARIOS = {
  op_demo_juan:   { nombre:'Juan (demo)',   activo:true, creado:'2026-07-30 00:00:00' },
  op_demo_ana:    { nombre:'Ana (demo)',    activo:true, creado:'2026-07-30 00:00:00' },
  op_demo_carlos: { nombre:'Carlos (demo)', activo:true, creado:'2026-07-30 00:00:00' }
};
// zonas del depósito (nombre + orden del recorrido)
const ZONAS = {
  z_demo_calz: { nombre:'Adidas Calzado',      orden:10 },
  z_demo_indu: { nombre:'Adidas Indumentaria', orden:20 },
  z_demo_otro: { nombre:'Accesorios / Otras',  orden:30 }
};
// asignación combo (marca__rubro) → zona
const ASIGN = {
  'Adidas__CALZADO':      'z_demo_calz',
  'Adidas__INDUMENTARIA': 'z_demo_indu',
  'Adidas__ACCESORIOS':   'z_demo_otro'
};
// pick de prueba, listo para ejecutar (EAN reales por variante, ordenado por zona)
const PICK_NRO = 9990;
const PICK = {
  nro: PICK_NRO, destino:'city-bell', estado:'PENDIENTE', prioridad:'ALTA',
  filtros:{ marca:'Adidas', rubro:'' }, origen:{ demo:true }, operario:'',
  created_at:'2026-07-30 20:00:00', creado_por:'demo',
  items: {
    i0001: { codigo:'ADIB75806', desc:'SAMBA OG BLANCO/NEGRO', marca:'Adidas', rubro:'CALZADO',
             zonaId:'z_demo_calz', zonaNombre:'Adidas Calzado', sequence:1, requested_qty:3, picked_qty:0, controlled_qty:0, estado:'pendiente',
             talles:[ {t:'5',   req:2, ean:'4059809047125', picked:0}, {t:'5.5', req:1, ean:'4059809047156', picked:0} ] },
    i0002: { codigo:'ADIKY5654', desc:'adi365 HYB T UF ONICLA/NEGRO', marca:'Adidas', rubro:'INDUMENTARIA',
             zonaId:'z_demo_indu', zonaNombre:'Adidas Indumentaria', sequence:2, requested_qty:5, picked_qty:0, controlled_qty:0, estado:'pendiente',
             talles:[ {t:'M', req:3, ean:'4067907129582', picked:0}, {t:'L', req:2, ean:'4067907129650', picked:0} ] }
  }
};

async function main(){
  if(limpiar){
    for(const id of Object.keys(OPERARIOS)) await fbDel('/picking/operarios/' + id);
    for(const id of Object.keys(ZONAS))     await fbDel('/picking/zonas/' + id);
    for(const k  of Object.keys(ASIGN))     await fbDel('/picking/asignZona/' + k);
    await fbDel('/picking/pickings/' + PICK_NRO);
    console.log('Demo borrada (operarios, zonas, asignaciones y PICK #' + PICK_NRO + ').');
    return;
  }
  for(const [id,v] of Object.entries(OPERARIOS)) await fbPut('/picking/operarios/' + id, v);
  for(const [id,v] of Object.entries(ZONAS))     await fbPut('/picking/zonas/' + id, v);
  for(const [k,v]  of Object.entries(ASIGN))     await fbPut('/picking/asignZona/' + k, v);
  await fbPut('/picking/pickings/' + PICK_NRO, PICK);
  console.log('Demo sembrada:');
  console.log('  · 3 operarios (Juan/Ana/Carlos "demo")');
  console.log('  · 3 zonas (Adidas Calzado, Adidas Indumentaria, Accesorios/Otras)');
  console.log('  · asignaciones Adidas Calzado/Indumentaria/Accesorios → zona');
  console.log('  · PICK #' + PICK_NRO + ' (City Bell, 8 u, 4 líneas, 2 zonas) listo para ejecutar');
  console.log('\nPara resetear: node scripts/seed-picking-demo.mjs --limpiar');
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
