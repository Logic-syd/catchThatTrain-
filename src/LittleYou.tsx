import './characterMotion.css';

export type LittleYouMotion='idle'|'running'|'sprinting'|'waiting'|'panic'|'blocked'|'asking'|'sidestepping'|'braking';
type Props={motion?:LittleYouMotion;characterId?:string;parentAppearance?:'mom'|'dad';childGap?:number;carrying?:boolean;effort?:'fresh'|'strained'|'exhausted';facing?:'back'|'front'};

// Separate joints keep the stride visible even when the player's map position is blocked.
function Leg({x,y,side,small=false}:{x:number;y:number;side:'left'|'right';small?:boolean}){
 return <g transform={`translate(${x} ${y})`}><g className={'little-leg '+side}>
  <path d={`M0 0l${side==='left'?-2:2} ${small?8:10}`} stroke="#765c46" strokeWidth={small?4:5.5} strokeLinecap="round"/>
  <ellipse cx={side==='left'?-3:3} cy={small?9:12} rx={small?3:4.5} ry="2.7" fill="#f5e6c4" stroke="#765c46" strokeWidth="1.5"/>
 </g></g>;
}
function Arm({x,y,side,small=false}:{x:number;y:number;side:'left'|'right';small?:boolean}){
 return <g transform={`translate(${x} ${y})`}><g className={'little-arm '+side}>
  <path d={`M0 0q${side==='left'?-5:5} 4 ${side==='left'?-7:7} ${small?8:12}`} fill="none" stroke="#edc6a4" strokeWidth={small?4:5.5} strokeLinecap="round"/>
 </g></g>;
}
function MotionMarks(){return <g className="little-speed-lines" stroke="#c4a071" strokeWidth="1.8" strokeLinecap="round"><path d="M9 33H3m7 7H0m62-6h7"/><path d="M9 49H3m57 4h8"/></g>;}

export function LittleYou({motion='idle',characterId='student',parentAppearance='mom',childGap=0,carrying=false,effort='fresh',facing='back'}:Props){
 const tired=effort!=='fresh';
 if(characterId==='mom')return <svg viewBox="0 0 102 72" className={'little-you '+motion+' effort-'+effort+' character-mom'+(carrying?' carrying-child':'')} role="img" aria-label={`${parentAppearance==='mom'?'妈妈':'爸爸'}${carrying?'抱着':'牵着'}孩子赶车`}>
  <ellipse className="little-shadow" cx="50" cy="64" rx="37" ry="5" fill="#75664c22"/>
  <MotionMarks/>
  <g className="little-body">
   <Leg x={27} y={49} side="left"/><Leg x={42} y={49} side="right"/>
   <Arm x={23} y={31} side="left"/><Arm x={47} y={31} side="right"/>
   <path d="M22 27q13-7 25 0l3 25H20z" fill={parentAppearance==='mom'?'#cd8f72':'#829e91'} stroke="#6d6650" strokeWidth="2"/>
   <circle cx="35" cy="17" r="13" fill="#e9bd98"/>
   <path d={parentAppearance==='mom'?'M21 18q0-18 14-18 17 0 14 20l-3 7-2-12Q33 6 25 21z':'M22 15q1-16 14-15 15 0 13 18-12-8-27-3z'} fill="#604c3c"/>
   <circle cx="31" cy="19" r="1" fill="#55463a"/><circle cx="39" cy="19" r="1" fill="#55463a"/>
   {tired?<ellipse cx="35" cy="26" rx="2.2" ry="3.5" fill="#aa735a"/>:<path d="M31 25q4 3 8 0" fill="none" stroke="#aa735a" strokeWidth="1.4"/>}
  </g>
  <g transform={`translate(${Math.min(15,childGap*1.6)} ${carrying?-17:6})`}><g className="little-child">
   <Leg x={67} y={49} side="left" small/><Leg x={77} y={49} side="right" small/>
   <Arm x={63} y={34} side="left" small/><Arm x={80} y={34} side="right" small/>
   <path d="M62 31q9-6 18 0l2 20H60z" fill="#e3b869" stroke="#90714d" strokeWidth="1.5"/>
   <circle cx="71" cy="25" r="9" fill="#edc29d"/><path d="M62 24q0-12 9-12 10 0 9 12-8-7-18 0z" fill="#634e3d"/>
   <circle cx="68" cy="26" r=".8" fill="#554638"/><circle cx="74" cy="26" r=".8" fill="#554638"/>
  </g></g>
  {!carrying&&<path d="M54 42q7 9 10 1" fill="none" stroke="#eac19e" strokeWidth="3" strokeLinecap="round"/>}
  <path className="sweat" d="M53 6q6 9 0 9t0-9" fill="#9ac8cc"/>
  <g className="little-pant"><text x="48" y="28">呼</text><path d="M50 32q7-4 12 0" fill="none" stroke="#b29c78" strokeWidth="1.5"/></g>
 </svg>;
 const body=characterId==='tourist'?'#8ca6a0':characterId==='worker'?'#8a9b86':'#91ae92';
 const bag=characterId==='tourist'?'#b6a884':characterId==='worker'?'#8b725f':'#d1b071';
 const aria=characterId==='worker'?'拉着妈妈塞满东西的大箱子':characterId==='tourist'?'拉着小号行李箱、背着背包的疲惫游客':'背着小书包的大学生';
 return <svg viewBox="0 0 72 68" className={'little-you '+motion+' effort-'+effort+' character-'+characterId} role="img" aria-label={aria}>
  <ellipse className="little-shadow" cx="32" cy="59" rx="17" ry="4" fill="#776c4525"/>
  <MotionMarks/>
  {characterId!=='student'&&<g className="rolling-case">
   <path d={characterId==='worker'?'M53 26v-5q0-3 4-3t4 3v5':'M55 30v-4q0-2 3-2t3 2v4'} fill="none" stroke="#806b52" strokeWidth="2"/>
   <rect x={characterId==='worker'?49:52} y={characterId==='worker'?26:30} width={characterId==='worker'?17:13} height={characterId==='worker'?28:24} rx="4" fill={characterId==='worker'?'#c58a63':'#d5b879'} stroke="#816c50" strokeWidth="1.8"/>
   <path d={characterId==='worker'?'M52 32h11m-11 5h11':'M55 35h7'} stroke="#f7e9c7" strokeWidth="2"/>
   <circle cx="53" cy="57" r="2" fill="#766148"/><circle cx="63" cy="57" r="2" fill="#766148"/>
  </g>}
  <g className="little-body">
   <Leg x={24} y={43} side="left"/><Leg x={37} y={43} side="right"/>
   <Arm x={18} y={30} side="left"/><Arm x={43} y={30} side="right"/>
   <ellipse cx="30" cy="34" rx="15" ry="12" fill={body} stroke="#667756" strokeWidth="2"/>
   <path d="M21 26v19m18-19v19" stroke="#a4885c" strokeWidth="3"/>
   <g className="little-backpack"><rect x="18" y="30" width="24" height="20" rx="7" fill={bag} stroke="#806d50" strokeWidth="1.5"/><rect x="22" y="40" width="16" height="7" rx="3" fill="#e4c48c"/></g>
   {facing==='front'?<>
    <circle cx="30" cy="23" r="12" fill="#edc6a4" stroke="#725b45" strokeWidth="1.8"/>
    <path d="M18 22q-1-16 12-16 15 0 12 17l-5-8q-8 5-19 7z" fill="#69543f"/>
    <path d={tired?'M23 23l4 1m6 0 4-1':'M24 23v1m12-1v1'} stroke="#5d4c3e" strokeWidth="2" strokeLinecap="round"/>
    {tired?<ellipse cx="30" cy="30" rx="2.5" ry="3.5" fill="#9b6655"/>:<path d="M26 29q4 4 8 0" fill="none" stroke="#9b6655" strokeWidth="1.5"/>}
    <ellipse cx="21" cy="28" rx="3" ry="1.5" fill="#d7977c"/><ellipse cx="39" cy="28" rx="3" ry="1.5" fill="#d7977c"/>
   </>:<><circle cx="30" cy="25" r="11.5" fill="#69543f" stroke="#4f4537" strokeWidth="2"/><path d="M23 19q7-6 14 0" fill="none" stroke="#967654" strokeWidth="2.2" strokeLinecap="round"/></>}
  </g>
  <path className="sweat" d="M47 12q8 12 0 12t0-12" fill="#9ac8cc"/>
  <g className="little-pant"><text x="48" y="30">呼</text><path d="M48 35q7-4 12 0" fill="none" stroke="#b29c78" strokeWidth="1.5"/></g>
 </svg>;
}
