import type {Request, RequestHandler, Response} from "express";

import {generateToken} from "@/auth";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

class AuthController {
    public login: RequestHandler = async (_req: Request, res: Response) => {
        const {email, password} = _req.body;
        const user = await prisma.user.findUnique({where: {email}});
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return handleServiceResponse(ServiceResponse.unAuthorized("Invalid credentials"), res);
        }
        if (!user.isVerified) {
            return handleServiceResponse(ServiceResponse.unAuthorized("User not verified"), res);
        }
        const token = generateToken({sub: user.id, email});
        return handleServiceResponse(ServiceResponse.success("Success", {...token, user}), res);
    };

    public register: RequestHandler = async (_req: Request, res: Response) => {
        const {email, password, name} = _req.body;
        const existingUser = await prisma.user.findUnique({where: {email}});
        if (existingUser) {
            return handleServiceResponse(ServiceResponse.failure("Duplicate", {}), res);
        }
        const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());
        await prisma.user.create({data: {email, password: hashedPassword, name, isVerified: false}});
        return handleServiceResponse(ServiceResponse.success("Success", {}, 200), res);
    };
}

export const authController = new AuthController();
