import fs from 'fs';
import * as topo from 'topojson-client';
const t = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const ids = {'356':'IND','586':'PAK','050':'BGD','524':'NPL','064':'BTN','144':'LKA','156':'CHN'};
const out = {};
for (const g of t.objects.countries.geometries) if (ids[g.id]) out[ids[g.id]] = topo.feature(t, g).geometry;
fs.writeFileSync('countries.json', JSON.stringify(out));
console.log(Object.keys(out));
