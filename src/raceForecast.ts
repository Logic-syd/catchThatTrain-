import {SPRINT} from './sprintConfig';
import type {Run} from './engine';
import {applyJourneyDecision,prepareNextJourney} from './journeyRules';
import {mapDistance,mapPath,mapTaskPoint,pathLength,type MapPoint} from './stationMapTravel';
import {selectedPath,stationChallenge,type StationDecision} from './stations';
import {movementFactor} from './studentConfig';
import {characterTimeProfiles} from './characterTime';
import type {StationBeat} from './stationJourney';

// This is a LOWER BOUND, not the normal walking estimate used in the results.
// Grant maximum stats, permanent late sprint, free queue/reading/recovery and
// every remaining shortcut. Only if even this bound exceeds the clock is loss certain.
export function maximumTravelFactor(s:Run):number{
 if(s.student)return movementFactor({...s.student,stats:{agility:100,energy:100,focus:100,load:0},sprinting:true,exhausted:false,late:true,sprintStrain:0});
 if(s.parent)return .98*SPRINT.parentSyncMultiplier; // Synchronised sprint, no child/load/energy slowdown.
 const p=characterTimeProfiles[s.characterTime?.characterId??'worker'];
 return p.sprintSpeed*(s.characterTime?.characterId==='tourist'?1.05:1.1)/.75;
}

function continuations(s:Run):Run[]{
 const id=s.stationJourney[s.stationBeat]?.id;
 if(id==='sh-corridor'||id==='gz-route')return stationChallenge(s,id)!.choices.map(c=>applyJourneyDecision(s,c.stationDecision!));
 if(id==='vertical-choice')return (['stairs','lift','escalator'] as const).map(value=>{
  const d:StationDecision={group:id,value,category:'vertical',optimal:true};
  return {...applyJourneyDecision(s,d),student:s.student?{...s.student,vertical:value}:undefined};
 });
 if(id==='wh-parent-duck')return [s,applyJourneyDecision(s,{group:id,value:'buy',category:'vertical',optimal:true,skip:['wh-parent-duck-repeat']})];
 if(id==='worker-boss-call'&&s.characterTime)return [s,{...s,characterTime:{...s.characterTime,bossCallsLeft:0}}];
 return [s];
}

function afterBeat(s:Run):Run{
 let n=prepareNextJourney(s),index=s.stationBeat+1;
 // On the map the tray is handled inside the security block, not a second walk.
 if(s.stationJourney[s.stationBeat]?.id==='security-queue'&&n.stationJourney[index]?.id==='bj-tray')index++;
 return {...n,stationBeat:index};
}
function futureLegs(s:Run,from:MapPoint,speed:number):number{
 const beat=s.stationJourney[s.stationBeat];if(!beat)return 0;
 const to=mapTaskPoint(s),distance=Math.max(0,pathLength(from,mapPath(s,from,to))-.05);
 const travel=beat.seconds*4/speed*Math.min(1,distance/8);
 if(beat.id===(s.gatePassed?'board-train':'gate-scan'))return travel;
 return travel+Math.min(...continuations(s).map(n=>futureLegs(afterBeat(n),to,speed)));
}

// Future task positions only change at a decision/beat boundary. The live leg is
// calculated from the actual map position; cache only the immutable future plan.
const futureCache=new WeakMap<StationBeat[],Map<string,number>>();
export function fastestRemainingSeconds(s:Run):number|null{
 if(s.phase!=='station'||!s.stationJourney[s.stationBeat])return null;
 const speed=maximumTravelFactor(s),beat=s.stationJourney[s.stationBeat],to=mapTaskPoint(s);
 let current=beat.seconds*4/speed*Math.max(0,1-s.stationProgress);
 if(s.stationMap){
  const distance=mapDistance(s.stationMap.position,to)<.05?0:Math.max(0,pathLength(s.stationMap.position,mapPath(s,s.stationMap.position,to))-.05);
  const leg=s.stationMap.legBeat===s.stationBeat?s.stationMap.legDistance:Math.max(8,distance);
  current=beat.seconds*4/speed*distance/Math.max(8,leg);
 }
 if(beat.id===(s.gatePassed?'board-train':'gate-scan'))return current;
 let cache=futureCache.get(s.stationJourney);if(!cache){cache=new Map();futureCache.set(s.stationJourney,cache);}
 const key=[s.city.id,s.character.id,s.stationBeat,s.gatePassed,selectedPath(s),s.student?.vertical,s.characterTime?.bossCallsLeft].join(':');
 if(!cache.has(key))cache.set(key,Math.min(...continuations(s).map(n=>futureLegs(afterBeat(n),to,speed))));
 return current+cache.get(key)!;
}
export function raceForecast(s:Run){
 const bound=fastestRemainingSeconds(s);if(bound===null)return null;
 // Round in the player's favour. Never declare failure from display rounding.
 const fastest=Math.max(0,Math.floor(bound)),remaining=Math.max(0,Math.ceil(s.remaining-(s.gatePassed?0:180)));
 const margin=remaining-fastest;
 return {fastest,remaining,margin,status:margin<0?'impossible':margin<=60?'tight':'open'} as const;
}
