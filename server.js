const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://cosbuyai.onrender.com', 'https://cosbuyai.com', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// User Model
const userSchema = new mongoose.Schema({
    phone: { type: String, unique: true },
    email: { type: String, sparse: true },
    password: String,
    searchHistory: [{
        query: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

const User = mongoose.model('User', userSchema);

// Serve home.html at root URL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/home.html');
});

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { phone, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [
                { phone: phone },
                { email: email }
            ]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
            phone,
            email,
            password: hashedPassword
        });

        await user.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { loginInput, password } = req.body;

        // Find user by phone or email
        const user = await User.findOne({
            $or: [
                { phone: loginInput },
                { email: loginInput }
            ]
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.json({ 
            success: true,
            user: {
                id: user._id,
                phone: user.phone,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search API endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;
        console.log('Received query:', query);

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful shopping assistant. Provide product recommendations in this format: 1. Product Name - Price\n* Key Features\n* Pros\n* Cons"
                },
                {
                    role: "user",
                    content: query
                }
            ],
            max_tokens: 1000
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        console.log('API Response:', response.data.choices[0].message.content);
        res.json({ response: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
});

// Get User Search History
app.get('/api/history/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ history: user.searchHistory });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});






