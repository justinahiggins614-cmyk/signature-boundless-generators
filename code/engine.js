/* =====================================================================
   THE SIGNATURE BOUNDLESS GENERATOR ARCHIVE — deterministic engine
   Runs in node (seeding/drips) and in the browser (interactive + ?gen=).
   Same (family, seed, params) -> same fully-solved output, forever.
   ===================================================================== */
(function (root) {
"use strict";

/* ---------- seeded RNG (mulberry32 + string hash) ---------- */
function hashStr(s) {
  var h = 1779033703 ^ String(s).length;
  for (var i = 0; i < String(s).length; i++) {
    h = Math.imul(h ^ String(s).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function RNG(seed) {
  var next = mulberry32(typeof seed === "number" ? seed : hashStr(seed));
  return {
    next: next,
    int: function (min, max) { return min + Math.floor(next() * (max - min + 1)); },
    float: function (min, max, dp) {
      var v = min + next() * (max - min);
      return dp == null ? v : Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp);
    },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    chance: function (p) { return next() < p; },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };
}

/* ---------- formatting ---------- */
function art(w){return /^[aeiou]/i.test(w||"")?"an":"a";}
function fmt(n, dp) {
  if (dp == null) dp = 1;
  var p = Math.pow(10, dp);
  var v = Math.round(n * p) / p;
  return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function D(label, value, unit) { return { label: label, value: value, unit: unit }; }
function M(part, material, finish) { return { part: part, material: material, finish: finish || "" }; }
function C(name, hex, area) { return { name: name, hex: hex, area: area }; }
function CP(part, chip, detail) { return { part: part, chip: chip, detail: detail }; }
function S(label, value, unit) { return { label: label, value: value, unit: unit }; }

/* ---------- shared pools (all original, trademark-safe) ---------- */
var NAME_PRE = ["Vel", "Nov", "Lum", "Aer", "Quant", "Zeph", "Oro", "Iri", "Nyx", "Sol", "Brev", "Cind", "Drav", "Elt", "Fenn", "Grav", "Halv", "Ist", "Jov", "Kest"];
var NAME_SUF = ["trix", "core", "forge", "wing", "craft", "line", "works", "dyne", "matic", "spire", "fold", "haven", "mark", "prime", "star", "veil"];
function brandName(rng, tail) {
  return rng.pick(NAME_PRE) + rng.pick(["a", "o", "e", "i"]) + rng.pick(NAME_SUF) + (tail ? " " + tail : "");
}
var COLORS = [
  ["Signature Midnight", "#0a0f1e"], ["Signature Gold", "#c9a227"], ["Arctic White", "#f2f5fa"],
  ["Ember Red", "#c0392b"], ["Ocean Teal", "#0e7c86"], ["Forest Moss", "#3d6b35"],
  ["Solar Amber", "#e8a020"], ["Violet Dusk", "#5b3a8e"], ["Steel Graphite", "#3a4149"],
  ["Coral Dawn", "#e2705a"], ["Mint Frost", "#9fd8c9"], ["Cobalt Pulse", "#1f4fd8"],
  ["Sandstone", "#cbb489"], ["Cherry Noir", "#5c1a24"], ["Glacier Blue", "#a9cdea"]
];
function colorSet(rng, areas, n) {
  n = n || Math.min(areas.length, 3);
  var cols = rng.shuffle(COLORS).slice(0, n);
  return areas.slice(0, n).map(function (a, i) { return C(cols[i][0], cols[i][1], a); });
}
var METALS = ["aerospace aluminum 6061-T6", "carbon-fiber composite", "titanium Ti-6Al-4V", "stainless steel 316L", "magnesium alloy AZ31B", "brass C36000"];
var PLASTICS = ["ABS", "polycarbonate", "nylon PA12", "PETG", "glass-filled nylon", "ASA"];
var WOODS = ["hard maple", "white oak", "walnut", "bamboo laminate", "birch plywood"];
var FABRICS = ["organic cotton canvas", "recycled polyester twill", "merino wool blend", "hemp canvas", "ripstop nylon"];
var FINISHES = ["matte", "satin", "brushed", "polished", "powder-coated", "anodized"];
function chip(rng, domain) {
  return "SIG-" + domain + "-" + rng.int(1000, 9999);
}

/* ---------- family registry ---------- */
var FAMILIES = [];
function fam(def) { FAMILIES.push(def); return def; }
function byKey(key) {
  for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].key === key) return FAMILIES[i];
  return null;
}
/* resolve params: overrides win, else draw from rng */
function resolveParams(def, rng, overrides) {
  var out = {};
  (def.params || []).forEach(function (p) {
    if (overrides && overrides[p.id] !== undefined && overrides[p.id] !== "") { out[p.id] = overrides[p.id]; return; }
    if (p.type === "choice") out[p.id] = rng.pick(p.options);
    else out[p.id] = rng.int(p.min, p.max);
  });
  return out;
}
function paramDefs(def) { return def.params || []; }

/* ================= FAMILY SOLVERS (1-10) ================= */

fam({
  key: "jet", name: "Signature Jet Generator", icon: "✈️",
  blurb: "Complete Signature-line jet aircraft concepts — airframe, powerplant, avionics, all the way down to fasteners and paint.",
  params: [
    { id: "cls", label: "Class", type: "choice", options: ["Light trainer", "Business jet", "Regional airliner"] },
    { id: "range_nm", label: "Range (nautical miles)", type: "range", min: 800, max: 4200, step: 100 },
    { id: "seats", label: "Seats", type: "range", min: 2, max: 90, step: 1 }
  ],
  solve: function (rng, P) {
    var cls = P.cls, seats = Math.min(P.seats, cls === "Light trainer" ? 4 : cls === "Business jet" ? 14 : 90);
    var mtow = cls === "Light trainer" ? rng.float(2.8, 4.2, 1) * 1000
      : cls === "Business jet" ? rng.float(14, 24, 1) * 1000 : rng.float(38, 52, 1) * 1000;
    var wingLoad = rng.float(280, 420, 0);            // kg per m^2
    var wingArea = mtow / wingLoad;
    var aspect = rng.float(7.5, 9.5, 1);
    var span = Math.sqrt(wingArea * aspect);
    var length = span * rng.float(0.82, 0.95, 2);
    var thrust = mtow * rng.float(0.28, 0.36, 2) / 1000; // kN per engine
    var engines = cls === "Regional airliner" ? 2 : rng.pick([1, 2]);
    var cruise = rng.float(0.62, 0.82, 2);
    var name = brandName(rng, "J-" + rng.int(3, 99));
    return {
      name: name, tagline: cls + " · " + fmt(P.range_nm, 0) + " nm range · " + seats + " seats",
      idea: "The " + name + " is a Signature-line " + cls.toLowerCase() + " drawn for " + fmt(P.range_nm, 0) +
        " nautical miles of nonstop range with " + seats + " seats. A " + rng.pick(["low", "mid", "high"]) +
        "-wing " + rng.pick(["T-tail", "conventional tail", "V-tail"]) + " layout keeps the structure light while the " +
        engines + " turbofan" + (engines > 1 ? "s" : "") + " deliver " + fmt(thrust, 1) + " kN each at Mach " + fmt(cruise, 2) + " cruise.",
      dimensions: [D("Length", fmt(length, 1), "m"), D("Wingspan", fmt(span, 1), "m"), D("Height", fmt(length * 0.28, 1), "m"), D("Cabin width", fmt(cls === "Regional airliner" ? 2.9 : 1.9, 1), "m")],
      materials: [M("Fuselage", rng.pick(METALS), rng.pick(FINISHES)), M("Wing skins", "carbon-fiber composite", "matte"), M("Interior panels", rng.pick(PLASTICS), "satin"), M("Fasteners", "titanium Ti-6Al-4V", "polished")],
      colors: colorSet(rng, ["fuselage", "wingtips", "tail", "engine nacelles"], 3),
      components: [CP("Flight controller", chip(rng, "FC"), "triple-redundant fly-by-wire"), CP("Engine FADEC", chip(rng, "EC"), "full-authority digital control"), CP("Weather radar", chip(rng, "WR"), fmt(rng.float(60, 90, 0), 0) + " cm dish"), CP("Landing gear", "n/a", "retractable tricycle, " + fmt(mtow * 0.045, 0) + " kg rated")],
      measurements: [S("Max takeoff weight", fmt(mtow, 0), "kg"), S("Wing area", fmt(wingArea, 1), "m²"), S("Thrust per engine", fmt(thrust, 1), "kN"), S("Cruise speed", "Mach " + fmt(cruise, 2), ""), S("Fuel capacity", fmt(mtow * rng.float(0.28, 0.34, 2), 0), "kg")],
      how_to_use: "Preflight: walk the " + fmt(span, 1) + " m wingspan for surface checks, verify " + fmt(mtow, 0) + " kg weight-and-balance, then fly the filed " + fmt(P.range_nm, 0) + " nm leg at Mach " + fmt(cruise, 2) + "."
    };
  }
});

var MED_NOTE = "Speculative Signature-line wellness concept ONLY — not medical advice, not a diagnosis or treatment, not a licensed professional, illustrative concept. Consult a qualified professional for any health decision.";
fam({
  key: "medical", name: "Signature Medical Concept Generator", icon: "✚",
  blurb: "Speculative Signature-line wellness device and formulation concepts. Concepts only — never medical advice.",
  safety: MED_NOTE,
  params: [
    { id: "focus", label: "Focus", type: "choice", options: ["Vital-signs monitoring", "Mobility support", "Sleep wellness", "Posture coaching"] },
    { id: "form", label: "Form", type: "choice", options: ["Wearable band", "Handheld unit", "Home station"] }
  ],
  solve: function (rng, P) {
    var dims = P.form === "Wearable band" ? [D("Band length", fmt(rng.float(18, 24, 1), 1), "cm"), D("Case width", fmt(rng.float(3.2, 4.4, 1), 1), "cm"), D("Thickness", fmt(rng.float(0.9, 1.4, 1), 1), "cm")]
      : P.form === "Handheld unit" ? [D("Height", fmt(rng.float(11, 15, 1), 1), "cm"), D("Width", fmt(rng.float(5.5, 7.5, 1), 1), "cm"), D("Depth", fmt(rng.float(1.8, 2.6, 1), 1), "cm")]
      : [D("Base diameter", fmt(rng.float(16, 24, 1), 1), "cm"), D("Height", fmt(rng.float(28, 42, 1), 1), "cm"), D("Weight", fmt(rng.float(1.2, 3.4, 1), 1), "kg")];
    var name = brandName(rng, rng.pick(["Vital", "Mend", "Rest", "Align"]) + "-" + rng.int(10, 99));
    var sensors = { "Vital-signs monitoring": ["optical heart-rate array", "skin-temperature probe", "SpO2 emitter pair"], "Mobility support": ["9-axis motion unit", "grip-pressure pads", "tilt alarm"], "Sleep wellness": ["actigraphy sensor", "ambient-light meter", "soft vibration motor"], "Posture coaching": ["spine-angle sensor", "haptic nudge motor", "desk-proximity beacon"] }[P.focus];
    return {
      name: name, tagline: P.focus + " · " + P.form + " · concept",
      idea: "The " + name + " is a speculative Signature-line " + P.form.toLowerCase() + " concept for " + P.focus.toLowerCase() +
        ". It pairs " + art(sensors[0]) + " " + sensors[0] + ", " + sensors[1] + ", and " + sensors[2] + " with gentle on-device coaching cues. " + MED_NOTE,
      dimensions: dims,
      materials: [M("Housing", rng.pick(PLASTICS), "satin"), M("Skin-contact face", "medical-grade silicone", "matte"), M("Strap", "woven nylon", "matte")],
      colors: colorSet(rng, ["housing", "strap", "accent ring"], 3),
      components: [CP("Sensor hub", chip(rng, "SH"), sensors.join("; ")), CP("Main MCU", chip(rng, "MC"), "low-power ARM core"), CP("Battery", "n/a", fmt(rng.float(400, 900, 0), 0) + " mAh, " + rng.int(3, 10) + "-day standby")],
      measurements: [S("Sensor sample rate", rng.int(25, 100), "Hz"), S("Wireless range", rng.int(8, 30), "m"), S("Water resistance", "IP" + rng.pick(["54", "67", "68"]), "")],
      how_to_use: "Charge fully, wear or place as directed in the concept guide, and review the coaching cues in the companion app. " + MED_NOTE,
      safety: MED_NOTE
    };
  }
});

fam({
  key: "food", name: "Signature Dish Generator", icon: "🍽️",
  blurb: "Complete Signature-line dishes — every ingredient weighed, every step timed, every temperature set.",
  params: [
    { id: "cuisine", label: "Cuisine", type: "choice", options: ["Mediterranean", "East Asian", "Latin", "Comfort", "Nordic"] },
    { id: "course", label: "Course", type: "choice", options: ["Starter", "Main", "Dessert"] },
    { id: "servings", label: "Servings", type: "range", min: 2, max: 8, step: 1 }
  ],
  solve: function (rng, P) {
    var sv = P.servings, per = function (g) { return Math.round(g * sv); };
    var mains = { "Mediterranean": ["chicken thigh", "white beans", "salmon fillet"], "East Asian": ["tofu steaks", "pork belly", "mushroom medley"], "Latin": ["black beans", "chicken breast", "sweet potato"], "Comfort": ["potato gratin", "meatloaf", "macaroni bake"], "Nordic": ["root vegetables", "gravlax-style trout", "barley risotto"] }[P.cuisine];
    var main = rng.pick(mains);
    var name = brandName(rng, P.cuisine.split(" ")[0] + " " + P.course);
    var ing = [
      S(main, per(rng.int(140, 200)), "g"), S(rng.pick(["olive oil", "sesame oil", "butter"]), per(rng.int(12, 20)), "g"),
      S(rng.pick(["garlic", "shallot", "ginger"]), per(rng.int(6, 12)), "g"), S("sea salt", (0.8 * sv).toFixed(1), "tsp"),
      S(rng.pick(["lemon", "lime", "rice vinegar"]), per(rng.int(10, 18)), "ml"), S(rng.pick(["fresh herbs", "scallions", "parsley"]), per(rng.int(8, 15)), "g")
    ];
    var temp = rng.int(175, 220), t1 = rng.int(8, 15), t2 = rng.int(18, 35);
    return {
      name: name, tagline: P.cuisine + " " + P.course.toLowerCase() + " · serves " + sv,
      idea: "The " + name + " is a Signature-line " + P.cuisine.toLowerCase() + " " + P.course.toLowerCase() +
        " built around " + main + ". Every quantity below is scaled for exactly " + sv + " servings — no guessing, no 'to taste' gaps in the core method.",
      dimensions: [D("Prep time", rng.int(10, 25), "min"), D("Cook time", t1 + t2, "min"), D("Rest time", rng.int(3, 10), "min")],
      materials: [M("Pan", "stainless steel 316L", "brushed"), M("Board", "hard maple", "satin"), M("Serving dish", "stoneware", "matte")],
      colors: colorSet(rng, ["plating", "garnish", "serving dish"], 3),
      components: [CP("Oven", "n/a", "preheat " + temp + "°C (" + Math.round(temp * 9 / 5 + 32) + "°F)"), CP("Thermometer", "n/a", "target internal " + rng.int(63, 75) + "°C")],
      measurements: ing.concat([S("Estimated energy", per(rng.int(320, 520)), "kcal/serving*"), S("Water", per(rng.int(120, 200)), "ml")]),
      how_to_use: "1) Prep all ingredients (" + rng.int(10, 25) + " min). 2) Sear the " + main + " " + t1 + " min. 3) Finish in the " + temp + "°C oven " + t2 + " min. 4) Rest, plate, serve. *Nutrition estimated, not lab-measured."
    };
  }
});

fam({
  key: "candy", name: "Signature Candy Generator", icon: "🍬",
  blurb: "Complete Signature-line confections — batch math, sugar stages, molds, and colors, fully specified.",
  params: [
    { id: "type", label: "Type", type: "choice", options: ["Gummy", "Hard candy", "Chocolate bar", "Chewy caramel"] },
    { id: "flavor", label: "Flavor family", type: "choice", options: ["Citrus", "Berry", "Mint", "Caramel", "Tropical"] },
    { id: "batch", label: "Batch (pieces)", type: "range", min: 24, max: 120, step: 12 }
  ],
  solve: function (rng, P) {
    var b = P.batch, per = function (g) { return Math.round(g * b / 48); };
    var stage = { "Gummy": "soft-ball 112°C", "Hard candy": "hard-crack 149°C", "Chocolate bar": "temper 31°C", "Chewy caramel": "firm-ball 118°C" }[P.type];
    var base = { "Gummy": ["granulated sugar", "glucose syrup", "gelatin 250 bloom"], "Hard candy": ["granulated sugar", "glucose syrup", "cream of tartar"], "Chocolate bar": ["cacao mass", "cocoa butter", "cane sugar"], "Chewy caramel": ["granulated sugar", "heavy cream", "butter"] }[P.type];
    var name = brandName(rng, P.flavor + " " + P.type);
    var piece = P.type === "Chocolate bar" ? [D("Bar length", 15.2, "cm"), D("Bar width", 7.6, "cm"), D("Thickness", fmt(rng.float(0.8, 1.2, 1), 1), "cm")]
      : [D("Piece size", fmt(rng.float(2.0, 3.2, 1), 1), "cm"), D("Piece weight", fmt(rng.float(8, 14, 1), 1), "g"), D("Batch yield", b, "pieces")];
    return {
      name: name, tagline: P.type + " · " + P.flavor.toLowerCase() + " · " + b + " pieces",
      idea: "The " + name + " is a Signature-line " + P.flavor.toLowerCase() + " " + P.type.toLowerCase() +
        " cooked to the " + stage + " stage. The batch below yields exactly " + b + " pieces with every gram weighed.",
      dimensions: piece,
      materials: [M("Mold", "food-grade silicone", "matte"), M("Wrapper", "wax paper", "satin")],
      colors: colorSet(rng, ["candy body", "swirl", "wrapper"], 3),
      components: [CP("Sugar stage", "n/a", stage), CP("Thermometer", "n/a", "clip-on candy thermometer, ±1°C")],
      measurements: [S(base[0], per(rng.int(380, 460)), "g"), S(base[1], per(rng.int(120, 200)), "g"), S(base[2], per(rng.int(40, 90)), "g"), S("Flavoring", (b / 48 * rng.float(4, 8, 1)).toFixed(1), "ml"), S("Set time", rng.int(2, 6), "h")],
      how_to_use: "Cook to " + stage + ", pour into the silicone mold, set " + rng.int(2, 6) + " hours, unmold and wrap each piece."
    };
  }
});

fam({
  key: "nanoplasma", name: "Signature Nanoplasma Device Generator", icon: "⚛️",
  blurb: "Theoretical Signature-line nanoplasma instruments — emitter physics worked out on paper, labeled theoretical.",
  params: [
    { id: "app", label: "Application", type: "choice", options: ["Lab display", "Surface sterilizer", "Plasma tweezer"] },
    { id: "scale", label: "Scale", type: "choice", options: ["Benchtop", "Handheld"] }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, "NP-" + rng.int(100, 999));
    var emitters = rng.int(64, 512);
    return {
      name: name, tagline: "Theoretical " + P.app.toLowerCase() + " · " + P.scale.toLowerCase(),
      idea: "The " + name + " is a THEORETICAL Signature-line concept: a " + P.scale.toLowerCase() + " " + P.app.toLowerCase() +
        " driven by a " + emitters + "-emitter nanoplasma array. All figures are paper-design targets for a lab prototype, not a shipping product.",
      dimensions: P.scale === "Benchtop" ? [D("Width", fmt(rng.float(28, 44, 1), 1), "cm"), D("Depth", fmt(rng.float(24, 36, 1), 1), "cm"), D("Height", fmt(rng.float(18, 30, 1), 1), "cm")] : [D("Length", fmt(rng.float(14, 20, 1), 1), "cm"), D("Width", fmt(rng.float(6, 9, 1), 1), "cm"), D("Weight", fmt(rng.float(0.4, 0.9, 2), 2), "kg")],
      materials: [M("Chamber", "quartz glass", "polished"), M("Housing", rng.pick(METALS), "brushed"), M("Emitter substrate", "silicon wafer", "polished")],
      colors: colorSet(rng, ["housing", "emitter glow", "control ring"], 3),
      components: [CP("Plasma driver", chip(rng, "PD"), fmt(rng.float(2, 13.56, 2), 2) + " MHz RF"), CP("Array controller", chip(rng, "AC"), emitters + " channels"), CP("Vacuum pump", "n/a", fmt(rng.float(0.1, 2, 1), 1) + " Pa target")],
      measurements: [S("Emitters", emitters, "channels"), S("RF power", rng.int(20, 200), "W"), S("Pulse rate", rng.int(1, 40), "kHz")],
      how_to_use: "Paper concept: assemble the emitter array in the quartz chamber, drive at the listed RF frequency, and validate plasma uniformity before any application testing. Theoretical — lab prototype stage only."
    };
  }
});

fam({
  key: "lightbot", name: "Signature Lightbot Generator", icon: "💡",
  blurb: "Complete Signature-line lightbots — pocket robots that paint with light, electronics fully specified.",
  params: [
    { id: "size", label: "Size class", type: "choice", options: ["Palm", "Desktop"] },
    { id: "behavior", label: "Behavior", type: "choice", options: ["Dance", "Patrol", "Companion glow"] }
  ],
  solve: function (rng, P) {
    var palm = P.size === "Palm";
    var leds = palm ? rng.int(12, 24) : rng.int(32, 96);
    var name = brandName(rng, "Lumo-" + rng.int(10, 99));
    return {
      name: name, tagline: P.size + " lightbot · " + P.behavior.toLowerCase() + " · " + leds + " LEDs",
      idea: "The " + name + " is a Signature-line " + P.size.toLowerCase() + " lightbot that performs a " + P.behavior.toLowerCase() +
        " routine on " + leds + " addressable LEDs. Two drive wheels, a full sensor ring, and a USB-C charge port round out the build.",
      dimensions: palm ? [D("Diameter", fmt(rng.float(7, 10, 1), 1), "cm"), D("Height", fmt(rng.float(4, 6, 1), 1), "cm"), D("Weight", rng.int(120, 220), "g")] : [D("Diameter", fmt(rng.float(14, 20, 1), 1), "cm"), D("Height", fmt(rng.float(8, 12, 1), 1), "cm"), D("Weight", rng.int(450, 900), "g")],
      materials: [M("Shell", rng.pick(PLASTICS), "satin"), M("Diffuser dome", "frosted polycarbonate", "matte"), M("Wheels", "silicone rubber", "matte")],
      colors: colorSet(rng, ["shell", "diffuser", "underglow"], 3),
      components: [CP("LED driver", chip(rng, "LD"), leds + " addressable RGB LEDs"), CP("Main MCU", chip(rng, "MC"), "motion + light engine"), CP("IMU", chip(rng, "IM"), "6-axis"), CP("Battery", "n/a", fmt(rng.float(800, 2200, 0), 0) + " mAh Li-ion")],
      measurements: [S("LEDs", leds, "pixels"), S("Runtime", rng.int(2, 8), "h"), S("Top speed", fmt(rng.float(0.3, 1.2, 1), 1), "m/s"), S("Charge time", fmt(rng.float(1, 2.5, 1), 1), "h")],
      how_to_use: "Charge over USB-C, set it down, and pick the " + P.behavior.toLowerCase() + " routine in the companion app — it dances, patrols, or glows on its own."
    };
  }
});

fam({
  key: "car", name: "Signature Car Generator", icon: "🚗",
  blurb: "Complete Signature-line cars — chassis, drivetrain, aero, interior, down to the lug nuts.",
  params: [
    { id: "body", label: "Body", type: "choice", options: ["Sedan", "Coupe", "SUV", "Pickup"] },
    { id: "drive", label: "Drivetrain", type: "choice", options: ["FWD", "RWD", "AWD", "Electric AWD"] },
    { id: "seats", label: "Seats", type: "range", min: 2, max: 7, step: 1 }
  ],
  solve: function (rng, P) {
    var ev = P.drive === "Electric AWD";
    var kw = ev ? rng.float(150, 380, 0) : rng.float(110, 320, 0);
    var kg = { "Sedan": rng.float(1400, 1750, 0), "Coupe": rng.float(1300, 1600, 0), "SUV": rng.float(1800, 2400, 0), "Pickup": rng.float(2000, 2600, 0) }[P.body];
    var zero60 = Math.max(2.9, 9.5 - kw / 90);
    var name = brandName(rng, P.body.slice(0, 3).toUpperCase() + "-" + rng.int(100, 999));
    return {
      name: name, tagline: P.body + " · " + P.drive + " · " + fmt(kw, 0) + " kW",
      idea: "The " + name + " is a Signature-line " + P.body.toLowerCase() + " with " + P.drive + " and " + fmt(kw, 0) +
        " kW. " + (ev ? "A skateboard battery pack keeps the center of gravity low." : "A front-engine layout feeds a " + rng.int(6, 10) + "-speed automatic.") +
        " Target 0–100 km/h: " + fmt(zero60, 1) + " s.",
      dimensions: [D("Length", fmt({ "Sedan": 4.8, "Coupe": 4.5, "SUV": 4.9, "Pickup": 5.3 }[P.body] * rng.float(0.97, 1.03, 2), 2), "m"), D("Width", fmt(rng.float(1.85, 2.0, 2), 2), "m"), D("Height", fmt(rng.float(1.35, 1.9, 2), 2), "m"), D("Wheelbase", fmt(rng.float(2.7, 3.3, 2), 2), "m")],
      materials: [M("Body panels", rng.pick([rng.pick(METALS), "carbon-fiber composite"]), rng.pick(FINISHES)), M("Chassis", "high-strength steel", "powder-coated"), M("Seats", "vegan leather", "matte"), M("Glass", "laminated acoustic glass", "polished")],
      colors: colorSet(rng, ["body", "roof", "calipers", "interior stitch"], 3),
      components: [CP("ECU", chip(rng, "EC"), (ev ? "dual-motor inverter control" : "engine + transmission control")), CP("Infotainment", chip(rng, "IV"), fmt(rng.float(10, 15, 1), 1) + "-in display"), CP("Battery", "n/a", ev ? fmt(rng.float(60, 110, 0), 0) + " kWh pack" : "12 V " + rng.int(60, 90) + " Ah")],
      measurements: [S("Power", fmt(kw, 0), "kW"), S("Curb weight", fmt(kg, 0), "kg"), S("0–100 km/h", fmt(zero60, 1), "s"), S("Range", ev ? rng.int(380, 620) : rng.int(600, 950), "km"), S("Drag Cd", fmt(rng.float(0.24, 0.34, 2), 2), "")],
      how_to_use: "Charge or fuel, select drive mode, and drive — service the " + fmt(kw, 0) + " kW drivetrain every " + rng.int(15, 30) + ",000 km."
    };
  }
});

fam({
  key: "engine", name: "Signature Engine Generator", icon: "⚙️",
  blurb: "Complete Signature-line engines — bore, stroke, compression, power curves, every bolt accounted for.",
  params: [
    { id: "layout", label: "Layout", type: "choice", options: ["Inline-4", "V6", "V8", "Flat-4"] },
    { id: "disp", label: "Displacement (L)", type: "range", min: 15, max: 62, step: 1 },
    { id: "fuel", label: "Fuel", type: "choice", options: ["Petrol", "Diesel", "Hybrid-assist petrol"] }
  ],
  solve: function (rng, P) {
    var cyl = { "Inline-4": 4, "V6": 6, "V8": 8, "Flat-4": 4 }[P.layout];
    var dispL = P.disp / 10, perCyl = dispL / cyl * 1000;
    var bore = Math.sqrt(perCyl / (Math.PI / 4) / rng.float(0.9, 1.1, 2) / 10) * 10; // mm approx
    var stroke = perCyl / (Math.PI / 4 * Math.pow(bore / 10, 2)) * 10;
    var comp = P.fuel === "Diesel" ? rng.float(15, 18, 1) : rng.float(10, 13, 1);
    var hp = dispL * (P.fuel === "Diesel" ? rng.float(55, 75, 0) : rng.float(85, 130, 0)) * (P.fuel.indexOf("Hybrid") === 0 ? 1.18 : 1);
    var name = brandName(rng, "SE-" + Math.round(dispL * 10));
    return {
      name: name, tagline: P.layout + " · " + fmt(dispL, 1) + " L " + P.fuel.toLowerCase(),
      idea: "The " + name + " is a Signature-line " + P.layout + " " + P.fuel.toLowerCase() + " engine displacing " + fmt(dispL, 1) +
        " litres. Bore " + fmt(bore, 1) + " mm × stroke " + fmt(stroke, 1) + " mm with " + fmt(comp, 1) + ":1 compression delivers " +
        fmt(hp, 0) + " hp at " + fmt(rng.int(5500, 7000), 0) + " rpm.",
      dimensions: [D("Bore", fmt(bore, 1), "mm"), D("Stroke", fmt(stroke, 1), "mm"), D("Length", fmt(rng.float(55, 85, 0), 0), "cm"), D("Dry weight", fmt(rng.float(120, 260, 0), 0), "kg")],
      materials: [M("Block", "cast aluminum", "satin"), M("Head", "aluminum alloy", "satin"), M("Crankshaft", "forged steel", "polished"), M("Pistons", "forged aluminum", "anodized")],
      colors: colorSet(rng, ["block", "valve cover", "intake"], 3),
      components: [CP("ECU", chip(rng, "EC"), "fuel + ignition mapping"), CP("Injectors", "n/a", cyl + "× direct injection"), CP("Turbocharger", "n/a", rng.chance(0.6) ? "single twin-scroll, " + fmt(rng.float(0.8, 1.6, 1), 1) + " bar" : "naturally aspirated")],
      measurements: [S("Displacement", fmt(dispL * 1000, 0), "cc"), S("Power", fmt(hp, 0), "hp"), S("Torque", fmt(hp * rng.float(1.15, 1.35, 2), 0), "Nm"), S("Compression", fmt(comp, 1) + ":1", ""), S("Redline", fmt(rng.int(6000, 7500), 0), "rpm")],
      how_to_use: "Mount with the specified bellhousing, wire the " + chip(rng, "EC") + "-family ECU, fill " + fmt(dispL, 1) + " L-spec oil, and break in for " + rng.int(800, 1500) + " km."
    };
  }
});

fam({
  key: "toy", name: "Signature Toy Generator", icon: "🧸",
  blurb: "Complete Signature-line toys — safe materials, mechanisms, and colors, fully specified.",
  params: [
    { id: "type", label: "Type", type: "choice", options: ["Action figure", "Vehicle", "Puzzle", "Plush"] },
    { id: "age", label: "Age range", type: "choice", options: ["3+", "6+", "9+"] }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, rng.pick(["Zippy", "Bouncer", "Twirly", "Dash", "Pip"]) + "-" + rng.int(10, 99));
    var small = P.age === "3+";
    return {
      name: name, tagline: P.type + " · ages " + P.age,
      idea: "The " + name + " is a Signature-line " + P.type.toLowerCase() + " for ages " + P.age + ". " +
        (small ? "No small parts — every piece exceeds the choke-tube gauge." : "Articulated joints and fine detail reward older builders.") +
        " Built from certified-safe materials with rounded edges throughout.",
      dimensions: [D("Height", fmt(rng.float(8, 28, 1), 1), "cm"), D("Width", fmt(rng.float(5, 18, 1), 1), "cm"), D("Weight", rng.int(80, 600), "g")],
      materials: [M("Body", P.type === "Plush" ? "organic cotton plush" : rng.pick(PLASTICS), "matte"), M("Joints", "nylon PA12", "satin"), M("Paint", "water-based toy paint", "satin")],
      colors: colorSet(rng, ["body", "accents", "packaging"], 3),
      components: [CP("Mechanism", "n/a", P.type === "Puzzle" ? rng.int(48, 500) + " interlocking pieces" : rng.int(5, 14) + " points of articulation"), CP("Sound chip", P.type === "Plush" || P.type === "Action figure" ? chip(rng, "SC") : "n/a", P.type === "Plush" || P.type === "Action figure" ? rng.int(3, 8) + " phrases" : "not fitted")],
      measurements: [S("Smallest part", small ? "38" : fmt(rng.float(12, 30, 0), 0), "mm"), S("Drop rating", rng.int(1, 2), "m onto wood")],
      how_to_use: "Unbox, check the " + rng.int(5, 14) + " joints move freely, and play — wipe clean with a damp cloth."
    };
  }
});

fam({
  key: "tool", name: "Signature Tool Generator", icon: "🔧",
  blurb: "Complete Signature-line power tools — motor, gearbox, battery, and ergonomics, fully specified.",
  params: [
    { id: "type", label: "Type", type: "choice", options: ["Drill driver", "Circular saw", "Orbital sander", "Multitool"] },
    { id: "power", label: "Power", type: "choice", options: ["18V battery", "40V battery", "Corded 120V"] }
  ],
  solve: function (rng, P) {
    var batt = P.power.indexOf("battery") >= 0;
    var rpm = { "Drill driver": rng.int(1800, 2200), "Circular saw": rng.int(5200, 6000), "Orbital sander": rng.int(11000, 13000), "Multitool": rng.int(18000, 22000) }[P.type];
    var name = brandName(rng, "T-" + rng.int(100, 999));
    return {
      name: name, tagline: P.type + " · " + P.power,
      idea: "The " + name + " is a Signature-line " + P.type.toLowerCase() + " running on " + P.power + ". A brushless motor drives " +
        fmt(rpm, 0) + " rpm through a metal gearbox, with soft-grip ergonomics for long sessions.",
      dimensions: [D("Length", fmt(rng.float(16, 32, 1), 1), "cm"), D("Height", fmt(rng.float(14, 24, 1), 1), "cm"), D("Weight", fmt(rng.float(0.9, 3.8, 1), 1), "kg")],
      materials: [M("Housing", "glass-filled nylon", "matte"), M("Gearbox", "powdered metal", "satin"), M("Grip", "thermoplastic elastomer", "matte"), M("Chuck", "hardened steel", "polished")],
      colors: colorSet(rng, ["housing", "grip", "accents"], 3),
      components: [CP("Motor controller", chip(rng, "MC"), "brushless 3-phase"), CP("Battery", "n/a", batt ? P.power + ", " + fmt(rng.float(4, 8, 1), 1) + " Ah" : "n/a — corded"), CP("Chuck", "n/a", P.type === "Drill driver" ? "13 mm keyless metal" : "n/a")],
      measurements: [S("No-load speed", fmt(rpm, 0), "rpm"), S("Max torque", P.type === "Drill driver" ? rng.int(45, 120) : rng.int(8, 30), "Nm"), S("Runtime", batt ? rng.int(35, 90) : 0, batt ? "min" : "continuous")],
      how_to_use: "Fit the bit or blade, check the " + P.power + " source, wear eye protection, and work — the electronic clutch protects the gearbox."
    };
  }
});

/* ================= FAMILY SOLVERS (11-20) ================= */

fam({
  key: "furniture", name: "Signature Furniture Generator", icon: "🪑",
  blurb: "Complete Signature-line furniture — joinery, finishes, and load ratings, fully specified.",
  params: [
    { id: "piece", label: "Piece", type: "choice", options: ["Lounge chair", "Dining table", "Bookshelf", "Bed frame"] },
    { id: "style", label: "Style", type: "choice", options: ["Mid-century", "Scandi", "Industrial", "Japandi"] }
  ],
  solve: function (rng, P) {
    var dimMap = {
      "Lounge chair": [D("Seat height", 42, "cm"), D("Seat width", 58, "cm"), D("Back height", 72, "cm")],
      "Dining table": [D("Length", 180, "cm"), D("Width", 90, "cm"), D("Height", 75, "cm")],
      "Bookshelf": [D("Height", 200, "cm"), D("Width", 90, "cm"), D("Depth", 32, "cm")],
      "Bed frame": [D("Length", 210, "cm"), D("Width", 160, "cm"), D("Headboard", 110, "cm")]
    }[P.piece];
    var name = brandName(rng, P.piece.split(" ")[0] + "-" + rng.int(10, 99));
    return {
      name: name, tagline: P.piece + " · " + P.style,
      idea: "The " + name + " is a Signature-line " + P.piece.toLowerCase() + " in " + P.style + " style — " +
        rng.pick(["mortise-and-tenon", "dovetail", "wedged-tenon", "knock-down cam"]) + " joinery, hand-sanded to 220 grit, finished for daily life.",
      dimensions: dimMap,
      materials: [M("Frame", rng.pick(WOODS), rng.pick(FINISHES)), M("Upholstery", P.piece === "Lounge chair" || P.piece === "Bed frame" ? rng.pick(FABRICS) : "n/a", "matte"), M("Hardware", "brass C36000", "brushed")],
      colors: colorSet(rng, ["wood", "upholstery", "hardware"], 3),
      components: [CP("Joinery", "n/a", rng.pick(["mortise-and-tenon", "dovetail", "wedged tenon"])), CP("Finish coats", "n/a", rng.int(2, 4) + "× hardwax oil")],
      measurements: [S("Load rating", rng.int(120, 300), "kg"), S("Assembly time", rng.int(15, 60), "min"), S("Flat-pack volume", fmt(rng.float(0.1, 0.5, 2), 2), "m³")],
      how_to_use: "Assemble with the included hex key in " + rng.int(15, 60) + " minutes, place on level floor, and enjoy — re-oil yearly."
    };
  }
});

fam({
  key: "clothing", name: "Signature Clothing Generator", icon: "👕",
  blurb: "Complete Signature-line garments — graded sizes, fabrics, and construction, fully specified.",
  params: [
    { id: "garment", label: "Garment", type: "choice", options: ["Field jacket", "Hoodie", "Work dress", "Trail uniform"] },
    { id: "climate", label: "Climate", type: "choice", options: ["Cold", "Mild", "Hot"] }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, rng.pick(["North", "Drift", "Ember", "Halo"]) + " " + P.garment.split(" ")[0]);
    var gsm = P.climate === "Cold" ? rng.int(320, 450) : P.climate === "Mild" ? rng.int(220, 320) : rng.int(120, 200);
    return {
      name: name, tagline: P.garment + " · " + P.climate.toLowerCase() + " · " + gsm + " gsm",
      idea: "The " + name + " is a Signature-line " + P.garment.toLowerCase() + " cut for " + P.climate.toLowerCase() +
        " weather in " + gsm + " gsm fabric. Flat-felled seams, bar-tacked stress points, and a fit graded across six sizes.",
      dimensions: [D("Chest (M)", rng.int(100, 112), "cm"), D("Length (M)", rng.int(68, 78), "cm"), D("Sleeve (M)", rng.int(62, 68), "cm")],
      materials: [M("Shell", rng.pick(FABRICS), "matte"), M("Lining", P.climate === "Cold" ? "brushed fleece" : "cotton voile", "matte"), M("Zipper", "YKK-grade metal", "polished")],
      colors: colorSet(rng, ["shell", "lining", "thread"], 3),
      components: [CP("Stitch density", "n/a", rng.int(8, 12) + " stitches/cm"), CP("Pockets", "n/a", rng.int(2, 6) + " — incl. " + rng.pick(["chest", "cargo", "hidden"]) + " pocket")],
      measurements: [S("Fabric weight", gsm, "gsm"), S("Sizes", "XS–XXL", "6 graded"), S("Water column", P.climate === "Cold" ? rng.int(5000, 10000) : 0, P.climate === "Cold" ? "mm" : "n/a")],
      how_to_use: "Machine wash cold, hang dry — the " + gsm + " gsm shell softens with every wash."
    };
  }
});

fam({
  key: "game", name: "Signature Game Generator", icon: "🎲",
  blurb: "Complete Signature-line tabletop games — components, rules, and box, fully specified.",
  params: [
    { id: "type", label: "Type", type: "choice", options: ["Board game", "Card game", "Party game"] },
    { id: "players", label: "Players", type: "range", min: 2, max: 8, step: 1 }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, rng.pick(["Realms", "Tides", "Gears", "Echoes", "Harbor"]) + " of " + rng.pick(["Ember", "Drift", "Quartz", "Mist"]));
    var cards = P.type === "Card game" ? rng.int(80, 140) : P.type === "Party game" ? rng.int(120, 200) : rng.int(40, 80);
    return {
      name: name, tagline: P.type + " · " + P.players + " players · " + rng.int(20, 90) + " min",
      idea: "The " + name + " is a Signature-line " + P.type.toLowerCase() + " for " + P.players + " players. " +
        rng.pick(["Draft routes and outmaneuver rivals", "Build combos from a shared deck", "Bluff your way to the final round", "Cooperate against the clock"]) +
        " across " + rng.int(20, 90) + " minutes of play — every component below is in the box.",
      dimensions: [D("Box", "29.7 × 29.7 × 7.5", "cm"), D("Board", P.type === "Board game" ? "56 × 56" : "n/a", P.type === "Board game" ? "cm quad-fold" : ""), D("Cards", "63 × 88", "mm poker")],
      materials: [M("Board", "2mm greyboard wrap", "matte"), M("Cards", "310gsm black-core", "linen"), M("Tokens", "wood", "satin")],
      colors: colorSet(rng, ["box", "cards", "tokens"], 3),
      components: [CP("Cards", "n/a", cards + " cards"), CP("Tokens", "n/a", rng.int(20, 60) + " wooden tokens"), CP("Dice", "n/a", rng.int(0, 5) + "× 16mm"), CP("Rulebook", "n/a", rng.int(8, 20) + " pages")],
      measurements: [S("Players", P.players, ""), S("Play time", rng.int(20, 90), "min"), S("Box weight", fmt(rng.float(0.6, 1.4, 1), 1), "kg")],
      how_to_use: "Read the " + rng.int(8, 20) + "-page rulebook (" + rng.int(8, 15) + " min), deal, and play — the quick-start card has you going in 5 minutes."
    };
  }
});

fam({
  key: "instrument", name: "Signature Instrument Generator", icon: "🎺",
  blurb: "Complete Signature-line instruments — acoustics, action, and range, fully specified.",
  params: [
    { id: "family", label: "Family", type: "choice", options: ["Strings", "Winds", "Percussion", "Electronic"] },
    { id: "range", label: "Range", type: "choice", options: ["Student", "Stage", "Studio"] }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, rng.pick(["Aria", "Cadence", "Reso", "Tempo"]) + "-" + rng.int(10, 99));
    var elec = P.family === "Electronic";
    return {
      name: name, tagline: P.family + " · " + P.range.toLowerCase() + " range",
      idea: "The " + name + " is a Signature-line " + P.family.toLowerCase() + " instrument built for " + P.range.toLowerCase() +
        " use. " + (elec ? "A custom DSP voice engine gives it " + rng.int(64, 256) + " voices of polyphony." : "Hand-voiced acoustics give it a warm, even response across its full range."),
      dimensions: [D("Length", fmt(rng.float(60, 130, 0), 0), "cm"), D("Width", fmt(rng.float(25, 45, 0), 0), "cm"), D("Weight", fmt(rng.float(1.5, 9, 1), 1), "kg")],
      materials: [M("Body", elec ? rng.pick(PLASTICS) : rng.pick(WOODS), "satin"), M("Hardware", "nickel silver", "polished"), M("Strings/pads", elec ? "velocity pads" : rng.pick(["phosphor bronze", "nylon", "steel"]), "n/a")],
      colors: colorSet(rng, ["body", "trim", "case"], 3),
      components: [CP("Voice engine", elec ? chip(rng, "DSP") : "n/a", elec ? rng.int(64, 256) + "-voice polyphony" : "acoustic"), CP("Pickup", elec ? "n/a" : chip(rng, "PU"), elec ? "line out" : "piezo + mic blend")],
      measurements: [S("Range", rng.pick(["3 octaves", "4 octaves", "5 octaves"]), ""), S("Tuning", "A=442 Hz", ""), S("Voices", elec ? rng.int(64, 256) : 1, elec ? "polyphony" : "acoustic")],
      how_to_use: "Tune to A=442 Hz, warm up for 10 minutes, and play — wipe down after each session."
    };
  }
});

fam({
  key: "robot", name: "Signature Robot Generator", icon: "🤖",
  blurb: "Complete Signature-line robots — kinematics, sensors, and power, fully specified.",
  params: [
    { id: "role", label: "Role", type: "choice", options: ["Home assistant", "Inspector", "Carrier"] },
    { id: "loco", label: "Locomotion", type: "choice", options: ["Wheels", "Legs", "Tracked"] }
  ],
  solve: function (rng, P) {
    var name = brandName(rng, "R-" + rng.int(100, 999));
    var dof = P.loco === "Legs" ? rng.int(12, 18) : rng.int(4, 8);
    return {
      name: name, tagline: P.role + " · " + P.loco.toLowerCase() + " · " + dof + " DOF",
      idea: "The " + name + " is a Signature-line " + P.role.toLowerCase() + " robot on " + P.loco.toLowerCase() + " with " + dof +
        " degrees of freedom. A full sensor ring and all-day battery let it work a full shift beside you.",
      dimensions: [D("Height", fmt(rng.float(60, 140, 0), 0), "cm"), D("Footprint", fmt(rng.float(35, 60, 0), 0) + " × " + fmt(rng.float(35, 60, 0), 0), "cm"), D("Weight", fmt(rng.float(12, 45, 1), 1), "kg")],
      materials: [M("Frame", rng.pick(METALS), "brushed"), M("Shell", rng.pick(PLASTICS), "matte"), M("Grippers", "silicone rubber", "matte")],
      colors: colorSet(rng, ["shell", "accents", "status light"], 3),
      components: [CP("Main compute", chip(rng, "RC"), dof + "-axis motion stack"), CP("Depth camera", chip(rng, "DC"), fmt(rng.float(0.3, 5, 1), 1) + " m range"), CP("Battery", "n/a", fmt(rng.float(0.5, 2, 2), 2) + " kWh, " + rng.int(6, 12) + " h runtime")],
      measurements: [S("Payload", rng.int(2, 25), "kg"), S("Top speed", fmt(rng.float(0.8, 2.5, 1), 1), "m/s"), S("Runtime", rng.int(6, 12), "h")],
      how_to_use: "Charge overnight, map your space once in the app, then assign tasks — it returns to its dock when done."
    };
  }
});

fam({
  key: "building", name: "Signature Building Generator", icon: "🏢",
  blurb: "Complete Signature-line building concepts — massing, structure, and program, fully specified.",
  params: [
    { id: "type", label: "Type", type: "choice", options: ["Courtyard home", "Mid-rise tower", "Pavilion"] },
    { id: "floors", label: "Floors", type: "range", min: 1, max: 24, step: 1 }
  ],
  solve: function (rng, P) {
    var fl = P.type === "Courtyard home" ? Math.min(P.floors, 3) : P.type === "Pavilion" ? 1 : P.floors;
    var fp = P.type === "Mid-rise tower" ? rng.float(500, 1200, 0) : rng.float(120, 400, 0);
    var name = brandName(rng, rng.pick(["Atrium", "Meridian", "Solstice", "Harbor"]) + " " + P.type.split(" ")[0]);
    return {
      name: name, tagline: P.type + " · " + fl + " floors · " + fmt(fp * fl, 0) + " m²",
      idea: "The " + name + " is a Signature-line " + P.type.toLowerCase() + " concept of " + fl + " floors and " +
        fmt(fp * fl, 0) + " m². A " + rng.pick(["steel moment frame", "cross-laminated timber", "reinforced concrete core"]) +
        " structure wraps a daylit, cross-ventilated plan.",
      dimensions: [D("Footprint", fmt(fp, 0), "m²"), D("Height", fmt(fl * rng.float(3.2, 4.2, 1), 1), "m"), D("Floor area", fmt(fp * fl, 0), "m²")],
      materials: [M("Structure", rng.pick(["cross-laminated timber", "structural steel", "reinforced concrete"]), "n/a"), M("Facade", rng.pick(["terracotta rainscreen", "glass curtain wall", "timber slats"]), "matte"), M("Roof", "standing-seam metal", "matte")],
      colors: colorSet(rng, ["facade", "roof", "lobby"], 3),
      components: [CP("HVAC", "n/a", "VRF + heat recovery"), CP("Elevators", "n/a", fl > 3 ? Math.ceil(fl / 8) + "× traction" : "stair only"), CP("Solar", "n/a", fmt(fp * 0.4, 0) + " m² array")],
      measurements: [S("Floors", fl, ""), S("Units/rooms", rng.int(4, 120), ""), S("Daylight factor", fmt(rng.float(2, 5, 1), 1), "% avg")],
      how_to_use: "Concept package: massing, plans, and sections as drawn — hand to a licensed architect and structural engineer for construction documents."
    };
  }
});

/* ---- mix-and-match labs ---- */
fam({
  key: "mix-car-engine", name: "Car × Engine Mix Lab", icon: "🚗",
  blurb: "A Signature car with its powerplant solved as one machine — chassis and engine co-designed.",
  params: [
    { id: "body", label: "Body", type: "choice", options: ["Sedan", "Coupe", "SUV"] },
    { id: "layout", label: "Engine layout", type: "choice", options: ["Inline-4", "V6", "V8"] }
  ],
  solve: function (rng, P) {
    var car = byKey("car").solve(rng, { body: P.body, drive: rng.pick(["RWD", "AWD"]), seats: rng.int(2, 5) });
    var eng = byKey("engine").solve(rng, { layout: P.layout, disp: rng.int(20, 55), fuel: "Petrol" });
    car.name = brandName(rng, P.body.slice(0, 3).toUpperCase() + "×" + P.layout.replace("-", ""));
    car.tagline = "Mix Lab: " + P.body + " × " + P.layout + " · " + eng.measurements[1].value + " " + eng.measurements[1].unit;
    car.idea = "Mix-Lab co-design: the " + car.name + " pairs a " + P.body.toLowerCase() + " chassis with a bespoke " +
      P.layout + " " + eng.dimensions[1].value + " mm-bore powerplant making " + eng.measurements[1].value + " " + eng.measurements[1].unit +
      " — engine and chassis tuned on the same dyno sheet.";
    car.components = car.components.concat(eng.components);
    car.measurements = car.measurements.concat(eng.measurements.slice(0, 3));
    return car;
  }
});

fam({
  key: "mix-toy-lightbot", name: "Toy × Lightbot Mix Lab", icon: "🧸",
  blurb: "A Signature toy with a lightbot heart — plaything outside, robot inside.",
  params: [
    { id: "type", label: "Toy type", type: "choice", options: ["Action figure", "Vehicle", "Plush"] },
    { id: "behavior", label: "Light routine", type: "choice", options: ["Dance", "Patrol", "Companion glow"] }
  ],
  solve: function (rng, P) {
    var toy = byKey("toy").solve(rng, { type: P.type, age: rng.pick(["6+", "9+"]) });
    var lb = byKey("lightbot").solve(rng, { size: "Palm", behavior: P.behavior });
    toy.name = brandName(rng, "Glow-" + rng.int(10, 99));
    toy.tagline = "Mix Lab: " + P.type + " × lightbot · " + lb.measurements[0].value + " " + lb.measurements[0].unit;
    toy.idea = "Mix-Lab fusion: the " + toy.name + " is a " + P.type.toLowerCase() + " with a full lightbot core — " +
      lb.measurements[0].value + " addressable LEDs run the " + P.behavior.toLowerCase() + " routine inside a toy-safe shell.";
    toy.components = toy.components.concat(lb.components.slice(0, 2));
    return toy;
  }
});

fam({
  key: "mix-food-candy", name: "Dish × Candy Mix Lab", icon: "🍽️",
  blurb: "A Signature dessert where the dish course meets the candy bench — plated and pulled.",
  params: [
    { id: "cuisine", label: "Cuisine", type: "choice", options: ["Mediterranean", "East Asian", "Latin", "Comfort"] },
    { id: "flavor", label: "Candy flavor", type: "choice", options: ["Citrus", "Berry", "Caramel", "Tropical"] }
  ],
  solve: function (rng, P) {
    var dish = byKey("food").solve(rng, { cuisine: P.cuisine, course: "Dessert", servings: rng.int(2, 6) });
    var candy = byKey("candy").solve(rng, { type: rng.pick(["Gummy", "Chewy caramel", "Chocolate bar"]), flavor: P.flavor, batch: 48 });
    dish.name = brandName(rng, "Dolce-" + rng.int(10, 99));
    dish.tagline = "Mix Lab: " + P.cuisine + " dessert × " + P.flavor.toLowerCase() + " candy";
    dish.idea = "Mix-Lab dessert: the " + dish.name + " plates a " + P.cuisine.toLowerCase() + " dessert finished with a handmade " +
      P.flavor.toLowerCase() + " " + candy.tagline.split(" · ")[0] + " — " + candy.components[0].detail + " — made in the same kitchen session.";
    dish.measurements = dish.measurements.concat(candy.measurements.slice(0, 2));
    return dish;
  }
});

fam({
  key: "mix-jet-engine", name: "Jet × Engine Mix Lab", icon: "✈️",
  blurb: "A Signature jet with its powerplant solved as one machine — airframe and turbofan co-designed.",
  params: [
    { id: "cls", label: "Class", type: "choice", options: ["Light trainer", "Business jet"] },
    { id: "engines", label: "Engines", type: "range", min: 1, max: 2, step: 1 }
  ],
  solve: function (rng, P) {
    var jet = byKey("jet").solve(rng, { cls: P.cls, range_nm: rng.int(1200, 3000), seats: rng.int(2, 12) });
    jet.name = brandName(rng, "JX-" + rng.int(10, 99));
    jet.tagline = "Mix Lab: " + P.cls + " × bespoke turbofan ×" + P.engines;
    var fan = rng.float(0.9, 1.6, 2), bypass = fmt(rng.float(4, 9, 1), 1);
    jet.idea = "Mix-Lab co-design: the " + jet.name + " wraps " + P.engines + " bespoke turbofan" + (P.engines > 1 ? "s" : "") +
      " (" + fmt(fan, 2) + " m fan, " + bypass + ":1 bypass) into a " + P.cls.toLowerCase() + " airframe — nacelle and wing solved together.";
    jet.components.push(CP("Turbofan", chip(rng, "TF"), fmt(fan, 2) + " m fan · " + bypass + ":1 bypass · " + jet.measurements[2].value + " " + jet.measurements[2].unit + " each"));
    return jet;
  }
});

/* ================= PUBLIC API ================= */
function genId(familyKey, seed) {
  var n = String(seed);
  while (n.length < 6) n = "0" + n;
  return "JAH-GEN-" + familyKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) + "-" + n;
}
function solve(familyKey, seed, paramOverrides) {
  var def = byKey(familyKey);
  if (!def) throw new Error("unknown family: " + familyKey);
  var rng = RNG(familyKey + ":" + seed + ":" + JSON.stringify(paramOverrides || {}));
  var P = resolveParams(def, rng, paramOverrides);
  var out = def.solve(rng, P);
  out.id = genId(familyKey, seed);
  out.family = familyKey;
  out.familyName = def.name;
  out.seed = seed;
  out.params = P;
  out.lineage = "Signature line — original concept generated by the Signature system.";
  if (def.safety) out.safety = def.safety;
  return out;
}
function compactRow(o) { return [o.id, o.family, o.seed, o.name, o.tagline]; }
function batch(familyKey, startSeed, count) {
  var out = [];
  for (var s = startSeed; s < startSeed + count; s++) out.push(solve(familyKey, s, null));
  return out;
}
function families() {
  return FAMILIES.map(function (f) {
    return { key: f.key, name: f.name, icon: f.icon, blurb: f.blurb, params: paramDefs(f), safety: f.safety || null };
  });
}

var API = { FAMILIES: FAMILIES, families: families, byKey: byKey, solve: solve, batch: batch, compactRow: compactRow, genId: genId, resolveParams: resolveParams };

/* node CLI: node engine.js families | node engine.js solve <family> <seed> [paramsJSON] | node engine.js batch <family> <start> <count> */
if (typeof module !== "undefined" && typeof require !== "undefined" && require.main === module) {
  var args = process.argv.slice(2);
  var cmd = args[0];
  if (cmd === "families") {
    process.stdout.write(JSON.stringify(API.families(), null, 1));
  } else if (cmd === "solve") {
    var ov = {};
    try { ov = args[3] ? JSON.parse(args[3]) : {}; } catch (e) { ov = {}; }
    process.stdout.write(JSON.stringify(solve(args[1], parseInt(args[2], 10), ov)));
  } else if (cmd === "batch") {
    process.stdout.write(JSON.stringify(batch(args[1], parseInt(args[2], 10), parseInt(args[3], 10))));
  } else if (cmd === "validate") {
    // validate one output per family: every field present, numbers concrete
    var fails = [];
    FAMILIES.forEach(function (f) {
      try {
        var o = solve(f.key, 7, null);
        ["id", "family", "seed", "name", "tagline", "idea", "dimensions", "materials", "colors", "components", "measurements", "how_to_use", "lineage", "params"].forEach(function (k) {
          if (o[k] === undefined || o[k] === null || o[k] === "") fails.push(f.key + ": missing " + k);
        });
        if (!o.dimensions.length || !o.materials.length || !o.colors.length || !o.measurements.length) fails.push(f.key + ": empty solved section");
        o.colors.forEach(function (c) { if (!/^#[0-9a-fA-F]{6}$/.test(c.hex)) fails.push(f.key + ": bad hex " + c.hex); });
        var txt = JSON.stringify(o);
        if (/TBD|XXX|undefined|NaN/.test(txt)) fails.push(f.key + ": placeholder text leaked");
      } catch (e) { fails.push(f.key + ": threw " + e.message); }
    });
    // determinism check
    var a = JSON.stringify(solve("car", 42, null)), b = JSON.stringify(solve("car", 42, null));
    if (a !== b) fails.push("car: not deterministic");
    if (fails.length) { process.stderr.write("FAIL\n" + fails.join("\n") + "\n"); process.exit(1); }
    process.stdout.write("OK " + FAMILIES.length + " families validated, deterministic\n");
  } else {
    process.stderr.write("usage: node engine.js families|solve|batch|validate\n");
    process.exit(2);
  }
}

root.SigGen = API;
})(typeof window !== "undefined" ? window : globalThis);
