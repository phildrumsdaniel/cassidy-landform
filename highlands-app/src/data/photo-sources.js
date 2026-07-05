// Photo sourcing catalog. For each POI slug we record either a verified
// Wikimedia Commons filename (`commons`) or a search query (`query`) the
// fetch script uses to find a good landscape image on Commons.
//
// The build-time script scripts/fetch-photos.mjs downloads these into
// public/images/<slug>.jpg and records real author/licence attribution into
// src/data/credits.json. Drop your own photos into public/images/mine/<slug>.jpg
// to override any of them.

export const photoSources = [
  // --- Verified Commons filenames (from the brochure starter list) ---
  { slug: 'glencoe',            name: 'Glencoe (Three Sisters)', commons: 'Glencoe (1).jpg' },
  { slug: 'derwentwater',       name: 'Derwentwater',            commons: 'Derwent Water, Lake District, Cumbria - June 2009.jpg' },
  { slug: 'loch-craignish',     name: 'Loch Craignish',          commons: 'Loch Craignish with Ardfern in the background, Argyllshire - geograph.org.uk - 65876.jpg' },
  { slug: 'ardfern-marina',     name: 'Ardfern Marina',          commons: 'A busy Ardfern Marina - geograph.org.uk - 4068815.jpg' },
  { slug: 'galley-of-lorne',    name: 'The Galley of Lorne Inn', commons: 'The Galley of Lorne Inn, Ardfern (geograph 4049514).jpg' },
  { slug: 'castle-stalker',     name: 'Castle Stalker',          commons: 'Castle Stalker Scotland.jpg' },
  { slug: 'glenfinnan-viaduct', name: 'Glenfinnan Viaduct',      commons: 'Glenfinnan Viaduct - 2022.jpg' },
  { slug: 'eilean-donan',       name: 'Eilean Donan Castle',     commons: 'Eilean Donan Castle.jpg' },
  { slug: 'torridon',           name: 'Torridon',                commons: 'The Torridons from the Shieldaig Peninsula.jpg' },

  // --- Found by Commons search at fetch time (query is a fallback-safe term) ---
  { slug: 'tebay-services',     name: 'Tebay Services',          query: 'Tebay Services Westmorland M6' },
  { slug: 'crinan-canal',       name: 'Crinan Canal',            query: 'Crinan Canal Argyll locks' },
  { slug: 'kilmartin-glen',     name: 'Kilmartin Glen',          query: 'Kilmartin Glen standing stones Argyll' },
  { slug: 'oban',               name: 'Oban',                    query: 'Oban harbour McCaig Tower Argyll' },
  { slug: 'applecross',         name: 'Applecross',              query: 'Applecross village Wester Ross' },
  { slug: 'applecross-bay',     name: 'Applecross Bay',          query: 'Applecross Bay beach Wester Ross' },
  { slug: 'gairloch-beach',     name: 'Gairloch beach',          query: 'Gairloch beach sands Wester Ross' },
  { slug: 'inverewe-garden',    name: 'Inverewe Garden',         query: 'Inverewe Garden Poolewe' },
  { slug: 'corrieshalloch-gorge', name: 'Corrieshalloch Gorge',  query: 'Corrieshalloch Gorge Falls of Measach' },
  { slug: 'ullapool',           name: 'Ullapool',                query: 'Ullapool harbour Loch Broom' },
  { slug: 'knockan-crag',       name: 'Knockan Crag',            query: 'Knockan Crag Assynt geology' },
  { slug: 'ardvreck-castle',    name: 'Ardvreck Castle',         query: 'Ardvreck Castle Loch Assynt' },
  { slug: 'kylesku-bridge',     name: 'Kylesku Bridge',          query: 'Kylesku Bridge Sutherland' },
  { slug: 'smoo-cave',          name: 'Smoo Cave',               query: 'Smoo Cave Durness Sutherland' },
  { slug: 'balnakeil-beach',    name: 'Balnakeil Beach',         query: 'Balnakeil Beach Durness' },
  { slug: 'sandwood-bay',       name: 'Sandwood Bay',            query: 'Sandwood Bay beach Sutherland' },
  { slug: 'loch-eriboll',       name: 'Loch Eriboll',            query: 'Loch Eriboll Sutherland' },
  { slug: 'kyle-of-tongue',     name: 'Kyle of Tongue',          query: 'Kyle of Tongue causeway Ben Loyal' },
  { slug: 'dunnet-head',        name: 'Dunnet Head',             query: 'Dunnet Head lighthouse Caithness' },
  { slug: 'duncansby-stacks',   name: 'Duncansby Stacks',        query: 'Duncansby Stacks Caithness' },
  { slug: 'john-o-groats',      name: 'John o’ Groats',          query: 'John o Groats signpost Caithness' },
  { slug: 'whaligoe-steps',     name: 'Whaligoe Steps',          query: 'Whaligoe Steps Caithness haven' },
  { slug: 'dunrobin-castle',    name: 'Dunrobin Castle',         query: 'Dunrobin Castle Sutherland' },
  { slug: 'dornoch',            name: 'Dornoch',                 query: 'Dornoch Cathedral Sutherland' },
  { slug: 'culloden',           name: 'Culloden Battlefield',    query: 'Culloden battlefield memorial cairn' },
  { slug: 'clava-cairns',       name: 'Clava Cairns',            query: 'Clava Cairns Balnuaran Inverness' },
  { slug: 'urquhart-castle',    name: 'Urquhart Castle',         query: 'Urquhart Castle Loch Ness' },
  { slug: 'fort-augustus',      name: 'Fort Augustus locks',     query: 'Fort Augustus Caledonian Canal locks' },
  { slug: 'aviemore',           name: 'Aviemore',                query: 'Aviemore Cairngorms Strathspey railway' },
  { slug: 'rothiemurchus',      name: 'Rothiemurchus',           query: 'Rothiemurchus forest Loch an Eilein' },
  { slug: 'loch-garten',        name: 'Loch Garten',             query: 'Loch Garten Abernethy osprey pines' },
  { slug: 'dalwhinnie',         name: 'Dalwhinnie Distillery',   query: 'Dalwhinnie distillery Highland' },
  { slug: 'blair-castle',       name: 'Blair Castle',            query: 'Blair Castle Blair Atholl Perthshire' },
  { slug: 'pitlochry-dam',      name: 'Pitlochry Dam',           query: 'Pitlochry dam fish ladder Tummel' }
]
