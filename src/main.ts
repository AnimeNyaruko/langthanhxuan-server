import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
	const logger = new Logger('Bootstrap');
	const app = await NestFactory.create(AppModule, {
		bufferLogs: true,
	});

	// 1. Security Headers via Helmet (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc.)
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					scriptSrc: ["'self'"],
					imgSrc: ["'self'", 'data:', 'https:'],
				},
			},
			crossOriginEmbedderPolicy: false, // allows embedding external media if needed
			referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
			hsts: {
				maxAge: 31536000,
				includeSubDomains: true,
				preload: true,
			},
		}),
	);

	// 2. Cookie Parser (for secure JWT / CSRF double-submit cookies)
	app.use(cookieParser());

	// 3. Strict CORS configuration
	const allowedOrigins = (
		process.env.FRONTEND_URL || 'http://localhost:3000,http://127.0.0.1:3000'
	)
		.split(',')
		.map((o) => o.trim());

	app.enableCors({
		origin: (origin, callback) => {
			// Allow non-browser requests (Postman, curl, server-to-server) or listed origins
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error(`CORS blocked origin: ${origin}`));
			}
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: [
			'Content-Type',
			'Authorization',
			'X-CSRF-Token',
			'X-Requested-With',
			'X-LTX-Client',
		],
		exposedHeaders: ['Retry-After'],
		maxAge: 86400,
	});

	// 4. API prefix
	app.setGlobalPrefix('api');

	// 5. Graceful shutdown
	app.enableShutdownHooks();

	const port = process.env.PORT || 4000;
	await app.listen(port);
	logger.log(`🛡️  NestJS Backend listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
	console.error('Fatal error during bootstrap:', err);
	process.exit(1);
});
