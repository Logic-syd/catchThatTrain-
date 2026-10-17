import {localizeNode} from './i18n';
import type { Dispatch } from 'react';
import { ArrowRight, Footprints, TrainFront } from 'lucide-react';
import { DOOR_SECONDS, type Action, type Run } from './engine';
import { LittleYou, MetroScene } from './Scenes';
import {currentMetroTerminal,needsMetroBranchExit,metroBoardingChoice,type MetroTerminal} from './metroBranch';
import ChoiceDetail from './ChoiceDetail';
import './metroBranch.css';

export default function MetroJourney({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}) {
 const route=run.route!;
 const arrived=run.phase==='arrival',platform=run.phase==='metro-platform';
 const stop=route.stops[Math.min(run.metroStopIndex+(arrived?0:1),route.stops.length-1)];
 const line=route.lines[run.metroTransferred?1:0];
 const terminal=currentMetroTerminal(run),branchExit=needsMetroBranchExit(run);
 const recovering=run.phase==='metro-recovery',transferring=run.phase==='transfer';
 return <section className={'journey-scene interactive-metro '+(arrived?'open-doors':'')}>
  <div className="metro-route-note"><TrainFront size={17}/><span>
   <b>{localizeNode(line)}{localizeNode(platform?'号线 · 龙溪路站台':terminal?'号线 · 本班终点：':'号线 · 目的地：')}{!platform&&localizeNode(terminal??run.city.stationName)}</b>
   <small>{localizeNode(platform?'目标：虹桥火车站':terminal?run.metroBranch?.terminal==='hangzhong'?'这班不到虹桥火车站，龙溪路换车。':'这班到虹桥火车站，留意站名。':route.transfers&&!run.metroTransferred?`计划：${route.via}下车，换乘${route.lines[1]}号线`:'直达路线 · 看清站名，再决定下车')}</small>
  </span></div>
  {platform?<div className="metro-branch-platform">
   <div className="metro-train-options">{(['hangzhong','hongqiao'] as MetroTerminal[]).map(destination=>{
    const choice=metroBoardingChoice(run,destination)!;
    return <button className="metro-train-choice" key={destination} data-terminal={destination} onClick={()=>dispatch({type:'BOARD_METRO',terminal:destination,visit:run.metroBranch!.platformVisit})}>
     <TrainFront size={24}/><span><small>{localizeNode(destination==='hangzhong'?'即将关门':'下一班')}</small><strong>{localizeNode(destination==='hangzhong'?'航中路':'虹桥火车站')}</strong><ChoiceDetail text={choice.detail}/></span><b>{localizeNode(destination==='hangzhong'?'上这趟':'等这班')}</b>
    </button>;
   })}</div>
  </div>:recovering||transferring?<div className="metro-recovery-scene" role="status"><LittleYou characterId={run.character.id} motion="running"/><h3>{localizeNode(transferring?`换上 ${route.lines[1]} 号线！`:run.metroRecoveryMessage)}</h3><p>{localizeNode(transferring?'穿过换乘通道，继续留意到站广播。':'还来得及，回到路线上继续赶车。')}</p></div>:<>
   <MetroScene run={run}/>{localizeNode(run.student&&!arrived&&<button className="soft-action prepare-door" disabled={run.student.doorReady||!!run.event} onClick={()=>dispatch({type:'PREPARE_DOOR'})}>{localizeNode(run.student.doorReady?'已经靠门，下车不用挤':'提前靠门，准备下车')}</button>)}
   <div className={'stop-decision '+(branchExit?'branch-exit':'')}>
    <div className="stop-announcement" aria-live="polite"><span>{localizeNode(arrived?'现在停靠':'下一站')}</span><strong>{localizeNode(stop)}</strong>{localizeNode(arrived&&<b className="stop-count">{localizeNode(Math.max(1,Math.ceil(DOOR_SECONDS-run.phaseElapsed)))}s</b>)}</div>
    <div className="stop-buttons">
     <button className="big-action" disabled={!arrived||!!run.event} onClick={()=>dispatch({type:'ALIGHT'})}><Footprints size={20}/>{localizeNode(branchExit?'下车换另一趟':'在这站下车')}</button>
     <button className="soft-action" disabled={!arrived||!!run.event} onClick={()=>dispatch({type:'CONTINUE_METRO'})}>{localizeNode('继续坐')}<ArrowRight size={20}/></button>
    </div>
    <p>{localizeNode(arrived?'车门只开 4 秒，不选就继续坐。':'到站后可以下车，也可以留在车上。')}</p>
   </div>
  </>}
 </section>;
}
