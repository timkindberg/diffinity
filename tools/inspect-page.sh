#!/bin/bash
# Usage: ./tools/inspect-page.sh "search term"
# Quick-inspect a demo page's diff items
cd "$(dirname "$0")/.."
python3 -c "
import json, re, sys
q = sys.argv[1].lower()
with open('site/fixtures/index.html') as f: c = f.read()
m = re.search(r'window\.VR_DATA = ({.*?});', c, re.DOTALL)
data = json.loads(m.group(1))
for page in data['pages']:
    if q in page['role'].lower() or q in page['page'].lower():
        vp = page['viewportDiffs']['1440']
        print(f'\n{page[\"page\"]} / {page[\"role\"]}')
        print(f'Changes: {vp[\"summary\"][\"totalChanges\"]}')
        for d in vp['diffs']:
            print(f'  [{d[\"importance\"]}] {d[\"type\"]}: {d[\"label\"]} (score {d[\"score\"]})')
            for ch in d['changes']:
                print(f'    {ch[\"property\"]}: {ch[\"before\"]} -> {ch[\"after\"]}')
        for g in vp['groups']:
            print(f'  [GROUP {g[\"importance\"]}] x{len(g[\"members\"])}: (score {g[\"score\"]})')
            for ch in g['changes']:
                print(f'    {ch[\"property\"]}: {ch[\"before\"]} -> {ch[\"after\"]}')
            for m2 in g['members'][:3]:
                print(f'      - {m2[\"label\"]}')
            if len(g['members'])>3: print(f'      ... +{len(g[\"members\"])-3} more')
        for cl in vp.get('cascadeClusters', []):
            print(f'  [CASCADE] {cl[\"elementCount\"]} elements: {cl[\"delta\"]}')
            if cl.get('rootCause'):
                rc = cl['rootCause']
                print(f'    caused by {rc[\"label\"]}: {rc[\"property\"]} {rc[\"before\"]} -> {rc[\"after\"]}')
        break
else:
    print(f'No page matching \"{sys.argv[1]}\"')
" "$1"
