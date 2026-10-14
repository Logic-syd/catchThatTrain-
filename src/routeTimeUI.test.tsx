import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createCharacterStationRun,formatTime} from './engine';
import {routeTravelSeconds} from './timeModel';
import RouteOptions from './RouteOptions';
it('路线按钮显示含步行/换乘的共用估时，并使用当前出发点',()=>{
 const base=createCharacterStationRun('beijing','worker',false,()=>.2),s={...base,spawn:1};
 const markup=renderToStaticMarkup(<RouteOptions run={s} dispatch={()=>{}}/>);
 for(const r of s.city.spawnStations[1].routes){expect(markup).toContain('预计路程 '+formatTime(routeTravelSeconds(s,r)));expect(markup).toContain('步行 '+r.walk+'m');}
 expect(markup).toContain('到站后检票约剩');
 const late=renderToStaticMarkup(<RouteOptions run={{...s,remaining:181}} dispatch={()=>{}}/>);expect(late).toContain('预计超过检票截止');
});
