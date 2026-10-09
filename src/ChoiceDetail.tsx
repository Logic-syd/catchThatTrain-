type Effect={label:string;cost:boolean;time:boolean};
// Interpret only values already disclosed in the copy; queue outcomes stay hidden.
export function describeChoice(text:string):{effects:Effect[];note:string}{
 const effects:Effect[]=[];
 const pattern=/(心力（专注）|(?:孩子|家长)?(?:精力|体力|专注|敏捷|负重|疲劳|耐心|尿意)(?:上限)?|路程|恢复速度|速度)\s*([+＋−–-])\s*(\d+(?:\.\d+)?)(\s*%)?|([−-]\s*\d+\s*秒)/g;
 const remainder=text.replace(pattern,(_match,stat:string,sign:string,value:string,percent:string,time:string)=>{
  if(time){effects.push({label:time.replace(/^[−-]\s*(\d+)\s*秒$/,'−$1 秒'),cost:true,time:true});return '';}
  const increase=sign==='+'||sign==='＋',burden=/(?:负重|疲劳|尿意|路程)(?:上限)?$/.test(stat);
  effects.push({label:`${stat} ${increase?'+':'−'}${value}${percent?'%':''}`,cost:burden?increase:!increase,time:false});return '';
 });
 const note=remainder.split(/[·；;、]/).map(s=>s.trim().replace(/^[，,]+|[，,]+$/g,'')).filter(Boolean).join(' · ');
 return {effects:[...effects.filter(e=>e.cost),...effects.filter(e=>!e.cost)],note};
}
export default function ChoiceDetail({text}:{text:string}){
 if(!text)return null;
 const {effects,note}=describeChoice(text);
 return <small className="choice-detail">{effects.length>0&&<span className="choice-effects">{effects.map((effect,i)=><b key={i} className={(effect.time?'choice-time-cost ':'')+'choice-effect '+(effect.cost?'choice-cost':'choice-benefit')} aria-label={(effect.cost?'代价：':'收益：')+effect.label}>{effect.label}</b>)}</span>}{note&&<span className="choice-consequence">{note}</span>}</small>;
}
