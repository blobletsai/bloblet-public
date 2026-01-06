export class CareError extends Error {
  status: number
  details?: Record<string, any>

  constructor(status: number, message: string, details?: Record<string, any>) {
    super(message)
    this.status = status
    this.details = details
  }
}
