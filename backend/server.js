const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

/* ================================
   SECURITY MIDDLEWARE
================================ */

// Restrict CORS (Set FRONTEND_URL in Render)
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

app.use(express.json());

/* ================================
   ENV VALIDATION
================================ */

if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
}

if (!process.env.YOUTUBE_API_KEY) {
    console.error("Missing YOUTUBE_API_KEY");
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
}

/* ================================
   DATABASE CONNECTION
================================ */

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

/* ================================
   SCHEMA
================================ */

const recipeSchema = new mongoose.Schema({
    ingredients: String,
    preferences: String,
    time: String,
    cuisine: String,
    response: String,
    createdAt: { type: Date, default: Date.now }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

/* ================================
   GOOGLE AI SETUP
================================ */

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* ================================
   YOUTUBE API SETUP
================================ */

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

/* ================================
   ROUTES
================================ */

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
Generate exactly 3 recipes using: ${ingredients}.
Preferences: ${preferences}. Cuisine: ${cuisine}. Max cooking time: ${time} minutes.

Rules:
1. First recipe title must remain unchanged.
2. Other two can be variations.
3. All must be realistic and edible.
Plain text only.
`;

        const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const recipesText = result.response.text();

        const matches = recipesText.match(/🍽️ (.*?)\n/g);
        const recipeTitles = matches
            ? matches.map(match => match.replace('🍽️ ', '').trim())
            : [];

        const enhancedRecipes = [];

        for (let i = 0; i < Math.min(recipeTitles.length, 3); i++) {
            const title = recipeTitles[i];
            const { videoUrl, thumbnailUrl } = await searchYouTubeVideo(title);

            enhancedRecipes.push(
                recipesText.split('\n\n')[i] +
                `\n📺 YouTube: ${videoUrl}\n🖼️ Thumbnail: ${thumbnailUrl}`
            );
        }

        const enhancedResponse = enhancedRecipes.join('\n\n');

        await Recipe.create({
            ingredients,
            preferences,
            time,
            cuisine,
            response: enhancedResponse
        });

        res.json({ response: enhancedResponse });

    } catch (error) {
        console.error("Error generating recipe:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find().sort({ createdAt: -1 });
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ error: "Error fetching recipes" });
    }
});

/* ================================
   YOUTUBE SEARCH FUNCTION
================================ */

async function searchYouTubeVideo(query) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: query + ' recipe cooking tutorial',
            type: 'video',
            order: 'relevance',
            maxResults: 1
        });

        if (response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;

            return {
                videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            };
        }

        return { videoUrl: "No video found", thumbnailUrl: "" };

    } catch (error) {
        console.error("YouTube API error:", error.message);
        return { videoUrl: "Error fetching video", thumbnailUrl: "" };
    }
}

/* ================================
   START SERVER
================================ */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
