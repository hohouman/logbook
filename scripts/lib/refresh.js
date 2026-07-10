/**
 * 每种类型判定“数据是否完整”的必需字段。
 * `foo[]` 表示必须是非空数组；`foo` 表示必须为真值（字符串需非空）。
 */
const REQUIRED_FIELDS = {
  // 注意：不要在此要求 localPosterPath。Steam 的 library_600x900.jpg 对部分
  // app 不存在，下载会返回 null，导致永远不满足刷新条件、每次都重复抓取。
  // 以远程 posterUrl + 本地封面 localCoverPath 作为完整性判据即可。
  steam: ['posterUrl', 'localCoverPath'],
  movie: ['director[]', 'localCoverPath', 'description'],
  book: ['author[]', 'publisher[]', 'localCoverPath', 'description'],
  album: ['artist[]', 'localCoverPath', 'description'],
};

function hasField(item, spec) {
  if (spec.endsWith('[]')) {
    const value = item[spec.slice(0, -2)];
    return Array.isArray(value) && value.length > 0;
  }
  const value = item[spec];
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

/**
 * 是否需要重新抓取：无数据、或任一必需字段缺失。
 */
export function shouldRefreshItem(parsed, item) {
  if (!item) return true;
  const kind = parsed.platform === 'steam' ? 'steam' : parsed.type;
  const required = REQUIRED_FIELDS[kind];
  if (!required) return false;
  return required.some((spec) => !hasField(item, spec));
}
