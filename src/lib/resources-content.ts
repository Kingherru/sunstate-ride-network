// Public resource articles. Three are adapted from former MY FLORIDA NEMT articles
// (rewritten to remove unverified claims and old dispatch positioning); one is new.
export type Block = { t: "p" | "h2"; c: string } | { t: "ul" | "ol"; items: string[] };
export type Resource = { slug: string; audience: "Patients & Caregivers" | "Providers"; title: string; metaTitle: string; description: string; reviewed: string; body: Block[]; cta: "book" | "join"; related: { label: string; href: string }[] };

const REVIEWED = "2026-10-05";

export const RESOURCES: Resource[] = [
  {
    slug: "caregiver-appointment-checklist", audience: "Patients & Caregivers",
    title: "A caregiver's checklist for medical-appointment transportation",
    metaTitle: "Caregiver Checklist for NEMT Appointments in Florida | MY FLORIDA NEMT",
    description: "What caregivers can prepare, confirm and pack before a loved one's non-emergency medical transportation trip — a practical checklist.",
    reviewed: REVIEWED, cta: "book",
    related: [{ label: "Ambulatory transportation", href: "/services/ambulatory" }, { label: "How it works", href: "/how-it-works" }],
    body: [
      { t: "p", c: "Small details usually decide whether an appointment day goes smoothly. This checklist collects the things caregivers most often wish they had confirmed in advance." },
      { t: "h2", c: "When you submit the request" },
      { t: "ul", items: ["Exact pickup and destination addresses, including building, suite or entrance", "The appointment time and how long the visit may take", "Whether you need a return ride, and a realistic return time", "Mobility aids that travel with the rider, and any help needed at the door", "Stairs, steps or narrow entrances at either end", "Your name and phone number as the authorized contact"] },
      { t: "h2", c: "The day before" },
      { t: "ul", items: ["Confirm the appointment time with the medical office", "Confirm the accepted trip and pickup window with the provider", "Charge the rider's phone and yours", "Set out ID, insurance card, medication list and any paperwork the office requested"] },
      { t: "h2", c: "What to pack" },
      { t: "ul", items: ["Water and a small snack if the rider is allowed to eat", "A light layer — waiting rooms are often cold", "Glasses, hearing aids and chargers", "A written list of questions for the clinician"] },
      { t: "h2", c: "At pickup and after the visit" },
      { t: "p", c: "Be ready a few minutes before the pickup window opens. If the visit runs long, contact the provider as soon as you know so they can adjust the return. Afterward, note anything that would help next time — a better entrance, a different pickup time — and add it to your next request." },
      { t: "p", c: "MY FLORIDA NEMT is for planned, non-emergency transportation. For a medical emergency, call 911." },
    ],
  },
  {
    slug: "wheelchair-transportation-what-to-expect", audience: "Patients & Caregivers",
    title: "Wheelchair transportation: what to expect and what to share",
    metaTitle: "Wheelchair Transportation in Florida: What to Expect | MY FLORIDA NEMT",
    description: "How wheelchair-accessible NEMT trips generally work, which chair and access details providers need, and questions to ask before a trip.",
    reviewed: REVIEWED, cta: "book",
    related: [{ label: "Wheelchair transportation", href: "/services/wheelchair" }, { label: "Stretcher transportation", href: "/services/stretcher" }],
    body: [
      { t: "p", c: "Wheelchair transportation lets a rider stay in their own chair from pickup to drop-off. Vehicles and equipment vary from provider to provider, so sharing accurate details is the best way to get a trip that fits." },
      { t: "h2", c: "Common vehicle types" },
      { t: "p", c: "Providers commonly use converted minivans with a fold-out ramp, or full-size vans with a powered lift. Ramps and lifts have size and weight limits, which is why providers ask about the chair before accepting a trip." },
      { t: "h2", c: "Details to include in your request" },
      { t: "ul", items: ["Manual, power or transport chair", "Approximate width and combined weight of rider and chair", "Whether the rider can stand or transfer, and how much help they need", "Steps, curbs, elevators or narrow doors at either end", "Oxygen or other equipment that travels with the rider"] },
      { t: "h2", c: "What generally happens at the vehicle" },
      { t: "p", c: "The driver deploys the ramp or lift, loads the chair, and secures it to the vehicle using the provider's securement system before the rider's seat belt is fastened. If anything about loading or securement worries you, say so before the vehicle moves." },
      { t: "h2", c: "Questions you can ask a provider" },
      { t: "ul", items: ["Can your vehicle accommodate this chair's size and weight?", "Will someone help at the door, or is service curb-to-curb?", "How should we reach you if the appointment runs long?"] },
      { t: "p", c: "Each independent provider decides whether they can safely accept a trip. Submitting a request does not guarantee a ride." },
    ],
  },
  {
    slug: "recurring-dialysis-transportation", audience: "Patients & Caregivers",
    title: "Planning recurring rides for dialysis and other regular treatments",
    metaTitle: "Recurring Dialysis Transportation in Florida — Planning Tips | MY FLORIDA NEMT",
    description: "How to request recurring non-emergency rides for dialysis, infusion or therapy schedules, and what details help providers plan dependable trips.",
    reviewed: REVIEWED, cta: "book",
    related: [{ label: "Ambulatory transportation", href: "/services/ambulatory" }, { label: "Wheelchair transportation", href: "/services/wheelchair" }],
    body: [
      { t: "p", c: "Treatments such as dialysis, infusion and therapy often happen several times a week at the same times. A recurring request lets providers review the whole schedule at once instead of one trip at a time." },
      { t: "h2", c: "What to include" },
      { t: "ul", items: ["The days and chair or appointment times", "The exact clinic entrance used for check-in", "Typical treatment length, so the return can be planned", "Mobility needs and whether the rider feels weak or dizzy after treatment", "A caregiver or clinic contact for schedule changes"] },
      { t: "h2", c: "Planning the return ride" },
      { t: "p", c: "Treatments do not always end on time. Tell the provider how you will let them know when the rider is ready, and ask how they handle sessions that run long. Riders who feel unwell after treatment should not be left waiting alone, so mention that need clearly." },
      { t: "h2", c: "When the schedule changes" },
      { t: "p", c: "Holidays, clinic closures and new treatment times all affect recurring trips. Let the provider know as early as possible, and keep the clinic's number and the provider's contact details somewhere easy to find." },
      { t: "p", c: "Submitting a recurring request does not guarantee every trip. A participating provider must review and accept it. This article is general information, not medical advice." },
    ],
  },
  {
    slug: "organizing-nemt-team-members-and-contractors", audience: "Providers",
    title: "Organizing NEMT team members and independent contractors",
    metaTitle: "Organizing NEMT Team Members & Independent Contractors | MY FLORIDA NEMT",
    description: "General information for Florida NEMT businesses on organizing employees and independent contractors, sharing trips provider-to-provider and keeping records consistent.",
    reviewed: REVIEWED, cta: "join",
    related: [{ label: "For providers", href: "/for-providers" }, { label: "Training", href: "/training" }],
    body: [
      { t: "p", c: "Many NEMT businesses grow by combining their own team members with independent contractors and by sharing trips with other providers. Keeping that coordination organized protects riders and makes the business easier to run." },
      { t: "p", c: "This is general information only. It is not legal, tax or worker-classification advice. Talk to a qualified professional about how these rules apply to your business." },
      { t: "h2", c: "Know who does what" },
      { t: "p", c: "Write down who dispatches, who drives, who handles billing and who speaks with facilities. When contractors are involved, document what work they perform and how trips are offered to them, so everyone has the same expectations." },
      { t: "h2", c: "Keep credentials and training current" },
      { t: "ul", items: ["Driver's license, insurance and vehicle documentation for everyone who drives", "Required training records, such as HIPAA and NEMT courses", "Renewal dates in one shared place, with reminders before they expire"] },
      { t: "h2", c: "Provider-to-provider trip sharing" },
      { t: "p", c: "Business-to-business NEMT coordination works best with clear agreements: which trips are shared, how rider information is protected, who communicates with the rider and how pricing is settled. Share only the information the other provider needs to complete the trip." },
      { t: "h2", c: "Use consistent trip records" },
      { t: "p", c: "Whether a trip is driven by an employee, a contractor or a partner provider, record it the same way — pickup and drop-off times, mileage and any notes. Consistent records make questions easier to answer later." },
    ],
  },
];

export const getResource = (slug: string) => RESOURCES.find((r) => r.slug === slug);
