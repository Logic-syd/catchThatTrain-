export const IS_PLAYTEST=import.meta.env.VITE_PLAYTEST==='true';
const prefix='playtest:';
// Seed existing earned progress when trying the test build, then keep all test
// writes separate so experimental runs cannot overwrite public-version saves.
export function readGameStorage(key:string):string|null{
 return IS_PLAYTEST?localStorage.getItem(prefix+key)??localStorage.getItem(key):localStorage.getItem(key);
}
export function writeGameStorage(key:string,value:string){
 localStorage.setItem(IS_PLAYTEST?prefix+key:key,value);
}
