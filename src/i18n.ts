import {useSyncExternalStore,type ReactNode} from 'react';
import catalog from './locales/en.json';
import patternCatalog from './locales/en-patterns.json';

export type Language='zh'|'en';
export const LANGUAGE_STORAGE_KEY='train-rush:language:v1';
let language:Language='zh';
const listeners=new Set<()=>void>();
const hasHan=(text:string)=>/[\u3400-\u9fff]/.test(text);
const dictionary:Record<string,string>=catalog;
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.entries(patternCatalog).map(([source,target])=>{
 const keys:number[]=[];
 const expression=source.split(/(\{\d+\})/).map(part=>{
  const match=part.match(/^\{(\d+)\}$/);if(match){keys.push(Number(match[1]));return '(.*?)';}return escape(part);
 }).join('');
 return {expression:new RegExp('^'+expression+'$'),target,keys,weight:source.replace(/\{\d+\}/g,'').length};
}).sort((a,b)=>b.weight-a.weight);
const fragments=Object.entries(dictionary).filter(([source])=>hasHan(source)&&!source.includes('\n')).sort((a,b)=>b[0].length-a[0].length);
const cache=new Map<string,string>();

/** Localize presentation only. Canonical event labels and action payloads stay intact. */
export function translate(source:string,locale:Language=language):string{
 if(locale==='zh'||!hasHan(source))return source;
 const cached=cache.get(source);if(cached!==undefined)return cached;
 const waitingMarker='；等待期间：';
 if(source.includes(waitingMarker)){
  const [before,...after]=source.split(waitingMarker);
  return translate(before,locale)+'; while waiting: '+translate(after.join(waitingMarker),locale);
 }
 let result=dictionary[source];
 if(result===undefined){
  const trimmed=source.trim();
  if(dictionary[trimmed]!==undefined)result=source.slice(0,source.indexOf(trimmed))+dictionary[trimmed]+source.slice(source.indexOf(trimmed)+trimmed.length);
 }
 if(result===undefined){
  for(const pattern of patterns){const match=source.match(pattern.expression);if(!match)continue;
   const values=new Map(pattern.keys.map((key,i)=>[key,match[i+1]]));
   result=pattern.target.replace(/\{(\d+)\}/g,(_,key)=>translate(values.get(Number(key))??'',locale));break;
  }
 }
 if(result===undefined&&source.includes(' · '))result=source.split(' · ').map(part=>translate(part,locale)).join(' · ');
 if(result===undefined){
  // Compose independently disclosed costs, resource feedback and partial JSX text.
  result=source;
  for(const [zh,en] of fragments)if(result.includes(zh))result=result.split(zh).join(en);
  // A partial translation can conceal a missing entry and distort unknown input.
  if(hasHan(result))result=source;
 }
 if(cache.size>5000)cache.clear();cache.set(source,result);return result;
}
export function localizeNode(value:ReactNode):ReactNode{
 return typeof value==='string'?translate(value):Array.isArray(value)?value.map(localizeNode):value;
}
export const getLanguage=()=>language;
export function initializeLanguage(){
 try{const saved=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(saved==='zh'||saved==='en')language=saved;}catch{/* Browsers without storage still support session switching. */}
 applyDocumentLanguage();
}
function applyDocumentLanguage(){
 if(typeof document==='undefined')return;
 document.documentElement.lang=language==='en'?'en':'zh-CN';
 document.title=language==='en'?'Catch That Train!':'我一定会赶上这趟车 · Catch That Train';
 document.querySelector('meta[name="description"]')?.setAttribute('content',language==='en'?'Dodge crowds, navigate six stations, and catch your train before boarding closes.':'选对地铁、穿过人海、找到检票口——我一定会赶上这趟车！');
}
export function setLanguage(next:Language){
 if(next!==language){language=next;try{localStorage.setItem(LANGUAGE_STORAGE_KEY,next);}catch{/* Keep the in-memory preference. */}applyDocumentLanguage();listeners.forEach(listener=>listener());}
}
export function useLanguage(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},getLanguage,getLanguage);}
