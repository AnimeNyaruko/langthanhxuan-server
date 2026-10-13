import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { SupabaseModule } from "./config/supabase.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";
import { LeaderboardModule } from "./modules/leaderboard/leaderboard.module";
import { ServicesModule } from "./modules/services/services.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { CsrfGuard } from "./common/security/csrf.guard";

@Module({
  imports: [
    // Rate Limiter: 100 req per minute globally by default
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    SupabaseModule,
    AuthModule,
    UsersModule,
    HealthModule,
    LeaderboardModule,
    ServicesModule,
    TransactionsModule,
  ],
  providers: [
    // Global Throttler (rate-limiting) guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global CSRF defense guard
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
