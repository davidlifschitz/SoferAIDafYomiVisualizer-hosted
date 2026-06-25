import {
  buildMarkerLocatePrompt,
  parseMarkerLocateResponse,
  type MarkerLocateRequest,
  type MarkerLocateResult,
} from "@/lib/domain/marker-locator";

const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

export interface VisionMarkerLocatorOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export async function locateMarkerWithVision(
  request: MarkerLocateRequest,
  imageBase64: string,
  options: VisionMarkerLocatorOptions,
): Promise<MarkerLocateResult> {
  const model = options.model ?? DEFAULT_OPENROUTER_MODEL;
  const baseUrl = options.baseUrl ?? "https://openrouter.ai/api/v1";
  const prompt = buildMarkerLocatePrompt(request);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vision marker locate failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  const raw =
    typeof content === "string"
      ? content
      : content?.map((part) => part.text ?? "").join("\n").trim();

  if (!raw) {
    throw new Error("Vision marker locate returned empty content");
  }

  const coordinates = parseMarkerLocateResponse(
    raw,
    request.imageWidth,
    request.imageHeight,
  );

  return {
    ...coordinates,
    source: "vision",
    model,
    segmentRef: request.segmentRef,
  };
}