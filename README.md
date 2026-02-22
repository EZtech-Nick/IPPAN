<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1l-Y911mGLQamWIOV_XfUmTqXpAWqLKd7

## Deploy to Netlify

1. Create a new site on Netlify.
2. Link your repository.
3. Set the build command to `npm run build`.
4. Set the publish directory to `dist`.
5. Add the `GEMINI_API_KEY` environment variable in Netlify settings.
6. Deploy!

The project is configured with `netlify.toml` and `public/_redirects` for SPA routing.
