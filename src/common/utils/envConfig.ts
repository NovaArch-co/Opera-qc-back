import dotenv from "dotenv";
import { cleanEnv, host, num, port, str, testOnly, url, makeValidator } from "envalid";

dotenv.config();

// Create a custom validator for URLs that ensures protocol is present
const strUrl = makeValidator((value) => {
    if (typeof value !== 'string') {
        throw new Error('Value must be a string');
    }

    // Add protocol if missing
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return `http://${value}`;
    }

    return value;
});

export const env = cleanEnv(process.env, {
    NODE_ENV: str({ devDefault: testOnly("test"), choices: ["development", "production", "test"] }),
    HOST: host({ devDefault: testOnly("localhost") }),
    // Use SWAGGER_URL from docker-compose, fallback to local swagger-ui if not set
    SWAGGER_URL: str({ devDefault: testOnly("http://localhost:8082") }),
    PORT: port({ devDefault: testOnly(3000) }),
    CORS_ORIGIN: str({ devDefault: testOnly("*") }),
    FILE_SERVER_BASE_URL: str({ devDefault: testOnly("http://192.168.1.115/tmp/two-channel/stream-audio-incoming.php?recfile=") }),
    COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(1000) }),
    COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(1000) }),
    JWT_SECRET: str({ devDefault: testOnly("ajwtsecret") }),
    JWT_REFRESH_SECRET: str({ devDefault: testOnly("ajwtsecret_refresh") }),
    MINIO_ENDPOINT_UTL: strUrl({ devDefault: testOnly("http://minio:9000") }),
    MINIO_ACCESS_KEY: str({ devDefault: testOnly("minioaccesskey") }),
    MINIO_SECRET_KEY: str({ devDefault: testOnly("miniosecretkey") }),
    REDIS_HOST: str({ devDefault: testOnly("redis") }),
    REDIS_PORT: port({ devDefault: testOnly(6379) }),
    BULL_QUEUE: str({ devDefault: testOnly("analyseCalls") }),
    DATABASE_URL: url({ devDefault: testOnly("postgresql://postgres:postgres@localhost:5432/postgres") }),
});
