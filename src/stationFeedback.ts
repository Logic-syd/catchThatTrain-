import type {Run} from './engine';

export function stationEventKey(run:Run){return `${run.id}:${run.stationBeat}:${run.event?.id??'travel'}`;}

export function completedStationAction(previous:Run,next:Run,selectedLabel?:string){
 if(previous.id!==next.id||!previous.event||next.event||next.phase!=='station')return null;
 const log=next.logs.slice(previous.logs.length).at(-1);
 if(!log)return null;
 const event=previous.event;
 const selected=event.choices.find(c=>c.label===selectedLabel);
 let title=selected?.outcome||selectedLabel||event.choices[0]?.label||log.title;
 if(event.id==='bj-entry')title=next.stationDecisions.at(-1)?.value==='east'?'东侧被拦下，已折返西侧入口':'从西侧入口进入安检区';
 if(event.id==='bj-tray')title='背包放稳了，通过安检';
 if(event.id==='security')title='剪刀已交给工作人员，安检放行';
 if(event.id==='identity-search')title='身份证找到了，拿好去刷卡';
 if(event.id==='gate-scan')title='绿灯亮了，检票通过！';
 if(event.id==='bag-snag')title='肩带解开了，背包拿回来了';
 if(event.id==='security-queue')title=(selectedLabel?`选了${selectedLabel}，`:'')+'已通过这段队伍';
 return {run:{...next,event,stationBeat:previous.stationBeat},title,seconds:log.seconds,nextLabel:next.stationJourney[next.stationBeat]?.label??'继续赶车'};
}
