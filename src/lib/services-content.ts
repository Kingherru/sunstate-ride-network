// Unique copy for each public service page. Rewritten from the former service pages
// to match current positioning: independent providers review and accept every request.

export type ServiceSection = { h: string; p?: string[]; list?: string[] };
export type ServicePage = {
  slug: "ambulatory" | "wheelchair" | "stretcher" | "medical-delivery";
  name: string;
  short: string;
  title: string;
  description: string;
  keyword: string;
  serviceType: string;
  h1: string;
  intro: string;
  imageKey: "family" | "hero" | "stretcher" | "facility";
  imageAlt: string;
  bookParam: string;
  sections: ServiceSection[];
  cta: { title: string; text: string };
  related: { label: string; href: string }[];
};

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "ambulatory",
    name: "Ambulatory transportation",
    short: "Rides for people who can walk on their own or with a little help.",
    title: "Ambulatory NEMT Transportation in Florida | MY FLORIDA NEMT",
    description: "Request ambulatory non-emergency medical transportation in Florida for riders who walk independently or with a cane or walker. Independent providers review each request.",
    keyword: "ambulatory transportation Florida",
    serviceType: "Ambulatory non-emergency medical transportation",
    h1: "Ambulatory transportation in Florida",
    intro: "Planned rides to medical appointments for people who can walk to and from the vehicle on their own, or with a steadying hand, cane or walker.",
    imageKey: "family",
    imageAlt: "A daughter walks arm in arm with her father, who uses a cane, toward a waiting passenger van",
    bookParam: "ambulatory",
    sections: [
      { h: "Who ambulatory transportation may help", p: [
        "Ambulatory trips are for riders who can get in and out of a standard passenger vehicle without a wheelchair lift or stretcher. Many riders travel alone; others prefer a companion or a driver who offers an arm on the way to the door.",
        "It is often a fit for older adults who no longer drive, people recovering from a procedure who have been told not to drive, and anyone without reliable transportation to a scheduled visit.",
      ] },
      { h: "Typical trips", list: [
        "Primary care, specialist and follow-up appointments",
        "Physical, occupational or speech therapy sessions",
        "Outpatient procedures where the rider cannot drive home",
        "Recurring visits such as dialysis, infusion or wound care",
        "Pharmacy, lab or imaging stops tied to a medical visit",
      ] },
      { h: "What to prepare before you request", p: [
        "Providers can plan accurately when they know exactly what the rider needs. Have the pickup and destination addresses ready, including the building, suite or entrance. Add the appointment time so a provider can schedule a sensible pickup, and say whether you need a return ride.",
        "Mention any cane, walker or folding mobility aid that travels with the rider, whether stairs are involved at either end, and whether the rider would benefit from door-to-door help rather than curb-to-curb service. Include an authorized contact who can answer questions about the trip.",
      ] },
      { h: "How to submit a request", p: [
        "Use the Book a Trip form and choose ambulatory as the transportation type. Pick one-way, round-trip or a multi-stop trip, and add notes for anything a driver should know in advance. Whenever possible, submit requests 48–72 hours ahead so providers have time to review and plan.",
      ] },
      { h: "Round trips, waiting and recurring visits", p: [
        "Many ambulatory trips are really two trips: the ride to the appointment and the ride home. If you know roughly how long the visit will take, include it, and say whether the rider would rather wait at the office or be picked up at a set time. For procedures with uncertain timing, give the best estimate and a phone number the provider can call when the rider is ready.",
        "If the rider goes to the same place on a regular schedule \u2014 for example therapy twice a week \u2014 describe the pattern in one request using the repeating-trip option, along with the start and end dates. Providers can then review the whole schedule instead of one trip at a time.",
        "It also helps to mention anything that makes the trip easier for the rider: a preferred entrance, a companion who will ride along, hearing or vision needs, or a language preference. Clear notes reduce last-minute calls on the day of the trip.",
      ] },
      { h: "Provider acceptance is required", p: [
        "MY FLORIDA NEMT connects requests with independent transportation providers. A submitted request is not a confirmed ride: a participating provider must review it and accept it. Availability, pricing and timing depend on the provider, the location and the trip details. Not every provider offers every service in every area.",
        "Ambulatory transportation is for planned, non-emergency travel only. For a medical emergency, call 911.",
      ] },
    ],
    cta: { title: "Request an ambulatory ride", text: "Share the trip details and participating Florida providers can review your ambulatory request." },
    related: [
      { label: "Wheelchair transportation", href: "/services/wheelchair" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Caregiver appointment checklist", href: "/resources/caregiver-appointment-checklist" },
    ],
  },
  {
    slug: "wheelchair",
    name: "Wheelchair transportation",
    short: "Ramp- or lift-equipped vehicles for riders who travel seated in a wheelchair.",
    title: "Wheelchair Transportation in Florida — Accessible NEMT | MY FLORIDA NEMT",
    description: "Request wheelchair-accessible non-emergency medical transportation in Florida. Share chair type and transfer needs so independent providers with suitable vehicles can review.",
    keyword: "wheelchair transportation Florida",
    serviceType: "Wheelchair-accessible non-emergency medical transportation",
    h1: "Wheelchair transportation in Florida",
    intro: "Planned trips in ramp- or lift-equipped vehicles for riders who stay seated in their own wheelchair for the whole ride.",
    imageKey: "hero",
    imageAlt: "A transportation professional helps a smiling woman in a wheelchair onto the ramp of an accessible van",
    bookParam: "wheelchair",
    sections: [
      { h: "Who wheelchair transportation may help", p: [
        "Wheelchair trips suit riders who cannot safely transfer into a car seat, or who would rather remain in their own chair. That includes people who use manual or power wheelchairs every day and people who use a transport chair only for longer distances.",
        "Family members, caregivers and facility staff often request these trips on a rider's behalf, especially for recurring appointments.",
      ] },
      { h: "Details that matter for wheelchair trips", p: [
        "Vehicles differ. Some use a fold-out ramp, others a powered lift, and each has size and weight limits. The more a provider knows about the chair, the better they can decide whether their vehicle is a good fit.",
      ], list: [
        "Manual, power or transport chair, and roughly how wide and heavy it is",
        "Whether the rider can bear weight or needs help moving to and from the chair",
        "Steps, curbs, narrow doorways or elevators at pickup or drop-off",
        "Oxygen or other equipment that travels with the rider",
        "Whether a companion or attendant will ride along",
      ] },
      { h: "Typical trips", p: [
        "Common requests include specialist and therapy appointments, dialysis and infusion schedules, discharge from a hospital or rehabilitation stay to home, and trips between a care facility and outpatient services. Recurring schedules can be described in a single request.",
      ] },
      { h: "How to submit a request", p: [
        "Choose wheelchair on the Book a Trip form, then add the chair and access details in the notes. Include the appointment time and any return ride. Requests submitted 48–72 hours in advance give providers the best chance to plan an appropriate vehicle.",
      ] },
      { h: "Helping at pickup and drop-off", p: [
        "Wheelchair trips often take a little longer at each end than other rides. Allow time for the driver to deploy the ramp or lift, load and secure the chair, and help the rider at the door if needed. If the rider lives in an apartment or a care facility, say which entrance is easiest and whether staff will bring the rider down.",
        "At the destination, note where the rider should be dropped off \u2014 a main entrance, a medical office building or a specific clinic door \u2014 and whether someone will meet them. Including these details in the request helps providers decide whether they can accept the trip and plan realistic timing.",
        "If the rider sometimes uses a different chair, such as a transport chair for appointments, tell the provider which one will travel on the day of the trip.",
      ] },
      { h: "Provider acceptance is required", p: [
        "Independent providers decide whether they can safely accept each trip with the vehicles and staff they have. Submitting a request does not guarantee a ride, and not every provider offers wheelchair service in every Florida area. Pricing and availability are set by the accepting provider.",
        "This service is for planned, non-emergency transportation. For a medical emergency, call 911.",
      ] },
    ],
    cta: { title: "Request a wheelchair-accessible trip", text: "Tell providers about the chair and access needs so they can review your request with the right vehicle in mind." },
    related: [
      { label: "Wheelchair trips: what to expect", href: "/resources/wheelchair-transportation-what-to-expect" },
      { label: "Stretcher transportation", href: "/services/stretcher" },
      { label: "For facilities", href: "/for-facilities" },
    ],
  },
  {
    slug: "stretcher",
    name: "Stretcher or specialized transportation",
    short: "Planned trips for riders who need to lie flat or need extra positioning support.",
    title: "Stretcher Transportation in Florida — Non-Emergency | MY FLORIDA NEMT",
    description: "Request planned, non-emergency stretcher or specialized transportation in Florida for riders who must lie flat. Independent providers review the details and decide whether to accept.",
    keyword: "stretcher transportation Florida",
    serviceType: "Non-emergency stretcher transportation",
    h1: "Stretcher and specialized transportation",
    intro: "Planned, non-emergency trips for riders who cannot sit upright for the length of the ride and need to travel lying down or with special positioning.",
    imageKey: "stretcher",
    imageAlt: "Two transportation crew members carefully load a passenger on a stretcher into a non-emergency van",
    bookParam: "stretcher",
    sections: [
      { h: "When stretcher transportation may be requested", p: [
        "Stretcher trips are sometimes called gurney transportation. They are typically requested when a rider is bed-bound, recovering in a way that makes sitting difficult, or otherwise needs to remain flat during travel. The decision about how a person should travel is made by the rider, their family and their care team — not by this website.",
        "These trips are not ambulance service. Stretcher transportation through the network is for stable riders who do not need medical monitoring or treatment on the way.",
      ] },
      { h: "Typical situations", list: [
        "Going home after a hospital or rehabilitation stay",
        "Moving between a care facility and an appointment or imaging visit",
        "Scheduled specialist visits for riders who cannot sit for long",
        "Transfers between residences or care settings",
      ] },
      { h: "What providers need to know", p: [
        "Stretcher trips involve more planning than other trip types, so detail helps. Describe the pickup location precisely — floor, room, elevator access, stairs and the width of hallways or doors. Note the rider's approximate height and weight, any equipment that must travel with them, and whether a family member or attendant will come along.",
        "Share the exact receiving location at the destination, including who will meet the rider and any check-in requirements.",
      ] },
      { h: "How to submit a request", p: [
        "Select stretcher on the Book a Trip form and add the positioning, access and equipment details in the notes. Submit 48–72 hours ahead whenever you can; same-week requests may be harder for providers to accept.",
      ] },
      { h: "Planning with facilities and families", p: [
        "Stretcher trips are often arranged by a hospital discharge planner, a care-facility coordinator or a family member. Whoever submits the request should confirm the timing with the sending and receiving locations first, so the rider is ready when the crew arrives and someone is expecting them at the other end.",
        "Include the names and phone numbers of the people who can answer questions at each location, and note any paperwork that must travel with the rider. If a family member wants to ride along, mention it in the request, since space can be limited in stretcher-capable vehicles.",
        "Give providers as much notice as you can. Stretcher-capable vehicles and crews are limited, and same-day requests are less likely to be accepted.",
      ] },
      { h: "Provider acceptance is required", p: [
        "Only some independent providers operate stretcher-capable vehicles and crews. A request is reviewed by participating providers, and the trip is not confirmed until one accepts it. Availability and pricing vary by provider and location.",
        "If the rider needs emergency care or medical monitoring, call 911 instead.",
      ] },
    ],
    cta: { title: "Request stretcher transportation", text: "Share positioning, access and equipment details so participating providers can review the trip carefully." },
    related: [
      { label: "Wheelchair transportation", href: "/services/wheelchair" },
      { label: "For facilities", href: "/for-facilities" },
      { label: "Florida coverage", href: "/florida-coverage" },
    ],
  },
  {
    slug: "medical-delivery",
    name: "Medical delivery",
    short: "Time-sensitive supplies, specimens, equipment or paperwork between locations.",
    title: "Medical Delivery in Florida — Supplies & Specimens | MY FLORIDA NEMT",
    description: "Request Florida medical delivery for supplies, equipment, specimens or paperwork through participating independent providers. Share handling needs and deadlines up front.",
    keyword: "medical delivery Florida",
    serviceType: "Medical courier and delivery",
    h1: "Medical delivery in Florida",
    intro: "Some independent providers in the network also move items rather than people — supplies, equipment, specimens or documents that need to arrive on time.",
    imageKey: "facility",
    imageAlt: "A facility coordinator arranges a delivery by phone at a front desk",
    bookParam: "medical-delivery",
    sections: [
      { h: "Who medical delivery may help", p: [
        "Medical delivery requests usually come from clinics, pharmacies, labs, home-health agencies, care facilities and medical-equipment suppliers. Individuals and caregivers sometimes need it too, for example when a rider's equipment or paperwork must reach a facility separately.",
        "Deliveries can be one-time, such as a piece of equipment that must reach a patient's home before a discharge, or part of a regular route between two locations. In either case, the person arranging the delivery should be able to describe what is moving, when it needs to arrive and who will receive it. Clear, specific instructions are what make a delivery dependable, and they help a provider decide quickly whether the job is a good fit for their vehicle and schedule.",
      ] },
      { h: "Typical deliveries", list: [
        "Medical supplies and small equipment",
        "Lab specimens between collection sites and labs",
        "Prescriptions or pharmacy orders, where the provider is set up to carry them",
        "Records, forms and other time-sensitive paperwork",
      ] },
      { h: "What to prepare", p: [
        "Delivery is only as good as the instructions. Have both addresses and a named contact with a phone number at each end. Describe what is being sent, its size and weight, and any handling needs such as keeping items upright, cold or sealed. Give the deadline and say whether a signature or chain-of-custody record is required.",
        "Specimens and regulated items can have their own packaging and handling rules. The sender is responsible for packaging items correctly; providers decide whether they can carry a particular item.",
      ] },
      { h: "How to submit a request", p: [
        "Choose Medical Delivery on the Book a Trip form. Online delivery requests are not available yet, so the form will show how to call or email us with the pickup location, delivery destination and instructions. We recommend planning 48–72 hours ahead, especially for recurring routes.",
      ] },
      { h: "What we do not need for a delivery", p: [
        "A delivery request is about the item, not a patient. You do not need to share diagnoses, medical history or other patient details to request a delivery. Describe the item in plain terms, its size and handling needs, and who is responsible for it at each end.",
        "For recurring routes, such as regular runs between a clinic and a lab, describe the schedule, the typical number of items and any cut-off times. That lets providers review whether a recurring route fits their schedule rather than one delivery at a time.",
        "Keep a record of the contact who arranged the delivery and the person who will receive it, so questions can be answered quickly on the day.",
      ] },
      { h: "Provider acceptance is required", p: [
        "Medical delivery is offered by some participating independent providers, not all of them. Each request is reviewed, and nothing is confirmed until a provider accepts it. Pricing and timing are set by the accepting provider.",
      ] },
    ],
    cta: { title: "Need something delivered?", text: "Send the pickup, drop-off, handling needs and deadline, and participating providers can review the delivery." },
    related: [
      { label: "For facilities", href: "/for-facilities" },
      { label: "For providers", href: "/for-providers" },
      { label: "Services overview", href: "/services" },
    ],
  },
];

export const getServicePage = (slug: string) => SERVICE_PAGES.find((s) => s.slug === slug);
