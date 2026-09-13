/* =========================================================================
   TAB 06 — Risk Performance & Statistics
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

window.renderPerformance = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var dq = E.computeDataQuality(dataset);
  var dupes = E.findCrossProjectDuplicates(dataset);
  var rpi = E.computeRPI(agg);
  var el = document.getElementById("view-performance");

  var avgAge = (function(){
    var ages = dataset.filter(function(r){return E.isOpenStatus(r.status);}).map(function(r){return E.ageDays(r.identDate);}).filter(function(a){return a!==null;});
    return ages.length ? ages.reduce(function(a,b){return a+b;},0)/ages.length : null;
  })();

  // simple, transparent velocity proxy: average new-Critical-risks/month over the last 3 identified months
  var monthKeys = Object.keys(agg.identMonthCounts).sort();
  var criticalByMonth = {};
  dataset.forEach(function(r){ if(r.curLevel==="Critical"){ var d=E.parseFlexDate(r.identDate); if(d){ var mk=E.monthKey(d); criticalByMonth[mk]=(criticalByMonth[mk]||0)+1; } } });
  var last3 = monthKeys.slice(-3);
  var velocity = last3.length ? last3.reduce(function(s,m){return s+(criticalByMonth[m]||0);},0)/last3.length : null;

  // Predicates mirroring E.computeDataQuality()'s deduction checks, in the
  // same order as dq.deductions, so a finding row can drill into the exact
  // records it counted without duplicating the scoring logic itself.
  var dqPredicates = [
    function(r){ return !r.id; },
    function(r){ return r.id && dq.dupIds.indexOf(r.id)>=0; },
    function(r){ return !r.owner || /^unassign/i.test(r.owner); },
    function(r){ return !r.prob; },
    function(r){ return typeof r.curScore!=="number"; },
    function(r){ var aTotal=(typeof r.actionsTotal==="number")?r.actionsTotal:(r.action?1:0); return !aTotal && E.isOpenStatus(r.status); },
    function(r){ return !r.due && E.isOpenStatus(r.status); },
    function(r){ return r.curLevel && E.LEVELS.indexOf(r.curLevel)<0; },
    function(r){ return r.status && !E.isKnownStatus(r.status); },
    function(r){ return r.identDate && !E.parseFlexDate(r.identDate); },
    function(r){ return r.due && !E.parseFlexDate(r.due); }
  ];

  el.innerHTML =
    '<div class="kpi-row n5">'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--good)"></div><div class="kpi-label">Closure Rate</div><div class="kpi-value">'+E.fmtPct(agg.closureRate,0)+'</div><div class="kpi-sub">'+agg.closed+' of '+agg.total+' closed</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--accent)"></div><div class="kpi-label">Mitigation Completion</div><div class="kpi-value">'+E.fmtPct(agg.mitigationCompletionRate,0)+'</div><div class="kpi-sub">action-level</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--serious)"></div><div class="kpi-label">Overdue Action Rate</div><div class="kpi-value">'+E.fmtPct(agg.overdueRate,0)+'</div><div class="kpi-sub">of all recorded actions</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--critical)"></div><div class="kpi-label">Critical Risk Ratio</div><div class="kpi-value">'+E.fmtPct(agg.criticalRatio,0)+'</div><div class="kpi-sub">of register</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--warning)"></div><div class="kpi-label">Residual Coverage</div><div class="kpi-value">'+E.fmtPct(agg.residualCoverage,0)+'</div><div class="kpi-sub">risks with a residual assessment</div></div>'+
    '</div>'+
    '<div class="kpi-row n4">'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--accent)"></div><div class="kpi-label">Average Inherent Score</div><div class="kpi-value">'+E.fmtNum(agg.avgCur,1)+'</div><div class="kpi-sub">of 25</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--good)"></div><div class="kpi-label">Average Residual Score</div><div class="kpi-value">'+E.fmtNum(agg.avgRes,1)+'</div><div class="kpi-sub">of 25, assessed risks only</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--nil)"></div><div class="kpi-label">Average Age — Open Risks</div><div class="kpi-value">'+(avgAge!==null?Math.round(avgAge)+"d":"—")+'</div><div class="kpi-sub">days since identification</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--warning)"></div><div class="kpi-label">New Critical Risks / Month</div><div class="kpi-value">'+(velocity!==null?velocity.toFixed(1):"—")+'</div><div class="kpi-sub">3-month trailing average ("risk velocity")</div></div>'+
    '</div>'+

    '<div class="grid g-2b" style="margin-bottom:14px;">'+
      '<div class="panel"><h3>Risk Performance Index</h3><div class="panel-sub">A transparent composite — never a black-box score</div>'+
        '<div class="grid g-2" style="align-items:center;">'+
        '<div id="g-rpi2"></div>'+
        '<div>'+ rpi.parts.map(function(p){ return '<div class="rpi-part"><span>'+p.key+'</span><b>'+p.value.toFixed(0)+'</b></div>'; }).join("") +
          (rpi.parts.length<4 ? '<div class="mi-note">'+(4-rpi.parts.length)+' sub-index/es excluded — required source field(s) not available for the current filter.</div>' : '') +
        '</div></div>'+
        '<div class="formula-box">RPI = mean( Closure Rate, Mitigation Completion Rate, 100 − Overdue Rate, Residual Risk Reduction % )<br>— only sub-indices with a computable source field are averaged.</div>'+
      '</div>'+
      '<div class="panel"><h3>Data Quality Score</h3><div class="panel-sub">Share of the register unaffected by any listed issue</div>'+
        '<div id="g-dq"></div>'+
        '<div class="formula-box">Score = 100 × (1 − Σ(issues×weight) / (records × Σweights))</div>'+
      '</div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>Register Data Quality Findings</h3><span class="tag">click a finding for records</span></div>'+
        '<div class="table-wrap"><table class="data-table" id="t-dqfindings"><thead><tr><th>Finding</th><th>Records</th><th>Weight</th></tr></thead><tbody>'+
        dq.deductions.map(function(d,i){ return '<tr data-dq-idx="'+i+'" style="'+(d.n?'cursor:pointer;':'opacity:.55;')+'">'+
          '<td>'+d.label+'</td><td class="num">'+d.n+'</td><td class="num">'+d.weight+'</td></tr>'; }).join("")+
        '</tbody></table></div>'+
      '</div>'+
      '<div class="panel"><div class="panel-head"><h3>Cross-Project Duplicate Records</h3>'+(dupes.length?'<span class="tag">click a group for details</span>':'')+'</div><div class="panel-sub">Identical title + cause text filed under more than one project</div>'+
        (dupes.length ? '<div class="table-wrap"><table class="data-table" id="t-dupes"><thead><tr><th>Risk Title</th><th>Projects Affected</th><th>Records</th></tr></thead><tbody>'+
          dupes.slice(0,25).map(function(d,i){ return '<tr data-dupe-idx="'+i+'" style="cursor:pointer;"><td class="td-title">'+E.esc(d.rows[0].title)+'</td><td>'+E.esc(d.projects.join(" ↔ "))+'</td><td class="num">'+d.rows.length+'</td></tr>'; }).join("")+
        '</tbody></table></div>'+
        (dupes.length>25?'<div class="mi-note">Showing 25 of '+dupes.length+' duplicate groups.</div>':'')
        : '<div class="mi-note">No cross-project duplicates detected in the current filter.</div>')+
      '</div>'+
    '</div>'+

    '<div class="grid g-2">'+
      '<div class="panel">'+UI.naCard("Risk Escalation Rate","Not Available — the register\'s Status field (Open / Emerging / Closed…) does not include an \"Escalated\" state. Add an escalation flag or status value to the source register to enable this rate.")+'</div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk Count by Owner Concentration</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Owners holding the most risk (concentration risk in itself)</div><div class="chart-wrap"><canvas id="c-ownerconc"></canvas></div></div>'+
    '</div>';

  var dqRows = document.getElementById("t-dqfindings");
  if(dqRows) dqRows.querySelectorAll("tr[data-dq-idx]").forEach(function(tr){
    tr.addEventListener("click", function(){
      var i = +tr.getAttribute("data-dq-idx");
      var d = dq.deductions[i], pred = dqPredicates[i];
      var rows = dataset.filter(pred);
      if(!rows.length) return;
      window._openRecordsModal("Data Quality — "+d.label, rows, {exportName:"dq_"+d.label.replace(/\W+/g,"_")});
    });
  });
  var dupeRows = document.getElementById("t-dupes");
  if(dupeRows) dupeRows.querySelectorAll("tr[data-dupe-idx]").forEach(function(tr){
    tr.addEventListener("click", function(){
      var d = dupes[+tr.getAttribute("data-dupe-idx")];
      window._openRecordsModal("Duplicate — "+d.rows[0].title, d.rows, {exportName:"dupe_"+(+tr.getAttribute("data-dupe-idx"))});
    });
  });

  UI.renderGauge("g-rpi2", {value:rpi.value, max:100, fmt:function(v){return Math.round(v);}, caption:"0-100, higher is better"});
  UI.renderGauge("g-dq", {value:dq.score, max:100, fmt:function(v){return v.toFixed(0);}, caption:dq.total+" records assessed against "+dq.deductions.length+" checks"});

  var ownerLabels = Object.keys(agg.byOwner).sort(function(a,b){return agg.byOwner[b]-agg.byOwner[a];}).slice(0,12);
  window._mkChart("ownerconc", document.getElementById("c-ownerconc").getContext("2d"), {
    type:"bar",
    data:{labels:ownerLabels, datasets:[{data:ownerLabels.map(function(o){return agg.byOwner[o];}), backgroundColor:C.categorical(ownerLabels.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true, ticks:{precision:0}}, y:{grid:{display:false}, ticks:{font:{size:10}}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var o = ownerLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return r.owner===o; });
        if(!rows.length) return;
        window._openRecordsModal(o+" — Owned Risks", rows, {exportName:"ownerconc_"+o.replace(/\W+/g,"_")});
      }
    })
  });
};
})();
