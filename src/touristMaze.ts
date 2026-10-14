import type {Run} from './engine';
import type {EventConfig} from './data';

export type TouristMaze={node:number;visited:number[];known:number[];steps:number;wrongTurns:number;asks:number;signs:number;revision:number;found:boolean;trail:[number,number][]};
export const MAZE_LOCATIONS=['地铁出口','商店岔路','出发层大厅','到达通道','行李寄存区','铁路安检入口'];
const LINKS=[[1,3],[4,2],[5,4],[0,4],[1,3],[]];
const GUIDE=[0,1,0,0,0];
export const createTouristMaze=():TouristMaze=>({node:0,visited:[0],known:[],steps:0,wrongTurns:0,asks:0,signs:0,revision:0,found:false,trail:[]});
const MAZE_COSTS={walk:20,sign:8,ask:12,read:2} as const;
/** Forecast assumes the shortest path, retaining directions already learned. */
export function mazeForecastSeconds(m:TouristMaze){
 let seconds=0,node=m.node;
 while(node!==5){
  seconds+=MAZE_COSTS.walk+MAZE_COSTS.read+(m.known.includes(node)?0:MAZE_COSTS.sign+MAZE_COSTS.read);
  node=LINKS[node][GUIDE[node]];
 }
 return seconds;
}
const flipped=(station:string)=>['beijing','hangzhou','zhengzhou'].includes(station);
export function mazeDirection(node:number,station:string){return (GUIDE[node]^(flipped(station)?1:0))===0?'left':'right';}
export function mazeDestination(node:number,direction:string,station:string){return LINKS[node][(direction==='left'?0:1)^(flipped(station)?1:0)];}
export function applyMazeChoice(m:TouristMaze,option:string,station:string):TouristMaze{
 if(m.found)return m;
 if(option==='ask'||option==='sign')return {...m,known:[...new Set([...m.known,m.node])],asks:m.asks+(option==='ask'?1:0),signs:m.signs+(option==='sign'?1:0),revision:m.revision+1};
 if(option!=='left'&&option!=='right')return m;
 const next=mazeDestination(m.node,option,station);if(next===undefined)return m;
 return {...m,node:next,visited:[...new Set([...m.visited,next])],steps:m.steps+1,wrongTurns:m.wrongTurns+(option!==mazeDirection(m.node,station)?1:0),revision:m.revision+1,found:next===5,trail:[...m.trail,[m.node,next]]};
}
export function touristMazePrompt(s:Run):EventConfig{
 const m=s.touristMaze!,known=m.known.includes(m.node),direction=mazeDirection(m.node,s.city.id),left=direction==='left';
 return {id:'tourist-maze',revision:m.revision,phase:'station',title:`又一个岔路：${MAZE_LOCATIONS[m.node]}`,description:known?`刚确认的路标：铁路出发往${left?'左':'右'}。车票是 ${s.gate}，先找到铁路安检入口。`:'这里的通道都长得差不多。人群不一定去铁路出发；可以问路或走近看路标，别把到达层当成出发层。',interaction:{kind:'choice',seconds:14,penalty:0},choices:[
  ...(['left','right'] as const).map(id=>({id,label:id==='left'?'走左侧连廊':'走右侧连廊',detail:`步行 ${MAZE_COSTS.walk} 游戏秒 · 精力 −${Math.min(2,s.characterTime!.energy)}${known&&id===direction?' · 路标：铁路出发方向':''}`,seconds:MAZE_COSTS.walk,fixedWalkSeconds:MAZE_COSTS.walk,waitSeconds:0,stationDecision:{group:'tourist-maze-'+m.steps,value:id,category:'navigation' as const,optimal:id===direction}})),
  ...(!known?[
   {id:'sign',label:'走近看清路标',detail:`花 ${MAZE_COSTS.sign} 游戏秒 · 确认这个路口的方向`,seconds:MAZE_COSTS.sign,waitSeconds:MAZE_COSTS.sign},
   {id:'ask',label:'问工作人员怎么走',detail:`花 ${MAZE_COSTS.ask} 游戏秒 · 确认这个路口的方向`,seconds:MAZE_COSTS.ask,waitSeconds:MAZE_COSTS.ask},
  ]:[]),
 ]};
}
