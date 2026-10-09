import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {buildStationJourney} from './stationJourney';
import {STATIONS,stationChallenge,stationArrivalGuide} from './stations';
import {initialMapTravel,mapTaskPoint,mapPath,mapDistance,pathLength,snapToRoad} from './stationMapTravel';
import {activeObstacle} from './mapObstructions';
function begin(city='hangzhou',character:'student'|'worker'|'tourist'|'mom'='student',manual=false){
 let s=createCharacterStationRun(city,character,false,()=>.65);s={...s,phase:'station',remaining:10000,stationJourney:buildStationJourney(s)};
 return reducer(s,{type:'MAP_ENABLE',manual});
}
function advance(s:Run){for(let i=0;i<5000&&(s.stationRunning||s.stationMap?.block)&&!s.event;i++){
 if(s.stationMap?.block){const b=s.stationMap.block,o=activeObstacle(s.stationMap)!;
  if(o.kind==='security'&&b.mode==='stopped')s=reducer(s,{type:'MAP_CLEAR',method:'join',lane:b.queues.findIndex(q=>q.people*q.interval===Math.min(...b.queues.map(q=>q.people*q.interval)))});
  else if(b.mode==='tray'){s=reducer(s,{type:'MAP_CLEAR',method:'tray'});s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});}
  else if(b.mode==='stopped')s=reducer(s,{type:'MAP_CLEAR',method:o.kind==='closed'?'leave':'sidestep'});
 }
 s=reducer(s,{type:'TICK',dt:.1});
 }return s;}
function resolve(s:Run){const e=s.event!;if(e.id==='identity-search')return s.student?reducer(s,{type:'POCKET_PICK',pocket:s.student.pocket}):reducer(s,{type:'ID_PICK',item:s.identityStage==='wallet'?'wallet':'id'});
 const choices=e.choices;const choice=e.id==='vertical-choice'?choices[1]:e.id==='zz-number'?choices.find(c=>c.label===s.gate)!:choices.find(c=>c.stationDecision?.optimal)??choices[0];return reducer(s,{type:'CHOICE',choice});}
describe('map travel and blocking encounters',()=>{
 it('does not move or drain sprint when no map destination was picked',()=>{const s=begin(),n=reducer(reducer(s,{type:'SPRINT_INPUT',held:true}),{type:'TICK',dt:1});expect(n.stationRunning).toBe(false);expect(n.stationMap?.position).toEqual(s.stationMap?.position);expect(n.student?.sprintSeconds).toBe(0);});
 it('stops at the encountered task even when tapping beyond it',()=>{let s=begin();s=reducer(s,{type:'MAP_TARGET',point:STATIONS[3].nodes.find(n=>n.id==='gate')!});s=advance(s);expect(s.event?.id).toBe('hz-fork');expect(mapDistance(s.stationMap!.position,mapTaskPoint(s))).toBeLessThan(.01);expect(s.stationRunning).toBe(false);const pos=s.stationMap!.position;s=reducer(s,{type:'MAP_TARGET',point:{x:400,y:40}});s=reducer(s,{type:'TICK',dt:2});expect(s.stationMap!.position).toEqual(pos);});
 it('allows exploration and backtracking on distinct branches without crossing buildings',()=>{let s=begin();s=advance(reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)}));s=resolve(s);const pos=s.stationMap!.position,west=STATIONS[3].nodes.find(n=>n.id==='west')!;s=advance(reducer(s,{type:'MAP_TARGET',point:west}));expect(s.event).toBeNull();expect(mapDistance(s.stationMap!.position,west)).toBeLessThan(.01);expect(mapDistance(pos,s.stationMap!.position)).toBeGreaterThan(20);expect(s.remaining).toBeLessThan(10000);const path=mapPath(s,west,mapTaskPoint(s));expect(path.some(p=>mapDistance(p,STATIONS[3].nodes.find(n=>n.id==='entry')!)<.01)).toBe(true);});
 it('pause freezes position, then resumes the same path',()=>{let s=begin();s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});s=reducer(s,{type:'TICK',dt:.1});s=reducer(s,{type:'RUN_INPUT',held:false});const pos=s.stationMap!.position;s=reducer(s,{type:'TICK',dt:1});expect(s.stationMap!.position).toEqual(pos);s=reducer(s,{type:'RUN_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});expect(s.stationMap!.position).not.toEqual(pos);});
 it('all six maps have reachable, road-snapped encounter locations',()=>{for(const st of STATIONS){const s=begin(st.id);for(let i=0;i<s.stationJourney.length;i++){s.stationBeat=i;const target=mapTaskPoint(s);expect(mapDistance(target,snapToRoad(s,target))).toBeLessThan(.01);expect(pathLength(s.stationMap!.position,mapPath(s,s.stationMap!.position,target))).toBeGreaterThan(0);}}});
 it.each(STATIONS.map(st=>st.id))('%s can complete on foot through its map events, for every playable character',(city)=>{for(const character of ['student','worker','tourist','mom'] as const){let s=begin(city,character);for(let actions=0;actions<140&&s.phase!=='result';actions++){if(s.event){s=resolve(s);continue;}s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});const oldBeat=s.stationBeat;s=advance(s);expect(s.event,city+' '+character+' stuck at '+oldBeat+' '+s.stationJourney[oldBeat]?.id+' phase='+s.phase).not.toBeNull();}expect(s.success,city+' '+character).toBe(true);}});
 it('alternative elevator and bridge paths remain connected to security',()=>{for(const [city,route] of [['wuhan','lift'],['guangzhou','outer'],['shanghai','outer']]){const s=begin(city);s.stationDecisions=[{group:'test-route',value:route,category:'vertical',optimal:true}];if(s.student&&city==='wuhan')s.student.vertical='lift';for(let i=0;i<s.stationJourney.length;i++){s.stationBeat=i;const task=mapTaskPoint(s);expect(mapDistance(task,snapToRoad(s,task))).toBeLessThan(.01);expect(mapPath(s,s.stationMap!.position,task).length).toBeGreaterThan(0);}}});
 it('directions on the station sign agree with the visible gate side',()=>{for(const st of STATIONS){const s=begin(st.id),right=st.nodes.find(n=>n.id==='gate')!.x>st.nodes.find(n=>n.id==='hall')!.x;expect(stationChallenge(s,'station-sign')!.choices[0].label).toContain(right?'右转':'左转');}const hz=STATIONS.find(st=>st.id==='hangzhou')!;expect(hz.nodes.find(n=>n.id==='gate')!.x).toBeGreaterThan(hz.nodes.find(n=>n.id==='hall')!.x);});
 it('real sprint strain still stops the player on the map',()=>{let s=begin('shanghai');s=reducer(s,{type:'MAP_TARGET',point:mapTaskPoint(s)});s.student={...s.student!,sprintStrain:6.99};s=reducer(s,{type:'SPRINT_INPUT',held:true});s=reducer(s,{type:'TICK',dt:.1});expect(s.event?.id).toBe('student-breath');expect(s.stationRunning).toBe(false);const beat=s.stationBeat;s=resolve(s);expect(s.stationBeat).toBe(beat);expect(s.stationMap!.path.length).toBeGreaterThan(0);});
 it('student Hangzhou has no work messages and the clue explains departure vs arrival',()=>{const s=begin();for(const id of ['hz-fork','hz-zone'])expect(JSON.stringify(stationChallenge(s,id))).not.toMatch(/工作消息|工作群|老板/);expect(stationArrivalGuide(s)).toContain('右转');expect(stationArrivalGuide(s)).toContain('铁路出发');expect(stationArrivalGuide(s)).toContain('到达');expect(initialMapTravel(s).path).toEqual([]);});
 it('one onward destination survives the interruptions and still requires a ticket scan in all 24 station/character combinations',()=>{
  for(const st of STATIONS)for(const character of ['student','worker','tourist','mom'] as const){let s=begin(st.id,character,true);const goal=STATIONS.find(v=>v.id===st.id)!.nodes.find(n=>n.id==='gate')!;s=reducer(s,{type:'MAP_TARGET',point:{x:Math.min(477,goal.x+24),y:Math.min(239,goal.y+28)}});
   for(let i=0;i<16000&&s.phase!=='result';i++){
    if(s.event){s=resolve(s);continue;}
    const b=s.stationMap?.block;
    if(b){const o=activeObstacle(s.stationMap!)!;if(b.mode==='tray')s=reducer(s,{type:'MAP_CLEAR',method:'tray'});else if(b.mode==='stopped'){const lane=b.queues.reduce((best,q,i)=>q.people*q.interval<b.queues[best].people*b.queues[best].interval?i:best,0);s=reducer(s,{type:'MAP_CLEAR',method:o.kind==='security'?'join':o.kind==='closed'?'leave':o.kind==='child'?'wait':'ask',lane});}}
    else if(!s.stationRunning)s=reducer(s,{type:'RUN_INPUT',held:true});
    s=reducer(s,{type:'TICK',dt:.1});
   }
   expect(s.success,st.id+' '+character+' failed to keep going').toBe(true);expect(s.seen).toContain('gate-scan');expect(s.seen).toContain('security-queue');
  }
 });
});
