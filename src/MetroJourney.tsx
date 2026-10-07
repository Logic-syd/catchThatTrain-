import type { Dispatch } from 'react';
import { ArrowRight, Footprints, TrainFront } from 'lucide-react';
import { DOOR_SECONDS, type Action, type Run } from './engine';
import { LittleYou, MetroScene } from './Scenes';

export default function MetroJourney({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}) {
 const route=run.route!;
 const arrived=run.phase==='arrival';
 const stop=route.stops[Math.min(run.metroStopIndex+(arrived?0:1),route.stops.length-1)];
 const line=route.lines[run.metroTransferred?1:0];
 const recovering=run.phase==='metro-recovery',transferring=run.phase==='transfer';
 return <section className={'journey-scene interactive-metro '+(arrived?'open-doors':'')}>
  <div className="metro-route-note"><TrainFront size={17}/><span><b>{line}号线 · 目的地：{run.city.stationName}</b><small>{route.transfers?`计划：${route.via}下车，换乘${route.lines[1]}号线`:'直达路线 · 看清站名，再决定下车'}</small></span></div>
  {recovering||transferring?<div className="metro-recovery-scene" role="status"><LittleYou characterId={run.character.id} motion="running"/><h3>{transferring?`换上 ${route.lines[1]} 号线！`:run.metroRecoveryMessage}</h3><p>{transferring?'穿过换乘通道，继续留意到站广播。':'还来得及，回到路线上继续赶车。'}</p></div>:<>
   <MetroScene run={run}/>{run.student&&!arrived&&<button className="soft-action prepare-door" disabled={run.student.doorReady||!!run.event} onClick={()=>dispatch({type:'PREPARE_DOOR'})}>{run.student.doorReady?'已经靠门，下车不用挤':'提前靠门，准备下车'}</button>}
   <div className="stop-decision">
    <div className="stop-announcement" aria-live="polite"><span>{arrived?'现在停靠':'下一站'}</span><strong>{stop}</strong>{arrived&&<b className="stop-count">{Math.max(1,Math.ceil(DOOR_SECONDS-run.phaseElapsed))}s</b>}</div>
    <div className="stop-buttons">
     <button className="big-action" disabled={!arrived} onClick={()=>dispatch({type:'ALIGHT'})}><Footprints size={20}/>在这站下车</button>
     <button className="soft-action" disabled={!arrived} onClick={()=>dispatch({type:'CONTINUE_METRO'})}>继续坐<ArrowRight size={20}/></button>
    </div>
    <p>{arrived?'车门只开 4 秒，不选就继续坐。':'到站后可以下车，也可以留在车上。'}</p>
   </div>
  </>}
 </section>;
}
