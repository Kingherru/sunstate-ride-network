// MyFloridaNemt.com blog content — pillar articles seeded for the blog engine.
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
    author: "MyFloridaNemt.com Editorial Team",
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
      { t: "p", c: "Traditional Medicare Part B does not cover NEMT. Many Medicare Advantage plans do, as a supplemental benefit — check your Evidence of Coverage or call the number on your card. Workers' compensation insurers routinely authorize NEMT for injured workers attending IME appointments, physical therapy, and specialist referrals. Private-pay patients can book any MyFloridaNemt.com provider directly; ambulatory rates typically run $35–$65 base plus a per-mile charge, with wheelchair and stretcher runs priced higher because of the specialized vehicle." },

      { t: "h2", c: "How to book a ride, step by step" },
      { t: "ol", items: [
        "Confirm your appointment date, time, and full pickup and drop-off addresses.",
        "If you are on Medicaid or Medicare Advantage, call the transportation number on the back of your insurance card and give them the appointment details.",
        "Ask for the trip confirmation number, the provider name, and the pickup window. Write these down.",
        "Be ready 15 minutes before the pickup window opens. Bring your ID, insurance card, and any paperwork the clinic asked for.",
        "If the ride does not arrive within the window, call the broker back and ask them to dispatch a backup provider — this is a routine request, not a complaint.",
      ]},

      { t: "h2", c: "What a good NEMT experience looks like" },
      { t: "p", c: "A professional MyFloridaNemt.com provider will call or text before pickup, arrive in a marked vehicle with a visibly ID-badged driver, help you into the seat or secure your wheelchair, and give you a written pickup time for the return trip. The driver should be quiet, courteous, and never leave you unattended at a hospital entrance. If any of that is missing — late arrivals, no-shows, unsafe driving, unprofessional behavior — you have the right to switch providers." },

      { t: "h2", c: "When to request a new provider" },
      { t: "p", c: "You do not have to accept poor service. Late pickups that make you miss dialysis, drivers who refuse to help with your wheelchair, unsafe vehicles, or repeated no-shows are all grounds to request a change. Call your plan's transportation broker, state the trip dates and what happened, and ask for a different provider to be assigned going forward. Keep a short log of dates and issues in case you need to escalate." },

      { t: "cta", heading: "Need a ride now?", body: "Request a verified MyFloridaNemt.com provider in your county. We match you with the right vehicle type — ambulatory, wheelchair, or stretcher — and confirm within minutes.", to: "/request-a-ride", label: "Request a Ride" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "provider-onboarding-guide",
    category: "Provider Resources",
    title: "How to Join the MyFloridaNemt.com Provider Network: A Complete 2026 Guide",
    metaTitle: "Join a MyFloridaNemt.com Network: Credentials, Contracts, Rates (2026)",
    metaDescription:
      "Everything a MyFloridaNemt.com operator needs to join a provider network in 2026 — AHCA registration, insurance minimums, vehicle standards, credentialing, and how trips are dispatched.",
    excerpt:
      "AHCA registration, insurance, vehicle inspections, credentialing, and dispatch — a practical 2026 guide for MyFloridaNemt.com operators who want steady contract volume.",
    publishedAt: "2026-06-10",
    readMinutes: 10,
    author: "MyFloridaNemt.com Editorial Team",
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

      { t: "cta", heading: "Ready to join a MyFloridaNemt.com network?", body: "Skip the broker-by-broker paperwork. Apply once through MyFloridaNemt.com and get access to trips across every major managed-care plan.", to: "/join-our-network", label: "Apply to Join" },
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
    author: "MyFloridaNemt.com Editorial Team",
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

      { t: "cta", heading: "Book your Medicaid ride the easy way", body: "MyFloridaNemt.com works with providers contracted to every major Medicaid managed-care plan. Request a ride and we'll route your trip to the right dispatcher.", to: "/request-a-ride", label: "Request a Ride" },
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
    author: "MyFloridaNemt.com Editorial Team",
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
      { t: "p", c: "Most MyFloridaNemt.com providers allow one attendant to ride at no additional cost, especially for pediatric patients, dementia patients, and post-op discharges. Say so when you book. Bring the insurance card, a printed medication list, and a phone charger. Introduce yourself to the driver so they know who to look for on the return." },

      { t: "h2", c: "Set up standing orders for recurring care" },
      { t: "p", c: "Dialysis, chemo, physical therapy, and behavioral-health appointments repeat on predictable schedules. Ask for a standing order so the same provider dispatches the same driver and vehicle each time. Patients — especially those with dementia or anxiety — do noticeably better when they recognize the driver." },

      { t: "h2", c: "Document every problem, calmly and in writing" },
      { t: "p", c: "If a ride is late, unsafe, or unprofessional, note the date, trip confirmation number, and what happened. Report it to the broker in one clear sentence. Repeated complaints trigger provider reviews and, if needed, reassignment. You do not need to be angry to be effective — you need to be specific." },

      { t: "h2", c: "Know when to escalate to your care team" },
      { t: "p", c: "Persistent transportation gaps deserve a note in the medical record. Ask the clinic's social worker or care coordinator to help escalate. Case managers at Medicaid plans have direct lines to the transportation department that regular members do not." },

      { t: "cta", heading: "Book one ride or a whole month at once", body: "MyFloridaNemt.com lets caregivers save patient profiles and schedule recurring trips in one place. Request a ride and set up standing orders in the same flow.", to: "/request-a-ride", label: "Book a Ride" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "nemt-industry-trends-2026",
    category: "Industry News",
    title: "MyFloridaNemt.com in 2026: Market Growth, Managed-Care Contracts, and What's Next",
    metaTitle: "MyFloridaNemt.com 2026 Trends: Market Growth & Managed-Care Contracts",
    metaDescription:
      "The 2026 state of Florida non-emergency medical transportation — market growth drivers, managed-care contracting shifts, technology adoption, and where new operators can win contracts.",
    excerpt:
      "A concise look at where Florida's NEMT market is heading in 2026 — the demographic tailwind, the managed-care re-procurement, and the technology shifts that separate the winners.",
    publishedAt: "2026-06-25",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "coral",
    keywords: [
      "MyFloridaNemt.com market 2026",
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

      { t: "cta", heading: "Compete for premium contracts", body: "MyFloridaNemt.com gives contracted operators a live dispatch board, EDI-ready billing, and per-trip performance reporting the plans actually accept.", to: "/join-our-network", label: "Join the Network" },
    ],
  },

  // ------------------------------------------------------------------
  {
    slug: "driver-training-hipaa-safety",
    category: "Training & Education",
    title: "NEMT Driver Training: HIPAA, Passenger Safety, and Wheelchair Securement",
    metaTitle: "NEMT Driver Training: HIPAA, Safety & Wheelchair Securement",
    metaDescription:
      "The core training every MyFloridaNemt.com driver needs: HIPAA privacy, passenger assistance, ADA-compliant wheelchair securement, defensive driving, and first-aid.",
    excerpt:
      "The five training modules every professional MyFloridaNemt.com driver must complete before their first solo dispatch — with a straight-talk checklist for owners building an in-house program.",
    publishedAt: "2026-06-30",
    readMinutes: 9,
    author: "MyFloridaNemt.com Editorial Team",
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
      { t: "p", c: "A NEMT driver is the person your patient interacts with most — and, from a compliance perspective, the person most likely to create liability if training is skipped. Every professional MyFloridaNemt.com operation runs new drivers through a formal training program before their first solo dispatch, then documents refresher training annually. Here is the core curriculum and how to actually deliver it without turning it into a paperwork exercise." },

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

      { t: "cta", heading: "Train drivers to the standard the plans measure", body: "MyFloridaNemt.com publishes the training curriculum, quizzes, and audit-ready credential tracker we use across our provider network.", to: "/training", label: "See the Training Modules" },
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
    author: "MyFloridaNemt.com Editorial Team",
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

      { t: "cta", heading: "Build a reliable Florida discharge network", body: "MyFloridaNemt.com contracts hospitals and SNFs statewide with a single point of dispatch, live tracking, and monthly performance reporting.", to: "/contact", label: "Talk to Our Team" },
    ],
  },

  // ---------- Patient Resources ----------
  {
    slug: "wheelchair-transportation-florida",
    category: "Patient Resources",
    title: "Wheelchair-Accessible Transportation in Florida: What to Expect",
    metaTitle: "Wheelchair Transportation Florida: Vans, Lifts, Securement",
    metaDescription:
      "How wheelchair-accessible NEMT works in Florida — vehicle types, four-point tie-downs, driver training, Medicaid coverage, and how to book a safe ride.",
    excerpt:
      "Wheelchair transportation isn't just a bigger van. Learn what a compliant wheelchair-accessible ride looks like in Florida — from lift specs to securement to what a good driver actually does at the curb.",
    publishedAt: "2026-06-08",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "cobalt",
    keywords: ["wheelchair transportation Florida", "wheelchair van NEMT", "ADA transport Florida", "medicaid wheelchair ride"],
    related: ["patient-guide-nemt-florida", "dialysis-transportation-florida", "caregiver-guide-medical-transport"],
    body: [
      { t: "p", c: "For thousands of Floridians a wheelchair-accessible van is the only way to get to a doctor without pain, risk, or an emergency-room bill. Yet 'wheelchair transportation' means very different things to different providers. This guide walks through what a safe, compliant wheelchair-accessible NEMT ride actually looks like — and how to spot one that isn't." },
      { t: "h2", c: "Vehicle types you'll see" },
      { t: "p", c: "Wheelchair-accessible NEMT in Florida is delivered in one of three vehicle types: full-size vans with hydraulic side or rear lifts, converted minivans with fold-out ramps, and cutaway shuttles that can carry two or three chairs plus companions. All of them must have four-point tie-downs bolted through the floor, a lap-and-shoulder belt for the occupant, and at least 30 inches of clearance at the door." },
      { t: "p", c: "Manual transport chairs, power wheelchairs, scooters, and bariatric chairs each have different loading needs. Providers ask for the chair type, weight, and dimensions at booking so they can dispatch a vehicle that actually fits. A 400-pound power chair does not belong on a folding ramp — it needs a hydraulic lift rated to 800 pounds." },
      { t: "h2", c: "What happens at the curb" },
      { t: "ol", items: [
        "The driver confirms the patient's name and destination before loading.",
        "The lift or ramp is deployed and inspected — no debris, no cracked belt on the lift motor.",
        "The chair is rolled on facing forward, brakes set, and secured with four independent straps at the frame (never at wheels, footrests, or armrests).",
        "The occupant's lap belt goes across the pelvis; the shoulder belt sits across the chest, never the neck.",
        "The driver documents the securement — many Florida providers now use photo-verified checklists.",
      ]},
      { t: "h2", c: "Driver training standards" },
      { t: "p", c: "A qualified wheelchair-transport driver in Florida has completed PASS (Passenger Assistance Safety and Sensitivity) or an equivalent curriculum, holds current CPR and first-aid certification, and has documented securement training. Ask providers to show you the training certificates — reputable ones will." },
      { t: "h2", c: "Medicaid coverage" },
      { t: "p", c: "Florida Medicaid covers wheelchair-accessible NEMT to covered medical services at no cost to eligible members. The trip is booked through the member's managed-care plan (Sunshine, Simply, Molina, Aetna Better Health, Humana, or United) or through the statewide brokerage — never directly by paying cash if the patient is eligible." },
      { t: "h2", c: "Red flags" },
      { t: "ul", items: [
        "Straps hooked to wheels or footrests instead of the chair frame",
        "Only two tie-downs instead of four",
        "No shoulder belt available",
        "Driver refuses to load a power chair 'because it's too heavy' without offering an alternate vehicle",
        "No documented securement checklist",
      ]},
      { t: "cta", heading: "Book a wheelchair-accessible ride in Florida", body: "MyFloridaNemt.com dispatches lift-equipped vans statewide with trained wheelchair-transport drivers and four-point securement on every trip.", to: "/request-a-ride", label: "Request a Ride" },
    ],
  },
  {
    slug: "dialysis-transportation-florida",
    category: "Patient Resources",
    title: "Dialysis Transportation in Florida: Reliable Rides Three Times a Week",
    metaTitle: "Dialysis Transportation Florida — Recurring NEMT Rides",
    metaDescription:
      "How Florida dialysis patients set up standing NEMT rides, what Medicaid and Medicare Advantage cover, and how to avoid missed sessions.",
    excerpt:
      "Dialysis missed even once puts a patient in the hospital. Learn how recurring NEMT rides work in Florida and how to lock in a schedule that actually shows up.",
    publishedAt: "2026-06-11",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "sunset",
    keywords: ["dialysis transportation Florida", "recurring NEMT dialysis", "medicaid dialysis rides", "standing order NEMT"],
    related: ["patient-guide-nemt-florida", "wheelchair-transportation-florida", "medicaid-transportation-florida"],
    body: [
      { t: "p", c: "In-center hemodialysis usually runs three times a week for four hours per session — Monday-Wednesday-Friday or Tuesday-Thursday-Saturday. Miss a session and potassium climbs, fluid loads, and hospitalization becomes likely within days. Reliable transportation isn't a convenience for dialysis patients; it's clinical." },
      { t: "h2", c: "How standing orders work" },
      { t: "p", c: "Most Florida dialysis centers work with two or three preferred NEMT providers under standing orders. The center's social worker submits the patient's schedule once, and the provider blocks the same pickup slot every week. A good standing order includes the pickup address, the exact clinic entrance (not just the building), transport type, chair specs if applicable, and a caregiver contact." },
      { t: "h2", c: "What Medicaid covers" },
      { t: "p", c: "Florida Medicaid covers medically necessary dialysis transportation for eligible members. Trips are booked through the plan's transportation broker at least 48 hours in advance for standing orders, or same-day for urgent adds. Medicare Advantage plans in Florida increasingly include a supplemental transportation benefit — typically 24 to 60 one-way trips per year that can be applied to dialysis." },
      { t: "h2", c: "Booking a reliable schedule" },
      { t: "ol", items: [
        "Ask the dialysis center's social worker which NEMT providers they trust for standing orders.",
        "Confirm the same-driver / same-vehicle preference — continuity matters when a patient has post-treatment low blood pressure.",
        "Set the pickup 45 minutes before treatment for center check-in.",
        "Set the return pickup 30 minutes after the scheduled treatment end — long enough for the patient to be cleared, short enough that they aren't waiting alone.",
        "Confirm the provider will accept last-minute schedule adjustments when a treatment runs long.",
      ]},
      { t: "h2", c: "What goes wrong — and how to prevent it" },
      { t: "p", c: "The most common failure is a late return pickup after a long treatment. A patient who is nauseated, cold, and hypotensive should not be sitting in a lobby for 90 minutes. Ask up front how the provider handles run-over treatments. The best answer is a live dispatch line staffed until the last dialysis chair in the region has cleared." },
      { t: "h2", c: "For caregivers" },
      { t: "p", c: "Keep an updated ride list with the provider's dispatch number, the plan's transportation number, and a backup ride if the primary fails. When a driver is more than 15 minutes late for pickup, call dispatch before you call the plan — providers can reassign a vehicle faster than the broker can escalate a complaint." },
      { t: "cta", heading: "Set up a reliable dialysis schedule", body: "MyFloridaNemt.com runs standing dialysis orders statewide with same-driver preference, dispatch coverage through the last treatment of the day, and Medicaid & Medicare Advantage billing.", to: "/request-a-ride", label: "Request Recurring Rides" },
    ],
  },
  {
    slug: "patient-rights-nemt-florida",
    category: "Patient Resources",
    title: "Your Rights as a MyFloridaNemt.com Patient",
    metaTitle: "MyFloridaNemt.com Patient Rights: Complaints, Denials, Appeals",
    metaDescription:
      "What every MyFloridaNemt.com patient is entitled to — timely pickup, a safe vehicle, HIPAA privacy — and how to file a complaint or appeal a denial.",
    excerpt:
      "Denied a ride? Waited two hours in a lobby? MyFloridaNemt.com patients have specific, enforceable rights. Here's what they are and how to use them.",
    publishedAt: "2026-06-14",
    readMinutes: 6,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "navy",
    keywords: ["NEMT patient rights Florida", "medicaid transportation complaint", "NEMT denial appeal", "AHCA transportation"],
    related: ["patient-guide-nemt-florida", "medicaid-transportation-florida", "caregiver-guide-medical-transport"],
    body: [
      { t: "p", c: "MyFloridaNemt.com is regulated by the Agency for Health Care Administration (AHCA), the Commission for the Transportation Disadvantaged (CTD), and each Medicaid managed-care plan's contract. Together they create a floor of patient rights that no provider or broker can override." },
      { t: "h2", c: "Your baseline rights" },
      { t: "ul", items: [
        "A ride to any Medicaid-covered service if you have no other reasonable means of transportation",
        "A pickup window that gets you to your appointment on time — not 'sometime today'",
        "A vehicle that matches your needs (wheelchair-accessible, stretcher, ambulatory)",
        "A driver who has passed background checks and been trained for the vehicle type",
        "Privacy — your medical information belongs to you, not the driver's group chat",
        "A written explanation if a trip is denied",
        "The right to appeal a denial",
      ]},
      { t: "h2", c: "How to file a complaint" },
      { t: "ol", items: [
        "Call the provider's dispatch line first — most missed pickups are resolved on the same call.",
        "If unresolved, call your Medicaid managed-care plan's member services (number on your ID card) and request a formal complaint number.",
        "For unresolved plan complaints, contact AHCA's Medicaid Helpline at 1-877-254-1055.",
        "For safety concerns about a vehicle or driver, file with the CTD at 850-410-5700.",
      ]},
      { t: "h2", c: "Appealing a denial" },
      { t: "p", c: "If your plan denies a trip request, you have 60 days to file an internal appeal. The plan must respond within 30 days for standard appeals, 72 hours for expedited (urgent) appeals. If the plan denies the appeal, you can request a State Fair Hearing through Florida's Department of Children and Families. Keep every letter, every reference number, and the name of every person you speak with." },
      { t: "h2", c: "Bring a caregiver" },
      { t: "p", c: "Every MyFloridaNemt.com patient is entitled to a caregiver or attendant seat at no extra cost when the caregiver's presence is medically necessary — for cognitive impairment, language interpretation, or physical assistance. Note the caregiver at booking; some providers require 24-hour notice." },
      { t: "cta", heading: "Report a problem or get help", body: "Our patient support team helps Floridians resolve NEMT complaints and re-book denied trips.", to: "/contact", label: "Contact Support" },
    ],
  },

  // ---------- Provider Resources ----------
  {
    slug: "starting-nemt-business-florida",
    category: "Provider Resources",
    title: "How to Start a NEMT Business in Florida",
    metaTitle: "Start a NEMT Business in Florida: Licensing, Insurance, Contracts",
    metaDescription:
      "Step-by-step guide to launching a Florida non-emergency medical transportation company — LLC formation, CTC/CTP registration, insurance, and Medicaid contracting.",
    excerpt:
      "The MyFloridaNemt.com market is growing fast, but the licensing path is not obvious. Here is the checklist we wish every new provider had before they bought their first van.",
    publishedAt: "2026-06-16",
    readMinutes: 9,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "forest",
    keywords: ["start NEMT business Florida", "how to start NEMT company", "Florida CTC CTP registration", "NEMT licensing Florida"],
    related: ["provider-onboarding-guide", "nemt-insurance-requirements-florida", "nemt-billing-medicaid-cms1500"],
    body: [
      { t: "p", c: "Florida issues no state-wide 'NEMT license,' which surprises new operators. Instead you are stacking several requirements: a business entity, transportation-disadvantaged registration, commercial insurance, driver credentialing, and contracts with the Medicaid managed-care plans or a broker. Here is the order that gets you paid the fastest." },
      { t: "h2", c: "1. Form a business entity" },
      { t: "p", c: "Register an LLC or S-Corp with the Florida Division of Corporations (Sunbiz). Obtain a federal EIN. Open a dedicated business bank account — commingling personal and business funds voids most insurance and audit defenses." },
      { t: "h2", c: "2. Register with the Commission for the Transportation Disadvantaged" },
      { t: "p", c: "Every Florida county has a Community Transportation Coordinator (CTC). To carry Medicaid-funded passengers you either become the CTC (rare), operate as a coordinated contractor, or subcontract to the CTC as a coordinated Community Transportation Provider (CTP). Contact your county's CTC first — the application, insurance minimums, and drug-testing requirements are set locally." },
      { t: "h2", c: "3. Buy commercial insurance" },
      { t: "p", c: "Minimum requirements in most Florida counties: $300,000 combined single-limit auto liability, $1M general liability, workers' compensation for W-2 drivers, and umbrella coverage that most contracts require at $1M. Sedan-only operators can sometimes start at $100,000, but no managed-care plan will contract without $1M." },
      { t: "h2", c: "4. Buy or lease vehicles" },
      { t: "p", c: "Start with what your first contract requires. A wheelchair-accessible cutaway van runs $65,000-$110,000 new; a used lift-equipped minivan can be sourced for $25,000-$40,000. Do not skip a pre-purchase inspection of the lift and tie-down anchors." },
      { t: "h2", c: "5. Credential drivers" },
      { t: "ul", items: [
        "Class E Florida driver license minimum; CDL not required for sub-15-passenger vehicles",
        "Level 2 background check (FDLE + FBI)",
        "DOT physical (Medical Examiner's Certificate)",
        "Pre-employment and random drug testing per DOT 49 CFR Part 40",
        "Defensive driving certification",
        "PASS or equivalent passenger-assistance training",
        "CPR and first aid",
      ]},
      { t: "h2", c: "6. Contract with the plans" },
      { t: "p", c: "Florida Medicaid transportation flows through six managed-care plans (Sunshine, Simply, Molina, Aetna Better Health, Humana, United) and their transportation brokers (typically Access2Care, ModivCare, or MTM). Each broker has its own credentialing packet, rate sheet, and IVR/dispatch platform. Expect 60-120 days to complete credentialing." },
      { t: "h2", c: "7. Build a billing workflow" },
      { t: "p", c: "Most MyFloridaNemt.com is billed as trip records to the broker, not CMS-1500 claims. Payment is per-loaded-mile plus a base rate, with add-ons for wheelchair, additional attendants, and after-hours pickups. Set up trip verification (signature capture, GPS breadcrumbs, timestamps) from day one — brokers deny claims without them." },
      { t: "cta", heading: "Get help launching your MyFloridaNemt.com company", body: "We onboard new MyFloridaNemt.com providers with credentialing support, insurance introductions, and dispatch software.", to: "/join-our-network", label: "Join the Network" },
    ],
  },
  {
    slug: "nemt-billing-medicaid-cms1500",
    category: "Provider Resources",
    title: "Florida Medicaid NEMT Billing: Trip Records, Rates, and Common Denials",
    metaTitle: "Florida Medicaid NEMT Billing Guide: Codes, Rates, Denials",
    metaDescription:
      "How MyFloridaNemt.com providers bill Medicaid managed-care plans — trip records, HCPCS codes A0080–A0130, per-mile rates, and the top denial reasons to avoid.",
    excerpt:
      "Getting paid for a Medicaid NEMT trip in Florida is not the same as billing an ambulance run. This is the trip-record workflow that keeps cash flowing.",
    publishedAt: "2026-06-19",
    readMinutes: 8,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "cobalt",
    keywords: ["MyFloridaNemt.com billing", "medicaid transportation codes", "A0130 A0100 HCPCS", "NEMT denial reasons"],
    related: ["provider-onboarding-guide", "starting-nemt-business-florida", "medicaid-transportation-florida"],
    body: [
      { t: "p", c: "Florida Medicaid NEMT is almost entirely capitated to managed-care plans, which delegate transportation to brokers. That means most providers do not submit CMS-1500 claims — they submit trip records through the broker's portal. Getting paid on time is a process problem, not a coding problem." },
      { t: "h2", c: "HCPCS codes you should recognize" },
      { t: "ul", items: [
        "A0080 — Non-emergency transportation, per mile, vehicle provided by volunteer",
        "A0090 — Non-emergency transportation, per mile, vehicle provided by individual",
        "A0100 — Non-emergency transportation; taxi",
        "A0110 — Non-emergency transportation; bus, intra- or inter-state carrier",
        "A0120 — Non-emergency transportation: mini-bus, mountain area transports, or other transportation systems",
        "A0130 — Non-emergency transportation: wheelchair van",
        "A0140 — Non-emergency transportation and air travel (private or commercial), intra- or inter-state",
        "T2001–T2005 — NEMT waiting time, extra attendant, mileage, ancillary charges",
      ]},
      { t: "h2", c: "Trip record vs claim" },
      { t: "p", c: "The broker's portal or EDI feed is where the money comes from. Each trip record must include: patient Medicaid ID, trip ID from the broker, pickup and drop-off timestamps with GPS, loaded miles, vehicle type, driver ID, attendant if any, and a signature or e-signature at the destination. Submit within the broker's window — usually 30 or 45 days from date of service." },
      { t: "h2", c: "Top denial reasons in Florida" },
      { t: "ol", items: [
        "Missing signature or e-signature at destination",
        "GPS breadcrumbs missing or don't match the address on file",
        "Trip billed for a wheelchair van but no wheelchair on the authorization",
        "Loaded miles exceed shortest reasonable route with no exception note",
        "Trip submitted after the timely-filing window",
        "Duplicate trip ID within the same day",
      ]},
      { t: "h2", c: "Rates in 2026" },
      { t: "p", c: "Rates vary by broker and county. Typical Florida ranges in 2026: ambulatory base $12-$20 with per-loaded-mile at $1.60-$2.20; wheelchair base $28-$45 with per-loaded-mile at $2.40-$3.20; stretcher base $75-$140 with per-loaded-mile at $4.00-$6.00. Long-distance (>50 miles one way) usually pays a supplemental long-distance rate — always ask." },
      { t: "h2", c: "AR discipline" },
      { t: "p", c: "Reconcile every submitted trip against the broker's remittance within 14 days. Set up denial buckets by reason code and rework them weekly — the vast majority of MyFloridaNemt.com denials are curable with a signature capture, GPS proof, or a corrected authorization number." },
      { t: "cta", heading: "Bill Medicaid faster with our dispatch stack", body: "The MyFloridaNemt.com platform captures signatures, GPS, and trip records automatically — export ready for every major broker.", to: "/join-our-network", label: "See the Platform" },
    ],
  },
  {
    slug: "nemt-insurance-requirements-florida",
    category: "Provider Resources",
    title: "NEMT Insurance Requirements in Florida: What Providers Actually Need",
    metaTitle: "MyFloridaNemt.com Insurance: Auto, GL, WC, Umbrella — 2026 Minimums",
    metaDescription:
      "2026 insurance minimums for MyFloridaNemt.com providers — commercial auto, general liability, workers comp, umbrella, and how brokers verify.",
    excerpt:
      "Undersized insurance is the fastest way to lose a MyFloridaNemt.com contract. Here are the 2026 minimums, the coverages brokers actually check, and where operators overpay.",
    publishedAt: "2026-06-21",
    readMinutes: 6,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "peach",
    keywords: ["NEMT insurance Florida", "commercial auto NEMT", "umbrella policy NEMT", "NEMT COI requirements"],
    related: ["starting-nemt-business-florida", "provider-onboarding-guide", "nemt-billing-medicaid-cms1500"],
    body: [
      { t: "p", c: "Every Florida broker and managed-care plan verifies certificates of insurance (COIs) before assigning trips, and again on renewal. Coverage that expires quietly is the fastest way to be locked out of a dispatch queue for a week — with drivers still on payroll." },
      { t: "h2", c: "The five coverages that matter" },
      { t: "ol", items: [
        "Commercial auto liability — minimum $300,000 combined single limit; $1M CSL for most managed-care contracts",
        "General liability — $1,000,000 per occurrence / $2,000,000 aggregate",
        "Workers' compensation — statutory limits for every W-2 driver in Florida",
        "Umbrella / excess liability — $1M common, $2M-$5M for hospital and dialysis contracts",
        "Cyber / privacy liability — increasingly required as brokers move to electronic PHI exchange",
      ]},
      { t: "h2", c: "Additional insureds and waivers" },
      { t: "p", c: "Every broker contract you sign will require them (and often the health plan) to be named as an additional insured, with a waiver of subrogation in their favor. Read your policy — some carriers charge for waivers of subrogation on workers' comp." },
      { t: "h2", c: "Where operators overpay" },
      { t: "ul", items: [
        "Insuring 1099 subcontractor drivers on your commercial auto (they should carry their own)",
        "Duplicating physical-damage coverage on financed vs owned vehicles",
        "Buying $5M umbrella when only one contract requires it — negotiate that contract down first",
      ]},
      { t: "h2", c: "COI hygiene" },
      { t: "p", c: "Set a renewal calendar 60, 30, and 7 days before every policy expires. Send fresh COIs to every broker before the old one lapses — brokers auto-suspend on the expiration date, not on the renewal notice." },
      { t: "cta", heading: "Get insurance-ready credentials", body: "Our provider dashboard tracks every driver, vehicle, and COI expiration in one place with automatic 60/30/7-day reminders.", to: "/join-our-network", label: "Join the Network" },
    ],
  },

  // ---------- Medicaid Information ----------
  {
    slug: "florida-medicaid-managed-care-plans",
    category: "Medicaid Information",
    title: "Florida Medicaid Managed-Care Plans and Their Transportation Benefits",
    metaTitle: "Florida Medicaid Managed Care Transportation: SMMC Plans Compared",
    metaDescription:
      "Compare Florida Medicaid managed-care plans — Sunshine, Simply, Molina, Aetna Better Health, Humana, United — and how each covers non-emergency transportation.",
    excerpt:
      "Six health plans deliver Florida Medicaid transportation to millions of members. Here is who covers what, which broker each uses, and how to book.",
    publishedAt: "2026-06-24",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "sand",
    keywords: ["Florida Medicaid managed care", "SMMC transportation", "Sunshine Simply Molina Aetna Humana United", "medicaid ride booking Florida"],
    related: ["medicaid-transportation-florida", "medicaid-eligibility-transportation", "patient-guide-nemt-florida"],
    body: [
      { t: "p", c: "Florida delivers Medicaid benefits through the Statewide Medicaid Managed Care (SMMC) program. Six health plans compete for enrollment in most regions, and each contracts a transportation broker to arrange NEMT for members." },
      { t: "h2", c: "The six plans" },
      { t: "ul", items: [
        "Sunshine Health — Centene affiliate; large statewide footprint",
        "Simply Healthcare — Elevance/Anthem affiliate; heavy South Florida presence",
        "Molina Healthcare of Florida — statewide",
        "Aetna Better Health of Florida — CVS Health affiliate",
        "Humana Healthy Horizons in Florida — statewide",
        "UnitedHealthcare Community Plan — statewide",
      ]},
      { t: "h2", c: "How to book a ride under each plan" },
      { t: "p", c: "Every plan gives members a dedicated transportation phone number on their ID card. Book at least 48-72 hours in advance for standard trips; 24 hours for urgent post-discharge; same-day for hospital discharges and dialysis run-overs. Members can also call the plan's Member Services line if the transportation number isn't answering." },
      { t: "h2", c: "Which broker each plan uses" },
      { t: "p", c: "Brokers change with contract cycles. As of 2026 the dominant Florida transportation brokers are Access2Care, ModivCare, MTM, and Verida. Some plans handle transportation in-house through a subsidiary. If you are the patient, you do not need to know the broker's name — you call the plan. If you are a provider, you must credential with each broker separately." },
      { t: "h2", c: "Long-distance trips" },
      { t: "p", c: "For appointments more than 50 miles away, plans generally require prior authorization and often prefer the nearest in-network specialist first. If the specialist is only available in another region, ask for a written authorization before the trip — providers won't dispatch long-distance without it." },
      { t: "h2", c: "Meals and lodging" },
      { t: "p", c: "For very long trips (usually 100+ miles or overnight), some Florida plans cover meal per-diem and lodging in addition to transportation. Ask specifically — this benefit is real but rarely advertised." },
      { t: "cta", heading: "Not sure which plan covers your ride?", body: "Tell us your plan and appointment, and we'll help you book through the right broker.", to: "/contact", label: "Get Help" },
    ],
  },
  {
    slug: "medicaid-eligibility-transportation",
    category: "Medicaid Information",
    title: "Who Qualifies for Medicaid Transportation in Florida?",
    metaTitle: "Florida Medicaid Transportation Eligibility & How to Apply",
    metaDescription:
      "Who qualifies for Florida Medicaid NEMT — income limits, categorical eligibility, and how to apply for transportation benefits through your managed-care plan.",
    excerpt:
      "Florida Medicaid transportation isn't automatic — patients need active Medicaid AND no other reasonable means of transport. Here's how eligibility works.",
    publishedAt: "2026-06-27",
    readMinutes: 6,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "coral",
    keywords: ["Florida Medicaid eligibility", "medicaid transportation qualify", "SMMC enrollment Florida", "no other means of transport"],
    related: ["medicaid-transportation-florida", "florida-medicaid-managed-care-plans", "patient-guide-nemt-florida"],
    body: [
      { t: "p", c: "Two things have to be true for a Florida patient to get a Medicaid-funded NEMT ride: they must be an active Medicaid recipient, and they must have no other reasonable means of transportation to a covered medical service. That second condition is where a lot of confusion — and denial — happens." },
      { t: "h2", c: "Active Florida Medicaid" },
      { t: "p", c: "You are eligible for Florida Medicaid if you meet one of the categorical groups (children, pregnant, aged, blind, disabled, parent/caretaker relative, medically needy) and income and asset limits. Apply through ACCESS Florida (myaccessflorida.com) or call 1-866-762-2237. Once approved, you are enrolled in an SMMC managed-care plan and receive an ID card." },
      { t: "h2", c: "'No other reasonable means'" },
      { t: "p", c: "The plan may ask if there's a family member, friend, or public transit that could reasonably get the patient to the appointment. 'Reasonable' isn't 'possible' — a two-hour bus ride each way with three transfers usually isn't reasonable for a dialysis patient. Document why alternatives don't work: no driver's license, no functioning vehicle, no bus route within a mile, medical inability to ride the bus." },
      { t: "h2", c: "Covered destinations" },
      { t: "p", c: "NEMT covers rides to Medicaid-covered medical services: physician visits, hospital outpatient, dental, mental health, substance-use treatment, dialysis, pharmacy pickup after a same-day appointment, and rehab. It does not cover social visits, work, school, or grocery shopping." },
      { t: "h2", c: "Recertification" },
      { t: "p", c: "Florida Medicaid requires annual redetermination. Missed paperwork ends your coverage — and your NEMT benefit with it. Sign up for text and email reminders through the ACCESS portal, and mark the renewal date on your calendar." },
      { t: "cta", heading: "Not sure if you qualify?", body: "We help Florida patients confirm Medicaid eligibility and book their first NEMT ride.", to: "/contact", label: "Ask for Help" },
    ],
  },

  // ---------- Caregiver Guides ----------
  {
    slug: "caregiver-appointment-checklist",
    category: "Caregiver Guides",
    title: "The Caregiver's Medical-Appointment Checklist (Print-Friendly)",
    metaTitle: "Caregiver Medical Appointment Checklist — MyFloridaNemt.com",
    metaDescription:
      "Everything a caregiver should bring, know, and confirm before taking a loved one to a medical appointment by NEMT in Florida.",
    excerpt:
      "The details caregivers forget aren't the big ones — they're the tiny ones that turn a routine visit into a three-hour disaster. Print this before every appointment.",
    publishedAt: "2026-06-29",
    readMinutes: 5,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "peach",
    keywords: ["caregiver checklist", "medical appointment prep", "Florida caregiver", "NEMT preparation"],
    related: ["caregiver-guide-medical-transport", "patient-guide-nemt-florida", "senior-transportation-options-florida"],
    body: [
      { t: "p", c: "Caregivers who nail the prep make every appointment shorter, safer, and less exhausting. Print this and stick it on the fridge — it's the checklist we use with our own family." },
      { t: "h2", c: "24 hours before" },
      { t: "ul", items: [
        "Confirm the appointment time, address, and provider name",
        "Confirm the NEMT pickup — provider dispatch number, driver name if available",
        "Charge the phone",
        "Fill any prescriptions the patient might need mid-day",
        "Pack a snack and water bottle (dialysis and infusion patients often need calories after)",
        "Print or screenshot the medication list and any recent lab results",
      ]},
      { t: "h2", c: "The go-bag" },
      { t: "ul", items: [
        "Insurance and Medicaid ID cards",
        "Photo ID",
        "Current medication list with doses and times",
        "List of allergies",
        "Any recent imaging reports or discharge summaries",
        "Advance directive or power of attorney if applicable",
        "Change of clothes for long infusions",
        "Phone charger",
        "Snack, water, small blanket",
      ]},
      { t: "h2", c: "At pickup" },
      { t: "ul", items: [
        "Confirm the driver knows the exact clinic entrance (many hospitals have three)",
        "Load the wheelchair or walker into the vehicle yourself if you can — you know how it collapses",
        "Bring the go-bag inside the vehicle, not the trunk",
        "Have the provider's dispatch number saved for the return call",
      ]},
      { t: "h2", c: "At the appointment" },
      { t: "ul", items: [
        "Write down the provider's exact instructions",
        "Ask for next-appointment details before you leave the room",
        "Confirm any new prescriptions and how they interact with current meds",
        "Take a photo of any handouts",
      ]},
      { t: "h2", c: "Booking the return" },
      { t: "p", c: "Call the NEMT dispatch when the patient is 30 minutes from being cleared — not after they are already waiting in the lobby. A little lead time keeps the driver from double-booking." },
      { t: "cta", heading: "Book a caregiver-friendly ride", body: "MyFloridaNemt.com welcomes caregivers on every trip and dispatches drivers trained to work with families.", to: "/request-a-ride", label: "Request a Ride" },
    ],
  },
  {
    slug: "senior-transportation-options-florida",
    category: "Caregiver Guides",
    title: "Senior Transportation Options in Florida: A Family Guide",
    metaTitle: "Senior Transportation Florida: NEMT, PACE, Volunteer, Paratransit",
    metaDescription:
      "How Florida families choose between NEMT, PACE, senior-center rides, volunteer driver programs, and paratransit for an aging loved one.",
    excerpt:
      "There are more transportation options for Florida seniors than most families realize. Here is how to pick the right one for a parent's routine — not just the emergency.",
    publishedAt: "2026-07-01",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "sunset",
    keywords: ["senior transportation Florida", "PACE Florida", "paratransit Florida", "volunteer driver senior"],
    related: ["caregiver-guide-medical-transport", "caregiver-appointment-checklist", "patient-guide-nemt-florida"],
    body: [
      { t: "p", c: "For Florida families, the transportation question is rarely 'how do I get Mom to one appointment?' — it's 'how do I set up a sustainable weekly routine?' The answer usually mixes two or three programs, not just one." },
      { t: "h2", c: "NEMT (Medicaid or Medicare Advantage)" },
      { t: "p", c: "Best for medical appointments when the patient qualifies. Free at the point of service, door-to-door, driver-assisted. Not for social visits or errands." },
      { t: "h2", c: "PACE — Program of All-Inclusive Care for the Elderly" },
      { t: "p", c: "PACE serves seniors 55+ who need nursing-home level care but want to live at home. Transportation to the PACE center and to medical appointments is built in. Florida has PACE programs in Miami, Broward, Palm Beach, Central Florida, Tampa Bay, and expanding." },
      { t: "h2", c: "Paratransit (ADA)" },
      { t: "p", c: "Every county with fixed-route public transit also runs ADA paratransit — curb-to-curb rides for people whose disability prevents them from using the bus. Fares are usually $2-$4 per trip. Booking requires an eligibility determination and 24-48 hour advance reservation." },
      { t: "h2", c: "Senior center and volunteer programs" },
      { t: "p", c: "County Councils on Aging, Area Agencies on Aging, and nonprofits like ITNAmerica run volunteer-driver programs in many Florida communities. Rides are low-cost or donation-based, but availability is thin — book weeks ahead for non-medical trips." },
      { t: "h2", c: "Rideshare (Uber Health, Lyft, GoGoGrandparent)" },
      { t: "p", c: "Best for cognitively intact, ambulatory seniors comfortable using a smartphone or a concierge service that dials for them. Not appropriate for wheelchair transport, stretcher transport, or patients with dementia who can't reliably identify the correct vehicle." },
      { t: "h2", c: "How to decide" },
      { t: "ol", items: [
        "Medical appointment covered by Medicaid or Medicare Advantage → NEMT",
        "Needs help all day, wants to stay home → PACE",
        "Wants to keep some independence for errands → ADA paratransit + rideshare",
        "Church, grocery, hair, social → volunteer driver programs and senior center vans",
      ]},
      { t: "cta", heading: "Get help setting up a routine", body: "MyFloridaNemt.com works with families to build multi-program transportation plans for aging parents.", to: "/contact", label: "Talk to a Care Coordinator" },
    ],
  },

  // ---------- Industry News ----------
  {
    slug: "nemt-technology-dispatch-software",
    category: "Industry News",
    title: "NEMT Dispatch Software in 2026: What Actually Matters",
    metaTitle: "NEMT Dispatch Software 2026: Features Providers Actually Need",
    metaDescription:
      "The NEMT tech stack in 2026 — dispatch, routing, driver app, broker EDI, signature capture, GPS, and what to demand from any vendor demo.",
    excerpt:
      "The NEMT software market is loud with 'AI dispatching' claims. Here's the feature list that actually keeps a MyFloridaNemt.com operation running.",
    publishedAt: "2026-07-03",
    readMinutes: 7,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "cobalt",
    keywords: ["NEMT dispatch software", "NEMT technology 2026", "NEMT routing app", "medical transport software"],
    related: ["nemt-industry-trends-2026", "provider-onboarding-guide", "nemt-billing-medicaid-cms1500"],
    body: [
      { t: "p", c: "Dispatch software is the single largest operational lever a NEMT provider has. Move a fleet from spreadsheets to a real platform and gross margin usually improves 5-9 points inside a year — from tighter routes, faster claim submission, and fewer late pickups. Here is what actually matters when comparing vendors." },
      { t: "h2", c: "Non-negotiable features" },
      { t: "ul", items: [
        "Broker EDI integrations (Access2Care, ModivCare, MTM, Verida, Tripspark) — not just CSV import",
        "Driver mobile app with turn-by-turn, signature capture, and offline mode",
        "Real-time GPS breadcrumbs stored for at least 90 days for audit",
        "Automated route optimization that respects appointment windows and vehicle types",
        "HIPAA-compliant messaging between dispatch, driver, and facility",
        "Credential expiration tracking for every driver and vehicle",
        "Configurable trip-verification workflow with photo capture",
      ]},
      { t: "h2", c: "Nice-to-have" },
      { t: "ul", items: [
        "Patient/family SMS notifications ('driver is 10 minutes out')",
        "Payer-specific claim scrubbing",
        "Fleet telematics (idle time, harsh braking)",
        "Facility portal for hospitals and dialysis centers to see their trips",
        "Analytics dashboard by payer, driver, vehicle",
      ]},
      { t: "h2", c: "The 'AI dispatching' question" },
      { t: "p", c: "Every vendor now claims AI. Ask what problem it solves: does it re-route a live driver when a hospital delay pushes a return trip 40 minutes later, without pulling him off the next pickup? Does it predict which trips are highest cancellation risk so dispatch can double-book safely? If the demo can't answer, it's marketing." },
      { t: "h2", c: "Total cost of ownership" },
      { t: "p", c: "Vendors quote per-vehicle or per-trip pricing. Add: implementation ($5K-$25K), broker EDI setup fees ($500-$2K per broker), driver-app data plans, and the internal ops time to migrate credentials and standing orders. Budget three months for a real cutover." },
      { t: "cta", heading: "See our dispatch stack", body: "MyFloridaNemt.com operators use our platform with EDI to the major brokers, driver app, and automated credential tracking.", to: "/join-our-network", label: "Book a Demo" },
    ],
  },

  // ---------- Training & Education ----------
  {
    slug: "wheelchair-securement-training",
    category: "Training & Education",
    title: "Wheelchair Securement Training for NEMT Drivers",
    metaTitle: "Wheelchair Securement Training: Four-Point Tie-Downs, Best Practices",
    metaDescription:
      "Step-by-step wheelchair securement training for NEMT drivers — four-point tie-down technique, belt placement, common mistakes, and inspection.",
    excerpt:
      "Improper wheelchair securement is the #1 preventable injury in NEMT. Here is the training every wheelchair-transport driver should have — and how to verify it.",
    publishedAt: "2026-07-05",
    readMinutes: 6,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "navy",
    keywords: ["wheelchair securement training", "four-point tie-down", "NEMT driver training", "PASS certification"],
    related: ["driver-training-hipaa-safety", "wheelchair-transportation-florida", "provider-onboarding-guide"],
    body: [
      { t: "p", c: "Passenger injuries during NEMT are rare, but the ones that do happen almost always involve improper wheelchair securement. Four-point tie-downs, when used correctly, hold a wheelchair through the same crash forces as a bolted-in vehicle seat. Used incorrectly, they turn a 400-pound chair into a projectile." },
      { t: "h2", c: "The four-point standard" },
      { t: "p", c: "Every wheelchair must be secured with four independent tie-down straps: two forward (attaching to the chair frame near the front, running down and outward to floor anchors ahead of the chair) and two rearward (attaching to the frame near the back, running down and outward to anchors behind the chair). Straps must be tight enough that the chair does not move more than two inches in any direction." },
      { t: "h2", c: "Where to attach — and where NOT to" },
      { t: "ul", items: [
        "Attach to structural frame members only",
        "Never attach to wheels, footrests, armrests, brake handles, or accessory brackets",
        "Never attach to a battery pack or motor housing on a power chair",
        "Never cross straps in an X pattern",
      ]},
      { t: "h2", c: "Occupant restraint" },
      { t: "p", c: "The wheelchair tie-down does not restrain the person. A separate lap belt goes across the pelvis (not the abdomen). A separate shoulder belt runs from the pelvis strap up over the chest and shoulder — never across the neck. Both must anchor to the vehicle, not the chair." },
      { t: "h2", c: "Pre-trip inspection" },
      { t: "ul", items: [
        "Straps free of cuts, fraying, and chemical damage",
        "Ratchets clean and moving freely",
        "Hooks not bent or missing safety latches",
        "Floor anchors clean and free of debris",
        "Lift or ramp operates smoothly with no unusual sound",
      ]},
      { t: "h2", c: "Training programs to look for" },
      { t: "p", c: "PASS (Passenger Assistance Safety and Sensitivity) from CTAA is the industry-standard curriculum. Q'Straint and Sure-Lok both offer manufacturer training on their tie-down systems. Every driver should complete both a general course and hands-on training on the specific equipment in their vehicle." },
      { t: "cta", heading: "Train your NEMT drivers", body: "Our provider onboarding includes wheelchair-securement modules, PASS scheduling, and equipment-specific training references.", to: "/join-our-network", label: "Provider Onboarding" },
    ],
  },

  // ---------- Florida Transportation Resources ----------
  {
    slug: "florida-counties-nemt-coverage",
    category: "Florida Transportation Resources",
    title: "NEMT Coverage by Florida County: Who Runs What",
    metaTitle: "Florida County NEMT Coverage: CTC List and Service Notes",
    metaDescription:
      "County-by-county overview of MyFloridaNemt.com coverage — Community Transportation Coordinators, service quirks, and what patients should know before booking.",
    excerpt:
      "MyFloridaNemt.com looks different in every county because every county has its own Community Transportation Coordinator. Here's the overview patients and families need.",
    publishedAt: "2026-07-08",
    readMinutes: 8,
    author: "MyFloridaNemt.com Editorial Team",
    cover: "sand",
    keywords: ["MyFloridaNemt.com counties", "CTC Florida", "county transportation Florida", "Florida transportation disadvantaged"],
    related: ["patient-guide-nemt-florida", "medicaid-transportation-florida", "florida-medicaid-managed-care-plans"],
    body: [
      { t: "p", c: "Florida's Commission for the Transportation Disadvantaged (CTD) designates one Community Transportation Coordinator (CTC) per county. The CTC is the local backbone for coordinated rides — Medicaid, senior programs, workforce, and disability. Managed-care NEMT operates alongside the CTC through contracted brokers, but the CTC still sets local safety, insurance, and drug-testing requirements." },
      { t: "h2", c: "How to find your county's CTC" },
      { t: "p", c: "Visit ctd.fl.gov and open the CTC directory. Each entry lists the coordinator, contact information, and the Local Coordinating Board (LCB) that oversees local service quality. LCB meetings are public — a fast way to hear real complaints and successes in your county." },
      { t: "h2", c: "Regions with the largest ride volumes" },
      { t: "ul", items: [
        "Miami-Dade — highest overall trip volume, deep provider network, heavy congestion",
        "Broward — dense dialysis and rehab volume, aggressive on-time metrics",
        "Palm Beach — high senior population, strong PACE presence",
        "Orange — Central Florida hub, Disney-area airport transfers overlap with medical",
        "Hillsborough & Pinellas — Tampa Bay dual-county coordination",
        "Duval — Jacksonville anchor, largest rural periphery",
      ]},
      { t: "h2", c: "Rural counties" },
      { t: "p", c: "In the Panhandle, North Florida, and inland counties, one or two providers usually cover 500+ square miles. Expect wider pickup windows and encourage patients to schedule earliest-morning appointments — a rural driver who is late to one 8 a.m. pickup is late for the rest of the day." },
      { t: "h2", c: "What to ask your CTC" },
      { t: "ul", items: [
        "Which brokers currently subcontract Medicaid trips locally?",
        "Are there driver shortages that affect same-day trips?",
        "What are the current on-time and complaint statistics?",
        "When does the LCB next meet, and how can I attend?",
      ]},
      { t: "h2", c: "Statewide realities" },
      { t: "p", c: "Hurricanes, snowbird season, and I-4 / I-95 congestion patterns affect every MyFloridaNemt.com operation. During a declared emergency, non-urgent NEMT is often suspended 24-48 hours before landfall. Dialysis, oxygen, and hospital discharge trips continue with priority. Sign up for county emergency alerts before hurricane season starts." },
      { t: "cta", heading: "Book NEMT in any Florida county", body: "MyFloridaNemt.com dispatches statewide — from the Panhandle to the Keys — with one phone number and one dispatch team.", to: "/request-a-ride", label: "Request a Ride" },
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
