const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const hbs = require('hbs');
const hbsutils = require('hbs-utils')(hbs);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { conversation, Suggestion } = require('@assistant/conversation')
const setupRoutes = require('./routes');
const User = require('./models/user.model');
const Profile = require('./models/profile.model');
const Medication = require('./models/medication.model');
const MedicationTime = require('./models/medicationTime.model');
const MedicationRecord = require('./models/medicationRecord.model');

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
        callbackURL: process.env.URL + '/auth/google/callback'
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

    hbsutils.registerWatchedPartials(__dirname + '/views/partials', function (err) {
      if (err) {
        console.error(err);
      }
    });

    hbs.registerHelper('minsto12h', (mins) => {
      const minsInt = parseInt(mins, 10);
      let hours = Math.floor(minsInt / 60);
      const minutes = (minsInt % 60).toString().padStart(2, '0');
      const am = hours >= 12 ? 'PM' : 'AM';
      hours %= 12;
      if (hours === 0) {
        hours = 12;
      }
      return `${hours}:${minutes} ${am}`;
    });

    hbs.registerHelper('minsto24h', (mins) => {
      const minsInt = parseInt(mins, 10);
      const hours = Math.floor(minsInt / 60).toString().padStart(2, '0');
      const minutes = (minsInt % 60).toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    hbs.registerHelper('ternary', function(test, equals, yes, no) {
      return test == equals ? yes : no;
    });

    /* AUTH ROUTES */

    app.get('/auth/google', passport.authenticate('google', { scope: 'openid profile email' }));

    app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
      res.redirect('/');
    });

    const webhookApp = conversation({
      clientId: process.env.ACTIONS_CLIENT_ID
    });

    const getOverdueMedications = function getOverdueMedications(profile, conv) {
      const overdueMedicationTimes = [];
      const timezone = conv.device.timeZone.id;

      const currTimeString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());
      
      const currDateString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      }).format(new Date());

      const hm = currTimeString.split(':');

      const mins = parseInt(hm[0],10)*60 + parseInt(hm[1],10);

      profile.medications.forEach((medication) => {
        medication.times.forEach((time) => {
          // check if time is in past
          if (time.time < mins) {
            let tookToday = false;
            time.records.forEach((record) => {
              const recordDateString = new Intl.DateTimeFormat('en-US', {
                timeZone: 'GMT',
                month: '2-digit',
                day: '2-digit',
                year: '2-digit'
              }).format(record.date);
              console.log(recordDateString, currDateString, record.taken);

              if (recordDateString === currDateString) {
                if (record.taken) {
                  tookToday = true;
                }
              }
            });

            if (!tookToday) {
              overdueMedicationTimes.push({
                name: medication.name,
                time: time._id
              });
            }
          }
        });
      });

      return overdueMedicationTimes;
    };

    // SETUP WEBHOOKS
    webhookApp.handle('getaccount', async (conv) => {
      if (conv.user.params && conv.user.params.tokenPayload) {
        const googleId = conv.user.params.tokenPayload.sub;

        const setProfile = (profile) => {
          conv.user.params.profile = profile._id;
          conv.add(`Hey ${profile.name}!`);
          
          // find any meds to take

          conv.session.params.overdue = getOverdueMedications(profile, conv);
        };

        // Get user
        const user = await User.findOne({ googleId })
          .populate([{
            path: 'profiles',
            populate: [{
              path: 'medications',
              populate: [{
                path: 'times',
                populate: [{
                  path: 'records'
                }]
              }]
            }]
          }]);
          
        if (!user) {
          return conv.add('No user was found.');
        }

        if (!user.profiles.length) {
          return conv.add('You have no profiles set up.');
        }

        if (conv.user.params.profile) {
          const profile = user.profiles.find((profile) => {
            return profile._id.equals(conv.user.params.profile);
          });
          if (profile) {
            setProfile(profile);
          }
        } else if (user.profiles.length === 1) {
          setProfile(user.profiles[0]);
        } else {
          let profileNameString = '';
          console.log(user.profiles);
          user.profiles.forEach((profile, index) => {
            if (index === user.profiles.length - 1) {
              profileNameString += `or ${profile.name}?`;
            } else {
              profileNameString += profile.name + ', ';
            }
          });
          return conv.add('There are multiple profiles associated with this account. Are you ' + profileNameString);

          // TODO: GET ANSWER
        }

      } else {
        return conv.add('Are you really logged in?');
      }
    });

    webhookApp.handle('checkoverdue', async (conv) => {
      conv.add(`Have you taken your ${conv.session.params.overdue[0].name}?`);
      conv.add(new Suggestion({ title: 'Yes' }));
      conv.add(new Suggestion({ title: 'No' }));
    });

    webhookApp.handle('tookmedication', async (conv) => {
      const timezone = conv.device.timeZone.id;
      const currDateString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      }).format(new Date());

      const checkStreak = async () => {
        console.log('checking streak');
        const profile = await Profile.findOne({ _id: conv.user.params.profile })
          .populate([{
            path: 'medications',
            populate: [{
              path: 'times',
              populate: [{
                path: 'records'
              }]
            }]
          }]);
        
        let tookAll = true;
        
        for (let i = 0; i < profile.medications.length; i += 1) {
          const medication = profile.medications[i];
          for (let j = 0; j < medication.times.length; j += 1) {
            const time = medication.times[j];
            const todayRecord = time.records.find((record) => {
              const recordDateString = new Intl.DateTimeFormat('en-US', {
                timeZone: 'GMT',
                month: '2-digit',
                day: '2-digit',
                year: '2-digit'
              }).format(record.date);
              console.log(recordDateString, currDateString);
      
              if (recordDateString === currDateString) {
                return true;
              }
            });

            if (!todayRecord || todayRecord.taken !== true) {
              tookAll = false;
              console.log(`did not take all - ${medication.name}`);
              console.log(todayRecord);
              break;
            }
          }

          console.log('tookAll', tookAll);

          if (!tookAll) {
            break;
          }
        }

        if (tookAll) {
          const lastStreakUpdate = profile.streakLastUpdate;
          const yesterday = new Date(new Date().setHours(0, 0, 0, 0) - 24*3600000);
          if (lastStreakUpdate < yesterday) {
            console.log(`last streak update was too long ago`);
            profile.streak = 0;
          } else {
            if (!profile.streak) {
              profile.streak = 0;
            }
            profile.streak += 1;
            conv.add(`Congrats - you took all of your medications today! Your streak is now up to ${profile.streak} days.`)
          }
          await profile.save();
        }

        return;
      }

      const time = await MedicationTime.findOne({ _id: conv.session.params.overdue[0].time })
        .populate({
          path: 'records'
        });
      
      let foundRecord = false;
      for (let i = 0; i < time.records.length; i += 1) {
        const record = time.records[i];

        const recordDateString = new Intl.DateTimeFormat('en-US', {
          timeZone: 'GMT',
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }).format(record.date);
        console.log('looking for record in tookmedication');
        console.log(recordDateString, currDateString);

        if (recordDateString === currDateString) {
          record.taken = true;
          foundRecord = true;
          await record.save();
          break;
        }

      }

      if (!foundRecord) {
        const newRecord = new MedicationRecord({
          date: currDateString,
          taken: true
        });
  
        const savedRecord = await newRecord.save();

        time.records.push(savedRecord);
      }
      
      await time.save();

      conv.session.params.overdue.shift();

      await checkStreak();

      return;
    });

    webhookApp.handle('didnottakemedication', async (conv) => {
      const timezone = conv.device.timeZone.id;
      const currDateString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      }).format(new Date());

      const checkStreak = async () => {
        const profile = await Profile.findOne({ _id: conv.user.params.profile })
          .populate([{
            path: 'medications',
            populate: [{
              path: 'times',
              populate: [{
                path: 'records'
              }]
            }]
          }]);
        
        let tookAll = true;
        
        for (let i = 0; i < profile.medications.length; i += 1) {
          const medication = profile.medications[i];
          for (let j = 0; j < medication.times.length; j += 1) {
            const time = medication.times[j];
            const todayRecord = time.records.find((record) => {
              const recordDateString = new Intl.DateTimeFormat('en-US', {
                timeZone: 'GMT',
                month: '2-digit',
                day: '2-digit',
                year: '2-digit'
              }).format(record.date);
              console.log(recordDateString, currDateString);
      
              if (recordDateString === currDateString) {
                return true;
              }
            });

            if (!todayRecord || todayRecord.taken !== true) {
              tookAll = false;
              console.log(`did not take all - ${medication.name}`);
              console.log(todayRecord);
              break;
            }
          }

          if (!tookAll) {
            break;
          }
        }

        if (tookAll) {
          const lastStreakUpdate = profile.streakLastUpdate;
          const yesterday = new Date(new Date().setHours(0, 0, 0, 0) - 24*3600000);
          if (lastStreakUpdate < yesterday) {
            console.log(`last streak update was too long ago`);
            profile.streak = 0;
          } else {
            if (!profile.streak) {
              profile.streak = 0;
            }
            profile.streak += 1;
            conv.add(`Congrats - you took all of your medications today! Your streak is now up to ${profile.streak} days.`)
          }
          await profile.save();
        }

        return;
      }

      const time = await MedicationTime.findOne({ _id: conv.session.params.overdue[0].time })
        .populate({
          path: 'records'
        });
      
      let foundRecord = false;
      time.records.forEach((record) => {
        const recordDateString = new Intl.DateTimeFormat('en-US', {
          timeZone: 'GMT',
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        }).format(record.date);

        if (recordDateString === currDateString) {
          record.taken = false;
        }
      });

      if (!foundRecord) {
        const newRecord = new MedicationRecord({
          date: currDateString,
          taken: false
        });
  
        const savedRecord = await newRecord.save();

        time.records.push(savedRecord);
      }
      
      await time.save();

      conv.session.params.overdue.shift();

      return;
    });

    webhookApp.handle('checkstreak', async (conv) => {
      const profile = await Profile.findOne({ _id: conv.user.params.profile });
        
      const lastStreakUpdate = profile.streakLastUpdate;
      const yesterday = new Date(new Date().setHours(0, 0, 0, 0) - 24*3600000);

      if (lastStreakUpdate < yesterday) {
        console.log(`last streak update was too long ago`);
        profile.streak = 0;
      } else {
        if (!profile.streak) {
          profile.streak = 0;
        }
      }

      conv.add(`Your streak is currently at ${profile.streak} days.`)

      return;
    });

    webhookApp.handle('whatsoverdue', async (conv) => {
      const profile = await Profile.findOne({ _id: conv.user.params.profile })
        .populate([{
          path: 'medications',
          populate: [{
            path: 'times',
            populate: [{
              path: 'records'
            }]
          }]
        }]);

      const overdue = getOverdueMedications(profile, conv);
      const numOverdue = overdue.length;
      if (numOverdue === 0) {
        return conv.add('You\'re not overdue on any medications!');
      }
      let overdueString = '';
      overdue.forEach((medication, index) => {
        if (1 === numOverdue) {
          overdueString += medication.name;
        } else if (index === numOverdue - 1) {
          overdueString += `and ${medication.name}`;
        } else {
          overdueString += `${medication.name}, `;
        }
      });
      conv.add(`You have ${numOverdue} medication${numOverdue > 1 ? 's' : ''} you haven't taken yet - ${overdueString}.`);
    });

    webhookApp.handle('enablereminders', async (conv) => {
      //TOOK_MEDICATION
      const notificationsSlot = conv.session.params['NotificationsSlot_TOOK_MEDICATION'];
      const updateUserId = notificationsSlot.additionalUserData.updateUserId;
      const profile = await Profile.findOne({ _id: conv.user.params.profile });
      profile.wantsNotifications = true;
      profile.notificationUserId = updateUserId;
      profile.save();
    });

    webhookApp.handle('disablereminders', async (conv) => {
      //TOOK_MEDICATION
      //const updateUserId = notificationsSlot.additionalUserData.updateUserId;
      const notificationsSlot = conv.session.params['NotificationsSlot_TOOK_MEDICATION'];
      const profile = await Profile.findOne({ _id: conv.user.params.profile });
      profile.wantsNotifications = false;
      //profile.notificationUserId = updateUserId;
      profile.save();
    });

    setupRoutes(app, webhookApp);

    app.listen(port, () => {
      console.log(`App is listening to ${port}...`);
      console.log('Press Ctrl+C to quit.');
    });
  });