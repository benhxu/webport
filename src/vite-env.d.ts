/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTACT_FORM_ENDPOINT?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_SESSION_REPLAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
