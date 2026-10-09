import type {TimeEntry} from '../src/timeLedger';
import type {Choice,EventConfig} from '../src/data';
import type {Run} from '../src/engine';
import type {BalanceCharacter} from './simulateBalance';

// A declared, reproducible reference, not a fitted model of real-player success.
export const REFERENCE_PLAYER={
 version:1,readingSeconds:5,followupSeconds:.75,tapSeconds:.28,arrivalSeconds:.6,
 sprintDuty:{student:.15,worker:.10,tourist:.06,mom:.08},
 preparation:{student:['skip','check','eat'],worker:['take-gifts','eat','reply'],tourist:['coffee','keep'],mom:['toilet-first','snacks-pack']} as Record<BalanceCharacter,string[]>,
 measurementAllowance:14400,
};
export type ReferenceMovement={movingSeconds:number;sprintSeconds:number;gateMovingSeconds:number;gateSprintSeconds:number};
export function referenceSprint(role:BalanceCharacter,movingSeconds:number,energy:number,maxEnergy:number,gap:number){
 // Ten moving seconds per cycle; events and queues do not advance this clock.
 const duty=REFERENCE_PLAYER.sprintDuty[role];
 const phase=(movingSeconds+1e-7)%10;
 return phase>=5-5*duty&&phase<5+5*duty&&energy>maxEnergy*.3&&gap<3;
}

/** Only displayed words select the answer. Never inspect seconds, optimal, random
 * outcomes, or invisible escalator state. New unhandled events fail the audit. */
export function referenceChoice(s:Run,event:EventConfig):Choice{
 const choices=event.choices;
 if(choices.length===1)return choices[0];
 const find=(pattern:RegExp)=>choices.find(c=>pattern.test(c.label+' '+c.detail));
 let chosen:Choice|undefined;
 switch(event.id){
  case 'sh-corridor':chosen=find(/沿墙走外侧/);break;
  case 'bj-entry':chosen=find(/西侧/);break;
  case 'gz-route':chosen=find(/走外围连桥/);break;
  case 'hz-fork':chosen=find(/往右.*铁路出发/);break;
  case 'hz-zone':chosen=find(/右侧 B/);break;
  case 'wh-floor':chosen=find(/2F/);break;
  case 'zz-wing':chosen=find(/右侧连廊/);break;
  case 'zz-number':chosen=choices.find(c=>c.label===s.gate);break;
  case 'station-sign':chosen=find(/按头顶的数字范围/);break;
  case 'vertical-choice':{
   const energy=s.student?.stamina??s.characterTime?.energy??s.parent!.energy;
   chosen=find(s.parent?(/三部扶梯/):energy>=30?(/楼梯/):(/等直达电梯/));break;
  }
  case 'gz-lift':chosen=find((s.student?.stamina??s.characterTime?.energy??0)>=30?/楼梯/:/电梯/);break;
  case 'escalator-choice':chosen=find(/2 号扶梯/);break; // blind corner: fixed lane, no oracle
  case 'escalator-ride':chosen=find(/站稳/);break;
  case 'elder-block':chosen=find(/不推/);break;
  case 'zz-hometown':chosen=find(s.character.id==='worker'?/不告诉/:/礼貌说/);break;
  case 'zz-hometown-answer':chosen=find(/说真话/);break;
  case 'gates':chosen=find(/证件都拿在手里/);break;
  case 'security-queue':chosen=find(/只背小包|轻装旅客/);break;
  case 'metro-announcement':chosen=find(/先去门口/);break;
  case 'metro-crowded-door':chosen=find(/提前挪/);break;
  case 'metro-transfer-sign':chosen=find(/确认/);break;
  case 'tourist-sleep':chosen=find(/提前 1/)??find(/提前 2/)??find(/提前 3/)??find(/撑着/);break;
  case 'tourist-wake':chosen=find(/醒醒/);break;
  case 'tourist-wheel':chosen=find(/调整轮子/);break;
  case 'tourist-wayfinding':chosen=find(/看楼层地图/);break;
  case 'worker-boss-call':chosen=find(/接起来/);break;
  case 'sh-parent-shop':chosen=find(/拿水壶/)??find(/买瓶水/);break;
  case 'bj-parent-strict':chosen=find(/分开放/);break;
  case 'hz-parent-lift':chosen=find(/右侧/);break;
  case 'wh-parent-duck':chosen=find(/上车再吃/);break;
  case 'wh-parent-duck-repeat':chosen=find(/一份零食/)??find(/上车再买/);break;
  case 'parent-gap':chosen=find(/停下等/);break;
  case 'parent-toilet':chosen=find(/现在去/);break;
  case 'parent-tired':chosen=find(/抱起来/);break;
  case 'parent-patience':chosen=find(/一份零食/)??find(/好好说/);break;
  case 'old-ticket':chosen=find(/核对今天/);break;
 }
 if(!chosen)throw Error('Reference policy needs a visible-clue rule: '+event.id);
 return chosen;
}

// Accounting convention for this reference. Normal security queue, tray, gate
// queue, and character care stay in necessary operations. These are encountered
// environmental responses, not a claim of pure unavoidable RNG or a 75s cap.
export function isReferenceEnvironment(source:string){
 return /^(map-(door|landing|crowd|child|closed)|bag-snag|elder-|suitcase|security(?=:|$)|metro-crowded-door|metro-transfer-sign|metro-announcement|escalator-operation|escalator-ride|tourist-wheel)/.test(source);
}

export function referenceEnvironmentSeconds(entry:TimeEntry){
 // Reading/holding/tapping is already a necessary operation, even when a
 // random obstacle prompted it. Only its extra wait or fixed response is here.
 if(entry.category==='obstructionWait')return entry.seconds;
 if(entry.category!=='eventCost')return 0;
 if(/^escalator-(operation|ride)/.test(entry.source))return Math.max(0,entry.seconds-15);
 return isReferenceEnvironment(entry.source)?entry.seconds:0;
}
