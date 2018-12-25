export class RecordNotFoundError extends Error {
  constructor() {
    super();
    Object.setPrototypeOf(this, RecordNotFoundError.prototype);
  }
}
