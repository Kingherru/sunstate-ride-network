// Florida NEMT blog content — pillar articles seeded for the blog engine.
// Structured blocks keep authoring type-safe and avoid a runtime markdown parser.

export type Category =
  | "Patient Resources"
  | "Provider Resources"
  | "Medicaid Information"
  | "Caregiver Guides"
  | "Industry News"
  | "Training & Education"
  | "Florida Transportation Resources";

export const CATEGORIES: Category[] = [
  "Patient Resources",
  "Provider Resources",
  "Medicaid Information",
  "Caregiver Guides",
  "Industry News",
  "Training & Education",
  "Florida Transportation Resources",
];

export type Block =
  | { t: "p"; c: string }
  | { t: "h2"; c: string }
  | { t: "h3"; c: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "quote"; c: string; cite?: string }
  | { t: "cta"; heading: string; body: string; to: "/request-a-ride" | "/join-our-network" | "/services" | "/contact" | "/training"; label: string };

export type Post = {
  slug: string;
  category: Category;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  publishedAt: string; // ISO date
  readMinutes: number;
  author: string;
  // Gradient key drives the cover image style (no asset generation required).
  cover: "navy" | "peach" | "sunset" | "forest" | "cobalt" | "coral" | "sand";
  keywords: string[];
  related: string[]; // slugs
  body: Block[];
};

// ---------------------------------------------------------------------------
// Pillar articles — one per required category
// ---------------------------------------------------------------------------

export const POSTS: Post[] = [
  {
    slug: "patient-guide-nemt-florida",
    category: "Patient Resources",
    title: "A Patient's Guide to Non-Emergency Medical Transportation in Florida",
    metaTitle: "NEMT in Florida: A Patient's Guide to Rides, Costs & Booking",
    metaDescription:
      "How Florida patients book non-emergency medical transportation, what Medicaid covers, and what to expect from a NEMT ride — dialysis, therapy, specialist visits, and more.",
    excerpt:
      "Missed appointments cost your health. Learn how non-emergency medical transportation works in Florida — who qualifies, what it costs, and how to book a ride you can rely on.",
    publishedAt: "2026-06-05",
    readMinutes: 8,
    author: "Florida NEMT Editorial Team",
    cover: "cobalt",
    keywords: [
      "non emergency medical transportation Florida",
      "NEMT Florida",
      "medical transportation for patients",
      "how to book NEMT",
      "Medicaid ride Florida",
    ],
    related: ["medicaid-transportation-florida", "caregiver-guide-medical-transport", "hospital-nursing-home-transport-florida"],
    body: [
      { t: "p", c: "Getting to a dialysis chair, a chemo infusion, or a follow-up with your cardiologist should not depend on whether a family member has the day off. Non-emergency medical transportation — usually shortened to NEMT — exists so that Floridians who cannot safely drive themselves still make it to every appointment. This guide explains how NEMT works across the state, who qualifies, what it costs, and how to book a ride you can actually count on." },

      { t: "h2", c: "What is non-emergency medical transportation?" },
      { t: "p", c: "NEMT is scheduled ground transportation for patients who need medical care but do not need an ambulance. That covers a wide range of trips: recurring dialysis three days a week, physical-therapy appointments after surgery, mental-health visits, dental work, wound-care follow-ups, and discharges from a hospital back home or to a skilled nursing facility. If you can wait for a scheduled pickup and you are not experiencing an emergency, NEMT is almost always the right level of transportation." },
      { t: "p", c: "Florida providers operate three basic vehicle types. Ambulatory sedans and SUVs move patients who can walk with limited assistance. Wheelchair-accessible vans use hydraulic lifts or ramps and secure the chair with four-point tie-downs. Stretcher-capable vehicles carry patients who need to remain lying down but are medically stable." },

      { t: "h2", c: "Who qualifies for a Medicaid-paid NEMT ride in Florida?" },
      { t: "p", c: "Florida Medicaid covers NEMT for enrolled beneficiaries who have no other way to reach a Medicaid-covered service. The state contracts with managed-care plans (Sunshine Health, Simply, Humana, Aetna Better Health, Molina, United, and others) and each plan uses a transportation broker to authorize rides. If you are Medicaid-eligible, you already have this benefit — it is not an extra you need to buy." },
      { t: "ul", items: [
        "You must be enrolled in Florida Medicaid or a Medicaid managed-care plan.",
        "The appointment must be for a Medicaid-covered service.",
        "You must not have another reasonable way to get there (no car, no licensed driver in the household, physically unable to use public transit).",
        "Trips generally have to be scheduled at least three business days ahead, except discharges and urgent same-day medical needs.",
      ]},

      { t: "h2", c: "What if I have Medicare, private insurance, or workers' comp?" },
      { t: "p", c: "Traditional Medicare Part B does not cover NEMT. Many Medicare Advantage plans do, as a supplemental benefit — check your Evidence of Coverage or call the number on your card. Workers' compensation insurers routinely authorize NEMT for injured workers attending IME appointments, physical therapy, and specialist referrals. Private-pay patients can book any Florida NEMT provider directly; ambulatory rates typically run $35–$65 base plus a per-mile charge, with wheelchair and stretcher runs priced higher because of the specialized vehicle." },

      { t: "h2", c: "How to book a ride, step by step" },
      { t: "ol", items: [
        "Confirm your appointment date, time, and full pickup and drop-off addresses.",
        "If you are on Medicaid or Medicare Advantage, call the transportation number on the back of your insurance card and give them the appointment details.",
        "Ask for the trip confirmation number, the provider name, and the pickup window. Write these down.",
        "Be ready 15 minutes before the pickup window opens. Bring your ID, insurance card, and any paperwork the clinic asked for.",
        "If the ride does not arrive within the window, call the broker back and ask them to dispatch a backup provider — this is a routine request, not a complaint.",
      ]},

      { t: "h2", c: "What a good NEMT experience looks like" },
      { t: "p", c: "A professional Florida NEMT provider will call or text before pickup, arrive in a marked vehicle with a visibly ID-badged driver, help you into the seat or secure your wheelchair, and give you a written pickup time for the return trip. The driver should be quiet, courteous, and never leave you unattended at a hospital entrance. If any of that is missing — late arrivals, no-shows, unsafe driving, unprofessional behavior — you have the right to switch providers." },

      { t: "h2", c: "When to request a new provider" },
      { t: "p", c: "You do not have to accept poor service. Late pickups that make you miss dialysis, drivers who refuse to help with your wheelchair, unsafe vehicles, or repeated no-shows are all grounds to request a change. Call your plan's transportation broker, state the trip dates and what happened, and ask for a different provider to be assigned going forward. Keep a short log of dates and issues in case you need to escalate." },

      { t: "cta", heading: "Need a ride now?", body: "Request a verified Florida NEMT provider in your county. We match you with the right vehicle type — ambulatory, wheelchair, or stretcher — and confirm within minutes.", to: "/request-a-ride", label: "Request a Ride" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "provider-onboarding-guide",
    category: "Provider Resources",
    title: "How to Join the Florida NEMT Provider Network: A Complete 2026 Guide",
    metaTitle: "Join a Florida NEMT Network: Credentials, Contracts, Rates (2026)",
    metaDescription:
      "Everything a Florida NEMT operator needs to join a provider network in 2026 — AHCA registration, insurance minimums, vehicle standards, credentialing, and how trips are dispatched.",
    excerpt:
      "AHCA registration, insurance, vehicle inspections, credentialing, and dispatch — a practical 2026 guide for Florida NEMT operators who want steady contract volume.",
    publishedAt: "2026-06-10",
    readMinutes: 10,
    author: "Florida NEMT Editorial Team",
    cover: "peach",
    keywords: [
      "NEMT provider Florida",
      "start NEMT business Florida",
      "AHCA transportation registration",
      "join NEMT network",
      "Medicaid transportation broker Florida",
    ],
    related: ["nemt-industry-trends-2026", "driver-training-hipaa-safety", "medicaid-transportation-florida"],
    body: [
      { t: "p", c: "Florida's NEMT market is one of the largest in the country, and managed-care plans are actively looking for reliable operators outside the big three metros. If you already run a compliant fleet — or you are close — joining a provider network is the fastest way to fill a schedule without spending months on direct-to-consumer marketing. This guide walks through the paperwork, the credentials, and the operational standards you need to meet to get contracted in 2026." },

      { t: "h2", c: "Step 1 — Get your business set up correctly" },
      { t: "p", c: "You need an LLC or corporation registered with Sunbiz, a federal EIN, and a Florida sales-and-use-tax certificate if you plan to bill any private-pay trips. Open a dedicated business bank account before you take your first payout — mixing personal and business funds is the number-one bookkeeping problem we see with new operators. If you plan to bill Medicaid managed-care plans directly, you will also need a Medicaid provider number and, for many plan contracts, an NPI." },

      { t: "h2", c: "Step 2 — AHCA registration and county permits" },
      { t: "p", c: "Florida's Agency for Health Care Administration regulates NEMT under Chapter 408 and Chapter 411, F.S. Most transportation companies that carry Medicaid-funded passengers must register with AHCA and maintain a valid Health Care Clinic license or an exemption on file. Some counties (Miami-Dade, Broward, Hillsborough) require additional local vehicle-for-hire permits — check with your county's Consumer Services Department before you buy vehicles." },

      { t: "h2", c: "Step 3 — Insurance that networks will actually accept" },
      { t: "p", c: "Networks and brokers publish minimum insurance limits and they do check the certificates. Expect to carry:" },
      { t: "ul", items: [
        "Commercial auto liability at $1,000,000 combined single limit (some Medicaid plans require $1.5M or split limits).",
        "Non-owned and hired auto coverage on the same policy.",
        "General liability at $1,000,000 per occurrence / $2,000,000 aggregate.",
        "Workers' compensation for all W-2 drivers and dispatchers.",
        "Umbrella coverage — $2M or $5M — becomes a hard requirement once you contract with hospital systems.",
      ]},
      { t: "p", c: "Name the broker or plan as an additional insured when they ask. Your COI must show the correct policy numbers and effective dates or you will be rejected during credentialing." },

      { t: "h2", c: "Step 4 — Vehicles that pass inspection" },
      { t: "p", c: "Every vehicle in your fleet needs a current Florida registration, a valid FHP or third-party safety inspection on file, and — for wheelchair or stretcher units — a documented ADA compliance inspection covering ramp slope, tie-down anchors, and lift capacity. Keep before-and-after photos of the interior and exterior on your driver-app or dispatch system; brokers ask for them during audits." },

      { t: "h2", c: "Step 5 — Driver credentialing" },
      { t: "p", c: "Every driver you dispatch needs, at minimum: a valid Florida CDL or E-endorsement (depending on vehicle GVWR and passenger count), a Level 2 background check through the Florida Department of Law Enforcement, a current DOT medical card, defensive-driving certification, PASS or a comparable passenger-service-and-safety course, First Aid/CPR, HIPAA training, and bloodborne-pathogens training. Store copies of every certificate with expiry dates in one place — a credentialing tracker is not optional." },

      { t: "h2", c: "Step 6 — Get contracted with brokers and networks" },
      { t: "p", c: "In Florida, most Medicaid managed-care rides flow through a small number of brokers (Modivcare, Access2Care, Verida, MTM, and a handful of plan-owned dispatch centers). Each broker has its own credentialing packet, rate sheet, and IT integration. Complete each packet in full — half-finished applications sit in a queue indefinitely. Expect 30–90 days from submission to first dispatched trip." },

      { t: "h2", c: "Step 7 — Operate to the standard the plans measure" },
      { t: "p", c: "Once you are dispatched, you are graded on on-time performance, no-show rate, complaint rate, and billing accuracy. Providers who hit 95%+ on-time and keep complaint rates below 1% get more volume, priority routing, and eventually direct contracts with the plans themselves. That is where the margin is." },

      { t: "cta", heading: "Ready to join a Florida NEMT network?", body: "Skip the broker-by-broker paperwork. Apply once through Florida NEMT and get access to trips across every major managed-care plan.", to: "/join-our-network", label: "Apply to Join" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "medicaid-transportation-florida",
    category: "Medicaid Information",
    title: "Medicaid Non-Emergency Medical Transportation in Florida: Benefits, Eligibility, and Booking",
    metaTitle: "Florida Medicaid Transportation (NEMT): Rules, Benefits & Booking",
    metaDescription:
      "How Florida Medicaid NEMT works: who is eligible, which appointments are covered, how to book through your managed-care plan's transportation broker, and what to do if a ride is denied.",
    excerpt:
      "A plain-English walkthrough of Florida Medicaid's transportation benefit — eligibility rules, covered appointment types, booking timelines, and what to do when a ride is denied.",
    publishedAt: "2026-06-15",
    readMinutes: 9,
    author: "Florida NEMT Editorial Team",
    cover: "navy",
    keywords: [
      "Florida Medicaid transportation",
      "Medicaid NEMT rules",
      "Sunshine Health transportation",
      "Simply Healthcare rides",
      "how to book Medicaid ride Florida",
    ],
    related: ["patient-guide-nemt-florida", "hospital-nursing-home-transport-florida", "caregiver-guide-medical-transport"],
    body: [
      { t: "p", c: "If you or a family member are enrolled in Florida Medicaid, transportation to and from medical care is already part of the benefit package. Most people never learn that until they need it — and by then, they are calling the wrong number and getting bounced between offices. This guide lays out exactly how Florida's Medicaid NEMT benefit works in 2026: who is eligible, what the plans have to cover, how to book, and what to do when something goes wrong." },

      { t: "h2", c: "Who provides the ride: the plan, not the state" },
      { t: "p", c: "Nearly every Florida Medicaid beneficiary is enrolled in a Statewide Medicaid Managed Care (SMMC) plan. Those plans — Sunshine Health, Simply Healthcare, Humana Healthy Horizons, Aetna Better Health, Molina, United, Community Care Plan, and a few regional plans — are required by AHCA contract to arrange non-emergency transportation for their members. Each plan hires a transportation broker, and the broker dispatches the trip to a local NEMT provider. You do not choose your broker; you inherit it from your plan." },

      { t: "h2", c: "What appointments are covered" },
      { t: "p", c: "Any Medicaid-covered service qualifies. That includes:" },
      { t: "ul", items: [
        "Primary care and specialist visits",
        "Dialysis (the largest single category of NEMT trips in Florida)",
        "Chemotherapy and radiation",
        "Behavioral health and substance-use treatment",
        "Dental services covered under Medicaid",
        "Pharmacy pickups when tied to a covered visit",
        "Hospital admissions, discharges, and inter-facility transfers",
        "Wound care, infusion therapy, and physical/occupational therapy",
      ]},
      { t: "p", c: "Rides to non-medical destinations — the grocery store, church, the DMV — are not covered under standard Medicaid NEMT, though some Medicaid Long-Term Care waiver programs and some Medicare Advantage plans add limited non-medical benefits." },

      { t: "h2", c: "Eligibility: the 'no other means' rule" },
      { t: "p", c: "Medicaid pays for a ride when you have no other reasonable way to get to your appointment. In practice, that means the plan will ask whether anyone in the household has a working vehicle, whether you are physically able to use public transit, and whether a family member or friend can drive you. Answer honestly. Beneficiaries who need wheelchair-accessible or stretcher transportation almost always qualify because those services are not something a friend with a sedan can provide." },

      { t: "h2", c: "How to book, and how far in advance" },
      { t: "p", c: "Call the transportation number on the back of your Medicaid card — not the general member-services number. Have the following ready: your Medicaid ID, the exact date and time of the appointment, the clinic address, the provider name, and whether you need wheelchair or stretcher transport. Most plans require at least three business days' notice for routine trips. Same-day and next-day requests are honored for urgent medical needs and discharges." },

      { t: "h2", c: "Recurring trips are easier than one-offs" },
      { t: "p", c: "If you have dialysis three times a week or physical therapy every Tuesday and Thursday, ask the broker to set up a standing order. The broker will assign the same provider for the whole authorization period, which usually cuts wait times and no-shows dramatically. Renew the standing order when the doctor updates the plan of care." },

      { t: "h2", c: "What to do if a ride is denied or missed" },
      { t: "p", c: "If the plan denies a trip request, ask for the denial in writing and the reason code. Common denial reasons include missing prior authorization, the appointment being for a non-covered service, or the beneficiary having other transportation available. You have the right to file a grievance and, if the denial is upheld, request a Medicaid Fair Hearing. If the ride was authorized but never arrived, call the broker back within 24 hours and file a service complaint — those complaints feed directly into provider performance scores." },

      { t: "h2", c: "Long-distance and out-of-county trips" },
      { t: "p", c: "Florida Medicaid covers medically necessary long-distance transportation when the required specialty is not available closer to home — a rural patient traveling to Shands or Mayo, for example. These trips need prior authorization and usually a letter from the treating physician documenting medical necessity. Plan ahead; approvals routinely take five to ten business days." },

      { t: "cta", heading: "Book your Medicaid ride the easy way", body: "Florida NEMT works with providers contracted to every major Medicaid managed-care plan. Request a ride and we'll route your trip to the right dispatcher.", to: "/request-a-ride", label: "Request a Ride" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "caregiver-guide-medical-transport",
    category: "Caregiver Guides",
    title: "The Caregiver's Handbook to Booking Safe Medical Transportation",
    metaTitle: "Caregiver's Guide to Medical Transportation in Florida",
    metaDescription:
      "A practical Florida caregiver's guide to booking, coordinating, and following up on non-emergency medical transportation for elderly parents, adult children, and chronic-care patients.",
    excerpt:
      "You are already coordinating meds, appointments, and paperwork. Here is how to make medical transportation the easiest part of caregiving instead of the hardest.",
    publishedAt: "2026-06-20",
    readMinutes: 8,
    author: "Florida NEMT Editorial Team",
    cover: "sand",
    keywords: [
      "caregiver medical transport",
      "book NEMT for parent Florida",
      "wheelchair transport family caregiver",
      "help elderly parent to appointments",
    ],
    related: ["patient-guide-nemt-florida", "hospital-nursing-home-transport-florida", "medicaid-transportation-florida"],
    body: [
      { t: "p", c: "If you are the family member holding a loved one's medical calendar together, transportation is one of the recurring headaches you probably did not sign up for. Missed rides mean missed appointments, and missed appointments mean setbacks. This handbook covers what caregivers need to know to book, coordinate, and follow up on non-emergency medical transportation across Florida — without spending your entire lunch break on hold." },

      { t: "h2", c: "Start with an accurate transportation profile" },
      { t: "p", c: "Before you book the first ride, write down (and keep updated) a one-page transportation profile you can text to a dispatcher or read off over the phone:" },
      { t: "ul", items: [
        "Full legal name, date of birth, and Medicaid or insurance ID",
        "Home address plus any gate codes or building-entry instructions",
        "Mobility status — walks unassisted, uses cane, uses walker, wheelchair (manual or power), or stretcher",
        "Weight (needed for lift and stretcher decisions)",
        "Oxygen use, dialysis schedule, or any equipment that has to travel with the patient",
        "Cognitive status — does the patient need door-to-door escort or can they meet the driver at the curb",
        "Preferred pharmacy and preferred hospital, in case of a schedule conflict",
      ]},
      { t: "p", c: "Providers get this information from you in ten seconds instead of five minutes, and the right vehicle shows up the first time." },

      { t: "h2", c: "Book earlier than you think you need to" },
      { t: "p", c: "Medicaid brokers require three business days' notice for routine trips, and even private-pay providers prefer 48 hours. Same-day rides are possible but you will pay premium rates and vehicle availability is not guaranteed. The moment a clinic hands you an appointment card, book the ride." },

      { t: "h2", c: "Coordinate the return trip separately" },
      { t: "p", c: "The single most common caregiver complaint is being stranded after a discharge or dialysis session. Book the return leg at the same time as the pickup, and confirm the return-trip pickup window when the outbound ride drops off. If the appointment runs long, call the broker or provider immediately — they can usually push the return by an hour or two if given notice." },

      { t: "h2", c: "Ride with your loved one when it matters" },
      { t: "p", c: "Most Florida NEMT providers allow one attendant to ride at no additional cost, especially for pediatric patients, dementia patients, and post-op discharges. Say so when you book. Bring the insurance card, a printed medication list, and a phone charger. Introduce yourself to the driver so they know who to look for on the return." },

      { t: "h2", c: "Set up standing orders for recurring care" },
      { t: "p", c: "Dialysis, chemo, physical therapy, and behavioral-health appointments repeat on predictable schedules. Ask for a standing order so the same provider dispatches the same driver and vehicle each time. Patients — especially those with dementia or anxiety — do noticeably better when they recognize the driver." },

      { t: "h2", c: "Document every problem, calmly and in writing" },
      { t: "p", c: "If a ride is late, unsafe, or unprofessional, note the date, trip confirmation number, and what happened. Report it to the broker in one clear sentence. Repeated complaints trigger provider reviews and, if needed, reassignment. You do not need to be angry to be effective — you need to be specific." },

      { t: "h2", c: "Know when to escalate to your care team" },
      { t: "p", c: "Persistent transportation gaps deserve a note in the medical record. Ask the clinic's social worker or care coordinator to help escalate. Case managers at Medicaid plans have direct lines to the transportation department that regular members do not." },

      { t: "cta", heading: "Book one ride or a whole month at once", body: "Florida NEMT lets caregivers save patient profiles and schedule recurring trips in one place. Request a ride and set up standing orders in the same flow.", to: "/request-a-ride", label: "Book a Ride" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "nemt-industry-trends-2026",
    category: "Industry News",
    title: "Florida NEMT in 2026: Market Growth, Managed-Care Contracts, and What's Next",
    metaTitle: "Florida NEMT 2026 Trends: Market Growth & Managed-Care Contracts",
    metaDescription:
      "The 2026 state of Florida non-emergency medical transportation — market growth drivers, managed-care contracting shifts, technology adoption, and where new operators can win contracts.",
    excerpt:
      "A concise look at where Florida's NEMT market is heading in 2026 — the demographic tailwind, the managed-care re-procurement, and the technology shifts that separate the winners.",
    publishedAt: "2026-06-25",
    readMinutes: 7,
    author: "Florida NEMT Editorial Team",
    cover: "coral",
    keywords: [
      "Florida NEMT market 2026",
      "NEMT industry trends",
      "Medicaid managed care Florida",
      "non emergency transportation growth",
    ],
    related: ["provider-onboarding-guide", "driver-training-hipaa-safety", "hospital-nursing-home-transport-florida"],
    body: [
      { t: "p", c: "Non-emergency medical transportation in Florida entered 2026 as one of the fastest-growing healthcare-adjacent segments in the state. Three forces are behind the growth: an aging population, a Medicaid managed-care re-procurement cycle that is shaking loose contracts long held by legacy brokers, and a rapid shift toward technology-native providers that can deliver on-time performance data plans can actually audit. Here is where the market is heading and what operators should be doing about it." },

      { t: "h2", c: "The demographic tailwind is not slowing" },
      { t: "p", c: "Florida added roughly 300,000 residents 65-and-older between 2023 and 2025, and the 85-and-older cohort — the group most dependent on wheelchair and stretcher transportation — is growing more than twice as fast as the general population. Dialysis volume alone is projected to grow 6–8% annually through 2028. Any operator with clean vehicles, credentialed drivers, and dispatch capacity has more demand than they can currently serve." },

      { t: "h2", c: "Managed-care contracts are being rewritten" },
      { t: "p", c: "AHCA's Statewide Medicaid Managed Care re-procurement redistributed regional plan awards and, with them, transportation contracts. Plans that changed brokers renegotiated rate sheets, tightened on-time and complaint thresholds, and pushed for direct provider contracting in regions where brokers historically monopolized dispatch. Providers that can meet enterprise reporting requirements — daily on-time data, geo-verified pickups, HIPAA-compliant messaging — are winning direct contracts at meaningfully better rates." },

      { t: "h2", c: "Technology adoption is now table stakes" },
      { t: "p", c: "The gap between top-quartile and bottom-quartile providers is now measured in software, not vehicles. Real-time GPS on every vehicle, automated ETA texting, digital signature capture at pickup and drop-off, and integrated billing directly to broker EDI systems are the operational baseline. Providers still running on spreadsheets and phone calls get squeezed out of premium contracts even when their service is fine." },

      { t: "h2", c: "Rural counties are the underserved opportunity" },
      { t: "p", c: "Broward, Miami-Dade, and Orange counties are saturated with providers. The opportunity right now is in mid-size and rural counties — Alachua, Marion, Polk, Lake, Sumter, and the Panhandle — where dialysis and specialist clinics exist but transportation capacity has not kept up. Plans are actively recruiting providers in these zones and will pay above baseline rates to guarantee coverage." },

      { t: "h2", c: "Workers' comp and hospital direct-pay are the margin play" },
      { t: "p", c: "Medicaid volume pays the bills, but the margin comes from workers' compensation trips (self-insured employers and TPAs contracting directly) and hospital-system discharge contracts. Both segments pay 30–60% more per trip than Medicaid managed-care rates because they are buying service reliability, not just a ride." },

      { t: "h2", c: "What to prioritize as an operator in 2026" },
      { t: "ol", items: [
        "Get every driver's credentials into a tracked expiry system — the plans are auditing more aggressively than ever.",
        "Publish on-time performance data monthly. If you cannot measure it, you cannot sell it.",
        "Expand into one new county before the market crowds in.",
        "Add wheelchair or stretcher capacity — those units are consistently under-supplied.",
        "Pursue at least one direct hospital or TPA contract to diversify revenue.",
      ]},

      { t: "cta", heading: "Compete for premium contracts", body: "Florida NEMT gives contracted operators a live dispatch board, EDI-ready billing, and per-trip performance reporting the plans actually accept.", to: "/join-our-network", label: "Join the Network" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "driver-training-hipaa-safety",
    category: "Training & Education",
    title: "NEMT Driver Training: HIPAA, Passenger Safety, and Wheelchair Securement",
    metaTitle: "NEMT Driver Training: HIPAA, Safety & Wheelchair Securement",
    metaDescription:
      "The core training every Florida NEMT driver needs: HIPAA privacy, passenger assistance, ADA-compliant wheelchair securement, defensive driving, and first-aid.",
    excerpt:
      "The five training modules every professional Florida NEMT driver must complete before their first solo dispatch — with a straight-talk checklist for owners building an in-house program.",
    publishedAt: "2026-06-30",
    readMinutes: 9,
    author: "Florida NEMT Editorial Team",
    cover: "forest",
    keywords: [
      "NEMT driver training",
      "HIPAA training transportation",
      "wheelchair securement training",
      "PASS training Florida",
      "passenger service safety",
    ],
    related: ["provider-onboarding-guide", "nemt-industry-trends-2026", "medicaid-transportation-florida"],
    body: [
      { t: "p", c: "A NEMT driver is the person your patient interacts with most — and, from a compliance perspective, the person most likely to create liability if training is skipped. Every professional Florida NEMT operation runs new drivers through a formal training program before their first solo dispatch, then documents refresher training annually. Here is the core curriculum and how to actually deliver it without turning it into a paperwork exercise." },

      { t: "h2", c: "1. HIPAA privacy and confidentiality" },
      { t: "p", c: "Drivers routinely see medical information — appointment types on dispatch screens, medication bags at pickup, oxygen equipment, dialysis catheters. They may also overhear conversations at clinics. Federal HIPAA rules and Florida Statute Chapter 456 both apply. Cover the basics in a one-hour module: what protected health information is, why drivers are considered part of the covered entity's workforce, how to handle inadvertent disclosures, and the hard rule — do not photograph, text, post, or discuss any patient-identifiable detail outside official dispatch channels. Have every driver sign a confidentiality attestation and re-sign it annually." },

      { t: "h2", c: "2. Passenger assistance and communication" },
      { t: "p", c: "This is where good NEMT companies separate themselves. Train drivers to:" },
      { t: "ul", items: [
        "Introduce themselves by name and confirm the patient's name and destination before loading",
        "Offer an arm rather than grabbing — 'Would you like some help?' before touching",
        "Give the patient the choice of front or back seat when it is safe",
        "Load mobility devices last so they are unloaded first",
        "Use plain, respectful language — no baby-talk, no diagnostic guessing, no medical advice",
        "Never leave a patient unattended at a clinic entrance until they are inside",
      ]},

      { t: "h2", c: "3. Wheelchair securement — done to the ADA standard" },
      { t: "p", c: "A wheelchair is a mobility device, not a seat, unless it is secured with an approved four-point tie-down system and the occupant is wearing a lap and shoulder belt anchored to the vehicle (not the chair). Common failures we see: only three straps used, straps run through the wheels instead of the frame, occupant seatbelt looped through the chair, and no rear tension applied. The Rehabilitation Engineering and Assistive Technology Society (RESNA WC-19) transit-safe chair standards are the training reference. Every new driver needs supervised, hands-on securement practice — not just a video." },

      { t: "h2", c: "4. Defensive driving and vehicle handling" },
      { t: "p", c: "NEMT vehicles are heavier and longer than a passenger car, and they carry medically fragile passengers. A short, smooth stop is more important than a fast schedule. Cover speed and following distance in Florida rain, the physics of a raised-roof van in crosswinds, backing procedures at hospital entrances (get out and look), and the standing rule that no phone use — dispatch, personal, or navigation — happens while the vehicle is in motion. Pair every new driver with a road-test evaluator before their first solo dispatch." },

      { t: "h2", c: "5. First aid, CPR, and emergency response" },
      { t: "p", c: "Drivers should be currently certified in adult and pediatric CPR/First Aid and AED use. They also need to know the company's emergency protocol: when to call 911 versus dispatch first, how to document a medical event that occurs in transit, and how to report a motor-vehicle incident with a patient on board. Run a live drill once a year." },

      { t: "h2", c: "How to run the program without burning out your team" },
      { t: "p", c: "Blend online modules (HIPAA, bloodborne pathogens, defensive driving) with in-person practicals (securement, patient transfers, road tests). Track every certificate with an expiry date. Automate the reminders so drivers do not lapse. Store signed attestations, quiz scores, and road-test evaluations in a single credentialing file per driver — plan audits will ask for exactly that." },

      { t: "cta", heading: "Train drivers to the standard the plans measure", body: "Florida NEMT publishes the training curriculum, quizzes, and audit-ready credential tracker we use across our provider network.", to: "/training", label: "See the Training Modules" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "hospital-nursing-home-transport-florida",
    category: "Florida Transportation Resources",
    title: "Hospital and Nursing Home Discharge Transportation Across Florida",
    metaTitle: "Hospital & Nursing Home Discharge Transport in Florida",
    metaDescription:
      "How Florida hospitals and skilled nursing facilities arrange safe patient discharge transportation — vehicle types, timing windows, payer rules, and what discharge planners should look for in a NEMT partner.",
    excerpt:
      "Discharge day is often when transportation fails patients hardest. Here is how Florida hospitals and nursing homes should be arranging safe, on-time NEMT for discharges, transfers, and readmission prevention.",
    publishedAt: "2026-07-01",
    readMinutes: 8,
    author: "Florida NEMT Editorial Team",
    cover: "sunset",
    keywords: [
      "hospital discharge transportation Florida",
      "nursing home transport",
      "SNF discharge NEMT",
      "hospital to home transportation",
      "readmission prevention transportation",
    ],
    related: ["patient-guide-nemt-florida", "medicaid-transportation-florida", "provider-onboarding-guide"],
    body: [
      { t: "p", c: "Discharge day is one of the highest-risk moments in a patient's care journey. A safe, on-time ride home or to a skilled nursing facility can be the difference between a smooth recovery and a 30-day readmission. Florida hospitals and SNFs that build a reliable NEMT partner network see measurable improvement in throughput, patient satisfaction, and CMS quality scores. Here is what discharge planners should be looking for — and what NEMT partners should be delivering." },

      { t: "h2", c: "Match the vehicle to the patient, not the schedule" },
      { t: "p", c: "The most common preventable discharge problem is sending an ambulatory sedan for a patient who needs a stretcher or wheelchair van. Confirm at the point of order:" },
      { t: "ul", items: [
        "Weight-bearing status and current mobility device",
        "Oxygen requirements and O2 tank type",
        "IV access still in place, wound vacs, or drains",
        "Cognitive status and whether an escort is required",
        "Whether a second-person lift is needed at the destination",
      ]},
      { t: "p", c: "A short discharge-transportation intake form built into the EMR eliminates almost all misroutes." },

      { t: "h2", c: "Book once you have a firm discharge time" },
      { t: "p", c: "Providers respond to firm windows, not guesses. Give a one-hour pickup window rather than 'this afternoon'; confirm the exact bed location; and update the provider immediately if the physician's discharge order is delayed. Providers who receive a 90-minute update can reassign a driver; providers who find out at pickup are stuck." },

      { t: "h2", c: "Understand who is paying for the ride" },
      { t: "p", c: "Payer rules drive what you can and cannot arrange:" },
      { t: "ol", items: [
        "Medicaid managed-care patients: use the plan's transportation broker. Discharges qualify for same-day authorization.",
        "Medicare fee-for-service patients: NEMT is generally not covered. Hospital charity funds, community grants, or private pay usually apply.",
        "Medicare Advantage patients: many plans include a supplemental transportation benefit — check the member's plan directly.",
        "Workers' compensation patients: the adjuster authorizes; document the authorization number on the transportation order.",
        "Uninsured or self-pay: publish a hospital-negotiated rate sheet with a preferred NEMT partner and route those trips there.",
      ]},

      { t: "h2", c: "Discharges to SNFs require handoff, not just a drop-off" },
      { t: "p", c: "Skilled nursing facilities need a physical handoff of the patient plus paperwork — discharge summary, medication reconciliation, and any DME orders. Train drivers (or use a partner that does) to wait for a signed acceptance from the SNF nurse rather than leaving a patient in a lobby. This one operational rule alone reduces readmissions traceable to discharge failures." },

      { t: "h2", c: "Nursing-home to hospital and back" },
      { t: "p", c: "Recurring NEMT — dialysis, oncology, cardiology follow-ups — should run on standing orders with the same provider. Assign a facility liaison at the NEMT partner and give them a direct line into the SNF's nurse-scheduling office. Standing orders reduce paperwork, reduce late arrivals, and let providers stage the right vehicles proactively." },

      { t: "h2", c: "What discharge planners should require from a NEMT partner" },
      { t: "ul", items: [
        "Same-day discharge acceptance for Medicaid managed-care patients",
        "A single dispatch phone number, staffed during discharge hours",
        "Live vehicle tracking on request",
        "Signed acceptance at the destination for every SNF discharge",
        "Monthly on-time and complaint reporting delivered without being asked",
        "HIPAA-compliant electronic ordering — no faxes",
      ]},

      { t: "h2", c: "Florida-specific realities" },
      { t: "p", c: "Traffic patterns matter here. Discharge windows on I-4 in Orlando or I-95 in Broward should assume 45 additional minutes during afternoon peaks. Coastal counties dealing with a hurricane watch need pre-storm discharge lists shared with providers 48 hours in advance so patients on oxygen or dialysis do not get stranded. Good NEMT partners in Florida already have hurricane operational plans on file — ask for a copy." },

      { t: "cta", heading: "Build a reliable Florida discharge network", body: "Florida NEMT contracts hospitals and SNFs statewide with a single point of dispatch, live tracking, and monthly performance reporting.", to: "/contact", label: "Talk to Our Team" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAllPosts(): Post[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string): Post[] {
  const post = getPostBySlug(slug);
  if (!post) return [];
  return post.related.map(getPostBySlug).filter((p): p is Post => Boolean(p));
}

export function getAllSlugs(): string[] {
  return POSTS.map((p) => p.slug);
}
