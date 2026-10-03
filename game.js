
"use strict";
/* ============================================================
   TRICK OR BEAM — a complete stealth adventure in one file
   Engine: Canvas 2D, fixed 60Hz timestep, DOM UI screens.
   ============================================================ */

/* ---------- utils ---------- */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
const angDiff=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const choice=a=>a[Math.floor(Math.random()*a.length)];
function $(id){return document.getElementById(id);}
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function fmtTime(sec){sec=Math.max(0,Math.ceil(sec));const m=Math.floor(sec/60),s=sec%60;return m+":"+String(s).padStart(2,"0");}
// clock display: level maps minutes 7:00pm -> 12:00am
function clockLabel(min){ // min = minutes since 7pm
  const h=7+Math.floor(min/60), m=Math.floor(min%60);
  const h12=((h-1)%12)+1;
  return h12+":"+String(m).padStart(2,"0")+" PM";
}

/* ---------- save system ---------- */
const SAVE_KEY="trickorbeam_save_v1";
function blankProfile(name){return{
 name:name||"Player", unlocked:1, stars:{}, candy:0,
 costumes:["robot"], selCostume:"robot",
 throwSel:"corn", ownedThrows:["corn"],
 ownedGadgets:[], hatsOwned:[], hat:null,
 colorsOwned:["mint"], color:"mint", trailsOwned:[], trail:null,
 settings:{music:0.7,sfx:0.8,joySide:"left",reduced:false,easy:false},
 best:{}, stats:{hides:0,throws:0,distracts:0,rescues:0,catches:0,powers:{},ghosted:0,maxCandy:0,late:0},
 book:{aliens:{},friends:{},corns:{}},
 achv:{}
};}
function blankSave(){return{profiles:[blankProfile("Player 1"),blankProfile(""),blankProfile(""),blankProfile("")],sel:0};}
let SAVE=blankSave();
function loadSave(){try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const d=JSON.parse(raw);
 if(d&&Array.isArray(d.profiles)&&d.profiles.length===4){for(let i=0;i<4;i++){d.profiles[i]=Object.assign(blankProfile(""),d.profiles[i]||{});}SAVE=d;}}}catch(e){}}
function storeSave(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE));}catch(e){}}
function P(){return SAVE.profiles[SAVE.sel];}
function prof(){return P();}
/* ---------- audio: all procedural Web Audio ---------- */
const AU={
 ctx:null,started:false,mode:"title",danger:0,duckT:0,seqStep:0,nextT:0,key:0,level:0,
 init(){ if(this.started)return; try{
  const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
  this.ctx=new C(); this.started=true;
  this.master=this.ctx.createGain(); this.master.connect(this.ctx.destination);
  this.musicG=this.ctx.createGain(); this.sfxG=this.ctx.createGain();
  this.musicG.connect(this.master); this.sfxG.connect(this.master);
  this.applyVol();
  this.nextT=this.ctx.currentTime+0.1;
  setInterval(()=>this.schedule(),60);
 }catch(e){} },
 resume(){ if(this.ctx&&this.ctx.state==="suspended"){try{this.ctx.resume();}catch(e){}} },
 applyVol(){ if(!this.ctx)return; const s=prof()?prof().settings:{music:.7,sfx:.8};
  this.musicG.gain.value=0.5*(s.music==null?0.7:s.music);
  this.sfxG.gain.value=0.9*(s.sfx==null?0.8:s.sfx); },
 tone(f,d,type,v,slide,when,dest){ if(!this.ctx)return; const t=when||this.ctx.currentTime;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain();
  o.type=type||"sine"; o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+d);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v||0.3,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g); g.connect(dest||this.sfxG); o.start(t); o.stop(t+d+0.05); },
 nz(d,v,ff,type,when){ if(!this.ctx)return; const t=when||this.ctx.currentTime;
  const len=Math.max(1,Math.floor(this.ctx.sampleRate*d));
  const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),ch=buf.getChannelData(0);
  for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(1-i/len);
  const s=this.ctx.createBufferSource(); s.buffer=buf;
  const f=this.ctx.createBiquadFilter(); f.type=type||"lowpass"; f.frequency.value=ff||800;
  const g=this.ctx.createGain(); g.gain.setValueAtTime(v||0.3,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t); },
 duck(){this.duckT=0.5;},
 sfx:{
  click(){AU.tone(660,0.07,"square",0.15,880);},
  step(sn){AU.nz(0.07,sn?0.05:0.11,500);AU.tone(sn?140:110,0.06,"sine",0.08,70);},
  crunch(){AU.nz(0.14,0.22,2400,"highpass");},
  clang(){AU.tone(420,0.35,"square",0.2,180);AU.tone(631,0.3,"square",0.12,240);},
  toss(){AU.tone(300,0.18,"sine",0.18,700);},
  land(){AU.nz(0.08,0.12,900);},
  gulp(){AU.tone(500,0.12,"sine",0.2,180);AU.tone(300,0.14,"sine",0.18,120,AU.ctx?AU.ctx.currentTime+0.1:0);},
  warble(){const t=AU.ctx?AU.ctx.currentTime:0;for(let i=0;i<3;i++)AU.tone(300+Math.random()*200,0.12,"sawtooth",0.07,600+Math.random()*300,t+i*0.11);},
  q(){AU.tone(880,0.18,"sine",0.22,1174);},
  excl(){AU.tone(660,0.12,"square",0.25,660);AU.tone(880,0.2,"square",0.25,880,AU.ctx?AU.ctx.currentTime+0.12:0);},
  beam(){if(!AU.ctx)return;const t=AU.ctx.currentTime;AU.tone(80,1.4,"sawtooth",0.16,220,t);AU.tone(160,1.4,"sine",0.1,440,t);},
  jarPop(){AU.tone(400,0.1,"square",0.25,900);AU.nz(0.12,0.2,1800,"highpass");},
  cheer(){const t=AU.ctx?AU.ctx.currentTime:0;const n=[523,659,784,1046];n.forEach((f,i)=>AU.tone(f,0.16,"triangle",0.2,f,t+i*0.09));},
  power(){AU.tone(200,0.4,"sawtooth",0.2,1200);},
  star(){AU.tone(1046,0.25,"sine",0.25,1568);AU.tone(1568,0.3,"sine",0.2,2093,AU.ctx?AU.ctx.currentTime+0.15:0);},
  hide(){AU.nz(0.18,0.14,600);AU.tone(250,0.15,"sine",0.1,120);},
  coin(){AU.tone(988,0.08,"square",0.12,1320);AU.tone(1320,0.12,"square",0.1,1760,AU.ctx?AU.ctx.currentTime+0.07:0);},
  corn(){const t=AU.ctx?AU.ctx.currentTime:0;[880,1174,1568].forEach((f,i)=>AU.tone(f,0.14,"triangle",0.2,f,t+i*0.08));},
  checkpoint(){AU.tone(523,0.2,"sine",0.2,784);AU.tone(784,0.25,"sine",0.18,1046,AU.ctx?AU.ctx.currentTime+0.14:0);},
  flip(){AU.tone(300,0.1,"square",0.2,600);AU.tone(600,0.12,"square",0.18,300,AU.ctx?AU.ctx.currentTime+0.09:0);},
  caught(){const t=AU.ctx?AU.ctx.currentTime:0;AU.tone(500,0.8,"sawtooth",0.2,90,t);},
  escape(){const t=AU.ctx?AU.ctx.currentTime:0;for(let i=0;i<4;i++)AU.tone(440+i*110,0.14,"square",0.2,440+i*110,t+i*0.15);},
  rattle(){const t=AU.ctx?AU.ctx.currentTime:0;for(let i=0;i<5;i++)AU.nz(0.05,0.16,3000,"highpass",t+i*0.07);},
  stomp(){AU.tone(70,0.3,"sine",0.4,40);AU.nz(0.2,0.3,300);},
  freeze(){AU.tone(1200,0.5,"sine",0.16,300);},
  dash(){AU.nz(0.3,0.2,1200,"bandpass");AU.tone(200,0.3,"sawtooth",0.12,800);},
  roll(){AU.nz(0.35,0.14,500);},
  glide(){AU.tone(600,0.5,"sine",0.12,900);},
  grab(){AU.tone(350,0.2,"sine",0.16,700);},
  trap(){AU.nz(0.25,0.3,400);AU.tone(150,0.3,"square",0.2,60);},
  heart(){AU.tone(65,0.12,"sine",0.4,50);AU.tone(60,0.1,"sine",0.3,45,AU.ctx?AU.ctx.currentTime+0.18:0);},
  blip(){AU.tone(700+Math.random()*300,0.03,"square",0.05);},
  apple(){AU.tone(700,0.1,"sine",0.2,900);AU.nz(0.08,0.15,1500,"highpass");},
  win(){const t=AU.ctx?AU.ctx.currentTime:0;[523,659,784,1046,1318].forEach((f,i)=>AU.tone(f,0.22,"triangle",0.22,f,t+i*0.12));}
 },
 setMode(m){this.mode=m;},
 setLevel(i){this.level=i;},
 // generative spooky-cute music sequencer
 schedule(){ if(!this.ctx||!this.started)return;
  const chase=this.mode==="chase", dark=this.mode==="dark";
  const bpm=chase?148:(this.mode==="title"?84:104);
  const spb=60/bpm/2; // eighth notes
  const now=this.ctx.currentTime;
  if(this.duckT>0)this.duckT-=0.06;
  const duckM=this.duckT>0?0.35:1;
  while(this.nextT<now+0.25){
   const t=this.nextT, s=this.seqStep;
   const keys=[0,3,5,7,10,2,8]; // minor-ish roots per level
   const root=110*Math.pow(2,keys[this.level%keys.length]/12);
   const prog=[0,-4,-2,-5]; const bar=Math.floor(s/8)%4;
   const bassN=root*Math.pow(2,prog[bar]/12);
   // plucked bass on beats
   if(s%4===0)this.tone(bassN,0.22,"triangle",0.30*duckM,bassN*0.99,t,this.musicG);
   if(s%4===2)this.tone(bassN*1.5,0.15,"triangle",0.18*duckM,bassN*1.49,t,this.musicG);
   // theremin lead: sparse spooky melody
   if(!chase&&s%8===irand(0,0)+[0,3,5][Math.floor(s/8)%3]){}
   if(s%2===0&&((s*7+this.level)%16<6)){
    const scale=[0,2,3,7,8,10,12];
    const n=root*2*Math.pow(2,choice(scale)/12);
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type="sine";o.frequency.value=n;
    const vib=this.ctx.createOscillator(),vg=this.ctx.createGain();
    vib.frequency.value=6;vg.gain.value=n*0.012;vib.connect(vg);vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.11*duckM,t+0.06);
    g.gain.exponentialRampToValueAtTime(0.0001,t+spb*1.8);
    o.connect(g);g.connect(this.musicG);o.start(t);vib.start(t);o.stop(t+spb*2);vib.stop(t+spb*2);
   }
   // bells sparkle
   if(s%16===12)this.tone(root*8,0.5,"sine",0.05*duckM,root*7.9,t,this.musicG);
   // drums
   if(chase||this.mode==="title"){
    if(s%4===0)this.nz2(0.12,0.28,200,t); // kick
    if(s%4===2)this.nz2(0.08,0.14,4000,t); // hat
   } else if(s%8===4)this.nz2(0.06,0.07,5000,t);
   // heartbeat under danger
   if(this.danger>0.55&&s%8===0){this.tone(62,0.12,"sine",0.35*this.danger,50,t,this.musicG);
    this.tone(58,0.1,"sine",0.25*this.danger,45,t+spb*2,this.musicG);}
   this.seqStep++; this.nextT+=spb;
  }
 },
 nz2(d,v,ff,t){ if(!this.ctx)return; const len=Math.max(1,Math.floor(this.ctx.sampleRate*d));
  const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),ch=buf.getChannelData(0);
  for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(1-i/len);
  const s=this.ctx.createBufferSource();s.buffer=buf;
  const f=this.ctx.createBiquadFilter();f.type="lowpass";f.frequency.value=ff;
  const g=this.ctx.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  s.connect(f);f.connect(g);g.connect(this.musicG);s.start(t); }
};
/* ---------- procedural art: glossy squishy cartoon style ---------- */
const BLOB_COLORS={mint:"#7fe6b8",purple:"#b07fe6",orange:"#f5a54f",lime:"#b8e64f",pink:"#f27fb8",tan:"#e0c48f",teal:"#5fd4c8",blue:"#6fa8f5"};
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
 r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255);return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");}
function glossBlob(c,x,y,r,o){
 // o: color,sx,sy,eyeDX,eyeDY,blink,mouth,alpha,hidden,rim
 o=o||{};const col=o.color||"#7fe6b8";
 const sx=o.sx||1,sy=o.sy||1;
 c.save();c.translate(x,y);c.scale(sx,sy);if(o.alpha!=null)c.globalAlpha=o.alpha;
 const g=c.createRadialGradient(-r*0.35,-r*0.4,r*0.2,0,0,r*1.15);
 g.addColorStop(0,shade(col,60));g.addColorStop(0.55,col);g.addColorStop(1,shade(col,-55));
 c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
 // rim light
 c.strokeStyle="rgba(255,255,255,.35)";c.lineWidth=Math.max(1.5,r*0.07);
 c.beginPath();c.arc(0,0,r*0.97,Math.PI*1.15,Math.PI*1.75);c.stroke();
 // glossy highlight
 c.fillStyle="rgba(255,255,255,.5)";
 c.beginPath();c.ellipse(-r*0.38,-r*0.44,r*0.28,r*0.16,-0.5,0,TAU);c.fill();
 if(!o.hidden){
  const ex=o.eyeDX||0,ey=o.eyeDY||0,er=r*0.30;
  const blink=o.blink?0.12:1;
  for(const s of[-1,1]){const exx=s*r*0.34+ex*r*0.3,eyy=-r*0.12+ey*r*0.3;
   c.fillStyle="#fff";c.beginPath();c.ellipse(exx,eyy,er,er*blink,0,0,TAU);c.fill();
   if(!o.blink){c.fillStyle="#26203a";c.beginPath();c.arc(exx+ex*r*0.35,eyy+ey*r*0.35,er*0.45,0,TAU);c.fill();
    c.fillStyle="#fff";c.beginPath();c.arc(exx+ex*r*0.35-er*0.12,eyy+ey*r*0.35-er*0.12,er*0.14,0,TAU);c.fill();}
  }
  if(o.mouth==="o"){c.fillStyle="#4a2b3a";c.beginPath();c.ellipse(0,r*0.42,r*0.16,r*0.22,0,0,TAU);c.fill();}
  else if(o.mouth==="smile"){c.strokeStyle="#4a2b3a";c.lineWidth=r*0.08;c.beginPath();c.arc(0,r*0.18,r*0.3,0.3,Math.PI-0.3);c.stroke();}
 }else{
  // peeking eyes above hiding spot rim
  const pex=o.eyeDX||0;
  for(const s of[-1,1]){c.fillStyle="#fff";c.beginPath();c.arc(s*r*0.3,-r*0.55,r*0.22,0,TAU);c.fill();
   c.fillStyle="#26203a";c.beginPath();c.arc(s*r*0.3+pex*r*0.1,-r*0.55,r*0.1,0,TAU);c.fill();}
 }
 c.restore();
}
function drawCostume(c,cost,r,o){
 // drawn around blob already at x,y; r = blob radius
 o=o||{};c.save();c.translate(o.x||0,o.y||0);
 const wob=o.wob||0;
 if(cost==="robot"){
  c.fillStyle="#c9a06a";c.strokeStyle="#8a6438";c.lineWidth=2;
  const bw=r*2.15,bh=r*1.5;
  c.fillRect(-bw/2,-r*0.2-bh/2+ r*0.3,bw,bh);c.strokeRect(-bw/2,-r*0.2-bh/2+r*0.3,bw,bh);
  c.fillStyle="#a87f4e";c.fillRect(-bw/2,-r*0.2-bh/2+r*0.3,bw,r*0.28);
  // buttons & dials
  c.fillStyle="#e74c3c";c.beginPath();c.arc(-r*0.5,r*0.35,r*0.14,0,TAU);c.fill();
  c.fillStyle="#7fe6b8";c.beginPath();c.arc(0,r*0.35,r*0.14,0,TAU);c.fill();
  c.fillStyle="#f5d54f";c.beginPath();c.arc(r*0.5,r*0.35,r*0.14,0,TAU);c.fill();
  // bendy straw antenna
  c.strokeStyle="#e75d8a";c.lineWidth=r*0.12;c.beginPath();c.moveTo(r*0.3,-r*1.15);
  c.quadraticCurveTo(r*0.7+Math.sin(wob)*r*0.2,-r*1.7,r*0.45,-r*2.0);c.stroke();
  c.fillStyle="#f5d54f";c.beginPath();c.arc(r*0.45,-r*2.05,r*0.16,0,TAU);c.fill();
  // flashlight in hand
  c.fillStyle="#8a93a8";c.fillRect(r*0.9,-r*0.1,r*0.5,r*0.32);
  c.fillStyle="#fff8c9";c.beginPath();c.arc(r*1.45,-r*0.06+r*0.1,r*0.16,0,TAU);c.fill();
 }else if(cost==="ghost"){
  c.fillStyle="rgba(245,245,255,.92)";
  c.beginPath();c.moveTo(-r*1.05,r*0.9);
  c.quadraticCurveTo(-r*1.15,-r*0.9,0,-r*1.25);c.quadraticCurveTo(r*1.15,-r*0.9,r*1.05,r*0.9);
  for(let i=0;i<4;i++){const xx=r*1.05-(i+0.5)*(r*2.1/4);c.quadraticCurveTo(xx-r*0.13,r*1.25,xx-r*0.26,r*0.9);}
  c.closePath();c.fill();
  c.fillStyle="rgba(200,200,230,.5)";c.beginPath();c.ellipse(-r*0.3,-r*0.5,r*0.3,r*0.15,-0.4,0,TAU);c.fill();
 }else if(cost==="pumpkin"){
  c.fillStyle="#ef7d2e";c.strokeStyle="#b85a17";c.lineWidth=2;
  c.beginPath();c.ellipse(0,0,r*1.25,r*1.05,0,0,TAU);c.fill();c.stroke();
  c.strokeStyle="rgba(150,70,10,.6)";for(const s of[-0.5,0,0.5]){c.beginPath();c.ellipse(s*r*0.6,0,r*0.5,r*1.0,0,0,TAU);c.stroke();}
  c.fillStyle="#5da24a";c.fillRect(-r*0.1,-r*1.55,r*0.2,r*0.6);
 }else if(cost==="skeleton"){
  c.strokeStyle="#f2f2f2";c.lineWidth=r*0.16;
  for(const s of[-1,1]){c.beginPath();c.moveTo(s*r*0.9,-r*0.4);c.lineTo(s*r*1.25,r*0.5);c.stroke();}
  c.fillStyle="#f2f2f2";c.beginPath();c.ellipse(0,r*0.1,r*0.5,r*0.62,0,0,TAU);c.fill();
  c.fillStyle="#333";for(let i=0;i<3;i++){c.beginPath();c.arc(0,-r*0.12+i*r*0.24,r*0.09,0,TAU);c.fill();}
 }else if(cost==="vampire"){
  c.fillStyle="#3a2a5c";c.beginPath();c.moveTo(-r*1.2,r*1.0);c.lineTo(-r*0.7,-r*0.5);c.lineTo(r*0.7,-r*0.5);c.lineTo(r*1.2,r*1.0);
  c.quadraticCurveTo(0,r*0.6,-r*1.2,r*1.0);c.fill();
  c.fillStyle="#8a2be2";c.beginPath();c.moveTo(-r*0.75,-r*0.55);c.lineTo(-r*0.45,-r*1.25);c.lineTo(-r*0.15,-r*0.55);c.fill();
  c.beginPath();c.moveTo(r*0.75,-r*0.55);c.lineTo(r*0.45,-r*1.25);c.lineTo(r*0.15,-r*0.55);c.fill();
 }else if(cost==="mummy"){
  c.strokeStyle="#e8dcc0";c.lineWidth=r*0.22;
  for(let i=0;i<4;i++){c.beginPath();c.moveTo(-r*1.0,-r*0.6+i*r*0.45);c.quadraticCurveTo(0,-r*0.75+i*r*0.45,r*1.0,-r*0.6+i*r*0.45);c.stroke();}
  c.strokeStyle="#d8c8a8";c.beginPath();c.moveTo(-r*0.8,-r*0.9);c.lineTo(-r*1.3,-r*1.3);c.stroke();
 }else if(cost==="witch"){
  c.fillStyle="#4a3670";c.beginPath();c.moveTo(-r*0.9,-r*0.75);c.lineTo(0,-r*2.0);c.lineTo(r*0.9,-r*0.75);c.closePath();c.fill();
  c.fillStyle="#f5d54f";c.fillRect(-r*0.55,-r*1.05,r*1.1,r*0.18);
  c.fillStyle="#4a3670";c.beginPath();c.ellipse(0,-r*0.72,r*1.05,r*0.22,0,0,TAU);c.fill();
  c.strokeStyle="#8a6438";c.lineWidth=r*0.14;c.beginPath();c.moveTo(r*1.0,r*0.6);c.lineTo(r*1.7,-r*0.2);c.stroke();
 }else if(cost==="dino"){
  c.fillStyle="#5da24a";c.beginPath();c.arc(0,-r*0.15,r*1.18,Math.PI*0.95,Math.PI*2.05);c.fill();
  c.fillStyle="#7cc46a";for(let i=0;i<4;i++){const a=Math.PI*1.15+i*0.28;
   c.beginPath();c.moveTo(Math.cos(a)*r*1.05,-r*0.15+Math.sin(a)*r*1.05);
   c.lineTo(Math.cos(a)*r*1.45,-r*0.15+Math.sin(a)*r*1.45- r*0.25);c.lineTo(Math.cos(a+0.14)*r*1.05,-r*0.15+Math.sin(a+0.14)*r*1.05);c.fill();}
 }
 c.restore();
}
function drawHat(c,hat,r){
 if(!hat)return;c.save();
 if(hat==="party"){c.fillStyle="#e75d8a";c.beginPath();c.moveTo(-r*0.5,-r*0.9);c.lineTo(0,-r*1.9);c.lineTo(r*0.5,-r*0.9);c.closePath();c.fill();
  c.fillStyle="#fff";for(let i=0;i<3;i++){c.beginPath();c.arc(-r*0.25+i*r*0.25,-r*1.25+i*0.01,r*0.09,0,TAU);c.fill();}}
 else if(hat==="antenna"){c.strokeStyle="#c9f27e";c.lineWidth=3;c.beginPath();c.moveTo(0,-r*0.9);c.quadraticCurveTo(r*0.3,-r*1.4,0,-r*1.7);c.stroke();
  c.fillStyle="#c9f27e";c.beginPath();c.arc(0,-r*1.75,r*0.14,0,TAU);c.fill();}
 else if(hat==="tophat"){c.fillStyle="#26203a";c.fillRect(-r*0.45,-r*1.8,r*0.9,r*0.9);c.fillRect(-r*0.7,-r*0.95,r*1.4,r*0.15);
  c.fillStyle="#e75d8a";c.fillRect(-r*0.45,-r*1.15,r*0.9,r*0.18);}
 c.restore();
}
/* --- aliens --- */
function drawAlien(c,a){
 const t=a.anim||0;
 if(a.type==="peeper"){
  const r=20+Math.sin(t*3)*2;
  c.save();c.translate(a.x,a.y+Math.sin(t*2)*5);
  const g=c.createRadialGradient(-6,-8,4,0,0,r*1.3);g.addColorStop(0,"#e8f5e8");g.addColorStop(1,"#9fd49f");
  c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
  c.strokeStyle="rgba(255,255,255,.5)";c.lineWidth=3;c.beginPath();c.arc(0,0,r*0.9,Math.PI*1.2,Math.PI*1.7);c.stroke();
  const ex=Math.cos(a.dir)*6,ey=Math.sin(a.dir)*6;
  c.fillStyle="#fff";c.beginPath();c.arc(ex,ey,r*0.55,0,TAU);c.fill();
  c.fillStyle=a.state==="chase"?"#e74c3c":"#2c7a2c";c.beginPath();c.arc(ex*1.3,ey*1.3,r*0.26,0,TAU);c.fill();
  c.fillStyle="#fff";c.beginPath();c.arc(ex*1.3-3,ey*1.3-3,r*0.08,0,TAU);c.fill();
  c.restore();
 }else if(a.type==="grabber"||a.type==="zorb"){
  const big=a.type==="zorb";
  c.save();c.translate(a.x,a.y);
  const wob=Math.sin(t*8)*(a.state==="chase"?4:2);
  c.rotate(Math.sin(t*4)*0.08);
  const r=big?30:22;
  const g=c.createRadialGradient(-r*0.3,-r*0.35,r*0.2,0,0,r*1.2);
  g.addColorStop(0,"#cfe8cf");g.addColorStop(0.6,"#8fc48f");g.addColorStop(1,"#5d9a5d");
  c.fillStyle=g;c.beginPath();c.ellipse(0,wob*0.3,r,r*1.05,0,0,TAU);c.fill();
  // chunky silver belt
  c.fillStyle="#b8c0cc";c.fillRect(-r*0.95,r*0.25,r*1.9,r*0.3);
  c.fillStyle="#7ee86a";c.fillRect(-r*0.95,r*0.3,r*1.9,r*0.08);
  // one big eye
  const ex=Math.cos(a.dir)*r*0.25,ey=Math.sin(a.dir)*r*0.25-r*0.25;
  c.fillStyle="#fff";c.beginPath();c.arc(ex,ey,r*0.42,0,TAU);c.fill();
  c.fillStyle=a.state==="chase"?"#e74c3c":"#3a6a3a";c.beginPath();c.arc(ex+Math.cos(a.dir)*5,ey+Math.sin(a.dir)*5,r*0.2,0,TAU);c.fill();
  // stubby legs waddle
  c.fillStyle="#6da86d";
  const lp=Math.sin(t*(a.state==="chase"?14:8))*r*0.35;
  c.beginPath();c.ellipse(-r*0.45+lp,r*1.0,r*0.28,r*0.4,0,0,TAU);c.fill();
  c.beginPath();c.ellipse(r*0.45-lp,r*1.0,r*0.28,r*0.4,0,0,TAU);c.fill();
  // butterfly net
  c.strokeStyle="#8a6438";c.lineWidth=5;c.beginPath();c.moveTo(r*0.8,0);c.lineTo(r*1.7,-r*0.9);c.stroke();
  c.strokeStyle="#d8f0d8";c.lineWidth=3;c.beginPath();c.ellipse(r*1.85,-r*1.1,r*0.5,r*0.38,0.5,0,TAU);c.stroke();
  if(big){ // hover scooter
   c.fillStyle="#9aa4b5";c.beginPath();c.ellipse(0,r*1.35,r*1.1,r*0.3,0,0,TAU);c.fill();
   c.fillStyle="rgba(126,232,106,.6)";c.beginPath();c.ellipse(0,r*1.55,r*0.8,r*0.18,0,0,TAU);c.fill();
   c.fillStyle="#f5d54f";c.beginPath();c.arc(0,-r*1.35,r*0.28,0,TAU);c.fill(); // captain badge
  }
  c.restore();
 }else if(a.type==="sniffer"){
  c.save();c.translate(a.x,a.y);c.rotate(a.dir);
  const r=22,wob=Math.sin(t*6)*2;
  const g=c.createRadialGradient(-6,-8,4,0,0,r*1.3);g.addColorStop(0,"#d8c9f0");g.addColorStop(1,"#8f7ab8");
  c.fillStyle=g;c.beginPath();c.ellipse(0,wob*0.3,r*1.15,r*0.95,0,0,TAU);c.fill();
  // giant nose
  c.fillStyle="#e8b8d0";c.beginPath();c.ellipse(r*0.75,wob*0.3,r*0.5,r*0.42,0,0,TAU);c.fill();
  c.fillStyle="#8a4a62";c.beginPath();c.arc(r*0.95,wob*0.3-3,4,0,TAU);c.fill();c.beginPath();c.arc(r*0.95,wob*0.3+7,4,0,TAU);c.fill();
  c.fillStyle="#fff";c.beginPath();c.arc(-r*0.3,-r*0.3,r*0.28,0,TAU);c.fill();
  c.fillStyle="#3a2a4a";c.beginPath();c.arc(-r*0.25,-r*0.3,r*0.13,0,TAU);c.fill();
  c.restore();
 }else if(a.type==="saucer"){
  c.save();c.translate(a.x,a.y+Math.sin(t*2.4)*6);
  const r=34;
  const g=c.createLinearGradient(0,-r,0,r);g.addColorStop(0,"#dfe6f2");g.addColorStop(0.5,"#9aa4b5");g.addColorStop(1,"#6a7484");
  c.fillStyle=g;c.beginPath();c.ellipse(0,0,r,r*0.42,0,0,TAU);c.fill();
  const dg=c.createRadialGradient(0,-r*0.5,2,0,-r*0.4,r*0.5);dg.addColorStop(0,"rgba(200,240,200,.95)");dg.addColorStop(1,"rgba(120,180,140,.85)");
  c.fillStyle=dg;c.beginPath();c.arc(0,-r*0.35,r*0.42,Math.PI,0);c.fill();
  c.fillStyle="#7ee86a";
  for(let i=0;i<5;i++){const xx=-r*0.7+i*r*0.35;c.beginPath();c.arc(xx,r*0.18,4+Math.sin(t*5+i)*1.5,0,TAU);c.fill();}
  c.restore();
 }else if(a.type==="guard"){
  c.save();c.translate(a.x,a.y);
  const r=24;
  const g=c.createRadialGradient(-7,-9,4,0,0,r*1.3);g.addColorStop(0,"#d5e8d5");g.addColorStop(1,"#6fa86f");
  c.fillStyle=g;c.beginPath();c.arc(0,Math.sin(t*3)*2,r,0,TAU);c.fill();
  c.fillStyle="#b8c0cc";c.fillRect(-r,-2,r*2,6);
  const ex=Math.cos(a.dir)*7,ey=Math.sin(a.dir)*7-4;
  c.fillStyle="#fff";c.beginPath();c.arc(ex,ey,r*0.4,0,TAU);c.fill();
  c.fillStyle="#2c5a2c";c.beginPath();c.arc(ex,ey,r*0.18,0,TAU);c.fill();
  c.restore();
 }else if(a.type==="queen"){
  c.save();c.translate(a.x,a.y);
  const r=64,wob=Math.sin(t*1.8)*4;
  const g=c.createRadialGradient(-r*0.3,-r*0.35,r*0.2,0,0,r*1.25);
  g.addColorStop(0,"#f0c8f0");g.addColorStop(0.55,"#c88fc8");g.addColorStop(1,"#8a5a9a");
  c.fillStyle=g;c.beginPath();c.ellipse(0,wob,r*1.15,r,0,0,TAU);c.fill();
  c.fillStyle="#f5d54f"; // crown
  c.beginPath();c.moveTo(-r*0.6,-r*0.85);c.lineTo(-r*0.6,-r*1.35);c.lineTo(-r*0.3,-r*1.0);c.lineTo(0,-r*1.45);c.lineTo(r*0.3,-r*1.0);c.lineTo(r*0.6,-r*1.35);c.lineTo(r*0.6,-r*0.85);c.closePath();c.fill();
  for(const s of[-1,1,0]){const ex=s*r*0.35+Math.cos(a.dir)*8,ey=-r*0.3+Math.sin(a.dir)*6;
   c.fillStyle="#fff";c.beginPath();c.arc(ex,ey,r*0.22,0,TAU);c.fill();
   c.fillStyle="#5a2a6a";c.beginPath();c.arc(ex,ey,r*0.1,0,TAU);c.fill();}
  c.restore();
 }
 // detection meter
 if(a.meter>0.02&&a.state!=="chase"){
  const w=44;c.save();c.translate(a.x,a.y-(a.type==="queen"?95:a.type==="saucer"?60:52));
  c.fillStyle="rgba(10,5,20,.75)";c.beginPath();c.arc(0,0,15,0,TAU);c.fill();
  c.font="bold 20px sans-serif";c.textAlign="center";c.textBaseline="middle";
  c.fillStyle=a.meter>0.6?"#ffb347":"#c9f27e";c.fillText("?",0,1);
  c.strokeStyle="#ffb347";c.lineWidth=4;c.beginPath();c.arc(0,0,15,-Math.PI/2,-Math.PI/2+a.meter*TAU);c.stroke();
  c.restore();
 }else if(a.state==="chase"){
  c.save();c.translate(a.x,a.y-(a.type==="queen"?95:a.type==="saucer"?60:56));
  c.font="bold 26px sans-serif";c.textAlign="center";
  c.fillStyle="#ff5a5a";c.strokeStyle="#000";c.lineWidth=4;c.strokeText("!",0,0);c.fillText("!",0,0);
  c.restore();
 }
}
/* --- props & tiles --- */
function drawProp(c,kind,x,y,t,flip,extra){
 c.save();c.translate(x,y);if(flip)c.scale(-1,1);
 if(kind==="leafpile"){
  c.fillStyle="#b06a2a";c.beginPath();c.ellipse(0,4,30,16,0,0,TAU);c.fill();
  c.fillStyle="#d8953f";for(let i=0;i<9;i++){const a=i/9*TAU;c.beginPath();c.ellipse(Math.cos(a)*18,Math.sin(a)*8+Math.sin(t*2+i)*2,9,6,a,0,TAU);c.fill();}
  c.fillStyle="#e74c3c";c.beginPath();c.ellipse(-8,-4,7,5,0.4,0,TAU);c.fill();
 }else if(kind==="bush"){
  c.fillStyle="#2f7a3a";c.beginPath();c.arc(0,-6,26,0,TAU);c.fill();
  c.fillStyle="#3f9a4a";c.beginPath();c.arc(-10,-14,14,0,TAU);c.fill();c.beginPath();c.arc(10,-12,12,0,TAU);c.fill();
 }else if(kind==="trashcan"){
  const g=c.createLinearGradient(-14,0,14,0);g.addColorStop(0,"#8a93a8");g.addColorStop(0.5,"#c3cbd8");g.addColorStop(1,"#6a7280");
  c.fillStyle=g;c.fillRect(-15,-34,30,40);c.fillStyle="#5a6270";c.fillRect(-17,-40,34,8);
  c.fillStyle="rgba(255,255,255,.35)";c.fillRect(-11,-32,5,36);
 }else if(kind==="box"){
  c.fillStyle="#c9a06a";c.strokeStyle="#8a6438";c.lineWidth=2;
  c.fillRect(-22,-30,44,36);c.strokeRect(-22,-30,44,36);
  c.beginPath();c.moveTo(0,-30);c.lineTo(0,6);c.stroke();c.beginPath();c.moveTo(-22,-12);c.lineTo(22,-12);c.stroke();
  c.fillStyle="#a87f4e";c.beginPath();c.moveTo(-22,-30);c.lineTo(-32,-42);c.lineTo(12,-42);c.lineTo(22,-30);c.closePath();c.fill();c.stroke();
 }else if(kind==="inflatable"){
  c.fillStyle="#e75d8a";c.beginPath();c.ellipse(0,-20,24,30,0,0,TAU);c.fill();
  c.fillStyle="#fff";c.beginPath();c.arc(-8,-30,7,0,TAU);c.arc(8,-30,7,0,TAU);c.fill();
  c.fillStyle="#26203a";c.beginPath();c.arc(-8,-30,3,0,TAU);c.arc(8,-30,3,0,TAU);c.fill();
  c.fillStyle="#f5d54f";c.beginPath();c.moveTo(-6,-12);c.lineTo(6,-12);c.lineTo(0,-2);c.closePath();c.fill();
 }else if(kind==="lamp"){
  c.fillStyle="#3a3f4a";c.fillRect(-4,-64,8,64);
  c.fillStyle="#ffb347";c.beginPath();c.arc(0,-70,12,0,TAU);c.fill();
  c.fillStyle="#fff3c9";c.beginPath();c.arc(0,-70,7,0,TAU);c.fill();
  if(!G||!reducedFlash()){const gl=c.createRadialGradient(0,-70,4,0,-70,60);gl.addColorStop(0,"rgba(255,190,90,.5)");gl.addColorStop(1,"rgba(255,190,90,0)");
   c.fillStyle=gl;c.beginPath();c.arc(0,-70,60,0,TAU);c.fill();}
 }else if(kind==="jar"){
  const wob=Math.sin(t*2.5)*0.04;
  c.save();c.rotate(wob);
  c.fillStyle="rgba(160,220,255,.28)";c.strokeStyle="rgba(200,240,255,.7)";c.lineWidth=3;
  c.beginPath();c.ellipse(0,-24,26,32,0,0,TAU);c.fill();c.stroke();
  c.fillStyle="#8a93a8";c.fillRect(-20,-62,40,10);
  c.fillStyle="rgba(255,255,255,.35)";c.fillRect(-18,-50,8,44);
  c.restore();
 }else if(kind==="candy"){
  c.fillStyle="#ff6a8a";c.beginPath();c.arc(0,0,8,0,TAU);c.fill();
  c.fillStyle="#fff";c.beginPath();c.moveTo(-8,0);c.lineTo(-14,-6);c.lineTo(-14,6);c.closePath();c.fill();
  c.beginPath();c.moveTo(8,0);c.lineTo(14,-6);c.lineTo(14,6);c.closePath();c.fill();
  c.fillStyle="rgba(255,255,255,.6)";c.beginPath();c.arc(-2,-2,3,0,TAU);c.fill();
 }else if(kind==="corn"){
  const bob=Math.sin(t*3)*3;
  c.save();c.translate(0,bob-6);
  const g=c.createLinearGradient(0,-14,0,14);g.addColorStop(0,"#ffb347");g.addColorStop(0.5,"#ff8c2e");g.addColorStop(1,"#fff3c9");
  c.fillStyle=g;c.beginPath();c.moveTo(0,-16);c.lineTo(11,10);c.lineTo(-11,10);c.closePath();c.fill();
  c.strokeStyle="#fff";c.lineWidth=2;c.stroke();
  if(!reducedFlash()){c.strokeStyle="rgba(255,215,94,.8)";c.lineWidth=2;c.beginPath();c.arc(0,-2,20+Math.sin(t*4)*3,0,TAU);c.stroke();}
  c.restore();
 }else if(kind==="tree"){
  c.fillStyle="#5a3a22";c.fillRect(-7,-20,14,26);
  c.fillStyle="#2f6a35";c.beginPath();c.arc(0,-38,26,0,TAU);c.fill();
  c.fillStyle="#3f8a48";c.beginPath();c.arc(-10,-46,14,0,TAU);c.fill();
  c.fillStyle="#ef7d2e";for(let i=0;i<5;i++){c.beginPath();c.arc(-14+i*7,-40+((i*37)%18),4,0,TAU);c.fill();}
 }else if(kind==="pumpkinD"){
  c.fillStyle="#ef7d2e";c.beginPath();c.ellipse(0,-8,18,14,0,0,TAU);c.fill();
  c.fillStyle="#5da24a";c.fillRect(-3,-28,6,10);
  c.fillStyle="#ffe9a0";c.beginPath();c.moveTo(-8,-10);c.lineTo(-4,-10);c.lineTo(-6,-4);c.closePath();c.fill();
  c.beginPath();c.moveTo(8,-10);c.lineTo(4,-10);c.lineTo(6,-4);c.closePath();c.fill();
 }else if(kind==="sheets"){
  c.strokeStyle="#6a5a8a";c.lineWidth=4;c.beginPath();c.moveTo(-34,-46);c.lineTo(34,-46);c.stroke();
  c.fillStyle="#4a3f6a";c.fillRect(-38,-52,6,52);c.fillRect(32,-52,6,52);
  c.fillStyle="rgba(240,240,250,.9)";
  for(const xx of[-18,4]){c.save();c.translate(xx,-46);c.rotate(Math.sin(t*1.5+xx)*0.06);
   c.fillRect(-11,0,22,34);c.fillStyle="rgba(200,200,220,.9)";c.fillRect(-11,30,22,4);c.restore();c.fillStyle="rgba(240,240,250,.9)";}
 }else if(kind==="lawnskel"){
  c.strokeStyle="#e8e8e8";c.lineWidth=5;c.beginPath();c.arc(0,-34,10,0,TAU);c.stroke();
  c.beginPath();c.moveTo(0,-24);c.lineTo(0,-2);c.moveTo(-14,-14);c.lineTo(14,-14);c.moveTo(0,-2);c.lineTo(-10,8);c.moveTo(0,-2);c.lineTo(10,8);c.stroke();
  c.fillStyle="#26203a";c.beginPath();c.arc(-3,-36,2.5,0,TAU);c.arc(3,-36,2.5,0,TAU);c.fill();
 }else if(kind==="cauldron"){
  c.fillStyle="#2c2c38";c.beginPath();c.ellipse(0,-12,22,18,0,0,TAU);c.fill();
  c.fillStyle="#7ee86a";c.beginPath();c.ellipse(0,-24,17,7,0,0,TAU);c.fill();
  if(!reducedFlash()){c.fillStyle="rgba(126,232,106,.4)";c.beginPath();c.arc((Math.sin(t*3)*8),-34,5,0,TAU);c.fill();}
  c.fillStyle="#5a3a22";c.fillRect(-4,2,8,8);
 }else if(kind==="junk"){
  c.fillStyle="#8a93a8";c.fillRect(-20,-22,40,22);c.fillStyle="#6a7280";c.fillRect(-14,-34,22,14);
  c.strokeStyle="#e75d8a";c.lineWidth=4;c.beginPath();c.moveTo(6,-34);c.quadraticCurveTo(16,-44,10,-52);c.stroke();
 }else if(kind==="dino"){
  c.fillStyle="#cfc4ae";c.beginPath();c.ellipse(0,-16,20,12,0,0,TAU);c.fill();
  c.beginPath();c.arc(16,-30,9,0,TAU);c.fill();c.fillRect(-4,-8,8,8);
 }else if(kind==="sarc"){
  c.fillStyle="#c9a86a";c.strokeStyle="#8a6a38";c.lineWidth=2;
  c.beginPath();c.ellipse(0,-24,16,28,0,0,TAU);c.fill();c.stroke();
  c.fillStyle="#8a6a38";c.beginPath();c.arc(0,-44,6,0,TAU);c.fill();
 }else if(kind==="coffin"){
  c.fillStyle="#4a3a5c";c.strokeStyle="#2c2238";c.lineWidth=2;
  c.beginPath();c.moveTo(-14,-52);c.lineTo(14,-52);c.lineTo(20,-6);c.lineTo(-20,-6);c.closePath();c.fill();c.stroke();
  c.fillStyle="#8a2be2";c.fillRect(-3,-48,6,38);
 }else if(kind==="appletub"){
  c.fillStyle="#7a4a2a";c.beginPath();c.ellipse(0,-8,26,14,0,0,TAU);c.fill();
  c.fillStyle="#4a8ac9";c.beginPath();c.ellipse(0,-14,22,10,0,0,TAU);c.fill();
  c.fillStyle="#e74c3c";for(let i=0;i<4;i++){c.beginPath();c.arc(-13+i*9,-14+Math.sin(t*2+i)*2,6,0,TAU);c.fill();}
 }else if(kind==="candymtn"){
  const cols=["#ff6a8a","#ffb347","#7ee86a","#6fa8f5","#c9a7ff"];
  for(let i=0;i<26;i++){const a=(i/26)*TAU,r2=8+((i*53)%26);
   c.fillStyle=cols[i%5];c.beginPath();c.arc(Math.cos(a)*r2,-10-Math.abs(Math.sin(a*2))*22-((i*29)%14),7,0,TAU);c.fill();}
 }else if(kind==="beamctl"){
  c.fillStyle="#3a4a5c";c.fillRect(-24,-50,48,50);
  c.fillStyle="#7ee86a";c.beginPath();c.arc(-10,-30,7,0,TAU);c.fill();
  c.fillStyle="#e74c3c";c.beginPath();c.arc(10,-30,7,0,TAU);c.fill();
  c.strokeStyle="#c3cbd8";c.lineWidth=6;c.beginPath();c.moveTo(0,-18);c.lineTo(14,-34);c.stroke();
  c.fillStyle="#e74c3c";c.beginPath();c.arc(14,-36,8,0,TAU);c.fill();
 }else if(kind==="switch"){
  c.fillStyle="#3a4a5c";c.fillRect(-12,-34,24,34);
  c.fillStyle=(extra&&extra.on)?"#7ee86a":"#e74c3c";c.beginPath();c.arc(0,-17,9,0,TAU);c.fill();
 }else if(kind==="carousel"){
  c.fillStyle="#c9a86a";c.fillRect(-6,-70,12,70);
  c.fillStyle="#e75d8a";c.beginPath();c.moveTo(0,-108);c.lineTo(44,-70);c.lineTo(-44,-70);c.closePath();c.fill();
  c.fillStyle="#f5d54f";c.beginPath();c.arc(0,-112,6,0,TAU);c.fill();
  for(let i=0;i<4;i++){const a2=t*0.5+i*Math.PI/2;c.fillStyle=i%2?"#6fa8f5":"#ffb347";
   c.beginPath();c.arc(Math.cos(a2)*30,-40,8,0,TAU);c.fill();}
 }else if(kind==="wagon"){
  c.fillStyle="#8a5a2a";c.fillRect(-34,-26,68,20);
  c.fillStyle="#d8b86a";for(let i=0;i<8;i++){c.beginPath();c.ellipse(-28+i*8,-30,7,10,0.2*(i%2?1:-1),0,TAU);c.fill();}
  c.fillStyle="#3a2a1a";c.beginPath();c.arc(-22,0,9,0,TAU);c.arc(22,0,9,0,TAU);c.fill();
 }else if(kind==="lilypad"){
  c.fillStyle="#3f9a4a";c.beginPath();c.ellipse(0,0,34,24,0,0.3,TAU-0.3);c.lineTo(0,0);c.fill();
  c.fillStyle="#5fc46a";c.beginPath();c.arc(-8,-4,5,0,TAU);c.fill();
  c.fillStyle="#e88ab8";c.beginPath();c.arc(14,-8,7,0,TAU);c.fill();
 }else if(kind==="porch"){
  c.fillStyle="rgba(120,80,40,.35)";c.fillRect(-40,-8,80,40);
  c.strokeStyle="#8a5a2a";c.lineWidth=3;c.strokeRect(-40,-8,80,40);
 }
 c.restore();
}
function reducedFlash(){return prof()&&prof().settings.reduced;}
function drawTile(c,ch,px,py,pal){
 const s=TILE;
 if(ch==="#"||ch==="T"||ch==="^"||ch==="V"){
  // base ground under solids
  c.fillStyle=pal.g1;c.fillRect(px,py,s,s);
 }
 if(ch==="#" ){ // house wall
  c.fillStyle="#4a3560";c.fillRect(px,py,s,s);
  c.fillStyle="#5d4577";c.fillRect(px,py,s,10);
  c.fillStyle="rgba(0,0,0,.25)";c.fillRect(px,py+s-8,s,8);
  c.fillStyle="#3a2a50";for(let i=0;i<3;i++)c.fillRect(px+6+i*14,py+14,8,20);
 }else if(ch==="^"){ // corn / hedge
  c.fillStyle="#3f7a2e";c.fillRect(px,py,s,s);
  c.fillStyle="#4f9a3a";for(let i=0;i<6;i++){const xx=px+4+(i*37)%40,yy=py+4+(i*53)%40;
   c.fillRect(xx,yy,5,14);c.beginPath();c.moveTo(xx+2,yy);c.lineTo(xx-3,yy-8);c.lineTo(xx+7,yy-8);c.closePath();c.fill();}
 }else if(ch==="T"){ /* tree drawn as prop separately */ }
 else if(ch==="~"){
  c.fillStyle="#1e4a6a";c.fillRect(px,py,s,s);
  c.strokeStyle="rgba(120,200,255,.3)";c.lineWidth=2;
  const tt=performance.now()/1000;
  for(let i=0;i<2;i++){c.beginPath();c.moveTo(px+6,py+14+i*16+Math.sin(tt*2+px)*3);
   c.quadraticCurveTo(px+24,py+10+i*16,px+42,py+14+i*16+Math.cos(tt*2+py)*3);c.stroke();}
 }else if(ch==="V"){ c.fillStyle=pal.g1;c.fillRect(px,py,s,s); }
 else{
  c.fillStyle=((px/s+py/s)%2===0)?pal.g1:pal.g2;c.fillRect(px,py,s,s);
  if(ch==="l"){ c.fillStyle="rgba(180,120,50,.5)";for(let i=0;i<5;i++)c.fillRect(px+4+(i*31)%40,py+4+(i*47)%40,6,4); }
  if(ch==="."&&((px*7+py*13)%97<8)){c.fillStyle="rgba(0,0,0,.12)";c.fillRect(px+10,py+30,8,3);}
 }
}
/* ---------- canvas & global state ---------- */
const cv=$("cv"),ctx=cv.getContext("2d");
let VW=0,VH=0,DPR=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);
 VW=window.innerWidth;VH=window.innerHeight;
 cv.width=Math.floor(VW*DPR);cv.height=Math.floor(VH*DPR);
 checkPortrait();}
window.addEventListener("resize",resize);
const G={screen:"title",lvl:0,returnTo:"map"};
function show(id){document.querySelectorAll(".scr").forEach(s=>s.classList.remove("on"));
 if(id)$(id).classList.add("on");G.screen=id;
 if(id==="s-map")renderMap();
 checkPortrait();}
let toastT=null;
function toast(msg,ms){const t=$("toast");t.innerHTML=msg;t.style.display="block";
 if(toastT)clearTimeout(toastT);toastT=setTimeout(()=>t.style.display="none",ms||2200);}
function checkPortrait(){const por=VH>VW&&VW<940;$("s-portrait").classList.toggle("on",por);}

/* ---------- input ---------- */
const IN={keys:{},joy:{on:false,id:null,ox:0,oy:0,dx:0,dy:0},
 actPress:false,actHeld:false,powPress:false,
 aim:{on:false,id:null,sx:0,sy:0,dx:0,dy:0},
 mouseThrow:null};
window.addEventListener("keydown",e=>{
 if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
 IN.keys[e.key.toLowerCase()]=true;
 if(e.key.toLowerCase()==="e"&&!e.repeat)IN.actPress=true;
 if(e.key.toLowerCase()==="q"&&!e.repeat)IN.powPress=true;
});
window.addEventListener("keyup",e=>{IN.keys[e.key.toLowerCase()]=false;});
function joySideLeft(){return prof().settings.joySide!=="right";}
function canvasTouch(e){
 for(const t of e.changedTouches){
  if(t.target!==cv)continue;
  const leftHalf=t.clientX<VW/2, useLeft=joySideLeft()?leftHalf:!leftHalf;
  if(e.type==="touchstart"&&useLeft&&!IN.joy.on){
   IN.joy.on=true;IN.joy.id=t.identifier;IN.joy.ox=t.clientX;IN.joy.oy=t.clientY;IN.joy.dx=0;IN.joy.dy=0;
  }else if((e.type==="touchmove")&&IN.joy.on&&t.identifier===IN.joy.id){
   let dx=t.clientX-IN.joy.ox,dy=t.clientY-IN.joy.oy;
   const m=Math.hypot(dx,dy),max=70;
   if(m>max){dx=dx/m*max;dy=dy/m*max;}
   IN.joy.dx=dx/max;IN.joy.dy=dy/max;
  }else if((e.type==="touchend"||e.type==="touchcancel")&&IN.joy.on&&t.identifier===IN.joy.id){
   IN.joy.on=false;IN.joy.dx=0;IN.joy.dy=0;
  }
 }
 if(e.cancelable&&e.target===cv)e.preventDefault();
}
cv.addEventListener("touchstart",canvasTouch,{passive:false});
cv.addEventListener("touchmove",canvasTouch,{passive:false});
cv.addEventListener("touchend",canvasTouch,{passive:false});
cv.addEventListener("touchcancel",canvasTouch,{passive:false});
// mouse: click to throw (testing), WASD via keys
cv.addEventListener("mousedown",e=>{if(G.screen==="s-play"||G.screen==="play")IN.mouseThrow={x:e.clientX,y:e.clientY};});
function bindBtn(id,down,up){
 const b=$(id);
 b.addEventListener("touchstart",e=>{e.preventDefault();down();},{passive:false});
 b.addEventListener("touchend",e=>{e.preventDefault();if(up)up();},{passive:false});
 b.addEventListener("mousedown",e=>{e.preventDefault();down();});
 b.addEventListener("mouseup",()=>{if(up)up();});
}
bindBtn("btn-act",()=>{IN.actPress=true;IN.actHeld=true;},()=>{IN.actHeld=false;});
bindBtn("btn-pow",()=>{IN.powPress=true;});
// THROW: press & drag to aim, release to throw
(function(){
 const b=$("btn-throw");let sx=0,sy=0;
 b.addEventListener("touchstart",e=>{e.preventDefault();const t=e.changedTouches[0];
  IN.aim.on=true;IN.aim.id=t.identifier;IN.aim.sx=t.clientX;IN.aim.sy=t.clientY;IN.aim.dx=0;IN.aim.dy=0;},{passive:false});
 b.addEventListener("touchmove",e=>{e.preventDefault();
  for(const t of e.changedTouches)if(t.identifier===IN.aim.id){IN.aim.dx=t.clientX-IN.aim.sx;IN.aim.dy=t.clientY-IN.aim.sy;}},{passive:false});
 const rel=e=>{if(IN.aim.on){IN.aim.on=false;IN.aim.released=true;}};
 b.addEventListener("touchend",rel);b.addEventListener("touchcancel",rel);
 b.addEventListener("mousedown",e=>{IN.aim.on=true;IN.aim.id="m";IN.aim.sx=e.clientX;IN.aim.sy=e.clientY;IN.aim.dx=0;IN.aim.dy=0;});
 window.addEventListener("mousemove",e=>{if(IN.aim.on&&IN.aim.id==="m"){IN.aim.dx=e.clientX-IN.aim.sx;IN.aim.dy=e.clientY-IN.aim.sy;}});
 window.addEventListener("mouseup",()=>{if(IN.aim.on&&IN.aim.id==="m"){IN.aim.on=false;IN.aim.released=true;}});
})();
function moveInput(){ // returns {x,y,mag,run}
 let x=0,y=0;
 if(IN.joy.on){x=IN.joy.dx;y=IN.joy.dy;}
 const k=IN.keys;
 if(k["a"]||k["arrowleft"])x-=1; if(k["d"]||k["arrowright"])x+=1;
 if(k["w"]||k["arrowup"])y-=1; if(k["s"]||k["arrowdown"])y+=1;
 let mag=Math.hypot(x,y);
 if(mag>1){x/=mag;y/=mag;mag=1;}
 const run=(k["shift"])||mag>0.85;
 return{x,y,mag,run};
}

/* ---------- UI screens ---------- */
$("btn-play").addEventListener("click",()=>{AU.init();AU.resume();AU.sfx.click();show("s-prof");renderProfiles();});
$("btn-how0").addEventListener("click",()=>{AU.sfx.click();G.returnTo="title";show("s-how");renderHow();});
$("btn-set0").addEventListener("click",()=>{AU.sfx.click();G.returnTo="title";show("s-set");renderSettings();});
$("btn-howback").addEventListener("click",()=>{AU.sfx.click();show(G.returnTo==="title"?"s-title":"s-map");});
$("btn-setback").addEventListener("click",()=>{AU.sfx.click();AU.applyVol();storeSave();show(G.returnTo==="title"?"s-title":"s-map");});
$("btn-profback").addEventListener("click",()=>{AU.sfx.click();show("s-title");});
$("btn-profgo").addEventListener("click",()=>{AU.sfx.click();storeSave();show("s-map");});
function renderProfiles(){
 const list=$("prof-list");list.innerHTML="";
 SAVE.profiles.forEach((p,i)=>{
  const d=el("div","profslot"+(SAVE.sel===i?" sel":""));
  if(p.name){d.innerHTML=`<div class="pname"></div><div class="pinfo">${p.unlocked>1?"Level "+p.unlocked:"New"} · ${p.candy} candy</div>`;
   d.querySelector(".pname").textContent=p.name;
   d.addEventListener("dblclick",()=>{const inp=document.createElement("input");inp.value=p.name;
    inp.addEventListener("click",e=>e.stopPropagation());
    inp.addEventListener("change",()=>{p.name=inp.value.trim()||("Player "+(i+1));storeSave();renderProfiles();});
    d.querySelector(".pname").innerHTML="";d.querySelector(".pname").appendChild(inp);inp.focus();});
  }else{d.innerHTML=`<div class="pname" style="color:#8f7fb8">+ New profile</div>`;
   d.addEventListener("dblclick",()=>{p.name="Player "+(i+1);storeSave();renderProfiles();});}
  d.addEventListener("click",()=>{if(!p.name){p.name="Player "+(i+1);storeSave();renderProfiles();}
   SAVE.sel=i;storeSave();AU.sfx.click();renderProfiles();});
  list.appendChild(d);
 });
}
/* town map */
const MAP_POS=[[8,72],[20,58],[33,66],[46,52],[58,62],[70,48],[80,60],[88,44],[66,28],[44,20]];
function renderMap(){
 const w=$("mapwrap");w.innerHTML="";
 const pr=prof();
 $("mapcandy").textContent=pr.candy+" candy";
 // path
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 svg.setAttribute("style","position:absolute;inset:0;width:100%;height:100%");
 let dstr="";
 MAP_POS.forEach((p,i)=>{dstr+=(i?"L":"M")+p[0]+" "+p[1]+" ";});
 const path=document.createElementNS("http://www.w3.org/2000/svg","path");
 path.setAttribute("d",dstr);path.setAttribute("fill","none");path.setAttribute("stroke","#7b4fc9");
 path.setAttribute("stroke-width","4");path.setAttribute("stroke-dasharray","8 6");path.setAttribute("vector-effect","non-scaling-stroke");
 svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("preserveAspectRatio","none");
 svg.appendChild(path);w.appendChild(svg);
 LEVELS.forEach((L,i)=>{
  const locked=i+1>pr.unlocked;
  const n=el("div","mapnode"+(locked?" locked":"")+(i+1===pr.unlocked?" cur":""));
  n.style.left=MAP_POS[i][0]+"%";n.style.top=MAP_POS[i][1]+"%";
  const st=pr.stars[i+1]||0;
  n.innerHTML=`<div>${locked?"?":(i+1)}</div><div class="stars">${"★".repeat(st)}${"☆".repeat(3-st)}</div><div class="nlbl">${L.name}</div>`;
  if(!locked)n.addEventListener("click",()=>{AU.sfx.click();openStory(i);});
  w.appendChild(n);
 });
 $("btn-mapshop").onclick=()=>{AU.sfx.click();openShop("s-map");};
 $("btn-mapbook").onclick=()=>{AU.sfx.click();openBook();};
 $("btn-mapachv").onclick=()=>{AU.sfx.click();openAchv();};
 $("btn-mapset").onclick=()=>{AU.sfx.click();G.returnTo="map";show("s-set");renderSettings();};
 $("btn-mapprof").onclick=()=>{AU.sfx.click();show("s-prof");renderProfiles();};
}
/* story */
let storyTimer=null,storyHoldT=null;
function openStory(i){
 G.lvl=i;const L=LEVELS[i],pr=prof();
 $("story-img").src="assets/story-l"+(i+1)+".png";
 $("story-img").onerror=function(){this.onerror=null;this.src="assets/title-art.png";};
 $("story-title").textContent=L.name+" — "+L.sub;
 $("story-hint").textContent="Tip: "+L.hint;
 const full=L.story;
 const txt=$("story-txt");txt.textContent="";
 let ci=0;AU.setMode("title");
 if(storyTimer)clearInterval(storyTimer);
 storyTimer=setInterval(()=>{ci++;txt.textContent=full.slice(0,ci);
  if(ci%3===0)AU.sfx.blip();AU.duck();
  if(ci>=full.length)clearInterval(storyTimer);},28);
 $("btn-storygo").onclick=()=>{if(storyTimer)clearInterval(storyTimer);AU.sfx.click();beginLevel(i);};
 const fr=$("s-story");
 const hs=e=>{e.preventDefault();storyHoldT=setTimeout(()=>{if(storyTimer)clearInterval(storyTimer);beginLevel(i);},900);};
 const he=()=>{if(storyHoldT)clearTimeout(storyHoldT);};
 fr.ontouchstart=hs;fr.ontouchend=he;fr.onmousedown=hs;fr.onmouseup=he;
 show("s-story");
}
/* how to */
function renderHow(){
 $("how-body").innerHTML=`
 <p><b>Move:</b> touch the left side of the screen — a joystick appears. Push a little to <b>sneak</b> (quiet), push far to <b>run</b> (fast but noisy!).</p>
 <p><b>Hide:</b> tap <b>HIDE</b> near leaf piles, bushes, trash cans, boxes, decorations or porches. Aliens can't see you while hidden.</p>
 <p><b>Blend in:</b> stand still next to decorations that match your costume (pumpkin + jack-o'-lanterns, ghost + sheets...). You'll shimmer when it works!</p>
 <p><b>Throw candy:</b> hold <b>THROW</b>, drag to aim, let go. Aliens LOVE candy and will waddle over to eat it.</p>
 <p><b>Rescue:</b> sneak to a glowing Jelly Jar and <b>hold HIDE</b> for 2 seconds to pop it.</p>
 <p><b>Costume power:</b> tap <b>POWER</b>. Each rescued friend shares their costume power!</p>
 <p><b>Caught?</b> No worries — you beam back to the last lamp post and drop half your candy (it's still there to pick up!). No game over.</p>
 <p><b>Goal:</b> rescue every friend, grab the 3 Golden Candy Corns, then escape when the big saucer comes!</p>
 <p><b>Keyboard:</b> WASD/arrows + Shift to run, E = action, Q = power, click = throw.</p>`;
}
/* settings */
function renderSettings(){
 const s=prof().settings,b=$("set-body");b.innerHTML="";
 const row=(label,ctrl)=>{const d=el("div","setrow");d.innerHTML=`<span>${label}</span>`;d.appendChild(ctrl);b.appendChild(d);};
 const mkRange=(v,cb)=>{const r=document.createElement("input");r.type="range";r.min=0;r.max=100;r.value=Math.round(v*100);
  r.addEventListener("input",()=>cb(r.value/100));return r;};
 row("Music volume",mkRange(s.music,v=>{s.music=v;AU.applyVol();}));
 row("Sound volume",mkRange(s.sfx,v=>{s.sfx=v;AU.applyVol();AU.sfx.click();}));
 const js=document.createElement("select");js.innerHTML=`<option value="left">Left</option><option value="right">Right</option>`;js.value=s.joySide;
 js.addEventListener("change",()=>{s.joySide=js.value;storeSave();});row("Joystick side",js);
 const rf=document.createElement("div");rf.className="switch"+(s.reduced?" on":"");
 rf.addEventListener("click",()=>{s.reduced=!s.reduced;rf.classList.toggle("on",s.reduced);storeSave();});row("Reduced flashing",rf);
 const em=document.createElement("div");em.className="switch"+(s.easy?" on":"");
 em.addEventListener("click",()=>{s.easy=!s.easy;em.classList.toggle("on",s.easy);storeSave();});row("Easy mode (slower aliens)",em);
}
/* ---------- game data: friends, aliens, costumes, shop, achievements ---------- */
const FRIENDS={
 marlow:{name:"Marlow",costume:"ghost",color:"purple",desc:"Shy purple blob in a bedsheet ghost costume. Whispers everything."},
 june:{name:"June",costume:"pumpkin",color:"orange",desc:"Bouncy orange blob in a round pumpkin costume. Very loud."},
 beans:{name:"Beans",costume:"skeleton",color:"lime",desc:"Lime-green blob in a skeleton onesie. Loves jokes."},
 violet:{name:"Violet",costume:"vampire",color:"pink",desc:"Dramatic pink blob vampire with a tall collar and cape."},
 tuck:{name:"Tuck",costume:"mummy",color:"tan",desc:"Slow, sweet tan blob wrapped as a mummy."},
 hazel:{name:"Hazel",costume:"witch",color:"teal",desc:"Bossy-but-kind teal blob witch with a little broom."},
 rocco:{name:"Rocco",costume:"dino",color:"blue",desc:"Strong, goofy blue blob in a dinosaur hoodie."}};
const NEIGHBORS=["Pebbles","Mochi","Waffles","Pickle","Noodle","Taffy","Boba","Sprout"];
const ALIENS={
 peeper:{name:"Peeper Drone",tip:"A floating eye with a long, narrow vision cone. Sidestep the beam!"},
 grabber:{name:"Grabber",tip:"Waddles with a butterfly net. Short, wide vision — and it CHASES!"},
 sniffer:{name:"Sniffer",tip:"Blind as a bat, but it follows your footprints when you RUN. Sneak!"},
 saucer:{name:"Searchlight Saucer",tip:"Its beam circle sweeps the ground. Dash between sweeps!"},
 guard:{name:"Jar Guard",tip:"Spins slowly beside Jelly Jars. Strike when its back is turned!"},
 zorb:{name:"Captain Zorb",tip:"Mini-boss! Two vision cones and a fast hover scooter. Toss candy!"},
 queen:{name:"Queen Glorpa",tip:"The huge jelly queen. She can't be hurt — distract her with candy!"}};
const COSTUMES={
 robot:{name:"Robot",power:"Flashlight Freeze",pdesc:"Freeze small drones 6s.",cd:10,camo:"Q"},
 ghost:{name:"Ghost",power:"Float",pdesc:"Float 3s over walls & gaps.",cd:12,camo:"W"},
 pumpkin:{name:"Pumpkin",power:"Roll",pdesc:"Fast roll burst.",cd:9,camo:"Y"},
 skeleton:{name:"Skeleton",power:"Bone Rattle",pdesc:"Noise lure where you aim.",cd:8,camo:"K"},
 vampire:{name:"Vampire",power:"Bat Glide",pdesc:"Glide a short distance.",cd:10,camo:"F"},
 mummy:{name:"Mummy",power:"Bandage Grab",pdesc:"Grab far candy & switches.",cd:8,camo:"M"},
 witch:{name:"Witch",power:"Broom Dash",pdesc:"Super-fast dash, dodges beams.",cd:9,camo:"U"},
 dino:{name:"Dinosaur",power:"Stomp",pdesc:"Dizzy nearby aliens 4s.",cd:12,camo:"Z"}};
const THROWS={
 corn:{name:"Candy Corn",cost:0,desc:"Classic toss. Distracts 1 alien for 3s.",dur:3,range:7},
 lolly:{name:"Lollipop",cost:150,desc:"Extra tasty. Distracts for 6s.",dur:6,range:7},
 jaw:{name:"Giant Jawbreaker",cost:300,desc:"Rolls far, distracts up to 3 aliens for 5s.",dur:5,range:11,multi:3},
 whoop:{name:"Whoopee Cushion",cost:200,desc:"LOUD! Lures every alien nearby.",dur:4,range:7,loud:1},
 glow:{name:"Glow Stick",cost:250,desc:"Hypnotic. Holds 1 alien for 8s.",dur:8,range:8},
 balloon:{name:"Blob Balloon",cost:350,desc:"Decoy balloon aliens chase for 6s.",dur:6,range:8,decoy:1}};
const HATS=[{id:"party",name:"Party Hat",cost:150},{id:"antenna",name:"Alien Antenna",cost:150},{id:"tophat",name:"Fancy Top Hat",cost:200}];
const BCOLORS=[{id:"mint",name:"Mint",cost:0},{id:"purple",name:"Grape",cost:100},{id:"orange",name:"Tangerine",cost:100},{id:"pink",name:"Bubblegum",cost:100},{id:"blue",name:"Blueberry",cost:100},{id:"teal",name:"Teal",cost:100}];
const TRAILS=[{id:"sparkle",name:"Sparkle Trail",cost:120},{id:"leaves",name:"Leaf Trail",cost:120},{id:"bubbles",name:"Bubble Trail",cost:120}];
const ACHVS=[
 {id:"hide50",name:"Leaf Pile Legend",desc:"Hide 50 times.",check:(s,p)=>s.hides>=50},
 {id:"sugar",name:"Sugar Rush",desc:"Distract 3 aliens with one candy.",check:(s,p)=>!!s.sugarRush},
 {id:"ghosted",name:"Ghosted",desc:"Finish a level without ever being spotted.",check:(s,p)=>s.ghosted>0},
 {id:"moon",name:"Full Moon",desc:"Earn all 30 stars.",check:(s,p)=>totalStars(p)>=30},
 {id:"hoard",name:"Candy Hoarder",desc:"Hold 200 candy at once.",check:(s,p)=>s.maxCandy>=200},
 {id:"jars",name:"Jar Breaker",desc:"Rescue 10 friends.",check:(s,p)=>s.rescues>=10},
 {id:"late",name:"Fashionably Late",desc:"Finish a level after the clock runs out.",check:(s,p)=>s.late>0},
 {id:"powers",name:"Power Player",desc:"Use all 8 costume powers.",check:(s,p)=>Object.keys(s.powers||{}).length>=8}];
function totalStars(p){let n=0;for(let i=1;i<=10;i++)n+=(p.stars[i]||0);return n;}

/* ---------- levels (hand-designed ASCII maps) ----------
 # house wall | ^ tall corn/hedge | T tree | ~ water | . path , grass : wood ; factory " dirt ' mud
 l crunchy leaves | L leaf pile B bush C trash can X box D inflatable O porch (hide)
 Y pumpkin W sheets K skeleton U cauldron Q junk Z dino M sarcophagus F coffin (camo)
 P start E exit J jar * candy G golden corn 1 2 3 checkpoints
 a peeper b grabber c sniffer d saucer e guard f zorb q queen
 A apple tub ! candy mountain & beam controls S switch g crowd V carousel H haybale n lilypad */
const LEVELS=[
{name:"Pumpkin Patch Lane",sub:"7:00 PM",clockMin:30,
 story:"The Zorblings have come for the cutest creatures in the galaxy — blob kids in Halloween costumes! You are PIP, a mint-green blob in a cardboard robot costume. You missed the first beam because you were hiding in a leaf pile. Sneak down the lane, free your friends from the Jelly Jars, and grab candy. Lots of candy.",
 hint:"Push the joystick a LITTLE to sneak quietly. Tap HIDE near leaf piles and bushes!",
 friends:["marlow"],neighborJars:1,unlock:"ghost",newAlien:"peeper",
 pal:{g1:"#2a4a2e",g2:"#243d28"},
 flags:{},
 map:[
"########################################",
"#......#........#........#.............#",
"#..Y...#...Y....#...Y....#..Y......Y...#",
"#......#........#........#.............#",
"#..P...D...l....D........D.............#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,l,,,,,,,,,,,,,,,,,,,,,,,,,,,,l,,,,,#",
"#,,,,,,,,,,a,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,B,,,,,,,,,,,,,,,,,B,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,1,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,l,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,l,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,L,,,,,,,,,,,L,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,a,,,,,,,,,#",
"#,2,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,G,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,B,,,,,,,,,,,,,,B,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,l,,,,,,,,,,J,,,,,,,,,,,,,,,,,,J,,l,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,,,*,,,,,,*,,,,,,*,,,,,,*,,,,,,,#",
"#..G...,,,,,,,,,,,,,,,,,,,,,,,,...E..G#",
"########################################"]},
{name:"Cornfield Maze",sub:"7:30 PM",clockMin:30,
 story:"June is trapped somewhere in the cornfield maze, and Searchlight Saucers sweep between the stalks. Stay out of the sweeping beam circles, and roll with it!",
 hint:"Saucer beams sweep on a timer. Watch the pattern, then move!",
 friends:["june"],neighborJars:1,unlock:"pumpkin",newAlien:"saucer",
 pal:{g1:"#3a5a2a",g2:"#334f24"},
 flags:{},
 map:[
"^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
"^P..l....^^^^....,,,,....^^^^....G...^^",
"^,,......^^^^....,,,,....^^^^........^^",
"^,,..B...^^^^....,,,,....^^^^...,,,..^^",
"^^,,......^^.....d,,,,.....^^.....,,^^^",
"^,,,,,....^^.....,,,,.....^^..,,,,,,^^^",
"^,,l,,....^^^^^^^,,,,^^^^^^^..,,l,,,^^^",
"^,,,,,....^^^^^^^,,,,^^^^^^^..,,,,,^^^",
"^^,,......,,,,,,,,,,,,,,,,......,,^^^^^",
"^,,,,,.1.,,,,,,^^^^^^,,,,,,.2.,,,,,,^^^",
"^,,l,,....,,,,,^^^^^^,,,,,....,,l,,^^^",
"^,,,,,....,,,,,^^^^^^,,,,,....,,,,,^^^",
"^^,,......,,,,,,,,,,,,,,,,......,,^^^^^",
"^,,,,,....^^^^^^,,,,,,^^^^^^....,,,,,^^",
"^,,B,,....^^^^^^,,J,,,^^^^^^....,,B,,^^",
"^,,,,,....^^^^^^,,,,,,^^^^^^....,,,,,^^",
"^^,,,,,,,,,,,,,,G,,,,,,,,,,,,,,,,,,^^^",
"^,,,,,....^^^^^^,,,,,,^^^^^^....,,,,,^^",
"^,,l,,....^^^^^^,,J,,,^^^^^^....,,l,,^^",
"^,,,,,....^^^^^^,,,,,,^^^^^^....,,,,,^^",
"^^,,......,,,,,,,,,,,,,,,,......,,^^^^^",
"^,,,,,....,,,,,,d,,,,,,,,,....,,,,,^^^",
"^,,l,,....,,,,,,,,,,,,,,,,....,,l,,^^^",
"^,,,,,.3.,,,,,,,,,,,,,,,,,,.E.,,,,,,^^^",
"^^,,......,,,,,,,*,,,,,,,,......,,G,^^^",
"^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"]},
{name:"Hayride Farm",sub:"8:00 PM",clockMin:30,
 story:"The old farm is crawling with Grabbers — waddling aliens with butterfly nets! But the hay wagons circle the farm on their own... and nobody looks twice at a hay bale.",
 hint:"Stand on a moving hay wagon to ride it. You're hidden while riding!",
 friends:["beans"],neighborJars:1,unlock:"skeleton",newAlien:"grabber",
 pal:{g1:"#5a4a30",g2:"#4f4028"},
 flags:{wagons:[{pts:[[6,6],[30,6],[30,18],[6,18]],speed:1.6},{pts:[[8,14],[28,14],[28,22],[8,22]],speed:1.2}]},
 map:[
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
"T\"P..l.....\"\"\"\"\"\"..............\"\"\"\"\"\"..T",
"T\",,.......\"\"\"\"\"\"......H.....\"\"\"\"\"\"..T",
"T\",,..B....\"\"\"\"\"\"..............\"\"\"\"\"..T",
"T\",,.......\"\"\"\"\"\".1.\"\"\"\"\"\"\"..H..\"\"\"..T",
"T\"\"\"\"\"\"\"\"..........................\"\"T",
"T\"\"....l.........b.............l...\"\"T",
"T\"\"..H......\"\"\"\"\"\"\"\"\"\"\"\"......H...\"\"T",
"T\"\"..........\"\"\"\"\"\"\"\"\"\"\"\"..........\"\"T",
"T\"\"..l.......\"\"\"\"..JJ..\"\"\"\".......l..\"\"T",
"T\"\"..........\"\"\"\"\"\"\"\"\"\"\"\"..........\"\"T",
"T\"\"....H.....\"\"\"\"\"\"\"\"\"\"\"\".....H....\"\"T",
"T\"\"..........b........b..........\"\"T",
"T\"\"\"\"\"\"\"\"........................\"\"\"\"T",
"T\"..l......\"\"\"\"\"\"........\"\"\"\"\"\"..l..T",
"T\"..B......\"\"\"\"\"\".2.\"\"\"\"\"\"\"..B....T",
"T\"..........\"\"\"\"\"\"........\"\"\"\"\"\"......T",
"T\"....H.....\"\"\"....G.....\"\"\"....H....T",
"T\"..........\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"........T",
"T\"..l........................l......T",
"T\"......b..........................T",
"T\".............................G...T",
"T\"..3.....*.....*.....*.....*....E..T",
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"]},
{name:"Main Street Carnival",sub:"8:30 PM",clockMin:30,
 story:"The carnival is packed with costumed blob kids — the perfect crowd to disappear into! Sniffers can't see you, but they WILL follow your footprints if you run. And someone left an apple-bobbing tub unattended...",
 hint:"Stand still near the crowd to blend in. SNEAK past Sniffers — never run!",
 friends:[],neighborJars:3,unlock:null,newAlien:"sniffer",
 pal:{g1:"#4a3a5c",g2:"#40304f"},
 flags:{crowds:true,carousel:true,apple:true},
 map:[
"########################################",
"#P...,,...,,,,...,,,,...,,,,...,,,,..E#",
"#,1.,,,.2.,,,.3.,,,.,,,.,,,.,,,.,,,.,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,g..g..,,,,,,V,,,,,,,,,,g..g..,,,,,#",
"#,,g..g..,,,,,,,,,,,,,,,,,g..g..,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,c,,,,,,,,,,,,,,,,,,c,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,A,,,,,,g..g..,,,,,,g..g..,,,,,A,,,#",
"#,,,,,,,,,g..g..,,,,,,g..g..,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,J,,,,,,,,J,,,,,,,,J,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,l,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,l,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,g..g..,,,,,,,,,,,,,,,,,g..g..,,,,,#",
"#,,g..g..,,,,,,,,c,,,,,,,,g..g..,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,*,,,,,,,*,,,,,,,,,,,,,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,G,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,G,,,#",
"#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#",
"#,,l,,,,,,,,,,,,,,,,,,,,,,,,,,,,l,,,#",
"########################################"]},
{name:"Graveyard Hill",sub:"9:00 PM",clockMin:30,
 story:"Fog rolls over Graveyard Hill, and the lawn skeletons rattle in the wind. Violet is waiting in the old crypt garden. Captain Zorb patrols on his hover scooter — with TWO vision cones!",
 hint:"Fog hides you at long range. Your skeleton costume blends in with lawn skeletons!",
 friends:["violet"],neighborJars:1,unlock:"vampire",newAlien:"zorb",
 pal:{g1:"#3a3f4a",g2:"#333842"},
 flags:{fog:true},
 map:[
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
"T,P......,,,,,,,,,,,,,,,,,,,,,,,,,,T",
"T,,,..K......,,,,..K......,,,,..K.,,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,.1.....,,,,,,,,,,,,,,,,,,,.2.,,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,...l.....f,,,,,,,,,,,,,,,,,l...,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,,..K.....J,,,,,,J.....,,..K....,T",
"T,,,..............................,T",
"T,,......,,,,,,,,,,,,,,,,,,......,T",
"T,,..l...,,,,,,e,,,,,,,,,,...l...,T",
"T,,......,,,,,,,,,,,,,,,,,,......,T",
"T,,,..............................,T",
"T,,,..K......,,,,..K......,,,,..K.,,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,.3.....,,,,,,,,,,,G,,,,,,,.E..,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,...l.....,,,,,,,,,,,,,,,,,l....,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,,..G.....J,,,,,,*.....,,.......,T",
"T,,,........,,,,,,,,,,,,,,,,,,,,,,T",
"T,,......,,,,,,,,,,,,,,,,,,......,T",
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"]},
{name:"Candy Factory",sub:"9:30 PM",clockMin:30,
 story:"The Candy Factory! Conveyor belts carry everything — candy, aliens, and sneaky little blobs — across the chocolate river. Tuck is stuck near the mixing vats.",
 hint:"Ride conveyor belts to zip across the factory. They move aliens too!",
 friends:["tuck"],neighborJars:1,unlock:"mummy",newAlien:null,
 pal:{g1:"#4a4a5c",g2:"#404050"},
 flags:{conveyors:[{x:4,y:6,w:32,h:2,dx:1,dy:0},{x:4,y:16,w:32,h:2,dx:-1,dy:0},{x:18,y:8,w:2,h:8,dx:0,dy:1}]},
 map:[
"########################################",
"#P.;;;;;;;;..........................E#",
"#..;;;;;;;;...........................#",
"#..1.......;;......e.......;;......2..#",
"#..........;;.............G;;.........#",
"#..l.......;;......J......;;......l...#",
"#..........;;.............G;;.........#",
"#..........;;......J......;;..........#",
"#..*.......;;.............G;;......*..#",
"#.....................................#",
"#..;;;;;;;...........................#",
"#..;;;;;;;......b.............b......#",
"#.....................................#",
"#..l................................l.#",
"#.....................................#",
"#..........;;;;;;;;...................#",
"#..........;;;;;;;;....e..............#",
"#..3.......;;;;;;;;...................#",
"#..........;;;;;;;;......G............#",
"#.....................................#",
"#.....b....................b..........#",
"#.....................................#",
"#..*.....*.....*.....*.....*.....*....#",
"#.....................................#",
"########################################"]},
{name:"Haunted Mansion",sub:"10:00 PM",clockMin:30,
 story:"The old mansion is dark — only your flashlight and the moonlight show the way. Portraits watch from the walls (harmless... probably). Hazel is hiding in the library. Your vampire costume can see hidden paths in the dark!",
 hint:"It's DARK. Your flashlight lights a small circle. Vampire costume reveals secret paths!",
 friends:["hazel"],neighborJars:1,unlock:"witch",newAlien:null,
 pal:{g1:"#4a3a2e",g2:"#403026"},
 flags:{dark:true},
 map:[
"########################################",
"#P.:::::::..........::::::::::........E#",
"#..:::::::..F.......::::::::::..F......#",
"#..1.......::::::::::......2...........#",
"#..........::::::::::.................#",
"#..l.......::::..J...::::.......l.....#",
"#..........::::......::::.............#",
"#..........::::..J...::::.............#",
"#..*.......::::::::::::::........*...#",
"#####.##########....##########.#########",
"#.....................................#",
"#..:::::::..........::::::::::........#",
"#..:::::::..e.......::::::::::..e.....#",
"#..........::::::::::.................#",
"#..l.......::::......::::.......l.....#",
"#..........::::..G...::::.............#",
"#..3.......::::......::::.............#",
"#..........::::::::::::::.............#",
"#..:::::::..........::::::::::........#",
"#..:::::::..F.......::::::::::..F.....#",
"#.....................................#",
"#..G....*.....*.....*.....*......G....#",
"#.....................................#",
"########################################"]},
{name:"Bog Bayou",sub:"10:30 PM",clockMin:30,
 story:"The bayou glows with fireflies — pretty, but they light YOU up too. Hop the drifting lily pads across the black water. Rocco is stuck on the far island, and something slow is out on the hover boat...",
 hint:"Ride lily pads across water. Fireflies reveal you — keep moving!",
 friends:["rocco"],neighborJars:1,unlock:"dino",newAlien:null,
 pal:{g1:"#2e4a3a",g2:"#284033"},
 flags:{pads:[{pts:[[6,20],[18,20],[18,10],[6,10]],speed:1.4},{pts:[[24,20],[34,20],[34,8],[24,8]],speed:1.4}],fireflies:true},
 map:[
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
"T'P.................................ET",
"T'1..''''...........................2T",
"T'''.................................T",
"T'''..~~~~~~.........................T",
"T'''..~~~~~~.....n...................T",
"T''l..~~~~~~.........................T",
"T'''..~~~~~~....~~~~~~~...............T",
"T'''..~~~~~~....~~~~~~~....b..........T",
"T'''.............~~~~~~~..............T",
"T''..J...........~~~~~~~....J.........T",
"T'''.............~~~~~~~..............T",
"T'''..~~~~~~~....~~~~~~~....~~~~~~....T",
"T'''..~~~~~~~................~~~~~~...T",
"T''l..~~~~~~~....G..........~~~~~~..lT",
"T'''..~~~~~~~................~~~~~~...T",
"T'''.............~~~~~~..............T",
"T''......b.......~~~~~~.....b.........T",
"T'''.............~~~~~~..............T",
"T'''..G..........~~~~~~....G..........T",
"T'''.................................T",
"T''l..........*.....*.....*........l.T",
"T'3.................................T",
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"]},
{name:"The Landing Field",sub:"11:00 PM",clockMin:30,
 story:"This is it — the alien camp in the woods. Saucers land and take off all around you, and Jar Guards watch the last Jelly Jars. Free EVERY remaining friend before the fleet lifts off!",
 hint:"Guards spin in place — time your rescue for when their back is turned!",
 friends:[],neighborJars:4,unlock:null,newAlien:"guard",
 pal:{g1:"#2a3a2e",g2:"#243026"},
 flags:{},
 map:[
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
"T,P.....l...........................ET",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,1....,,,,..e....e....e..,,,,...2,,T",
"T,,,....,,,,..J....J....J..,,,,...,,,T",
"T,,,....,,,,,,,,..J..,,,,,,,...,,,T",
"T,,l....,,,,,,,,,,,,,,,,,,,,,,...l,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,,....,,d,,,,,,,,,,,,d,,,,,,...,,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,.....l,,,,,,b,,,,,,b,,,,,,l....,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,,....,,,,..e....e....e..,,,,...,,,T",
"T,,,....,,,,..J....J....J..,,,,...,,,T",
"T,,3....,,,,,,,,..J..,,,,,,,...,,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,l....,,,,,,,,,,,,,,,,,,,,,,...l,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,,....,,d,,,,,,,,,,,,d,,,,,,...,,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,.....l,,,,,,b,,,,,,b,,,,,,l....,,T",
"T,,,....,,,,,,,,,,,,,,,,,,,,,,,...,,,T",
"T,,,....G,,,,,,,*,,,,,,,*,,,,G...,,,T",
"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"]},
{name:"The Mothership",sub:"11:30 PM",clockMin:30,
 story:"You made it aboard the Mothership! Flip the three power switches, pile candy on the candy mountain to distract Queen Glorpa, then REVERSE the tractor beam at the beam controls to send every blob kid floating home!",
 hint:"Flip all 3 switches, then bring candy to the mountain, then hold ACTION at the beam controls!",
 friends:[],neighborJars:0,unlock:null,newAlien:"queen",
 pal:{g1:"#3a3f6a",g2:"#32375c"},
 flags:{switches:true,mountain:true,beamctl:true},
 map:[
"########################################",
"#P.;;;;;..............................#",
"#..;;;;;.......S.......................#",
"#..1.....;;;;;..........e..........2..#",
"#........;;;;;........................#",
"#..l.....G....;;;;;..........l........#",
"#..............;;;;;..................#",
"#.....e........;;;;;.....e.............#",
"#..................S..................#",
"#..;;;;;..............................#",
"#..;;;;;.....q........................#",
"#..;;;;;..............................#",
"#........S............................#",
"#.....................................#",
"#..l..............................l...#",
"#.....................................#",
"#.....!...............................#",
"#.....................................#",
"#..........&..........................#",
"#.....................................#",
"#..*....*.....*.....*.....*.....*......#",
"#.....................................#",
"#..G..................................#",
"########################################"]}
];
/* ---------- level runtime ---------- */
const TILE=48;
let LV=null;
const SOLID=new Set(["#","^","T","~","V","H"]);
const SEETHRU=new Set(["#","^","T","V"]);
function parseLevel(def){
 const rows=def.map,W=Math.max(...rows.map(r=>r.length)),H=rows.length;
 const grid=[];for(let y=0;y<H;y++){grid[y]=[];for(let x=0;x<W;x++)grid[y][x]=rows[y][x]||"#";}
 const L={def,tw:W,th:H,grid,aliens:[],jars:[],candies:[],corns:[],checks:[],hides:[],camos:[],
  crowds:[],wagons:[],pads:[],switches:[],beams:[],rings:[],parts:[],texts:[],lures:[],decoys:[],
  timeLeft:def.clockMin*12,rescued:0,caught:0,spotted:false,cornsGot:0,totalJars:0,
  escape:false,chaseT:0,complete:false,done:false,over:false,caughtT:0,catchAnim:null,
  candyEarned:0,candyStart:prof().candy,exitX:0,exitY:0,mountainGot:0,beamHold:0,
  startT:0,neighbors:0};
 let ji=0;
 const friends=def.friends.slice();
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const ch=grid[y][x],px=x*TILE+TILE/2,py=y*TILE+TILE/2;
  const put=(arr,o)=>arr.push(Object.assign({tx:x,ty:y,x:px,y:py},o));
  if(ch==="P"){L.px=px;L.py=py;grid[y][x]=",";}
  else if(ch==="E"){L.hasExit=true;L.exitX=px;L.exitY=py;grid[y][x]=",";}
  else if(ch==="J"){const fid=friends.length?friends.shift():null;
   put(L.jars,{friend:fid,nb:fid?null:NEIGHBORS[(L.neighbors++)%NEIGHBORS.length],popped:false,holdT:0,anim:Math.random()*9});
   grid[y][x]=",";L.totalJars++;}
  else if(ch==="*"){put(L.candies,{taken:false,vx:0,vy:0});grid[y][x]=",";}
  else if(ch==="G"){put(L.corns,{taken:false});grid[y][x]=",";}
  else if(ch==="1"||ch==="2"||ch==="3"){put(L.checks,{on:false});grid[y][x]=",";}
  else if("LBCXDO".includes(ch)){put(L.hides,{kind:ch});}
  else if("YWK UQZMF".replace(/ /g,"").includes(ch)){put(L.camos,{kind:ch});}
  else if(ch==="a"||ch==="b"||ch==="c"||ch==="d"||ch==="e"||ch==="f"){
   put(L.aliens,mkAlien(ch,x,y));grid[y][x]=",";}
  else if(ch==="q"){put(L.aliens,mkAlien(ch,x,y));grid[y][x]=",";}
  else if(ch==="g"){put(L.crowds,{dir:Math.random()*TAU,wt:Math.random()*3,color:choice(Object.keys(BLOB_COLORS)),costume:choice(["ghost","pumpkin","skeleton","vampire","mummy","witch","dino"]),anim:Math.random()*9});grid[y][x]=",";}
  else if(ch==="A"){L.apple={x:px,y:py,cd:0};grid[y][x]=",";}
  else if(ch==="S"){put(L.switches,{on:false});grid[y][x]=";";}
  else if(ch==="&"){L.beamctl={x:px,y:py};grid[y][x]=";";}
  else if(ch==="!"){L.mountain={x:px,y:py};grid[y][x]=";";}
 }
 // patrol routes around spawn
 for(const a of L.aliens){
  const r=a.type==="peeper"?4:a.type==="saucer"?5:3;
  if(a.type==="guard"||a.type==="queen"){a.wp=[[a.tx,a.ty]];}
  else if(a.type==="saucer"){a.wp=[];for(let i=0;i<8;i++){const an=i/8*TAU;
   a.wp.push([a.tx+Math.cos(an)*r,a.ty+Math.sin(an)*r*0.7]);}}
  else{a.wp=[[a.tx-r,a.ty],[a.tx+r,a.ty],[a.tx+r,a.ty+r*0.6],[a.tx-r,a.ty+r*0.6]];}
  a.wpi=0;
 }
 // wagons & pads
 for(const w of (def.flags.wagons||[]))L.wagons.push({pts:w.pts.map(p=>({x:p[0]*TILE+TILE/2,y:p[1]*TILE+TILE/2})),pi:0,t:0,speed:w.speed,w:76,h:54,x:0,y:0,dx:1,dy:0,kind:"wagon"});
 for(const w of (def.flags.pads||[]))L.pads.push({pts:w.pts.map(p=>({x:p[0]*TILE+TILE/2,y:p[1]*TILE+TILE/2})),pi:0,t:0,speed:w.speed,w:68,h:48,x:0,y:0,dx:1,dy:0,kind:"lilypad"});
 L.conveyors=(def.flags.conveyors||[]).map(c=>({x:c.x*TILE,y:c.y*TILE,w:c.w*TILE,h:c.h*TILE,dx:c.dx,dy:c.dy}));
 L.player={x:L.px,y:L.py,r:14,vx:0,vy:0,dir:0,hidden:false,camo:false,blend:false,
  costume:prof().selCostume,candy:0,sneak:false,run:false,noiseT:0,stepT:0,trail:[],
  powerCD:0,floatT:0,rollT:0,rollDX:0,rollDY:0,dashT:0,dashDX:0,dashDY:0,dizT:0,
  blink:0,blinkT:rand(2,5),squish:0,anim:0,caught:false,aimTX:0,aimTY:0,hideKind:null,riding:null,mash:0,popT:0};
 L.cam={x:L.px,y:L.py};
 return L;
}
const ALIEN_DEF={
 peeper:{range:7,fov:0.5,speed:55,chaseSpeed:120},
 grabber:{range:4.5,fov:1.5,speed:60,chaseSpeed:135},
 sniffer:{range:6,fov:TAU,speed:70,chaseSpeed:140,blind:true},
 saucer:{range:0,fov:0,speed:80,chaseSpeed:150,beamR:78},
 guard:{range:5,fov:1.2,speed:0,chaseSpeed:110},
 zorb:{range:6,fov:0.9,speed:95,chaseSpeed:175,rear:true},
 queen:{range:8,fov:1.0,speed:45,chaseSpeed:95}};
function mkAlien(ch,tx,ty){
 const t={a:"peeper",b:"grabber",c:"sniffer",d:"saucer",e:"guard",f:"zorb",q:"queen"}[ch];
 const d=ALIEN_DEF[t];
 return{type:t,x:tx*TILE+TILE/2,y:ty*TILE+TILE/2,tx,ty,dir:Math.random()*TAU,
  state:"patrol",meter:0,waitT:0,anim:Math.random()*9,tx_:0,ty_:0,
  distractT:0,eatT:0,lureX:0,lureY:0,beamT:0,beamA:Math.random()*TAU,frozen:0,dizzy:0,
  range:d.range,fov:d.fov,speed:d.speed,chaseSpeed:d.chaseSpeed,blind:!!d.blind,
  bx:0,by:0,trailI:0};
}
function tileAt(tx,ty){if(!LV||tx<0||ty<0||tx>=LV.tw||ty>=LV.th)return"#";return LV.grid[ty][tx];}
function solidAt(tx,ty,float){const ch=tileAt(tx,ty);
 if(ch==="~")return !float;return SOLID.has(ch);}
function losBlocked(x1,y1,x2,y2){
 const d=dist(x1,y1,x2,y2),steps=Math.ceil(d/14);
 for(let i=1;i<steps;i++){const t=i/steps;
  const tx=Math.floor(lerp(x1,x2,t)/TILE),ty=Math.floor(lerp(y1,y2,t)/TILE);
  if(SEETHRU.has(tileAt(tx,ty)))return true;}
 return false;
}
function collideMove(e,dx,dy,float){
 let nx=e.x+dx;
 const r=e.r||14;
 const hit=(x,y)=>{const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);return solidAt(tx,ty,float);};
 if(!hit(nx+Math.sign(dx)*r,e.y-r*0.6)&&!hit(nx+Math.sign(dx)*r,e.y+r*0.6)&&!hit(nx+Math.sign(dx)*r,e.y))e.x=nx;
 else e.bumped=true;
 let ny=e.y+dy;
 if(!hit(e.x-r*0.6,ny+Math.sign(dy)*r)&&!hit(e.x+r*0.6,ny+Math.sign(dy)*r)&&!hit(e.x,ny+Math.sign(dy)*r))e.y=ny;
 else e.bumped=true;
}
/* ---------- begin level ---------- */
function beginLevel(i){
 const pr=prof();
 LV=parseLevel(LEVELS[i]);
 G.lvl=i;G.screen="play";G.paused=false;G.inGame=true;
 document.querySelectorAll(".scr").forEach(s=>s.classList.remove("on"));
 $("hud").classList.add("on");
 AU.setMode("level");AU.setLevel(i);AU.sfx.power();
 updateCostumeHUD();
 // new alien cards
 const seen=pr.book.aliens;
 const types=[...new Set(LV.aliens.map(a=>a.type))];
 let cardQ=types.filter(t=>!seen[t]);
 LV.cardQueue=cardQ;
 showNextCard();
 toast(LEVELS[i].name+"<br><span style='font-size:13px'>"+LEVELS[i].sub+"</span>");
 updateTopbar();
}
function showNextCard(){
 if(!LV.cardQueue||!LV.cardQueue.length){G.paused=false;return;}
 G.paused=true;
 const t=LV.cardQueue.shift(),A=ALIENS[t];
 $("card-name").textContent=A.name;$("card-desc").textContent=A.tip;
 const c=$("card-cv").getContext("2d");c.clearRect(0,0,300,300);
 drawAlien(c,{type:t,x:150,y:150,dir:0.6,state:"patrol",meter:0,anim:1});
 prof().book.aliens[t]=true;storeSave();
 $("s-card").classList.add("on");
 $("btn-cardok").onclick=()=>{AU.sfx.click();$("s-card").classList.remove("on");showNextCard();};
}
function updateCostumeHUD(){
 const c=$("tb-costcv").getContext("2d");c.clearRect(0,0,60,60);
 const pl=LV?LV.player:{costume:prof().selCostume};
 glossBlob(c,30,32,20,{color:BLOB_COLORS[prof().color]||"#7fe6b8"});
 drawCostume(c,pl.costume,20,{x:30,y:32});
 drawHat(c,prof().hat,20);
}
/* ---------- player update ---------- */
function updPlayer(dt){
 const p=LV.player,pr=prof(),easy=pr.settings.easy;
 if(p.caught||LV.over)return;
 const mv=IN.mouseThrow;
 const inp=moveInput();
 let sp=p.run?0:0;
 const runKey=inp.run;
 p.sneak=inp.mag>0.05&&inp.mag<=0.62;
 p.run=inp.mag>0.62;
 let speed=p.sneak?95:(p.run?205:0);
 if(p.rollT>0){speed=340;p.rollT-=dt;}
 if(p.dashT>0){speed=460;p.dashT-=dt;}
 if(p.floatT>0)speed*=1.1;
 const tx=inp.x,ty=inp.y;
 if(inp.mag>0.05){p.dir=Math.atan2(ty,tx);
  p.vx=lerp(p.vx,tx/inp.mag*speed,1-Math.pow(0.0001,dt));
  p.vy=lerp(p.vy,ty/inp.mag*speed,1-Math.pow(0.0001,dt));
 }else{p.vx*=Math.pow(0.001,dt);p.vy*=Math.pow(0.001,dt);}
 const floating=p.floatT>0;
 p.bumped=false;
 collideMove(p,p.vx*dt,p.vy*dt,floating);
 // conveyors
 for(const c of LV.conveyors){if(p.x>c.x&&p.x<c.x+c.w&&p.y>c.y&&p.y<c.y+c.h){p.x+=c.dx*90*dt;p.y+=c.dy*90*dt;}}
 // wagons & pads carry + hide
 p.riding=null;
 for(const w of [...LV.wagons,...LV.pads]){
  if(Math.abs(p.x-w.x)<w.w/2&&Math.abs(p.y-w.y)<w.h/2){p.riding=w;p.x+=w.dx*w.speed*60*dt;p.y+=w.dy*w.speed*60*dt;}
 }
 p.anim+=dt*(Math.hypot(p.vx,p.vy)>10?10:3);
 p.blinkT-=dt;if(p.blinkT<0){p.blink=0.12;p.blinkT=rand(2,5);}if(p.blink>0)p.blink-=dt;
 p.squish=clamp(Math.hypot(p.vx,p.vy)/205,0,1);
 // footsteps noise
 const moving=Math.hypot(p.vx,p.vy)>30;
 if(moving){p.stepT-=dt;
  if(p.stepT<=0){p.stepT=p.run?0.28:0.5;AU.sfx.step(p.sneak);
   if(prof().trail)spawnTrail(p);
   if(p.run){emitRing(p.x,p.y,3.2);p.noiseT=0.35;
    // footprints for sniffers
    p.trail.push({x:p.x,y:p.y,t:6});
    const tch=tileAt(Math.floor(p.x/TILE),Math.floor(p.y/TILE));
    if(tch==="l")AU.sfx.crunch();
    if(tch==="C"){AU.sfx.clang();emitRing(p.x,p.y,5);}
   }}}
 for(const f of p.trail)f.t-=dt;
 p.trail=p.trail.filter(f=>f.t>0);
 // hiding
 p.hidden=false;p.hideKind=null;
 if(p.popT<=0&&(!moving||p.sneak)){
  for(const h of LV.hides){if(dist(p.x,p.y,h.x,h.y)<40){p.hidden=true;p.hideKind=h.kind;break;}}
 }
 if(p.riding)p.hidden=true;
 // camouflage
 p.camo=false;
 const camoCh=COSTUMES[p.costume].camo;
 if(!moving&&!p.hidden){
  for(const cm of LV.camos){if(cm.kind===camoCh&&dist(p.x,p.y,cm.x,cm.y)<70){p.camo=true;
   if(Math.random()<dt*8)spawnPart(p.x+rand(-16,16),p.y+rand(-16,16),0,-20,0.6,"#c9f27e",3);break;}}
 }
 // crowd blend
 p.blend=false;
 if(LV.def.flags.crowds&&!moving&&!p.hidden&&!p.camo){
  for(const c of LV.crowds){if(dist(p.x,p.y,c.x,c.y)<62){p.blend=true;break;}}
 }
 if(p.powerCD>0){p.powerCD-=dt;$("pow-cd").style.display="flex";$("pow-cd").textContent=Math.ceil(p.powerCD);}
 else{$("pow-cd").style.display="none";}
 // pickups
 for(const c of LV.candies){if(!c.taken&&dist(p.x,p.y,c.x,c.y)<26){c.taken=true;
  const w=c.worth||1;p.candy+=w;LV.candyEarned+=w;
  prof().candy+=w;prof().stats.maxCandy=Math.max(prof().stats.maxCandy,prof().candy);
  AU.sfx.coin();spawnPart(c.x,c.y,0,-30,0.5,"#ffb347",4);updateTopbar();}}
 for(const c of LV.corns){if(!c.taken&&dist(p.x,p.y,c.x,c.y)<30){c.taken=true;LV.cornsGot++;
  prof().book.corns[G.lvl+"_"+LV.corns.indexOf(c)]=true;
  AU.sfx.corn();addText(c.x,c.y-20,"GOLDEN CANDY CORN!","#ffd75e");updateTopbar();storeSave();}}
 for(const k of LV.checks){if(!k.on&&dist(p.x,p.y,k.x,k.y)<44){k.on=true;LV.respawnX=k.x;LV.respawnY=k.y;
  AU.sfx.checkpoint();addText(k.x,k.y-40,"CHECKPOINT","#7ee86a");}}
 // candy throw (aim release / mouse click)
 if(IN.aim.released){IN.aim.released=false;doThrow();}
 if(mv){IN.mouseThrow=null;throwAt(mv.x,mv.y);}
 // power
 if(IN.powPress){IN.powPress=false;doPower();}
 // action press
 if(IN.actPress){IN.actPress=false;doActionPress();}
 updActionHold(dt);
 // clock
 LV.timeLeft-=dt;
 if(LV.timeLeft<=0&&!LV.over){LV.timeLeft=0;timeoutFinish();}
}
function emitRing(x,y,tr){LV.rings.push({x,y,r:10,max:tr*TILE,alpha:0.8});
 for(const a of LV.aliens){if(a.state==="patrol"||a.state==="sus"){
  if(dist(x,y,a.x,a.y)<tr*TILE){a.dir=Math.atan2(y-a.y,x-a.x);a.meter=Math.min(1,a.meter+0.35);
   if(a.meter>=0.6&&a.state==="patrol"){a.state="sus";AU.sfx.q();}}}}}
function spawnPart(x,y,vx,vy,life,color,size){LV.parts.push({x,y,vx:vx+rand(-20,20),vy:vy+rand(-20,20),life,maxLife:life,color,size:size||3});}
function spawnTrail(p){const t=prof().trail;if(!t)return;
 const col=t==="sparkle"?"#fff3c9":t==="leaves"?"#d8953f":"#bfe8ff";
 spawnPart(p.x+rand(-8,8),p.y+rand(8,14),rand(-10,10),rand(-30,-10),0.7,col,3);}
function addText(x,y,txt,color){LV.texts.push({x,y,txt,life:2.2,color:color||"#fff"});}
/* ---------- interactions ---------- */
function nearestInteract(){
 const p=LV.player;let best=null,bd=90;
 const consider=(x,y,obj,label)=>{const d=dist(p.x,p.y,x,y);if(d<bd){bd=d;best={obj,label};}};
 for(const j of LV.jars)if(!j.popped)consider(j.x,j.y,{t:"jar",j},"POP JAR");
 for(const h of LV.hides)consider(h.x,h.y,{t:"hide",h},p.hidden?"POP OUT":"HIDE");
 if(LV.apple&&LV.apple.cd<=0)consider(LV.apple.x,LV.apple.y,{t:"apple"},"BOB APPLES");
 for(const s of LV.switches)if(!s.on)consider(s.x,s.y,{t:"switch",s},"FLIP");
 if(LV.mountain&&LV.mountainGot<60)consider(LV.mountain.x,LV.mountain.y,{t:"mountain"},"GIVE CANDY");
 if(LV.beamctl&&LV.mountainGot>=60&&LV.switches.every(s=>s.on))consider(LV.beamctl.x,LV.beamctl.y,{t:"beam"},"REVERSE BEAM");
 if(LV.escape)consider(LV.exitX,LV.exitY,{t:"exit"},"ESCAPE!");
 return best;
}
function doActionPress(){
 const p=LV.player;if(p.caught||LV.over)return;
 const it=nearestInteract();if(!it)return;
 const o=it.obj;
 if(o.t==="jar"){LV.holdJar=o.j;o.j.holdT=0;$("holdwrap").style.display="block";$("holdtxt").textContent="HOLD TO POP JAR";}
 else if(o.t==="hide"){if(p.hidden){p.popT=1.2;AU.sfx.hide();}else{toast("Stay still near a hiding spot!");} }
 else if(o.t==="apple"){p.mash++;AU.sfx.apple();spawnPart(LV.apple.x,LV.apple.y-20,0,-40,0.5,"#e74c3c",4);
  if(p.mash>=6){p.mash=0;LV.apple.cd=20;p.candy+=30;LV.candyEarned+=30;prof().candy+=30;
   addText(LV.apple.x,LV.apple.y-50,"+30 CANDY!","#ffb347");AU.sfx.cheer();updateTopbar();}}
 else if(o.t==="switch"){o.s.on=true;AU.sfx.flip();addText(o.s.x,o.s.y-40,"CLICK!","#7ee86a");
  spawnPart(o.s.x,o.s.y,0,-30,0.6,"#7ee86a",5);
  if(LV.switches.every(s=>s.on)){toast("All switches flipped!");AU.sfx.star();}}
 else if(o.t==="mountain"){const give=Math.min(p.candy,60-LV.mountainGot);
  if(give>0){p.candy-=give;prof().candy-=give;LV.mountainGot+=give;LV.candyEarned-=give;
   AU.sfx.gulp();addText(LV.mountain.x,LV.mountain.y-60,"+"+give+" candy!","#ffb347");updateTopbar();
   if(LV.mountainGot>=60){toast("The Queen is distracted! Get to the beam controls!");AU.sfx.star();}}
  else toast("You need candy! Grab some first.");}
 else if(o.t==="beam"){LV.holdBeam=true;$("holdwrap").style.display="block";$("holdtxt").textContent="HOLD TO REVERSE BEAM";}
 else if(o.t==="exit"){finishLevel(false);}
}
function updActionHold(dt){
 const p=LV.player,held=IN.actHeld||IN.keys["e"];
 const it=nearestInteract();
 // jar hold
 if(LV.holdJar){
  const j=LV.holdJar;
  if(!held||!it||it.obj.t!=="jar"||it.obj.j!==j){j.holdT=0;LV.holdJar=null;$("holdwrap").style.display="none";}
  else{j.holdT+=dt;$("holdfill").style.width=Math.min(100,j.holdT/2*100)+"%";
   if(j.holdT>=2)popJar(j);}
 }
 if(LV.holdBeam){
  if(!held||!it||it.obj.t!=="beam"){LV.holdBeam=false;$("holdwrap").style.display="none";}
  else{LV.beamHold+=dt;$("holdfill").style.width=Math.min(100,LV.beamHold/3*100)+"%";
   if(Math.random()<dt*10)spawnPart(LV.beamctl.x+rand(-20,20),LV.beamctl.y+rand(-20,20),0,-40,0.8,"#7ee86a",4);
   if(LV.beamHold>=3){LV.holdBeam=false;$("holdwrap").style.display="none";winSequence();}}
 }
 if(it&&$("btn-act"))$("btn-act").childNodes[0].textContent=it.label;
 else if($("btn-act"))$("btn-act").childNodes[0].textContent=p.hidden?"HIDDEN":"HIDE";
}
function popJar(j){
 j.popped=true;$("holdwrap").style.display="none";LV.holdJar=null;
 AU.sfx.jarPop();AU.sfx.cheer();
 for(let i=0;i<24;i++)spawnPart(j.x,j.y-20,rand(-120,120),rand(-160,-20),0.9,choice(["#ffb347","#7ee86a","#ff6a8a","#fff"]),4);
 prof().stats.rescues++;
 if(j.friend){const F=FRIENDS[j.friend];
  prof().book.friends[j.friend]=true;
  addText(j.x,j.y-60,F.name+" rescued!","#7ee86a");
  const un=LV.def.unlock;
  if(un&&!prof().costumes.includes(un)){prof().costumes.push(un);
   setTimeout(()=>toast(F.name+" shared the <b>"+COSTUMES[un].name+"</b> costume!<br>Swap in the pause menu."),600);}
 }else{
  addText(j.x,j.y-60,j.nb+" rescued! +25","#7ee86a");
  LV.player.candy+=25;LV.candyEarned+=25;prof().candy+=25;
 }
 LV.rescued++;storeSave();updateTopbar();checkAchv();
 if(LV.totalJars>0&&LV.rescued>=LV.totalJars)startEscape();
}
function startEscape(){
 if(LV.escape||LV.over)return;LV.escape=true;
 AU.setMode("chase");AU.sfx.escape();
 toast("<b>RUN!</b> The big saucer is coming!<br>Get to the exit!");
 addText(LV.exitX,LV.exitY-40,"EXIT!","#7ee86a");
 // ensure a chase saucer exists
 if(!LV.aliens.some(a=>a.type==="saucer")){
  const p=LV.player,ptx=Math.floor(p.x/TILE),pty=Math.floor(p.y/TILE);
  const a=mkAlien("d",ptx,pty);a.x=p.x;a.y=p.y-420;a.wp=[[ptx,pty]];a.chasing=true;LV.aliens.push(a);}
 for(const a of LV.aliens)if(a.type==="saucer")a.chasing=true;
}
/* ---------- throwing & lures ---------- */
function doThrow(){
 const p=LV.player;if(p.caught||LV.over)return;
 const dx=IN.aim.dx,dy=IN.aim.dy,m=Math.hypot(dx,dy);
 if(m<15)return;
 const ang=Math.atan2(dy,dx),pow=clamp(m/140,0.4,1);
 throwCandy(ang,pow);
}
function throwAt(sx,sy){
 const p=LV.player;if(p.caught||LV.over)return;
 const wx=sx+LV.cam.x-VW/2,wy=sy+LV.cam.y-VH/2;
 const ang=Math.atan2(wy-p.y,wx-p.x);
 throwCandy(ang,clamp(dist(p.x,p.y,wx,wy)/(TILE*8),0.4,1));
}
function throwCandy(ang,pow){
 const p=LV.player,pr=prof();
 if(p.candy<=0){toast("No candy! Grab some first.");return;}
 p.candy--;LV.candyEarned--;pr.candy=Math.max(0,pr.candy-1);
 pr.stats.throws++;
 const T=THROWS[pr.throwSel]||THROWS.corn;
 const R=T.range*TILE*pow;
 LV.beams.push({x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(ang)*R,ty:p.y+Math.sin(ang)*R,t:0,dur:0.55,type:pr.throwSel,def:T});
 AU.sfx.toss();updateTopbar();
}
function landCandy(s){
 const T=s.def;AU.sfx.land();
 spawnPart(s.tx,s.ty,0,-20,0.4,"#ff6a8a",4);
 if(T.loud){emitRing(s.tx,s.ty,8);AU.sfx.trap();}
 if(T.decoy){LV.decoys.push({x:s.tx,y:s.ty,t:T.dur,ang:Math.random()*TAU});
  for(const a of LV.aliens){if(dist(s.tx,s.ty,a.x,a.y)<9*TILE&&(a.state==="patrol"||a.state==="sus")){a.state="decoy";a.decoyT=T.dur;}}
  return;}
 const lure={x:s.tx,y:s.ty,t:T.dur,dur:T.dur,def:T,hit:new Set()};
 LV.lures.push(lure);
 let n=0;
 const cands=LV.aliens.filter(a=>(a.state==="patrol"||a.state==="sus")&&dist(s.tx,s.ty,a.x,a.y)<(T.range||7)*TILE);
 cands.sort((a,b)=>dist(s.tx,s.ty,a.x,a.y)-dist(s.tx,s.ty,b.x,b.y));
 const max=T.multi||1;
 for(const a of cands.slice(0,max)){a.state="distract";a.lureX=s.tx;a.lureY=s.ty;a.distractT=T.dur;a.eatT=0;n++;}
 if(n>0){prof().stats.distracts+=n;if(n>=3)prof().stats.sugarRush=true;checkAchv();}
}
/* ---------- costume powers ---------- */
function doPower(){
 const p=LV.player,pr=prof();
 if(p.caught||LV.over||p.powerCD>0)return;
 const c=p.costume,C=COSTUMES[c];
 p.powerCD=C.cd;
 pr.stats.powers[c]=true;
 const ang=p.dir;
 if(c==="robot"){let n=0;for(const a of LV.aliens){if((a.type==="peeper"||a.type==="saucer")&&dist(p.x,p.y,a.x,a.y)<6*TILE){a.frozen=6;n++;}}
  AU.sfx.freeze();addText(p.x,p.y-40,n?"FROZEN!":"No drones near","#bfe8ff");}
 else if(c==="ghost"){p.floatT=3;AU.sfx.glide();addText(p.x,p.y-40,"FLOATING!","#e8e8ff");}
 else if(c==="pumpkin"){p.rollT=1.1;p.rollDX=Math.cos(ang);p.rollDY=Math.sin(ang);AU.sfx.roll();emitRing(p.x,p.y,2);}
 else if(c==="skeleton"){const lx=p.x+Math.cos(ang)*4*TILE,ly=p.y+Math.sin(ang)*4*TILE;
  AU.sfx.rattle();emitRing(lx,ly,5);addText(lx,ly-20,"rattle rattle!","#fff");}
 else if(c==="vampire"){p.dashT=0.45;p.dashDX=Math.cos(ang);p.dashDY=Math.sin(ang);AU.sfx.glide();addText(p.x,p.y-40,"GLIDE!","#c9a7ff");}
 else if(c==="mummy"){let best=null,bd=7*TILE;
  for(const cd of LV.candies)if(!cd.taken&&dist(p.x,p.y,cd.x,cd.y)<bd){bd=dist(p.x,p.y,cd.x,cd.y);best={t:"c",o:cd};}
  for(const cn of LV.corns)if(!cn.taken&&dist(p.x,p.y,cn.x,cn.y)<bd){bd=dist(p.x,p.y,cn.x,cn.y);best={t:"g",o:cn};}
  for(const sw of LV.switches)if(!sw.on&&dist(p.x,p.y,sw.x,sw.y)<bd){best={t:"s",o:sw};}
  AU.sfx.grab();
  if(best){if(best.t==="s"){best.o.on=true;AU.sfx.flip();addText(best.o.x,best.o.y-40,"CLICK!","#7ee86a");}
   else{best.o.taken=true;
    if(best.t==="c"){p.candy++;LV.candyEarned++;prof().candy++;}
    else{LV.cornsGot++;prof().book.corns[G.lvl+"_"+LV.corns.indexOf(best.o)]=true;AU.sfx.corn();}
    AU.sfx.coin();updateTopbar();}
   addText(p.x,p.y-40,"GRABBED!","#e8dcc0");}
  else addText(p.x,p.y-40,"nothing in reach","#999");}
 else if(c==="witch"){p.dashT=0.5;p.dashDX=Math.cos(ang);p.dashDY=Math.sin(ang);AU.sfx.dash();
  addText(p.x,p.y-40,"BROOM DASH!","#c9f27e");}
 else if(c==="dino"){let n=0;for(const a of LV.aliens){if(dist(p.x,p.y,a.x,a.y)<3.5*TILE&&a.type!=="saucer"&&a.type!=="queen"){a.dizzy=4;a.state="patrol";a.meter=0;n++;}}
  AU.sfx.stomp();emitRing(p.x,p.y,3.5);addText(p.x,p.y-40,n?"DIZZY!":"stomp!","#ffb347");}
 checkAchv();storeSave();
}
/* ---------- caught ---------- */
function catchPlayer(by){
 const p=LV.player;if(p.caught||LV.over||p.dashT>0)return;
 p.caught=true;LV.caughtT=2.4;LV.catchAnim={t:0,by:by||"alien"};
 AU.sfx.caught();setTimeout(()=>AU.sfx.beam(),150);
 LV.caught++;prof().stats.catches++;
 const drop=Math.floor(p.candy/2);
 if(drop>0){const n=Math.min(10,drop);let left=drop;
  for(let i=0;i<n;i++){const w=i===n-1?left:Math.max(1,Math.floor(drop/n));left-=w;
   LV.candies.push({x:p.x+rand(-40,40),y:p.y+rand(-40,40),taken:false,vx:rand(-60,60),vy:rand(-60,60),dropT:0.6,worth:w});}
  p.candy-=drop;if(p.candy<0)p.candy=0;
  prof().candy=Math.max(0,prof().candy-drop);LV.candyEarned-=drop;}
 updateTopbar();storeSave();
}
function respawn(){
 const p=LV.player;
 p.x=LV.respawnX!=null?LV.respawnX:LV.px;p.y=LV.respawnY!=null?LV.respawnY:LV.py;
 p.vx=0;p.vy=0;p.caught=false;p.hidden=false;p.trail=[];
 LV.catchAnim=null;
 for(const a of LV.aliens){if(a.state==="chase"){a.state="patrol";a.meter=0.3;}}
}
/* ---------- alien AI ---------- */
function alienCanSee(a,tx,ty){
 const p=LV.player;
 if(p.hidden||p.camo||p.blend)return false;
 if(p.caught)return false;
 const d=dist(a.x,a.y,tx,ty);
 let range=a.range*(prof().settings.easy?1.15:1);
 if(LV.def.flags.dark)range*=0.75;
 if(LV.def.flags.fog)range*=0.85;
 if(d>range)return false;
 if(!a.blind){
  const ang=Math.atan2(ty-a.y,tx-a.x);
  if(Math.abs(angDiff(a.dir,ang))>a.fov/2){
   if(a.type==="zorb"){ // rear cone
    if(Math.abs(angDiff(a.dir+Math.PI,ang))>0.45)return false;
   }else return false;
  }
 }
 return !losBlocked(a.x,a.y,tx,ty);
}
function updAlien(a,dt){
 const p=LV.player;if(LV.over)return;
 a.anim+=dt*(a.state==="chase"?3:1.2);
 if(a.frozen>0){a.frozen-=dt;return;}
 if(a.dizzy>0){a.dizzy-=dt;a.dir+=dt*6;return;}
 const easy=prof().settings.easy;
 const spd=a.speed*(easy?0.85:1),cspd=a.chaseSpeed*(easy?0.85:1);
 if(a.type==="saucer"){updSaucer(a,dt);return;}
 if(a.type==="guard"){a.dir+=dt*0.7;
  if(alienCanSee(a,p.x,p.y))a.meter+=dt*1.4;else a.meter=Math.max(0,a.meter-dt*0.5);
  if(a.meter>=1){a.state="chase";a.meter=1;AU.sfx.excl();LV.spotted=true;}
  if(a.state==="chase"){moveToward(a,p.x,p.y,cspd*0.6,dt);
   if(dist(a.x,a.y,p.x,p.y)<30)catchPlayer("guard");
   if(!alienCanSee(a,p.x,p.y)){a.waitT=(a.waitT||0)+dt;if(a.waitT>3){a.state="patrol";a.meter=0.3;a.waitT=0;}}}
  return;}
 if(a.state==="distract"){
  moveToward(a,a.lureX,a.lureY,spd*1.2,dt);
  if(dist(a.x,a.y,a.lureX,a.lureY)<24){a.eatT=a.distractT;a.state="eat";AU.sfx.gulp();
   for(let i=0;i<6;i++)spawnPart(a.lureX,a.lureY-10,rand(-40,40),rand(-60,-10),0.6,"#ff6a8a",3);}
  return;}
 if(a.state==="eat"){a.eatT-=dt;a.dir+=dt*2;
  if(a.eatT<=0){a.state="patrol";a.meter=0;}return;}
 if(a.state==="decoy"){a.decoyT-=dt;
  const d0=LV.decoys[0];if(d0)moveToward(a,d0.x,d0.y,spd*1.3,dt);
  if(a.decoyT<=0){a.state="patrol";a.meter=0;LV.decoys.length=0;}return;}
 // vision
 const sees=alienCanSee(a,p.x,p.y);
 if(a.type==="sniffer"){
  if(p.trail.length&&a.state!=="chase"){const f=p.trail[p.trail.length-1];
   if(dist(a.x,a.y,f.x,f.y)<7*TILE){a.state="sus";moveToward(a,f.x,f.y,spd,dt);
    if(dist(a.x,a.y,p.x,p.y)<30){a.state="chase";AU.sfx.excl();LV.spotted=true;}}}
  else if(a.state==="patrol")patrolMove(a,spd,dt);
 }else if(sees){
  const d=dist(a.x,a.y,p.x,p.y);
  const rate=(1.6-d/(a.range*TILE)*1.1)*(easy?0.6:1);
  a.meter=Math.min(1,a.meter+dt*Math.max(0.5,rate));
  a.dir=Math.atan2(p.y-a.y,p.x-a.x);
  if(a.meter>=1&&a.state!=="chase"){a.state="chase";AU.sfx.excl();LV.spotted=true;}
  else if(a.meter>0.3&&a.state==="patrol"){a.state="sus";AU.sfx.q();}
 }else{
  a.meter=Math.max(0,a.meter-dt*0.45);
  if(a.meter<0.3&&a.state==="sus")a.state="patrol";
 }
 if(a.state==="chase"){
  moveToward(a,p.x,p.y,cspd,dt);
  if(dist(a.x,a.y,p.x,p.y)<30)catchPlayer(a.type);
  if(!sees){a.waitT=(a.waitT||0)+dt;
   if(a.waitT>4){a.state="patrol";a.meter=0.35;a.waitT=0;}}
  else a.waitT=0;
 }else if(a.state==="patrol"||a.state==="sus"){
  patrolMove(a,a.state==="sus"?spd*0.4:spd,dt);
 }
}
function patrolMove(a,spd,dt){
 if(!a.wp.length)return;
 const w=a.wp[a.wpi% a.wp.length],wx=w[0]*TILE+TILE/2,wy=w[1]*TILE+TILE/2;
 if(dist(a.x,a.y,wx,wy)<20){a.wpi=(a.wpi+1)%a.wp.length;return;}
 moveToward(a,wx,wy,spd,dt);
}
function moveToward(a,tx,ty,spd,dt){
 const d=Math.max(1,dist(a.x,a.y,tx,ty));
 a.dir=Math.atan2(ty-a.y,tx-a.x);
 const nx=a.x+(tx-a.x)/d*spd*dt,ny=a.y+(ty-a.y)/d*spd*dt;
 const ox=a.x,oy=a.y;a.x=nx;a.y=ny;a.r=16;
 const tx0=Math.floor(a.x/TILE),ty0=Math.floor(a.y/TILE);
 if(solidAt(tx0,ty0,false)){a.x=ox;a.y=oy;}
}
function updSaucer(a,dt){
 const p=LV.player;
 a.beamA+=dt*(a.chasing?2.2:0.9);
 if(a.chasing){moveToward(a,p.x,p.y,a.chaseSpeed*0.55,dt);}
 else patrolMove(a,a.speed,dt);
 a.bx=a.x+Math.cos(a.beamA)*46;a.by=a.y+Math.sin(a.beamA)*46;
 const inBeam=dist(p.x,p.y,a.bx,a.by)<ALIEN_DEF.saucer.beamR;
 const vis=!p.hidden&&!p.camo&&!p.blend&&!p.caught&&p.dashT<=0;
 if(inBeam&&vis){a.beamT+=dt*(prof().settings.easy?0.7:1);
  if(Math.random()<dt*4)spawnPart(p.x,p.y-20,0,-30,0.5,"#7ee86a",3);
  if(a.beamT>0.9)catchPlayer("saucer");
 }else a.beamT=Math.max(0,a.beamT-dt*2);
}
/* ---------- world update ---------- */
function updWorld(dt){
 if(!LV||LV.done)return;
 LV.startT+=dt;
 if(LV.caughtT>0){LV.caughtT-=dt;if(LV.caughtT<=0)respawn();}
 updPlayer(dt);
 // pop-out timer
 if(LV.player.popT>0)LV.player.popT-=dt;
 for(const a of LV.aliens){updAlien(a,dt);
  // conveyors move aliens too
  for(const c of LV.conveyors){if(a.x>c.x&&a.x<c.x+c.w&&a.y>c.y&&a.y<c.y+c.h){a.x+=c.dx*90*dt;a.y+=c.dy*90*dt;}}}
 // wagons & pads
 for(const w of [...LV.wagons,...LV.pads]){
  const tgt=w.pts[(w.pi+1)%w.pts.length];
  const d=dist(w.x,w.y,tgt.x,tgt.y);
  if(w.x===0&&w.y===0){w.x=w.pts[0].x;w.y=w.pts[0].y;}
  if(d<8){w.pi=(w.pi+1)%w.pts.length;}
  else{w.dx=(tgt.x-w.x)/d;w.dy=(tgt.y-w.y)/d;w.x+=w.dx*w.speed*60*dt;w.y+=w.dy*w.speed*60*dt;}
 }
 // crowds wander
 for(const c of LV.crowds){c.wt-=dt;c.anim+=dt*2;
  if(c.wt<=0){c.wt=rand(2,5);c.dir=rand(0,TAU);}
  const nx=c.x+Math.cos(c.dir)*22*dt,ny=c.y+Math.sin(c.dir)*22*dt;
  if(!solidAt(Math.floor(nx/TILE),Math.floor(ny/TILE),false)){c.x=nx;c.y=ny;}else c.dir=rand(0,TAU);}
 // shots (thrown candy)
 for(const s of LV.beams){s.t+=dt;
  const k=Math.min(1,s.t/s.dur);s.x=lerp(s.sx,s.tx,k);s.y=lerp(s.sy,s.ty,k);
  if(s.t>=s.dur){s.dead=true;landCandy(s);}}
 LV.beams=LV.beams.filter(s=>!s.dead);
 for(const l of LV.lures){l.t-=dt;if(Math.random()<dt*3)spawnPart(l.x+rand(-10,10),l.y,0,-20,0.5,"#ff6a8a",2);}
 LV.lures=LV.lures.filter(l=>l.t>0);
 for(const d of LV.decoys){d.t-=dt;d.ang+=dt*2;d.x+=Math.cos(d.ang)*20*dt;d.y+=Math.sin(d.ang)*20*dt;}
 LV.decoys=LV.decoys.filter(d=>d.t>0);
 for(const r of LV.rings){r.r+=(r.max-r)*dt*4;r.alpha-=dt*1.2;}
 LV.rings=LV.rings.filter(r=>r.alpha>0);
 for(const pt of LV.parts){pt.life-=dt;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=140*dt;}
 LV.parts=LV.parts.filter(p=>p.life>0);
 for(const t of LV.texts){t.life-=dt;t.y-=24*dt;}
 LV.texts=LV.texts.filter(t=>t.life>0);
 for(const c of LV.candies)if(c.dropT>0){c.dropT-=dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.vx*=0.9;c.vy*=0.9;}
 if(LV.apple&&LV.apple.cd>0)LV.apple.cd-=dt;
 LV.carouselT=(LV.carouselT||0)+dt;
 // music danger
 let dg=0;for(const a of LV.aliens){dg=Math.max(dg,a.state==="chase"?1:a.meter);}
 AU.danger=dg;
 if(LV.escape&&!LV.over){LV.chaseT+=dt;}
 // camera
 const p=LV.player;
 LV.cam.x=lerp(LV.cam.x,p.x,1-Math.pow(0.001,dt));
 LV.cam.y=lerp(LV.cam.y,p.y,1-Math.pow(0.001,dt));
 const ww=LV.tw*TILE;
 LV.cam.x=ww<VW?ww/2:clamp(LV.cam.x,VW/2,ww-VW/2);
 LV.cam.y=LV.th*TILE<VH?LV.th*TILE/2:clamp(LV.cam.y,VH/2,LV.th*TILE-VH/2);
 updateTopbar();
}
/* ---------- topbar ---------- */
function updateTopbar(){
 if(!LV)return;
 $("tb-candy").textContent=LV.player.candy;
 const elapsed=(LV.def.clockMin*12-LV.timeLeft)/12; // game-minutes elapsed
 $("tb-clock").textContent=clockLabel(G.lvl*30+elapsed);
 $("tb-fr").textContent=LV.def.flags.beamctl?("SW "+LV.switches.filter(s=>s.on).length+"/3"):(LV.rescued+"/"+LV.totalJars);
}
/* ---------- render ---------- */
let lightC=null;
function render(){
 ctx.setTransform(DPR,0,0,DPR,0,0);
 ctx.fillStyle="#0d0718";ctx.fillRect(0,0,VW,VH);
 if(!G.inGame||!LV){return;}
 const t=LV.startT;
 ctx.save();
 ctx.translate(Math.round(VW/2-LV.cam.x),Math.round(VH/2-LV.cam.y));
 const x0=Math.max(0,Math.floor((LV.cam.x-VW/2)/TILE)-1),x1=Math.min(LV.tw-1,Math.ceil((LV.cam.x+VW/2)/TILE)+1);
 const y0=Math.max(0,Math.floor((LV.cam.y-VH/2)/TILE)-1),y1=Math.min(LV.th-1,Math.ceil((LV.cam.y+VH/2)/TILE)+1);
 const pal=LV.def.pal;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)drawTile(ctx,LV.grid[y][x],x*TILE,y*TILE,pal);
 // conveyor arrows
 for(const c of LV.conveyors){ctx.fillStyle="rgba(255,255,255,.08)";ctx.fillRect(c.x,c.y,c.w,c.h);
  ctx.fillStyle="rgba(255,215,94,.5)";const off=(t*60)%36;
  for(let ax=c.x+8+off%36;ax<c.x+c.w-8;ax+=36)for(let ay=c.y+8;ay<c.y+c.h-8;ay+=32){
   ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+10,ay+6);ctx.lineTo(ax,ay+12);ctx.closePath();ctx.fill();}}
 // vision cones (under entities)
 for(const a of LV.aliens){
  if(a.type==="saucer"){
   const r=ALIEN_DEF.saucer.beamR;
   const g=ctx.createRadialGradient(a.bx,a.by,6,a.bx,a.by,r);
   const hot=a.beamT>0.2;
   g.addColorStop(0,hot?"rgba(255,120,90,.5)":"rgba(126,232,106,.4)");g.addColorStop(1,"rgba(126,232,106,0)");
   ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.bx,a.by,r,0,TAU);ctx.fill();
   ctx.strokeStyle=hot?"rgba(255,120,90,.8)":"rgba(126,232,106,.7)";ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(a.bx,a.by,r,0,TAU);ctx.stroke();
   // beam from saucer
   if(!reducedFlash()){const bg=ctx.createLinearGradient(a.x,a.y,a.bx,a.by);
    bg.addColorStop(0,"rgba(126,232,106,.35)");bg.addColorStop(1,"rgba(126,232,106,.05)");
    ctx.strokeStyle=bg;ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.bx,a.by);ctx.stroke();}
  }else if(a.range>0){
   const fov=a.fov===TAU?TAU:a.fov,range=a.range*TILE;
   const g=ctx.createRadialGradient(a.x,a.y,10,a.x,a.y,range);
   g.addColorStop(0,"rgba(126,232,106,.20)");g.addColorStop(1,"rgba(126,232,106,0)");
   ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(a.x,a.y);
   ctx.arc(a.x,a.y,range,a.dir-fov/2,a.dir+fov/2);ctx.closePath();ctx.fill();
   if(a.type==="zorb"){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.arc(a.x,a.y,range*0.6,a.dir+Math.PI-0.45,a.dir+Math.PI+0.45);ctx.closePath();ctx.fill();}
  }
 }
 // depth-sorted draw list
 const DL=[];
 const inView=(x,y,m)=>x>LV.cam.x-VW/2-m&&x<LV.cam.x+VW/2+m&&y>LV.cam.y-VH/2-m&&y<LV.cam.y+VH/2+m;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const ch=LV.grid[y][x],px=x*TILE+TILE/2,py=y*TILE+TILE/2;
  if(!inView(px,py,60))continue;
  if(ch==="T")DL.push({y:py,f:()=>drawProp(ctx,"tree",px,py+10,t)});
  else if(ch==="H")DL.push({y:py,f:()=>drawProp(ctx,"wagon",px,py+8,t)});
  else if(ch==="V")DL.push({y:py,f:()=>drawProp(ctx,"carousel",px,py+10,LV.carouselT||0)});
  else if(ch==="L")DL.push({y:py,f:()=>drawProp(ctx,"leafpile",px,py+8,t)});
  else if(ch==="B")DL.push({y:py,f:()=>drawProp(ctx,"bush",px,py+8,t)});
  else if(ch==="C")DL.push({y:py,f:()=>drawProp(ctx,"trashcan",px,py+8,t)});
  else if(ch==="X")DL.push({y:py,f:()=>drawProp(ctx,"box",px,py+8,t)});
  else if(ch==="D")DL.push({y:py,f:()=>drawProp(ctx,"inflatable",px,py+8,t)});
  else if(ch==="O")DL.push({y:py-20,f:()=>drawProp(ctx,"porch",px,py+8,t)});
  else if(ch==="Y")DL.push({y:py,f:()=>drawProp(ctx,"pumpkinD",px,py+8,t)});
  else if(ch==="W")DL.push({y:py,f:()=>drawProp(ctx,"sheets",px,py+8,t)});
  else if(ch==="K")DL.push({y:py,f:()=>drawProp(ctx,"lawnskel",px,py+8,t)});
  else if(ch==="U")DL.push({y:py,f:()=>drawProp(ctx,"cauldron",px,py+8,t)});
  else if(ch==="Q")DL.push({y:py,f:()=>drawProp(ctx,"junk",px,py+8,t)});
  else if(ch==="Z")DL.push({y:py,f:()=>drawProp(ctx,"dino",px,py+8,t)});
  else if(ch==="M")DL.push({y:py,f:()=>drawProp(ctx,"sarc",px,py+8,t)});
  else if(ch==="F")DL.push({y:py,f:()=>drawProp(ctx,"coffin",px,py+8,t)});
 }
 for(const k of LV.checks)DL.push({y:k.y,f:()=>{drawProp(ctx,"lamp",k.x,k.y+6,t);if(!k.on){ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.arc(k.x,k.y-64,10,0,TAU);ctx.fill();}}});
 for(const j of LV.jars)if(!j.popped)DL.push({y:j.y,f:()=>{
  drawProp(ctx,"jar",j.x,j.y,t);
  const col=j.friend?BLOB_COLORS[FRIENDS[j.friend].color]:"#c9b8f0";
  glossBlob(ctx,j.x,j.y-26,13,{color:col,eyeDX:Math.sin(t*2+j.anim)*4,mouth:"o",sy:0.9+Math.sin(t*4+j.anim)*0.05});
 }});
 for(const c of LV.candies)if(!c.taken)DL.push({y:c.y-10,f:()=>drawProp(ctx,"candy",c.x,c.y-8,t)});
 for(const c of LV.corns)if(!c.taken)DL.push({y:c.y-10,f:()=>drawProp(ctx,"corn",c.x,c.y,t)});
 for(const c of LV.crowds)DL.push({y:c.y,f:()=>{
  glossBlob(ctx,c.x,c.y,17,{color:BLOB_COLORS[c.color],sx:1,sy:0.95+Math.sin(c.anim)*0.03});
  drawCostume(ctx,c.costume,17,{x:c.x,y:c.y});}});
 for(const w of LV.wagons)DL.push({y:w.y+10,f:()=>drawProp(ctx,"wagon",w.x,w.y,t)});
 for(const w of LV.pads)DL.push({y:w.y+10,f:()=>drawProp(ctx,"lilypad",w.x,w.y,t)});
 if(LV.apple)DL.push({y:LV.apple.y,f:()=>drawProp(ctx,"appletub",LV.apple.x,LV.apple.y+6,t)});
 for(const s of LV.switches)DL.push({y:s.y,f:()=>drawProp(ctx,"switch",s.x,s.y+6,t,false,{on:s.on})});
 if(LV.mountain)DL.push({y:LV.mountain.y,f:()=>{drawProp(ctx,"candymtn",LV.mountain.x,LV.mountain.y+10,t);
  ctx.fillStyle="#fff";ctx.font="bold 14px sans-serif";ctx.textAlign="center";
  ctx.fillText(LV.mountainGot+"/60",LV.mountain.x,LV.mountain.y-70);}});
 if(LV.beamctl)DL.push({y:LV.beamctl.y,f:()=>drawProp(ctx,"beamctl",LV.beamctl.x,LV.beamctl.y+6,t)});
 for(const l of LV.lures)DL.push({y:l.y-6,f:()=>{drawProp(ctx,"candy",l.x,l.y-8,t);
  ctx.strokeStyle="rgba(255,180,80,.7)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(l.x,l.y-8,14+Math.sin(t*6)*3,0,TAU);ctx.stroke();}});
 for(const d of LV.decoys)DL.push({y:d.y,f:()=>{
  ctx.fillStyle="rgba(240,200,220,.9)";ctx.beginPath();ctx.ellipse(d.x,d.y-24,16,20,0,0,TAU);ctx.fill();
  ctx.fillStyle="#26203a";ctx.beginPath();ctx.arc(d.x-5,d.y-28,3,0,TAU);ctx.arc(d.x+5,d.y-28,3,0,TAU);ctx.fill();}});
 for(const s of LV.beams)DL.push({y:s.y-20,f:()=>{const h=Math.sin(Math.min(1,s.t/s.dur)*Math.PI)*40;
  drawProp(ctx,"candy",s.x,s.y-10-h,t);}});
 for(const a of LV.aliens)DL.push({y:a.y+10,f:()=>{drawAlien(ctx,a);
  if(a.frozen>0){ctx.fillStyle="rgba(160,220,255,.45)";ctx.beginPath();ctx.arc(a.x,a.y,30,0,TAU);ctx.fill();}
  if(a.dizzy>0){ctx.fillStyle="#ffd75e";ctx.font="bold 18px sans-serif";ctx.textAlign="center";
   ctx.fillText("★ ★",a.x,a.y-46+Math.sin(t*6)*4);}}});
 // exit gate
 if(LV.hasExit)DL.push({y:LV.exitY,f:()=>{
  const open=LV.escape;
  ctx.save();ctx.translate(LV.exitX,LV.exitY);
  const g=ctx.createRadialGradient(0,-20,4,0,-20,70);
  g.addColorStop(0,open?"rgba(126,232,106,.75)":"rgba(120,120,140,.25)");g.addColorStop(1,"rgba(126,232,106,0)");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-20,70,0,TAU);ctx.fill();
  ctx.fillStyle=open?"#7ee86a":"#5a5a6a";
  ctx.fillRect(-26,-70,10,70);ctx.fillRect(16,-70,10,70);
  ctx.beginPath();ctx.arc(0,-70,26,Math.PI,0);ctx.fill();
  if(open){ctx.fillStyle="#fff";ctx.font="bold 15px sans-serif";ctx.textAlign="center";ctx.fillText("EXIT",0,-96);}
  else{ctx.fillStyle="#999";ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText("🔒 rescue all!",0,-96);}
  ctx.restore();}});
 // player
 DL.push({y:LV.player.y+14,f:()=>drawPlayer(t)});
 DL.sort((a,b)=>a.y-b.y);
 for(const d of DL)d.f();
 // rings & particles & texts
 for(const r of LV.rings){ctx.strokeStyle=`rgba(255,255,255,${r.alpha})`;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke();}
 for(const pt of LV.parts){ctx.globalAlpha=clamp(pt.life/pt.maxLife,0,1);ctx.fillStyle=pt.color;
  ctx.beginPath();ctx.arc(pt.x,pt.y,pt.size,0,TAU);ctx.fill();ctx.globalAlpha=1;}
 ctx.textAlign="center";
 for(const tx of LV.texts){ctx.globalAlpha=clamp(tx.life,0,1);ctx.font="bold 17px sans-serif";
  ctx.strokeStyle="rgba(0,0,0,.8)";ctx.lineWidth=4;ctx.strokeText(tx.txt,tx.x,tx.y);
  ctx.fillStyle=tx.color;ctx.fillText(tx.txt,tx.x,tx.y);ctx.globalAlpha=1;}
 // caught beam animation
 if(LV.catchAnim){const ca=LV.catchAnim;ca.t+=1/60;const p=LV.player;
  const lift=Math.min(1,ca.t/1.2);
  ctx.save();
  const bg=ctx.createLinearGradient(p.x,-100,p.x,p.y);
  bg.addColorStop(0,"rgba(126,232,106,0)");bg.addColorStop(1,"rgba(126,232,106,.8)");
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.moveTo(p.x-30,-100);ctx.lineTo(p.x+30,-100);ctx.lineTo(p.x+50,p.y);ctx.lineTo(p.x-50,p.y);ctx.closePath();ctx.fill();
  if(!reducedFlash())for(let i=0;i<8;i++){ctx.fillStyle=`rgba(255,255,255,${0.5+Math.sin(t*10+i)*0.3})`;
   ctx.beginPath();ctx.arc(p.x+Math.sin(i*2+t*6)*36,p.y-((t*160+i*53)%260),3,0,TAU);ctx.fill();}
  ctx.restore();}
 ctx.restore();
 drawLighting(t);
 drawTouchUI();
}
function drawPlayer(t){
 const p=LV.player;
 const moving=Math.hypot(p.vx,p.vy)>30;
 const sq=p.squish;
 let sx=1+sq*0.14,sy=1-sq*0.10;
 if(!moving){const b=Math.sin(t*3)*0.03;sx=1+b;sy=1-b;}
 if(p.rollT>0){sx=1.15;sy=0.85;}
 const col=BLOB_COLORS[prof().color]||"#7fe6b8";
 const bob=p.floatT>0?-26:0;
 if(p.floatT>0){ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(p.x,p.y+16,16,6,0,0,TAU);ctx.fill();}
 const hidden=p.hidden;
 glossBlob(ctx,p.x,p.y+bob,16,{color:col,sx,sy,eyeDX:Math.cos(p.dir)*5,eyeDY:Math.sin(p.dir)*5,
  blink:p.blink>0,mouth:p.caught?"o":(moving?"smile":"smile"),hidden:hidden,alpha:p.caught?0.6:1});
 if(!hidden){
  drawCostume(ctx,p.costume,16,{x:p.x,y:p.y+bob,wob:t*4});
  drawHat(ctx,prof().hat,16);
  if(p.camo){ctx.strokeStyle=`rgba(201,242,126,${0.5+Math.sin(t*6)*0.3})`;ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(p.x,p.y+bob,24,0,TAU);ctx.stroke();}
  if(p.floatT>0){ctx.fillStyle="rgba(230,230,255,.5)";ctx.beginPath();ctx.ellipse(p.x,p.y+bob+14,20,8,0,0,TAU);ctx.fill();}
 }
}
function drawLighting(t){
 const dark=LV.def.flags.dark?0.78:0.5;
 if(!lightC||lightC.width!==Math.floor(VW)||lightC.height!==Math.floor(VH)){
  lightC=document.createElement("canvas");lightC.width=Math.floor(VW);lightC.height=Math.floor(VH);}
 const lc=lightC.getContext("2d");
 lc.setTransform(1,0,0,1,0,0);lc.globalCompositeOperation="source-over";lc.clearRect(0,0,VW,VH);
 lc.fillStyle=`rgba(8,4,22,${dark})`;lc.fillRect(0,0,VW,VH);
 lc.globalCompositeOperation="destination-out";
 const hole=(x,y,r,a)=>{const sx=x-LV.cam.x+VW/2,sy=y-LV.cam.y+VH/2;
  if(sx<-r||sx>VW+r||sy<-r||sy>VH+r)return;
  const g=lc.createRadialGradient(sx,sy,r*0.2,sx,sy,r);
  g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,"rgba(0,0,0,0)");
  lc.fillStyle=g;lc.beginPath();lc.arc(sx,sy,r,0,TAU);lc.fill();};
 hole(LV.player.x,LV.player.y,LV.def.flags.dark?260:190,0.95);
 for(const k of LV.checks)hole(k.x,k.y-60,120,0.8);
 for(const j of LV.jars)if(!j.popped)hole(j.x,j.y-24,90,0.7);
 for(const a of LV.aliens)hole(a.x,a.y,a.type==="queen"?200:80,0.55);
 if(LV.escape)hole(LV.exitX,LV.exitY,140,0.8);
 ctx.drawImage(lightC,0,0,VW,VH);
 // colored glows
 ctx.save();ctx.globalCompositeOperation="lighter";
 ctx.translate(Math.round(VW/2-LV.cam.x),Math.round(VH/2-LV.cam.y));
 for(const a of LV.aliens){if(a.type==="saucer"||a.type==="queen")continue;
  const g=ctx.createRadialGradient(a.x,a.y,4,a.x,a.y,60);
  g.addColorStop(0,"rgba(126,232,106,.20)");g.addColorStop(1,"rgba(126,232,106,0)");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.x,a.y,60,0,TAU);ctx.fill();}
 ctx.restore();ctx.globalCompositeOperation="source-over";
 // fog
 if(LV.def.flags.fog){ctx.save();ctx.globalAlpha=0.16;ctx.fillStyle="#b8c4d8";
  for(let i=0;i<12;i++){const fx=((t*14*(1+i%3)+i*347)%(VW+300))-150,fy=(i*97+Math.sin(t*0.5+i)*30)%VH;
   ctx.beginPath();ctx.ellipse(fx,fy,120,34,0,0,TAU);ctx.fill();}
  ctx.restore();}
 // fireflies
 if(LV.def.flags.fireflies){for(let i=0;i<22;i++){
  const fx=LV.cam.x-VW/2+((i*211+t*23)%(VW+100))-50,fy=LV.cam.y-VH/2+((i*137+t*31)%(VH+100))-50;
  const sx=fx-LV.cam.x+VW/2,sy=fy-LV.cam.y+VH/2;
  ctx.fillStyle=`rgba(255,255,180,${0.5+Math.sin(t*4+i)*0.4})`;
  ctx.beginPath();ctx.arc(sx,sy,2.5,0,TAU);ctx.fill();}}
}
function drawTouchUI(){
 // joystick
 if(IN.joy.on){const j=IN.joy;
  ctx.strokeStyle="rgba(255,255,255,.35)";ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(j.ox,j.oy,64,0,TAU);ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.45)";
  ctx.beginPath();ctx.arc(j.ox+j.dx*64,j.oy+j.dy*64,28,0,TAU);ctx.fill();}
 // aim arc
 if(IN.aim.on&&LV){const dx=IN.aim.dx,dy=IN.aim.dy,m=Math.hypot(dx,dy);
  if(m>15){const p=LV.player,ang=Math.atan2(dy,dx),pow=clamp(m/140,0.4,1);
   const T=THROWS[prof().throwSel]||THROWS.corn,R=T.range*TILE*pow;
   const tx=p.x+Math.cos(ang)*R,ty=p.y+Math.sin(ang)*R;
   const sx0=p.x-LV.cam.x+VW/2,sy0=p.y-LV.cam.y+VH/2,ex=tx-LV.cam.x+VW/2,ey=ty-LV.cam.y+VH/2;
   ctx.strokeStyle="rgba(255,200,100,.85)";ctx.lineWidth=3;ctx.setLineDash([8,6]);
   ctx.beginPath();ctx.moveTo(sx0,sy0);
   ctx.quadraticCurveTo((sx0+ex)/2,(sy0+ey)/2-70,ex,ey);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle="rgba(255,120,120,.9)";ctx.beginPath();ctx.arc(ex,ey,10,0,TAU);ctx.fill();}}
}
/* ---------- pause ---------- */
$("btn-pause").addEventListener("click",()=>{if(G.screen!=="play"||!LV||LV.done)return;
 AU.sfx.click();G.paused=true;renderPauseCostumes();renderPauseThrow();show("s-pause");});
function renderPauseCostumes(){
 const w=$("pause-costumes");w.innerHTML="";
 const pr=prof();
 for(const id of Object.keys(COSTUMES)){
  const owned=pr.costumes.includes(id);
  const b=el("button","costbtn"+(pr.selCostume===id?" sel":"")+(owned?"":" locked"));
  const c2=document.createElement("canvas");c2.width=64;c2.height=64;
  const g2=c2.getContext("2d");
  glossBlob(g2,32,34,18,{color:BLOB_COLORS[pr.color]});
  drawCostume(g2,id,18,{x:32,y:34});
  b.appendChild(c2);b.title=COSTUMES[id].name+" — "+COSTUMES[id].pdesc;
  if(owned)b.addEventListener("click",()=>{pr.selCostume=id;storeSave();AU.sfx.click();
   if(LV)LV.player.costume=id;updateCostumeHUD();renderPauseCostumes();});
  w.appendChild(b);
 }
}
function renderPauseThrow(){
 const w=$("pause-throw");w.innerHTML="";
 const pr=prof();
 for(const id of Object.keys(THROWS)){
  const owned=pr.ownedThrows.includes(id);
  const b=el("button","btn small"+(pr.throwSel===id?"":" ghost"),THROWS[id].name+(owned?"":" ("+THROWS[id].cost+")"));
  if(owned)b.addEventListener("click",()=>{pr.throwSel=id;storeSave();AU.sfx.click();renderPauseThrow();});
  w.appendChild(b);
 }
}
$("btn-resume").addEventListener("click",()=>{AU.sfx.click();$("s-pause").classList.remove("on");G.screen="play";G.paused=false;});
$("btn-prestart").addEventListener("click",()=>{AU.sfx.click();$("s-pause").classList.remove("on");beginLevel(G.lvl);});
$("btn-pmap").addEventListener("click",()=>{AU.sfx.click();$("hud").classList.remove("on");G.paused=false;G.inGame=false;show("s-map");});
$("btn-pset").addEventListener("click",()=>{AU.sfx.click();G.returnTo="pause";show("s-set");renderSettings();});
$("btn-phow").addEventListener("click",()=>{AU.sfx.click();G.returnTo="pause";show("s-how");renderHow();});
/* ---------- finish / complete ---------- */
function timeoutFinish(){prof().stats.late++;finishLevel(true);}
function finishLevel(timeout){
 if(!LV||LV.done)return;LV.done=true;LV.over=true;
 const pr=prof();
 let stars=(LV.rescued>=LV.totalJars?1:0)+(LV.caught===0?1:0)+(LV.cornsGot>=3?1:0);
 if(stars===0)stars=1;
 if(!LV.spotted)pr.stats.ghosted++;
 const key=G.lvl+1;
 pr.stars[key]=Math.max(pr.stars[key]||0,stars);
 if(key<10)pr.unlocked=Math.max(pr.unlocked,key+1);else pr.unlocked=10;
 const secs=Math.round(LV.startT);
 if(!pr.best[key]||secs<pr.best[key])pr.best[key]=secs;
 storeSave();checkAchv();
 AU.sfx.win();AU.setMode("title");
 $("hud").classList.remove("on");
 $("done-title").textContent=(timeout?"Time's up! ":"")+LEVELS[G.lvl].name+" complete!";
 let sh="";for(let i=0;i<3;i++)sh+=`<span class="${i<stars?"":"off"}">★</span>`;
 $("done-stars").innerHTML=sh;
 $("done-stats").innerHTML=`Friends rescued: <b>${LV.rescued}/${LV.totalJars}</b><br>`+
  `Times caught: <b>${LV.caught}</b> · Golden corn: <b>${LV.cornsGot}/3</b><br>`+
  `Candy earned: <b>${LV.candyEarned}</b> · Time: <b>${fmtTime(secs)}</b>`+
  (timeout?"<br><i>The clock ran out — no worries, you still did great!</i>":"");
 $("btn-donenext").style.display=G.lvl<9?"":"none";
 show("s-done");
}
$("btn-donenext").addEventListener("click",()=>{AU.sfx.click();openStory(G.lvl+1);});
$("btn-donereplay").addEventListener("click",()=>{AU.sfx.click();beginLevel(G.lvl);});
$("btn-donemap").addEventListener("click",()=>{AU.sfx.click();G.inGame=false;show("s-map");});
/* L10 ending */
function winSequence(){
 LV.over=true;AU.sfx.win();AU.setMode("title");
 $("hud").classList.remove("on");
 $("story-img").src="assets/story-end.png";
 $("story-title").textContent="Everyone floats home!";
 const full="The beam reverses in a sparkle of green light! One by one, every blob kid floats down from the sky, right into their own front yards. The Zorblings wave goodbye — and Queen Glorpa keeps a single crayon drawing of Pip for her Space Zoo instead.";
 const txt=$("story-txt");txt.textContent="";let ci=0;
 if(storyTimer)clearInterval(storyTimer);
 storyTimer=setInterval(()=>{ci++;txt.textContent=full.slice(0,ci);if(ci%3===0)AU.sfx.blip();
  if(ci>=full.length)clearInterval(storyTimer);},26);
 $("story-hint").textContent="";
 $("btn-storygo").textContent="Finish";
 $("btn-storygo").onclick=()=>{if(storyTimer)clearInterval(storyTimer);$("btn-storygo").textContent="Start";finishLevel(false);};
 show("s-story");
}
/* ---------- main loop ---------- */
let lastT=0,acc=0;
function frame(tms){
 requestAnimationFrame(frame);
 const now=tms/1000;let dt=Math.min(0.1,now-(lastT||now));lastT=now;
 if(G.inGame&&G.screen==="play"&&!G.paused&&LV&&!LV.done){
  acc+=dt;let n=0;
  while(acc>=1/60&&n<5){updWorld(1/60);acc-=1/60;n++;}
  if(n===5)acc=0;
 }else if(LV&&LV.done){acc=0;}
 try{render();}catch(err){if(!window.__errT||Date.now()-window.__errT>5000){window.__errT=Date.now();console.error(err);}}
}
/* ---------- init ---------- */
loadSave();resize();AU.setMode("title");
window.addEventListener("pointerdown",()=>{AU.resume();},{passive:true});
document.addEventListener("touchstart",()=>{AU.resume();},{passive:true});
requestAnimationFrame(frame);
/* ---------- achievements ---------- */
function checkAchv(){
 const pr=prof();let changed=false;
 for(const a of ACHVS){if(!pr.achv[a.id]){
  try{if(a.check(pr.stats,pr)){pr.achv[a.id]=Date.now();changed=true;
   setTimeout(()=>{toast("Achievement: <b>"+a.name+"</b>!");AU.sfx.star();},800);}}catch(e){}}}
 if(changed)storeSave();
}
/* ---------- shop ---------- */
function openShop(from){
 G.shopReturn=from||"s-map";G.returnTo="shop";
 $("shop-candy").textContent=prof().candy;
 const list=$("shop-list");list.innerHTML="";
 const pr=prof();
 const sec=t=>{const h=el("h3","",t);h.style.cssText="color:#ffb347;margin:12px 0 4px";list.appendChild(h);};
 const item=(name,desc,owned,equipped,action)=>{
  const d=el("div","shopitem"+(equipped?" equipped":owned?" owned":""));
  d.innerHTML=`<div class="sinfo"><div class="sname"></div><div class="sdesc"></div></div>`;
  d.querySelector(".sname").textContent=name;d.querySelector(".sdesc").textContent=desc;
  const b=el("button","btn small"+(owned?" ghost":""),owned?(equipped?"Equipped":"Use"):"Buy");
  b.addEventListener("click",e=>{e.stopPropagation();action();});
  d.appendChild(b);list.appendChild(d);};
 sec("Throwables — what your THROW button tosses");
 for(const id of Object.keys(THROWS)){const T=THROWS[id],owned=pr.ownedThrows.includes(id);
  item(T.name+(owned?"":" — "+T.cost+" candy"),T.desc,owned,pr.throwSel===id,()=>{
   if(owned){pr.throwSel=id;AU.sfx.click();}
   else if(pr.candy>=T.cost){pr.candy-=T.cost;pr.ownedThrows.push(id);pr.throwSel=id;AU.sfx.star();toast("Bought "+T.name+"!");}
   else{toast("Not enough candy!");return;}
   storeSave();openShop(G.shopReturn);});}
 sec("Hats (just for fun)");
 for(const h of HATS){const owned=pr.hatsOwned.includes(h.id);
  item(h.name+(owned?"":" — "+h.cost+" candy"),"A snazzy look. No gameplay effect.",owned,pr.hat===h.id,()=>{
   if(owned){pr.hat=pr.hat===h.id?null:h.id;AU.sfx.click();}
   else if(pr.candy>=h.cost){pr.candy-=h.cost;pr.hatsOwned.push(h.id);pr.hat=h.id;AU.sfx.star();}
   else{toast("Not enough candy!");return;}
   storeSave();openShop(G.shopReturn);});}
 sec("Blob colors");
 for(const c of BCOLORS){const owned=pr.colorsOwned.includes(c.id);
  item(c.name+(owned?"":" — "+c.cost+" candy"),"Change Pip's blob color.",owned,pr.color===c.id,()=>{
   if(owned){pr.color=c.id;AU.sfx.click();}
   else if(pr.candy>=c.cost){pr.candy-=c.cost;pr.colorsOwned.push(c.id);pr.color=c.id;AU.sfx.star();}
   else{toast("Not enough candy!");return;}
   storeSave();openShop(G.shopReturn);});}
 sec("Trails");
 for(const t of TRAILS){const owned=pr.trailsOwned.includes(t.id);
  item(t.name+(owned?"":" — "+t.cost+" candy"),"A sparkly trail when you move.",owned,pr.trail===t.id,()=>{
   if(owned){pr.trail=pr.trail===t.id?null:t.id;AU.sfx.click();}
   else if(pr.candy>=t.cost){pr.candy-=t.cost;pr.trailsOwned.push(t.id);pr.trail=t.id;AU.sfx.star();}
   else{toast("Not enough candy!");return;}
   storeSave();openShop(G.shopReturn);});}
 show("s-shop");
}
$("btn-shopback").addEventListener("click",()=>{AU.sfx.click();show(G.shopReturn||"s-map");});
/* ---------- treat book ---------- */
function openBook(){
 const pr=prof(),list=$("book-list");list.innerHTML="";
 const sec=t=>{const h=el("h3","",t);h.style.cssText="color:#ffb347;margin:12px 0 4px";list.appendChild(h);};
 const entry=(t,d)=>{const e=el("div","bookentry",`<h3></h3><p></p>`);e.querySelector("h3").textContent=t;e.querySelector("p").textContent=d;list.appendChild(e);};
 sec("Aliens met");
 for(const id of Object.keys(ALIENS)){entry(pr.book.aliens[id]?ALIENS[id].name:"???",
  pr.book.aliens[id]?ALIENS[id].tip:"You haven't met this one... yet.");}
 sec("Friends rescued");
 for(const id of Object.keys(FRIENDS)){const F=FRIENDS[id];
  entry(pr.book.friends[id]?F.name+" ("+COSTUMES[F.costume].name+" costume)":"???",
   pr.book.friends[id]?F.desc:"Still trapped in a Jelly Jar somewhere...");}
 sec("Golden Candy Corns");
 LEVELS.forEach((L,i)=>{let n=0;for(let k=0;k<3;k++)if(pr.book.corns[i+"_"+k])n++;
  entry(L.name,n+" / 3 found");});
 show("s-book");
}
$("btn-bookback").addEventListener("click",()=>{AU.sfx.click();show("s-map");});
/* ---------- achievements screen ---------- */
function openAchv(){
 const pr=prof(),list=$("achv-list");list.innerHTML="";
 for(const a of ACHVS){const got=!!pr.achv[a.id];
  const e=el("div","achv"+(got?"":" locked"));
  e.innerHTML=`<h3>${got?'<span class="adone">★</span> ':""}${a.name}</h3><p>${a.desc}</p>`;
  list.appendChild(e);}
 show("s-achv");
}
$("btn-achvback").addEventListener("click",()=>{AU.sfx.click();show("s-map");});
/* ---------- opening story (once per profile) ---------- */
const _openStory=openStory;
openStory=function(i){
 $("btn-storygo").textContent="Start";
 if(i===0&&!prof().book.opened){
  prof().book.opened=true;storeSave();
  $("story-img").src="assets/story-open.png";
  $("story-title").textContent="The night the Zorblings came";
  $("story-hint").textContent="";
  const full="It is Halloween night in Gumdrop Hollow, where everyone is a squishy jelly blob. At 7:00 PM, a fleet of goofy one-eyed aliens called the Zorblings arrives! Their queen wants the cutest creatures in the galaxy for her Space Zoo... and nothing is cuter than blob kids in Halloween costumes. Saucers start beaming kids up, one by one. But one little blob — PIP, in a homemade cardboard robot costume — was hiding in a leaf pile, and missed the first beam. Now it's up to Pip to sneak through town and free every friend before midnight!";
  const txt=$("story-txt");txt.textContent="";let ci=0;
  if(storyTimer)clearInterval(storyTimer);
  storyTimer=setInterval(()=>{ci++;txt.textContent=full.slice(0,ci);if(ci%3===0)AU.sfx.blip();AU.duck();
   if(ci>=full.length)clearInterval(storyTimer);},26);
  $("btn-storygo").onclick=()=>{if(storyTimer)clearInterval(storyTimer);AU.sfx.click();_openStory(i);};
  const fr=$("s-story");
  const hs=e=>{e.preventDefault();storyHoldT=setTimeout(()=>{if(storyTimer)clearInterval(storyTimer);_openStory(i);},900);};
  const he=()=>{if(storyHoldT)clearTimeout(storyHoldT);};
  fr.ontouchstart=hs;fr.ontouchend=he;fr.onmousedown=hs;fr.onmouseup=he;
  show("s-story");return;
 }
 _openStory(i);
};
