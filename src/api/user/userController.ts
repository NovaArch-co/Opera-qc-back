import type { Request, RequestHandler, Response } from "express";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

const prisma = new PrismaClient();
class UserController {
  public getMe: RequestHandler = async (req: Request, res: Response) => {
    const { email } = req.user;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return handleServiceResponse(ServiceResponse.failure("Not found", {}, StatusCodes.NOT_FOUND), res);
    }
    const serviceResponse = ServiceResponse.success("Success", user);
    return handleServiceResponse(serviceResponse, res);
  };
}

export const userController = new UserController();
