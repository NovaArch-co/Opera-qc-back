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

// Configure Swagger options
const swaggerOptions = {
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: "none",
    // Set proper URLs and server handling for correct API calls
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    requestInterceptor: (req: Record<string, any>) => {
      // This code will run in the browser when "Try it out" is used
      const newReq = req;
      if (req.url && typeof req.url === 'string' && req.url.includes('/api/docs/api/')) {
        // Fix the URL by removing the duplicate /api/docs prefix
        newReq.url = req.url.replace('/api/docs/api/', '/api/');
      }
      return newReq;
    }
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
