import type {Action,Phase,Run} from './engine';

export type TimeCategory='metroRide'|'metroWalk'|'metroTransfer'|'stationMovement'|'securityQueue'|'obstructionWait'|'interaction'|'idle'|'metroDwell'|'transferInteraction'|'recoveryWait'|'preparationCost'|'eventCost'|'navigationPenalty'|'operationPenalty'|'sprintPenalty'|'unclassified';
export type TimeEntry={category:TimeCategory;phase:Phase;source:string;deadline:'gate'|'departure';seconds:number};
export type TimeLedger={totalSeconds:number;realSeconds:number;entries:TimeEntry[]};
export type MetroTimeBudget={rideSeconds:number;walkSeconds:number;transferSeconds:number;totalSeconds:number};
export const freshTimeLedger=():TimeLedger=>({totalSeconds:0,realSeconds:0,entries:[]});

function fixedCategory(s:Run,n:Run,a:Action):TimeCategory{
 if(['PREP_PICK','PERSON_PICK','PARENT_PREP'].includes(a.type))return 'preparationCost';
 if(s.event?.id==='student-breath')return 'sprintPenalty';
 if(s.phase==='wrong'||n.phase==='metro-recovery'&&s.phase!=='metro-recovery')return 'navigationPenalty';
 if(a.type==='POCKET_PICK'||a.type==='ID_PICK'||a.type==='TICK')return 'operationPenalty';
 if(a.type==='CHOICE'&&a.choice.stationDecision?.category==='navigation'&&!a.choice.stationDecision.optimal)return 'navigationPenalty';
 return 'eventCost';
}

function tickCategory(s:Run):TimeCategory{
 if(s.event)return 'interaction';
 if(s.phase==='preparation'||s.phase==='route'||s.phase==='direction')return 'interaction';
 if(s.phase==='arrival'||s.phase==='metro')return 'metroDwell';
 if(s.phase==='transfer')return 'transferInteraction';
 if(s.phase==='wrong'||s.phase==='metro-recovery')return 'recoveryWait';
 if(s.phase==='station'){
  if(s.stationMap?.block)return 'interaction';
  if(s.stationRunning&&!s.student?.runner.blocked&&!s.characterTime?.runner.blocked&&!s.parent?.runner.blocked)return 'stationMovement';
 }
 return 'idle';
}

/** Observe actual countdown changes. Never charge time or sum presentation logs.
 * Entries describe where time went, not whether a choice was a mistake or bad luck.
 * Those causal budgets require a calibrated reference and are deliberately separate. */
export function trackTimeLedger(s:Run,n:Run,a:Action,clockRate:number,metroAnimationSeconds:number):Run{
 if(a.type==='NEW'||n===s||s.phase==='result')return n;
 const spent=s.remaining-n.remaining,real=Math.max(0,n.elapsed-s.elapsed);
 if(Math.abs(spent)<1e-10&&real===0)return n;
 const previous=s.timeLedger??freshTimeLedger(),entries=[...previous.entries];
 const deadline=s.gatePassed?'departure':'gate';
 let allocated=0;
 const add=(category:TimeCategory,seconds:number,source:string)=>{
  if(Math.abs(seconds)<1e-10)return;
  allocated+=seconds;
  const index=entries.findIndex(e=>e.category===category&&e.phase===s.phase&&e.source===source&&e.deadline===deadline);
  if(index<0)entries.push({category,phase:s.phase,source,deadline,seconds});
  else entries[index]={...entries[index],seconds:entries[index].seconds+seconds};
 };
 const source=s.event?.id??s.stationMap?.block?.id??s.stationJourney[s.stationBeat]?.id??s.phase;
 const fixedSource=a.type==='PENALTY'?a.title:
  a.type==='PREP_PICK'||a.type==='PERSON_PICK'||a.type==='PARENT_PREP'?`preparation:${a.step}:${a.option}`:
  a.type==='CHOICE'?`${source}:${a.choice.label}`:source+':'+a.type;
 // Includes normal metro ticks and the tourist's jump to the wake-up stop.
 const progress=Math.max(0,n.metroProgress-s.metroProgress);
 const journey=progress*s.metroDuration;
 if(journey>0){
  const budget=s.metroTimeBudget;
  if(budget&&Math.abs(budget.totalSeconds-s.metroDuration)<1e-8){
   add('metroRide',progress*budget.rideSeconds,'metro-route');
   add('metroWalk',progress*budget.walkSeconds,'metro-route');
   add('metroTransfer',progress*budget.transferSeconds,'metro-route');
  }else add('metroRide',journey,'metro-route-legacy-unsplit');
 }
 let ticking=0;
 if(a.type==='TICK'){
  if(s.phase==='metro'&&!s.event){
   ticking=Math.max(0,real-progress*metroAnimationSeconds)*clockRate;
   add(n.event?'interaction':'metroDwell',ticking,n.event?.id??'metro-boundary');
  }else{
   const block=s.stationMap?.block;
   if(s.phase==='station'&&!s.event&&block&&['queue','waiting','yielding'].includes(block.mode)){
    const waiting=Math.min(real,Math.max(0,block.duration-block.elapsed));
    ticking=waiting*clockRate+(real-waiting);
    add(block.mode==='queue'?'securityQueue':'obstructionWait',waiting*clockRate,block.id);
    add('interaction',real-waiting,block.id+':finished');
   }else{
    ticking=real*clockRate;
    add(tickCategory(s),ticking,source);
   }
  }
 }
 // Instant choices and timeout penalties are the remainder after actual passage
 // of time. A log showing an already-completed queue has a zero remainder.
 const fixed=spent-journey-ticking;
 if(fixed>1e-8)add(fixedCategory(s,n,a),fixed,fixedSource);
 else if(fixed< -1e-8)add('unclassified',fixed,source+':clock-adjustment');
 // Keep genuine unexplained differences visible instead of silently dropping them.
 if(Math.abs(spent-allocated)>1e-8)add('unclassified',spent-allocated,source+':unallocated');
 return {...n,timeLedger:{totalSeconds:previous.totalSeconds+spent,realSeconds:previous.realSeconds+real,entries}};
}
