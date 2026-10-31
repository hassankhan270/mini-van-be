import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      console.error(exception);
    }

    const body = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const normalized = typeof body === 'string' ? { message: body } : body;

    response.status(statusCode).json({
      statusCode,
      ...normalized,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
