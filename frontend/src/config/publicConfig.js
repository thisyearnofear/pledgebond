/**
 * Public environment configuration — safe for the browser bundle.
 *
 * This file MUST ONLY reference NEXT_PUBLIC_* env vars and non-secret config.
 * Server-only secrets (API keys, private keys, tokens) live in
 * @/config/serverConfig and must never be imported from client-side code.
 */

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(
    (variable) =>
      !process.env[variable] ||
      process.env[variable] === "dummy-api-key" ||
      process.env[variable].includes("dummy")
  );

  if (missing.length > 0) {
    console.warn(
      `Missing or dummy Firebase environment variables: ${missing.join(", ")}`
    );
    if (isProduction) {
      console.error("CRITICAL: Firebase variables missing in production!");
    }
  }
};

const baseConfig = {
  isDevelopment,
  isProduction,
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-api-key",
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "pledgebond.firebasestorage.app",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:dummy",
    measurementId:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-DUMMY",
  },
  api: {
    baseUrl: isProduction
      ? "https://pledgebond.vercel.app/api"
      : "http://localhost:3000/api",
    timeout: 30000,
    retryAttempts: 3,
  },
  features: {
    enableMockData: false,
    enableAnalytics: isProduction,
    enableErrorReporting: isProduction,
  },
  cache: {
    defaultTTL: 5 * 60 * 1000,
    githubDataTTL: 60 * 60 * 1000,
    contractDataTTL: 60 * 1000,
  },
};

const environmentConfig = {
  development: {
    ...baseConfig,
    api: { ...baseConfig.api, timeout: 10000 },
    features: {
      ...baseConfig.features,
      enableAnalytics: false,
      enableErrorReporting: false,
    },
  },
  production: {
    ...baseConfig,
    features: {
      ...baseConfig.features,
      enableAnalytics: true,
      enableErrorReporting: true,
    },
  },
  test: {
    ...baseConfig,
    features: {
      ...baseConfig.features,
      enableAnalytics: false,
      enableErrorReporting: false,
    },
  },
};

const getConfig = () => {
  const env = process.env.NODE_ENV || "development";
  const config = environmentConfig[env] || environmentConfig.development;

  // Only validate in runtime, not during build
  if (typeof window !== "undefined") {
    validateEnvironment();
  }

  return config;
};

/**
 * Client-safe API service validation.
 * Only checks NEXT_PUBLIC_* env vars — server-side services (circle, github,
 * blockchain) require server-only secrets, so they always return true here
 * and must be validated via an API call or server-side check.
 */
const validateApiService = (serviceName) => {
  switch (serviceName) {
    case "lifi":
      return !!process.env.NEXT_PUBLIC_LIFI_API_KEY;
    case "metamask":
      return !!process.env.NEXT_PUBLIC_METAMASK_PROJECT_ID;
    // Server-side services: always report true client-side; actual validation
    // happens in @/config/serverConfig (server-only).
    case "circle":
    case "github":
    case "blockchain":
    case "solana":
      return true;
    default:
      return false;
  }
};

export default getConfig();
export { validateEnvironment, validateApiService };