import type {Dispatch} from 'react';
import type {Run,Action} from './engine';
import {activeObstacle,obstructionTitle,type ObstructionKind,type ClearMethod} from './mapObstructions';
import HoldAction from './HoldAction';
import {LittleYou} from './LittleYou';
import {stationAvatarMotion,stationAvatarEffort} from './stationMotion';
import type {StationActionProgress} from './StationActionContext';
import {visibleChildDelay} from './mapTimeFeedback';
import './mapObstructions.css';

function Person({x,y=70,small=false,color='#94aaa0'}:{x:number;y?:number;small?:boolean;color?:string}){return <g transform={`translate(${x} ${y}) scale(${small?.65:1})`}><ellipse cy="28" rx="13" ry="4" fill="#79654825"/><path d="M-7 15l-4 12m18-12 4 12" stroke="#76644b" strokeWidth="5" strokeLinecap="round"/><rect x="-13" y="-10" width="26" height="29" rx="9" fill={color}/><circle cy="-19" r="12" fill="#e4c198"/><path d="M-11-22q3-16 21-1" fill="#75634c"/><path d="M-12 0l-9 10m33-10 9 10" stroke="#e4c198" strokeWidth="6" strokeLinecap="round"/></g>;}
export function MapObstructionScene({run,action}:{run:Run;action?:StationActionProgress}){
 const map=run.stationMap!,block=map.block!,obstacle=activeObstacle(map);if(!obstacle)return null;
 const kind=obstacle.kind,progress=block.duration?block.elapsed/block.duration:0,letting=block.mode==='yielding',motion=stationAvatarMotion(run,true,action);
 const playerX=kind==='security'&&block.mode==='queue'?36+progress*146:180;
 return <svg viewBox="0 0 360 145" role="img" aria-label={obstructionTitle(kind)} className="map-obstruction-scene">
  <path d="M0 106H360M72 145l43-125m174 125L245 20" stroke="#d6c59f" strokeWidth="2"/>
  {kind==='door'&&<><rect x="70" y="4" width="220" height="91" rx="14" fill="#d4ddd0"/><rect x="126" y="8" width="108" height="84" rx="5" fill="#fff8df"/><text x="180" y="24" textAnchor="middle">地铁车门</text><Person x={154-(letting?progress*35:0)}/><Person x={205+(letting?progress*35:0)} color="#be987b"/></>}
  {kind==='landing'&&<><path d="M116 106V40h125v66" fill="#e3d6b5" stroke="#a38f6b" strokeWidth="5"/><path d="M124 53h109m-109 13h109m-109 13h109" stroke="#b8a680" strokeWidth="3"/><text x="180" y="22" textAnchor="middle">扶梯出口</text><Person x={180+(letting?progress*60:0)} y={81}/><rect x={192+(letting?progress*60:0)} y="70" width="11" height="17" rx="2" fill="#655e52"/></>}
  {kind==='child'&&<><text x="180" y="24" textAnchor="middle">注意！别撞上</text><Person x={60+((Math.sin(run.elapsed*2.5)+1)/2)*240} y={76} small color="#dcac73"/><path d="M50 91H310" stroke="#c98f65" strokeDasharray="5 8" fill="none"/><text x="305" y="48" textAnchor="end">等等我！</text></>}
  {kind==='crowd'&&<><text x="180" y="22" textAnchor="middle">通道被占满</text>{[130,178,226].map((x,i)=><Person key={x} x={x+(letting?(i-1)*progress*50:0)} color={['#9cae89','#bba182','#8fa9ac'][i]}/>)}</>}
  {kind==='closed'&&<><rect x="35" y="32" width="135" height="66" rx="8" fill="#e2d1ae"/><path d="M41 43H165M41 54H165M41 65H165" stroke="#baa57e"/><rect x="59" y="72" width="86" height="23" rx="5" fill="#b9725e"/><text x="102" y="89" fill="#fff9e7" textAnchor="middle">暂停服务</text><rect x="245" y="35" width="47" height="67" rx="7" fill="#b9c8a3"/><text x="265" y="25" textAnchor="middle">自助 →</text><path d="M200 79h26l-7-7m7 7-7 7" fill="none" stroke="#7e9b71" strokeWidth="4"/></>}
  {kind==='security'&&<><rect x="248" y="19" width="77" height="61" rx="8" fill="#b9c7ad"/><rect x="256" y="30" width="59" height="22" rx="4" fill="#637362"/><text x="289" y="70" textAnchor="middle">安检</text>{Array.from({length:Math.min(4,block.lane===null?3:block.queues[block.lane].people)},(_,i)=><Person key={i} x={91+i*35-progress%(.25)*12} y={72} small color={i%2?'#be9d85':'#9cad8c'}/>)}{block.mode==='tray'&&<><rect x="198" y="66" width="42" height="12" rx="4" fill="#c0b49d"/><rect x="207" y="41" width="24" height="28" rx="6" fill="#ab9066"/><text x="177" y="25" textAnchor="middle">轮到你，放包！</text></>}</>}
  <foreignObject className="obstruction-player" x={playerX-26} y="88" width="52" height="56"><LittleYou characterId={run.character.id} parentAppearance={run.parent?.appearance} childGap={run.parent?.gap} carrying={run.parent?.carrying} motion={motion} effort={stationAvatarEffort(run)}/></foreignObject>
  {motion==='asking'&&<g className="obstruction-callout"><rect x={playerX+24} y="88" width="64" height="25" rx="12" fill="#fff9e7"/><path d={`M${playerX+24} 100l-7 7h12`} fill="#fff9e7"/><text x={playerX+56} y="105" textAnchor="middle">借过！</text></g>}
 </svg>;
}
const instructions:Record<ObstructionKind,string>={door:'大家挤在车门前，先让出一条缝。',landing:'前面的人停在出口看手机，后面还在往上来。',child:'先刹住，等孩子过去，或从外侧避让。',crowd:'近路挤满了人，外侧还有一点空隙。',closed:'卷帘门关着。旁边的自助通道亮着绿灯。',security:'看人、看行李。排进去以后，得等前面的人检查完。'};
export function MapObstructionTimeLoss({run}:{run:Run}){
 const delay=visibleChildDelay(run);if(!delay)return null;
 const seconds=Math.round(delay.seconds*10)/10;
 return <div key={delay.startedAt+':'+delay.active} className={'map-time-loss'+(delay.active?' ongoing':' complete')} role="status" aria-live={delay.active?'off':'polite'}>
  <span>{delay.active?'被小孩打断 · 已耽误':'避让小孩，耽误了'}<small>{delay.active?'正在等待或绕行':'通路腾出来了，继续跑！'}</small></span>
  <strong>{seconds>0?`−${seconds} 秒`:'时间正在流失'}</strong>
 </div>;
}
export default function MapObstructionPanel({run,dispatch}:{run:Run;dispatch:Dispatch<Action>}){
 const map=run.stationMap!,block=map.block!,obstacle=activeObstacle(map);if(!obstacle)return null;
 const clear=(method:ClearMethod,lane?:number)=>dispatch({type:'MAP_CLEAR',method,lane});
 const busy=block.mode==='waiting'||block.mode==='yielding',queue=block.mode==='queue';
 return <section className="map-obstruction-panel" aria-live="polite">
  <div className="obstruction-heading"><b>{obstructionTitle(obstacle.kind)}</b><span>被挡住了</span></div>
  <p>{queue?'队伍每次只放一个人。可以换队，但要重新排到后面。':instructions[obstacle.kind]}</p>
  {block.mode==='tray'?<HoldAction seconds={1.5} label="按住把背包放进托盘" onComplete={()=>clear('tray')}/>:obstacle.kind==='security'?<>
   {queue&&<div className="obstruction-queue-status"><b>{block.queues[block.lane!].label} · 前面还有 {block.queues[block.lane!].people} 人</b><progress max={block.duration} value={block.elapsed}/><span>{block.queues[block.lane!].people<=1?'下一位就是你了':'前面正在开包检查，别急…'}</span></div>}
   <div className="obstruction-queues">{block.queues.map((q,i)=><button key={q.label} disabled={queue&&block.lane===i} className={block.lane===i?'selected':''} aria-pressed={block.lane===i} onClick={()=>clear('join',i)}><b>{q.label} · {q.people} 人</b><span>{q.people?q.detail:'前面没人了，可以去放包'}</span><small>{queue&&block.lane===i?'正在排这队':queue?'换到这队':'排这队'}</small></button>)}</div>
  </>:busy?<div className="obstruction-wait-status"><b>{block.mode==='yielding'?'“借过一下，谢谢！”对方正在挪开':'刹住脚步，让孩子先过去'}</b><progress max={block.duration} value={block.elapsed}/><span>通路腾出来后继续往前</span></div>:<div className="obstruction-actions">
   {obstacle.kind==='closed'?<button onClick={()=>clear('leave')}>转到旁边自助通道 →</button>:obstacle.kind==='child'?<><button onClick={()=>clear('wait')}>先刹住，让孩子过去</button><button onClick={()=>clear('sidestep')}>从外侧绕过去 →</button></>:<><HoldAction seconds={1.2} label="按住说声借过" onComplete={()=>clear('ask')}/><button onClick={()=>clear('sidestep')}>侧身，从旁边绕过去 →</button></>}
  </div>}
 </section>;
}
