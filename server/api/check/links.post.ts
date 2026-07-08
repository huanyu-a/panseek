/**
 * 链接有效性检测 API 端点
 * 直接翻译自 pansou/api/check_handler.go
 */

import { defineEventHandler, readBody, sendError, createError } from "h3";
import { getCheckService } from "../../core/services/checkService";
import type { CheckRequest, CheckResponse } from "../../core/types/check";
import type { GenericResponse } from "../../core/types/models";

export default defineEventHandler(async (event) => {
  const body = await readBody<CheckRequest>(event);

  if (!body || !body.items || body.items.length === 0) {
    return sendError(
      event,
      createError({ statusCode: 400, statusMessage: "items不能为空" })
    );
  }

  const proxyURL = (body.proxy_url || body.proxy || "").trim();
  const service = getCheckService();

  const response: CheckResponse = await service.checkAsync(body.items, proxyURL);

  const resp: GenericResponse<CheckResponse> = {
    code: 0,
    message: "success",
    data: response,
  };

  return resp;
});
