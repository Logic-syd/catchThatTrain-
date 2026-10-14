import type {Run} from './engine';
import type {EventConfig} from './data';
import {STUDENT} from './studentConfig';
import {refreshParentPrompt} from './parent';
import {refreshCharacterPrompt} from './characterTime';
import {waitingFeedback} from './waiting';
const amount=(n:number)=>Number(n.toFixed(1));
export function withActualEventCosts(s:Run,event:EventConfig):EventConfig{
 if(s.student&&['escalator-ride','escalator-operation'].includes(event.id)&&s.student.vertical==='escalator'){
  const remaining=Math.max(0,STUDENT.badLuckBudget-s.student.environmentLoss);
  event={...event,choices:event.choices.map(c=>c.seconds>remaining?{...c,seconds:remaining,waitSeconds:remaining,detail:`等待 ${remaining} 游戏秒 · 本局拥堵扣时已封顶`}:c)};
 }
 return event;
}
export function withResourceFeedback(s:Run,event:EventConfig):EventConfig{
 return waitingFeedback(s,baseResourceFeedback(s,withActualEventCosts(s,event)));
}
function baseResourceFeedback(s:Run,event:EventConfig):EventConfig{
 if(s.parent)return refreshParentPrompt(s.parent,event);
 if(s.characterTime)return refreshCharacterPrompt(s.characterTime,event);
 const u=s.student;if(!u)return event;
 const change=(delta:number)=>{
  const actual=Math.max(0,Math.min(u.stats.energy,u.stamina+delta))-u.stamina;
  return actual>0?`体力 +${amount(actual)}`:actual<0?`体力 −${amount(-actual)}`:u.stamina>=u.stats.energy?'体力无变化（已满）':'体力无变化';
 };
 const choices=event.choices.map(c=>{
  if(event.id==='gz-lift')return {...c,detail:`−${c.seconds} 秒 · ${change(c.stationDecision?.value==='stairs'?-22:25)}`};
  if(event.id==='student-breath')return {...c,detail:`−${c.seconds} 秒 · ${change(Math.max(0,65-u.stamina))}`};
  if(event.id==='escalator-ride'&&u.vertical==='stairs')return {...c,detail:`完成上楼 · ${change(-22)}`};
  return c;
 });
 return {...event,choices};
}
export type ResourceChanges=Record<string,{before:number;after:number}>;
function snapshot(s:Run):Record<string,number>{
 if(s.student){const u=s.student;return {happiness:u.happiness,morality:u.morality,energy:u.stamina,maxEnergy:u.stats.energy,agility:u.stats.agility,focus:u.stats.focus,load:u.stats.load};}
 if(s.characterTime){const t=s.characterTime;return {energy:t.energy,maxEnergy:t.maxEnergy,energyReserve:t.energyReserve??0,fatigue:t.fatigue,load:t.load,focus:t.focus};}
 if(s.parent){const p=s.parent;return {anger:p.anger,energy:p.energy,maxEnergy:p.maxEnergy,childEnergy:p.childEnergy,patience:p.patience,toilet:p.toilet,load:p.load,snacks:p.snacks,water:p.water};}
 return {};
}
export function resourceChanges(s:Run,n:Run):ResourceChanges{
 const before=snapshot(s),after=snapshot(n),changes:ResourceChanges={};
 for(const [key,value] of Object.entries(before))if(after[key]!==undefined&&Math.abs(after[key]-value)>1e-9)changes[key]={before:value,after:after[key]};
 return changes;
}
