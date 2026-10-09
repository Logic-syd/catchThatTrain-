import {describe,it,expect,vi,afterEach} from 'vitest';
import {createCharacterStationRun,type Run} from './engine';
import {awardRun,freshProgress,persistRun,readProgress,isCharacterUnlocked,mergeProgress,PROFILE_KEY,migrateLegacy} from './achievements';
function result(character:'student'|'worker'|'tourist'|'mom'='student',success=true):Run{return {...createCharacterStationRun('shanghai',character),phase:'result',success,gateRemaining:60};}
function storage(){const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)});return store;}
afterEach(()=>vi.unstubAllGlobals());
describe('permanent character unlocks',()=>{
 it('a win then repeated losses and reload never relocks level two',()=>{storage();let p=persistRun(result()).progress;for(let i=0;i<4;i++)p=persistRun(result('student',false),p).progress;expect(readProgress().totalWins).toBe(1);expect(isCharacterUnlocked(readProgress(),'worker')).toBe(true);expect(p.currentWinStreak).toBe(0);});
 it('a stale tab with more runs cannot overwrite a newer win',()=>{storage();let stale=freshProgress();for(let i=0;i<6;i++)stale=awardRun(stale,result('student',false));persistRun(result());const p=persistRun(result('student',false),stale).progress;expect(isCharacterUnlocked(p,'worker')).toBe(true);expect(isCharacterUnlocked(readProgress(),'worker')).toBe(true);});
 it('merges wins from two tabs in different chapters and deduplicates results',()=>{storage();const a=awardRun(freshProgress(),result()),run=result('worker'),b=awardRun(freshProgress(),run);const merged=mergeProgress(a,b);expect(isCharacterUnlocked(merged,'tourist')).toBe(true);expect(merged.characterStats.student.wins).toBe(1);expect(awardRun(merged,run)).toBe(merged);});
 it('a corrupt main profile can recover the saved backup and grants',()=>{const store=storage();persistRun(result('tourist'));store.set(PROFILE_KEY,'{broken');expect(isCharacterUnlocked(readProgress(),'mom')).toBe(true);store.delete(PROFILE_KEY+':backup');expect(isCharacterUnlocked(readProgress(),'mom')).toBe(true);});
 it('legacy wins and old local battle records restore earned access',()=>{const store=storage();expect(isCharacterUnlocked(migrateLegacy({version:1,wins:1}),'worker')).toBe(true);store.set('catch-train-records',JSON.stringify([{character:'背包大学生',success:true}]));expect(isCharacterUnlocked(readProgress(),'worker')).toBe(true);});
 it('storage rejection still preserves memory grants after a loss',()=>{vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('blocked');}});const p=persistRun(result());expect(p.saved).toBe(false);expect(isCharacterUnlocked(persistRun(result('student',false),p.progress).progress,'worker')).toBe(true);});
});
