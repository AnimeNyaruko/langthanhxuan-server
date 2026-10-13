import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../../config/supabase.service";

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Admin: get all transactions for a specific user (as sender or receiver).
   */
  async getTransactionsForUser(userId: string) {
    const client = this.supabase.getAdminClient();
    const { data, error } = await client
      .from("transactions")
      .select("transaction_id, sender_id, receiver_id, time_sent, time_received, amount, comment")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("time_sent", { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch transactions for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException("Could not fetch transactions");
    }

    return data || [];
  }

  /**
   * Get a completed transaction's sender and receiver info.
   */
  async getTransactionParties(transactionId: string) {
    const client = this.supabase.getAdminClient();
    const { data, error } = await client
      .from("transactions")
      .select(`
        transaction_id,
        time_sent,
        time_received,
        amount,
        comment,
        sender:sender_id(user_id, full_name, email),
        receiver:receiver_id(user_id, full_name, email)
      `)
      .eq("transaction_id", transactionId)
      .not("time_received", "is", null)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch transaction ${transactionId}: ${error.message}`);
      throw new InternalServerErrorException("Could not fetch transaction details");
    }

    return data;
  }
}
