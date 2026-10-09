import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';

let values:Map<string,string>;
beforeEach(()=>{vi.resetModules();values=new Map();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('independent playtest deployment',()=>{
 it('keeps the public storage and share address unchanged outside the test build',async()=>{
  vi.stubEnv('VITE_PLAYTEST','false');
  const {readGameStorage,writeGameStorage}=await import('./playtestEnvironment');
  writeGameStorage('records','public');expect(readGameStorage('records')).toBe('public');expect(values.has('playtest:records')).toBe(false);
  expect((await import('./shareChallenge')).SHARE_GAME_URL).toBe('https://logic-syd.github.io/catchThatTrain-/');
 });
 it('seeds earned public data, writes only the test namespace, and shares the test game',async()=>{
  vi.stubEnv('VITE_PLAYTEST','true');values.set('records','public');
  const {readGameStorage,writeGameStorage}=await import('./playtestEnvironment');
  expect(readGameStorage('records')).toBe('public');writeGameStorage('records','test');
  expect(values.get('records')).toBe('public');expect(readGameStorage('records')).toBe('test');
  const {SHARE_GAME_URL,challengeUrl}=await import('./shareChallenge');
  expect(new URL(challengeUrl(SHARE_GAME_URL,'hangzhou','赶上了',true)).pathname).toBe('/catchThatTrain-/test/');
 });
 it('a failed test replay retains an earned character and never rewrites the public profile',async()=>{
  vi.stubEnv('VITE_PLAYTEST','true');
  values.set('train-rush:characters:v1',JSON.stringify(['student','worker']));
  const publicData=JSON.stringify([...values]);
  const {createCharacterStationRun}=await import('./engine');
  const {persistRun,readProgress,isCharacterUnlocked}=await import('./achievements');
  const s=createCharacterStationRun('hangzhou');
  expect(persistRun({...s,phase:'result',success:false,remaining:0}).saved).toBe(true);
  expect(isCharacterUnlocked(readProgress(),'worker')).toBe(true);
  expect(values.has('playtest:train-rush:profile:v1')).toBe(true);
  expect(JSON.stringify([...values].filter(([key])=>!key.startsWith('playtest:')))).toBe(publicData);
 });
});
