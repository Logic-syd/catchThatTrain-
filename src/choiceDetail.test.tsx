import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import ChoiceDetail,{describeChoice} from './ChoiceDetail';
import {Preparation} from './StudentUI';
import {PREPARATIONS} from './studentConfig';
import {createStationRun,reducer} from './engine';

describe('readable costs and tradeoffs',()=>{
 it('puts the later energy-cap penalty first without losing when it applies',()=>{const html=renderToStaticMarkup(<ChoiceDetail text="精力上限 −10 · 到候车大厅后生效，后半程更容易跑不动"/>);expect(html).toContain('class="choice-effect choice-cost"');expect(html.indexOf('精力上限 −10')).toBeLessThan(html.indexOf('到候车大厅后生效'));});
 it('treats more luggage as a cost and less fatigue as a benefit',()=>{const {effects}=describeChoice('负重 +5 · 疲劳 −15 · 专注 +5 · 精力 −10');expect(effects.map(e=>[e.label,e.cost])).toEqual([['负重 +5',true],['精力 −10',true],['疲劳 −15',false],['专注 +5',false]]);});
 it('keeps cake time, focus, load and its ongoing drawback visible',()=>{const {effects,note}=describeChoice(PREPARATIONS[0].options[0].detail);expect(effects.map(e=>e.label)).toEqual(['−75 秒','负重 +5','专注 +5']);expect(note).toBe('占一只手，赶路更费体力');});
 it('does not invent numbers for hidden queues or uncertain outcomes',()=>{const text='队伍里有什么？再看仔细一点';expect(describeChoice(text)).toEqual({effects:[],note:text});expect(describeChoice('一会儿老板可能会打电话').effects).toHaveLength(0);expect(renderToStaticMarkup(<ChoiceDetail text=""/>)).toBe('');});
 it('preserves percent units and distinguishes less distance from less stamina',()=>{const {effects}=describeChoice('路程 −25% · 体力 −22');expect(effects.map(e=>[e.label,e.cost])).toEqual([['体力 −22',true],['路程 −25%',false]]);});
 it('breakfast shows actual capped gain and both choices have clear consequences',()=>{let s=reducer(createStationRun(),{type:'START'});s=reducer(s,{type:'PREP_PICK',step:0,option:'skip'});s=reducer(s,{type:'PREP_PICK',step:1,option:'check'});const html=renderToStaticMarkup(<Preparation run={s} dispatch={()=>{}}/>);expect(html).toContain('收益：精力上限 +10');expect(html).not.toContain('精力上限 +15');expect(html).toContain('代价：精力上限 −10');const eaten=reducer(s,{type:'PREP_PICK',step:2,option:'eat'});expect(eaten.student!.stats.energy-s.student!.stats.energy).toBe(10);const skipped=reducer(s,{type:'PREP_PICK',step:2,option:'skip'});const hungry=reducer({...skipped,phase:'station',stage:3},{type:'TICK',dt:.1});expect(hungry.student!.stats.energy).toBe(skipped.student!.stats.energy-10);});
 it('the first preparation option is not always the one with an immediate time cost',()=>{expect(PREPARATIONS[1].options[0].id).toBe('skip');expect(PREPARATIONS[1].options[1].id).toBe('check');});
});
