import type {Choice,MetroRoute} from './data';
import type {Run} from './engine';

// A branch correction adds a local wait, never a second fare for the whole route.
export const METRO_BRANCH={stop:'龙溪路',waitSeconds:30,missSeconds:65} as const;
export type MetroTerminal='hongqiao'|'hangzhong';
export type MetroBranchState={terminal:MetroTerminal;platformVisit:number;waitPaid:boolean;misses:number};

export function line10BranchStopIndex(route:MetroRoute):number{
 const index=route.stops.indexOf(METRO_BRANCH.stop),line=route.lines.indexOf('10');
 if(index<1||index>=route.stops.length-1||line<0)return -1;
 const transfer=route.via?route.stops.indexOf(route.via):-1;
 if(line===0&&route.transfers&&transfer>=0&&transfer<=index)return -1;
 if(line>0&&(transfer<0||transfer>=index))return -1;
 return index;
}
export function planMetroBranch(route:MetroRoute,variant:number):MetroBranchState|undefined{
 return line10BranchStopIndex(route)<0?undefined:{terminal:variant<.5?'hangzhong':'hongqiao',platformVisit:0,waitPaid:false,misses:0};
}
function onLine10(s:Run){
 return !!s.route&&(s.metroTransferred?s.route.lines[1]==='10':s.route.lines[0]==='10');
}
export function currentMetroTerminal(s:Run):string|undefined{
 if(!s.metroBranch||!onLine10(s)||!['metro','arrival','transfer','metro-platform','metro-recovery'].includes(s.phase))return undefined;
 return s.metroBranch.terminal==='hongqiao'?'虹桥火车站':'航中路';
}
export function needsMetroBranchExit(s:Run):boolean{
 return !!s.route&&!!s.metroBranch&&onLine10(s)&&s.metroBranch.terminal==='hangzhong'&&s.metroStopIndex===line10BranchStopIndex(s.route);
}
export function isMetroBranchStop(s:Run):boolean{
 return !!s.route&&!!s.metroBranch&&onLine10(s)&&s.metroStopIndex===line10BranchStopIndex(s.route);
}
export function metroBoardingChoice(s:Run,terminal:MetroTerminal):Choice|undefined{
 if((terminal!=='hongqiao'&&terminal!=='hangzhong')||s.phase!=='metro-platform'||!isMetroBranchStop(s))return undefined;
 return terminal==='hongqiao'
  ?{id:'board-hongqiao',label:'等下一班 · 虹桥火车站',detail:`等车 −${METRO_BRANCH.waitSeconds} 秒，继续原路线`,seconds:METRO_BRANCH.waitSeconds,waitSeconds:METRO_BRANCH.waitSeconds}
  :{id:'board-hangzhong',label:'上眼前这班 · 航中路',detail:`不到火车站，折返 −${METRO_BRANCH.missSeconds} 秒`,seconds:METRO_BRANCH.missSeconds,waitSeconds:0};
}
export function pendingMetroBranchSeconds(s:Run,route=s.route):number{
 if(!route||s.route?.id!==route.id||!s.metroBranch||line10BranchStopIndex(route)<0||s.phase==='station'||s.stationJourney.length||s.phase==='result'&&s.success)return 0;
 if(s.phase==='metro-platform')return METRO_BRANCH.waitSeconds;
 // The destination is known only once the player boards the Line 10 segment.
 if(!currentMetroTerminal(s)&&s.phase!=='result')return 0;
 return s.metroBranch.terminal==='hangzhong'&&!s.metroBranch.waitPaid?METRO_BRANCH.waitSeconds:0;
}
