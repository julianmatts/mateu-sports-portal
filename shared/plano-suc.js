/* ============================================================================
   Mapa del plano de una sucursal  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Dibuja window.PLANOS_SUC (shared/planos-sucursal.js, generado por
   scripts/gen-plano-sucursal.py) como SVG por planta: salón con sus sectores y
   depósitos con sus estanterías. Lo usan el Buscador de Artículos y Tareas.
   Auto-inyecta su CSS (prefijo ps-), sin depender de las variables del módulo.

   API global PlanoSuc:
     de(slug)                        -> plano de la sucursal o null
     plantas(slug, tipo?)            -> plantas ('salon' | 'deposito')
     svg(plano, planta, opts)        -> SVG de una planta
     bloque(slug, opts)              -> plantas del tipo pedido + leyenda
     celdaEst(slug, num)             -> {planta, celda} de la estantería N
     celdaNombre(slug, nombre)       -> {planta, celda} por nombre (sector/estantería)
   opts: { tipo, hot:Set<id> (resaltadas), cls:'ps-here'(rojo)|'ps-hot'(verde),
           pick:true (sectores/estanterías clickeables), soloConHot:true (solo
           las plantas con algo resaltado), leyenda:'texto del resaltado' }
   Cada mueble es <g data-ps="<id>" data-pl="<planta>" data-nm="<nombre>">.
   ========================================================================== */
(function(){
  if(window.PlanoSuc) return;
  if(!document.getElementById('planoSucCss')){
    var css=[
      '.ps-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:8px}',
      '.ps-planta{border:1px solid #dce3f0;border-radius:12px;padding:10px;background:#fff;min-width:0}',
      '.ps-planta h4{font-family:"Barlow Condensed",sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6B7A99;margin:0 0 6px}',
      '.ps-svg{width:100%;height:auto;display:block;max-height:70vh}',
      '.ps-c text{text-anchor:middle;dominant-baseline:central;font-family:"Barlow Condensed",sans-serif;font-weight:700;fill:#0B1527;pointer-events:none}',
      '.ps-c rect{stroke:#fff;stroke-width:.12}',
      '.ps-mueble rect{fill:#cfe2f3}',
      '.ps-serv rect{fill:#eef1f7}.ps-serv text{fill:#8a96ad;font-weight:600}',
      '.ps-hueco rect{fill:#f7f8fb}',
      '.ps-hot rect{fill:#16a34a}.ps-hot text{fill:#fff}',
      '.ps-here rect{fill:var(--marca-red,#CC0000)}.ps-here text{fill:#fff}',
      '.ps-pick .ps-mueble{cursor:pointer}.ps-pick .ps-mueble:hover rect{stroke:#0B1527;stroke-width:.3}',
      '.ps-bg{fill:#fbfcfe;stroke:#dce3f0;stroke-width:.15}',
      '.ps-flash rect{animation:psFlash 1s ease-out 3}',
      '@keyframes psFlash{0%,100%{opacity:1}45%{opacity:.25}}',
      '.ps-legend{display:flex;gap:12px;flex-wrap:wrap;font-family:"Barlow Condensed",sans-serif;font-size:12px;color:#6B7A99;margin-top:8px}',
      '.ps-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:middle;margin-right:4px}'
    ].join('');
    var s=document.createElement('style'); s.id='planoSucCss'; s.textContent=css; document.head.appendChild(s);
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function de(slug){ var P=window.PLANOS_SUC||{}; return (slug && P[slug]) || null; }
  function plantas(slug, tipo){ var p=de(slug); return p ? p.plantas.filter(function(pl){ return !tipo || pl.tipo===tipo; }) : []; }
  // rótulo corto: en el mapa la estantería se lee por su número
  function corto(c){
    if(c.tipo==='estanteria'){ var d=c.nombre.split(' · ')[1]; return 'E'+c.num+(d&&d!=='sin nombre'?' '+d:''); }
    return c.nombre.replace(/^Sin nombre (\d+)$/,'s/n $1');
  }
  function svg(plano, planta, opts){
    opts=opts||{}; var hot=opts.hot||new Set(); var hotCls=opts.cls||'ps-here';
    var A=plano.aspecto||1.5, W=planta.cols*A, H=planta.filas;
    var out=(planta.celdas||[]).map(function(c){
      var x=c.c0*A, y=c.r0, w=(c.c1-c.c0+1)*A, h=c.r1-c.r0+1;
      var mueble=c.tipo==='sector'||c.tipo==='estanteria';
      var cls='ps-c '+(mueble?'ps-mueble':(c.tipo==='servicio'?'ps-serv':'ps-hueco'))+(hot.has(c.id)?' '+hotCls:'');
      var g='<g class="'+cls+'"'+(mueble?' data-ps="'+esc(c.id)+'" data-pl="'+esc(planta.id)+'" data-nm="'+esc(c.nombre)+'"':'')+'>'
        +'<rect x="'+x.toFixed(2)+'" y="'+y+'" width="'+w.toFixed(2)+'" height="'+h+'" rx="0.25"/>';
      if(c.nombre){
        // orientación que deja el texto más grande (horizontal o girado)
        var t=corto(c), L=Math.max(t.length,2)*0.52;
        var fsH=Math.min(1.1, h*0.62, w*0.92/L), fsV=Math.min(1.1, w*0.62, h*0.92/L);
        var vert=fsV>fsH*1.05, fs=Math.max(0.35, vert?fsV:fsH);
        var cx=(x+w/2).toFixed(2), cy=(y+h/2).toFixed(2);
        g+='<title>'+esc(c.nombre)+'</title><text x="'+cx+'" y="'+cy+'" font-size="'+fs.toFixed(2)+'"'
          +(vert?' transform="rotate(-90 '+cx+' '+cy+')"':'')+'>'+esc(t)+'</text>';
      }
      return g+'</g>';
    }).join('');
    return '<svg class="ps-svg'+(opts.pick?' ps-pick':'')+'" viewBox="-0.3 -0.3 '+(W+0.6).toFixed(2)+' '+(H+0.6)+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(planta.nombre)+'">'
      +'<rect class="ps-bg" x="-0.3" y="-0.3" width="'+(W+0.6).toFixed(2)+'" height="'+(H+0.6)+'" rx="0.4"/>'+out+'</svg>';
  }
  function bloque(slug, opts){
    opts=opts||{}; var p=de(slug); if(!p) return '';
    var hot=opts.hot||new Set();
    var pls=plantas(slug, opts.tipo);
    if(opts.soloConHot){
      var con=pls.filter(function(pl){ return pl.celdas.some(function(c){ return hot.has(c.id); }); });
      if(con.length) pls=con;
    }
    var html=pls.map(function(pl){ return '<div class="ps-planta"><h4>'+esc(pl.nombre)+'</h4>'+svg(p, pl, opts)+'</div>'; }).join('');
    var col=(opts.cls==='ps-hot')?'#16a34a':'#CC0000';
    return '<div class="ps-wrap">'+html+'</div>'
      +'<div class="ps-legend">'+(opts.leyenda?'<span><i style="background:'+col+'"></i>'+esc(opts.leyenda)+'</span>':'')
      +'<span><i style="background:#cfe2f3"></i>'+(opts.tipo==='salon'?'Sector de exhibición':(opts.tipo==='deposito'?'Estantería':'Mueble'))+'</span>'
      +'<span><i style="background:#eef1f7"></i>PC / caja / baño / probador</span></div>';
  }
  function buscar(slug, fn){
    var ps=plantas(slug);
    for(var i=0;i<ps.length;i++) for(var j=0;j<ps[i].celdas.length;j++){ if(fn(ps[i].celdas[j])) return {planta:ps[i], celda:ps[i].celdas[j]}; }
    return null;
  }
  function norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
  function celdaEst(slug, num){ num=+num; return buscar(slug, function(c){ return c.tipo==='estanteria' && c.num===num; }); }
  function celdaNombre(slug, nombre){ var n=norm(nombre); return n ? buscar(slug, function(c){ return (c.tipo==='sector'||c.tipo==='estanteria') && norm(c.nombre)===n; }) : null; }
  // vuelve a disparar el destello de lo resaltado dentro de `cont`
  function destellar(cont){
    var gs=(cont||document).querySelectorAll('.ps-here,.ps-hot');
    for(var i=0;i<gs.length;i++){ (function(g){
      g.classList.remove('ps-flash');
      void g.offsetWidth;                       // reinicia la animación
      g.classList.add('ps-flash');
      setTimeout(function(){ g.classList.remove('ps-flash'); }, 3200);
    })(gs[i]); }
  }
  window.PlanoSuc={ de:de, plantas:plantas, svg:svg, bloque:bloque, celdaEst:celdaEst, celdaNombre:celdaNombre, destellar:destellar };
})();
