import {RedisOptions} from "ioredis";
import {env} from "@/common/utils/envConfig";

export const redisConfig: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
};