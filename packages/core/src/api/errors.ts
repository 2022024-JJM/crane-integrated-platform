export class RestClientError extends Error {
  readonly status: number;
  readonly responseBody?: unknown;

  constructor(
    message: string,
    status: number,
    responseBody?: unknown,
  ) {
    super(message);
    this.name = 'RestClientError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class RestClientTimeoutError extends Error {
  constructor(message = 'Request timed out.') {
    super(message);
    this.name = 'RestClientTimeoutError';
  }
}
