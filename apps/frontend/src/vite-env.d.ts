/// <reference types="vite/client" />

// CRITICAL: Vite environment variable types
// Allows TypeScript to recognize import.meta.env.VITE_* variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
