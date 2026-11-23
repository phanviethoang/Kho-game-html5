/* G002 - SPACE BATTLE
 * Bridge: Universal EdTech Game Bridge v2.0
 * XP is a spend-only resource. No XP is earned inside this game.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    healthFill:$("healthFill"), healthText:$("healthText"), xpText:$("xpText"),
    weaponText:$("weaponText"), levelText:$("levelText"), waveText:$("waveText"),
    timeText:$("timeText"), bossHud:$("bossHud"), bossName:$("bossName"),
    bossHealthFill:$("bossHealthFill"), bossHealthText:$("bossHealthText"),
    notice:$("centerNotice"), shop:$("shopOverlay"), confirm:$("confirmOverlay"),
    result:$("resultOverlay"), start:$("startOverlay"), shopXp:$("shopXp"),
    shopHealth:$("shopHealth"), weaponOptions:$("weaponOptions"),
    shopMessage:$("shopMessage"), buyHeal:$("buyHeal")
  };

  const WEAPONS = [
    {level:1,name:"Đạn đơn",desc:"Một luồng đạn thẳng",damage:12,spread:0,cost:0,icon:"🔹"},
    {level:2,name:"Đạn đôi",desc:"Hai luồng đạn song song",damage:11,spread:9,cost:10,icon:"🔷"},
    {level:3,name:"Đạn ba",desc:"Ba luồng đạn bao quát",damage:10,spread:15,cost:15,icon:"💠"},
    {level:4,name:"Đạn tỏa",desc:"Nhiều luồng đạn hình quạt",damage:9,spread:25,cost:20,icon:"🌟"},
    {level:5,name:"Đạn năng lượng",desc:"Chùm năng lượng uy lực",damage:23,spread:31,cost:25,icon:"💥"}
  ];
  const ENEMY_TYPES = [
    {name:"Scout",color:"#ff758f",hp:32,speed:78,radius:15,damage:7,fire:1.8,kind:"normal"},
    {name:"Swift",color:"#ffd36f",hp:23,speed:132,radius:12,damage:6,fire:2.4,kind:"fast"},
    {name:"Armor",color:"#a98bff",hp:90,speed:48,radius:20,damage:12,fire:2.2,kind:"armor"},
    {name:"Ranger",color:"#5ce4ff",hp:42,speed:56,radius:16,damage:8,fire:1.25,kind:"ranged"},
    {name:"Ram",color:"#ff9d58",hp:28,speed:155,radius:13,damage:14,fire:99,kind:"ram"}
  ];
  const BOSS_NAMES = ["ĐẠI TƯỚNG NEBULA","PHÁO ĐÀI VOID","RỒNG VŨ TRỤ","CHÚA TỂ NOVA","BẠO CHÚA GALAXY"];
  const LEVEL_WAVES = [0,2,2,3,3,3];

  let W=800,H=600,dpr=1, last=0, raf=0, bridgeState={}, bridgeReady=false;
  let level=1, initialXp=10, xp=10, health=100, weaponLevel=1;
  let running=false, started=false, finished=false, shopOpen=false, confirmAction=null;
  let gameTime=0, elapsed=0, wave=1, waveTimer=0, spawnTimer=0, enemiesSpawned=0, enemiesToSpawn=0;
  let boss=null, bossPhase=1, bossIntro=false, bossIntroTimer=0, bossSpawned=false;
  let player={x:0,y:0,vx:0,vy:0,angle:-Math.PI/2,r:17,invuln:5,fireCooldown:0};
  let bullets=[], enemyBullets=[], enemies=[], asteroids=[], particles=[], stars=[];
  let keys={}, pointer={x:0,y:0,down:false,inside:false}, autoFire=true, touchFire=false;
  let joystick={active:false,id:null,x:0,y:0,dx:0,dy:0};
  let lastProgress=0, noticeTimer=0, soundOn=true, lastSoundAt={};
  const isTouch = () => matchMedia("(pointer: coarse)").matches || window.innerWidth<=760;

  function callSound(name, opts){ try{ if(window.SoundManager && soundOn) window.SoundManager.play(name,opts||{}); else if(window.playSound && soundOn) window.playSound(name,opts||{}); }catch(e){} }
  function setSound(enabled){soundOn=!!enabled;try{if(window.SoundManager){enabled?window.SoundManager.enable():window.SoundManager.disable();}}catch(e){} $("soundButton").textContent=soundOn?"🔊":"🔇";}
  function resize(){
    const rect=canvas.getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
    W=Math.max(320,rect.width); H=Math.max(320,rect.height);
    canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!started){player.x=W/2;player.y=H*.72;}
    seedStars();
  }
  function seedStars(){stars=Array.from({length:Math.max(55,Math.floor(W*H/8500))},()=>({x:Math.random()*W,y:Math.random()*H,s:.4+Math.random()*1.8,a:.2+Math.random()*.65}));}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function rand(a,b){return a+Math.random()*(b-a);}
  function levelWaves(){return LEVEL_WAVES[clamp(level,1,5)];}
  function formatTime(sec){const s=Math.floor(sec);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
  function setNotice(text,seconds=1.8){ui.notice.textContent=text;ui.notice.classList.remove("hidden");noticeTimer=seconds;}
  function updateHud(){
    ui.healthFill.style.width=health+"%";ui.healthText.textContent=Math.ceil(health)+"%";
    ui.xpText.textContent=xp;ui.weaponText.textContent="CẤP "+weaponLevel;
    ui.levelText.textContent=level;ui.waveText.textContent= boss?"BOSS":`${Math.min(wave,levelWaves())}/${levelWaves()}`;
    ui.timeText.textContent=formatTime(elapsed);
    if(boss){ui.bossHud.classList.remove("hidden");ui.bossHealthFill.style.width=(boss.hp/boss.maxHp*100)+"%";ui.bossHealthText.textContent=Math.ceil(boss.hp/boss.maxHp*100)+"%";}
    else ui.bossHud.classList.add("hidden");
  }
  function initWorld(){
    player={x:W/2,y:H*.72,vx:0,vy:0,angle:-Math.PI/2,r:17,invuln:5,fireCooldown:0};
    bullets=[];enemyBullets=[];enemies=[];particles=[];boss=null;bossPhase=1;bossIntro=false;bossSpawned=false;
    asteroids=[];
    const count=4+level*2;
    for(let i=0;i<count;i++) asteroids.push({x:rand(35,W-35),y:rand(115,H-80),r:rand(13,25),vx:rand(-22,22),vy:rand(-18,18),rot:rand(0,6),vr:rand(-.5,.5)});
    wave=1;waveTimer=0;spawnTimer=.5;enemiesSpawned=0;enemiesToSpawn=waveEnemyCount(1);
    gameTime=0;elapsed=0;running=false;started=false;finished=false;shopOpen=false;
    ui.bossHud.classList.add("hidden");ui.result.classList.add("hidden");ui.shop.classList.add("hidden");
    updateHud();
  }
  function waveEnemyCount(w){return 4+level*2+w*2;}
  function enemyForWave(){const pool=level===1?2:level===2?3:level===3?4:5;return ENEMY_TYPES[Math.floor(Math.random()*pool)];}
  function spawnEnemy(){
    const type=enemyForWave(), side=Math.floor(Math.random()*4), margin=35;
    let x=side===0?-margin:side===1?W+margin:rand(20,W-20);
    let y=side===2?-margin:side===3?H+margin:rand(105,H-30);
    const scale=1+(level-1)*.18;
    enemies.push({x,y,vx:0,vy:0,hp:type.hp*scale,maxHp:type.hp*scale,speed:type.speed*(1+(level-1)*.1),r:type.radius,color:type.color,damage:type.damage+level,fire:type.fire,fireTimer:rand(.5,1.8),kind:type.kind,angle:0});
  }
  function spawnBoss(){
    bossSpawned=true;bossIntro=true;bossIntroTimer=2.4;bossPhase=1;
    const maxHp=620+level*310;
    boss={x:W/2,y:-90,targetY:Math.max(115,H*.23),hp:maxHp,maxHp,speed:52+level*7,r:42+level*2,fireTimer:.8,pattern:0};
    setNotice("⚠ CẢNH BÁO: "+BOSS_NAMES[level-1],2.3);callSound("notification");
  }
  function spawnWave(){
    enemiesSpawned=0;enemiesToSpawn=waveEnemyCount(wave);spawnTimer=.3;waveTimer=0;
    setNotice("ĐỢT "+wave+" – TIÊU DIỆT HẠM ĐỘI ĐỊCH",1.7);
  }
  function startGame(){
    if(started||finished)return;
    started=true;running=true;ui.start.classList.add("hidden");player.invuln=5;
    callSound("start");setNotice("KHIÊN BẢO VỆ KÍCH HOẠT – 5 GIÂY",2);
    last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function movePlayer(dt){
    let dx=0,dy=0;
    if(keys.KeyA||keys.ArrowLeft)dx-=1;if(keys.KeyD||keys.ArrowRight)dx+=1;
    if(keys.KeyW||keys.ArrowUp)dy-=1;if(keys.KeyS||keys.ArrowDown)dy+=1;
    if(joystick.active){dx+=joystick.dx;dy+=joystick.dy;}
    const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
    const speed=245;
    player.vx=dx*speed;player.vy=dy*speed;
    player.x=clamp(player.x+player.vx*dt,player.r+3,W-player.r-3);
    player.y=clamp(player.y+player.vy*dt,105,H-player.r-6);
    if(pointer.inside){player.angle=Math.atan2(pointer.y-player.y,pointer.x-player.x);}
    else if(autoFire && enemies.length){const target=nearestEnemy();if(target)player.angle=Math.atan2(target.y-player.y,target.x-player.x);}
  }
  function nearestEnemy(){let list=enemies.slice();if(boss)list.push(boss);let best=null,dist=Infinity;for(const e of list){const d=(e.x-player.x)**2+(e.y-player.y)**2;if(d<dist){dist=d;best=e;}}return best;}
  function firePlayer(){
    const base=WEAPONS[weaponLevel-1];const n=weaponLevel===1?1:weaponLevel===2?2:weaponLevel===3?3:weaponLevel===4?5:3;
    const spread=weaponLevel===1?0:weaponLevel===2?8:weaponLevel===3?13:weaponLevel===4?38:20;
    for(let i=0;i<n;i++){const off=n===1?0:(i-(n-1)/2)*spread*Math.PI/180;const a=player.angle+off;const speed=520;
      bullets.push({x:player.x+Math.cos(a)*20,y:player.y+Math.sin(a)*20,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:weaponLevel===5?5:4,damage:base.damage*(1+(level-1)*.04),life:1.5,color:weaponLevel===5?"#8ffcff":"#71eaff"});}
    callSound("click");
  }
  function updateEnemies(dt){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];const dx=player.x-e.x,dy=player.y-e.y,d=Math.max(1,Math.hypot(dx,dy));e.angle=Math.atan2(dy,dx);
      if(e.kind==="ram"){e.vx=dx/d*e.speed;e.vy=dy/d*e.speed;}
      else {const desired=e.kind==="ranged"?Math.max(190,260-level*10):Math.max(95,155-level*7);const dir=e.kind==="ranged"?(d<desired?-1:1):1;e.vx=dx/d*e.speed*dir;e.vy=dy/d*e.speed*dir;}
      e.x+=e.vx*dt;e.y+=e.vy*dt;
      e.fireTimer-=dt;
      if(e.kind!=="ram"&&e.fireTimer<=0&&d<620){const speed=185+level*13;enemyBullets.push({x:e.x,y:e.y,vx:dx/d*speed,vy:dy/d*speed,r:5,damage:e.damage,life:4});e.fireTimer=e.fire*(1-level*.055)+rand(.2,.8);}
      if(d<e.r+player.r){damagePlayer(e.damage*.75);e.hp=0;}
      if(e.hp<=0){burst(e.x,e.y,e.color,9);enemies.splice(i,1);callSound("collect");}
    }
  }
  function updateBoss(dt){
    if(!boss)return;
    if(bossIntro){bossIntroTimer-=dt;if(bossIntroTimer<=0)bossIntro=false;}
    if(boss.y<boss.targetY)boss.y+=100*dt;
    const ratio=boss.hp/boss.maxHp;const phase=ratio<=.4?3:ratio<=.7?2:1;
    if(phase!==bossPhase){bossPhase=phase;setNotice(phase===2?"BOSS TĂNG CƯỜNG TẤN CÔNG!":"BOSS KÍCH HOẠT TOÀN LỰC!",1.8);callSound("notification");}
    boss.x=W/2+Math.sin(elapsed*(.55+level*.04))*Math.min(W*.29,190);
    boss.fireTimer-=dt;
    if(boss.fireTimer<=0){
      const aimed=Math.atan2(player.y-boss.y,player.x-boss.x);
      const count=phase===1?3:phase===2?5:7;
      for(let i=0;i<count;i++){const a=aimed+(i-(count-1)/2)*(phase===3?.19:.25);const sp=170+level*16+phase*22;enemyBullets.push({x:boss.x,y:boss.y+boss.r*.55,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:6,damage:11+level*2,life:5});}
      boss.fireTimer=phase===1?1.25:phase===2?.85:.58;
    }
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(Math.hypot(b.x-boss.x,b.y-boss.y)<boss.r+b.r){boss.hp-=b.damage;bullets.splice(i,1);burst(b.x,b.y,"#8ffcff",2);}}
    if(boss.hp<=0){burst(boss.x,boss.y,"#ffcf75",45);boss=null;winGame();}
  }
  function updateBullets(dt){
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let hit=false;
      for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){e.hp-=b.damage;hit=true;burst(b.x,b.y,e.color,2);if(e.hp<=0){burst(e.x,e.y,e.color,10);enemies.splice(j,1);callSound("collect");}break;}}
      if(hit||b.life<=0||b.x<-20||b.x>W+20||b.y<-20||b.y>H+20)bullets.splice(i,1);
    }
    for(let i=enemyBullets.length-1;i>=0;i--){const b=enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r){damagePlayer(b.damage);enemyBullets.splice(i,1);continue;}
      if(b.life<=0||b.x<-30||b.x>W+30||b.y<-30||b.y>H+30)enemyBullets.splice(i,1);
    }
  }
  function updateAsteroids(dt){
    for(const a of asteroids){a.x+=a.vx*dt;a.y+=a.vy*dt;a.rot+=a.vr*dt;if(a.x<-a.r)a.x=W+a.r;if(a.x>W+a.r)a.x=-a.r;if(a.y<100-a.r)a.y=H+a.r;if(a.y>H+a.r)a.y=105-a.r;
      if(Math.hypot(a.x-player.x,a.y-player.y)<a.r+player.r*.7){damagePlayer(9+level);const dx=player.x-a.x,dy=player.y-a.y,d=Math.max(1,Math.hypot(dx,dy));player.x=clamp(player.x+dx/d*13,player.r,W-player.r);player.y=clamp(player.y+dy/d*13,110,H-player.r);}
      for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(Math.hypot(a.x-e.x,a.y-e.y)<a.r+e.r*.7){e.hp-=18;}}
    }
  }
  function damagePlayer(amount){
    if(player.invuln>0||finished)return;
    health=clamp(health-amount,0,100);player.invuln=.42;callSound("wrong");
    burst(player.x,player.y,"#ff719c",8);updateHud();
    if(health<=0)loseGame();
  }
  function updateWaves(dt){
    if(boss||bossSpawned)return;
    if(enemiesSpawned<enemiesToSpawn){spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();enemiesSpawned++;spawnTimer=Math.max(.34,.95-level*.08);}}
    if(enemiesSpawned>=enemiesToSpawn&&enemies.length===0){
      if(wave<levelWaves()){wave++;spawnWave();}
      else spawnBoss();
    }
  }
  function burst(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),s=rand(25,180);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.2,.65),max:.65,color,r:rand(1,3)});}}
  function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}}
  function update(dt){
    if(!running||shopOpen||finished)return;
    elapsed+=dt;gameTime+=dt;if(player.invuln>0)player.invuln-=dt;
    movePlayer(dt);
    player.fireCooldown-=dt;
    if((autoFire||pointer.down||touchFire)&&player.fireCooldown<=0){if(autoFire){const target=nearestEnemy();if(target)player.angle=Math.atan2(target.y-player.y,target.x-player.x);}firePlayer();player.fireCooldown=weaponLevel===5?.19:.27;}
    updateAsteroids(dt);updateEnemies(dt);updateBullets(dt);updateBoss(dt);updateWaves(dt);updateParticles(dt);
    if(elapsed-lastProgress>3){lastProgress=elapsed;try{if(window.PyQuestBridge?.reportProgress)window.PyQuestBridge.reportProgress(Math.min(99,Math.round((wave-1)/levelWaves()*65+(boss?15:0))));}catch(e){}}
    updateHud();
  }
  function drawShip(x,y,angle,color="#6eeaff",scale=1){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.scale(scale,scale);
    ctx.shadowColor=color;ctx.shadowBlur=18;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(15,15);ctx.lineTo(0,9);ctx.lineTo(-15,15);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle="#e9fbff";ctx.beginPath();ctx.ellipse(0,-3,5,9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#ffb86b";ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(0,25+Math.random()*5);ctx.lineTo(6,13);ctx.fill();ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createRadialGradient(W*.5,H*.4,20,W*.5,H*.5,Math.max(W,H)*.8);bg.addColorStop(0,"#17274d");bg.addColorStop(1,"#050817");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    for(const s of stars){s.y+=s.s*.12;if(s.y>H)s.y=0;ctx.globalAlpha=s.a;ctx.fillStyle="#c9e9ff";ctx.fillRect(s.x,s.y,s.s,s.s);}ctx.globalAlpha=1;
    for(const a of asteroids){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);ctx.fillStyle="#65708e";ctx.strokeStyle="#aab8d5";ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<9;i++){const ang=i*Math.PI*2/9,r=a.r*(.78+(i%3)*.11);const px=Math.cos(ang)*r,py=Math.sin(ang)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    for(const e of enemies){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle+Math.PI/2);ctx.fillStyle=e.color;ctx.shadowColor=e.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(0,-e.r);ctx.lineTo(e.r*.85,e.r*.8);ctx.lineTo(0,e.r*.35);ctx.lineTo(-e.r*.85,e.r*.8);ctx.closePath();ctx.fill();ctx.restore();if(e.hp<e.maxHp){ctx.fillStyle="#26334e";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,3);ctx.fillStyle="#ff8eaa";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*e.hp/e.maxHp,3);}}
    for(const b of bullets){ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
    for(const b of enemyBullets){ctx.fillStyle="#ff8b9e";ctx.shadowColor="#ff416d";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
    if(boss){ctx.save();ctx.translate(boss.x,boss.y);ctx.rotate(Math.sin(elapsed)*.08);ctx.fillStyle="#b45cff";ctx.shadowColor="#f35cff";ctx.shadowBlur=25;ctx.beginPath();ctx.moveTo(0,-boss.r);ctx.lineTo(boss.r*.9,-boss.r*.25);ctx.lineTo(boss.r*.72,boss.r*.8);ctx.lineTo(0,boss.r*.5);ctx.lineTo(-boss.r*.72,boss.r*.8);ctx.lineTo(-boss.r*.9,-boss.r*.25);ctx.closePath();ctx.fill();ctx.fillStyle="#ffe6ff";ctx.shadowBlur=0;ctx.beginPath();ctx.arc(0,0,boss.r*.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    if(player.invuln>0){ctx.strokeStyle="#8df5ff";ctx.lineWidth=3;ctx.globalAlpha=.65+.25*Math.sin(elapsed*18);ctx.beginPath();ctx.arc(player.x,player.y,player.r+10,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    drawShip(player.x,player.y,player.angle);
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  }
  function loop(now){if(finished)return;const dt=Math.min(.035,(now-last)/1000||0);last=now;update(dt);draw();raf=requestAnimationFrame(loop);}
  function renderShop(){
    ui.shopXp.textContent=xp;ui.shopHealth.textContent=Math.ceil(health)+"%";
    ui.weaponOptions.innerHTML="";
    WEAPONS.forEach(w=>{
      const card=document.createElement("div");card.className="upgrade-card"+(weaponLevel===w.level?" current":"")+(weaponLevel<w.level-1?" locked":"");
      const canBuy=w.level===weaponLevel+1&&xp>=w.cost;
      let status=weaponLevel>=w.level?"ĐÃ MỞ":w.level===weaponLevel+1?(xp>=w.cost?"SẴN SÀNG":"THIẾU XP"):"CHƯA MỞ";
      card.innerHTML=`<div class="weapon-badge">${w.icon}</div><div class="upgrade-info"><strong>CẤP ${w.level} · ${w.name}</strong><span>${w.desc} · Sát thương ${w.damage}</span><span>${w.level===1?"Mặc định":`Giá ${w.cost} XP`} · ${status}</span></div>`;
      const btn=document.createElement("button");btn.className="buy-button";btn.textContent=weaponLevel>=w.level?"ĐÃ SỞ HỮU":`MUA ${w.cost} XP`;
      btn.disabled=!canBuy;btn.addEventListener("click",()=>askPurchase("weapon",w));card.appendChild(btn);ui.weaponOptions.appendChild(card);
    });
    ui.buyHeal.disabled=xp<10||health>=100;
    ui.buyHeal.textContent=health>=100?"ĐẦY MÁU":"MUA 10 XP";
    ui.shopMessage.textContent=xp<10?"XP không đủ cho hồi máu hoặc nâng cấp tiếp theo.":"Chọn nâng cấp phù hợp với chiến thuật của bạn.";
  }
  function askPurchase(kind,item){
    if(kind==="weapon"&&(item.level!==weaponLevel+1||xp<item.cost))return;
    if(kind==="heal"&&(xp<10||health>=100))return;
    confirmAction=()=>{if(kind==="weapon"){xp-=item.cost;weaponLevel=item.level;callSound("correct");}
      else{xp-=10;health=clamp(health+30,0,100);callSound("correct");}
      updateHud();renderShop();};
    $("confirmTitle").textContent=kind==="weapon"?"XÁC NHẬN NÂNG CẤP?":"XÁC NHẬN HỒI MÁU?";
    $("confirmText").textContent=kind==="weapon"?`Nâng cấp lên ${item.name}, tiêu tốn ${item.cost} XP?`:"Hồi tối đa 30% máu, tiêu tốn 10 XP?";
    ui.confirm.classList.remove("hidden");
  }
  function openShop(){if(finished||!started||shopOpen)return;shopOpen=true;running=false;renderShop();ui.shop.classList.remove("hidden");}
  function closeShop(){if(!shopOpen)return;ui.confirm.classList.add("hidden");ui.shop.classList.add("hidden");shopOpen=false;running=true;last=performance.now();}
  function endGame(won){
    if(finished)return;finished=true;running=false;cancelAnimationFrame(raf);
    const stats={initialXp,finalXp:xp,xpSpent:initialXp-xp,weaponLevel,healthRemaining:Math.round(health),level,wavesCompleted:boss?levelWaves():levelWaves(),durationSec:Math.round(elapsed)};
    try{if(window.PyQuestBridge?.finishGame)window.PyQuestBridge.finishGame(!!won,won?100:0,stats);else if(window.finishGame)window.finishGame(!!won,won?100:0,stats);}catch(e){console.warn("Bridge finish error",e);}
    $("resultTitle").textContent=won?"CHIẾN THẮNG!":"THẤT BẠI!";
    $("resultIcon").textContent=won?"🏆":"💫";
    $("resultSubtext").textContent=won?"Bạn đã đánh bại Boss và bảo vệ thành công thiên hà!":"Tàu chiến đã cạn năng lượng. Hãy cân nhắc hồi máu sớm hơn ở lần chơi tiếp theo.";
    $("initialXpResult").textContent=initialXp;$("finalXpResult").textContent=xp;
    $("weaponResult").textContent="CẤP "+weaponLevel;$("healthResult").textContent=Math.ceil(health)+"%";
    ui.result.classList.remove("hidden");ui.result.querySelector(".result-panel").classList.toggle("lost",!won);
    callSound(won?"win":"gameover");
  }
  function winGame(){health=Math.max(health,0);endGame(true);}
  function loseGame(){health=0;updateHud();endGame(false);}
  function exitGame(){
    const payload={type:"GAME_EXIT",projectId:bridgeState.projectId||"",studentId:bridgeState.studentId||"",sessionId:bridgeState.sessionId||""};
    try{window.parent.postMessage(payload,"*");}catch(e){}
  }
  function applyInit(state){
    bridgeState=state||bridgeState;bridgeReady=true;
    const suppliedLevel=Number(state?.level??state?.gameConfig?.level??level);
    if(Number.isFinite(suppliedLevel))level=clamp(Math.round(suppliedLevel),1,5);
    const suppliedXp=Number(state?.currentXp??state?.gameConfig?.currentXp??initialXp);
    if(Number.isFinite(suppliedXp))initialXp=Math.max(0,Math.floor(suppliedXp));
    xp=initialXp;health=100;weaponLevel=1;
    initWorld();updateHud();
  }
  function setupBridge(){
    const bridge=window.PyQuestBridge;
    if(!bridge||typeof bridge.setup!=="function"){applyInit({level:1,currentXp:10});return;}
    try{
      bridge.setup({
        onInit:(state)=>{applyInit(state||{});},
        onStart:()=>{if(!started){startGame();}},
        onPowerup:(data)=>{ /* All XP spending remains inside this game. */ },
        onRestart:()=>{applyInit(bridgeState);ui.start.classList.remove("hidden");},
        onSettingsChange:(settings)=>{if(settings?.soundEnabled!==undefined)setSound(settings.soundEnabled);}
      });
      // Render a usable board immediately, even if the host sends GAME_INIT later.
      if(!bridgeReady){const s=bridge.state||{};applyInit(s);}
    }catch(e){console.warn("Bridge setup error",e);applyInit({level:1,currentXp:10});}
  }
  function bindInputs(){
    $("startButton").addEventListener("click",startGame);
    $("shopButton").addEventListener("click",openShop);
    $("closeShop").addEventListener("click",closeShop);
    $("confirmCancel").addEventListener("click",()=>{ui.confirm.classList.add("hidden");confirmAction=null;});
    $("confirmAccept").addEventListener("click",()=>{ui.confirm.classList.add("hidden");const fn=confirmAction;confirmAction=null;if(fn)fn();});
    $("exitGame").addEventListener("click",exitGame);
    $("autoButton").addEventListener("click",toggleAuto);
    $("touchAuto").addEventListener("click",toggleAuto);
    $("soundButton").addEventListener("click",()=>setSound(!soundOn));
    canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;pointer.inside=true;});
    canvas.addEventListener("pointerleave",()=>{pointer.inside=false;});
    canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"){pointer.down=true;canvas.setPointerCapture?.(e.pointerId);}});
    window.addEventListener("pointerup",()=>{pointer.down=false;});
    window.addEventListener("keydown",e=>{keys[e.code]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(e.code==="KeyE"&&!e.repeat)openShop();});
    window.addEventListener("keyup",e=>{keys[e.code]=false;});
    $("touchFire").addEventListener("pointerdown",e=>{touchFire=true;e.currentTarget.setPointerCapture?.(e.pointerId);});
    $("touchFire").addEventListener("pointerup",()=>touchFire=false);
    $("touchFire").addEventListener("pointercancel",()=>touchFire=false);
    const joy=$("joystick"),knob=$("joystickKnob");
    joy.addEventListener("pointerdown",e=>{joystick.active=true;joystick.id=e.pointerId;joy.setPointerCapture(e.pointerId);updateJoy(e);});
    joy.addEventListener("pointermove",e=>{if(joystick.active&&e.pointerId===joystick.id)updateJoy(e);});
    const stopJoy=()=>{joystick.active=false;joystick.dx=0;joystick.dy=0;knob.style.transform="translate(0,0)";};
    joy.addEventListener("pointerup",stopJoy);joy.addEventListener("pointercancel",stopJoy);
    function updateJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/(r.width*.35),dy=(e.clientY-cy)/(r.height*.35);const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}joystick.dx=dx;joystick.dy=dy;knob.style.transform=`translate(${dx*29}px,${dy*29}px)`;}
  }
  function toggleAuto(){autoFire=!autoFire;$("autoButton").classList.toggle("active",autoFire);$("touchAuto").classList.toggle("active",autoFire);$("autoButton").textContent="TỰ ĐỘNG BẮN: "+(autoFire?"BẬT":"TẮT");}
  function boot(){resize();bindInputs();setupBridge();if(!bridgeReady)applyInit({level:1,currentXp:10});draw();window.addEventListener("resize",resize);document.addEventListener("visibilitychange",()=>{if(document.hidden&&running){/* Avoid accidental simulation jump; elapsed gameplay pauses while tab hidden. */running=false;}});}
  boot();
})();
