import { z } from 'zod';

/**
 * Zod schema matching the 3-step signup wizard on the frontend.
 */
export const SignupWizardDto = z.object({
	// Step 1
	fullname: z.string().min(1, 'Vui lòng nhập họ tên').max(100),
	dobDay: z.string().min(1).max(2),
	dobMonth: z.string().min(1).max(2),
	dobYear: z.string().length(4),
	location: z.string().min(1).max(200),

	// Step 2
	skills: z.array(z.string()).min(1).max(5),
	customSkill: z.array(z.string()).max(200).optional(),
	hours: z.coerce.number().min(0).lte(87600).optional(),
	method: z.array(z.enum(['online', 'offline'])).optional(),

	// Step 3
	imageUrl: z.url().optional().nullable(),
	meetingStatus: z.enum(['met', 'notMet', '']),
	referenceInfo: z.string().max(1000).optional(),
});

export type SignupWizardPayload = z.infer<typeof SignupWizardDto>;

export const UpdateProfileDto = SignupWizardDto.partial();
export type UpdateProfilePayload = z.infer<typeof UpdateProfileDto>;
