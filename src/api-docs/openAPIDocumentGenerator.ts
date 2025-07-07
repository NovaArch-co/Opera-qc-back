import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { authRegistry } from "@/api/auth/authRouter";
import { userRegistry } from "@/api/user/userRouter";
import { sessionEventRegistry } from "@/api/session/sessionRouter";
import { audioRegistry } from "@/api/audio/audioRouter";
import { env } from "@/common/utils/envConfig";

export function generateOpenAPIDocument() {
    const registry = new OpenAPIRegistry([
        userRegistry,
        authRegistry,
        sessionEventRegistry,
        audioRegistry
    ]);

    // Register security schemes
    registry.registerComponent("securitySchemes", "basicAuth", {
        type: "http",
        scheme: "basic",
        description: "Basic authentication for audio API"
    });

    registry.registerComponent("securitySchemes", "bearerAuth", {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT authentication for protected endpoints"
    });

    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "Swagger API",
        },
        servers: [{
            url: "https://qc.novaarchai.com",
            description: "dev"
        }],
        // Default security is JWT for most endpoints
        security: [{ bearerAuth: [] }],
        externalDocs: {
            description: "View the raw OpenAPI AS JSON",
            url: "https://qc.novaarchai.com/api/docs/api/swagger.json",
        },
    });
}
