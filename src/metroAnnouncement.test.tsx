import {describe,it,expect} from 'vitest';
import {createCharacterStationRun,reducer,type Run} from './engine';
import {metroIncidentCheckpoint,planMetroIncident} from './metroFlow';
import {renderToStaticMarkup} from 'react-dom/server';
import MetroJourney from './MetroJourney';

function announcement(character:'student'|'worker'|'tourist'|'mom'='student',roll=.1):Run{
 const s=createCharacterStationRun('shanghai',character,false,()=>.6),route=s.city.spawnStations[0].routes.find(r=>!r.transfers)!;
 const event=planMetroIncident(route,0,.9,character)!;
 return {...s,remaining:10000,phase:'metro',route,metroDuration:300,metroProgress:metroIncidentCheckpoint(route,event),metroStopIndex:route.stops.length-2,metroIncident:event,metroAnnouncementRoll:roll,event};
}
const energy=(s:Run)=>s.student?.stamina??s.characterTime?.energy??s.parent!.energy;
function arrive(s:Run){for(let i=0;i<100&&s.phase==='metro';i++)s=reducer(s,{type:'TICK',dt:.1});return s;}

describe('unclear announcement has an energy-versus-risk choice',()=>{
 it.each(['student','worker','tourist','mom'] as const)('%s can spend five energy and five seconds to stand at the door',character=>{
  const s=announcement(character),n=reducer(s,{type:'CHOICE',choice:s.event!.choices[0]});
  expect(n.remaining).toBe(s.remaining-5);expect(energy(n)).toBe(energy(s)-5);
  expect(n.metroAnnouncement).toEqual({mode:'door',miss:false});
  if(n.student)expect(n.student.doorReady).toBe(true);
  const destination=arrive(n);expect(destination.phase).toBe('arrival');expect(destination.metroMisses).toBe(0);
 });
 it('sitting spends five seconds, preserves energy, and a pre-drawn bad result costs fifty once at the destination',()=>{
  const s=announcement(),n=reducer(s,{type:'CHOICE',choice:s.event!.choices[1]});
  expect(n.remaining).toBe(s.remaining-5);expect(energy(n)).toBe(energy(s));expect(n.metroAnnouncement!.miss).toBe(true);
  const missed=arrive(n);expect(missed.phase).toBe('metro-recovery');expect(missed.metroMisses).toBe(1);
  expect(missed.logs.filter(l=>l.seconds===50)).toHaveLength(1);expect(missed.metroAnnouncement).toBeUndefined();
  const back=reducer(missed,{type:'TICK',dt:2});expect(back.phase).toBe('arrival');expect(back.metroStopIndex).toBe(back.route!.stops.length-1);
  const off=reducer(back,{type:'ALIGHT'});expect(off.phase).toBe('station');expect(off.logs.filter(l=>l.seconds===50)).toHaveLength(1);
 });
 it('sitting can also reach the correct station; reading and rendering never reroll the risk',()=>{
  const s=announcement('student',.3),n=reducer(s,{type:'CHOICE',choice:s.event!.choices[1]});
  expect(n.metroAnnouncement!.miss).toBe(false);
  const read=reducer(n,{type:'TICK',dt:.1});renderToStaticMarkup(<MetroJourney run={read} dispatch={()=>{}}/>);
  expect(read.metroAnnouncement).toEqual(n.metroAnnouncement);expect(read.metroAnnouncementRoll).toBe(.3);
  expect(arrive(read).phase).toBe('arrival');expect(arrive(read).metroMisses).toBe(0);
 });
 it('going to the door after choosing to sit has its disclosed cost instead of cancelling risk for free',()=>{
  const s=announcement(),seated=reducer(s,{type:'CHOICE',choice:s.event!.choices[1]});
  const door=reducer(seated,{type:'PREPARE_DOOR'});
  expect(door.remaining).toBe(seated.remaining-5);expect(energy(door)).toBe(energy(seated)-5);
  expect(door.metroAnnouncement).toEqual({mode:'door',miss:false});expect(arrive(door).metroMisses).toBe(0);
  expect(reducer(door,{type:'PREPARE_DOOR'}).remaining).toBe(door.remaining);
 });
 it('the announcement happens on the final approach, not at an unrelated intermediate station',()=>{
  const s=announcement(),route=s.route!,at=metroIncidentCheckpoint(route,s.event);
  expect(at).toBeGreaterThan((route.stops.length-2)/(route.stops.length-1));
  const early=reducer({...s,event:null,metroStopIndex:0,metroProgress:0},{type:'TICK',dt:1});expect(early.event).toBeNull();
  const late=reducer({...s,event:null,metroProgress:at-.01},{type:'TICK',dt:.1});expect(late.event?.id).toBe('metro-announcement');
 });
 it('player copy discloses the possible consequence but hides the numeric probability and the rolled result',()=>{
  const s=announcement(),text=s.event!.choices.map(c=>c.label+c.detail).join('');
  expect(text).toContain('可能坐过站');expect(text).toContain('50 秒');expect(text).not.toMatch(/概率|\d+\s*%/);
  const bad=reducer(s,{type:'CHOICE',choice:s.event!.choices[1]}),good=reducer(announcement('student',.8),{type:'CHOICE',choice:s.event!.choices[1]});
  expect(renderToStaticMarkup(<MetroJourney run={bad} dispatch={()=>{}}/>)).toEqual(renderToStaticMarkup(<MetroJourney run={good} dispatch={()=>{}}/>));
 });
});
