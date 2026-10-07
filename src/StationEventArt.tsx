import type { EscalatorState } from './stationEncounters';

export function EscalatorArt({state}:{state?:EscalatorState}) {
 return <svg viewBox="0 0 120 125" className="escalator-art" aria-hidden="true">
  <path d="M16 106h24l50-72h17M12 92h21l51-72h21" fill="none" stroke="#adab88" strokeWidth="12" strokeLinejoin="round"/>
  <path d="M15 99h24l49-72h18" fill="none" stroke="#ede0b9" strokeWidth="10"/>
  {[0,1,2,3,4,5].map(i=><path key={i} d={`M${37+i*9} ${96-i*13}h14`} stroke="#b4a178" strokeWidth="3"/>)}
  <path d="M14 80h16l49-72h26" fill="none" stroke="#c9b58d" strokeWidth="4" strokeLinecap="round"/>
  {state?Array.from({length:state==='blocked'?4:state==='steady'?2:0},(_,i)=><g key={i} transform={`translate(${48+i*10} ${63-i*14})`}><ellipse cy="8" rx="7" ry="11" fill={i%2?'#bd9e89':'#9caa89'}/><circle cy="-6" r="6" fill="#8d7c65"/></g>):<g><circle cx="58" cy="45" r="18" fill="#fff7df"/><text x="58" y="52" textAnchor="middle" fontSize="23" fill="#af9366">?</text></g>}
  {state==='clear'&&<path d="m52 58 16-22m-16 6 16-6 1 15" fill="none" stroke="#8f9e6c" strokeWidth="5" strokeLinecap="round"/>}
 </svg>;
}

export function ElderArt({grandma,scam=false,showStudent=true}:{grandma:boolean;scam?:boolean;showStudent?:boolean}) {
 return <svg viewBox="0 0 250 104" className="elder-art" aria-hidden="true">
  <path d="M15 87h220" stroke="#dfd0ad" strokeWidth="3" strokeDasharray="8 7"/>
  {showStudent&&<g transform="translate(84 54)"><ellipse cy="35" rx="26" ry="5" fill="#c7b38d44"/><rect x="-15" y="0" width="30" height="30" rx="12" fill="#98ac8a"/><rect x="-22" y="5" width="17" height="26" rx="7" fill="#cda86b" stroke="#ae885b" strokeWidth="2"/><circle cy="-9" r="14" fill="#6f5b46"/><path d="M-7 30v7m17-7v7" stroke="#7e6d54" strokeWidth="6"/></g>}
  <g transform="translate(160 48)"><ellipse cy="41" rx="28" ry="5" fill="#c7b38d44"/><rect x="-17" y="1" width="34" height="34" rx="14" fill={grandma?'#b7a6b7':'#a0af9c'}/><circle cy="-10" r="16" fill="#eed7b5"/><path d="M-15-12q0-24 29 0" fill="#ddd9cb"/>{grandma&&<circle cx="-10" cy="-25" r="7" fill="#d1d0c2"/>}<path d="M-10 36v6m20-6v6" stroke="#7e6d54" strokeWidth="6"/><path d="M23 20q7-9 9 0v25" fill="none" stroke="#a28e6a" strokeWidth="4"/></g>
  {scam?<text x="206" y="32" fill="#bb785a" fontSize="25" fontWeight="800">!</text>:<path d="M24 47q-6-30 27-30h37" stroke="#b8bd90" strokeWidth="3" fill="none" strokeDasharray="5 5"/>}
 </svg>;
}

export function VerticalArt({kind}:{kind:'stairs'|'lift'}){
 return <svg viewBox="0 0 120 125" className="escalator-art" aria-hidden="true">{kind==='stairs'?<><path d="M12 110V93h19V76h19V59h19V42h19V25h20v85Z" fill="#dbcaa2" stroke="#b6a17a"/><path d="M12 93h19V76h19V59h19V42h19V25h20M10 76 96 6" fill="none" stroke="#a6ac87" strokeWidth="5" strokeLinejoin="round"/><path d="m38 56 23-20m-17 2 17-2-2 16" fill="none" stroke="#8e9f79" strokeWidth="4"/></>:<><rect x="20" y="22" width="80" height="90" rx="5" fill="#b5bda1"/><rect x="28" y="30" width="64" height="77" fill="#e2dbc2"/><path d="M60 30v77" stroke="#b1a483" strokeWidth="3"/><rect x="44" y="6" width="32" height="12" rx="3" fill="#96a57e"/><path d="m55 14 5-5 5 5" fill="none" stroke="#fff8e6" strokeWidth="2"/><circle cx="108" cy="61" r="4" fill="#c09b66"/></>}</svg>;
}
