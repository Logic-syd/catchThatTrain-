import {describe,expect,it} from 'vitest';
import {challengeUrl,readChallenge} from './shareChallenge';
import {drawStationPair} from './stations';

describe('result challenge links',()=>{
 it('keeps only the public result context and opens a playable station pair',()=>{
  const url=challengeUrl('https://logic-syd.github.io/catchThatTrain-/?release=old#results','wuhan','前面冲太猛了',false);
  const parsed=new URL(url);
  expect(parsed.searchParams.has('release')).toBe(false);
  expect(parsed.hash).toBe('');
  expect(readChallenge(parsed.search)).toEqual({stationId:'wuhan',stationName:'武汉站',title:'前面冲太猛了',success:false});
  const pair=drawStationPair(()=>0,'wuhan');
  expect(pair).toHaveLength(2);
  expect(pair[0].id).toBe('wuhan');
  expect(pair[1].id).not.toBe('wuhan');
 });
 it('ignores invalid or incomplete shared results',()=>{
  expect(readChallenge('?challenge=nope&title=test&won=1')).toBeNull();
  expect(readChallenge('?challenge=wuhan&title=test')).toBeNull();
  expect(readChallenge('?challenge=wuhan&title=%20&won=0')).toBeNull();
 });
});
