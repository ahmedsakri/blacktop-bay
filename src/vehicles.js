import { MANUFACTURER_VEHICLES } from './manufacturer-vehicles.js';
// Preserve the original twenty save IDs alongside independently sourced real cars. Physics units:
// m/s², m/s, steering multiplier, boost seconds, charge seconds per driving second.
export const VEHICLES = Object.freeze([
  Object.freeze({
    id: 'coupe', family: 'gt', name: 'Apex GT', number: '07', tagline: 'Precision, built for the grid.', color: '#de241b',
    specs: Object.freeze({ body: 'GT circuit racer', speed: '162 km/h', character: 'Balanced', boost: '3.0 sec' }),
    handling: Object.freeze({ acceleration: 14, topSpeed: 45, handling: 1, nitroCapacity: 3, recharge: .24 }),
  }),
  Object.freeze({
    id: 'sprint', family: 'gt', name: 'Apex Sprint', number: '11', tagline: 'Light on its feet. Fast out of the turn.', color: '#e8edf0',
    specs: Object.freeze({ body: 'GT sprint build', speed: '158 km/h', character: 'Responsive', boost: '2.8 sec' }),
    handling: Object.freeze({ acceleration: 15, topSpeed: 44, handling: 1.08, nitroCapacity: 2.8, recharge: .28 }),
  }),
  Object.freeze({
    id: 'gt', family: 'gt', name: 'Torque R', number: '24', tagline: 'Endurance muscle. Uncompromising pace.', color: '#d49136',
    specs: Object.freeze({ body: 'Widebody endurance GT', speed: '173 km/h', character: 'Power', boost: '3.0 sec' }),
    handling: Object.freeze({ acceleration: 15.2, topSpeed: 48, handling: .91, nitroCapacity: 3, recharge: .22 }),
  }),
  Object.freeze({
    id: 'endurance', family: 'gt', name: 'Torque RS', number: '88', tagline: 'Hold the pace. Go the distance.', color: '#233c77',
    specs: Object.freeze({ body: 'GT endurance build', speed: '166 km/h', character: 'Sustained boost', boost: '3.8 sec' }),
    handling: Object.freeze({ acceleration: 14.4, topSpeed: 46, handling: .98, nitroCapacity: 3.8, recharge: .25 }),
  }),
  Object.freeze({
    id: 'rally', family: 'formula', name: 'Vortex P1', number: '31', tagline: 'Low drag. Pure racing instinct.', color: '#42baa9',
    specs: Object.freeze({ body: 'Formula racer', speed: '151 km/h', character: 'Agility', boost: '3.4 sec' }),
    handling: Object.freeze({ acceleration: 13.6, topSpeed: 42, handling: 1.13, nitroCapacity: 3.4, recharge: .27 }),
  }),
  Object.freeze({
    id: 'formula', family: 'formula', name: 'Vortex X', number: '55', tagline: 'Open wheels. An open invitation to push.', color: '#b5d849',
    specs: Object.freeze({ body: 'Formula attack build', speed: '169 km/h', character: 'Fast response', boost: '3.2 sec' }),
    handling: Object.freeze({ acceleration: 14.8, topSpeed: 47, handling: 1.04, nitroCapacity: 3.2, recharge: .26 }),
  }),
  Object.freeze({
    id: 'prototype', family: 'prototype', name: 'Spectre LM', number: '63', tagline: 'A new silhouette. A longer horizon.', color: '#dddcd5',
    specs: Object.freeze({ body: 'Closed-cockpit prototype', speed: '176 km/h', character: 'Endurance', boost: '3.6 sec' }),
    handling: Object.freeze({ acceleration: 14.7, topSpeed: 49, handling: .96, nitroCapacity: 3.6, recharge: .24 }),
  }),
  Object.freeze({
    id: 'hyper', family: 'prototype', name: 'Spectre LM-R', number: '91', tagline: 'Every straight is an invitation.', color: '#ef5727',
    specs: Object.freeze({ body: 'Long-tail racing prototype', speed: '180 km/h', character: 'Top speed', boost: '3.3 sec' }),
    handling: Object.freeze({ acceleration: 15.1, topSpeed: 50, handling: .92, nitroCapacity: 3.3, recharge: .23 }),
  }),
  Object.freeze({
    id: 'barchetta', family: 'prototype', name: 'Cinder R', number: '16', tagline: 'Open cockpit. Nothing held back.', color: '#3f7cad',
    specs: Object.freeze({ body: 'Open-cockpit sports racer', speed: '162 km/h', character: 'Corner speed', boost: '3.1 sec' }),
    handling: Object.freeze({ acceleration: 15.3, topSpeed: 45, handling: 1.11, nitroCapacity: 3.1, recharge: .29 }),
  }),
  Object.freeze({
    id: 'spyder', family: 'prototype', name: 'Cinder RX', number: '72', tagline: 'Turn in early. Leave them behind.', color: '#b2263b',
    specs: Object.freeze({ body: 'Open-cockpit aero racer', speed: '169 km/h', character: 'Attack', boost: '3.5 sec' }),
    handling: Object.freeze({ acceleration: 15.6, topSpeed: 47, handling: 1.06, nitroCapacity: 3.5, recharge: .27 }),
  }),
  Object.freeze({
    id: 'kestrel', family: 'gt', name: 'Kestrel GT-R', number: '46', tagline: 'Long nose. Short lap times.', color: '#628782',
    specs: Object.freeze({ body: 'Long-nose GT time attack', speed: '176 km/h', character: 'Straight-line power', boost: '3.5 sec' }),
    handling: Object.freeze({ acceleration: 15, topSpeed: 49, handling: .94, nitroCapacity: 3.5, recharge: .25 }),
  }),
  Object.freeze({
    id: 'mirage', family: 'prototype', name: 'Mirage LMP', number: '08', tagline: 'Low roof. Long-tail precision.', color: '#6774a0',
    specs: Object.freeze({ body: 'Low-canopy endurance prototype', speed: '184 km/h', character: 'High-speed balance', boost: '3.6 sec' }),
    handling: Object.freeze({ acceleration: 14.9, topSpeed: 51, handling: .98, nitroCapacity: 3.6, recharge: .24 }),
  }),
  Object.freeze({
    id: 'monoposto', family: 'prototype', name: 'Solstice One', number: '29', tagline: 'One seat. Every apex.', color: '#cf9c51',
    specs: Object.freeze({ body: 'Single-seat open speedster', speed: '166 km/h', character: 'Agile response', boost: '3.0 sec' }),
    handling: Object.freeze({ acceleration: 15.8, topSpeed: 46, handling: 1.14, nitroCapacity: 3, recharge: .30 }),
  }),
  Object.freeze({
    id: 'tempest', family: 'prototype', name: 'Tempest XR', number: '99', tagline: 'Downforce with intent.', color: '#6f805c',
    specs: Object.freeze({ body: 'Extreme aero racing prototype', speed: '180 km/h', character: 'Aero attack', boost: '3.8 sec' }),
    handling: Object.freeze({ acceleration: 15.5, topSpeed: 50, handling: 1.02, nitroCapacity: 3.8, recharge: .25 }),
  }),
  Object.freeze({
    id: 'corsair', family: 'gt', name: 'Corsair GTS', number: '18', tagline: 'Open sky. Race-ready resolve.', color: '#2d7891',
    specs: Object.freeze({ body: 'Open-cockpit GT cup racer', speed: '167 km/h', character: 'Fluid response', boost: '3.2 sec' }),
    handling: Object.freeze({ acceleration: 14.8, topSpeed: 46.5, handling: 1.05, nitroCapacity: 3.2, recharge: .27 }),
  }),
  Object.freeze({
    id: 'stratus', family: 'gt', name: 'Stratus GT3', number: '52', tagline: 'Built to stay at the front.', color: '#b9bec1',
    specs: Object.freeze({ body: 'Long-tail endurance GT', speed: '178 km/h', character: 'Sustained pace', boost: '4.0 sec' }),
    handling: Object.freeze({ acceleration: 15.1, topSpeed: 49.5, handling: .97, nitroCapacity: 4, recharge: .24 }),
  }),
  Object.freeze({
    id: 'vector', family: 'formula', name: 'Vector F', number: '12', tagline: 'Every input. An instant answer.', color: '#f0bd35',
    specs: Object.freeze({ body: 'Formula sprint aero racer', speed: '167 km/h', character: 'Quick direction', boost: '2.9 sec' }),
    handling: Object.freeze({ acceleration: 15.4, topSpeed: 46.5, handling: 1.16, nitroCapacity: 2.9, recharge: .30 }),
  }),
  Object.freeze({
    id: 'zenith', family: 'formula', name: 'Zenith FX', number: '04', tagline: 'A clear view of the next apex.', color: '#b7cede',
    specs: Object.freeze({ body: 'Enclosed-canopy Formula concept', speed: '182 km/h', character: 'Fast and composed', boost: '3.5 sec' }),
    handling: Object.freeze({ acceleration: 14.6, topSpeed: 50.5, handling: 1.07, nitroCapacity: 3.5, recharge: .26 }),
  }),
  Object.freeze({
    id: 'vela', family: 'prototype', name: 'Vela R', number: '27', tagline: 'A cockpit built around the driver.', color: '#be603a',
    specs: Object.freeze({ body: 'Offset-cockpit sports racer', speed: '164 km/h', character: 'Corner specialist', boost: '3.3 sec' }),
    handling: Object.freeze({ acceleration: 15.7, topSpeed: 45.5, handling: 1.17, nitroCapacity: 3.3, recharge: .29 }),
  }),
  Object.freeze({
    id: 'aurora', family: 'prototype', name: 'Aurora LMX', number: '66', tagline: 'Made for the long way home.', color: '#886699',
    specs: Object.freeze({ body: 'Finned endurance prototype', speed: '187 km/h', character: 'Long-straight pace', boost: '3.9 sec' }),
    handling: Object.freeze({ acceleration: 15, topSpeed: 52, handling: .96, nitroCapacity: 3.9, recharge: .24 }),
  }),
  ...MANUFACTURER_VEHICLES,
]);

export function getVehicle(id = 'coupe') {
  return VEHICLES.find(vehicle => vehicle.id === id) || VEHICLES[0];
}
