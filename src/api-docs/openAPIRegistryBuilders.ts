import { OpenAPIRegistry, type RouteConfig } from "@asteasolutions/zod-to-openapi";

export class ExtendedOpenAPIRegistry extends OpenAPIRegistry {
  bearerAuth: {
    name: string;
    ref: {
      $ref: string;
    };
  };

  constructor() {
    super();
    const bearerAuth = this.registerComponent("securitySchemes", "bearerAuth", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
    this.bearerAuth = bearerAuth;
  }

  public registerSecurePath(route: RouteConfig) {
    route.security = [{ [this.bearerAuth.name]: [] }];
    this.registerPath(route);
  }
}
