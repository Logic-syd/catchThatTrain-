import {describe,it,expect} from 'vitest';
import {BALANCE} from './balanceConfig';
import {NORMAL_REFERENCE} from './referenceBudgets';
import {buildReferenceTimeBudget} from './timeBudget';
import {createCharacterStationRun,reducer,STOP_BEFORE} from './engine';
import referenceReport from '../docs/design/reference-time-report.json';
import {simulateBalance} from '../scripts/simulateBalance';

const roles=['student','worker','tourist','mom'] as const;
describe('mistake allowance replaces role penalty multipliers',()=>{
 it('uses the frozen 24 full-route measurements once, without old buffers, post-gate travel or another environment allowance',()=>{
  expect(BALANCE.errorBudgetSeconds).toEqual({student:240,worker:180,tourist:135,mom:90});
  expect(BALANCE).not.toHaveProperty('navigationMistakeMultiplier');
  for(const role of roles)for(const [city,ref] of Object.entries(NORMAL_REFERENCE[role])){
   const measured=referenceReport.groups.find(g=>g.character===role&&g.station===city)!;
   expect(measured).toBeDefined();
   const sum=Object.values(ref).reduce((a,b)=>a+b,0);
   expect(Math.abs(sum-measured.normalWithEnvironment)).toBeLessThan(.025);
   const run=createCharacterStationRun(city,role),budget=run.timeBudget!;
   const slack=run.initial-STOP_BEFORE-sum;
   expect(slack).toBeGreaterThanOrEqual(BALANCE.errorBudgetSeconds[role]-.000001);
   expect(slack).toBeLessThan(BALANCE.errorBudgetSeconds[role]+1);
   expect(budget.legacyAllowanceSeconds).toBe(0);
   expect(budget.calibration.expectedEnvironmentSeconds).toBe(measured.environment);
   expect(budget.roundingSeconds).toBe(1);
   expect(budget.departureBudgetSeconds-budget.gateBudgetSeconds).toBe(STOP_BEFORE);
  }
 });
 it('keeps the existing hard-mode reduction separate from the normal mistake allowance',()=>{
  for(const role of roles)for(const city of Object.keys(NORMAL_REFERENCE[role])){
   const normal=buildReferenceTimeBudget(city,role,false,180),hard=buildReferenceTimeBudget(city,role,true,180);
   expect(normal.gateBudgetSeconds-hard.gateBudgetSeconds).toBe(BALANCE.hardReduction[role]);
   expect(hard.calibration).toEqual(normal.calibration);
  }
 });
 it('equal extra lost seconds consume progressively smaller remaining margins',()=>{
  const counts=roles.map(role=>{
   const run=createCharacterStationRun('hangzhou',role);
   const r=NORMAL_REFERENCE[role].hangzhou;
   const normalCost=Object.values(r).reduce((a,b)=>a+b,0);
   let s=reducer(run,{type:'START'});
   // Fixed reference completion cost; no random, resource or route differences.
   s=reducer(s,{type:'PENALTY',title:'reference completion',seconds:normalCost});
   let count=0;
   while(s.phase!=='result'){
    const before=s.remaining;
    s=reducer(s,{type:'PENALTY',title:'same 60-second mistake',seconds:60});
    expect(before-s.remaining).toBeCloseTo(60,6);count++;
   }
   expect(s.timeLedger.totalSeconds).toBeCloseTo(normalCost+count*60,6);
   return count;
  });
  expect(counts).toEqual([5,4,3,2]);
 });
 it.each(roles)('%s completes declared reference play within the real deadline, without the measurement extension',role=>{
  for(const city of Object.keys(NORMAL_REFERENCE[role])){
   const run=simulateBalance({city,character:role,reference:true,budgetAdjustment:0,seed:921});
   expect(run.success,role+'/'+city).toBe(true);
   expect(run.initial).toBe(run.timeBudget!.departureBudgetSeconds);
   expect(run.gateRemaining).toBeGreaterThan(0);
   expect(run.timeLedger.totalSeconds).toBeCloseTo(run.initial-run.remaining,6);
  }
 });
 it('rejects absent reference data instead of silently inventing an opening budget',()=>{
  expect(()=>buildReferenceTimeBudget('unknown','student',false,180)).toThrow('Missing normal reference');
 });
});
