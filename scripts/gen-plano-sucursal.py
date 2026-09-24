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

Plano dibujado con FORMAS (Berisso, 24/09/2026): si la hoja no tiene celdas pero
sí un dibujo (Insertar → Formas), se leen las formas y se pasan a una grilla de
celdas cuadradas de UNIDAD_EMU:
  - rectángulo gris (relleno sólido bg2) con rótulo = mueble (estantería);
  - rectángulo blanco (lt1) con rótulo, o globo de texto = servicio (baño,
    oficina, PC, «A escalera…»);
  - rectángulo rayado = pared;
  - flechas, vidrios (degradé), arcos, imágenes y grises sin rótulo se ignoran.
    Los girados 90°/270° se dibujan con ancho y alto intercambiados.
  - La estantería toma el número que sigue a «Estantería» («IND. HOMBRE
    ESTANTERIA 1» = 1, descripción «Ind. hombre»).

Forma de la salida (por slug, los demás slugs del archivo se conservan):
  window.PLANOS_SUC = { <slug>: { fuente, generado, aspecto,
    plantas:[{id, nombre, tipo:'salon'|'deposito', filas, cols,
      celdas:[{id, nombre, tipo:'sector'|'estanteria'|'servicio'|'hueco'|'pared', num?, r0,r1,c0,c1}]}] } }
"""
import sys, os, re, json, datetime, unicodedata, zipfile, posixpath
import openpyxl

MUEBLE = 'FF8FC1E3'
PARED = 'PARED'
UNIDAD_EMU = 127000   # una celda de la grilla = 0,133" del dibujo
DEST = os.path.join('shared', 'planos-sucursal.js')


def slugify(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def limpiar(v):
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''


def bonito(t):
    """«CALZADO  VERANO» → «Calzado verano» (solo si viene todo en mayúsculas)."""
    t = re.sub(r'\s+([.,])', r'\1', limpiar(t))
    t = t[:1].upper() + t[1:].lower() if t and t == t.upper() else t
    for mal, bien in (('Garantias', 'Garantías'), ('Salon', 'Salón'), ('edlp', 'EDLP'), ('gelp', 'GELP'),
                      ('Acces.', 'Accesorios'), ('Of. ', 'Oficina ')):
        t = re.sub(r'(?<!\w)' + re.escape(mal) + (r'(?!\w)' if mal[-1].isalnum() else ''), bien, t)
    return t


def dibujo_de_hojas(xlsx):
    """{nombre de hoja: xml del dibujo} de las hojas que tienen formas."""
    z = zipfile.ZipFile(xlsx)

    def rels(path):
        d, f = posixpath.split(path)
        rp = posixpath.join(d, '_rels', f + '.rels')
        if rp not in z.namelist():
            return {}
        x = z.read(rp).decode('utf-8', 'replace')
        return {m.group(1): posixpath.normpath(posixpath.join(d, m.group(2)))
                for m in re.finditer(r'Id="(\w+)"[^>]*Target="([^"]+)"', x)}
    wbx = z.read('xl/workbook.xml').decode('utf-8', 'replace')
    wrel = rels('xl/workbook.xml')
    out = {}
    for m in re.finditer(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="(\w+)"', wbx):
        hoja = wrel.get(m.group(2))
        for tgt in (rels(hoja).values() if hoja else []):
            if '/drawings/' in tgt and tgt.endswith('.xml'):
                out[m.group(1)] = z.read(tgt).decode('utf-8', 'replace')
    return out


def leer_formas(ws, xml):
    tipo_planta = 'deposito' if re.search(r'dep', ws.title, re.I) else 'salon'
    bloques = []
    for a in re.findall(r'<xdr:twoCellAnchor.*?</xdr:twoCellAnchor>', xml, re.S):
        if not re.search(r'<xdr:sp[ >]', a):
            continue                                   # imágenes, grupos, conectores
        sppr = a.split('</xdr:spPr>')[0]
        geom = (re.search(r'prst="(\w+)"', sppr) or [None, ''])[1]
        xf = re.search(r'<a:xfrm([^>]*)><a:off x="(-?\d+)" y="(-?\d+)"/><a:ext cx="(\d+)" cy="(\d+)"', sppr)
        if not xf:
            continue
        rot = int((re.search(r'rot="(-?\d+)"', xf.group(1)) or [None, '0'])[1]) // 60000 % 180
        x, y, w, h = (int(v) for v in xf.groups()[1:])
        if rot == 90:                                  # girado: mismo centro, lados cambiados
            cx, cy = x + w / 2, y + h / 2
            w, h = h, w
            x, y = cx - w / 2, cy - h / 2
        lab = limpiar(' '.join(re.findall(r'<a:t>(.*?)</a:t>', a, re.S)))
        relleno = sppr.split('<a:ln')[0]
        if geom == 'rect' and 'pattFill' in relleno:
            fill = PARED
        elif geom == 'rect' and re.search(r'<a:solidFill><a:schemeClr val="bg2"', relleno) and lab:
            fill = MUEBLE
        elif lab and (geom == 'wedgeRectCallout' or (geom == 'rect' and '<a:solidFill>' in relleno)):
            fill = ''
        else:
            continue
        u = UNIDAD_EMU
        c0, r0 = round(x / u), round(y / u)
        c1, r1 = max(c0, round((x + w) / u) - 1), max(r0, round((y + h) / u) - 1)
        bloques.append(dict(label=bonito(lab), fill=fill, r0=r0, r1=r1, c0=c0, c1=c1))
    if not bloques:
        return None
    rmin = min(b['r0'] for b in bloques); cmin = min(b['c0'] for b in bloques)
    for b in bloques:
        b['r0'] -= rmin; b['r1'] -= rmin; b['c0'] -= cmin; b['c1'] -= cmin
    # orden de dibujo: paredes, servicios y arriba los muebles; dentro, izq→der y arriba→abajo
    capa = {PARED: 0, '': 1, MUEBLE: 2}
    bloques.sort(key=lambda b: (capa[b['fill']], b['c0'], b['r0']))
    nombre = re.sub(r'^Depo\b', 'Depósito', ws.title).replace('Deposito', 'Depósito').replace('Salon', 'Salón')
    return dict(nombre=nombre, tipo=tipo_planta, bloques=bloques, formas=True,
                filas=max(b['r1'] for b in bloques) + 1, cols=max(b['c1'] for b in bloques) + 1)


def num_est(lab):
    """Número de la estantería: el que sigue a «Estantería», o el único del rótulo."""
    return re.search(r'estanter[ií]a\s*(\d+)', lab, re.I) or re.search(r'(\d+)', lab)


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
    dibujos = dibujo_de_hojas(xlsx)
    hojas = [h for h in ((leer_hoja(ws) or (leer_formas(ws, dibujos[ws.title]) if ws.title in dibujos else None))
                         for ws in wb) if h]

    # números de estantería ya ocupados
    usados = set()
    for h in hojas:
        if h['tipo'] != 'deposito':
            continue
        for b in h['bloques']:
            m = num_est(b['label'])
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
                    m = num_est(lab)
                    num = int(m.group(1)) if m else proximo()
                    desc = re.sub(r'estanter[ií]a\s*\d*', '', lab, flags=re.I)
                    desc = re.sub(r'^\d+$', '', desc.strip(' -·')).strip()
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
            elif b['fill'] == PARED:
                celdas.append(dict(id='pared-%d' % len(celdas), nombre='', tipo='pared', **geo))
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
    if all(h.get('formas') for h in hojas):
        aspecto = 1                                    # grilla de formas: celda cuadrada

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
            if c['tipo'] not in ('hueco', 'pared'):
                print('   %-10s %s' % (c['tipo'], c['nombre']))


if __name__ == '__main__':
    main()
