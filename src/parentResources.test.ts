import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {applyParentChoice,canParentSprint,createParentState,parentBlockPrompt,parentMovementFactor,parentStationPrompt,refreshParentPrompt,type ParentState} from './parent';
import {buildStationJourney,journeyPrompt} from './stationJourney';

function state(changes:Partial<ParentState>={}):ParentState{return {...createParentState(()=>.5),toilet:10,...changes};}
function apply(p:ParentState,eventId:string,id:string,seconds=0){return applyParentChoice(p,eventId,'修改后的文案',seconds,id);}
function stationEvent(city:string,id:string,changes:Partial<ParentState>={}):Run{
 const base=createCharacterStationRun(city,'mom',false,()=>.5);
 const stationJourney=buildStationJourney(base),stationBeat=stationJourney.findIndex(b=>b.id===id);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 const run:Run={...base,phase:'station',stationJourney,stationBeat,parent:state(changes)};
 return {...run,event:journeyPrompt(run)};
}

describe('家长资源恢复、消耗和动态提示',()=>{
 it.each([
  ['parent-tired','rest',7],['parent-patience','rest',5],['hz-parent-lift','right',5],['gz-lift','lift',25]
 ] as const)('%s 恢复精力始终遵守人物上限', (eventId,id,nominal)=>{
  for(const energy of [0,40,69,70]){
   const p=state({energy,exhausted:energy===0}),next=apply(p,eventId,id);
   expect(next.energy).toBe(Math.min(70,energy+nominal));
   expect(next.maxEnergy).toBe(70);
  }
 });
 it('广州楼梯兑现精力消耗，下限为零且立即影响冲刺资格',()=>{
  for(const energy of [0,10,22,70]){
   const p=state({energy}),next=apply(p,'gz-lift','stairs');
   expect(next.energy).toBe(Math.max(0,energy-22));
   expect(next.exhausted).toBe(energy<=22);
   expect(canParentSprint(next)).toBe(energy>22);
  }
 });
 it('电梯恢复会改变后续移动，并按既有阈值解除疲惫',()=>{
  const empty=state({energy:0,exhausted:true});
  const rested=apply(empty,'gz-lift','lift');
  expect(canParentSprint(rested)).toBe(true);
  expect(parentMovementFactor(rested)).toBeGreaterThan(parentMovementFactor(empty));
  expect(apply(empty,'parent-patience','rest').exhausted).toBe(true);
 });
 it('资源提示取实际增量；满值不再承诺固定恢复',()=>{
  for(const energy of [0,40,69,70]){
   const run=stationEvent('guangzhou','gz-lift',{energy});
   const lift=run.event!.choices.find(c=>c.id==='lift')!;
   expect(lift.detail).toContain(`家长精力 +${Math.min(25,70-energy)}`);
   if(energy===70)expect(lift.detail).toContain('已满，无恢复收益');
   const stairs=run.event!.choices.find(c=>c.id==='stairs')!;
   expect(stairs.detail).toContain(`家长精力 ${energy?'−':'+'}${Math.min(22,energy)}`);
  }
 });
 it('家长休息同时显示各资源实际恢复，保留固定成本',()=>{
  const p=state({energy:69,childEnergy:17,patience:99});
  const event=parentBlockPrompt(p)!;
  expect(event.id).toBe('parent-tired');
  const c=event.choices.find(c=>c.id==='rest')!,next=apply(p,event.id,c.id!,c.seconds);
  expect(c.detail).toContain('−30 秒');
  expect(c.detail).toContain('家长精力 +1');
  expect(c.detail).toContain('孩子体力 +36');
  expect(c.detail).toContain('耐心 +1');
  expect(next.energy).toBe(70);expect(next.childEnergy).toBe(53);expect(next.patience).toBe(100);
  expect(next.childDelaySeconds-p.childDelaySeconds).toBe(30);
 });
 it('耐心恢复不会把已有耐心重置为更低的固定值',()=>{
  for(const patience of [0,70,99,100])for(const id of ['snack','comfort','rest']){
   const nominal=id==='snack'?42:id==='comfort'?26:32;
   const next=apply(state({patience,snacks:1,load:32}),'parent-patience',id);
   expect(next.patience).toBe(Math.min(100,patience+nominal));
   expect(next.snacks).toBe(id==='snack'?0:1);
  }
 });
 it('杭州电梯、通用换层和饮水如实显示隐藏的资源得失',()=>{
  const hz=stationEvent('hangzhou','hz-parent-lift',{energy:69,childEnergy:99});
  expect(hz.event!.choices[0].detail).toContain('家长精力 +1');
  expect(hz.event!.choices[0].detail).toContain('孩子体力 +1');
  const wh=stationEvent('wuhan','vertical-choice',{childEnergy:99,patience:3});
  const lift=wh.event!.choices.find(c=>c.id==='lift')!;
  expect(lift.detail).toContain('孩子体力 +1');expect(lift.detail).toContain('耐心 −3');
  const water=stationEvent('shanghai','sh-parent-shop',{patience:98,toilet:99}).event!.choices[0];
  expect(water.detail).toContain('耐心 +2');expect(water.detail).toContain('饮水尿意 +1');
 });
 it('动态刷新只更新选项信息，不改变进行中的事件或资源',()=>{
  const p=state({energy:50,childEnergy:17,patience:0,snacks:1});
  const original=parentBlockPrompt(p)!,snapshot=structuredClone(p);
  const recovered={...p,energy:70,childEnergy:19};
  const refreshed=refreshParentPrompt(recovered,original);
  expect(p).toEqual(snapshot);expect(refreshed.id).toBe('parent-tired');
  expect(refreshed.choices.find(c=>c.id==='rest')!.detail).toContain('家长精力 +0（已满，无恢复收益）');
  expect(apply(recovered,'parent-tired','walk').childEnergy).toBe(19);
  expect(refreshed.choices.map(c=>c.seconds)).toEqual(original.choices.map(c=>c.seconds));
 });
 it('恢复之外的必经选择也修正历史超上限资源，避免保留隐性加速',()=>{
  expect(apply(state({energy:90}),'bj-parent-strict','prepared').energy).toBe(70);
 });
 it('零食和周黑鸭的后续效果有消费者，已买后的继续选项不扣耐心',()=>{
  const p=state({patience:0,snacks:1,load:32}),comforted=apply(p,'parent-patience','snack');
  expect(comforted.snacks).toBe(0);expect(comforted.load).toBe(30);expect(comforted.snacksUsed).toBe(1);
  expect(parentBlockPrompt({...comforted,blockCooldown:0})).toBeNull();
  const bought=apply(state({patience:98}),'wh-parent-duck','buy');
  expect(bought.patience).toBe(100);expect(bought.duckBought).toBe(true);
  expect(apply(bought,'wh-parent-duck-repeat','continue').patience).toBe(100);
 });
 it('广州家长选项从真实事件进入引擎，时间和资源只结算一次',()=>{
  for(const id of ['lift','stairs']){
   const run=stationEvent('guangzhou','gz-lift',{energy:40});
   const c=run.event!.choices.find(c=>c.id===id)!,next=reducer(run,{type:'CHOICE',choice:c});
   expect(next.parent!.energy).toBe(id==='lift'?65:18);
   expect(run.remaining-next.remaining).toBe(id==='lift'?45:12);
   expect(next.parent!.toilet-run.parent!.toilet).toBeCloseTo(c.seconds/60*4);
   expect(next.stationDecisions.at(-1)?.value).toBe(id);
   const duplicate=reducer(next,{type:'CHOICE',choice:c});
   expect(duplicate.parent!.energy).toBe(next.parent!.energy);expect(duplicate.remaining).toBe(next.remaining);
  }
 });
 it('新的稳定选项 ID 独立于展示文案，旧选项标签仍兼容',()=>{
  const p=state({energy:40});
  expect(apply(p,'hz-parent-lift','right').energy).toBe(45);
  expect(applyParentChoice(p,'hz-parent-lift','去右侧可靠的电梯',18).energy).toBe(45);
  const base=stationEvent('wuhan','vertical-choice');
  expect(parentStationPrompt(base,'vertical-choice')!.choices.every(c=>!!c.id)).toBe(true);
 });
});
