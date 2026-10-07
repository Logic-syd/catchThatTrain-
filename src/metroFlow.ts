import type { EventConfig, MetroRoute } from './data';
import { identityPrompt } from './flow';

export const METRO_INCIDENT_CHANCE = .3;

// Draw once per journey. Rendering, stopping and reopening the map never reroll it.
export function planMetroIncident(route: MetroRoute, roll: number, variant: number): EventConfig | null {
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
  description:`${route.lines[0]}号线驶过隧道，广播断断续续。要去的是${route.stops.at(-1)}。`,
  interaction:{kind:'choice',seconds:7,penalty:40},
  choices:[
   {label:'看车门上方的站名屏',detail:'重新确认位置 · −5 秒',seconds:5},
   {label:'问旁边也没听清的乘客',detail:'确认了好一会儿 · −35 秒',seconds:35}
  ]
 };
}

export function transferStopIndex(route: MetroRoute): number {
 return route.transfers && route.via ? route.stops.indexOf(route.via) : -1;
}
