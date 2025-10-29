import dotenv from "dotenv";
import { url, cleanEnv, host, makeValidator, num, port, str, bool, } from "envalid";

dotenv.config();

// Create a custom validator for URLs that ensures protocol is present
const strUrl = makeValidator((value) => {
  if (typeof value !== "string") {
    throw new Error("Value must be a string");
  }

  // Add protocol if missing
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return `http://${value}`;
  }

  return value;
});

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ devDefault: ("test"), choices: ["development", "production", "test"] }),
  HOST: host({ devDefault: ("localhost") }),
  // Use SWAGGER_URL from docker-compose, fallback to local swagger-ui if not set
  SWAGGER_URL: str({ devDefault: ("http://localhost:8082") }),
  PORT: port({ devDefault: (3000) }),
  CORS_ORIGIN: str({ devDefault: ("*") }),
  FILE_SERVER_BASE_URL: str({
    devDefault: ("http://192.168.1.115/tmp/two-channel/stream-audio-incoming.php?recfile="),
  }),
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: (1000) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: (1000) }),
  JWT_SECRET: str({ devDefault: ("ajwtsecret") }),
  JWT_REFRESH_SECRET: str({ devDefault: ("ajwtsecret_refresh") }),
  MINIO_ENDPOINT_UTL: strUrl({ devDefault: ("http://minio:9000") }),
  MINIO_BUCKET_NAME: str({ devDefault: ("audio-files") }),
  MINIO_ACCESS_KEY: str({ devDefault: ("minioaccesskey") }),
  MINIO_SECRET_KEY: str({ devDefault: ("miniosecretkey") }),
  REDIS_HOST: str({ devDefault: ("redis") }),
  REDIS_PORT: port({ devDefault: (6379) }),
  REDIS_PASSWORD: str({ devDefault: ("") }),
  REDIS_SENTINEL_HOSTS: str({ devDefault: ("") }),
  REDIS_SENTINEL_NAME: str({ devDefault: ("mymaster") }),
  BULL_QUEUE: str({ devDefault: ("analyseCalls") }),
  POSTGRES_DB: str({ devDefault: ("opera_qc") }),
  POSTGRES_USER: str({ devDefault: ("postgres") }),
  POSTGRES_PASSWORD: str({ devDefault: ("postgres") }),
  DATABASE_URL: url({ devDefault: ("postgresql://postgres:postgres@localhost:5432/postgres") }),
  isProduction: bool({ devDefault: (false) }),
  // JWT configuration
  JWT_EXPIRES_IN: str({ devDefault: ("1d") }),
});