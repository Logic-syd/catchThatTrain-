import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createStationRun,reducer} from './engine';
import {STUDENT_PREPARATION_COSTS,STUDENT_PREPARATION_TOTAL} from './studentConfig';
import {StudentReport} from './StudentUI';
import {createGameResult,analyzeFactors,type GameResult} from './gameResult';
import {TITLE_CONFIGS} from './titles';
import {ACHIEVEMENTS,matches} from './achievementConfig';

function prepared(options=['buy','check','eat']){
 let run=reducer(createStationRun('shanghai',false,()=>.5),{type:'START'});
 for(const option of options)run=reducer(run,{type:'PREP_PICK',option,step:run.student!.prep});
 return run;
}
const title=(id:string)=>TITLE_CONFIGS.find(t=>t.id===id)!;

describe('学生准备费用的结算消费者',()=>{
 it('实际准备支出、指标与报告使用同一费用',()=>{
  const run=prepared(),result=createGameResult(run),report=renderToStaticMarkup(<StudentReport run={run}/>);
  expect(run.initial-run.remaining).toBe(STUDENT_PREPARATION_TOTAL);
  expect(result.characterStats.extraPreparationSeconds).toBe(STUDENT_PREPARATION_TOTAL);
  expect(report).toContain(`出门前花 ${STUDENT_PREPARATION_COSTS.id} 秒检查`);
  expect(report).toContain(`奶茶花了 ${STUDENT_PREPARATION_COSTS.tea} 秒`);
  expect(report).not.toContain('2 分钟');
  expect(renderToStaticMarkup(<StudentReport run={prepared(['skip','skip','skip'])}/>)).toContain(`保住了 ${STUDENT_PREPARATION_COSTS.tea} 秒`);
 });
 it('降价后的全部准备仍可获得时间管理称号，成功余量窗口保持独立',()=>{
  const result={...createGameResult(prepared()),success:true,resultMarginSeconds:60};
  expect(title('student_management').condition(result)).toBe(true);
  expect(title('student_management').condition({...result,resultMarginSeconds:120})).toBe(false);
  expect(title('student_management').condition({...result,characterStats:{...result.characterStats,extraPreparationSeconds:STUDENT_PREPARATION_TOTAL-1}})).toBe(false);
 });
 it('压哨准备成就仍可触发，文案与实际要求同时更新',()=>{
  const result={...createGameResult(prepared()),success:true,resultMarginSeconds:5,errors:1};
  const achievement=ACHIEVEMENTS.find(a=>a.id==='secret-student')!;
  expect(achievement.description).toContain(`至少花费 ${STUDENT_PREPARATION_TOTAL} 秒`);
  expect(matches(achievement.condition,{r:result})).toBe(true);
  expect(matches(achievement.condition,{r:{...result,errors:0}})).toBe(false);
 });
 it.each([['tea','student_tea_loss',STUDENT_PREPARATION_COSTS.tea],['breakfast','student_food_loss',STUDENT_PREPARATION_COSTS.breakfast]] as const)('%s 单项准备败因只覆盖它真实可补回的费用', (prep,id,cost)=>{
  const base=createGameResult(prepared());
  const failed=(gap:number):GameResult=>{
   const result={...base,success:false,resultMarginSeconds:-gap,timeImpacts:[{id:'prepare-'+prep,eventId:'prepare-'+prep,source:'准备',category:'decision' as const,deltaSeconds:-cost,positive:false,avoidable:true},{id:'other',source:'其他',category:'decision' as const,deltaSeconds:-10,positive:false,avoidable:true}]};
   return {...result,timeImpacts:analyzeFactors(result).impacts};
  };
  expect(title(id).condition(failed(cost))).toBe(true);
  expect(title(id).condition(failed(cost+1))).toBe(false);
 });
 it('通用准备耗时称号对学生使用新总费，其他人物仍用独立门槛',()=>{
  const result={...createGameResult(prepared()),success:false};
  expect(title('optional_delay').condition(result)).toBe(true);
  expect(title('optional_delay').condition({...result,characterId:'worker'})).toBe(false);
  expect(title('optional_delay').condition({...result,characterId:'worker',characterStats:{extraPreparationSeconds:120}})).toBe(true);
 });
});
