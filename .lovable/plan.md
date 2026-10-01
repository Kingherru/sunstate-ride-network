# Homepage final corrections and public heading consistency

## Scope
- Apply the uploaded homepage visual corrections and motion brief without changing functionality, backend services, training, policies, sitemap, or SEO data.
- Extend only the heading hierarchy, uppercase treatment, and alignment rules across the existing public pages, as requested.
- Do not publish.

## Homepage changes
- Enforce one uppercase H1, uppercase H2 section headings, and H3 headings for connection paths, provider steps, and services.
- Standardize every visible brand reference as `MY FLORIDA NEMT`; retain the orange `NEMT` treatment in header and footer lockups.
- Replace provider-step numbers with four matching icons and align all four cards consistently.
- Rebuild Services as a balanced desktop two-column section: left-aligned copy and CTA beside a 2×2 service grid; stack cleanly on smaller screens.
- Change Membership to the approved pale-orange surface, dark-blue copy, white fee panels, and a blue Join button.
- Increase shared CTA horizontal spacing and prevent labels from wrapping or overflowing.

## Site-wide public heading rules
- Make shared public section headings uppercase.
- Center complete one-column heading groups; preserve left alignment when a heading belongs to a balanced two-column composition.
- Correct semantic heading levels where public-page structure currently skips or misuses levels.
- Keep footer navigation labels semantic without affecting page heading outlines.

## Homepage motion
- Add lightweight, one-time viewport entrances using CSS and Intersection Observer: section headings, card groups, hero halves, path cards, provider steps, and Membership.
- Add a single restrained nudge and accessible color sweep to primary CTAs.
- Preserve existing provider-tool and map behavior while smoothing panel and selection transitions.
- Disable all decorative motion under `prefers-reduced-motion` and show content immediately.

## Validation
- Check public heading structure and brand capitalization.
- Test the homepage at 2560, 1440, 1024, 768, and 390 pixels for alignment, single-line CTA labels, membership styling, and horizontal overflow.
- Verify interactions, reduced-motion behavior, console output, type safety, and the latest preview build.
