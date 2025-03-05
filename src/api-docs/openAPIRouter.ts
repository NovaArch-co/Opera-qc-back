import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";

import { generateOpenAPIDocument } from "@/api-docs/openAPIDocumentGenerator";
import expressBasicAuth from "express-basic-auth";

export const openAPIRouter: Router = express.Router();
const openAPIDocument = generateOpenAPIDocument();
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
openAPIRouter.get("/docs/swagger.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openAPIDocument);
});

if (ADMIN_USERNAME && ADMIN_PASSWORD) {
  openAPIRouter.use(
    "/",
    expressBasicAuth({
      users: { [ADMIN_USERNAME]: ADMIN_PASSWORD },
      challenge: true,
    }),
    swaggerUi.serve,
    swaggerUi.setup(openAPIDocument, {}),
  );
} else {
  openAPIRouter.use("/swagger", swaggerUi.serveWithOptions({ redirect: false,cacheControl:false }), swaggerUi.setup(openAPIDocument, {}));
}
