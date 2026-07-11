type RuntimeEnv = Record<string, string | undefined>;

const DEV_SECRET_FRAGMENTS = [
  'change_me',
  'super_secret',
  'fallback_secret',
  'dev-secret',
  'dev_secret',
  'local-secret',
] as const;

function requireEnv(env: RuntimeEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requirePositiveInteger(env: RuntimeEnv, key: string, fallback?: number) {
  const raw = env[key]?.trim();
  if (!raw && fallback !== undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function validateSecret(key: string, value: string, productionLike: boolean) {
  if (value.length < 16) {
    throw new Error(`${key} must be at least 16 characters long`);
  }

  if (
    productionLike &&
    DEV_SECRET_FRAGMENTS.some((fragment) => value.toLowerCase().includes(fragment))
  ) {
    throw new Error(`${key} must not use a development/default secret in production-like environments`);
  }
}

export function parseCorsOrigins(raw?: string | null) {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateEnv(rawEnv: RuntimeEnv) {
  const env = { ...rawEnv };
  const nodeEnv = requireEnv(env, 'NODE_ENV');
  const productionLike = !['development', 'test'].includes(nodeEnv);
  const port = requirePositiveInteger(env, 'PORT');
  const databaseUrl = requireEnv(env, 'DATABASE_URL');
  const jwtSecret = requireEnv(env, 'JWT_SECRET');
  const adminJwtSecret = requireEnv(env, 'ADMIN_JWT_SECRET');
  const jwtAccessTtlSeconds = requirePositiveInteger(
    env,
    'JWT_ACCESS_TTL_SECONDS',
    15 * 60,
  );
  const jwtRefreshTtlDays = requirePositiveInteger(
    env,
    'JWT_REFRESH_TTL_DAYS',
    30,
  );
  const adminJwtTtlSeconds = requirePositiveInteger(
    env,
    'ADMIN_JWT_TTL_SECONDS',
    60 * 60,
  );
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const googleMapsApiKey = env.GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const googlePlacesApiKey = env.GOOGLE_PLACES_API_KEY?.trim() ?? '';
  const googleDirectionsApiKey = env.GOOGLE_DIRECTIONS_API_KEY?.trim() ?? '';
  const mapsProvider = env.MAPS_PROVIDER?.trim() || 'auto';
  const bingMapsApiKey = env.BING_MAPS_API_KEY?.trim() ?? '';
  const azureMapsKey = env.AZURE_MAPS_KEY?.trim() ?? '';
  const osrmBaseUrl = env.OSRM_BASE_URL?.trim() ?? '';

  validateSecret('JWT_SECRET', jwtSecret, productionLike);
  validateSecret('ADMIN_JWT_SECRET', adminJwtSecret, productionLike);

  if (productionLike && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production-like environments');
  }
  if (!['auto', 'google', 'bing', 'azure', 'osm'].includes(mapsProvider)) {
    throw new Error('MAPS_PROVIDER must be one of auto, google, bing, azure, osm');
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    PORT: `${port}`,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    ADMIN_JWT_SECRET: adminJwtSecret,
    JWT_ACCESS_TTL_SECONDS: `${jwtAccessTtlSeconds}`,
    JWT_REFRESH_TTL_DAYS: `${jwtRefreshTtlDays}`,
    ADMIN_JWT_TTL_SECONDS: `${adminJwtTtlSeconds}`,
    CORS_ORIGINS: corsOrigins.join(','),
    GOOGLE_MAPS_API_KEY: googleMapsApiKey,
    GOOGLE_PLACES_API_KEY: googlePlacesApiKey,
    GOOGLE_DIRECTIONS_API_KEY: googleDirectionsApiKey,
    MAPS_PROVIDER: mapsProvider,
    BING_MAPS_API_KEY: bingMapsApiKey,
    AZURE_MAPS_KEY: azureMapsKey,
    OSRM_BASE_URL: osrmBaseUrl,
  };
}
