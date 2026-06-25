import { canonicalLectureKey } from "@/lib/domain/lecture-key";

import type { ResolvedLecture } from "@/lib/analysis/workflow-types";

const AUDIO_URL_PATTERN =
  /https?:\/\/[^"'\\s]+\.(?:mp3|m4a)(?:\?[^"'\\s]*)?/i;

export type YutorahResolverOptions = {
  fetchImpl?: typeof fetch;
};

function lectureTitleFromKey(sourceKey: string, htmlTitle?: string): string {
  if (htmlTitle?.trim()) {
    return htmlTitle.trim();
  }

  const [, lectureId] = sourceKey.split(":");
  return lectureId ? `YUTorah lecture ${lectureId}` : "YUTorah lecture";
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function extractAudioUrl(html: string): string | undefined {
  const srcAttr = html.match(/src=["']([^"']+\.(?:mp3|m4a)[^"']*)["']/i)?.[1];
  if (srcAttr) {
    return srcAttr;
  }

  const direct = html.match(AUDIO_URL_PATTERN)?.[0];
  if (direct) {
    return direct;
  }

  return html.match(/audio_url["'\s:]+([^"'\\s]+\.(?:mp3|m4a))/i)?.[1];
}

export async function resolveYutorahLecture(
  lectureUrl: string,
  options: YutorahResolverOptions = {},
): Promise<ResolvedLecture> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sourceKey = canonicalLectureKey(lectureUrl);

  const response = await fetchImpl(lectureUrl, {
    headers: { accept: "text/html" },
  });

  if (!response.ok) {
    throw new Error(`YUTorah lecture page unavailable (${response.status})`);
  }

  const html = await response.text();
  const audioUrl = extractAudioUrl(html);
  if (!audioUrl) {
    throw new Error("YUTorah lecture audio URL was not found");
  }

  return {
    lectureUrl,
    sourceKey,
    title: lectureTitleFromKey(sourceKey, extractTitle(html)),
    audioUrl,
  };
}