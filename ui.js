/* =========================================================================
   Shared presentation helpers: icons, severity pills (shape + color, never
   color alone), and a lightweight SVG semicircle gauge component used
   across tabs (no chart.js dependency needed for these).
========================================================================= */
(function(global){
"use strict";
var E = global.RiskEngine;

var ICON = {
  exec:'<path d="M3 12l4-4 3 3 6-7 4 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 19h17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  heat:'<rect x="3" y="3" width="6.2" height="6.2" rx="1.2" fill="currentColor" opacity=".9"/><rect x="10.4" y="3" width="6.2" height="6.2" rx="1.2" fill="currentColor" opacity=".55"/><rect x="17.6" y="3" width="3.4" height="6.2" rx="1.2" fill="currentColor" opacity=".3"/><rect x="3" y="10.4" width="6.2" height="6.2" rx="1.2" fill="currentColor" opacity=".55"/><rect x="10.4" y="10.4" width="6.2" height="6.2" rx="1.2" fill="currentColor" opacity=".9"/>',
  trend:'<path d="M3 17l5-6 4 3 7-9" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 5h5v5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  shield:'<path d="M12 2l8 3.5v6c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-6L12 2z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  layers:'<path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M3 12l9 4.5 9-4.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M3 16.5L12 21l9-4.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  gauge:'<path d="M12 12l4.8-3.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M4 15a8 8 0 1116 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 9.5h18M9 4v16" stroke="currentColor" stroke-width="1.5"/>',
  sun:'<circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></g>',
  moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" fill="currentColor"/>',
  down:'<path d="M12 4v13M6 11l6 6 6-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  up:'<path d="M12 20V7M6 13l6-6 6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
};
function icon(name, cls){ return '<svg class="'+(cls||"")+'" viewBox="0 0 24 24">'+(ICON[name]||"")+'</svg>'; }

/* Severity shapes: triangle=Critical, diamond=High, circle=Medium,
   chevron=Low, dash=Nil — so meaning survives without color (colorblind /
   print / grayscale safe), per the shape+color severity convention. */
var LEVEL_SHAPE = {
  Critical:'<path d="M5 5L1 -3.5 -3 5z" transform="translate(0,1)" fill="currentColor"/>',
  High:'<path d="M0 -4L4 0 0 4 -4 0z" fill="currentColor"/>',
  Medium:'<circle cx="0" cy="0" r="4" fill="currentColor"/>',
  Low:'<path d="M-4 -2l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  Nil:'<rect x="-4" y="-1" width="8" height="2" rx="1" fill="currentColor"/>'
};
function levelPill(level, opts){
  opts = opts||{};
  var lvl = level || "Nil";
  var shape = LEVEL_SHAPE[lvl] || LEVEL_SHAPE.Nil;
  return '<span class="pill '+E.levelPillClass(lvl)+'">'+
    '<svg viewBox="-6 -6 12 12">'+shape+'</svg>'+
    E.esc(lvl)+(opts.count!==undefined?' · '+opts.count:'')+
  '</span>';
}
function statusPill(status){
  var cls = E.statusPillClass(status);
  var glyph = cls==="pill-closed" ? '<path d="M-3 0l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
            : cls==="pill-emerging" ? '<path d="M0 -4v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="3.2" r=".9" fill="currentColor"/>'
            : '<circle cx="0" cy="0" r="3.4" fill="currentColor"/>';
  return '<span class="pill '+cls+'"><svg viewBox="-6 -6 12 12">'+glyph+'</svg>'+E.esc(status||"—")+'</span>';
}

/* ---------------- SVG semicircle gauge ----------------
   zones: [{to:number, color:cssVarString}] ascending thresholds on a 0..max scale.
   Draws a 180° arc as colored zone segments, plus a needle at `value`. */
function polar(cx,cy,r,angleDeg){
  var a = (angleDeg-180) * Math.PI/180;
  return {x: cx + r*Math.cos(a), y: cy + r*Math.sin(a)};
}
function arcPath(cx,cy,r,a0,a1){
  var p0 = polar(cx,cy,r,a0), p1 = polar(cx,cy,r,a1);
  var large = (a1-a0) > 180 ? 1 : 0;
  return "M "+p0.x.toFixed(2)+" "+p0.y.toFixed(2)+" A "+r+" "+r+" 0 "+large+" 1 "+p1.x.toFixed(2)+" "+p1.y.toFixed(2);
}
function renderGauge(el, opt){
  if(typeof el === "string") el = document.getElementById(el);
  if(!el) return;
  var value = opt.value===null||opt.value===undefined||isNaN(opt.value) ? null : Math.max(0,Math.min(opt.max||100, opt.value));
  var max = opt.max || 100;
  var zones = opt.zones || [
    {to:max*0.4, color:E.cssVar("--critical")},
    {to:max*0.65, color:E.cssVar("--serious")},
    {to:max*0.85, color:E.cssVar("--warning")},
    {to:max, color:E.cssVar("--good")}
  ];
  var W=220,H=148,cx=W/2,cy=110,r=88,rw=21;
  var svg = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:230px;display:block;margin:0 auto;">';
  var prevAngle=0;
  zones.forEach(function(z){
    var ang = (z.to/max)*180;
    svg += '<path d="'+arcPath(cx,cy,r,prevAngle,ang)+'" stroke="'+z.color+'" stroke-width="'+rw+'" fill="none" stroke-linecap="butt" opacity="0.92"/>';
    prevAngle = ang;
  });
  if(value!==null){
    var needleAngle = (value/max)*180;
    var tip = polar(cx,cy,r-rw/2-4,needleAngle);
    var back = polar(cx,cy,10,needleAngle-90);
    var back2 = polar(cx,cy,10,needleAngle+90);
    svg += '<path d="M '+back.x.toFixed(1)+' '+back.y.toFixed(1)+' L '+tip.x.toFixed(1)+' '+tip.y.toFixed(1)+' L '+back2.x.toFixed(1)+' '+back2.y.toFixed(1)+' Z" fill="'+E.cssVar("--text-primary")+'" opacity="0.88"/>';
    svg += '<circle cx="'+cx+'" cy="'+cy+'" r="8" fill="'+E.cssVar("--text-primary")+'"/>';
  }
  svg += '</svg>';
  var valueText = value===null ? "N/A" : (opt.fmt ? opt.fmt(value) : Math.round(value)+(opt.suffix||""));
  el.innerHTML =
    '<div class="gauge-wrap">'+svg+
    '<div class="gauge-value" style="color:'+(value===null?E.cssVar("--text-muted"):E.cssVar("--text-primary"))+'">'+valueText+'</div>'+
    (opt.caption ? '<div class="gauge-caption">'+opt.caption+'</div>' : '')+
    '</div>';
}

/* animated count-up for KPI numbers — small, tasteful, respects reduced motion */
function countUp(el, target, opts){
  opts = opts||{};
  if(typeof el==="string") el = document.getElementById(el);
  if(!el) return;
  if(target===null||target===undefined||isNaN(target)){ el.textContent = "—"; return; }
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = opts.fmt || function(v){ return Math.round(v).toLocaleString(); };
  if(prefersReduced){ el.textContent = fmt(target); return; }
  var start = 0, dur = 650, t0 = performance.now();
  function step(t){
    var p = Math.min(1, (t-t0)/dur);
    var eased = 1 - Math.pow(1-p, 3);
    el.textContent = fmt(start + (target-start)*eased);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function naCard(title, note){
  return '<div class="na-card"><b>'+E.esc(title)+'</b>'+E.esc(note||"Not Available — this metric requires a source field that is not present in the imported register.")+'</div>';
}

global.RiskUI = { icon:icon, levelPill:levelPill, statusPill:statusPill, renderGauge:renderGauge, countUp:countUp, naCard:naCard };
})(window);
