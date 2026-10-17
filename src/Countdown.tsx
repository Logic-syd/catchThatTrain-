import './countdown.css';

/** Format one authoritative game-clock value, without starting a display clock. */
export function countdownParts(seconds:number){
 // Round up once so a positive remainder stays visible. Ignore floating-point
 // noise at exact hundredths, then split that same value across all three units.
 const centiseconds=Number.isFinite(seconds)&&seconds>0?Math.max(1,Math.ceil(seconds*100-1e-7)):0;
 const wholeSeconds=Math.floor(centiseconds/100);
 return {
  whole:String(Math.floor(wholeSeconds/60)).padStart(2,'0')+':'+String(wholeSeconds%60).padStart(2,'0'),
  fraction:String(centiseconds%100).padStart(2,'0'),
 };
}

export default function Countdown({seconds}:{seconds:number}){
 const {whole,fraction}=countdownParts(seconds);
 return <strong className="countdown-readout" role="timer" aria-live="off"><span>{whole}</span><span className="countdown-fraction">.{fraction}</span></strong>;
}
