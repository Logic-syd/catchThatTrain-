import type {Dispatch} from 'react';
import {ArrowRight,Heart,Footprints} from 'lucide-react';
import ChoiceDetail from './ChoiceDetail';
import {parentPreparation} from './parent';
import type {Action,Run} from './engine';
import {LittleYou} from './Scenes';

export function ParentPreparation({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 const p=run.parent!,step=parentPreparation[p.prepStep];
 return <section className="student-preparation parent-preparation"><span className="chapter-sticker">出门前 · {p.prepStep+1} / 2</span><div className="parent-origin"><LittleYou characterId="mom" parentAppearance={p.appearance}/><span><b>“行，还是我自己带。”</b><small>孩子会自己走，所有事却都要你来处理。</small></span></div><div className="prep-art">{p.prepStep===0?'🚻':'🍪'}</div><h2>{step.title}</h2><p>{step.story}</p><div className="event-buttons">{step.options.map(o=><button className="soft-action" key={o.id} onClick={()=>dispatch({type:'PARENT_PREP',option:o.id,step:p.prepStep})}><span><strong>{o.label}</strong><ChoiceDetail text={o.detail}/></span><ArrowRight size={20}/></button>)}</div><small>现在的准备会改变后面孩子停不停、要不要绕路。</small></section>;
}
export function ParentStatus({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 const p=run.parent!,warning=p.gap>=5?'孩子快跟不上了':p.toilet>=80?'孩子想上厕所':p.patience<=25?'孩子不想走了':p.childEnergy<=30?'孩子快走不动了':p.carrying?'抱着孩子赶路':'孩子牵着手跟上了';
 const low=warning.includes('快')||warning.includes('厕所')||warning.includes('不想');
 const final=run.remaining-(run.gatePassed?0:180)<=120;
 return <div className={'parent-status '+(low?'urgent':'')}><div className="parent-status-top"><span><Heart size={15}/><b>家长精力 {Math.ceil(p.energy)} / {p.maxEnergy}</b></span><strong>{warning}</strong></div><div className="parent-status-bars"><label>孩子体力 <meter min="0" max="100" value={p.childEnergy}/></label><label>耐心 <meter min="0" max="100" value={p.patience}/></label><label>尿意 <meter min="0" max="100" value={p.toilet}/></label></div><div className="parent-status-actions"><small>零食 {p.snacks} 份 · 水 {p.water} 瓶 · {p.carrying?'正在抱孩子':'牵手赶路'}</small>{p.carrying&&run.city.id!=='guangzhou'&&<button disabled={!!run.event} onClick={()=>dispatch({type:'PARENT_RELEASE'})}>放下孩子牵手走</button>}{final&&!p.syncUsed&&<button className="sync-action" disabled={!!run.event} onClick={()=>dispatch({type:'PARENT_SYNC'})}><Footprints size={15}/>拉好手，跑！</button>}{p.syncRemaining>0&&<b>同步冲刺 {Math.ceil(p.syncRemaining)} 秒</b>}</div></div>;
}
