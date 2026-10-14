import {localizeNode,translate} from './i18n';
import {useEffect,useRef,useState} from 'react';
export default function HoldAction({seconds,label,onComplete}:{seconds:number;label:string;onComplete:()=>void}){
 const duration=Number.isFinite(seconds)&&seconds>0?seconds:1;
 const [progress,setProgress]=useState(0);const started=useRef<number|null>(null),elapsed=useRef(0),done=useRef(false),callback=useRef(onComplete);callback.current=onComplete;
 const advance=()=>{
  if(started.current===null||done.current)return;
  const now=performance.now();elapsed.current=Math.min(duration,elapsed.current+Math.max(0,now-started.current)/1000);started.current=now;
  setProgress(elapsed.current/duration);
  if(elapsed.current>=duration){done.current=true;started.current=null;callback.current();}
 };
 const stop=()=>{advance();started.current=null;};
 const start=()=>{if(!done.current&&started.current===null)started.current=performance.now();};
 useEffect(()=>{
  started.current=null;elapsed.current=0;done.current=false;setProgress(0);
  const timer=setInterval(advance,40),hidden=()=>{if(document.hidden)stop();};
  window.addEventListener('blur',stop);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);document.addEventListener('visibilitychange',hidden);
  return()=>{started.current=null;clearInterval(timer);window.removeEventListener('blur',stop);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);document.removeEventListener('visibilitychange',hidden);};
 },[duration]);
 return <div className="hold-operation"><button className="big-action" disabled={progress>=1} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);start();}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onPointerLeave={stop} onBlur={stop} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();start();}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter')stop();}}>{localizeNode(label)}<b>{localizeNode(Math.round(progress*100))}%</b></button><div role="progressbar" aria-label={translate(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><i style={{width:progress*100+'%'}}/></div><p>{localizeNode("累计按住 ")}{localizeNode(Number(duration.toFixed(2)))}{localizeNode(" 秒完成；松手暂停，进度保留。操作期间时间照常流逝。")}</p></div>;
}
