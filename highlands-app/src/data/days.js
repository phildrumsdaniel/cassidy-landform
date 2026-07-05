// Full 16-day itinerary — Highlands Adventure, 8–23 August 2026.
// Each POI `image` is a stable slug resolved at runtime to a photo in
// public/images/ (or public/images/mine/ for our own), falling back to a
// tasteful placeholder. Coordinates centre the Leaflet map / maps deep-links.

/**
 * @typedef {{ name: string, blurb: string, lat?: number, lng?: number, image: string, credit?: string }} POI
 * @typedef {{ n:number, date:string, weekday:string, title:string, drive:string,
 *   distance:string, overnight:string, plan:string[], goodToKnow:string,
 *   pois:POI[], hero:string }} Day
 */

/** @type {Day[]} */
export const days = [
  {
    n: 1,
    date: '8 Aug 2026',
    weekday: 'Sat',
    title: 'Burbage to the Lake District',
    drive: 'Up to 6 hrs',
    distance: '~180–220 mi',
    overnight: 'Keswick or Penrith',
    plan: [
      'Leave after breakfast — no rush.',
      'Tebay Services comfort stop on the M6.',
      'Evening walk by Derwentwater.'
    ],
    goodToKnow: 'Keep it simple — the aim today is just to get north without arriving tired.',
    hero: 'derwentwater',
    pois: [
      { name: 'Tebay Services', blurb: 'The famous family-run farm-shop services on the M6 — a proper Cumbrian pit stop.', lat: 54.4419, lng: -2.6060, image: 'tebay-services' },
      { name: 'Derwentwater', blurb: 'One of Lakeland’s loveliest lakes, ringed by fells — a gentle evening stroll from Keswick.', lat: 54.5772, lng: -3.1450, image: 'derwentwater' }
    ]
  },
  {
    n: 2,
    date: '9 Aug 2026',
    weekday: 'Sun',
    title: 'Lake District to Ardfern',
    drive: '~6 hrs',
    distance: '~250 mi',
    overnight: 'The Galley of Lorne / Ardfern',
    plan: [
      'North through southern Scotland into Argyll.',
      'Arrive Ardfern on the Craignish peninsula.',
      'Dinner at The Galley of Lorne and check motorhome parking.'
    ],
    goodToKnow: 'First proper Scottish evening — don’t over-plan it.',
    hero: 'loch-craignish',
    pois: [
      { name: 'Loch Craignish', blurb: 'A serene sea loch scattered with islands, framing Ardfern village.', lat: 56.1300, lng: -5.5400, image: 'loch-craignish' },
      { name: 'The Galley of Lorne Inn', blurb: 'Cosy 18th-century inn on the water at Ardfern — our welcome to Argyll.', lat: 56.1840, lng: -5.5360, image: 'galley-of-lorne' }
    ]
  },
  {
    n: 3,
    date: '10 Aug 2026',
    weekday: 'Mon',
    title: 'Ardfern & Mid-Argyll slow day',
    drive: 'Light local driving',
    distance: 'Short hops',
    overnight: 'Ardfern',
    plan: [
      'Ardfern Marina & Loch Craignish.',
      'Crinan Canal locks.',
      'Kilmartin Glen prehistoric sites.'
    ],
    goodToKnow: 'A slow day makes the whole trip feel like a holiday.',
    hero: 'kilmartin-glen',
    pois: [
      { name: 'Ardfern Marina', blurb: 'A busy little yachting marina tucked into Loch Craignish.', lat: 56.1855, lng: -5.5360, image: 'ardfern-marina' },
      { name: 'Crinan Canal', blurb: '“Britain’s most beautiful shortcut” — nine miles of locks between sea lochs.', lat: 56.0930, lng: -5.5580, image: 'crinan-canal' },
      { name: 'Kilmartin Glen', blurb: 'One of Scotland’s richest prehistoric landscapes — cairns, standing stones and carvings.', lat: 56.1330, lng: -5.4870, image: 'kilmartin-glen' }
    ]
  },
  {
    n: 4,
    date: '11 Aug 2026',
    weekday: 'Tue',
    title: 'Ardfern to Oban, Glencoe & Fort William',
    drive: '~4 hrs',
    distance: '~115 mi',
    overnight: 'Fort William or Glen Nevis',
    plan: [
      'Oban harbour & seafood.',
      'Castle Stalker viewpoint.',
      'Glencoe — the Three Sisters.'
    ],
    goodToKnow: 'Glencoe is a place to slow down — safe pull-ins only.',
    hero: 'glencoe',
    pois: [
      { name: 'Oban', blurb: 'The “seafood capital of Scotland” and gateway to the isles.', lat: 56.4150, lng: -5.4720, image: 'oban' },
      { name: 'Castle Stalker', blurb: 'A picture-perfect tower house on a tiny tidal islet in Loch Laich.', lat: 56.5720, lng: -5.3970, image: 'castle-stalker' },
      { name: 'Glencoe (Three Sisters)', blurb: 'Scotland’s most dramatic glen — three great ridges plunging to the road.', lat: 56.6710, lng: -4.9970, image: 'glencoe' }
    ]
  },
  {
    n: 5,
    date: '12 Aug 2026',
    weekday: 'Wed',
    title: 'Fort William to Glenfinnan, Eilean Donan & Applecross',
    drive: '~5–6 hrs',
    distance: '~150 mi',
    overnight: 'Applecross Campsite',
    plan: [
      'Glenfinnan Viaduct early.',
      'Eilean Donan Castle.',
      'Safer coastal route to Applecross if the van is large.'
    ],
    goodToKnow: 'Don’t attempt Bealach na Bà in a large motorhome — use the A832 coast road instead.',
    hero: 'glenfinnan-viaduct',
    pois: [
      { name: 'Glenfinnan Viaduct', blurb: 'The great curved railway viaduct made famous by the Hogwarts Express.', lat: 56.8720, lng: -5.4330, image: 'glenfinnan-viaduct' },
      { name: 'Eilean Donan Castle', blurb: 'Scotland’s most photographed castle, on its own island where three lochs meet.', lat: 57.2740, lng: -5.5160, image: 'eilean-donan' },
      { name: 'Applecross', blurb: 'A remote, whitewashed coastal village looking across to Skye.', lat: 57.4320, lng: -5.8130, image: 'applecross' }
    ]
  },
  {
    n: 6,
    date: '13 Aug 2026',
    weekday: 'Thu',
    title: 'Applecross to Torridon & Gairloch',
    drive: '~3–4 hrs',
    distance: '~70 mi',
    overnight: 'Sands Caravan & Camping Park / Gairloch',
    plan: [
      'Applecross Bay & Inn.',
      'Shieldaig & Torridon scenery.',
      'Gairloch beach evening.'
    ],
    goodToKnow: 'One of the most scenic days of the whole trip — take your time.',
    hero: 'torridon',
    pois: [
      { name: 'Applecross Bay', blurb: 'A sweep of pink sand and a legendary waterside inn.', lat: 57.4330, lng: -5.8160, image: 'applecross-bay' },
      { name: 'Torridon', blurb: 'Ancient, sculpted mountains rising straight from the sea loch.', lat: 57.5470, lng: -5.5090, image: 'torridon' },
      { name: 'Gairloch beach', blurb: 'Golden sands with sunsets over the Minch and, often, dolphins.', lat: 57.7300, lng: -5.6900, image: 'gairloch-beach' }
    ]
  },
  {
    n: 7,
    date: '14 Aug 2026',
    weekday: 'Fri',
    title: 'Gairloch to Ullapool',
    drive: '~2–3 hrs',
    distance: '~55 mi',
    overnight: 'Broomfield Park, Ullapool',
    plan: [
      'Inverewe Garden.',
      'Corrieshalloch Gorge & Falls of Measach.',
      'Ullapool harbour seafood.'
    ],
    goodToKnow: 'Last proper town for a while — stock up, fuel up, fill water.',
    hero: 'corrieshalloch-gorge',
    pois: [
      { name: 'Inverewe Garden', blurb: 'A lush subtropical garden thriving on the Gulf Stream at this latitude.', lat: 57.7760, lng: -5.5980, image: 'inverewe-garden' },
      { name: 'Corrieshalloch Gorge', blurb: 'A mile-long box canyon with a swaying suspension bridge over the Falls of Measach.', lat: 57.7570, lng: -5.0010, image: 'corrieshalloch-gorge' },
      { name: 'Ullapool', blurb: 'A pretty white-washed fishing port on Loch Broom.', lat: 57.8960, lng: -5.1590, image: 'ullapool' }
    ]
  },
  {
    n: 8,
    date: '15 Aug 2026',
    weekday: 'Sat',
    title: 'Ullapool, Ardvreck Castle & Kylesku',
    drive: '~3–4 hrs',
    distance: '~55 mi',
    overnight: 'Kylesku or Scourie',
    plan: [
      'Knockan Crag.',
      'Ardvreck Castle on Loch Assynt.',
      'Kylesku Bridge.'
    ],
    goodToKnow: 'In a large van take the A837/A894 — not the narrow B869 Drumbeg road.',
    hero: 'ardvreck-castle',
    pois: [
      { name: 'Knockan Crag', blurb: 'The birthplace of modern geology, with a walk-through interpretive trail.', lat: 58.0300, lng: -5.0800, image: 'knockan-crag' },
      { name: 'Ardvreck Castle', blurb: 'A romantic ruined tower on a spit into Loch Assynt beneath Quinag.', lat: 58.1690, lng: -4.9970, image: 'ardvreck-castle' },
      { name: 'Kylesku Bridge', blurb: 'An elegant curving bridge sweeping across a Highland sea loch.', lat: 58.2570, lng: -5.0240, image: 'kylesku-bridge' }
    ]
  },
  {
    n: 9,
    date: '16 Aug 2026',
    weekday: 'Sun',
    title: 'Kylesku to Durness & Smoo Cave',
    drive: '~2 hrs',
    distance: '~40 mi',
    overnight: 'Sango Sands, Durness',
    plan: [
      'Scourie & the Sandwood Bay turn.',
      'Smoo Cave.',
      'Balnakeil Beach & craft village (Cocoa Mountain).'
    ],
    goodToKnow: 'Sango Sands sits above the beach — grab a sea-view pitch.',
    hero: 'smoo-cave',
    pois: [
      { name: 'Smoo Cave', blurb: 'A vast sea-and-freshwater cave with a thundering inner waterfall.', lat: 58.5620, lng: -4.7200, image: 'smoo-cave' },
      { name: 'Balnakeil Beach', blurb: 'A dazzling arc of white sand and dunes beside a craft village.', lat: 58.5780, lng: -4.7620, image: 'balnakeil-beach' },
      { name: 'Sandwood Bay', blurb: 'A remote, wild beach with a sea-stack — reached only on foot.', lat: 58.5350, lng: -5.0700, image: 'sandwood-bay' }
    ]
  },
  {
    n: 10,
    date: '17 Aug 2026',
    weekday: 'Mon',
    title: 'Durness to Tongue & Thurso',
    drive: '~2.5–3 hrs',
    distance: '~75 mi',
    overnight: 'Dunnet Bay or Thurso',
    plan: [
      'Loch Eriboll.',
      'Kyle of Tongue causeway.',
      'Bettyhill, then the Dunnet Head detour.'
    ],
    goodToKnow: 'Dunnet Head — not John o’ Groats — is the true northernmost point of mainland Britain.',
    hero: 'dunnet-head',
    pois: [
      { name: 'Loch Eriboll', blurb: 'A deep, dramatic sea loch once used to shelter the wartime fleet.', lat: 58.4900, lng: -4.7000, image: 'loch-eriboll' },
      { name: 'Kyle of Tongue', blurb: 'A shallow, sandy sea loch crossed by a low causeway under Ben Loyal.', lat: 58.5000, lng: -4.4100, image: 'kyle-of-tongue' },
      { name: 'Dunnet Head', blurb: 'Red cliffs, a lighthouse and the true tip of mainland Britain.', lat: 58.6710, lng: -3.3760, image: 'dunnet-head' }
    ]
  },
  {
    n: 11,
    date: '18 Aug 2026',
    weekday: 'Tue',
    title: 'Duncansby, John o’ Groats & Wick',
    drive: 'Short day',
    distance: '~40 mi',
    overnight: 'Wick / John o’ Groats',
    plan: [
      'Walk to the Duncansby Stacks.',
      'John o’ Groats signpost.',
      'On to Wick.'
    ],
    goodToKnow: 'The Stacks beat the signpost — a short easy walk from the lighthouse car park.',
    hero: 'duncansby-stacks',
    pois: [
      { name: 'Duncansby Stacks', blurb: 'Towering sea-stacks and geos at the far north-east corner of Scotland.', lat: 58.6440, lng: -3.0330, image: 'duncansby-stacks' },
      { name: 'John o’ Groats', blurb: 'The famous signpost marking the end of the mainland road.', lat: 58.6440, lng: -3.0700, image: 'john-o-groats' }
    ]
  },
  {
    n: 12,
    date: '19 Aug 2026',
    weekday: 'Wed',
    title: 'Wick to Dunrobin Castle & Dornoch',
    drive: '~2.5 hrs',
    distance: '~55 mi',
    overnight: 'Dornoch or Tain',
    plan: [
      'Whaligoe Steps.',
      'Dunrobin Castle (falconry).',
      'Dornoch cathedral town.'
    ],
    goodToKnow: 'Check Dunrobin’s falconry display times before you arrive.',
    hero: 'dunrobin-castle',
    pois: [
      { name: 'Whaligoe Steps', blurb: '365 stone steps zig-zagging down cliffs to a hidden fishing haven.', lat: 58.3480, lng: -3.1750, image: 'whaligoe-steps' },
      { name: 'Dunrobin Castle', blurb: 'A fairy-tale château of turrets, formal gardens and daily falconry.', lat: 57.9820, lng: -3.9460, image: 'dunrobin-castle' },
      { name: 'Dornoch', blurb: 'A genteel cathedral town with a famous links golf course and beach.', lat: 57.8800, lng: -4.0280, image: 'dornoch' }
    ]
  },
  {
    n: 13,
    date: '20 Aug 2026',
    weekday: 'Thu',
    title: 'Dornoch to Inverness & Loch Ness',
    drive: '~2.5–3 hrs',
    distance: '~70 mi',
    overnight: 'Fort Augustus',
    plan: [
      'Culloden Battlefield.',
      'Inverness restock.',
      'Loch Ness & Urquhart Castle.',
      'Fort Augustus canal locks.'
    ],
    goodToKnow: 'The Bronze Age Clava Cairns are 5 minutes from Culloden — worth the short detour.',
    hero: 'urquhart-castle',
    pois: [
      { name: 'Culloden Battlefield', blurb: 'The moor where the 1746 Jacobite rising met its end — moving and quiet.', lat: 57.4780, lng: -4.0940, image: 'culloden' },
      { name: 'Clava Cairns', blurb: 'A 4,000-year-old ring of burial cairns and standing stones in a wooded glade.', lat: 57.4730, lng: -4.0740, image: 'clava-cairns' },
      { name: 'Urquhart Castle', blurb: 'Ruined lochside stronghold with the classic view down Loch Ness.', lat: 57.3240, lng: -4.4420, image: 'urquhart-castle' },
      { name: 'Fort Augustus locks', blurb: 'A staircase of Caledonian Canal locks stepping down into Loch Ness.', lat: 57.1440, lng: -4.6810, image: 'fort-augustus' }
    ]
  },
  {
    n: 14,
    date: '21 Aug 2026',
    weekday: 'Fri',
    title: 'Fort Augustus to the Cairngorms',
    drive: '~2 hrs',
    distance: '~60 mi',
    overnight: 'Aviemore / Coylumbridge',
    plan: [
      'Into the Cairngorms National Park.',
      'Strathspey steam railway or Rothiemurchus forest.',
      'Ospreys at Loch Garten.'
    ],
    goodToKnow: 'Gentle and green after the wild north — slow right down and breathe it in.',
    hero: 'rothiemurchus',
    pois: [
      { name: 'Aviemore', blurb: 'The lively heart of the Cairngorms — outdoors town and steam railway.', lat: 57.1950, lng: -3.8290, image: 'aviemore' },
      { name: 'Rothiemurchus', blurb: 'Ancient Caledonian pine forest, lochs and easy walking trails.', lat: 57.1600, lng: -3.8000, image: 'rothiemurchus' },
      { name: 'Loch Garten', blurb: 'A pinewood osprey reserve beside a tranquil loch.', lat: 57.2500, lng: -3.7130, image: 'loch-garten' }
    ]
  },
  {
    n: 15,
    date: '22 Aug 2026',
    weekday: 'Sat',
    title: 'Aviemore to Pitlochry',
    drive: '~1.5–2 hrs',
    distance: '~50 mi',
    overnight: 'Pitlochry / Blair Atholl',
    plan: [
      'Dalwhinnie distillery.',
      'Blair Atholl / House of Bruar.',
      'Pitlochry dam & fish ladder.'
    ],
    goodToKnow: 'The perfect wind-down town — last good dinner and a dram.',
    hero: 'pitlochry-dam',
    pois: [
      { name: 'Dalwhinnie Distillery', blurb: 'The Highlands’ highest distillery, gentle and heathery.', lat: 56.9350, lng: -4.2450, image: 'dalwhinnie' },
      { name: 'Blair Castle', blurb: 'A dazzling white castle with formal gardens and Scotland’s last private army.', lat: 56.7690, lng: -3.8480, image: 'blair-castle' },
      { name: 'Pitlochry Dam', blurb: 'A hydro dam with a salmon ladder and a smart visitor centre.', lat: 56.7020, lng: -3.7350, image: 'pitlochry-dam' }
    ]
  },
  {
    n: 16,
    date: '23 Aug 2026',
    weekday: 'Sun',
    title: 'Pitlochry to home (Burbage)',
    drive: 'Long day',
    distance: '~350 mi',
    overnight: 'Home — end of trip',
    plan: [
      'A9 / M74 south, steadily.',
      'Tebay or Southwaite comfort stop.',
      'Home by evening.'
    ],
    goodToKnow: 'Longest single drive — swap over, break often, don’t push tired.',
    hero: 'tebay-services',
    pois: [
      { name: 'Tebay Services', blurb: 'One last farm-shop stop on the M6 to break the journey home.', lat: 54.4419, lng: -2.6060, image: 'tebay-services' }
    ]
  }
]

export const TRIP = {
  title: 'Highlands Adventure',
  subtitle: 'A Scottish Highlands motorhome tour',
  who: 'Phil & Tracey',
  tagline: 'Slow roads. Big views. Good food. Great whisky. Unforgettable memories.',
  startDate: '2026-08-08',
  endDate: '2026-08-23',
  totalDays: 16
}
