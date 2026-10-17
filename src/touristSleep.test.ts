import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,journeyRouteSeconds,type Run} from './engine';
import {characterEventPrompt,applyCharacterEvent,TOURIST_SLEEP_OPTIONS,timedPrompt} from './characterTime';
import {STATIONS} from './stations';
import {needsMetroBranchExit} from './metroBranch';

function boarded(city='shanghai',hard=false):Run{
 let s=reducer(createCharacterStationRun(city,'tourist',hard,()=>.5),{type:'START'});
 s=reducer(s,{type:'PERSON_PICK',step:0,option:'go'});
 s=reducer(s,{type:'PERSON_PICK',step:1,option:'light'});
 const route=[...s.city.spawnStations[s.spawn].routes].sort((a,b)=>journeyRouteSeconds(s,a)-journeyRouteSeconds(s,b))[0];
 s=reducer(s,{type:'ROUTE',route});return reducer(s,{type:'DIRECTION',correct:true});
}
function choose(s:Run,id:string){return reducer(s,{type:'CHOICE',choice:s.event!.choices.find(c=>c.id===id)!});}
function travel(s:Run):Run{
 for(let i=0;i<1000&&s.phase!=='station'&&s.phase!=='result';i++){
  if(s.event){expect(s.event.id).toBe('tourist-wake');s=reducer(s,{type:'CHOICE',choice:s.event.choices[0]});}
  else if(s.phase==='arrival')s=reducer(s,{type:needsMetroBranchExit(s)||s.metroStopIndex===s.route!.stops.length-1||s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});
  else if(s.phase==='metro-platform'){const visit=s.metroBranch!.platformVisit;s=reducer(s,{type:'TICK',dt:1});s=reducer(s,{type:'BOARD_METRO',terminal:'hongqiao',visit});}
  else s=reducer(s,{type:'TICK',dt:.1});
 }
 expect(s.phase).toBe('station');return s;
}
describe('tourist sleep uses the existing metro journey',()=>{
 it.each(TOURIST_SLEEP_OPTIONS)('$id has no extra time charge, retains its recovery and cannot be applied twice',option=>{
  let s=boarded();s={...s,characterTime:{...s.characterTime!,energy:10,fatigue:70}};
  s.event=characterEventPrompt(s,'tourist-sleep')!;
  const n=choose(s,option.id);
  expect(n.remaining).toBe(s.remaining);expect(n.metroDuration).toBe(s.metroDuration);
  expect(n.characterTime!.maxEnergy).toBe(35);
  expect(n.characterTime!.energy).toBe(10+option.energy);
  expect(n.characterTime!.fatigue).toBe(70-option.fatigue);
  expect(n.characterTime!.alarmStops).toBe(option.alarmStops);
  expect(n.characterTime!.sleeping).toBe(true);
  expect(n.logs.at(-1)?.seconds).toBe(0);
  expect(n.metrics.impacts.some(i=>i.eventId==='tourist-sleep'&&i.deltaSeconds<0)).toBe(false);
  expect(reducer(n,{type:'CHOICE',choice:s.event!.choices.find(c=>c.id===option.id)!})).toBe(n);
 });
 it.each([0,20,34,35])('discloses actual restoration at energy %s and respects the cap',energy=>{
  let s=boarded();s={...s,characterTime:{...s.characterTime!,energy,fatigue:5}};
  s.event=characterEventPrompt(s,'tourist-sleep')!;
  const c=s.event.choices.find(c=>c.id==='alarm-1')!,gain=Math.min(20,35-energy);
  expect(c.seconds).toBe(0);expect(c.detail).toContain(gain?`精力 +${gain}`:'精力已满');
  expect(c.detail).toContain('疲劳 −5');expect(c.detail).not.toMatch(/睡 \d+ 秒/);
  const n=choose(s,'alarm-1');expect(n.characterTime!.energy-energy).toBe(gain);
  expect(n.characterTime!.fatigue).toBe(0);
 });
 it('keeps current restoration details fresh while reading, charges only elapsed reading time',()=>{
  let s=boarded();s={...s,characterTime:{...s.characterTime!,energy:34,fatigue:70}};
  s.event=characterEventPrompt(s,'tourist-sleep')!;
  const n=reducer(s,{type:'TICK',dt:1});
  expect(n.remaining).toBe(s.remaining-1);expect(n.metroProgress).toBe(s.metroProgress);
  expect(n.event!.choices[0].detail).toContain('精力已满');
  const picked=choose(n,'alarm-3');expect(picked.remaining).toBe(n.remaining);
 });
 it('uses stable sleep option IDs even if the displayed label changes',()=>{
  const s=boarded(),n=applyCharacterEvent(s,'tourist-sleep','新的选项文案','alarm-2');
  expect(n.characterTime!.alarmStops).toBe(2);expect(n.characterTime!.fatigue).toBe(58);
 });
 it('staying awake adds no delay or unimplemented focus bonus and has no obsolete third prep',()=>{
  const s=boarded(),n=choose(s,'awake');
  expect(n.remaining).toBe(s.remaining);expect(n.characterTime!.sleeping).toBe(false);
  expect(n.characterTime!.focus).toBe(s.characterTime!.focus);
  expect(timedPrompt(n)).toBeUndefined();
 });
 it.each(STATIONS)('$id charges the same metro journey for each alarm as staying awake in both difficulties',station=>{
  for(const hard of [false,true]){
   const s=boarded(station.id,hard),awake=travel(choose(s,'awake'));
   for(const option of TOURIST_SLEEP_OPTIONS){
    const asleep=travel(choose(s,option.id));
    expect(asleep.remaining).toBeCloseTo(awake.remaining,8);
    expect(asleep.metroProgress).toBe(1);expect(asleep.metroMisses).toBe(0);
    expect(asleep.characterTime!.sleeping).toBe(false);
    expect(asleep.logs.some(l=>l.eventId==='tourist-sleep'&&l.seconds>0)).toBe(false);
   }
  }
 });
 it.each(TOURIST_SLEEP_OPTIONS)('$id rings at the configured stop and charges actual wake interaction time',option=>{
  let s=choose(boarded(),option.id);
  for(let i=0;i<500&&!s.event;i++){
   if(s.phase==='arrival')s=reducer(s,{type:'CONTINUE_METRO'});
   else s=reducer(s,{type:'TICK',dt:.1});
  }
  expect(s.event?.id).toBe('tourist-wake');
  expect(s.metroStopIndex).toBe(Math.max(1,s.route!.stops.length-1-option.alarmStops));
  const n=reducer(s,{type:'TICK',dt:.3});expect(n.remaining).toBeCloseTo(s.remaining-.3);
  const woke=reducer(n,{type:'CHOICE',choice:n.event!.choices[0]});
  expect(woke.remaining).toBe(n.remaining);expect(woke.characterTime!.sleeping).toBe(false);
 });
 it('a missed alarm still costs 80 extra seconds exactly once',()=>{
  let s=choose(boarded(),'alarm-1');
  for(let i=0;i<500&&!s.event;i++)s=s.phase==='arrival'?reducer(s,{type:'CONTINUE_METRO'}):reducer(s,{type:'TICK',dt:.1});
  expect(s.event?.id).toBe('tourist-wake');
  const n=reducer(s,{type:'TICK',dt:3});
  expect(n.remaining).toBeCloseTo(s.remaining-3-80);
  expect(n.metroMisses).toBe(1);expect(n.characterTime!.sleeping).toBe(false);
  expect(n.logs.filter(l=>l.seconds===80)).toHaveLength(1);
 });
});
