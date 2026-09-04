/* ============================================================================
   Render del mapa del depósito central  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Dibuja el plano (window.PLANO_DEPOSITO, generado por scripts/gen-plano-
   deposito.js) como SVG schemático por planta. Lo usan el módulo de Picking y
   el kiosco de operarios. Auto-inyecta su CSS (colores horneados, portable) así
   funciona en cualquier página sin depender de sus variables.

   API global:
     PlanoMapa.svg(planta, opts)   -> SVG de una planta ({nombre,filas,cols,celdas})
     PlanoMapa.bloque(opts)        -> las dos plantas + leyenda (usa PLANO_DEPOSITO)
     PlanoMapa.shortLabel(label)
   opts: { resaltar:Set<nombreZona>, hotCls:'mp-hot'(verde)|'mp-here'(rojo) }
   Los <g class="mp-res" data-zl="<nombre>"> son clickeables (los cablea quien lo usa).
   ========================================================================== */
(function(){
  if(window.PlanoMapa) return;
  if(!document.getElementById('planoMapaCss')){
    var css=[
      '.mp-wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}',
      '@media(max-width:760px){.mp-wrap{grid-template-columns:1fr}}',
      '.mp-planta{border:1px solid #dce3f0;border-radius:12px;padding:12px;background:#fff}',
      '.mp-planta h3{font-family:"Barlow Condensed",sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6B7A99;margin:0 0 8px}',
      '.mp-svg{width:100%;height:auto;display:block}',
      '.mp-cell text{text-anchor:middle;dominant-baseline:central;font-family:"Barlow Condensed",sans-serif;font-weight:700;fill:#0B1527;pointer-events:none}',
      '.mp-cell rect{stroke:#fff;stroke-width:.14}',
      '.mp-res rect{fill:#e7eefc}',
      '.mp-op rect{fill:#fff4e2}.mp-op text{fill:#9a5b00;font-weight:600}',
      '.mp-serv rect{fill:#eef1f7}.mp-serv text{fill:#aab4c9;font-weight:600}',
      '.mp-hot rect{fill:#16a34a}.mp-hot text{fill:#fff}',
      '.mp-here rect{fill:#CC0000}.mp-here text{fill:#fff}',
      '.mp-res[data-zl]{cursor:pointer}.mp-res[data-zl]:hover rect{stroke:#0B1527;stroke-width:.35}',
      '.mp-legend{display:flex;gap:14px;flex-wrap:wrap;font-family:"Barlow Condensed",sans-serif;font-size:12px;color:#6B7A99;margin-top:10px}',
      '.mp-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;margin-right:5px}'
    ].join('');
    var s=document.createElement('style'); s.id='planoMapaCss'; s.textContent=css; document.head.appendChild(s);
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function shortLabel(label){
    var g=String(label).match(/GONDOLA\s+(\d+)/i); if(g) return g[1];
    return String(label).replace(/^GONDOLA\s+/i,'').replace(/INDUMENTARIA/i,'IND.').replace(/MERCADER[ÍI]A/i,'MERC.');
  }
  function svg(planta, opts){
    opts=opts||{}; var res=opts.resaltar||new Set(); var hotCls=opts.hotCls||'mp-hot';
    var W=planta.cols, H=planta.filas;
    var cells=(planta.celdas||[]).map(function(cd){
      var x=cd.c0, y=cd.r0, w=cd.c1-cd.c0+1, h=cd.r1-cd.r0+1;
      var hot=cd.tipo==='reserva'&&res.has(cd.label);
      var tcls=cd.tipo==='reserva'?'mp-res':(cd.tipo==='operacion'?'mp-op':'mp-serv');
      var cls='mp-cell '+tcls+(hot?' '+hotCls:'');
      var isG=/GONDOLA\s+\d+/i.test(cd.label);
      var fs=isG?Math.min(h*0.62,w*0.42,2.4):Math.max(0.62,Math.min(1.15,Math.min(w,h)*0.5));
      return '<g class="'+cls+'"'+(cd.tipo==='reserva'?' data-zl="'+esc(cd.label)+'"':'')+'>'
        +'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="0.3"/>'
        +'<title>'+esc(cd.label)+'</title>'
        +'<text x="'+(x+w/2).toFixed(2)+'" y="'+(y+h/2).toFixed(2)+'" font-size="'+fs.toFixed(2)+'">'+esc(shortLabel(cd.label))+'</text></g>';
    }).join('');
    return '<svg class="mp-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img">'+cells+'</svg>';
  }
  function bloque(opts){
    var P=window.PLANO_DEPOSITO; if(!P||!P.plantas) return '';
    var svgs=P.plantas.map(function(pl){ return '<div class="mp-planta"><h3>'+esc(pl.nombre)+'</h3>'+svg(pl,opts)+'</div>'; }).join('');
    var hot=(opts&&opts.hotCls==='mp-here')?'<span><i style="background:#CC0000"></i>Acá está el ítem</span>':'<span><i style="background:#16a34a"></i>Con marca/rubro asignado</span>';
    return '<div class="mp-wrap">'+svgs+'</div>'
      +'<div class="mp-legend"><span><i style="background:#e7eefc"></i>Reserva (pickeable)</span>'+hot
      +'<span><i style="background:#fff4e2"></i>Recepción / boxes</span><span><i style="background:#eef1f7"></i>Servicios</span></div>';
  }
  // planta que contiene la zona de reserva con ese nombre
  function plantaDeZona(nombre){
    var P=window.PLANO_DEPOSITO; if(!P||!P.plantas) return null;
    for(var i=0;i<P.plantas.length;i++){ var pl=P.plantas[i];
      if((pl.celdas||[]).some(function(c){ return c.tipo==='reserva'&&c.label===nombre; })) return pl; }
    return null;
  }
  // mapa compacto de la planta donde está la zona, con la zona resaltada (rojo por defecto)
  function zonaMap(nombre, opts){
    var pl=plantaDeZona(nombre); if(!pl) return '';
    opts=opts||{}; opts.resaltar=new Set([nombre]); if(!opts.hotCls) opts.hotCls='mp-here';
    return '<div class="mp-planta"><h3>'+esc(pl.nombre)+'</h3>'+svg(pl,opts)+'</div>';
  }
  window.PlanoMapa = { svg:svg, bloque:bloque, shortLabel:shortLabel, zonaMap:zonaMap, plantaDeZona:plantaDeZona };
})();
