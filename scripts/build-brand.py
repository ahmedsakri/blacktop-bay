"""Build outlined SVG racing identities from the OFL Racing Sans One font.
Run with Python fontTools + brotli. Font outlines keep logos consistent in every browser.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools import subset
A=Path(__file__).resolve().parents[1]/'public/assets'
font=TTFont(A/'racing-sans-one.ttf');glyphs=font.getGlyphSet();cmap=font.getBestCmap();units=font['head'].unitsPerEm

def word(text,x,y,width,height,cls,fill):
    paths=[];offset=0
    for ch in text:
        g=cmap[ord(ch)];pen=SVGPathPen(glyphs);glyphs[g].draw(pen)
        paths.append(f'<path transform="translate({offset},0)" d="{pen.getCommands()}"/>');offset+=font['hmtx'].metrics[g][0]
    return f'<g class="{cls}" fill="{fill}" transform="translate({x},{y}) scale({width/offset},{-height/(units*.72)})">'+''.join(paths)+'</g>'
def defs():
 return '''<defs>
 <linearGradient id="chrome" x1="0" y1="0" x2="0.15" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="#e5f7ff"/><stop offset=".48" stop-color="#819aa7"/><stop offset=".5" stop-color="#e9fbff"/><stop offset=".78" stop-color="#bfd5de"/><stop offset="1" stop-color="#f5ffff"/></linearGradient>
 <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d1fcff"/><stop offset=".36" stop-color="#55edf6"/><stop offset="1" stop-color="#00a5c4"/></linearGradient>
 <linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#314b5c"/><stop offset=".5" stop-color="#0b1b27"/><stop offset="1" stop-color="#112b3a"/></linearGradient>
 <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2faff"/><stop offset=".27" stop-color="#78a6bd"/><stop offset=".5" stop-color="#193444"/><stop offset=".8" stop-color="#8bf5ff"/><stop offset="1" stop-color="#186d8b"/></linearGradient>
 <pattern id="check" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 0h14v14H0zm14 14h14v14H14z" fill="#c7eff6"/><path d="M14 0h14v14H14zM0 14h14v14H0z" fill="#1f3a4c"/></pattern>
 <filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>
 </defs>'''
def emblem(transform=''):
 return f'''<g class="emblem" transform="{transform}">
 <path d="M30 26 180 26 194 53 156 168 92 209 28 177 8 76Z" fill="#03101b" opacity=".8" transform="translate(0 6)"/>
 <path class="shield" d="M30 26 180 26 194 53 156 168 92 209 28 177 8 76Z" fill="url(#dark)" stroke="url(#edge)" stroke-width="4"/>
 <path d="m37 37 134 0 8 19-34 104-54 35-52-27-18-90Z" fill="#071520" stroke="#4ed9ed" stroke-opacity=".36"/>
 <path d="M39 39h128l6 16H28Z" fill="url(#check)"/>
 <path d="M52 65 153 65 143 87 98 87 105 75 78 75 58 130 84 130 96 102 137 102 130 123 106 123 102 136 147 136 136 157 49 157 33 137Z" fill="url(#chrome)"/>
 <path class="apex" d="m105 88 29-16-13 32-41 76 0-22 25-70Z" fill="url(#cyan)"/>
 <path d="m27 109 20-7-10 28-22 7Zm132-24 20-7-9 28-20 7Z" fill="#ff624d"/>
 <path class="road-trace" d="M26 76 45 43h116l11 16-34 94-48 34-43-25-14-25" fill="none" stroke="#86f9ff" stroke-width="2"/>
 </g>'''

def full(animated=False):
 style='''<style>.road-trace{stroke-dasharray:470;stroke-dashoffset:470;animation:trace 1.45s cubic-bezier(.2,.6,.2,1) forwards}.emblem{transform-origin:125px 155px;animation:badge .85s cubic-bezier(.16,1,.3,1) both}.topword{animation:word .85s .22s both}.bayword{animation:word .85s .42s both}.sweep{stroke-dasharray:680;stroke-dashoffset:680;animation:trace 1.05s .6s ease-out forwards}.live-dot{animation:pulse 1.25s 1s infinite}@keyframes trace{to{stroke-dashoffset:0}}@keyframes badge{from{opacity:0;translate:30px 0;scale:.88}to{opacity:1;translate:0 0;scale:1}}@keyframes word{from{opacity:0;translate:32px 0}to{opacity:1;translate:0 0}}@keyframes pulse{50%{opacity:.35}}@media(prefers-reduced-motion:reduce){*{animation:none!important}.road-trace,.sweep{stroke-dashoffset:0}}</style>''' if animated else ''
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 300" role="img" aria-label="Blacktop Bay">'+defs()+style+emblem('translate(12 16) scale(1.15)')+f'<g transform="translate(0 5)" opacity=".5">'+word('BLACKTOP',258,123,596,95,'','black')+word('BAY',265,232,352,106,'','black')+'</g>'+word('BLACKTOP',258,123,596,95,'topword','url(#chrome)')+word('BAY',265,232,352,106,'bayword','url(#cyan)')+'''<path class="sweep" d="m264 253 526 0 60-45" fill="none" stroke="#52ddee" stroke-width="5"/><path d="m660 216 174-6-15 17-164 0Z" fill="#ff654e"/><path d="m650 235 153 0-19 9H645Z" fill="#5a7688"/><circle class="live-dot" cx="844" cy="180" r="5" fill="#ff6953"/></svg>'''
(A/'logo.svg').write_text(full())
(A/'logo-loader.svg').write_text(full(True))
compact='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 150" role="img" aria-label="Blacktop Bay">'+defs()+emblem('translate(1 -2) scale(.65)')+word('BLACKTOP BAY',151,97,690,77,'','url(#chrome)')+'<path d="m156 113 642 0 29-17" fill="none" stroke="#43e6f4" stroke-width="3"/><path d="m689 118 106 0-11 8H684Z" fill="#ff624d"/></svg>'
(A/'logo-compact.svg').write_text(compact)
(A/'mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240">'+defs()+emblem('translate(10 8)')+'</svg>')
for basename in ['racing-sans-one','barlow-condensed-extrabold-italic']:
 f=TTFont(A/(basename+'.ttf'));o=subset.Options();o.flavor='woff2';o.layout_features=['*'];sub=subset.Subsetter(options=o);sub.populate(unicodes=range(32,256));sub.subset(f);f.flavor='woff2';f.save(A/(basename+'.woff2'))
print('Created scalable logos, animated loader artwork and compact fonts.')
