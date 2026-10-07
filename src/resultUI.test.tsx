import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createStationRun} from './engine';
import Results,{AchievementShelf} from './Results';
import {awardRun,freshProgress,ACHIEVEMENTS} from './achievements';
const noop=()=>{};
describe('result UI rendering',()=>{
 it('result identity and key causes precede collapsed detail and replay remains present',()=>{
  const run={...createStationRun(),phase:'result' as const,success:true,gateRemaining:2};const progress=awardRun(freshProgress(),run);
  const html=renderToStaticMarkup(<Results run={run} progress={progress} saved replay={noop} share={noop} selectStation={noop}/>);
  expect(html).toContain('最后一秒选手');expect(html).toContain('这局你为什么赶上了');expect(html).toContain('再赶一趟！');
  expect(html.indexOf('reason-card')).toBeLessThan(html.indexOf('result-details'));expect(html).not.toContain('<details open');
  expect(html.match(/class="achievement-feature /g)).toHaveLength(1);
 });
 it('locked hidden achievements expose neither names nor conditions',()=>{
  const html=renderToStaticMarkup(<AchievementShelf progress={freshProgress()}/>);
  const hiddenCards=(html.match(/<article[^>]*>[\s\S]*?<\/article>/g)??[]).filter(card=>card.includes('未发现的故事'));
  for(const card of hiddenCards)for(const a of ACHIEVEMENTS.filter(a=>a.hidden)){expect(card).not.toContain(a.name);expect(card).not.toContain(a.description);}
  expect(html.match(/未发现的故事/g)).toHaveLength(7);expect(html).toContain('<progress');
 });
 it('failure deductions use prominent seconds; early failure identifies preparation',()=>{
  const run={...createStationRun(),phase:'result' as const,success:false,remaining:180};run.metrics.endPhase='preparation';run.metrics.estimatedSecondsToGoal=50;
  run.metrics.impacts=[{id:'tea',eventId:'prepare-tea',source:'买奶茶',category:'decision',deltaSeconds:-120,positive:false,avoidable:true}];run.student!.choices.tea='buy';
  const html=renderToStaticMarkup(<Results run={run} progress={freshProgress()} saved={false} replay={noop} share={noop} selectStation={noop}/>);
  expect(html).toContain('奶茶误我');expect(html).toContain('止步出门准备');expect(html).toContain('class="time-loss">−120');expect(html).toContain('浏览器未允许保存');
 });
});
