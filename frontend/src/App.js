import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
    const [ingredients, setIngredients] = useState('');
    const [preferences, setPreferences] = useState('');
    const [cuisine, setCuisine] = useState('');
    const [time, setTime] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

    const generateRecipe = async() => {
        setLoading(true);
        setResponse('');

        const payload = {
            ingredients,
            preferences,
            time,
            cuisine
        };

        try {
            const res = await axios.post('https://recipergenrator.onrender.com/api/generate', payload);
            if (res.data.response) {
                // Parse the response to handle YouTube thumbnails
                let lines = res.data.response.split('\n');
                let formattedLines = lines.map(line => {
                    if (line.startsWith('8. 🖼️ YouTube Thumbnail: ')) {
                        let thumbnail_url = line.substring('8. 🖼️ YouTube Thumbnail: '.length);
                        return '<br><img src="' + thumbnail_url + '" alt="YouTube Thumbnail" style="max-width: 120px; height: auto;"><br>';
                    } else {
                        return line;
                    }
                });
                let formattedResponse = formattedLines.join('<br>');
                setResponse(formattedResponse);
            } else if (res.data.error) {
                setResponse(`Error: ${res.data.error}`);
            } else {
                setResponse('Unexpected response from server.');
            }
        } catch (error) {
            setResponse(`Network error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return ( <
        div className = "container" >
        <
        h1 > 🥗AI Recipe Ideas < /h1> <
        p > Get delicious recipes using your available ingredients! < /p>

        <
        div className = "form" >
        <
        input type = "text"
        placeholder = "Enter ingredients (e.g., tomato, rice, chicken)"
        value = { ingredients }
        onChange = {
            (e) => setIngredients(e.target.value)
        }
        /> <
        input type = "text"
        placeholder = "Dietary preferences (e.g., vegetarian, gluten-free)"
        value = { preferences }
        onChange = {
            (e) => setPreferences(e.target.value)
        }
        /> <
        input type = "text"
        placeholder = "Preferred cuisine (e.g., Italian, Asian)"
        value = { cuisine }
        onChange = {
            (e) => setCuisine(e.target.value)
        }
        /> <
        input type = "number"
        placeholder = "Max cooking time (minutes)"
        value = { time }
        onChange = {
            (e) => setTime(e.target.value)
        }
        /> <
        button onClick = { generateRecipe }
        disabled = { loading } > { loading ? 'Generating...' : 'Generate Recipe 🍳' } <
        /button> < /
        div >

        <
        div id = "output"
        dangerouslySetInnerHTML = {
            { __html: response }
        }
        /> < /
        div >
    );
}

export default App;