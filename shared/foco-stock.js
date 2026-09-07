/* Foco de trabajo del mes — Área de Producto (Daniel: Calzado · David: Indumentaria + Accesorios).
   Sale de la sección «Meses de stock» del Reporte Mensual (gestionStock/<ym>/mesesStock de
   discontinuos-mateu) con las MISMAS reglas del deck: < 3 meses = riesgo de faltante,
   3 a 5 = saludable, ≥ 6 = exceso. Lo usan el deck (gestion-stock/, bloque «Foco del mes»
   de cada rubro) y la pantalla inicial de producto@ (equipo/, checklist por operador).
   window.FocoStock.calcular(mesesStock, prevRatios) → {calzado:{exceso,riesgo,vigilar,…}, …}
   prevRatios = {rubro:{slug:ratio}} del mes anterior (para la variación %). */
(function(){
  const OPERADORES=[{op:'Daniel',rubros:['calzado']},{op:'David',rubros:['indumentaria','accesorios']}];
  const RUBRO_LBL={calzado:'Calzado',indumentaria:'Indumentaria',accesorios:'Accesorios'};
  const LO=3, HI=6;
  const EXCLUIR=['deposito']; // el Depósito Central es reserva: no es una sucursal a corregir
  function nombre(x){ const m=String(x.codigo||'').match(/^\d{2}\s*-\s*(.+)$/); return m?m[1]:(x.codigo||x.slug||''); }
  function variacion(cur, prev){ if(cur==null||prev==null||!(prev>0)) return null; return Math.round((cur-prev)/prev*100); }
  function calcular(ms, prevRatios){
    const out={};
    Object.keys(RUBRO_LBL).forEach(r=>{
      const lista=(((ms||{})[r])||[]).filter(x=>x && x.ratio!=null && EXCLUIR.indexOf(x.slug)<0);
      const pr=((prevRatios||{})[r])||{};
      const item=x=>{
        const prev=pr[x.slug]; const st=x.stock||0, ve=x.ventas||0;
        return {slug:x.slug, nombre:nombre(x), ratio:x.ratio, stock:st, ventas:ve, prev:prev==null?null:prev, var:variacion(x.ratio,prev),
          exced: x.ratio>=HI ? Math.max(0, Math.round(st-ve*HI)) : 0,   // unidades por encima de 6 meses de venta
          falta: x.ratio<LO ? Math.max(0, Math.round(ve*LO-st)) : 0};   // unidades que faltan para llegar a 3 meses
      };
      const exceso=lista.filter(x=>x.ratio>=HI).map(item).sort((a,b)=>b.ratio-a.ratio);
      const riesgo=lista.filter(x=>x.ratio<LO).map(item).sort((a,b)=>a.ratio-b.ratio);
      // Vigilar: está en rango pero pegada al borde y viene moviéndose para el lado malo
      const vigilar=lista.filter(x=>x.ratio>=LO&&x.ratio<HI).map(item)
        .filter(i=> i.var!=null && ((i.ratio>=5 && i.var>0) || (i.ratio<3.5 && i.var<0)))
        .sort((a,b)=>Math.abs(b.var)-Math.abs(a.var));
      out[r]={rubro:r, label:RUBRO_LBL[r], exceso, riesgo, vigilar, total:lista.length, sanas:lista.length-exceso.length-riesgo.length};
    });
    return out;
  }
  function porOperador(foco){ return OPERADORES.map(o=>({op:o.op, rubros:o.rubros.map(r=>(foco||{})[r]).filter(Boolean)})); }
  function claveItem(rubro, slug){ return rubro+'__'+slug; }
  function fmtVar(v){ return v==null ? '' : (v===0 ? '=' : (v>0 ? '▲ +'+v+'%' : '▼ −'+Math.abs(v)+'%')); }
  function enRango(v){ return v>=LO && v<HI; }
  function dist(v){ return v<LO ? LO-v : (v>=HI ? v-HI+0.01 : 0); } // distancia al rango saludable
  /* Cierre del mes: ¿las sucursales del foco de un mes se acercaron al rango con el
     Reporte Mensual siguiente? focoPrev = calcular(mesesStock del mes evaluado),
     msActual = mesesStock del mes siguiente, hechos = equipo/foco/<mesEvaluado>
     (trabajadas / descartadas por gerencia). Resultado por ítem: resuelto (entró al
     rango) · mejoro (se acercó ≥10 % de lo que le faltaba) · igual · empeoro ·
     sindato · descartado (no cuenta). Cumplimiento = resueltas + mejoraron / evaluadas. */
  const RES_LBL={resuelto:'Resuelta', mejoro:'Mejoró', igual:'Sin cambio', empeoro:'Empeoró', sindato:'Sin dato', descartado:'Descartada'};
  function evaluar(focoPrev, msActual, hechos){
    const act={};
    Object.keys(msActual||{}).forEach(r=>{ act[r]={}; (msActual[r]||[]).forEach(x=>{ if(x&&x.ratio!=null) act[r][x.slug]=x.ratio; }); });
    const items=[];
    Object.keys(RUBRO_LBL).forEach(r=>{
      const f=(focoPrev||{})[r]; if(!f) return;
      f.exceso.map(x=>Object.assign({tipo:'exceso'},x)).concat(f.riesgo.map(x=>Object.assign({tipo:'riesgo'},x))).forEach(x=>{
        const h=((hechos||{})[claveItem(r,x.slug)])||{};
        const r1=act[r] ? act[r][x.slug] : undefined;
        let res;
        if(h.descartado) res='descartado';
        else if(r1==null) res='sindato';
        else if(enRango(r1)) res='resuelto';
        else { const d0=dist(x.ratio), d1=dist(r1); const m=d0>0?(d0-d1)/d0:0; res = m>=0.1?'mejoro':(m<=-0.1?'empeoro':'igual'); }
        items.push({rubro:r, label:f.label, slug:x.slug, nombre:x.nombre, tipo:x.tipo, de:x.ratio, a:r1==null?null:r1,
          var:r1==null?null:variacion(r1,x.ratio), res, trabajada:!!h.hecho, nota:h.nota||'', descartado:!!h.descartado, motivoDesc:h.motivoDesc||''});
      });
    });
    const porOp=OPERADORES.map(o=>{
      const its=items.filter(i=>o.rubros.indexOf(i.rubro)>=0), vivos=its.filter(i=>!i.descartado);
      const c=k=>vivos.filter(i=>i.res===k).length;
      const n=vivos.length-c('sindato'), ok=c('resuelto')+c('mejoro');
      return {op:o.op, rubros:o.rubros.map(r=>RUBRO_LBL[r]).join(' + '), items:its, n, ok,
        resuelto:c('resuelto'), mejoro:c('mejoro'), igual:c('igual'), empeoro:c('empeoro'), sindato:c('sindato'),
        descartados:its.length-vivos.length, trabajadas:vivos.filter(i=>i.trabajada).length,
        trabEmpeoro:vivos.filter(i=>i.trabajada&&(i.res==='empeoro'||i.res==='igual')).length,
        pct:n?Math.round(ok/n*100):null};
    });
    return {items, porOp};
  }
  window.FocoStock={OPERADORES, RUBRO_LBL, RES_LBL, LO, HI, calcular, porOperador, claveItem, variacion, fmtVar, nombre, enRango, dist, evaluar};
})();
