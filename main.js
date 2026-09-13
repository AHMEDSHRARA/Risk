/* =========================================================================
   Application shell: state, cascading filters, nav, theme, drawer/modal,
   toast. Tab render functions (renderExec, renderHeatmap, ...) are defined
   in their own modules and looked up by view name at switch time.
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI;

// Single-file build embeds the dataset as a JSON <script> tag (assemble.py);
// the multi-file GitHub Pages build instead loads data.js first, which sets
// window.RISK_DATA directly. Support both without maintaining two main.js files.
var RAW = window.RISK_DATA || JSON.parse(document.getElementById("risk-data").textContent);
var state = {
  data: RAW.slice(),
  filters: {program:"", project:"", dept:"", owner:"", status:"", level:"", search:"", dateFrom:"", dateTo:""},
  view: "exec",
  selectedProject: null,
  charts: {},
  register: { page:1, pageSize:25, sortKey:"curScore", sortDir:"desc" }
};
window._RiskState = state; // exposed for the render modules

function destroyChart(key){ if(state.charts[key]){ state.charts[key].destroy(); delete state.charts[key]; } }
function mkChart(key, ctx, config){ destroyChart(key); state.charts[key] = new Chart(ctx, config); return state.charts[key]; }
window._mkChart = mkChart;

function filteredData(scopeToProject){
  var f = state.filters;
  var from = f.dateFrom ? new Date(f.dateFrom) : null;
  var to = f.dateTo ? new Date(f.dateTo) : null;
  return state.data.filter(function(r){
    if(f.program && r.program!==f.program) return false;
    if(f.project && r.project!==f.project) return false;
    if(f.dept && r.dept!==f.dept) return false;
    if(f.owner && r.owner!==f.owner) return false;
    if(f.status && r.status!==f.status) return false;
    if(f.level && (r.curLevel||E.scoreToLevel(r.curScore))!==f.level) return false;
    if(scopeToProject && state.selectedProject && r.project!==state.selectedProject) return false;
    if(from || to){
      var d = E.parseFlexDate(r.identDate);
      if(!d) return false;
      if(from && d<from) return false;
      if(to && d>to) return false;
    }
    if(f.search){
      var q=f.search.toLowerCase();
      var hay=[r.id,r.title,r.owner,r.func,r.program,r.project,r.dept].join(" ").toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}
window._filteredData = filteredData;

function activeFilterCount(){
  var f = state.filters; var n=0;
  ["program","project","dept","owner","status","level","search","dateFrom","dateTo"].forEach(function(k){ if(f[k]) n++; });
  return n;
}

function populateFilters(){
  var programs = E.uniqSorted(state.data.map(function(r){return r.program;}));
  var depts = E.uniqSorted(state.data.map(function(r){return r.dept;}));
  var owners = E.uniqSorted(state.data.map(function(r){return r.owner;}));
  var statuses = E.uniqSorted(state.data.map(function(r){return r.status;}));
  function fill(id, values, allLabel){
    var el = document.getElementById(id);
    var keep = el.value;
    el.innerHTML = "";
    var optAll = document.createElement("option"); optAll.value=""; optAll.textContent = allLabel; el.appendChild(optAll);
    values.forEach(function(v){ var o=document.createElement("option"); o.value=v; o.textContent=v; el.appendChild(o); });
    if(values.indexOf(keep)>=0) el.value=keep; else el.value="";
  }
  fill("f-program", programs, "All Programs");
  var projectPool = state.filters.program ? state.data.filter(function(r){return r.program===state.filters.program;}) : state.data;
  fill("f-project", E.uniqSorted(projectPool.map(function(r){return r.project;})), "All Projects");
  fill("f-dept", depts, "All Departments");
  fill("f-owner", owners, "All Owners");
  fill("f-status", statuses, "All Status");
  fill("f-level", E.LEVELS, "All Levels");
}
window._populateFiltersFromMain = populateFilters;

/* ---------------- theme ---------------- */
function setTheme(mode){
  document.documentElement.setAttribute("data-theme", mode);
  document.body.setAttribute("data-theme", mode);
  document.getElementById("btn-dark").classList.toggle("active", mode==="dark");
  document.getElementById("btn-light").classList.toggle("active", mode==="light");
  try{ localStorage.setItem("rua-risk-theme", mode); }catch(e){}
  renderCurrentView(); // re-render so chart colors (read from CSS vars) pick up the new theme
}
function wireTheme(){
  document.getElementById("btn-dark").addEventListener("click", function(){ setTheme("dark"); });
  document.getElementById("btn-light").addEventListener("click", function(){ setTheme("light"); });
  var saved = null; try{ saved = localStorage.getItem("rua-risk-theme"); }catch(e){}
  setTheme(saved==="light" ? "light" : "dark");
}

/* ---------------- nav / views ---------------- */
var VIEW_META = {
  exec:{title:"Executive Risk Command Center", sub:"Portfolio-wide risk position — RUA AL-HARAM AL-MAKKI Development Program", fn:function(){ return window.renderExec && window.renderExec(); }},
  heatmap:{title:"Risk Profile & Heat Map", sub:"Probability × Impact placement, derived from the register's own probability bands and risk scores", fn:function(){ return window.renderHeatmap && window.renderHeatmap(); }},
  trend:{title:"Risk Trend & S-Curve", sub:"Cumulative identification vs. closure, aging, and exposure trend over time", fn:function(){ return window.renderTrend && window.renderTrend(); }},
  mitigation:{title:"Mitigation & Response", sub:"Treatment progress, overdue actions, and the risks requiring immediate management attention", fn:function(){ return window.renderMitigation && window.renderMitigation(); }},
  program:{title:"Program & Project Risk Intelligence", sub:"Portfolio → Program → Project drill-down with inherent vs. residual comparison", fn:function(){ return window.renderProgram && window.renderProgram(); }},
  performance:{title:"Risk Performance & Statistics", sub:"Rates, ratios, the Risk Performance Index, and register data-quality", fn:function(){ return window.renderPerformance && window.renderPerformance(); }},
  register:{title:"Risk Register / Executive Data Explorer", sub:"Full searchable, sortable, exportable register with drill-down to every field", fn:function(){ return window.renderRegister && window.renderRegister(); }}
};
function renderCurrentView(){ var m = VIEW_META[state.view]; if(m) m.fn(); }
window._renderCurrentView = renderCurrentView;

function switchView(view){
  state.view = view;
  var scrollEl = document.querySelector(".content-area"); if(scrollEl) scrollEl.scrollTop = 0;
  document.querySelectorAll(".nav-item").forEach(function(el){ el.classList.toggle("active", el.getAttribute("data-view")===view); });
  document.querySelectorAll(".view").forEach(function(el){ el.classList.toggle("active", el.id==="view-"+view); });
  var m = VIEW_META[view];
  if(m){ document.getElementById("view-title").textContent = m.title; document.getElementById("view-subtitle").textContent = m.sub; }
  renderCurrentView();
}
function wireNav(){
  document.querySelectorAll(".nav-item").forEach(function(el){
    el.addEventListener("click", function(){ switchView(el.getAttribute("data-view")); });
  });
}

/* ---------------- filters wiring ---------------- */
function onFilterChange(){
  state.filters.program = document.getElementById("f-program").value;
  state.filters.project = document.getElementById("f-project").value;
  state.filters.dept = document.getElementById("f-dept").value;
  state.filters.owner = document.getElementById("f-owner").value;
  state.filters.status = document.getElementById("f-status").value;
  state.filters.level = document.getElementById("f-level").value;
  state.filters.dateFrom = document.getElementById("f-date-from").value;
  state.filters.dateTo = document.getElementById("f-date-to").value;
  state.register.page = 1;
  renderCurrentView();
}
function wireFilters(){
  ["f-program","f-dept","f-owner","f-status","f-level","f-date-from","f-date-to"].forEach(function(id){
    document.getElementById(id).addEventListener("change", function(){
      if(id==="f-program"){ populateFilters(); }
      onFilterChange();
    });
  });
  document.getElementById("f-project").addEventListener("change", onFilterChange);
  var search = document.getElementById("f-search");
  var t=null;
  search.addEventListener("input", function(){ clearTimeout(t); t=setTimeout(function(){ state.filters.search=search.value; state.register.page=1; renderCurrentView(); }, 220); });
  document.getElementById("f-reset").addEventListener("click", function(){
    state.filters = {program:"", project:"", dept:"", owner:"", status:"", level:"", search:"", dateFrom:"", dateTo:""};
    ["f-program","f-project","f-dept","f-owner","f-status","f-level"].forEach(function(id){
      document.getElementById(id).value = "";
    });
    document.getElementById("f-search").value = "";
    document.getElementById("f-date-from").value = "";
    document.getElementById("f-date-to").value = "";
    populateFilters();
    state.register.page = 1;
    renderCurrentView();
  });
}

/* Programmatic cross-filter: charts/KPIs call this to drill into another
   dimension (click a program bar -> filters to that program, etc.) */
function setFilter(key, value){
  state.filters[key] = value;
  if(key==="program"){ state.filters.project = ""; }
  populateFilters();
  document.getElementById("f-"+key) && (document.getElementById("f-"+key).value = value||"");
  state.register.page = 1;
  renderCurrentView();
}
window._setFilter = setFilter;

/* ---------------- drawer / modal / toast ---------------- */
function showToast(msg){
  var t=document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._timer); t._timer = setTimeout(function(){ t.classList.remove("show"); }, 3400);
}
window._showToast = showToast;

function openDrawer(id){
  var r = state.data.find(function(x){ return x.id===id; });
  if(!r) return;
  var d = document.getElementById("risk-drawer");
  var actions = (r.mitigationsAll && r.mitigationsAll.length ? r.mitigationsAll : (r.action?[{action:r.action,owner:r.actionOwner,status:r.actionStatus,pct:r.pct,due:r.due}]:[]));
  d.innerHTML =
    '<div class="close-x" id="drawer-close" style="float:right;cursor:pointer;font-size:20px;color:var(--text-muted);">&times;</div>'+
    '<div class="tag">'+E.esc(r.id)+'</div>'+
    '<h3>'+E.esc(r.title)+'</h3>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">'+UI.levelPill(r.curLevel)+UI.statusPill(r.status)+'<span class="tag">'+E.esc(r.type||"Threat")+'</span></div>'+
    '<div class="kv">'+
      '<b>Program</b><span>'+E.esc(r.program)+'</span>'+
      '<b>Project</b><span>'+E.esc(r.project)+'</span>'+
      '<b>Department</b><span>'+E.esc(r.dept)+'</span>'+
      '<b>Owning Function</b><span>'+E.esc(r.func)+'</span>'+
      '<b>Risk Owner</b><span>'+E.esc(r.owner)+'</span>'+
      '<b>Identified</b><span>'+E.esc(E.dispDate(r.identDate))+'</span>'+
      '<b>Probability</b><span>'+E.esc(r.prob)+'</span>'+
      '<b>Inherent Score</b><span>'+E.fmtNum(r.curScore)+' / 25</span>'+
      '<b>Residual Score</b><span>'+(typeof r.resScore==="number"?E.fmtNum(r.resScore)+' / 25 ('+E.esc(r.resLevel)+')':'Not yet assessed')+'</span>'+
      (typeof r.costLikely==="number" ? '<b>Cost Impact (Likely)</b><span>'+E.fmtMoney(r.costLikely)+'</span>' : '')+
      (typeof r.timeLikely==="number" ? '<b>Schedule Impact (Likely)</b><span>'+E.fmtDays(r.timeLikely)+'</span>' : '')+
    '</div>'+
    '<div class="hairline"></div>'+
    '<div style="font-size:12px;font-weight:800;margin-bottom:4px;">Risk Statement</div>'+
    '<p style="font-size:12.5px;color:var(--text-secondary);line-height:1.55;">'+E.esc(r.statement||"—")+'</p>'+
    (r.cause ? '<div style="font-size:12px;font-weight:800;margin:10px 0 4px;">Cause</div><p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;">'+E.esc(r.cause)+'</p>' : '')+
    (r.consequence ? '<div style="font-size:12px;font-weight:800;margin:10px 0 4px;">Consequence</div><p style="font-size:12.5px;color:var(--text-secondary);line-height:1.5;">'+E.esc(r.consequence)+'</p>' : '')+
    '<div class="hairline"></div>'+
    '<div style="font-size:12px;font-weight:800;margin-bottom:4px;">Treatment Plan</div>'+
    '<p style="font-size:12.5px;color:var(--text-secondary);">'+E.esc(r.treatment||"—")+'</p>'+
    (actions.length ? actions.map(function(a,i){
      return '<div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:9px;padding:8px 10px;margin-bottom:6px;font-size:11.8px;">'+
        '<b>Action '+(i+1)+':</b> '+E.esc(a.action||"—")+'<br>'+
        '<span class="muted">Owner: '+E.esc(a.owner||"—")+' · Status: '+E.esc(a.status||"—")+' · '+Math.round((a.pct||0)*100)+'% complete · Due: '+E.esc(E.dispDate(a.due))+'</span>'+
      '</div>';
    }).join("") : '<div class="mi-note">No mitigation action recorded for this risk.</div>')+
    '<div class="footer-note" style="text-align:left;margin-top:14px;">Source file: '+E.esc(r.src||"—")+'</div>';
  d.classList.add("open");
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
}
function closeDrawer(){ document.getElementById("risk-drawer").classList.remove("open"); }
window._openDrawer = openDrawer;

function openModal(html, opts){
  opts = opts||{};
  var body = document.getElementById("modal-body");
  body.innerHTML = html;
  body.classList.toggle("wide", !!opts.wide);
  document.getElementById("modal-overlay").classList.add("open");
}
function closeModal(){ document.getElementById("modal-overlay").classList.remove("open"); }
window._openModal = openModal; window._closeModal = closeModal;

/* ---------------- generic drill-down records modal ----------------
   The single reusable "click a chart element -> see the underlying risk
   records" popup used across every tab. Every meaningful chart/KPI click
   in the app should route through this so the drill-down experience (and
   its column set, its Export/Close actions) is consistent everywhere. */
function recordsTableHtml(rows, limit){
  limit = limit || 150;
  var shown = rows.slice(0, limit);
  return '<div class="table-wrap" style="max-height:360px;"><table class="data-table"><thead><tr>'+
    '<th>Risk ID</th><th>Risk Title</th><th>Project</th><th>Owner</th><th>Level</th><th>Score</th><th>Status</th>'+
    '</tr></thead><tbody>'+
    shown.map(function(r){
      return '<tr onclick="window._closeModal();window._openDrawer(\''+String(r.id).replace(/'/g,"\\'")+'\')">'+
        '<td>'+E.esc(r.id)+'</td>'+
        '<td class="td-title">'+E.esc(r.title)+'</td>'+
        '<td>'+E.esc(r.project)+'</td>'+
        '<td>'+E.esc(r.owner||"Unassigned")+'</td>'+
        '<td>'+UI.levelPill(r.curLevel)+'</td>'+
        '<td class="num">'+E.fmtNum(r.curScore)+'</td>'+
        '<td>'+UI.statusPill(r.status)+'</td>'+
      '</tr>';
    }).join("")+
    (rows.length===0 ? '<tr><td colspan="7" class="muted" style="text-align:center;padding:18px;">No risks match this selection under the current filter.</td></tr>' : '')+
    (rows.length>limit ? '<tr><td colspan="7" class="muted" style="text-align:center;padding:10px;">+ '+(rows.length-limit)+' more record(s) — use Export to get the full list.</td></tr>' : '')+
    '</tbody></table></div>';
}
var _lastModalRows = [];
window._exportLastModalRows = function(name){ if(window._exportCSV) window._exportCSV(_lastModalRows, name||"selection.csv"); };
function openRecordsModal(title, rows, opts){
  opts = opts||{};
  _lastModalRows = rows || [];
  var html =
    '<div class="close-x" onclick="window._closeModal()">&times;</div>'+
    '<div class="modal-eyebrow">Risk Details</div>'+
    '<h3 style="margin-top:2px;">'+E.esc(title)+'</h3>'+
    '<div class="tag" style="margin-bottom:10px;">Total Records: '+ (rows?rows.length:0) +'</div>'+
    (opts.note ? '<div class="mi-note" style="margin-bottom:8px;">'+opts.note+'</div>' : '')+
    recordsTableHtml(rows||[])+
    (rows && rows.length ? '<div class="mi-note" style="margin-top:8px;">Click any row to open its full risk detail.</div>' : '')+
    '<div class="modal-actions">'+
      (rows && rows.length ? '<button class="btn tiny secondary" onclick="window._exportLastModalRows(\''+(opts.exportName||"selection")+'.csv\')">Export CSV</button>' : '')+
      '<button class="btn tiny" onclick="window._closeModal()">Close</button>'+
    '</div>';
  openModal(html, {wide:true});
}
window._openRecordsModal = openRecordsModal;
function wireOverlayClose(){
  document.getElementById("modal-overlay").addEventListener("click", function(e){ if(e.target.id==="modal-overlay") closeModal(); });
  document.addEventListener("keydown", function(e){ if(e.key==="Escape"){ closeModal(); closeDrawer(); } });
}

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", function(){
  populateFilters();
  wireNav();
  wireFilters();
  wireOverlayClose();
  if(window._wireIO) window._wireIO();
  wireTheme(); // renders the initial view once theme + data are ready
});

})();
