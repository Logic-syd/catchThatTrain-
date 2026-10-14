/** Reproducible strategy audit, not a human win-rate estimate.
 * Run: npx vite-node scripts/simulate-success-rates.ts --samples=20 --character=student
 * Emits one JSON row per game plus metadata/summary. Never changes initial budgets.
 */
import {createCharacterStationRun,reducer as gameReducer,journeyRouteSeconds,type Run,type Action} from '../src/engine';
import {runnerWave} from '../src/runner';
import {STATIONS} from '../src/stations';
import {PREPARATIONS,focusWindow} from '../src/studentConfig';
import {timedPrompt} from '../src/characterTime';
import {eventHoldSeconds} from '../src/eventTiming';

const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.slice(2).split('=')));
const samples=Number(args.samples??20);
const characters=['student','worker','tourist','mom'] as const;
if(!Number.isInteger(samples)||samples<1||args.character&&!characters.includes(args.character as typeof characters[number]))throw Error('Invalid samples/character');
const selectedCharacters=characters.filter(c=>!args.character||c===args.character);
const locomotions=args.locomotion?[args.locomotion]:['walk','sprint'];
if(locomotions.some(m=>m!=='walk'&&m!=='sprint'))throw Error('Invalid locomotion');
let transitions=0,caseName='',lastPhase='',lastEvent='',finished=0,wins=0;
function check(s:Run){
 const bound=(label:string,v:number,max:number)=>{if(!Number.isFinite(v)||!Number.isFinite(max)||v<0||v>max)throw Error(JSON.stringify({caseName,label,v,max}));};
 if(!Number.isFinite(s.remaining))throw Error('Invalid clock '+caseName);
 if(s.student){for(const [k,v] of Object.entries(s.student.stats))bound(k,v,100);bound('stamina',s.student.stamina,s.student.stats.energy);}
 if(s.characterTime){const t=s.characterTime;bound('energy',t.energy,t.maxEnergy);bound('maxEnergy',t.maxEnergy,100);bound('reserve',t.energyReserve??0,10);for(const k of ['fatigue','focus','load'] as const)bound(k,t[k],100);}
 if(s.parent){const p=s.parent;bound('energy',p.energy,p.maxEnergy);bound('maxEnergy',p.maxEnergy,70);for(const k of ['childEnergy','patience','toilet'] as const)bound(k,p[k],100);for(const k of ['snacks','water'] as const)if(!Number.isInteger(p[k])||p[k]<0)throw Error('Invalid inventory '+caseName+':'+k);}
}
function reduce(s:Run,a:Action){
 const n=gameReducer(s,a);transitions++;check(n);
 if(n.phase==='result'&&s.phase!=='result'){lastPhase=s.phase;lastEvent=n.endEventId??s.event?.id??s.stationJourney[s.stationBeat]?.id??'none';}
 return n;
}
function tick(s:Run,seconds:number){while(seconds>1e-8&&s.phase!=='result'){const dt=Math.min(.1,seconds);s=reduce(s,{type:'TICK',dt});seconds-=dt;}return s;}
function tickEvent(s:Run,seconds:number,id:string){while(seconds>1e-8&&s.phase!=='result'&&s.event?.id===id){const dt=Math.min(.1,seconds);s=reduce(s,{type:'TICK',dt});seconds-=dt;}return s;}
console.log(JSON.stringify({type:'metadata',samples,characters:selectedCharacters,locomotions,readSeconds:2,arrivalDecisionSeconds:1,seedRule:'(0x9e3779b9 ^ Math.imul(sample+1,0x85ebca6b)) >>> 0',policies:[0,1,2],notes:'All current initial budgets; default spawn; perfect navigation, obstacle avoidance and identity/queue information; deterministic first options except specified policy choices.'}));
for(let sample=0;sample<samples;sample++)for(const station of STATIONS)for(const who of selectedCharacters)for(const hard of [false,true])for(const variant of [0,1,2])for(const locomotion of locomotions){
 const originalSeed=(0x9e3779b9^Math.imul(sample+1,0x85ebca6b))>>>0;
 let seed=originalSeed;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 caseName=[sample,station.id,who,hard,variant,locomotion].join(':');lastPhase='';lastEvent='';
 let s=reduce(createCharacterStationRun(station.id,who,hard,rng),{type:'START'});
 const initial=s.initial,spawn=s.spawn;
 while(s.phase==='preparation'){
  s=tick(s,2);if(s.phase==='result')break;
  if(s.student){const p=PREPARATIONS[s.student.prep],o=p.options[variant===1?0:1];s=reduce(s,{type:'PREP_PICK',step:s.student.prep,option:o.id});}
  else if(s.characterTime){const p=timedPrompt(s)!;s=reduce(s,{type:'PERSON_PICK',step:s.characterTime.prepStep,option:p.choices[variant===0?p.choices.length-1:0].id});}
  else s=reduce(s,{type:'PARENT_PREP',step:s.parent!.prepStep,option:s.parent!.prepStep===0?(variant===0?'toilet-skip':'toilet-first'):(variant===0?'snacks-skip':'snacks-pack')});
 }
 const route=[...s.city.spawnStations[s.spawn].routes].sort((a,b)=>journeyRouteSeconds(s,a)-journeyRouteSeconds(s,b))[variant===2?1:0];
 if(!route)throw Error('Missing route '+caseName);
 if(s.phase!=='result'){s=tick(s,2);s=reduce(s,{type:'ROUTE',route});s=tick(s,2);s=reduce(s,{type:'DIRECTION',correct:true});}
 let sprintBurst=0,sprintTime=0,parentRegrouping=false,studentRecovering=false;
 for(let i=0;i<20000&&s.phase!=='result';i++){
  if(s.event){
   const id=s.event.id;sprintBurst=0;
   s=tickEvent(s,2,id);if(s.phase==='result'||s.event?.id!==id)continue;
   const e=s.event;
   if(id==='identity-search'){
    if(s.student){s=tickEvent(s,(s.student.checkedID?.65:1.4)/focusWindow(s.student.stats.focus)*(s.student.tea?1.25:1),id);if(s.event?.id===id)s=reduce(s,{type:'POCKET_PICK',pocket:s.student!.pocket});}
    else {s=tickEvent(s,2,id);if(s.event?.id===id)s=reduce(s,{type:'ID_PICK',item:'wallet'});s=tickEvent(s,1,id);if(s.event?.id===id)s=reduce(s,{type:'ID_PICK',item:'id'});}
    continue;
   }
   let index=0;
   if(id==='tourist-sleep')index=variant;
   else if(id==='vertical-choice')index=e.choices.findIndex(c=>variant===0?c.label.includes('楼梯'):variant===1?c.label.includes('电梯'):c.label.includes('扶梯'));
   else if(id==='security-queue'||id==='gates')index=e.choices.findIndex(c=>c.seconds===Math.min(...e.choices.map(x=>x.seconds)));
   else if(id==='zz-number')index=e.choices.findIndex(c=>c.label===s.gate);
   else if(id==='gz-route')index=variant%2;
   const choice=e.choices[Math.max(0,index)];if(!choice)throw Error('Missing choice '+caseName+':'+id);
   const operation=e.interaction?.kind==='hold'?eventHoldSeconds(s,e):e.interaction?.kind==='tap'?(e.interaction.required??5)*.2:e.interaction?.kind==='swipe'?1:0;
   s=tickEvent(s,operation,id);if(s.event?.id===id)s=reduce(s,{type:'CHOICE',choice});
  }else if(s.phase==='arrival'){
   s=tick(s,1);if(s.phase==='arrival')s=reduce(s,{type:s.metroStopIndex===route.stops.length-1||route.stops[s.metroStopIndex]===route.via?'ALIGHT':'CONTINUE_METRO'});
  }else if(s.phase==='station'){
   const r=s.student?.runner??s.characterTime?.runner??s.parent!.runner,w=runnerWave(s);
   if(w&&w.lane===r.lane)s=reduce(s,{type:'CHANGE_LANE',direction:r.lane===2?-1:1});
   if(!s.stationRunning)s=reduce(s,{type:'RUN_INPUT',held:true});
   if(locomotion==='sprint'){
    const state=s.student??s.characterTime??s.parent!;
    const energy=s.student?s.student.stamina:s.characterTime?.energy??s.parent!.energy;
    const cap=s.student?s.student.stats.energy:s.characterTime?.maxEnergy??s.parent!.maxEnergy;
    let desired=state.sprinting?energy>cap*.3:energy>=cap*.7;
    if(s.student){
     if(s.student.sprintStrain>=4||sprintBurst>=4)studentRecovering=true;
     else if(s.student.sprintStrain<=1)studentRecovering=false;
     if(studentRecovering)desired=false;
    }
    if(s.parent){
     if(s.parent.gap>=4)parentRegrouping=true;
     else if(s.parent.gap<=2)parentRegrouping=false;
     if(s.parent.toilet>=80||parentRegrouping)desired=false;
    }
    if(desired!==state.sprinting)s=reduce(s,{type:'SPRINT_INPUT',held:desired});
   }
   const sprinting=(s.student??s.characterTime??s.parent!).sprinting;
   sprintBurst=sprinting?sprintBurst+.1:0;if(sprinting)sprintTime+=.1;
   s=tick(s,.1);
  }else{if(s.student&&s.phase==='metro')s=reduce(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
 }
 if(s.phase!=='result')throw Error('Traversal stuck '+caseName+':'+s.phase+':'+s.event?.id);
 finished++;if(s.success)wins++;
 console.log(JSON.stringify({type:'game',sample,seed:originalSeed,station:station.id,who,hard,variant,locomotion,spawn,initial,success:s.success,remaining:s.remaining,gateRemaining:s.gateRemaining,gatePassed:s.gatePassed,endPhase:lastPhase,endEvent:lastEvent,sprintSeconds:Math.round(sprintTime*10)/10,collisions:(s.student??s.characterTime??s.parent!).runner.collisions}));
}
console.log(JSON.stringify({type:'summary',finished,wins,losses:finished-wins,transitions,resourceBounds:'passed'}));
