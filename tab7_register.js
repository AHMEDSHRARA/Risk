/* =========================================================================
   TAB 07 — Risk Register / Executive Data Explorer
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI;

var COLS = [
  {key:"id", label:"Risk ID"}, {key:"title", label:"Risk Title"}, {key:"program", label:"Program"},
  {key:"project", label:"Project"}, {key:"owner", label:"Owner"}, {key:"status", label:"Status"},
  {key:"curLevel", label:"Level"}, {key:"curScore", label:"Score"}, {key:"resScore", label:"Residual"},
  {key:"due", label:"Due"}, {key:"actionStatus", label:"Action Status"}
];

function sortRows(rows, key, dir){
  var mul = dir==="asc" ? 1 : -1;
  return rows.slice().sort(function(a,b){
    var av=a[key], bv=b[key];
    if(av===null||av===undefined) av = typeof bv==="number" ? -Infinity : "";
    if(bv===null||bv===undefined) bv = typeof av==="number" ? -Infinity : "";
    if(typeof av==="string") av=av.toLowerCase();
    if(typeof bv==="string") bv=bv.toLowerCase();
    if(av<bv) return -1*mul;
    if(av>bv) return 1*mul;
    return 0;
  });
}

window.renderRegister = function(){
  var dataset = window._filteredData();
  var st = window._RiskState.register;
  var el = document.getElementById("view-register");

  var sorted = sortRows(dataset, st.sortKey, st.sortDir);
  var totalPages = Math.max(1, Math.ceil(sorted.length/st.pageSize));
  if(st.page>totalPages) st.page = totalPages;
  var pageRows = sorted.slice((st.page-1)*st.pageSize, st.page*st.pageSize);

  el.innerHTML =
    '<div class="reg-toolbar">'+
      '<span class="tag">'+dataset.length+' of '+window._RiskState.data.length+' risks match current filters</span>'+
      '<span class="tag">'+E.uniqSorted(dataset.map(function(r){return r.project;})).length+' projects</span>'+
      '<span class="tag">'+dataset.filter(function(r){return r.curLevel==="Critical";}).length+' critical</span>'+
      '<div style="flex:1;"></div>'+
      '<button class="btn tiny secondary" id="reg-export-csv">Export view as CSV</button>'+
    '</div>'+
    '<div class="table-wrap xwide"><table class="data-table" id="reg-table"><thead><tr>'+
      COLS.map(function(c){ return '<th data-key="'+c.key+'" class="'+(st.sortKey===c.key?"sorted":"")+'">'+c.label+(st.sortKey===c.key?(st.sortDir==="asc"?" ▲":" ▼"):"")+'</th>'; }).join("")+
    '</tr></thead><tbody>'+
    pageRows.map(function(r){
      var due = E.parseFlexDate(r.due);
      var overdue = due && due<E.todayDate() && E.isOpenStatus(r.status) && (r.actionStatus||"").toLowerCase()!=="done";
      return '<tr class="'+(r.curLevel==="Critical"?"row-critical":"")+'" onclick="window._openDrawer(\''+String(r.id).replace(/'/g,"\\'")+'\')">'+
        '<td>'+E.esc(r.id)+'</td>'+
        '<td class="td-title">'+E.esc(r.title)+'</td>'+
        '<td>'+E.esc(r.program)+'</td>'+
        '<td>'+E.esc(r.project)+'</td>'+
        '<td>'+E.esc(r.owner||"Unassigned")+'</td>'+
        '<td>'+UI.statusPill(r.status)+'</td>'+
        '<td>'+UI.levelPill(r.curLevel)+'</td>'+
        '<td class="num">'+E.fmtNum(r.curScore)+'</td>'+
        '<td class="num">'+(typeof r.resScore==="number"?E.fmtNum(r.resScore):"—")+'</td>'+
        '<td style="'+(overdue?"color:var(--critical);font-weight:800;":"")+'">'+E.esc(E.dispDate(r.due))+'</td>'+
        '<td>'+E.esc(r.actionStatus||"—")+'</td>'+
      '</tr>';
    }).join("")+
    (pageRows.length===0 ? '<tr><td colspan="'+COLS.length+'" class="muted" style="text-align:center;padding:24px;">No risks match the current filters.</td></tr>' : '')+
    '</tbody></table></div>'+
    '<div class="reg-pager">'+
      '<span>Page '+st.page+' of '+totalPages+' · '+sorted.length+' records</span>'+
      '<button id="reg-prev" '+(st.page<=1?"disabled":"")+'>← Prev</button>'+
      '<button id="reg-next" '+(st.page>=totalPages?"disabled":"")+'>Next →</button>'+
    '</div>';

  el.querySelectorAll("#reg-table thead th").forEach(function(th){
    th.addEventListener("click", function(){
      var key = th.getAttribute("data-key");
      if(st.sortKey===key){ st.sortDir = st.sortDir==="asc"?"desc":"asc"; } else { st.sortKey=key; st.sortDir = (key==="curScore"||key==="resScore")?"desc":"asc"; }
      window.renderRegister();
    });
  });
  var prevBtn = document.getElementById("reg-prev"), nextBtn = document.getElementById("reg-next");
  if(prevBtn) prevBtn.addEventListener("click", function(){ if(st.page>1){ st.page--; window.renderRegister(); } });
  if(nextBtn) nextBtn.addEventListener("click", function(){ if(st.page<totalPages){ st.page++; window.renderRegister(); } });
  var expBtn = document.getElementById("reg-export-csv");
  if(expBtn) expBtn.addEventListener("click", function(){ window._exportCSV(sorted, "risk_register_filtered_view.csv"); });
};
})();
