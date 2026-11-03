// Reading materials reused from Basic Nemt Test; no accounts or browser storage.
export type CoursePage = {
  title: string;
  body: string[]; // paragraphs
  bullets?: string[];
  tip?: string;
  remember?: string;
};

export const NEMT_PAGES: CoursePage[] = [
  {
    title: "Welcome to Florida NEMT",
    body: [
      "Welcome to the Florida NEMT Basics Course. This course is designed to introduce transportation providers to the fundamentals of Non-Emergency Medical Transportation (NEMT) and prepare them to provide safe, reliable, and professional service.",
      "NEMT provides transportation for individuals who need assistance getting to medical appointments but do not require emergency medical care. As an NEMT provider, you are more than a driver — you are an important part of the patient's healthcare journey.",
      "At the foundation of every successful NEMT provider are four responsibilities. These principles should guide every trip, every passenger interaction, and every decision made in the field.",
    ],
    bullets: [
      "Never abandon a patient",
      "Safety comes first",
      "Communication is critical",
      "Professionalism matters",
    ],
    tip: "Many patients depend on transportation to receive life-saving treatments. Being reliable can directly impact their health and well-being.",
    remember:
      "Your job is to transport patients safely, professionally, respectfully, and on time.",
  },
  {
    title: "1. Never Abandon a Patient",
    body: [
      "A transportation provider should never abandon a patient under any circumstance.",
      "Once a provider has accepted responsibility for a passenger, they must follow proper procedures and communicate with dispatch if a problem occurs.",
    ],
    bullets: [
      "The passenger is not ready at pickup",
      "There is a delay at a facility",
      "A trip issue occurs",
      "The passenger needs assistance",
      "The destination has a problem receiving the passenger",
      "The provider cannot complete the trip",
    ],
    tip: "A provider should never leave a passenger stranded, unsafe, or without proper communication and support.",
    remember: "A difficult trip is still a patient's trip. Never abandon a passenger.",
  },
  {
    title: "2. Safety Comes First",
    body: [
      "Safety is the most important responsibility of every NEMT provider.",
      "Providers should never rush a trip by sacrificing safety. Arriving safely is always more important than arriving quickly.",
    ],
    bullets: [
      "Perform vehicle inspections",
      "Follow all traffic laws",
      "Drive safely and defensively",
      "Properly secure wheelchairs and mobility equipment",
      "Assist passengers safely",
      "Report unsafe conditions immediately",
    ],
    tip: "No appointment is more important than passenger safety.",
    remember: "No appointment is more important than passenger safety.",
  },
  {
    title: "3. Communication Is Critical",
    body: [
      "Successful transportation requires communication between providers, dispatchers, facilities, and passengers.",
      "Good communication prevents problems and helps provide a better experience for everyone involved.",
    ],
    bullets: [
      "They are delayed",
      "A passenger is not ready",
      "Trip details appear incorrect",
      "A problem occurs during transportation",
      "Additional assistance is needed",
    ],
    tip: "When in doubt, communicate with dispatch.",
    remember: "When in doubt, communicate with dispatch.",
  },
  {
    title: "4. Professionalism Matters",
    body: [
      "Every provider represents their company and the NEMT industry.",
      "Providers should also understand that once they accept a trip, they should not simply turn back or refuse service because the trip becomes inconvenient. If there is a legitimate safety concern or issue, the provider should contact dispatch and follow proper procedures.",
    ],
    bullets: [
      "Treat passengers with dignity and respect",
      "Arrive prepared and on time",
      "Maintain clean vehicles",
      "Protect patient privacy",
      "Remain calm during difficult situations",
      "Follow company policies",
    ],
    tip: "Professional providers solve problems; they do not leave passengers behind.",
    remember: "Professional providers solve problems; they do not leave passengers behind.",
  },
  {
    title: "Final Course Review",
    body: [
      "The four most important responsibilities of every NEMT provider are:",
      "Following these principles helps protect passengers, providers, healthcare facilities, and the reputation of the NEMT industry.",
      "Congratulations — you have completed the Florida NEMT Basics reading section. You are now ready to take the Florida NEMT Basics Final Examination. Read each question carefully and select the best answer based on the material you have just reviewed.",
    ],
    bullets: [
      "Never abandon a patient",
      "Always prioritize safety",
      "Communicate clearly and quickly",
      "Maintain professionalism at all times",
    ],
    tip: "If you achieved a score of 80% or higher, you have successfully completed the Florida NEMT Basics Course.",
    remember:
      "Professionalism, safety, communication, and compassion are the foundation of excellent Non-Emergency Medical Transportation.",
  },
];

