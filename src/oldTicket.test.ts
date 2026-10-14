import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {stationPrompt} from './flow';

function oldTicket():Run{
 const base=createCharacterStationRun('shanghai','tourist',true,()=>.1);
 const stationJourney=buildStationJourney(base),stationBeat=stationJourney.findIndex(b=>b.id==='old-ticket');
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 const s:Run={...base,phase:'station',stationJourney,stationBeat,stage:3,event:null,
  characterTime:{...base.characterTime!,energy:10,fatigue:40}};
 return {...s,event:journeyPrompt(s)};
}

describe('saved old ticket is an actionable date check',()=>{
 it('offers a real current ticket without claiming the player bought the wrong date',()=>{
  const e=stationPrompt('old-ticket',true)!;
  expect(e.id).toBe('old-ticket');expect(e.interaction!.kind).toBe('choice');
  expect(e.description).toContain('今天的车票也在手机里');
  expect(e.description).not.toContain('你点错了日期');
  expect(e.choices.map(c=>({id:c.id,seconds:c.seconds}))).toEqual([{id:'current-ticket',seconds:8},{id:'stale-ticket',seconds:60}]);
  expect(e.choices[0].detail).toContain('8 游戏秒');expect(e.choices[1].detail).toContain('60 游戏秒');
 });
 it.each([['current-ticket',8,30],['stale-ticket',60,35]] as const)('%s charges its canonical cost once and completes the same obstacle', (id,cost,energy)=>{
  const s=oldTicket(),c=s.event!.choices.find(c=>c.id===id)!;
  const n=reducer(s,{type:'CHOICE',choice:{...c,label:'过时文案',seconds:999}});
  expect(s.remaining-n.remaining).toBe(cost);
  expect(n.event).toBeNull();expect(n.stationBeat).toBe(s.stationBeat+1);
  expect(n.logs).toHaveLength(s.logs.length+1);expect(n.logs.at(-1)!.seconds).toBe(cost);
  expect(n.characterTime!.energy).toBe(energy);
  expect(n.characterTime!.fatigue).toBeCloseTo(40-cost*.00075,10);
  expect(n.characterTime!.maxEnergy).toBe(35);
  expect(reducer(n,{type:'CHOICE',choice:c})).toBe(n);
 });
 it('inaction adds one sixty-second timeout, then still requires a ticket choice',()=>{
  const s=oldTicket(),waiting=reducer(s,{type:'TICK',dt:8.1});
  expect(s.remaining-waiting.remaining).toBeCloseTo(8.1+60,8);
  expect(waiting.event!.id).toBe('old-ticket');expect(waiting.eventOverdue).toBe(true);
  expect(waiting.stationBeat).toBe(s.stationBeat);
  expect(waiting.logs).toHaveLength(s.logs.length+1);expect(waiting.logs.at(-1)!.seconds).toBe(60);
  expect(waiting.characterTime!.fatigue).toBeCloseTo(40-68.1*.00075,10);
  const later=reducer(waiting,{type:'TICK',dt:2});
  expect(waiting.remaining-later.remaining).toBeCloseTo(2,8);expect(later.logs).toHaveLength(waiting.logs.length);
  const c=later.event!.choices.find(c=>c.id==='current-ticket')!;
  const completed=reducer(later,{type:'CHOICE',choice:c});
  expect(later.remaining-completed.remaining).toBe(8);
  expect(completed.event).toBeNull();expect(completed.logs.at(-1)!.seconds).toBe(8);
  expect(reducer(completed,{type:'CHOICE',choice:c})).toBe(completed);
 });
});
