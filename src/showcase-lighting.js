// The same restrained grade drives the visible backdrop, reflections and
// foreground lighting. No per-frame cube captures or extra scene lights.
export const SHOWCASE_LIGHTING=Object.freeze({
 harbor:{sky:'#9cb9d9',bounce:'#635042',sun:'#ffd3a0',sunlight:1.28,fill:'#9fc9ed',fillIntensity:.62,fog:'#62758c',fogDensity:.00095,environmentIntensity:.72,backdropTint:'#fff2df',backdropExposure:1.02},
 'fuji-skyline':{sky:'#c4d9e5',bounce:'#59604c',sun:'#fff0d1',sunlight:1.36,fill:'#bad5e8',fillIntensity:.48,fog:'#a0b7bd',fogDensity:.00080,environmentIntensity:.66,backdropTint:'#f2f8ff',backdropExposure:1.04},
 // Keep the metropolitan key-light level for readable physical road/car forms.
 // Night character comes from the coordinated palette, fill, fog and backdrop.
 'singapore-afterdark':{sky:'#7999b4',bounce:'#293a40',sun:'#c5dbe8',sunlight:.84,fill:'#93bfc8',fillIntensity:.60,fog:'#263e50',fogDensity:.00105,environmentIntensity:.70,backdropTint:'#d7ebed',backdropExposure:.88},
 'san-francisco-hills':{sky:'#bad3e3',bounce:'#77624d',sun:'#ffdbad',sunlight:1.34,fill:'#a9cde4',fillIntensity:.56,fog:'#8fa6b5',fogDensity:.00086,environmentIntensity:.70,backdropTint:'#fff1df',backdropExposure:1.02},
});

// Catalogue-wide art grades. The same values feed the physical lighting,
// reflections and backdrop on every route, instead of leaving 35 circuits with
// unrelated generic sky/reflection colours. Families share a coherent climate;
// individual routes may keep a deliberately authored override above.
export const REGIONAL_LIGHTING=Object.freeze({
 maritime:{sky:'#abc8dc',bounce:'#655c50',sun:'#ffe0b6',sunlight:1.30,fill:'#a9cfe8',fillIntensity:.56,fog:'#8aabba',fogDensity:.00085,environmentIntensity:.70,backdropTint:'#fff4e5',backdropExposure:1.02},
 mediterranean:{sky:'#a6c7dd',bounce:'#857052',sun:'#ffe0ae',sunlight:1.38,fill:'#b6d1e4',fillIntensity:.48,fog:'#97b2bd',fogDensity:.00078,environmentIntensity:.72,backdropTint:'#fff0d7',backdropExposure:1.03},
 woodland:{sky:'#c0d6e1',bounce:'#58634c',sun:'#fff0d5',sunlight:1.32,fill:'#bad3e1',fillIntensity:.48,fog:'#99b1ad',fogDensity:.00087,environmentIntensity:.65,backdropTint:'#f1f8f4',backdropExposure:1.02},
 alpine:{sky:'#c7dce8',bounce:'#647066',sun:'#f6eddb',sunlight:1.24,fill:'#bcd9ea',fillIntensity:.59,fog:'#a2bec8',fogDensity:.00092,environmentIntensity:.66,backdropTint:'#ecf6ff',backdropExposure:1.03},
 tropical:{sky:'#a9c9d7',bounce:'#655e45',sun:'#ffe5bb',sunlight:1.35,fill:'#aad3e7',fillIntensity:.54,fog:'#91b1b4',fogDensity:.00105,environmentIntensity:.72,backdropTint:'#fff2df',backdropExposure:1.01},
 arid:{sky:'#d4cbb5',bounce:'#a07956',sun:'#ffe0a7',sunlight:1.48,fill:'#b6c6d3',fillIntensity:.49,fog:'#b8a38a',fogDensity:.00072,environmentIntensity:.67,backdropTint:'#fff1d8',backdropExposure:1.01},
 metropolitan:{sky:'#8aa2c4',bounce:'#363449',sun:'#d1d9fa',sunlight:.84,fill:'#a59ee3',fillIntensity:.68,fog:'#38435c',fogDensity:.00113,environmentIntensity:.78,backdropTint:'#e8e9ff',backdropExposure:.95},
 industrial:{sky:'#9bb8d1',bounce:'#5c5857',sun:'#ffd4a2',sunlight:1.19,fill:'#a1c4e0',fillIntensity:.59,fog:'#7d95a8',fogDensity:.00104,environmentIntensity:.69,backdropTint:'#f8ecdf',backdropExposure:.99},
});
export const VENUE_REGIONS=Object.freeze({
 harbor:'maritime',dockyard:'industrial',coast:'maritime',summit:'alpine',grandprix:'maritime',
 melbourne:'maritime',shanghai:'woodland',suzuka:'woodland',miami:'tropical',montreal:'woodland',monaco:'mediterranean',barcelona:'mediterranean',spielberg:'alpine',silverstone:'woodland',spa:'alpine',hungaroring:'woodland',zandvoort:'maritime',monza:'woodland',madring:'metropolitan',baku:'metropolitan',sepang:'tropical',singapore:'metropolitan',austin:'arid',mexico:'metropolitan',interlagos:'tropical',lasvegas:'metropolitan',lusail:'arid',yasmarina:'metropolitan',sakhir:'arid',jeddah:'arid',breakwater:'maritime','copper-canyon':'arid','cedar-ridge':'alpine','neon-freight':'metropolitan','fuji-skyline':'alpine','singapore-afterdark':'metropolitan','norway-fjord':'alpine','san-francisco-hills':'maritime',
});
export function venueLighting(track){
 const region=VENUE_REGIONS[track.id]||({urban:'metropolitan',desert:'arid',parkland:'woodland',coastal:'maritime'}[track.environment])||'maritime';
 return {...REGIONAL_LIGHTING[region],...SHOWCASE_LIGHTING[track.id],lightingRegion:region};
}
