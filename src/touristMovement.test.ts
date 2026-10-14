import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Action,type Run} from './engine';
import {advanceCharacterWait,characterMovementFactor,createCharacterTimeState,tickCharacterResources} from './characterTime';

function corridor(fatigue=40):Run{
 const s=createCharacterStationRun('shanghai','tourist',false,()=>.5);
 return {...s,phase:'station',stationRunning:true,event:null,stationJourney:[{id:'gates',stage:4,label:'同一段通道',seconds:200}],stationBeat:0,stationProgress:0,
  characterTime:{...s.characterTime!,fatigue,runner:{...s.characterTime!.runner,wave:3}}};
}
function tick(s:Run,seconds:number){return reducer(s,{type:'TICK',dt:seconds});}

describe('tourist movement rewards controlled sprinting',()=>{
 it('a short burst still gains actual distance after twenty seconds of recovery walking',()=>{
  const s=corridor(),walking=tick(s,22);
  let burst=tick(reducer(s,{type:'SPRINT_INPUT',held:true}),2);
  expect(burst.characterTime!.energy).toBeCloseTo(23,8);
  burst=tick(reducer(burst,{type:'SPRINT_INPUT',held:false}),20);
  expect(burst.stationProgress).toBeGreaterThan(walking.stationProgress);
  expect(burst.remaining).toBeCloseTo(walking.remaining,8);
  expect(burst.characterTime!.energy).toBe(35);
  expect(burst.characterTime!.maxEnergy).toBe(35);
 });
 it.each([40,85])('paced sprinting at fatigue %s gains distance over the same continuous walking time',fatigue=>{
  const s=corridor(fatigue),walking=tick(s,120);
  let paced=s,sprintTicks=0;
  for(let i=0;i<1200;i++){
   const t=paced.characterTime!,desired=t.sprinting?t.energy>t.maxEnergy*.3:t.energy>=t.maxEnergy*.7;
   if(desired!==t.sprinting)paced=reducer(paced,{type:'SPRINT_INPUT',held:desired});
   if(paced.characterTime!.sprinting)sprintTicks++;
   paced=tick(paced,.1);
   expect(paced.characterTime!.energy).toBeGreaterThan(0);
   expect(paced.characterTime!.energy).toBeLessThanOrEqual(35);
  }
  expect(sprintTicks).toBeGreaterThan(0);expect(sprintTicks).toBeLessThan(1200);
  expect(paced.stationProgress).toBeGreaterThan(walking.stationProgress);
  expect(paced.remaining).toBeCloseTo(walking.remaining,8);
  expect(paced.characterTime!.runner.collisions).toBe(0);
  expect(paced.characterTime!.exhausted).toBe(false);
 });
 it('softens only tourist low-energy speed, retaining the worker curve',()=>{
  for(const [who,ratio] of [['tourist',.96],['worker',.86]] as const){
   const s=createCharacterStationRun('shanghai',who,false,()=>.5),t=s.characterTime!;
   const half={...s,characterTime:{...t,energy:t.maxEnergy/2}};
   expect(characterMovementFactor(half)/characterMovementFactor(s)).toBeCloseTo(ratio,10);
  }
 });
});

describe('fatigue restricts positive recovery without discounting sprint costs',()=>{
 it.each([[40,1],[70,.85],[90,.75]])('fatigue %s affects walking and resting, while sprint still costs six', (fatigue,factor)=>{
  const t={...createCharacterTimeState('tourist',()=>.5),energy:20,fatigue};
  expect(tickCharacterResources({...t,sprinting:true},1,true).energy).toBe(14);
  expect(tickCharacterResources(t,1,true).energy).toBeCloseTo(20+.9*factor,10);
  expect(advanceCharacterWait(t,1).energy).toBeCloseTo(20+2.5*factor,10);
  expect(tickCharacterResources({...t,sprinting:true,wheelDamaged:true},1,true).energy).toBe(13);
 });
 it('repeated sprint, exhaustion and waiting stay bounded without reusing reserve or auto-resuming sprint',()=>{
  let s=corridor(85);s={...s,characterTime:{...s.characterTime!,energyReserve:10,wheelDamaged:true}};
  const act=(action:Action)=>{
   s=reducer(s,action);const t=s.characterTime!;
   expect(t.maxEnergy).toBe(35);expect(t.energy).toBeGreaterThanOrEqual(0);expect(t.energy).toBeLessThanOrEqual(35);
   expect(t.fatigue).toBeGreaterThanOrEqual(0);expect(t.fatigue).toBeLessThanOrEqual(100);
   expect(t.energyReserve).toBeGreaterThanOrEqual(0);expect(t.energyReserve).toBeLessThanOrEqual(10);
   expect(t.energyReserve+t.energyReserveUsed).toBeCloseTo(10,8);
   return t;
  };
  for(let cycle=0;cycle<8;cycle++){
   act({type:'SPRINT_INPUT',held:true});
   const tired=act({type:'TICK',dt:8});
   expect(tired.energy).toBe(0);expect(tired.exhausted).toBe(true);expect(tired.sprinting).toBe(false);
   act({type:'RUN_INPUT',held:false});
   const partial=act({type:'TICK',dt:4});
   expect(partial.energy).toBeCloseTo(7.5,8);expect(partial.exhausted).toBe(true);
   const recovered=act({type:'TICK',dt:2});
   expect(recovered.energy).toBeCloseTo(11.25,8);expect(recovered.exhausted).toBe(false);expect(recovered.sprinting).toBe(false);
  }
  expect(s.characterTime!.energyReserveUsed).toBeCloseTo(10,8);
  expect(s.phase).toBe('station');
 });
});
