const https = require('https');
const mongoose = require('mongoose');
const { auth: gAuth } = require('google-auth-library');
const Profile = require('./models/profile.model');
const Medication = require('./models/medication.model');
const MedicationTime = require('./models/medicationTime.model');
const MedicationRecord = require('./models/medicationRecord.model');

mongoose.connect('mongodb://127.0.0.1:27017/macy')
  .catch(console.error)
  .then(async () => {
    const notifProfiles = await Profile.find({ wantsNotifications: true })
      .populate([{
        path: 'medications',
        populate: [{
          path: 'times'
        }]
      }]);
    for (let i = 0; i < notifProfiles.length; i += 1) {
      const profile = notifProfiles[i];
      for (let j = 0; j < profile.medications.length; j += 1) {
        const medication = profile.medications[j];
        for (let k = 0; k < medication.times.length; k += 1) {
          const time = medication.times[k];
          const yesterday = new Date(new Date().getTime() - 24*3600000);
          if (!time.lastNotification || time.lastNotification < yesterday) {
            console.log(`Don't forget to take your ${medication.name}!`, profile.notificationUserId);
            await doNotification(`Don't forget to take your ${medication.name}!`, profile.notificationUserId);
          }
        }
      }
    }
    mongoose.disconnect();
  });

const doNotification = async function doNotification(text, userId) {
  const client = gAuth.fromJSON(require('./service-account.json'));
  client.scopes = ['https://www.googleapis.com/auth/actions.fulfillment.conversation'];
  const notification = {
    userNotification: {
      title: text,
    },
    target: {
      userId: userId,
      intent: 'Notifications Intent',
    },
  };

  const accesstoken = await client.getAccessToken();

  console.log(accesstoken);

  const res = await client.request({
    url: 'https://actions.googleapis.com/v2/conversations:send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accesstoken.token}`
    },
    data: {'customPushMessage': notification, 'isInSandbox': true}
  });
  console.log(res.data);
};
