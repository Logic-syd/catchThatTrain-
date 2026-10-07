import {StationWorld,StationMap} from './StationMaps';
import {stationFor,selectedPath} from './stations';
import {StudentEnergy} from './StudentUI';
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
 const runner=u?.runner??run.characterTime?.runner;const wave=runnerWave(run),collision=!!runner?.blocked;
 const moving=run.stationRunning&&!blocked&&!collision&&!run.characterTime?.exhausted;
 const obstacle=run.event;
 const elder=beat?.id==='elder-block',lift=beat?.id.startsWith('escalator'),bag=beat?.id==='bag-snag',train=beat?.id==='board-train';
 const approach=wave?Math.min(1,Math.max(0,(run.stationProgress-wave.from)/(wave.at-wave.from))):0;
 const change=(direction:-1|1)=>dispatch({type:'CHANGE_LANE',direction});
 return <section className={'station-journey lane-journey layout-'+station.id+' '+(moving?'running ':'')+(obstacle||collision?'obstructed':'')} data-beat={beat?.id} data-progress={run.stationProgress.toFixed(3)} data-lane={runner?.lane??1} data-blocked={collision}>
  {(u||run.characterTime)&&<StudentEnergy run={run} dispatch={dispatch}/>}<div className="journey-status"><span>{['出站通道',u?.vertical==='stairs'?'上楼梯':u?.vertical==='lift'?'直达电梯':'上楼扶梯','安检入口','候车大厅','检票闸机','列车门口'][beat?.stage??0]}</span><b>{run.stationBeat+1} / {run.stationJourney.length}</b></div>
  <div className={'runner-scene '+(!obstacle?'three-lane-road':'')} aria-label={obstacle?'被拦住，完成操作后才能继续':'三条跑道，左右切换躲开障碍'} onPointerDown={e=>{if(blocked)return;swipe.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start&&Math.abs(e.clientX-start.x)>30&&Math.abs(e.clientX-start.x)>Math.abs(e.clientY-start.y))change(e.clientX<start.x?-1:1);}} onPointerCancel={()=>{swipe.current=null;}}>
   <StationWorld run={run}/><div className="station-location"><b>{station.name}</b><span>{station.routes.find(r=>r.id===selectedPath(run))?.label??station.short}</span></div><div className="corridor-sign">{train?run.city.train+' · 08车厢':lift?'铁路出发 ↑':beat?.stage===4?run.gate+' · 检票':'铁路出发 · 向前跑'}</div>
   <div className="corridor-floor"><i/><i/><i/><i/></div>
   {!obstacle&&<><div className="lane-guides"><i/><i/></div>{wave&&<div className={'lane-obstacle '+(collision?'bumped':'')} data-obstacle-lane={wave.lane} style={{left:(16.67+wave.lane*33.33)+'%',top:(20+approach*49)+'%',transform:`translate(-50%,-50%) scale(${.65+approach*.35})`}}>{wave.kind==='人群'?<Users/>:<Luggage/>}<span>{wave.kind}</span></div>}</>}
   {obstacle&&<div className="runner-obstacle">
    {train?<TinyTrain doors/>:elder?<ElderArt showStudent={false} grandma={run.stationLuck.elder==='grandma'} scam={run.event?.id==='elder-outcome'&&run.stationLuck.elderScam}/>:lift&&u&&u.vertical!=='escalator'?<VerticalArt kind={u.vertical}/>:lift?<EscalatorArt state={run.escalatorLane!==null&&beat.id==='escalator-ride'?run.stationLuck.escalators[run.escalatorLane]:undefined}/>:bag?<div className="caught-bag"><Backpack size={40}/><span>肩带挂住了</span></div>:<div className="checkpoint-bar"><TrainFront size={24}/><span>{beat?.stage===4?'请先完成检票':'前方需要处理'}</span></div>}
   </div>}
   {obstacle&&<div className="stop-line"><LockKeyhole size={14}/>停！先解决眼前这件事</div>}
   <div className="runner-you" style={{left:obstacle?'50%':(16.67+(runner?.lane??1)*33.33)+'%'}}><LittleYou characterId={run.character.id} motion={moving?((u?.sprinting||run.characterTime?.sprinting)?'sprinting':'running'):obstacle||collision?'panic':'waiting'}/></div>
   {!obstacle&&<div className={'lane-callout '+(collision?'collision':'')} role="status">{collision?'被挡住了！左右换到空道继续':wave?`${['左','中','右'][wave.lane]}道有${wave.kind} · 提前避让`:'这段畅通，继续向前'}</div>}
  </div>
  <div className="journey-track" aria-label="本段进度"><i style={{width:run.stationProgress*100+'%'}}/></div>
  <div className="journey-interaction">
   {children||<div className="run-panel"><h2>{beat?.label}</h2><p>开始后自动向前 · 左右躲障碍 · 冲刺更快</p>
    <div className="lane-controls"><button aria-label="向左换道" disabled={blocked||runner?.lane===0} onClick={()=>change(-1)}><ArrowLeft/>向左</button><button className="run-toggle" disabled={blocked} onClick={()=>dispatch({type:'RUN_INPUT',held:!run.stationRunning})}>{run.stationRunning?<Pause/>:<Play/>}{run.stationRunning?'歇一下':'开始前进'}</button><button aria-label="向右换道" disabled={blocked||runner?.lane===2} onClick={()=>change(1)}>向右<ArrowRight/></button></div>
    <button className="big-action sprint-forward" disabled={blocked||u?.exhausted||run.characterTime?.exhausted||collision} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dispatch({type:'SPRINT_INPUT',held:true});}} onPointerUp={()=>dispatch({type:'SPRINT_INPUT',held:false})} onPointerCancel={()=>dispatch({type:'SPRINT_INPUT',held:false})} onLostPointerCapture={()=>dispatch({type:'SPRINT_INPUT',held:false})} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();dispatch({type:'SPRINT_INPUT',held:true});}}} onKeyUp={()=>dispatch({type:'SPRINT_INPUT',held:false})}><Footprints size={22}/>{collision?'先左右避开障碍':u?.exhausted?'恢复到 15 再冲':run.characterTime?.exhausted?'精力耗尽，先休息':'按住冲刺'}<small>松手恢复普通前进</small></button>
    <small>← → / A D 换道 · 空格冲刺 · P 休息</small><span className="clock-mode">{clockRate(run)===1?'阅读 / 休息：时间正常流逝':'赶路中：1 秒 = 4 秒游戏时间'}</span>
   </div>}
  </div>
 </section>;
}
