/**
 * 迅雷字幕接口的独立封装。
 *
 * 运行环境：Node.js 18+（需要内置 fetch）。
 * IINA 插件不能直接复用 Node.js 的 fetch，应使用文档中的 iina.http 适配方式。
 */

export const THUNDER_SEARCH_URL =
  'https://api-shoulei-ssl.xunlei.com/oracle/subtitle'

export const THUNDER_SUBTITLE_HOST = 'subtitle.v.geilijiasu.com'

export class ThunderSubtitleError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ThunderSubtitleError'
    Object.assign(this, details)
  }
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function')
  }
}

function toSearchUrl(name, { duration = 0, gcid = '' } = {}) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('name must be a non-empty string')
  }

  const url = new URL(THUNDER_SEARCH_URL)
  url.searchParams.set('duration', String(duration))
  url.searchParams.set('gcid', String(gcid ?? ''))
  url.searchParams.set('name', name)
  return url
}

function parseSearchBody(body, status, statusText) {
  if (!body || typeof body !== 'object') {
    throw new ThunderSubtitleError('Thunder API returned a non-object body', {
      status,
      statusText,
      body,
    })
  }

  if (body.code !== 0) {
    throw new ThunderSubtitleError('Thunder API returned an error', {
      status,
      statusText,
      code: body.code,
      result: body.result,
      body,
    })
  }

  return {
    code: body.code,
    result: body.result,
    items: Array.isArray(body.data) ? body.data : [],
    raw: body,
  }
}

/**
 * 搜索字幕。
 *
 * @param {string} name 视频名称或搜索关键词
 * @param {object} [options]
 * @param {number|string} [options.duration=0] 视频时长参数，接口单位未公开；旧插件传 0
 * @param {string} [options.gcid=''] 文件指纹；没有指纹时传空字符串
 * @param {AbortSignal} [options.signal] fetch 使用的取消信号
 * @param {Function} [options.fetchImpl=fetch] 可注入的 fetch 实现
 * @returns {Promise<{code:number,result:string,items:Array,raw:object}>}
 */
export async function searchSubtitles(name, options = {}) {
  const {
    duration = 0,
    gcid = '',
    signal,
    fetchImpl = globalThis.fetch,
  } = options
  assertFetch(fetchImpl)

  const url = toSearchUrl(name, { duration, gcid })
  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { 'User-Agent': 'xunlei' },
      signal,
    })
  } catch (error) {
    throw new ThunderSubtitleError('Unable to reach Thunder subtitle API', {
      cause: error,
      url: url.toString(),
    })
  }

  let body
  try {
    body = await response.json()
  } catch (error) {
    throw new ThunderSubtitleError('Thunder API returned invalid JSON', {
      cause: error,
      status: response.status,
      statusText: response.statusText,
      url: url.toString(),
    })
  }

  if (!response.ok) {
    throw new ThunderSubtitleError('Thunder API HTTP request failed', {
      status: response.status,
      statusText: response.statusText,
      body,
      url: url.toString(),
    })
  }

  return parseSearchBody(body, response.status, response.statusText)
}

function validateSubtitleUrl(urlString) {
  let url
  try {
    url = new URL(urlString)
  } catch {
    throw new ThunderSubtitleError('Subtitle item contains an invalid URL', {
      url: urlString,
    })
  }

  if (url.protocol !== 'https:' || url.hostname !== THUNDER_SUBTITLE_HOST) {
    throw new ThunderSubtitleError('Subtitle URL is outside the allowed host', {
      url: url.toString(),
    })
  }
  return url
}

/**
 * 下载字幕内容，不负责写入文件。
 *
 * @param {{url:string}} item 搜索结果中的字幕项
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.fetchImpl=fetch]
 * @returns {Promise<{bytes:Uint8Array,contentType:string,url:string}>}
 */
export async function downloadSubtitle(item, options = {}) {
  const {
    signal,
    fetchImpl = globalThis.fetch,
  } = options
  assertFetch(fetchImpl)

  if (!item || typeof item.url !== 'string') {
    throw new TypeError('item.url must be a string')
  }
  const url = validateSubtitleUrl(item.url)

  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { 'User-Agent': 'xunlei' },
      signal,
    })
  } catch (error) {
    throw new ThunderSubtitleError('Unable to download subtitle', {
      cause: error,
      url: url.toString(),
    })
  }

  if (!response.ok) {
    throw new ThunderSubtitleError('Subtitle download failed', {
      status: response.status,
      statusText: response.statusText,
      url: url.toString(),
    })
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || '',
    url: url.toString(),
  }
}

/**
 * 对搜索结果按 cid 或 URL 去重，同时保留原始顺序。
 */
export function dedupeSubtitles(items) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  return items.filter((item) => {
    const key = item?.cid || item?.url
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * 去除视频扩展名，供插件构造初始搜索词。
 * 这里只做安全的文件名处理，不对发布组、分辨率等内容做猜测性清理。
 */
export function stripVideoExtension(fileName) {
  if (typeof fileName !== 'string') return ''
  return fileName.replace(/\.[^./\\]+$/, '')
}
