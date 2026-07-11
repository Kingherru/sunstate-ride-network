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

export interface CityInfo {
  slug: CitySlug;
  name: string;
  code: string;
  region: string;
  blurb: string;
  highlights: string[];
  hubs: string[];
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
  },
};

export const CITY_LIST = Object.values(CITIES);
