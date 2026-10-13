import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser, type AuthenticatedUser } from "./current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

const SendOtpDto = z.object({
  phone: z.string().min(8).max(20),
});

const VerifyOtpDto = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6),
});

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Returns the current authenticated user's session profile.
   */
  @Get("me")
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    };
  }

  /**
   * Request an SMS OTP (strictly rate-limited: 3 calls per minute).
   */
  @Post("otp/send")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(SendOtpDto))
  async sendOtp(@Body() body: z.infer<typeof SendOtpDto>) {
    return this.authService.sendPhoneOtp(body.phone);
  }

  /**
   * Verify the 6-digit OTP code.
   */
  @Post("otp/verify")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(VerifyOtpDto))
  async verifyOtp(@Body() body: z.infer<typeof VerifyOtpDto>) {
    return this.authService.verifyPhoneOtp(body.phone, body.code);
  }
}
