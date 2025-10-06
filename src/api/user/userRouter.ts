import express, { type Router } from "express";

import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { UserSchema } from "@/api/user/userModel";
import { userController } from "./userController";

export const userRegistry = new ExtendedOpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);

userRegistry.registerSecurePath({
  method: "get",
  path: "/api/users/me",
  tags: ["User"],
  responses: createApiResponse(UserSchema, "Success"),
});

userRouter.get("/me", userController.getMe);
