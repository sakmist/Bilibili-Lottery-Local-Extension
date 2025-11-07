import { fetchJson, incrementThrottleCounter } from './http-client';
import { withWbiSignature } from './wbi';
import { sleep } from '@/utils/utils';

const API = {
  VIDEO_DETAIL: 'https://api.bilibili.com/x/web-interface/view',
  DYNAMIC_DETAIL: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail',
  DYNAMIC_DETAIL_OLD: 'https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail',
  COMMENT_LIST: 'https://api.bilibili.com/x/v2/reply/wbi/main',
  REACTION_LIST: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail/reaction',
  NAV_INFO: 'https://api.bilibili.com/x/web-interface/nav',
  CHECK_RELATION: 'https://api.bilibili.com/x/space/wbi/acc/relation'
};

const COMMENT_TYPE_VIDEO = 1;
const REQUEST_DELAY = 800; // ms
const MAX_RETRY = 3;

const REACTION_TYPE = {
  FORWARD: '转发了',
  LIKE: '赞了'
};

function serializeDuplicateMap(duplicateMap) {
  return Array.from(duplicateMap.entries()).map(([key, value]) => [key, { ...value }]);
}

function deserializeDuplicateMap(serialized) {
  if (!Array.isArray(serialized)) {
    return new Map();
  }
  return new Map(serialized.map(([key, value]) => [key, { ...value }]));
}

function isBvid(id = '') {
  return /^BV[0-9A-Za-z]+$/i.test(id);
}

function formatTimestamp(ctime = 0) {
  if (!ctime) return '';
  const date = new Date((Number(ctime) + 8 * 3600) * 1000);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function normalizeCommentNode(comment, duplicateMap) {
  const member = comment?.member || {};
  const base = {
    id: member.mid ?? 0,
    user_name: member.uname ?? '',
    user_sign: member.sign ?? '',
    avatar: member.avatar ?? '',
    pendant: member.pendant?.image_enhance ?? '',
    level: member.level_info?.current_level ?? 0,
    vip: member.vip?.label?.label_theme ?? '',
    vip_description: member.vip?.label?.text ?? '',
    content: comment?.content?.message ?? '',
    date: formatTimestamp(comment?.ctime ?? 0),
    array_replies: [],
    action: '',
    reply_id: comment?.rpid ?? 0,
    original_comment_id: 0,
    duplicate_comment_count: 0
  };

  const digest = base.content.trim();
  if (digest) {
    const existing = duplicateMap.get(digest);
    if (existing) {
      existing.count += 1;
      base.original_comment_id = existing.id;
      base.duplicate_comment_count = existing.count;
    } else {
      duplicateMap.set(digest, { id: base.reply_id, count: 0 });
    }
  }

  const flattened = [base];
  const replies = Array.isArray(comment?.replies) ? comment.replies : [];
  for (const reply of replies) {
    flattened.push(...normalizeCommentNode(reply, duplicateMap));
  }

  return flattened;
}

function normalizeReactionNode(item) {
  const baseUser = item?.user || item;
  const actionType = item?.action || item?.type;
  let action = REACTION_TYPE.LIKE;
  if (typeof actionType === 'string') {
    if (actionType.includes('转发') || actionType.toLowerCase().includes('forward')) {
      action = REACTION_TYPE.FORWARD;
    } else if (actionType.includes('赞') || actionType.toLowerCase().includes('like')) {
      action = REACTION_TYPE.LIKE;
    }
  } else if (typeof actionType === 'number') {
    action = actionType === 1 ? REACTION_TYPE.FORWARD : REACTION_TYPE.LIKE;
  }

  return {
    id: baseUser?.mid ?? baseUser?.uid ?? 0,
    user_name: baseUser?.name ?? baseUser?.uname ?? '',
    avatar: baseUser?.face ?? baseUser?.avatar ?? '',
    action
  };
}

async function fetchWithRetry(url, paramsBuilder, { signal } = {}) {
  let attempt = 0;
  while (attempt < MAX_RETRY) {
    try {
      const params = await paramsBuilder();
      return await fetchJson(url, { params, signal });
    } catch (error) {
      if (error?.status === 412) {
        throw error;
      }
      attempt += 1;
      if (attempt >= MAX_RETRY) {
        throw error;
      }
      await sleep(REQUEST_DELAY * attempt);
    }
  }
  throw new Error('请求重试失败');
}

export async function fetchLoginUser() {
  const { data } = await fetchJson(API.NAV_INFO);
  return {
    id: data?.mid ?? 0,
    user_name: data?.uname ?? '',
    avatar: data?.face ?? ''
  };
}

export async function fetchDetail(id) {
  if (!id) {
    throw new Error('请输入 BV 号或动态 ID');
  }

  if (isBvid(id)) {
    const { data } = await fetchJson(API.VIDEO_DETAIL, { params: { bvid: id } });
    if (!data) {
      throw new Error('无法获取视频详情');
    }
    return {
      author_id: data.owner?.mid ?? 0,
      author_name: data.owner?.name ?? '',
      author_avatar: data.owner?.face ?? '',
      description: data.title ?? '',
      comment_count: data.stat?.reply ?? 0,
      forward_count: data.stat?.share ?? 0,
      like_count: data.stat?.like ?? 0,
      comment_area_id: data.aid ?? null,
      comment_type: COMMENT_TYPE_VIDEO,
      source_type: 'video'
    };
  }

  if (!/^\d+$/.test(id)) {
    throw new Error('ID 参数无效，必须是 BV 号或纯数字动态 ID');
  }

  const detail = await fetchDynamicDetail(id);
  if (!detail) {
    throw new Error('无法获取动态详情');
  }
  return detail;
}

async function fetchDynamicDetail(id) {
  try {
    const { data } = await fetchJson(API.DYNAMIC_DETAIL, { params: { id } });
    const item = data?.item;
    if (item) {
      return {
        author_id: item.modules?.module_author?.mid ?? 0,
        author_name: item.modules?.module_author?.name ?? '',
        author_avatar: item.modules?.module_author?.face ?? '',
        description: item.modules?.module_dynamic?.desc?.text ?? '',
        comment_count: item.modules?.module_stat?.comment?.count ?? 0,
        forward_count: item.modules?.module_stat?.forward?.count ?? 0,
        like_count: item.modules?.module_stat?.like?.count ?? 0,
        comment_area_id: item.basic?.comment_id_str ?? null,
        comment_type: item.basic?.comment_type ?? null,
        source_type: 'dynamic'
      };
    }
  } catch (error) {
    // ignore and fallback
    console.warn('动态详情接口失败，尝试使用旧版接口', error.message);
  }

  const { data } = await fetchJson(API.DYNAMIC_DETAIL_OLD, { params: { dynamic_id: id } });
  const desc = data?.card?.desc;
  const info = desc?.user_profile?.info;
  let card = {};
  if (data?.card?.card) {
    try {
      card = JSON.parse(data.card.card);
    } catch (error) {
      console.warn('解析旧版动态 card 失败', error?.message ?? error);
    }
  }

  if (!desc) {
    return null;
  }

  const commentType = mapOldDynamicTypeToCommentType(desc?.type ?? null);
  return {
    author_id: info?.uid ?? 0,
    author_name: info?.uname ?? '',
    author_avatar: info?.face ?? '',
    description: card?.item?.description ?? '',
    comment_count: desc?.comment ?? 0,
    forward_count: desc?.repost ?? 0,
    like_count: desc?.like ?? 0,
    comment_area_id: desc?.rid_str ?? null,
    comment_type: commentType,
    source_type: 'dynamic'
  };
}

function mapOldDynamicTypeToCommentType(type) {
  switch (type) {
    case 1:
      return 17;
    case 2:
    case 4:
      return 11;
    case 8:
      return COMMENT_TYPE_VIDEO;
    case 64:
      return 12;
    default:
      return type;
  }
}

export async function fetchCommentUsers({ id, detail, onProgress, signal, resumeState } = {}) {
  const detailInfo = detail || await fetchDetail(id);
  if (!detailInfo.comment_area_id || !detailInfo.comment_type) {
    throw new Error('评论区参数缺失');
  }

  const result = [];
  const duplicateMap = resumeState?.duplicateDigest ? deserializeDuplicateMap(resumeState.duplicateDigest) : new Map();
  let paginationStr = resumeState?.paginationStr;
  let hasNext = resumeState?.hasNext ?? true;
  let processedCount = resumeState?.processedCount ?? 0;

  try {
    while (hasNext) {
      const baseParams = {
        type: detailInfo.comment_type,
        oid: detailInfo.comment_area_id,
        mode: 2,
        ps: 30,
        ...(paginationStr ? { pagination_str: paginationStr } : {})
      };

      const response = await fetchWithRetry(API.COMMENT_LIST, () => withWbiSignature(baseParams), { signal });
      const data = response?.data || {};
      const replies = Array.isArray(data.replies) ? data.replies : [];
      for (const reply of replies) {
        result.push(...normalizeCommentNode(reply, duplicateMap));
      }

      if (replies.length > 0) {
        await incrementThrottleCounter(replies.length);
      }

      onProgress?.(processedCount + result.length, detailInfo.comment_count || 0);

      const cursor = data.cursor;
      if (cursor?.is_end === false) {
        const offset = cursor.pagination_reply?.next_offset;
        if (!offset && offset !== 0) {
          throw new Error('无法读取评论翻页游标');
        }
        paginationStr = JSON.stringify({ offset });
        await sleep(REQUEST_DELAY);
      } else {
        hasNext = false;
      }
    }
  } catch (error) {
    if (error?.status === 412) {
      error.isResumable = true;
      error.partialResult = result.slice();
      error.resumeState = {
        paginationStr,
        hasNext,
        processedCount: processedCount + result.length,
        duplicateDigest: serializeDuplicateMap(duplicateMap)
      };
    }
    throw error;
  }

  return result;
}

export async function fetchReactionUsers({ id, detail, onProgress, signal, resumeState } = {}) {
  const detailInfo = detail || await fetchDetail(id);
  const total = (detailInfo.forward_count || 0) + (detailInfo.like_count || 0);
  const result = [];
  let offset = resumeState?.offset ?? '';
  let hasMore = resumeState?.hasMore ?? true;
  let processedCount = resumeState?.processedCount ?? 0;

  try {
    while (hasMore) {
      const baseParams = {
        id,
        ...(offset ? { offset } : {})
      };

      const response = await fetchWithRetry(API.REACTION_LIST, () => withWbiSignature(baseParams), { signal });
      const data = response?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        result.push(normalizeReactionNode(item));
      }

      if (items.length > 0) {
        await incrementThrottleCounter(items.length);
      }

      onProgress?.(processedCount + result.length, total);

      hasMore = data.has_more === true && (processedCount + result.length) < total;
      offset = data.offset || '';
      if (hasMore) {
        await sleep(REQUEST_DELAY);
      }
    }
  } catch (error) {
    if (error?.status === 412) {
      error.isResumable = true;
      error.partialResult = result.slice();
      error.resumeState = {
        offset,
        hasMore,
        processedCount: processedCount + result.length
      };
    }
    throw error;
  }

  return result;
}

export async function checkIsMyFans(userId) {
  if (!userId) {
    throw new Error('缺少用户 ID');
  }
  const { data } = await fetchWithRetry(API.CHECK_RELATION, () => withWbiSignature({ mid: userId }));
  const relation = data?.be_relation;
  if (!relation) {
    throw new Error('无法获取粉丝关系');
  }

  const attribute = relation.attribute ?? 0;
  let relation_type_description = '';
  switch (attribute) {
    case 2:
      relation_type_description = '是粉丝';
      break;
    case 6:
      relation_type_description = '已互粉';
      break;
    case 128:
      relation_type_description = '已被拉黑';
      break;
    default:
      relation_type_description = '不是粉丝';
      break;
  }

  return {
    relation_type: attribute,
    relation_type_description,
    relation_date: relation.mtime ? formatTimestamp(relation.mtime) : ''
  };
}
