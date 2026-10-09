import type {Action,Run} from './engine';

export type MeaningfulOperation={id:string;label:string;phase:Run['phase']};
// A whole hold/swipe/tap task counts once. Waiting, repeat presses, wrong-pocket
// retries and repeatedly switching the same queue never inflate this count.
export function completedOperation(s:Run,n:Run,a:Action):MeaningfulOperation|null{
 if(n===s||a.type==='TICK'||a.type==='NEW')return null;
 const op=(id:string,label:string):MeaningfulOperation=>({id,label,phase:s.phase});
 if(a.type==='PREP_PICK'&&n.student?.prep!==s.student?.prep)return op('prep:'+a.step,n.logs.at(-1)?.title??'出门准备');
 if(a.type==='PERSON_PICK'&&n.characterTime?.prepStep!==s.characterTime?.prepStep)return op('prep:'+a.step,n.logs.at(-1)?.title??'出门准备');
 if(a.type==='PARENT_PREP'&&n.parent?.prepStep!==s.parent?.prepStep)return op('prep:'+a.step,n.logs.at(-1)?.title??'出门准备');
 if(a.type==='ROUTE'&&s.phase==='route'&&n.phase==='direction')return op('metro:route','选择地铁线路');
 if(a.type==='DIRECTION'&&s.phase==='direction'&&n.phase!==s.phase)return op('metro:direction','认方向上车');
 if(a.type==='ALIGHT'&&s.phase==='arrival'&&n.phase==='station')return op('metro:alight','认准车站下车');
 if((a.type==='POCKET_PICK'||a.type==='ID_PICK')&&!s.identityReady&&n.identityReady)return op('identity','找到身份证');
 if(a.type==='MAP_CLEAR'&&s.stationMap?.block){
  const block=s.stationMap.block;
  const changed=n.stationMap?.block?.mode!==block.mode||n.stationMap?.block?.lane!==block.lane;
  if(changed)return op(block.id+':'+(a.method==='join'?'queue':a.method==='tray'?'tray':'pass'),a.method==='join'?'选安检队':a.method==='tray'?'放包过安检':'处理眼前的阻碍');
 }
 if(a.type==='CHOICE'&&s.event&&(n.stationBeat!==s.stationBeat||n.event?.id!==s.event.id||n.logs.length>s.logs.length)){
  const occurrence=s.stationJourney.slice(0,s.stationBeat).filter(b=>b.id===s.stationJourney[s.stationBeat]?.id).length;
  return op('event:'+s.event.id+':'+occurrence,a.choice.label);
 }
 return null;
}
