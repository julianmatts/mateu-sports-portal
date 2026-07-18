/* Datos de prueba para el MODO DEMO de Control de Recepciones.
   Solo se usan cuando FIREBASE_DB_URL está vacío (no persiste nada).
   Mismo shape que la base Firebase: recepciones/{pedidos,remitos}/<key>. */
window.RECEP_MOCK = {
  pedidos: {
    'OC-1042': { nro:'OC-1042', fecha:'2026-06-02', comprador:'Juli', proveedor:'Nike Argentina', marca:'Nike', moneda:'ARS', lineas:[
      { rubro:'Running', disciplina:'Running', tipo:'Calzado', cantidad:120, costo_unitario:48000 },
      { rubro:'Running', disciplina:'Running', tipo:'Indumentaria', cantidad:80, costo_unitario:22000 },
      { rubro:'Training', disciplina:'Training', tipo:'Calzado', cantidad:60, costo_unitario:41000 }
    ]},
    'OC-1058': { nro:'OC-1058', fecha:'2026-06-09', comprador:'Julián', proveedor:'adidas Argentina', marca:'adidas', moneda:'ARS', lineas:[
      { rubro:'Futbol', disciplina:'Futbol', tipo:'Calzado', cantidad:90, costo_unitario:52000 },
      { rubro:'Futbol', disciplina:'Futbol', tipo:'Indumentaria', cantidad:50, costo_unitario:19000 },
      { rubro:'Lifestyle', disciplina:'Urbano', tipo:'Calzado', cantidad:40, costo_unitario:57000 }
    ]}
  },
  remitos: {
    'R-8801': { nro:'R-8801', fecha:'2026-06-05', proveedor:'Nike Argentina', marca:'Nike', pedido_nro:'OC-1042', semana:'Sem 23', lineas:[
      { rubro:'Running', disciplina:'Running', tipo:'Calzado', cantidad:70, costo_unitario:48000 },
      { rubro:'Running', disciplina:'Running', tipo:'Indumentaria', cantidad:80, costo_unitario:22000 }
    ]},
    'R-8817': { nro:'R-8817', fecha:'2026-06-12', proveedor:'Nike Argentina', marca:'Nike', pedido_nro:'OC-1042', semana:'Sem 24', lineas:[
      { rubro:'Running', disciplina:'Running', tipo:'Calzado', cantidad:50, costo_unitario:48000 },
      { rubro:'Training', disciplina:'Training', tipo:'Calzado', cantidad:65, costo_unitario:41000 }
    ]},
    'R-8834': { nro:'R-8834', fecha:'2026-06-15', proveedor:'adidas Argentina', marca:'adidas', pedido_nro:'OC-1058', semana:'Sem 25', lineas:[
      { rubro:'Futbol', disciplina:'Futbol', tipo:'Calzado', cantidad:90, costo_unitario:52000 },
      { rubro:'Futbol', disciplina:'Futbol', tipo:'Indumentaria', cantidad:20, costo_unitario:19000 }
    ]}
  }
};
