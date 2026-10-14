import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {EventSheet} from './App';
import {ParentStatus} from './ParentUI';
import {parentBlockPrompt} from './parent';
import {CharacterChallengeSummary} from './CharacterChallengeUI';
function at(who:'student'|'worker'|'tourist',id:string):Run{
 const base=createCharacterStationRun('shanghai',who,false,()=>.5),stationJourney=buildStationJourney(base),stationBeat=stationJourney.findIndex(b=>b.id===id);
 const s={...base,phase:'station' as const,stationJourney,stationBeat};return {...s,event:journeyPrompt(s)};
}
describe('人物难点的可见操作',()=>{
 it('shows tempting emotional gains, actual costs and the leave option',()=>{
  const s=at('student','student-cat'),html=renderToStaticMarkup(<EventSheet run={s} dispatch={()=>{}}/>);
  expect(html).toContain('幸福感 +20');expect(html).toContain('30 游戏秒');expect(html).toContain('记住车票，继续赶路');
  expect(html).not.toContain('精力 +20');
 });
 it('maze exposes two directions, signs, asking and explored unknown nodes',()=>{
  const s=at('tourist','tourist-maze'),html=renderToStaticMarkup(<EventSheet run={s} dispatch={()=>{}}/>);
  for(const label of ['走左侧连廊','走右侧连廊','走近看清路标','问工作人员怎么走','未到达区域'])expect(html).toContain(label);
  expect(html).toContain('20 游戏秒');expect(html).toContain('8 游戏秒');expect(html).toContain('12 游戏秒');
 });
 it('parent anger, stop-and-breathe and lecture costs are visible',()=>{
  const base=createCharacterStationRun('beijing','mom',false,()=>.5),parent={...base.parent!,anger:80,blockCooldown:0},s={...base,parent,phase:'station' as const,event:parentBlockPrompt(parent)};
  const html=renderToStaticMarkup(<><ParentStatus run={s} dispatch={()=>{}}/><EventSheet run={s} dispatch={()=>{}}/></>);
  expect(html).toContain('怒气 80');expect(html).toContain('忍住，深呼吸，牵好手');expect(html).toContain('停下来，训孩子一顿');expect(html).toContain('12 秒');expect(html).toContain('45 秒');
 });
 it('company delays read the pending state and results count actual interruptions',()=>{
  const s=at('worker','worker-company-revision');s.characterTime={...s.characterTime!,workPending:2,workInterruptions:2};s.event=journeyPrompt(s);
  const html=renderToStaticMarkup(<EventSheet run={s} dispatch={()=>{}}/>);
  expect(html).toContain('32 游戏秒');expect(html).toContain('下一次追问更久');
  expect(renderToStaticMarkup(<CharacterChallengeSummary run={s}/>)).toContain('2 次');
 });
});
