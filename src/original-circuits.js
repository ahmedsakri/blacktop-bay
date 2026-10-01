// Authored for Camber Reign. These are original flat arcade circuits, not
// surveyed real-world venues; every route is validated with the actual physics.
// Start at the second collinear point so the grid sits on a true straight.
export const ORIGINAL_CIRCUITS = [
  {
    id: 'breakwater', name: 'Breakwater Run', environment: 'coastal', scenery: 'breakwater',
    character: 'Fast coastal sweepers', width: 18,
    description: 'A long sea-wall straight, sweeping headlands and an inland S-bend beside basalt outcrops and a working lighthouse.',
    points: [[-180,-230],[-70,-230],[70,-230],[205,-230],[288,-177],[304,-86],[274,-8],[197,36],[135,53],[115,112],[171,164],[228,219],[207,289],[119,325],[16,292],[-41,226],[-86,157],[-163,164],[-239,124],[-275,35],[-253,-53],[-274,-140],[-253,-207]],
  },
  {
    id: 'copper-canyon', name: 'Copper Canyon', environment: 'desert', scenery: 'copper-canyon',
    character: 'Open straights & switchbacks', width: 18,
    description: 'Carry speed between sandstone mesas, then brake for a broad canyon hairpin and a linked pair of technical turns.',
    points: [[-210,-220],[-100,-220],[40,-220],[192,-220],[286,-183],[339,-111],[329,-23],[254,25],[169,20],[99,48],[83,119],[140,185],[229,236],[237,313],[169,371],[71,352],[-6,266],[-54,171],[-104,131],[-190,149],[-272,113],[-322,35],[-308,-57],[-311,-143],[-272,-199]],
  },
  {
    id: 'cedar-ridge', name: 'Cedar Ridge', environment: 'parkland', scenery: 'cedar-ridge',
    character: 'Linked bends & forest straights', width: 17,
    description: 'Find a rhythm through cedar-lined bends, open the throttle on the forest straight, and sweep past timber lodges under the ridgeline.',
    points: [[-160,-260],[-45,-260],[85,-260],[199,-244],[268,-184],[278,-103],[236,-38],[150,-12],[121,49],[172,112],[252,149],[269,225],[220,294],[134,311],[67,268],[9,202],[-60,199],[-105,251],[-175,282],[-244,235],[-266,150],[-221,85],[-152,47],[-136,-21],[-192,-74],[-269,-111],[-295,-186],[-249,-241]],
  },
  {
    id: 'neon-freight', name: 'Neon Freight', environment: 'urban', scenery: 'neon-freight',
    character: 'Night-time industrial circuit', width: 19,
    description: 'A floodlit freight district with a long loading-yard straight, generous ninety-degree turns and a fast return past container stacks.',
    points: [[-200,-220],[-90,-220],[70,-220],[218,-220],[288,-177],[311,-104],[311,17],[282,81],[214,107],[127,111],[92,161],[101,237],[68,307],[-8,338],[-112,331],[-211,297],[-269,235],[-280,148],[-248,88],[-179,51],[-118,16],[-98,-47],[-146,-100],[-233,-118],[-282,-165],[-263,-211]],
  },
].map(circuit => ({ ...circuit, points: [...circuit.points.slice(1), circuit.points[0]] }));
