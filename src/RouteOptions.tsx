import {localizeNode} from './i18n';
import type {Dispatch} from 'react';
import {ChevronRight} from 'lucide-react';
import {formatTime,type Run,type Action} from './engine';
import {routeTravelSeconds,arrivalMargin} from './timeModel';
export default function RouteOptions({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 return <div className="route-options">{localizeNode(run.city.spawnStations[run.spawn].routes.map((r,i)=>{
  const margin=arrivalMargin(run,r);
  return <button className="route-option" key={r.id} onClick={()=>dispatch({type:'ROUTE',route:r})}><span className="route-line-symbol" style={{background:r.color}}>{localizeNode(r.lines[0])}</span><span className="route-option-main"><strong>{localizeNode(r.lines.join(' → '))}{localizeNode("号线")}{localizeNode(r.transfers?'换乘':'直达')}</strong><span>{localizeNode("预计路程 ")}{localizeNode(formatTime(routeTravelSeconds(run,r)))} · {localizeNode(r.transfers?r.transfers+' 次换乘':'不换乘')}{localizeNode(" · 步行 ")}{localizeNode(r.walk)}m</span><small className={'route-personality route-'+i}>{localizeNode(r.transfers?r.via+'下车换 '+r.lines[1]+' 号线':'经过 '+r.stops[r.stops.length-2]+' · 火车站下车')}</small></span><span className="route-margin"><small>{localizeNode(margin<0?'预计超过检票截止':'到站后检票约剩')}</small><b>{localizeNode(formatTime(Math.abs(margin)))}</b><ChevronRight size={21}/></span></button>;
 }))}</div>;
}
