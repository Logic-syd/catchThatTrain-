import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {STATIONS} from './stations';
import {STUDENT_DISTRACTIONS,WORK_CHALLENGE_IDS,applyStudentDistraction} from './characterChallenges';
import {movementSpeed} from './timeModel';
import {createGameResult} from './gameResult';
import {parentBlockPrompt} from './parent';
function at(who:'student'|'worker'|'tourist'|'mom',id:string,station='shanghai'):Run{
 const base=createCharacterStationRun(station,who,false,()=>.5),stationJourney=buildStationJourney(base),stationBeat=stationJourney.findIndex(b=>b.id===id);
 expect(stationBeat).toBeGreaterThanOrEqual(0);
 const s={...base,phase:'station' as const,stationJourney,stationBeat,stationProgress:1};return {...s,event:journeyPrompt(s)};
}
function choose(s:Run,id:string){const c=s.event!.choices.find(c=>c.id===id)!;expect(c).toBeDefined();return reducer(s,{type:'CHOICE',choice:c,eventRevision:s.event!.revision});}
describe('人物难点的完整状态链路',()=>{
 it.each(STATIONS)('$id: four temptations, three new company requests and a maze only appear for the corresponding character',st=>{
  const ids=(who:'student'|'worker'|'tourist'|'mom')=>buildStationJourney(createCharacterStationRun(st.id,who,false,()=>.5)).map(b=>b.id);
  for(const d of STUDENT_DISTRACTIONS){expect(ids('student')).toContain(d.id);expect(ids('worker')).not.toContain(d.id);}
  for(const id of WORK_CHALLENGE_IDS){expect(ids('worker')).toContain(id);expect(ids('student')).not.toContain(id);}
  expect(ids('tourist')).toContain('tourist-maze');expect(ids('mom')).not.toContain('tourist-maze');
 });
 it('emotional gains do not enter speed, stamina, focus or capacity, and the actual stop is charged once',()=>{
  const s=at('student','student-cat'),u=s.student!,after=applyStudentDistraction(u,'student-cat','indulge');
  expect(after.happiness).toBe(20);expect(after.stats).toEqual(u.stats);expect(after.stamina).toBe(u.stamina);
  expect(movementSpeed({...s,student:after})).toBe(movementSpeed(s));
  const n=choose(s,'indulge');expect(s.remaining-n.remaining).toBe(30);expect(n.student!.distractionSeconds).toBe(30);
  expect(n.student!.happiness).toBe(20);expect(createGameResult(n).characterStats.distractions).toBe(1);
  expect(reducer(n,{type:'CHOICE',choice:s.event!.choices[0]})).toBe(n);
 });
 it('helping grandma records morality, walking cost and no energy gift; leaving charges zero',()=>{
  const s=at('student','student-help-grandma');s.student={...s.student!,stamina:20};
  const n=choose(s,'indulge');expect(n.student!.morality).toBe(20);expect(n.student!.stamina).toBe(20);
  expect(s.remaining-n.remaining).toBe(35);expect(choose(s,'leave').student!.morality).toBe(0);
 });
 it('preparation reply cancels its old reminder but new company requests still occur; ignoring makes the later reply longer',()=>{
  let s=at('worker','worker-company-ping');s.characterTime={...s.characterTime!,bossUnread:false,bossCallsLeft:0};
  const n=choose(s,'ignore');expect(n.characterTime!.workPending).toBe(1);expect(n.characterTime!.workInterruptions).toBe(1);
  const index=n.stationJourney.findIndex(b=>b.id==='worker-company-revision'),later={...n,stationBeat:index};
  const e=journeyPrompt(later);expect(e.choices.find(c=>c.id==='boundary')!.seconds).toBe(20);
  const cleared=choose({...later,event:e},'boundary');expect(cleared.characterTime!.workPending).toBe(0);
  expect(cleared.stationJourney.some(b=>b.id==='worker-company-call')).toBe(true);
 });
 it.each(STATIONS)('$id: visible signs give a three-passage route; asking never skips movement',st=>{
  let s=at('tourist','tourist-maze',st.id);const initial=s.remaining,beat=s.stationBeat;
  for(let i=0;i<3;i++){
   s=choose(s,i===0?'ask':'sign');expect(s.stationBeat).toBe(beat);
   const direction=s.event!.description.includes('往左')?'left':'right';s=choose(s,direction);
  }
  expect(s.touristMaze!.found).toBe(true);expect(s.touristMaze!.steps).toBe(3);expect(s.touristMaze!.wrongTurns).toBe(0);
  expect(s.stationBeat).toBe(beat+1);expect(initial-s.remaining).toBe(88);
 });
 it('maze turns can return to a visited node; movement charges only its advertised cost and stale revisions cannot repeat it',()=>{
  let s=at('tourist','tourist-maze');s.characterTime={...s.characterTime!,energy:20};
  const old=s,first=choose(s,'right');expect(first.touristMaze!.node).toBe(3);expect(first.characterTime!.energy).toBe(18);
  expect(old.remaining-first.remaining).toBe(20);
  expect(reducer(first,{type:'CHOICE',choice:old.event!.choices[1],eventRevision:old.event!.revision})).toBe(first);
  s=choose(first,'left');expect(s.touristMaze!.node).toBe(0);expect(s.touristMaze!.visited).toEqual([0,3]);
  expect(createGameResult(s).wrongTurns).toBe(1);
 });
 it('necessary passages do not become avoidable delay, while a wrong turn and the extra asking cost do',()=>{
  let s=choose(at('tourist','tourist-maze'),'sign');s=choose(s,'left');
  expect(s.metrics.impacts.filter(i=>i.eventId==='tourist-maze')).toEqual([]);
  s=choose(s,'left');
  expect(s.metrics.impacts.filter(i=>i.eventId==='tourist-maze').reduce((sum,i)=>sum+i.deltaSeconds,0)).toBe(-20);
  s=choose(s,'ask');
  expect(s.metrics.impacts.filter(i=>i.eventId==='tourist-maze').reduce((sum,i)=>sum+i.deltaSeconds,0)).toBe(-24);
 });
 it('remembered directions remove paid information choices and reject buying the same information again',()=>{
  const base=at('tourist','tourist-maze'),oldSign=base.event!.choices.find(c=>c.id==='sign')!;
  const s=choose(base,'sign');expect(s.event!.choices.map(c=>c.id)).toEqual(['left','right']);
  const n=reducer(s,{type:'CHOICE',choice:oldSign,eventRevision:s.event!.revision});
  expect(n.remaining).toBe(s.remaining);expect(n.touristMaze).toEqual(s.touristMaze);
  const back=choose(choose(s,'right'),'left');
  expect(back.touristMaze!.node).toBe(0);expect(back.event!.choices.map(c=>c.id)).toEqual(['left','right']);
  const next=choose(back,'left');expect(next.touristMaze!.node).toBe(1);expect(next.event!.choices.map(c=>c.id)).toContain('sign');
 });
 it('the engine interrupts movement after the anger cooldown and does not advance the current journey segment',()=>{
  const base=createCharacterStationRun('shanghai','mom',false,()=>.5),stationJourney=buildStationJourney(base);
  let s:Run={...base,phase:'station',stationJourney,stationBeat:0,stationProgress:.1,stationRunning:true,event:null,parent:{...base.parent!,anger:80,blockCooldown:.2,toilet:0,gap:0}};
  s=reducer(s,{type:'TICK',dt:.1});expect(s.event).toBeNull();
  s=reducer(s,{type:'TICK',dt:.11});expect(s.event!.id).toBe('parent-rage');
  expect(s.stationRunning).toBe(false);expect(s.stationBeat).toBe(0);
  const progress=s.stationProgress,n=reducer(s,{type:'TICK',dt:1});
  expect(n.stationProgress).toBe(progress);expect(s.remaining-n.remaining).toBeCloseTo(1);
  expect(n.parent!.anger).toBe(80);expect(n.parent!.toilet-s.parent!.toilet).toBeCloseTo(4/60);
 });
 it('child incidents raise anger; an outburst stops movement and the two options have different child outcomes',()=>{
  const a=choose(at('mom','child-shoelace'),'help');
  const index=a.stationJourney.findIndex(b=>b.id==='child-distraction'),base={...a,stationBeat:index};
  const b=choose({...base,event:journeyPrompt(base)},'comfort');expect(b.parent!.anger).toBe(80);
  const parent={...b.parent!,blockCooldown:0},event=parentBlockPrompt(parent)!;expect(event.id).toBe('parent-rage');
  const s={...b,parent,event},calm=choose(s,'breathe'),lecture=choose(s,'lecture');
  expect(s.remaining-calm.remaining).toBe(12);expect(s.remaining-lecture.remaining).toBe(45);
  expect(calm.parent!.outbursts).toBe(1);expect(calm.parent!.anger).toBe(15);expect(calm.parent!.patience).toBeGreaterThan(lecture.parent!.patience);
  expect(calm.stationBeat).toBe(s.stationBeat);expect(calm.parent!.toilet-s.parent.toilet).toBeCloseTo(12/60*4);
  expect(createGameResult(calm).characterStats.rageDelaySeconds).toBe(12);
 });
});
