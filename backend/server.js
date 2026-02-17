const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
}));
app.use(express.json());

// Configure Google Generative AI
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// YouTube API setup
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Recipe Ideas API Running 🚀' });
});

app.post('/api/generate', async (req, res) => {
    try {
        const { ingredients, preferences, time, cuisine } = req.body;

        if (!ingredients || !ingredients.trim()) {
            return res.status(400).json({ error: "Please provide some ingredients." });
        }

        const prompt = `
You are a professional chef assistant.
Generate exactly 3 recipes using these ingredients: ${ingredients}.
Preferences: ${preferences}. Cuisine: ${cuisine}. Max cooking time: ${time} minutes.

For each recipe provide:
1. 🍽️ Recipe Title
2. ⏱️ Estimated Time
3. 🛒 Ingredients List
4. 👨‍🍳 Steps
5. 🛍️ Missing Ingredients
6. 💡 Short Note or Tip
`;

        const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const recipesText = response.text();

        // Extract titles
        const matches = recipesText.match(/🍽️ (.*?)\n/g);
        const recipeTitles = matches
            ? matches.map(match => match.replace('🍽️ ', '').trim())
            : [];

        const enhancedRecipes = [];

        for (let i = 0; i < Math.min(recipeTitles.length, 3); i++) {
            const title = recipeTitles[i];
            const { videoUrl, thumbnailUrl } = await searchYouTubeVideo(title);

            const recipeBlocks = recipesText.split('\n\n');
            if (recipeBlocks[i]) {
                const enhancedRecipe =
                    recipeBlocks[i] +
                    `\n7. 📺 YouTube Video Link: ${videoUrl}` +
                    `\n8. 🖼️ YouTube Thumbnail: ${thumbnailUrl}`;

                enhancedRecipes.push(enhancedRecipe);
            }
        }

        const enhancedResponse = enhancedRecipes.join('\n\n');

        res.json({ response: enhancedResponse });

    } catch (error) {
        console.error('Error generating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// YouTube Search Function
async function searchYouTubeVideo(query) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: query + ' recipe cooking tutorial',
            type: 'video',
            order: 'relevance',
            maxResults: 1
        });

        if (response.data.items && response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            return { videoUrl, thumbnailUrl };
        }

        return { videoUrl: "No video found", thumbnailUrl: "" };

    } catch (error) {
        console.error('YouTube API error:', error);
        return { videoUrl: "Error fetching video", thumbnailUrl: "" };
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
