/** Internal catalog of portal features that may later appear in the homepage
 *  provider-tools scroller. Nothing is shown publicly unless publicApproved is
 *  explicitly set to true by the owner. Icons are lucide-react names. */
export type FeatureAudience = "Provider" | "Patient" | "Facility/Organization" | "Admin" | "Shared";
export type FeatureStatus = "complete" | "partial" | "planned";
export type PortalFeature = {
  name: string; audience: FeatureAudience; description: string; icon: string;
  route: string; status: FeatureStatus; publicApproved: boolean;
};

export const FEATURE_CATALOG: PortalFeature[] = [
  { name: "Smart Notes", audience: "Provider", description: "Private operational notes for your business, saved securely.", icon: "StickyNote", route: "/portal", status: "complete", publicApproved: false },
  { name: "Trips", audience: "Provider", description: "See trips offered or assigned to your company.", icon: "Car", route: "/portal/trips", status: "complete", publicApproved: false },
  { name: "Schedule", audience: "Provider", description: "Plan the day across drivers and vehicles.", icon: "CalendarDays", route: "/portal/schedule", status: "complete", publicApproved: false },
  { name: "Vehicles", audience: "Provider", description: "Keep your fleet list and vehicle types up to date.", icon: "Truck", route: "/portal/vehicles", status: "complete", publicApproved: false },
  { name: "Drivers", audience: "Provider", description: "Manage drivers, availability and earnings reports.", icon: "Users", route: "/portal/drivers", status: "complete", publicApproved: false },
  { name: "Provider Network", audience: "Shared", description: "Find verified providers by service area and service type.", icon: "Network", route: "/portal/network", status: "complete", publicApproved: false },
  { name: "Training & Tests", audience: "Provider", description: "Buy and continue driver training courses and view certificates.", icon: "GraduationCap", route: "/portal/training", status: "complete", publicApproved: false },
  { name: "Business Messaging", audience: "Shared", description: "Message other businesses in the network from one inbox.", icon: "MessageSquare", route: "/portal/messaging", status: "partial", publicApproved: false },
  { name: "Business Information", audience: "Provider", description: "Keep your company details current.", icon: "Building2", route: "/portal/account", status: "complete", publicApproved: false },
  { name: "Pricing Rules", audience: "Provider", description: "Set your own rates by service type.", icon: "DollarSign", route: "/portal/account", status: "complete", publicApproved: false },
  { name: "Integrations", audience: "Provider", description: "Connect the dispatch software you already use.", icon: "Plug", route: "/portal/account", status: "partial", publicApproved: false },
  { name: "Payouts", audience: "Provider", description: "Track balances and payouts for completed trips.", icon: "Banknote", route: "/portal/account", status: "partial", publicApproved: false },
  { name: "Network Profile", audience: "Provider", description: "Control how your business appears in the network.", icon: "IdCard", route: "/portal/account", status: "complete", publicApproved: false },
  { name: "New Trip Request", audience: "Shared", description: "Request a passenger trip or a medical delivery.", icon: "PlusCircle", route: "/portal/requests/new", status: "complete", publicApproved: false },
  { name: "Trip History", audience: "Patient", description: "Review every request and its current status.", icon: "ListChecks", route: "/portal/requests", status: "complete", publicApproved: false },
  { name: "Safe CSV Upload", audience: "Facility/Organization", description: "Upload many requests with a full check before anything is sent.", icon: "Upload", route: "/portal/upload-csv", status: "complete", publicApproved: false },
  { name: "Saved Providers", audience: "Facility/Organization", description: "Keep a short list of providers you work with.", icon: "Star", route: "/portal/saved-providers", status: "complete", publicApproved: false },
  { name: "Contacts", audience: "Facility/Organization", description: "Store the people you coordinate trips with.", icon: "Contact2", route: "/portal/contacts", status: "complete", publicApproved: false },
  { name: "Payers", audience: "Facility/Organization", description: "Keep payer details ready for each request.", icon: "Wallet", route: "/portal/payers", status: "complete", publicApproved: false },
  { name: "Notifications", audience: "Shared", description: "Status updates for your requests and trips.", icon: "Bell", route: "/portal/notifications", status: "complete", publicApproved: false },
  { name: "Account & Security", audience: "Shared", description: "Profile, password and sign-out of other devices.", icon: "ShieldCheck", route: "/portal/account", status: "complete", publicApproved: false },
  { name: "Scoped Administrators", audience: "Admin", description: "Give each admin only the sections and accounts they need.", icon: "UserCog", route: "/admin/admins", status: "complete", publicApproved: false },
  { name: "Request on Behalf", audience: "Admin", description: "Submit a request for a patient or organization you support.", icon: "PlusCircle", route: "/admin/on-behalf", status: "complete", publicApproved: false },
];

/** Only owner-approved, finished features may ever be shown publicly. */
export const publicFeatures = () => FEATURE_CATALOG.filter((f) => f.publicApproved && f.status === "complete");
