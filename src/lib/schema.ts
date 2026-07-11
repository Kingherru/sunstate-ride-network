export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My Florida NEMT",
  url: "https://myfloridanemt.com",
  logo: "https://myfloridanemt.com/logo-horizontal.png",
  sameAs: [
    "https://www.facebook.com/MyFloridaNEMT",
    "https://www.linkedin.com/company/myfloridanemt",
  ],
};

export const buildServiceSchema({
  serviceType,
  description,
  url,
  name,
}: {
  serviceType: string;
  description: string;
  url: string;
  name: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType,
    description,
    provider: {
      "@type": "Organization",
      name: "My Florida NEMT",
      url: "https://myfloridanemt.com",
    },
    areaServed: {
      "@type": "State",
      name: "Florida",
    },
    url,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      priceValidUntil: "2099-12-31",
      description: "Free quote; Medicaid, insurance, and private-pay billing accepted",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "127",
      bestRating: "5",
      worstRating: "1",
    },
  };
}
