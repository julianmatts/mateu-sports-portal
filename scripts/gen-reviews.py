#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-reviews.py — genera reviews/reviews-data.js desde el Excel de Ivan
("Porcentaje de buenas y malas criticas.xlsx").

    python scripts/gen-reviews.py "C:/ruta/Porcentaje de buenas y malas criticas.xlsx"

Estructura del Excel (una hoja por anio, "2025" y "2026"):
  - Cada MES es un BLOQUE de columnas contiguo. Los bloques NO tienen ancho fijo:
    arrancan en 3 columnas (Sucursal | Buenas | Malas) y van creciendo con el tiempo
    hasta 8 (+ Cant. Ticket, %, Ultima opinion tomada, opiniones totales, Resenias nuevas).
    Por eso el bloque se detecta buscando 'Sucursal' en la fila 2 y leyendo los
    encabezados contiguos, NUNCA saltando de a N columnas.
  - Fila 1 del bloque: la FECHA EN QUE SE TOMO el dato y, a veces, una etiqueta con el
    mes al que corresponde. El dato de un mes se toma a principios del mes siguiente
    (los datos de junio se leyeron el 04/07). Ver periodo_de_bloque().
  - Cada bloque tiene su PROPIO orden de sucursales (los ultimos vienen ordenados por
    tasa), asi que hay que leer el nombre fila por fila dentro del bloque.

Ojo con la columna '%': es Buenas / Cant. Ticket, o sea la TASA DE CAPTACION de
resenias sobre tickets emitidos, no la satisfaccion. Se recalcula aca y no se
copia del Excel.
"""

import json
import re
import sys
import unicodedata
from collections import OrderedDict
from datetime import datetime, date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Falta openpyxl:  pip install openpyxl")


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

# Nombre del Excel -> slug del portal. El Excel escribe algunos con variantes
# ("Los Horno" / "Los Hornos"), asi que se normaliza antes de buscar aca.
SLUGS = {
    "calle 12": ("calle-12", "Calle 12"),
    "calle 47": ("calle-47", "Calle 47"),
    "calle 49": ("calle-49", "Calle 49"),
    "city bell": ("city-bell", "City Bell"),
    "plaza italia": ("plaza-italia", "Plaza Italia"),
    "los horno": ("los-hornos", "Los Hornos"),
    "los hornos": ("los-hornos", "Los Hornos"),
    "ensenada": ("ensenada", "Ensenada"),
    "berisso": ("berisso", "Berisso"),
    "diagonal 80": ("diagonal", "Diagonal 80"),
    "kids": ("kids", "Kids"),
    "adidas 7": ("adidas-7", "Adidas 7"),
    "adidas 12": ("adidas-12", "Adidas 12"),
    "adidas originals": ("adidas-originals", "Adidas Originals"),
    "adidas original": ("adidas-originals", "Adidas Originals"),
    "aurelius 5": ("aurelius-5", "Aurelius 5"),
    "aurelius 10": ("aurelius-10", "Aurelius 10"),
    "aurelius 12": ("aurelius-12", "Aurelius 12"),
    "aurelius cb": ("aurelius-cb", "Aurelius CB"),
    "outlet 55": ("outlet-55", "Outlet 55"),
    "outlet gonnet": ("gonnet", "Outlet Gonnet"),
    "outlet avenida 44": ("avenida-44", "Outlet Avenida 44"),
    "outlet avenida": ("avenida-44", "Outlet Avenida 44"),
}

# Encabezado del Excel -> campo interno.
CAMPOS = {
    "sucursal": "suc",
    "buenas": "b",
    "malas": "m",
    "cant. ticket": "t",
    "cant ticket": "t",
    "ultima opinion tomada": "autor",
    "opiniones total por local": "total",
    "resenas nuevas": "nuevas",   # norm() deja 'Resenias nuevas' sin la tilde de la enie
}


def norm(s):
    """minusculas, sin acentos, sin espacios de mas."""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def campo_de(encabezado):
    n = norm(encabezado)
    if n in CAMPOS:
        return CAMPOS[n]
    # "opiniones al 1-7", "opiniones al 3/8", "opiniones al 7/9" = mismo acumulado
    # con otro nombre segun el dia en que se leyo.
    if n.startswith("opiniones al") or n.startswith("opiniones total"):
        return "total"
    if n.startswith("%"):
        return None  # se recalcula
    return None


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return v
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return None


def entero(v):
    n = num(v)
    return int(round(n)) if n is not None else None


def periodo_de_bloque(etiqueta, fechas):
    """
    Devuelve 'YYYY-MM' del mes que MIDE el bloque.

    Tres casos, en orden de prioridad:

    1) Etiqueta con el nombre del mes: manda, es lo que escribio quien carga la
       planilla. El anio sale de la fecha: si el mes de la etiqueta es posterior al
       de la toma, es del anio anterior ('Diciembre' leido el 10/01/2025 -> 2024-12).
    2) Dos fechas en el bloque (los meses de 2026): la primera es el 1o del mes
       medido y la segunda el dia en que se leyo (01/03/2026 + 06/04/2026 = marzo).
    3) Una sola fecha: el dato se lee a principios del mes siguiente, asi que el
       periodo es el mes anterior (leido el 08/08/2024 -> julio 2024).
    """
    mes_et = None
    if etiqueta:
        n = norm(etiqueta)
        if n in MESES:
            mes_et = MESES.index(n) + 1

    if not fechas:
        return None
    if mes_et:
        anio = fechas[0].year - 1 if mes_et > fechas[0].month else fechas[0].year
        return "%04d-%02d" % (anio, mes_et)
    if len(fechas) > 1:
        return "%04d-%02d" % (fechas[0].year, fechas[0].month)
    m, a = fechas[0].month - 1, fechas[0].year
    if m == 0:
        m, a = 12, a - 1
    return "%04d-%02d" % (a, m)


def leer_bloques(ws):
    """Encuentra los bloques de la hoja. Devuelve [(periodo, fecha, {campo: col})]."""
    bloques = []
    col = 1
    while col <= ws.max_column:
        if norm(ws.cell(row=2, column=col).value) != "sucursal":
            col += 1
            continue

        # Encabezados contiguos: el bloque termina en la primera columna sin
        # encabezado en la fila 2 (las planillas dejan una vacia entre bloques).
        cols, c = {}, col
        while c <= ws.max_column:
            enc = ws.cell(row=2, column=c).value
            if enc is None or str(enc).strip() == "":
                break
            campo = campo_de(enc)
            if campo and campo not in cols:
                cols[campo] = c
            c += 1
        fin = c

        # Fila 1 dentro del bloque: fecha(s) + etiqueta del mes.
        fechas, etiqueta = [], None
        for cc in range(col, fin):
            v = ws.cell(row=1, column=cc).value
            if isinstance(v, (datetime, date)):
                fechas.append(v.date() if isinstance(v, datetime) else v)
            elif isinstance(v, str) and norm(v) in MESES and etiqueta is None:
                etiqueta = v

        if "suc" in cols and "b" in cols:
            bloques.append((periodo_de_bloque(etiqueta, fechas), fechas, cols))
        col = fin

    return bloques


def leer(xlsx):
    """{slug: {'nombre': str, 'serie': {periodo: fila}}}"""
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    datos = {}
    vistos = {}       # periodo -> firma, para detectar bloques repetidos entre hojas
    desconocidas = set()

    for hoja in wb.sheetnames:
        ws = wb[hoja]
        for periodo, fechas, cols in leer_bloques(ws):
            if not periodo:
                continue

            filas = []
            for r in range(3, ws.max_row + 1):
                nombre = ws.cell(row=r, column=cols["suc"]).value
                clave = norm(nombre)
                if not clave or clave in ("total", "sucursal"):
                    continue
                if clave not in SLUGS:
                    desconocidas.add(str(nombre).strip())
                    continue

                slug, bonito = SLUGS[clave]
                fila = {
                    "b": entero(ws.cell(row=r, column=cols["b"]).value) or 0,
                    "m": entero(ws.cell(row=r, column=cols["m"]).value) if "m" in cols else 0,
                }
                fila["m"] = fila["m"] or 0
                for campo in ("t", "total", "nuevas"):
                    if campo in cols:
                        v = entero(ws.cell(row=r, column=cols[campo]).value)
                        if v is not None:
                            fila[campo] = v
                if "autor" in cols:
                    v = ws.cell(row=r, column=cols["autor"]).value
                    if v and str(v).strip():
                        fila["autor"] = re.sub(r"\s+", " ", str(v)).strip()
                if fila["b"] or fila["m"]:
                    filas.append((slug, bonito, fila))

            if not filas:
                continue

            # Un mismo bloque aparece en las dos hojas (el corte de anio se repite):
            # si el contenido es identico, es el mismo dato y se ignora. Si es
            # distinto, la etiqueta esta corrida y va al primer mes libre.
            # La firma va ordenada por sucursal porque cada hoja las lista en
            # distinto orden (las ultimas vienen ordenadas por tasa).
            firma = json.dumps(sorted((s, f["b"], f["m"], f.get("t")) for s, _, f in filas))
            if periodo in vistos:
                if vistos[periodo] == firma:
                    continue
                y, m = int(periodo[:4]), int(periodo[5:])
                while periodo in vistos:
                    m += 1
                    if m == 13:
                        m, y = 1, y + 1
                    periodo = "%04d-%02d" % (y, m)
            vistos[periodo] = firma

            for slug, bonito, fila in filas:
                d = datos.setdefault(slug, {"nombre": bonito, "serie": {}})
                d["serie"][periodo] = fila

    wb.close()
    if desconocidas:
        print("  ! sucursales sin slug (se saltearon): " + ", ".join(sorted(desconocidas)))
    return datos


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    xlsx = Path(sys.argv[1])
    salida = Path(sys.argv[2]) if len(sys.argv) > 2 else \
        Path(__file__).resolve().parent.parent / "reviews" / "reviews-data.js"

    print("Leyendo %s ..." % xlsx.name)
    datos = leer(xlsx)

    periodos = sorted({p for d in datos.values() for p in d["serie"]})
    print("  %d sucursales, %d periodos (%s -> %s)"
          % (len(datos), len(periodos), periodos[0], periodos[-1]))

    salida_datos = OrderedDict()
    for slug in sorted(datos, key=lambda s: datos[s]["nombre"]):
        d = datos[slug]
        salida_datos[slug] = OrderedDict([
            ("nombre", d["nombre"]),
            ("serie", OrderedDict((p, d["serie"][p]) for p in periodos if p in d["serie"])),
        ])

    payload = OrderedDict([
        ("fuente", xlsx.name),
        ("generado", datetime.now().strftime("%Y-%m-%d")),
        ("periodos", periodos),
        ("sucursales", salida_datos),
    ])

    salida.parent.mkdir(parents=True, exist_ok=True)
    with salida.open("w", encoding="utf-8") as f:
        f.write("// Resenias de Google por sucursal. NO editar a mano.\n")
        f.write("// Generado por scripts/gen-reviews.py desde \"%s\".\n" % xlsx.name)
        f.write("// b=buenas  m=malas  t=tickets  total=resenias acumuladas del local\n")
        f.write("// nuevas=resenias nuevas del mes  autor=quien dejo la ultima opinion leida\n\n")
        f.write("window.REVIEWS_DATA = ")
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print("  -> %s (%.0f KB)" % (salida, salida.stat().st_size / 1024))


if __name__ == "__main__":
    main()
