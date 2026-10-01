"""Build Camber Reign's outlined SVG identity from the licensed OFL font.
Run with Python fontTools + brotli. Pass --fonts to also rebuild font subsets.
The artwork contains paths, so its lettering does not depend on browser fonts.
"""
from pathlib import Path
import argparse
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools import subset

A = Path(__file__).resolve().parents[1] / 'public/assets'
font = TTFont(A / 'racing-sans-one.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
cap_height = font['OS/2'].sCapHeight


def word(text, x, y, width, height, cls, fill):
    paths, offset = [], 0
    for ch in text:
        glyph = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[glyph].draw(pen)
        paths.append(f'<path transform="translate({offset},0)" d="{pen.getCommands()}"/>')
        offset += font['hmtx'].metrics[glyph][0]
    # Uniform outline scaling keeps the letters' designed racing proportions.
    scale = min(width / offset, height / cap_height)
    return f'<g class="{cls}" fill="{fill}" transform="translate({x},{y}) scale({scale},{-scale})">' + ''.join(paths) + '</g>'


def defs():
    return '''<defs>
 <linearGradient id="chrome" x1="0" y1="0" x2="0.15" y2="1"><stop stop-color="#FFFFFF"/><stop offset=".30" stop-color="#F6F3FF"/><stop offset=".48" stop-color="#8A8295"/><stop offset=".50" stop-color="#FFFFFF"/><stop offset=".78" stop-color="#DCD7E5"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
 <linearGradient id="violet" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D6BDFF"/><stop offset=".36" stop-color="#9246FF"/><stop offset="1" stop-color="#7430D3"/></linearGradient>
 <linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#021439"/><stop offset=".5" stop-color="#110017"/><stop offset="1" stop-color="#021439"/></linearGradient>
 <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF"/><stop offset=".27" stop-color="#9246FF"/><stop offset=".5" stop-color="#110017"/><stop offset=".8" stop-color="#FFF71E"/><stop offset="1" stop-color="#9246FF"/></linearGradient>
 <pattern id="check" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 0h14v14H0zm14 14h14v14H14z" fill="#FFFFFF"/><path d="M14 0h14v14H14zM0 14h14v14H0z" fill="#021439"/></pattern>
 </defs>'''


def emblem(transform=''):
    return f'''<g class="emblem" transform="{transform}">
 <path d="M30 26H180l14 27-38 115-64 41-64-32L8 76Z" fill="#110017" opacity=".8" transform="translate(0 6)"/>
 <path class="shield" d="M30 26H180l14 27-38 115-64 41-64-32L8 76Z" fill="url(#dark)" stroke="url(#edge)" stroke-width="4"/>
 <path d="M37 37H171l8 19-34 104-54 35-52-27-18-90Z" fill="#110017" stroke="#9246FF" stroke-opacity=".55"/>
 <path d="M39 39h128l6 16H28Z" fill="url(#check)"/>
 {word('C', 34, 157, 76, 91, 'monogram-c', 'url(#chrome)')}
 {word('R', 99, 157, 73, 91, 'monogram-r', 'url(#violet)')}
 <path class="apex" d="m58 171 80-5-7 9-77 4Z" fill="#FFF71E"/>
 <path d="m27 109 14-5-10 28-16 5Zm139-24 13-7-9 28-13 7Z" fill="#9246FF"/>
 <path class="road-trace" d="M26 76 45 43h116l11 16-34 94-48 34-43-25-14-25" fill="none" stroke="#FFF71E" stroke-width="2"/>
 </g>'''


def full(animated=False):
    style = '''<style>.road-trace{stroke-dasharray:470;stroke-dashoffset:470;animation:trace 1.45s cubic-bezier(.2,.6,.2,1) forwards}.emblem{transform-origin:125px 155px;animation:badge .85s cubic-bezier(.16,1,.3,1) both}.camberword{animation:word .85s .22s both}.reignword{animation:word .85s .42s both}.sweep{stroke-dasharray:680;stroke-dashoffset:680;animation:trace 1.05s .6s ease-out forwards}.live-dot{animation:pulse 1.25s 1s infinite}@keyframes trace{to{stroke-dashoffset:0}}@keyframes badge{from{opacity:0;translate:30px 0;scale:.88}to{opacity:1;translate:0 0;scale:1}}@keyframes word{from{opacity:0;translate:32px 0}to{opacity:1;translate:0 0}}@keyframes pulse{50%{opacity:.35}}@media(prefers-reduced-motion:reduce){*{animation:none!important}.road-trace,.sweep{stroke-dashoffset:0}}</style>''' if animated else ''
    letters = word('CAMBER', 258, 129, 596, 96, 'camberword', 'url(#chrome)') + word('REIGN', 262, 240, 520, 104, 'reignword', 'url(#violet)')
    shadow = word('CAMBER', 258, 129, 596, 96, '', '#110017') + word('REIGN', 262, 240, 520, 104, '', '#110017')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 300" role="img" aria-label="Camber Reign"><title>Camber Reign</title>' + defs() + style + emblem('translate(12 16) scale(1.15)') + '<g transform="translate(0 5)" opacity=".65">' + shadow + '</g>' + letters + '''<path class="sweep" d="M264 257H801l49-39" fill="none" stroke="#FFF71E" stroke-width="5"/><path d="m772 209 68-4-14 17h-60Z" fill="#9246FF"/><circle class="live-dot" cx="853" cy="179" r="4" fill="#FFF71E"/></svg>'''


def build():
    (A / 'logo.svg').write_text(full())
    (A / 'logo-loader.svg').write_text(full(True))
    compact = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 150" role="img" aria-label="Camber Reign"><title>Camber Reign</title>' + defs() + emblem('translate(1 -2) scale(.65)') + word('CAMBER REIGN', 151, 99, 690, 77, '', 'url(#chrome)') + '<path d="M156 115H799l28-19" fill="none" stroke="#FFF71E" stroke-width="3"/><path d="M684 122H795l-11 7H679Z" fill="#9246FF"/></svg>'
    (A / 'logo-compact.svg').write_text(compact)
    (A / 'mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240" role="img" aria-label="Camber Reign racing emblem"><title>Camber Reign CR racing emblem</title>' + defs() + emblem('translate(10 8)') + '</svg>')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fonts', action='store_true', help='Also regenerate licensed webfont subsets')
    options = parser.parse_args()
    build()
    if options.fonts:
        for basename in ['racing-sans-one', 'barlow-condensed-extrabold-italic']:
            f = TTFont(A / (basename + '.ttf'))
            o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']
            sub = subset.Subsetter(options=o); sub.populate(unicodes=range(32, 256)); sub.subset(f)
            f.flavor = 'woff2'; f.save(A / (basename + '.woff2'))
    print('Created Camber Reign vector logos, CR emblem and animated loader.')
