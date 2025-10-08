import IORedis from 'ioredis';
import { env } from '@/common/utils/envConfig';

// Redis connection configuration with high availability
export class RedisConnectionManager {
    private static instance: RedisConnectionManager;
    private redisClient: IORedis | null = null;
    private sentinelClient: IORedis | null = null;
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000; // Start with 1 second

    private constructor() { }

    public static getInstance(): RedisConnectionManager {
        if (!RedisConnectionManager.instance) {
            RedisConnectionManager.instance = new RedisConnectionManager();
        }
        return RedisConnectionManager.instance;
    }

    public async connect(): Promise<IORedis> {
        if (this.redisClient && this.isConnected) {
            return this.redisClient;
        }

        try {
            // Check if we should use Sentinel or direct connection
            const sentinelHosts = env.REDIS_SENTINEL_HOSTS?.split(',') || [];

            if (sentinelHosts.length > 0) {
                // Use Redis Sentinel for high availability
                this.redisClient = new IORedis({
                    sentinels: sentinelHosts.map(host => {
                        const [hostname, port] = host.trim().split(':');
                        return { host: hostname, port: parseInt(port) };
                    }),
                    name: env.REDIS_SENTINEL_NAME || 'mymaster',
                    password: env.REDIS_PASSWORD,
                    db: 0,

                    // Connection options
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                    lazyConnect: true,

                    // Retry strategy
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,

                    // Connection pool
                    family: 4,
                    keepAlive: true,

                    // Sentinel options
                    sentinelRetryStrategy: (times) => {
                        const delay = Math.min(times * 50, 2000);
                        console.log(`Sentinel retry attempt ${times}, delay: ${delay}ms`);
                        return delay;
                    },

                    // Failover options
                    enableOfflineQueue: false,

                    // Logging
                    showFriendlyErrorStack: true,
                });
            } else {
                // Direct connection (fallback)
                this.redisClient = new IORedis({
                    host: env.REDIS_HOST || 'localhost',
                    port: env.REDIS_PORT || 6379,
                    password: env.REDIS_PASSWORD,
                    db: 0,

                    // Connection options
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                    lazyConnect: true,

                    // Retry strategy
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,

                    // Connection pool
                    family: 4,
                    keepAlive: true,

                    // Retry strategy
                    retryStrategy: (times) => {
                        const delay = Math.min(times * 50, 2000);
                        console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
                        return delay;
                    },

                    // Disable offline queue to fail fast
                    enableOfflineQueue: false,

                    // Logging
                    showFriendlyErrorStack: true,
                });
            }

            // Set up event handlers
            this.setupEventHandlers();

            // Connect
            await this.redisClient.connect();

            console.log('✅ Redis connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;

            return this.redisClient;

        } catch (error) {
            console.error('❌ Redis connection failed:', error);
            await this.handleConnectionError(error as Error);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        if (!this.redisClient) return;

        this.redisClient.on('connect', () => {
            console.log('🔗 Redis connection established');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.redisClient.on('ready', () => {
            console.log('✅ Redis is ready to accept commands');
        });

        this.redisClient.on('error', async (error) => {
            console.error('❌ Redis error:', error);
            this.isConnected = false;
            await this.handleConnectionError(error);
        });

        this.redisClient.on('close', () => {
            console.log('🔌 Redis connection closed');
            this.isConnected = false;
        });

        this.redisClient.on('reconnecting', (ms) => {
            console.log(`🔄 Redis reconnecting in ${ms}ms (attempt ${this.reconnectAttempts + 1})`);
        });

        this.redisClient.on('end', () => {
            console.log('🔚 Redis connection ended');
            this.isConnected = false;
        });

        // Sentinel-specific events
        this.redisClient.on('+switch-master', (masterName, oldHost, oldPort, newHost, newPort) => {
            console.log(`🔄 Redis master switched: ${masterName} from ${oldHost}:${oldPort} to ${newHost}:${newPort}`);
        });
    }

    private async handleConnectionError(error: Error): Promise<void> {
        this.reconnectAttempts++;

        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            console.log(`⏳ Attempting to reconnect to Redis in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(async () => {
                try {
                    await this.connect();
                } catch (reconnectError) {
                    console.error('Reconnection failed:', reconnectError);
                }
            }, delay);
        } else {
            console.error('🚨 Max reconnection attempts reached. Redis connection failed permanently.');
            // Here you could implement additional alerting or fallback mechanisms
        }
    }

    public async disconnect(): Promise<void> {
        if (this.redisClient) {
            await this.redisClient.quit();
            this.redisClient = null;
            this.isConnected = false;
        }
    }

    public getClient(): IORedis | null {
        return this.redisClient;
    }

    public isHealthy(): boolean {
        return this.isConnected && this.redisClient !== null;
    }

    public async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
        if (!this.redisClient || !this.isConnected) {
            return { healthy: false, error: 'Not connected' };
        }

        try {
            const start = Date.now();
            await this.redisClient.ping();
            const latency = Date.now() - start;

            return { healthy: true, latency };
        } catch (error) {
            return { healthy: false, error: (error as Error).message };
        }
    }

    public async getInfo(): Promise<Record<string, any>> {
        if (!this.redisClient || !this.isConnected) {
            throw new Error('Redis not connected');
        }

        const info = await this.redisClient.info();
        const lines = info.split('\r\n');
        const result: Record<string, any> = {};

        for (const line of lines) {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    result[key] = value;
                }
            }
        }

        return result;
    }
}

// Export singleton instance
export const redisManager = RedisConnectionManager.getInstance();

// Helper function to get Redis client with automatic connection
export async function getRedisClient(): Promise<IORedis> {
    return await redisManager.connect();
}

// Circuit breaker for Redis operations
export class RedisCircuitBreaker {
    private failures = 0;
    private lastFailTime = 0;
    private readonly maxFailures = 5;
    private readonly resetTimeout = 60000; // 1 minute
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailTime = Date.now();

        if (this.failures >= this.maxFailures) {
            this.state = 'OPEN';
            console.error(`🔴 Redis circuit breaker OPEN after ${this.failures} failures`);
        }
    }

    getState(): string {
        return this.state;
    }
}

export const redisCircuitBreaker = new RedisCircuitBreaker();
