import type { EventConfig } from './data';

export type EscalatorState = 'clear' | 'steady' | 'blocked';
export type StationLuck = {
 elder: 'grandma' | 'grandpa';
 elderScam: boolean;
 escalators: EscalatorState[];
};
export const ELDER_SCAM_CHANCE = .3;
export const ESCALATOR_X = [130,320,510];

export function createStationLuck(rng=Math.random):StationLuck {
 const elder=rng()<.5?'grandma':'grandpa';
 const elderScam=rng()<ELDER_SCAM_CHANCE;
 const escalators:EscalatorState[]=['clear','steady','blocked'];
 for(let i=escalators.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[escalators[i],escalators[j]]=[escalators[j],escalators[i]];}
 return {elder,elderScam,escalators};
}

export function elderPrompt(luck:StationLuck):EventConfig {
 const name=luck.elder==='grandma'?'老奶奶':'老爷爷';
 return {id:'elder-block',title:`${name}挡在路中间了！`,phase:'station',description:`${name}停下来翻找东西，把通道挡住了。侧面还有一点空隙，你要怎么过去？`,interaction:{kind:'choice',seconds:8,penalty:10},choices:[
  {label:'不推，从旁边绕开',detail:'绕侧面通过 · −10 秒',seconds:10,effect:'elder-detour',detour:{x:235,y:1260,label:'从旁边绕过老人'}},
  {label:'推一下，挤过去',detail:'顺利通过 −2 秒；可能被碰瓷，耽误 60 秒',seconds:2,effect:'elder-push'}
 ]};
}

export function elderOutcome(scam:boolean):EventConfig {
 return {id:'elder-outcome',phase:'station',title:scam?'糟了，被碰瓷了！':'对方挪开了，你挤了过去。',description:scam?'对方拉住你不让走。等工作人员来把事情说清楚，已经耽误了 60 秒。':'这次顺利通过，耽误了 2 秒。背好包，继续赶车！',interaction:{kind:'outcome',seconds:4,penalty:0},choices:[{label:'背好包，继续跑！',detail:scam?'已扣 60 秒':'已扣 2 秒',seconds:0}]};
}

export function escalatorPrompt():EventConfig {
 return {id:'escalator-choice',phase:'station',title:'三部扶梯，选哪一部？',description:'都能上出发层。拐角挡住了视线，看不清前面的情况，选好再过去。',interaction:{kind:'escalators',seconds:10,penalty:0},choices:ESCALATOR_X.map((_,i)=>({label:`${i+1} 号扶梯`,detail:'前方情况未知',seconds:0,escalator:i}))};
}

export function escalatorRide(state:EscalatorState,lane:number):EventConfig {
 const detour={x:ESCALATOR_X[lane],y:952,label:`沿 ${lane+1} 号扶梯上楼`};
 const common={id:'escalator-ride',phase:'station' as const,interaction:{kind:'escalator-ride' as const,seconds:8,penalty:state==='blocked'?30:state==='steady'?15:10}};
 if(state==='clear')return {...common,title:'前面空着，可以快走两步！',description:`${lane+1} 号扶梯畅通，抓紧这段空隙上楼。`,choices:[
  {label:'快走两步！',detail:'短暂加速 4 秒',seconds:0,boost:4,detour},
  {label:'站稳，跟着扶梯走',detail:'慢慢上楼 · −10 秒',seconds:10,detour}
 ]};
 if(state==='blocked')return {...common,title:'前面的人，把扶梯堵住了。',description:`${lane+1} 号扶梯前方站满了人。只能跟在后面，等出口慢慢腾开。`,choices:[{label:'等前面的人挪开',detail:'被堵住了 · −30 秒',seconds:30,detour}]};
 return {...common,title:'这部扶梯，只能慢慢往上。',description:`${lane+1} 号扶梯有人正常站立，留出距离，跟着队伍上楼。`,choices:[{label:'跟着扶梯上楼',detail:'正常通行 · −15 秒',seconds:15,detour}]};
}
