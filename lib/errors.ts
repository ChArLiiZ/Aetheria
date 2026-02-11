/**
 * Structured Error Types
 *
 * 結構化的 AI 服務錯誤，用於提供有意義的使用者訊息
 */

export type AIErrorType =
  | 'rate_limit'
  | 'auth'
  | 'quota'
  | 'server'
  | 'timeout'
  | 'parse'
  | 'unknown';

export class AIServiceError extends Error {
  public statusCode: number;
  public errorType: AIErrorType;
  public retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    errorType: AIErrorType,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.retryAfter = retryAfter;
  }

  /**
   * 將錯誤序列化為 JSON（用於 API route 回應）
   */
  toJSON() {
    return {
      error: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * 使用者友好的錯誤訊息對應
 */
export function getErrorUserMessage(errorType: AIErrorType): string {
  switch (errorType) {
    case 'rate_limit':
      return '請求過於頻繁，請稍候再試';
    case 'auth':
      return 'API 金鑰無效或已過期，請到設定頁面檢查';
    case 'quota':
      return 'API 額度不足，請檢查您的供應商帳戶';
    case 'server':
      return 'AI 服務暫時不可用，請稍後再試';
    case 'timeout':
      return '請求逾時，請稍後再試';
    case 'parse':
      return 'AI 回應格式異常，請重試';
    default:
      return '發生未知錯誤，請稍後再試';
  }
}
