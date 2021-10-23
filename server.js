const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const hbs = require('hbs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const setupRoutes = require('./routes');
const User = require('./models/user.model');

require('dotenv').config()

/* Connect to MongoDB */
const clientP = mongoose.connect('mongodb://127.0.0.1:27017/macy')
  .catch(console.error)
  .then(async (m) => {
    /* PASSPORT SETUP */
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3030/auth/google/callback"
      },
      function(accessToken, refreshToken, profile, done) {
        console.log(accessToken, refreshToken, profile);
        User.findOne({ googleId: profile.id }, (err, user) => {
          if (err) {
            return done(err);
          }
          // No user was found, so create!
          if (!user) {
            const newUser = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value
            });
            newUser.save((err) => {
                if (err) {
                  console.error(err);
                };
                return done(err, user);
            });
          } else {
            return done(err, user);
          }
        });
      }
    ));

    passport.serializeUser(function(user, done) {
      done(null, user);
    });
    
    passport.deserializeUser(function(user, done) {
      done(null, user);
    });

    /* EXPRESS SETUP */

    const app = express();

    const port = process.env.PORT || '3030';

    app.set('view engine', 'hbs');

    app.set('views', path.join(__dirname, 'views'));

    app.use(express.static(path.join(__dirname, 'public')));

    app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      store: MongoStore.create({
        client: m.connection.getClient()
      })
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    hbs.registerPartials(__dirname + '/views/partials', function (err) {
      if (err) {
        console.error(err);
      }
    });

    /* AUTH ROUTES */

    app.get('/auth/google', passport.authenticate('google', { scope: 'openid profile email' }));

    app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
      res.redirect('/');
    });

    setupRoutes(app);

    app.listen(port, () => {
      console.log(`App is listening to ${port}...`);
      console.log('Press Ctrl+C to quit.');
    });
  });