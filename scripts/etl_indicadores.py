"""ETL Indicadores de Sucursal · Mateu Sports
Lee el export de ventas del mes + el staff, y emite un JSON por período.
Uso: python3 etl_indicadores.py

Salida:
  out/indicadores-<periodo>.json     dataset combinado del período (lo que ve el ETL)
  out/indicadores/…                  SALIDA PARTICIONADA que consume el Portal:
      objetivos.json                 targets por formato
      periodos.json                  períodos disponibles (más nuevo primero)
      <periodo>/cadena.json          agregados de las 20 sucursales, SIN personas
      <periodo>/<NN-Nombre>.json     KPIs + personas de esa sucursal
  Copiar out/indicadores/ a data/indicadores/ del repo.
  El navegador de un usuario de sucursal solo pide su archivo + cadena.json:
  las personas de las otras sucursales nunca llegan al cliente.
"""
import pandas as pd, numpy as np, json, datetime as dt, unicodedata, os

STAFF = '/mnt/user-data/uploads/Sucursales_staff.xlsx'
# Períodos RETAIL: lunes a domingo. Mayo = 5 semanas (27/4 al 31/5) · Junio = 4 semanas (1/6 al 28/6)
PERIODOS = {
  '2026-05': dict(archivo='/mnt/user-data/uploads/Ventas_por_sucursal_y_vendedores_mayo_26.xlsx',
                  desde=dt.date(2026,4,27), hasta=dt.date(2026,5,31)),
  '2026-06': dict(archivo='/mnt/user-data/uploads/Venta_por_vendedores_y_sucursales.xlsx',
                  desde=dt.date(2026,6,1),  hasta=dt.date(2026,6,28)),
}
DOW = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

def semana_retail(f, desde):
    """N° de semana retail (lunes a domingo) de la fecha f dentro del período que
    arranca en 'desde'. Alineada al calendario: la semana que contiene el 1° del mes
    es la SEMANA 1 de ese mes (arranca el lunes, aunque ese lunes caiga en el mes
    anterior). Robusto aunque 'desde' no sea exactamente lunes."""
    lun_f = f - dt.timedelta(days=f.weekday())          # lunes de la semana de f
    lun_0 = desde - dt.timedelta(days=desde.weekday())  # lunes de la semana del inicio del período
    return (lun_f - lun_0).days // 7 + 1
OUT = '/home/claude/out'

# Objetivos por formato (los define Producto). El cumplimiento de cada sucursal se
# mide SIEMPRE contra el objetivo de SU formato, nunca contra el promedio de la cadena.
OBJETIVOS = {
  'MS':       {'tickets_hora': 1.30, 'upt': 1.85, 'ticket_promedio': 118000},
  'Adidas':   {'tickets_hora': 1.75, 'upt': 1.55, 'ticket_promedio': 185000},
  'Outlet':   {'tickets_hora': 1.45, 'upt': 2.00, 'ticket_promedio': 95000},
  'Aurelius': {'tickets_hora': 0.80, 'upt': 1.60, 'ticket_promedio': 155000},
  'Kids':     {'tickets_hora': 1.10, 'upt': 1.55, 'ticket_promedio': 80000},
}
MES_STOCK = {'01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
             '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE'}
MES_NOMBRE = {'01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio',
              '07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre'}
ECOM = '99-Ecommerce'
GRUPOS_PISO = ['Ventas','Caja','Jefatura','Refuerzos']

def formato_de(nombre):
    n = (nombre or '').lower()
    if 'ecommerce' in n: return 'Ecommerce'
    if 'aurelius' in n:  return 'Aurelius'
    if 'adidas' in n:    return 'Adidas'
    if 'outlet' in n:    return 'Outlet'
    if 'kids' in n:      return 'Kids'
    return 'MS'

def archivo_de(nombre):
    return nombre.replace('.', '').replace(' ', '-')

# Roles deducidos del horario real (no figuran en el staff) · CONFIRMAR
MANUAL = {
 'TAUBE RENATA':                 ('09-Adidas Av. 7',  'Vend. Part Time Tarde'),
 'LATTINI CARLA':                ('06-MS City Bell',  'Caj. Part Time Mañana'),
 'LASORSA MICAELA ELIZABETH':    ('13-MS Los Hornos', 'Vend. Full Time'),
 'PUJOL MERCADO MARIA VICTORIA': ('11-MS Ensenada',   'Vend. Full Time'),
 'PARDO AUGUSTO':                ('14-Outlet Gonnet', 'Vend. Refuerzo 3 Días'),
 'LEDESMA JANO':                 ('06-MS City Bell',  'Vend. Full Time'),
 'PEREA FRANCO':                 ('01-MS Plaza Italia','Vend. Full Time'),
}
DEPOSITO  = ['BUZZELLA IVAN','ROUCO NAHUEL','TREZEGUET DIEGO','GUIDA FABIAN',
             'MATEU AGUSTIN','LOPEZ IVAN','DE GRANDIS DAMIAN']
EVENTUAL  = ['LEMOS FRANCO EMANUEL','GARCIA SALINAS CAMILO','BOLZANI MARIA CANDELA',
             'CABAÑAS MERELES CLARISA']
ECOM_P    = ['ASPIROZ ALFREDO']

# ── STAFF ────────────────────────────────────────────────────────────────
def cargar_staff():
    st = pd.read_excel(STAFF); st.columns = ['sucursal','sector','vendedor','comp']
    st = st[st.sucursal != '05-Depósito'][['sucursal','sector','vendedor']]
    st = pd.concat([st, pd.DataFrame([{'sucursal':s,'sector':r,'vendedor':v} for v,(s,r) in MANUAL.items()])])
    st['propuesto'] = st.vendedor.isin(MANUAL)
    st['grupo'] = st.sector.map(lambda s: 'Ventas' if s.startswith('Vend') else
                                          'Caja'   if s.startswith('Caj')  else
                                          'Jefatura' if 'Encargado' in s   else 'Otros')
    st['au'] = st.sucursal.str.contains('Aurelius')
    def horario(r):
        s, au = r.sector, r.au
        if 'Refuerzo' in s:                       return (12, 19, 8,  3)   # 8 h · 3 días/sem
        if 'Part Time Mañana' in s:               return ((10,15,6,6) if au else (9,14,6,6))
        if 'Part Time Tarde' in s:                return (14, 19, 6, 6)
        if 'Encargado' in s and 'Part Time' in s: return ((10,15,6,6) if au else (9,14,6,6))
        if s in ('Encargado','Sub Encargado'):    return ((10,18,9,6) if au else (9,17,9,6))
        if 'Full Time' in s:                      return ((10,19,9,6) if au else (9,19,9,6))
        return (None, None, 0, 0)                                          # eCommerce · Administración
    st[['h_ini','h_fin','h_dia','d_sem']] = st.apply(lambda r: pd.Series(horario(r)), axis=1)
    return st

# ── VENTAS ───────────────────────────────────────────────────────────────
def fechas_del_periodo(cfg):
    """Todas las fechas del período retail, indexadas por (día del mes, día de semana).
    El export solo trae el número de día, y el período puede cruzar dos meses
    (mayo arranca el 27 de abril), así que el par día+día_semana desambigua."""
    f, idx = cfg['desde'], {}
    while f <= cfg['hasta']:
        idx[(f.day, DOW[f.weekday()])] = f
        f += dt.timedelta(days=1)
    return idx

def cargar_ventas(cfg):
    v = pd.read_excel(cfg['archivo'])
    v.columns = ['sucursal','dia_semana','dia','vendedor','hora','comprobante','cantidad','importe']
    v = v[(v.sucursal != 'Total') & (v.dia != 'Total') & (v.sucursal != '05-Depósito')].copy()
    v['dia'] = v.dia.astype(int); v['hora'] = v.hora.astype(int)
    v['vendedor'] = v.vendedor.fillna('SIN ASIGNAR')
    idx = fechas_del_periodo(cfg)
    v['fecha'] = [idx.get((d, ds)) for d, ds in zip(v.dia, v.dia_semana)]
    huerfanas = v.fecha.isna().sum()
    if huerfanas:
        print(f'  ⚠ {huerfanas} filas con día/día-semana fuera del período: se descartan')
        v = v[v.fecha.notna()]
    v['es_nc'] = v.comprobante.str.startswith('Nc')
    return v

def procesar(per, cfg, st):
    v  = cargar_ventas(cfg)
    nc = v[v.es_nc]
    vt = v[(~v.es_nc) & (v.cantidad > 0)].copy()          # fuera: canjes sin importe y operaciones sin unidades
    vt['dia'] = vt.fecha                                  # fecha real: el período puede cruzar dos meses
    vt['sem'] = vt['dia'].apply(lambda f: semana_retail(f, cfg['desde']))     # semana retail (Lu-Do)

    n_dias  = (cfg['hasta'] - cfg['desde']).days + 1
    habiles = sum(1 for i in range(n_dias) if (cfg['desde'] + dt.timedelta(days=i)).weekday() < 6)  # Lu–Sá
    semanas = n_dias / 7

    st = st.copy()
    st['horas_contr'] = np.where(st.d_sem == 6, st.h_dia * habiles,
                        np.where(st.d_sem == 3, st.h_dia * 3 * semanas, 0))

    # sucursal fija = donde hizo más tickets
    tkv  = vt.groupby(['vendedor','sucursal']).comprobante.nunique().rename('tk').reset_index()
    fija = tkv.sort_values('tk', ascending=False).drop_duplicates('vendedor').set_index('vendedor').sucursal
    st['es_fija'] = st.apply(lambda r: fija.get(r.vendedor) == r.sucursal, axis=1)
    rol = st.sort_values('es_fija', ascending=False).drop_duplicates('vendedor').set_index('vendedor')

    def meta(n):
        if n in rol.index:
            r = rol.loc[n]
            return r.sector, r.grupo, float(r.horas_contr), bool(r.propuesto), r.sucursal
        if n in DEPOSITO: return 'Depósito · refuerzo', 'Refuerzos', None, False, None
        if n in EVENTUAL: return 'Eventual', 'Refuerzos', None, False, None
        if n in ECOM_P:   return 'eCommerce', 'Otros', 0.0, False, None
        return 'Sin rol', 'Gerencia / otros', 0.0, False, None

    vt['sector'] = vt.vendedor.map(lambda n: meta(n)[0])
    vt['grupo']  = vt.vendedor.map(lambda n: meta(n)[1])

    # horas: contrato prorrateado entre sucursales cubiertas · eventuales = franja real de su venta
    span = vt.groupby(['vendedor','sucursal','dia']).hora.agg(['min','max'])
    span['h'] = (span['max'] - span['min'] + 1).clip(upper=11)
    ev_h = span.groupby(['vendedor','sucursal']).h.sum()

    ha = vt.groupby(['vendedor','sucursal']).apply(
        lambda d: d.groupby(['dia','hora']).ngroups, include_groups=False).rename('h_act').reset_index()
    ha['share'] = ha.h_act / ha.groupby('vendedor').h_act.transform('sum')
    ha['horas_contr'] = ha.apply(
        lambda r: ev_h.get((r.vendedor, r.sucursal), 0) if meta(r.vendedor)[2] is None
                  else meta(r.vendedor)[2] * r.share, axis=1)

    nc_v = nc.groupby(['sucursal','vendedor']).agg(dev_i=('importe','sum'), dev_u=('cantidad','sum')).reset_index()
    vend = vt.groupby(['sucursal','vendedor','sector','grupo']).agg(
        tickets=('comprobante','nunique'), unidades=('cantidad','sum'),
        importe=('importe','sum'), dias=('dia','nunique')).reset_index()
    vend = (vend.merge(ha[['vendedor','sucursal','horas_contr','h_act']], on=['vendedor','sucursal'], how='left')
                .merge(nc_v, on=['sucursal','vendedor'], how='left').fillna({'dev_i':0,'dev_u':0,'horas_contr':0}))
    vend['importe_neto']   = vend.importe + vend.dev_i
    vend['unidades_netas'] = vend.unidades + vend.dev_u
    vend['propuesto'] = vend.vendedor.map(lambda n: meta(n)[3])
    base = vend.vendedor.map(lambda n: meta(n)[4])
    vend['cubre'] = base.notna() & (base != vend.sucursal)

    med = set(vend[vend.horas_contr > 0].set_index(['sucursal','vendedor']).index)
    vt['medible'] = [(s, p) in med for s, p in zip(vt.sucursal, vt.vendedor)]
    vm = vt[vt.medible]

    suc = vm.groupby('sucursal').agg(tickets=('comprobante','nunique'), unidades=('cantidad','sum'),
                                     importe=('importe','sum')).reset_index()
    suc['tickets_todos'] = vt.groupby('sucursal').comprobante.nunique().reindex(suc.sucursal).values
    suc = suc.merge(nc.groupby('sucursal').agg(dev_i=('importe','sum'), dev_u=('cantidad','sum')).reset_index(),
                    on='sucursal', how='left').fillna(0)
    suc['importe_neto']   = suc.importe + suc.dev_i
    suc['unidades_netas'] = suc.unidades + suc.dev_u
    hv  = vend[vend.horas_contr > 0]
    suc = suc.merge(hv.groupby('sucursal')[['horas_contr','h_act']].sum().reset_index(), on='sucursal', how='left')
    suc['personas']  = hv.groupby('sucursal').vendedor.nunique().reindex(suc.sucursal).values
    suc['cobertura'] = (suc.tickets / suc.tickets_todos * 100).round(1)

    e, ne = vt[vt.sucursal == '99-Ecommerce'], nc[nc.sucursal == '99-Ecommerce']
    if len(e):
        suc = pd.concat([suc, pd.DataFrame([{'sucursal':'99-Ecommerce','tickets':e.comprobante.nunique(),
          'tickets_todos':e.comprobante.nunique(),'unidades':e.cantidad.sum(),'importe':e.importe.sum(),
          'dev_i':ne.importe.sum(),'dev_u':ne.cantidad.sum(),
          'importe_neto':e.importe.sum()+ne.importe.sum(),'unidades_netas':e.cantidad.sum()+ne.cantidad.sum(),
          'horas_contr':0,'h_act':0,'personas':e.vendedor.nunique(),'cobertura':100.0}])], ignore_index=True)

    # cobertura vs demanda: horas repartidas sobre los días efectivamente trabajados
    dias_p = vt.groupby(['vendedor','sucursal']).dia.nunique()
    rows = []
    for r in vend.itertuples():
        if r.horas_contr <= 0: continue
        hc = meta(r.vendedor)[2]
        if hc is None:
            d = vt[(vt.vendedor == r.vendedor) & (vt.sucursal == r.sucursal)]
            hi, hf = int(d.hora.min()), int(d.hora.max())
        else:
            hi, hf = int(rol.loc[r.vendedor].h_ini), int(rol.loc[r.vendedor].h_fin)
        nd = dias_p.get((r.vendedor, r.sucursal), 0)
        if not nd or hf < hi: continue
        peso = r.horas_contr / (nd * (hf - hi + 1))
        for h in range(hi, hf + 1):
            rows.append({'sucursal': r.sucursal, 'hora': h, 'dot': peso * nd})
    dot = pd.DataFrame(rows).groupby(['sucursal','hora'])['dot'].sum().reset_index()
    dias_ab = vt.groupby('sucursal').dia.nunique().rename('dias_ab')
    th = vt.groupby(['sucursal','hora']).comprobante.nunique().rename('tickets').reset_index().join(dias_ab, on='sucursal')
    th['tickets_dia'] = th.tickets / th.dias_ab
    dot = dot.merge(dias_ab, on='sucursal'); dot['dot'] = dot['dot'] / dot['dias_ab']
    cov = th.merge(dot[['sucursal','hora','dot']], on=['sucursal','hora'], how='outer').fillna(0)
    cov = cov[(cov.hora >= 9) & (cov.hora <= 19)]

    heat = vt.groupby(['sucursal','dia_semana','hora']).comprobante.nunique().rename('tickets').reset_index()

    # ── semana a semana (semanas retail del mes, Lu-Do, alineadas al calendario) ──
    lun0 = cfg['desde'] - dt.timedelta(days=cfg['desde'].weekday())   # lunes de la 1ª semana
    n_sem = (cfg['hasta'] - lun0).days // 7 + 1
    def rango_sem(s):
        ini = lun0 + dt.timedelta(days=(s - 1) * 7)
        fin = min(cfg['hasta'], ini + dt.timedelta(days=6))
        ini = max(ini, cfg['desde'])
        return f"{ini.strftime('%d/%m')}–{fin.strftime('%d/%m')}"
    ncw = nc.copy()
    ncw['sem'] = ncw['fecha'].apply(lambda f: semana_retail(f, cfg['desde']))
    def semanas_por(gv, gnc, claves):
        a = gv.groupby(claves + ['sem']).agg(tickets=('comprobante','nunique'),
              unidades=('cantidad','sum'), importe=('importe','sum')).reset_index()
        b = gnc.groupby(claves + ['sem']).agg(dev_i=('importe','sum'), dev_u=('cantidad','sum')).reset_index()
        m = a.merge(b, on=claves + ['sem'], how='left').fillna(0)
        m['importe_neto'] = m.importe + m.dev_i
        m['unidades_netas'] = m.unidades + m.dev_u
        out = {}
        for r in m.itertuples(index=False):
            key = tuple(getattr(r, c) for c in claves); s = int(r.sem)
            out.setdefault(key, {})[s] = {'n': s, 'rango': rango_sem(s), 'tickets': int(r.tickets),
                'unidades_netas': round(float(r.unidades_netas), 2), 'importe_neto': round(float(r.importe_neto), 2)}
        return out
    suc_sem  = semanas_por(vm, ncw, ['sucursal'])
    vend_sem = semanas_por(vt, ncw, ['sucursal', 'vendedor'])
    lista_sem = lambda d: [d[s] for s in range(1, n_sem + 1) if s in d]

    suc_recs = suc.round(2).to_dict('records')
    for rec in suc_recs:
        rec['semanas'] = lista_sem(suc_sem.get((rec['sucursal'],), {}))
    vend_recs = vend[['sucursal','vendedor','sector','grupo','tickets','unidades_netas','importe_neto',
                      'horas_contr','h_act','dias','cubre','propuesto']].round(2).to_dict('records')
    for rec in vend_recs:
        rec['semanas'] = lista_sem(vend_sem.get((rec['sucursal'], rec['vendedor']), {}))

    return {'periodo': per,
      'meta': {'dias': f"{cfg['desde'].strftime('%d/%m')}–{cfg['hasta'].strftime('%d/%m')}",
               'habiles': habiles, 'semanas': round(semanas,2)},
      'sucursales': suc_recs,
      'vendedores': vend_recs,
      'cobertura': cov.round(3).to_dict('records'),
      'heatmap': heat.to_dict('records')}

# ── SALIDA PARTICIONADA (lo que consume el Portal) ────────────────────────
def emitir_particionado(data, dest):
    """Parte el dataset combinado en un archivo por sucursal + uno de cadena por
    período. Es la parte que da la seguridad: cadena.json NO lleva personas, y el
    navegador de una sucursal solo pide su propio <NN-Nombre>.json."""
    root = os.path.join(dest, 'indicadores')
    os.makedirs(root, exist_ok=True)
    dump = lambda o, p: json.dump(o, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))

    dump(OBJETIVOS, os.path.join(root, 'objetivos.json'))

    periodos_meta = []
    for per, d in data.items():
        mm = per[5:7]
        pdir = os.path.join(root, per); os.makedirs(pdir, exist_ok=True)

        # buckets por sucursal
        por = {s['sucursal']: {'summary': s, 'vendedores': [], 'cobertura': [], 'heatmap': []}
               for s in d['sucursales']}
        for v in d.get('vendedores', []): por.setdefault(v['sucursal'], {'vendedores':[],'cobertura':[],'heatmap':[]})['vendedores'].append(v)
        for c in d.get('cobertura', []):  por.setdefault(c['sucursal'], {'vendedores':[],'cobertura':[],'heatmap':[]})['cobertura'].append(c)
        for h in d.get('heatmap', []):    por.setdefault(h['sucursal'], {'vendedores':[],'cobertura':[],'heatmap':[]})['heatmap'].append(h)

        # mix de la cadena por grupo (excl. ecommerce), sin personas
        mix = {}
        for v in d.get('vendedores', []):
            if v['sucursal'] != ECOM and v.get('horas_contr', 0) > 0 and v['grupo'] in GRUPOS_PISO:
                g = mix.setdefault(v['grupo'], {'h': 0, 't': 0})
                g['h'] += v['horas_contr']; g['t'] += v['tickets']

        suc_agg = [dict(s, formato=formato_de(s['sucursal'])) for s in d['sucursales']]
        dump({'periodo': per, 'meta': d['meta'], 'mesStock': MES_STOCK.get(mm),
              'sucursales': suc_agg, 'mix': mix}, os.path.join(pdir, 'cadena.json'))

        for s in d['sucursales']:
            b = por[s['sucursal']]
            dump({'periodo': per, 'meta': d['meta'], 'mesStock': MES_STOCK.get(mm),
                  'sucursal': s['sucursal'], 'formato': formato_de(s['sucursal']),
                  'summary': s, 'vendedores': b['vendedores'],
                  'cobertura': b['cobertura'], 'heatmap': b['heatmap']},
                 os.path.join(pdir, archivo_de(s['sucursal']) + '.json'))

        periodos_meta.append({'id': per,
          'label': f"{MES_NOMBRE.get(mm, mm)} {per[:4]}",
          'dias': d['meta'].get('dias', ''), 'habiles': d['meta'].get('habiles'),
          'semanas': d['meta'].get('semanas'), 'mesStock': MES_STOCK.get(mm)})

    periodos_meta.sort(key=lambda p: p['id'], reverse=True)   # más nuevo primero
    json.dump({'periodos': periodos_meta}, open(os.path.join(root, 'periodos.json'), 'w'),
              ensure_ascii=False, indent=2)

st = cargar_staff()
os.makedirs(OUT, exist_ok=True)
data = {}
for per, cfg in PERIODOS.items():
    data[per] = procesar(per, cfg, st)
    json.dump(data[per], open(f'{OUT}/indicadores-{per}.json','w'), ensure_ascii=False, separators=(',',':'))

# bajas/altas: quien no vendió en el período no aparece
json.dump(data, open('/home/claude/indicadores-multi.json','w'), ensure_ascii=False, separators=(',',':'))

# salida particionada para el Portal (copiar out/indicadores/ a data/indicadores/ del repo)
emitir_particionado(data, OUT)

for per, d in data.items():
    s = pd.DataFrame(d['sucursales']); f = s[s.sucursal != '99-Ecommerce']
    print(f"{per} (días {d['meta']['dias']}, {d['meta']['habiles']} hábiles) → "
          f"UPT {f.unidades_netas.sum()/f.tickets.sum():.2f} · "
          f"TPH {f.tickets.sum()/f.horas_contr.sum():.2f} · "
          f"TP ${f.importe_neto.sum()/f.tickets.sum():,.0f} · "
          f"cobertura {f.tickets.sum()/f.tickets_todos.sum()*100:.1f}%")
