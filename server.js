const express = require("express");
const fetch = require("node-fetch"); // or const fetch = (...await import('node-fetch')).default; for ESM
const app = express();
const path = require("path");

// Serve static files from the Angular build output directory
app.use(express.static(path.join(__dirname, "/dist/spectra-frontend")));

// Specific API/proxy routes should come BEFORE the wildcard SPA route

// Status endpoint
app.get("/status", function (req, res) {
  res.json({ status: "UP" });
});

// Proxy endpoint for images
app.get("/proxy-image", async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send("Missing url query parameter");
  }
  try {
    const fetchOptions = {
      headers: {
        // Add any necessary headers, e.g., User-Agent, if the image host requires it
        "User-Agent": "SpectraImageProxy/1.0",
      },
    };
    const response = await fetch(imageUrl, fetchOptions);
    if (!response.ok) {
      console.error(
        `Proxy failed to fetch image: ${imageUrl}, Status: ${response.status}`
      );
      return res
        .status(response.status)
        .send(`Failed to fetch image from origin: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      console.warn(
        `Proxied resource is not an image type: ${imageUrl}, Content-Type: ${contentType}`
      );
      // Optionally, you could try to stream the response anyway, or return an error
      // For now, let's return an error if it's clearly not an image.
      return res.status(400).send(
        `Proxied resource at ${imageUrl} is not a valid image type. Content-Type: ${contentType}`
      );
    }

    res.set("Access-Control-Allow-Origin", "*"); // Consider making this more restrictive if needed
    res.set("Content-Type", contentType);
    response.body.pipe(res);
  } catch (e) {
    console.error(`Error in /proxy-image for ${imageUrl}:`, e);
    res.status(500).send("Proxy encountered an error");
  }
});

// Wildcard route for the Angular SPA - This MUST be AFTER specific API routes
app.get("/*", function (req, res) {
  res.sendFile(path.join(__dirname, "/dist/spectra-frontend/index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
