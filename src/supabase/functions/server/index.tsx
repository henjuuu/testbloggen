import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const BUCKET_NAME = 'make-16ace407-gallery-images';

// Create bucket on startup if it doesn't exist
(async () => {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET_NAME, { public: false });
    console.log(`Created bucket: ${BUCKET_NAME}`);
  }
})();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-16ace407/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload images
app.post("/make-server-16ace407/images", async (c) => {
  try {
    const body = await c.req.json();
    const { images } = body;

    if (!images || !Array.isArray(images)) {
      return c.json({ error: 'Images array is required' }, 400);
    }

    const uploadedImages = [];

    for (const imageData of images) {
      const { base64, date, monthYear } = imageData;
      
      // Convert base64 to blob
      const base64Data = base64.split(',')[1];
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Generate unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${monthYear}/${filename}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      // Get signed URL (valid for 1 year)
      const { data: signedUrlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      const imageMetadata = {
        id: filename,
        filePath,
        url: signedUrlData?.signedUrl || '',
        date,
        monthYear
      };

      // Store metadata in KV
      await kv.set(`image:${filename}`, imageMetadata);
      uploadedImages.push(imageMetadata);
    }

    return c.json({ success: true, images: uploadedImages });
  } catch (error) {
    console.error('Error uploading images:', error);
    return c.json({ error: 'Failed to upload images' }, 500);
  }
});

// Get all images
app.get("/make-server-16ace407/images", async (c) => {
  try {
    const images = await kv.getByPrefix('image:');
    
    // Refresh signed URLs if needed (they expire after 1 year)
    const refreshedImages = await Promise.all(
      images.map(async (img: any) => {
        const { data: signedUrlData } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(img.filePath, 60 * 60 * 24 * 365);
        
        return {
          ...img,
          url: signedUrlData?.signedUrl || img.url
        };
      })
    );

    return c.json({ images: refreshedImages });
  } catch (error) {
    console.error('Error fetching images:', error);
    return c.json({ error: 'Failed to fetch images' }, 500);
  }
});

// Delete image
app.delete("/make-server-16ace407/images/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const imageData = await kv.get(`image:${id}`);
    
    if (!imageData) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Delete from storage
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([imageData.filePath]);

    // Delete metadata from KV
    await kv.del(`image:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return c.json({ error: 'Failed to delete image' }, 500);
  }
});

Deno.serve(app.fetch);