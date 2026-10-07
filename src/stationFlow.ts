import type {Run} from './engine';
import type {Point} from './navigation';
import {ESCALATOR_X} from './stationEncounters';
export type Target=Point&{id?:string;label:string;next?:number;detour?:boolean};
export function stationTarget(r:Run):Target{
 if(r.detour)return {...r.detour,detour:true};
 const encounter=r.encounters.find(e=>e.stage===r.stage&&!r.seen.includes(e.id));
 if(encounter)return encounter;
 if(r.stage===0)return {x:160,y:1190,label:'跟着铁路出发标识走',next:1};
 if(r.stage===1){
  if(r.escalatorLane===null)return {x:320,y:1188,id:'escalator-choice',label:'三部扶梯，选一部上楼'};
  if(!r.seen.includes('escalator-ride'))return {x:ESCALATOR_X[r.escalatorLane],y:1100,id:'escalator-ride',label:'走到 '+(r.escalatorLane+1)+' 号扶梯看看'};
  return {x:320,y:930,label:'走出扶梯，前面是安检',next:2};
 }
 if(r.stage===2)return {x:320,y:747,label:'通过安检，继续跑',next:3};
 if(r.stage===3)return {x:320,y:485,label:'赶到 12A 候检区',next:4};
 if(r.stage===4){
  if(!r.identityReady)return {x:320,y:365,id:'identity-search',label:'闸机就在前面，准备身份证'};
  if(!r.seen.includes('gates'))return {x:320,y:365,id:'gates',label:'看看哪条队伍更短'};
  return {x:68+(r.stationLane??3)*72,y:250,label:'去 '+((r.stationLane??3)+1)+' 号检票通道'};
 }
 return {x:320,y:93,label:'最后一步，上车！'};
}
