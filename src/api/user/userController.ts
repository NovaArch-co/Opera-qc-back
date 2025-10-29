import type { Request, RequestHandler, Response } from "express";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { StatusCodes } from "http-status-codes";
import { userRepository } from "./userRepository";

class UserController {
  // existing endpoint: returns current authenticated user
  public getMe: RequestHandler = async (req: Request, res: Response) => {
    // req.user should be populated by passport
    const { email } = req.user as any;
    const user = await userRepository.findAllAsync().then((list) => list.find((u) => u.email === email) || null);
    if (!user) {
      return handleServiceResponse(ServiceResponse.notFound("User not found"), res);
    }
    return handleServiceResponse(ServiceResponse.success("Success", user), res);
  };

  public listUsers: RequestHandler = async (_req: Request, res: Response) => {
    const users = await userRepository.findAllAsync();
    // Debug log to verify frontend calls reach this endpoint
    // eslint-disable-next-line no-console
    console.log(`listUsers called; returning ${users.length} users`);
    return handleServiceResponse(ServiceResponse.success("Users retrieved", users), res);
  };

  public getUserById: RequestHandler = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const user = await userRepository.findByIdAsync(id);
    if (!user) return handleServiceResponse(ServiceResponse.notFound("User not found"), res);
    return handleServiceResponse(ServiceResponse.success("User retrieved", user), res);
  };

  public createUser: RequestHandler = async (req: Request, res: Response) => {
    const data = req.body;
    try {
      const created = await userRepository.createAsync(data);
      return handleServiceResponse(ServiceResponse.success("User created", created, StatusCodes.CREATED), res);
    } catch (err) {
      return handleServiceResponse(ServiceResponse.failure("Unable to create user", null), res);
    }
  };

  public updateUser: RequestHandler = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const data = req.body;
    const updated = await userRepository.updateAsync(id, data);
    if (!updated) return handleServiceResponse(ServiceResponse.notFound("User not found"), res);
    return handleServiceResponse(ServiceResponse.success("User updated", updated), res);
  };

  public deleteUser: RequestHandler = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const deleted = await userRepository.deleteAsync(id);
    if (!deleted) return handleServiceResponse(ServiceResponse.notFound("User not found"), res);
    return handleServiceResponse(ServiceResponse.success("User deleted", { id }), res);
  };

  public toggleActive: RequestHandler = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const toggled = await userRepository.toggleActiveAsync(id);
    if (!toggled) return handleServiceResponse(ServiceResponse.notFound("User not found"), res);
    return handleServiceResponse(ServiceResponse.success("User active toggled", toggled), res);
  };
}

export const userController = new UserController();
