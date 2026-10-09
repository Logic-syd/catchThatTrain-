import {stationFor} from './stations';
import type {ReactNode} from 'react';
import type {Run} from './engine';

type TaskKind='entry'|'security-queue'|'security-tray'|'identity'|'gate-choice'|'gate-scan'|'wayfinding'|'floor-sign'|'vertical-choice'|'escalator-choice'|'escalator'|'stairs'|'lift'|'phone'|'child'|'encounter'|'crowd'|'bag-snag'|'luggage'|'rest'|'board-train';
const color={ink:'#765e46',faint:'#ac9676',cream:'#fff9eb',paper:'#f2e6ca',line:'#cfbc98',sage:'#94a986',peach:'#d6a184',blue:'#95ada9',gold:'#d5b477',skin:'#edd0ab'};
const taskId=(run:Run)=>run.event?.id??run.stationJourney[run.stationBeat]?.id??'';
function verticalMode(run:Run){
 return run.student?.vertical??[...run.stationDecisions].reverse().find(choice=>choice.group==='vertical-choice')?.value??'escalator';
}
function taskKind(run:Run):TaskKind{
 const id=taskId(run),interaction=run.event?.interaction?.kind;
 if(id==='board-train')return 'board-train';
 if(id==='security-queue')return 'security-queue';
 if(id==='bj-tray'||id==='bj-parent-strict'||id==='security'||interaction==='scan')return 'security-tray';
 if(id==='identity-search'||interaction==='identity')return 'identity';
 if(id==='gate-scan')return 'gate-scan';
 if(id==='gates'||interaction==='gates')return 'gate-choice';
 if(id==='vertical-choice'||id==='gz-lift'||id==='broken-lift'||id==='hz-parent-lift')return 'vertical-choice';
 if(id==='escalator-choice'||interaction==='escalators')return 'escalator-choice';
 if(id==='escalator-ride'||id==='escalator-operation'){
  const mode=verticalMode(run);return mode==='stairs'?'stairs':mode==='lift'?'lift':'escalator';
 }
 if(id==='wh-floor'||id==='wh-landing')return 'floor-sign';
 if(['bj-entry','exit-closed','gz-route','hz-fork'].includes(id))return 'entry';
 if(['station-sign','hz-zone','zz-wing','zz-number','old-ticket','tourist-wayfinding'].includes(id)||interaction==='gate-number')return 'wayfinding';
 if(id==='worker-boss-call')return 'phone';
 if(id.includes('parent-'))return 'child';
 if(id==='bag-snag')return 'bag-snag';
 if(id==='suitcase'||id==='tourist-wheel')return 'luggage';
 if(id==='gz-crossing')return 'crowd';
 if(id==='student-breath')return 'rest';
 return 'encounter';
}

export function stationTaskLabel(run:Run):string{
 const id=taskId(run),kind=taskKind(run);
 if(id==='bj-entry')return '看清开放标识，再选入口';
 if(id==='bj-parent-strict')return '水壶、零食和包要分开放';
 if(id==='security')return '找出剪刀，交给安检员';
 if(id==='wh-landing')return '按住看清 2F 出发标识';
 if(id==='zz-number')return '核对车票，再选检票口编号';
 if(id==='hz-parent-lift')return '看清维修牌，再选电梯';
 if(id==='gz-parent-carry')return '按住把孩子抱起来';
 if(id==='zz-parent-child')return '按住牵好孩子，再看方向';
 if(id==='parent-gap')return '先接到孩子，再一起走';
 if(id==='parent-toilet')return '孩子想上厕所，先作决定';
 if(id==='parent-tired')return '孩子走不动了，先照顾一下';
 if(id.includes('parent-duck'))return '孩子盯着小店，先作决定';
 if(id==='sh-parent-shop')return '先处理孩子喝水的事';
 if(id==='tourist-wheel')return '处理卡住的箱轮，再前进';
 const labels:Record<TaskKind,string>={
  entry:'先看路牌，再选一条通路',
  'security-queue':'观察队伍，再选 A、B 或 C 队',
  'security-tray':'按住放稳背包，送入安检机',
  identity:run.student?'先选书包夹层，再按住翻找':'先找钱包，再取出身份证',
  'gate-choice':'比较步行和排队，再选通道',
  'gate-scan':'按住刷身份证，等绿灯放行',
  wayfinding:'对照车票，选对检票口区域',
  'floor-sign':'认准 2F 铁路出发，再上楼',
  'vertical-choice':'看好楼梯、扶梯和电梯再选',
  'escalator-choice':'选一部扶梯，再看前方情况',
  escalator:run.event?.interaction?.kind==='tap'?'连续点击，扶稳后快步上楼':run.event?.interaction?.kind==='hold'?'按住扶手，走完这一段':'看清前方情况，再决定怎么上楼',
  stairs:'连续点击，一步一步上楼',
  lift:'按住开门，收好行李进电梯',
  phone:'老板来电话了，先决定怎么回',
  child:'先安抚孩子，再一起赶路',
  encounter:run.event?.interaction?.kind==='swipe'?'向上滑动，从旁边侧身通过':'有人挡在前面，先决定怎么过',
  crowd:'连续点击说借过，让出通路',
  'bag-snag':'向上滑动，解开挂住的肩带',
  luggage:'向上滑动，把箱子提过门槛',
  rest:'先调整呼吸，再继续赶路',
  'board-train':'最后三步，连续点击冲上车',
 };
 return labels[kind];
}

function Person({x,y,scale=1,coat=color.sage,child=false}:{x:number;y:number;scale?:number;coat?:string;child?:boolean}){
 return <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <ellipse cx="0" cy="41" rx="20" ry="4" fill="#99836522"/>
  <path d="M-8 25v13m16-13v13" stroke={color.ink} strokeWidth="7" strokeLinecap="round"/>
  <path d="M-16 7-21 23M16 7l5 16" stroke={color.skin} strokeWidth="6" strokeLinecap="round"/>
  <rect x="-15" y="-1" width="30" height="31" rx="11" fill={coat}/>
  <circle cy="-17" r="15" fill={color.skin}/>
  <path d={child?'M-14-19q2-20 26-7l3 9-11-8-16 10Z':'M-15-19q0-22 28-5l2 12-12-12-17 11Z'} fill={color.ink}/>
  <circle cx="-5" cy="-15" r="1.4" fill={color.ink}/><circle cx="5" cy="-15" r="1.4" fill={color.ink}/>
 </g>;
}
function Bag({x,y,scale=1}:{x:number;y:number;scale?:number}){
 return <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-13-27v-8q13-12 26 0v8" fill="none" stroke={color.ink} strokeWidth="5"/>
  <rect x="-28" y="-28" width="56" height="65" rx="17" fill={color.gold} stroke="#b29260" strokeWidth="2"/>
  <path d="M-19-15h38" stroke="#f6e6c0" strokeWidth="4"/>
  <rect x="-20" y="6" width="40" height="24" rx="7" fill="#c69f67"/>
  <path d="M-15 13h30" stroke={color.cream} strokeWidth="2"/><path d="M25-15v39" stroke="#a7895a" strokeWidth="3"/>
 </g>;
}
function IDCard({x,y,scale=1}:{x:number;y:number;scale?:number}){
 return <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <rect x="-41" y="-26" width="82" height="52" rx="7" fill="#f9f6e7" stroke={color.sage} strokeWidth="2"/>
  <rect x="13" y="-15" width="20" height="27" rx="3" fill="#d8e2ce"/><circle cx="23" cy="-6" r="5" fill={color.ink}/><path d="M16 10q1-12 14 0" fill={color.blue}/>
  <path d="M-31-11h30M-31-2h27M-31 8h35M-31 17h58" stroke="#a0b196" strokeWidth="3" strokeLinecap="round"/>
 </g>;
}
function Sign({x,y,width=150,title,sub}:{x:number;y:number;width?:number;title:string;sub?:string}){
 return <g transform={`translate(${x} ${y})`}>
  <rect width={width} height={sub?53:35} rx="9" fill={color.cream} stroke={color.line} strokeWidth="2"/>
  <text x={width/2} y="23" textAnchor="middle" fontSize="17" fontWeight="750">{title}</text>
  {sub&&<text x={width/2} y="43" textAnchor="middle" fontSize="13" fill={color.faint}>{sub}</text>}
 </g>;
}
function Floor(){return <><path d="M18 198h404" stroke={color.line} strokeWidth="2"/><path d="m35 204 40-57m88 57 20-57m100 57-15-57m106 57-34-57" stroke="#d5c4a044" strokeWidth="2"/></>;}
function UpArrow({x,y}:{x:number;y:number}){return <path d={`M${x} ${y+24}v-24m-9 10 9-10 9 10`} fill="none" stroke={color.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>;}

function EntryScene({run,p}:{run:Run;p:number}){
 const id=taskId(run);
 const sides=id==='bj-entry'?[['西侧入口','开放通行'],['东侧出口','只出不进']]:id==='hz-fork'?[['← 西广场','到达出口'],['东侧 →','铁路出发']]:id==='gz-route'?[['外围连桥','远一点 · 少换层'],['中区近路','人群 · 需要换层']]:[['← 铁路出发','沿站内标识'],['机场接驳 →','另一条通路']];
 return <><Floor/>{sides.map(([title,sub],i)=><g key={title} transform={`translate(${35+i*218} 36)`}>
  <rect x="5" y="0" width="147" height="146" rx="15" fill="#d9c7a7"/><rect x="18" y="16" width="121" height="130" rx="6" fill="#e9dfc7"/>
  <path d="M18 108h121" stroke={color.line} strokeWidth="2"/><Sign x={-4} y={5} width={164} title={title} sub={sub}/>
  {id==='bj-entry'&&i===1&&<><path d="M28 122h101" stroke={color.peach} strokeWidth="7"/><path d="M38 113v27m82-27v27" stroke={color.ink} strokeWidth="3"/></>}
  <path d="M79 126V83m-12 14 12-14 12 14" fill="none" stroke={color.faint} strokeWidth="4" strokeLinecap="round"/>
 </g>)}<Person x={220} y={159-p*8} scale={.8}/><Bag x={201} y={165-p*8} scale={.35}/></>;
}
function QueueScene({run}:{run:Run}){
 const queues=['A','B','C'].map(letter=>{
  const choice=run.event?.choices.find(option=>new RegExp(`^${letter}\\s*队`).test(option.label));
  return {letter,people:choice?.label.match(/(\d+)\s*人/)?.[1]};
 });
 return <>{queues.map(({letter,people},i)=><g key={letter} transform={`translate(${20+i*140} 17)`}>
  <rect x="0" y="0" width="120" height="183" rx="17" fill={color.cream} stroke={color.line}/>
  <text x="60" y="24" textAnchor="middle" fontSize="19" fontWeight="800">{letter} 队 · {people??'?'} 人</text>
  <rect x="29" y="36" width="62" height="36" rx="4" fill={color.blue}/><rect x="39" y="44" width="42" height="28" rx="2" fill="#e8eddf"/>
  <path d="M17 91v72m86-72v72M17 93h86M17 162h86" stroke={color.line} strokeWidth="3" fill="none"/>
  {Array.from({length:Math.min(12,Number(people??0))},(_,j)=><Person key={j} x={43+(j%2)*34} y={90+Math.floor(j/2)*22} scale={.38} coat={j%2?color.peach:color.sage}/>)}
  {!people&&<text x="60" y="128" textAnchor="middle" fontSize="17" fill={color.faint}>走近再看</text>}
 </g>)}</>;
}
function TrayScene({run,p}:{run:Run;p:number}){
 const scan=run.event?.interaction?.kind==='scan',strict=taskId(run)==='bj-parent-strict';
 return <><Floor/>
  <rect x="224" y="30" width="178" height="145" rx="17" fill={color.blue}/><rect x="250" y="62" width="126" height="104" rx="7" fill="#6d8078"/>
  {[0,1,2,3,4,5].map(i=><path key={i} d={`M${259+i*21} 65v96`} stroke="#9fae9b" strokeWidth="7"/>)}
  <text x="313" y="53" textAnchor="middle" fontSize="17" fill={color.cream} fontWeight="750">行李安检</text>
  <rect x="60" y="150" width="347" height="28" rx="14" fill="#c3b99f" stroke={color.ink} strokeWidth="2"/>
  {Array.from({length:14},(_,i)=><circle key={i} cx={76+i*24} cy="165" r="7" fill="#e7ddc7" stroke={color.line}/>)}
  <g data-scene-object="tray" transform={`translate(${108+p*197} ${137-p*5})`}>
   <path d="M-44 0h88l-8 18h-73Z" fill="#eef0e1" stroke={color.blue} strokeWidth="3"/>
   <g data-scene-object="backpack" transform={`translate(0 ${-28+(1-p)*-17})`}><Bag x={0} y={0} scale={.76}/></g>
   {strict&&<><rect x="-40" y="-26" width="14" height="27" rx="4" fill={color.blue}/><rect x="26" y="-20" width="17" height="21" rx="3" fill={color.peach}/></>}
  </g>
  {scan?<g transform="translate(80 56)"><rect x="-51" y="-30" width="104" height="55" rx="10" fill={color.cream} stroke={color.line}/><circle cx="-14" cy="5" r="8" fill="none" stroke={color.ink} strokeWidth="3"/><circle cx="9" cy="5" r="8" fill="none" stroke={color.ink} strokeWidth="3"/><path d="m-10-1 22-22M6-1-15-23" stroke={color.ink} strokeWidth="3"/><text x="0" y="47" textAnchor="middle" fontSize="16">需要开包检查</text></g>:<path d={`M49 87q10 0 ${28+p*34} ${24+p*12}`} fill="none" stroke={color.skin} strokeWidth="17" strokeLinecap="round"/>}
  <Person x={419} y={126} scale={.65} coat={color.ink}/>
 </>;
}
function IdentityScene({run,p}:{run:Run;p:number}){
 const names=run.student?['前袋','侧袋','主袋','电脑夹层']:run.identityStage==='card'?['身份证','银行卡','交通卡','学生证']:['钱包','水杯','手机','耳机'];
 return <><Floor/><path d="M163 46V31q55-24 109 0v15" stroke={color.ink} strokeWidth="10" fill="none"/>
  <rect x="68" y="42" width="305" height="157" rx="34" fill={color.gold} stroke="#b3915d" strokeWidth="3"/>
  <path d="M90 65h260" stroke={color.cream} strokeWidth="5" strokeDasharray="4 3"/>
  {names.map((name,i)=>{const searched=run.student?.searched.includes(i);return <g key={name} transform={`translate(${91+(i%2)*141} ${82+Math.floor(i/2)*55})`}>
   <rect width="116" height="43" rx="10" fill={searched?'#c2b28e':'#edd6ac'} stroke="#b59462" strokeWidth="2"/>
   <path d="M9 10h96" stroke="#a38a63" strokeWidth="2"/><text x="58" y="31" textAnchor="middle" fontSize="16">{searched?'已翻过':name}</text>
  </g>;})}
  {run.identityReady&&<g data-scene-object="identity-card" transform="translate(0 -35)"><IDCard x={220} y={99} scale={.7}/></g>}
  <path d={`M393 175q-15-9-25-${18+p*40}`} stroke={color.skin} strokeWidth="20" strokeLinecap="round" fill="none"/>
 </>;
}
function GateScene({run,p,choice}:{run:Run;p:number;choice:boolean}){
 if(choice)return <><Floor/><Sign x={129} y={13} width={182} title={`${run.gate} 检票通道`}/>{Array.from({length:8},(_,i)=><g key={i} transform={`translate(${26+(i%4)*103} ${66+Math.floor(i/4)*65})`}>
  <rect width="79" height="54" rx="9" fill={color.cream} stroke={color.line} strokeWidth="2"/><rect x="10" y="22" width="13" height="31" rx="5" fill={color.blue}/><rect x="56" y="22" width="13" height="31" rx="5" fill={color.blue}/><path d="M23 36h33" stroke={color.peach} strokeWidth="4"/><text x="40" y="17" textAnchor="middle" fontSize="16" fontWeight="750">{i+1} 号</text>
 </g>)}</>;
 return <><Floor/><Sign x={145} y={12} width={150} title={`${run.gate} · 刷证进站`}/>
  <path d="M112 195 174 95h92l66 100" fill="#e4dcc4"/>
  <rect x="103" y="76" width="65" height="113" rx="16" fill={color.blue}/><rect x="271" y="76" width="65" height="113" rx="16" fill={color.blue}/>
  <g data-scene-object="gate-doors"><path d={`M168 120h${51*(1-p)}v47h-${51*(1-p)}Z`} fill={color.peach} opacity={.9}/><path d={`M271 120h-${51*(1-p)}v47h${51*(1-p)}Z`} fill={color.peach} opacity={.9}/></g>
  <rect x="113" y="86" width="44" height="31" rx="6" fill="#edf0dc" stroke={color.ink}/><text x="135" y="107" textAnchor="middle" fontSize="13">刷证</text>
  <circle data-scene-object="gate-light" cx="303" cy="96" r="8" fill={p>=1?color.sage:color.gold}/>
  <Person x={220} y={163-p*45} scale={.77}/><IDCard x={154-p*19} y={131-p*22} scale={.47}/>
  <path d={`M192 163 156 ${138-p*22}`} fill="none" stroke={color.skin} strokeWidth="11" strokeLinecap="round"/>
  {p>=1&&<text x="306" y="139" textAnchor="middle" fontSize="15" fill={color.cream}>放行</text>}
 </>;
}
function WayfindingScene({run,floors=false}:{run:Run;floors?:boolean}){
 const id=taskId(run),letters=id==='hz-zone',numbers=id==='zz-number',ticket=id==='old-ticket';
 if(floors)return <><Floor/><rect x="67" y="30" width="205" height="157" rx="16" fill={color.cream} stroke={color.line} strokeWidth="2"/>
  {['2F  铁路出发 ↑','1F  到达出口','B1  地铁换乘'].map((label,i)=><g key={label}><path d={`M82 ${80+i*48}h175`} stroke={color.line}/><text x="169" y={62+i*48} textAnchor="middle" fontSize="21" fontWeight={i===0?800:500}>{label}</text></g>)}
  <Person x={334} y={150} scale={.85}/><path d="m315 151-32-24" stroke={color.skin} strokeWidth="11" strokeLinecap="round"/>
 </>;
 const st=stationFor(run),right=st.nodes.find(n=>n.id==='gate')!.x>st.nodes.find(n=>n.id==='hall')!.x;
 const area=parseInt(run.gate)<=15?'01–15':'16–30',other=area==='01–15'?'16–30':'01–15';
 const panels=numbers?['12A','21B','21A']:letters?['← A 廊','B 廊 →']:[`← ${right?other:area} 区`,`${right?area:other} 区 →`];
 return <><Floor/><path d="M24 112h392M220 33v166" stroke="#d6c6a34d" strokeWidth="27"/>
  {panels.map((label,i)=><Sign key={label} x={numbers?22+i*139:18+i*222} y={30} width={numbers?119:184} title={label} sub={numbers?'核对数字与字母':letters?'检票口区域':'按车票编号找路'}/>)}
  <path d="M143 103 115 137m183-34 28 34" stroke={color.faint} strokeWidth="4" strokeDasharray="6 5" fill="none"/>
  <g transform="translate(167 111) rotate(-5)"><rect width="111" height="73" rx="10" fill={color.cream} stroke={color.line} strokeWidth="2"/><text x="55" y="23" textAnchor="middle" fontSize="14">{ticket?'核对乘车日期':'我的检票口'}</text><text x="55" y="55" textAnchor="middle" fontSize="30" fontWeight="800">{ticket?'今天':run.gate}</text></g>
  <path d="m172 190-13-27m116 27 15-27" stroke={color.skin} strokeWidth="16" strokeLinecap="round"/>
 </>;
}
function Steps({escalator=false}:{escalator?:boolean}){
 return <><path d="M8 159H36v-25h30v-25h30V84h30V59h30V34h37v147H8Z" fill="#d6c39d" stroke={color.line} strokeWidth="2"/>
  {escalator?<><path d="m18 136 147-121h32m-185 145h30L186 41" fill="none" stroke={color.blue} strokeWidth="10" strokeLinecap="round"/><path d="m26 127 137-111h30" stroke={color.cream} strokeWidth="3" fill="none"/></>:<path d="m13 121 151-118h28" fill="none" stroke={color.sage} strokeWidth="6" strokeLinecap="round"/>}
 </>;
}
function Lift({x=0,y=0,p=0,small=false}:{x?:number;y?:number;p?:number;small?:boolean}){
 return <g transform={`translate(${x} ${y})${small?' scale(.62)':''}`}>
  <rect x="0" y="0" width="128" height="151" rx="11" fill={color.blue}/><rect x="13" y="27" width="102" height="113" fill="#697d73"/>
  <path data-scene-object="lift-doors" d={`M13 27h${51*(1-p)}v113H13Zm102 0h-${51*(1-p)}v113h${51*(1-p)}Z`} fill="#e1dbc6" stroke={color.line}/>
  <path d="m55 18 9-9 9 9" fill="none" stroke={color.cream} strokeWidth="3" strokeLinecap="round"/><circle cx="139" cy="79" r="6" fill={color.gold}/>
 </g>;
}
function VerticalScene({run,p,kind}:{run:Run;p:number;kind:TaskKind}){
 if(kind==='vertical-choice'){
  const twoLifts=taskId(run)==='hz-parent-lift';
  return <><Floor/>{twoLifts?<><Lift x={68} y={41}/><Lift x={264} y={41}/><Sign x={55} y={74} width={150} title="维修中"/><text x="327" y="30" textAnchor="middle" fontSize="17">右侧电梯</text></>:<>
   <g transform="translate(8 65) scale(.56)"><Steps/></g><text x="67" y="48" textAnchor="middle" fontSize="18">楼梯</text>
   <g transform="translate(151 65) scale(.56)"><Steps escalator/></g><text x="208" y="48" textAnchor="middle" fontSize="18">扶梯</text>
   <Lift x={332} y={66} small/><text x="371" y="48" textAnchor="middle" fontSize="18">电梯</text>
   <Person x={221} y={177} scale={.55}/>
  </>}</>;
 }
 if(kind==='escalator-choice')return <><Floor/>{[0,1,2].map(i=><g key={i} transform={`translate(${6+i*146} 30)`}>
  <text x="65" y="0" textAnchor="middle" fontSize="18" fontWeight="750">{i+1} 号扶梯</text><g transform="translate(0 42) scale(.65)"><Steps escalator/></g>
  <rect x="15" y="28" width="101" height="73" rx="12" fill={color.cream} stroke={color.line} strokeDasharray="5 4"/><text x="66" y="60" textAnchor="middle" fontSize="30" fill={color.faint}>?</text><text x="66" y="84" textAnchor="middle" fontSize="14">前方看不清</text>
 </g>)}</>;
 if(kind==='lift')return <><Floor/><Lift x={184} y={29} p={p}/><Person x={132+p*109} y={151-p*14} scale={.87}/><Bag x={112+p*111} y={161-p*14} scale={.36}/><Sign x={32} y={36} width={114} title="按住开门"/></>;
 const escalator=kind==='escalator',state=run.escalatorLane===null?undefined:run.stationLuck.escalators[run.escalatorLane];
 return <><Floor/><g transform="translate(100 13)"><Steps escalator={escalator}/></g>
  <Person x={146+p*134} y={137-p*109} scale={.72}/><Bag x={130+p*134} y={147-p*109} scale={.31}/>
  {escalator&&state&&state!=='clear'&&Array.from({length:state==='blocked'?3:1},(_,i)=><Person key={i} x={231+i*21} y={68-i*17} scale={.58} coat={color.peach}/>)}
  <Sign x={311} y={17} width={110} title="出发层 ↑"/><UpArrow x={62} y={92}/>
 </>;
}
function PhoneScene(){return <><Floor/><Person x={113} y={141} scale={1.02}/><Bag x={89} y={161} scale={.45}/>
 <g transform="translate(228 20) rotate(6 61 88)"><rect width="122" height="180" rx="21" fill={color.ink}/><rect x="9" y="12" width="104" height="153" rx="13" fill={color.cream}/><rect x="47" y="6" width="28" height="5" rx="2" fill={color.faint}/><circle cx="61" cy="51" r="21" fill={color.peach}/><text x="61" y="58" textAnchor="middle" fontSize="20">工</text><text x="61" y="94" textAnchor="middle" fontSize="21" fontWeight="800">老板来电</text><text x="61" y="119" textAnchor="middle" fontSize="14">工作消息又来了</text><circle cx="36" cy="144" r="12" fill={color.peach}/><circle cx="86" cy="144" r="12" fill={color.sage}/></g>
 <path d="m375 57 9-8m-6 29 13-1" stroke={color.gold} strokeWidth="4" strokeLinecap="round"/>
 </>;}
function ChildScene({run,p}:{run:Run;p:number}){
 const id=taskId(run),toilet=id==='parent-toilet'||id==='parent-accident',shop=id.includes('duck')||id==='sh-parent-shop',carry=id==='gz-parent-carry',gap=id==='parent-gap';
 const words=toilet?'想上厕所！':shop?id==='sh-parent-shop'?'想喝水！':'想吃这个！':id==='parent-tired'?'走不动了…':gap?'等等我！':'先等等我';
 return <><Floor/>{shop?<><rect x="276" y="31" width="146" height="132" rx="12" fill="#e1c29d"/><path d="M269 55h159l-13-30H282Z" fill={color.peach}/><text x="350" y="46" textAnchor="middle" fontSize="16">{id.includes('duck')?'周黑鸭':'站内小店'}</text><rect x="291" y="76" width="117" height="59" rx="5" fill={color.cream}/>{[0,1,2].map(i=><rect key={i} x={301+i*32} y="94" width="22" height="27" rx="4" fill={i%2?color.blue:color.gold}/>)}</>:toilet?<Sign x={281} y={39} width={135} title="洗手间 →" sub="需要绕一段路"/>:<><path d="M285 150h129m-113-1v42m98-42v42" stroke={color.line} strokeWidth="7"/><rect x="282" y="114" width="134" height="31" rx="8" fill="#d7c4a0"/></>}
  <Person x={120} y={141} scale={1.02}/>
  <Person x={gap?237-p*65:carry?195-p*42:195} y={carry?166-p*63:166} scale={.61} coat={color.peach} child/>
  {!gap&&!carry&&<path d="m140 151 40 17" stroke={color.skin} strokeWidth="8" strokeLinecap="round"/>}
  <Sign x={82} y={20} width={171} title={words}/>
 </>;
}
function EncounterScene({run,p,crowd=false,rest=false}:{run:Run;p:number;crowd?:boolean;rest?:boolean}){
 const id=taskId(run),chat=id.startsWith('zz-hometown'),grandma=id==='sh-corridor'||run.stationLuck.elder==='grandma';
 return <><Floor/>{rest?<><rect x="173" y="144" width="160" height="20" rx="8" fill={color.gold}/><path d="M185 164v29m136-29v29" stroke={color.ink} strokeWidth="5"/><Person x={237} y={127} scale={.84}/><Sign x={127} y={24} width={190} title="停下来，缓口气"/></>:<>
  <path d="M47 178q42-130 193-104" stroke={color.line} strokeWidth="8" strokeDasharray="10 9" fill="none"/>
  <Person x={99+p*33} y={150-p*31} scale={.85}/><Bag x={80+p*33} y={165-p*31} scale={.37}/>
  {crowd?[0,1,2].map(i=><Person key={i} x={222+i*58+(i-1)*p*23} y={126+(i%2)*18} scale={.85} coat={i%2?color.blue:color.peach}/>):<><Person x={282} y={145} scale={1.05} coat={grandma?'#b7a2ac':color.blue}/><path d="M266 119q-6-16 12-22h15q12 3 14 14" fill="#dad2be"/><path d="M317 151q6-10 10 0v42" fill="none" stroke={color.ink} strokeWidth="4"/></>}
  <Sign x={176} y={20} width={crowd?228:221} title={crowd?'借过一下，谢谢！':chat?'老乡，聊两句嘛！':id==='elder-outcome'&&run.stationLuck.elderScam?'先把事情说清楚':'前面有人挡住了'}/>
 </>}</>;
}
function LuggageScene({run,p,snag=false}:{run:Run;p:number;snag?:boolean}){
 return <><Floor/><Person x={113} y={138} scale={.99}/>
  {snag?<><path d="M295 50v145m-35-122h72" stroke={color.line} strokeWidth="12" strokeLinecap="round"/><path d="M295 78h-17q-14 0-14 13" stroke={color.ink} strokeWidth="5" fill="none"/><g data-scene-object="snagged-bag" transform={`translate(0 ${-p*66})`}><Bag x={239} y={149} scale={1.02}/></g><path d={`M165 139q25-9 46-${14+p*50}`} stroke={color.skin} strokeWidth="14" fill="none" strokeLinecap="round"/></>:<>
   <rect x="170" y="178" width="209" height="20" rx="4" fill="#d3c3a2"/><g data-scene-object="suitcase" transform={`translate(${248+p*45} ${124-p*43})`}><path d="M-15-31v-32h30v32" stroke={color.ink} strokeWidth="5" fill="none"/><rect x="-36" y="-32" width="72" height="92" rx="14" fill={color.blue} stroke="#748f85" strokeWidth="3"/><path d="M-20-20v65m20-65v65m20-65v65" stroke="#bed0be" strokeWidth="3"/><circle cx="-24" cy="65" r="7" fill={color.ink}/><circle cx="24" cy="65" r="7" fill={color.ink}/></g>
  </>}
  <UpArrow x={351} y={88}/><Sign x={44} y={20} width={200} title={snag?'肩带挂在栏杆上':taskId(run)==='tourist-wheel'?'箱轮卡住了':'箱子卡在门槛上'}/>
 </>;
}
function TrainScene({run,p}:{run:Run;p:number}){
 return <><Floor/><rect x="157" y="23" width="267" height="160" rx="25" fill="#dce5d6" stroke={color.blue} strokeWidth="3"/><path d="M159 147h263" stroke={color.peach} strokeWidth="9"/>
  <rect x="177" y="47" width="73" height="59" rx="13" fill="#a9bdb6"/><rect x="361" y="47" width="43" height="59" rx="10" fill="#a9bdb6"/>
  <rect x="269" y="43" width="74" height="140" rx="14" fill="#6e8275"/><rect x="274" y="167" width="64" height="14" rx="3" fill={color.gold}/>
  <text x="306" y="32" textAnchor="middle" fontSize="15" fontWeight="750">08 车厢</text><text x="214" y="82" textAnchor="middle" fontSize="17" fill={color.cream}>{run.city.train}</text>
  <path d="M28 195h380" stroke={color.gold} strokeWidth="6" strokeDasharray="15 6"/>
  <g data-scene-object="boarding-passenger"><Person x={77+p*228} y={155-p*36} scale={.87-p*.19}/><Bag x={58+p*232} y={165-p*42} scale={.35-p*.06}/></g>
  {[0,1,2].map(i=><g key={i} transform={`translate(${131+i*47} ${184-i*3})`} opacity={p>=(i+1)/3?.3:1}><ellipse rx="7" ry="3" transform="rotate(-18)" fill={color.ink}/><ellipse cx="12" cy="-8" rx="7" ry="3" transform="rotate(-18)" fill={color.ink}/></g>)}
 </>;
}

export default function StationTaskScene({run,progress,active,actionLabel}:{run:Run;progress:number;active:boolean;actionLabel?:string}){
 const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0,kind=taskKind(run),hint=actionLabel||stationTaskLabel(run);
 let art:ReactNode;
 switch(kind){
  case 'entry':art=<EntryScene run={run} p={p}/>;break;
  case 'security-queue':art=<QueueScene run={run}/>;break;
  case 'security-tray':art=<TrayScene run={run} p={p}/>;break;
  case 'identity':art=<IdentityScene run={run} p={p}/>;break;
  case 'gate-choice':case 'gate-scan':art=<GateScene run={run} p={p} choice={kind==='gate-choice'}/>;break;
  case 'wayfinding':case 'floor-sign':art=<WayfindingScene run={run} floors={kind==='floor-sign'}/>;break;
  case 'vertical-choice':case 'escalator-choice':case 'escalator':case 'stairs':case 'lift':art=<VerticalScene run={run} p={p} kind={kind}/>;break;
  case 'phone':art=<PhoneScene/>;break;
  case 'child':art=<ChildScene run={run} p={p}/>;break;
  case 'crowd':case 'rest':case 'encounter':art=<EncounterScene run={run} p={p} crowd={kind==='crowd'} rest={kind==='rest'}/>;break;
  case 'bag-snag':case 'luggage':art=<LuggageScene run={run} p={p} snag={kind==='bag-snag'}/>;break;
  case 'board-train':art=<TrainScene run={run} p={p}/>;break;
 }
 return <div className="station-task-scene" data-task-kind={kind} data-task-active={active}>
  <svg viewBox="0 0 440 248" width="100%" height="100%" role="img" aria-label={`${run.event?.title??run.stationJourney[run.stationBeat]?.label??'站内任务'}。${hint}`} style={{display:'block',overflow:'visible',fontFamily:'inherit',color:color.ink}}>
   <rect x="3" y="3" width="434" height="241" rx="24" fill={color.paper}/>
   <g fill={color.ink}>{art}</g>
   <rect x="16" y="211" width="408" height="32" rx="16" fill={color.cream} stroke={active?color.gold:color.line}/>
   <text x="220" y="232" textAnchor="middle" fill={color.ink} fontSize={hint.length>25?13:16} fontWeight="700">{hint}</text>
  </svg>
 </div>;
}
