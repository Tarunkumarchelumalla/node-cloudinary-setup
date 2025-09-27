// install deps first:
// npm install express @supabase/supabase-js cloudinary dotenv

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json()); // 👈 needed for POST body
const PORT = process.env.PORT || 4000;

// ---- Supabase setup ----
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---- Cloudinary setup ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---- Reusable Upload Function ----
async function uploadToCloudinary(imageUrl) {
  if (!imageUrl) throw new Error("No image URL provided");

  // Skip if already hosted on Cloudinary
  if (imageUrl.includes(`res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`)) {
    return { status: "skipped", url: imageUrl };
  }

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "supabase_uploads",
  });

  return { status: "uploaded", url: result.secure_url };
}

// ---- API 1: Process whole handle ----
app.get('/upload/:handlename', async (req, res) => {
  const { handlename } = req.params;

  try {
    const { data, error } = await supabase
      .from('instagram_post')
      .select('id, displayurl')
      .eq('handlename', handlename);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.json({ message: `No posts found for ${handlename}` });
    }

    const results = [];

    for (const row of data) {
      try {
        const result = await uploadToCloudinary(row.displayurl);

        if (result.status === "uploaded") {
          await supabase
            .from('instagram_post')
            .update({ displayurl: result.url })
            .eq('id', row.id);
        }

        results.push({ id: row.id, ...result });
      } catch (err) {
        results.push({ id: row.id, status: "failed", error: err.message });
      }
    }

    res.json({ message: `Process completed for ${handlename}`, results });
  } catch (err) {
    console.error("❌ Script failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- API 2: Upload single image directly ----
app.post('/upload-url', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const result = await uploadToCloudinary(imageUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
