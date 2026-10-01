// Nissan GT-R 2018 by Tanvir.Ahmed, CC BY 4.0. +Z source forward.
// Geometry uses whole source wheel pieces, with authored steering neutralized.
const wheelMaterial = new Set(['Material__6', 'wheel_black', 'outer_rim', 'inner_rim', 'chrome_rim', 'brake', 'material_24', 'material']);
export default [{
  id: 'nissan-gt-r-2018', uid: 'e595ef868dd94f77b83c332f9d5c6f5d',
  brand: 'Nissan', model: 'GT-R · 2018', length: 4.71,
  paint: ['body'], exclude: (_name, material) => material === 'floor',
  wheel: (_name, material) => wheelMaterial.has(material),
  wheelYaw: {wheel_front_left: -20 * Math.PI / 180, wheel_front_right: -20 * Math.PI / 180},
  alignWheelContact: true, simplifyPermissive: true,
  highBudget: 360000, lowBudget: 95000, highSecondaryError: .002, lowError: .02,
  brake: ['taillight2S', 'tail_light_lod0', 'detail_glass_red'],
  extraChanges: 'Removed the display floor; neutralized source front wheel steering by 20 degrees; repaired named PBR material roles while retaining authored geometry and UVs.',
  repairMaterials(root) {
    const palette=(m,c,metal,rough)=>m.setBaseColorFactor(c).setMetallicFactor(metal).setRoughnessFactor(rough).setEmissiveFactor([0,0,0]);
    for (const m of root.listMaterials()) {
      const n=m.getName(); m.setEmissiveFactor([0,0,0]);
      if(n==='body')m.setMetallicFactor(.62).setRoughnessFactor(.24);
      else if(n==='Material__6'||n==='rubber_trim')palette(m,[.016,.018,.021,1],0,.85);
      else if(n==='wheel_black')palette(m,[.028,.032,.038,1],.75,.3);
      else if(['inner_rim','outer_rim','chrome_rim','material','material_24'].includes(n))palette(m,[.28,.31,.36,1],.92,.25);
      else if(n==='brake')palette(m,[.26,.28,.3,1],.87,.39);
      else if(n==='window')palette(m,[.045,.07,.09,.67],.14,.12).setAlphaMode('BLEND');
      else if(n==='glass'||n==='detail_glass_cle')palette(m,[.6,.72,.8,.32],.12,.1).setAlphaMode('BLEND');
      else if(['taillight2S','tail_light_lod0','detail_glass_red','fogred'].includes(n))palette(m,[.5,.008,.014,1],.13,.22).setAlphaMode('OPAQUE');
      else if(['hidhead','xenonhead','drlwhite','reverse_light_lo'].includes(n))palette(m,[.75,.83,.92,1],.18,.2);
      else if(n.startsWith('indicator_'))palette(m,[.8,.28,.018,1],.1,.3);
      else if(n==='chrome'||n==='chrome_2'||n.startsWith('mirror'))palette(m,[.55,.6,.66,1],.95,.17);
      else if(n==='carbon_fiber')m.setMetallicFactor(.18).setRoughnessFactor(.4);
      else if(['leather','bump_leather','bump_leather2','cloth','headliner'].includes(n))m.setMetallicFactor(0).setRoughnessFactor(.83);
      else if(['plastic','plastic2','bump_plastic','black','misc'].includes(n))m.setMetallicFactor(.05).setRoughnessFactor(.6);
      else if(n==='undercarriage')palette(m,[.034,.039,.047,1],.45,.55);
    }
  },
}];
