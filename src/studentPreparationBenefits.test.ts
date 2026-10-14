import {describe,it,expect} from 'vitest';
import {applyStudentPreparation,bagHint,movementFactor,studentPreparation,studentState,teaRecoveryActive,type StudentState} from './studentConfig';

function fresh(){return studentState(()=>.5);}
function option(u:StudentState,id:string){return studentPreparation(u)!.options.find(o=>o.id===id)!;}

describe('student preparation promises and resource boundaries',()=>{
 it.each([0,90,99,100])('tea fills only newly gained capacity when the cap is %s',energy=>{
  const u={...fresh(),stats:{...fresh().stats,energy},stamina:energy/2};
  const n=applyStudentPreparation(u,'buy'),gain=Math.min(10,100-energy);
  expect(n.stats.energy).toBe(energy+gain);
  expect(n.stamina-u.stamina).toBe(gain);
  expect(option(u,'buy').detail).toContain(`精力上限 +${gain}`);
  expect(option(u,'buy').detail).toContain(`当前体力 +${gain}`);
  expect(n.decisionLoss).toBe(option(u,'buy').seconds);
  expect(n.stats.agility-u.stats.agility).toBe(5);
  expect(movementFactor(n)).toBeGreaterThan(movementFactor(u));
  expect(u.stamina).toBe(energy/2);
 });

 it.each([0,90,99,100])('breakfast fills only newly gained capacity at cap %s and retains satiety',energy=>{
  const u={...fresh(),prep:2,stats:{...fresh().stats,energy},stamina:energy/2};
  const n=applyStudentPreparation(u,'eat'),gain=Math.min(15,100-energy);
  expect(n.stats.energy).toBe(energy+gain);
  expect(n.stamina-u.stamina).toBe(gain);
  expect(n.breakfast).toBe(true);
  expect(option(u,'eat').detail).toContain(`精力上限 +${gain}`);
  expect(option(u,'eat').detail).toContain(`当前体力 +${gain}`);
  expect(option(u,'eat').detail).toContain('饱腹避免进入候车大厅后上限 −10');
  expect(n.decisionLoss).toBe(25);
 });

 it('later preparation reads the capacity granted by tea without healing missing stamina',()=>{
  let u={...fresh(),stamina:25};
  u=applyStudentPreparation(u,'buy');
  expect(u.stamina).toBe(35);
  u=applyStudentPreparation(u,'check');
  expect(u.stamina).toBe(35);
  expect(option(u,'eat').detail).toContain('精力上限 +0');
  u=applyStudentPreparation(u,'eat');
  expect(u.stamina).toBe(35);
  expect(u.stats.energy).toBe(100);
  expect(u.breakfast).toBe(true);
  expect(u.decisionLoss).toBe(80);
  expect(u.choices).toEqual({tea:'buy',id:'check',breakfast:'eat'});
  expect(studentPreparation(u)).toBeUndefined();
  expect(applyStudentPreparation(u,'eat')).toBe(u);
 });

 it('all allowed tea, ID and breakfast combinations retain only the promised stamina gain',()=>{
  for(const tea of ['buy','skip'])for(const id of ['check','skip'])for(const breakfast of ['eat','skip']){
   let u={...fresh(),stamina:20};
   for(const pick of [tea,id,breakfast])u=applyStudentPreparation(u,pick);
   expect(u.stats.energy).toBe(tea==='buy'||breakfast==='eat'?100:90);
   expect(u.stamina).toBe(tea==='buy'||breakfast==='eat'?30:20);
   expect(u.checkedID).toBe(id==='check');
   expect(u.breakfast).toBe(breakfast==='eat');
   expect(u.decisionLoss).toBe((tea==='buy'?45:0)+(id==='check'?10:0)+(breakfast==='eat'?25:0));
  }
 });

 it('capped agility and focus disclose actual gains while checked ID still has a consumer',()=>{
  let u={...fresh(),stats:{...fresh().stats,agility:99,focus:100},stamina:0};
  expect(option(u,'buy').detail).toContain('敏捷 +1');
  u=applyStudentPreparation(u,'buy');
  expect(u.stats.agility).toBe(100);
  expect(option(u,'check').detail).toContain('专注 +0');
  u=applyStudentPreparation(u,'check');
  expect(u.stats.focus).toBe(100);
  expect(u.stamina).toBe(10);
  expect(u.pocket).toBe(0);
  expect(bagHint(u)).toContain('身份证就在前袋');
 });

 it('invalid options and duplicate earlier choices cannot charge or grant resources',()=>{
  const u=fresh();
  expect(applyStudentPreparation(u,'eat')).toBe(u);
  const tea=applyStudentPreparation(u,'buy');
  expect(applyStudentPreparation(tea,'buy')).toBe(tea);
 });

 it('tea recovery has a station-time window independent of a long metro trip and held cup',()=>{
  const u=applyStudentPreparation(fresh(),'buy');
  expect(option(fresh(),'buy').detail).toContain('进站后前 3 游戏分钟自然恢复 +20%');
  expect(teaRecoveryActive({...u,elapsedGame:1800,stationElapsedGame:0})).toBe(true);
  expect(teaRecoveryActive({...u,tea:false,stationElapsedGame:179.99})).toBe(true);
  expect(teaRecoveryActive({...u,stationElapsedGame:180})).toBe(false);
  expect(teaRecoveryActive({...u,stationElapsedGame:181})).toBe(false);
  expect(teaRecoveryActive({...u,choices:{tea:'skip'}})).toBe(false);
  expect(teaRecoveryActive({...u,stationElapsedGame:undefined})).toBe(true);
 });
});
