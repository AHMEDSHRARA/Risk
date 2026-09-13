/* =========================================================================
   RUA AL HARAM — Enterprise Risk Intelligence Dashboard — DATA ENGINE v2
   All analytics are derived transparently from the source Risk Register
   fields. Nothing here invents a value: where a source field is absent,
   the corresponding metric resolves to null and callers must render
   "Not Available — field not provided in source register".
========================================================================= */
(function(global){
"use strict";

/* ---------------- taxonomy ---------------- */
var LEVELS = ["Critical","High","Medium","Low","Nil"];
var LEVEL_ORDER = {Critical:0,High:1,Medium:2,Low:3,Nil:4};
var PROB_BANDS = ["<10%","10%-30%","30%-70%","70%-90%",">90%"];
var PROB_ORDINAL = {"<10%":1, "10%-30%":2, "30%-70%":3, "70%-90%":4, ">90%":5};
var PROB_LABEL_BY_ORDINAL = {1:"Rare (<10%)",2:"Unlikely (10-30%)",3:"Possible (30-70%)",4:"Likely (70-90%)",5:"Almost Certain (>90%)"};
var IMPACT_LABEL_BY_ORDINAL = {1:"Very Low",2:"Low",3:"Medium",4:"High",5:"Very High"};
var AGING_BUCKETS = ["0-30","31-60","61-90","91-180","180+"];

/* Column header aliases accepted on import (lower-cased, trimmed match) */
var CANON_HEADERS = {
  "no":"no","no.":"no","department":"dept","dept":"dept","program":"program","project":"project",
  "risk id":"id","risk title":"title","risk owner":"owner","owning function":"func",
  "risk status":"status","risk identified date":"identDate","risk closed date":"closedDate",
  "current risk type":"type","current risk probability":"prob","current risk score":"curScore",
  "current risk level":"curLevel","cost impact score":"cost","time impact score":"time",
  "hsse impact score":"hsse","quality impact score":"quality","treatment plan title":"treatment",
  "mitigation action":"action","action owner":"actionOwner","action status":"actionStatus",
  "% completion":"pct","due date":"due","residual risk score":"resScore","residual risk level":"resLevel",
  "risk statement":"statement","risk cause(s)":"cause","risk consequence(s)":"consequence",
  "source file":"src",
  "cost impact (likely, sar)":"costLikely","cost impact likely":"costLikely","estimated cost exposure (likely)":"costLikely",
  "time impact (likely, days)":"timeLikely","time impact likely days":"timeLikely","estimated schedule exposure (likely days)":"timeLikely",
  "total mitigation actions":"actionsTotal","mitigation actions total":"actionsTotal",
  "completed mitigation actions":"actionsDone","overdue mitigation actions":"actionsOverdue"
};

/* ---------------- generic helpers ---------------- */
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function esc(s){ if(s===null||s===undefined) return ""; return String(s).replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function uniqSorted(arr){ return Array.from(new Set(arr.filter(function(v){return v!==null&&v!==undefined&&v!=="";}))).sort(); }
function fmtNum(n, d){ if(n===null||n===undefined||isNaN(n)) return "—"; return (+n).toLocaleString(undefined,{minimumFractionDigits:d||0,maximumFractionDigits:d===undefined?0:d}); }
function fmtPct(n, d){ if(n===null||n===undefined||isNaN(n)) return "—"; return (+n).toFixed(d===undefined?0:d)+"%"; }
function fmtMoney(n){ if(n===null||n===undefined||isNaN(n)) return "—";
  if(Math.abs(n)>=1000000) return "SAR "+(n/1000000).toFixed(1)+"M";
  if(Math.abs(n)>=1000) return "SAR "+(n/1000).toFixed(0)+"K";
  return "SAR "+Math.round(n);
}
function fmtDays(n){ if(n===null||n===undefined||isNaN(n)) return "—"; return Math.round(n)+"d"; }
function todayDate(){ var t = new Date(); t.setHours(0,0,0,0); return t; }

/* Robust flexible date parser — handles the real formats found across the
   6 source registers: ISO (2025-09-15), DD/MM/YYYY (15/03/2026),
   DD-Mon-YY(YY) (31-Mar-26), "D Month YYYY" (30 November 2026, with an
   optional trailing period), and "Weekday, Month D, YYYY". Returns a Date
   at local midnight, or null if the text cannot be read as a date (that
   null is itself surfaced as a Data Quality finding, never silently
   coerced to "today"). */
var MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function parseFlexDate(raw){
  if(raw===null||raw===undefined) return null;
  if(raw instanceof Date) return isNaN(raw.getTime())?null:raw;
  var s = String(raw).trim().replace(/\.$/,"").replace(/\s+/g," ");
  if(!s) return null;
  var m;
  // ISO: 2025-09-15 (optionally with time component)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m){ var d = new Date(+m[1], +m[2]-1, +m[3]); return isNaN(d.getTime())?null:d; }
  // DD/MM/YYYY or DD-MM-YYYY (numeric)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m){ var dd=+m[1], mm=+m[2]; if(mm>12 && dd<=12){ var t=dd; dd=mm; mm=t; } var d2=new Date(+m[3], mm-1, dd); return isNaN(d2.getTime())?null:d2; }
  // DD-Mon-YY or DD-Mon-YYYY  e.g. 31-Mar-26
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{2,4})$/);
  if(m){
    var mon = MONTHS[m[2].slice(0,3).toLowerCase()];
    if(mon!==undefined){
      var yr = +m[3]; if(yr<100) yr += 2000;
      var d3 = new Date(yr, mon, +m[1]); return isNaN(d3.getTime())?null:d3;
    }
  }
  // "D Month YYYY" e.g. 30 November 2026
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(m){
    var mon2 = MONTHS[m[2].slice(0,3).toLowerCase()];
    if(mon2!==undefined){ var d4 = new Date(+m[3], mon2, +m[1]); return isNaN(d4.getTime())?null:d4; }
  }
  // "Month D, YYYY" or "Weekday, Month D, YYYY"
  m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if(m){
    var mon3 = MONTHS[m[1].slice(0,3).toLowerCase()];
    if(mon3!==undefined){ var d5 = new Date(+m[3], mon3, +m[2]); return isNaN(d5.getTime())?null:d5; }
  }
  return null; // unparseable text (e.g. "Open", free narrative) — a data-quality finding, not a date
}
function fmtDate(d){
  if(!d) return "—";
  var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.getDate()+" "+months[d.getMonth()]+" "+d.getFullYear();
}
function dispDate(raw){ if(!raw) return "—"; var d = parseFlexDate(raw); return d ? fmtDate(d) : String(raw); }
function monthKey(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }
function monthLabel(key){
  var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var parts=key.split("-"); return months[+parts[1]-1]+" "+parts[0].slice(2);
}
function daysBetween(a,b){ return Math.round((b-a)/86400000); }

/* ---------------- risk-level scoring (derived from the Risk Rating
   Scheme sheet embedded in the source template — Score = (Impact-1)*5 +
   Probability, both 1-5 ordinals). We never invent Probability/Impact:
   Probability is read directly from the "Current/Residual Risk
   Probability" band; Impact is recovered by inverting that exact
   documented formula against the recorded Score. ---------------- */
function scoreToLevel(score){
  if(score===null||score===undefined||isNaN(score)) return null;
  var s=+score;
  if(s<=0) return "Nil";
  if(s<=3) return "Low";
  if(s<=9) return "Medium";
  if(s<=15) return "High";
  return "Critical";
}
function probOrdinal(band){ return PROB_ORDINAL[band] || null; }
function deriveImpactOrdinal(band, score){
  var p = probOrdinal(band);
  if(p===null || score===null || score===undefined || isNaN(score) || score<=0) return null;
  var raw = (score - p)/5 + 1;
  var rounded = Math.round(raw);
  if(rounded<1 || rounded>5) return null;              // outside the documented 5x5 matrix — leave unplaced
  if(Math.abs(raw-rounded) > 0.001) return null;        // score/probability pair inconsistent with the matrix — data-quality case, not fabricated
  return rounded;
}

function levelColor(level){
  switch((level||"").toLowerCase()){
    case "critical": return cssVar("--critical");
    case "high": return cssVar("--serious");
    case "medium": return cssVar("--warning");
    case "low": return cssVar("--good");
    default: return cssVar("--nil");
  }
}
function levelPillClass(level){
  switch((level||"").toLowerCase()){
    case "critical": return "pill-critical";
    case "high": return "pill-high";
    case "medium": return "pill-medium";
    case "low": return "pill-low";
    default: return "pill-nil";
  }
}
function statusPillClass(status){
  var s=(status||"").toLowerCase();
  if(s.indexOf("closed")>=0) return "pill-closed";
  if(s.indexOf("emerg")>=0) return "pill-emerging";
  return "pill-open";
}
function isOpenStatus(status){
  var s=(status||"").toLowerCase();
  return s.indexOf("closed")<0;
}
function isKnownStatus(status){
  var known=["open","emerging","closed - other","closed - trend/issue","closed - expired","closed - residual risk","closed - disapproved","approved"];
  return known.indexOf((status||"").toLowerCase())>=0;
}

/* ---------------- aging ---------------- */
function ageDays(identDateRaw, ref){
  var d = identDateRaw instanceof Date ? identDateRaw : parseFlexDate(identDateRaw);
  if(!d) return null;
  return daysBetween(d, ref||todayDate());
}
function agingBucket(days){
  if(days===null||days===undefined) return null;
  if(days<=30) return "0-30";
  if(days<=60) return "31-60";
  if(days<=90) return "61-90";
  if(days<=180) return "91-180";
  return "180+";
}

/* =========================================================================
   AGGREGATION ENGINE — one pass over a (filtered) dataset producing every
   number the seven tabs read from. Keeping this in one place guarantees
   every tab agrees on the same definitions.
========================================================================= */
function computeAgg(dataset){
  var today = todayDate();
  var total = dataset.length;
  var byLevel = {}; LEVELS.forEach(function(l){byLevel[l]=0;});
  var byStatus = {}, byProgram = {}, byProject = {}, byFunc = {}, byOwner = {}, byDept = {}, byCategory = {};
  var open=0, closed=0, emerging=0, overdueRisk=0;
  var curScores=[], resScores=[], pairedReduction=[];
  var noResidual=0, noOwner=0, noProbability=0, noScore=0;
  var risksWithMitigation=0, risksWithoutMitigation=0;
  var actionsTotal=0, actionsDone=0, actionsOverdue=0, actionsInProgress=0, actionsDelayed=0;
  var costExposure=0, costExposureN=0, timeExposure=0, timeExposureN=0;
  var agingCounts={}; AGING_BUCKETS.forEach(function(b){agingCounts[b]=0;});
  var identMonthCounts={}, closedMonthCounts={};
  var heat = {}; // key "p-i" -> count (Threats only, valid matrix placements)
  var unplacedThreats = 0;
  var opportunities = 0;
  var invalidIdentDate=0, invalidDueDate=0, missingDueOnOpen=0;
  var top = [];

  dataset.forEach(function(r){
    var lvl = r.curLevel || scoreToLevel(r.curScore) || "Nil";
    byLevel[lvl] = (byLevel[lvl]||0)+1;
    byStatus[r.status] = (byStatus[r.status]||0)+1;
    var openFlag = isOpenStatus(r.status);
    if(openFlag) open++; else closed++;
    if((r.status||"").toLowerCase()==="emerging") emerging++;

    if(r.type==="Opportunity") opportunities++;

    if(typeof r.curScore==="number") curScores.push(r.curScore); else noScore++;
    if(!r.prob) noProbability++;
    if(typeof r.resScore==="number"){ resScores.push(r.resScore); if(typeof r.curScore==="number") pairedReduction.push({cur:r.curScore,res:r.resScore}); }
    else noResidual++;
    if(!r.owner || /^unassign/i.test(r.owner)) noOwner++;

    var due = parseFlexDate(r.due);
    if(r.due && !due) invalidDueDate++;
    if(!r.due && openFlag) missingDueOnOpen++;
    if(due && due<today && openFlag && (r.actionStatus||"").toLowerCase()!=="done") overdueRisk++;

    var aTotal = (typeof r.actionsTotal==="number") ? r.actionsTotal : (r.action ? 1 : 0);
    var aDone  = (typeof r.actionsDone==="number") ? r.actionsDone : ((r.actionStatus||"").toLowerCase()==="done" ? aTotal : 0);
    var aOver  = (typeof r.actionsOverdue==="number") ? r.actionsOverdue : (due && due<today && openFlag && (r.actionStatus||"").toLowerCase()!=="done" ? 1 : 0);
    actionsTotal += aTotal; actionsDone += aDone; actionsOverdue += aOver;
    if((r.actionStatus||"").toLowerCase()==="in progress") actionsInProgress++;
    if((r.actionStatus||"").toLowerCase()==="delayed") actionsDelayed++;
    if(aTotal>0) risksWithMitigation++; else risksWithoutMitigation++;

    if(typeof r.costLikely==="number"){ costExposure += r.costLikely; costExposureN++; }
    if(typeof r.timeLikely==="number"){ timeExposure += r.timeLikely; timeExposureN++; }

    byProgram[r.program]=(byProgram[r.program]||0)+1;
    var pk=r.program+" | "+r.project;
    byProject[pk]=byProject[pk]||{program:r.program, project:r.project, count:0, curSum:0, resSum:0, resN:0, critical:0, high:0, open:0, costExposure:0, timeExposure:0};
    var bp = byProject[pk];
    bp.count++;
    if(typeof r.curScore==="number") bp.curSum += r.curScore;
    if(typeof r.resScore==="number"){ bp.resSum += r.resScore; bp.resN++; }
    if(lvl==="Critical") bp.critical++;
    if(lvl==="High") bp.high++;
    if(openFlag) bp.open++;
    if(typeof r.costLikely==="number") bp.costExposure += r.costLikely;
    if(typeof r.timeLikely==="number") bp.timeExposure += r.timeLikely;

    byFunc[r.func]=(byFunc[r.func]||0)+1;
    byOwner[r.owner]=(byOwner[r.owner]||0)+1;
    byDept[r.dept]=(byDept[r.dept]||0)+1;
    ["cost","time","hsse","quality"].forEach(function(cat){
      if(typeof r[cat]==="number"){
        byCategory[cat]=byCategory[cat]||{sum:0,n:0,resSum:0,resN:0};
        byCategory[cat].sum += r[cat]; byCategory[cat].n++;
      }
    });

    if(openFlag){
      var age = ageDays(r.identDate, today);
      if(age!==null){ var b=agingBucket(age); agingCounts[b]=(agingCounts[b]||0)+1; }
    }

    var identD = parseFlexDate(r.identDate);
    if(!identD && r.identDate) invalidIdentDate++;
    if(identD){ var mk=monthKey(identD); identMonthCounts[mk]=(identMonthCounts[mk]||0)+1; }
    var closedD = parseFlexDate(r.closedDate);
    if(closedD){ var mk2=monthKey(closedD); closedMonthCounts[mk2]=(closedMonthCounts[mk2]||0)+1; }

    if(r.type!=="Opportunity" && typeof r.curScore==="number" && r.curScore>0 && r.prob){
      var pi = probOrdinal(r.prob), ii = deriveImpactOrdinal(r.prob, r.curScore);
      if(pi && ii){ var key=pi+"-"+ii; heat[key]=(heat[key]||0)+1; }
      else unplacedThreats++;
    }

    top.push(r);
  });

  var avgCur = curScores.length? curScores.reduce(function(a,b){return a+b;},0)/curScores.length : null;
  var avgRes = resScores.length? resScores.reduce(function(a,b){return a+b;},0)/resScores.length : null;
  var avgPairedReductionPct = null;
  if(pairedReduction.length){
    var sumPct=0, nn=0;
    pairedReduction.forEach(function(p){ if(p.cur>0){ sumPct += (p.cur-p.res)/p.cur; nn++; } });
    avgPairedReductionPct = nn? (sumPct/nn*100) : null;
  }
  top.sort(function(a,b){ return (b.curScore||0)-(a.curScore||0); });

  var closureRate = total? (closed/total*100) : null;
  var mitigationCompletionRate = actionsTotal? (actionsDone/actionsTotal*100) : null;
  var overdueRate = actionsTotal? (actionsOverdue/actionsTotal*100) : null;
  var criticalRatio = total? (byLevel.Critical/total*100) : null;
  var residualCoverage = total? ((total-noResidual)/total*100) : null;

  return {
    total:total, open:open, closed:closed, emerging:emerging, opportunities:opportunities,
    byLevel:byLevel, byStatus:byStatus, byProgram:byProgram, byProject:byProject,
    byFunc:byFunc, byOwner:byOwner, byDept:byDept, byCategory:byCategory,
    avgCur:avgCur, avgRes:avgRes, avgPairedReductionPct:avgPairedReductionPct,
    noResidual:noResidual, noOwner:noOwner, noProbability:noProbability, noScore:noScore,
    overdueRisk:overdueRisk, invalidDueDate:invalidDueDate, invalidIdentDate:invalidIdentDate, missingDueOnOpen:missingDueOnOpen,
    risksWithMitigation:risksWithMitigation, risksWithoutMitigation:risksWithoutMitigation,
    actionsTotal:actionsTotal, actionsDone:actionsDone, actionsOverdue:actionsOverdue,
    actionsInProgress:actionsInProgress, actionsDelayed:actionsDelayed,
    costExposure:costExposure, costExposureN:costExposureN, timeExposure:timeExposure, timeExposureN:timeExposureN,
    agingCounts:agingCounts, identMonthCounts:identMonthCounts, closedMonthCounts:closedMonthCounts,
    heat:heat, unplacedThreats:unplacedThreats,
    closureRate:closureRate, mitigationCompletionRate:mitigationCompletionRate, overdueRate:overdueRate,
    criticalRatio:criticalRatio, residualCoverage:residualCoverage,
    topRisks: top.slice(0,15)
  };
}

/* ---------------- Data Quality ---------------- */
function computeDataQuality(dataset){
  var issues = [];
  var idCounts = {};
  dataset.forEach(function(r){ if(r.id){ idCounts[r.id]=(idCounts[r.id]||0)+1; } });
  var dupIds = Object.keys(idCounts).filter(function(k){return idCounts[k]>1;});

  var missingOwner=0, missingProb=0, missingScore=0, missingMitigation=0, missingDueOpen=0,
      invalidLevel=0, invalidStatus=0, invalidIdentDate=0, invalidDueDate=0, missingId=0;
  dataset.forEach(function(r){
    if(!r.id) missingId++;
    if(!r.owner || /^unassign/i.test(r.owner)) missingOwner++;
    if(!r.prob) missingProb++;
    if(typeof r.curScore!=="number") missingScore++;
    var aTotal = (typeof r.actionsTotal==="number") ? r.actionsTotal : (r.action?1:0);
    if(!aTotal && isOpenStatus(r.status)) missingMitigation++;
    if(!r.due && isOpenStatus(r.status)) missingDueOpen++;
    if(r.curLevel && LEVELS.indexOf(r.curLevel)<0) invalidLevel++;
    if(r.status && !isKnownStatus(r.status)) invalidStatus++;
    if(r.identDate && !parseFlexDate(r.identDate)) invalidIdentDate++;
    if(r.due && !parseFlexDate(r.due)) invalidDueDate++;
  });

  var total = dataset.length || 1;
  var deductions = [
    {label:"Missing Risk ID", n:missingId, weight:3},
    {label:"Duplicate Risk ID", n:dupIds.length, weight:3},
    {label:"Missing Owner", n:missingOwner, weight:1.5},
    {label:"Missing Probability", n:missingProb, weight:1.5},
    {label:"Missing Risk Score", n:missingScore, weight:2},
    {label:"Open Risk Without Mitigation Action", n:missingMitigation, weight:2},
    {label:"Open Risk Without Due Date", n:missingDueOpen, weight:1},
    {label:"Invalid Risk Level Text", n:invalidLevel, weight:1},
    {label:"Unrecognized Status Value", n:invalidStatus, weight:1},
    {label:"Unparseable Identified Date", n:invalidIdentDate, weight:1},
    {label:"Unparseable Due Date", n:invalidDueDate, weight:1}
  ];
  // Issue-density scoring: each record could in principle trip every check
  // (total * sum of weights = the maximum possible weighted issue count).
  // The score is the share of that maximum NOT observed — bounded 0-100 by
  // construction, and it stays proportionate to how much of the register is
  // actually affected rather than collapsing on one systemic finding.
  var weightSum = deductions.reduce(function(s,d){ return s+d.weight; },0);
  var maxPossible = total*weightSum;
  var rawPenalty = deductions.reduce(function(s,d){ return s + d.n*d.weight; },0);
  var score = maxPossible? Math.max(0, 100*(1 - rawPenalty/maxPossible)) : 100;

  return {score:score, deductions:deductions, dupIds:dupIds, total:total, weightSum:weightSum, rawPenalty:rawPenalty};
}

/* Cross-project verbatim duplicate detection (title+cause match across
   different source projects) — surfaces genuine register duplication
   issues such as identical registers filed under two project names. */
function findCrossProjectDuplicates(dataset){
  var groups = {};
  dataset.forEach(function(r){
    var key = (r.title||"").trim().toLowerCase()+"||"+(r.cause||"").trim().toLowerCase().slice(0,80);
    if(!key.trim()) return;
    groups[key] = groups[key] || [];
    groups[key].push(r);
  });
  var dupes = [];
  Object.keys(groups).forEach(function(k){
    var g = groups[k];
    var projects = uniqSorted(g.map(function(r){return r.project;}));
    if(g.length>1 && projects.length>1){ dupes.push({key:k, rows:g, projects:projects}); }
  });
  return dupes;
}

/* ---------------- Risk Performance Index ----------------
   A transparent, documented composite of four normalized sub-indices,
   each 0-100 and each computed only from fields present in the source
   register. Any sub-index that cannot be computed (its source field
   absent) is excluded from the average rather than defaulted to a
   value — the UI must show which sub-indices fed the final number. */
function computeRPI(agg){
  var parts = [];
  if(agg.closureRate!==null) parts.push({key:"Closure Rate", value:agg.closureRate});
  if(agg.mitigationCompletionRate!==null) parts.push({key:"Mitigation Completion Rate", value:agg.mitigationCompletionRate});
  if(agg.overdueRate!==null) parts.push({key:"On-Time Action Rate", value:100-agg.overdueRate});
  if(agg.avgPairedReductionPct!==null) parts.push({key:"Residual Risk Reduction", value:Math.max(0,Math.min(100,agg.avgPairedReductionPct))});
  var value = parts.length ? parts.reduce(function(s,p){return s+p.value;},0)/parts.length : null;
  return {value:value, parts:parts};
}

global.RiskEngine = {
  LEVELS:LEVELS, LEVEL_ORDER:LEVEL_ORDER, PROB_BANDS:PROB_BANDS, PROB_ORDINAL:PROB_ORDINAL,
  PROB_LABEL_BY_ORDINAL:PROB_LABEL_BY_ORDINAL, IMPACT_LABEL_BY_ORDINAL:IMPACT_LABEL_BY_ORDINAL,
  AGING_BUCKETS:AGING_BUCKETS, CANON_HEADERS:CANON_HEADERS,
  cssVar:cssVar, esc:esc, uniqSorted:uniqSorted, fmtNum:fmtNum, fmtPct:fmtPct, fmtMoney:fmtMoney, fmtDays:fmtDays,
  todayDate:todayDate, parseFlexDate:parseFlexDate, fmtDate:fmtDate, dispDate:dispDate, monthKey:monthKey, monthLabel:monthLabel, daysBetween:daysBetween,
  scoreToLevel:scoreToLevel, probOrdinal:probOrdinal, deriveImpactOrdinal:deriveImpactOrdinal,
  levelColor:levelColor, levelPillClass:levelPillClass, statusPillClass:statusPillClass, isOpenStatus:isOpenStatus, isKnownStatus:isKnownStatus,
  ageDays:ageDays, agingBucket:agingBucket,
  computeAgg:computeAgg, computeDataQuality:computeDataQuality, findCrossProjectDuplicates:findCrossProjectDuplicates, computeRPI:computeRPI
};

})(window);
