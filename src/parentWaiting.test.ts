import {describe,it,expect} from 'vitest';
import {advanceParentWait,applyParentChoice,createParentState,parentBlockPrompt,parentStationPrompt,parentWaitOverrides,tickParent,type ParentState} from './parent';
import {createCharacterStationRun} from './engine';
import type {Choice} from './data';

const parent=(changes:Partial<ParentState>={}):ParentState=>({...createParentState(()=>.5),energy:10,childEnergy:50,childEnergyMin:50,patience:60,patienceMin:60,toilet:20,...changes});
const option=(id:string,seconds=0):Choice=>({id,label:'更新后的文案',detail:'',seconds});
describe('家长等待资源按游戏秒独立结算',()=>{
 it('55 秒固定等待与相同时间逐步等待使用同一资源速率',()=>{
  const p=parent(),instant=advanceParentWait(p,'station',55);
  let gradual=p;for(let i=0;i<550;i++)gradual=advanceParentWait(gradual,'station',.1);
  expect(instant.energy).toBe(70);expect(instant.childEnergy).toBeCloseTo(51.1);expect(instant.patience).toBeCloseTo(56.975);
  for(const key of ['energy','childEnergy','patience','childEnergyMin','patienceMin'] as const)expect(gradual[key]).toBeCloseTo(instant[key]);
 });
 it('地铁等待继承站外耐心速率，抱着时孩子恢复更快',()=>{
  const p=parent({carrying:true}),n=advanceParentWait(p,'metro',60);
  expect(n.energy).toBe(70);expect(n.childEnergy).toBeCloseTo(63.2);expect(n.patience).toBeCloseTo(58.92);
 });
 it('等待不改变尿意、同步窗口、缓冲、距离或移动统计',()=>{
  const p=parent({carrying:true,gap:4,syncUsed:true,syncRemaining:8,blockCooldown:3,carriedSeconds:12,syncSprintSaved:5,toilet:79});
  const n=advanceParentWait(p,'station',75);
  for(const key of Object.keys(p) as (keyof ParentState)[]){
   if(!['energy','childEnergy','patience','exhausted','childEnergyMin','patienceMin'].includes(key))expect(n[key],key).toEqual(p[key]);
  }
 });
 it('等待遵守上下限、最低记录及既有耗尽解除阈值',()=>{
  const empty=parent({energy:0,exhausted:true,childEnergy:99.9,patience:.01,patienceMin:.01});
  const early=advanceParentWait(empty,'station',10),recovered=advanceParentWait(empty,'station',11);
  expect(early.energy).toBe(11.5);expect(early.exhausted).toBe(true);
  expect(recovered.exhausted).toBe(false);expect(recovered.sprinting).toBe(false);
  expect(recovered.childEnergy).toBe(100);expect(recovered.patience).toBe(0);expect(recovered.patienceMin).toBe(0);
  const full=advanceParentWait(parent({energy:70,childEnergy:100,patience:0}),'station',600);
  expect(full.energy).toBe(70);expect(full.childEnergy).toBe(100);expect(full.patience).toBe(0);
 });
 it('整段休息的三项任务效果替代同字段自然等待，避免重复奖励',()=>{
  const p=parent({childEnergy:10,patience:20}),c=option('rest',30),excluded=parentWaitOverrides('parent-tired',c);
  expect(excluded).toEqual(['energy','childEnergy','patience']);
  const waited=advanceParentWait(p,'station',c.seconds,excluded);
  const n=applyParentChoice(waited,'parent-tired',c.label,c.seconds,c.id);
  expect(n.energy).toBe(17);expect(n.childEnergy).toBe(46);expect(n.patience).toBe(28);
 });
 it('电梯只覆盖已声明精力恢复，其余等待资源仍推进',()=>{
  const p=parent(),c=option('lift',45),waited=advanceParentWait(p,'station',45,parentWaitOverrides('gz-lift',c));
  const n=applyParentChoice(waited,'gz-lift',c.label,c.seconds,c.id);
  expect(n.energy).toBe(35);expect(n.childEnergy).toBeCloseTo(50.9);expect(n.patience).toBeCloseTo(57.525);
 });
 it('安慰、饮水、库存只覆盖明确的等待资源，不包含生理或库存字段',()=>{
  expect(parentWaitOverrides('parent-patience',option('comfort',12))).toEqual(['patience']);
  expect(parentWaitOverrides('parent-patience',option('snack',5))).toEqual(['patience']);
  expect(parentWaitOverrides('sh-parent-shop',option('water',3))).toEqual(['patience']);
  expect(parentWaitOverrides('vertical-choice',option('lift',38))).toEqual(['childEnergy','patience']);
  expect(parentWaitOverrides('security-queue',option('a',24))).toEqual([]);
  expect(parentWaitOverrides('parent-tired',{label:'坐下休息一下',detail:'',seconds:30})).toEqual(['energy','childEnergy','patience']);
 });
 it('关闭逐帧被动结算仍推进真实同步/缓冲时间，且不重复恢复',()=>{
  const p=parent({syncRemaining:8,blockCooldown:3}),raw=tickParent(p,'station',2,0,false,false);
  expect(raw.energy).toBe(p.energy);expect(raw.childEnergy).toBe(p.childEnergy);expect(raw.patience).toBe(p.patience);
  expect(raw.syncRemaining).toBe(6);expect(raw.blockCooldown).toBe(1);
  const centralized=advanceParentWait(raw,'station',2),legacy=tickParent(p,'station',2,0,false);
  expect(centralized).toEqual(legacy);
 });
 it.each([false,true])('关闭逐帧被动结算不改变正在移动的资源，冲刺=%s',sprinting=>{
  const p=parent({sprinting,energy:50});
  expect(tickParent(p,'station',.1,0,true,false)).toEqual(tickParent(p,'station',.1,0,true));
 });
 it('普通点击完成等待/安慰，真正的抱起按住操作继续保留',()=>{
  for(const p of [parent({gap:8}),parent({patience:0})]){
   const event=parentBlockPrompt(p)!;
   expect(event.interaction?.kind).toBe('choice');
   const c=event.choices.find(c=>c.id===(event.id==='parent-gap'?'wait':'comfort'))!;
   expect(c.detail).toContain('点击选择');expect(c.detail).not.toContain('按住');
   expect(c.seconds).toBe(event.id==='parent-gap'?8:12);
  }
  const run=createCharacterStationRun('guangzhou','mom',false,()=>.5),carry=parentStationPrompt(run,'gz-parent-carry')!;
  expect(carry.interaction?.kind).toBe('hold');expect(carry.choices[0].detail).toContain('按住抱起');
 });
 it('无有效时间不增加资源，也不更改状态',()=>{
  const p=parent();for(const seconds of [0,-1,NaN,Infinity])expect(advanceParentWait(p,'station',seconds)).toBe(p);
 });
});
