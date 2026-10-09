import type {EventConfig} from './data';

// Only actual missed opportunities expire. Ordinary reading/actions keep the
// main clock running and stay open until the player completes them.
export function hasEventDeadline(event:EventConfig){
 return event.id==='tourist-wake'||event.id==='metro-announcement';
}
