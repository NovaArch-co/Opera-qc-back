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

    // Get the base server URL without any path components
    const baseUrl = env.SWAGGER_URL.replace(/\/[^/]*$/, '').replace(/\/+$/, '');

    // Define servers for OpenAPI doc
    const servers = [
        {
            url: `${baseUrl}/api/docs/proxy`,
            description: "API Server (via Swagger proxy)"
        }
    ];

    return generator.generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "Opera QC API Documentation",
            description: "API documentation for the Opera QC backend service."
        },
        servers: servers,
        // Default security is JWT for most endpoints
        security: [{ bearerAuth: [] }],
        externalDocs: {
            description: "View the raw OpenAPI as JSON",
            url: `${baseUrl}/api/docs/swagger.json`,
        }
    });
}
