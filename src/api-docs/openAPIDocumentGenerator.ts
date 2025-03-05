import {OpenApiGeneratorV3, OpenAPIRegistry} from "@asteasolutions/zod-to-openapi";

import {authRegistry} from "@/api/auth/authRouter";
import {userRegistry} from "@/api/user/userRouter";
import {sessionEventRegistry} from "@/api/session/sessionRouter";
import {env} from "@/common/utils/envConfig";

export function generateOpenAPIDocument() {
    const registry = new OpenAPIRegistry([
        userRegistry,
        authRegistry,
        sessionEventRegistry
    ]);
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: "3.0.0",
        info: {
            version: "1.0.0",
            title: "Swagger API",
        },
        servers:[{
            url:env.SWAGGER_URL,
        }],
        // security: [{ [bearerAuth.name]: [] }],
        externalDocs: {
            description: "View the raw OpenAPI Specification in JSON format",
            url: "/swagger.json",
        },
    });
}
