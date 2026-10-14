import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {StudentEnergy} from './StudentUI';
import {createCharacterStationRun} from './engine';
import {characterMovementFactor} from './characterTime';

describe('tourist resource feedback',()=>{
 it.each([[59,'行走缓慢恢复'],[60,'精力恢复降低 15%'],[80,'精力恢复降低 25%']])('fatigue %s shows the recovery band actually used', (fatigue,text)=>{
  const base=createCharacterStationRun('shanghai','tourist',false,()=>.5);
  const run={...base,characterTime:{...base.characterTime!,fatigue:Number(fatigue),energy:12}};
  const html=renderToStaticMarkup(<StudentEnergy run={run} dispatch={()=>{}}/>);
  expect(html).toContain(text);
  expect(html).toContain(`当前步行速度 ${characterMovementFactor(run,false).toFixed(2)} 倍`);
  expect(html).not.toContain('普通速度 0.86 倍');
 });
 it('active sprint feedback takes precedence over the fatigue recovery hint',()=>{
  const base=createCharacterStationRun('shanghai','tourist',false,()=>.5);
  const run={...base,characterTime:{...base.characterTime!,fatigue:90,sprinting:true}};
  const html=renderToStaticMarkup(<StudentEnergy run={run} dispatch={()=>{}}/>);
  expect(html).toContain('冲刺中，精力下降更快');
  expect(html).not.toContain('精力恢复降低');
 });
 it('dragging a damaged wheel describes its net energy drain and current slowed speed',()=>{
  const base=createCharacterStationRun('shanghai','tourist',false,()=>.5);
  const run={...base,characterTime:{...base.characterTime!,fatigue:40,energy:12,wheelDamaged:true}};
  const html=renderToStaticMarkup(<StudentEnergy run={run} dispatch={()=>{}}/>);
  expect(html).toContain('硬拖行李持续耗能，停步可恢复');
  expect(html).not.toContain('行走缓慢恢复');
  expect(html).toContain(`当前步行速度 ${characterMovementFactor(run,false).toFixed(2)} 倍`);
 });
});
