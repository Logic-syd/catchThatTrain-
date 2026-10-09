import {useEffect,useRef,type ReactNode} from 'react';
import {Backpack,CakeSlice,Check,Coffee,Cookie,Footprints,Luggage,Smartphone,Soup,TrainFront,type LucideIcon} from 'lucide-react';
import type {Run} from './engine';

type PrepScene={label:string;place:string;tone:string;Icon:LucideIcon};
const scenes:Record<string,PrepScene[]>={
 student:[
  {label:'小蛋糕',place:'朋友门口 · 要告别了',tone:'peach',Icon:CakeSlice},
  {label:'身份证',place:'路边 · 再摸摸书包',tone:'sage',Icon:Backpack},
  {label:'早餐',place:'便利店 · 肚子先叫了',tone:'honey',Icon:Soup},
 ],
 worker:[
  {label:'土特产',place:'家里玄关 · 妈妈还在装',tone:'honey',Icon:Luggage},
  {label:'再吃两口',place:'厨房门口 · 饭还热着',tone:'peach',Icon:Soup},
  {label:'老板消息',place:'出门路上 · 手机又响了',tone:'blue',Icon:Smartphone},
 ],
 tourist:[
  {label:'缓口气',place:'酒店门口 · 退房了',tone:'blue',Icon:Coffee},
  {label:'纪念品',place:'行李箱旁 · 轻装还是留念',tone:'honey',Icon:Luggage},
 ],
 mom:[
  {label:'上厕所',place:'家门口 · 最后问一次',tone:'sage',Icon:Footprints},
  {label:'带零食',place:'玄关 · 装好随身包',tone:'peach',Icon:Cookie},
 ],
};
function prepScenes(run:Run){return scenes[run.character.id]??scenes.student;}
function previousChoice(run:Run){return [...run.logs].reverse().find(log=>/^(prepare-|worker-prep-|tourist-prep-|parent-prep-)/.test(log.eventId??''));}
function ChoiceReceipt({run}:{run:Run}){
 const last=previousChoice(run);
 if(!last)return null;
 return <div className="prep-receipt" role="status"><Check size={17} aria-hidden="true"/><span><small>上一题已完成</small><b>{last.title}</b></span>{last.seconds>0&&<strong>−{last.seconds} 秒</strong>}</div>;
}

export default function PreparationFrame({run,step,title,story,stats,children,className='',note}:{run:Run;step:number;title:string;story:string;stats?:ReactNode;children:ReactNode;className?:string;note:string}){
 const steps=prepScenes(run),scene=steps[step],Icon=scene.Icon;
 const stepKey=`${run.id}:${run.character.id}:${step}`;
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  heading.current?.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
 },[stepKey]);
 return <section className={`student-preparation preparation-flow ${className} prep-tone-${scene.tone}`} aria-label="出门准备">
  <ol className="prep-steps" aria-label="准备进度">{steps.map((item,index)=><li key={item.label} className={index<step?'complete':index===step?'current':''} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={14} aria-hidden="true"/>:index+1}</span><b>{item.label}</b></li>)}</ol>
  <div className="prep-page" key={stepKey} onClickCapture={event=>{if(event.detail>1){event.preventDefault();event.stopPropagation();}}}>
   {step>0&&<ChoiceReceipt run={run}/>}
   <header className="prep-scene">
    <div className="prep-scene-top"><span className="prep-scene-art" aria-hidden="true"><Icon size={39}/></span><div><span className="prep-step-caption">{step===0?'出门之前':`进入第 ${step+1} 步`} · {step+1} / {steps.length}</span><b>{scene.place}</b></div><Footprints className="prep-scene-footprints" size={23} aria-hidden="true"/></div>
    <h2 ref={heading} tabIndex={-1}>{title}</h2><p>{story}</p>
   </header>
   {stats}
   {children}
   <small className="prep-next">{step<steps.length-1?`选完继续 → ${steps[step+1].label}`:'最后一题 · 选完就去坐地铁'}</small>
   <small className="prep-note">{note}</small>
  </div>
 </section>;
}

export function PreparationComplete({run}:{run:Run}){
 if(!previousChoice(run))return null;
 return <div className="prep-complete"><div className="prep-complete-heading"><TrainFront size={23}/><span><b>准备完成，去赶地铁！</b><small>下一步 · 选一条去车站的路线</small></span><Check size={20}/></div><ChoiceReceipt run={run}/></div>;
}
