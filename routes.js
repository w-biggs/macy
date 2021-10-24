const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user.model');
const Profile = require('./models/profile.model');
const Medication = require('./models/medication.model');
const MedicationTime = require('./models/medicationTime.model');
const MedicationRecord = require('./models/medicationRecord.model');

const getOverdueMedications = function getOverdueMedications(profile) {
  const overdueMedicationTimes = [];

  const currTimeString = new Intl.DateTimeFormat('en-US', {
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
  
  const currDateString = new Intl.DateTimeFormat('en-US', {
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
            time: time.time
          });
        }
      }
    });
  });

  return overdueMedicationTimes;
};

const findOverdues = async function findOverdues(userId) {
  const user = await User.findOne({ _id: userId })
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

  const overdues = user.profiles.map((profile) => {
    return {
      name: profile.name,
      overdue: getOverdueMedications(profile)
    }
  });

  return overdues;
};

/**
 * Route for /
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const indexRoute = async function indexRoute(req, res) {
  if (!req.user) {
    res.redirect('/login');
  } else {
    const overdues = await findOverdues(req.user._id);
    res.render('index', { user: req.user, overdues });
  }
};

/**
 * Route for /profiles
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const profilesRoute = async function profilesRoute(req, res) {
  if (!req.user) {
    return res.redirect('/login');
  }

  const user = await User.findOne({ _id: req.user._id })
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
    return res.send('something weird happened... no user was found with your user id');
  }

  const dates = new Array(7);
  for (let l = 0; l < dates.length; l += 1) {
    const date = new Date(new Date().setHours(0, 0, 0, 0) - ((6 - l) * (24*3600000)));
    const dateString = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' }).format(date);
    dates[l] = dateString;
  }
  

  const todayTimestamp = new Date().setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < user.profiles.length; i += 1) {
    const profile = user.profiles[i];
    for (let j = 0; j < profile.medications.length; j += 1) {
      const medication = profile.medications[j];
      for (let k = 0; k < medication.times.length; k += 1) {
        const time = medication.times[k];
        const days = new Array(7);
        for (let l = 0; l < time.records.length; l += 1) {
          const record = time.records[l];
          const timestamp = record.date.getTime();
          const daysAgo = Math.floor((todayTimestamp - timestamp) / (24*3600000));
          if (daysAgo < 7) {
            days[6 - daysAgo] = record.taken ? '✔️' : '❌';
          }
        }
        for (let l = 0; l < days.length; l += 1) {
          if (!days[l]) {
            days[l] = '--';
          }
        }
        time.days = days;
      }
    }
  }

  //61745f95a1c94c819e56bfb7
  return res.render('profiles', { user: req.user, userDoc: user, dates });
};

/**
 * Route for /login
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const loginRoute = async function loginRoute(req, res) {
  if (req.user) {
    res.redirect('/');
  } else {
    res.render('login', { user: req.user });
  }
};

/**
 * Route for /save
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const saveRoute = async function saveRoute(req, res) {
  const { type } = req.params;
  try {
    switch (type) {
      case 'medication':
        if (req.body.medId) {
          const medication = await Medication.findById(req.body.medId);
          if (!medication) {
            return res.send({
              error: 'medId invalid.'
            });
          }
          medication.name = req.body.name;
          const medicationTime = await MedicationTime.findOne({ _id: medication.times[0] });
          if (!medicationTime) {
            const newMedicationTime = new MedicationTime({
              time: req.body.time
            });
            const savedMT = await newMedicationTime.save();
            medication.times.push(savedMT._id);
          } else {
            medicationTime.time = req.body.time;
            const savedMT = await medicationTime.save();
            console.log(savedMT);
          }
          const savedM = await medication.save();
          console.log(savedM);
        } else {
          const profile = await Profile.findById(req.body.profileId);
          if (!profile) {
            return res.send({
              error: 'profileId invalid.'
            });
          }
          const medicationTime = new MedicationTime({
            time: req.body.time
          });
          const savedMT = await medicationTime.save();
          const medication = new Medication({
            name: req.body.name,
            times: [
              savedMT._id
            ]
          });
          const savedM = await medication.save();
          console.log(savedM);
          profile.medications.push(savedM._id);
          const savedP = await profile.save();
        }
        return res.send({
          success: true
        });
      case 'profile':
        const user = await User.findOne({ _id: req.body.userId });

        if (!user) {
          return res.send({
            error: 'userId invalid.'
          });
        }

        const profile = new Profile({
          name: req.body.name,
          medications: [],
          streak: 0
        });

        const savedP = await profile.save();

        user.profiles.push(savedP._id);

        await user.save();

        return res.send({
          success: true
        });
      default:
        return res.send({
          error: 'Save type unknown.'
        });
    }
  } catch (error) {
    console.log(error);
    return res.send(error);
  }
};

/**
 * Route for /delete
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const deleteRoute = async function deleteRoute(req, res) {
  const { type } = req.params;
  try {
    switch (type) {
      case 'medication':
        const medication = await Medication.findOne({ _id: req.body.medId })
          .populate([{
            path: 'times',
            populate: [{
              path: 'records'
            }]
          }]);

        if (!medication) {
          return res.send({
            error: 'medId invalid.'
          });
        }

        for (let i = 0; i < medication.times.length; i += 1) {
          const time = medication.times[i];
          for (let j = 0; j < time.records.length; j += 1) {
            const record = time.records[j];
            await MedicationRecord.findOneAndDelete({ _id: record._id });
          }
          await MedicationTime.findOneAndDelete({ _id: time._id });
        }
        await Medication.findOneAndDelete({ _id: medication._id });

        const profile = await Profile.findOne({ _id: req.body.profileId });
        profile.medications = profile.medications.filter((medication) => {
          return !medication.equals(req.body.medId);
        });

        break;
      default:
        return res.send({
          error: 'Delete type unknown.'
        });
    }
    return res.send({
      success: true
    });
  } catch (error) {
    console.log(error);
    return res.send(error);
  }
};

/**
 * Sets up the express routes.
 * @param {import('express').Express} app The express instance.
 * @param {import('@assistant/conversation').conversation} webhookApp The conversation instance.
 */
const setupRoutes = function setupExpressRoutes(app, webhookApp) {
  app.get('/', indexRoute);
  app.get('/login', loginRoute);
  app.get('/profiles', profilesRoute);
  app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });
  app.post('/save/:type', express.json(), saveRoute);
  app.post('/delete/:type', express.json(), deleteRoute);
  app.post('/webhook/', express.json(), webhookApp);
};

module.exports = setupRoutes;