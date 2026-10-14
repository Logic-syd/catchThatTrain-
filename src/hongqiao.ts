import type {Run} from './engine';
import {STUDENT_DISTRACTIONS,studentDistractionPrompt} from './characterChallenges';

/** The first playable scene template. Other chapters keep their own flow. */
export type HongqiaoRunState={stationAutoRun?:boolean;roadsideActive?:string};
export const isHongqiaoPrototype=(s:Run)=>!!s.student&&s.city.id==='shanghai';
export const isRoadsideBeat=(s:Run,id=s.stationJourney[s.stationBeat]?.id)=>isHongqiaoPrototype(s)&&STUDENT_DISTRACTIONS.some(d=>d.id===id);
export function roadsidePrompt(s:Run){
 const id=s.stationJourney[s.stationBeat]?.id;
 if(s.phase!=='station'||!id||!isRoadsideBeat(s,id)||s.event||s.seen.includes(id)||s.student!.runner.blocked||s.stationProgress>=1)return undefined;
 return studentDistractionPrompt(id,s.student!);
}
export const ROADSIDE_ART:Record<string,{icon:string;label:string;action:string}>={
 'student-cat':{icon:'🐈',label:'小猫蹭过来了',action:'按住摸摸小猫'},
 'student-spectacle':{icon:'👀',label:'那边好热闹',action:'按住凑近看看'},
 'student-help-grandma':{icon:'👵',label:'奶奶想去电梯口',action:'按住扶稳奶奶'},
 'student-tea-shop':{icon:'🧋',label:'茶颜悦色不排队',action:'按住接过奶茶'},
};
