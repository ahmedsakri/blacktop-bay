// Portable source configuration for isolated preparation or the shipping catalogue.
// Raw UID.glb and live Sketchfab UID.json must be adjacent in --sources.
export default [
  {
    id: 'bmw-i8', uid: 'c884666736f049c296044992107e12a7',
    brand: 'BMW', model: 'i8', length: 4.689,
    paint: ['Material__121'],
    wheel: (_name, material) => ['Material__102', 'Material__89', 'Material__90', 'Material__91', '7___Default'].includes(material),
    brake: ['Material__78'],
    simplifyPermissive: true, lowBudget: 160000, lowError: .004,
  },
  {
    id: 'bmw-f22-eurofighter', uid: 'd4ffe0df9066481fa028eb1e1348c4b0',
    brand: 'BMW', model: 'F22 Eurofighter', length: 4.7, flip: true,
    paint: ['remap__prim_env_2_spec'],
    wheel: (_name, material) => ['smw_remap__sec_env_4_spec', 'wheelz__env_3_spec', 'ad08_sidewall__spec', 'advan__spec', 'brake_disc__env_4_spec', 'discextras__spec'].includes(material),
    brake: ['TAIL_GLASS'],
    simplifyPermissive: true, alignWheelContact: true,
    additionalCredits: [
      {title: 'F22 Eurofighter edit', author: 'autoNgraphic', source: 'https://vk.com/autongraphic'},
      {title: 'F22 Eurofighter bodykit', author: 'crooked.hand', source: 'https://vk.com/crooked.hand'},
      {title: 'F22 Eurofighter wheels', author: 'ondori_ws', source: 'https://vk.com/ondori_ws'},
    ],
  },
];
