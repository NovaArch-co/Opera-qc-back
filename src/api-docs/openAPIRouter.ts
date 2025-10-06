import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";

import { generateOpenAPIDocument } from "@/api-docs/openAPIDocumentGenerator";
import expressBasicAuth from "express-basic-auth";

export const openAPIRouter: Router = express.Router();
const openAPIDocument = generateOpenAPIDocument();
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

// JSON endpoint for raw OpenAPI spec
openAPIRouter.get("/swagger.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openAPIDocument);
});

// Swagger UI options to hide servers dropdown
const swaggerOptions = {
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: "none",
    operationsSorter: 'alpha',
    tagsSorter: 'alpha',
    filter: true,
    plugins: [
      () => {
        return {
          wrapComponents: {
            servers: () => () => null // This hides the servers dropdown
          }
        }
      }
    ]
  }
};

// Setup Swagger UI
if (ADMIN_USERNAME && ADMIN_PASSWORD) {
  // If admin credentials are provided, protect Swagger with basic auth
  openAPIRouter.use(
    "/",
    expressBasicAuth({
      users: { [ADMIN_USERNAME]: ADMIN_PASSWORD },
      challenge: true,
    }),
    swaggerUi.serve,
    swaggerUi.setup(openAPIDocument, swaggerOptions),
  );
} else {
  // No auth protection for Swagger UI
  openAPIRouter.use("/", swaggerUi.serve, swaggerUi.setup(openAPIDocument, swaggerOptions));
}
