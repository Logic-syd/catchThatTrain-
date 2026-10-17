import type {Run} from './engine';
import {STUDENT_DISTRACTIONS,studentDistractionPrompt} from './characterChallenges';

/** Spatial entrances remain a Hongqiao template; continuous walking is shared by students. */
export type RoadsideOpportunity={id:string;revision:number};
export type RoadsideNotice=RoadsideOpportunity&{expiresAt:number};
export type HongqiaoRunState={stationAutoRun?:boolean;roadsideActive?:string;roadsideNotice?:RoadsideNotice;roadsideQueue?:RoadsideOpportunity[];roadsideQueued?:string[]};
export const ROADSIDE_SECONDS=5;
export const isHongqiaoPrototype=(s:Run)=>!!s.student&&s.city.id==='shanghai';
export const isStudentJourney=(s:Run)=>!!s.student;
export const isRoadsideBeat=(s:Run,id=s.stationJourney[s.stationBeat]?.id)=>isStudentJourney(s)&&STUDENT_DISTRACTIONS.some(d=>d.id===id);
export const roadsideSecondsRemaining=(s:Run)=>s.roadsideNotice?Math.max(0,s.roadsideNotice.expiresAt-s.elapsed):0;
const canOpenRoadside=(s:Run)=>s.phase==='station'&&!!s.student&&!s.event&&!s.student.runner.blocked;
export function roadsidePrompt(s:Run){
 const notice=s.roadsideNotice;
 if(!notice||!canOpenRoadside(s)||roadsideSecondsRemaining(s)<=0)return undefined;
 const prompt=studentDistractionPrompt(notice.id,s.student!);
 return prompt?{...prompt,revision:notice.revision}:undefined;
}
/** Called only by the reducer. Rendering cannot create, extend or restart a notice. */
export function updateRoadsideNotices(s:Run):Run{
 if(!isStudentJourney(s)||s.phase!=='station'){
  return s.roadsideNotice||s.roadsideQueue?.length?{...s,roadsideNotice:undefined,roadsideQueue:[]}:s;
 }
 let n=s;
 const id=s.stationJourney[s.stationBeat]?.id;
 if(id&&isRoadsideBeat(s,id)&&!s.roadsideQueued?.includes(id)&&!s.seen.includes(id)){
  n={...n,roadsideQueued:[...n.roadsideQueued??[],id],roadsideQueue:[...n.roadsideQueue??[],{id,revision:s.stationBeat}]};
 }
 if(n.roadsideNotice&&roadsideSecondsRemaining(n)<=1e-9){
  const expired=n.roadsideNotice;
  n={...n,roadsideNotice:undefined,seen:[...new Set([...n.seen,expired.id])],logs:[...n.logs,{title:'路过'+ROADSIDE_ART[expired.id].label+'，继续赶路',seconds:0,eventId:expired.id}]};
 }
 if(!n.roadsideNotice&&n.roadsideQueue?.length&&canOpenRoadside(n)){
  const [next,...queue]=n.roadsideQueue;
  n={...n,roadsideNotice:{...next,expiresAt:n.elapsed+ROADSIDE_SECONDS},roadsideQueue:queue};
 }
 return n;
}
export const ROADSIDE_ART:Record<string,{icon:string;label:string;action:string}>={
 'student-cat':{icon:'🐈',label:'小猫蹭过来了',action:'按住摸摸小猫'},
 'student-spectacle':{icon:'👀',label:'那边好热闹',action:'按住凑近看看'},
 'student-help-grandma':{icon:'👵',label:'奶奶想去电梯口',action:'按住扶稳奶奶'},
 'student-tea-shop':{icon:'🧋',label:'茶颜悦色不排队',action:'按住接过奶茶'},
};
