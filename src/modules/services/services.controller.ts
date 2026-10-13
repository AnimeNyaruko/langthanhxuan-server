import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { AuthGuard } from "../auth/auth.guard";

@Controller("services")
@UseGuards(AuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /** List all available services. */
  @Get()
  async listAll() {
    return this.servicesService.listAll();
  }

  /** List all users enrolled in a specific service. */
  @Get(":serviceId/users")
  async getUsersByService(@Param("serviceId") serviceId: string) {
    return this.servicesService.getUsersByService(serviceId);
  }
}
