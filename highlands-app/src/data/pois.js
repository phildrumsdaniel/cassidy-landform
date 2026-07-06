// Points of interest, keyed by slug. `image` resolves to public/images/<slug>.jpg
// (or images/mine/<slug>.jpg), falling back to a placeholder. Coordinates drive
// the map and Maps deep-links.

/** @type {Record<string, {name:string, blurb:string, lat:number, lng:number}>} */
export const POIS = {
  // Lake District
  'tebay-services':      { name: 'Tebay Services',        blurb: 'The famous family-run farm-shop services on the M6 — a proper Cumbrian pit stop.', lat: 54.4419, lng: -2.6060 },
  'derwentwater':        { name: 'Derwentwater',          blurb: 'One of Lakeland’s loveliest lakes, ringed by fells — a gentle evening stroll from Keswick.', lat: 54.5772, lng: -3.1450 },
  'castlerigg':          { name: 'Castlerigg Stone Circle', blurb: 'A 4,000-year-old ring of standing stones in a natural amphitheatre of fells.', lat: 54.6027, lng: -3.0987 },

  // Argyll
  'loch-craignish':      { name: 'Loch Craignish',        blurb: 'A serene sea loch scattered with islands, framing Ardfern village.', lat: 56.1300, lng: -5.5400 },
  'ardfern-marina':      { name: 'Ardfern Marina',        blurb: 'A busy little yachting marina tucked into Loch Craignish.', lat: 56.1855, lng: -5.5360 },
  'galley-of-lorne':     { name: 'The Galley of Lorne',   blurb: 'Cosy 18th-century inn on the water at Ardfern — our hotel for night two.', lat: 56.1840, lng: -5.5360 },
  'oban':                { name: 'Oban',                  blurb: 'The “seafood capital of Scotland” and gateway to the isles.', lat: 56.4150, lng: -5.4720 },
  'kilmartin-glen':      { name: 'Kilmartin Glen',        blurb: 'One of Scotland’s richest prehistoric landscapes — cairns, standing stones and carvings.', lat: 56.1330, lng: -5.4870 },
  'crinan-canal':        { name: 'Crinan Canal',          blurb: '“Britain’s most beautiful shortcut” — nine miles of locks between sea lochs.', lat: 56.0930, lng: -5.5580 },

  // Lochaber
  'castle-stalker':      { name: 'Castle Stalker',        blurb: 'A picture-perfect tower house on a tiny tidal islet in Loch Laich.', lat: 56.5720, lng: -5.3970 },
  'glencoe':             { name: 'Glencoe (Three Sisters)', blurb: 'Scotland’s most dramatic glen — three great ridges plunging to the road.', lat: 56.6710, lng: -4.9970 },
  'glenfinnan-viaduct':  { name: 'Glenfinnan Viaduct',    blurb: 'The great curved railway viaduct made famous by the Hogwarts Express.', lat: 56.8720, lng: -5.4330 },
  'steall-falls':        { name: 'Steall Falls',          blurb: 'A 120m waterfall reached on a gorge walk from the top of Glen Nevis.', lat: 56.7717, lng: -4.9686 },
  'mallaig':             { name: 'Mallaig & Silver Sands', blurb: 'A lively fishing port and the dazzling white beaches of Morar.', lat: 57.0064, lng: -5.8280 },

  // Wester Ross
  'eilean-donan':        { name: 'Eilean Donan Castle',   blurb: 'Scotland’s most photographed castle, on its own island where three lochs meet.', lat: 57.2740, lng: -5.5160 },
  'torridon':            { name: 'Torridon',              blurb: 'Ancient, sculpted mountains rising straight from the sea loch.', lat: 57.5470, lng: -5.5090 },
  'applecross-bay':      { name: 'Applecross',            blurb: 'A remote, whitewashed coastal village and pink-sand bay looking to Skye.', lat: 57.4330, lng: -5.8160 },
  'inverewe-garden':     { name: 'Inverewe Garden',       blurb: 'A lush subtropical garden thriving on the Gulf Stream at this latitude.', lat: 57.7760, lng: -5.5980 },
  'gairloch-beach':      { name: 'Gairloch beach',        blurb: 'Golden sands with sunsets over the Minch and, often, dolphins.', lat: 57.7300, lng: -5.6900 },

  // Assynt / Ullapool
  'corrieshalloch-gorge': { name: 'Corrieshalloch Gorge', blurb: 'A mile-long box canyon with a swaying suspension bridge over the Falls of Measach.', lat: 57.7570, lng: -5.0010 },
  'ullapool':            { name: 'Ullapool',              blurb: 'A pretty white-washed fishing port on Loch Broom.', lat: 57.8960, lng: -5.1590 },
  'ardvreck-castle':     { name: 'Ardvreck Castle',       blurb: 'A romantic ruined tower on a spit into Loch Assynt beneath Quinag.', lat: 58.1690, lng: -4.9970 },
  'knockan-crag':        { name: 'Knockan Crag',          blurb: 'The birthplace of modern geology, with a walk-through interpretive trail.', lat: 58.0300, lng: -5.0800 },
  'stac-pollaidh':       { name: 'Stac Pollaidh',         blurb: 'A miniature mountain with a giant’s profile and a superb short circuit.', lat: 58.0356, lng: -5.2075 },
  'achmelvich':          { name: 'Achmelvich Beach',      blurb: 'A hidden cove of white sand and turquoise water near Lochinver.', lat: 58.1717, lng: -5.3050 },
  'kylesku-bridge':      { name: 'Kylesku Bridge',        blurb: 'An elegant curving bridge sweeping across a Highland sea loch.', lat: 58.2570, lng: -5.0240 },

  // North coast
  'smoo-cave':           { name: 'Smoo Cave',             blurb: 'A vast sea-and-freshwater cave with a thundering inner waterfall.', lat: 58.5620, lng: -4.7200 },
  'balnakeil-beach':     { name: 'Balnakeil Beach',       blurb: 'A dazzling arc of white sand and dunes beside a craft village.', lat: 58.5780, lng: -4.7620 },
  'sandwood-bay':        { name: 'Sandwood Bay',          blurb: 'A remote, wild beach with a sea-stack — reached only on foot.', lat: 58.5350, lng: -5.0700 },
  'cape-wrath':          { name: 'Cape Wrath',            blurb: 'Mainland Britain’s wild north-west tip — minibus and ferry only.', lat: 58.6236, lng: -4.9989 },
  'loch-eriboll':        { name: 'Loch Eriboll',          blurb: 'A deep, dramatic sea loch once used to shelter the wartime fleet.', lat: 58.4900, lng: -4.7000 },
  'kyle-of-tongue':      { name: 'Kyle of Tongue',        blurb: 'A shallow, sandy sea loch crossed by a low causeway under Ben Loyal.', lat: 58.5000, lng: -4.4100 },
  'dunnet-head':         { name: 'Dunnet Head',           blurb: 'Red cliffs, a lighthouse and the true tip of mainland Britain.', lat: 58.6710, lng: -3.3760 },
  'castle-of-mey':       { name: 'Castle of Mey',         blurb: 'The late Queen Mother’s northern home, with walled gardens by the sea.', lat: 58.6386, lng: -3.2270 },
  'duncansby-stacks':    { name: 'Duncansby Stacks',      blurb: 'Towering sea-stacks and geos at the far north-east corner of Scotland.', lat: 58.6440, lng: -3.0330 },
  'john-o-groats':       { name: 'John o’ Groats',        blurb: 'The famous signpost marking the end of the mainland road.', lat: 58.6440, lng: -3.0700 },

  // East coast
  'whaligoe-steps':      { name: 'Whaligoe Steps',        blurb: '365 stone steps zig-zagging down cliffs to a hidden fishing haven.', lat: 58.3480, lng: -3.1750 },
  'dunrobin-castle':     { name: 'Dunrobin Castle',       blurb: 'A fairy-tale château of turrets, formal gardens and daily falconry.', lat: 57.9820, lng: -3.9460 },
  'dornoch':             { name: 'Dornoch',               blurb: 'A genteel cathedral town with a famous links golf course and beach.', lat: 57.8800, lng: -4.0280 },

  // Cairngorms & Loch Ness day loop
  'culloden':            { name: 'Culloden Battlefield',  blurb: 'The moor where the 1746 Jacobite rising met its end — moving and quiet.', lat: 57.4780, lng: -4.0940 },
  'clava-cairns':        { name: 'Clava Cairns',          blurb: 'A 4,000-year-old ring of burial cairns and standing stones in a wooded glade.', lat: 57.4730, lng: -4.0740 },
  'urquhart-castle':     { name: 'Urquhart Castle',       blurb: 'Ruined lochside stronghold with the classic view down Loch Ness.', lat: 57.3240, lng: -4.4420 },
  'fort-augustus':       { name: 'Fort Augustus locks',   blurb: 'A staircase of Caledonian Canal locks stepping down into Loch Ness.', lat: 57.1440, lng: -4.6810 },
  'aviemore':            { name: 'Aviemore',              blurb: 'The lively heart of the Cairngorms — outdoors town and steam railway.', lat: 57.1950, lng: -3.8290 },
  'rothiemurchus':       { name: 'Rothiemurchus',         blurb: 'Ancient Caledonian pine forest, lochs and easy walking trails.', lat: 57.1600, lng: -3.8000 },
  'loch-morlich':        { name: 'Loch Morlich',          blurb: 'A sandy freshwater beach ringed by pines under the Cairngorm plateau.', lat: 57.1583, lng: -3.7130 },
  'loch-garten':         { name: 'Loch Garten',           blurb: 'A pinewood osprey reserve beside a tranquil loch.', lat: 57.2500, lng: -3.7130 },
  'dalwhinnie':          { name: 'Dalwhinnie Distillery', blurb: 'The Highlands’ highest distillery, gentle and heathery.', lat: 56.9350, lng: -4.2450 },

  // Homeward
  'pitlochry-dam':       { name: 'Pitlochry Dam',         blurb: 'A hydro dam with a salmon ladder and a smart visitor centre.', lat: 56.7020, lng: -3.7350 },
  'blair-castle':        { name: 'Blair Castle',          blurb: 'A dazzling white castle with formal gardens near the A9.', lat: 56.7690, lng: -3.8480 }
}

export function poi(slug) {
  const p = POIS[slug]
  return p ? { slug, image: slug, ...p } : { slug, image: slug, name: slug, blurb: '', lat: undefined, lng: undefined }
}
