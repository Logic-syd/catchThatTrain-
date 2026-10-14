import type {EventConfig} from './data';
import type {StudentState} from './studentConfig';
import type {CharacterTimeState} from './characterTime';

export const STUDENT_DISTRACTIONS=[
 {id:'student-cat',title:'柱子后面的小猫，过来蹭你了',story:'它翻出肚皮。就摸一下，应该来得及吧？',label:'蹲下来，摸摸小猫',seconds:30,happiness:20,morality:0},
 {id:'student-spectacle',title:'那边围了一大圈人，发生什么了？',story:'有人举着手机，你也忍不住想凑过去看看。',label:'挤进去，围观一小会儿',seconds:40,happiness:20,morality:0},
 {id:'student-help-grandma',title:'老奶奶想请你扶她走到电梯口',story:'电梯就在旁边。你看了眼车票，又看了眼她手里的袋子。',label:'扶奶奶过去，再回来赶车',seconds:35,happiness:0,morality:20},
 {id:'student-tea-shop',title:'茶颜悦色竟然一个人都没排队！',story:'这种机会也太难得了。店员说现在就能做一杯。',label:'买一杯，今天真幸福',seconds:25,happiness:20,morality:0},
] as const;
export function studentDistractionPrompt(id:string,u:StudentState):EventConfig|undefined{
 const d=STUDENT_DISTRACTIONS.find(x=>x.id===id);if(!d)return;
 const gain=d.happiness?`幸福感 +${Math.min(d.happiness,100-u.happiness)}`:`道德 +${Math.min(d.morality,100-u.morality)}`;
 return {id,phase:'station',title:d.title,description:d.story,interaction:{kind:'choice',seconds:12,penalty:0},choices:[
  {id:'indulge',label:d.label,detail:`${gain} · 花 ${d.seconds} 游戏秒`,seconds:d.seconds,waitSeconds:id==='student-help-grandma'?0:d.seconds,fixedWalkSeconds:id==='student-help-grandma'?d.seconds:0},
  {id:'leave',label:'记住车票，继续赶路',detail:'现在不额外花时间',seconds:0},
 ]};
}
/** Emotional scores are story facts only; movement and recovery never read them. */
export function applyStudentDistraction(u:StudentState,id:string,option?:string):StudentState{
 const d=STUDENT_DISTRACTIONS.find(x=>x.id===id);if(!d||option!=='indulge')return u;
 return {...u,happiness:Math.min(100,u.happiness+d.happiness),morality:Math.min(100,u.morality+d.morality),distractions:u.distractions+1,distractionSeconds:u.distractionSeconds+d.seconds};
}

export const WORK_CHALLENGE_IDS=['worker-company-ping','worker-company-revision','worker-company-call'] as const;
export function workChallengePrompt(id:string,t:CharacterTimeState):EventConfig|undefined{
 const step=WORK_CHALLENGE_IDS.indexOf(id as typeof WORK_CHALLENGE_IDS[number]);if(step<0)return;
 const pending=t.workPending,seconds=step===2?12+pending*15:8+pending*12;
 const titles=['工作群又艾特你：“现在确认一下。”','刚回复完，公司又改口：“表格要换版本。”','电话又响了：“你先别上车，听我说完。”'];
 const stories=['出门时回过的消息已经处理了，这是新加的事。','刚才的要求又变了，之前的回复不能替你处理这次变更。','对方还在追加任务。你得决定什么时候把手机放下。'];
 return {id,phase:'station',title:titles[step],description:stories[step]+(pending?`还有 ${pending} 条没有说明的消息。`:''),interaction:{kind:'choice',seconds:12,penalty:0},choices:[
  {id:'boundary',label:step===2?'说明正在赶车，约好上车后处理':'回复正在赶车，确认处理时间',detail:`花 ${seconds} 游戏秒 · 清掉当前追问`,seconds,waitSeconds:seconds},
  ...(step<2?[{id:'work',label:'停下来，现在就把它做完',detail:'花 40 游戏秒 · 完成当前要求，新的要求仍可能来',seconds:40,waitSeconds:40}]:[]),
  {id:'ignore',label:step===2?'挂断，先赶车':'先不回，继续赶路',detail:step===2?`专注 −${Math.min(8,t.focus)} · 当前电话结束`:'现在不花时间 · 下一次追问更久',seconds:0},
 ]};
}
export function applyWorkChallenge(t:CharacterTimeState,id:string,option?:string):CharacterTimeState{
 if(!WORK_CHALLENGE_IDS.some(x=>x===id))return t;
 const last=id==='worker-company-call';
 return {...t,workInterruptions:t.workInterruptions+1,workPending:option==='ignore'&&!last?t.workPending+1:0,focus:last&&option==='ignore'?Math.max(0,t.focus-8):t.focus,workCalls:t.workCalls+(last?1:0)};
}
