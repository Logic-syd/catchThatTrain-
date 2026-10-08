import type {Run} from './engine';
import {summarizeRun} from './outcomes';
import {analyzeFactors,type GameResult} from './gameResult';
import {ACHIEVEMENTS,matches,getField} from './achievementConfig';
export {ACHIEVEMENTS} from './achievementConfig';
export const PROFILE_KEY='train-rush:profile:v1';
export type PlayableCharacterId='student'|'worker'|'tourist'|'mom';
export type Stat={runs:number;wins:number;streak:number;bestStreak:number;goodRouteStreak:number;failuresBeforeFirstWin:number};
export type Progress={schemaVersion:1;totalRuns:number;totalWins:number;currentWinStreak:number;bestWinStreak:number;characterStats:Record<string,Stat>;stationStats:Record<string,Stat>;achievementProgress:Record<string,{current:number;target:number;unlocked:boolean}>;unlocked:Record<string,{at:string;runId:string}>;processedRunIds:string[];lastRunId:string|null;lastUnlocks:string[];legacyMigrated:boolean;conqueredStations:number;
 // Kept for existing record/UI consumers.
 wins:number;streak:number;clutchStreak:number;stationWins:Record<string,number>};
const stat=():Stat=>({runs:0,wins:0,streak:0,bestStreak:0,goodRouteStreak:0,failuresBeforeFirstWin:0});
export const freshProgress=():Progress=>({schemaVersion:1,totalRuns:0,totalWins:0,currentWinStreak:0,bestWinStreak:0,characterStats:{},stationStats:{},achievementProgress:{},unlocked:{},processedRunIds:[],lastRunId:null,lastUnlocks:[],legacyMigrated:false,conqueredStations:0,wins:0,streak:0,clutchStreak:0,stationWins:{}});
export function isCharacterUnlocked(progress:Progress,id:PlayableCharacterId){
 if(id==='student')return true;
 if(id==='worker')return (progress.characterStats.student?.wins??0)>0||(progress.characterStats.worker?.runs??0)>0||(progress.characterStats.tourist?.runs??0)>0;
 if(id==='tourist')return (progress.characterStats.worker?.wins??0)>0||(progress.characterStats.tourist?.runs??0)>0;
 return (progress.characterStats.tourist?.wins??0)>0||(progress.characterStats.mother?.runs??0)>0;
}
export function newlyUnlockedCharacter(progress:Progress,run:Run):PlayableCharacterId|null{
 if(!run.success||progress.lastRunId!==run.id)return null;
 if(run.character.id==='student'&&progress.characterStats.student?.wins===1&&(progress.characterStats.worker?.runs??0)===0)return 'worker';
 if(run.character.id==='worker'&&progress.characterStats.worker?.wins===1&&(progress.characterStats.tourist?.runs??0)===0)return 'tourist';
 if(run.character.id==='tourist'&&progress.characterStats.tourist?.wins===1&&(progress.characterStats.mother?.runs??0)===0)return 'mom';
 return null;
}
const count=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.floor(v):0;
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function unlocks(raw:unknown):Progress['unlocked']{return Object.fromEntries(Object.entries(object(raw)).filter(([id,v])=>ACHIEVEMENTS.some(a=>a.id===id)&&typeof object(v).at==='string'&&typeof object(v).runId==='string').map(([id,v])=>[id,{at:String(object(v).at),runId:String(object(v).runId)}]));}
function stats(raw:unknown):Record<string,Stat>{return Object.fromEntries(Object.entries(object(raw)).map(([id,v])=>[id,Object.fromEntries(Object.keys(stat()).map(k=>[k,count(object(v)[k])])) as Stat]));}
export function parseProfile(raw:unknown):Progress{
 const v=object(raw),p=freshProgress();if(v.schemaVersion!==1)return p;
 for(const k of ['totalRuns','totalWins','currentWinStreak','bestWinStreak','clutchStreak'] as const)p[k]=count(v[k]);
 p.characterStats=stats(v.characterStats);p.stationStats=stats(v.stationStats);p.unlocked=unlocks(v.unlocked);
 p.processedRunIds=Array.isArray(v.processedRunIds)?v.processedRunIds.filter((x):x is string=>typeof x==='string').slice(-512):[];
 p.lastRunId=typeof v.lastRunId==='string'?v.lastRunId:null;p.lastUnlocks=Array.isArray(v.lastUnlocks)?v.lastUnlocks.filter((x):x is string=>typeof x==='string'&&!!p.unlocked[x]):[];
 p.legacyMigrated=v.legacyMigrated===true;
 for(const a of ACHIEVEMENTS){const current=Math.min(a.target,count(object(object(v.achievementProgress)[a.id]).current));p.achievementProgress[a.id]={current:p.unlocked[a.id]?a.target:current,target:a.target,unlocked:!!p.unlocked[a.id]};}
 return aliases(p);
}
function aliases(p:Progress):Progress{p.wins=p.totalWins;p.streak=p.currentWinStreak;p.stationWins=Object.fromEntries(Object.entries(p.stationStats).map(([k,v])=>[k,v.wins]));p.conqueredStations=Object.values(p.stationWins).filter(v=>v>0).length;return p;}
export function migrateLegacy(raw:unknown):Progress{
 const v=object(raw),p=freshProgress();if(v.version!==1)return p;p.legacyMigrated=true;
 p.unlocked=unlocks(v.unlocked);p.processedRunIds=Array.isArray(v.completed)?v.completed.filter((x):x is string=>typeof x==='string').slice(-512):[];
 p.totalWins=count(v.wins);p.totalRuns=Math.max(p.totalWins,Array.isArray(v.completed)?v.completed.length:0);p.currentWinStreak=count(v.streak);p.bestWinStreak=p.currentWinStreak;
 for(const [id,wins] of Object.entries(object(v.stationWins)))p.stationStats[id]={...stat(),runs:count(wins),wins:count(wins)};
 // Old counters do not prove new thresholds. Preserve earned badges; start new progress at zero.
 for(const a of ACHIEVEMENTS)p.achievementProgress[a.id]={current:p.unlocked[a.id]?a.target:0,target:a.target,unlocked:!!p.unlocked[a.id]};
 return aliases(p);
}
export function readProgress():Progress{try{const current=localStorage.getItem(PROFILE_KEY);if(current)return parseProfile(JSON.parse(current));const p=migrateLegacy(JSON.parse(localStorage.getItem('catch-train-achievements-v1')??'null'));if(p.legacyMigrated){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}catch{/* in-memory migration remains usable */}}return p;}catch{return freshProgress();}}
function updateStat(old:Stat|undefined,r:GameResult):Stat{const s={...(old??stat())};s.runs++;if(r.success)s.wins++;else if(!s.wins)s.failuresBeforeFirstWin++;s.streak=r.success?s.streak+1:0;s.bestStreak=Math.max(s.bestStreak,s.streak);s.goodRouteStreak=r.routeEfficiency>=90?s.goodRouteStreak+1:0;return s;}
export function awardResult(previous:Progress,input:GameResult,at=new Date().toISOString()):Progress{
 if(previous.processedRunIds.includes(input.runId))return previous;
 const analysis=analyzeFactors(input),r={...input,timeImpacts:analysis.impacts,characterStats:{...input.characterStats}};
 const decisive=(pattern:RegExp)=>r.timeImpacts.some(i=>pattern.test(i.eventId??i.id)&&i.decisive&&(r.success?i.deltaSeconds>r.resultMarginSeconds:-i.deltaSeconds>=-r.resultMarginSeconds));
 Object.assign(r.characterStats,{cakeDecisive:decisive(/prepare-cake/),liftDecisive:decisive(/lift|vertical-choice/),lateSprintDecisive:decisive(/sprint-late/)});
 const p:Progress={...previous,totalRuns:previous.totalRuns+1,totalWins:previous.totalWins+(r.success?1:0),currentWinStreak:r.success?previous.currentWinStreak+1:0,characterStats:{...previous.characterStats},stationStats:{...previous.stationStats},achievementProgress:{...previous.achievementProgress},unlocked:{...previous.unlocked},processedRunIds:[...previous.processedRunIds,r.runId].slice(-512),lastRunId:r.runId,lastUnlocks:[],clutchStreak:r.success&&r.resultMarginSeconds<=15?previous.clutchStreak+1:0};
 p.bestWinStreak=Math.max(p.bestWinStreak,p.currentWinStreak);p.characterStats[r.characterId]=updateStat(p.characterStats[r.characterId],r);p.stationStats[r.stationId]=updateStat(p.stationStats[r.stationId],r);aliases(p);
 const context={r,p,station:p.stationStats[r.stationId],character:p.characterStats[r.characterId]};
 for(const a of ACHIEVEMENTS){if(a.legacy||p.unlocked[a.id]||!['general','station',r.characterId].includes(a.category))continue;
 let current=previous.achievementProgress[a.id]?.current??0;
 if(a.sequenceField){const seq=getField(context,a.sequenceField);if(Array.isArray(seq))for(const ok of seq){if(typeof ok!=='boolean')continue;current=ok?current+1:0;if(current>=a.target)break;}}
 else if(a.mode==='value')current=count(getField(context,a.progressField!));
 else {const met=matches(a.condition,context);current=a.mode==='streak'?(met?current+1:0):met?current+1:current;}
 const unlocked=current>=a.target;p.achievementProgress[a.id]={current:Math.min(a.target,current),target:a.target,unlocked};
 if(unlocked){p.unlocked[a.id]={at,runId:r.runId};p.lastUnlocks.push(a.id);}
 }
 return p;
}
export function awardRun(previous:Progress,s:Run,at?:string):Progress{return s.phase==='result'?awardResult(previous,summarizeRun(s).result,at):previous;}
export function persistRun(s:Run,memory?:Progress):{progress:Progress;saved:boolean}{const disk=readProgress();const p=awardRun(memory&&memory.totalRuns>=disk.totalRuns?memory:disk,s);try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));return {progress:p,saved:true};}catch{return {progress:p,saved:false};}}
export const rarityRank={common:0,uncommon:1,rare:2,legendary:3};
export function featuredUnlock(ids:string[]){return ACHIEVEMENTS.filter(a=>ids.includes(a.id)).sort((a,b)=>rarityRank[b.rarity]-rarityRank[a.rarity]||a.id.localeCompare(b.id))[0];}
