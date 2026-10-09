import {REFERENCE_PLAYER,referenceChoice,referenceSprint,type ReferenceMovement} from './referencePlayer';
import {createCharacterStationRun,reducer,journeyRouteSeconds,STOP_BEFORE,type Run} from '../src/engine';
import {activeObstacle,mapQueueWait} from '../src/mapObstructions';
import {trainPoint} from '../src/stationMapTravel';
import {transferStopIndex} from '../src/metroFlow';
import {focusWindow} from '../src/studentConfig';
import type {Choice} from '../src/data';

export type BalanceCharacter='student'|'worker'|'tourist'|'mom';
export type BalancePolicy='walk'|'paced'|'sprint';
export type BalanceOptions={city:string;character?:BalanceCharacter;policy?:BalancePolicy;seed?:number;reading?:number;mistakes?:number;preparation?:string[];hard?:boolean;budgetAdjustment?:number;reference?:boolean;onReferenceMovement?:(stats:ReferenceMovement)=>void;onState?:(run:Run)=>void};
export function seededRandom(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
// A repeatable scenario runner, not a model of the probability that a real person wins.
// It uses real map travel, hold durations, queues and a 4-second burst / 3-second walk cycle.
export function simulateBalance(options:BalanceOptions):Run{
 const random=seededRandom(options.seed??921),oldRandom=Math.random;Math.random=random;
 try {
  let s=reducer(createCharacterStationRun(options.city,options.character??'student',options.hard??false,random),{type:'START'});
  const adjustment=options.budgetAdjustment??(options.reference?REFERENCE_PLAYER.measurementAllowance:0);
  if(adjustment)s={...s,initial:s.initial+adjustment,remaining:s.remaining+adjustment};
  const reading=options.reading??(options.reference?REFERENCE_PLAYER.readingSeconds:3);
  const movement:ReferenceMovement={movingSeconds:0,sprintSeconds:0,gateMovingSeconds:0,gateSprintSeconds:0};
  let previousPrompt='';
  let mistakes=options.mistakes??0,burst=0,walking=0;
  const finished=()=>s.phase==='result';
  const advance=(seconds:number)=>{for(let left=seconds;left>1e-8&&s.phase!=='result';left-=.1){
   const before=s,dt=Math.min(.1,left);
   s=reducer(s,{type:'TICK',dt});
   if(options.reference&&before.phase==='station'&&before.stationRunning&&!before.event&&!before.stationMap?.block){
    const sprint=!!(before.student?.sprinting??before.characterTime?.sprinting??before.parent?.sprinting);
    movement.movingSeconds+=dt;if(sprint)movement.sprintSeconds+=dt;
    if(!before.gatePassed){movement.gateMovingSeconds+=dt;if(sprint)movement.gateSprintSeconds+=dt;}
   }
  }options.onReferenceMovement?.({...movement});};
  const select=(choice:Choice)=>{s=reducer(s,{type:'CHOICE',choice});};
  const energy=()=>s.student?.stamina??s.characterTime?.energy??s.parent!.energy;
  const defaults=s.student?['skip','check','eat']:s.characterTime?.characterId==='worker'?['take-gifts','eat','reply']:s.characterTime?['coffee','keep']:['toilet-first','snacks-pack'];
  for(const option of options.preparation??(options.reference?REFERENCE_PLAYER.preparation[options.character??'student']:defaults)){advance(reading);if(s.phase==='result')return s;s=reducer(s,s.student?{type:'PREP_PICK',option,step:s.student.prep}:s.characterTime?{type:'PERSON_PICK',option,step:s.characterTime.prepStep}:{type:'PARENT_PREP',option,step:s.parent!.prepStep});}
  advance(reading);if(s.phase==='result')return s;
  const route=s.city.spawnStations[s.spawn].routes.reduce((best,r)=>journeyRouteSeconds(s,r)<journeyRouteSeconds(s,best)?r:best);
  s=reducer(s,{type:'ROUTE',route});advance(reading);s=reducer(s,{type:'DIRECTION',correct:true});
  for(let i=0;i<20000&&s.phase!=='result';i++){
   options.onState?.(s);
   if(s.event){
    const e=s.event,promptKey=s.phase+':'+s.stationBeat+':'+e.id;
    const read=options.reference&&promptKey===previousPrompt?REFERENCE_PLAYER.followupSeconds:reading;
    advance(e.id==='tourist-wake'?.6:read);previousPrompt=promptKey;if(finished())break;
    if(e.id==='identity-search'){
     if(s.student){const u=s.student,order=u.checkedID?[0]:u.stats.focus>=75?[u.pocket]:u.stats.focus>=55?(u.pocket<2?[0,1]:[2,3]):[0,1,2,3];
      const pocket=order.find(p=>!u.searched.includes(p))!;
      advance((u.checkedID?.65:1.4)/focusWindow(u.stats.focus)*(u.cake?1.25:1));
      s=reducer(s,{type:'POCKET_PICK',pocket});
     }else{advance(1.5);s=reducer(s,{type:'ID_PICK',item:s.identityStage==='wallet'?'wallet':'id'});}continue;
    }
    if(e.id==='tourist-sleep'){const choice=options.reference?referenceChoice(s,e):e.choices.find(c=>c.label.startsWith('提前 1'))??e.choices[0];select(choice);continue;}
    if(e.id==='tourist-wake'){select(e.choices[0]);continue;}
    const bad=e.choices.find(c=>c.stationDecision?.category==='navigation'&&!c.stationDecision.optimal);
    if(mistakes>0&&bad){mistakes--;select(bad);continue;}
    let choice:Choice;
    if(options.reference)choice=referenceChoice(s,e);
    else {
     choice=e.choices.find(c=>c.stationDecision?.optimal)??e.choices.reduce((best,c)=>c.seconds<best.seconds?c:best,e.choices[0]);
    if(e.id==='vertical-choice')choice=energy()>30?e.choices.find(c=>c.stationDecision?.value==='stairs'||c.studentEffect==='stairs')!:e.choices.at(-1)!;
    if(e.id==='elder-block')choice=e.choices.find(c=>c.effect==='elder-detour')!;
    if(e.id==='escalator-choice')choice=e.choices[s.stationLuck.escalators.indexOf('clear')];
    if(e.id==='zz-number')choice=e.choices.find(c=>c.label===s.gate)!;
    if(e.id==='metro-announcement')choice=e.choices[0];
    if(e.id==='tourist-wheel')choice=e.choices[0];
    if(e.id==='parent-gap')choice=e.choices[0];
    if(e.id==='parent-toilet')choice=e.choices[0];
    if(e.id==='parent-tired')choice=e.choices[0];
    if(e.id==='zz-hometown-answer')choice=e.choices[1];
    }
    const kind=e.interaction?.kind,required=e.interaction?.required??2;
    advance(kind==='hold'?required*(s.student?.cake?1.25:1):kind==='tap'?required*.28:kind==='swipe'||kind==='scan'?1:0);
    select(choice);continue;
   }
   const b=s.stationMap?.block;
   if(b){const o=activeObstacle(s.stationMap!)!;
    if(b.mode==='tray'){advance(1.5);s=reducer(s,{type:'MAP_CLEAR',method:'tray'});}
    else if(b.mode==='stopped'){
     advance(reading);if(finished())break;
     if(o.kind==='security'){const lane=options.reference?b.queues.findIndex(q=>/只背小包/.test(q.detail)):b.queues.reduce((best,q,i)=>mapQueueWait(q)<mapQueueWait(b.queues[best])?i:best,0);if(lane<0)throw Error('Reference queue clue missing');s=reducer(s,{type:'MAP_CLEAR',method:'join',lane});}
     else{if(!['child','closed'].includes(o.kind))advance(1.2);s=reducer(s,{type:'MAP_CLEAR',method:o.kind==='child'?'wait':o.kind==='closed'?'leave':'ask'});}
    }else advance(.1);
    continue;
   }
   if(s.phase==='arrival'){advance(.6);if(s.phase==='arrival')s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||s.metroStopIndex===transferStopIndex(s.route!)?'ALIGHT':'CONTINUE_METRO'});continue;}
   if(s.phase==='station'){
    if(!s.stationMap)s=reducer(s,{type:'MAP_ENABLE',manual:true});
    if(!s.stationMap!.path.length)s=reducer(s,{type:'MAP_TARGET',point:trainPoint(s)});
    const policy=options.policy??'paced';
    let sprint=policy==='sprint';
    if(policy==='paced'){
     if(burst>=4||energy()<=25||(s.student?.sprintStrain??0)>=4.5||(s.parent?.gap??0)>=5){burst=0;walking=3;}
     if(walking>0){walking=Math.max(0,walking-.1);sprint=false;}else{sprint=true;burst+=.1;}
    }
    if(options.reference)sprint=referenceSprint(options.character??'student',movement.movingSeconds,energy(),s.student?.stats.energy??s.characterTime?.maxEnergy??s.parent!.maxEnergy,s.parent?.gap??0);
    s=reducer(s,{type:sprint?'SPRINT_INPUT':'RUN_INPUT',held:true});advance(.1);continue;
   }
   s=reducer(s,{type:'PREPARE_DOOR'});advance(.1);
  }
  if(s.phase!=='result')throw Error('Unfinished scenario: '+options.city+' '+s.character.id+' '+s.phase+' '+s.event?.id);
  return s;
 }finally{Math.random=oldRandom;}
}
export function balanceSummary(s:Run){
 const u=s.student,ledger=s.timeLedger.entries.reduce((sum,entry)=>sum+entry.seconds,0);
 return {operations:s.metrics.operations.length,station:s.city.id,character:s.character.id,won:s.success,gateMargin:Math.round(s.gateRemaining),realSeconds:Math.round(s.elapsed),initialGateBudget:Math.round(s.initial-STOP_BEFORE),stationBudget:u&&u.stationStart>0?Math.round(u.stationStart-STOP_BEFORE):null,spent:Math.round(s.initial-s.remaining),ledgerError:Math.round((ledger-(s.initial-s.remaining))*100)/100,breathStops:u?.breathStops??0,energy:Math.round(u?.stamina??s.characterTime?.energy??s.parent?.energy??0),delay:Math.round(s.logs.reduce((sum,l)=>sum+l.seconds,0))};
}
