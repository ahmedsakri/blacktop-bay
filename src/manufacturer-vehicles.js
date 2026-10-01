// Actual model identities are separate from the game's balanced driving ratings.
// These are independent artist-made representations, not manufacturer products.
const car = (id, brand, name, body, tagline, color, acceleration, topSpeed, handling, nitroCapacity, recharge, powertrain = 'combustion') => Object.freeze({
  id, assetId: id, brand, family: 'gt', origin: 'manufacturer', powertrain,
  name, number: '—', tagline, color,
  specs: Object.freeze({ body, speed: `${Math.round(topSpeed * 3.6)} km/h`, character: powertrain === 'electric' ? 'Electric response' : handling > 1.05 ? 'Corner response' : 'High-speed balance', boost: `${nitroCapacity.toFixed(1)} sec` }),
  handling: Object.freeze({ acceleration, topSpeed, handling, nitroCapacity, recharge }),
});

export const MANUFACTURER_VEHICLES = Object.freeze([
  car('mclaren-570s', 'McLaren', 'McLaren 570S Coupé', 'Mid-engine sports car', 'Light on its feet. Sharp on the apex.', '#f26818', 15.2, 48.5, 1.09, 3.4, .28),
  car('mclaren-senna', 'McLaren', 'McLaren Senna', 'Track-focused hypercar', 'Turn downforce into confidence.', '#3564bc', 15.7, 51.5, 1.14, 3.6, .28),
  car('mclaren-p1-gtr', 'McLaren', 'McLaren P1 GTR', 'Track-only hypercar', 'A circuit is its natural habitat.', '#e3ea37', 15.7, 51, 1.08, 3.7, .27),
  car('ferrari-458-italia', 'Ferrari', 'Ferrari 458 Spider', 'Mid-engine open-top sports car', 'A sharper line through every corner.', '#d8201b', 15.1, 48, 1.06, 3.3, .27),
  car('lamborghini-aventador', 'Lamborghini', 'Lamborghini Aventador', 'V12 supercar', 'Low. Wide. Unmistakable.', '#ee8b19', 15.0, 50, .98, 3.6, .24),
  car('koenigsegg-one-1', 'Koenigsegg', 'Koenigsegg One:1', 'Track-focused megacar', 'Find another gear in your ambition.', '#8d1919', 15.7, 52, 1.03, 3.9, .25),
  car('pagani-zonda-c12', 'Pagani', 'Pagani Zonda C12', 'V12 supercar', 'Sculpted for the open road.', '#a7adb3', 15.0, 49, 1.05, 3.4, .26),
  car('bugatti-veyron', 'Bugatti', 'Bugatti Veyron', 'W16 hypercar', 'Give the straight your full attention.', '#234fa1', 15.4, 52, .94, 3.9, .23),
  car('maserati-mc-stradale', 'Maserati', 'Maserati GranTurismo MC Stradale', 'Track-focused grand tourer', 'Grand touring with a sharper edge.', '#eee9e0', 14.9, 47.5, 1.02, 3.6, .26),
  car('lotus-elise', 'Lotus', 'Lotus Elise', 'Lightweight sports car', 'Less weight. More corner.', '#2c6b4a', 15.4, 45.5, 1.17, 3.0, .30),
  car('audi-r8', 'Audi', 'Audi R8 Custom', 'Sports car with custom body kit', 'Quiet confidence. Committed corners.', '#a86527', 15.2, 48, 1.07, 3.4, .27),
  car('rimac-concept-one', 'Rimac', 'Rimac Concept One', 'Electric hypercar', 'Instant response. Electric intent.', '#b22623', 16.0, 50, 1.02, 3.7, .28, 'electric'),
  car('porsche-930-turbo', 'Porsche', 'Porsche 911 (930) Turbo', '1975 classic sports car', 'An icon with its own rhythm.', '#cccac6', 14.7, 46, 1.10, 3.1, .28),
  car('gma-t50', 'Gordon Murray Automotive', 'GMA T.50 Custom', 'Artist’s T.50 track interpretation', 'One driver. A singular focus.', '#3256be', 15.6, 50, 1.12, 3.4, .29),
  car('aston-martin-one-77', 'Aston Martin', 'Aston Martin One-77', 'V12 grand tourer', 'Sculpted presence. Composed pace.', '#1f2125', 15.0, 49, 1.01, 3.6, .25),
  car('rimac-nevera', 'Rimac', 'Rimac Nevera', 'Electric hypercar', 'Every exit. Electrified.', '#267f9b', 16.2, 51.5, 1.05, 3.8, .28, 'electric'),
]);
