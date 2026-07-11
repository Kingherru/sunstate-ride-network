export type CitySlug =
  | "jacksonville"
  | "orlando"
  | "tampa"
  | "miami"
  | "tallahassee"
  | "fort-lauderdale"
  | "gainesville"
  | "daytona-beach"
  | "southwest-florida";

export interface CityService {
  name: string;
  slug: "ambulatory" | "wheelchair" | "stretcher";
  headline: string;
  copy: string;
}

export interface CityInfo {
  slug: CitySlug;
  name: string;
  code: string;
  region: string;
  blurb: string;
  highlights: string[];
  hubs: string[];
  seoTitle: string;
  seoDescription: string;
  intro: string;
  services: CityService[];
  neighborhoods: string[];
}

const svc = (city: string) => (opts: {
  slug: CityService["slug"];
  name: string;
  headline: string;
  copy: string;
}): CityService => ({ ...opts, headline: opts.headline.replace("{city}", city), copy: opts.copy.replace(/\{city\}/g, city) });

function buildServices(city: string): CityService[] {
  const b = svc(city);
  return [
    b({
      slug: "ambulatory",
      name: "Ambulatory Transportation",
      headline: "Ambulatory rides in {city}",
      copy: "Safe, on-time rides in {city} for passengers who can walk independently or need minimal assistance — doctor visits, dialysis, therapy, and follow-up appointments.",
    }),
    b({
      slug: "wheelchair",
      name: "Wheelchair Transportation",
      headline: "Wheelchair transport in {city}",
      copy: "ADA-compliant lift-equipped vans across {city} for passengers who remain in their wheelchair during travel. Secure four-point tie-down and trained attendants on every ride.",
    }),
    b({
      slug: "stretcher",
      name: "Gurney & Stretcher Transportation",
      headline: "Gurney & stretcher transport in {city}",
      copy: "Bed-to-bed non-emergency transport in {city} for patients who cannot safely travel seated — hospital discharges, SNF transfers, and specialty appointments.",
    }),
  ];
}

export const CITIES: Record<CitySlug, CityInfo> = {
  jacksonville: {
    slug: "jacksonville",
    name: "Jacksonville",
    code: "JAX-01",
    region: "Northeast Florida",
    blurb:
      "Serving Duval, Clay, St. Johns, and Nassau counties with prompt non-emergency medical transport for Mayo Clinic, Baptist Health, UF Health, and Ascension St. Vincent's networks.",
    highlights: [
      "Mayo Clinic Jacksonville transfers",
      "Baptist Health & UF Health discharge runs",
      "Beaches to Westside coverage",
    ],
    hubs: ["Mayo Clinic", "Baptist Medical Center", "UF Health Jacksonville", "Ascension St. Vincent's"],
    seoTitle: "NEMT in Jacksonville, FL | Ambulatory, Wheelchair & Stretcher Transport",
    seoDescription:
      "Non-emergency medical transportation in Jacksonville, FL. Ambulatory, wheelchair, and stretcher rides to Mayo Clinic, Baptist Health, UF Health, and Ascension St. Vincent's — Medicaid, insurance, and private pay accepted.",
    intro:
      "My Florida NEMT connects Jacksonville patients with vetted non-emergency medical transportation providers across Duval, Clay, St. Johns, and Nassau counties. From Mayo Clinic transfers to dialysis rounds on the Westside, our network delivers HIPAA-trained drivers, on-time pickups, and Medicaid billing handled end-to-end.",
    services: buildServices("Jacksonville"),
    neighborhoods: ["Downtown", "Southside", "Westside", "Beaches", "Mandarin", "Orange Park", "St. Augustine"],
  },
  orlando: {
    slug: "orlando",
    name: "Orlando",
    code: "ORL-02",
    region: "Central Florida",
    blurb:
      "Central Florida's medical corridor — AdventHealth and Orlando Health complexes, Lake Nona Medical City, and the I-4 spine through Kissimmee, Sanford, and Lake County.",
    highlights: [
      "AdventHealth & Orlando Health transfers",
      "Lake Nona Medical City coverage",
      "Theme park resort medical pickups",
    ],
    hubs: ["AdventHealth Orlando", "Orlando Health ORMC", "Nemours Children's", "Lake Nona Medical City"],
    seoTitle: "NEMT in Orlando, FL | Non-Emergency Medical Transportation Services",
    seoDescription:
      "Reliable NEMT in Orlando, FL — ambulatory, wheelchair, and stretcher transportation to AdventHealth, Orlando Health, Nemours, and Lake Nona Medical City. Statewide dispatch, Medicaid & insurance billing.",
    intro:
      "My Florida NEMT serves the entire Orlando metro, from Lake Nona Medical City to the I-4 corridor through Kissimmee, Sanford, and Lake County. Providers in our network run scheduled dialysis rounds, same-day discharges, and specialty appointments for AdventHealth, Orlando Health, and Nemours Children's Hospital.",
    services: buildServices("Orlando"),
    neighborhoods: ["Downtown Orlando", "Lake Nona", "Winter Park", "Kissimmee", "Sanford", "Apopka", "Dr. Phillips"],
  },
  tampa: {
    slug: "tampa",
    name: "Tampa",
    code: "TPA-03",
    region: "Gulf Coast",
    blurb:
      "Tampa Bay coverage spanning Hillsborough, Pinellas, and Pasco — including Tampa General, Moffitt Cancer Center, BayCare, and the St. Petersburg medical district.",
    highlights: [
      "Moffitt Cancer Center patient runs",
      "Tampa General & BayCare network",
      "Bridge-aware Pinellas/Hillsborough routing",
    ],
    hubs: ["Tampa General Hospital", "Moffitt Cancer Center", "AdventHealth Tampa", "BayCare Health System"],
    seoTitle: "NEMT in Tampa Bay, FL | Medical Transportation to Moffitt & Tampa General",
    seoDescription:
      "Tampa Bay NEMT — ambulatory, wheelchair, and stretcher transport across Hillsborough, Pinellas, and Pasco. Vetted providers serving Tampa General, Moffitt Cancer Center, AdventHealth Tampa, and BayCare.",
    intro:
      "My Florida NEMT covers Tampa Bay from Wesley Chapel to St. Petersburg with bridge-aware routing across Pinellas and Hillsborough. Providers handle recurring Moffitt Cancer Center oncology runs, Tampa General discharges, and dialysis schedules for BayCare and AdventHealth patients.",
    services: buildServices("Tampa"),
    neighborhoods: ["Downtown Tampa", "South Tampa", "Brandon", "Wesley Chapel", "St. Petersburg", "Clearwater", "Riverview"],
  },
  miami: {
    slug: "miami",
    name: "Miami",
    code: "MIA-04",
    region: "South Florida",
    blurb:
      "Miami-Dade coverage including Jackson Health System, University of Miami Health, Baptist Health South Florida, and the Aventura/Miami Beach corridors.",
    highlights: [
      "Jackson Memorial & UM Health transfers",
      "Bilingual EN/ES dispatch and drivers",
      "Aventura, Coral Gables, Kendall coverage",
    ],
    hubs: ["Jackson Memorial Hospital", "UHealth", "Baptist Health South Florida", "Mount Sinai Miami Beach"],
    seoTitle: "NEMT in Miami, FL | Bilingual Medical Transportation Services",
    seoDescription:
      "Miami-Dade NEMT with bilingual EN/ES dispatch. Ambulatory, wheelchair, and stretcher transport to Jackson Memorial, UHealth, Baptist Health South Florida, and Mount Sinai Miami Beach.",
    intro:
      "My Florida NEMT delivers bilingual (English/Spanish) non-emergency medical transportation across Miami-Dade — from Kendall to Aventura, Coral Gables to Miami Beach. Our providers coordinate with Jackson Health System, UHealth, and Baptist Health South Florida for transfers, dialysis, and specialty visits.",
    services: buildServices("Miami"),
    neighborhoods: ["Downtown Miami", "Miami Beach", "Coral Gables", "Kendall", "Aventura", "Doral", "Homestead"],
  },
  tallahassee: {
    slug: "tallahassee",
    name: "Tallahassee",
    code: "TLH-05",
    region: "Florida Panhandle",
    blurb:
      "Capital region transport across Leon, Gadsden, Jefferson, and Wakulla — Tallahassee Memorial, Capital Regional Medical Center, and HCA Florida facilities.",
    highlights: [
      "Tallahassee Memorial transfers",
      "Capital Regional Medical Center",
      "Long-distance Panhandle transport",
    ],
    hubs: ["Tallahassee Memorial Healthcare", "Capital Regional Medical Center", "HCA Florida Capital Hospital"],
    seoTitle: "NEMT in Tallahassee, FL | Capital Region Medical Transportation",
    seoDescription:
      "Non-emergency medical transportation in Tallahassee and the Florida Panhandle. Ambulatory, wheelchair, and stretcher rides to Tallahassee Memorial, Capital Regional, and HCA Florida Capital Hospital.",
    intro:
      "My Florida NEMT serves Tallahassee and the surrounding Panhandle — Leon, Gadsden, Jefferson, and Wakulla counties — with long-distance capacity for referrals to Gainesville and Jacksonville specialty centers. Providers handle recurring dialysis, discharges, and rural transports.",
    services: buildServices("Tallahassee"),
    neighborhoods: ["Downtown Tallahassee", "Midtown", "Killearn", "Southwood", "Quincy", "Crawfordville", "Monticello"],
  },
  "fort-lauderdale": {
    slug: "fort-lauderdale",
    name: "Fort Lauderdale",
    code: "FLL-06",
    region: "Broward County",
    blurb:
      "Broward County NEMT covering Broward Health, Memorial Healthcare System, Holy Cross Health, and the Pompano-to-Hollywood medical corridor.",
    highlights: [
      "Broward Health & Memorial transfers",
      "Cruise port discharge transports",
      "Coral Springs to Hollywood coverage",
    ],
    hubs: ["Broward Health Medical Center", "Memorial Regional Hospital", "Holy Cross Health"],
    seoTitle: "NEMT in Fort Lauderdale, FL | Broward County Medical Transportation",
    seoDescription:
      "Fort Lauderdale NEMT — ambulatory, wheelchair, and stretcher transport across Broward County. Vetted providers serving Broward Health, Memorial Healthcare, and Holy Cross Health with Medicaid billing.",
    intro:
      "My Florida NEMT covers all of Broward County — from Coral Springs and Pompano Beach down to Hollywood and Hallandale. Providers coordinate discharges from Broward Health and Memorial Regional, cruise port medical pickups, and recurring dialysis routes.",
    services: buildServices("Fort Lauderdale"),
    neighborhoods: ["Downtown Fort Lauderdale", "Coral Springs", "Pompano Beach", "Hollywood", "Plantation", "Sunrise", "Weston"],
  },
  gainesville: {
    slug: "gainesville",
    name: "Gainesville",
    code: "GNV-07",
    region: "North Central Florida",
    blurb:
      "North Central My Florida NEMT centered on UF Health Shands and the VA Medical Center, serving Alachua, Marion, and surrounding counties with long-distance specialty transfers.",
    highlights: [
      "UF Health Shands transfers",
      "Malcom Randall VA Medical Center",
      "Ocala & Lake City long-distance runs",
    ],
    hubs: ["UF Health Shands", "North Florida Regional Medical Center", "Malcom Randall VA Medical Center"],
    seoTitle: "NEMT in Gainesville, FL | UF Health Shands Medical Transportation",
    seoDescription:
      "Gainesville NEMT with long-distance specialty transfer capacity. Ambulatory, wheelchair, and stretcher transport to UF Health Shands, North Florida Regional, and Malcom Randall VA.",
    intro:
      "My Florida NEMT connects Alachua, Marion, and surrounding North Central Florida counties to UF Health Shands and the Malcom Randall VA Medical Center. Providers specialize in long-distance specialty referral transports from Ocala, Lake City, and beyond.",
    services: buildServices("Gainesville"),
    neighborhoods: ["Downtown Gainesville", "Haile Plantation", "Jonesville", "Alachua", "Newberry", "Ocala", "Lake City"],
  },
  "daytona-beach": {
    slug: "daytona-beach",
    name: "Daytona Beach",
    code: "DAB-08",
    region: "Central Florida",
    blurb:
      "Volusia and Flagler County NEMT — AdventHealth Daytona Beach, Halifax Health, and the I-95 corridor from Ormond Beach to New Smyrna and Palm Coast.",
    highlights: [
      "Halifax Health Medical Center transfers",
      "AdventHealth Daytona Beach discharge runs",
      "Palm Coast & New Smyrna coverage",
    ],
    hubs: ["Halifax Health Medical Center", "AdventHealth Daytona Beach", "AdventHealth Palm Coast"],
    seoTitle: "NEMT in Daytona Beach, FL | Volusia County Medical Transportation",
    seoDescription:
      "Daytona Beach NEMT — ambulatory, wheelchair, and stretcher transport across Volusia and Flagler. Vetted providers serving Halifax Health, AdventHealth Daytona Beach, and AdventHealth Palm Coast.",
    intro:
      "My Florida NEMT covers Volusia and Flagler counties along the I-95 corridor from Ormond Beach to New Smyrna and Palm Coast. Providers handle Halifax Health discharges, AdventHealth transfers, and recurring dialysis schedules.",
    services: buildServices("Daytona Beach"),
    neighborhoods: ["Daytona Beach", "Ormond Beach", "Port Orange", "New Smyrna Beach", "Deland", "Palm Coast", "Deltona"],
  },
  "southwest-florida": {
    slug: "southwest-florida",
    name: "Southwest Florida",
    code: "SWFL-09",
    region: "Southwest Florida",
    blurb:
      "Lee, Collier, and Charlotte County NEMT covering Fort Myers, Cape Coral, Naples, and Bonita Springs — Lee Health, NCH Healthcare, and Physicians Regional networks.",
    highlights: [
      "Lee Health & NCH Healthcare transfers",
      "Naples to Fort Myers corridor",
      "Snowbird season surge capacity",
    ],
    hubs: ["Lee Memorial Hospital", "NCH Baker Hospital Downtown", "Physicians Regional Healthcare", "HealthPark Medical Center"],
    seoTitle: "NEMT in Southwest Florida | Fort Myers, Naples & Cape Coral Transport",
    seoDescription:
      "Southwest Florida NEMT across Lee, Collier, and Charlotte — ambulatory, wheelchair, and stretcher transport to Lee Health, NCH Healthcare, and Physicians Regional networks.",
    intro:
      "My Florida NEMT serves Southwest Florida from Cape Coral and Fort Myers to Naples and Bonita Springs, with surge capacity for snowbird season. Providers coordinate with Lee Health, NCH Healthcare, and Physicians Regional for scheduled and same-day transports.",
    services: buildServices("Southwest Florida"),
    neighborhoods: ["Fort Myers", "Cape Coral", "Naples", "Bonita Springs", "Estero", "Marco Island", "Port Charlotte"],
  },
};

export const CITY_LIST = Object.values(CITIES);
