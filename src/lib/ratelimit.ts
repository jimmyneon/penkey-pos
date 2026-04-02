import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a no-op ratelimiter for development/testing
class NoOpRatelimit {
  async limit(key: string) {
    return { success: true };
  }
}

let ratelimit: any;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Production: Use real Redis-backed rate limiting
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    analytics: true,
    prefix: "@penkey/pos/ratelimit",
  });
} else {
  // Development: Use no-op ratelimiter (all requests pass through)
  console.warn("[Ratelimit] UPSTASH_REDIS_REST_URL not set, using no-op ratelimiter for development");
  ratelimit = new NoOpRatelimit();
}

export { ratelimit };
