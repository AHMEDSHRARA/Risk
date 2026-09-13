/* =========================================================================
   TAB 04 — Mitigation & Response
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

window.renderMitigation = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var el = document.getElementById("view-mitigation");

  // action-status tally across ALL actions (mitigationsAll when present, else the single primary action)
  function riskActions(r){ return (r.mitigationsAll && r.mitigationsAll.length) ? r.mitigationsAll : (r.action ? [{status:r.actionStatus, pct:r.pct}] : []); }
  function pctBucketOf(pct){ pct=Math.round((pct||0)*100); return pct>=100?"100%":pct>=76?"76-99%":pct>=51?"51-75%":pct>=26?"26-50%":"0-25%"; }
  var statusTally = {"Done":0, "In Progress":0, "Delayed":0, "Not Recorded":0};
  var pctBuckets = {"0-25%":0, "26-50%":0, "51-75%":0, "76-99%":0, "100%":0};
  dataset.forEach(function(r){
    var actions = riskActions(r);
    if(!actions.length){ statusTally["Not Recorded"]++; return; }
    actions.forEach(function(a){
      var st = a.status || "Not Recorded";
      statusTally[st] = (statusTally[st]||0)+1;
      pctBuckets[pctBucketOf(a.pct)]++;
    });
  });

  // Executive Action Matrix — open, high-exposure risks most needing attention:
  // no mitigation OR overdue OR (high/critical with residual not yet assessed)
  var attention = dataset.filter(function(r){
    if(!E.isOpenStatus(r.status)) return false;
    var aTotal = (typeof r.actionsTotal==="number")?r.actionsTotal:(r.action?1:0);
    var due = E.parseFlexDate(r.due);
    var overdue = due && due<E.todayDate() && (r.actionStatus||"").toLowerCase()!=="done";
    var noMit = aTotal===0;
    var highNoResidual = (r.curLevel==="Critical"||r.curLevel==="High") && typeof r.resScore!=="number";
    return overdue || noMit || highNoResidual;
  }).sort(function(a,b){ return (b.curScore||0)-(a.curScore||0); }).slice(0,20);

  el.innerHTML =
    '<div class="kpi-row n5">'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--good)"></div><div class="kpi-label">Risks With Mitigation</div><div class="kpi-value">'+agg.risksWithMitigation+'</div><div class="kpi-sub">'+E.fmtPct(agg.total?agg.risksWithMitigation/agg.total*100:0,0)+' of register</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--critical)"></div><div class="kpi-label">Without Mitigation</div><div class="kpi-value">'+agg.risksWithoutMitigation+'</div><div class="kpi-sub">no treatment action recorded</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--accent)"></div><div class="kpi-label">Mitigation Completion</div><div class="kpi-value">'+E.fmtPct(agg.mitigationCompletionRate,0)+'</div><div class="kpi-sub">'+agg.actionsDone+' of '+agg.actionsTotal+' actions done</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--serious)"></div><div class="kpi-label">Overdue Actions</div><div class="kpi-value">'+agg.actionsOverdue+'</div><div class="kpi-sub">past due date, not done</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--warning)"></div><div class="kpi-label">In Progress / Delayed</div><div class="kpi-value">'+agg.actionsInProgress+' / '+agg.actionsDelayed+'</div><div class="kpi-sub">action-level status</div></div>'+
    '</div>'+

    '<div class="grid g-3" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Mitigation Action Status</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-actstatus"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Mitigation Progress</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">% completion, all recorded actions</div><div class="chart-wrap"><canvas id="c-progress"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk Reduction — Inherent vs. Residual</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Average score by risk level, where a residual score exists</div><div class="chart-wrap"><canvas id="c-reduction"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Inherent vs. Residual Exposure by Program</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-progreduction"></canvas></div></div>'+
      '<div class="panel">'+UI.naCard("Risks by Response Strategy (Avoid / Reduce / Transfer / Accept / Escalate)","Not Available — the source register does not include a Response Strategy field. Every risk instead carries a free-text Treatment Plan and one or more Mitigation Actions, both shown in the risk detail panel and the Register tab. Add a Response Strategy column to the register to enable this breakdown.")+'</div>'+
    '</div>'+

    '<div class="section-title">Executive Action Matrix <span class="stq">open risks most needing management attention — no mitigation, overdue action, or unassessed residual exposure</span></div>'+
    '<div class="table-wrap wide"><table class="data-table" id="t-attention"><thead><tr>'+
      '<th>Risk ID</th><th>Risk</th><th>Score</th><th>Level</th><th>Owner</th><th>Mitigation</th><th>Due</th><th>Status</th><th>Residual</th>'+
    '</tr></thead><tbody>'+
    attention.map(function(r){
      var due = E.parseFlexDate(r.due);
      var overdue = due && due<E.todayDate() && (r.actionStatus||"").toLowerCase()!=="done";
      return '<tr class="'+(r.curLevel==="Critical"?"row-critical":"")+'" onclick="window._openDrawer(\''+String(r.id).replace(/'/g,"\\'")+'\')">'+
        '<td>'+E.esc(r.id)+'</td>'+
        '<td class="td-title">'+E.esc(r.title)+'</td>'+
        '<td class="num">'+E.fmtNum(r.curScore)+'</td>'+
        '<td>'+UI.levelPill(r.curLevel)+'</td>'+
        '<td>'+E.esc(r.owner||"Unassigned")+'</td>'+
        '<td>'+(r.actionsTotal?E.esc(r.action||"").slice(0,60)+((r.action||"").length>60?"…":""):'<span class="muted">None recorded</span>')+'</td>'+
        '<td style="'+(overdue?'color:var(--critical);font-weight:800;':'')+'">'+E.esc(E.dispDate(r.due))+'</td>'+
        '<td>'+E.esc(r.actionStatus||"—")+'</td>'+
        '<td>'+(typeof r.resScore==="number"?E.fmtNum(r.resScore)+" ("+r.resLevel+")":'<span class="muted">Not assessed</span>')+'</td>'+
      '</tr>';
    }).join("")+
    (attention.length===0 ? '<tr><td colspan="9" class="muted" style="text-align:center;padding:20px;">No open risks flagged for attention under the current filter.</td></tr>' : '')+
    '</tbody></table></div>';

  var statusKeys = Object.keys(statusTally);
  window._mkChart("actstatus", document.getElementById("c-actstatus").getContext("2d"), {
    type:"bar",
    data:{labels:statusKeys, datasets:[{data:Object.values(statusTally), backgroundColor:[E.cssVar("--good"),E.cssVar("--accent"),E.cssVar("--serious"),E.cssVar("--nil")], borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var st = statusKeys[hits[0].index];
        var rows = dataset.filter(function(r){
          var actions = riskActions(r);
          if(st==="Not Recorded") return !actions.length;
          return actions.some(function(a){ return (a.status||"Not Recorded")===st; });
        });
        if(!rows.length) return;
        window._openRecordsModal("Mitigation Actions — "+st, rows, {exportName:"actstatus_"+st.replace(/\W+/g,"_")});
      }
    })
  });

  var pctKeys = Object.keys(pctBuckets);
  window._mkChart("progress", document.getElementById("c-progress").getContext("2d"), {
    type:"bar",
    data:{labels:pctKeys, datasets:[{data:Object.values(pctBuckets), backgroundColor:C.categorical(5), borderRadius:5}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var bucket = pctKeys[hits[0].index];
        var rows = dataset.filter(function(r){ return riskActions(r).some(function(a){ return pctBucketOf(a.pct)===bucket; }); });
        if(!rows.length) return;
        window._openRecordsModal("Mitigation Progress — "+bucket, rows, {exportName:"progress_"+bucket.replace(/\W+/g,"_")});
      }
    })
  });

  var levels = ["Critical","High","Medium","Low"];
  var curByLevel = levels.map(function(l){ var xs=dataset.filter(function(r){return r.curLevel===l && typeof r.curScore==="number";}).map(function(r){return r.curScore;}); return xs.length?xs.reduce(function(a,b){return a+b;},0)/xs.length:0; });
  var resByLevel = levels.map(function(l){ var xs=dataset.filter(function(r){return r.curLevel===l && typeof r.resScore==="number";}).map(function(r){return r.resScore;}); return xs.length?xs.reduce(function(a,b){return a+b;},0)/xs.length:0; });
  window._mkChart("reduction", document.getElementById("c-reduction").getContext("2d"), {
    type:"bar",
    data:{labels:levels, datasets:[
      {label:"Inherent", data:curByLevel, backgroundColor:C.categorical(2)[0], borderRadius:4},
      {label:"Residual", data:resByLevel, backgroundColor:E.cssVar("--good"), borderRadius:4}
    ]},
    options: C.baseOptions({plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip}, scales:{y:{beginAtZero:true, max:25}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var l = levels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.curLevel===l && typeof r.resScore==="number"; });
        if(!rows.length) return;
        window._openRecordsModal(l+" — Inherent vs. Residual (assessed)", rows, {exportName:"reduction_"+l});
      }
    })
  });

  var progLabels = Object.keys(agg.byProgram);
  var curByProg = progLabels.map(function(p){ var xs=dataset.filter(function(r){return r.program===p && typeof r.curScore==="number";}).map(function(r){return r.curScore;}); return xs.length?xs.reduce(function(a,b){return a+b;},0)/xs.length:0; });
  var resByProg = progLabels.map(function(p){ var xs=dataset.filter(function(r){return r.program===p && typeof r.resScore==="number";}).map(function(r){return r.resScore;}); return xs.length?xs.reduce(function(a,b){return a+b;},0)/xs.length:0; });
  window._mkChart("progreduction", document.getElementById("c-progreduction").getContext("2d"), {
    type:"bar",
    data:{labels:progLabels, datasets:[
      {label:"Avg. Inherent", data:curByProg, backgroundColor:C.categorical(2)[0], borderRadius:4},
      {label:"Avg. Residual", data:resByProg, backgroundColor:E.cssVar("--good"), borderRadius:4}
    ]},
    options: C.baseOptions({plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip}, scales:{y:{beginAtZero:true, max:25}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var p = progLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.program===p; });
        if(!rows.length) return;
        window._openRecordsModal(p+" — Inherent vs. Residual Exposure", rows, {exportName:"progreduction_"+p.replace(/\W+/g,"_")});
      }
    })
  });
};
})();
