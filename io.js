/* =========================================================================
   IMPORT / EXPORT — CSV / JSON / XLSX round-trip + Executive PDF (CDO)
========================================================================= */
(function(){
"use strict";
var E = window.RiskEngine, UI = window.RiskUI;

var EXPORT_COLUMNS = [
  ["no","No."],["dept","Department"],["program","Program"],["project","Project"],["id","Risk ID"],
  ["title","Risk Title"],["owner","Risk Owner"],["func","Owning Function"],["status","Risk Status"],
  ["identDate","Risk Identified Date"],["closedDate","Risk Closed Date"],["type","Current Risk Type"],
  ["prob","Current Risk Probability"],["curScore","Current Risk Score"],["curLevel","Current Risk Level"],
  ["cost","Cost Impact Score"],["time","Time Impact Score"],["hsse","HSSE Impact Score"],["quality","Quality Impact Score"],
  ["costLikely","Cost Impact (Likely, SAR)"],["timeLikely","Time Impact (Likely, Days)"],
  ["treatment","Treatment Plan Title"],["action","Mitigation Action"],["actionOwner","Action Owner"],
  ["actionStatus","Action Status"],["pct","% Completion"],["due","Due Date"],
  ["actionsTotal","Total Mitigation Actions"],["actionsDone","Completed Mitigation Actions"],
  ["resScore","Residual Risk Score"],["resLevel","Residual Risk Level"],
  ["statement","Risk Statement"],["cause","Risk Cause(s)"],["consequence","Risk Consequence(s)"],["src","Source File"]
];

function canonicalRow(r,i){
  var out={};
  EXPORT_COLUMNS.forEach(function(pair){
    var key=pair[0], label=pair[1];
    out[label] = key==="no" ? (i+1) : (r[key]!==undefined&&r[key]!==null? r[key] : "");
  });
  return out;
}
function csvEscape(v){ if(v===null||v===undefined) v=""; v=String(v); if(/[",\n]/.test(v)) v='"'+v.replace(/"/g,'""')+'"'; return v; }
function downloadBlob(content, filename, mime){
  var blob = new Blob([content], {type:mime});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 400);
}

function exportCSV(rows, filename){
  rows = rows || window._RiskState.data;
  var data = rows.map(canonicalRow);
  var headers = EXPORT_COLUMNS.map(function(p){return p[1];});
  var lines = [headers.map(csvEscape).join(",")];
  data.forEach(function(row){ lines.push(headers.map(function(h){return csvEscape(row[h]);}).join(",")); });
  downloadBlob(lines.join("\r\n"), filename||"risk_register_export.csv", "text/csv;charset=utf-8;");
  window._showToast("Exported "+rows.length+" risks to CSV");
}
function exportJSON(rows, filename){
  rows = rows || window._RiskState.data;
  downloadBlob(JSON.stringify(rows, null, 1), filename||"risk_register_export.json", "application/json");
  window._showToast("Exported "+rows.length+" risks to JSON");
}
function exportXLSX(rows, filename){
  rows = rows || window._RiskState.data;
  var data = rows.map(canonicalRow);
  var headers = EXPORT_COLUMNS.map(function(p){return p[1];});
  var ws = XLSX.utils.json_to_sheet(data, {header:headers});
  ws['!cols'] = headers.map(function(h){ return {wch: Math.min(38, Math.max(10, h.length+4))}; });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Risk Register (Master)");
  XLSX.writeFile(wb, filename||"RUA_Portfolio_Risk_Register_Master.xlsx");
  window._showToast("Exported "+rows.length+" risks to Excel");
}

var SHORT_KEYS = ["no","dept","program","project","id","title","owner","func","status","identDate","closedDate",
  "type","prob","curScore","curLevel","cost","time","hsse","quality","costLikely","timeLikely","treatment",
  "action","actionOwner","actionStatus","pct","due","actionsTotal","actionsDone","resScore","resLevel",
  "statement","cause","consequence","src","mitigationsAll"];

function normalizeImportedRow(raw){
  var out = {};
  Object.keys(raw).forEach(function(k){
    var norm = k.trim().toLowerCase();
    var key = E.CANON_HEADERS[norm];
    if(!key){ if(SHORT_KEYS.indexOf(k)>=0) key=k; else return; }
    out[key] = raw[k];
  });
  ["curScore","resScore","cost","time","hsse","quality","no","costLikely","timeLikely","actionsTotal","actionsDone"].forEach(function(k){
    if(out[k]!==undefined && out[k]!=="" && !isNaN(out[k])) out[k]=+out[k];
    else if(out[k]==="") out[k]=null;
  });
  if(out.pct!==undefined && out.pct!==""){ var p=+out.pct; if(!isNaN(p)){ out.pct = p>1? p/100 : p; } }
  if(!out.curLevel && out.curScore!=null) out.curLevel = E.scoreToLevel(out.curScore);
  if(!out.resLevel && out.resScore!=null) out.resLevel = E.scoreToLevel(out.resScore);
  if(!out.owner) out.owner="Unassigned";
  if(!out.func) out.func="Unassigned";
  if(!out.status) out.status="Open";
  if(typeof out.actionsTotal!=="number") out.actionsTotal = out.action ? 1 : 0;
  if(typeof out.actionsDone!=="number") out.actionsDone = (out.actionStatus||"").toLowerCase()==="done" ? out.actionsTotal : 0;
  return out;
}

function handleImportFile(file){
  var name = file.name.toLowerCase();
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var rows;
      if(name.endsWith(".json")){
        var parsed = JSON.parse(e.target.result);
        rows = Array.isArray(parsed) ? parsed : (parsed.data||parsed.risks||[]);
      } else if(name.endsWith(".csv")){
        var wb = XLSX.read(e.target.result, {type:"string"});
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:""});
      } else {
        var wb2 = XLSX.read(e.target.result, {type:"array"});
        var sheetName = wb2.SheetNames.find(function(n){return /risk register/i.test(n) && !/read\s*me/i.test(n);}) || wb2.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(wb2.Sheets[sheetName], {defval:""});
      }
      var normalized = rows.map(normalizeImportedRow).filter(function(r){return r.id;});
      if(!normalized.length){ window._showToast("No valid risk rows found in "+file.name); return; }
      var state = window._RiskState;
      state.data = normalized;
      state.selectedProject = null;
      state.filters = {program:"", project:"", dept:"", owner:"", status:"", level:"", search:"", dateFrom:"", dateTo:""};
      document.getElementById("f-search").value=""; document.getElementById("f-date-from").value=""; document.getElementById("f-date-to").value="";
      window._populateFiltersFromMain && window._populateFiltersFromMain();
      document.getElementById("data-source-note").textContent = "Source: imported from "+file.name+" · "+normalized.length+" risks";
      window._renderCurrentView();
      window._showToast("Imported "+normalized.length+" risks from "+file.name);
    }catch(err){
      console.error(err);
      window._showToast("Import failed: "+err.message);
    }
  };
  if(name.endsWith(".json") || name.endsWith(".csv")) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

/* ---------------- PDF Executive Report (CDO) ---------------- */
function chartToImage(type, data, options, w, h){
  return new Promise(function(resolve){
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed; left:-99999px; top:0; width:"+w+"px; height:"+h+"px;";
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    var whiteBg = { id:"whiteBg", beforeDraw: function(c){ var ctx=c.ctx; ctx.save(); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height); ctx.restore(); } };
    var chart = new Chart(canvas.getContext("2d"), {
      type:type, data:data,
      options: Object.assign({responsive:false, animation:false, devicePixelRatio:1.5}, options),
      plugins:[whiteBg]
    });
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var img = canvas.toDataURL("image/jpeg",0.9);
        chart.destroy(); wrap.remove();
        resolve(img);
      });
    });
  });
}
function hexToRgb(hex){ var v=parseInt(hex.replace("#",""),16); return [(v>>16)&255,(v>>8)&255,v&255]; }

async function buildPdfReport(){
  window._showToast("Generating executive PDF report…");
  var d = window._RiskState.data.slice(); // full portfolio, independent of UI filters
  var agg = E.computeAgg(d);
  var dq = E.computeDataQuality(d);
  var rpi = E.computeRPI(agg);
  var reduction = agg.avgPairedReductionPct!==null ? Math.round(agg.avgPairedReductionPct) : null;
  var dupes = E.findCrossProjectDuplicates(d);
  var overdueRows = d.filter(function(r){var due=E.parseFlexDate(r.due); return due && due<E.todayDate() && E.isOpenStatus(r.status) && (r.actionStatus||"").toLowerCase()!=="done";});
  var noOwnerRows = d.filter(function(r){return !r.owner || /^unassign/i.test(r.owner);});
  var noResidualRows = d.filter(function(r){return r.resScore===null||r.resScore===undefined;});
  var progLabels = Object.keys(agg.byProgram);

  var LIGHT_TXT = "#141414", LIGHT_GRID="#e2e2e2";

  var levelImg = await chartToImage("bar", {
    labels: E.LEVELS.filter(function(l){return agg.byLevel[l]>0;}),
    datasets:[{data:E.LEVELS.filter(function(l){return agg.byLevel[l]>0;}).map(function(l){return agg.byLevel[l];}),
      backgroundColor:E.LEVELS.filter(function(l){return agg.byLevel[l]>0;}).map(function(l){return {Critical:"#d03b3b",High:"#ec835a",Medium:"#c98500",Low:"#0ca30c",Nil:"#9aa3a8"}[l];}), borderRadius:6}]
  }, {indexAxis:"y", plugins:{legend:{display:false}}, scales:{x:{ticks:{color:LIGHT_TXT,font:{size:13}},grid:{color:LIGHT_GRID}},y:{ticks:{color:LIGHT_TXT,font:{size:14,weight:"700"}},grid:{display:false}}}}, 900,460);

  var curresImg = await chartToImage("bar", {
    labels: progLabels,
    datasets:[
      {label:"Inherent", data:progLabels.map(function(p){var rows=d.filter(function(r){return r.program===p && typeof r.curScore==="number";}); return rows.length? +(rows.reduce(function(s,r){return s+r.curScore;},0)/rows.length).toFixed(1):0;}), backgroundColor:"#eb6834", borderRadius:6},
      {label:"Residual", data:progLabels.map(function(p){var rows=d.filter(function(r){return r.program===p && typeof r.resScore==="number";}); return rows.length? +(rows.reduce(function(s,r){return s+r.resScore;},0)/rows.length).toFixed(1):0;}), backgroundColor:"#0ca30c", borderRadius:6}
    ]}, {plugins:{legend:{labels:{color:LIGHT_TXT,font:{size:13,weight:"600"}}}}, scales:{x:{ticks:{color:LIGHT_TXT,font:{size:13,weight:"700"}},grid:{display:false}},y:{beginAtZero:true,max:25,ticks:{color:LIGHT_TXT,font:{size:12}},grid:{color:LIGHT_GRID}}}}, 900,460);

  var catLabels=["Cost","Time","HSSE","Quality"]; var catKeys=["cost","time","hsse","quality"];
  var catImg = await chartToImage("bar", {
    labels:catLabels,
    datasets:[{data:catKeys.map(function(k){var vals=d.map(function(r){return r[k];}).filter(function(v){return typeof v==="number";}); return vals.length?+(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1):0;}),
      backgroundColor:["#2a78d6","#eb6834","#e34948","#eda100"], borderRadius:6}]
  }, {plugins:{legend:{display:false}}, scales:{x:{ticks:{color:LIGHT_TXT,font:{size:13,weight:"700"}},grid:{display:false}},y:{beginAtZero:true,max:25,ticks:{color:LIGHT_TXT,font:{size:12}},grid:{color:LIGHT_GRID}}}}, 900,420);

  var statusGroups = {};
  Object.keys(agg.byStatus).forEach(function(s){var v=agg.byStatus[s],sl=s.toLowerCase();
    var g = sl.indexOf("closed")>=0?"Closed":sl.indexOf("emerg")>=0?"Emerging":"Open";
    statusGroups[g]=(statusGroups[g]||0)+v; });
  var statusLabels = Object.keys(statusGroups);
  var statusImg = await chartToImage("doughnut", {
    labels:statusLabels, datasets:[{data:statusLabels.map(function(l){return statusGroups[l];}), backgroundColor:statusLabels.map(function(l){return {"Open":"#2a78d6","Emerging":"#c98500","Closed":"#0ca30c"}[l]||"#9aa3a8";}), borderWidth:3, borderColor:"#ffffff"}]
  }, {cutout:"58%", plugins:{legend:{position:"bottom",labels:{color:LIGHT_TXT,font:{size:13,weight:"600"}}}}}, 720,460);

  var jsPDFCtor = window.jspdf.jsPDF;
  var doc = new jsPDFCtor({orientation:"landscape", unit:"pt", format:"a4"});
  var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  var M = 42, pageNum=0;
  var NAVY=[11,46,58];

  function chrome(title, subtitle){
    if(pageNum>0) doc.addPage();
    pageNum++;
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]); doc.rect(0,0,W,50,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(13);
    doc.text("RUA AL HARAM — ENTERPRISE RISK INTELLIGENCE", M, 22);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(190,213,219);
    doc.text("Executive Summary Report - Prepared for CDO / Executive Review", M, 37);
    doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text(("0"+pageNum).slice(-2)+" / 12", W-M, 22, {align:"right"});
    doc.setTextColor(20,20,20); doc.setFont("helvetica","bold"); doc.setFontSize(18);
    doc.text(title, M, 76);
    if(subtitle){ doc.setFont("helvetica","normal"); doc.setFontSize(10.5); doc.setTextColor(100,100,100); doc.text(subtitle, M, 93); }
    doc.setTextColor(20,20,20);
    return 112;
  }
  function footer(){
    doc.setFontSize(8); doc.setTextColor(150,150,150);
    doc.text("RUA AL HARAM Portfolio Risk Register - Confidential - Executive Distribution - Generated "+new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), M, H-18);
  }
  function kpiBox(x,y,w,h,label,value,sub,color){
    doc.setFillColor(248,249,250); doc.roundedRect(x,y,w,h,6,6,"F");
    doc.setFillColor.apply(doc, hexToRgb(color)); doc.rect(x,y,4,h,"F");
    doc.setTextColor(120,120,120); doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
    doc.text(label.toUpperCase(), x+14, y+18);
    doc.setTextColor(20,20,20); doc.setFont("helvetica","bold"); doc.setFontSize(22);
    doc.text(String(value), x+14, y+42);
    doc.setTextColor(130,130,130); doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
    doc.text(sub, x+14, y+58, {maxWidth:w-24});
  }
  function para(text, x, y, w, size){
    doc.setFont("helvetica","normal"); doc.setFontSize(size||10.5); doc.setTextColor(60,60,60);
    var lines = doc.splitTextToSize(text, w);
    doc.text(lines, x, y);
    return y + lines.length*(size?size*1.35:14.5);
  }

  // PAGE 1 — Cover
  doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]); doc.rect(0,0,W,H,"F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text("RUA AL HARAM AL MAKKI DEVELOPMENT PROGRAM", M, 90);
  doc.setFontSize(30);
  doc.text("Enterprise Risk Intelligence", M, 140);
  doc.text("Executive Summary Report", M, 178);
  doc.setFont("helvetica","normal"); doc.setFontSize(12.5); doc.setTextColor(190,213,219);
  doc.text("Consolidated risk position across the KSG and AJYAD delivery programs", M, 210);
  doc.text("Prepared for: Chief Development Officer & Executive Steering Committee", M, 232);
  doc.setDrawColor(255,255,255); doc.setLineWidth(0.6); doc.line(M, 260, W-M, 260);
  var coverStats = [["Total Tracked Risks",agg.total],["Open / Emerging",agg.open],["Risk Performance Index",rpi.value!==null?Math.round(rpi.value):"N/A"],["Data Quality Score",Math.round(dq.score)]];
  var cw=(W-2*M)/4;
  coverStats.forEach(function(s,i){
    doc.setFont("helvetica","bold"); doc.setFontSize(28); doc.setTextColor(255,255,255);
    doc.text(String(s[1]), M+i*cw, 305);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(170,195,202);
    doc.text(s[0], M+i*cw, 322);
  });
  doc.setFontSize(9.5); doc.setTextColor(170,195,202);
  doc.text("Report date: "+new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})+"   -   Source: 6 project risk registers consolidated into one portfolio master   -   Confidential", M, H-40);

  // PAGE 2 — Executive Summary
  pageNum = 1;
  var y = chrome("Executive Summary","Portfolio-wide risk posture at a glance");
  var kw=(W-2*M-3*12)/4, kh=68;
  kpiBox(M,y,kw,kh,"Total Risks",agg.total,agg.open+" open - "+agg.closed+" closed","#2a78d6");
  kpiBox(M+kw+12,y,kw,kh,"Critical (Inherent)",agg.byLevel.Critical, Math.round(agg.byLevel.Critical/agg.total*100)+"% of portfolio","#d03b3b");
  kpiBox(M+2*(kw+12),y,kw,kh,"Avg Inherent Score",E.fmtNum(agg.avgCur,1)+"/25","before treatment","#eb6834");
  kpiBox(M+3*(kw+12),y,kw,kh,"Avg Residual Score",agg.avgRes!==null?E.fmtNum(agg.avgRes,1)+"/25":"—", reduction!==null?("reduced "+reduction+"% after treatment"):"pending assessment","#0ca30c");
  y += kh+26;
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(20,20,20); doc.text("Summary", M, y); y+=16;
  var summaryTxt = "This report consolidates "+agg.total+" risks tracked across the RUA AL HARAM portfolio's active development programs — King Salman Gate (KSG) and AJYAD — spanning multiple project-level registers. "+
    "At inherent (pre-mitigation) rating, "+Math.round(agg.byLevel.Critical/agg.total*100)+"% of tracked risks are rated Critical and a further "+Math.round(agg.byLevel.High/agg.total*100)+"% High. "+
    (reduction!==null? ("Where a residual assessment has been completed, the average risk score falls from "+E.fmtNum(agg.avgCur,1)+" to "+E.fmtNum(agg.avgRes,1)+" out of 25 — a "+reduction+"% reduction. "):"")+
    "The Risk Performance Index for the current register stands at "+(rpi.value!==null?Math.round(rpi.value):"N/A")+"/100 and the register's Data Quality Score is "+Math.round(dq.score)+"/100. "+
    noResidualRows.length+" risks ("+Math.round(noResidualRows.length/agg.total*100)+"%) still lack a completed residual assessment and "+overdueRows.length+" mitigation actions are overdue.";
  y = para(summaryTxt, M, y, W-2*M, 11);
  y += 14;
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text("Key Findings", M, y); y+=6;
  var findings = [
    Math.round(agg.byLevel.Critical/agg.total*100)+"% of the portfolio ("+agg.byLevel.Critical+" risks) is rated Critical at inherent level.",
    noResidualRows.length+" risks ("+Math.round(noResidualRows.length/agg.total*100)+"%) have not yet received a completed residual assessment.",
    overdueRows.length+" mitigation actions are overdue against their planned due date.",
    noOwnerRows.length+" risks currently have no assigned owner.",
    dupes.length? (dupes.reduce(function(s,x){return s+x.rows.length;},0)+" risk record(s) appear duplicated verbatim across different project registers and require data-quality review.") : "No cross-project duplicate risk records were detected."
  ];
  findings.forEach(function(f){ y+=16; doc.setFont("helvetica","normal"); doc.setFontSize(10.5); doc.setTextColor(60,60,60); doc.text("-  "+f, M+4, y, {maxWidth:W-2*M-10}); });
  footer();

  // PAGE 3 — Risk Profile
  y = chrome("Portfolio Risk Profile","Current (inherent) risk level distribution");
  doc.addImage(levelImg, "JPEG", M, y, (W-2*M)*0.56, 300);
  var tx = M+(W-2*M)*0.56+24, tw=(W-2*M)*0.44-24;
  doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.text("Reading this chart", tx, y+16);
  var readTxt = "Current risk level is derived from the 1-25 probability x impact score recorded for each risk (Low 1-3, Medium 4-9, High 10-15, Critical 16-25). This reflects inherent exposure before mitigation credit is applied.";
  para(readTxt, tx, y+34, tw, 10);
  footer();

  // PAGE 4 — Current vs Residual
  y = chrome("Mitigation Effectiveness","Average inherent vs residual risk score, by program");
  doc.addImage(curresImg, "JPEG", M, y, W-2*M, 300);
  footer();

  // PAGE 5 — Risk by category
  y = chrome("Risk Exposure by Category","Average impact score - Cost / Time / HSSE / Quality (0-25 scale)");
  doc.addImage(catImg, "JPEG", M, y, (W-2*M)*0.62, 300);
  var tx2=M+(W-2*M)*0.62+24, tw2=(W-2*M)*0.38-24;
  doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.text("Status Mix", tx2, y+16);
  doc.addImage(statusImg,"JPEG", tx2, y+26, tw2, tw2*0.64);
  footer();

  // PAGE 6 — Top risks table
  y = chrome("Top 15 Highest-Exposure Open Risks","Ranked by current risk score");
  var top15 = d.filter(function(r){return E.isOpenStatus(r.status);}).slice().sort(function(a,b){return (b.curScore||0)-(a.curScore||0);}).slice(0,15);
  doc.autoTable({
    startY:y, margin:{left:M,right:M},
    head:[["Risk ID","Program","Project","Title","Owner","Score","Level","Residual"]],
    body: top15.map(function(r){return [r.id, r.program, r.project, (r.title||"").slice(0,60), r.owner, r.curScore, r.curLevel, r.resScore!=null?r.resScore:"pending"];}),
    styles:{fontSize:8.3, cellPadding:4, textColor:[40,40,40]},
    headStyles:{fillColor:NAVY, textColor:255, fontSize:8.3},
    alternateRowStyles:{fillColor:[247,248,249]},
    columnStyles:{3:{cellWidth:180}},
  });
  footer();

  // PAGE 7+ — Project deep-dives per program
  function programPage(progName, title){
    var y2 = chrome(title, "Project-level breakdown");
    var rows = d.filter(function(r){return r.program===progName;});
    var projects = E.uniqSorted(rows.map(function(r){return r.project;}));
    var body = projects.map(function(p){
      var pr = rows.filter(function(r){return r.project===p;});
      var a = E.computeAgg(pr);
      var red = a.avgPairedReductionPct!==null? Math.round(a.avgPairedReductionPct)+"%" : "—";
      return [p, pr.length, a.open, a.byLevel.Critical, E.fmtNum(a.avgCur,1), a.avgRes!==null?E.fmtNum(a.avgRes,1):"—", red];
    });
    doc.autoTable({
      startY:y2, margin:{left:M,right:M},
      head:[["Project","Risks","Open","Critical","Avg Inherent","Avg Residual","Reduction"]],
      body: body,
      styles:{fontSize:9.5, cellPadding:5, textColor:[40,40,40]},
      headStyles:{fillColor:NAVY, textColor:255},
      alternateRowStyles:{fillColor:[247,248,249]},
    });
    footer();
  }
  progLabels.forEach(function(p){ programPage(p, p+" Program - Project Summary"); });

  // PAGE — Mitigation status / overdue
  y = chrome("Mitigation Status & Overdue Actions", overdueRows.length+" action(s) currently overdue");
  if(overdueRows.length){
    doc.autoTable({
      startY:y, margin:{left:M,right:M},
      head:[["Risk ID","Project","Title","Owner","Due Date","Action Status"]],
      body: overdueRows.slice(0,20).map(function(r){return [r.id,r.project,(r.title||"").slice(0,55),r.owner,E.dispDate(r.due),r.actionStatus||"—"];}),
      styles:{fontSize:8.6, cellPadding:4},
      headStyles:{fillColor:NAVY, textColor:255},
      alternateRowStyles:{fillColor:[247,248,249]},
    });
  } else {
    para("No mitigation actions are currently overdue across the portfolio.", M, y, W-2*M, 11);
  }
  footer();

  // PAGE — Data quality
  y = chrome("Data Quality Findings","Register Data Quality Score: "+Math.round(dq.score)+"/100");
  var dqFindings = [
    noResidualRows.length+" of "+agg.total+" risks ("+Math.round(noResidualRows.length/agg.total*100)+"%) have no completed residual assessment.",
    noOwnerRows.length+" risks have no assigned owner recorded in source registers.",
    dupes.length? (dupes.reduce(function(s,x){return s+x.rows.length;},0)+" risk record(s) appear identical across different project registers"+(dupes.length>14?" (top 14 groups shown below)":"")+":") : "No cross-project duplicate risk records were detected in this consolidation."
  ];
  dqFindings.forEach(function(f){ y+=4; y=para("-  "+f, M, y+14, W-2*M, 11); });
  if(dupes.length){
    y+=6;
    doc.autoTable({ startY:y, margin:{left:M,right:M},
      head:[["Risk Title","Risk IDs","Appears In"]],
      body: dupes.slice(0,14).map(function(x){return [x.rows[0].title, x.rows.map(function(r){return r.id;}).join(", "), x.projects.join(" - ")];}),
      styles:{fontSize:9, cellPadding:4}, headStyles:{fillColor:NAVY,textColor:255}, alternateRowStyles:{fillColor:[247,248,249]},
    });
  }
  footer();

  // PAGE — Recommendations & methodology
  y = chrome("Recommendations & Methodology","Director-level guidance for the next reporting cycle");
  var recs = [
    "Close the residual-assessment gap first — "+noResidualRows.length+" risks cannot currently demonstrate mitigation effectiveness without a completed post-treatment score.",
    overdueRows.length? ("Escalate "+overdueRows.length+" overdue mitigation actions to program management this reporting cycle.") : "Maintain the current on-time mitigation-action completion rate.",
    noOwnerRows.length? ("Assign an accountable owner to all "+noOwnerRows.length+" currently unassigned risks before the next steering committee.") : "Ownership coverage is complete across the portfolio.",
    dupes.length? "Correct the duplicated risk records identified above at source, so portfolio counts are not inflated by copied template content." : "Continue the current register-hygiene practice; no duplication was found.",
    "Adopt a bi-weekly re-scoring cadence for Critical/High risks so the current-to-residual reduction trend can be tracked release over release.",
    "Standardise on the exported master workbook as the single source of truth: update it, re-import into the dashboard, and regenerate this report ahead of every CDO / steering committee review."
  ];
  recs.forEach(function(r,i){ y = para((i+1)+".  "+r, M, y+16, W-2*M, 11); });
  y+=18;
  doc.setFont("helvetica","bold"); doc.setFontSize(11.5); doc.text("Risk Level Bands (0-25 scale)", M, y); y+=6;
  doc.autoTable({ startY:y+6, margin:{left:M,right:M},
    head:[["Level","Score Range","Definition"]],
    body:[["Low","1-3","Minor impact; routine monitoring."],["Medium","4-9","Moderate impact; active tracking with a treatment plan."],
      ["High","10-15","Significant impact; treatment plan mandatory, owner-reviewed regularly."],
      ["Critical","16-25","Severe impact to cost, schedule, safety or quality; requires program-level escalation and weekly review."]],
    styles:{fontSize:9.5, cellPadding:5}, headStyles:{fillColor:NAVY,textColor:255}, alternateRowStyles:{fillColor:[247,248,249]},
  });
  footer();

  doc.save("RUA_Portfolio_Risk_Executive_Report_CDO.pdf");
  window._showToast("Executive PDF report downloaded ("+pageNum+" pages)");
}

function wireIO(){
  var fileInput = document.getElementById("file-input");
  document.getElementById("btn-import").addEventListener("click", function(){ fileInput.click(); });
  fileInput.addEventListener("change", function(){ if(fileInput.files[0]){ handleImportFile(fileInput.files[0]); fileInput.value=""; } });

  var exportBtn = document.getElementById("btn-export");
  var dropdown = document.getElementById("export-dropdown");
  exportBtn.addEventListener("click", function(e){ e.stopPropagation(); dropdown.classList.toggle("open"); });
  document.addEventListener("click", function(){ dropdown.classList.remove("open"); });
  dropdown.querySelectorAll("button").forEach(function(btn){
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      dropdown.classList.remove("open");
      var kind = btn.getAttribute("data-export");
      var rows = window._RiskState.data;
      if(kind==="csv") exportCSV(rows);
      else if(kind==="json") exportJSON(rows);
      else if(kind==="xlsx") exportXLSX(rows);
      else if(kind==="pdf") buildPdfReport();
    });
  });
}
window._wireIO = wireIO;
window._exportCSV = exportCSV; window._exportJSON = exportJSON; window._exportXLSX = exportXLSX;
})();
