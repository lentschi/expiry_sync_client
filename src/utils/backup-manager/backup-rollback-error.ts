export class BackupReadError extends Error {
  constructor(errorData?: any) {
    super(errorData);
    Object.setPrototypeOf(this, BackupReadError.prototype);
  }
}
