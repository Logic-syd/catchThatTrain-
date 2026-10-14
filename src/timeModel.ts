import type {Run} from './engine';
import type {MetroRoute,CharacterConfig} from './data';
import {characterMovementFactor} from './characterTime';
import {parentMovementFactor} from './parent';
import {buildStationJourney,journeyPrompt} from './stationJourney';
import {stationFor} from './stations';
import {eventHoldSeconds} from './eventTiming';
import {difficultyPolicy,type PlayableDifficultyCharacter} from './difficulty';
import {mazeForecastSeconds} from './touristMaze';
import {isRoadsideBeat} from './hongqiao';
import {buildSpatialScene,spatialOperationSeconds} from './spatialChoice';

import {TIME_SCALE,STOP_BEFORE} from './gameClock';
export {TIME_SCALE,STOP_BEFORE} from './gameClock';
export const transferSeconds=(character:CharacterConfig)=>character.stroller?90:character.luggage?45:20;
export function movementSpeed(s:Run,sprinting=false){
 return s.parent?parentMovementFactor(s.parent,sprinting):s.student||s.characterTime?characterMovementFactor(s,sprinting):s.character.speed;
}
export function priceRoute(route:MetroRoute,speed:number,character:CharacterConfig){
 const ride=route.minutes*60,walk=route.walk/1.5/speed,transfer=route.transfers*transferSeconds(character);
 return {ride,walk,transfer,total:ride+walk+transfer};
}
export const routeTravelSeconds=(s:Run,route:MetroRoute)=>priceRoute(route,movementSpeed(s),s.character).total;
export const fastestRouteSeconds=(s:Run)=>Math.min(...s.city.spawnStations[s.spawn].routes.map(r=>routeTravelSeconds(s,r)));
export function remainingMetroSeconds(s:Run,route=s.route){
 if(s.phase==='station'||s.stationJourney.length||s.phase==='result'&&s.success)return 0;
 const selected=route&&s.route?.id===route.id&&s.metroDuration>0;
 const total=selected?s.metroDuration:route?routeTravelSeconds(s,route):fastestRouteSeconds(s);
 return total*(selected?Math.max(0,1-s.metroProgress):1);
}
export const stationWalkingSeconds=(s:Run)=>stationFor(s).walking/movementSpeed(s);
export function arrivalMargin(s:Run,route=s.route){return s.remaining-(s.gatePassed?0:STOP_BEFORE)-remainingMetroSeconds(s,route);}
// Budget buffers are a difficulty policy, not a second travel-cost formula.
export function stationBudget(s:Run,buffer:number,hardReduction:number,minimum=0){
 const travel=fastestRouteSeconds(s),walking=stationWalkingSeconds(s);
 const beforeGate=Math.max(minimum,Math.ceil((travel+walking+buffer)/30)*30);
 return {travel,walking,buffer,initial:beforeGate+STOP_BEFORE-(s.hard?hardReduction:0)};
}
export function openingBudget(s:Run,character:PlayableDifficultyCharacter){
 const policy=difficultyPolicy(character,s.city.id);
 return stationBudget(s,policy.buffer,policy.hardReduction,policy.minimum);
}
export function stationForecast(s:Run){
 const beats=s.stationJourney.length?s.stationJourney:buildStationJourney(s);
 const start=s.stationJourney.length?s.stationBeat:0;
 const gate=beats.findIndex(b=>b.id==='gate-scan');
 const end=s.gatePassed?beats.length-1:gate<0?beats.length-1:gate;
 let walking=0,operations=0;
 for(let index=start;index<=end;index++){
  const current=index===start&&s.stationJourney.length>0;
  const progress=current?s.stationProgress:0;
  const seconds=beats[index].seconds*Math.max(0,1-progress)/movementSpeed(s,false);
  walking+=seconds*TIME_SCALE;
  // Optional roadside activities can be passed without a prompt or handling fee.
  if(isRoadsideBeat(s,beats[index].id)&&!(current&&s.roadsideActive===beats[index].id&&s.event))continue;
  if(beats[index].id==='tourist-maze'&&s.touristMaze){operations+=Math.max(0,mazeForecastSeconds(s.touristMaze)-(current?Math.min(2,s.eventElapsed):0));continue;}
  // Freeze current resources, assume ordinary walking, 2s reading, fastest visible choice.
  const event=current&&s.event?s.event:journeyPrompt({...s,stationJourney:beats,stationBeat:index},false);
  const scene=buildSpatialScene({...s,phase:'station',stationJourney:beats,stationBeat:index,event});
  if(scene){
   const elapsed=current&&s.event?s.eventElapsed:0;
   // Estimate a real route to an entrance, using the same collision geometry as
   // the controls. Only the chosen event's canonical fixed fee is added.
   operations+=Math.min(...scene.exits.map(exit=>Math.max(0,2+spatialOperationSeconds(scene,exit.choiceIndex)-elapsed)+event.choices[exit.choiceIndex].seconds));
   continue;
  }
  const read=event.interaction?.kind==='hold'?eventHoldSeconds(s,event):event.interaction?.kind==='tap'?(event.interaction.required??1)*.2:2;
  const remainingRead=current&&s.event?Math.max(0,read-s.eventElapsed):read;
  const cost=event.choices.length?Math.min(...event.choices.map(c=>c.seconds)):0;
  operations+=remainingRead+cost;
 }
 return {walking,operations,total:walking+operations};
}
export function secondsToGoal(s:Run){return remainingMetroSeconds(s)+stationForecast(s).total;}
