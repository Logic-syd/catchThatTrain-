import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Station from './Station';
import StationTaskScene from './StationTaskScene';
import IdentitySearch from './IdentitySearch';
import {createStationRun,createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {mapTaskPoint} from './stationMapTravel';
function atStation():Run{const fresh=createStationRun();return reducer({...fresh,phase:'station',stationJourney:buildStationJourney(fresh),remaining:1500},{type:'MAP_ENABLE',manual:true});}
function render(run:Run){return renderToStaticMarkup(<Station run={run} dispatch={()=>{}} blocked={!!run.event}>{run.event&&<button>处理这件事</button>}</Station>);}
describe('mobile map controls',()=>{
 it('starts with a navigable map, landmarks and clear hold guidance',()=>{const html=render(atStation());expect(html).toContain('按住出发，地图上可以改道');expect(html).toContain('走到铁路出发');expect(html).toContain('走到事件');expect(html).toContain('按住赶路');expect(html).toContain('按住冲刺');expect(html).toContain('松手＝停下喘气');expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);expect(html).not.toContain('换道');});
 it('updates travel, pause and resume feedback with actual state',()=>{let s=atStation();s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});expect(render(s)).toContain('路线选好了，按住继续');s=reducer(s,{type:'RUN_INPUT',held:true});expect(render(s)).toContain('正沿地图通道赶路');expect(render(s)).toContain('在赶了，在赶了！');s=reducer(s,{type:'RUN_INPUT',held:false});expect(render(s)).toContain('路线还在。按住赶路继续，松手就停下。');s=reducer(s,{type:'RUN_INPUT',held:true});expect(render(s)).toContain('正沿地图通道赶路');});
 it('replaces movement controls with the active operation when blocked',()=>{let s=atStation();s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});s=reducer(s,{type:'RUN_INPUT',held:true});for(let i=0;i<1000&&!s.stationMap!.block;i++)s=reducer(s,{type:'TICK',dt:.1});const html=render(s);expect(html).toContain('被挡住了');expect(html).toContain('按住说声借过');expect(html).toContain('侧身，从旁边绕过去');expect(html).toContain('map-task-closeup');expect(html).not.toContain('hold-run-controls');s={...s,stationMap:{...s.stationMap!,block:null},event:journeyPrompt(s)};expect(render(s)).toContain('先处理，再赶路');expect(render(s)).toContain('处理这件事');});
 it('security and gate artwork changes with action progress, without revealing an unfound ID',()=>{const s=atStation();s.stationBeat=s.stationJourney.findIndex(b=>b.id==='gate-scan');s.event=journeyPrompt(s);const start=renderToStaticMarkup(<StationTaskScene run={s} progress={0} active={false}/>),end=renderToStaticMarkup(<StationTaskScene run={s} progress={1} active={false}/>);expect(start).not.toEqual(end);expect(end).toContain('放行');s.stationBeat=s.stationJourney.findIndex(b=>b.id==='identity-search');s.event=journeyPrompt(s);expect(renderToStaticMarkup(<StationTaskScene run={s} progress={.8} active/>)).not.toContain('data-scene-object="identity-card"');});
 it('uses a wide, compact object grid for phone searches without removing items',()=>{const s={...createCharacterStationRun('hangzhou','worker'),phase:'station' as const};const html=renderToStaticMarkup(<IdentitySearch run={s} dispatch={()=>{}}/>);expect(html).toContain('viewBox="0 0 360 230"');expect(html.match(/class="search-object"/g)).toHaveLength(18);});
});
