import {StationWorld,StationMap} from './StationMaps';
import {stationFor,selectedPath} from './stations';
import {StudentEnergy} from './StudentUI';
import {ParentStatus} from './ParentUI';
import {useEffect,useRef,type Dispatch,type ReactNode} from 'react';
import {Footprints,LockKeyhole,ArrowLeft,ArrowRight,Backpack,TrainFront,Luggage,Users,Pause,Play} from 'lucide-react';
import {clockRate,type Run,type Action} from './engine';
import {runnerWave} from './runner';
import {LittleYou,TinyTrain} from './Scenes';
import {ElderArt,EscalatorArt,VerticalArt} from './StationEventArt';
export default function Station({run,dispatch,blocked,children}:{run:Run;dispatch:Dispatch<Action>;blocked:boolean;children?:ReactNode}){
 const station=stationFor(run);
 const beat=run.stationJourney[run.stationBeat],u=run.student;
 const locked=useRef(blocked);locked.current=blocked;
 const running=useRef(run.stationRunning);running.current=run.stationRunning;
 const swipe=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{if(blocked)dispatch({type:'RUN_INPUT',held:false});},[blocked,dispatch]);
 useEffect(()=>{
  const reset=()=>dispatch({type:'RUN_INPUT',held:false});
  const down=(e:KeyboardEvent)=>{
   if(locked.current||(e.code==='Space'&&e.target instanceof HTMLButtonElement))return;
   if(e.code==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();dispatch({type:'CHANGE_LANE',direction:-1});}
   if(e.code==='ArrowRight'||e.code==='KeyD'){e.preventDefault();dispatch({type:'CHANGE_LANE',direction:1});}
   if(e.code==='Space'&&!e.repeat){e.preventDefault();dispatch({type:'SPRINT_INPUT',held:true});}
   if(e.code==='KeyP'&&!e.repeat){e.preventDefault();dispatch({type:'RUN_INPUT',held:!running.current});}
  };
  const up=(e:KeyboardEvent)=>{if(e.code==='Space'){e.preventDefault();dispatch({type:'SPRINT_INPUT',held:false});}};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);};
 },[dispatch]);
 const runner=u?.runner??run.characterTime?.runner??run.parent?.runner;const wave=runnerWave(run),collision=!!runner?.blocked;
 const moving=run.stationRunning&&!blocked&&!collision&&!run.characterTime?.exhausted&&!run.parent?.exhausted;
 const obstacle=run.event;
 const elder=beat?.id==='elder-block',lift=beat?.id.startsWith('escalator'),bag=beat?.id==='bag-snag',train=beat?.id==='board-train';
 const approach=wave?Math.min(1,Math.max(0,(run.stationProgress-wave.from)/(wave.at-wave.from))):0;
 const change=(direction:-1|1)=>dispatch({type:'CHANGE_LANE',direction});
 const currentLane=runner?.lane??1;
 const dangerLane=wave?.lane;
 const needDodge=dangerLane===currentLane;
 const safeDirection: -1|1=currentLane===2?-1:1;
 const directionHint=currentLane===0?'点「向右」':currentLane===2?'点「向左」':'点「向左」或「向右」';
 let guidance='正在自动前进，看到障碍再点左右换道';
 if(collision)guidance=`被${wave?.kind??'障碍'}挡住了！${directionHint}换道，才能继续走`;
 else if(!run.stationRunning)guidance=needDodge?`先点「开始前进」；前方有${wave?.kind}，接着${directionHint}避开`:'先点「开始前进」，小人会自动往前走';
 else if(needDodge)guidance=`前方${['左','中','右'][dangerLane!]}道有${wave?.kind}！${directionHint}提前避开`;
 else if(wave)guidance=`前方${['左','中','右'][wave.lane]}道有${wave.kind}，你在${['左','中','右'][currentLane]}道，保持这条道`;
 return <section className={'station-journey lane-journey layout-'+station.id+' '+(moving?'running ':'')+(obstacle||collision?'obstructed':'')} data-beat={beat?.id} data-progress={run.stationProgress.toFixed(3)} data-lane={runner?.lane??1} data-blocked={collision}>
  {run.parent?<ParentStatus run={run} dispatch={dispatch}/>:((u||run.characterTime)&&<StudentEnergy run={run} dispatch={dispatch}/>)}<div className="journey-status"><span>{['出站通道',u?.vertical==='stairs'?'上楼梯':u?.vertical==='lift'?'直达电梯':'上楼扶梯','安检入口','候车大厅','检票闸机','列车门口'][beat?.stage??0]}</span><b>{run.stationBeat+1} / {run.stationJourney.length}</b></div>
  <div className={'runner-scene '+(!obstacle?'three-lane-road':'')} aria-label={obstacle?'被拦住，完成操作后才能继续':'三条跑道，左右切换躲开障碍'} onPointerDown={e=>{if(blocked)return;swipe.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start&&Math.abs(e.clientX-start.x)>30&&Math.abs(e.clientX-start.x)>Math.abs(e.clientY-start.y))change(e.clientX<start.x?-1:1);}} onPointerCancel={()=>{swipe.current=null;}}>
   <StationWorld run={run}/><div className="station-location"><b>{station.name}</b><span>{station.routes.find(r=>r.id===selectedPath(run))?.label??station.short}</span></div><div className="corridor-sign">{train?run.city.train+' · 08车厢':lift?'铁路出发 ↑':beat?.stage===4?run.gate+' · 检票':'铁路出发 · 向前跑'}</div>
   <div className="corridor-floor"><i/><i/><i/><i/></div>
   {!obstacle&&<><div className="lane-guides"><i/><i/></div>{wave&&<div className={'lane-obstacle '+(collision?'bumped':'')} data-obstacle-lane={wave.lane} style={{left:(16.67+wave.lane*33.33)+'%',top:(20+approach*49)+'%',transform:`translate(-50%,-50%) scale(${.65+approach*.35})`}}>{wave.kind==='人群'?<Users/>:<Luggage/>}<span>{wave.kind}</span></div>}</>}
   {obstacle&&<div className="runner-obstacle">
    {train?<TinyTrain doors/>:elder?<ElderArt showStudent={false} grandma={run.stationLuck.elder==='grandma'} scam={run.event?.id==='elder-outcome'&&run.stationLuck.elderScam}/>:lift&&u&&u.vertical!=='escalator'?<VerticalArt kind={u.vertical}/>:lift?<EscalatorArt state={run.escalatorLane!==null&&beat.id==='escalator-ride'?run.stationLuck.escalators[run.escalatorLane]:undefined}/>:bag?<div className="caught-bag"><Backpack size={40}/><span>肩带挂住了</span></div>:<div className="checkpoint-bar"><TrainFront size={24}/><span>{beat?.stage===4?'请先完成检票':'前方需要处理'}</span></div>}
   </div>}
   {obstacle&&<div className="stop-line"><LockKeyhole size={14}/>停！先解决眼前这件事</div>}
   <div className="runner-you" style={{left:obstacle?'50%':(16.67+(runner?.lane??1)*33.33)+'%'}}><LittleYou characterId={run.character.id} parentAppearance={run.parent?.appearance} childGap={run.parent?.gap} carrying={run.parent?.carrying} motion={moving?((u?.sprinting||run.characterTime?.sprinting||run.parent?.sprinting)?'sprinting':'running'):obstacle||collision?'panic':'waiting'}/></div>
   {!obstacle&&<div className={'lane-callout '+(collision?'collision':'')} role="status">{collision?`${directionHint}换道才能继续`:needDodge?`${['左','中','右'][dangerLane!]}道有${wave?.kind} · 快换道`:wave?'当前道路安全 · 继续前进':'这段畅通，继续向前'}</div>}
  </div>
  <div className="journey-track" aria-label="本段进度"><i style={{width:run.stationProgress*100+'%'}}/></div>
  <div className="journey-interaction">
   {children||<div className="run-panel"><div className="run-panel-heading"><h2>{beat?.label}</h2><span>{['左','中','右'][currentLane]}道</span></div><p className={'run-guidance '+(collision?'urgent':needDodge&&run.stationRunning?'caution':'')} role="status" aria-live="polite">{guidance}</p>
    {!run.stationRunning&&!collision&&<button className="run-start" disabled={blocked} onClick={()=>dispatch({type:'RUN_INPUT',held:true})}><Play size={22} fill="currentColor"/>开始前进 <span>点一次，自动往前走</span></button>}
    <div className="lane-controls"><button className={needDodge&&currentLane>0&&(safeDirection===-1||currentLane===1)?'suggested':''} aria-label="向左换道" disabled={blocked||currentLane===0} onClick={()=>change(-1)}><ArrowLeft/>向左换道</button><button className={needDodge&&currentLane<2&&(safeDirection===1||currentLane===1)?'suggested':''} aria-label="向右换道" disabled={blocked||currentLane===2} onClick={()=>change(1)}>向右换道<ArrowRight/></button></div>
    {run.stationRunning&&<div className="run-secondary"><button className="big-action sprint-forward" disabled={blocked||u?.exhausted||run.characterTime?.exhausted||run.parent?.exhausted||collision} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dispatch({type:'SPRINT_INPUT',held:true});}} onPointerUp={()=>dispatch({type:'SPRINT_INPUT',held:false})} onPointerCancel={()=>dispatch({type:'SPRINT_INPUT',held:false})} onLostPointerCapture={()=>dispatch({type:'SPRINT_INPUT',held:false})} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();dispatch({type:'SPRINT_INPUT',held:true});}}} onKeyUp={()=>dispatch({type:'SPRINT_INPUT',held:false})}><Footprints size={21}/><span>{collision?'先换道':u?.exhausted?'体力恢复后再冲':run.characterTime?.exhausted||run.parent?.exhausted?'精力耗尽':run.parent?'按住带孩子冲刺':'按住冲刺'}<small>松手恢复正常速度</small></span></button><button className="run-pause" disabled={blocked} onClick={()=>dispatch({type:'RUN_INPUT',held:false})}><Pause size={19}/>暂停</button></div>}
    <small className="run-keyboard-hint">键盘：← → 换道 · 空格冲刺 · P 暂停</small><span className="clock-mode">{clockRate(run)===1?'停下时游戏时间正常流逝':'跑动时 1 秒 = 4 秒游戏时间'}</span>
   </div>}
  </div>
 </section>;
}
