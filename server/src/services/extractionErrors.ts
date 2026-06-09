export class ExtractionBlockedError extends Error {
  constructor(message = "该页面需要登录或验证，暂时无法自动提取。") {
    super(message);
    this.name = "ExtractionBlockedError";
  }
}

export class InvalidUrlError extends Error {
  constructor(message = "请输入有效的 http 或 https 商品链接。") {
    super(message);
    this.name = "InvalidUrlError";
  }
}
