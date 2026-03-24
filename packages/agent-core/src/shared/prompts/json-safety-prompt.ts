export const JSON_SAFETY_PROMPT = `
【JSON 输出安全规则 - 必须严格遵守】
1. 只输出 JSON 数据本身，前后不要添加解释、Markdown 代码块或注释。
2. 输出必须是严格合法的 JSON，能够被 JSON.parse() 正确解析。
3. 字符串值必须使用双引号，禁止使用单引号。
4. 不要输出 trailing comma。
5. 所有括号必须正确配对。
6. 特殊字符必须正确转义。
7. 禁止在 JSON 中输出注释。
8. 数值不要用引号包裹，布尔值使用 true/false。
`;

export function appendJsonSafety(prompt: string) {
  return `${prompt.trim()}\n${JSON_SAFETY_PROMPT.trim()}`;
}
