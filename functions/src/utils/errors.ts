/** Error lanzado cuando el usuario no tiene permisos para realizar la operación. */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
