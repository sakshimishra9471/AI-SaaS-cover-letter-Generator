require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");


const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 8787;
const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();


function buildPrompts({ name, role, company, skills, resumeText }) {
  const system = `You are an expert career coach and professional cover-letter writer.
Write a compelling, ATS-friendly cover letter of 3-4 short paragraphs.
Return plain prose only, no markdown headers or bullet lists — just the
letter body starting with "Dear Hiring Manager" and ending with a sign-off
using the candidate's name. Separate paragraphs with a blank line.`;

  const user = `Candidate name: ${name || "(not provided)"}
Target job role: ${role || "(not provided)"}
Target company: ${company || "(not provided)"}
Key skills to emphasize: ${skills || "(not provided)"}
${resumeText ? `\nRelevant resume excerpt:\n${String(resumeText).slice(0, 6000)}` : ""}`;

  return { system, user };
}

async function callOpenAI({ system, user }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 700,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI request failed: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini({ system, user }) {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini request failed: ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n").trim() || "";
}

app.post("/api/generate-letter", async (req, res) => {
  try {
    const { name, role, company, skills, resumeText } = req.body || {};
    const prompts = buildPrompts({ name, role, company, skills, resumeText });

    const letter =
      PROVIDER === "gemini" ? await callGemini(prompts) : await callOpenAI(prompts);

    if (!letter) return res.status(502).json({ error: "Empty response from LLM provider" });
    res.json({ letter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate letter" });
  }
});


async function extractPdfText(buffer) {
  
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text.trim();
}

app.post("/api/parse-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const text = await extractPdfText(req.file.buffer);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not parse PDF" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT} (LLM provider: ${PROVIDER})`);
});