// Solano Nights — tuning constants for the whole game. One place to balance
// the city, the cars, the police and the missions from.
export const CITY = {
  blocks: 7, // blocks per side
  block: 52, // block pitch (road centre to road centre)
  road: 14, // road width
  sidewalk: 4, // sidewalk width inside each block edge
};

export const WORLD = {
  // City spans -(blocks/2*block) .. +(blocks/2*block); the sea lies beyond +z.
  half: (CITY.blocks * CITY.block) / 2, // 182
  seaZ: 196, // shoreline
  startTime: 16.6, // 16:36, golden late-afternoon sun
  dayLength: 480, // seconds of play per in-game hour
};

export const PLAYER = {
  walkSpeed: 7.5,
  runSpeed: 11.5,
  radius: 0.55,
  maxHealth: 100,
  startCash: 250,
  startAmmo: 24,
  fistRange: 2.2,
  fistDamage: 12,
  pistolRange: 60,
  pistolDamage: 34,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 9,
  turnRate: 1.9,
  drag: 0.6,
  length: 4.4,
  width: 2.0,
};

export const TRAFFIC = { cars: 14, peds: 22, maxSpeed: 11 };

export const POLICE = {
  maxCars: 6, // hard cap on active pursuit cars
  spawnDist: 55,
  ramSpeed: 30,
  bustDist: 2.0,
  bustTime: 1.6, // seconds a cop must stay close to arrest you on foot
  decayDelay: 14, // seconds of no new crime before stars start falling
  decayEvery: 9, // seconds per star lost while laying low
};

export const MISSIONS = [
  {
    id: 'fare',
    title: 'First Fare',
    giver: 'IVO KADE',
    brief: 'A package waits at the marina. Pick it up on foot and bring it back to the garage.',
    lines: [
      'IVO: Mara. You need work, I need a courier. No questions, no cops.',
      'MARA: One fare. Then we talk about the rate.',
      'IVO: Package is at the marina, yellow marker. Walk it back here.',
    ],
    reward: 300,
  },
  {
    id: 'wheels',
    title: 'Hot Wheels',
    giver: 'IVO KADE',
    brief: 'A client wants the blue coupe parked by the plaza. Take it — press E — and deliver it to the garage.',
    lines: [
      'IVO: That blue coupe by the plaza? It has a new owner. You.',
      'MARA: Stealing cars now? That was not in the brochure.',
      'IVO: Walk up, press E, drive it to the garage. The cops will not like it.',
    ],
    reward: 500,
  },
  {
    id: 'breakers',
    title: 'Breaker Trouble',
    giver: 'IVO KADE',
    brief: 'Three Breakers are leaning on the plaza. Send them a message — fists or pistol, your call.',
    lines: [
      'IVO: The Breakers think the plaza is theirs. Remind them it is not.',
      'MARA: Three of them. Fine. I was getting bored.',
      'IVO: Make it loud. The whole city should hear it.',
    ],
    reward: 650,
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    giver: 'IVO KADE',
    brief: 'The heat is on — 2 stars and climbing. Lose the cops: break line of sight and lay low until the stars fade.',
    lines: [
      'IVO: You made the evening news, Mara. Lose them.',
      'MARA: I just need a quiet corner and a little patience.',
      'IVO: Stay out of sight. The stars fade when the city forgets.',
    ],
    reward: 400,
  },
  {
    id: 'score',
    title: 'The Big Score',
    giver: 'IVO KADE',
    brief: 'Grab the cash from the bank vault, then escape to the safehouse with the whole city on your tail.',
    lines: [
      'IVO: One last job. The bank on Meridian Row. In and out.',
      'MARA: And when the sirens come?',
      'IVO: Then you drive like the city owes you money. Because it does.',
    ],
    reward: 2000,
  },
];

export const PLACES = {
  garage: { x: -52, z: -52, label: 'Kade Garage' },
  marina: { x: 104, z: 156, label: 'Marina' },
  plaza: { x: 0, z: 0, label: 'Solano Plaza' },
  bank: { x: 104, z: -104, label: 'Meridian Bank' },
  safehouse: { x: -104, z: 104, label: 'Safehouse' },
  hospital: { x: -104, z: 156, label: 'Clinic' },
};

export const SAVE_KEY = 'solano-nights-save-v1';
