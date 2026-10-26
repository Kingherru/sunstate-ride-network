// Assessment content reused from Basic Nemt Test. Answer keys stay server-side.
export type Question = {
  id: number;
  q: string;
  choices: string[];
  answer: number; // index
  explanation: string;
};

export const NEMT_PASS_THRESHOLD = 0.8;

export const NEMT_QUESTIONS: Question[] = [
  {
    id: 1,
    q: "What does NEMT stand for?",
    choices: [
      "National Emergency Medical Transport",
      "Non-Emergency Medical Transportation",
      "New Emergency Medical Transit",
      "National Emergency Mobility Team",
    ],
    answer: 1,
    explanation: "NEMT stands for Non-Emergency Medical Transportation.",
  },
  {
    id: 2,
    q: "What is the first core responsibility discussed in the course?",
    choices: [
      "Never abandon a patient",
      "Safety comes first",
      "Communication is critical",
      "Professionalism matters",
    ],
    answer: 0,
    explanation: "The first core responsibility is to never abandon a patient.",
  },
  {
    id: 3,
    q: "Which responsibility is described as the most important for every NEMT provider?",
    choices: [
      "Never abandon a patient",
      "Safety comes first",
      "Communication is critical",
      "Professionalism matters",
    ],
    answer: 1,
    explanation: "Safety is described as the most important responsibility of every NEMT provider.",
  },
  {
    id: 4,
    q: "Which situation requires a provider to contact dispatch instead of leaving?",
    choices: [
      "The passenger is not ready at pickup",
      "There is a delay at a facility",
      "The provider cannot complete the trip",
      "All of the above",
    ],
    answer: 3,
    explanation: "All of these situations require contacting dispatch rather than leaving the passenger.",
  },
  {
    id: 5,
    q: "If a problem occurs during a trip, what should the provider do?",
    choices: [
      "Leave the passenger and return to base",
      "Remain professional, ensure the passenger is safe, and contact dispatch",
      "Wait for the passenger to solve it",
      "Ignore the problem",
    ],
    answer: 1,
    explanation: "Providers should remain professional, keep the passenger safe, and contact dispatch for assistance.",
  },
  {
    id: 6,
    q: "A provider should never leave a passenger:",
    choices: [
      "Stranded",
      "Unsafe",
      "Without proper communication and support",
      "All of the above",
    ],
    answer: 3,
    explanation: "Providers should never leave a passenger stranded, unsafe, or without proper communication and support.",
  },
  {
    id: 7,
    q: "Before beginning a shift, providers should:",
    choices: [
      "Perform vehicle inspections",
      "Skip inspections if running late",
      "Wait for a problem to occur",
      "Only check fuel",
    ],
    answer: 0,
    explanation: "Providers should perform vehicle inspections before beginning their shift.",
  },
  {
    id: 8,
    q: "Which of the following is a safety responsibility?",
    choices: [
      "Follow all traffic laws",
      "Properly secure wheelchairs",
      "Report unsafe conditions immediately",
      "All of the above",
    ],
    answer: 3,
    explanation: "All of these are safety responsibilities listed in the course.",
  },
  {
    id: 9,
    q: "Why should providers never rush a trip?",
    choices: [
      "To save fuel",
      "To arrive safely rather than quickly",
      "To avoid traffic",
      "To finish early",
    ],
    answer: 1,
    explanation: "Arriving safely is always more important than arriving quickly.",
  },
  {
    id: 10,
    q: "Wheelchairs and mobility equipment should be:",
    choices: [
      "Left unsecured if the trip is short",
      "Properly secured",
      "Held by the passenger",
      "Stored in the trunk",
    ],
    answer: 1,
    explanation: "Wheelchairs and mobility equipment must be properly secured.",
  },
  {
    id: 11,
    q: "When should providers communicate with dispatch?",
    choices: [
      "When they are delayed",
      "When a passenger is not ready",
      "When a problem occurs during transportation",
      "All of the above",
    ],
    answer: 3,
    explanation: "Providers should communicate with dispatch in all of these situations.",
  },
  {
    id: 12,
    q: "Good communication helps:",
    choices: [
      "Increase paperwork",
      "Prevent problems and provide a better experience",
      "Replace vehicle inspections",
      "Avoid passengers",
    ],
    answer: 1,
    explanation: "Good communication prevents problems and helps provide a better experience for everyone involved.",
  },
  {
    id: 13,
    q: '"When in doubt, communicate with dispatch" supports which core responsibility?',
    choices: [
      "Never abandon a patient",
      "Communication is critical",
      "Safety comes first",
      "Professionalism matters",
    ],
    answer: 1,
    explanation: "This statement supports the responsibility that communication is critical.",
  },
  {
    id: 14,
    q: "Which behavior demonstrates professionalism?",
    choices: [
      "Treating passengers with dignity",
      "Arriving prepared and on time",
      "Following company policies",
      "All of the above",
    ],
    answer: 3,
    explanation: "All of these behaviors demonstrate professionalism.",
  },
  {
    id: 15,
    q: "Professional providers should:",
    choices: [
      "Maintain clean vehicles",
      "Protect patient privacy",
      "Remain calm during difficult situations",
      "All of the above",
    ],
    answer: 3,
    explanation: "Professional providers maintain clean vehicles, protect privacy, and remain calm during difficult situations.",
  },
  {
    id: 16,
    q: "If a trip becomes inconvenient, a provider should:",
    choices: [
      "Simply turn back and refuse service",
      "Leave the passenger at the nearest stop",
      "Contact dispatch and follow proper procedures",
      "Ignore the trip",
    ],
    answer: 2,
    explanation: "Providers should contact dispatch and follow proper procedures rather than simply refusing service.",
  },
  {
    id: 17,
    q: "What does the course say about refusing service because a trip becomes inconvenient?",
    choices: [
      "Providers should always refuse inconvenient trips",
      "Providers should not simply turn back or refuse service",
      "Inconvenient trips should be ignored",
      "Dispatch does not need to be informed",
    ],
    answer: 1,
    explanation: "Providers should not simply turn back or refuse service because a trip becomes inconvenient.",
  },
  {
    id: 18,
    q: "Professional providers solve problems by:",
    choices: [
      "Leaving passengers behind",
      "Arguing with dispatch",
      "Not leaving passengers behind",
      "Skipping paperwork",
    ],
    answer: 2,
    explanation: "Professional providers solve problems; they do not leave passengers behind.",
  },
  {
    id: 19,
    q: "Which core responsibility includes protecting patient privacy?",
    choices: [
      "Never abandon a patient",
      "Safety comes first",
      "Communication is critical",
      "Professionalism matters",
    ],
    answer: 3,
    explanation: "Protecting patient privacy is part of professionalism.",
  },
  {
    id: 20,
    q: "What are the four core responsibilities of every NEMT provider?",
    choices: [
      "Never abandon a patient, safety first, clear communication, professionalism",
      "Speed, silence, flexibility, privacy",
      "Driving fast, arriving early, avoiding paperwork, ignoring problems",
      "None of the above",
    ],
    answer: 0,
    explanation: "The four core responsibilities are never abandon a patient, safety first, clear communication, and professionalism.",
  },
  {
    id: 21,
    q: "If a passenger is not ready at pickup, the provider should:",
    choices: [
      "Leave immediately",
      "Wait silently and then leave",
      "Contact dispatch instead of leaving",
      "Refuse all future trips",
    ],
    answer: 2,
    explanation: "The provider should contact dispatch instead of leaving.",
  },
  {
    id: 22,
    q: "If a destination has a problem receiving the passenger, the provider should:",
    choices: [
      "Leave the passenger outside",
      "Contact dispatch for assistance",
      "Drive to another location",
      "Ignore the problem",
    ],
    answer: 1,
    explanation: "The provider should contact dispatch for assistance rather than leaving the passenger.",
  },
  {
    id: 23,
    q: "The final course review lists the four most important responsibilities as:",
    choices: [
      "Never abandon a patient",
      "Always prioritize safety",
      "Communicate clearly and quickly",
      "All of the above",
    ],
    answer: 3,
    explanation: "The final review lists all of these: never abandon a patient, always prioritize safety, communicate clearly and quickly, and maintain professionalism.",
  },
  {
    id: 24,
    q: "Following the four core responsibilities helps protect:",
    choices: [
      "Passengers",
      "Providers",
      "Healthcare facilities and the reputation of the industry",
      "All of the above",
    ],
    answer: 3,
    explanation: "Following these principles helps protect passengers, providers, healthcare facilities, and the reputation of the NEMT industry.",
  },
  {
    id: 25,
    q: "The main message of the Florida NEMT Basics Course is:",
    choices: [
      "Never abandon a patient, prioritize safety, communicate clearly, and maintain professionalism",
      "Finish trips as quickly as possible",
      "Skip paperwork whenever possible",
      "Only communicate when problems occur",
    ],
    answer: 0,
    explanation: "The main message is to never abandon a patient, prioritize safety, communicate clearly, and maintain professionalism at all times.",
  },
];
