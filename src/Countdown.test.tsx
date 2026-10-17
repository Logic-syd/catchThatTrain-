import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Countdown,{countdownParts} from './Countdown';
import {createCharacterStationRun,reducer,STOP_BEFORE} from './engine';

describe('倒计时小数位使用同一个正式剩余时间',()=>{
 it.each([
  [60,'01:00','00'],
  [59.999,'01:00','00'],
  [59.99,'00:59','99'],
  [60.01,'01:00','01'],
  [3599.99,'59:59','99'],
  [3600,'60:00','00'],
  [.001,'00:00','01'],
  [0,'00:00','00'],
  [-.01,'00:00','00'],
 ] as const)('%s 秒在分钟及截止边界保持一致',(seconds,whole,fraction)=>{
  expect(countdownParts(seconds)).toEqual({whole,fraction});
 });

 it('精确百分之一秒不因浮点误差额外进位',()=>{
  expect(countdownParts(.1+.2)).toEqual({whole:'00:00',fraction:'30'});
  expect(countdownParts(60.1+.2)).toEqual({whole:'01:00',fraction:'30'});
 });

 it('读数只跟随引擎推进与固定费用，不建立第二个计时器或改变游戏状态',()=>{
  let run=reducer(createCharacterStationRun('shanghai','student',false,()=>.2),{type:'START'});
  const interval=vi.spyOn(globalThis,'setInterval');
  try{
   const before=run.remaining;
   run=reducer(run,{type:'TICK',dt:.137});
   expect(before-run.remaining).toBeCloseTo(.137);
   const beforeChoice=run.remaining;
   run=reducer(run,{type:'PREP_PICK',option:'buy',step:0});
   expect(beforeChoice-run.remaining).toBe(45);
   const snapshot=JSON.stringify(run),parts=countdownParts(run.remaining-STOP_BEFORE);
   const markup=renderToStaticMarkup(<Countdown seconds={run.remaining-STOP_BEFORE}/>);
   expect(markup).toContain('>'+parts.whole+'</span>');
   expect(markup).toContain('>.'+parts.fraction+'</span>');
   expect(markup).toContain('role="timer" aria-live="off"');
   expect(JSON.stringify(run)).toBe(snapshot);
   expect(interval).not.toHaveBeenCalled();
  }finally{interval.mockRestore();}
 });
});
