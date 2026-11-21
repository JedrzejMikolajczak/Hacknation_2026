import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { calculatorRouter } from './routes/calculator';
import { casesRouter } from './routes/cases';
import { assistantRouter } from './routes/assistant';
import { healthRouter } from './routes/health';
import { mockRouter } from './routes/mock';
import { paramsRouter } from './routes/params';

export const API_PREFIX = '/api/v1';
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

export function createApp(): Express {
  const app = express();

  const allowedOrigins = [DEFAULT_CLIENT_ORIGIN, process.env.CLIENT_ORIGIN].filter(
    (origin): origin is string => Boolean(origin),
  );
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  app.use(API_PREFIX, healthRouter);
  app.use(API_PREFIX, paramsRouter);
  app.use(API_PREFIX, calculatorRouter);
  app.use(API_PREFIX, casesRouter);
  app.use(API_PREFIX, assistantRouter);
  app.use(API_PREFIX, mockRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
