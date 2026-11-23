(() => {
"use strict";
const $ = id => document.getElementById(id);
const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
const ui = {
  level:$("levelText"), xp:$("xpText"), score:$("scoreText"), health:$("healthBar"),
  healthText:$("healthText"), wave:$("waveText"), bossWrap:$("bossWrap"),
  bossName:$("bossName"), bossHealth:$("bossHealthBar"), bossHealthText:$("bossHealthText"),
  notice:$("notice"), start:$("startOverlay"), shop:$("shopOverlay"), confirm:$("confirmOverlay"),
  result:$("resultOverlay")
};
const BOSS_NAMES = ["KẺ HỦY DIỆT","MÃNG XÀ VŨ TRỤ","ĐẠI TƯỚNG BÓNG ĐÊM","PHÁO ĐÀI HỦY DIỆT","CHÚA TỂ THIÊN HÀ"];
const WAVE_COUNTS = [0,2,2,3,3,3];
const WEAPONS = [
  {name:"Đạn đơn",damage:12,cost:0,shots:1},
  {name:"Đạn đôi",damage:13,cost:10,shots:2},
  {name:"Đạn ba",damage:14,cost:15,shots:3},
  {name:"Đạn tỏa",damage:16,cost:20,shots:3},
  {name:"Đạn năng lượng",damage:25,cost:25,shots:5}
];
let W=800,H=600,dpr=1, raf=0,last=0,elapsed=0,gameActive=false,gameEnded=false,shopOpen=false;
let level=1,initialXp=10,xp=10,xpSpent=0,score=0,health=100,weaponLevel=0,wave=1,waveKills=0,spawned=0;
let player,bullets=[],enemies=[],enemyBullets=[],particles=[],boss=null,keys={left:false,right:false,fire:false};
let lastShot=0,spawnTimer=0,noticeTimer=0,shieldUntil=0,confirmAction=null,finishedSent=false;
const rand=(a,b)=>Math.random()*(b-a)+a;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function resize(){
 const r=canvas.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
 W=Math.max(320,r.width); H=Math.max(360,r.height);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(player) player.y=H-62;
}
window.addEventListener("resize",resize);
function resetWorld(){
 player={x:W/2,y:H-62,w:34,h:38,speed:330,invuln:0};
 bullets=[];enemies=[];enemyBullets=[];particles=[];boss=null;
 health=100;score=0;wave=1;waveKills=0;spawned=0;spawnTimer=.5;elapsed=0;
 shieldUntil=performance.now()+5000;lastShot=0;gameEnded=false;finishedSent=false;
 updateHud();
}
function updateHud(){
 ui.level.textContent=level;ui.xp.textContent=xp;ui.score.textContent=score;
 ui.health.style.width=health+"%";ui.healthText.textContent=Math.ceil(health)+"%";
 ui.wave.textContent=`ĐỢT ${Math.min(wave,WAVE_COUNTS[level])} / ${WAVE_COUNTS[level]}`;
 $("shopXp").textContent=xp;
 const w=WEAPONS[weaponLevel];$("weaponDescription").textContent=`${w.name} · Sát thương ${w.damage}`;
 $("weaponCost").textContent=weaponLevel>=4?"Đã đạt cấp tối đa":`${WEAPONS[weaponLevel+1].cost} XP`;
 $("upgradeBtn").disabled=weaponLevel>=4||xp<WEAPONS[weaponLevel+1].cost;
 $("healBtn").disabled=xp<10||health>=100;
 $("upgradeBtn").style.opacity=$("upgradeBtn").disabled?".45":"1";
 $("healBtn").style.opacity=$("healBtn").disabled?".45":"1";
}
function showNotice(text,ms=1800){ui.notice.textContent=text;ui.notice.classList.remove("hidden");noticeTimer=ms/1000;}
function hideOverlays(){ui.start.classList.add("hidden");ui.shop.classList.add("hidden");ui.confirm.classList.add("hidden");}
function getBridgeState(){
 const s=window.PyQuestBridge?.state||{};
 level=clamp(parseInt(s.level||s.gameConfig?.level||1,10)||1,1,5);
 initialXp=Math.max(0,Number(s.currentXp??10)||0);xp=initialXp;xpSpent=0;
}
function bridgeInit(){getBridgeState();resetWorld();updateHud();}
function beginGame(){
 if(gameEnded)return;
 ui.start.classList.add("hidden");gameActive=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}
function openShop(){
 if(!gameActive||gameEnded||shopOpen)return;
 shopOpen=true;ui.shop.classList.remove("hidden");updateHud();
}
function closeShop(){shopOpen=false;ui.shop.classList.add("hidden");last=performance.now();}
function askConfirm(title,text,action){
 $("confirmTitle").textContent=title;$("confirmText").textContent=text;confirmAction=action;ui.confirm.classList.remove("hidden");
}
function purchaseUpgrade(){
 if(weaponLevel>=4)return;
 const cost=WEAPONS[weaponLevel+1].cost;
 if(xp<cost)return;
 askConfirm("NÂNG CẤP VŨ KHÍ",`Dùng ${cost} XP để nâng cấp lên ${WEAPONS[weaponLevel+1].name}?`,()=>{
   xp-=cost;xpSpent+=cost;weaponLevel++;updateHud();playSound("correct");
 });
}
function purchaseHeal(){
 if(xp<10||health>=100)return;
 askConfirm("HỒI PHỤC SINH LỰC","Dùng 10 XP để hồi thêm 30% máu?",()=>{
   xp-=10;xpSpent+=10;health=Math.min(100,health+30);updateHud();playSound("correct");
 });
}
function playSound(name){try{window.SoundManager?.play?.(name);}catch(e){}}
function fire(){
 if(!gameActive||gameEnded||shopOpen)return;
 const now=performance.now();if(now-lastShot<180)return;lastShot=now;
 const w=WEAPONS[weaponLevel],spacing=9;
 for(let i=0;i<w.shots;i++){
   const offset=(i-(w.shots-1)/2)*spacing;
   bullets.push({x:player.x+offset,y:player.y-22,vy:-570,damage:w.damage,r:4});
 }
 playSound("click");
}
function spawnEnemy(){
 const type=Math.random();
 const hp=type<.65?25:type<.88?40:55;
 enemies.push({x:rand(24,W-24),y:-30,r:type<.65?14: type<.88?17:19,hp,maxHp:hp,
   speed:rand(65,105)+(level-1)*9,drift:rand(-35,35),shoot:rand(1.4,3.8),kind:type});
}
function spawnBoss(){
 const maxHp=650+level*210;
 boss={x:W/2,y:85,r:42,hp:maxHp,maxHp,dir:1,shoot:1.2,phase:0,age:0};
 ui.bossName.textContent=BOSS_NAMES[level-1];ui.bossWrap.classList.remove("hidden");
 showNotice(`⚠ CẢNH BÁO BOSS ⚠\n${BOSS_NAMES[level-1]}`,2200);
}
function damagePlayer(amount){
 if(performance.now()<shieldUntil||player.invuln>0)return;
 health=Math.max(0,health-amount);player.invuln=.65;updateHud();
 if(health<=0)endGame(false,"Tàu chiến đã bị phá hủy!");
}
function burst(x,y,color,n=8){
 for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-130,130),vy:rand(-130,130),life:rand(.2,.6),max:.6,color});
}
function update(dt){
 elapsed+=dt;
 if(elapsed>=240){endGame(false,"Đã hết thời gian chiến đấu!");return;}
 if(player.invuln>0)player.invuln-=dt;
 if(keys.left)player.x-=player.speed*dt;
 if(keys.right)player.x+=player.speed*dt;
 player.x=clamp(player.x,20,W-20);
 if(keys.fire)fire();
 spawnTimer-=dt;
 if(spawnTimer<=0&&!boss){
   const total=level<=2?5+level*2:6+level;
   if(spawned<total){spawnEnemy();spawned++;spawnTimer=Math.max(.42,.95-level*.08);}
   else if(enemies.length===0){spawnBoss();}
 }
 bullets.forEach(b=>b.y+=b.vy*dt);
 bullets=bullets.filter(b=>b.y>-20);
 for(const e of enemies){
   e.y+=e.speed*dt;e.x+=Math.sin(elapsed*2+e.y*.02)*e.drift*dt;
   e.shoot-=dt;
   if(e.shoot<=0&&e.y>25&&e.y<H*.65){enemyBullets.push({x:e.x,y:e.y+12,vy:220+level*15,r:5});e.shoot=rand(2.2,4);}
   if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+15){e.hp=0;damagePlayer(12);}
   if(e.y>H+20){e.hp=0;damagePlayer(8);}
 }
 enemies=enemies.filter(e=>e.hp>0);
 for(const b of bullets){
   for(const e of enemies){if(e.hp>0&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+b.r){e.hp-=b.damage;b.y=-100;if(e.hp<=0){score+=10;waveKills++;burst(e.x,e.y,"#ffbb66",10);}break;}}
   if(boss&&Math.hypot(b.x-boss.x,b.y-boss.y)<boss.r+b.r){boss.hp-=b.damage;b.y=-100;}
 }
 if(boss){
   boss.age+=dt;boss.x+=boss.dir*(90+level*10)*dt;
   if(boss.x>W-boss.r||boss.x<boss.r)boss.dir*=-1;
   boss.shoot-=dt;
   if(boss.shoot<=0){
     const count=boss.phase>=2?5:boss.phase>=1?3:2;
     for(let i=0;i<count;i++)enemyBullets.push({x:boss.x+(i-(count-1)/2)*17,y:boss.y+boss.r,vy:250+level*18,r:6});
     boss.shoot=boss.phase>=2?.75:boss.phase>=1?1.0:1.35;
   }
   const pct=boss.hp/boss.maxHp;
   const phase=pct<=.4?2:pct<=.7?1:0;
   if(phase>boss.phase){boss.phase=phase;showNotice(phase===1?"BOSS TĂNG CƯỜNG TẤN CÔNG!":"BOSS VÀO TRẠNG THÁI CUỒNG NỘ!",1500);}
   ui.bossHealth.style.width=Math.max(0,pct*100)+"%";ui.bossHealthText.textContent=Math.ceil(Math.max(0,pct*100))+"%";
   if(boss.hp<=0){
     burst(boss.x,boss.y,"#ff6a8a",35);boss=null;ui.bossWrap.classList.add("hidden");
     if(wave>=WAVE_COUNTS[level]){endGame(true,"Bạn đã tiêu diệt toàn bộ kẻ địch!");return;}
     wave++;spawned=0;spawnTimer=1.5;showNotice(`HOÀN THÀNH ĐỢT ${wave-1}\nChuẩn bị đợt tiếp theo!`,1700);
   }
 }
 for(const b of enemyBullets){b.y+=b.vy*dt;if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+13){b.y=H+100;damagePlayer(8);}}
 enemyBullets=enemyBullets.filter(b=>b.y<H+20);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
 if(noticeTimer>0){noticeTimer-=dt;if(noticeTimer<=0)ui.notice.classList.add("hidden");}
 updateHud();
}
function draw(){
 ctx.clearRect(0,0,W,H);
 // starfield
 for(let i=0;i<70;i++){const x=(i*97+Math.floor(elapsed*18)*(i%3+1))%W;const y=(i*137+elapsed*(25+i%4*10))%H;ctx.fillStyle=i%5===0?"#7deaff":"#486989";ctx.globalAlpha=.25+(i%4)*.12;ctx.fillRect(x,y,i%5===0?2:1,i%5===0?2:1);}
 ctx.globalAlpha=1;
 // player ship
 if(player){
   const flashing=player.invuln>0&&Math.floor(elapsed*18)%2===0;
   if(!flashing){
    ctx.save();ctx.translate(player.x,player.y);
    ctx.fillStyle="#49d9ff";ctx.beginPath();ctx.moveTo(0,-23);ctx.lineTo(18,17);ctx.lineTo(0,10);ctx.lineTo(-18,17);ctx.closePath();ctx.fill();
    ctx.fillStyle="#e8fbff";ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(6,8);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();
    ctx.fillStyle="#ff9b40";ctx.fillRect(-5,16,4,9+Math.sin(elapsed*25)*3);ctx.fillRect(2,16,4,9+Math.sin(elapsed*25)*3);
    ctx.restore();
   }
   if(performance.now()<shieldUntil){ctx.strokeStyle="#6eeaff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,29,0,Math.PI*2);ctx.stroke();}
 }
 ctx.fillStyle="#91f4ff";for(const b of bullets){ctx.shadowColor="#3eefff";ctx.shadowBlur=10;ctx.fillRect(b.x-2,b.y-10,4,14);}ctx.shadowBlur=0;
 for(const e of enemies){ctx.fillStyle=e.kind<.65?"#f2a34e":e.kind<.88?"#d56dff":"#f05c75";ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(e.x-7,e.y-3,4,4);ctx.fillRect(e.x+3,e.y-3,4,4);}
 if(boss){ctx.save();ctx.translate(boss.x,boss.y);ctx.fillStyle="#c42e62";ctx.beginPath();ctx.moveTo(0,-boss.r);ctx.lineTo(boss.r,0);ctx.lineTo(22,boss.r);ctx.lineTo(0,boss.r-12);ctx.lineTo(-22,boss.r);ctx.lineTo(-boss.r,0);ctx.closePath();ctx.fill();ctx.strokeStyle="#ff9bb5";ctx.lineWidth=3;ctx.stroke();ctx.restore();}
 ctx.fillStyle="#ff7b70";for(const b of enemyBullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
}
function loop(now){
 if(!gameActive||gameEnded)return;
 const dt=Math.min(.033,(now-last)/1000||0);last=now;
 if(!shopOpen)update(dt);
 draw();raf=requestAnimationFrame(loop);
}
function endGame(won,message){
 if(gameEnded)return;gameEnded=true;gameActive=false;shopOpen=false;cancelAnimationFrame(raf);
 ui.shop.classList.add("hidden");ui.confirm.classList.add("hidden");
 $("resultIcon").textContent=won?"🏆":"💥";$("resultTitle").textContent=won?"CHIẾN THẮNG!":"THẤT BẠI!";
 $("resultMessage").textContent=message;$("initialXpResult").textContent=initialXp;
 $("spentXpResult").textContent=xpSpent;$("finalXpResult").textContent=xp;
 ui.result.classList.remove("hidden");
 if(!finishedSent){
   finishedSent=true;
   const stats={initialXp,finalXp:xp,xpSpent,weaponLevel:weaponLevel+1,healthRemaining:Math.ceil(health),level,wavesCompleted:won?WAVE_COUNTS[level]:Math.max(0,wave-1),durationSec:Math.round(elapsed)};
   try{window.PyQuestBridge?.finishGame?.(won,won?100:0,stats);}catch(e){console.warn("Bridge finish error",e);}
 }
}
function exitGame(){
 window.parent.postMessage({type:"GAME_EXIT",projectId:window.PyQuestBridge?.state?.projectId||"G002_SPACE_BATTLE",studentId:window.PyQuestBridge?.state?.studentId||"",sessionId:window.PyQuestBridge?.state?.sessionId||""},"*");
}
function bindHold(id,key){
 const el=$(id);const on=e=>{e.preventDefault();keys[key]=true;};const off=e=>{e.preventDefault();keys[key]=false;};
 el.addEventListener("pointerdown",on);["pointerup","pointerleave","pointercancel"].forEach(t=>el.addEventListener(t,off));
}
bindHold("leftBtn","left");bindHold("rightBtn","right");bindHold("fireBtn","fire");
window.addEventListener("keydown",e=>{
 if(["ArrowLeft","ArrowRight"," ","a","A","d","D","b","B"].includes(e.key))e.preventDefault();
 if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=true;
 if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=true;
 if(e.key===" ")keys.fire=true;
 if(e.key.toLowerCase()==="b")openShop();
});
window.addEventListener("keyup",e=>{
 if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=false;
 if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=false;
 if(e.key===" ")keys.fire=false;
});
$("startBtn").addEventListener("click",beginGame);
$("shopBtn").addEventListener("click",openShop);
$("closeShopBtn").addEventListener("click",closeShop);
$("upgradeBtn").addEventListener("click",purchaseUpgrade);
$("healBtn").addEventListener("click",purchaseHeal);
$("confirmYes").addEventListener("click",()=>{const fn=confirmAction;confirmAction=null;ui.confirm.classList.add("hidden");if(fn)fn();});
$("confirmNo").addEventListener("click",()=>{confirmAction=null;ui.confirm.classList.add("hidden");});
$("exitBtn").addEventListener("click",exitGame);

// Drag/touch position on the lower playfield: player follows horizontal finger movement only.
canvas.addEventListener("pointerdown",e=>{if(!gameActive||shopOpen)return;canvas.setPointerCapture?.(e.pointerId);movePlayerTo(e);keys.fire=true;});
canvas.addEventListener("pointermove",e=>{if(e.buttons&&gameActive&&!shopOpen)movePlayerTo(e);});
canvas.addEventListener("pointerup",()=>{keys.fire=false;});
canvas.addEventListener("pointercancel",()=>{keys.fire=false;});
function movePlayerTo(e){const r=canvas.getBoundingClientRect();player.x=clamp((e.clientX-r.left)/r.width*W,20,W-20);}

resize();getBridgeState();resetWorld();
if(window.PyQuestBridge?.setup){
 window.PyQuestBridge.setup({
  onInit:()=>bridgeInit(),
  onStart:()=>beginGame(),
  onRestart:()=>{getBridgeState();resetWorld();ui.result.classList.add("hidden");ui.start.classList.remove("hidden");gameActive=false;},
  onPowerup:()=>openShop()
 });
}
})();
