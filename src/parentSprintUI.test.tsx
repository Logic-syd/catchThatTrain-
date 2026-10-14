import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,type Run} from './engine';
import {ParentStatus} from './ParentUI';
import Station from './Station';
it('尿急时普通和同步冲刺入口禁用并显示原因',()=>{
 const base=createCharacterStationRun('shanghai','mom',false,()=>.5);
 const run:Run={...base,phase:'station',remaining:290,parent:{...base.parent!,toilet:80}};
 const status=renderToStaticMarkup(<ParentStatus run={run} dispatch={()=>{}}/>);
 expect(status).toContain('孩子尿急，暂不能冲刺');expect(status).toMatch(/class="sync-action" disabled=""/);
 const station=renderToStaticMarkup(<Station run={run} dispatch={()=>{}} blocked={false}/>);
 expect(station).toMatch(/class="big-action sprint-forward" disabled=""/);expect(station).toContain('先处理尿急；仍可慢慢走');
});
