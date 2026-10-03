// Central public-site configuration. Change values here only.
import { CONTACT_INFO } from "@/lib/contact-info";

import heroImg from "@/assets/home/hero-wheelchair-assist.jpg";
import familyImg from "@/assets/home/path-family.jpg";
import facilityImg from "@/assets/home/path-facility.jpg";
import providerImg from "@/assets/home/path-provider.jpg";
import stretcherImg from "@/assets/home/service-stretcher.jpg";
import founderImg from "@/assets/home/founder-provider.jpg";

/** Real public phone number goes in CONTACT_INFO.phone. Empty = show "Call Us" with no link. */
export const PUBLIC_PHONE = CONTACT_INFO.phone;
export const PUBLIC_EMAIL = CONTACT_INFO.email;
/** Temporary placeholder number; dial string set explicitly. */
export const PUBLIC_PHONE_TEL = "tel:5555555555";
export const phoneHref = (_p: string) => PUBLIC_PHONE_TEL;

/** Temporary AI-generated placeholder photos — replace with licensed/approved photos. */
export const HOME_IMAGES = {
  hero: { src: heroImg, w: 1600, h: 1008, alt: "A transportation professional helps a smiling woman in a wheelchair onto the ramp of an accessible van on a sunny Florida street" },
  family: { src: familyImg, w: 1008, h: 1200, alt: "A daughter walks arm in arm with her father, who uses a cane, toward a waiting passenger van" },
  facility: { src: facilityImg, w: 1200, h: 912, alt: "A facility coordinator arranges transportation by phone while a resident with a walker passes behind her" },
  provider: { src: providerImg, w: 1008, h: 1200, alt: "A transportation provider checks trip details on his phone beside his accessible van" },
  stretcher: { src: stretcherImg, w: 1200, h: 912, alt: "Two transportation crew members carefully load a seated passenger on a stretcher into a non-emergency van" },
  founder: { src: founderImg, w: 1008, h: 1200, alt: "A working NEMT provider reviews trip paperwork at the open door of her accessible van at sunrise" },
} as const;

/** Temporary destinations. TODO(routing phase): replace with real pages. */
export const BOOKING_ROUTE = "/book";
/** Existing training products (titles/slugs from the live course catalog). */
export const TRAINING = [
  { title: "HIPAA Training for NEMT", href: "/shop/hipaa" },
  { title: "Florida Basic NEMT Test", href: "/shop/nemt-certification" },
] as const;
export const LINKS = {
  book: BOOKING_ROUTE,
  createAccount: "/create-account",
  faq: "/frequently-asked-questions",
  join: "/join",
  training: "/shop",
  signIn: "/login",
} as const;
