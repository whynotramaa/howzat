import { z } from 'zod';
import {
  claimableUsernameSchema,
  emailSchema,
  loginIdentifierSchema,
  nameSchema,
  passwordSchema,
  usernameSchema,
} from './common';

export const registerSchema = z.object({
  email: emailSchema,
  username: claimableUsernameSchema,
  name: nameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  username: claimableUsernameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const usernameAvailabilitySchema = z.object({
  username: usernameSchema,
});
export type UsernameAvailabilityInput = z.infer<typeof usernameAvailabilitySchema>;
