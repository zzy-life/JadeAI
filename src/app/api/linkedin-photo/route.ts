import { NextRequest, NextResponse } from 'next/server';
import { normalizeAIBaseURL } from '@/lib/ai/base-url';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OPENAI_IMAGE_SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '3:4': '1024x1536',
  '2:3': '1024x1536',
  '4:3': '1536x1024',
};

function isInvalidApiKey(status: number, body: string) {
  return status === 401
    || status === 403
    || (status === 400 && /api key.*(?:not valid|invalid)|invalid.*api key/i.test(body));
}

function extractImageFromText(text: string): string | null {
  const dataUrl = text.match(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+/i)?.[0];
  if (dataUrl) return dataUrl.replace(/\s/g, '');

  const markdownUrl = text.match(/!\[[^\]]*\]\((https:\/\/[^\s)]+)\)/i)?.[1];
  if (markdownUrl) return markdownUrl;

  return text.match(/https:\/\/[^\s<>"')]+\.(?:png|jpe?g|webp)(?:\?[^\s<>"')]*)?/i)?.[0] || null;
}

function isAllowedUpstreamBaseURL(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.localhost')) return false;
    if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;
    const private172 = hostname.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    if (/^169\.254\./.test(hostname) || /^0\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { image, prompt, requirements, aspectRatio } = await request.json();
    const provider = request.headers.get('x-provider');
    const apiKey = request.headers.get('x-api-key');
    const baseURL = request.headers.get('x-base-url');
    const imageModel = request.headers.get('x-image-model');

    if (provider !== 'gemini' && provider !== 'openai') {
      return NextResponse.json(
        { error: 'unsupported_provider' },
        { status: 400 }
      );
    }

    if (!apiKey || !imageModel) {
      return NextResponse.json(
        { error: 'ai_config_required' },
        { status: 400 }
      );
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
    }

    const dataUrlMatch = image.match(/^data:(image\/[\w+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!dataUrlMatch || !ALLOWED_IMAGE_TYPES.has(dataUrlMatch[1])) {
      return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
    }

    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2].replace(/\s/g, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
    }

    // Build final prompt with aspect ratio and requirements
    let finalPrompt = prompt;
    if (aspectRatio && aspectRatio !== '1:1') {
      finalPrompt += `\n\nOutput image aspect ratio: ${aspectRatio} (width:height).`;
    }
    if (requirements) {
      finalPrompt += `\n\nAdditional requirements: ${requirements}`;
    }

    if (provider === 'openai') {
      const effectiveBaseURL = normalizeAIBaseURL(baseURL || 'https://api.openai.com/v1');
      if (!isAllowedUpstreamBaseURL(effectiveBaseURL)) {
        return NextResponse.json({ error: 'invalid_base_url' }, { status: 400 });
      }
      const imageBytes = Uint8Array.from(imageBuffer);
      const formData = new FormData();
      formData.append('model', imageModel);
      formData.append('prompt', finalPrompt);
      formData.append('image', new Blob([imageBytes], { type: mimeType }), `selfie.${mimeType.split('/')[1] || 'jpg'}`);
      formData.append('size', OPENAI_IMAGE_SIZES[aspectRatio] || OPENAI_IMAGE_SIZES['1:1']);
      if (/^(dall-e-|dall·e)/i.test(imageModel)) {
        formData.append('response_format', 'b64_json');
      } else {
        formData.append('output_format', 'png');
      }

      const res = await fetch(`${effectiveBaseURL}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        redirect: 'error',
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('OpenAI-compatible image API error:', res.status, errBody);
        return NextResponse.json(
          { error: isInvalidApiKey(res.status, errBody) ? 'invalid_key' : 'generate_failed', detail: errBody },
          { status: res.status }
        );
      }

      const data = await res.json();
      const item = data?.data?.[0];
      if (item?.b64_json) {
        return NextResponse.json({ image: `data:image/png;base64,${item.b64_json}` });
      }
      if (item?.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) {
          return NextResponse.json(
            { error: 'generate_failed', detail: 'Failed to download generated image' },
            { status: 502 }
          );
        }
        const generatedImage = Buffer.from(await imageResponse.arrayBuffer());
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        return NextResponse.json({
          image: `data:${contentType};base64,${generatedImage.toString('base64')}`,
        });
      }
      return NextResponse.json(
        { error: 'generate_failed', detail: 'No image in response' },
        { status: 500 }
      );
    }

    // Gemini-compatible providers use the configured Base URL, matching text chat behavior.
    const effectiveBaseURL = normalizeAIBaseURL(baseURL || 'https://generativelanguage.googleapis.com/v1beta');
    if (!isAllowedUpstreamBaseURL(effectiveBaseURL)) {
      return NextResponse.json({ error: 'invalid_base_url' }, { status: 400 });
    }
    const normalizedModel = imageModel.replace(/^models\//, '');
    const endpoint = `${effectiveBaseURL}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: finalPrompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
      redirect: 'error',
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Gemini API error:', res.status, errBody);
      return NextResponse.json(
        { error: isInvalidApiKey(res.status, errBody) ? 'invalid_key' : 'generate_failed', detail: errBody },
        { status: res.status }
      );
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;

    if (!parts || parts.length === 0) {
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason ?? candidate?.finish_reason;
      if (finishReason === 'SAFETY') {
        return NextResponse.json(
          { error: 'safety_filtered' },
          { status: 400 }
        );
      }
      console.error('Gemini empty response:', JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: 'generate_failed', detail: 'No content in response' },
        { status: 500 }
      );
    }

    let resultImage: string | null = null;
    let resultText: string | null = null;

    for (const part of parts) {
      const inlineData = part.inlineData ?? part.inline_data;
      if (inlineData) {
        const mime = inlineData.mimeType ?? inlineData.mime_type ?? 'image/png';
        resultImage = `data:${mime};base64,${inlineData.data}`;
      }
      if (part.text) {
        resultText = part.text;
        resultImage ||= extractImageFromText(part.text);
      }
    }

    if (!resultImage) {
      console.error('Gemini returned text without image:', resultText?.slice(0, 500));
      return NextResponse.json(
        { error: 'image_not_returned' },
        { status: 422 }
      );
    }

    return NextResponse.json({ image: resultImage, text: resultText });
  } catch (err) {
    console.error('LinkedIn photo generation error:', err);
    return NextResponse.json(
      { error: 'generate_failed', detail: String(err) },
      { status: 500 }
    );
  }
}
