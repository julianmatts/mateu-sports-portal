/* ============================================================
   Fichas técnicas de Matts, por disciplina (21/09/2026)
   ------------------------------------------------------------
   El criterio técnico con que Matts recomienda en el mostrador. Haiku solo
   a veces afirma cosas dudosas (dijo que la paleta de un principiante lleva
   el balance hacia la cabeza: es al revés), así que el criterio va escrito
   acá y la Function (functions/api/asistente.js) le inyecta al prompt SOLO
   la ficha de lo que se está preguntando (`fichasPara`: palabras clave sobre
   los últimos mensajes del usuario, hasta 2 fichas) — no gasta una vuelta
   de herramienta ni manda las 13 fichas en cada consulta.

   PARA CORREGIR O SUMAR CRITERIO: editar el `texto` de la ficha (o agregar
   una entrada con su `rx`) y pushear. Texto plano, corto y en rioplatense;
   nada de precios ni de consejos médicos. Conviene que lo revise quien sabe
   del deporte (Iván / los referentes de cada disciplina).
   Test: node --test lib/asistente-fichas.test.mjs
   ============================================================ */

export const FICHAS = [
  {
    id: 'padel',
    rx: /\bp[aá]del\b|\bpaddle\b|\bpaleta(s)?\b/i,
    texto: `PÁDEL — PALETAS
- Forma: REDONDA = control, punto dulce amplio y centrado, balance BAJO (hacia el puño): la de quien empieza y la del jugador de control. LÁGRIMA = equilibrio control/potencia, balance medio: intermedios y polivalentes. DIAMANTE = potencia, punto dulce chico y arriba, balance ALTO (hacia la cabeza): avanzados, exige técnica y brazo.
- Principiante: redonda, balance bajo, goma blanda, liviana. NUNCA diamante ni balance alto para empezar.
- Peso orientativo: 350-365 g hombre, 340-360 g dama; más liviana = más manejable y menos exigente para el brazo; más pesada = más potencia con buena técnica.
- Núcleo: goma blanda (EVA soft / foam) = más salida de bola y confort, ideal para juego lento y para empezar; goma dura = más control y potencia en golpes rápidos, más exigente.
- Caras: fibra de vidrio = más flexible y con más salida, perdona más; carbono = más rígido, preciso y durable (3K, 12K, 18K: a más K, más rigidez). Cara rugosa ayuda a los efectos.
- Si el cliente menciona molestias en el codo: sin opinar de la lesión, orientá a redonda, goma blanda, peso moderado y balance bajo.
- Marco de 38 mm es el estándar; no es un criterio para elegir.
PÁDEL — CALZADO: suela de ESPIGA (herringbone) o mixta/omni para césped sintético con arena, con refuerzo lateral y puntera. La zapatilla de running no sirve: no tiene sostén lateral y la suela resbala o se traba.
Accesorios que siempre suman: protector de marco, overgrip, pelotas (pierden presión en pocas semanas).`
  },
  {
    id: 'tenis',
    rx: /\btenis\b(?! de mesa)|\btennis\b|\braqueta(s)?\b|polvo de ladrillo/i,
    texto: `TENIS — RAQUETAS
- Tamaño de cabeza: 100-105 in² o más = más punto dulce y potencia fácil (principiante / recreativo); 98-100 = intermedio; 95-98 = avanzado, más control y menos perdón.
- Peso sin encordar: menos de 285 g = principiante, juvenil o quien busca manejabilidad; 285-305 g = intermedio; más de 305 g = avanzado (estabilidad y control, exige físico y técnica).
- Balance: las livianas suelen ir con balance a la cabeza (ayuda a generar potencia); las pesadas, con balance al puño (control y maniobrabilidad).
- Patrón de cuerdas: 16x19 = más efecto y potencia; 18x20 = más control y duración de cuerda.
- Grip: tallas L1 a L4. Dama suele usar L1-L2, hombre L2-L3. Prueba: empuñando, entre la yema de los dedos y la palma tiene que entrar justo un dedo de la otra mano. Ante la duda, el más chico (se agranda con overgrip).
- Junior por altura: 19" hasta ~1,05 m · 21" 1,05-1,20 · 23" 1,20-1,35 · 25" 1,35-1,45 · 26" 1,45-1,55 · después, adulto liviana.
- Muchas raquetas se venden sin encordar: avisarlo.
TENIS — CALZADO: según superficie. Polvo de ladrillo = suela de espiga completa (agarra y deja deslizar, no junta polvo). Cemento / rápida = suela all court, más dura y durable. Siempre con refuerzo lateral y puntera; la de running no sirve (sin sostén lateral).
PELOTAS: presurizadas para jugar. Chicos: roja (5-8 años), naranja (8-10), verde (9-10 en adelante) antes de la amarilla.`
  },
  {
    id: 'running',
    rx: /\brunning\b|\bcorrer\b|\bcorro\b|\bcorre\b|\btrot(e|ar)\b|\bmarat[oó]n\b|\b(10|21|42) ?k\b|\bpisada\b|\bpronador|\bsupinador|\bdrop\b|\btrail\b/i,
    texto: `RUNNING — ZAPATILLAS
- Pisada: NEUTRA (la mayoría) = zapatilla neutra. PRONADORA (el pie cae hacia adentro) = zapatilla de estabilidad / con soporte medial. SUPINADORA = neutra con buena amortiguación, nunca de estabilidad. Si el cliente no sabe, mirar el desgaste de la suela de su zapatilla vieja; ante la duda, neutra.
- Drop (diferencia de altura talón-punta): 8-12 mm = tradicional, el más amable para quien empieza o apoya de talón. 4-6 mm o menos = más exigente para gemelos y tendón de Aquiles: solo para quien ya viene corriendo, con transición gradual.
- Amortiguación: más amortiguación y estructura para corredores de más de ~85 kg, para fondos largos y para asfalto todos los días. Menos y más liviana para ritmos rápidos y corredores livianos.
- Para EMPEZAR: neutra, drop 8-10 mm, amortiguación media-alta, estable. No placa de carbono ni modelos de competición: son para correr rápido, duran menos y son inestables al trote.
- Uso: entrenamiento diario (durable, amortiguada) vs. competición / series (liviana, reactiva). Trail = suela con taqueado y protección; en asfalto se gasta y es dura.
- Talle: medio a un número más que el calzado de calle; tiene que quedar un dedo (≈1 cm) libre adelante del dedo más largo. Probar a la tarde y con las medias de correr.
- Vida útil orientativa: 600-800 km; después pierde amortiguación aunque se vea bien.
- La zapatilla casual con estética running NO es para correr: mirar la disciplina del artículo.
Accesorios: medias técnicas sin costura (evitan ampollas), indumentaria que seque rápido (no algodón).`
  },
  {
    id: 'futbol',
    rx: /\bf[uú]tbol\b|\bfutsal\b|\bbot[ií]n(es)?\b|\btapon(es)?\b|\bpapi\b|\bcanillera|\barquero\b|\bf[5-9]\b|\bf11\b/i,
    texto: `FÚTBOL — BOTINES, SEGÚN LA CANCHA (es lo primero que hay que preguntar)
- FG (firm ground) = césped NATURAL firme, tapones moldeados. El clásico de fútbol 11.
- SG (soft ground) = césped natural blando o mojado, tapones intercambiables (metal). Poco uso recreativo.
- AG (artificial grass) = césped SINTÉTICO de caucho, más tapones, más cortos y huecos. Muchos modelos vienen FG/AG o MG (multi ground): sirven para los dos.
- TF / turf / «papi» = sintético de pelo corto, alfombra o canchas duras: suela multitaco de goma. Es lo que se usa en la mayoría de las canchas de fútbol 5.
- IC / IN / futsal = suela lisa de goma que no marca: parquet, cemento, baldosa.
- Un FG en sintético agarra de más y se gasta antes; un TF en césped natural mojado patina.
- Material: cuero = se adapta al pie y es más cómodo, cede con el uso; sintético = más liviano, no cede (elegir el talle justo).
- Calce: ajustado, sin que sobre más de ~0,5 cm. A los chicos NO comprarles grande «para que les dure»: pierden estabilidad y toque.
PELOTAS: N°5 desde los 12-13 años y adultos · N°4 de 8 a 12 años · N°3 hasta los 8. Futsal = N°4 de BAJO PIQUE (no es la N°4 de campo). Cosida o termosellada para césped; para cemento, goma o sintética resistente.
CANILLERAS: por altura del jugador; con tobillera para los más chicos. GUANTES DE ARQUERO: un punto más holgados que la mano; cortes plano (clásico), rollfinger (más contacto) y negativo (más ajustado).`
  },
  {
    id: 'hockey',
    rx: /\bhockey\b|\bpalo(s)?\b|\bbocha(s)?\b|\bbow\b/i,
    texto: `HOCKEY — PALOS
- Largo según altura (referencia: parado, el palo llega al hueso de la cadera): hasta 1,20 m = 28-30" · 1,20-1,30 = 32" · 1,30-1,40 = 34" · 1,40-1,50 = 35" · 1,50-1,60 = 35-36,5" · 1,60-1,75 = 36,5" · más de 1,75 = 37,5". La mayoría de los adultos usa 36,5" o 37,5".
- Composición: más % de CARBONO = más rigidez y potencia en la pegada, pero menos absorción: la bocha rebota más al recibir y exige técnica. Principiante / infantil = fibra de vidrio o madera, 0-30 % carbono (perdona y da control). Intermedio = 40-70 %. Avanzado = 80-100 %.
- Curvatura (bow): STANDARD / MID BOW (curva suave y al medio) = todo terreno, el indicado para empezar y para defensores / pegada. LOW BOW (curva más marcada y más abajo) = facilita levantar la bocha y el arrastre, intermedio-avanzado. EXTRA LOW / XLB (curva máxima cerca de la pala) = arrastradas y 3D, jugadores avanzados.
- Peso: light (~520-540 g) = más manejable, delanteros y juveniles; medium (~540-560 g) = más potencia, defensores.
- Nunca un palo 90-100 % carbono y extra low bow para quien empieza: se le va a ir la bocha en cada recepción.
PROTECCIÓN: bucal (imprescindible), canilleras DE HOCKEY (más altas y con protección de tobillo que las de fútbol), guante para la mano izquierda. CALZADO: para sintético de agua, suela multitaco de goma con buen sostén lateral y puntera reforzada. BOCHAS: lisas para entrenamiento, con hoyuelos para cancha de agua.`
  },
  {
    id: 'basquet',
    rx: /\bb[aá]s?quet(bol)?\b|\bbasket\b|\bnba\b/i,
    texto: `BÁSQUET — CALZADO
- Caña ALTA / media = más sujeción y protección en los contactos: internos, jugadores de poste y quien busca seguridad en el tobillo. Caña BAJA = más liviana y libre: bases y escoltas, juego rápido. El sostén real lo da el ajuste y la base, no solo la altura.
- Amortiguación importante en talón y antepié: es un deporte de saltos y frenadas. Base ancha y estable.
- Suela: para cancha INDOOR (parquet) goma más blanda con dibujo de espiga, agarra más; para OUTDOOR (cemento) goma más dura y gruesa, porque el cemento la gasta rápido. Usar en la calle una zapatilla de indoor la arruina en poco tiempo.
- La zapatilla de running no sirve: no tiene sostén lateral para los cambios de dirección.
PELOTAS: N°7 = masculino desde los 14-15 años · N°6 = femenino y categorías U13-U14 · N°5 = mini básquet (hasta 12 años) · N°3 = pre-mini. Cuero sintético / compuesto para parquet; GOMA para cemento y exterior (el cuero compuesto se pela en el cemento).`
  },
  {
    id: 'training',
    rx: /\btraining\b|\bgimnasio\b|\bgym\b|\bcrossfit\b|\bcross ?training\b|\bfuncional\b|\bpesas\b|\bhiit\b|\bmusculaci[oó]n\b/i,
    texto: `TRAINING / GIMNASIO — CALZADO
- Para PESAS y funcional: suela plana, firme y estable, drop bajo y base ancha. Una zapatilla de running muy amortiguada es inestable para levantar peso (el talón se hunde).
- Cross training: además, refuerzo lateral y en el arco para la soga, y suela que agarre en cajones y sprints cortos.
- Clases aeróbicas, HIIT, saltos: algo más de amortiguación en el antepié y buena flexión adelante, sin perder estabilidad lateral.
- Si el cliente hace cinta larga además de pesas: o un modelo mixto y aclararle el compromiso, o dos pares.
- Pregunta clave: ¿pesas / máquinas, clases con saltos, o mezcla con correr?
INDUMENTARIA: telas que sequen rápido; calzas con buena compresión y cintura alta para sentadillas; remeras sin costuras que rocen. Accesorios: guantes, soga, bandas, botella.`
  },
  {
    id: 'voley',
    rx: /\bv[oó]ley(bol)?\b|\bvolley\b|\brodillera(s)?\b/i,
    texto: `VÓLEY
- Calzado INDOOR: suela de goma (caramelo / no marcante) con mucho agarre en parquet, amortiguación reforzada en el ANTEPIÉ para los saltos y las caídas, liviana y con sostén lateral. Caña media para centrales y quien busca más sujeción.
- La de running no sirve: amortigua en el talón, no adelante, y no sostiene de costado.
- Rodilleras: por talle (contorno de rodilla); tienen que quedar firmes sin cortar la circulación. Imprescindibles para defensa y líberos.
- Pelota: N°5 oficial (260-280 g). Para chicos e iniciación hay versiones más livianas y blandas (mini vóley), que no lastiman los antebrazos.`
  },
  {
    id: 'rugby',
    rx: /\brugby\b|\bhombrera(s)?\b|\bscrum\b|\btackle\b/i,
    texto: `RUGBY
- Botines: FORWARDS (primera y segunda línea) = suela SG de 8 tapones de aluminio, horma más ancha y estructura firme para empujar en el scrum. BACKS y tercera línea = más livianos, tipo fútbol (FG o mixtos de 6 tapones), para velocidad y cambios de dirección. En cancha dura o seca, tapones moldeados.
- Protección: bucal (obligatorio en la práctica), casco y hombreras blandas homologadas (World Rugby). Las hombreras no son para «pegar más fuerte»: amortiguan el roce.
- Pelotas: N°5 = juveniles desde M15 y adultos · N°4 = M10 a M14 · N°3 = menores. De entrenamiento (grip más marcado, más durable) o de partido.
- Indumentaria: camisetas y shorts reforzados (costuras y tela resisten el agarre); medias largas.`
  },
  {
    id: 'natacion',
    rx: /\bnataci[oó]n\b|\bnadar\b|\bnado\b|\bpileta\b|\bantiparra(s)?\b|\bmalla(s)?\b|\bgorra de (nataci[oó]n|silicona|ba[ñn]o)\b/i,
    texto: `NATACIÓN
- Mallas de ENTRENAMIENTO: poliéster / PBT resisten el cloro mucho más que la lycra (que se afloja y se transparenta en pocos meses de pileta). Para nadar seguido, siempre resistente al cloro. La malla de playa no es para pileta.
- Calce: ajustada, sin que sobre tela (en el agua cede). Las de competición van todavía más justas.
- Antiparras: junta de silicona blanda para entrenar; lente claro para pileta cubierta, espejado u oscuro para exterior. Prueba de calce: apoyarlas sin pasar la tira: si hacen sopapa un par de segundos, sellan bien. Puente nasal regulable ayuda en caras chicas. Antifog: no frotar el interior.
- Gorras: SILICONA = dura más, no tira del pelo, abriga algo; LYCRA / tela = la más cómoda, pero deja pasar el agua; LÁTEX = fina y liviana, pero se rompe más fácil. Pelo largo: silicona con más volumen.
- Accesorios de entrenamiento: tabla, pull buoy, patas de rana cortas, manoplas (para quien ya nada con técnica).`
  },
  {
    id: 'box',
    rx: /\bbox(eo)?\b|\bkick ?boxing\b|\bmuay\b|\bguante(s)? de box|\bonzas?\b|\boz\b|\bbolsa de box|\bvendas?\b/i,
    texto: `BOXEO / CONTACTO — GUANTES POR ONZAS (oz = cantidad de relleno, no el talle de la mano)
- 8-10 oz = competencia y trabajo de velocidad; adultos livianos en bolsa.
- 12 oz = bolsa y manoplas para la mayoría de las damas y adultos livianos (hasta ~65 kg).
- 14 oz = bolsa / manoplas de adultos de 65-80 kg, y sparring liviano.
- 16 oz = el estándar de SPARRING (protege al compañero) y bolsa para más de ~80 kg.
- Chicos: 6-8 oz.
- Para empezar a entrenar (clases recreativas): 12 oz dama, 14 oz hombre es la regla simple.
- Cierre con VELCRO para entrenar (se pone solo); con cordón es de competencia y necesita ayuda.
- VENDAS siempre debajo del guante (3,5-4,5 m adultos; más cortas para manos chicas): sostienen la muñeca y absorben la transpiración. Guantín de gel como alternativa rápida.
- Protección para sparring: bucal, cabezal; tibiales para kick / muay thai.
- Cuidado: airear los guantes después de usarlos, nunca guardarlos húmedos en el bolso.`
  },
  {
    id: 'adventure',
    rx: /\btrekking\b|\bsenderismo\b|\bmonta[ñn]a\b|\boutdoor\b|\badventure\b|\bcamping\b|\bimpermeable\b|\bmochila de\b|\bborcego|\bhiking\b/i,
    texto: `ADVENTURE / TREKKING
- Calzado: caña BAJA = senderos simples, caminatas de día, más liviana y fresca. Caña MEDIA / ALTA = terreno irregular, piedra suelta, mochila pesada o varios días: más sostén de tobillo y protección.
- Membrana impermeable y respirable (tipo Gore-Tex): para frío, lluvia, barro o nieve. Con calor abriga de más y si se moja por adentro tarda en secar: para verano seco, mejor sin membrana y con buena ventilación.
- Suela con taqueado profundo y goma adherente (tipo Vibram); puntera reforzada.
- Talle: medio número más que de calle (el pie se hincha y en las bajadas los dedos no tienen que tocar la punta). Probar con la media de trekking. Ablandarlas antes de una salida larga.
- La zapatilla de trail running es una buena opción liviana para senderos sin carga.
- Mochilas por litros: 20-30 L = salida de día · 40-50 L = fin de semana · 60 L o más = travesía con carpa. Que tenga cinturón lumbar (el peso va a la cadera) y espalda regulable en las grandes.
- Abrigo por CAPAS: primera = térmica que saca la transpiración (sintética o lana merino, nunca algodón) · segunda = abrigo (polar, pluma o fibra) · tercera = rompeviento / impermeable. En impermeables, la columna de agua (mm) indica cuánta lluvia aguanta: 5.000 = lluvia moderada, 10.000 o más = lluvia sostenida.`
  },
  {
    id: 'talles',
    rx: /\btalle(s)?\b|\bn[uú]mero\b|\bequivale|\bconversi[oó]n\b|\b(us|uk|eur?)\b ?\d|\bhorma\b|\bcm\b/i,
    texto: `TALLES DE CALZADO
- Cada marca rotula distinto (AR, US, UK, EUR) y las equivalencias CAMBIAN de una marca a otra: no afirmes una conversión de memoria. La medida que no engaña es el largo en CM / JP de la etiqueta de la caja o de la lengüeta.
- Regla práctica: largo del pie en cm + ~1 cm de margen (running y trekking, un poco más; botines de fútbol, más justos).
- Dama y hombre tienen escalas US distintas (la de dama es ~1,5 número más que la de hombre para el mismo largo); en modelos unisex la etiqueta suele rotular la de hombre.
- Probar siempre los dos pies, de tarde y con la media que se va a usar. Si queda entre dos talles, en calzado deportivo el más grande.
- Chicos: el pie crece más o menos un número cada 4-6 meses; dejar 1 a 1,5 cm de margen, no más (un calzado grande hace tropezar y no sostiene).
- Si la sucursal no abre el stock por talle, el talle se confirma en el depósito.`
  }
];

/* Fichas que aplican a lo que se está hablando: mira los últimos mensajes DEL USUARIO, del más nuevo al más viejo.
   «talles» solo entra como segunda ficha o cuando es de lo único que se habla. Devuelve a lo sumo `max`. */
export function fichasPara(textos, max) {
  max = max || 2;
  const elegidas = [];
  const lista = (textos || []).filter(Boolean).slice(-3).reverse();
  lista.forEach(t => {
    const mesa = /tenis de mesa|ping ?pong/i.test(t);   // no es ni tenis ni pádel: sin ficha
    FICHAS.forEach(f => { if (mesa && (f.id === 'padel' || f.id === 'tenis')) return; if (f.id !== 'talles' && elegidas.length < max && elegidas.indexOf(f) < 0 && f.rx.test(t)) elegidas.push(f); });
  });
  const talles = FICHAS.filter(f => f.id === 'talles')[0];
  if (elegidas.length < max && lista.length && talles.rx.test(lista[0])) elegidas.push(talles);
  return elegidas;
}
