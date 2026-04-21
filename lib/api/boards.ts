import axios from "axios";
import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  status?: number;
  message?: string;
  error?: string;
};

export type BoardSearchType = "TITLE" | "TEXT" | "USER_ID";

export type BoardSummary = {
  id: number;
  /** @deprecated display logic must use authorUserId only */
  authorName: string;
  authorUserId: string | null;
  title: string;
  summaryText: string;
  regDate: string | null;
  updateDate: string | null;
  editable: boolean;
  deletable: boolean;
};

export type BoardPagination = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  previousPage: number | null;
  nextPage: number | null;
  groupStartPage: number;
  groupEndPage: number;
  hasPreviousGroup: boolean;
  hasNextGroup: boolean;
  previousGroupPage: number | null;
  nextGroupPage: number | null;
  firstPage: number | null;
  lastPage: number | null;
};

export type BoardListData = {
  boards: BoardSummary[];
  pagination: BoardPagination;
};

export type BoardComment = {
  id: number;
  parentId: number | null;
  depth: number;
  /** @deprecated display logic must use authorUserId only */
  authorName: string;
  authorUserId: string | null;
  content: string;
  regDate: string | null;
  updateDate: string | null;
  editable: boolean;
  deletable: boolean;
  children: BoardComment[];
};

export type BoardDetail = {
  id: number;
  /** @deprecated display logic must use authorUserId only */
  authorName: string;
  authorUserId: string | null;
  title: string;
  text: string;
  regDate: string | null;
  updateDate: string | null;
  commentCount: number;
  editable: boolean;
  deletable: boolean;
  comments: BoardComment[];
};

export type BoardCommentsSnapshot = {
  boardId: number;
  commentCount: number;
  comments: BoardComment[];
};

export type BoardListParams = {
  page: number;
  size: number;
  searchType?: BoardSearchType | null;
  keyword?: string | null;
};

export type BoardCreateRequest = {
  authorName?: string;
  title: string;
  text: string;
};

export type BoardUpdateRequest = {
  title: string;
  text: string;
};

export type BoardCommentCreateRequest = {
  authorName?: string;
  parentId: number | null;
  content: string;
};

export type BoardCommentUpdateRequest = {
  content: string;
};

export type BoardApiErrorInfo = {
  fallback: string;
  httpStatus: number | null;
  method: string | null;
  responseData: unknown;
  responseStatus: number | null;
  url: string | null;
};

export class BoardApiError extends Error {
  info: BoardApiErrorInfo;

  constructor(message: string, info: BoardApiErrorInfo) {
    super(message);
    this.name = "BoardApiError";
    this.info = info;
  }
}

export function isBoardApiError(error: unknown): error is BoardApiError {
  return error instanceof BoardApiError;
}

function readErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const body = data as ErrorResponseBody;

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }

  return fallback;
}

function readResponseStatus(data: unknown, fallback: number | null) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const status = (data as { status?: unknown }).status;

  return typeof status === "number" ? status : fallback;
}

function createBoardApiError(
  fallback: string,
  options: {
    config?: {
      method?: string;
      url?: string;
    } | null;
    httpStatus?: number | null;
    message?: string | null;
    responseData?: unknown;
    responseStatus?: number | null;
  },
) {
  const message =
    typeof options.message === "string" && options.message.trim()
      ? options.message
      : fallback;

  return new BoardApiError(message, {
    fallback,
    httpStatus:
      typeof options.httpStatus === "number" ? options.httpStatus : null,
    method: options.config?.method?.toUpperCase() ?? null,
    responseData: options.responseData ?? null,
    responseStatus:
      typeof options.responseStatus === "number" ? options.responseStatus : null,
    url: options.config?.url ?? null,
  });
}

async function unwrapResponse<T>(
  request: Promise<{
    config?: {
      method?: string;
      url?: string;
    };
    data: ApiEnvelope<T> | ErrorResponseBody;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const body = response.data as ApiEnvelope<T>;
    const responseStatus =
      readResponseStatus(response.data, response.status) ?? response.status;
    const message = readErrorMessage(response.data, fallback);

    if (
      response.status < 200 ||
      response.status >= 300 ||
      responseStatus >= 400 ||
      body.data === null ||
      body.data === undefined
    ) {
      throw createBoardApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message,
        responseData: response.data,
        responseStatus,
      });
    }

    return body.data;
  } catch (error) {
    if (isBoardApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createBoardApiError(fallback, {
        config: error.config,
        httpStatus: error.response?.status ?? null,
        message: readErrorMessage(error.response?.data, error.message || fallback),
        responseData: error.response?.data ?? null,
        responseStatus: readResponseStatus(error.response?.data, null),
      });
    }

    if (error instanceof Error) {
      throw createBoardApiError(fallback, {
        message: error.message,
      });
    }

    throw createBoardApiError(fallback, {});
  }
}

async function unwrapVoidResponse(
  request: Promise<{
    config?: {
      method?: string;
      url?: string;
    };
    data: ApiEnvelope<null> | ErrorResponseBody;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const responseStatus =
      readResponseStatus(response.data, response.status) ?? response.status;
    const message = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
      throw createBoardApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message,
        responseData: response.data,
        responseStatus,
      });
    }
  } catch (error) {
    if (isBoardApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createBoardApiError(fallback, {
        config: error.config,
        httpStatus: error.response?.status ?? null,
        message: readErrorMessage(error.response?.data, error.message || fallback),
        responseData: error.response?.data ?? null,
        responseStatus: readResponseStatus(error.response?.data, null),
      });
    }

    if (error instanceof Error) {
      throw createBoardApiError(fallback, {
        message: error.message,
      });
    }

    throw createBoardApiError(fallback, {});
  }
}

export async function listBoards(params: BoardListParams) {
  const keyword = params.keyword?.trim();

  return unwrapResponse(
    apiClient.get<ApiEnvelope<BoardListData>>("/boards", {
      params: {
        page: params.page,
        size: params.size,
        searchType: keyword ? params.searchType : undefined,
        keyword: keyword || undefined,
      },
      validateStatus: () => true,
    }),
    "게시글 목록을 불러오지 못했습니다.",
  );
}

export async function getBoard(boardId: number) {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<BoardDetail>>(`/boards/${boardId}`, {
      validateStatus: () => true,
    }),
    "게시글을 불러오지 못했습니다.",
  );
}

export async function createBoard(payload: BoardCreateRequest) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<BoardDetail>>("/boards", payload, {
      validateStatus: () => true,
    }),
    "게시글을 작성하지 못했습니다.",
  );
}

export async function updateBoard(boardId: number, payload: BoardUpdateRequest) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<BoardDetail>>(`/boards/${boardId}`, payload, {
      validateStatus: () => true,
    }),
    "게시글을 수정하지 못했습니다.",
  );
}

export async function deleteBoard(boardId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(`/boards/${boardId}`, {
      validateStatus: () => true,
    }),
    "게시글을 삭제하지 못했습니다.",
  );
}

export async function listBoardComments(boardId: number) {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<BoardCommentsSnapshot>>(`/boards/${boardId}/comments`, {
      validateStatus: () => true,
    }),
    "댓글을 불러오지 못했습니다.",
  );
}

export async function createBoardComment(
  boardId: number,
  payload: BoardCommentCreateRequest,
) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<BoardCommentsSnapshot>>(
      `/boards/${boardId}/comments`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "댓글을 작성하지 못했습니다.",
  );
}

export async function updateBoardComment(
  boardId: number,
  commentId: number,
  payload: BoardCommentUpdateRequest,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<BoardCommentsSnapshot>>(
      `/boards/${boardId}/comments/${commentId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "댓글을 수정하지 못했습니다.",
  );
}

export async function deleteBoardComment(boardId: number, commentId: number) {
  return unwrapResponse(
    apiClient.delete<ApiEnvelope<BoardCommentsSnapshot>>(
      `/boards/${boardId}/comments/${commentId}`,
      {
        validateStatus: () => true,
      },
    ),
    "댓글을 삭제하지 못했습니다.",
  );
}
