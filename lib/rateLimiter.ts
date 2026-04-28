import { RateLimiterMemory } from "rate-limiter-flexible";

// 10 requests per 60 seconds
export const rateLimiter = new RateLimiterMemory({
  points: 10,       // 10 max requests
  duration: 60,    // per 60 sec
});