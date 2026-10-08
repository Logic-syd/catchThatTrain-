import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Station from './Station';
import {createStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';

function atStation():Run{
 const fresh=createStationRun();
 return {...fresh,phase:'station',stationJourney:buildStationJourney(fresh),remaining:1500};
}
function render(run:Run){return renderToStaticMarkup(<Station run={run} dispatch={()=>{}} blocked={false}/>);}

describe('mobile station controls',()=>{
 it('shows one clear start action before movement and separates directions',()=>{
  const html=render(atStation());
  expect(html).toContain('先点「开始前进」');
  expect(html).toContain('点一次，自动往前走');
  expect(html).toContain('向左换道');
  expect(html).toContain('向右换道');
  expect(html).not.toContain('class="run-secondary"');
 });
 it('puts sprint and pause after starting and points out the occupied lane',()=>{
  const run=reducer(atStation(),{type:'RUN_INPUT',held:true});
  const html=render(run);
  expect(html).toContain('前方中道有行李箱');
  expect(html).toContain('点「向左」或「向右」提前避开');
  expect(html).toContain('class="run-secondary"');
  expect(html).toContain('按住冲刺');
  expect(html).toContain('暂停');
  expect(html).not.toContain('class="run-start"');
 });
 it('identifies the only available escape at the lane edge after a collision',()=>{
  const started=reducer(atStation(),{type:'RUN_INPUT',held:true});
  const run={...started,student:{...started.student!,runner:{...started.student!.runner,lane:0,blocked:true}}};
  const html=render(run);
  expect(html).toContain('点「向右」换道，才能继续走');
  expect(html).toContain('aria-label="向左换道" disabled=""');
  expect(html).toContain('class="big-action sprint-forward" disabled=""');
 });
 it('walks a player through collision, lane change, pause, and restart',()=>{
  let run=reducer(atStation(),{type:'RUN_INPUT',held:true});
  for(let i=0;i<200&&!run.student!.runner.blocked;i++)run=reducer(run,{type:'TICK',dt:.1});
  expect(run.student!.runner.blocked).toBe(true);
  expect(render(run)).toContain('点「向左」或「向右」换道，才能继续走');
  run=reducer(run,{type:'CHANGE_LANE',direction:-1});
  expect(run.student!.runner.blocked).toBe(false);
  expect(render(run)).not.toContain('才能继续走');
  run=reducer(run,{type:'RUN_INPUT',held:false});
  expect(render(run)).toContain('点一次，自动往前走');
  run=reducer(run,{type:'RUN_INPUT',held:true});
  expect(render(run)).toContain('按住冲刺');
 });
});
