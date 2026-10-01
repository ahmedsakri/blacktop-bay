// Liquid Lines is the approved original lobby composition. Legacy saved styles
// migrate to it without changing mute, game volume or music volume preferences.
export const LOBBY_STYLES=Object.freeze([
 Object.freeze({id:'liquid-lines',name:'Liquid Lines',description:'168 BPM liquid drum & bass · syncopated drums, deep bass and bright keys',bpm:168}),
]);
export const normalizeLobbyStyle=()=>LOBBY_STYLES[0].id;
const frequency=note=>440*2**((note-69)/12);
const envelope=(age,attack,decay)=>Math.min(1,Math.max(0,age)/attack)*Math.exp(-Math.max(0,age)/decay);
const eventEnvelope=(beat,pattern,subdivision,attack,decay)=>{
 const step=Math.floor(beat*subdivision),phase=(beat*subdivision-step)/subdivision;
 return pattern.includes(step%16)?envelope(phase,attack,decay):0;
};
const CHORDS=[[53,60,63,67],[49,56,60,63],[44,55,60,63],[51,58,62,65]];
export function lobbyMusicFrame(styleId,time=0){
 const id=normalizeLobbyStyle(styleId),style=LOBBY_STYLES[0],seconds=Number.isFinite(time)?Math.max(0,time):0;
 const beat=seconds*style.bpm/60,bar=Math.floor(beat/8)%4,chord=CHORDS[bar];
 const frame={id,bpm:style.bpm,padNotes:chord.map(frequency),leadWave:'sine'};
  const sixteenth=(beat*4)%1,bassStep=Math.floor(beat*2)%8;
  frame.padWave='triangle';frame.padCutoff=1700;frame.padSmoothing=.095;
  const chordAge=beat%2;frame.padGains=chord.map((_,i)=>(i===0?.032:.028)*(.28+.72*envelope(chordAge,.025,.72)));
  frame.bassFrequency=frequency(chord[0]-12+[0,0,0,7,0,12,10,7][bassStep]);frame.bassGain=.14*envelope((beat*2)%1,.04,.40);
  frame.pulseFrequency=frequency(chord[[3,1,2,0][Math.floor(beat)%4]]+12);frame.pulseGain=.040*envelope(beat%1,.018,.35);frame.pulseWave='sine';
  const kickStep=Math.floor(beat*4)%16,kickAge=(beat*4)%1/4;
  frame.kickGain=[0,6,10].includes(kickStep)?.15*envelope(kickAge,.012,.10):0;
  frame.kickFrequency=45+65*Math.exp(-kickAge*32);
  frame.snareGain=eventEnvelope(beat,[4,12],4,.009,.15)*.115;frame.snareBodyGain=frame.snareGain*.28;
  frame.hatGain=(Math.floor(beat*4)%2?.025:.039)*envelope(sixteenth,.04,.24);
  const melody=[79,75,72,70,75,79,82,79];frame.leadFrequency=frequency(melody[Math.floor(beat/4)%8]);frame.leadGain=.037*envelope(beat%4,.10,1.25);
  frame.space=.20;frame.echo=.24;
 return frame;
}
