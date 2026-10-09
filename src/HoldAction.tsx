import {useEffect,useRef,useState} from 'react';
import {useStationAction} from './StationActionContext';
export default function HoldAction({seconds,label,onComplete}:{seconds:number;label:string;onComplete:()=>void}){
 const [progress,setProgress]=useState(0),[holding,setHolding]=useState(false);const down=useRef(false),amount=useRef(0),done=useRef(false),callback=useRef(onComplete);callback.current=onComplete;
 const report=useStationAction();
 useEffect(()=>report({progress,active:holding,label}),[progress,holding,label,report]);
 const stop=()=>{down.current=false;setHolding(false);};
 const begin=()=>{if(done.current)return;down.current=true;setHolding(true);};
 useEffect(()=>{let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;if(!down.current||done.current)return;amount.current=Math.min(1,amount.current+dt/seconds);setProgress(amount.current);if(amount.current>=1){done.current=true;down.current=false;setHolding(false);callback.current();}},40);const reset=()=>{down.current=false;setHolding(false);};window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);return()=>{clearInterval(timer);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);};},[seconds]);
 return <div className="hold-operation"><button className="big-action" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);begin();}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();begin();}}} onKeyUp={stop}>{label}<b>{Math.round(progress*100)}%</b></button><div><i style={{width:progress*100+'%'}}/></div><p>按住完成，松手停止。前方未放行时不能跑。</p></div>;
}
