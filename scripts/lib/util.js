/** 延迟指定毫秒 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 指数退避延迟：2s, 4s, 8s ... */
export const backoff = (attempt) => delay(2 ** attempt * 1000);
