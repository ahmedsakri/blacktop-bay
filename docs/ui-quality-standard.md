# Mandatory UI quality standard

This standard records the user's requirements for Camber Reign. Apply it to the title screen, garage, collection, circuit selection, workshop, paint, race HUD, pause, help, results, loading, privacy, and information pages. A polished screen does not excuse a broken action or unreadable state elsewhere.

## Approved visual direction

Use an original futuristic motorsport interface inspired by the clarity and energy of premium arcade racing games. Keep sharp framed buttons, strong racing typography, deliberate spacing, and clear action hierarchy. Do not reproduce another game's logos or proprietary artwork.

| Role | Exact colour | Intended use |
| --- | --- | --- |
| Dominant accent | `#9246FF` | UI framing, selected panels, active surfaces, controlled glow |
| Secondary highlight | `#FFF71E` | Important CTAs, key active indicators, sparing high-energy emphasis |
| Base | `#110017` | Main dark background |
| Navy panel | `#021439` | Cards, dialogs, controls |
| White | `#FFFFFF` | Readable primary text and neutral icons |
| Danger | `#FF0054` | Destructive actions and genuine errors |
| Lime | `#C3FB13` | Sparing completed-upgrade status emphasis |
| Gold | `#FFD700` | Rewards, credits, podium emphasis |

The lobby Garage shortcut belongs in the top header strip beside race credits. Keep the lower navigation for race modes, career and circuits. On narrow phones, retain a visible Garage label and wallet without shrinking controls below 44 px; volume remains available through Controls and sound, and fullscreen remains available in landscape and the race orientation prompt.

Use the shared theme and button system instead of adding conflicting screen-specific primary colours. Keep the dark base dominant across each screen, with violet as the main accent and yellow reserved for priority moments. Keep dark text on yellow actions and white text on violet actions. Do not use violet for small body text on dark surfaces. Check muted labels and disabled states against their actual backgrounds. Never convey selection, danger, or progress through colour alone.

Use self-hosted illustrated SVG icons from the shared sprite. Icons must keep consistent size, alignment, and stroke; do not substitute emoji, platform-dependent glyphs, or unlabeled browser symbols. Decorative icons are hidden from assistive technology, while icon-only controls have clear accessible names. Keep Barlow Condensed for racing display hierarchy and readable UI type for supporting text. A generic `.button span` rule must not enlarge labels or affect every nested element.

## Required interaction checks

- Title and garage: Race now, car changes, orbit controls, back navigation, paint, performance, sound, and circuit selection work with the correct selected state.
- Collection: search, family filter, sorting, favourites, comparison, zero results, and choosing a car work together. Preserve focus when rebuilding cards; no stale selection or invisible focused control.
- Circuit browser: search and filters work, current circuit is clear, switching loads the requested circuit, and real venue names are distinguished from the game's simplified arcade layouts.
- Workshop and paint: show real values, prices, credit balances, upgrade limits, saving failures, and selected finishes. Never award credits through presentation code or silently claim a failed save succeeded.
- Driving: automatic acceleration, drag steering, keyboard steering/brake/handbrake, and held Nitro remain usable. Release, cancellation, lost pointer capture, blur, pause, and rotation must clear inputs. Steering and Nitro work simultaneously with two touches.
- Pause and help: pause freezes driving and time, resume restores the race, quick settings work, and restart/garage exits follow their existing confirmation rules.
- Results: show actual finishing position, timings, pending rivals, records, credits, and persistence outcomes. A pending opponent must not receive an invented finish time.
- Privacy: analytics stays inactive before consent; revocation disables measurement. UI changes must not bypass existing consent behaviour.

## Required layout and accessibility checks

Review at least 1280×800 desktop, 390×844 phone portrait, 844×390 phone landscape, and 568×320 compact landscape. Include 320 px width where a screen supports portrait use. Test with loaded local fonts and with realistic long car/circuit labels, empty search results, maximum upgrade states, and storage errors.

- No horizontal page overflow, clipped text, stretched artwork, overlapping actions, or covered primary controls. Modal content may scroll vertically; its primary actions remain reachable.
- Buttons and important touch actions have at least 44×44 CSS px target areas. Adjacent controls have space to avoid accidental taps. Readable labels must not be reduced solely to fit more buttons.
- Keyboard traversal includes buttons, links, search fields, selects, and checkboxes. Trap focus in an open modal, hide or make background controls inert, restore focus after closing, and keep a visible focus indicator.
- Respect safe areas, browser bars, dynamic viewport height, landscape rotation, and the phone orientation gate. A hidden control is also removed from keyboard interaction.
- Reduced-motion preferences remove nonessential movement. Animated graphics must not obscure text or intercept input. No forced audio before a user gesture.
- Keep the driving map, progress, timer, Nitro state, pause, and recovery feedback legible over bright and dark venue scenery.
- Inspect cars and scenery in the actual renderer. Check clipping planes against the largest circuit, optical surfaces, wheel animation, model loading failure, and bounded mobile graphics costs.

## Release gate and evidence

Run the production build and relevant automated tests. Broaden testing when changes cross shared components, input, saving, or the renderer. Record the checked viewports, key interactions, test results, and any limitations in the release report; retain representative screenshots where useful. A fixture is useful for rare UI states but does not replace an actual gameplay, save, and navigation smoke test.

Publish only after representative checks show no known critical failures, blocked primary actions, action overlaps, or material accessibility regressions. Fix findings and repeat the affected checks. Do not describe these checks as an absolute guarantee of zero bugs, perfect accessibility, or exhaustive device coverage. Unverified behaviour must be stated honestly.
