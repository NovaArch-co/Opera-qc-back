import dotenv from "dotenv";
import {cleanEnv, host, num, port, str, testOnly} from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
    NODE_ENV: str({devDefault: testOnly("test"), choices: ["development", "production", "test"]}),
    HOST: host({devDefault: testOnly("localhost")}),
    SWAGGER_URL: host({devDefault: testOnly("https://qc.novaarchai.com")}),
    PORT: port({devDefault: testOnly(3000)}),
    CORS_ORIGIN: str({devDefault: testOnly("*")}),
    FILE_SERVER_BASE_URL: str({devDefault: testOnly("http://185.243.48.218:4567/")}),
    COMMON_RATE_LIMIT_MAX_REQUESTS: num({devDefault: testOnly(1000)}),
    COMMON_RATE_LIMIT_WINDOW_MS: num({devDefault: testOnly(1000)}),
    JWT_SECRET: str({devDefault: testOnly("ajwtsecret")}),
    JWT_REFRESH_SECRET: str({devDefault: testOnly("ajwtsecret_refresh")}),
    MINIO_ENDPOINT_UTL: str({devDefault: testOnly("http://45.156.185.11:9000")}),
    REDIS_HOST: str({devDefault: testOnly("45.156.185.11")}),
    REDIS_PORT: port({devDefault: testOnly(6379)}),
    BULL_QUEUE: str({devDefault: testOnly("analyseCalls")}),
});
