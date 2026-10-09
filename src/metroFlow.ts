import type { Choice, EventConfig, MetroRoute } from './data';
import type {Run} from './engine';
import {BALANCE} from './balanceConfig';
import { identityPrompt } from './flow';

export const METRO_INCIDENT_CHANCE = .3;

// Draw once per journey. Rendering, stopping and reopening the map never reroll it.
export function planMetroIncident(route: MetroRoute, roll: number, variant: number,characterId='student'): EventConfig | null {
 if (roll >= METRO_INCIDENT_CHANCE) return null;
 if (variant < 1 / 3) return identityPrompt('metro');
 if (variant < 2 / 3) return {
  id: 'metro-crowded-door', phase: 'metro', title: '车门口，被箱子堵住了！',
  description: `${route.lines[0]}号线的门口挤满了行李。先把下车的路留出来。`,
  interaction: {kind:'choice',seconds:7,penalty:45},
  choices: [
   {label:'借过，提前挪到另一扇门',detail:'绕过行李 · −12 秒',seconds:12},
   {label:'留在原地，等大家先走',detail:'下车前再挤过去 · −40 秒',seconds:40}
  ]
 };
 if (route.transfers) return {
  id:'metro-transfer-sign', phase:'metro', title:'换乘指示牌，怎么有两个方向？',
  description:`你选了 ${route.lines.join(' → ')} 号线。在${route.via}下车后，要找对下一条线。`,
  interaction:{kind:'choice',seconds:8,penalty:55},
  choices:[
   {label:`确认 ${route.lines[1]} 号线换乘标识`,detail:'记住通道，留意到站广播 · −8 秒',seconds:8},
   {label:'跟着“出站”人群走',detail:'绕回换乘通道 · −55 秒',seconds:55}
  ]
 };
 return {
  id:'metro-announcement',phase:'metro',title:'广播没听清，刚刚报的是哪站？',
  description:`下一站就要到${route.stops.at(-1)}，广播却断断续续。先去门口盯着站名，还是坐着等？`,
  interaction:{kind:'choice',seconds:7,penalty:0},
  choices:[
   {label:'不管哪站，先去门口等着',detail:`−${BALANCE.metroAnnouncement.choiceSeconds} 秒 · ${characterId==='tourist'?'精力':'体力'} −${BALANCE.metroAnnouncement.doorEnergyCost} · 靠门留意站名`,seconds:BALANCE.metroAnnouncement.choiceSeconds,metroEffect:'door-wait'},
   {label:'老实坐着，等下一站',detail:`−${BALANCE.metroAnnouncement.choiceSeconds} 秒 · 保留体力 · 可能坐过站，折返会耽误 ${BALANCE.metroAnnouncement.missSeconds} 秒`,seconds:BALANCE.metroAnnouncement.choiceSeconds,metroEffect:'seated-wait'}
  ]
 };
}

export function metroIncidentCheckpoint(route:MetroRoute,incident:EventConfig|null):number{
 return incident?.id==='metro-announcement'?(route.stops.length-2+.14)/(route.stops.length-1):.14;
}
export function applyMetroAnnouncement(s:Run,c:Choice):Run{
 const door=c.metroEffect==='door-wait',cost=door?BALANCE.metroAnnouncement.doorEnergyCost:0;
 return {...s,metroAnnouncement:{mode:door?'door':'seated',miss:!door&&(s.metroAnnouncementRoll??.5)<BALANCE.metroAnnouncement.missChance},
  student:s.student?{...s.student,stamina:Math.max(0,s.student.stamina-cost),doorReady:door}:undefined,
  characterTime:s.characterTime?{...s.characterTime,energy:Math.max(0,s.characterTime.energy-cost)}:undefined,
  parent:s.parent?{...s.parent,energy:Math.max(0,s.parent.energy-cost)}:undefined,
  stamina:Math.max(0,(s.student?.stamina??s.characterTime?.energy??s.parent?.energy??s.stamina)-cost)};
}

export function transferStopIndex(route: MetroRoute): number {
 return route.transfers && route.via ? route.stops.indexOf(route.via) : -1;
}
