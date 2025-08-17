// install deps first:
// npm install express @supabase/supabase-js cloudinary dotenv

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000; // 👈 port 4000

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

// ---- Route ----
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
      if (!row.displayurl) continue;

      if (row.displayurl.includes(`res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`)) {
        results.push({ id: row.id, status: 'skipped (already uploaded)' });
        continue;
      }

      try {
        const result = await cloudinary.uploader.upload(row.displayurl, {
          folder: 'supabase_uploads',
        });

        await supabase
          .from('instagram_post')
          .update({ displayurl: result.secure_url })
          .eq('id', row.id);

        results.push({ id: row.id, status: 'uploaded', newUrl: result.secure_url });
      } catch (err) {
        results.push({ id: row.id, status: 'failed', error: err.message });
      }
    }

    res.json({ message: `Process completed for ${handlename}`, results });
  } catch (err) {
    console.error('❌ Script failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
