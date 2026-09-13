/* =========================================================================
   TAB 01 — Executive Risk Command Center
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

function kpi(label, value, sub, opt){
  opt = opt||{};
  var barColor = opt.bar || "var(--accent)";
  var clickable = opt.onClick ? ' kpi-clickable" onclick="'+opt.onClick+'"' : '"';
  return '<div class="kpi'+(opt.critical?' accent-critical':'')+clickable+'>'+
    '<div class="kpi-bar" style="background:'+barColor+'"></div>'+
    '<div class="kpi-top"><div class="kpi-label">'+label+'</div></div>'+
    '<div class="kpi-value" id="'+opt.id+'">'+(opt.raw!==undefined?opt.raw:E.fmtNum(value))+'</div>'+
    (sub? '<div class="'+(opt.na?'kpi-na':'kpi-sub')+'">'+sub+'</div>' : '')+
  '</div>';
}

function buildInsights(agg, dq, dataset){
  var insights = [];
  var progEntries = Object.keys(agg.byProgram).map(function(k){return {k:k,n:agg.byProgram[k]};}).sort(function(a,b){return b.n-a.n;});
  var topProgram = progEntries[0];
  var projEntries = Object.keys(agg.byProject).map(function(k){return agg.byProject[k];}).sort(function(a,b){return b.critical-a.critical;});
  var topProject = projEntries[0];

  if(agg.total>0){
    insights.push({sev:"critical", title:agg.byLevel.Critical+" critical risks open across the portfolio ("+E.fmtPct(agg.criticalRatio,0)+" of the register)"+(topProgram?", concentrated most heavily in "+E.esc(topProgram.k):""),
      body: topProject ? "The single highest concentration of critical exposure sits in \""+E.esc(topProject.project)+"\" ("+topProject.critical+" critical risks). This is the first project a CDO review should open." : ""});
  }
  if(agg.avgPairedReductionPct!==null){
    insights.push({sev: agg.avgPairedReductionPct>=40?"good":"warning",
      title:"Mitigation is reducing risk scores by "+E.fmtPct(agg.avgPairedReductionPct,0)+" on average, post-treatment",
      body:"Based on the "+(agg.total-agg.noResidual)+" risks with a completed residual assessment. "+agg.noResidual+" risks ("+E.fmtPct(agg.total?agg.noResidual/agg.total*100:0,0)+") have no residual score yet — their true post-mitigation exposure is unverified."});
  }
  if(agg.overdueRisk>0){
    insights.push({sev:"serious", title:agg.overdueRisk+" open risks have a mitigation due date already in the past",
      body:"These require immediate re-baselining or escalation — see the Mitigation & Response tab for the full list, ranked by exposure."});
  }
  if(agg.noOwner>0){
    insights.push({sev:"warning", title:agg.noOwner+" risks have no named accountable owner",
      body:"Ownership gaps are a leading indicator of stalled mitigation; assigning owners is typically the fastest lever available to management."});
  }
  var dupes = E.findCrossProjectDuplicates(dataset);
  if(dupes.length>0){
    var rows = dupes.reduce(function(s,d){return s+d.rows.length;},0);
    var projs = E.uniqSorted([].concat.apply([],dupes.map(function(d){return d.projects;})));
    insights.push({sev:"serious", title:rows+" risk records are verbatim duplicates carried across "+projs.length+" different projects ("+projs.join(" ↔ ")+")",
      body:"This inflates the apparent risk count for those projects and should be reconciled at source — see Risk Performance & Statistics → Data Quality for the full list."});
  }
  if(dq.score<80){
    insights.push({sev:"warning", title:"Register data quality is "+dq.score.toFixed(0)+"/100 — below the 80 threshold typically expected for board-level reporting",
      body:"Primary gaps: "+dq.deductions.filter(function(d){return d.n>0;}).sort(function(a,b){return b.n-a.n;}).slice(0,2).map(function(d){return d.n+" "+d.label.toLowerCase();}).join("; ")+"."});
  }
  return insights;
}

/* KPI cards call this by name (kept global so the inline onclick attribute
   in kpi() above doesn't need a closure) — always recomputes against the
   CURRENT filtered dataset so the drill-down always matches what's on screen. */
window._execKpiDrill = function(kind){
  var dataset = window._filteredData();
  var due, overdue;
  var specs = {
    total:      {title:"All Tracked Risks", rows: dataset},
    open:       {title:"Open / Emerging Risks", rows: dataset.filter(function(r){ return E.isOpenStatus(r.status); })},
    critical:   {title:"Critical Risks", rows: dataset.filter(function(r){ return r.curLevel==="Critical"; })},
    high:       {title:"High Risks", rows: dataset.filter(function(r){ return r.curLevel==="High"; })},
    medium:     {title:"Medium Risks", rows: dataset.filter(function(r){ return r.curLevel==="Medium"; })},
    lownil:     {title:"Low / Nil Risks", rows: dataset.filter(function(r){ return r.curLevel==="Low"||r.curLevel==="Nil"; })},
    overdue:    {title:"Overdue Risks — Mitigation Due Date Passed", rows: dataset.filter(function(r){
                    var d = E.parseFlexDate(r.due); return d && d<E.todayDate() && E.isOpenStatus(r.status) && (r.actionStatus||"").toLowerCase()!=="done";
                  })},
    nomit:      {title:"Risks Without a Mitigation Action", rows: dataset.filter(function(r){
                    var aTotal = (typeof r.actionsTotal==="number")?r.actionsTotal:(r.action?1:0); return aTotal===0;
                  })},
    noowner:    {title:"Risks Without a Named Owner", rows: dataset.filter(function(r){ return !r.owner || /^unassign/i.test(r.owner); })},
    nores:      {title:"Risks Without a Residual Assessment", rows: dataset.filter(function(r){ return typeof r.resScore!=="number"; })},
    cost:       {title:"Risks With a Quantified Cost Exposure", rows: dataset.filter(function(r){ return typeof r.costLikely==="number"; }).sort(function(a,b){return (b.costLikely||0)-(a.costLikely||0);})}
  };
  var spec = specs[kind]; if(!spec) return;
  window._openRecordsModal(spec.title, spec.rows, {exportName:"exec_"+kind});
};

function insightIconColor(sev){
  return sev==="critical"?E.cssVar("--critical"):sev==="serious"?E.cssVar("--serious"):sev==="warning"?E.cssVar("--warning"):E.cssVar("--good");
}

window.renderExec = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var dq = E.computeDataQuality(dataset);
  var rpi = E.computeRPI(agg);
  var el = document.getElementById("view-exec");

  var insights = buildInsights(agg, dq, dataset);
  var bannerHtml = insights.length ? insights.slice(0,1).map(function(i){
    return '<div class="eb-tag">Executive Risk Message</div><p><b>'+i.title+'.</b> '+i.body+'</p>';
  }).join("") : '<div class="eb-tag">Executive Risk Message</div><p>No risks match the current filter.</p>';

  el.innerHTML =
    '<div class="exec-banner">'+bannerHtml+'</div>'+

    '<div class="kpi-row">'+
      kpi("Total Risks", agg.total, agg.opportunities?agg.opportunities+" opportunities included":"across "+Object.keys(agg.byProject).length+" projects", {id:"kv-total", onClick:"window._execKpiDrill('total')"})+
      kpi("Open Risks", agg.open, agg.emerging+" emerging", {id:"kv-open", bar:"var(--accent)", onClick:"window._execKpiDrill('open')"})+
      kpi("Critical", agg.byLevel.Critical, E.fmtPct(agg.criticalRatio,0)+" of register", {id:"kv-critical", bar:"var(--critical)", critical:agg.byLevel.Critical>0, onClick:"window._execKpiDrill('critical')"})+
      kpi("High", agg.byLevel.High, "", {id:"kv-high", bar:"var(--serious)", onClick:"window._execKpiDrill('high')"})+
      kpi("Medium", agg.byLevel.Medium, "", {id:"kv-medium", bar:"var(--warning)", onClick:"window._execKpiDrill('medium')"})+
      kpi("Low / Nil", agg.byLevel.Low+agg.byLevel.Nil, "", {id:"kv-low", bar:"var(--good)", onClick:"window._execKpiDrill('lownil')"})+
    '</div>'+
    '<div class="kpi-row n5">'+
      kpi("Overdue Risks", agg.overdueRisk, "mitigation due date passed", {id:"kv-overdue", bar:"var(--critical)", onClick:"window._execKpiDrill('overdue')"})+
      kpi("Without Mitigation", agg.risksWithoutMitigation, "no treatment action recorded", {id:"kv-nomit", bar:"var(--serious)", onClick:"window._execKpiDrill('nomit')"})+
      kpi("Without Owner", agg.noOwner, "accountability gap", {id:"kv-noowner", bar:"var(--warning)", onClick:"window._execKpiDrill('noowner')"})+
      kpi("No Residual Assessment", agg.noResidual, "post-mitigation score not yet set", {id:"kv-nores", bar:"var(--nil)", onClick:"window._execKpiDrill('nores')"})+
      kpi("Est. Cost Exposure", null, agg.costExposureN+" of "+agg.total+" risks quantified (likely-case)", {raw:E.fmtMoney(agg.costExposure), id:"kv-cost", bar:"var(--accent)", onClick:"window._execKpiDrill('cost')"})+
    '</div>'+

    '<div class="grid g-3" style="margin-bottom:14px;">'+
      '<div class="panel"><h3>Overall Risk Health</h3><div class="panel-sub">100 − share of open risks rated Critical or High</div><div id="g-health"></div></div>'+
      '<div class="panel"><h3>Mitigation Effectiveness</h3><div class="panel-sub">Average score reduction, inherent → residual</div><div id="g-mit"></div></div>'+
      '<div class="panel"><h3>Risk Performance Index</h3><div class="panel-sub">Composite of closure, mitigation, on-time action & reduction rates</div><div id="g-rpi"></div></div>'+
    '</div>'+

    '<div class="grid g-3" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Risk Distribution by Level</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-level"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk by Status</h3><span class="tag">click a slice for details</span></div><div class="chart-wrap"><canvas id="c-status"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Top 10 Risk Exposure</h3><span class="tag">by inherent score</span></div><div class="chart-wrap tall"><canvas id="c-top10"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Risk by Program</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-program"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk by Category (avg. score)</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-category"></canvas></div></div>'+
    '</div>'+

    '<div class="section-title">Executive Insights <span class="stq">auto-generated from the current filter</span></div>'+
    '<div class="insight-list">'+
      insights.map(function(i){
        return '<div class="insight"><div class="dot" style="background:'+insightIconColor(i.sev)+'"></div><div><b>'+i.title+'.</b><p>'+i.body+'</p></div></div>';
      }).join("")+
      (insights.length===0?'<div class="mi-note">No notable findings for the current filter selection.</div>':'')+
    '</div>';

  // ---- gauges ----
  var openCritHigh = dataset.filter(function(r){ return E.isOpenStatus(r.status) && (r.curLevel==="Critical"||r.curLevel==="High"); }).length;
  var healthScore = agg.open ? 100 - (openCritHigh/agg.open*100) : null;
  UI.renderGauge("g-health", {value: healthScore, max:100, suffix:"", fmt:function(v){return Math.round(v)+"/100";}, caption:"Open risks only · higher is healthier"});
  UI.renderGauge("g-mit", {value: agg.avgPairedReductionPct, max:100, fmt:function(v){return Math.round(v)+"%";}, caption: agg.avgPairedReductionPct!==null ? "Paired inherent→residual comparison, n="+(agg.total-agg.noResidual) : "No risks with both inherent and residual scores"});
  UI.renderGauge("g-rpi", {value: rpi.value, max:100, fmt:function(v){return Math.round(v);}, caption: rpi.parts.length ? "Averaged over "+rpi.parts.length+" of 4 sub-indices (see Performance tab)" : "Insufficient data"});

  // ---- charts ----
  var levelLabels = ["Critical","High","Medium","Low","Nil"];
  var levelData = levelLabels.map(function(l){return agg.byLevel[l]||0;});
  window._mkChart("level", document.getElementById("c-level").getContext("2d"), {
    type:"bar",
    data:{labels:levelLabels, datasets:[{data:levelData, backgroundColor:C.levelColorsFor(levelLabels), borderRadius:4, maxBarThickness:34}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, grid:{color:C.gridColor()}, ticks:{color:C.mutedColor(), precision:0}}, y:{grid:{display:false}, ticks:{color:C.mutedColor()}}},
      onClick:function(evt,_els,chart){ var hits=C.pick(evt,chart); if(!hits.length) return;
        var lvl = levelLabels[hits[0].index];
        // Modal only — NOT a global cross-filter: filtering this chart by the
        // very dimension it displays would collapse its other bars to zero,
        // making them unclickable until Reset Filters. See Risk by Program
        // below for a dimension where cross-filtering still makes sense.
        C.afterClick(function(){
          window._openRecordsModal(lvl+" Risks", dataset.filter(function(r){ return (r.curLevel||"Nil")===lvl; }), {exportName:"risks_level_"+lvl});
        });
      }
    })
  });

  var statusLabels = Object.keys(agg.byStatus).sort(function(a,b){return agg.byStatus[b]-agg.byStatus[a];});
  window._mkChart("status", document.getElementById("c-status").getContext("2d"), {
    type:"doughnut",
    data:{labels:statusLabels, datasets:[{data:statusLabels.map(function(s){return agg.byStatus[s];}), backgroundColor:C.categorical(statusLabels.length), borderWidth:2, borderColor:C.surface()}]},
    options: {responsive:true, maintainAspectRatio:false, cutout:"62%", plugins:{legend:{display:true, position:"bottom", labels:{boxWidth:9, color:C.textColor(), font:{size:10.5}}}, tooltip:C.baseOptions().plugins.tooltip},
      onClick:function(evt,_els,chart){ var hits=C.pick(evt,chart); if(!hits.length) return;
        var st = statusLabels[hits[0].index];
        C.afterClick(function(){
          window._openRecordsModal(st+" Risks", dataset.filter(function(r){ return r.status===st; }), {exportName:"risks_status_"+st});
        });
      } }
  });

  // ---- Top 10 Risk Exposure — every bar clickable, toggles a persistent
  // red "active" highlight (matches the requested selected-state look) and
  // opens the full risk detail drawer for that specific record.
  var top10 = dataset.slice().sort(function(a,b){return (b.curScore||0)-(a.curScore||0);}).slice(0,10);
  var selectedTop10Id = null;
  function top10Fills(){ return top10.map(function(r){ return r.id===selectedTop10Id ? E.cssVar("--critical") : C.levelColorsFor([r.curLevel])[0]; }); }
  function top10Borders(){ return top10.map(function(r){ return r.id===selectedTop10Id ? "#ffffff" : "transparent"; }); }
  function top10BorderW(){ return top10.map(function(r){ return r.id===selectedTop10Id ? 2 : 0; }); }
  function buildTop10Chart(){
    // Rebuilding (destroy + new Chart) rather than mutating + chart.update()
    // is deliberate: calling update() on a chart from inside its OWN click
    // handler corrupts this Chart.js build's hit-testing for the NEXT click
    // (verified — every other click handler in this app already rebuilds via
    // _mkChart on every re-render, which is why only this one needed care).
    window._mkChart("top10", document.getElementById("c-top10").getContext("2d"), {
      type:"bar",
      data:{labels:top10.map(function(r){return r.id;}), datasets:[{data:top10.map(function(r){return r.curScore;}), backgroundColor:top10Fills(), borderColor:top10Borders(), borderWidth:top10BorderW(), borderRadius:4, maxBarThickness:22}]},
      options: C.baseOptions({indexAxis:"y", scales:{x:{max:25, grid:{color:C.gridColor()}, ticks:{color:C.mutedColor()}}, y:{grid:{display:false}, ticks:{color:C.mutedColor(), font:{size:10}}}},
        plugins:{legend:{display:false}, tooltip:Object.assign({},C.baseOptions().plugins.tooltip,{callbacks:{title:function(items){ var r=top10[items[0].dataIndex]; return r.id+" — "+r.title; }, label:function(item){ var r=top10[item.dataIndex]; return "Score "+r.curScore+" ("+r.curLevel+") · "+r.project+" · click to open / click again to deselect"; }}})},
        onClick:function(evt,_els,chart){
          var hits = C.pick(evt, chart); if(!hits.length) return;
          var r = top10[hits[0].index];
          selectedTop10Id = (selectedTop10Id===r.id) ? null : r.id;
          // Defer to a fresh tick: Chart.js still has internal bookkeeping to
          // finish for THIS click after our callback returns, and destroying
          // the chart synchronously here throws inside that internal step
          // ("Cannot read properties of undefined (reading 'handleEvent')"),
          // which then breaks hit-testing for every click after it.
          setTimeout(function(){
            buildTop10Chart();
            if(selectedTop10Id) window._openDrawer(r.id);
          }, 0);
        }
      })
    });
  }
  buildTop10Chart();

  var progLabels = Object.keys(agg.byProgram).sort(function(a,b){return agg.byProgram[b]-agg.byProgram[a];});
  window._mkChart("program", document.getElementById("c-program").getContext("2d"), {
    type:"bar",
    data:{labels:progLabels, datasets:[{data:progLabels.map(function(p){return agg.byProgram[p];}), backgroundColor:C.categorical(progLabels.length), borderRadius:5, maxBarThickness:46}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}}, onClick:function(evt,_els,chart){ var hits=C.pick(evt,chart); if(!hits.length) return;
      var p = progLabels[hits[0].index];
      C.afterClick(function(){
        window._openRecordsModal(p+" Program — All Risks", dataset.filter(function(r){ return r.program===p; }), {exportName:"risks_program_"+p});
      });
    }})
  });

  var catKeys = ["cost","time","hsse","quality"].filter(function(k){return agg.byCategory[k];});
  var catLabels = catKeys.map(function(k){return k[0].toUpperCase()+k.slice(1);});
  window._mkChart("category", document.getElementById("c-category").getContext("2d"), {
    type:"bar",
    data:{labels:catLabels, datasets:[{label:"Avg. Score", data:catKeys.map(function(k){return agg.byCategory[k].sum/agg.byCategory[k].n;}), backgroundColor:C.categorical(4), borderRadius:5, maxBarThickness:46}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, max:25}},
      onClick:function(evt,_els,chart){ var hits=C.pick(evt,chart); if(!hits.length) return;
        var k = catKeys[hits[0].index], label = catLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return typeof r[k]==="number"; }).sort(function(a,b){ return (b[k]||0)-(a[k]||0); });
        window._openRecordsModal(label+" Category — Risks with a Recorded "+label+" Score", rows, {exportName:"risks_category_"+k});
      }
    })
  });
};
})();
