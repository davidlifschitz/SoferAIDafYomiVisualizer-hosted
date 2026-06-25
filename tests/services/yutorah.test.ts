import { describe, expect, it } from "vitest";

import { resolveYutorahLecture } from "@/lib/services/yutorah";

describe("resolveYutorahLecture", () => {
  it("extracts a direct audio URL from the lecture page HTML", async () => {
    const html = `
      <html>
        <head><title>Rabbi Aryeh Lebowitz Daf Yomi Shabbos Daf 02</title></head>
        <body>
          <audio src="https://media.yutorah.org/lectures/948110.mp3"></audio>
        </body>
      </html>
    `;

    const resolved = await resolveYutorahLecture(
      "https://www.yutorah.org/lectures/lecture.cfm/948110",
      {
        fetchImpl: async () =>
          new Response(html, {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      },
    );

    expect(resolved.sourceKey).toBe("yutorah:948110");
    expect(resolved.audioUrl).toBe("https://media.yutorah.org/lectures/948110.mp3");
    expect(resolved.title).toContain("Shabbos Daf 02");
  });
});