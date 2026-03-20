import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function parseImageData(dataUrl: string): { data: string; mimeType: string } {
  const base64Data = dataUrl.includes(",")
    ? dataUrl.split(",")[1]
    : dataUrl;
  let mimeType = "image/jpeg";
  if (dataUrl.includes("data:image/png")) mimeType = "image/png";
  if (dataUrl.includes("data:image/webp")) mimeType = "image/webp";
  return { data: base64Data, mimeType };
}

export interface DesignPlan {
  displayText: string;
  imagePrompt: string;
  ingredientTable: string;
}

/**
 * 第零步：产品抠图
 */
export const generateWhiteBg = async (imageData: string): Promise<string> => {
  const img = parseImageData(imageData);
  const parts = [
    { inlineData: img },
    {
      text: `Remove the background from this product photo completely. Place the product on a pure white (#FFFFFF) background.
Keep the product EXACTLY as it is — do not redraw or modify. All text, labels, logos must remain sharp and legible. Preserve exact colors and proportions. Clean pure white background, no shadows.`,
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts },
    config: { imageConfig: { aspectRatio: "1:1" } },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("White background generation failed");
};

/**
 * 第一步：策划设计方案
 */
export const generateDesignPlan = async (
  productName: string,
  customReq?: string,
  referenceImage?: string,
  ingredientImages: string[] = [],
  quantity: string = "1",
  position: string = "右侧"
): Promise<DesignPlan> => {
  const positionEn =
    position === "右侧" ? "right" : position === "左侧" ? "left" : "center";

  const prompt = `You are a world-class TV shopping LED backdrop poster art director.

Task: Design a visual concept for a 1920×1080 LED screen backdrop poster.
Product: ${productName}
${customReq ? `Ingredients / Attributes: ${customReq}` : ""}
Product count: ${quantity}, placement: ${positionEn} side

You must output THREE sections, separated by exact markers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: Chinese Design Brief
Output each part with its heading:

【色调】具体色彩名+hex+情绪
【场景故事】一句话叙事，与产品产地/工艺/文化强关联
【远景 — 氛围层】背景场景具体描述
【中景 — 产品层】产品摆放方式
【近景 — 配料层】每种配料的真实物理形态和位置。重要规则：配料表的排列顺序就是用量从大到小的顺序，排在前面的配料是主料，画面中应该占据最大的面积和最突出的位置；排在后面的是辅料，画面中应该小而少。（酸枣仁=5mm棕色椭圆种子≠红枣；百合=白色干燥鳞片≠百合花；茯苓=白色方块≠蘑菇）
【光影】光源、方向、色温、特效
【氛围关键词】5个关键词

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: English Scene Prompt
After the exact line "===SCENE_PROMPT===", output a SHORT English paragraph (max 150 words) describing ONLY:
- The background scene/environment
- Color palette (hex codes)
- Lighting setup
- Product placement (${quantity} unit(s) on ${positionEn})
- Camera angle
- "Upper 1/3 of frame is empty, background only. No text anywhere. 1920x1080, 16:9, cinematic f/2.8 bokeh."

Do NOT describe ingredients here. Keep it short and focused.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: Ingredient Visual Table
After the exact line "===INGREDIENT_TABLE===", output a structured list.

CRITICAL RULE: The ingredient list order = dosage order (first = largest amount, last = smallest amount).
- Rank 1-2: VISUAL_WEIGHT=HERO — large generous pile/bowl, occupying the most foreground area, closest to camera
- Rank 3-4: VISUAL_WEIGHT=MAJOR — medium visible portion, clearly recognizable
- Rank 5-6: VISUAL_WEIGHT=MINOR — smaller amount, supporting role
- Rank 7+: VISUAL_WEIGHT=ACCENT — just a few pieces or a pinch, subtle presence at the edge

For EACH ingredient, one line in this exact format:

INGREDIENT: [English name (中文)] | RANK: [1-based position] | VISUAL_WEIGHT: [HERO/MAJOR/MINOR/ACCENT] | LOOKS LIKE: [precise shape, size in mm, color, texture] | NOT: [common confusion item] | PLACEMENT: [where] | CONTAINER: [bowl/plate/scattered/none] | AMOUNT: [large pile/medium bowl/small handful/few pieces/a pinch]

Example (rank 1, biggest dosage):
INGREDIENT: Ziziphus jujuba seeds (酸枣仁) | RANK: 1 | VISUAL_WEIGHT: HERO | LOOKS LIKE: tiny 5mm oval flat seeds, dark reddish-brown, smooth hard shell | NOT: red jujube dates, NOT goji berries | PLACEMENT: prominent front-center | CONTAINER: large ceramic bowl, overflowing | AMOUNT: large generous pile, 50+ seeds visible

Example (rank 7, smallest dosage):
INGREDIENT: Malt sugar (麦芽糖) | RANK: 7 | VISUAL_WEIGHT: ACCENT | LOOKS LIKE: golden amber sticky syrup | NOT: honey | PLACEMENT: far edge | CONTAINER: tiny spoon | AMOUNT: a small drizzle

Be EXTREMELY precise. The image model uses this table directly.`;

  const parts: any[] = [];

  if (referenceImage) {
    parts.push({ text: "[Product packaging — reproduce exactly]:" });
    parts.push({ inlineData: parseImageData(referenceImage) });
  }

  if (ingredientImages.length > 0) {
    parts.push({ text: "[Ingredient reference photos]:" });
    for (const img of ingredientImages) {
      parts.push({ inlineData: parseImageData(img) });
    }
  }

  parts.push({ text: prompt });

  console.log("Sending design plan request to Gemini...");
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: { parts },
  });

  const text = response.text || "";
  console.log("Received design plan response.");

  const sceneSep = "===SCENE_PROMPT===";
  const ingredientSep = "===INGREDIENT_TABLE===";

  const sceneIdx = text.indexOf(sceneSep);
  const ingredientIdx = text.indexOf(ingredientSep);

  let displayText = text;
  let imagePrompt = "";
  let ingredientTable = "";

  if (sceneIdx !== -1) {
    displayText = text.substring(0, sceneIdx).trim();
    if (ingredientIdx !== -1) {
      imagePrompt = text.substring(sceneIdx + sceneSep.length, ingredientIdx).trim();
      ingredientTable = text.substring(ingredientIdx + ingredientSep.length).trim();
    } else {
      imagePrompt = text.substring(sceneIdx + sceneSep.length).trim();
    }
  }

  return { displayText, imagePrompt, ingredientTable };
};

/**
 * 第二步：生成海报
 */
export const generatePosterFromPlan = async (
  scenePrompt: string,
  ingredientTable: string,
  referenceImage?: string,
  ingredientImages: string[] = []
): Promise<string> => {
  const parts: any[] = [];

  if (referenceImage) {
    parts.push({
      text: "Product packaging reference (reproduce this EXACT packaging):",
    });
    parts.push({ inlineData: parseImageData(referenceImage) });
  }

  if (ingredientImages.length > 0) {
    parts.push({
      text: "Ingredient appearance references (match these exact visual forms):",
    });
    for (let i = 0; i < ingredientImages.length; i++) {
      parts.push({ inlineData: parseImageData(ingredientImages[i]) });
    }
  }

  const variations = [
    "Shot from a low angle (15° upward), making the product look heroic and monumental.",
    "Golden hour warm light streaming from the left, casting long amber shadows.",
    "Cool blue hour atmosphere with soft twilight tones and gentle rim lighting.",
    "Morning dew droplets visible on ingredients, fresh and crisp dawn lighting.",
    "Dramatic chiaroscuro lighting with deep shadows and bright highlights, Caravaggio-style.",
    "Autumn leaves subtly scattered at the far edges of the frame.",
    "Wisps of warm steam or mist rising gently from behind the ingredients.",
    "Soft bokeh light orbs floating in the distant background, dreamlike.",
    "Frost crystals on the wooden surface, cold winter morning atmosphere.",
    "Overhead angled shot (30° downward), showcasing the ingredient spread like a food editorial.",
    "Spring cherry blossom petals drifting softly in the background air.",
    "Volumetric light rays (Tyndall effect) cutting through from upper-left window.",
  ];
  const randomVariation = variations[Math.floor(Math.random() * variations.length)];

  const finalPrompt = `${scenePrompt}
Creative variation for this render: ${randomVariation}

FOREGROUND INGREDIENTS — render each one exactly as described, respecting VISUAL_WEIGHT:
${ingredientTable}

CRITICAL RULES:
- VISUAL_WEIGHT determines how much space each ingredient occupies: HERO = largest and most prominent, ACCENT = tiny and subtle. This reflects real dosage proportions.
- Each ingredient must match its "LOOKS LIKE" description precisely. If it says "tiny 5mm oval seeds", do NOT render large red fruits.
- Pay attention to "NOT" items — those are common mistakes to avoid.
- HERO ingredients should be the first thing the viewer notices in the foreground. ACCENT ingredients should be barely noticeable at the edges.
- Product packaging must be identical to the reference photo.
- No text, letters, or typography anywhere in the image.`;

  parts.push({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts },
    config: {
      imageConfig: { aspectRatio: "16:9" },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Image generation failed");
};

/**
 * 方案修改后：重新生成英文 scenePrompt + ingredientTable
 */
export const rebuildPromptFromBrief = async (
  editedBrief: string,
  productName: string,
  quantity: string = "1",
  position: string = "右侧"
): Promise<{ imagePrompt: string; ingredientTable: string }> => {
  const positionEn =
    position === "右侧" ? "right" : position === "左侧" ? "left" : "center";

  const prompt = `Convert this edited Chinese design brief into two outputs.

Product: ${productName}, ${quantity} unit(s), ${positionEn} side.

=== BRIEF ===
${editedBrief}

=== OUTPUT 1: SCENE PROMPT (after "===SCENE===") ===
A SHORT English paragraph (max 150 words) for the background scene, colors, lighting, product placement.
Include: "Upper 1/3 empty. No text. 1920x1080, 16:9, cinematic f/2.8."

=== OUTPUT 2: INGREDIENT TABLE (after "===INGREDIENTS===") ===
Ingredient list order = dosage order (first = most, last = least).
For each ingredient mentioned in 【近景】, one line:
INGREDIENT: [English name (中文)] | RANK: [1-based] | VISUAL_WEIGHT: [HERO(rank1-2)/MAJOR(3-4)/MINOR(5-6)/ACCENT(7+)] | LOOKS LIKE: [shape, size mm, color, texture] | NOT: [confusion item] | PLACEMENT: [where] | CONTAINER: [what] | AMOUNT: [large pile/medium/small handful/few pieces/pinch]

Follow the brief EXACTLY. Do not change any creative decisions.`;

  console.log("Rebuilding prompt from brief...");
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: { parts: [{ text: prompt }] },
  });

  const text = (response.text || "").trim();
  console.log("Rebuild complete.");
  const sceneSep = "===SCENE===";
  const ingredientSep = "===INGREDIENTS===";

  const sceneIdx = text.indexOf(sceneSep);
  const ingredientIdx = text.indexOf(ingredientSep);

  let imagePrompt = "";
  let ingredientTable = "";

  if (sceneIdx !== -1 && ingredientIdx !== -1) {
    imagePrompt = text.substring(sceneIdx + sceneSep.length, ingredientIdx).trim();
    ingredientTable = text.substring(ingredientIdx + ingredientSep.length).trim();
  } else if (sceneIdx !== -1) {
    imagePrompt = text.substring(sceneIdx + sceneSep.length).trim();
  } else {
    imagePrompt = text;
  }

  return { imagePrompt, ingredientTable };
};
