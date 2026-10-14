import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,clockRate,type Run} from './engine';
import {parentMovementFactor,tickParent,PARENT_SPRINT} from './parent';
function station(character:'student'|'worker'|'tourist'|'mom'):Run{
 const base=createCharacterStationRun('shanghai',character,false,()=>.5);
 const s:Run={...base,phase:'station',remaining:1500,stationRunning:true,stationJourney:[{id:'gate-scan',stage:4,label:'检票入口',seconds:100}]};
 if(s.student)s.student={...s.student,stamina:30,runner:{...s.student.runner,lane:0,wave:99}};
 if(s.characterTime)s.characterTime={...s.characterTime,energy:20,runner:{...s.characterTime.runner,lane:0,wave:99}};
 if(s.parent)s.parent={...s.parent,energy:40,toilet:0,runner:{...s.parent.runner,lane:0,wave:99}};
 return s;
}
const actor=(s:Run)=>s.student??s.characterTime??s.parent!;
const energy=(s:Run)=>s.student?.stamina??s.characterTime?.energy??s.parent!.energy;
describe('统一人物冲刺状态',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s 仅实际移动冲刺耗体力，停止后不自动恢复冲刺',character=>{
  const base=station(character),s=reducer(base,{type:'SPRINT_INPUT',held:true});
  expect(actor(s).sprinting).toBe(true);
  const moving=reducer(s,{type:'TICK',dt:.2});expect(energy(moving)).toBeLessThan(energy(s));
  const stopped=reducer(moving,{type:'RUN_INPUT',held:false});expect(actor(stopped).sprinting).toBe(false);expect(clockRate(stopped)).toBe(1);
  const rested=reducer(stopped,{type:'TICK',dt:.2});expect(energy(rested)).toBeGreaterThan(energy(stopped));
  expect(actor(reducer(rested,{type:'RUN_INPUT',held:true})).sprinting).toBe(false);
  const released=reducer(moving,{type:'SPRINT_INPUT',held:false});expect(released.stationRunning).toBe(true);expect(actor(released).sprinting).toBe(false);
 });
 it.each(['student','worker','tourist','mom'] as const)('%s 到达事件立即清除冲刺，阅读时恢复体力',character=>{
  let s=reducer(station(character),{type:'SPRINT_INPUT',held:true});s={...s,stationProgress:.99999};
  const prompt=reducer(s,{type:'TICK',dt:.1});expect(prompt.event?.id).toBe('gate-scan');expect(actor(prompt).sprinting).toBe(false);expect(clockRate(prompt)).toBe(1);
  const reading=reducer(prompt,{type:'TICK',dt:.2});expect(energy(reading)).toBeGreaterThan(energy(prompt));
 });
 it.each(['student','worker','tourist','mom'] as const)('%s 碰撞不会保留冲刺或继续扣冲刺体力',character=>{
  let s=reducer(station(character),{type:'SPRINT_INPUT',held:true});
  if(s.student)s={...s,student:{...s.student,runner:{...s.student.runner,blocked:true}}};
  if(s.characterTime)s={...s,characterTime:{...s.characterTime,runner:{...s.characterTime.runner,blocked:true}}};
  if(s.parent)s={...s,parent:{...s.parent,runner:{...s.parent.runner,blocked:true}}};
  const n=reducer(s,{type:'TICK',dt:.2});expect(actor(n).sprinting).toBe(false);expect(n.stationProgress).toBe(s.stationProgress);expect(energy(n)).toBeGreaterThan(energy(s));expect(clockRate(n)).toBe(1);
 });
 it.each(['student','worker','tourist','mom'] as const)('%s 耗尽后拒绝冲刺输入，允许普通步行',character=>{
  let s=station(character);s.stationRunning=false;
  if(s.student)s.student={...s.student,stamina:0,exhausted:true};
  if(s.characterTime)s.characterTime={...s.characterTime,energy:0,exhausted:true};
  if(s.parent)s.parent={...s.parent,energy:0,exhausted:true};
  const denied=reducer(s,{type:'SPRINT_INPUT',held:true});expect(denied.stationRunning).toBe(false);expect(actor(denied).sprinting).toBe(false);
  const walking=reducer(reducer(denied,{type:'RUN_INPUT',held:true}),{type:'TICK',dt:.2});expect(walking.stationProgress).toBeGreaterThan(0);expect(clockRate(walking)).toBe(4);
 });
});
describe('家长冲刺成本与尿急限制',()=>{
 it.each([false,true])('降低加速并提高体力消耗，抱娃=%s',carrying=>{
  const p={...station('mom').parent!,carrying,sprinting:true};
  expect(parentMovementFactor(p,true)/parentMovementFactor(p,false)).toBeCloseTo(1.25);
  expect(tickParent(p,'station',1,4,true).energy).toBeCloseTo(p.energy-(carrying?8.5:6.5));
  const sync={...p,syncRemaining:12};expect(parentMovementFactor(sync,true)/parentMovementFactor(sync,false)).toBeCloseTo(1.4);
  expect(tickParent(sync,'station',1,4,true).syncSprintSaved).toBeCloseTo(1.6);
 });
 it.each([80,95,100])('尿意 %s 不可通过普通或同步冲刺绕过限制',toilet=>{
  const base=station('mom'),s={...base,remaining:290,stationRunning:false,parent:{...base.parent!,toilet,carrying:true}};
  const denied=reducer(s,{type:'SPRINT_INPUT',held:true});expect(denied.stationRunning).toBe(false);expect(denied.parent!.sprinting).toBe(false);
  expect(reducer(s,{type:'PARENT_SYNC'}).parent!.syncUsed).toBe(false);
  const p={...s.parent,sprinting:true,syncRemaining:12};expect(parentMovementFactor(p,true)).toBe(parentMovementFactor(p,false));expect(tickParent(p,'station',1,4,true).syncSprintSaved).toBe(0);
 });
 it('跨过预警阈值立即停止冲刺，下个时间片恢复步行且不增加同步收益',()=>{
  const base=station('mom'),s={...base,parent:{...base.parent!,toilet:PARENT_SPRINT.toiletThreshold-.01,sprinting:true,syncRemaining:12}};
  const urgent=reducer(s,{type:'TICK',dt:.1});expect(urgent.parent!.toilet).toBeGreaterThanOrEqual(80);expect(urgent.parent!.sprinting).toBe(false);
  const walking=reducer(urgent,{type:'TICK',dt:.1});expect(walking.stationProgress).toBeGreaterThan(urgent.stationProgress);expect(walking.parent!.energy).toBeGreaterThan(urgent.parent!.energy);expect(walking.parent!.syncSprintSaved).toBe(urgent.parent!.syncSprintSaved);
 });
 it('处理尿急后可以重新按住冲刺，不自动恢复旧状态',()=>{
  const base=station('mom');let s:Run={...base,parent:{...base.parent!,toilet:95,sprinting:true,blockCooldown:0}};
  s=reducer(s,{type:'TICK',dt:.1});expect(s.event?.id).toBe('parent-toilet');
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});expect(s.parent!.toilet).toBe(0);expect(s.parent!.sprinting).toBe(false);
  expect(reducer(s,{type:'SPRINT_INPUT',held:true}).parent!.sprinting).toBe(true);
 });
});
