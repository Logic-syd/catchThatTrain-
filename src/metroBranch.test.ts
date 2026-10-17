import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,projectedTime,journeyRouteSeconds,METRO_SECONDS,DOOR_SECONDS,STOP_BEFORE,type Run} from './engine';
import {METRO_BRANCH,line10BranchStopIndex,currentMetroTerminal,needsMetroBranchExit,metroBoardingChoice,pendingMetroBranchSeconds,type MetroTerminal} from './metroBranch';
import {transferStopIndex} from './metroFlow';
import {openingBudget,remainingMetroSeconds} from './timeModel';
import {parentToiletAfter} from './parent';
import {TOURIST_SLEEP_OPTIONS} from './characterTime';
import {createGameResult} from './gameResult';

const CHARACTERS=['student','worker','tourist','mom'] as const;
type Character=typeof CHARACTERS[number];
const ROUTES=['sh-n-10','sh-j-10','sh-p-x'] as const;

function prepared(character:Character,routeId:string,variant=.1,incidentRoll=.9):Run{
 let s=createCharacterStationRun('shanghai',character,false,()=>.9);
 const spawn=s.city.spawnStations.findIndex(p=>p.routes.some(r=>r.id===routeId));
 expect(spawn).toBeGreaterThanOrEqual(0);
 s={...s,spawn,metroIncidentVariant:variant,metroIncidentRoll:incidentRoll};
 const initial=openingBudget(s,character).initial;
 s=reducer({...s,initial,remaining:initial},{type:'START'});
 if(character==='student')for(const [step,option] of ['skip','check','skip'].entries())s=reducer(s,{type:'PREP_PICK',step,option});
 else if(character==='mom')for(const [step,option] of ['toilet-first','snacks-pack'].entries())s=reducer(s,{type:'PARENT_PREP',step,option});
 else for(const [step,option] of (character==='worker'?['leave-gifts','leave','reply']:['go','light']).entries())s=reducer(s,{type:'PERSON_PICK',step,option});
 expect(s.phase).toBe('route');
 return reducer(s,{type:'ROUTE',route:s.city.spawnStations[spawn].routes.find(r=>r.id===routeId)!});
}
function choose(s:Run,id?:string):Run{
 const choice=id?s.event!.choices.find(c=>c.id===id)!:s.event!.choices[0];
 expect(choice).toBeDefined();
 return reducer(s,{type:'CHOICE',choice});
}
function boarded(character:Character,routeId:string,variant=.1,incidentRoll=.9,sleep='awake'):Run{
 let s=reducer(prepared(character,routeId,variant,incidentRoll),{type:'DIRECTION',correct:true});
 if(s.event?.id==='tourist-sleep')s=choose(s,sleep);
 return s;
}
function nextStop(s:Run):Run{
 expect(s.phase).toBe('metro');
 expect(s.event).toBeNull();
 if(s.student)s=reducer(s,{type:'PREPARE_DOOR'});
 const progress=(s.metroStopIndex+1)/(s.route!.stops.length-1)-s.metroProgress;
 return reducer(s,{type:'TICK',dt:progress*METRO_SECONDS});
}
function board(s:Run,terminal:MetroTerminal='hongqiao'):Run{
 return reducer(s,{type:'BOARD_METRO',terminal,visit:s.metroBranch!.platformVisit});
}
function advance(s:Run):Run{
 if(s.event){
  expect(['transfer-run','tourist-wake']).toContain(s.event.id);
  return choose(s);
 }
 if(s.phase==='metro')return nextStop(s);
 if(s.phase==='metro-platform')return board(s);
 if(s.phase==='transfer')return reducer(s,{type:'TICK',dt:1.2});
 if(s.phase==='metro-recovery')return reducer(s,{type:'TICK',dt:2});
 if(s.phase==='arrival')return reducer(s,{type:needsMetroBranchExit(s)||s.metroStopIndex===s.route!.stops.length-1||!s.metroTransferred&&s.metroStopIndex===transferStopIndex(s.route!)?'ALIGHT':'CONTINUE_METRO'});
 throw new Error('Unexpected journey phase '+s.phase);
}
function atBranch(s:Run,resolveWake=true):Run{
 const stop=line10BranchStopIndex(s.route!);
 expect(stop).toBeGreaterThan(0);
 for(let i=0;i<100;i++){
  if(s.phase==='arrival'&&s.metroStopIndex===stop&&(!s.event||!resolveWake))return s;
  s=advance(s);
 }
 throw new Error('The branch stop was not reached');
}
function finishMetro(s:Run):Run{
 for(let i=0;i<100&&s.phase!=='station'&&s.phase!=='result';i++)s=advance(s);
 expect(s.phase).toBe('station');
 return s;
}
function platform(character:Character='worker'):Run{
 const arrival=atBranch(boarded(character,'sh-n-10'));
 const s=reducer(arrival,{type:'ALIGHT'});
 expect(s.phase).toBe('metro-platform');
 return s;
}

describe('Hongqiao Line 10 train destinations are part of the selected journey',()=>{
 it.each(ROUTES)('%s passes Longxi Road before the two destinations diverge',routeId=>{
  const s=prepared('worker',routeId),index=line10BranchStopIndex(s.route!);
  expect(index).toBeGreaterThan(0);
  expect(index).toBeLessThan(s.route!.stops.length-1);
  expect(s.route!.stops[index]).toBe(METRO_BRANCH.stop);
  expect(s.metroBranch?.terminal).toBe('hangzhong');
 });
 it.each(['sh-n-2','sh-n-x','sh-j-x'])('%s does not require a branch swap, including joining Line 10 after its fork',routeId=>{
  const s=prepared('worker',routeId);
  expect(line10BranchStopIndex(s.route!)).toBe(-1);
  expect(s.metroBranch).toBeUndefined();
  expect(pendingMetroBranchSeconds(s)).toBe(0);
 });
 it.each([0,.299999,.3,.9])('reveals the actual terminus independently of the incident roll %s',roll=>{
  const selected=prepared('worker','sh-n-10',.49,roll);
  expect(selected.metroBranch?.terminal).toBe('hangzhong');
  expect(currentMetroTerminal(selected)).toBeUndefined();
  const s=reducer(selected,{type:'DIRECTION',correct:true});
  expect(currentMetroTerminal(s)).toBe('航中路');
  expect(prepared('worker','sh-n-10',.5,roll).metroBranch?.terminal).toBe('hongqiao');
  const read=Array.from({length:10},()=>currentMetroTerminal(s));
  expect(new Set(read)).toEqual(new Set(['航中路']));
  expect(reducer(s,{type:'ROUTE',route:s.route!})).toBe(s);
 });
 it.each(CHARACTERS.flatMap(character=>ROUTES.map(routeId=>({character,routeId}))))('$character can swap trains on $routeId without paying the original journey twice',({character,routeId})=>{
  const start=boarded(character,routeId),originalFare=start.metroDuration;
  expect(originalFare).toBeCloseTo(journeyRouteSeconds(start,start.route!),8);
  const arrival=atBranch(start);
  expect(needsMetroBranchExit(arrival)).toBe(true);
  const p=reducer(arrival,{type:'ALIGHT'});
  expect(p.phase).toBe('metro-platform');
  expect(p.remaining).toBe(arrival.remaining);
  expect(p.metroProgress).toBe(arrival.metroProgress);
  expect(p.metroStopIndex).toBe(arrival.metroStopIndex);
  const resumed=board(p);
  expect(resumed.phase).toBe('metro');
  expect(resumed.remaining).toBeCloseTo(p.remaining-METRO_BRANCH.waitSeconds,8);
  expect(resumed.metroDuration).toBe(originalFare);
  expect(resumed.metroProgress).toBe(arrival.metroProgress);
  expect(resumed.metroTransferred).toBe(arrival.metroTransferred);
  expect(currentMetroTerminal(resumed)).toBe('虹桥火车站');
  const last=finishMetro(resumed);
  const transferAnimation=start.route!.transfers&&character!=='student'?1.2:0;
  expect(start.remaining-last.remaining).toBeCloseTo(originalFare+METRO_BRANCH.waitSeconds+transferAnimation,7);
  expect(last.metroProgress).toBe(1);
  expect(last.metroMisses).toBe(0);
  expect(last.metroDuration).toBe(originalFare);
 });
 it.each(ROUTES)('%s continues normally on the Hongqiao train',routeId=>{
  const start=boarded('worker',routeId,.9),arrival=atBranch(start);
  expect(currentMetroTerminal(arrival)).toBe('虹桥火车站');
  expect(needsMetroBranchExit(arrival)).toBe(false);
  const next=reducer(arrival,{type:'CONTINUE_METRO'});
  expect(next.phase).toBe('metro');
  expect(next.remaining).toBe(arrival.remaining);
  expect(pendingMetroBranchSeconds(next)).toBe(0);
  const last=finishMetro(next);
  expect(start.remaining-last.remaining).toBeCloseTo(start.metroDuration+(start.route!.transfers?1.2:0),7);
 });
 it('retains ordinary metro incidents before the destination decision',()=>{
  const start=boarded('worker','sh-n-10',.4,.1),interrupted=nextStop(start);
  expect(interrupted.event?.id).toBe('metro-crowded-door');
  expect(interrupted.metroBranch?.terminal).toBe('hangzhong');
  const handled=choose(interrupted,'move-door');
  expect(interrupted.remaining-handled.remaining).toBe(12);
  expect(handled.seen).toContain('metro-crowded-door');
  const arrival=atBranch(handled);
  expect(needsMetroBranchExit(arrival)).toBe(true);
  expect(arrival.event).toBeNull();
  expect(finishMetro(arrival).seen.filter(id=>id==='metro-crowded-door')).toHaveLength(1);
 });
});

describe('branch actions, deadlines and remaining travel use the same cost',()=>{
 it('reserves the known wait once in the arrival forecast, then removes it when paid',()=>{
  const s=platform();
  expect(pendingMetroBranchSeconds(s)).toBe(30);
  expect(remainingMetroSeconds(s)).toBeCloseTo(s.metroDuration*(1-s.metroProgress)+30,8);
  const forecast=projectedTime(s),next=board(s);
  expect(next.metroBranch?.waitPaid).toBe(true);
  expect(pendingMetroBranchSeconds(next)).toBe(0);
  expect(remainingMetroSeconds(next)).toBeCloseTo(next.metroDuration*(1-next.metroProgress),8);
  expect(projectedTime(next)).toBeCloseTo(forecast,8);
  expect(pendingMetroBranchSeconds(finishMetro(next))).toBe(0);
 });
 it.each(['continue','timeout'] as const)('%s on the wrong branch returns to Longxi Road with one detour fee',mode=>{
  const s=atBranch(boarded('worker','sh-n-10'));
  const n=reducer(s,mode==='continue'?{type:'CONTINUE_METRO'}:{type:'TICK',dt:DOOR_SECONDS});
  expect(n.phase).toBe('metro-recovery');
  expect(s.remaining-n.remaining).toBeCloseTo(METRO_BRANCH.missSeconds+(mode==='timeout'?DOOR_SECONDS:0),8);
  expect(n.metroProgress).toBe(s.metroProgress);
  expect(n.metroStopIndex).toBe(s.metroStopIndex);
  expect(n.metroDuration).toBe(s.metroDuration);
  const returned=reducer(n,{type:'TICK',dt:2});
  expect(returned.phase).toBe('arrival');
  expect(needsMetroBranchExit(returned)).toBe(true);
  expect(n.remaining-returned.remaining).toBe(2);
  const resumed=board(reducer(returned,{type:'ALIGHT'}));
  expect(resumed.phase).toBe('metro');
  expect(resumed.metroBranch?.terminal).toBe('hongqiao');
  expect(resumed.logs.filter(l=>l.seconds===METRO_BRANCH.missSeconds)).toHaveLength(1);
 });
 it('rejects stale and repeated boarding callbacks, including a second platform visit',()=>{
  const s=platform(),oldAction={type:'BOARD_METRO' as const,terminal:'hongqiao' as const,visit:s.metroBranch!.platformVisit};
  expect(reducer(s,{...oldAction,visit:oldAction.visit+1})).toBe(s);
  const wrong=board(s,'hangzhong');
  expect(s.remaining-wrong.remaining).toBe(METRO_BRANCH.missSeconds);
  expect(reducer(wrong,oldAction)).toBe(wrong);
  const back=reducer(reducer(wrong,{type:'TICK',dt:2}),{type:'ALIGHT'});
  expect(back.phase).toBe('metro-platform');
  expect(back.metroBranch!.platformVisit).toBeGreaterThan(s.metroBranch!.platformVisit);
  expect(reducer(back,oldAction)).toBe(back);
  const next=board(back);
  expect(back.remaining-next.remaining).toBe(30);
  expect(reducer(next,{...oldAction,visit:back.metroBranch!.platformVisit})).toBe(next);
 });
 it('cannot board outside the platform at the actual branch stop',()=>{
  const s=platform(),action={type:'BOARD_METRO' as const,terminal:'hongqiao' as const,visit:s.metroBranch!.platformVisit};
  for(const phase of ['metro','arrival','station','result'] as const){
   const other={...s,phase};
   expect(reducer(other,action)).toBe(other);
  }
  const wrongStop={...s,metroStopIndex:s.metroStopIndex-1};
  expect(reducer(wrongStop,action)).toBe(wrongStop);
 });
 it('rejects a malformed runtime terminal without charging or changing trains',()=>{
  const s=platform(),terminal='unknown-destination' as MetroTerminal;
  expect(metroBoardingChoice(s,terminal)).toBeUndefined();
  expect(reducer(s,{type:'BOARD_METRO',terminal,visit:s.metroBranch!.platformVisit})).toBe(s);
 });
 it('fails immediately if the real wait exhausts the check-in deadline',()=>{
  const s={...platform(),remaining:STOP_BEFORE+METRO_BRANCH.waitSeconds-1},next=board(s);
  expect(next.phase).toBe('result');
  expect(next.success).toBe(false);
  expect(next.endEventId).toBe('metro-branch-wait');
  expect(s.remaining-next.remaining).toBe(30);
  expect(reducer(next,{type:'BOARD_METRO',terminal:'hongqiao',visit:s.metroBranch!.platformVisit})).toBe(next);
 });
 it('attributes a deadline while reading the platform to actual hesitation, not the unpaid fixed wait',()=>{
  const s={...platform('student'),remaining:STOP_BEFORE+.5},n=reducer(s,{type:'TICK',dt:1});
  expect(n.phase).toBe('result');
  expect(n.endEventId).toBe('metro-branch-platform');
  expect(s.remaining-n.remaining).toBe(1);
  expect(n.logs.some(l=>l.eventId==='metro-branch-wait')).toBe(false);
  expect(n.metrics.impacts.find(i=>i.id==='idle')?.deltaSeconds).toBe(-1);
 });
 it('retains the wrong-branch cause when the deadline arrives during its recovery',()=>{
  const s={...atBranch(boarded('worker','sh-n-10')),remaining:STOP_BEFORE+METRO_BRANCH.missSeconds+1};
  const recovery=reducer(s,{type:'CONTINUE_METRO'}),n=reducer(recovery,{type:'TICK',dt:2});
  expect(recovery.phase).toBe('metro-recovery');
  expect(n.phase).toBe('result');
  expect(n.endEventId).toBe('metro-branch-missed');
  expect(n.logs.filter(l=>l.eventId==='metro-branch-missed')).toHaveLength(1);
 });
 it.each(CHARACTERS)('%s counts one wrong direction and one branch miss as two distinct errors',character=>{
  let s=prepared(character,'sh-n-10');
  s=reducer(reducer(s,{type:'DIRECTION',correct:false}),{type:'TICK',dt:2.5});
  expect(s.phase).toBe('direction');
  s=reducer(s,{type:'DIRECTION',correct:true});
  if(s.event?.id==='tourist-sleep')s=choose(s,'awake');
  const missed=reducer(atBranch(s),{type:'CONTINUE_METRO'}),result=createGameResult(missed);
  expect(missed.metroBranch!.misses).toBe(1);
  expect(result.wrongDirections).toBe(1);
  expect(result.errors).toBe(2);
  expect(result.missedStops).toBe(0);
 });
});

describe('branch waiting retains the existing character clocks and resources',()=>{
 it('parent waiting matches the same elapsed platform time, including urine exactly once',()=>{
  const raw=platform('mom'),s={...raw,parent:{...raw.parent!,energy:10,childEnergy:40,patience:50,toilet:10}};
  const cost=metroBoardingChoice(s,'hongqiao')!;
  expect(cost.seconds).toBe(30);
  expect(cost.waitSeconds).toBe(30);
  const fixed=board(s),elapsed=reducer(s,{type:'TICK',dt:30});
  expect(s.remaining-fixed.remaining).toBe(30);
  for(const key of ['energy','childEnergy','patience','toilet'] as const)expect(fixed.parent![key]).toBeCloseTo(elapsed.parent![key],8);
  expect(fixed.parent!.energy).toBeCloseTo(44.5,8);
  expect(fixed.parent!.childEnergy).toBeCloseTo(40.6,8);
  expect(fixed.parent!.patience).toBeCloseTo(49.46,8);
  expect(fixed.parent!.toilet).toBeCloseTo(parentToiletAfter(10,'metro-platform',30),8);
  expect(fixed.parent!.gap).toBe(s.parent.gap);
  expect(fixed.parent!.carriedSeconds).toBe(s.parent.carriedSeconds);
 });
 it.each(CHARACTERS)('%s gets no passive recovery from choosing the wrong train or its recovery animation',character=>{
  let s=platform(character);
  if(s.student)s={...s,student:{...s.student,stamina:10}};
  if(s.characterTime)s={...s,characterTime:{...s.characterTime,energy:10,fatigue:50,energyReserve:7}};
  if(s.parent)s={...s,parent:{...s.parent,energy:10,childEnergy:40,patience:50,toilet:10}};
  expect(metroBoardingChoice(s,'hangzhong')?.waitSeconds??0).toBe(0);
  const wrong=board(s,'hangzhong'),returned=reducer(wrong,{type:'TICK',dt:2});
  expect(s.remaining-returned.remaining).toBe(METRO_BRANCH.missSeconds+2);
  if(s.student)expect(returned.student!.stamina).toBe(s.student.stamina);
  if(s.characterTime){
   expect(returned.characterTime!.energy).toBe(s.characterTime.energy);
   expect(returned.characterTime!.fatigue).toBe(s.characterTime.fatigue);
   expect(returned.characterTime!.energyReserve).toBe(7);
   expect(returned.characterTime!.energyReserveUsed).toBe(s.characterTime.energyReserveUsed);
  }
  if(s.parent){
   expect(returned.parent!.energy).toBe(10);
   expect(returned.parent!.childEnergy).toBe(40);
   expect(returned.parent!.patience).toBe(50);
   expect(returned.parent!.toilet).toBeCloseTo(parentToiletAfter(10,'metro-platform',67),8);
  }
 });
 it.each(TOURIST_SLEEP_OPTIONS)('$id still lets a sleeping tourist leave the wrong train before the fork',option=>{
  const s=boarded('tourist','sh-j-10',.1,.9,option.id),arrival=atBranch(s,false);
  const ready=arrival.event?choose(arrival):arrival;
  expect(ready.characterTime!.sleeping).toBe(false);
  expect(needsMetroBranchExit(ready)).toBe(true);
  const p=reducer(ready,{type:'ALIGHT'});
  expect(p.phase).toBe('metro-platform');
  const resumed=board(p),last=finishMetro(resumed);
  expect(last.characterTime!.sleeping).toBe(false);
  expect(s.remaining-last.remaining).toBeCloseTo(s.metroDuration+30,7);
  expect(last.metroMisses).toBe(0);
 });
 it('uses a branch reminder before the configured alarm, and retains the actual alarm on the right train',()=>{
  const wrong=atBranch(boarded('tourist','sh-j-10',.1,.9,'alarm-1'),false);
  expect(wrong.metroStopIndex).toBeLessThan(wrong.route!.stops.length-1-wrong.characterTime!.alarmStops);
  expect(wrong.event?.id).toBe('tourist-wake');
  expect(wrong.event?.title).toBe('龙溪路到了，先醒醒！');
  expect(wrong.event?.description).toContain('航中路');
  expect(wrong.event?.title).not.toContain('闹钟');
  const right=atBranch(boarded('tourist','sh-j-10',.9,.9,'alarm-1'),false);
  expect(right.event).toBeNull();
  expect(right.characterTime!.sleeping).toBe(true);
  const alarm=nextStop(reducer(right,{type:'CONTINUE_METRO'}));
  expect(alarm.event?.id).toBe('tourist-wake');
  expect(alarm.event?.title).toContain('闹钟响了');
 });
});
