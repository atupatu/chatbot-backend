const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./model/user');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb+srv://atharvapatil1384:atharvapatil@cluster0.jov89wq.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB', error);
});

passport.use(new GoogleStrategy({
  clientID: '728158111811-31aa7j9qojm0q27839nkfb1kmt4f41uh.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'https://thehooked.co'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = new User({
        googleId: profile.id,
        email: profile.emails[0].value,
      });
      await user.save();
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('https://chatbot-avd8.onrender.com');
  }
);

let step = 0;
let userEmail = '';
let verificationCode = 0;
let newPassword = '';

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'agnes.lehner@ethereal.email',
    pass: 'uE1nSrvmHR3P1xnEAF'
  }
});

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
  
    if (step === 0) {
        const email = message.trim();
  
        if (!isValidEmail(email)) {
            return res.json({ reply: 'Invalid email. Please enter a valid email.' });
        }
  
        try {
            const user = await User.findOne({ email });
  
            if (user) {
                step = 1;
                userEmail = email;
                res.json({ reply: 'Hey you seem to be an old friend of ours!!!\nEnter your password to login.' });
            } else {
                step = 2;
                userEmail = email;
                res.json({ reply: 'New traveller I see. Type hooked for a verification mail to be sent to your email.' });
            }
        } catch (error) {
            console.error('Error querying the database', error);
            if (!res.headersSent) {
                res.status(500).json({ reply: 'Internal server error' });
            }
        }
    } else if (step === 1) {
        const password = message.trim();
  
        try {
            const user = await User.findOne({ email: userEmail });
  
            if (!user) {
                step = 0;
                return res.json({ reply: 'Email not found. Please provide a valid email.' });
            }
  
            if (password === user.password) {
                step = 9;
                res.json({ reply: 'Password verified. Type yes to get a link to our dashboard.' });
            } else {
                res.json({ reply: 'Naah man, try again!' });
            }
        } catch (error) {
            console.error('Error querying the database', error);
            if (!res.headersSent) {
                res.status(500).json({ reply: 'Internal server error' });
            }
        }
    } else if (step === 2) {
        try {
            verificationCode = generateVerificationCode();
            console.log(verificationCode);
  
            let mailOptions = {
                from: 'your_email@gmail.com',
                to: userEmail,
                subject: 'Email Verification',
                text: `Your verification code is: ${verificationCode}`
            };
  
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending verification email', error);
                    res.status(500).json({ reply: 'Error sending verification email' });
                } else {
                    step = 3;
                    console.log('Verification email sent:', info.response);
                    res.json({ reply: 'Verification email sent. Please check your email for the verification code.' });
                }
            });
  
        } catch (error) {
            console.error('Error sending verification email', error);
            if (!res.headersSent) {
                res.status(500).json({ reply: 'Internal server error' });
            }
        }
    } else if (step === 3) {
        const receivedCode = message.trim();
        console.log(receivedCode);
  
        if (receivedCode == verificationCode) {
            step = 4;
            res.json({ reply: 'Verification successful. Please enter your new password.' });
        } else {
            res.json({ reply: 'Incorrect verification code. Please try again.' });
        }
    } else if (step === 4) {
        newPassword = message.trim();
        step = 5;
        res.json({ reply: 'Please confirm your new password.' });
    } else if (step === 5) {
        const confirmedPassword = message.trim();
  
        if (confirmedPassword === newPassword) {
            try {
                let user = await User.findOne({ email: userEmail });
                if (!user) {
                    user = new User({ email: userEmail, password: confirmedPassword });
                } else {
                    user.password = confirmedPassword;
                }
                await user.save();
  
                step = 9;
                res.json({ 
                    reply: 'Email and password updated successfully. Type "yes" to get a link to our dashboard.', 
                    type: 'button', 
                    buttonText: 'Go to your profile', 
                    buttonLink: 'https://thehooked.co/' 
                });
            } catch (error) {
                console.error('Error updating email and password', error);
                if (!res.headersSent) {
                    res.status(500).json({ reply: 'Internal server error' });
                }
            }
        } else {
            step = 4;
            res.json({ reply: 'Passwords do not match. Please enter your new password again.' });
        }
    } else if (step === 9) {
        const check = message.trim();
        if (check === "yes") {
            step = 0;
            userEmail = '';
            verificationCode = 0;
            newPassword = '';
            res.json({ 
                reply: 'Hop on in.', 
                type: 'button', 
                buttonText: 'Go to your profile', 
                buttonLink: 'https://thehooked.co/' 
            });
        } else {
            res.json({ reply: 'Please type "yes" to get a link to our dashboard.' });
        }
    } else {
        res.json({ reply: message });
    }
});

  
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
