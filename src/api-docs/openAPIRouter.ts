import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";

import { generateOpenAPIDocument } from "@/api-docs/openAPIDocumentGenerator";
import expressBasicAuth from "express-basic-auth";

export const openAPIRouter: Router = express.Router();
let openAPIDocument: any = null;
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

try {
  openAPIDocument = generateOpenAPIDocument();
  // Attempt to write the generated spec to disk so the external swagger-ui container
  // (which mounts ./openapi/swagger.json) can serve the up-to-date file.
  try {
    const outPath = path.resolve(process.cwd(), "openapi", "swagger.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(openAPIDocument, null, 2), "utf-8");
    // eslint-disable-next-line no-console
    console.log("Wrote OpenAPI spec to", outPath);
  } catch (writeErr) {
    // eslint-disable-next-line no-console
    console.error("Failed to write OpenAPI spec to disk:", writeErr);
  }
} catch (err) {
  // Log error so it appears in container logs and helps diagnosis
  // Do not throw here to avoid crashing the server; expose diagnostic on /swagger.json
  // eslint-disable-next-line no-console
  console.error("OpenAPI document generation failed:", err);
}

// JSON endpoint for raw OpenAPI spec
openAPIRouter.get("/swagger.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  if (!openAPIDocument) {
    return res.status(500).send({ error: "OpenAPI document not available. Check server logs for generation errors." });
  }
  return res.send(openAPIDocument);
});

// Swagger UI options to hide servers dropdown
const swaggerOptions = {
  swaggerOptions: {
    displayRequestDuration: true,
    docExpansion: "none",
    operationsSorter: "alpha",
    tagsSorter: "alpha",
    filter: true,
    plugins: [
      () => {
        return {
          wrapComponents: {
            servers: () => () => null, // This hides the servers dropdown
          },
        };
      },
    ],
  },
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
  // If document generation failed, still mount the UI but with an empty spec so the page will show an error message
  openAPIRouter.use("/", swaggerUi.serve, swaggerUi.setup(openAPIDocument || {}, swaggerOptions));
}
