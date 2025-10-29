const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection (optional)
mongoose.connect('mongodb://localhost:27017/recipe-ideas')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB not available, running without database'));

// Recipe Schema
const recipeSchema = new mongoose.Schema({
    title: String,
    ingredients: String,
    preferences: String,
    time: String,
    cuisine: String,
    response: String,
    createdAt: { type: Date, default: Date.now }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

// Configure Google Generative AI
const genai = new GoogleGenerativeAI("AIzaSyCwYMbe13yOedIvoHdtsA5hn8F-AAuoGSs");

// YouTube API setup
const YOUTUBE_API_KEY = "AIzaSyAZdwM5vH9HB_28_-NAwmDFbDzHX7gylpg";
const youtube = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Recipe Ideas API' });
});

app.post('/api/generate', async(req, res) => {
    try {
        const { ingredients, preferences, time, cuisine } = req.body;

        if (!ingredients || !ingredients.trim()) {
            return res.status(400).json({ error: "Please provide some ingredients." });
        }

        const prompt = `
You are a professional chef assistant.
Your task is to generate exactly 3 recipes using these ingredients: ${ingredients}.
Preferences: ${preferences}. Cuisine: ${cuisine}. Max cooking time: ${time} minutes.

Important rules:
1. The first recipe MUST have the exact same title as provided by the user. Do NOT change, expand, or creatively reinterpret the title. For example, if the title is "potato fry", it must remain "potato fry" — not "potato fry manchurian" or "crispy potato fry delight".
2. The other two recipes can be creative variations or related dishes using the same ingredients.
3. All recipes must be realistic and edible.

For each recipe, provide (plain text only, no markdown formatting):
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

        // Parse the response to extract recipe titles
        const matches = recipesText.match(/🍽️ (.*?)\n/g);
        const recipeTitles = matches ? matches.map(match => match.replace('🍽️ ', '').trim()) : [];

        // For each recipe, get YouTube link and thumbnail
        const enhancedRecipes = [];
        for (let i = 0; i < Math.min(recipeTitles.length, 3); i++) {
            const title = recipeTitles[i];
            const { videoUrl, thumbnailUrl } = await searchYouTubeVideo(title);

            // Split recipes by double newlines
            const recipeBlocks = recipesText.split('\n\n');
            if (recipeBlocks[i]) {
                const enhancedRecipe = recipeBlocks[i] + `\n7. 📺 YouTube Video Link: ${videoUrl}\n8. 🖼️ YouTube Thumbnail: ${thumbnailUrl}`;
                enhancedRecipes.push(enhancedRecipe);
            }
        }

        const enhancedResponse = enhancedRecipes.join('\n\n');

        // Save the generated recipe to database (optional)
        try {
            const newRecipe = new Recipe({
                ingredients,
                preferences,
                time,
                cuisine,
                response: enhancedResponse
            });
            await newRecipe.save();
        } catch (saveError) {
            console.error('Error saving recipe to database:', saveError.message);
            // Continue without saving
        }

        res.json({ response: enhancedResponse });
    } catch (error) {
        console.error('Error generating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to get saved recipes
app.get('/api/recipes', async(req, res) => {
    try {
        const recipes = await Recipe.find().sort({ createdAt: -1 });
        res.json(recipes);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        return { videoUrl: `Error fetching video: ${error.message}`, thumbnailUrl: "" };
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;