import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {completedStationAction} from './stationFeedback';
import {stationTemptationEvent,stationTemptations,visibleChoices,withDecisionClues} from './decisionPresentation';
import {characterEventPrompt} from './characterTime';
import GateChoices from './GateChoices';
import ChoiceDetail from './ChoiceDetail';

type Character='student'|'worker'|'tourist'|'mom';
function at(city:string,character:Character,eventId=stationTemptationEvent[city]):Run{
 const initial=createCharacterStationRun(city,character,false,()=>.2);
 const stationJourney=buildStationJourney(initial),stationBeat=stationJourney.findIndex(b=>b.id===eventId);
 if(stationBeat<0)throw Error('Missing event '+eventId);
 const run:Run={...initial,phase:'station',remaining:10000,stationJourney,stationBeat};
 return {...run,event:journeyPrompt(run)};
}
const cases=Object.keys(stationTemptationEvent).flatMap(city=>(['student','worker','tourist','mom'] as const).map(character=>({city,character})));
const previews=(run:Run)=>renderToStaticMarkup(<>{visibleChoices(run,run.event!).map(c=><div key={c.label}>{c.label}<ChoiceDetail text={c.detail}/></div>)}</>);

describe('observable temptations and earned consequences',()=>{
 it.each(cases)('$city / $character has a tempting option whose consequence appears only after choosing',({city,character})=>{
  const run=at(city,character),event=run.event!;
  expect(event.description).toContain(stationTemptations[city][character]);
  const lure=event.choices.find(c=>c.stationDecision&&!c.stationDecision.optimal)!;
  expect(lure).toBeDefined();expect(lure.outcome).toBeTruthy();
  expect(previews(run)).not.toMatch(/概率|\d+\s*%|[+−-]\s*\d+\s*秒|折返|正确答案/);
  expect(previews(run)).not.toContain(lure.outcome);
  const next=reducer(run,{type:'CHOICE',choice:lure});
  expect(run.remaining-next.remaining).toBe(lure.seconds);
  expect(next.stationDecisions.at(-1)?.value).toBe(lure.stationDecision!.value);
  expect(next.logs.at(-1)?.title).toBe(lure.outcome);
  expect(completedStationAction(run,next,lure.label)?.title).toBe(lure.outcome);
  if(city==='guangzhou')expect(next.stationJourney.some(b=>b.id==='gz-lift')).toBe(true);
  if(city==='shanghai')expect(next.stationJourney[next.stationBeat].seconds).toBeCloseTo(run.stationJourney[run.stationBeat+1].seconds*.75);
 });

 it.each([['beijing','bj-parent-strict','rescan',65],['hangzhou','hz-parent-lift','left',65]] as const)('%s parent temptation retains its actual consequence', (city,id,value,seconds)=>{
  const run=at(city,'mom',id),choice=run.event!.choices.find(c=>c.stationDecision?.value===value)!;
  expect(previews(run)).not.toMatch(/65|折返/);
  const next=reducer(run,{type:'CHOICE',choice});
  expect(run.remaining-next.remaining).toBe(seconds);
  expect(completedStationAction(run,next,choice.label)?.title).toBe(choice.outcome);
  if(value==='rescan')expect(next.parent!.patience).toBe(run.parent!.patience-12);
 });

 it('does not reveal a tourist risk draw through the option copy',()=>{
  const base=at('hangzhou','tourist');
  const prompt=(risk:boolean)=>{
   const run={...base,characterTime:{...base.characterTime!,wrongWayRisk:risk}};
   return {...run,event:withDecisionClues(run,characterEventPrompt(run,'tourist-wayfinding')!)};
  };
  const safe=prompt(false),risky=prompt(true);
  expect(previews(risky)).toBe(previews(safe));
  expect(risky.event!.choices[1].seconds).toBe(42);
  expect(safe.event!.choices[1].seconds).toBe(0);
 });
});

describe('choice presentation',()=>{
 it('changes the leading choice across rounds, but never while reading the same event',()=>{
  const run=at('beijing','student'),event=run.event!;
  const leads=new Set(Array.from({length:20},(_,i)=>visibleChoices({...run,id:'round-'+i},event)[0].stationDecision!.value));
  expect(leads.size).toBe(2);
  expect(visibleChoices({...run,remaining:run.remaining-10,eventElapsed:10},event)).toEqual(visibleChoices(run,event));
  expect(new Set(visibleChoices(run,event))).toEqual(new Set(event.choices));
 });

 it('keeps numbered gates and spatial queues in their actual order',()=>{
  for(const id of ['gates','security-queue']){
   const run=at('beijing','worker',id);
   expect(visibleChoices(run,run.event!)).toBe(run.event!.choices);
  }
 });

 it('gate choices show people and observed behaviour, never hidden service seconds or outcomes',()=>{
  const run=at('shanghai','student','gates'),choices=run.event!.choices;
  const html=renderToStaticMarkup(<GateChoices choices={choices} onChoose={()=>{}}/>);
  expect(html).not.toMatch(/秒|最快|折返|selected|aria-pressed="true"/);
  expect(html).toContain('找证件');expect(html).toContain('绿灯');
  expect(renderToStaticMarkup(<GateChoices choices={choices.map(c=>({...c,seconds:c.seconds+100,outcome:'隐藏结果'}))} onChoose={()=>{}}/>)).toBe(html);
  const shortest=choices.filter(c=>c.queuePeople===Math.min(...choices.map(c=>c.queuePeople!)));
  expect(shortest.every(c=>c.seconds>Math.min(...choices.map(c=>c.seconds)))).toBe(true);
 });

 it('a chosen gate charges its real queue time once and explains the wait',()=>{
  const run=at('shanghai','worker','gates'),choice=run.event!.choices.find(c=>c.queuePeople===2&&c.seconds===32)!;
  const next=reducer(run,{type:'CHOICE',choice});
  expect(run.remaining-next.remaining).toBe(32);
  expect(next.stationLane).toBe(choice.lane);
  expect(next.stationJourney[next.stationBeat].id).toBe('gate-scan');
  expect(completedStationAction(run,next,choice.label)?.title).toBe(choice.outcome);
 });
});
