import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Station from './Station';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {runnerWave} from './runner';
const start=():Run=>({...createCharacterStationRun('shanghai','student',false,()=>.2),phase:'station',stationJourney:[{id:'gate-scan',stage:4,label:'向检票口前进',seconds:10}],stationBeat:0,stationProgress:0,stationRunning:false,event:null});
const render=(s:Run)=>renderToStaticMarkup(<Station run={s} dispatch={()=>{}} blocked={!!s.event}/>);
describe('首关操作成果反馈',()=>{
 it('shows actual avoided obstacles and estimated sprint savings without charging or rewarding a render',()=>{
  let s=reducer(start(),{type:'RUN_INPUT',held:true});
  s=reducer(s,{type:'CHANGE_LANE',direction:-1});
  for(let i=0;i<100&&s.student!.runner.dodges===0;i++)s=reducer(s,{type:'TICK',dt:.1});
  expect(s.student!.runner.dodges).toBe(1);expect(s.student!.sprintSaved).toBe(0);
  expect(render(s)).toContain('避开路障 <b>1 次</b>');expect(render(s)).toContain('冲刺追回约 <b>0 秒</b>');
  const wave=runnerWave(s);if(wave?.lane===s.student!.runner.lane)s=reducer(s,{type:'CHANGE_LANE',direction:wave.lane===2?-1:1});
  s=reducer(s,{type:'SPRINT_INPUT',held:true});
  for(let i=0;i<15;i++)s=reducer(s,{type:'TICK',dt:.1});
  expect(s.student!.sprintSaved).toBeGreaterThan(1);
  const snapshot=JSON.stringify(s),html=render(s);expect(html).toContain(`冲刺追回约 <b>${Math.floor(s.student!.sprintSaved)} 秒</b>`);
  render(s);expect(JSON.stringify(s)).toBe(snapshot);
 });
 it('a collision does not count as an avoided obstacle, and a new round starts from zero',()=>{
  let s=reducer(start(),{type:'RUN_INPUT',held:true});
  for(let i=0;i<100&&!s.student!.runner.blocked;i++)s=reducer(s,{type:'TICK',dt:.1});
  expect(s.student!.runner.collisions).toBe(1);expect(s.student!.runner.dodges).toBe(0);
  expect(render(s)).toContain('避开路障 <b>0 次</b>');expect(render(start())).toContain('冲刺追回约 <b>0 秒</b>');
 });
});
