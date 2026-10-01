# Grand Prix circuit pack: research and validation

Reviewed 1 October 2026. This report concerns the prepared source; deployment and real-device performance are not claimed.

## Scope and primary evidence

The [current official 2026 calendar](https://www.formula1.com/en/racing/2026) contains 23 rounds. [Formula 1’s 26 July announcement](https://corp.formula1.com/formula-1-and-fia-confirm-that-malaysia-will-join-the-2026-calendar-as-host-venue-for-the-bahrain-grand-prix/) confirms Sepang as the host venue for the Bahrain Grand Prix on 2–4 October. The [original calendar announcement](https://api.fia.com/news/fia-and-formula-1-announce-2026-calendar) listed 24 rounds, including Sakhir and Jeddah. Those two venues are labeled original-calendar bonuses, not current rounds.

The game therefore has 30 courses: five unchanged original courses, 23 current-calendar venue adaptations, and two bonus venue adaptations. This is not a claim to cover every venue in Formula 1 history. The calendar is a dated snapshot, not a live feed.

## Geometry provenance and limitations

The source is [f1-circuits by Tomislav Bacinger](https://github.com/bacinger/f1-circuits), pinned to commit `394d8fbe70ef2c0b0c8d23ff7bee61fa09606055`, copyright © 2019–2025, MIT licensed. The upstream dataset explicitly describes itself as unofficial and acknowledges an initial Google My Maps source. The MIT notice is preserved in `public/credits/f1-circuits-MIT.txt` and `reports/circuit-research/LICENSE.md`; the public credits page identifies the derivation and changes. No official map artwork, logos, game meshes or textures were copied.

The frozen GeoJSON input is `reports/circuit-research/source-circuits.geojson`. `scripts/prepare-grand-prix-circuits.mjs` reproducibly converts geographic outlines into local metre coordinates, scales, resamples, smooths and separates nearby road sections, then chooses a safe starting straight. This is an offline preparation step: production never downloads geometry. Course-specific descriptions summarize the source character, but tight chicanes are softened and some very small details disappear. Tracks are compact, flat arcade adaptations, not surveyed replicas. The real venue length is metadata only; displayed playable lap lengths must use the computed `length`.

Suzuka uses original authored geometry: its figure-eight overpass is unrolled into a non-crossing rhythm course. This is explicitly stated in `adaptationNote`; planar collision/projection cannot safely handle an at-grade figure-eight. Banking and elevation are not simulated, including Madring’s Monumental turn. Madring data represents a published outline; the official current page gives 5.414km and overrides the older dataset length. All other real lengths likewise come from linked official event pages rather than blindly trusting dataset metadata.

## Catalogue and physical validation

Each fixture drives all checkpoints through actual player/opponent physics at 120 Hz, without assigning progress or finish state. Each four-car field completes three laps with zero recovery resets. The fixture allows up to 420 seconds for the longer courses; existing original-course 220/240-second limits remain unchanged.

| Course | Country | Category | Official length | Arcade lap | Player finish | All four finished |
|---|---|---|---:|---:|---:|---:|
| [Albert Park](https://www.formula1.com/en/racing/2026/australia) | Australia | Round 1 | 5.278km | 2.497km | 216.5s | 232.5s |
| [Shanghai](https://www.formula1.com/en/racing/2026/china) | China | Round 2 | 5.451km | 2.513km | 248.6s | 271.1s |
| [Suzuka](https://www.formula1.com/en/racing/2026/japan) | Japan | Round 3 | 5.807km | 2.486km | 237.4s | 259.5s |
| [Miami](https://www.formula1.com/en/racing/2026/miami) | United States | Round 4 | 5.412km | 2.393km | 221.5s | 237.3s |
| [Gilles Villeneuve](https://www.formula1.com/en/racing/2026/canada) | Canada | Round 5 | 4.361km | 2.468km | 215.1s | 231.0s |
| [Monaco](https://www.formula1.com/en/racing/2026/monaco) | Monaco | Round 6 | 3.337km | 2.133km | 203.9s | 221.8s |
| [Barcelona-Catalunya](https://www.formula1.com/en/racing/2026/barcelona-catalunya) | Spain | Round 7 | 4.657km | 2.384km | 226.9s | 247.2s |
| [Red Bull Ring](https://www.formula1.com/en/racing/2026/austria) | Austria | Round 8 | 4.326km | 2.496km | 224.6s | 242.8s |
| [Silverstone](https://www.formula1.com/en/racing/2026/great-britain) | United Kingdom | Round 9 | 5.891km | 2.402km | 221.1s | 239.7s |
| [Spa-Francorchamps](https://www.formula1.com/en/racing/2026/belgium) | Belgium | Round 10 | 7.004km | 2.844km | 252.7s | 273.5s |
| [Hungaroring](https://www.formula1.com/en/racing/2026/hungary) | Hungary | Round 11 | 4.381km | 2.364km | 226.6s | 245.8s |
| [Zandvoort](https://www.formula1.com/en/racing/2026/netherlands) | Netherlands | Round 12 | 4.259km | 2.351km | 227.0s | 247.9s |
| [Monza](https://www.formula1.com/en/racing/2026/italy) | Italy | Round 13 | 5.793km | 2.575km | 219.6s | 235.3s |
| [Madring](https://www.formula1.com/en/racing/2026/spain) | Spain | Round 14 | 5.414km | 2.546km | 226.8s | 247.1s |
| [Baku City](https://www.formula1.com/en/racing/2026/azerbaijan) | Azerbaijan | Round 15 | 6.003km | 2.465km | 218.3s | 234.3s |
| [Sepang](https://www.formula1.com/en/racing/2026/bahrain) | Malaysia | Round 16 | 5.543km | 2.460km | 238.4s | 259.9s |
| [Marina Bay](https://www.formula1.com/en/racing/2026/singapore) | Singapore | Round 17 | 4.927km | 2.370km | 223.1s | 242.0s |
| [Circuit of the Americas](https://www.formula1.com/en/racing/2026/united-states) | United States | Round 18 | 5.513km | 2.290km | 226.2s | 245.1s |
| [Hermanos Rodríguez](https://www.formula1.com/en/racing/2026/mexico) | Mexico | Round 19 | 4.304km | 2.441km | 218.7s | 237.2s |
| [Interlagos](https://www.formula1.com/en/racing/2026/brazil) | Brazil | Round 20 | 4.309km | 2.397km | 225.1s | 242.5s |
| [Las Vegas Strip](https://www.formula1.com/en/racing/2026/las-vegas) | United States | Round 21 | 6.201km | 2.466km | 222.1s | 238.1s |
| [Lusail](https://www.formula1.com/en/racing/2026/qatar) | Qatar | Round 22 | 5.419km | 2.342km | 229.9s | 250.8s |
| [Yas Marina](https://www.formula1.com/en/racing/2026/united-arab-emirates) | United Arab Emirates | Round 23 | 5.281km | 2.382km | 225.3s | 241.4s |
| [Bahrain International](https://www.formula1.com/en/racing/2025/bahrain) | Bahrain | Bonus | 5.412km | 2.359km | 228.6s | 248.2s |
| [Jeddah Corniche](https://www.formula1.com/en/racing/2025/saudi-arabia) | Saudi Arabia | Bonus | 6.174km | 2.605km | 226.0s | 245.0s |

Geometry checks cover finite normalized samples, closure, no intersecting centerlines, a straight initial 35 m, more than 24 m of separation beyond the road width for sections separated by 70 m along the course, and positive inside-kerb radii. All 25 new layouts use 440 samples, retaining the existing projection budget per racer. The five original sampled curves are locked by SHA-256 regression checks and remain numerically identical. Spectator-stand footprint tests cover all 30 courses.

## Runtime metadata contract

`TRACKS` returns lightweight descriptors, while `getTrack(id)` includes the same metadata plus samples and spawn. Original courses use `series: original`, `region: Blacktop Bay`, `layoutKind: original`; no environment override is applied. Added venues expose `series: grand-prix`, `season: 2026`, `calendarStatus: current|original-calendar-bonus`, nullable round, country, region, official source URL, pinned geometry source URL, realLengthKm, `layoutKind: compact-adaptation`, adaptationNote and `environment: coastal|urban|desert|parkland`. See the adjacent metadata schema.

Targeted validation passed **71/71** tests across `grand-prix-circuits.test.js`, `race.test.js` and `world.test.js`.

## Remaining release verification

Root owns responsive circuit selector, integration, source review, production deployment and live checks. Automated completion is not a benchmark of physical mobile hardware or GPU performance. The pack’s visual setting is stylized and does not reconstruct each venue’s buildings or full scenery.
