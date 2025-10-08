import { reconnectToDatabase } from "@/common/utils/dbHealthCheck";
import { env } from "@/common/utils/envConfig";
import prisma from "@/common/utils/prisma";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { ExtractJwt, Strategy as JwtStrategy, type StrategyOptionsWithoutRequest } from "passport-jwt";

dotenv.config();

export const jwtOpts: StrategyOptionsWithoutRequest = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET!,
};

export const jwtRefreshOpts: StrategyOptionsWithoutRequest = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET!,
};

export const generateAccessToken = (payload: any) => {
  const token = jwt.sign(payload, jwtOpts.secretOrKey, { expiresIn: "3h" });
  return token;
};

export const generateRefreshToken = (payload: any) => {
  const token = jwt.sign(payload, jwtRefreshOpts.secretOrKey, { expiresIn: "48h" });
  return token;
};

export const generateToken = (payload: any) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken({}),
  };
};

export const passportConfig = new JwtStrategy(jwtOpts, async (payload, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    console.error("Authentication error:", error);

    // Check if it's a connection error
    if (
      error instanceof Error &&
      (error.message.includes("prepared statement") ||
        error.message.includes("connection") ||
        error.message.includes("timeout"))
    ) {
      // Try to reconnect to the database
      const reconnected = await reconnectToDatabase();
      if (reconnected) {
        // Try the query again after reconnecting
        try {
          const user = await prisma.user.findUnique({ where: { email: payload.email } });
          if (user) {
            return done(null, user);
          }
        } catch (retryError) {
          console.error("Authentication retry error:", retryError);
        }
      }
    }

    return done(error, false);
  }
});
