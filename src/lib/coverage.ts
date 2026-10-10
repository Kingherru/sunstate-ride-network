// Coverage directory: Florida → Region → County → City.
// Region ids, names and county assignments mirror the regions used by the Florida map
// (src/components/home/FloridaMap.tsx) so the directory and map never disagree.
// No hospital or facility names: none were verified against official sources in Pass 2B.

export type Region = { slug: string; name: string; intro: string; counties: string[] };
export type City = { slug: string; name: string; county: string; title: string; description: string; h1: string; about: string[]; needs: string[]; landmarks?: string[] };

export const REGIONS: Region[] = [
  { slug: "panhandle", name: "Panhandle & Big Bend", intro: "Florida's northwest stretches from Pensacola on the Alabama line through Panama City to the state capital in Tallahassee and the rural Big Bend coast. Long distances between towns make planned trips especially important here.",
    counties: ["Escambia", "Santa Rosa", "Okaloosa", "Walton", "Holmes", "Washington", "Bay", "Jackson", "Calhoun", "Gulf", "Liberty", "Franklin", "Gadsden", "Leon", "Wakulla", "Jefferson", "Madison", "Taylor"] },
  { slug: "northeast", name: "Northeast", intro: "Northeast Florida centers on Jacksonville and the Atlantic coast down through St. Augustine and Palm Coast, with smaller inland communities along the Georgia border and the Suwannee River valley.",
    counties: ["Hamilton", "Suwannee", "Lafayette", "Dixie", "Columbia", "Baker", "Union", "Bradford", "Nassau", "Duval", "Clay", "St. Johns", "Putnam", "Flagler"] },
  { slug: "north-central", name: "North Central", intro: "North Central Florida runs from Gainesville and Ocala to the Nature Coast around Inverness — a mix of university-town neighborhoods, horse country and quiet rural roads.",
    counties: ["Gilchrist", "Alachua", "Levy", "Marion", "Citrus", "Hernando"] },
  { slug: "central", name: "Central", intro: "Central Florida spans the Orlando metro, the Space Coast around Melbourne, Daytona Beach on the Atlantic and Lakeland along I-4 — one of the fastest-growing parts of the state.",
    counties: ["Volusia", "Lake", "Sumter", "Seminole", "Orange", "Osceola", "Brevard", "Polk"] },
  { slug: "tampa-bay", name: "Tampa Bay", intro: "The Tampa Bay region wraps around the bay from Tampa and St. Petersburg south to Sarasota, then inland toward the farm and ranch counties of the Heartland.",
    counties: ["Pasco", "Pinellas", "Hillsborough", "Manatee", "Sarasota", "Hardee", "DeSoto", "Highlands"] },
  { slug: "southwest", name: "Southwest", intro: "Southwest Florida follows the Gulf coast from Port Charlotte through Fort Myers to Naples, with inland communities around Lake Okeechobee's western shore.",
    counties: ["Charlotte", "Lee", "Collier", "Glades", "Hendry"] },
  { slug: "southeast", name: "Southeast & Treasure Coast", intro: "Southeast Florida runs from the Treasure Coast around Port St. Lucie through West Palm Beach, Fort Lauderdale and Miami, then down the Florida Keys to Key West.",
    counties: ["Indian River", "St. Lucie", "Okeechobee", "Martin", "Palm Beach", "Broward", "Miami-Dade", "Monroe"] },
];

const C = (slug: string, name: string, county: string, about: string[], needs: string[], landmarks?: string[]): City => ({
  slug, name, county, about, needs, landmarks,
  title: `NEMT in ${name}, FL — Medical Rides & Wheelchair Transportation | MY FLORIDA NEMT`,
  description: `Request non-emergency medical transportation in ${name}, Florida. Ambulatory, wheelchair and stretcher trip requests are reviewed by participating independent providers.`,
  h1: `NEMT in ${name}`,
});

export const CITIES: City[] = [
  C("pensacola", "Pensacola", "Escambia", ["Pensacola sits on Pensacola Bay in Florida's far western Panhandle, close to the Alabama state line. It is the seat of Escambia County and home to Naval Air Station Pensacola."], ["Trips from Perdido Key, Gulf Breeze or the northern county can involve long drives across bridges, so pickup windows matter.", "Many residents travel between neighborhoods and medical offices clustered near the city's main hospital campuses."]),
  C("panama-city", "Panama City", "Bay", ["Panama City is the seat of Bay County on St. Andrew Bay, a short drive from the beach communities of Panama City Beach."], ["Requests often connect coastal and inland communities across the Hathaway Bridge and US-98.", "Seasonal traffic near the beaches can affect timing, so include appointment times when you request a ride."]),
  C("tallahassee", "Tallahassee", "Leon", ["Tallahassee is Florida's capital and the seat of Leon County, and home to Florida State University and Florida A&M University."], ["Riders from surrounding rural counties such as Gadsden, Wakulla and Jefferson often travel into Tallahassee for specialist care.", "Campus and capitol-area traffic can make specific entrances and drop-off points important to note."]),
  C("jacksonville", "Jacksonville", "Duval", ["Jacksonville is the largest city in Florida by population and by land area; the city and Duval County share a consolidated government. The St. Johns River runs through its center."], ["Distances across the city are large — from the Beaches to the Westside — so exact addresses and entrances help providers plan.", "Requests frequently involve major medical campuses and recurring visits such as dialysis or therapy."]),
  C("st-augustine", "St. Augustine", "St. Johns", ["St. Augustine, the seat of St. Johns County, is the oldest continuously inhabited European-founded city in the continental United States, founded in 1565."], ["Narrow historic streets and limited parking downtown make clear pickup and drop-off instructions especially useful.", "Some riders travel north to Jacksonville for specialist appointments."]),
  C("palm-coast", "Palm Coast", "Flagler", ["Palm Coast is the largest city in Flagler County, a largely residential community between St. Augustine and Daytona Beach along I-95."], ["Trips for specialty care often head north or south along I-95, so include the full destination address and appointment time.", "Recurring appointment schedules can be described in a single request."]),
  C("gainesville", "Gainesville", "Alachua", ["Gainesville is the seat of Alachua County and home to the University of Florida and its academic health center."], ["Riders from surrounding rural counties often travel to Gainesville for specialized care, which can mean long trips with return rides.", "Large campuses make building names and entrances important details."]),
  C("ocala", "Ocala", "Marion", ["Ocala is the seat of Marion County, an area known for its horse farms."], ["Spread-out rural roads mean pickup locations should include gate codes or farm entrances where relevant.", "Riders who no longer drive may depend on planned rides for routine appointments, so recurring schedules can be described in one request."]),
  C("inverness", "Inverness", "Citrus", ["Inverness is the seat of Citrus County on Florida's Nature Coast, set among a chain of lakes along the Withlacoochee River."], ["Trips can be long when care is in larger cities such as Ocala, Gainesville or Tampa, so return-ride needs belong in the request.", "Rural addresses benefit from landmarks or directions in the notes."]),
  C("orlando", "Orlando", "Orange", ["Orlando is the seat of Orange County and the center of a metro area that stretches into Seminole, Osceola and Lake counties along I-4."], ["Heavy I-4 and tourist-corridor traffic makes realistic pickup times essential.", "Requests often involve large hospital campuses with several entrances, so name the building or tower."]),
  C("daytona-beach", "Daytona Beach", "Volusia", ["Daytona Beach is on the Atlantic coast of Volusia County and is known for the Daytona International Speedway and its hard-packed beach."], ["Major events can bring heavy traffic, so mention the date and time clearly.", "Riders on the beachside and the mainland may need to cross one of the Halifax River bridges."]),
  C("melbourne", "Melbourne", "Brevard", ["Melbourne is on the Indian River Lagoon in Brevard County, part of the Space Coast that also includes Cape Canaveral and Titusville."], ["Brevard County is long and narrow, so trips from the north or south ends of the county can take time.", "Barrier-island addresses may need a bridge crossing to reach mainland offices."]),
  C("lakeland", "Lakeland", "Polk", ["Lakeland is the largest city in Polk County, roughly midway between Tampa and Orlando on I-4, and is known for its many lakes."], ["Polk is a large county, so trips from rural towns into Lakeland or out to Tampa or Orlando can be long.", "Include whether you need a return ride and how long the appointment may last."]),
  C("tampa", "Tampa", "Hillsborough", ["Tampa is the seat of Hillsborough County on the east side of Tampa Bay,."], ["Bridge crossings to Pinellas County and rush-hour traffic make timing important.", "Large hospital campuses often have several entrances, so name the building or entrance you need."]),
  C("st-petersburg", "St. Petersburg", "Pinellas", ["St. Petersburg is the largest city in Pinellas County, on a peninsula between Tampa Bay and the Gulf of Mexico."], ["Pinellas is densely built, and trips to Tampa usually cross the Howard Frankland, Gandy or Courtney Campbell bridges.", "Beach-community addresses benefit from building names and parking instructions."]),
  C("sarasota", "Sarasota", "Sarasota", ["Sarasota is the seat of Sarasota County on the Gulf coast, with barrier-island communities such as Siesta Key and Longboat Key nearby."], ["If the rider uses a cane, walker or wheelchair, include it in the request so providers can plan.", "Island addresses may involve drawbridges that affect timing."]),
  C("fort-myers", "Fort Myers", "Lee", ["Fort Myers is the seat of Lee County on the Caloosahatchee River, near Cape Coral, Bonita Springs and the barrier islands of Sanibel and Fort Myers Beach."], ["River and bridge crossings between Fort Myers and Cape Coral can shape travel time.", "Seasonal population growth in winter can affect traffic and scheduling."]),
  C("naples", "Naples", "Collier", ["Naples is on the Gulf coast in Collier County, the southern gateway to the Everglades and Big Cypress National Preserve."], ["Collier is large, and trips from Immokalee or Everglades City into Naples can be long.", "Gated communities often require gate codes or guest registration — add them to the notes."]),
  C("port-charlotte", "Port Charlotte", "Charlotte", ["Port Charlotte is the largest community in Charlotte County, on Charlotte Harbor between Sarasota and Fort Myers."], ["Some riders travel north to Sarasota or south to Fort Myers for specialty care, which can mean longer round trips.", "Mention mobility aids and assistance needs, as many riders are older adults."]),
  C("miami", "Miami", "Miami-Dade", ["Miami is the seat of Miami-Dade County, Florida's most populous county."], ["Dense traffic and large medical districts mean precise addresses and entrance details matter.", "Note the rider's preferred language in the request if it is not English."]),
  C("fort-lauderdale", "Fort Lauderdale", "Broward", ["Fort Lauderdale is the seat of Broward County, known for its canals and coastline, between Miami and West Palm Beach."], ["I-95 and US-1 traffic can be heavy, so allow realistic pickup windows.", "Waterfront and high-rise addresses often need tower, unit or valet details."]),
  C("west-palm-beach", "West Palm Beach", "Palm Beach", ["West Palm Beach is the seat of Palm Beach County, across the Lake Worth Lagoon from the town of Palm Beach."], ["Palm Beach County stretches west to Lake Okeechobee, so trips from the western communities into West Palm Beach can be long.", "Coastal and island addresses may require bridge crossings."]),
  C("port-st-lucie", "Port St. Lucie", "St. Lucie", ["Port St. Lucie is the largest city in St. Lucie County and on the Treasure Coast."], ["Trips frequently run between Port St. Lucie, Fort Pierce and Stuart, or south to Palm Beach County for specialty care.", "Recurring appointment schedules can be described in one request."]),
  C("key-west", "Key West", "Monroe", ["Key West is at the end of the Florida Keys, the southernmost city in the continental United States, linked to the mainland by the Overseas Highway (US-1)."], ["Specialty care on the mainland can mean a long drive up the Overseas Highway, so plan well ahead and describe return needs.", "Old Town's narrow streets make exact pickup points important."]),
];

export const slugify = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const regionOfCounty = (county: string) => REGIONS.find((r) => r.counties.includes(county));
export const citiesInCounty = (county: string) => CITIES.filter((c) => c.county === county);
/** County pages exist only where at least one city page exists (avoids thin pages). */
export const countiesWithPages = () => [...new Set(CITIES.map((c) => c.county))];
export const findRegion = (slug: string) => REGIONS.find((r) => r.slug === slug);
export const findCounty = (region: Region, slug: string) => region.counties.find((c) => slugify(c) === slug && citiesInCounty(c).length > 0);
export const countyPath = (county: string) => `/florida-coverage/${regionOfCounty(county)!.slug}/${slugify(county)}-county`;
export const cityPath = (c: City) => `${countyPath(c.county)}/${c.slug}`;
export const coveragePaths = () => [
  ...REGIONS.map((r) => `/florida-coverage/${r.slug}`),
  ...countiesWithPages().map(countyPath),
  ...CITIES.map(cityPath),
];
