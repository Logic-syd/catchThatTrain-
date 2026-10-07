import type {Run} from './engine';
import {characters} from './data';
import {characterTimeProfiles} from './characterTime';
import {isCharacterUnlocked,type Progress,type PlayableCharacterId} from './achievements';

function StudentPortrait(){
 return <svg className="student-portrait" viewBox="0 0 100 118" role="img" aria-label="背着黄色双肩包、举拳给自己打气的大学生">
  <ellipse cx="50" cy="110" rx="30" ry="5" fill="#d8c69e" opacity=".4"/>
  <g stroke="#776247" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
   <rect x="24" y="51" width="52" height="40" rx="14" fill="#d3b470" stroke="#aa8d56"/>
   <path d="m37 87-2 18h12l4-18m3 0 2 18h12l-5-21" fill="#73857a"/>
   <path d="M34 103h13v7H29q-2-5 5-7m22 0h12l6 7H56z" fill="#fff8e9"/>
   <path d="M29 62q20-15 41 0l-5 29H34z" fill="#a6bca2"/>
   <path d="m32 64-5 18q-2 7-7 2l4-24m44 5 9-12 8 5-11 21" fill="#a6bca2"/>
   <path d="M82 59q-10-3-7-10l2-6q1-4 4-2l1 5q8-3 9 3t-9 10" fill="#f0cfad"/>
   <path d="M21 83q-3 9 3 9t5-8" fill="#f0cfad"/>
   <path d="m36 59 2 22m24-22-2 22" stroke="#c29d62" strokeWidth="5"/>
   <path d="M43 52v10q7 5 14 0V52" fill="#e9bc97"/>
   <circle cx="27" cy="38" r="5" fill="#f0cfad" stroke="none"/>
   <circle cx="74" cy="38" r="5" fill="#f0cfad" stroke="none"/>
   <path d="M27 29q0-20 25-20 23 0 23 23l-3 13q-5 14-22 14T28 45z" fill="#f0cfad"/>
   <path d="M26 34q-7-25 17-28 20-6 29 8 8 7 4 22l-8-13q-13 11-32 5l-8 10z" fill="#705741"/>
   <path d="M36 15q10-7 22-4" stroke="#a08560" fill="none"/>
   <path d="m37 37 6-1m16 0 6 1" fill="none"/>
   <path d="M42 40v3m17-3v3" stroke="#594d3e"/>
   <path d="M46 49q5 5 10-1" fill="none"/>
   <path d="m34 46 5 1m24-1 5-1" stroke="#dba08b" strokeWidth="3"/>
  </g>
  <path d="m86 23 2 7m5-4-5 4" stroke="#d4a14f" strokeWidth="2.5" strokeLinecap="round"/>
 </svg>;
}

const characterIntro={
 student:{quote:'“来得及。”',scene:'朋友家 / 咖啡厅 · 手机满电',card:'精力满格 · 书包容易乱'},
 worker:{quote:'“真的不想回去上班。”',scene:'家里玄关 · 妈妈还在往箱子里塞东西',card:'路线熟 · 行李越来越重'},
 tourist:{quote:'“我知道要走，但我真的走不动了。”',scene:'陌生城市 · 已退房 · 今日 23,487 步',card:'精力低 · 需要休息和认路'},
} as const;

export default function LobbyIntro({run,progress,onSelect}:{run:Run;progress:Progress;onSelect:(id:PlayableCharacterId)=>void}){
 const stats=run.student?.stats;const t=run.characterTime;const id=run.character.id as 'student'|'worker'|'tourist';const intro=characterIntro[id],profile=characterTimeProfiles[id];
 const values=stats?{agility:stats.agility,energy:stats.energy,focus:stats.focus,load:stats.load}:{agility:profile.agility,energy:t?.energy??profile.energy,focus:t?.focus??profile.focus,load:t?.load??profile.load};
 return <div className="lobby-intro">
  <div className="lobby-person">{id==='student'?<StudentPortrait/>:<span className="character-portrait-emoji" role="img" aria-label={run.character.name}>{run.character.emoji}</span>}<b>{run.character.name}</b></div>
  <div className="lobby-person-copy">
   <div className={'student-speech speech-'+id}><h1>我一定会<span>赶上这趟车！</span></h1><p>{intro.quote}</p><small className="lobby-scene">{intro.scene}</small></div>
   <dl className="lobby-attributes" aria-label="人物属性，满分 100">
    {(['agility','energy','focus','load'] as const).map((key,i)=><div key={key}><dt>{['敏捷','精力','专注','负重'][i]}</dt><dd>{values[key]}</dd></div>)}
   </dl>
  </div>
  <div className="character-picker" aria-label="选择赶车人物">{characters.filter(c=>['student','worker','tourist'].includes(c.id)).map(c=>{const characterId=c.id as PlayableCharacterId,unlocked=isCharacterUnlocked(progress,characterId);return <button key={c.id} className={(id===c.id?'selected ':'')+(!unlocked?'locked':'')} aria-pressed={id===c.id} disabled={!unlocked} onClick={()=>onSelect(characterId)}><span>{unlocked?c.emoji:'🔒'}</span><b>{c.id==='worker'?'打工人':c.id==='tourist'?'疲惫游客':'大学生'}</b><small>{unlocked?characterIntro[characterId].card:characterId==='worker'?'大学生赶上一次后解锁':'打工人赶上一次后解锁'}</small></button>;})}</div>
 </div>;
}
