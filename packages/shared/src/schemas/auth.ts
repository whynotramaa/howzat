import { z } from 'zod';
import {
  claimableUsernameSchema,
  emailSchema,
  loginIdentifierSchema,
  nameSchema,
  passwordSchema,
  usernameSchema,
} from './common';

/**
 * Signup is one step with one confirmation: pick a username and password, then
 * prove the email is yours with a code. After that the code never appears
 * again — sign-in is username and password, which is what people expect and
 * what works when they are standing at a ground with no signal on the phone
 * their email is on.
 */
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

/** Confirms the address and signs the new account straight in. */
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
  /** Username or email — the server works out which. */
  identifier: loginIdentifierSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  username: claimableUsernameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Forgetting a password is the one case where the emailed code comes back, and
 * for the right reason this time: it is the only proof of identity someone
 * locked out can still offer.
 */
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

/** Signup-form availability check, so a taken handle is caught before submit. */
export const usernameAvailabilitySchema = z.object({
  username: usernameSchema,
});
export type UsernameAvailabilityInput = z.infer<typeof usernameAvailabilitySchema>;
