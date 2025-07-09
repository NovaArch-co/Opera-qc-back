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

// Create a proxy for API requests from Swagger UI to fix the path issues
openAPIRouter.all("/proxy/*", (req: Request, res: Response) => {
  // Strip "/proxy" from the path and forward to the actual API endpoint
  const targetPath = req.path.replace('/proxy', '');
  console.log(`Proxying request from ${req.path} to ${targetPath}`);

  // Forward the request to the correct API endpoint
  req.url = targetPath;

  // Continue processing the request through the Express middleware chain
  res.locals.proxied = true;
  req.app._router.handle(req, res);
});

// Configure Swagger options
const swaggerOptions = {
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: "none",
    // Explicitly set the server URL
    url: "/api/docs/swagger.json",
    // Set up customized request handling
    requestInterceptor: (req: Record<string, any>) => {
      const newReq = { ...req };

      // Redirect all API requests through our proxy
      if (newReq.url && typeof newReq.url === 'string') {
        // If the URL contains an API path that would be affected by the /api/docs prefix
        if (newReq.url.includes('/api/') && !newReq.url.includes('/api/docs/swagger')) {
          // Replace the URL to use our proxy endpoint
          newReq.url = newReq.url.replace(/\/api\//, '/api/docs/proxy/');
        }
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
