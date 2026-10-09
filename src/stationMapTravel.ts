import type {Run} from './engine';
import {stationFor,selectedPath} from './stations';
import {createMapObstacles,newBlock,obstaclePosition,type MapObstacle,type MapBlock} from './mapObstructions';
import type {MapChildDelay} from './mapTimeFeedback';
export type MapPoint={x:number;y:number};
export type MapTravel={position:MapPoint;path:MapPoint[];destination:MapPoint|null;legBeat:number;legDistance:number;obstacles:MapObstacle[];block:MapBlock|null;bypassing:boolean;bypassRemaining:number;notice:string;childDelay?:MapChildDelay;manual?:boolean;driveHeld?:boolean};
export const mapDistance=(a:MapPoint,b:MapPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a:MapPoint,b:MapPoint,t:number):MapPoint=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function mapRoads(run:Run):[MapPoint,MapPoint][]{
 const st=stationFor(run),lookup=(id:string)=>st.nodes.find(n=>n.id===id)!;
 return [...st.edges.map(([a,b]):[MapPoint,MapPoint]=>[lookup(a),lookup(b)]),[lookup('gate'),trainPoint(run)]];
}
export function trainPoint(run:Run):MapPoint{const gate=stationFor(run).nodes.find(n=>n.id==='gate')!;return {x:Math.min(477,gate.x+24),y:Math.min(239,gate.y+28)};}
function project(p:MapPoint,a:MapPoint,b:MapPoint){const dx=b.x-a.x,dy=b.y-a.y;return lerp(a,b,Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))));}
export function snapToRoad(run:Run,p:MapPoint):MapPoint{return mapRoads(run).map(([a,b])=>project(p,a,b)).sort((a,b)=>mapDistance(p,a)-mapDistance(p,b))[0];}
// Split edges at the traveller, destination and encounter; pathfinding never cuts through buildings.
export function mapPath(run:Run,from:MapPoint,to:MapPoint):MapPoint[]{
 const roads=mapRoads(run),start=snapToRoad(run,from),end=snapToRoad(run,to),task=mapTaskPoint(run);
 const points:MapPoint[]=[],adj:number[][]=[];const index=(p:MapPoint)=>{let i=points.findIndex(q=>mapDistance(p,q)<.01);if(i<0){i=points.length;points.push(p);adj.push([]);}return i;};
 const si=index(start),ei=index(end);
 for(const [a,b] of roads){const cuts=[a,b,...[start,end,task].filter(p=>mapDistance(p,project(p,a,b))<.01)].sort((p,q)=>mapDistance(a,p)-mapDistance(a,q));for(let j=1;j<cuts.length;j++){const x=index(cuts[j-1]),y=index(cuts[j]);if(x!==y){adj[x].push(y);adj[y].push(x);}}}
 const dist=points.map(()=>Infinity),prev=points.map(()=>-1),visited=new Set<number>();dist[si]=0;
 for(let k=0;k<points.length;k++){let u=-1;for(let i=0;i<points.length;i++)if(!visited.has(i)&&(u<0||dist[i]<dist[u]))u=i;if(u<0||dist[u]===Infinity)break;if(u===ei)break;visited.add(u);for(const v of adj[u]){const d=dist[u]+mapDistance(points[u],points[v]);if(d<dist[v]){dist[v]=d;prev[v]=u;}}}
 if(dist[ei]===Infinity)return [];
 const path:MapPoint[]=[];for(let i=ei;i!==si&&i>=0;i=prev[i])path.unshift(points[i]);return path;
}
export function pathLength(from:MapPoint,path:MapPoint[]){return path.reduce((sum,p,i)=>sum+mapDistance(i?path[i-1]:from,p),0);}
function pathPoint(points:MapPoint[],at:number){let left=at;for(let i=1;i<points.length;i++){const len=mapDistance(points[i-1],points[i]);if(left<=len)return lerp(points[i-1],points[i],len?left/len:0);left-=len;}return points.at(-1)!;}
export function mapTaskPoint(run:Run,beatIndex=run.stationBeat):MapPoint{
 const st=stationFor(run),selected=selectedPath(run);
 // Wrong entrances are dead ends to explore, not a new mandatory route for the whole station.
 const route=(['outer','lift'].includes(selected??'')?st.routes.find(r=>r.id===selected):undefined)??st.routes[0];
 const nodes=route.points.map(id=>st.nodes.find(n=>n.id===id)!);const gate=nodes.at(-1)!;
 // An elevator still leads through security before the departure hall.
 if(!nodes.some(n=>n.id==='security'))nodes.splice(nodes.findIndex(n=>n.id==='hall'),0,st.nodes.find(n=>n.id==='hall')!,st.nodes.find(n=>n.id==='security')!);
 const points:MapPoint[]=[...nodes,trainPoint(run)],distAt=(id:string)=>pathLength(points[0],points.slice(1,nodes.map(n=>n.id).lastIndexOf(id)+1));
 const entry=distAt('entry'),security=distAt('security'),hall=distAt('hall'),end=distAt(gate.id);
 const hasVertical=run.stationJourney.some(b=>b.stage===1);
 const bounds=[0,entry,hasVertical?entry+(security-entry)*.55:entry,security,hall,end,pathLength(points[0],points.slice(1))];
 const beat=run.stationJourney[beatIndex];if(!beat)return trainPoint(run);
 const peers=run.stationJourney.map((b,i)=>({b,i})).filter(({b})=>b.stage===beat.stage),rank=peers.findIndex(({i})=>i===beatIndex);
 const stage=Math.min(5,beat.stage),ratio=(rank+1)/peers.length;
 return snapPoint(pathPoint(points,bounds[stage]+(bounds[stage+1]-bounds[stage])*ratio));
 function snapPoint(p:MapPoint){return snapToRoad(run,p);}
}
export function initialMapTravel(run:Run):MapTravel{const position=stationFor(run).nodes.find(n=>n.id==='metro')!;return {position:{x:position.x,y:position.y},path:[],destination:null,legBeat:-1,legDistance:0,obstacles:createMapObstacles(run),block:null,bypassing:false,bypassRemaining:0,notice:''};}
export function setMapDestination(run:Run,point:MapPoint):MapTravel{
 const old=run.stationMap??initialMapTravel(run),destination=snapToRoad(run,point);
 const task=mapTaskPoint(run),toTask=mapPath(run,old.position,task);
 // A click on the final gate keeps the goal across the intervening required facilities.
 const gate=stationFor(run).nodes.find(n=>n.id==='gate')!;
 const onward=mapDistance(destination,gate)<1||mapDistance(destination,trainPoint(run))<1;
 const path=onward?[...toTask,...mapPath(run,task,destination)]:mapPath(run,old.position,destination);
 return {...old,destination,path,notice:'',legBeat:run.stationBeat,legDistance:old.legBeat===run.stationBeat?old.legDistance:Math.max(8,pathLength(old.position,toTask))};
}
export function advanceOnMap(run:Run,amount:number):{map:MapTravel;encounter:boolean;obstruction?:MapObstacle}{
 const old=run.stationMap!,task=mapTaskPoint(run);let position=old.position,path=[...old.path],left=amount,bypassRemaining=old.bypassRemaining;
 if(old.block)return {map:old,encounter:false};
 if(mapDistance(position,task)<.05)return {map:old,encounter:true};
 while(path.length&&left>0){
  const next=path[0],distance=mapDistance(position,next),end=distance>left?lerp(position,next,left/distance):next;
  // Check the whole movement segment, so neither sprint nor a long frame can pass through people.
  const hit=old.obstacles.filter(o=>!o.cleared&&o.kind!=='security').map(o=>{
   const center=obstaclePosition(o,run.elapsed),dx=end.x-position.x,dy=end.y-position.y,length=Math.hypot(dx,dy);
   const t=length?Math.max(0,Math.min(1,((center.x-position.x)*dx+(center.y-position.y)*dy)/(length*length))):0;
   const closest=lerp(position,end,t),gap=mapDistance(center,closest),radius=o.kind==='crowd'?12:8;
   if(gap>radius)return {o,at:Infinity};
   const along=t*length-Math.sqrt(Math.max(0,radius*radius-gap*gap));return {o,at:Math.max(0,along)};
  }).sort((a,b)=>a.at-b.at)[0];
  if(hit&&hit.at<=mapDistance(position,end)){
   const length=mapDistance(position,end);position=lerp(position,end,length?hit.at/length:0);
   return {map:{...old,position,path,block:newBlock(hit.o),bypassRemaining},encounter:false,obstruction:hit.o};
  }
  if(distance>left){position=end;left=0;}else{position=next;left-=distance;path.shift();if(bypassRemaining>0)bypassRemaining--;}
  if(mapDistance(position,task)<.05)return {map:{...old,position,path,bypassRemaining,bypassing:bypassRemaining>0},encounter:true};
 }
 return {map:{...old,position,path,bypassRemaining,bypassing:bypassRemaining>0,destination:path.length?old.destination:null},encounter:false};
}
