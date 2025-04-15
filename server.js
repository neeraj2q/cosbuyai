const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

// Search Route with History
app.post('/api/search', async (req, res) => {
    try {
        const { query, userId } = req.body;

        // Save search history if user is logged in
        if (userId) {
            await User.findByIdAndUpdate(userId, {
                $push: {
                    searchHistory: {
                        query,
                        timestamp: new Date()
                    }
                }
            });
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: "You are a helpful shopping assistant that provides information in Hinglish (mix of Hindi and English)."
            }, {
                role: "user",
                content: `Compare prices and features for: ${query}. Include prices from different e-commerce platforms.`
            }],
            max_tokens: 1000,
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        res.json({ content: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});






