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
    // Misma estética que los planos de sucursal del Buscador de Artículos (shared/plano-suc.js,
    // Ensenada): marco claro, muebles celestes, servicios grises, rojo de la marca para «acá está»,
    // verde para lo asignado, rótulo girado cuando entra más grande y destello al resaltar.
    var css=[
      '.mp-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:8px}',
      '.mp-planta{border:1px solid #dce3f0;border-radius:12px;padding:10px;background:#fff;min-width:0}',
      '.mp-planta h3{font-family:"Barlow Condensed",sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6B7A99;margin:0 0 6px}',
      '.mp-svg{width:100%;height:auto;display:block;max-height:70vh}',
      '.mp-bg{fill:#fbfcfe;stroke:#dce3f0;stroke-width:.15}',
      '.mp-cell text{text-anchor:middle;dominant-baseline:central;font-family:"Barlow Condensed",sans-serif;font-weight:700;fill:#0B1527;pointer-events:none}',
      '.mp-cell rect{stroke:#fff;stroke-width:.12}',
      '.mp-res rect{fill:#cfe2f3}',
      '.mp-op rect{fill:#fdf1dc}.mp-op text{fill:#9a5b00;font-weight:600}',
      '.mp-serv rect{fill:#eef1f7}.mp-serv text{fill:#8a96ad;font-weight:600}',
      '.mp-hot rect{fill:#16a34a}.mp-hot text{fill:#fff}',
      '.mp-here rect{fill:var(--marca-red,#CC0000);animation:mpFlash 1s ease-out 3}.mp-here text{fill:#fff}',
      '@keyframes mpFlash{0%,100%{opacity:1}45%{opacity:.25}}',
      '@media(prefers-reduced-motion:reduce){.mp-here rect{animation:none}}',
      '.mp-res[data-zl]{cursor:pointer}.mp-res[data-zl]:hover rect{stroke:#0B1527;stroke-width:.3}',
      '.mp-legend{display:flex;gap:12px;flex-wrap:wrap;font-family:"Barlow Condensed",sans-serif;font-size:12px;color:#6B7A99;margin-top:8px}',
      '.mp-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:middle;margin-right:4px}'
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
    var A=(window.PLANO_DEPOSITO&&window.PLANO_DEPOSITO.aspecto)||1;      // proporción de celda del Excel, si el generador la trae
    var cs=planta.celdas||[]; if(!cs.length) return '';
    // marco ajustado a lo dibujado (las celdas vienen en base 1 y con margen)
    var c0=Infinity,r0=Infinity,c1=-Infinity,r1=-Infinity;
    cs.forEach(function(cd){ c0=Math.min(c0,cd.c0); r0=Math.min(r0,cd.r0); c1=Math.max(c1,cd.c1); r1=Math.max(r1,cd.r1); });
    var X0=c0*A-0.3, Y0=r0-0.3, W=(c1-c0+1)*A+0.6, H=(r1-r0+1)+0.6;
    var cells=cs.map(function(cd){
      var x=cd.c0*A, y=cd.r0, w=(cd.c1-cd.c0+1)*A, h=cd.r1-cd.r0+1;
      var hot=cd.tipo==='reserva'&&res.has(cd.label);
      var tcls=cd.tipo==='reserva'?'mp-res':(cd.tipo==='operacion'?'mp-op':'mp-serv');
      var cls='mp-cell '+tcls+(hot?' '+hotCls:'');
      // orientación que deja el rótulo más grande (horizontal o girado), como en los planos de sucursal
      var t=shortLabel(cd.label), L=Math.max(t.length,2)*0.52;
      var tope=/^\d+$/.test(t)?1.6:1.1;
      var fsH=Math.min(tope, h*0.62, w*0.92/L), fsV=Math.min(tope, w*0.62, h*0.92/L);
      var vert=h>w && fsV>fsH*1.05, fs=Math.max(0.35, vert?fsV:fsH);   // solo se gira en los muebles más altos que anchos
      var cx=(x+w/2).toFixed(2), cy=(y+h/2).toFixed(2);
      return '<g class="'+cls+'"'+(cd.tipo==='reserva'?' data-zl="'+esc(cd.label)+'"':'')+'>'
        +'<rect x="'+x.toFixed(2)+'" y="'+y+'" width="'+w.toFixed(2)+'" height="'+h+'" rx="0.25"/>'
        +'<title>'+esc(cd.label)+'</title>'
        +'<text x="'+cx+'" y="'+cy+'" font-size="'+fs.toFixed(2)+'"'+(vert?' transform="rotate(-90 '+cx+' '+cy+')"':'')+'>'+esc(t)+'</text></g>';
    }).join('');
    return '<svg class="mp-svg" viewBox="'+X0.toFixed(2)+' '+Y0.toFixed(2)+' '+W.toFixed(2)+' '+H.toFixed(2)+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(planta.nombre)+'">'
      +'<rect class="mp-bg" x="'+X0.toFixed(2)+'" y="'+Y0.toFixed(2)+'" width="'+W.toFixed(2)+'" height="'+H.toFixed(2)+'" rx="0.4"/>'+cells+'</svg>';
  }
  function bloque(opts){
    var P=window.PLANO_DEPOSITO; if(!P||!P.plantas) return '';
    var svgs=P.plantas.map(function(pl){ return '<div class="mp-planta"><h3>'+esc(pl.nombre)+'</h3>'+svg(pl,opts)+'</div>'; }).join('');
    var hot=(opts&&opts.hotCls==='mp-here')?'<span><i style="background:#CC0000"></i>Acá está el ítem</span>':'<span><i style="background:#16a34a"></i>Con marca/rubro asignado</span>';
    return '<div class="mp-wrap">'+svgs+'</div>'
      +'<div class="mp-legend">'+hot+'<span><i style="background:#cfe2f3"></i>Góndola / zona de reserva</span>'
      +'<span><i style="background:#fdf1dc"></i>Recepción / boxes</span><span><i style="background:#eef1f7"></i>Oficina / baño / servicios</span></div>';
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
