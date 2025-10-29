import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

// Public-facing user shape used by the frontend UI
export type User = z.infer<typeof UserSchema>;
export const UserSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  username: z.string().optional(),
  evaluatorName: z.string().optional(),
  sessionId: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// Input Validation for 'GET users/:id' endpoint
export const GetUserSchema = z.object({
  params: z.object({ id: commonValidations.id }),
});

export const CreateUserSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    username: z.string().optional(),
    evaluatorName: z.string().optional(),
    sessionId: z.string().optional(),
    email: z.string().email().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const UpdateUserSchema = z.object({
  params: z.object({ id: commonValidations.id }),
  body: z.object({
    name: z.string().optional(),
    username: z.string().optional(),
    evaluatorName: z.string().optional(),
    sessionId: z.string().optional(),
    email: z.string().email().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});
