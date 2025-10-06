import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
});

export const TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const VerifySchema = z.object({
  email: z.string().email(),
  verificationCode: z.string(),
});
