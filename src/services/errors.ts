export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient Story Credits: ${required} required, ${available} available.`);
  }
}
