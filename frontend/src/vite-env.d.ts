/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin of the API, e.g. https://nativityguard-backend.onrender.com */
  readonly VITE_API_URL?: string
  /** 'true' to serve data from local MSW mocks instead of the real API. */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
