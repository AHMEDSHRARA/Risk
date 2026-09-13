/* =========================================================================
   TAB 03 — Risk Trend & S-Curve
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI, C = window.RiskCharts;

function monthRange(dataset){
  var idents = dataset.map(function(r){return E.parseFlexDate(r.identDate);}).filter(Boolean);
  var closes = dataset.map(function(r){return E.parseFlexDate(r.closedDate);}).filter(Boolean);
  var all = idents.concat(closes);
  if(!all.length) return [];
  var min = new Date(Math.min.apply(null, all)), max = new Date(Math.max.apply(null, all));
  var months = [];
  var cur = new Date(min.getFullYear(), min.getMonth(), 1);
  var end = new Date(max.getFullYear(), max.getMonth(), 1);
  while(cur<=end){ months.push(E.monthKey(cur)); cur.setMonth(cur.getMonth()+1); }
  return months;
}

window.renderTrend = function(){
  var dataset = window._filteredData();
  var agg = E.computeAgg(dataset);
  var el = document.getElementById("view-trend");

  var validIdent = dataset.filter(function(r){return E.parseFlexDate(r.identDate);}).length;
  var validClosed = dataset.filter(function(r){return r.closedDate && E.parseFlexDate(r.closedDate);}).length;
  var openAges = dataset.filter(function(r){return E.isOpenStatus(r.status);}).map(function(r){return E.ageDays(r.identDate);}).filter(function(a){return a!==null;}).sort(function(a,b){return a-b;});
  var medianAge = openAges.length ? openAges[Math.floor(openAges.length/2)] : null;
  var maxAge = openAges.length ? openAges[openAges.length-1] : null;

  el.innerHTML =
    '<div class="kpi-row n4">'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--accent)"></div><div class="kpi-label">Identified-Date Coverage</div><div class="kpi-value">'+validIdent+' / '+dataset.length+'</div><div class="kpi-sub">'+agg.invalidIdentDate+' unparseable value(s)</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--good)"></div><div class="kpi-label">Closed-Date Coverage</div><div class="kpi-value">'+validClosed+' / '+agg.closed+'</div><div class="kpi-sub">of records marked Closed</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--warning)"></div><div class="kpi-label">Median Age — Open Risks</div><div class="kpi-value">'+(medianAge!==null?medianAge+"d":"—")+'</div><div class="kpi-sub">days since identification</div></div>'+
      '<div class="kpi"><div class="kpi-bar" style="background:var(--critical)"></div><div class="kpi-label">Oldest Open Risk</div><div class="kpi-value">'+(maxAge!==null?maxAge+"d":"—")+'</div><div class="kpi-sub">longest-standing open item</div></div>'+
    '</div>'+

    '<div class="panel" style="margin-bottom:14px;">'+
      '<div class="panel-head"><h3>Risk S-Curve — Cumulative Identified vs. Closed</h3><span class="tag">click a point for that month\'s records</span></div>'+
      '<div class="chart-wrap tall"><canvas id="c-scurve"></canvas></div>'+
      '<div class="mi-note">Built from each risk\'s own Identified Date and Closed Date. A widening gap between the two lines is the register\'s open backlog at that point in time.</div>'+
    '</div>'+

    '<div class="grid g-2" style="margin-bottom:14px;">'+
      '<div class="panel"><div class="panel-head"><h3>New vs. Closed Risks by Month</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-monthly"></canvas></div></div>'+
      '<div class="panel"><div class="panel-head"><h3>Risk Aging — Open Risks</h3><span class="tag">click a bar for details</span></div><div class="panel-sub">Days since identification</div><div class="chart-wrap"><canvas id="c-aging"></canvas></div></div>'+
    '</div>'+

    '<div class="grid g-2">'+
      '<div class="panel"><div class="panel-head"><h3>Average Age by Program (Open Risks)</h3><span class="tag">click a bar for details</span></div><div class="chart-wrap"><canvas id="c-ageprog"></canvas></div></div>'+
      '<div class="panel">'+UI.naCard("Historical Exposure Trend (Inherent vs. Residual over time)","Not Available — the register captures a single current snapshot per risk (one inherent score, one residual score); it does not store dated score history. Tracking exposure trend requires periodic re-scoring with a recorded assessment date in the source register.")+'</div>'+
    '</div>';

  var months = monthRange(dataset);
  if(!months.length){
    document.getElementById("c-scurve").parentElement.innerHTML = '<div class="mi-note">No identifiable dates in the current filter selection.</div>';
  } else {
    var identByMonth = {}, closedByMonth = {};
    months.forEach(function(m){ identByMonth[m]=0; closedByMonth[m]=0; });
    dataset.forEach(function(r){
      var d = E.parseFlexDate(r.identDate); if(d){ var mk=E.monthKey(d); if(identByMonth[mk]!==undefined) identByMonth[mk]++; }
      var cd = E.parseFlexDate(r.closedDate); if(cd){ var mk2=E.monthKey(cd); if(closedByMonth[mk2]!==undefined) closedByMonth[mk2]++; }
    });
    var cumIdent=0, cumClosed=0;
    var cumIdentSeries = months.map(function(m){ cumIdent+=identByMonth[m]; return cumIdent; });
    var cumClosedSeries = months.map(function(m){ cumClosed+=closedByMonth[m]; return cumClosed; });
    var labels = months.map(E.monthLabel);

    window._mkChart("scurve", document.getElementById("c-scurve").getContext("2d"), {
      type:"line",
      data:{labels:labels, datasets:[
        {label:"Cumulative Identified", data:cumIdentSeries, borderColor:C.categorical(2)[0], backgroundColor:"transparent", borderWidth:2.5, pointRadius:2, tension:.25},
        {label:"Cumulative Closed", data:cumClosedSeries, borderColor:E.cssVar("--good"), backgroundColor:"transparent", borderWidth:2.5, pointRadius:2, tension:.25, borderDash:[5,3]}
      ]},
      options: C.baseOptions({plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip},
        scales:{x:{ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:12}}, y:{beginAtZero:true, ticks:{precision:0}}},
        onClick:function(evt,_els,chart){
          var hits = C.pick(evt, chart); if(!hits.length) return;
          var mk = months[hits[0].index], mlabel = E.monthLabel(mk), dsIdx = hits[0].datasetIndex;
          var isClosed = dsIdx===1;
          var rows = dataset.filter(function(r){
            var d = isClosed ? E.parseFlexDate(r.closedDate) : E.parseFlexDate(r.identDate);
            return d && E.monthKey(d)===mk;
          });
          if(!rows.length) return;
          window._openRecordsModal((isClosed?"Closed":"Identified")+" in "+mlabel, rows, {exportName:(isClosed?"closed_":"identified_")+mk});
        }
      })
    });

    window._mkChart("monthly", document.getElementById("c-monthly").getContext("2d"), {
      type:"bar",
      data:{labels:labels, datasets:[
        {label:"New", data:months.map(function(m){return identByMonth[m];}), backgroundColor:C.categorical(2)[0], borderRadius:3},
        {label:"Closed", data:months.map(function(m){return closedByMonth[m];}), backgroundColor:E.cssVar("--good"), borderRadius:3}
      ]},
      options: C.baseOptions({plugins:{legend:{display:true, position:"top", align:"end", labels:{boxWidth:10, color:C.textColor(), font:{size:11}}}, tooltip:C.baseOptions().plugins.tooltip},
        scales:{x:{ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:12}}, y:{beginAtZero:true, ticks:{precision:0}}},
        onClick:function(evt,_els,chart){
          var hits = C.pick(evt, chart); if(!hits.length) return;
          var mk = months[hits[0].index], mlabel = E.monthLabel(mk), dsIdx = hits[0].datasetIndex;
          var isClosed = dsIdx===1;
          var rows = dataset.filter(function(r){
            var d = isClosed ? E.parseFlexDate(r.closedDate) : E.parseFlexDate(r.identDate);
            return d && E.monthKey(d)===mk;
          });
          if(!rows.length) return;
          window._openRecordsModal((isClosed?"Closed":"New — Identified")+" in "+mlabel, rows, {exportName:(isClosed?"closed_":"new_")+mk});
        }
      })
    });
  }

  window._mkChart("aging", document.getElementById("c-aging").getContext("2d"), {
    type:"bar",
    data:{labels:E.AGING_BUCKETS, datasets:[{data:E.AGING_BUCKETS.map(function(b){return agg.agingCounts[b]||0;}), backgroundColor:["#2a9d4f","#8bbf3f","#e9c46a","#f4a261","#d03b3b"].map(function(hex,i){return i<2?E.cssVar("--good"):i===2?E.cssVar("--warning"):i===3?E.cssVar("--serious"):E.cssVar("--critical");}), borderRadius:5}]},
    options: C.baseOptions({scales:{y:{beginAtZero:true, ticks:{precision:0}}},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var bucket = E.AGING_BUCKETS[hits[0].index];
        var rows = dataset.filter(function(r){ if(!E.isOpenStatus(r.status)) return false; var age=E.ageDays(r.identDate); return age!==null && E.agingBucket(age)===bucket; });
        if(!rows.length) return;
        window._openRecordsModal("Open Risks Aged "+bucket+" Days", rows, {exportName:"aging_"+bucket.replace(/\W+/g,"_")});
      }
    })
  });

  var progAges = {};
  dataset.filter(function(r){return E.isOpenStatus(r.status);}).forEach(function(r){
    var age = E.ageDays(r.identDate); if(age===null) return;
    progAges[r.program]=progAges[r.program]||{sum:0,n:0}; progAges[r.program].sum+=age; progAges[r.program].n++;
  });
  var progLabels = Object.keys(progAges).sort(function(a,b){return (progAges[b].sum/progAges[b].n)-(progAges[a].sum/progAges[a].n);});
  window._mkChart("ageprog", document.getElementById("c-ageprog").getContext("2d"), {
    type:"bar",
    data:{labels:progLabels, datasets:[{data:progLabels.map(function(p){return Math.round(progAges[p].sum/progAges[p].n);}), backgroundColor:C.categorical(progLabels.length), borderRadius:5}]},
    options: C.baseOptions({indexAxis:"y", scales:{x:{beginAtZero:true}, y:{grid:{display:false}}},
      plugins:{legend:{display:false}, tooltip:Object.assign({},C.baseOptions().plugins.tooltip,{callbacks:{label:function(item){return item.raw+" days average";}}})},
      onClick:function(evt,_els,chart){
        var hits = C.pick(evt, chart); if(!hits.length) return;
        var p = progLabels[hits[0].index];
        var rows = dataset.filter(function(r){ return E.isOpenStatus(r.status) && r.program===p; });
        if(!rows.length) return;
        window._openRecordsModal(p+" — Open Risks", rows, {exportName:"ageprog_"+p.replace(/\W+/g,"_")});
      }
    })
  });
};
})();
