/* =========================================================================
   TAB 02 — Risk Profile & Interactive Heat Map
   Probability x Impact placement is DERIVED, not invented: Probability is
   read from the register's own probability band; Impact is recovered by
   inverting the documented Score=(Impact-1)*5+Probability formula from the
   source template's Risk Rating Scheme sheet against the recorded score.
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

function cellBg(level, alpha){
  var c = E.levelColor(level);
  // colors are already theme-correct hex/rgb from CSS vars; wrap with alpha via color-mix for a graded fill
  return "color-mix(in srgb, "+c+" "+Math.round(alpha*100)+"%, "+E.cssVar("--surface")+")";
}

function buildHeatmapGrid(agg, dataset){
  var rows = [5,4,3,2,1]; // impact, top(5,Very High) to bottom(1,Very Low)
  var cols = [1,2,3,4,5]; // probability, left(Rare) to right(Almost Certain)
  var maxCount = 0;
  Object.keys(agg.heat).forEach(function(k){ if(agg.heat[k]>maxCount) maxCount=agg.heat[k]; });
  var html = '<div class="heatmap-wrap"><div class="heatmap-ylabel">IMPACT →</div><div style="flex:1;">';
  html += '<div class="heatmap">';
  rows.forEach(function(i){
    cols.forEach(function(p){
      var key = p+"-"+i;
      var n = agg.heat[key]||0;
      var score = (i-1)*5+p;
      var level = E.scoreToLevel(score);
      var alpha = n===0 ? 0.10 : (0.32 + 0.55*(n/(maxCount||1)));
      html += '<div class="heatmap-cell'+(n===0?' empty':'')+'" data-p="'+p+'" data-i="'+i+'" '+
        'style="background:'+cellBg(level,alpha)+'; color:'+(alpha>0.55?'#fff':E.cssVar('--text-primary'))+';" '+
        'title="Probability: '+E.PROB_LABEL_BY_ORDINAL[p]+' · Impact: '+E.IMPACT_LABEL_BY_ORDINAL[i]+' · Score '+score+' ('+level+') · '+n+' risk(s)">'+
        '<span class="cnt">'+(n||"")+'</span><span class="lvl">'+(n?level:"")+'</span>'+
      '</div>';
    });
  });
  html += '</div>';
  html += '<div class="heatmap-axis-x">'+cols.map(function(p){return '<div>'+E.PROB_LABEL_BY_ORDINAL[p].split(" (")[0]+'</div>';}).join("")+'</div>';
  html += '<div class="heatmap-xlabel">PROBABILITY →</div>';
  html += '</div></div>';
  return html;
}

function rankBarPanel(title, entries, colorFn){
  var labels = entries.map(function(e){return e[0];});
  var values = entries.map(function(e){return e[1];});
  return {labels:labels, values:values};
}

window.renderHeatmap = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var el = document.getElementById("view-heatmap");

  var placed = Object.keys(agg.heat).reduce(function(s,k){return s+agg.heat[k];},0);

  el.innerHTML =
    '<div class="kpi-row n4">'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--accent)"></div><div class="kpi-label">Threats Placed on Matrix</div><div class="kpi-value">'+placed+'</div><div class="kpi-sub">of '+dataset.length+' filtered records</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--nil)"></div><div class="kpi-label">Unplaced / Inconsistent</div><div class="kpi-value">'+agg.unplacedThreats+'</div><div class="kpi-sub">score does not resolve to a valid 1-5×1-5 pair — a data-quality case, see Performance tab</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--good)"></div><div class="kpi-label">Opportunities</div><div class="kpi-value">'+agg.opportunities+'</div><div class="kpi-sub">excluded from the Threat matrix (scored on a separate scale)</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--critical)"></div><div class="kpi-label">Critical Cells (score 16-25)</div><div class="kpi-value">'+Object.keys(agg.heat).filter(function(k){var parts=k.split("-");return E.scoreToLevel((+parts[1]-1)*5+ +parts[0])==="Critical";}).reduce(function(s,k){return s+agg.heat[k];},0)+'</div><div class="kpi-sub">risks landing in the red zone</div></div>'+
    '</div>'+

    '<div class="grid g-2c" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Enterprise Risk Heat Map — Probability × Impact</h3><span class="tag">click a cell for detail</span></div>'+
      buildHeatmapGrid(agg, dataset)+
      '<div class="mi-note">Probability is read directly from the register\'s "Current Risk Probability" field. Impact is derived by inverting the source template\'s own scoring formula (Score = (Impact−1)×5 + Probability) against each risk\'s recorded score — no value is invented. '+agg.unplacedThreats+' record(s) could not be placed because their score/probability pair does not resolve to a valid cell.</div>'+
      '</div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk Score Distribution</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Inherent score, 1–25</div><div class="chart-wrap tall"><canvas id="c-scoredist"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-3" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Probability Distribution</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap short"><canvas id="c-probdist"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Impact Distribution</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap short"><canvas id="c-impactdist"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk by Category (count ≥ High)</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Cost / Time / HSSE / Quality — records scoring High or Critical</div><div class="chart-wrap short"><canvas id="c-catcount"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Risk by Department</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-dept"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Top Risk Owners by Volume</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Top 10 by number of assigned risks</div><div class="chart-wrap"><canvas id="c-owner"></canvas></div></div>'+
    '</div>';

  // ---- cell click -> modal list ----
  el.querySelectorAll(".heatmap-cell").forEach(function(cell){
    cell.addEventListener("click", function(){
      var p = +cell.getAttribute("data-p"), i = +cell.getAttribute("data-i");
      var rows = dataset.filter(function(r){
        if(r.type==="Opportunity" || typeof r.curScore!=="number") return false;
        return E.probOrdinal(r.prob)===p && E.deriveImpactOrdinal(r.prob, r.curScore)===i;
      });
      if(!rows.length) return;
      window._openRecordsModal("Probability: "+E.PROB_LABEL_BY_ORDINAL[p]+" · Impact: "+E.IMPACT_LABEL_BY_ORDINAL[i], rows, {exportName:"heatmap_cell_p"+p+"_i"+i});
    });
  });

  // ---- charts ----
  var scoreBuckets = {}; for(var s=1;s<=25;s++) scoreBuckets[s]=0;
  dataset.forEach(function(r){ if(typeof r.curScore==="number" && r.curScore>0) scoreBuckets[r.curScore]=(scoreBuckets[r.curScore]||0)+1; });
  var scoreLabels = Object.keys(scoreBuckets).map(Number).sort(function(a,b){return a-b;});
  window._mkChart("scoredist", document.getElementById("c-scoredist").getContext("2d"), {
    type:"bar",
    data:{labels:scoreLabels, datasets:[{data:scoreLabels.map(function(s){return scoreBuckets[s];}), backgroundColor:scoreLabels.map(function(s){return E.levelColor(E.scoreToLevel(s));}), borderRadius:3, categoryPercentage:0.9, barPercentage:0.9}]},
    options: C.baseOptions({scales:{x:{ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:13}}, y:{beginAtZero:true, ticks:{precision:0}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var sc = scoreLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.curScore===sc; });
        if(!rows.length) return;
        window._openRecordsModal("Risk Score: "+sc+" ("+E.scoreToLevel(sc)+")", rows, {exportName:"score_"+sc});
      }
    })
  });

  var probCounts = [1,2,3,4,5].map(function(p){ return dataset.filter(function(r){return r.type!=="Opportunity" && E.probOrdinal(r.prob)===p;}).length; });
  window._mkChart("probdist", document.getElementById("c-probdist").getContext("2d"), {
    type:"bar",
    data:{labels:[1,2,3,4,5].map(function(p){return E.PROB_LABEL_BY_ORDINAL[p].split(" (")[0];}), datasets:[{data:probCounts, backgroundColor:C.categorical(5), borderRadius:5}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}, x:{ticks:{font:{size:9.5}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var p = hits[0].index+1;
        var rows = dataset.filter(function(r){ return r.type!=="Opportunity" && E.probOrdinal(r.prob)===p; });
        if(!rows.length) return;
        window._openRecordsModal("Probability: "+E.PROB_LABEL_BY_ORDINAL[p], rows, {exportName:"prob_"+p});
      }
    })
  });

  var impactCounts = [1,2,3,4,5].map(function(i){ return dataset.filter(function(r){ return r.type!=="Opportunity" && typeof r.curScore==="number" && E.deriveImpactOrdinal(r.prob,r.curScore)===i; }).length; });
  window._mkChart("impactdist", document.getElementById("c-impactdist").getContext("2d"), {
    type:"bar",
    data:{labels:[1,2,3,4,5].map(function(i){return E.IMPACT_LABEL_BY_ORDINAL[i];}), datasets:[{data:impactCounts, backgroundColor:C.categorical(5), borderRadius:5}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}, x:{ticks:{font:{size:9.5}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var i = hits[0].index+1;
        var rows = dataset.filter(function(r){ return r.type!=="Opportunity" && typeof r.curScore==="number" && E.deriveImpactOrdinal(r.prob,r.curScore)===i; });
        if(!rows.length) return;
        window._openRecordsModal("Impact: "+E.IMPACT_LABEL_BY_ORDINAL[i], rows, {exportName:"impact_"+i});
      }
    })
  });

  var catKeys = ["cost","time","hsse","quality"];
  var catHighCounts = catKeys.map(function(k){ return dataset.filter(function(r){ return typeof r[k]==="number" && r[k]>=11; }).length; });
  window._mkChart("catcount", document.getElementById("c-catcount").getContext("2d"), {
    type:"bar",
    data:{labels:catKeys.map(function(k){return k[0].toUpperCase()+k.slice(1);}), datasets:[{data:catHighCounts, backgroundColor:C.categorical(4), borderRadius:5}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var k = catKeys[hits[0].index];
        var rows = dataset.filter(function(r){ return typeof r[k]==="number" && r[k]>=11; });
        if(!rows.length) return;
        window._openRecordsModal(k[0].toUpperCase()+k.slice(1)+" Risks — High or Critical", rows, {exportName:"cat_"+k});
      }
    })
  });

  var deptLabels = Object.keys(agg.byDept).sort(function(a,b){return agg.byDept[b]-agg.byDept[a];});
  window._mkChart("dept", document.getElementById("c-dept").getContext("2d"), {
    type:"bar",
    data:{labels:deptLabels, datasets:[{data:deptLabels.map(function(d){return agg.byDept[d];}), backgroundColor:C.categorical(deptLabels.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var d = deptLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.dept===d; });
        if(!rows.length) return;
        window._openRecordsModal(d+" — Department Risks", rows, {exportName:"dept_"+d.replace(/\W+/g,"_")});
      }
    })
  });

  var ownerLabels = Object.keys(agg.byOwner).sort(function(a,b){return agg.byOwner[b]-agg.byOwner[a];}).slice(0,10);
  window._mkChart("owner", document.getElementById("c-owner").getContext("2d"), {
    type:"bar",
    data:{labels:ownerLabels, datasets:[{data:ownerLabels.map(function(o){return agg.byOwner[o];}), backgroundColor:C.categorical(ownerLabels.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var o = ownerLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.owner===o; });
        if(!rows.length) return;
        window._openRecordsModal(o+" — Owned Risks", rows, {exportName:"owner_"+o.replace(/\W+/g,"_")});
      }
    })
  });
};
})();
