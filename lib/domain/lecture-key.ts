const SUPPORTED_HOSTS = new Set(["yutorah.org", "www.yutorah.org"]);
const LECTURE_PATH = "/lectures/lecture.cfm";

export type LectureKey = `yutorah:${string}`;

function unsupported(url: string): never {
  throw new Error(`Unsupported YUTorah lecture URL: ${url}`);
}

export function canonicalLectureKey(input: string): LectureKey {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return unsupported(input);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !SUPPORTED_HOSTS.has(hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
    return unsupported(input);
  }

  const pathMatch = url.pathname.match(/^\/lectures\/lecture\.cfm\/(\d+)\/?$/);
  const queryIds = url.searchParams.getAll("lecture");
  if (queryIds.length > 1) return unsupported(input);
  const queryId = url.pathname === LECTURE_PATH ? queryIds[0] ?? null : null;
  const id = pathMatch?.[1] ?? queryId;

  if (!id || !/^\d+$/.test(id)) return unsupported(input);
  const canonicalId = BigInt(id);
  if (canonicalId === BigInt(0)) return unsupported(input);
  return `yutorah:${canonicalId}`;
}

export const lectureKeyFromUrl = canonicalLectureKey;
