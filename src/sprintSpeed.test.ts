import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer} from './engine';
import {movementFactor,studentSprintMultiplier} from './studentConfig';
import {characterMovementFactor} from './characterTime';
import {parentMovementFactor} from './parent';
import {maximumTravelFactor} from './raceForecast';

describe('controlled sprint speed',()=>{
 it('caps acceleration relative to each role walking in the same resource state',()=>{
  for(const [role,ratio] of [['student',1.5],['worker',1.4],['tourist',1.3],['mom',1.25]] as const){
   const s=createCharacterStationRun('hangzhou',role);
   const walk=s.parent?parentMovementFactor(s.parent,false):characterMovementFactor(s,false);
   const sprint=s.parent?parentMovementFactor(s.parent,true):characterMovementFactor(s,true);
   expect(sprint/walk).toBeCloseTo(ratio,8);
  }
 });
 it('keeps short bursts useful, gradually reduces gains after 3 seconds and caps the late boost',()=>{
  const u=createCharacterStationRun().student!;
  const values=[0,3,4,5,6,7].map(sprintStrain=>studentSprintMultiplier({...u,sprintStrain}));
  expect(values[0]).toBe(1.5);expect(values[1]).toBe(1.5);
  for(let i=2;i<values.length;i++)expect(values[i]).toBeLessThan(values[i-1]);
  expect(values.at(-1)).toBeCloseTo(1.15,8);
  expect(studentSprintMultiplier({...u,late:true,sprintStrain:0})).toBe(1.6);
  expect(studentSprintMultiplier({...u,late:true,sprintStrain:7})).toBeCloseTo(1.18,8);
  expect(studentSprintMultiplier({...u,sprintStrain:20})).toBeCloseTo(1.15,8);
 });
 it('tapping sprint repeatedly or briefly releasing does not reset accumulated strain',()=>{
  let s=createCharacterStationRun();s={...s,phase:'station',student:{...s.student!,sprintStrain:5},stationRunning:true};
  for(let i=0;i<10;i++){
   s=reducer(s,{type:'SPRINT_INPUT',held:false});s=reducer(s,{type:'SPRINT_INPUT',held:true});
  }
  expect(s.student!.sprintStrain).toBe(5);
  const slow=movementFactor(s.student!);
  s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});
  expect(s.student!.sprintStrain).toBeCloseTo(4.85,8);
  expect(movementFactor({...s.student!,sprinting:true})).toBeGreaterThan(slow);
  expect(studentSprintMultiplier(s.student!)).toBeLessThan(1.5);
 });
 it('the optimistic forecast uses fresh sprint capacity, not current fatigue from holding',()=>{
  const s=createCharacterStationRun();
  expect(maximumTravelFactor({...s,student:{...s.student!,sprintStrain:7}})).toBe(maximumTravelFactor(s));
 });
 it('the parent synchronized burst has a bounded, explicit advantage',()=>{
  const p=createCharacterStationRun('hangzhou','mom').parent!;
  const synced={...p,syncRemaining:5};
  expect(parentMovementFactor(synced,true)/parentMovementFactor(synced,false)).toBeCloseTo(1.45,8);
 });
});
