// The Relaxed Loop — 9 bases over 16 days (8–23 Aug 2026). Drive to a base,
// stay put, explore from it. Each base lists its accommodation (with tap-to-call
// + costs), the drive in, and the POIs to explore (slugs → src/data/pois.js).

export const TRIP = {
  title: 'Highlands Adventure',
  subtitle: 'The Relaxed Loop',
  who: 'Phil & Tracey',
  tagline: 'Drive less. Stay longer. See more.',
  startDate: '2026-08-08',
  endDate: '2026-08-23',
  totalDays: 16
}

/**
 * @typedef {{ name:string, kind:string, phone?:string, tel?:string, postcode?:string,
 *   nights:number, cost?:number, estimate?:boolean, url?:string, note?:string,
 *   lat?:number, lng?:number }} Stay
 * @typedef {{ id:number, name:string, region:string, start:string, nights:number,
 *   dateLabel:string, from:string, miles:string, drive:string, via?:string,
 *   stays:Stay[], explore:string[], goodToKnow:string, hero:string,
 *   lat:number, lng:number }} Base
 */

/** @type {Base[]} */
export const bases = [
  {
    id: 1, name: 'Keswick', region: 'Lake District',
    start: '2026-08-08', nights: 1, dateLabel: 'Sat 8 Aug',
    from: 'Burbage', miles: '~185', drive: '~4 h', via: 'Tebay Services',
    lat: 54.5931, lng: -3.1132,
    stays: [
      { name: 'Castlerigg Hall', kind: 'Campsite', phone: '017687 74499', tel: '01768774499', postcode: 'CA12 4TE', nights: 1, cost: 42, lat: 54.5931, lng: -3.1132 }
    ],
    explore: ['derwentwater', 'castlerigg'],
    goodToKnow: 'Just a staging night — break the long haul north and start fresh.',
    hero: 'derwentwater'
  },
  {
    id: 2, name: 'Ardfern', region: 'Argyll',
    start: '2026-08-09', nights: 2, dateLabel: 'Sun 9 – Mon 10 Aug',
    from: 'Keswick', miles: '~250', drive: '~6 h', via: 'the big drive of the trip',
    lat: 56.1740, lng: -5.5480,
    stays: [
      { name: 'The Galley of Lorne', kind: 'Hotel · Sun 9', phone: '01852 500284', tel: '01852500284', postcode: 'PA31 8QN', nights: 1, cost: null, estimate: true, note: 'Our hotel night after the big drive — confirm the room rate when booking.', lat: 56.1840, lng: -5.5360 },
      { name: 'Ardfern Motorhome Park', kind: 'Van · Mon 10', postcode: 'PA31 8QN', nights: 1, cost: 22, note: 'Lochside, motorhome-only — enquire to book.', url: 'https://ardfernmotorhomepark.com', lat: 56.1740, lng: -5.5480 }
    ],
    explore: ['loch-craignish', 'ardfern-marina', 'galley-of-lorne', 'oban', 'kilmartin-glen', 'crinan-canal'],
    goodToKnow: 'After that long drive, a proper bed at the Galley of Lorne on night one — then a full day exploring before the van pitch on night two.',
    hero: 'loch-craignish'
  },
  {
    id: 3, name: 'Fort William', region: 'Lochaber',
    start: '2026-08-11', nights: 2, dateLabel: 'Tue 11 – Wed 12 Aug',
    from: 'Ardfern', miles: '~110', drive: '~2.5 h', via: 'Oban & Castle Stalker',
    lat: 56.8056, lng: -5.0739,
    stays: [
      { name: 'Glen Nevis C&C Park', kind: 'Campsite', phone: '01397 702191', tel: '01397702191', postcode: 'PH33 6SX', nights: 2, cost: 72, note: 'Under Ben Nevis, restaurant on site.', lat: 56.8056, lng: -5.0739 }
    ],
    explore: ['castle-stalker', 'glencoe', 'glenfinnan-viaduct', 'steall-falls', 'mallaig'],
    goodToKnow: 'A brilliant base — half of the west Highlands’ greatest hits are a short hop away.',
    hero: 'glencoe'
  },
  {
    id: 4, name: 'Gairloch', region: 'Wester Ross',
    start: '2026-08-13', nights: 2, dateLabel: 'Thu 13 – Fri 14 Aug',
    from: 'Fort William', miles: '~150', drive: '~3.5 h', via: 'Eilean Donan & Torridon',
    lat: 57.7406, lng: -5.7650,
    stays: [
      { name: 'Sands Caravan & Camping', kind: 'Campsite', phone: '01445 712152', tel: '01445712152', postcode: 'IV21 2DL', nights: 2, cost: 62, note: 'Big beachfront site, sea-view pitches.', lat: 57.7406, lng: -5.7650 }
    ],
    explore: ['eilean-donan', 'torridon', 'applecross-bay', 'inverewe-garden', 'gairloch-beach'],
    goodToKnow: 'Break the drive here with Eilean Donan Castle — it’s right on the way. Skip Bealach na Bà in a big van; take the coast road.',
    hero: 'torridon'
  },
  {
    id: 5, name: 'Ullapool', region: 'Assynt',
    start: '2026-08-15', nights: 2, dateLabel: 'Sat 15 – Sun 16 Aug',
    from: 'Gairloch', miles: '~55', drive: '~1.5 h', via: 'Corrieshalloch Gorge',
    lat: 57.8943, lng: -5.1647,
    stays: [
      { name: 'Broomfield Holiday Park', kind: 'Campsite', phone: '01854 612020', tel: '01854612020', postcode: 'IV26 2UT', nights: 2, cost: 60, note: 'On the seafront, walk to the harbour.', lat: 57.8943, lng: -5.1647 }
    ],
    explore: ['corrieshalloch-gorge', 'ullapool', 'ardvreck-castle', 'knockan-crag', 'stac-pollaidh', 'achmelvich', 'kylesku-bridge'],
    goodToKnow: 'Short drive in — so you’ve almost two full days for the Assynt loop. Last big town for a while: fuel, water, stock up.',
    hero: 'ardvreck-castle'
  },
  {
    id: 6, name: 'Durness', region: 'Cape Wrath corner',
    start: '2026-08-17', nights: 1, dateLabel: 'Mon 17 Aug',
    from: 'Ullapool', miles: '~70', drive: '~2 h', via: 'Kylesku & Scourie',
    lat: 58.5687, lng: -4.7431,
    stays: [
      { name: 'Sango Sands Oasis', kind: 'Campsite', postcode: 'IV27 4PZ', nights: 1, cost: 29, note: 'Above the beach — book online / by email.', lat: 58.5687, lng: -4.7431 }
    ],
    explore: ['smoo-cave', 'balnakeil-beach', 'sandwood-bay', 'cape-wrath'],
    goodToKnow: 'A single night here is plenty — it’s a scenic pause on the way across the top.',
    hero: 'smoo-cave'
  },
  {
    id: 7, name: 'Thurso & Dunnet', region: 'North coast',
    start: '2026-08-18', nights: 2, dateLabel: 'Tue 18 – Wed 19 Aug',
    from: 'Durness', miles: '~75', drive: '~2 h', via: 'the Kyle of Tongue',
    lat: 58.6155, lng: -3.3455,
    stays: [
      { name: 'Dunnet Bay Club Site', kind: 'Campsite', phone: '01847 821319', tel: '01847821319', postcode: 'KW14 8XD', nights: 2, cost: 68, note: 'Behind Dunnet beach. Alt: Thurso Bay.', lat: 58.6155, lng: -3.3455 }
    ],
    explore: ['kyle-of-tongue', 'loch-eriboll', 'duncansby-stacks', 'john-o-groats', 'dunnet-head', 'castle-of-mey'],
    goodToKnow: 'Two nights here turns “the top corner” into a proper stop, not a dash. Dunnet Head — not John o’ Groats — is the true north.',
    hero: 'dunnet-head'
  },
  {
    id: 8, name: 'Dornoch', region: 'East coast',
    start: '2026-08-20', nights: 1, dateLabel: 'Thu 20 Aug',
    from: 'Thurso', miles: '~80', drive: '~2 h', via: 'Whaligoe Steps & Dunrobin',
    lat: 57.8762, lng: -4.0209,
    stays: [
      { name: 'Dornoch C&C Park', kind: 'Campsite', phone: '01862 810423', tel: '01862810423', postcode: 'IV25 3LX', nights: 1, cost: 33, note: 'By the beach & cathedral. Alt: Grannie’s Heilan’ Hame.', lat: 57.8762, lng: -4.0209 }
    ],
    explore: ['whaligoe-steps', 'dunrobin-castle', 'dornoch'],
    goodToKnow: 'An easy, pretty night to break the run south down the east coast. Check Dunrobin’s falconry times.',
    hero: 'dunrobin-castle'
  },
  {
    id: 9, name: 'Aviemore', region: 'Cairngorms',
    start: '2026-08-21', nights: 2, dateLabel: 'Fri 21 – Sat 22 Aug',
    from: 'Dornoch', miles: '~75', drive: '~1.5 h', via: 'the A9',
    lat: 57.1743, lng: -3.7957,
    stays: [
      { name: 'Rothiemurchus Camp & Caravan', kind: 'Campsite', phone: '01479 812800', tel: '01479812800', postcode: 'PH22 1QU', nights: 2, cost: 58, note: 'In the pines. Alt: Glenmore, Loch Morlich.', lat: 57.1743, lng: -3.7957 }
    ],
    explore: ['rothiemurchus', 'loch-morlich', 'loch-garten', 'aviemore', 'culloden', 'clava-cairns', 'urquhart-castle', 'fort-augustus', 'dalwhinnie'],
    goodToKnow: 'Loch Ness & Culloden are an easy day loop from here — no need for a separate night.',
    hero: 'rothiemurchus'
  },
  {
    id: 10, name: 'Home', region: 'The drive back',
    start: '2026-08-23', nights: 0, dateLabel: 'Sun 23 Aug',
    from: 'Aviemore', miles: '~380', drive: '~7 h', via: 'A9 / M74',
    lat: 52.5356, lng: -1.3521,
    stays: [],
    explore: ['pitlochry-dam', 'blair-castle', 'tebay-services'],
    goodToKnow: 'Long one — swap driving, break often. Prefer to split it? Add a night at Pitlochry (Faskally, ~£36) for a gentle ~2.5 h home the next day.',
    hero: 'pitlochry-dam'
  }
]

// Driving legs for the mileage table (numbers only; parsed for totals).
export const legs = [
  { n: 1, route: 'Burbage → Keswick', miles: 185, drive: '~4 h', nights: 1 },
  { n: 2, route: 'Keswick → Ardfern', miles: 250, drive: '~6 h', nights: 2 },
  { n: 3, route: 'Ardfern → Fort William', miles: 110, drive: '~2.5 h', nights: 2 },
  { n: 4, route: 'Fort William → Gairloch', miles: 150, drive: '~3.5 h', nights: 2 },
  { n: 5, route: 'Gairloch → Ullapool', miles: 55, drive: '~1.5 h', nights: 2 },
  { n: 6, route: 'Ullapool → Durness', miles: 70, drive: '~2 h', nights: 1 },
  { n: 7, route: 'Durness → Thurso', miles: 75, drive: '~2 h', nights: 2 },
  { n: 8, route: 'Thurso → Dornoch', miles: 80, drive: '~2 h', nights: 1 },
  { n: 9, route: 'Dornoch → Aviemore', miles: 75, drive: '~1.5 h', nights: 2 },
  { n: 10, route: 'Aviemore → home', miles: 380, drive: '~7 h', nights: 0 }
]

export const twoNightBases = bases.filter((b) => b.nights === 2).length
