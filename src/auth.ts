import jwt from "jsonwebtoken";
import { ExtractJwt, Strategy as JwtStrategy, type StrategyOptionsWithoutRequest } from "passport-jwt";
import dotenv from "dotenv";
import { env } from "@/common/utils/envConfig";
import prisma from "@/common/utils/prisma";

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
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (user) {
    return done(null, user);
  }
  return done(null, false);
});
