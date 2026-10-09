import {useEffect,useRef,type Dispatch} from 'react';
import {Footprints,Zap} from 'lucide-react';
import type {Run,Action} from './engine';
import {trainPoint} from './stationMapTravel';
import {LittleYou} from './LittleYou';
import {stationAvatarEffort,stationAvatarMotion} from './stationMotion';
import './stationRunControls.css';

export default function StationRunControls({run,dispatch,blocked}:{run:Run;dispatch:Dispatch<Action>;blocked:boolean}){
 const latest=useRef({run,blocked});latest.current={run,blocked};
 const held=useRef<'walk'|'sprint'|null>(null),space=useRef(false);
 const stop=()=>{held.current=null;space.current=false;dispatch({type:'RUN_INPUT',held:false});};
 const start=(kind:'walk'|'sprint')=>{
  const {run:s,blocked}=latest.current;
  if(blocked||s.event||s.stationMap?.block)return;
  held.current=kind;
  if(!s.stationMap?.path.length)dispatch({type:'MAP_TARGET',point:trainPoint(s)});
  dispatch({type:'RUN_INPUT',held:true});
  if(kind==='sprint')dispatch({type:'SPRINT_INPUT',held:true});
 };
 const release=(kind:'walk'|'sprint')=>{if(held.current===kind)stop();};
 useEffect(()=>{if(blocked)stop();},[blocked,dispatch]);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLButtonElement||e.target instanceof SVGElement||e.target instanceof HTMLInputElement)return;
   if(e.code==='Space'&&!e.repeat){e.preventDefault();space.current=true;start(e.shiftKey?'sprint':'walk');}
   if(e.code.startsWith('Shift')&&space.current&&!e.repeat)start('sprint');
  };
  const up=(e:KeyboardEvent)=>{if(e.code==='Space'){e.preventDefault();stop();}else if(e.code.startsWith('Shift')&&space.current)start('walk');};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);stop();};
 },[dispatch]);
 const moving=run.stationRunning&&!blocked,sprint=!!(run.student?.sprinting||run.characterTime?.sprinting||run.parent?.sprinting),effort=stationAvatarEffort(run);
 const strain=run.student?.sprintStrain??0,hasRoute=!!run.stationMap?.path.length;
 const speech=effort==='exhausted'?'呼…呼…真的跑不动了！':strain>=4.5?'呼…快岔气了！':effort==='strained'?'腿好重…还得赶上！':sprint?'快点！这趟车我一定要上！':moving?'在赶了，在赶了！':hasRoute?'缓口气，接着跑！':'得走了，车可不等人！';
 const instruction=effort==='exhausted'?'松手停下恢复更快，也可以按住赶路慢走。':strain>=4.5?'松开冲刺，按住赶路慢走，先把呼吸稳住。':run.stationMap?.bypassing?'按住赶路，小人会侧身绕过前面的人。':moving?'按住赶路稳着走；换按冲刺会加速，也更费体力。':hasRoute?'路线还在。按住赶路继续，松手就停下。':'按住赶路开始前进。点地图通道可以换一条路。';
 return <>
  <div className={'run-reaction effort-'+effort+(sprint?' sprinting':'')}>
   <LittleYou characterId={run.character.id} parentAppearance={run.parent?.appearance} childGap={run.parent?.gap} carrying={run.parent?.carrying} motion={stationAvatarMotion(run,blocked)} effort={effort} facing="front"/>
   <div><b>{speech}</b><p>{instruction}</p>{run.student&&<div className="run-breath"><span>{strain>=4.5?'快岔气了':'呼吸负荷'}</span><meter min={0} max={7} value={strain}/></div>}</div>
  </div>
  <div className="map-run-controls hold-run-controls">
   {(['walk','sprint'] as const).map(kind=><button key={kind} className={kind==='walk'?'map-walk':'map-sprint'} disabled={blocked||(kind==='sprint'&&effort==='exhausted')} aria-pressed={moving&&(kind==='sprint'?sprint:!sprint)}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);start(kind);}} onPointerUp={()=>release(kind)} onPointerCancel={()=>release(kind)} onLostPointerCapture={()=>release(kind)} onContextMenu={e=>e.preventDefault()}
    onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start(kind);}}} onKeyUp={()=>release(kind)}>
    {kind==='walk'?<Footprints/>:<Zap/>}<span>{kind==='walk'?'按住赶路':effort==='exhausted'?'喘口气再冲':'按住冲刺'}</span><small>{kind==='walk'?'稳着走，调整呼吸':'更快，别一直猛冲'}</small>
   </button>)}
  </div>
  <p className="hold-run-tip">松手＝停下喘气 · 空格赶路，Shift＋空格冲刺</p>
 </>;
}
