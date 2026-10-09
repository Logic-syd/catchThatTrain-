import {describe,it,expect} from 'vitest';
import {createStationRun,reducer,type Run} from './engine';
import {STATIONS} from './stations';
import {mapTaskPoint} from './stationMapTravel';
import {activeObstacle} from './mapObstructions';
import {summarizeRun} from './outcomes';

function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function tick(s:Run,n:number){for(let i=0;i<Math.round(n*10)&&s.phase!=='result';i++)s=reducer(s,{type:'TICK',dt:.1});return s;}
function play(city:string,mode:'walk'|'sprint'|'paced',seed=921,preparation=['skip','check','eat']){
 let s=reducer(createStationRun(city,false,rng(seed)),{type:'START'});
 for(const option of preparation)s=reducer(s,{type:'PREP_PICK',option,step:s.student!.prep});
 const route=s.city.spawnStations[0].routes.reduce((best,r)=>r.minutes*60+r.walk/1.5+r.transfers*20<best.minutes*60+best.walk/1.5+best.transfers*20?r:best);
 s=reducer(s,{type:'ROUTE',route});s=reducer(s,{type:'DIRECTION',correct:true});
 for(let i=0;i<12000&&s.phase!=='result';i++){
  if(s.event){s=tick(s,.8);if(s.phase==='result')break;const e=s.event!;
   if(e.id==='identity-search'){s=reducer(s,{type:'POCKET_PICK',pocket:s.student!.pocket});continue;}
   let index=0;if(e.id==='vertical-choice')index=1;if(e.id==='escalator-choice')index=s.stationLuck.escalators.indexOf('clear');if(e.id==='security-queue'||e.id==='gates')index=e.choices.findIndex(c=>c.seconds===Math.min(...e.choices.map(c=>c.seconds)));if(e.id==='zz-number')index=e.choices.findIndex(c=>c.label===s.gate);
   s=reducer(s,{type:'CHOICE',choice:e.choices[Math.max(0,index)]});
  }else if(s.stationMap?.block){const b=s.stationMap.block,o=activeObstacle(s.stationMap)!;
   if(b.mode==='tray')s=reducer(s,{type:'MAP_CLEAR',method:'tray'});
   else if(b.mode==='stopped'){
    if(o.kind==='security'){const lane=b.queues.reduce((best,q,i)=>q.people*q.interval<b.queues[best].people*b.queues[best].interval?i:best,0);s=reducer(s,{type:'MAP_CLEAR',method:'join',lane});}
    else s=reducer(s,{type:'MAP_CLEAR',method:o.kind==='closed'?'leave':o.kind==='child'?'wait':'ask'});
   }
   s=tick(s,.1);
  }else if(s.phase==='arrival')s=reducer(s,{type:s.metroStopIndex===s.route!.stops.length-1||s.route!.stops[s.metroStopIndex]===s.route!.via?'ALIGHT':'CONTINUE_METRO'});
  else if(s.phase==='station'){if(!s.stationMap)s=reducer(s,{type:'MAP_ENABLE',manual:true});if(!s.stationMap!.path.length)s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});const sprint=mode==='sprint'||mode==='paced'&&s.student!.sprintStrain<4.8&&s.student!.stamina>30;s=reducer(s,{type:sprint?'SPRINT_INPUT':'RUN_INPUT',held:true});s=tick(s,.1);}
  else{s=reducer(s,{type:'PREPARE_DOOR'});s=tick(s,.1);}
 }
 return s;
}

describe('student sprint pacing',()=>{
 it('mindlessly sprinting fails at every first-chapter station while walking and paced bursts work',()=>{
  for(const st of STATIONS)for(const seed of [921,84,12,453]){
   const walk=play(st.id,'walk',seed),sprint=play(st.id,'sprint',seed),paced=play(st.id,'paced',seed);
   expect(walk.success,`${st.id} seed ${seed} walking (beat ${walk.stationBeat}, remaining ${walk.remaining})`).toBe(true);
   expect(paced.success,`${st.id} seed ${seed} paced`).toBe(true);
   expect(paced.student!.breathStops,`${st.id} seed ${seed} paced breath`).toBe(0);
   expect(sprint.success,`${st.id} seed ${seed} all sprint`).toBe(false);
   expect(sprint.student!.breathStops,`${st.id} seed ${seed} all sprint breath`).toBeGreaterThanOrEqual(2);
   const outcome=summarizeRun(sprint);
   expect(outcome.title,`${st.id} seed ${seed} failure title`).toBe('前面冲太猛了');
   expect(outcome.reasons.join(' '),`${st.id} seed ${seed} failure reasons`).toContain('岔气');
   const rush=play(st.id,'sprint',seed,['skip','skip','skip']);
   expect(rush.success,`${st.id} seed ${seed} no preparation, all sprint`).toBe(false);
  }
 },30000);
 it('a breath stop blocks progress and resumes the same corridor after recovery',()=>{
  let s=createStationRun('shanghai',false,rng(921));s={...s,phase:'station',remaining:900,stationJourney:[{id:'gates',stage:4,label:'long corridor',seconds:100}],stationBeat:0,stationRunning:true};
  for(let i=0;i<100&&s.event?.id!=='student-breath';i++)s=tick(reducer(s,{type:'SPRINT_INPUT',held:true}),.1);
  expect(s.event?.id).toBe('student-breath');
  const progress=s.stationProgress,remaining=s.remaining;
  s=tick(s,1.5);
  expect(s.stationProgress).toBe(progress);
  s=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});
  expect(s.event).toBeNull();expect(s.stationBeat).toBe(0);expect(s.stationProgress).toBe(progress);
  expect(s.remaining).toBeCloseTo(remaining-1.5-105);
 });
});
