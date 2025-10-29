import express, { type Router } from "express";

import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { UserSchema, CreateUserSchema, UpdateUserSchema, GetUserSchema } from "@/api/user/userModel";
import { userController } from "./userController";

export const userRegistry = new ExtendedOpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);

// get current user
userRegistry.registerSecurePath({
  method: "get",
  path: "/api/users/me",
  tags: ["User"],
  responses: createApiResponse(UserSchema, "Success"),
});

// list users
userRegistry.registerSecurePath({
  method: "get",
  path: "/api/users",
  tags: ["User"],
  responses: createApiResponse(UserSchema.array(), "Success"),
});

// get user by id
userRegistry.registerSecurePath({
  method: "get",
  path: "/api/users/{id}",
  tags: ["User"],
  requestSchema: GetUserSchema,
  responses: createApiResponse(UserSchema, "Success"),
});

// create user
userRegistry.registerSecurePath({
  method: "post",
  path: "/api/users",
  tags: ["User"],
  requestSchema: CreateUserSchema,
  responses: createApiResponse(UserSchema, "Created"),
});

// update user
userRegistry.registerSecurePath({
  method: "put",
  path: "/api/users/{id}",
  tags: ["User"],
  requestSchema: UpdateUserSchema,
  responses: createApiResponse(UserSchema, "Success"),
});

// delete user
userRegistry.registerSecurePath({
  method: "delete",
  path: "/api/users/{id}",
  tags: ["User"],
  requestSchema: GetUserSchema,
  responses: createApiResponse(UserSchema, "Success"),
});

// toggle active
userRegistry.registerSecurePath({
  method: "patch",
  path: "/api/users/{id}/toggle-active",
  tags: ["User"],
  requestSchema: GetUserSchema,
  responses: createApiResponse(UserSchema, "Success"),
});

// route bindings
userRouter.get("/me", userController.getMe);
userRouter.get("/", userController.listUsers);
userRouter.get("/:id", userController.getUserById);
userRouter.post("/", userController.createUser);
userRouter.put("/:id", userController.updateUser);
userRouter.delete("/:id", userController.deleteUser);
userRouter.patch("/:id/toggle-active", userController.toggleActive);
