import {STATIONS} from './stations';

export type SharedChallenge={stationId:string;stationName:string;title:string;success:boolean};
export const SHARE_GAME_URL='https://logic-syd.github.io/catchThatTrain-/';

export function challengeUrl(pageUrl:string,stationId:string,title:string,success:boolean){
 const url=new URL(pageUrl);
 url.search='';
 url.hash='';
 url.searchParams.set('challenge',stationId);
 url.searchParams.set('title',title.slice(0,28));
 url.searchParams.set('won',success?'1':'0');
 return url.toString();
}

export function readChallenge(search:string):SharedChallenge|null{
 const params=new URLSearchParams(search);
 const station=STATIONS.find(s=>s.id===params.get('challenge'));
 const title=params.get('title')?.trim().slice(0,28);
 const won=params.get('won');
 if(!station||!title||(won!=='0'&&won!=='1'))return null;
 return {stationId:station.id,stationName:station.name,title,success:won==='1'};
}
