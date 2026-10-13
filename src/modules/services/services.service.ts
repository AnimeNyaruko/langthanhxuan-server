import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../../config/supabase.service";

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List all available services.
   */
  async listAll() {
    const client = this.supabase.getAdminClient();
    const { data, error } = await client
      .from("services")
      .select("service_id, requester_id, time_created, thanks_amount, review")
      .order("time_created", { ascending: false });

    if (error) {
      this.logger.error(`Failed to list services: ${error.message}`);
      throw new InternalServerErrorException("Could not list services");
    }

    return data || [];
  }

  /**
   * List all users enrolled in a specific service via the user_service junction table.
   */
  async getUsersByService(serviceId: string) {
    const client = this.supabase.getAdminClient();

    // Verify service exists
    const { data: svc, error: svcErr } = await client
      .from("services")
      .select("service_id")
      .eq("service_id", serviceId)
      .single();

    if (svcErr || !svc) {
      throw new NotFoundException("Service not found");
    }

    const { data, error } = await client
      .from("user_service")
      .select("user_id, user:user_id(user_id, full_name, email, location, points)")
      .eq("service_id", serviceId);

    if (error) {
      this.logger.error(`Failed to fetch users for service ${serviceId}: ${error.message}`);
      throw new InternalServerErrorException("Could not fetch users for service");
    }

    return data || [];
  }
}
