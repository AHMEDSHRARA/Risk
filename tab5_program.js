/* =========================================================================
   TAB 05 — Program & Project Risk Intelligence
   Portfolio -> Program -> Project drill-down. The topbar's Program/Project
   filters already cascade globally; this tab's project cards are a second,
   visual way to set the same filter.
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

window.renderProgram = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var el = document.getElementById("view-program");

  var projects = Object.keys(agg.byProject).map(function(k){return agg.byProject[k];}).sort(function(a,b){return b.count-a.count;});

  el.innerHTML =
    '<div class="section-title">Portfolio → Program → Project<span class="stq">'+projects.length+' projects in the current filter</span></div>'+
    '<div class="proj-cards" id="proj-cards">'+
      projects.map(function(p){
        var pk = p.program+" | "+p.project;
        var active = window._RiskState.filters.project===p.project;
        return '<div class="proj-card'+(active?' active':'')+'" data-project="'+E.esc(p.project)+'">'+
          '<div class="pc-prog">'+E.esc(p.program)+'</div>'+
          '<div class="pc-name">'+E.esc(p.project)+'</div>'+
          '<div class="pc-stats">'+
            '<span><b>'+p.count+'</b> risks</span>'+
            '<span><b style="color:'+E.cssVar("--critical")+'">'+p.critical+'</b> critical</span>'+
            '<span><b>'+p.open+'</b> open</span>'+
          '</div>'+
        '</div>';
      }).join("")+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Critical &amp; High Risks by Project</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap tall"><canvas id="c-critproj"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Inherent vs. Residual — Top Projects</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">By risk count, average score</div><div class="chart-wrap tall"><canvas id="c-clustered"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Estimated Cost Exposure by Project</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Likely-case, sum of quantified risks only</div><div class="chart-wrap"><canvas id="c-costproj"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Estimated Schedule Exposure by Project</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Likely-case days, sum of quantified risks only</div><div class="chart-wrap"><canvas id="c-timeproj"></canvas></div></div>'+
    '</div>'+

    '<div class="panel">'+
      '<div class="panel-head"><h3>Risk Level Composition by Program</h3><span class="tag">click a segment for details</span></div><div class="panel-sub">Share of each program\'s risks by level</div>'+
      '<div class="chart-wrap tall"><canvas id="c-progstack"></canvas></div>'+
    '</div>';

  el.querySelectorAll(".proj-card").forEach(function(card){
    card.addEventListener("click", function(){
      var proj = card.getAttribute("data-project");
      var isActive = card.classList.contains("active");
      window._RiskState.filters.project = isActive ? "" : proj;
      var programOfProj = projects.find(function(p){return p.project===proj;});
      if(!isActive && programOfProj) window._RiskState.filters.program = programOfProj.program;
      document.getElementById("f-program").value = window._RiskState.filters.program;
      document.getElementById("f-project").value = "";
      window._setFilter("project", window._RiskState.filters.project);
    });
  });

  window._mkChart("critproj", document.getElementById("c-critproj").getContext("2d"), {
    type:"bar",
    data:{labels:projects.map(function(p){return p.project;}), datasets:[
      {label:"Critical", data:projects.map(function(p){return p.critical;}), backgroundColor:E.cssVar("--critical"), borderRadius:3},
      {label:"High", data:projects.map(function(p){return p.high;}), backgroundColor:E.cssVar("--serious"), borderRadius:3}
    ]},
    options: C.baseOptions({indexAxis:"y", plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip},
      scales:{x:{stacked:true, beginAtZero:true}, y:{stacked:true, grid:{display:false}, ticks:{font:{size:10}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var proj = projects[hits[0].index].project, lvl = hits[0].datasetIndex===0?"Critical":"High";
        var rows = dataset.filter(function(r){ return r.project===proj && r.curLevel===lvl; });
        if(!rows.length) return;
        window._openRecordsModal(proj+" — "+lvl+" Risks", rows, {exportName:"critproj_"+proj.replace(/\W+/g,"_")+"_"+lvl});
      }
    })
  });

  var top = projects.slice(0,10);
  window._mkChart("clustered", document.getElementById("c-clustered").getContext("2d"), {
    type:"bar",
    data:{labels:top.map(function(p){return p.project;}), datasets:[
      {label:"Avg. Inherent", data:top.map(function(p){return p.count?p.curSum/p.count:0;}), backgroundColor:C.categorical(2)[0], borderRadius:4},
      {label:"Avg. Residual", data:top.map(function(p){return p.resN?p.resSum/p.resN:0;}), backgroundColor:E.cssVar("--good"), borderRadius:4}
    ]},
    options: C.baseOptions({indexAxis:"y", plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip},
      scales:{x:{beginAtZero:true, max:25}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var proj = top[hits[0].index].project, isRes = hits[0].datasetIndex===1;
        var rows = dataset.filter(function(r){ return r.project===proj && (!isRes || typeof r.resScore==="number"); });
        if(!rows.length) return;
        window._openRecordsModal(proj+" — "+(isRes?"Residual Assessed":"All")+" Risks", rows, {exportName:"clustered_"+proj.replace(/\W+/g,"_")});
      }
    })
  });

  var withCost = projects.filter(function(p){return p.costExposure>0;}).sort(function(a,b){return b.costExposure-a.costExposure;});
  window._mkChart("costproj", document.getElementById("c-costproj").getContext("2d"), {
    type:"bar",
    data:{labels:withCost.map(function(p){return p.project;}), datasets:[{data:withCost.map(function(p){return p.costExposure;}), backgroundColor:C.categorical(withCost.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, ticks:{callback:function(v){return E.fmtMoney(v);}}}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      plugins:{legend:{display:false}, tooltip:Object.assign({},C.baseOptions().plugins.tooltip,{callbacks:{label:function(item){return E.fmtMoney(item.raw);}}})},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var proj = withCost[hits[0].index].project;
        var rows = dataset.filter(function(r){ return r.project===proj && typeof r.costLikely==="number" && r.costLikely>0; });
        if(!rows.length) rows = dataset.filter(function(r){ return r.project===proj; });
        window._openRecordsModal(proj+" — Cost-Exposed Risks", rows, {exportName:"costproj_"+proj.replace(/\W+/g,"_")});
      }
    })
  });
  if(!withCost.length) document.getElementById("c-costproj").parentElement.innerHTML = UI.naCard("Estimated Cost Exposure by Project","No project in the current filter has a quantified likely-case cost impact recorded.");

  var withTime = projects.filter(function(p){return p.timeExposure>0;}).sort(function(a,b){return b.timeExposure-a.timeExposure;});
  window._mkChart("timeproj", document.getElementById("c-timeproj").getContext("2d"), {
    type:"bar",
    data:{labels:withTime.map(function(p){return p.project;}), datasets:[{data:withTime.map(function(p){return p.timeExposure;}), backgroundColor:C.categorical(withTime.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      plugins:{legend:{display:false}, tooltip:Object.assign({},C.baseOptions().plugins.tooltip,{callbacks:{label:function(item){return item.raw+" days";}}})},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var proj = withTime[hits[0].index].project;
        var rows = dataset.filter(function(r){ return r.project===proj && typeof r.timeLikely==="number" && r.timeLikely>0; });
        if(!rows.length) rows = dataset.filter(function(r){ return r.project===proj; });
        window._openRecordsModal(proj+" — Schedule-Exposed Risks", rows, {exportName:"timeproj_"+proj.replace(/\W+/g,"_")});
      }
    })
  });
  if(!withTime.length) document.getElementById("c-timeproj").parentElement.innerHTML = UI.naCard("Estimated Schedule Exposure by Project","No project in the current filter has a quantified likely-case schedule impact recorded.");

  var progLabels = Object.keys(agg.byProgram);
  var levels = ["Critical","High","Medium","Low","Nil"];
  var progLevelCounts = progLabels.map(function(p){
    var rows = dataset.filter(function(r){return r.program===p;});
    return levels.map(function(l){ return rows.filter(function(r){return (r.curLevel||"Nil")===l;}).length; });
  });
  window._mkChart("progstack", document.getElementById("c-progstack").getContext("2d"), {
    type:"bar",
    data:{labels:progLabels, datasets:levels.map(function(l,li){
      return {label:l, data:progLevelCounts.map(function(row){return row[li];}), backgroundColor:E.levelColor(l), borderRadius:2};
    })},
    options: C.baseOptions({indexAxis:"y", plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:10.5}}}, tooltip:C.baseOptions().plugins.tooltip},
      scales:{x:{stacked:true, beginAtZero:true}, y:{stacked:true, grid:{display:false}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var prog = progLabels[hits[0].index], lvl = levels[hits[0].datasetIndex];
        var rows = dataset.filter(function(r){ return r.program===prog && (r.curLevel||"Nil")===lvl; });
        if(!rows.length) return;
        window._openRecordsModal(prog+" — "+lvl+" Risks", rows, {exportName:"progstack_"+prog.replace(/\W+/g,"_")+"_"+lvl});
      }
    })
  });
};
})();
