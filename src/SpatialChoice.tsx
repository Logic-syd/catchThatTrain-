import {localizeNode,translate} from './i18n';
import {useEffect,useRef,useState,type Dispatch} from 'react';
import type {Action,Run} from './engine';
import {focusWindow} from './studentConfig';
import {advanceSpatialMotion,buildSpatialScene,type Point,type SpatialInput,type SpatialScene} from './spatialChoice';
import './spatialChoice.css';
export {isHongqiaoSpatialEvent} from './spatialChoice';

const directions:Record<string,Point>={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};
const icons={stairs:'▱',lift:'↕',escalator:'↗',corridor:'↑',queue:'▥',sign:'➜',gate:'▥'};
export function SpatialChoice({run,dispatch,active=true}:{run:Run;dispatch:Dispatch<Action>;active?:boolean}){
 const scene=buildSpatialScene(run);if(!scene)return null;
 return <SpatialWalk key={`${run.id}:${run.event!.id}:${run.event!.revision??''}:${run.stationBeat}`} run={run} scene={scene} dispatch={dispatch} active={active}/>;
}
function SpatialWalk({run,scene,dispatch,active}:{run:Run;scene:SpatialScene;dispatch:Dispatch<Action>;active:boolean}){
 const [position,setPosition]=useState(scene.start),[target,setTarget]=useState<Point|null>(null),[blocked,setBlocked]=useState(false),[observation,setObservation]=useState(0);
 const positionRef=useRef(position),input=useRef<SpatialInput>(null),keys=useRef(new Set<string>()),pointer=useRef<number|null>(null),done=useRef(false),lastElapsed=useRef(run.eventElapsed),observing=useRef(false),observedTime=useRef(0),observedDone=useRef(false);
 const canInput=active&&run.phase==='station'&&!done.current;
 const stop=()=>{input.current=null;keys.current.clear();pointer.current=null;observing.current=false;setTarget(null);};
 const known=!!run.student?.observed||(run.student?.stats.focus??0)>=75;
 const observeSeconds=2.5/focusWindow(run.student!.stats.focus);
 useEffect(()=>{
  const dt=Math.max(0,run.eventElapsed-lastElapsed.current);lastElapsed.current=run.eventElapsed;
  if(!active||done.current){stop();return;}
  if(observing.current&&!known&&!observedDone.current){observedTime.current=Math.min(observeSeconds,observedTime.current+dt);setObservation(observedTime.current/observeSeconds);if(observedTime.current>=observeSeconds){observedDone.current=true;observing.current=false;dispatch({type:'OBSERVE'});}return;}
  const next=advanceSpatialMotion(scene,positionRef.current,input.current,dt);positionRef.current=next.position;setPosition(next.position);setBlocked(next.blocked);
  if(next.choiceIndex!==null){const choice=run.event?.choices[next.choiceIndex];if(choice){done.current=true;stop();dispatch({type:'CHOICE',choice,...run.event?.revision===undefined?{}:{eventRevision:run.event.revision}});}}
 },[run.eventElapsed,active]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener('blur',stop);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);document.addEventListener('visibilitychange',hidden);
  return()=>{input.current=null;observing.current=false;window.removeEventListener('blur',stop);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 const point=(element:HTMLElement,clientX:number,clientY:number)=>{const rect=element.getBoundingClientRect();return {x:Math.max(0,Math.min(scene.width,(clientX-rect.left)/rect.width*scene.width)),y:Math.max(0,Math.min(scene.height,(clientY-rect.top)/rect.height*scene.height))};};
 const aim=(p:Point)=>{input.current={target:p};setTarget(p);};
 const keyInput=()=>{const direction={x:0,y:0};for(const key of keys.current){const d=directions[key];direction.x+=d.x;direction.y+=d.y;}input.current=direction.x||direction.y?{direction}:null;};
 const styles=(p:Point,w?:number,h?:number)=>({left:`${p.x/scene.width*100}%`,top:`${p.y/scene.height*100}%`,...w===undefined?{}:{width:`${w/scene.width*100}%`},...h===undefined?{}:{height:`${h/scene.height*100}%`}});
 return <section className={`spatial-choice spatial-${scene.id}`} aria-label={translate("虹桥场景操作")}>
  <div className="spatial-heading"><strong>{localizeNode(scene.heading)}</strong><span>{localizeNode("体力 ")}{localizeNode(Math.round(run.student!.stamina))}/{localizeNode(run.student!.stats.energy)}</span></div>
  <p className="spatial-instruction">{localizeNode("按住地面引导小人，松手停下；走进入口才会选择。")}</p>
  <div className="spatial-floor" role="application" aria-label={translate("步行场景，按住地面或使用方向键与 WASD 引导人物，绕开障碍走入入口")} tabIndex={active?0:-1} aria-disabled={!active} style={{aspectRatio:`${scene.width}/${scene.height}`}}
   onPointerDown={e=>{if(!canInput||e.button!==0||pointer.current!==null)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);pointer.current=e.pointerId;keys.current.clear();observing.current=false;aim(point(e.currentTarget,e.clientX,e.clientY));}}
   onPointerMove={e=>{if(canInput&&pointer.current===e.pointerId)aim(point(e.currentTarget,e.clientX,e.clientY));}}
   onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
   onKeyDown={e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(directions[key]){e.preventDefault();if(!canInput)return;observing.current=false;keys.current.add(key);setTarget(null);keyInput();}}}
   onKeyUp={e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(directions[key]){e.preventDefault();keys.current.delete(key);keyInput();}}}>
   <div className="spatial-floor-grid" aria-hidden="true"/>
   {localizeNode(scene.exits.map(exit=><div className={`spatial-entrance entrance-${exit.kind} ${exit.status??''}`} key={exit.choiceIndex} data-choice-index={exit.choiceIndex} style={styles(exit,exit.width,exit.height)}>
    <strong><i aria-hidden="true">{localizeNode(icons[exit.kind])}</i>{localizeNode(exit.label)}</strong>
    {localizeNode(exit.people!==undefined&&<span className="spatial-people" aria-hidden="true">{localizeNode(Array.from({length:Math.min(exit.people,8)},(_,i)=><i key={i}/>))}</span>)}
    {localizeNode(exit.info.map((line,i)=><small key={i}>{localizeNode(line)}</small>))}
   </div>))}
   {localizeNode(scene.obstacles.map((obstacle,i)=><div key={i} className={`spatial-obstacle obstacle-${obstacle.kind}`} style={styles(obstacle,obstacle.width,obstacle.height)} aria-label={translate(`${obstacle.label}，需要绕开`)}><span aria-hidden="true">{localizeNode(obstacle.kind==='crowd'?'● ●':'▰ ▰ ▰')}</span></div>))}
   {localizeNode(target&&<i className="spatial-aim" aria-hidden="true" style={styles(target)}/>)}
   <span className={`spatial-player ${blocked?'is-blocked':''}`} data-x={position.x.toFixed(3)} data-y={position.y.toFixed(3)} style={styles(position)} aria-label={translate("你的位置")}><i className="spatial-player-head"/><i className="spatial-player-body"/><i className="spatial-player-bag"/><b>{localizeNode("你")}</b></span>
   <span className="spatial-floor-start" aria-hidden="true">{localizeNode("出发 ↑")}</span>
  </div>
  <p className="spatial-status" role="status">{localizeNode(blocked?'前面被挡住了，带小人从旁边绕过去。':'看清路牌和人群，再走进去。方向键 / WASD 也能移动。')}</p>
  {localizeNode(scene.id==='security-queue'&&!known&&<div className="spatial-observe"><button type="button" disabled={!active} className="soft-action" onPointerDown={e=>{if(!canInput||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);stop();observing.current=true;}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onPointerLeave={stop} onBlur={stop} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&canInput){e.preventDefault();input.current=null;observing.current=true;}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter')stop();}}>{localizeNode("按住观察队伍 ")}<b>{localizeNode(Math.round(observation*100))}%</b></button><small>{localizeNode("累计观察 ")}{localizeNode(Number(observeSeconds.toFixed(2)))}{localizeNode(" 秒；松手保留进度。")}</small></div>)}
  <p className="spatial-cost-note">{localizeNode("走位与观察按实际操作时间计时；入口显示的办理、步行或排队费用到达后结算。")}</p>
 </section>;
}
export default SpatialChoice;
