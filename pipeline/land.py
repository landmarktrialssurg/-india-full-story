import json
from shapely.geometry import shape, mapping, box, Polygon, MultiPolygon
from shapely.ops import unary_union
c = json.load(open('countries.json'))
parts = [shape(c[k]) for k in ['IND','PAK','BGD','NPL','BTN']]
chn = shape(c['CHN'])
# Aksai Chin + Trans-Karakoram tract (approximate, stylised)
claim = Polygon([(75.9,36.6),(77.0,36.1),(77.8,35.55),(78.3,35.6),(79.0,35.95),(79.6,35.9),(80.3,35.4),(80.4,34.8),(79.6,34.3),(79.0,34.3),(78.2,34.5),(77.0,35.3),(75.9,36.0)])
parts.append(chn.intersection(claim))
main = unary_union(parts).buffer(0.02).buffer(-0.02)
lka = shape(c['LKA'])
def clean(g, minarea=0.05):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    return [Polygon(p.exterior).simplify(0.03) for p in polys if p.area > minarea]
out = {'main': [list(p.exterior.coords) for p in clean(main)], 'lanka': [list(p.exterior.coords) for p in clean(lka)]}
json.dump(out, open('land.json','w'))
print([len(x) for x in out['main']], [len(x) for x in out['lanka']])
