import {describe,expect,it} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {applyCharacterEvent,applyTimedChoice,characterEventPrompt,characterMovementFactor,consumeEnergyReserve,refreshCharacterPrompt,tickCharacterResources,timedPrompt,TOURIST_WHEEL_RULES} from './characterTime';
import {stationChallenge} from './stations';

function preparation(character:'worker'|'tourist',step=0):Run{
 const s=createCharacterStationRun('shanghai',character,false,()=>.5);
 return {...s,phase:'preparation',characterTime:{...s.characterTime!,prepStep:step}};
}
function station(character:'worker'|'tourist'):Run{
 const s=preparation(character);
 return {...s,phase:'station',event:null,stationRunning:true,stationJourney:[{id:'gate-scan',stage:4,label:'长通道',seconds:100}],stationBeat:0,stationProgress:0,characterTime:{...s.characterTime!,runner:{...s.characterTime!.runner,wave:99,lane:0}}};
}

describe('preparation resources reach a real consumer',()=>{
 it.each([
  ['worker',1,'eat',60],['tourist',0,'coffee',50],['tourist',0,'rest',30],
 ] as const)('%s %s %s turns the default full-energy benefit into usable reserve',(character,step,option,cost)=>{
  const s=preparation(character,step),prompt=timedPrompt(s)!;
  expect(prompt.choices.find(c=>c.id===option)!.detail).toContain('精力已满');
  expect(prompt.choices.find(c=>c.id===option)!.detail).toContain('精力储备 +10');
  const n=reducer(s,{type:'PERSON_PICK',option,step});
  expect(n.remaining).toBe(s.remaining-cost);
  expect(n.characterTime!.energy).toBe(s.characterTime!.energy);
  expect(n.characterTime!.maxEnergy).toBe(s.characterTime!.maxEnergy);
  expect(n.characterTime!.energyReserve).toBe(10);
  const depleted={...n.characterTime!,energy:n.characterTime!.maxEnergy-4};
  const moved=tickCharacterResources(depleted,.1,true);
  expect(moved.energy).toBe(moved.maxEnergy);
  expect(moved.energyReserveUsed).toBeGreaterThan(3);
  expect(moved.energyReserve+moved.energyReserveUsed).toBeCloseTo(10,8);
  expect(reducer(n,{type:'PERSON_PICK',option,step})).toEqual(n);
 });
 it.each([0,20,58,60])('meal at %s energy splits recovery and reserve without changing capacity',energy=>{
  const base=preparation('worker',1),s={...base,characterTime:{...base.characterTime!,energy}};
  const detail=timedPrompt(s)!.choices[0].detail,n=applyTimedChoice(s,'eat');
  const restored=Math.min(10,60-energy);
  expect(n.characterTime!.energy-energy).toBe(restored);
  expect(n.characterTime!.energyReserve).toBe(10-restored);
  expect(n.characterTime!.maxEnergy).toBe(60);
  expect(n.characterTime!.motherStayed).toBe(true);
  expect(detail).toContain(restored?`精力 +${restored}`:'精力已满');
  expect(detail).toContain(`精力储备 +${10-restored}`);
 });
 it('clips reserve, fatigue and focus benefits in both text and state',()=>{
  const base=preparation('tourist'),s={...base,characterTime:{...base.characterTime!,energyReserve:8,fatigue:3}};
  expect(timedPrompt(s)!.choices[0].detail).toContain('精力储备 +2');
  expect(timedPrompt(s)!.choices[0].detail).toContain('疲劳 −3');
  const coffee=applyTimedChoice(s,'coffee');
  expect(coffee.characterTime!.energyReserve).toBe(10);
  expect(coffee.characterTime!.fatigue).toBe(0);
  const worker=preparation('worker',2),reply={...worker,characterTime:{...worker.characterTime!,focus:99,energy:22,energyReserve:4}};
  expect(timedPrompt(reply)!.choices[0].detail).toContain('专注 +1');
  const replied=applyTimedChoice(reply,'reply');
  expect(replied.characterTime!.focus).toBe(100);
  expect(replied.characterTime!.energy).toBe(22);
  expect(replied.characterTime!.energyReserve).toBe(4);
 });
 it('leaving the meal unchosen does not claim a family-story action',()=>{
  expect(applyTimedChoice(preparation('worker',1),'leave').characterTime!.motherStayed).toBe(false);
 });
 it('silencing work records pending calls separately from the calls actually handled',()=>{
  const ignored=applyTimedChoice(preparation('worker',2),'ignore');
  expect(ignored.characterTime!.bossCalls).toBe(0);
  expect(ignored.characterTime!.bossCallsLeft).toBe(2);
  const first=applyCharacterEvent(ignored,'worker-boss-call','挂掉，继续赶车');
  expect(first.characterTime!.bossCalls).toBe(1);
  expect(first.characterTime!.bossCallsLeft).toBe(1);
  const second=applyCharacterEvent(first,'worker-boss-call','挂掉，继续赶车');
  expect(second.characterTime!.bossCalls).toBe(2);
  expect(second.characterTime!.bossCallsLeft).toBe(0);
  const answered=applyCharacterEvent(ignored,'worker-boss-call','renamed','answer');
  expect(answered.characterTime!.bossCalls).toBe(1);
  expect(answered.characterTime!.bossCallsLeft).toBe(0);
 });
 it('only movement consumes reserve and exhaustion still needs ten energy to clear',()=>{
  const t={...preparation('worker').characterTime!,energy:0,energyReserve:5,exhausted:true};
  const resting=tickCharacterResources(t,.1,false);
  expect(resting.energyReserve).toBe(5);
  expect(resting.energyReserveUsed).toBe(0);
  const moving=tickCharacterResources(t,.1,true);
  expect(moving.energyReserve).toBe(0);
  expect(moving.energyReserveUsed).toBe(5);
  expect(moving.exhausted).toBe(true);
  expect(tickCharacterResources(moving,2,false).exhausted).toBe(false);
  const full={...t,energy:t.maxEnergy};
  expect(consumeEnergyReserve(full).energyReserve).toBe(5);
 });
 it.each(['worker','tourist'] as const)('%s reserve actually supports sprinting through the reducer',character=>{
  const base=station(character),s={...base,characterTime:{...base.characterTime!,energyReserve:10}};
  const running=reducer(s,{type:'SPRINT_INPUT',held:true}),large=reducer(running,{type:'TICK',dt:1});
  let small=running;for(let i=0;i<10;i++)small=reducer(small,{type:'TICK',dt:.1});
  expect(large.characterTime!.energy).toBe(large.characterTime!.maxEnergy);
  expect(large.characterTime!.energyReserve).toBeLessThan(10);
  expect(large.characterTime!.energyReserveUsed).toBeGreaterThan(0);
  expect(large.characterTime).toEqual(small.characterTime);
  expect(large.remaining).toBeCloseTo(small.remaining,8);
  expect(large.stationProgress).toBeCloseTo(small.stationProgress,8);
  const reading={...running,event:characterEventPrompt(running,'tourist-wheel')!};
  expect(reducer(reading,{type:'TICK',dt:1}).characterTime!.energyReserveUsed).toBe(0);
 });
});

describe('wheel effects and shared event boundaries',()=>{
 it('repair costs only its declared time; dragging has a persistent movement consumer',()=>{
  const s=station('tourist'),event=characterEventPrompt(s,'tourist-wheel')!;
  expect(event.choices[0].seconds).toBe(20);
  expect(event.choices[0].detail).not.toContain('负重');
  const repaired=applyCharacterEvent(s,'tourist-wheel','changed label','repair');
  const dragging=applyCharacterEvent(s,'tourist-wheel','changed label','drag');
  expect(repaired.characterTime!.energy).toBe(s.characterTime!.energy);
  expect(repaired.characterTime!.load).toBe(s.characterTime!.load);
  expect(dragging.characterTime!.energy).toBe(s.characterTime!.energy);
  expect(dragging.characterTime!.fatigue).toBe(s.characterTime!.fatigue);
  expect(dragging.characterTime!.wheelDamaged).toBe(true);
  expect(characterMovementFactor(dragging)).toBeCloseTo(characterMovementFactor(repaired)*TOURIST_WHEEL_RULES.speedMultiplier,10);
  const healthy={...repaired.characterTime!,energy:20},damaged={...dragging.characterTime!,energy:20};
  expect(tickCharacterResources(healthy,1,true).energy-tickCharacterResources(damaged,1,true).energy).toBeCloseTo(1,10);
  expect(tickCharacterResources(healthy,1,false).energy).toBe(tickCharacterResources(damaged,1,false).energy);
  const fixed=applyCharacterEvent(dragging,'tourist-wheel','停下来调整轮子');
  expect(fixed.characterTime!.wheelDamaged).toBe(false);
 });
 it('wheel choice applies its canonical cost once and holds the penalty through later walking',()=>{
  const base=station('tourist'),s={...base,event:characterEventPrompt(base,'tourist-wheel')!};
  const repair=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});
  const drag=reducer(s,{type:'CHOICE',choice:s.event!.choices[1]});
  expect(repair.remaining).toBe(s.remaining-20);
  expect(drag.remaining).toBe(s.remaining);
  expect(drag.characterTime!.wheelDamaged).toBe(true);
  expect(reducer(drag,{type:'CHOICE',choice:s.event!.choices[1]})).toEqual(drag);
 });
 it.each([0,58,60])('the salary answer at %s energy restores within capacity and shows actual deltas',energy=>{
  const base=station('worker'),s={...base,characterTime:{...base.characterTime!,energy,focus:3}};
  const event=refreshCharacterPrompt(s.characterTime!,stationChallenge(s,'zz-hometown-answer')!);
  const low=event.choices.find(c=>c.id==='low-salary')!;
  expect(low.detail).toContain('专注 −3');
  expect(low.detail).toContain(`精力 +${Math.min(5,60-energy)}`);
  const n=applyCharacterEvent(s,event.id,'renamed',low.id);
  expect(n.characterTime!.energy).toBe(Math.min(60,energy+5));
  expect(n.characterTime!.maxEnergy).toBe(60);
  expect(n.characterTime!.focus).toBe(0);
 });
 it('shared lift and stairs advertise the current resource boundary, preserving cost and route',()=>{
  const base=station('tourist'),s={...base,characterTime:{...base.characterTime!,energy:34}};
  const lift=refreshCharacterPrompt(s.characterTime!,stationChallenge(s,'gz-lift')!);
  expect(lift.choices[0].id).toBe('lift');
  expect(lift.choices[0].detail).toContain('精力 +1');
  expect(lift.choices[0].seconds).toBe(45);
  expect(lift.choices[0].stationDecision!.value).toBe('lift');
  const recovered=applyCharacterEvent(s,'gz-lift','renamed','lift');
  expect(recovered.characterTime!.energy).toBe(35);
  expect(recovered.characterTime!.maxEnergy).toBe(35);
  const empty={...s,characterTime:{...s.characterTime!,energy:3}};
  const stairs=refreshCharacterPrompt(empty.characterTime!,lift).choices[1];
  expect(stairs.detail).toContain('精力 −3');
  expect(applyCharacterEvent(empty,'gz-lift','renamed','stairs').characterTime!.energy).toBe(0);
 });
 it('event recovery clears exhaustion at ten energy without resuming sprint automatically',()=>{
  const base=station('worker'),s={...base,characterTime:{...base.characterTime!,energy:0,exhausted:true,sprinting:false}};
  const small=applyCharacterEvent(s,'zz-hometown-answer','说工资 5000');
  expect(small.characterTime!.energy).toBe(5);
  expect(small.characterTime!.exhausted).toBe(true);
  const recovered=applyCharacterEvent(s,'gz-lift','等电梯，恢复体力');
  expect(recovered.characterTime!.energy).toBe(25);
  expect(recovered.characterTime!.exhausted).toBe(false);
  expect(recovered.characterTime!.sprinting).toBe(false);
  const drained=applyCharacterEvent({...s,characterTime:{...s.characterTime!,energy:12,exhausted:false,sprinting:true}},'vertical-choice','走楼梯');
  expect(drained.characterTime!.energy).toBe(0);
  expect(drained.characterTime!.exhausted).toBe(true);
  expect(drained.characterTime!.sprinting).toBe(false);
  const preparationRecovery=applyTimedChoice({...s,phase:'preparation',characterTime:{...s.characterTime!,prepStep:1}},'eat');
  expect(preparationRecovery.characterTime!.energy).toBe(10);
  expect(preparationRecovery.characterTime!.exhausted).toBe(false);
 });
});
