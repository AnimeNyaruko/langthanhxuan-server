import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("transactions")
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Admin-only: get all transactions for a specific user.
   */
  @Get("user/:userId")
  @Roles("admin")
  async getTransactionsForUser(@Param("userId") userId: string) {
    return this.transactionsService.getTransactionsForUser(userId);
  }

  /**
   * Get sender & receiver info for a completed transaction.
   */
  @Get(":transactionId/parties")
  async getTransactionParties(@Param("transactionId") transactionId: string) {
    return this.transactionsService.getTransactionParties(transactionId);
  }
}
