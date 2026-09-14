#!/usr/bin/env python3
"""
Generador del plano de una sucursal  ·  Portal Mateu Sports
---------------------------------------------------------------------------
Lee el plano dibujado en Excel (una hoja por planta: «Salon», «Deposito»,
«Deposito 2»…; cada mueble/área es una celda combinada) y lo agrega a
shared/planos-sucursal.js, que usan el Buscador de Artículos (mapa del depósito
y del salón) y Tareas (sectores del salón).

Uso:
  python scripts/gen-plano-sucursal.py "C:/Users/julia/Downloads/Plano Ensenada.xlsx" ensenada

Reglas de lectura:
  - Celda pintada de celeste (FF8FC1E3) = mueble: en el salón es un SECTOR de
    exhibición; en un depósito es una ESTANTERÍA.
  - Celda blanca con rótulo (PC, Baño, Caja, Probador, Vidriera) = servicio.
  - Celda blanca sin rótulo = hueco (puerta, columna): se dibuja apagada.
  - Estanterías: las que ya traen número («Estanteria 11») lo conservan; las
    demás reciben los números libres (1, 2, 3…) recorriendo las hojas en orden
    y cada hoja de izquierda a derecha, de arriba abajo. El rótulo queda como
    descripción: «Estantería 5 · ind. hombre».
  - Muebles celestes sin rótulo = «Sin nombre N».

Forma de la salida (por slug, los demás slugs del archivo se conservan):
  window.PLANOS_SUC = { <slug>: { fuente, generado, aspecto,
    plantas:[{id, nombre, tipo:'salon'|'deposito', filas, cols,
      celdas:[{id, nombre, tipo:'sector'|'estanteria'|'servicio'|'hueco', num?, r0,r1,c0,c1}]}] } }
"""
import sys, os, re, json, datetime, unicodedata
import openpyxl

MUEBLE = 'FF8FC1E3'
DEST = os.path.join('shared', 'planos-sucursal.js')


def slugify(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def limpiar(v):
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''


def leer_hoja(ws):
    tipo_planta = 'deposito' if re.search(r'dep', ws.title, re.I) else 'salon'
    bloques = []
    for m in ws.merged_cells.ranges:
        c = ws.cell(m.min_row, m.min_col)
        fill = c.fill.fgColor.rgb if c.fill and c.fill.fill_type else ''
        bloques.append(dict(label=limpiar(c.value), fill=fill,
                            r0=m.min_row - 1, r1=m.max_row - 1, c0=m.min_col - 1, c1=m.max_col - 1))
    # celdas sueltas con texto (no combinadas)
    en_merge = set()
    for b in bloques:
        for r in range(b['r0'], b['r1'] + 1):
            for cc in range(b['c0'], b['c1'] + 1):
                en_merge.add((r, cc))
    for row in ws.iter_rows():
        for c in row:
            if (c.row - 1, c.column - 1) in en_merge or c.value is None:
                continue
            fill = c.fill.fgColor.rgb if c.fill and c.fill.fill_type else ''
            bloques.append(dict(label=limpiar(c.value), fill=fill,
                                r0=c.row - 1, r1=c.row - 1, c0=c.column - 1, c1=c.column - 1))
    if not bloques:
        return None
    # recorte al área dibujada
    rmin = min(b['r0'] for b in bloques); cmin = min(b['c0'] for b in bloques)
    for b in bloques:
        b['r0'] -= rmin; b['r1'] -= rmin; b['c0'] -= cmin; b['c1'] -= cmin
    bloques.sort(key=lambda b: (b['c0'], b['r0']))
    return dict(nombre=ws.title.replace('Deposito', 'Depósito').replace('Salon', 'Salón'),
                tipo=tipo_planta, bloques=bloques,
                filas=max(b['r1'] for b in bloques) + 1, cols=max(b['c1'] for b in bloques) + 1)


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    xlsx, slug = sys.argv[1], sys.argv[2]
    wb = openpyxl.load_workbook(xlsx)
    hojas = [h for h in (leer_hoja(ws) for ws in wb) if h]

    # números de estantería ya ocupados
    usados = set()
    for h in hojas:
        if h['tipo'] != 'deposito':
            continue
        for b in h['bloques']:
            m = re.search(r'(\d+)', b['label'])
            if b['fill'] == MUEBLE and m:
                usados.add(int(m.group(1)))
    libre = [1]

    def proximo():
        while libre[0] in usados:
            libre[0] += 1
        usados.add(libre[0])
        return libre[0]

    plantas = []
    sin_nombre = {}
    for h in hojas:
        pid = slugify(h['nombre'])
        celdas, vistos = [], {}
        for b in h['bloques']:
            lab = b['label']
            geo = {k: b[k] for k in ('r0', 'r1', 'c0', 'c1')}
            if b['fill'] == MUEBLE:
                if h['tipo'] == 'deposito':
                    m = re.search(r'(\d+)', lab)
                    num = int(m.group(1)) if m else proximo()
                    desc = re.sub(r'^estanter[ií]a\s*', '', lab, flags=re.I)
                    desc = re.sub(r'^\d+$', '', desc).strip()
                    if not desc and not m:
                        desc = 'sin nombre'
                    nombre = 'Estantería %d' % num + (' · ' + desc if desc else '')
                    celdas.append(dict(id='est%d' % num, nombre=nombre, tipo='estanteria', num=num, **geo))
                else:
                    if not lab:
                        sin_nombre[pid] = sin_nombre.get(pid, 0) + 1
                        lab = 'Sin nombre %d' % sin_nombre[pid]
                    vistos[lab] = vistos.get(lab, 0) + 1
                    nombre = lab if vistos[lab] == 1 else '%s %d' % (lab, vistos[lab])
                    celdas.append(dict(id=slugify(nombre), nombre=nombre, tipo='sector', **geo))
            else:
                if lab:
                    vistos[lab] = vistos.get(lab, 0) + 1
                    nombre = lab if vistos[lab] == 1 else '%s %d' % (lab, vistos[lab])
                    celdas.append(dict(id=slugify(nombre), nombre=nombre, tipo='servicio', **geo))
                else:
                    celdas.append(dict(id='hueco-%d-%d' % (b['r0'], b['c0']), nombre='', tipo='hueco', **geo))
        # la primera ocurrencia de un rótulo repetido también lleva número («ind. Dama 1»)
        for c in celdas:
            base = re.sub(r' \d+$', '', c['nombre'])
            if c['tipo'] in ('sector', 'servicio') and vistos.get(c['nombre'], 0) > 1:
                c['nombre'] = c['nombre'] + ' 1'; c['id'] = slugify(c['nombre'])
        plantas.append(dict(id=pid, nombre=h['nombre'], tipo=h['tipo'], filas=h['filas'], cols=h['cols'], celdas=celdas))

    # proporción de la celda en el Excel (ancho de columna en caracteres → px, alto 15 pt = 20 px)
    ws0 = wb.worksheets[0]
    ancho = None
    for k, d in ws0.column_dimensions.items():
        if d.width:
            ancho = d.width; break
    ancho = ancho or ws0.sheet_format.defaultColWidth or 8.43
    aspecto = round((ancho * 7 + 5) / 20, 2)

    # fusionar con los planos de otras sucursales ya generados
    todos = {}
    if os.path.exists(DEST):
        txt = open(DEST, encoding='utf-8').read()
        m = re.search(r'window\.PLANOS_SUC\s*=\s*(\{.*\});', txt, re.S)
        if m:
            todos = json.loads(m.group(1))
    todos[slug] = dict(fuente=os.path.basename(xlsx), generado=datetime.date.today().isoformat(),
                       aspecto=aspecto, plantas=plantas)
    js = ('/* Generado por scripts/gen-plano-sucursal.py — NO editar a mano. Un plano por slug de sucursal. */\n'
          'window.PLANOS_SUC = ' + json.dumps(todos, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(DEST, 'w', encoding='utf-8').write(js)
    print('OK', DEST, os.path.getsize(DEST), 'bytes · aspecto', aspecto)
    for p in plantas:
        print('==', p['nombre'], '(%s, %dx%d)' % (p['tipo'], p['filas'], p['cols']))
        for c in p['celdas']:
            if c['tipo'] != 'hueco':
                print('   %-10s %s' % (c['tipo'], c['nombre']))


if __name__ == '__main__':
    main()
