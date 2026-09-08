#!/usr/bin/env python3
"""
extraer-reviews-excel.py — Extrae datos de reviews del Excel de Iván
Genera reviews-data.json con histórico completo 2024-2026

Uso: python extraer-reviews-excel.py "ruta/Porcentaje de buenas y malas criticas.xlsx"
"""

import openpyxl
import json
import sys
from datetime import datetime
from collections import defaultdict

def extract_reviews_data(excel_path):
    """Lee el Excel y extrae estructura: {sucursal: [{mes, buenas, malas, tickets, %}]}"""

    wb = openpyxl.load_workbook(excel_path, data_only=True)

    reviews_data = defaultdict(list)

    # Procesar cada hoja
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        print(f"Procesando hoja: {sheet_name}")

        # Identificar fechas en la fila 1 (header con fechas)
        # y sucursales en fila 2 con patrón "Sucursal | Buenas | Malas | ... | Sucursal..."

        dates = []
        cols_by_date = {}  # {fecha: [col_sucursal, col_buenas, col_malas, col_tickets, col_pct]}

        # Buscar encabezados con fechas (fila 1) y estructura Sucursal/Buenas/Malas
        row = 1
        col_idx = 1

        while col_idx <= ws.max_column:
            date_cell = ws.cell(row=1, column=col_idx).value
            suc_header = ws.cell(row=2, column=col_idx).value

            if date_cell and suc_header == "Sucursal":
                # Encontramos un bloque de fecha
                try:
                    if isinstance(date_cell, datetime):
                        fecha_str = date_cell.strftime("%Y-%m")
                    else:
                        fecha_str = str(date_cell).split()[0]  # Tomar solo la parte de fecha
                        fecha_str = fecha_str.replace("00:00:00", "").strip()

                    # Detectar las columnas de este bloque
                    col_buenas = col_idx + 1
                    col_malas = col_idx + 2
                    col_tickets = None
                    col_pct = None

                    # Buscar si hay columnas de Tickets y %
                    if ws.cell(row=2, column=col_idx + 3).value == "Cant. Ticket":
                        col_tickets = col_idx + 3
                        col_buenas = col_idx + 4
                        col_malas = col_idx + 5
                        col_pct = col_idx + 6

                    if fecha_str and fecha_str not in ["", "None"]:
                        cols_by_date[fecha_str] = {
                            "sucursal": col_idx,
                            "buenas": col_buenas,
                            "malas": col_malas,
                            "tickets": col_tickets,
                            "pct": col_pct
                        }
                        print(f"  Encontrada fecha: {fecha_str}")
                except Exception as e:
                    pass

            col_idx += 4  # Saltar bloques de 4 columnas (Sucursal, Buenas, Malas, +)

        # Leer datos de las sucursales (a partir de fila 3)
        for fecha_str, cols in sorted(cols_by_date.items()):
            for row_idx in range(3, ws.max_row + 1):
                sucursal = ws.cell(row=row_idx, column=cols["sucursal"]).value
                if not sucursal or sucursal in ["Total", "TOTAL", ""]:
                    continue

                buenas = ws.cell(row=row_idx, column=cols["buenas"]).value
                malas = ws.cell(row=row_idx, column=cols["malas"]).value
                tickets = None
                pct = None

                if cols["tickets"]:
                    tickets = ws.cell(row=row_idx, column=cols["tickets"]).value
                if cols["pct"]:
                    pct = ws.cell(row=row_idx, column=cols["pct"]).value

                # Normalizar valores
                try:
                    buenas = int(buenas) if buenas else 0
                    malas = int(malas) if malas else 0
                    tickets = int(tickets) if tickets else None
                except:
                    continue

                # Normalizar nombre de sucursal
                sucursal = str(sucursal).strip()

                if buenas > 0 or malas > 0:
                    reviews_data[sucursal].append({
                        "mes": fecha_str,
                        "buenas": buenas,
                        "malas": malas,
                        "tickets": tickets,
                        "porcentaje": pct
                    })

    wb.close()
    return dict(reviews_data)

def normalize_reviews(reviews_dict):
    """Normaliza y ordena los datos"""

    # Mapeo de nombres de sucursales
    name_map = {
        "Calle 12": "calle-12",
        "Calle 47": "calle-47",
        "Calle 49": "calle-49",
        "City Bell": "city-bell",
        "Plaza Italia": "plaza-italia",
        "Los Horno": "los-hornos",
        "Los Hornos": "los-hornos",
        "Ensenada": "ensenada",
        "Berisso": "berisso",
        "Diagonal 80": "diagonal",
        "Aurelius 12": "aurelius-12",
        "Aurelius 5": "aurelius-5",
        "Aurelius 10": "aurelius-10",
        "Aurelius CB": "aurelius-cb",
        "Kids": "kids",
        "Adidas 12": "adidas-12",
        "Adidas Original": "adidas-original",
        "Outlet 55": "outlet-55",
        "Outlet Gonnet": "gonnet",
        "Outlet Avenida": "avenida-44",
        "Outlet Avenida 44": "avenida-44",
    }

    normalized = {}
    for name, slug in name_map.items():
        if name in reviews_dict:
            # Ordenar por mes
            reviews_sorted = sorted(reviews_dict[name], key=lambda x: x["mes"])
            normalized[slug] = {
                "nombre": name,
                "reviews": reviews_sorted
            }

    # Agregar las que no están en el mapa pero existen
    for name, data in reviews_dict.items():
        slug = name.lower().replace(" ", "-")
        if slug not in normalized:
            normalized[slug] = {
                "nombre": name,
                "reviews": sorted(data, key=lambda x: x["mes"])
            }

    return normalized

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python extraer-reviews-excel.py 'ruta/archivo.xlsx'")
        sys.exit(1)

    excel_file = sys.argv[1]
    print(f"Leyendo {excel_file}...")

    data = extract_reviews_data(excel_file)
    normalized = normalize_reviews(data)

    # Generar estructura final
    output = {
        "sucursales": normalized,
        "actualizado": datetime.now().isoformat()
    }

    # Imprimir como JSON
    print("\n// Reviews data — Histórico completo")
    print("window.REVIEWS_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";")

    # También guardar a archivo si se especifica
    if len(sys.argv) > 2:
        out_file = sys.argv[2]
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write("// Reviews data — Histórico 2024-2026\n")
            f.write("// Generado por extraer-reviews-excel.py\n\n")
            f.write("window.REVIEWS_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";\n")
        print(f"\n✓ Guardado en {out_file}")
