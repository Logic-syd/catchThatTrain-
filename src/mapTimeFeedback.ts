import type {Run} from './engine';
import {activeObstacle} from './mapObstructions';

export type MapChildDelay={startedRemaining:number;startedAt:number;seconds:number;active:boolean;completedAt:number|null};

// Feedback for time the countdown has already spent, never a second penalty.
export function trackMapChildDelay(previous:Run,next:Run):Run{
 if(previous===next||previous.id!==next.id||next.phase!=='station'||!next.stationMap)return next;
 const map=next.stationMap,child=map.block&&activeObstacle(map)?.kind==='child';
 if(child&&(!previous.stationMap?.childDelay?.active||previous.stationMap?.block?.id!==map.block?.id)){
  return {...next,stationMap:{...map,childDelay:{startedRemaining:next.remaining,startedAt:next.elapsed,seconds:0,active:true,completedAt:null}}};
 }
 const delay=previous.stationMap?.childDelay;
 if(!delay?.active)return next;
 const active=!!child||(!map.block&&map.bypassing&&!next.event);
 return {...next,stationMap:{...map,childDelay:{...delay,seconds:Math.max(0,delay.startedRemaining-next.remaining),active,completedAt:active?null:next.elapsed}}};
}

export function visibleChildDelay(run:Run){
 const delay=run.stationMap?.childDelay;
 if(run.phase!=='station'||!delay||(!delay.active&&run.elapsed-(delay.completedAt??0)>3))return null;
 return delay;
}
