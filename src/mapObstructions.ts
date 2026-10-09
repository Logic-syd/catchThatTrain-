import type {Run} from './engine';
import type {MapPoint,MapTravel} from './stationMapTravel';
import {stationFor} from './stations';

export type ObstructionKind='door'|'landing'|'child'|'crowd'|'closed'|'security';
export type MapObstacle={id:string;kind:ObstructionKind;point:MapPoint;direction:MapPoint;cleared:boolean;phase:number};
export type MapQueue={people:number;interval:number;serviceElapsed:number;label:string;detail:string};
export type MapBlock={id:string;mode:'stopped'|'waiting'|'yielding'|'queue'|'tray';elapsed:number;duration:number;waited:number;lane:number|null;queues:MapQueue[]};
export type ClearMethod='ask'|'sidestep'|'wait'|'leave'|'tray'|'join';
export const obstructionTitle=(kind:ObstructionKind)=>({door:'车门开了，前面的人还没动！',landing:'刚下扶梯，前面的人就停住了',child:'小孩突然横穿过来了！',crowd:'并排走的人把通道占满了',closed:'人工窗口没开，白跑到跟前了',security:'安检队伍怎么还不往前走？'}[kind]);

// Draw once when entering the map. Taking a different corridor encounters different people.
export function createMapObstacles(run:Run):MapObstacle[]{
 const st=stationFor(run),out:MapObstacle[]=[],seed=run.metroIncidentVariant;
 const add=(kind:ObstructionKind,a:string,b:string,t:number)=>{
  const from=st.nodes.find(n=>n.id===a),to=st.nodes.find(n=>n.id===b);if(!from||!to)return;
  const len=Math.hypot(to.x-from.x,to.y-from.y)||1;
  out.push({id:'map-'+kind,kind,point:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},direction:{x:(to.x-from.x)/len,y:(to.y-from.y)/len},cleared:false,phase:seed*6.28});
 };
 add('door','metro','entry',.24+seed*.08);
 if(st.id==='shanghai'){add('landing','shops','security',.3);add('crowd','shops','security',.75);}
 else if(st.id==='guangzhou'){add('crowd','entry','center',.48);add('landing','lift','security',.35);}
 else if(st.id==='wuhan')add('landing','stairs','security',.22);
 else if(st.id==='hangzhou')add('crowd','entry','east',.5);
 else if(st.id==='beijing')add('crowd','entry','west',.46);
 else add('crowd','security','hall',.45);
 add('child','hall',st.id==='zhengzhou'?'east':'gate',.42+seed*.12);
 add('closed',st.id==='zhengzhou'?'east':'hall','gate',.82);
 return out;
}
export function obstaclePosition(obstacle:MapObstacle,elapsed:number):MapPoint{
 if(obstacle.kind!=='child')return obstacle.point;
 const offset=Math.sin(elapsed*2.5+obstacle.phase)*22;
 return {x:obstacle.point.x-obstacle.direction.y*offset,y:obstacle.point.y+obstacle.direction.x*offset};
}
export function newBlock(obstacle:MapObstacle):MapBlock{return {id:obstacle.id,mode:'stopped',elapsed:0,duration:0,waited:0,lane:null,queues:[]};}
export function mapSecurityBlock(run:Run,point:MapPoint):{obstacle:MapObstacle;block:MapBlock}{
 const raw=run.student?.queues??[{people:6,seconds:24,hint:'前面只背小包，托盘已摆好'},{people:3,seconds:55,hint:'一家人带着几只箱子，正打开侧袋'},{people:8,seconds:32,hint:'队列长一些，两台机器都亮着灯'}];
 const strict=run.city.id==='beijing'?1.15:1;
 const queues=raw.map((q,i)=>({people:q.people,interval:q.seconds/q.people/4*strict,serviceElapsed:0,label:String.fromCharCode(65+i)+' 队',detail:q.hint}));
 const obstacle:MapObstacle={id:'map-security',kind:'security',point,direction:{x:0,y:-1},cleared:false,phase:0};
 return {obstacle,block:{...newBlock(obstacle),queues}};
}
export function activeObstacle(map:MapTravel){return map.obstacles.find(o=>o.id===map.block?.id);}
export function obstacleCanBypass(kind:ObstructionKind){return kind!=='security';}

export function mapQueueWait(queue:MapQueue){return Math.max(0,queue.people*queue.interval-(queue.serviceElapsed??0));}
// All lanes share the game clock, but each checkpoint processes its own front passenger.
export function advanceMapQueues(queues:MapQueue[],seconds:number):MapQueue[]{
 return queues.map(q=>{
  if(q.people===0||seconds<=0)return q;
  const elapsed=(q.serviceElapsed??0)+seconds;
  const served=Math.min(q.people,Math.floor((elapsed+1e-9)/q.interval));
  const people=q.people-served;
  return {...q,people,serviceElapsed:people?Math.max(0,elapsed-served*q.interval):0};
 });
}

// Local, physical sidestep inside the corridor. It retains the onward route and takes time to walk.
export function bypassObstacle(map:MapTravel,obstacle:MapObstacle):MapTravel{
 const next=map.path[0]??map.destination??obstacle.point;
 const dx=next.x-map.position.x,dy=next.y-map.position.y,len=Math.hypot(dx,dy)||1;
 const dir={x:dx/len,y:dy/len},normal={x:-dir.y,y:dir.x},offset=obstacle.kind==='closed'?22:19;
 const side=(p:MapPoint):MapPoint=>({x:p.x+normal.x*offset,y:p.y+normal.y*offset});
 const after={x:obstacle.point.x+dir.x*15,y:obstacle.point.y+dir.y*15};
 return {...map,block:null,bypassing:true,bypassRemaining:3,path:[side(map.position),side(after),after,...map.path],obstacles:map.obstacles.map(o=>o.id===obstacle.id?{...o,cleared:true}:o),notice:obstacle.kind==='closed'?'转向旁边开放的自助通道':'侧身绕过去，接着赶路'};
}
export function clearMapObstacle(map:MapTravel):MapTravel{
 return {...map,block:null,obstacles:map.obstacles.map(o=>o.id===map.block?.id?{...o,cleared:true}:o),notice:'前面让开了，继续赶路！'};
}
