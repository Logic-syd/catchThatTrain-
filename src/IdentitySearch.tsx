import {useState} from 'react';
import type {Run,Action} from './engine';
const names:Record<string,string>={wallet:'钱包',phone:'手机',keys:'钥匙',headphones:'耳机',bottle:'水杯',umbrella:'雨伞',notebook:'笔记本',pen:'笔',glasses:'眼镜',charger:'充电宝',tissue:'纸巾',snack:'饼干',lipstick:'润唇膏',comb:'梳子',watch:'手表',camera:'相机',sock:'袜子',sanitizer:'洗手液',id:'身份证',bank:'银行卡',metro:'交通卡',student:'学生证',photo:'照片',receipt:'小票'};
function ObjectArt({id}:{id:string}){
 switch(id){
 case 'wallet':return <><rect x="8" y="16" width="50" height="36" rx="9" fill="#ad785b"/><path d="M12 21h37M12 46h38" stroke="#e0b58c" strokeDasharray="2 3"/><path d="M42 27h18v16H42q-9-8 0-16" fill="#c4956d"/><circle cx="47" cy="35" r="2" fill="#ead9a5"/></>;
 case 'phone':return <><rect x="17" y="4" width="32" height="55" rx="7" fill="#777c7c"/><rect x="21" y="10" width="24" height="40" rx="3" fill="#bed1ca"/><path d="m23 42 18-24M27 11h13" stroke="#f6f0d9"/><circle cx="33" cy="55" r="1.5" fill="#e4e0c9"/></>;
 case 'keys':return <><circle cx="23" cy="21" r="12" fill="none" stroke="#9faaa1" strokeWidth="5"/><path d="m29 30 20 22 6-6-5-5 3-3-10-10M17 33v25h10v-8h-4v-8" stroke="#c7a267" fill="#d8be80" strokeWidth="3"/></>;
 case 'headphones':return <><path d="M11 39V27a21 21 0 0 1 42 0v12" stroke="#8ba297" fill="none" strokeWidth="7"/><rect x="5" y="30" width="13" height="23" rx="6" fill="#c5d2bc"/><rect x="46" y="30" width="13" height="23" rx="6" fill="#c5d2bc"/></>;
 case 'bottle':return <><rect x="24" y="4" width="18" height="9" rx="3" fill="#8aab9b"/><path d="M23 14h20l5 12v28q-15 9-30 0V26Z" fill="#c0d7cf"/><path d="M20 35h25v17H20" fill="#8ebbad"/><path d="M25 23v25" stroke="#edf5e5" strokeWidth="3"/></>;
 case 'umbrella':return <><path d="M18 14q13-10 27 0L40 46H23Z" fill="#969fc0"/><path d="m26 14 3 31m8-31-3 31" stroke="#c8cadd"/><path d="M32 47v8q0 9 9 2" fill="none" stroke="#927b5f" strokeWidth="4"/></>;
 case 'notebook':return <><rect x="10" y="8" width="43" height="48" rx="4" fill="#d9ac77"/><path d="M18 9v46" stroke="#af7e53" strokeWidth="3"/><rect x="26" y="20" width="19" height="15" rx="2" fill="#faf0d1"/><path d="M29 24h12m-12 6h9" stroke="#b8a17b"/></>;
 case 'pen':return <><path d="m20 53 22-43 6 3-23 43-7 4Z" fill="#869c9c"/><path d="m38 17 8 4-7 15" fill="none" stroke="#e4d2a8" strokeWidth="3"/><path d="m18 60 3-8 4 4" fill="#776b5a"/></>;
 case 'glasses':return <><path d="m9 22 4-10m41 10-4-10M28 33q4-7 8 0" stroke="#7c705f" strokeWidth="3" fill="none"/><rect x="5" y="26" width="23" height="18" rx="7" fill="#d9e0cf" stroke="#9b8769" strokeWidth="3"/><rect x="36" y="26" width="23" height="18" rx="7" fill="#d9e0cf" stroke="#9b8769" strokeWidth="3"/></>;
 case 'charger':return <><rect x="11" y="14" width="44" height="34" rx="9" fill="#f3e9cd"/><path d="m35 21-11 13h11l-6 9 15-16H33Z" fill="#cbb779"/><path d="M30 13V7q0-6 18-3t8 10" fill="none" stroke="#b4a98e" strokeWidth="3"/></>;
 case 'tissue':return <><path d="m21 22-4-17 18 8L46 4l-1 20" fill="#fffbed"/><rect x="7" y="21" width="50" height="32" rx="7" fill="#b2c6b5"/><path d="m12 28 37 17m-31 5 14-25" stroke="#dce5d1" strokeWidth="5"/></>;
 case 'snack':return <><path d="m14 8 5 3 6-3 7 3 7-3 6 3 6-3v48l-7-3-6 3-6-3-6 3-7-3-5 3Z" fill="#e5bc77"/><circle cx="32" cy="32" r="14" fill="#bf8e5f"/><circle cx="32" cy="32" r="11" fill="#efd09a"/><path d="m26 27 1 1m9 0 1 1m-5 9 1 1m-8-2 1 1m12 1 1 1" stroke="#997151" strokeWidth="3"/></>;
 case 'lipstick':return <><rect x="22" y="28" width="22" height="30" rx="4" fill="#c0949b"/><path d="M25 28V15l15-7v20" fill="#d78778"/><path d="M24 36h18" stroke="#e6c59a" strokeWidth="4"/></>;
 case 'comb':return <><path d="M8 16h49q8 4 0 9H8Z" fill="#b59cbd"/><path d="M12 24v23m6-23v23m6-23v23m6-23v23m6-23v23m6-23v23m6-23v23m6-23v23" stroke="#b59cbd" strokeWidth="3"/></>;
 case 'watch':return <><rect x="24" y="2" width="16" height="60" rx="6" fill="#b99978"/><circle cx="32" cy="32" r="17" fill="#e4d4b1"/><circle cx="32" cy="32" r="13" fill="#fcf3da"/><path d="M32 22v11l8 4" stroke="#a08c6d" strokeWidth="2" fill="none"/></>;
 case 'camera':return <><path d="m16 20 6-9h17l5 9" fill="#7e8f86"/><rect x="4" y="19" width="56" height="35" rx="8" fill="#97a69b"/><circle cx="33" cy="36" r="14" fill="#60746d"/><circle cx="33" cy="36" r="9" fill="#b5ccc0"/><circle cx="30" cy="33" r="3" fill="#e0edd5"/><rect x="10" y="25" width="8" height="5" rx="2" fill="#f0d7a4"/></>;
 case 'sock':return <><path d="M25 5h25v34L31 58q-23 6-22-7L25 33Z" fill="#ddd3b0"/><path d="M25 12h24m-24 6h24" stroke="#acba98" strokeWidth="4"/><path d="m11 47 13 8m15-20 9 5" stroke="#bdc9a7" strokeWidth="10"/></>;
 default:return <><path d="M25 17V8h24v5H34v5" stroke="#98af9d" strokeWidth="5" fill="none"/><rect x="15" y="18" width="34" height="40" rx="10" fill="#bed3c0"/><rect x="22" y="29" width="20" height="20" rx="6" fill="#f4eed3"/><path d="M32 33v12m-6-6h12" stroke="#94b39c" strokeWidth="3"/></>;
 }
}
function CardArt({id}:{id:string}){
 const colors:Record<string,string>={id:'#dce9de',bank:'#b7c8b0',metro:'#dcbe89',student:'#b6cbda',photo:'#fff8e8',receipt:'#f6efd9'};
 return <g>
 <rect width="96" height="60" rx="5" fill={colors[id]} stroke="#baa785" strokeWidth="1.2"/>
 {id==='id'?<><path d="M5 15q35-20 86 32M3 30q30-19 88 14" stroke="#bdd4c5" fill="none" strokeWidth="3"/><text x="8" y="12" fontSize="6" fill="#7b937f">居民身份证</text><rect x="62" y="17" width="27" height="33" rx="2" fill="#f1e9d3"/><circle cx="76" cy="28" r="7" fill="#967b5f"/><path d="M66 48v-7q10-14 20 0v7" fill="#859f94"/><path d="M9 24h26M9 32h41M9 40h33M9 48h40" stroke="#91a99a" strokeWidth="2"/><text x="8" y="56" fontSize="4" fill="#91a99a">仅为游戏示意</text></>
 :id==='photo'?<><rect x="7" y="6" width="82" height="45" fill="#c8dac7"/><path d="m9 45 23-25 20 17 16-21 20 29" fill="#a0b5a0"/><circle cx="72" cy="17" r="6" fill="#e8d7a0"/><path d="M27 48V37m21 11V37" stroke="#928373" strokeWidth="6"/></>
 :id==='receipt'?<><text x="32" y="14" fontSize="8" fill="#a6997e">便利店</text><path d="M12 23h72M12 30h50M12 37h69M12 44h62M12 51h72" stroke="#bfb295" strokeDasharray="3 2"/></>
 :<><text x="9" y="15" fontSize="8" fill="#6f795f">{names[id]}</text>{id==='bank'?<rect x="12" y="24" width="16" height="13" rx="3" fill="#ecdb9c"/>:<circle cx="76" cy="32" r="11" fill="#f4eed5" opacity=".7"/>}<path d="M10 46h53M10 51h31" stroke="#f8f2dd" strokeWidth="2"/><path d="m48 19 6 3-6 3m10-6 6 3-6 3" stroke="#8e9e7f" fill="none"/></>}
 </g>;
}
export default function IdentitySearch({run,dispatch}:{run:Run;dispatch:React.Dispatch<Action>}){
 const [wrong,setWrong]=useState('');const wallet=run.identityStage==='wallet';
 const pick=(id:string)=>{const correct=id===(wallet?'wallet':'id');setWrong(correct?'':'这是'+names[id]+'，再找找！−5 秒');dispatch({type:'ID_PICK',item:id});};
 return <div className="identity-search">
 <div className="search-steps"><span className={wallet?'current':'complete'}>① 找钱包</span><i>→</i><span className={!wallet?'current':''}>② 找身份证</span></div>
 <div className="search-picture" key={run.identityStage}>
 {wallet?<svg viewBox="0 0 360 318" aria-label="摊开的背包，里面散放着十八件物品">
 <rect x="2" y="2" width="356" height="314" rx="30" fill="#e4d0a8"/><rect x="12" y="12" width="336" height="294" rx="24" fill="#f3e5c6" stroke="#bc9d6e" strokeDasharray="4 5"/>
 <path d="M24 104q153 17 310-3M22 207q157-14 314 3" fill="none" stroke="#deccaa" strokeWidth="1.5"/><path d="M33 29q100-12 271 0" fill="none" stroke="#dfcda6" strokeWidth="3"/>
 {run.identityItems.map((id,i)=><g key={id} role="button" tabIndex={0} aria-label={names[id]} onClick={()=>pick(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(id);}}} className="search-object" transform={'translate('+(8+i%6*58)+','+(23+Math.floor(i/6)*97+(i%3-1)*7)+')'}>
 <rect x="0" y="-9" width="57" height="84" rx="15" fill="transparent"/>
 <g transform={'translate(1 4) rotate('+((i*17)%25-12)+' 28 28) scale(.82)'}><ObjectArt id={id}/></g></g>)}
 <text x="180" y="304" fontSize="8" textAnchor="middle" fill="#b59970">包里什么都有，偏偏钱包躲起来了。</text></svg>
 :<svg viewBox="0 0 360 280" aria-label="打开的钱包，找出六张卡片中的身份证">
 <rect x="2" y="2" width="356" height="276" rx="28" fill="#d7b28d"/><rect x="10" y="10" width="340" height="260" rx="22" fill="#bd8b66" stroke="#e9caa1" strokeDasharray="3 4"/>
 <path d="M16 143h328" stroke="#9e704f" strokeWidth="3"/><path d="M25 221q160 20 312-2v38H25" fill="#ab7c57"/><path d="M30 247h297" stroke="#dcba91" strokeDasharray="3 4"/>
 {run.identityCards.map((id,i)=><g key={id} role="button" tabIndex={0} aria-label={names[id]} onClick={()=>pick(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(id);}}} className="search-object" transform={'translate('+(17+i%3*114)+','+(40+Math.floor(i/3)*112)+') rotate('+((i*11)%13-6)+' 48 30)'}>
 <rect x="-5" y="-12" width="106" height="84" rx="6" fill="transparent"/><CardArt id={id}/></g>)}
 </svg>}
 </div>
 <p className={'search-instruction '+(wrong?'mistake':'')} role="status">{wrong||(wallet?'直接点图里的钱包！':'钱包打开了，点出身份证！')}</p>
 </div>;
}
