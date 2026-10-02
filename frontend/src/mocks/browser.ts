// Superseded: the mock layer is now a fetch-level adapter, installed via
// `installMockApi()` from `./install` (called in `src/main.tsx`).
//
// This file previously started an MSW service worker. MSW was dropped because
// it requires both an npm install and a generated `public/mockServiceWorker.js`
// that cannot be produced without network access, which would have made the
// "works offline against mocks" guarantee unverifiable. Safe to delete.
export {}
