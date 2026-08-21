# Carga la venta de la SEMANA EN CURSO a Firebase (recepciones-mateu / ventaEquipo/<slug>/<lunesISO>),
# por sucursal y vendedor, desde la estadistica detallada por linea del sistema ("Semana DD-MM-AA.xls":
# Sucursal | Dia semana | Dia | Vendedor | Hora | Nro.comprobante | Articulo | Rubro | Cantidad | Importe).
# Es el "real provisorio" que ven Indicadores (pill prov) y el dashboard de Objetivos (Venta parcial);
# el real OFICIAL lo completa el HISTORICO del Excel PMS del lunes. Mismos criterios por linea que
# scripts/etl_indicadores.py (criterio_linea): ticket = comprobante no-Nc con unidades > 0.
#   python scripts/cargar-venta-semana.py "C:/Users/julia/Downloads/Semana 17-08-26.xls" 2026-08-17 [--publicar]
# Sin --publicar solo imprime el resumen por sucursal vs. la meta publicada. Requiere xlrd (pip install xlrd).
import sys, json, unicodedata, collections, datetime as dt, urllib.request
import xlrd

ARCHIVO, SEMANA = sys.argv[1], sys.argv[2]
PUBLICAR = '--publicar' in sys.argv
URL = 'https://recepciones-mateu-default-rtdb.firebaseio.com'
PFX_SLUG = {'01':'plaza','02':'kids','03':'calle-55','04':'aurelius-12','06':'city-bell','07':'aurelius-10',
  '08':'calle-47','09':'adidas','10':'diagonal','11':'ensenada','12':'calle-12','13':'los-hornos','14':'gonnet',
  '15':'originals','16':'berisso','17':'aurelius-cb','18':'aurelius-5','19':'calle-49','20':'av-44','21':'adidas-12','99':'ecommerce'}
DOW = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']

def norm(s):
    s = unicodedata.normalize('NFD', str(s if s is not None else '')).encode('ascii','ignore').decode()
    return ' '.join(s.upper().split())

def criterio_linea(rubro, articulo):            # copia fiel del ETL
    r, a = rubro, articulo
    if r == 'OTROS': return (False, False)
    if r == '01-VARIOS': return (False, False) if a == 'REDONDEO' else (True, True)
    if r == 'CONCEPTOS':
        if a.startswith('CREDITO A FAVOR'): return (True, True)
        if a.startswith('INGRESO CUPON') or 'LLAVERO COMPRA GRANDE' in a: return (False, False)
        if a.startswith('CONCEPTOS VARIOS'): return (False, False)
        return (False, True)
    return (True, True)

wb = xlrd.open_workbook(ARCHIVO); sh = wb.sheet_by_index(0)
hdr = [norm(sh.cell_value(2,c)) for c in range(sh.ncols)]
assert hdr[0]=='SUCURSAL' and hdr[5].startswith('NRO') and hdr[8]=='CANTIDAD' and hdr[9]=='IMPORTE', hdr

# 1) agregar por comprobante (atómico): Σ cant (si cuenta), Σ importe (si cuenta), metadata = línea de mayor |importe|
comp = {}
for r in range(3, sh.nrows):
    suc = str(sh.cell_value(r,0)).strip()
    if not suc or suc=='Total': continue
    nro = str(sh.cell_value(r,5)).strip()
    cant = float(sh.cell_value(r,8) or 0); imp = float(sh.cell_value(r,9) or 0)
    ok_c, ok_i = criterio_linea(norm(sh.cell_value(r,7)), norm(sh.cell_value(r,6)))
    k = (suc, nro)
    c = comp.get(k)
    if c is None:
        c = comp[k] = {'cant':0.0,'imp':0.0,'abs':-1,'vend':'','dow':'','dia':''}
    if ok_c: c['cant'] += cant
    if ok_i: c['imp'] += imp
    if abs(imp) > c['abs']:
        c['abs'] = abs(imp); c['vend'] = str(sh.cell_value(r,3)).strip() or 'SIN ASIGNAR'
        c['dow'] = str(sh.cell_value(r,1)).strip(); c['dia'] = str(sh.cell_value(r,2)).strip()

# 2) por sucursal → vendedor → día
suc_v = collections.defaultdict(lambda: collections.defaultdict(lambda: {'venta':0.0,'tickets':0,'unidades':0.0,'dias':collections.defaultdict(float)}))
nc_pos = 0
for (suc, nro), c in comp.items():
    es_nc = nro.startswith('Nc')
    if es_nc and c['imp'] > 0: nc_pos += 1
    v = suc_v[suc][c['vend']]
    v['venta'] += c['imp']; v['unidades'] += c['cant']
    if not es_nc and c['cant'] > 0: v['tickets'] += 1
    if c['imp']: v['dias'][c['dow']] += c['imp']
if nc_pos: print(f'⚠ {nc_pos} notas de crédito con importe positivo (se esperaba negativo)')

# 3) armar payloads
ahora = dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
dias_orden = {d:i for i,d in enumerate(DOW)}
dias_vistos = sorted({c['dow'] for c in comp.values()}, key=lambda d: dias_orden.get(d,9))
etiqueta = f"estadística {dias_vistos[0]}-{dias_vistos[-1]}" if dias_vistos else 'estadística'
updates = {}; resumen = []
for suc, vends in sorted(suc_v.items()):
    slug = PFX_SLUG.get(suc[:2])
    if not slug:
        print(f'  (salteo {suc}: sin slug)'); continue
    lista = []
    for nombre, v in vends.items():
        venta = round(v['venta']); tk = v['tickets']; un = round(v['unidades'])
        if not venta and not tk and not un: continue
        dias = [{'d':d,'v':round(m)} for d,m in sorted(v['dias'].items(), key=lambda x: dias_orden.get(x[0],9)) if round(m)]
        lista.append({'nombre':nombre, 'venta':venta, 'tickets':tk, 'unidades':un, 'dias':dias})
    lista.sort(key=lambda x: -x['venta'])
    total = {'venta':sum(x['venta'] for x in lista), 'tickets':sum(x['tickets'] for x in lista), 'unidades':sum(x['unidades'] for x in lista)}
    updates[f'{slug}/{SEMANA}'] = {'semana':SEMANA, 'actualizado':ahora, 'por':f'julian@mateu.com.ar ({etiqueta})',
                                   'vendedores':lista, 'total':total, 'metaTienda':0, 'minimoTienda':0}
    resumen.append((slug, suc, total, len(lista)))

# 4) resumen vs meta publicada
metas = json.load(urllib.request.urlopen(f'{URL}/objetivos/semanas/{SEMANA}/porSlug.json')) or {}
print(f'\n{"slug":12} {"sucursal":24} {"venta":>14} {"tk":>5} {"un":>6} {"vend":>4}   {"meta":>14}  avance')
tv=0; tm=0
for slug, suc, t, n in resumen:
    m = (metas.get(slug) or {}).get('meta') or 0
    tv += t['venta']; tm += m
    print(f'{slug:12} {suc:24} {t["venta"]:>14,.0f} {t["tickets"]:>5} {t["unidades"]:>6,.0f} {n:>4}   {m:>14,.0f}  {(t["venta"]/m*100 if m else 0):5.1f}%')
print(f'{"TOTAL":12} {"":24} {tv:>14,.0f} {"":>5} {"":>6} {"":>4}   {tm:>14,.0f}  {(tv/tm*100 if tm else 0):5.1f}%')
print(f'\nDías en el archivo: {dias_vistos} - etiqueta "{etiqueta}" - {len(updates)} sucursales')

if PUBLICAR:
    body = json.dumps(updates, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f'{URL}/ventaEquipo.json', data=body, method='PATCH', headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as resp:
        print('PATCH ventaEquipo ->', resp.status, f'({len(body)/1024:.0f} KB)')
else:
    print('(modo seco: agregar --publicar para escribir en Firebase)')
