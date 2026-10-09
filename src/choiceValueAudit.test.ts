import {describe,it,expect} from 'vitest';
import {simulateBalance} from '../scripts/simulateBalance';

describe('paired choice analysis driver',()=>{
 it('exercises both stages of the salary conversation instead of assuming a choice changed',()=>{
  const seen:string[]=[];
  const base=simulateBalance({city:'zhengzhou',character:'worker',reference:true,seed:921});
  const truth=simulateBalance({city:'zhengzhou',character:'worker',reference:true,seed:921,choose:(_s,e)=>{
   const label=e.id==='zz-hometown'?'告诉他':e.id==='zz-hometown-answer'?'说真话':null;
   if(label){seen.push(e.id);return e.choices.find(c=>c.label===label);}
  }});
  expect(seen).toEqual(['zz-hometown','zz-hometown-answer']);
  expect(truth.success).toBe(true);
  expect(truth.characterTime!.focus).toBe(base.characterTime!.focus-10);
  expect(truth.initial-truth.remaining).toBeLessThan(base.initial-base.remaining);
 });
 it('can compare staying awake with the existing sleep shortcut, with both clocks reconciled',()=>{
  for(const awake of [false,true]){
   const run=simulateBalance({city:'shanghai',character:'tourist',reference:true,seed:921,choose:awake?(_s,e)=>e.id==='tourist-sleep'?e.choices.find(c=>c.label.includes('撑着')):undefined:undefined});
   expect(run.characterTime!.slept).toBe(!awake);
   expect(run.success).toBe(true);
   expect(run.timeLedger.totalSeconds).toBeCloseTo(run.initial-run.remaining,6);
  }
 });
 it('rejects fabricated options and restores randomness when a scenario is invalid',()=>{
  const random=Math.random;
  expect(()=>simulateBalance({city:'hangzhou',reference:true,choose:()=>({label:'invented',detail:'',seconds:0})})).toThrow('Scenario choice must belong');
  expect(Math.random).toBe(random);
 });
});
