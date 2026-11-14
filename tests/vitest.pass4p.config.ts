// Isolate server handlers from the application RPC transform for synthetic persistence checks.
export default {
  resolve: { alias: { '@': `${process.cwd()}/src` } },
  test: { include: ['tests/pass4p-preference-persistence.test.ts','tests/pass4p-rules.test.ts','tests/onboarding-rules.test.ts'] },
};