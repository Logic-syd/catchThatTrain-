import type {Run,Action} from './engine';
import type {Choice,EventConfig} from './data';
import {STUDENT,teaRecoveryActive} from './studentConfig';
import {advanceCharacterWait,characterWaitOverrides} from './characterTime';
import {advanceParentWait,parentWaitOverrides} from './parent';

export type WaitResource='energy'|'fatigue'|'childEnergy'|'patience';
export type WaitPlan={seconds:number;excluded:readonly WaitResource[]};
export function isPassiveWait(s:Run){return !['lobby','result','transfer','wrong','metro-recovery'].includes(s.phase);}

/** Fixed costs describe activities, not additional animation time. Unclassified
 * handling/walking costs never grant standing-rest recovery. New waiting choices
 * should supply waitSeconds; existing task IDs are migrated here. */
export function fixedWaitPlan(s:Run,c:Choice,eventId=s.event?.id):WaitPlan{
 let seconds=c.waitSeconds;
 const option=c.id??c.stationDecision?.value??c.studentEffect;
 if(seconds===undefined){
  const ordinary=['security-queue','gates','old-ticket','worker-boss-call','zz-hometown','metro-announcement','student-breath'];
  const wait=ordinary.includes(eventId??'')
   ||(eventId==='vertical-choice'||eventId==='gz-lift')&&option==='lift'
   ||(eventId==='escalator-operation'||eventId==='escalator-ride')&&c.seconds>0
   ||eventId==='broken-lift'&&c.seconds===65
   ||eventId==='parent-gap'&&option==='wait'
   ||eventId==='parent-tired'&&option==='rest'
   ||eventId==='parent-patience'
   ||eventId==='parent-toilet'&&option==='toilet'
   ||eventId==='parent-accident'
   ||eventId==='sh-parent-shop'&&(option==='water'||option==='buy')
   ||(eventId==='wh-parent-duck'||eventId==='wh-parent-duck-repeat')&&(option==='buy'||option==='snack')
   ||eventId==='bj-parent-strict'
   ||eventId==='metro-crowded-door'&&option==='wait';
  seconds=wait?Math.max(0,c.seconds-(c.fixedWalkSeconds??0)):0;
 }
 const excluded:WaitResource[]=s.parent?[...parentWaitOverrides(eventId??'',c)]:s.characterTime?[...characterWaitOverrides(eventId??'',c)]:[];
 if(s.student&&(eventId==='student-breath'||eventId==='gz-lift'))excluded.push('energy');
 return {seconds:Math.max(0,Math.min(c.seconds,seconds)),excluded};
}

/** Only passive resources. Movement, reserve use, biological urine, timers and
 * task completion effects retain their own single settlement points. */
export function advanceWaitingResources(s:Run,gameSeconds:number,excluded:readonly WaitResource[]=[]):Run{
 if(!Number.isFinite(gameSeconds)||gameSeconds<=0)return s;
 if(s.student&&!excluded.includes('energy')){
  const u=s.student;
  const boosted=s.phase==='station'&&teaRecoveryActive(u)?Math.min(gameSeconds,Math.max(0,180-(u.stationElapsedGame??0))):0;
  const rate=STUDENT.recover*(.65+u.stats.energy/100*.4667)*(1-u.stats.load/250)*(u.late?STUDENT.lateRecovery:1);
  const stamina=Math.max(0,Math.min(u.stats.energy,u.stamina+rate*(gameSeconds+.2*boosted)));
  const exhausted=stamina<=0||u.exhausted&&stamina<15;
  s={...s,student:{...u,stamina,exhausted,sprinting:exhausted?false:u.sprinting}};
 }
 if(s.characterTime){const characterTime=advanceCharacterWait(s.characterTime,gameSeconds,excluded.filter((k):k is 'energy'|'fatigue'=>k==='energy'||k==='fatigue'));s={...s,characterTime,stamina:characterTime.energy};}
 if(s.parent){const parent=advanceParentWait(s.parent,s.phase,gameSeconds,excluded.filter((k):k is 'energy'|'childEnergy'|'patience'=>k!=='fatigue'));s={...s,parent,stamina:parent.energy};}
 return s;
}

/** Derive waiting from time actually charged, never add the time a second time. */
export function settleWaiting(s:Run,n:Run,a:Action,moving:boolean):Run{
 const spent=Math.max(0,s.remaining-n.remaining);
 if(n===s||spent<=0||a.type==='NEW'||s.phase==='lobby'||s.phase==='result')return n;
 let seconds=0,excluded:readonly WaitResource[]=[];
 if(a.type==='TICK'){
  if(!moving&&s.phase==='metro'&&!s.event&&s.route){
    // Fare includes access/transfer walking. Only the ride itself is seated time.
    const progress=Math.max(0,n.metroProgress-s.metroProgress);
    seconds=progress*s.route.minutes*60+Math.min(a.dt,Math.max(0,spent-progress*s.metroDuration));
  }
  // A hesitation penalty represents additional stationary delay, not movement.
  if(s.event&&n.eventOverdue&&!s.eventOverdue)seconds+=Math.max(0,spent-a.dt);
  else if(s.event&&!n.event&&spent>a.dt){
   const last=s.event.choices.at(-1);
   if(last){const plan=fixedWaitPlan(s,{...last,seconds:spent-a.dt,waitSeconds:undefined,fixedWalkSeconds:undefined});seconds+=plan.seconds;excluded=plan.excluded;}
  }
 }else if(a.type==='CHOICE'&&s.event){
  const c=s.event.choices.find(c=>a.choice.id?c.id===a.choice.id:c.label===a.choice.label);
  if(c){const plan=fixedWaitPlan(s,c);seconds=Math.min(spent,plan.seconds);excluded=plan.excluded;}
  if(s.event.id==='elder-block'&&n.event?.id==='elder-outcome'&&s.stationLuck.elderScam)seconds=spent;
 }else if(a.type==='PARENT_PREP'&&a.option==='toilet-first'&&s.parent?.prepStep!==n.parent?.prepStep){
  seconds=spent;
 }
 if(seconds<=0)return n;
 // Use the activity's starting phase and tea window even when it completes a beat.
 const waiting=advanceWaitingResources({...n,phase:s.phase,student:n.student?{...n.student,stationElapsedGame:s.student?.stationElapsedGame}:undefined},seconds,excluded);
 return {...waiting,phase:n.phase};
}

export function waitingFeedback(s:Run,event:EventConfig):EventConfig{
 if(!s.student&&!s.characterTime&&!s.parent)return event;
 const names={energy:s.student?'体力':'精力',fatigue:'疲劳',childEnergy:'孩子体力',patience:'耐心'};
 return {...event,choices:event.choices.map(c=>{
  const plan=fixedWaitPlan(s,c,event.id);if(!plan.seconds)return c;
  const after=advanceWaitingResources(s,plan.seconds,plan.excluded);
  const before=s.parent??s.characterTime??(s.student?{energy:s.student.stamina}:{});
  const next=after.parent??after.characterTime??(after.student?{energy:after.student.stamina}:{});
  const changes=(Object.keys(names) as WaitResource[]).flatMap(key=>{
   if(!(key in before)||!(key in next))return [];
   const delta=(next as Record<string,number>)[key]-(before as Record<string,number>)[key];
   if(Math.abs(delta)<.005)return [];
   return [`${names[key]} ${delta<0?'−':'+'}${Number(Math.abs(delta).toFixed(2))}`];
  });
  const base=c.detail.split('；等待期间：')[0];
  return {...c,waitSeconds:plan.seconds,detail:base+(changes.length?`；等待期间：${changes.join(' · ')}`:'')};
 })};
}
