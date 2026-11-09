const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express();app.use(express.static(__dirname+'/public'));
const srv=http.createServer(app),io=new Server(srv,{pingInterval:4000,pingTimeout:9000});
const G=380,rooms={};
const A={p:{dmg:8,reach:60,kb:7,s:4,e:10,len:24},k:{dmg:13,reach:88,kb:12,s:8,e:15,len:40}};
const mk=i=>({x:i?680:220,y:G,vx:0,vy:0,hp:100,f:i?-1:1,c:0,atk:'',at:0,st:0,hit:0,pp:0,pk:0,in:{}});
const tk=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const rnd=()=>{let c;do c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('');while(rooms[c]);return c};
const reset=r=>{r.s=[mk(0),mk(1)]};
function move(s,o){
 const i=s.in,g=s.y>=G,can=s.st<=0&&!s.atk;
 s.c=can&&g&&i.c?1:0;
 if(s.st>0){s.st--;s.vx*=.88}
 else if(g){s.vx=can&&!s.c?((i.r?1:0)-(i.l?1:0))*5:s.atk?s.vx*.8:0;if(can&&i.j)s.vy=-16}
 s.vy+=.8;s.x+=s.vx;s.y+=s.vy;
 if(s.y>=G){s.y=G;if(s.vy>0)s.vy=0}
 s.x=Math.max(30,Math.min(870,s.x));
 const dx=o.x-s.x;
 if(Math.abs(dx)<44&&Math.abs(o.y-s.y)<60)s.x+=(44-Math.abs(dx))/2*(dx>=0?-1:1);
 if(s.y>=G&&!s.atk&&s.st<=0)s.f=dx>=0?1:-1;
}
function attack(r,s,o){
 const n=s.in;
 for(const k of['p','k']){
  const edge=n[k]&&!s['p'+k];s['p'+k]=n[k]?1:0;
  if(edge&&!s.atk&&s.st<=0&&s.y>=G){s.atk=k;s.at=0;s.hit=0;s.c=0}
 }
 if(!s.atk)return;
 const a=A[s.atk];s.at++;
 if(s.at>=a.s&&s.at<=a.e&&!s.hit){
  const d=(o.x-s.x)*s.f;
  if(d>-10&&d<a.reach+22&&Math.abs(o.y-s.y)<90&&!(s.atk=='p'&&o.c)){
   s.hit=1;o.hp=Math.max(0,o.hp-a.dmg);o.st=14;o.vx=s.f*a.kb;o.atk='';o.at=0;
   io.to(r.code).emit('fx',{k:s.atk,x:(s.x+o.x)/2,y:o.y-(o.c?35:65)});
  }
 }
 if(s.at>=a.len)s.atk='';
}
function step(r){
 if(r.pl.some(p=>!p||!p.sid))return;
 r.t++;
 if(r.ph=='intro'){if(r.t>170){r.ph='fight';r.t=0;r.tm=3600}}
 else if(r.ph=='fight'){
  r.tm--;
  r.s.forEach((s,i)=>move(s,r.s[1-i]));
  r.s.forEach((s,i)=>attack(r,s,r.s[1-i]));
  const d=r.s.findIndex(s=>s.hp<=0);
  if(d>=0||r.tm<=0){
   const a=r.s[0].hp,b=r.s[1].hp;
   r.win=d>=0?1-d:a==b?-1:a>b?0:1;
   if(r.win>=0)r.w[r.win]++;
   r.ph='end';r.t=0;r.ko=d>=0;
  }
 } else if(r.ph=='end'&&r.t>150){
  if(r.w.some(v=>v>=2))r.ph='over';
  else{r.rd++;reset(r);r.ph='intro';r.t=100}
 }
}
const snap=r=>({ph:r.ph,rd:r.rd,tm:r.tm,t:r.t,w:r.w,win:r.win,ko:r.ko,c:r.pl.map(p=>p&&p.sid?1:0),
 p:r.s.map(s=>[s.x|0,s.y|0,s.f,s.c,s.atk,s.at,s.hp,s.st>0?1:0])});
let n=0;
setInterval(()=>{
 n++;
 for(const c in rooms){
  const r=rooms[c];step(r);
  if(n%2==0)io.to(c).volatile.emit('s',snap(r));
  if(r.pl.every(p=>!p||!p.sid)){r.idle=r.idle||Date.now();if(Date.now()-r.idle>120000)delete rooms[c]}else r.idle=0;
 }
},1000/60);
io.on('connection',so=>{
 let r=null,i=-1;
 const attach=(room,slot)=>{r=room;i=slot;so.join(r.code);r.pl[i].sid=so.id;so.emit('joined',{code:r.code,slot:i,tok:r.pl[i].tok})};
 so.on('create',()=>{
  const code=rnd(),room={code,ph:'wait',t:0,rd:1,tm:3600,w:[0,0],pl:[{tok:tk()},null],rm:[0,0]};
  reset(room);rooms[code]=room;attach(room,0);
 });
 so.on('join',({code,tok}={})=>{
  const room=rooms[String(code||'').toUpperCase().trim()];
  if(!room)return so.emit('err','Room not found');
  let s=room.pl.findIndex(p=>p&&tok&&p.tok==tok);
  if(s<0){
   s=room.pl.findIndex(p=>!p);
   if(s<0)return so.emit('err','Room is full');
   room.pl[s]={tok:tk()};
  }else{
   const old=room.pl[s].sid;
   if(old&&old!=so.id)io.sockets.sockets.get(old)?.disconnect(true);
  }
  attach(room,s);
  if(room.ph=='wait'&&room.pl.every(p=>p&&p.sid)){room.ph='intro';room.t=0}
 });
 so.on('in',v=>{
  if(!r||!v||!r.s)return;
  const m={};for(const k of'lrjcpk')m[k]=!!v[k];
  r.s[i].in=m;
 });
 so.on('rematch',()=>{
  if(!r||r.ph!='over')return;
  r.rm[i]=1;
  if(r.rm[0]&&r.rm[1]){r.rm=[0,0];r.w=[0,0];r.rd=1;r.win=-1;reset(r);r.ph='intro';r.t=0}
 });
 so.on('pg',cb=>typeof cb=='function'&&cb());
 so.on('disconnect',()=>{
  if(r&&r.pl[i]&&r.pl[i].sid==so.id){
   r.pl[i].sid=null;
   if(r.ph=='wait'&&i==1)r.pl[1]=null;
  }
 });
});
srv.listen(process.env.PORT||3000,()=>console.log('AI Fight Arena on :'+(process.env.PORT||3000)));
