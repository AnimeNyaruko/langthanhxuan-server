import { type ExecutionContext, createParamDecorator } from "@nestjs/common";

export interface AuthenticatedUser {
  id: string; // Supabase user ID or NextAuth sub (Google ID)
  email?: string;
  name?: string;
  image?: string;
  googleSub?: string;
  role: "user" | "admin" | "moderator";
  rawToken?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return data && user ? user[data] : user;
  },
);
