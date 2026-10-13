import {
	type ArgumentMetadata,
	BadRequestException,
	Logger,
	type PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Reusable NestJS Pipe for Zod schemas.
 * Avoids installing class-validator + class-transformer (saves ~15MB in node_modules).
 */
export class ZodValidationPipe implements PipeTransform {
	constructor(private schema: ZodType) {}

	transform(value: unknown, _metadata: ArgumentMetadata) {
		const result = this.schema.safeParse(value);
		if (!result.success) {
			const formatted = result.error.issues.map((issue) => ({
				field: issue.path.length ? issue.path.join('.') : 'body',
				message: issue.message,
			}));
			throw new BadRequestException({
				statusCode: 400,
				error: 'Validation Failed',
				message: formatted,
			});
		}
		return result.data;
	}
}
