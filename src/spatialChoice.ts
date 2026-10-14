import type {Run} from './engine';
import {escalatorRide} from './stationEncounters';
import {withActualEventCosts} from './resourceFeedback';

export type Point={x:number;y:number};
export type SpatialRect=Point&{width:number;height:number};
export type SpatialObstacle=SpatialRect&{kind:'rail'|'crowd';label:string};
export type SpatialExit=SpatialRect&{choiceIndex:number;label:string;info:string[];kind:'stairs'|'lift'|'escalator'|'corridor'|'queue'|'sign'|'gate';people?:number;status?:'clear'|'steady'|'blocked'};
export type SpatialScene={id:string;width:number;height:number;start:Point;speed:number;radius:number;heading:string;instruction:string;exits:SpatialExit[];obstacles:SpatialObstacle[]};
export type SpatialInput={target:Point}|{direction:Point}|null;
export type SpatialMotion={position:Point;choiceIndex:number|null;blocked:boolean};
const EVENTS=new Set(['vertical-choice','escalator-choice','sh-corridor','security-queue','station-sign','gates']);
export function isHongqiaoSpatialEvent(run:Run):boolean{return run.phase==='station'&&run.city.id==='shanghai'&&run.character.id==='student'&&!!run.student&&!!run.event&&EVENTS.has(run.event.id);}

/** Geometry only controls handling input. It never prices distance, waiting or resources. */
export function buildSpatialScene(run:Run):SpatialScene|null{
 if(!isHongqiaoSpatialEvent(run))return null;
 const event=run.event!,u=run.student!;
 const scene:SpatialScene={id:event.id,width:360,height:270,start:{x:180,y:246},speed:155,radius:9,heading:'虹桥 · 出发层',instruction:'按住地面引导小人，绕过挡路的人和栏杆，走进入口。',exits:[],obstacles:[{x:143,y:145,width:74,height:18,kind:'rail',label:'栏杆'}]};
 const top=(i:number,n:number):SpatialRect=>({x:n===2?16+i*188:12+i*118,y:10,width:n===2?140:100,height:90});
 if(event.id==='vertical-choice'){
  scene.heading='上楼入口';
  scene.exits=event.choices.map((c,i)=>({...top(i,3),choiceIndex:i,kind:c.studentEffect==='stairs'?'stairs':c.studentEffect==='lift'?'lift':'escalator',label:c.studentEffect==='stairs'?'楼梯':c.studentEffect==='lift'?'直达电梯':'扶梯厅',info:c.studentEffect==='stairs'?['上楼最多耗 22 体力','到达后逐步上楼']:c.studentEffect==='lift'?[`等待 ${c.seconds} 秒`,'站着恢复体力']:['三部扶梯','进去看通行情况']}));
 }
 if(event.id==='escalator-choice'){
  scene.heading='看清人群，再走进扶梯';scene.obstacles=[{x:105,y:157,width:45,height:30,kind:'crowd',label:'旅客'},{x:240,y:128,width:34,height:42,kind:'crowd',label:'行李'}];
  scene.exits=event.choices.map((c,i)=>{const status=run.stationLuck.escalators[c.escalator??i];const ride=withActualEventCosts(run,escalatorRide(status,c.escalator??i));return {...top(i,3),choiceIndex:i,kind:'escalator',status,label:`${i+1} 号扶梯`,people:status==='clear'?0:status==='steady'?2:5,info:status==='clear'?['前面空着','可快走 · 无固定等待']:[status==='blocked'?'出口人群拥堵':'旅客正常站立',`上楼等待 ${ride.choices[0].seconds} 秒`]};});
 }
 if(event.id==='sh-corridor'){
  scene.heading='长廊分岔';scene.obstacles=[{x:140,y:135,width:50,height:42,kind:'crowd',label:'挡路旅客'},{x:242,y:133,width:40,height:25,kind:'crowd',label:'商店人群'}];
  scene.exits=event.choices.map((c,i)=>({...top(i,2),choiceIndex:i,kind:'corridor',label:c.stationDecision?.value==='shops'?'商店通道':'外侧长廊',info:c.stationDecision?.value==='shops'?['后面路程 −25%','人群更密']:['后面路程 +10%','路障更少']}));
 }
 if(event.id==='security-queue'){
  scene.heading='安检入口 · 先看行李与通行速度';const known=u.observed||u.stats.focus>=75;
  scene.exits=event.choices.map((c,i)=>({...top(i,3),choiceIndex:i,kind:'queue',label:`${String.fromCharCode(65+i)} 队`,people:u.queues[i]?.people??0,info:known?[u.queues[i].hint,`排队 ${c.seconds} 秒`]:[`${u.queues[i]?.people??0} 人`,'按住观察看清速度']}));
 }
 if(event.id==='station-sign'){
  scene.heading=`车票 ${run.gate} · ← 1–15 号 ｜ 16–30 号 →`;
  scene.exits=[0,1].map(side=>{const correct=(parseInt(run.gate)<=15?0:1)===side;return {...top(side,2),choiceIndex:correct?0:1,kind:'sign',label:side===0?'← 1–15 号':'16–30 号 →',info:['按车票编号找方向']};});
 }
 if(event.id==='gates'){
  scene.height=370;scene.start={x:180,y:347};scene.heading=`车票 ${run.gate} · 八条通道都通往本检票口`;
  scene.obstacles=[{x:166,y:266,width:29,height:21,kind:'crowd',label:'候车旅客'},{x:204,y:159,width:15,height:38,kind:'rail',label:'栏杆'}];
  scene.exits=event.choices.map((c,i)=>({x:i<4?8:248,y:8+(i%4)*78,width:104,height:68,choiceIndex:i,kind:'gate',label:c.label,people:Math.max(1,Math.round((c.waitSeconds??c.seconds)/10)),info:[`步行 ${c.fixedWalkSeconds??0} · 排队 ${c.waitSeconds??c.seconds}`,`合计 ${c.seconds} 秒`]}));
 }
 return scene;
}

export function pointInside(p:Point,r:SpatialRect):boolean{return p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;}
export function spatialPositionIsClear(scene:SpatialScene,p:Point):boolean{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<scene.radius||p.y<scene.radius||p.x>scene.width-scene.radius||p.y>scene.height-scene.radius)return false;
 return !scene.obstacles.some(o=>{const x=Math.max(o.x,Math.min(o.x+o.width,p.x)),y=Math.max(o.y,Math.min(o.y+o.height,p.y));return (p.x-x)**2+(p.y-y)**2<scene.radius**2;});
}
const entered=(scene:SpatialScene,p:Point)=>scene.exits.find(e=>pointInside(p,e))?.choiceIndex??null;

/** Integrates the existing event clock. Substeps prevent tunnelling through people/rails. */
export function advanceSpatialMotion(scene:SpatialScene,position:Point,input:SpatialInput,dt:number):SpatialMotion{
 let p={...position},blocked=false;
 if(!input||!Number.isFinite(dt)||dt<=0)return {position:p,choiceIndex:null,blocked};
 let remaining=dt;
 while(remaining>1e-9){
  const step=Math.min(remaining,1/120);remaining-=step;
  const d='target'in input?{x:input.target.x-p.x,y:input.target.y-p.y}:input.direction;
  const length=Math.hypot(d.x,d.y);if(!Number.isFinite(length)||length<1e-7)break;
  const travel=Math.min(scene.speed*step,'target'in input?length:Infinity),dx=d.x/length*travel,dy=d.y/length*travel;
  const next={x:p.x+dx,y:p.y+dy};
  if(spatialPositionIsClear(scene,next))p=next;
  else {blocked=true;const horizontal={x:p.x+dx,y:p.y},vertical={x:p.x,y:p.y+dy};if(Math.abs(dx)>1e-8&&spatialPositionIsClear(scene,horizontal))p=horizontal;if(Math.abs(dy)>1e-8&&spatialPositionIsClear(scene,{x:p.x,y:vertical.y}))p={x:p.x,y:vertical.y};}
  const choiceIndex=entered(scene,p);if(choiceIndex!==null)return {position:p,choiceIndex,blocked};
 }
 return {position:p,choiceIndex:null,blocked};
}

/** Deterministic route for input simulations, including recovery from a replaced scene.start. */
export function planSpatialPath(scene:SpatialScene,choiceIndex:number):Point[]{
 const exit=scene.exits.find(e=>e.choiceIndex===choiceIndex);if(!exit)return [];
 const target={x:exit.x+exit.width/2,y:exit.y+exit.height/2},start=scene.start;
 const clearLine=(a:Point,b:Point)=>{const distance=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(distance/2));for(let i=1;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!spatialPositionIsClear(scene,p)||scene.exits.some(e=>e.choiceIndex!==choiceIndex&&pointInside(p,{x:e.x-2,y:e.y-2,width:e.width+4,height:e.height+4})))return false;}return true;};
 if(clearLine(start,target))return [target];
 const grid=12,columns=Math.floor(scene.width/grid),rows=Math.floor(scene.height/grid);
 const nodes:Point[]=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)nodes.push({x:scene.radius+x*grid,y:scene.radius+y*grid});
 const usable=nodes.map(p=>spatialPositionIsClear(scene,p)&&!scene.exits.some(e=>e.choiceIndex!==choiceIndex&&pointInside(p,e)));
 let startIndex=-1,startDistance=Infinity;nodes.forEach((p,i)=>{const d=Math.hypot(p.x-start.x,p.y-start.y);if(usable[i]&&d<startDistance&&clearLine(start,p)){startIndex=i;startDistance=d;}});
 if(startIndex<0)return [];
 const queue=[startIndex],previous=new Map<number,number>([[startIndex,-1]]);let end=-1;
 for(let at=0;at<queue.length;at++){const i=queue[at],p=nodes[i];if(clearLine(p,target)){end=i;break;}const x=i%columns,y=Math.floor(i/columns);for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=columns||ny<0||ny>=rows)continue;const next=ny*columns+nx;if(!previous.has(next)&&usable[next]&&clearLine(p,nodes[next])){previous.set(next,i);queue.push(next);}}}
 if(end<0)return [];
 const reversed:Point[]=[target];for(let i=end;i>=0;i=previous.get(i)??-1)reversed.push(nodes[i]);const path=reversed.reverse();
 const compact:Point[]=[];let from=start;for(let i=0;i<path.length;){let furthest=i;for(let j=i+1;j<path.length;j++){if(clearLine(from,path[j]))furthest=j;}compact.push(path[furthest]);from=path[furthest];i=furthest+1;}
 return compact;
}

const operationSecondsCache=new Map<string,number>();
/** Prediction only: traverses the same geometry, stopping at the entrance rather than its centre. */
export function spatialOperationSeconds(scene:SpatialScene,choiceIndex:number):number{
 const rect=(r:SpatialRect)=>[r.x,r.y,r.width,r.height];
 const key=JSON.stringify([choiceIndex,scene.width,scene.height,scene.start.x,scene.start.y,scene.speed,scene.radius,scene.exits.map(e=>[e.choiceIndex,...rect(e)]),scene.obstacles.map(rect)]);
 const cached=operationSecondsCache.get(key);if(cached!==undefined)return cached;
 const path=planSpatialPath(scene,choiceIndex);let position={...scene.start},elapsed=0,reached:number|null=null;
 for(const target of path){for(let i=0;i<1000&&Math.hypot(target.x-position.x,target.y-position.y)>.001&&reached===null;i++){
  const step=Math.min(.01,Math.hypot(target.x-position.x,target.y-position.y)/scene.speed),next=advanceSpatialMotion(scene,position,{target},step);
  if(Math.hypot(next.position.x-position.x,next.position.y-position.y)<1e-9)break;
  position=next.position;elapsed+=step;reached=next.choiceIndex;
 }if(reached!==null)break;}
 const seconds=reached===choiceIndex?elapsed:Infinity;
 if(operationSecondsCache.size>=128)operationSecondsCache.clear();operationSecondsCache.set(key,seconds);return seconds;
}
