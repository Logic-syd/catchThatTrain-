import {localizeNode} from './i18n';
import type {Dispatch} from 'react';
import {ArrowRight,Heart,Footprints} from 'lucide-react';
import ChoiceDetail from './ChoiceDetail';
import {parentPreparation,canParentSprint,PARENT_SPRINT} from './parent';
import type {Action,Run} from './engine';
import {LittleYou} from './Scenes';
import {waitingFeedback} from './waiting';

export function ParentPreparation({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 const p=run.parent!,step=parentPreparation[p.prepStep];
 const choices=waitingFeedback(run,{id:'parent-preparation',title:step.title,description:step.story,phase:'station',choices:step.options.map(o=>({...o,waitSeconds:o.seconds}))}).choices;
 return <section className="student-preparation parent-preparation"><span className="chapter-sticker">{localizeNode("出门前 · ")}{localizeNode(p.prepStep+1)} / 2</span><div className="parent-origin"><LittleYou characterId="mom" parentAppearance={p.appearance}/><span><b>{localizeNode("“行，还是我自己带。”")}</b><small>{localizeNode("孩子会自己走，所有事却都要你来处理。")}</small></span></div><div className="prep-art">{localizeNode(p.prepStep===0?'🚻':'🍪')}</div><h2>{localizeNode(step.title)}</h2><p>{localizeNode(step.story)}</p><div className="event-buttons">{localizeNode(choices.map(o=><button className="soft-action" key={o.id} onClick={()=>dispatch({type:'PARENT_PREP',option:o.id!,step:p.prepStep})}><span><strong>{localizeNode(o.label)}</strong><ChoiceDetail text={o.detail}/></span><ArrowRight size={20}/></button>))}</div><small>{localizeNode("现在的准备会改变后面孩子停不停、要不要绕路。")}</small></section>;
}
export function ParentStatus({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 const p=run.parent!,warning=p.anger>=80?'气到要爆发了':p.gap>=5?'孩子快跟不上了':p.toilet>=PARENT_SPRINT.toiletThreshold?'孩子尿急，暂不能冲刺':p.patience<=25?'孩子不想走了':p.childEnergy<=30?'孩子快走不动了':p.carrying?'抱着孩子赶路':'孩子牵着手跟上了';
 const low=p.anger>=80||warning.includes('快')||warning.includes('尿急')||warning.includes('不想');
 const final=run.remaining-(run.gatePassed?0:180)<=120;
 return <div className={'parent-status '+(low?'urgent':'')}><div className="parent-status-top"><span><Heart size={15}/><b>{localizeNode("家长精力 ")}{localizeNode(Math.ceil(p.energy))} / {localizeNode(p.maxEnergy)}</b></span><strong>{localizeNode(warning)}</strong></div><div className="parent-status-bars"><label>{localizeNode("孩子体力 ")}<meter min="0" max="100" value={p.childEnergy}/></label><label>{localizeNode("耐心 ")}<meter min="0" max="100" value={p.patience}/></label><label>{localizeNode("尿意 ")}<meter min="0" max="100" value={p.toilet}/></label><label>{localizeNode("怒气 ")}{localizeNode(Math.round(p.anger))} <meter min="0" max="100" value={p.anger}/></label></div><div className="parent-status-actions"><small>{localizeNode("零食 ")}{localizeNode(p.snacks)}{localizeNode(" 份 · 水 ")}{localizeNode(p.water)}{localizeNode(" 瓶 · ")}{localizeNode(p.carrying?'正在抱孩子':'牵手赶路')}</small>{localizeNode(p.carrying&&run.city.id!=='guangzhou'&&<button disabled={!!run.event} onClick={()=>dispatch({type:'PARENT_RELEASE'})}>{localizeNode("放下孩子牵手走")}</button>)}{localizeNode(final&&!p.syncUsed&&<button className="sync-action" disabled={!!run.event||!canParentSprint(p)||p.runner.blocked} onClick={()=>dispatch({type:'PARENT_SYNC'})}><Footprints size={15}/>{localizeNode("拉好手，跑！")}</button>)}{localizeNode(p.syncRemaining>0&&<b>{localizeNode("同步冲刺 ")}{localizeNode(Math.ceil(p.syncRemaining))}{localizeNode(" 秒")}</b>)}</div></div>;
}
