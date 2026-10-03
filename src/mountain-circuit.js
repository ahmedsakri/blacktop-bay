// An original mountain route inspired by contemporary arcade racing: a lower
// lakeside section, rising switchbacks and an elevated looping viaduct.
export const MOUNTAIN_CIRCUITS = [{
  id: 'fuji-skyline', name: 'Fuji Skyline', region: 'Japan', country: 'Japan',
  environment: 'parkland', scenery: 'fuji-skyline', series: 'original',
  layoutKind: 'original', width: 18, difficulty: 'Technical',
  description: 'Climb from the wooded lower roads to an elevated mountain viaduct. Two optional launch ramps reward a clean approach.',
  points: [[-260,-210],[-120,-220],[45,-205],[190,-172],[285,-90],[310,35],
    [252,120],[150,145],[90,95],[135,30],[220,15],[255,60],[205,100],
    [120,65],[25,18],[-65,52],[-18,120],[60,172],[20,242],[-90,270],
    [-200,208],[-155,135],[-228,90],[-312,128],[-365,65],[-318,-8],
    [-235,-20],[-235,-82],[-328,-98],[-350,-177]],
  elevationProfile: [[0,0],[.12,0],[.23,12],[.34,29],[.48,33],[.59,20],[.70,13],[.84,4],[.95,0],[1,0]],
  rampFractions: [{id:'lake-flight',fraction:.040,length:13,height:2.2,width:5,lane:4.7,type:'straight'},
    {id:'skyline-roll',fraction:.45,length:12,height:2.7,width:5,lane:-4.7,type:'barrel'}],
}, {
  id:'singapore-afterdark',name:'Singapore Afterdark',region:'Singapore',country:'Singapore',
  environment:'urban',scenery:'singapore-afterdark',series:'original',layoutKind:'original',width:20,
  description:'Marina straights, an illuminated city underpass and a sweeping elevated expressway. Read the work-zone barriers before committing to the inside line.',
  points:[[-290,-180],[-120,-180],[80,-180],[250,-150],[320,-55],[270,20],[150,18],[95,75],[145,150],[290,150],[320,220],[200,265],[25,245],[-90,175],[-220,235],[-325,200],[-350,85],[-290,20],[-170,28],[-130,-45],[-255,-70]],
  elevationProfile:[[0,0],[.18,0],[.3,14],[.43,14],[.55,0],[.7,0],[.85,6],[1,0]],
  rampFractions:[{id:'marina-launch',fraction:.04,length:14,height:2.4,width:5,lane:5.5,type:'straight'}],
  obstacleFractions:[{id:'works-a',fraction:.62,lane:5.9,radius:1.4,height:1.2,type:'barrier'},{id:'works-b',fraction:.625,lane:5.9,radius:1.4,height:1.2,type:'barrier'}],
}, {
  id:'norway-fjord',name:'Norway Fjord Run',region:'Norway',country:'Norway',
  environment:'parkland',scenery:'norway-fjord',series:'original',layoutKind:'original',width:18,
  description:'Race across a high fjord bridge, through a rock gallery and along forested climbing bends. Optional outer-lane ramps keep the main racing line clear.',
  points:[[-310,-180],[-145,-198],[35,-190],[220,-145],[320,-45],[280,70],[175,90],[125,175],[30,250],[-75,270],[-160,190],[-95,115],[-160,42],[-260,95],[-355,72],[-340,-30],[-245,-64]],
  elevationProfile:[[0,5],[.12,5],[.25,28],[.43,36],[.6,18],[.8,5],[1,5]],
  rampFractions:[{id:'fjord-flight',fraction:.035,length:14,height:2.5,width:5,lane:-4.7,type:'straight'}],
  obstacleFractions:[{id:'rock-fall',fraction:.70,lane:-6.2,radius:1.35,height:1.6,type:'rock'}],
}, {
  id:'san-francisco-hills',name:'San Francisco Hills',region:'United States',country:'United States',
  environment:'coastal',scenery:'san-francisco-hills',series:'original',layoutKind:'original',width:20,
  description:'Climb a terraced city grid, launch from a hilltop ramp and descend toward the waterfront suspension bridge. A wide bypass lane stays open at every obstacle.',
  points:[[-300,-230],[-130,-230],[60,-225],[240,-210],[310,-140],[275,-55],[140,-50],[75,10],[160,55],[270,55],[305,145],[210,220],[40,240],[-120,215],[-195,150],[-180,50],[-280,20],[-355,80],[-390,-30],[-360,-150]],
  elevationProfile:[[0,0],[.13,2],[.27,30],[.38,37],[.52,8],[.67,3],[.8,16],[1,0]],
  rampFractions:[{id:'hilltop-flight',fraction:.13,length:15,height:2.5,width:5,lane:5.5,type:'straight'},{id:'waterfront-roll',fraction:.58,length:12,height:2.7,width:5,lane:-5.5,type:'barrel'}],
  obstacleFractions:[{id:'roadworks-a',fraction:.07,lane:-6.8,radius:1.4,height:1.2,type:'barrier'},{id:'roadworks-b',fraction:.075,lane:-6.8,radius:1.4,height:1.2,type:'barrier'}],
}];

export function elevationAt(fraction, profile = []) {
  if (profile.length < 2) return 0;
  const f = ((fraction % 1) + 1) % 1;
  for (let i=1;i<profile.length;i++) if (f <= profile[i][0]) {
    const [a,ya]=profile[i-1], [b,yb]=profile[i];
    const t=(f-a)/(b-a), blend=(1-Math.cos(Math.PI*t))/2;
    return ya+(yb-ya)*blend;
  }
  return 0;
}
