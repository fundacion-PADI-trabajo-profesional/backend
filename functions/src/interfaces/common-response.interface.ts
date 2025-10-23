
// functions/src/interfaces/common-response.interface.ts
// Contrato y helper para respuestas uniformes.
// ResponseModel: { success, message, data?, error? }
// commonResponse(success, message, data?, error?) crea el objeto estándar.

export interface ResponseModel {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code?: string;
    description?: string;
  };
}

export const commonResponse = (
  success: boolean,
  message: string,
  data: any = null,
  error: { code?: string; description?: string } = {}
): ResponseModel => {
  return {
    success,
    message,
    data,
    error,
  };
};


