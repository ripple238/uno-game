const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const COLORS = ['red', 'blue', 'green', 'yellow'];
const CARD_VALUES = { '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'skip':20,'reverse':20,'draw2':20,'wild':50,'wild4':50 };
const rooms = {};
const traffic = { totalConnections:0, uniqueVisitors:new Set(), gamesCreated:0, gamesStarted:0, gamesCompleted:0, peakConcurrent:0, dailyStats:{} };

function genCode() { return Math.random().toString(36).substring(2,8).toUpperCase(); }
function genId() { return Math.random().toString(36).substring(2,10); }
function shuffle(a) { const s=[...a]; for(let i=s.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[s[i],s[j]]=[s[j],s[i]];} return s; }
function createDeck() {
  const d=[]; for(const c of COLORS){ d.push({color:c,value:'0',type:'number',id:genId()}); for(let i=1;i<=9;i++){d.push({color:c,value:i+'',type:'number',id:genId()});d.push({color:c,value:i+'',type:'number',id:genId()});} for(const sp of ['skip','reverse','draw2']){d.push({color:c,value:sp,type:'special',id:genId()});d.push({color:c,value:sp,type:'special',id:genId()});} }
  for(let i=0;i<4;i++){d.push({color:'wild',value:'wild',type:'wild',id:genId()});d.push({color:'wild',value:'wild4',type:'wild',id:genId()});}
  return shuffle(d);
}
function deal(d,n){const h=Array.from({length:n},()=>[]);for(let i=0;i<7;i++)for(let j=0;j<n;j++)if(d.length>0)h[j].push(d.pop());return{hands:h,deck:d};}
function valid(card,top,color){if(!card||!top)return false;if(card.type==='wild')return true;if(card.color===color)return true;if(top.color!=='wild'&&card.color===top.color)return true;if(card.value===top.value)return true;return false;}
function nextIdx(room,skip=1){let n=room.currentPlayerIndex;for(let i=0;i<skip;i++)n=(n+room.direction+room.players.length)%room.players.length;return n;}
function handVal(h){return h.reduce((s,c)=>s+(CARD_VALUES[c.value]||0),0);}
function refill(room){if(room.discardPile.length<=1)return;const t=room.discardPile.pop();room.deck=shuffle(room.discardPile);room.discardPile=[t];}
function msg(room,text,type='system'){room.messages.push({text,type,time:Date.now()});if(room.messages.length>100)room.messages.shift();}
function avatar(name){const a=['Lion','Tiger','Bear','Panda','Fox','Wolf','Owl','Dragon','Unicorn','Shark'];let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return a[Math.abs(h)%a.length];}

class Bot {
  constructor(name,diff='medium'){this.id='bot-'+genId();this.name=name;this.isBot=true;this.diff=diff;this.hand=[];this.saidUno=false;this.score=0;this.wins=0;this.avatar='Bot';}
  pick(hand,top,color){const v=[];for(let i=0;i<hand.length;i++)if(valid(hand[i],top,color))v.push({c:hand[i],i});if(!v.length)return null;if(this.diff==='easy')return v[Math.floor(Math.random()*v.length)];v.sort((a,b)=>((CARD_VALUES[b.c.value]||0)-(CARD_VALUES[a.c.value]||0)));if(this.diff==='hard'&&hand.length<=3){const nw=v.find(x=>x.c.type!=='wild');if(nw)return nw;}return v[0];}
  pickColor(hand){const cnt={};hand.forEach(c=>{if(c.color!=='wild')cnt[c.color]=(cnt[c.color]||0)+1});const s=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);return s.length?s[0][0]:COLORS[Math.floor(Math.random()*4)];}
}
const BN=['Robo','Alpha','Beta','Gamma','Delta','Neo','Cyber','Pixel','Viper','Flash'];

function pubState(room){
  return{
    code:room.code,host:room.host,
    players:room.players.map(p=>({id:p.id,name:p.name,cardCount:p.hand.length,saidUno:p.saidUno,isBot:p.isBot,avatar:p.avatar,score:p.score,wins:p.wins})),
    status:room.status,currentPlayerIndex:room.currentPlayerIndex,direction:room.direction,currentColor:room.currentColor,
    topCard:room.discardPile[room.discardPile.length-1]||null,discardCount:room.discardPile.length,deckCount:room.deck.length,
    messages:room.messages,winner:room.winner,round:room.round,theme:room.theme,settings:room.settings
  };
}
function broadcast(room){
  room.players.forEach((p,i)=>{
    if(p.isBot)return;
    io.to(p.id).emit('game-state',{...pubState(room),yourHand:p.hand,yourIndex:i,isYourTurn:i===room.currentPlayerIndex,canPlay:i===room.currentPlayerIndex});
  });
}

function execPlay(room,pi,ci,chosenColor){
  if(room.status!=='playing')return{success:false,error:'Not playing'};
  if(pi!==room.currentPlayerIndex)return{success:false,error:'Not your turn'};
  if(ci<0||ci>=room.players[pi].hand.length)return{success:false,error:'Invalid card'};
  const p=room.players[pi],c=p.hand[ci],t=room.discardPile[room.discardPile.length-1];
  if(!valid(c,t,room.currentColor))return{success:false,error:'Invalid play'};
  p.hand.splice(ci,1);room.discardPile.push(c);room.currentColor=(c.type==='wild')?chosenColor:c.color;
  let skip=1,draw=0,ni=nextIdx(room,0),snd='play';
  if(c.value==='skip'){skip=2;snd='special';msg(room,p.name+' skipped '+room.players[ni].name+'!');}
  else if(c.value==='reverse'){room.direction*=-1;snd='special';if(room.players.length===2)skip=2;msg(room,p.name+' reversed!');}
  else if(c.value==='draw2'){draw=2;snd='special';msg(room,p.name+' made '+room.players[ni].name+' draw 2!');}
  else if(c.value==='wild4'){draw=4;snd='wild';msg(room,p.name+' made '+room.players[ni].name+' draw 4!');}
  else if(c.type==='wild'){snd='wild';msg(room,p.name+' chose '+chosenColor+'!');}
  if(draw>0){for(let i=0;i<draw;i++){if(room.deck.length===0)refill(room);if(room.deck.length>0)room.players[ni].hand.push(room.deck.pop());}}
  if(p.hand.length===0){endRound(room,p);return{success:true,sound:'win',over:room.status==='finished'};}
  if(p.hand.length===1){p.saidUno=true;msg(room,'UNO! '+p.name+' has one card left!');}
  room.currentPlayerIndex=nextIdx(room,skip);broadcast(room);setTimeout(()=>botTurn(room),500);
  return{success:true,sound:snd};
}

function botTurn(room){
  if(room.status!=='playing'||room.botThinking)return;
  const b=room.players[room.currentPlayerIndex];if(!b||!b.isBot)return;
  room.botThinking=true;
  setTimeout(()=>{
    if(room.status!=='playing'){room.botThinking=false;return;}
    const t=room.discardPile[room.discardPile.length-1],pl=b.pick(b.hand,t,room.currentColor);
    if(pl){const r=execPlay(room,room.currentPlayerIndex,pl.i,b.pickColor(b.hand));if(r.success&&!r.over)io.to(room.code).emit('sound',r.sound);}
    else{if(room.deck.length===0)refill(room);if(room.deck.length>0){b.hand.push(room.deck.pop());msg(room,b.name+' drew a card');const nt=room.discardPile[room.discardPile.length-1],dc=b.hand[b.hand.length-1];if(valid(dc,nt,room.currentColor)&&b.diff!=='easy'){setTimeout(()=>{if(room.status!=='playing')return;const r=execPlay(room,room.currentPlayerIndex,b.hand.length-1,b.pickColor(b.hand));if(r.success)io.to(room.code).emit('sound',r.sound);},1500);}else{room.currentPlayerIndex=nextIdx(room);broadcast(room);setTimeout(()=>botTurn(room),500);}}}
    room.botThinking=false;
  },2000);
}

function endRound(room,winner){
  room.status='round_end';winner.wins++;traffic.gamesCompleted++;
  let rp=0;room.players.forEach(p=>{if(p!==winner){rp+=handVal(p.hand);}});winner.score+=rp;
  msg(room,winner.name+' wins Round '+room.round+'! +'+rp+' pts','winner');
  const target=room.settings.targetScore||500, gw=room.players.find(p=>p.score>=target);
  if(gw){room.status='finished';room.winner=gw.name;msg(room,gw.name+' WINS THE GAME!','winner');}
  else room.round++;
  broadcast(room);
}

function startRound(room){
  const d=createDeck(),{hands,deck:rem}=deal(d,room.players.length);
  room.players.forEach((p,i)=>{p.hand=hands[i];p.saidUno=false;});
  let fc=rem.pop();while(fc&&fc.type==='wild'){rem.unshift(fc);fc=rem.pop();}
  room.deck=rem;room.discardPile=[fc];room.currentColor=fc.color;room.status='playing';
  room.currentPlayerIndex=0;room.direction=1;room.winner=null;room.botThinking=false;
  if(fc.value==='skip')room.currentPlayerIndex=nextIdx(room);
  else if(fc.value==='reverse')room.direction=-1;
  else if(fc.value==='draw2'){const np=room.players[nextIdx(room,0)];for(let i=0;i<2;i++)if(room.deck.length>0)np.hand.push(room.deck.pop());room.currentPlayerIndex=nextIdx(room);}
  msg(room,'Round '+room.round+' started! Target: '+room.settings.targetScore);
  broadcast(room);setTimeout(()=>botTurn(room),1000);
}

function getToday(){return new Date().toISOString().split('T')[0];}
function track(id){traffic.totalConnections++;traffic.uniqueVisitors.add(id);const t=getToday();if(!traffic.dailyStats[t])traffic.dailyStats[t]={visitors:0,games:0};traffic.dailyStats[t].visitors++;const c=io.engine.clientsCount;if(c>traffic.peakConcurrent)traffic.peakConcurrent=c;}

io.on('connection',socket=>{
  console.log('Connected:',socket.id);track(socket.id);

  socket.on('create-room',(data,cb)=>{
    const{name,settings={}}=data,code=genCode();
    rooms[code]={code,host:socket.id,players:[{id:socket.id,name,hand:[],saidUno:false,score:0,wins:0,isBot:false,avatar:avatar(name)}],spectators:[],status:'waiting',deck:[],discardPile:[],currentPlayerIndex:0,direction:1,currentColor:null,messages:[],winner:null,round:1,theme:settings.theme||'classic',settings:{targetScore:settings.targetScore||500,botDifficulty:settings.botDifficulty||'medium',allowSpectators:settings.allowSpectators!==false,...settings},botThinking:false};
    socket.join(code);socket.roomCode=code;traffic.gamesCreated++;
    cb({success:true,code,theme:rooms[code].theme});io.to(code).emit('room-update',pubState(rooms[code]));
  });

  socket.on('join-room',(data,cb)=>{
    const{roomCode,name}=data,r=rooms[roomCode];
    if(!r)return cb({success:false,error:'Room not found'});
    if(r.status!=='waiting')return cb({success:false,error:'Game started'});
    if(r.players.length>=10)return cb({success:false,error:'Room full'});
    r.players.push({id:socket.id,name,hand:[],saidUno:false,score:0,wins:0,isBot:false,avatar:avatar(name)});
    socket.join(roomCode);socket.roomCode=roomCode;cb({success:true,theme:r.theme});io.to(roomCode).emit('room-update',pubState(r));
  });

  socket.on('add-bot',(diff,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return cb({success:false,error:'Not authorized'});
    if(r.status!=='waiting')return cb({success:false,error:'Started'});if(r.players.length>=10)return cb({success:false,error:'Full'});
    r.players.push(new Bot(BN[Math.floor(Math.random()*BN.length)]+' '+Math.floor(Math.random()*99),diff));
    cb({success:true});io.to(r.code).emit('room-update',pubState(r));
  });

  socket.on('remove-bot',(bid,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return cb({success:false,error:'Not authorized'});
    const i=r.players.findIndex(p=>p.id===bid&&p.isBot);if(i!==-1){r.players.splice(i,1);cb({success:true});io.to(r.code).emit('room-update',pubState(r));}else cb({success:false,error:'Not found'});
  });

  socket.on('start-game',(_,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return cb({success:false,error:'Not authorized'});
    if(r.players.length<2)return cb({success:false,error:'Need 2+ players'});
    r.players.forEach(p=>{p.score=0;p.wins=0;});r.round=1;traffic.gamesStarted++;startRound(r);cb({success:true});
  });

  socket.on('next-round',(_,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.host!==socket.id)return cb({success:false,error:'Not authorized'});
    if(r.status!=='round_end')return cb({success:false,error:'Not round end'});startRound(r);cb({success:true});
  });

  socket.on('play-card',(data,cb)=>{
    const{cardIndex,chosenColor}=data,r=rooms[socket.roomCode];
    if(!r||r.status!=='playing')return cb({success:false,error:'Not active'});
    const p=r.players[r.currentPlayerIndex];if(!p||p.id!==socket.id)return cb({success:false,error:'Not your turn'});
    const res=execPlay(r,r.currentPlayerIndex,cardIndex,chosenColor);if(res.success)io.to(r.code).emit('sound',res.sound);cb(res);
  });

  socket.on('draw-card',(_,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.status!=='playing')return cb({success:false,error:'Not active'});
    const p=r.players[r.currentPlayerIndex];if(!p||p.id!==socket.id)return cb({success:false,error:'Not your turn'});
    if(r.deck.length===0)refill(r);if(r.deck.length===0)return cb({success:false,error:'Empty'});
    const c=r.deck.pop();p.hand.push(c);msg(r,p.name+' drew a card');cb({success:true,card:c});broadcast(r);
  });

  socket.on('pass-turn',(_,cb)=>{
    const r=rooms[socket.roomCode];if(!r||r.status!=='playing')return cb({success:false,error:'Not active'});
    const p=r.players[r.currentPlayerIndex];if(!p||p.id!==socket.id)return cb({success:false,error:'Not your turn'});
    r.currentPlayerIndex=nextIdx(r);msg(r,p.name+' passed');cb({success:true});broadcast(r);setTimeout(()=>botTurn(r),500);
  });

  socket.on('say-uno',(_,cb)=>{
    const r=rooms[socket.roomCode];if(!r)return cb({success:false,error:'No room'});
    const p=r.players.find(x=>x.id===socket.id);if(!p)return cb({success:false,error:'Not found'});
    if(p.hand.length===1){p.saidUno=true;msg(r,'UNO! '+p.name+' has one card!');io.to(r.code).emit('sound','uno');cb({success:true});broadcast(r);}
    else cb({success:false,error:'Not UNO'});
  });

  socket.on('send-message',(data)=>{
    const{message,emoji}=data,r=rooms[socket.roomCode];if(!r)return;
    const p=r.players.find(x=>x.id===socket.id);if(!p)return;
    if(emoji){msg(r,p.name+' '+emoji,'emoji');io.to(r.code).emit('emoji-reaction',{player:p.name,emoji});}
    else msg(r,p.name+': '+message,'chat');
    io.to(r.code).emit('room-update',pubState(r));
  });

  socket.on('emoji-reaction',(emoji)=>{
    const r=rooms[socket.roomCode];if(!r)return;
    const p=r.players.find(x=>x.id===socket.id);if(p)io.to(r.code).emit('emoji-reaction',{player:p.name,emoji,playerId:socket.id});
  });

  socket.on('disconnect',()=>{
    const r=rooms[socket.roomCode];if(!r)return;
    const pi=r.players.findIndex(p=>p.id===socket.id);
    if(pi!==-1&&!r.players[pi].isBot){
      const n=r.players[pi].name;r.players.splice(pi,1);
      if(r.players.filter(p=>!p.isBot).length===0){delete rooms[socket.roomCode];return;}
      if(r.status==='playing'){if(r.currentPlayerIndex>=r.players.length)r.currentPlayerIndex=0;if(pi<r.currentPlayerIndex)r.currentPlayerIndex--;msg(r,n+' disconnected');broadcast(r);setTimeout(()=>botTurn(r),500);}
      if(r.host===socket.id){const nh=r.players.find(p=>!p.isBot);if(nh)r.host=nh.id;}
    }
    const si=r.spectators.findIndex(s=>s.id===socket.id);if(si!==-1)r.spectators.splice(si,1);
    io.to(r.code).emit('room-update',pubState(r));
  });
});

app.get('/stats',(req,res)=>{
  const t=getToday(),ts=traffic.dailyStats[t]||{visitors:0,games:0};
  res.json({onlineNow:io.engine.clientsCount,totalConnections:traffic.totalConnections,uniqueVisitors:traffic.uniqueVisitors.size,gamesCreated:traffic.gamesCreated,gamesStarted:traffic.gamesStarted,gamesCompleted:traffic.gamesCompleted,peakConcurrent:traffic.peakConcurrent,today:{date:t,visitors:ts.visitors,games:ts.games},activeRooms:Object.keys(rooms).length});
});

app.get('/stats-dashboard',(req,res)=>{
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>UNO Stats</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Poppins,sans-serif;background:#1a1a2e;color:#fff;padding:20px}.c{max-width:800px;margin:0 auto}h1{text-align:center;margin-bottom:10px;font-size:28px}.s{text-align:center;color:#a0aec0;margin-bottom:30px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:30px}.card{background:#16213e;padding:20px;border-radius:16px;text-align:center;border:1px solid rgba(255,255,255,0.05)}.card.live{border-color:#2ecc71;animation:pulse 2s infinite}@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(46,204,113,0.3)}50%{box-shadow:0 0 20px rgba(46,204,113,0.2)}}.n{font-size:36px;font-weight:900;margin:10px 0}.l{font-size:12px;color:#a0aec0;text-transform:uppercase;letter-spacing:1px}.o{color:#2ecc71}.v{color:#e74c3c}.gm{color:#f1c40f}.p{color:#3498db}button{background:#e74c3c;color:white;border:none;padding:12px 30px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;display:block;margin:0 auto}.f{text-align:center;margin-top:30px;color:#666;font-size:12px}</style></head><body><div class="c"><h1>UNO Ultimate Stats</h1><p class="s">Real-time analytics</p><div class="g"><div class="card live"><div class="l">Online Now</div><div class="n o" id="on">-</div></div><div class="card"><div class="l">Total Connections</div><div class="n v" id="tc">-</div></div><div class="card"><div class="l">Unique Visitors</div><div class="n v" id="uv">-</div></div><div class="card"><div class="l">Games Created</div><div class="n gm" id="gc">-</div></div><div class="card"><div class="l">Games Started</div><div class="n gm" id="gs">-</div></div><div class="card"><div class="l">Games Completed</div><div class="n gm" id="gp">-</div></div><div class="card"><div class="l">Peak Concurrent</div><div class="n p" id="pk">-</div></div><div class="card"><div class="l">Today's Visitors</div><div class="n v" id="tv">-</div></div></div><button onclick="load()">Refresh</button><div class="f">Auto-updates every 5s<br><span id="lu"></span></div></div><script>async function load(){try{const d=await(await fetch('/stats')).json();document.getElementById('on').textContent=d.onlineNow;document.getElementById('tc').textContent=d.totalConnections;document.getElementById('uv').textContent=d.uniqueVisitors;document.getElementById('gc').textContent=d.gamesCreated;document.getElementById('gs').textContent=d.gamesStarted;document.getElementById('gp').textContent=d.gamesCompleted;document.getElementById('pk').textContent=d.peakConcurrent;document.getElementById('tv').textContent=d.today.visitors;document.getElementById('lu').textContent='Updated: '+new Date().toLocaleTimeString();}catch(e){}}load();setInterval(load,5000);</script></body></html>`);
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('UNO running on port '+PORT));
