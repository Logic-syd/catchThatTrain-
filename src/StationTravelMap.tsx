import {useRef,useState,type Dispatch,type CSSProperties} from 'react';
import type {Run,Action} from './engine';
import {stationFor} from './stations';
import {mapRoads,mapTaskPoint,mapDistance,trainPoint} from './stationMapTravel';
import {Structure} from './StationMaps';
import {LittleYou} from './Scenes';
import {obstaclePosition,obstructionTitle} from './mapObstructions';
import {stationAvatarMotion,stationAvatarEffort} from './stationMotion';
import type {StationActionProgress} from './StationActionContext';
export default function StationTravelMap({run,dispatch,blocked,action}:{run:Run;dispatch:Dispatch<Action>;blocked:boolean;action?:StationActionProgress}){
 const st=stationFor(run),map=run.stationMap,ref=useRef<SVGSVGElement>(null),task=mapTaskPoint(run),train=trainPoint(run);
 const send=(p:{x:number;y:number})=>{if(!blocked)dispatch({type:'MAP_TARGET',point:p});};
 const clickRoad=(event:React.PointerEvent)=>{const svg=ref.current,matrix=svg?.getScreenCTM();if(!svg||!matrix)return;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const local=p.matrixTransform(matrix.inverse());send({x:local.x,y:local.y-45});};
 const motion=stationAvatarMotion(run,blocked,action);
 const [overview,setOverview]=useState(false),position=map?.position??{x:250,y:135};
 const viewBox=overview?'0 0 500 325':`${Math.max(0,Math.min(210,position.x-145))} ${Math.max(0,Math.min(85,position.y+45-120))} 290 240`;
 return <><button className="map-follow-toggle" onClick={()=>setOverview(v=>!v)}>{overview?'跟随小人':'看全站地图'}</button><svg ref={ref} className="travel-map" viewBox={viewBox} role="group" aria-label={st.name+'，点击通道选路，按住赶路前进'} style={{background:st.paper,'--map-accent':st.accent} as CSSProperties}>
  <text x="20" y="24" className="travel-station-name">{st.name}</text><text x="480" y="24" textAnchor="end" className="travel-map-key">虚线＝选择的路线</text>
  <g transform="translate(0 45)">
   <g className="travel-buildings"><Structure id={st.id}/></g>
   {mapRoads(run).map(([a,b],i)=><g key={i}><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="travel-road-edge"/><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="travel-road"/><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="travel-road-hit" onPointerDown={clickRoad}/></g>)}
   {map&&map.path.length>0&&<polyline className="travel-planned-path" points={[map.position,...map.path].map(p=>p.x+','+p.y).join(' ')}/>}
   {st.nodes.map(n=><g key={n.id} role="button" tabIndex={blocked?-1:0} aria-label={'走到'+n.label} onClick={()=>send(n)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();send(n);}}} className="travel-landmark"><circle cx={n.x} cy={n.y} r="25" fill="transparent"/><circle cx={n.x} cy={n.y} r={n.kind==='gate'?9:6} fill="#fffbed" stroke={st.accent} strokeWidth="2"/><text x={Math.max(48,Math.min(451,n.x))} y={n.y+21} textAnchor="middle">{n.label}</text></g>)}
   <g role="button" tabIndex={blocked?-1:0} aria-label="走向列车" onClick={()=>send(train)} onKeyDown={e=>{if(e.key==='Enter')send(train);}}><circle cx={train.x} cy={train.y} r="25" fill="transparent"/><text x={train.x} y={train.y+3} fontSize="22" textAnchor="middle">🚄</text></g>
   <g className="travel-encounter" role="button" tabIndex={blocked?-1:0} aria-label={'走到事件：'+run.stationJourney[run.stationBeat]?.label} onClick={()=>send(task)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();send(task);}}}><circle cx={task.x} cy={task.y} r="28" fill="transparent"/><circle className="encounter-ring" cx={task.x} cy={task.y} r="14"/><text x={task.x} y={task.y+5} textAnchor="middle">!</text></g>
   {map?.obstacles.filter(o=>o.kind==='closed'||overview||mapDistance(position,o.point)<105).map(o=>{const p=obstaclePosition(o,run.elapsed),offset=o.cleared?18:0;return <g key={o.id} className={'travel-human'+(map.block?.id===o.id?' active':'')+(o.cleared?' cleared':'')} transform={`translate(${p.x-o.direction.y*offset} ${p.y+o.direction.x*offset})`}><title>{obstructionTitle(o.kind)}</title>{o.kind==='closed'?<><rect x="-14" y="-13" width="28" height="27" rx="4" fill="#be8974"/><path d="M-10-7H10M-10-1H10M-10 5H10" stroke="#eedbc3" strokeWidth="2"/><text x="0" y="27" textAnchor="middle">人工未开</text></>:o.kind==='security'?<><rect x="-16" y="-18" width="32" height="33" rx="5" fill="#b5c29f"/><text y="-1" textAnchor="middle">安检</text><text y="27" textAnchor="middle">慢慢排</text></>:<g transform={o.kind==='child'?'scale(.75)':'scale(1)'}>{(o.kind==='crowd'||o.kind==='door')&&[-15,15].map(x=><g key={x} transform={`translate(${x} 0)`}><rect className="human-body" x="-6" y="-4" width="12" height="18" rx="5" fill="#b5aa8f"/><circle cy="-8" r="5" fill="#dab992"/></g>)}<rect className="human-body" x="-8" y="-5" width="16" height="20" rx="6" fill={o.kind==='child'?'#d9a568':'#94ab9b'}/><circle cy="-11" r="7" fill="#dabb98"/><path d="M-5 15l-3 6m13-6 3 6" stroke="#7b674b" strokeWidth="3"/>{o.kind==='landing'&&<rect x="7" y="0" width="5" height="8" fill="#6f695e"/>}<text y="34" textAnchor="middle">{o.kind==='door'?'堵门':o.kind==='landing'?'停在出口':o.kind==='child'?'乱跑':'人挤人'}</text></g>}</g>;})}
   {map?.destination&&mapDistance(map.destination,task)>4&&<circle cx={map.destination.x} cy={map.destination.y} r="10" className="travel-destination"/>}
   {map&&<g className={'travel-avatar '+motion} transform={`translate(${map.position.x} ${map.position.y})`}>
    <g className="avatar-steps" fill="#b5976255"><ellipse cx="-5" cy="9" rx="2" ry="3"/><ellipse cx="5" cy="16" rx="2" ry="3"/></g>
    <foreignObject x="-31" y="-51" width="62" height="66"><LittleYou characterId={run.character.id} parentAppearance={run.parent?.appearance} childGap={run.parent?.gap} carrying={run.parent?.carrying} motion={motion} effort={stationAvatarEffort(run)}/></foreignObject><text y="30" textAnchor="middle">你</text>
   </g>}
  </g>
 </svg></>;
}
