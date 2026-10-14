import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {EventSheet} from './App';
import HoldAction from './HoldAction';
import {createCharacterStationRun,type Run} from './engine';
import {characterEventPrompt} from './characterTime';
import {journeyPrompt} from './stationJourney';
import {parentBlockPrompt} from './parent';
import {stationPrompt} from './flow';

function eventRun(character:'student'|'tourist'|'mom'='student'):Run{
 return {...createCharacterStationRun('guangzhou',character,false,()=>.5),phase:'station',event:null};
}
function html(run:Run){return renderToStaticMarkup(<EventSheet run={run} dispatch={()=>{}}/>);}

describe('任务操作与可见提示一致',()=>{
 it('长按展示实际累计秒数、暂停保留规则与进度',()=>{
  const result=renderToStaticMarkup(<HoldAction seconds={1.875} label="调整呼吸" onComplete={()=>{}}/>);
  expect(result).toContain('累计按住 1.88 秒完成');
  expect(result).toContain('松手暂停，进度保留');
  expect(result).toContain('role="progressbar"');
  expect(result).toContain('aria-valuenow="0"');
 });
 it('占手后的长按秒数与完成后固定成本同时可见',()=>{
  let s=eventRun();s={...s,student:{...s.student!,tea:true},event:{id:'student-breath',phase:'station',title:'调整呼吸',description:'',interaction:{kind:'hold',required:2,seconds:10,penalty:0},choices:[{label:'按住调整呼吸',detail:'恢复体力',seconds:105}]}};
  const result=html(s);
  expect(result).toContain('累计按住 2.5 秒完成');
  expect(result).toContain('恢复体力');
  expect(result).toContain('完成操作后另结算 105 游戏秒');
 });
 it('醒来是一次点击，并且再睡一下是玩家可选的另一按钮',()=>{
  const s=eventRun('tourist');s.phase='metro';s.event=characterEventPrompt(s,'tourist-wake')!;
  const result=html(s);
  expect(result).toContain('醒醒！');expect(result).toContain('再睡一下');
  expect(result).toContain('点击一次完成');
  expect(result).not.toContain('跑！跑！跑！');
  // Count task actions separately from the modal's language control.
  expect((result.match(/<button(?![^>]*class="language-switch")/g)??[]).length).toBe(2);
 });
 it('游客倒计时使用实际三秒窗口，不额外受专注倍率影响',()=>{
  const s=eventRun('tourist');s.phase='metro';s.characterTime={...s.characterTime!,focus:100};s.event=characterEventPrompt(s,'tourist-wake')!;
  expect(html(s)).toContain('>3s</b>');
  s.eventElapsed=1.1;expect(html(s)).toContain('>2s</b>');
 });
 it('提醒行人使用真实动作标签和要求的四次点击',()=>{
  let s=eventRun();s={...s,stationJourney:[{id:'gz-crossing',stage:1,label:'过人流',seconds:1}],stationBeat:0};s.event=journeyPrompt(s);
  const result=html(s);
  expect(result).toContain('借过，谢谢！');
  expect(result).toContain('连续点击 4 次完成');
  expect(result).not.toContain('跑！跑！跑！');
 });
 it('普通等待选择保留所有选项，不伪装成长按任务',()=>{
  const s=eventRun('mom');s.parent={...s.parent!,gap:9};s.event=parentBlockPrompt(s.parent)!;
  const result=html(s);
  expect(result).toContain('停下等孩子');expect(result).toContain('回头抱起来');
  expect(result).not.toContain('hold-operation');
  expect(result).not.toContain('role="progressbar"');
 });
 it('扫描类操作公开完成后额外耗时',()=>{
  const s=eventRun();s.event=stationPrompt('security')!;
  const result=html(s);
  expect(result).toContain('剪刀');
  expect(result).toContain('完成操作后另结算 20 游戏秒');
 });
 it('检票通道显示步行、排队和合计，人数图示只读取排队时间',()=>{
  const s=eventRun();s.event={id:'gates',phase:'station',title:'选择通道',description:'',interaction:{kind:'gates',seconds:10,penalty:0},choices:[{label:'1 号',detail:'附加步行 90 秒 · 排队 10 秒 · 合计 100 秒',seconds:100,fixedWalkSeconds:90,waitSeconds:10}]};
  const result=html(s);
  expect(result).toContain('附加步行 90 秒');expect(result).toContain('排队 10 秒');expect(result).toContain('合计 100 秒');
  expect(result).toContain('<div class="queue-people"><i></i></div>');
 });
});
