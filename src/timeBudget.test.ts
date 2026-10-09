import {describe,expect,it} from 'vitest';
import {buildTimeBudget,type TimeBudgetInput} from './timeBudget';

const input:TimeBudgetInput={metroSeconds:1120,stationWalkSeconds:432,legacyAllowanceSeconds:210,hardReductionSeconds:0,gateClosingLeadSeconds:180};

describe('opening countdown budget',()=>{
 it('accounts for every second without counting the gate-closing lead as play time',()=>{
  const budget=buildTimeBudget(input);
  expect(budget.roundingAdjustmentSeconds).toBe(8);
  expect(budget.gateBudgetSeconds).toBe(1770);
  expect(budget.departureBudgetSeconds).toBe(1950);
  expect(budget.metroSeconds+budget.stationWalkSeconds+budget.legacyAllowanceSeconds+budget.roundingAdjustmentSeconds-budget.hardReductionSeconds).toBe(budget.gateBudgetSeconds);
  expect(budget.departureBudgetSeconds-budget.gateClosingLeadSeconds).toBe(budget.gateBudgetSeconds);
 });

 it('applies hard reduction after rounding, preserving the parent 75-second reduction',()=>{
  const normal=buildTimeBudget({...input,metroSeconds:1130.212765957447,stationWalkSeconds:440.81632653061223,legacyAllowanceSeconds:280});
  const hard=buildTimeBudget({...input,metroSeconds:1130.212765957447,stationWalkSeconds:440.81632653061223,legacyAllowanceSeconds:280,hardReductionSeconds:75});
  expect(normal.gateBudgetSeconds).toBe(1860);
  expect(hard.gateBudgetSeconds).toBe(1785);
  expect(normal.departureBudgetSeconds-hard.departureBudgetSeconds).toBe(75);
  expect(hard.roundingAdjustmentSeconds).toBe(normal.roundingAdjustmentSeconds);
 });

 it('keeps unknown mandatory, environmental and error allowances explicit instead of labelling the whole buffer as tolerance',()=>{
  const budget=buildTimeBudget(input);
  expect(budget.legacyAllowanceSeconds).toBe(210);
  expect(budget.calibration).toEqual({status:'legacy-unallocated',mandatoryInteractionSeconds:null,expectedEnvironmentSeconds:null,errorBudgetSeconds:null});
 });

 it('does not add rounding slack when the raw budget already meets the rounding boundary',()=>{
  const budget=buildTimeBudget({...input,metroSeconds:1000,stationWalkSeconds:350,legacyAllowanceSeconds:150});
  expect(budget.roundingAdjustmentSeconds).toBe(0);
  expect(budget.gateBudgetSeconds).toBe(1500);
 });

 it.each([
  {metroSeconds:NaN},
  {stationWalkSeconds:Infinity},
  {legacyAllowanceSeconds:-1},
  {roundingSeconds:0},
  {hardReductionSeconds:2000},
 ])('rejects invalid configuration without hiding it through clamping: %j',override=>{
  expect(()=>buildTimeBudget({...input,...override})).toThrow(RangeError);
 });
});
