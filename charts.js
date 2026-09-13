/* Shared Chart.js defaults so every chart across the seven tabs reads as
   one system: recessive gridlines, muted axis ink, consistent tooltip
   styling, and a fixed categorical order (never re-cycled per filter). */
(function(global){
"use strict";
var E = global.RiskEngine;

function textColor(){ return E.cssVar("--text-secondary"); }
function mutedColor(){ return E.cssVar("--text-muted"); }
function gridColor(){ return E.cssVar("--chart-grid"); }
function surface(){ return E.cssVar("--surface"); }

var CAT_ORDER = ["--s1","--s2","--s3","--s4","--s5","--s6","--s7","--s8"];
function categorical(n){
  var out=[]; for(var i=0;i<n;i++) out.push(E.cssVar(CAT_ORDER[i%CAT_ORDER.length]));
  return out;
}
var LEVEL_COLORS = {
  Critical: function(){return E.cssVar("--critical");},
  High: function(){return E.cssVar("--serious");},
  Medium: function(){return E.cssVar("--warning");},
  Low: function(){return E.cssVar("--good");},
  Nil: function(){return E.cssVar("--nil");}
};
function levelColorsFor(labels){ return labels.map(function(l){ return (LEVEL_COLORS[l]||LEVEL_COLORS.Nil)(); }); }

/* Precise click hit-testing. Chart.js's own `elements` argument passed into
   onClick is computed from the chart-wide `interaction` mode (mode:"index",
   intersect:false in baseOptions below) — for horizontal bar charts
   (indexAxis:"y") that combination resolves the wrong element (or none) on
   a real click in this Chart.js version. Every onClick handler in the app
   should ignore the `elements` argument Chart.js passes in and instead call
   pick(evt, chart) to get the element actually under the pointer. */
function pick(evt, chart){
  try{ return chart.getElementsAtEventForMode(evt, "nearest", {intersect:true}, true); }
  catch(e){ return []; }
}
/* Any onClick handler that ends up destroying/rebuilding ITS OWN chart —
   directly, or indirectly via _setFilter/a full tab re-render — must do that
   work on a fresh tick. Chart.js still has internal bookkeeping to finish for
   the current click after the onClick callback returns; tearing the chart
   down synchronously inside that callback throws inside Chart.js's own code
   ("Cannot read properties of undefined (reading 'handleEvent')") and that,
   in turn, breaks hit-testing for every click after it. Wrap the effectful
   part of the handler in this instead of calling it directly. */
function afterClick(fn){ setTimeout(fn, 0); }

Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = mutedColor();

function baseOptions(overrides){
  var opt = {
    responsive:true, maintainAspectRatio:false,
    animation:{duration:420},
    interaction:{mode:"index", intersect:false},
    plugins:{
      legend:{display:false},
      tooltip:{
        backgroundColor: surface(), titleColor: E.cssVar("--text-primary"), bodyColor: textColor(),
        borderColor: E.cssVar("--border"), borderWidth:1, padding:10, cornerRadius:8,
        titleFont:{weight:"700",size:11.5}, bodyFont:{size:11.5}, displayColors:true, boxPadding:4
      }
    },
    scales:{
      x:{ grid:{color:gridColor(), drawTicks:false}, ticks:{color:mutedColor()}, border:{display:false} },
      y:{ grid:{color:gridColor(), drawTicks:false}, ticks:{color:mutedColor()}, border:{display:false}, beginAtZero:true }
    }
  };
  return Object.assign({}, opt, overrides||{});
}

global.RiskCharts = { textColor:textColor, mutedColor:mutedColor, gridColor:gridColor, surface:surface,
  categorical:categorical, levelColorsFor:levelColorsFor, baseOptions:baseOptions, pick:pick, afterClick:afterClick };
})(window);
