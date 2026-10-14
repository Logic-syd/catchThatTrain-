import {describe,expect,it} from 'vitest';
import {advanceCharacterWait,characterWaitOverrides,createCharacterTimeState,tickCharacterResources} from './characterTime';
import type {Choice} from './data';

const option=(id:string,label='改过的文案'):Choice=>({id,label,seconds:35,detail:''});

describe('worker and tourist passive game time',()=>{
 it('uses debited game time and the established passive rates',()=>{
  const worker={...createCharacterTimeState('worker'),energy:10,fatigue:50};
  const tourist={...createCharacterTimeState('tourist'),energy:10,fatigue:70};
  const w=advanceCharacterWait(worker,2),t=advanceCharacterWait(tourist,2);
  expect(w.energy).toBe(17);expect(w.fatigue).toBeCloseTo(49.9995,10);
  expect(t.energy).toBe(14.25);expect(t.fatigue).toBeCloseTo(69.9985,10);
 });
 it.each([80.0003,80,60.0003,60])('a wait crossing fatigue %s is identical when split',fatigue=>{
  const start={...createCharacterTimeState('tourist'),energy:10,fatigue};
  const full=advanceCharacterWait(start,1);
  let split=start;for(let i=0;i<10;i++)split=advanceCharacterWait(split,.1);
  expect(full.energy).toBeCloseTo(split.energy,8);
  expect(full.fatigue).toBeCloseTo(split.fatigue,8);
  expect(full.exhausted).toBe(split.exhausted);
  if(fatigue===80.0003)expect(full.energy).toBeCloseTo(12.025,8);
  if(fatigue===60.0003)expect(full.energy).toBeCloseTo(12.35,8);
 });
 it('integrates through both fatigue thresholds during a long wait',()=>{
  const start={...createCharacterTimeState('tourist'),energy:0,fatigue:85};
  const full=advanceCharacterWait(start,40000);
  let split=start;for(let i=0;i<400;i++)split=advanceCharacterWait(split,100);
  expect(full.energy).toBeCloseTo(split.energy,6);
  expect(full.energy).toBe(35);
  expect(full.fatigue).toBeCloseTo(55,8);
  expect(full.fatigue).toBeCloseTo(split.fatigue,8);
 });
 it('long metro waits stay within character capacity and fatigue floor',()=>{
  for(const id of ['worker','tourist'] as const){
   const start={...createCharacterTimeState(id),energy:0,fatigue:1,exhausted:true};
   const full=advanceCharacterWait(start,6000);
   expect(full.energy).toBe(start.maxEnergy);expect(full.maxEnergy).toBe(start.maxEnergy);
   expect(full.fatigue).toBe(0);expect(full.exhausted).toBe(false);
  }
 });
 it('semantic overrides prevent a second resource award, including at caps',()=>{
  const start={...createCharacterTimeState('tourist'),energy:12,fatigue:80};
  const both=advanceCharacterWait(start,30,['energy','fatigue']);
  expect(both.energy).toBe(12);expect(both.fatigue).toBe(80);
  const onlyEnergy=advanceCharacterWait(start,1,['fatigue']);
  expect(onlyEnergy.fatigue).toBe(80);expect(onlyEnergy.energy).toBe(13.875);
  const onlyFatigue=advanceCharacterWait(start,30,['energy']);
  expect(onlyFatigue.energy).toBe(12);expect(onlyFatigue.fatigue).toBeCloseTo(79.9775,10);
  const full={...start,energy:35,fatigue:0};
  expect(advanceCharacterWait(full,30,['energy','fatigue'])).toEqual(full);
 });
 it('rest changes neither reserve, wheel effects nor actual movement statistics',()=>{
  const start={...createCharacterTimeState('tourist'),energy:10,fatigue:70,energyReserve:10,energyReserveUsed:2,wheelDamaged:true,actualDelay:42};
  const n=advanceCharacterWait(start,1);
  expect(n.energy).toBe(12.125);expect(n.energyReserve).toBe(10);expect(n.energyReserveUsed).toBe(2);
  expect(n.wheelDamaged).toBe(true);expect(n.actualDelay).toBe(42);expect(n.runner).toEqual(start.runner);
 });
 it('exhaustion clears at ten energy without automatically starting sprint',()=>{
  const start={...createCharacterTimeState('worker'),energy:6,exhausted:true};
  expect(advanceCharacterWait(start,1).exhausted).toBe(true);
  const n=advanceCharacterWait(start,2);expect(n.exhausted).toBe(false);expect(n.sprinting).toBe(false);
  const empty={...start,energy:0,exhausted:false,sprinting:true};
  const stillEmpty=advanceCharacterWait(empty,2,['energy']);
  expect(stillEmpty.exhausted).toBe(true);expect(stillEmpty.sprinting).toBe(false);
 });
 it('keeps wheel and sprint drain separate from fatigue recovery and rejects invalid wait durations',()=>{
  const start={...createCharacterTimeState('tourist'),energy:20,fatigue:70,sprinting:true,wheelDamaged:true};
  const moving=tickCharacterResources(start,1,true);
  expect(moving.energy).toBeCloseTo(13,10);expect(moving.fatigue).toBeCloseTo(70.003,10);
  const resting=tickCharacterResources(start,1,false);
  expect(resting.energy).toBe(22.125);expect(resting.fatigue).toBeCloseTo(69.99925,10);
  for(const duration of [0,-1,NaN,Infinity])expect(advanceCharacterWait(start,duration)).toBe(start);
 });
});

describe('explicit wait resource coverage',()=>{
 it('identifies overrides by stable option ID and supports legacy labels',()=>{
  for(const event of ['vertical-choice','gz-lift'])for(const id of ['lift','stairs'])expect(characterWaitOverrides(event,option(id))).toEqual(['energy']);
  expect(characterWaitOverrides('gz-lift',{...option('lift'),id:undefined,label:'等电梯，恢复体力'})).toEqual(['energy']);
  expect(characterWaitOverrides('tourist-sleep',option('alarm-1'))).toEqual(['energy','fatigue']);
  expect(characterWaitOverrides('tourist-sleep',option('awake'))).toEqual([]);
  expect(characterWaitOverrides('tourist-wake',option('wake'))).toEqual(['energy']);
  expect(characterWaitOverrides('tourist-wake',option('oversleep'))).toEqual(['energy']);
  expect(characterWaitOverrides('zz-hometown-answer',option('low-salary'))).toEqual(['energy']);
  expect(characterWaitOverrides('zz-hometown-answer',option('truth'))).toEqual([]);
 });
 it('does not invent fixed resource effects for queues, wheel repairs or phone calls',()=>{
  expect(characterWaitOverrides('security-queue',option('a'))).toEqual([]);
  expect(characterWaitOverrides('tourist-wheel',option('repair'))).toEqual([]);
  expect(characterWaitOverrides('worker-boss-call',option('answer'))).toEqual([]);
 });
});
