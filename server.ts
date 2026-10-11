import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support base64 image snapshots up to 15MB
app.use(express.json({ limit: '15mb' }));

/**
 * Health & Vision Service status check
 */
app.get('/api/vision-status', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    available: hasKey,
    model: 'gemini-3.8-flash',
    mode: 'free-tier-compatible',
    message: hasKey
      ? 'Gemini vision service is ready.'
      : 'GEMINI_API_KEY not configured. Core VR game is fully functional.',
  });
});

/**
 * Deliberate single-frame AI vision analysis
 */
app.post('/api/vision-analyze', async (req: Request, res: Response) => {
  const { image, mimeType = 'image/jpeg' } = req.body;

  if (!image || typeof image !== 'string') {
    res.status(400).json({
      error: 'Missing image data. Please provide a base64 encoded frame.',
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error:
        'Gemini API key is not configured on the server. AI Vision requires GEMINI_API_KEY in server secrets. The core VR game remains completely playable.',
      code: 'API_KEY_MISSING',
    });
    return;
  }

  try {
    // Clean base64 string if it contains data URL prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are the educational vision intelligence system inside RealityPlay VR.
Your purpose is to describe ordinary visible inanimate objects (such as furniture, technology, household items, tools, plants, books) and provide interesting educational facts or STEM concepts.

STRICT SAFETY AND PRIVACY DIRECTIVES:
1. Do NOT identify, recognize, name, or profile any human individuals.
2. Do NOT infer sensitive personal attributes (including emotion, age, gender, ethnicity, biometrics, or health status).
3. If people or personal documents are visible, ignore facial/personal details and focus strictly on general inanimate objects, furnishings, or surrounding environmental items.
4. Do NOT claim that visual analysis provides exact physical 3D coordinates, depth maps, or anchored spatial bounding boxes. Clearly emphasize observations are 2D visual estimates.
5. Provide engaging, curiosity-sparking STEM insights suitable for learners of all ages.`;

    const userPrompt = `Analyze this single camera snapshot:
1. Identify 2 to 4 prominent inanimate objects or tools visible.
2. Provide 2 to 3 fascinating educational/scientific facts about the materials, mechanics, or physics of these objects.
3. Suggest 1 interactive discovery challenge for the user.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType,
            },
          },
          { text: userPrompt },
        ],
      },
      config: {
        systemInstruction,
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneSummary: {
              type: Type.STRING,
              description: 'Brief 1-sentence description of the visible setting.',
            },
            detectedObjects: {
              type: Type.ARRAY,
              description: 'List of ordinary inanimate objects identified in frame.',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Common name of object' },
                  detail: { type: Type.STRING, description: 'Brief observation about material or function' },
                },
                required: ['name', 'detail'],
              },
            },
            educationalFacts: {
              type: Type.ARRAY,
              description: 'STEM or historical educational facts about the observed items.',
              items: {
                type: Type.STRING,
              },
            },
            discoveryChallenge: {
              type: Type.STRING,
              description: 'A curious question or mini-challenge for the user.',
            },
          },
          required: ['sceneSummary', 'detectedObjects', 'educationalFacts', 'discoveryChallenge'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      res.status(500).json({ error: 'Empty response received from Gemini model.' });
      return;
    }

    const parsed = JSON.parse(responseText.trim());
    res.json({
      success: true,
      analysis: parsed,
      disclaimer: 'Visual observations are 2D AI estimates and do not represent exact spatial coordinates or depth anchors.',
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; errorDetails?: unknown };
    const errMsg = err?.message || 'Failed to analyze camera frame';

    // Handle quota errors gracefully
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
      res.status(429).json({
        error: 'Free-tier Gemini request quota temporarily exceeded. Please try again shortly. Core VR target game remains fully operational.',
        code: 'QUOTA_EXHAUSTED',
      });
      return;
    }

    res.status(500).json({
      error: `AI Vision analysis error: ${errMsg}`,
      code: 'API_ERROR',
    });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RealityPlay VR server running on port ${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
