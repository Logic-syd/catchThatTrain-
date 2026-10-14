import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {applyParentChoice,applyParentPreparation,canParentSprint,createParentState,parentBlockPrompt,parentToiletAfter} from './parent';
function base():Run{
 const b=createCharacterStationRun('shanghai','mom',false,()=>.5);
 return {...b,phase:'station',remaining:1800,stationRunning:true,stationJourney:[{id:'gate-scan',stage:4,label:'检票入口',seconds:100}],parent:{...b.parent!,toilet:20,energy:40,runner:{...b.parent!.runner,lane:0,wave:99}}};
}
describe('孩子尿意按全部实际游戏扣时结算一次',()=>{
 it('走路、停步、阅读仍使用原来的时间倍率',()=>{
  const s=base();for(const variant of [s,{...s,stationRunning:false},{...s,event:{id:'test',phase:'station' as const,title:'阅读',description:'',choices:[]}}]){
   const n=reducer(variant,{type:'TICK',dt:.2});expect(n.parent!.toilet-variant.parent!.toilet).toBeCloseTo((variant.remaining-n.remaining)/60*4);
  }
 });
 it('瞬时处罚推进尿意但不虚构移动、恢复、冲刺或同步时间',()=>{
  const s=base();s.parent={...s.parent!,sprinting:true,syncRemaining:12};
  const n=reducer(s,{type:'PENALTY',seconds:60,title:'等待'});
  expect(n.parent!.toilet).toBeCloseTo(24);expect(n.parent!.energy).toBe(40);expect(n.parent!.childEnergy).toBe(s.parent.childEnergy);expect(n.parent!.gap).toBe(0);expect(n.parent!.syncRemaining).toBe(12);expect(n.parent!.syncSprintSaved).toBe(0);
  expect(reducer(n,{type:'TICK',dt:.1}).parent!.toilet).toBeCloseTo(24+.4/60*4);
 });
 it('准备去厕所按完成时归零，重复选择不再扣时',()=>{
  let s=reducer(createCharacterStationRun('shanghai','mom',false,()=>.5),{type:'START'});
  s=reducer(s,{type:'PARENT_PREP',option:'toilet-first',step:0});expect(s.parent!.toilet).toBe(0);
  expect(reducer(s,{type:'PARENT_PREP',option:'toilet-first',step:0})).toBe(s);
 });
 it('站内选择固定成本和饮水额外尿意各计算一次',()=>{
  const s=base();s.stationJourney=buildStationJourney(s);s.stationBeat=s.stationJourney.findIndex(b=>b.id==='sh-parent-shop');s.event=journeyPrompt(s);
  const c=s.event!.choices[0],n=reducer(s,{type:'CHOICE',choice:c});
  expect(n.parent!.toilet).toBeCloseTo(20+c.seconds/60*4+6);
  const duplicate=reducer(n,{type:'CHOICE',choice:c});expect(duplicate.remaining).toBe(n.remaining);expect(duplicate.parent!.toilet).toBe(n.parent!.toilet);
 });
 it('尿急跨阈值立即解除冲刺且下一时间片按步行',()=>{
  const s=base();s.parent={...s.parent!,toilet:79,sprinting:true};
  const n=reducer(s,{type:'PENALTY',seconds:15,title:'绕行'});expect(n.parent!.toilet).toBe(80);expect(n.parent!.sprinting).toBe(false);
  const walk=reducer(n,{type:'TICK',dt:.1});expect(walk.parent!.energy).toBeGreaterThan(n.parent!.energy);expect(walk.stationProgress).toBeGreaterThan(n.stationProgress);
 });
 it('到95的时间片仍立即触发厕所阻挡',()=>{
  const s=base();s.parent={...s.parent!,toilet:94.99};const n=reducer(s,{type:'TICK',dt:.1});expect(n.event?.id).toBe('parent-toilet');expect(n.parent!.toilet).toBeCloseTo(94.99+.4/60*4);
 });
 it('地铁事件阅读及处罚按地铁尿意速率计入',()=>{
  const s={...base(),phase:'metro' as const,event:{id:'test',phase:'metro' as const,title:'阅读',description:'',interaction:{kind:'tap' as const,seconds:100,penalty:15},choices:[]}};
  const read=reducer(s,{type:'TICK',dt:2});expect(read.parent!.toilet).toBeCloseTo(20+2/60*2.5);
  expect(reducer(read,{type:'PENALTY',seconds:80,title:'折返'}).parent!.toilet).toBeCloseTo(20+82/60*2.5);
 });
 it('厕所处理和意外归位发生在费用时间之后',()=>{
  let s=base();s.parent={...s.parent!,toilet:95};s=reducer(s,{type:'TICK',dt:.1});s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.parent!.toilet).toBe(0);
  s={...base(),parent:{...base().parent!,toilet:100}};s=reducer(s,{type:'TICK',dt:.1});expect(s.event!.id).toBe('parent-accident');s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.parent!.toilet).toBe(50);
 });
 it('地铁到站截断时也按全部实际扣时结算，不漏剩余读秒',()=>{
  const b=base(),route=b.city.spawnStations[b.spawn].routes[0];
  const s:Run={...b,phase:'metro',route,metroDuration:600,metroIncident:null,metroProgress:1/(route.stops.length-1)-.00001};
  const n=reducer(s,{type:'TICK',dt:1});expect(n.phase).toBe('arrival');
  expect(n.parent!.toilet-s.parent!.toilet).toBeCloseTo((s.remaining-n.remaining)/60*2.5);
 });
 it('事件超时额外罚时只推进一次；后续读题不重复处罚',()=>{
  const s:Run={...base(),event:{id:'test',phase:'station',title:'操作',description:'',interaction:{kind:'tap',seconds:.9,penalty:15},choices:[]}};
  const overdue=reducer(s,{type:'TICK',dt:1});expect(s.remaining-overdue.remaining).toBeCloseTo(16);expect(overdue.parent!.toilet).toBeCloseTo(20+16/60*4);
  const read=reducer(overdue,{type:'TICK',dt:1});expect(overdue.remaining-read.remaining).toBeCloseTo(1);expect(read.parent!.toilet).toBeCloseTo(20+17/60*4);
 });
 it('大步延迟与小步序列跨尿急阈值的状态和账本保持一致',()=>{
  const s=base();s.parent={...s.parent!,toilet:79.99,sprinting:true,syncRemaining:12};
  const delayed=reducer(s,{type:'TICK',dt:1});let regular=s;for(let i=0;i<10;i++)regular=reducer(regular,{type:'TICK',dt:.1});
  expect(delayed.parent).toEqual(regular.parent);expect(delayed.remaining).toBeCloseTo(regular.remaining);expect(delayed.stationProgress).toBeCloseTo(regular.stationProgress);expect(delayed.metrics).toEqual(regular.metrics);
 });
 it('失败时仍结算已经扣掉的时间，尿意不超过100',()=>{
  const s=base();s.remaining=185;s.parent={...s.parent!,toilet:99};
  const n=reducer(s,{type:'PENALTY',seconds:20,title:'等待'});expect(n.phase).toBe('result');expect(n.parent!.toilet).toBe(100);
 });

});

describe('准备如厕后的站内尿意增长留出照顾收益',()=>{
 it.each([['station',24],['metro',22.5],['preparation',20.45],['arrival',20.45],['transfer',20.45],['metro-recovery',20.45]] as const)('%s 的一分钟保持自己的速率', (phase,expected)=>{
  expect(parentToiletAfter(20,phase,60)).toBeCloseTo(expected);
  expect(parentToiletAfter(99.99,phase,60)).toBe(100);
 });
 it('同样18分钟地铁和10分钟站内，准备后可免一次厕所，但仍受80尿急禁冲限制',()=>{
  const initial=createParentState(()=>.5),prepared=applyParentPreparation(initial,'toilet-first')!;
  const preparedAfter={...prepared,toilet:parentToiletAfter(parentToiletAfter(prepared.toilet,'metro',18*60),'station',10*60)};
  expect(preparedAfter.toilet).toBe(85);expect(parentBlockPrompt(preparedAfter)).toBeNull();expect(canParentSprint(preparedAfter)).toBe(false);
  const unpreparedEntry={...initial,toilet:parentToiletAfter(initial.toilet,'metro',18*60)};
  expect(unpreparedEntry.toilet).toBe(88);
  const urgent={...unpreparedEntry,toilet:parentToiletAfter(unpreparedEntry.toilet,'station',105)};
  const event=parentBlockPrompt(urgent)!;expect(event.id).toBe('parent-toilet');
  const choice=event.choices.find(c=>c.id==='toilet')!;
  const waited={...urgent,toilet:parentToiletAfter(urgent.toilet,'station',choice.seconds)};
  const cared=applyParentChoice(waited,event.id,choice.label,choice.seconds,choice.id);
  expect(cared.toilet).toBe(0);expect(cared.toiletVisits).toBe(1);expect(cared.childDelaySeconds).toBe(75);
  expect(canParentSprint(cared)).toBe(true);
 });
});
