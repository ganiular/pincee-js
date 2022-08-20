
// import dotenv from 'dotenv'
// const {config} = dotenv;
// config()
// require('dotenv').load();
// Twilio Library
import Twilio from 'twilio';

// Check configuration variables
if (process.env.TWILIO_API_KEY == null ||
    process.env.TWILIO_API_SECRET == null ||
    process.env.TWILIO_ACCOUNT_SID == null ||
    process.env.VERIFICATION_SERVICE_SID == null ||
    process.env.COUNTRY_CODE == null) {
console.log('Please copy the .env.example file to .env, ' +
                    'and then add your Twilio API Key, API Secret, ' +
                    'and Account SID to the .env file. ' +
                    'Find them on https://www.twilio.com/console');
process.exit();
}

if (process.env.APP_HASH == null) {
    console.log('Please provide a valid Android app hash, ' +
                'in the .env file');
    process.exit();
}

if (process.env.CLIENT_SECRET == null) {
    console.log('Please provide a secret string to share, ' +
                'between the app and the server ' +
                'in the .env file');
    process.exit();
}

const configuredClientSecret = process.env.CLIENT_SECRET;

// Initialize the Twilio Client
const twilioClient = new Twilio(process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    {accountSid: process.env.TWILIO_ACCOUNT_SID});

import SMSVerify from './SMSVerify.mjs';

// module.exports['smsVerify'] = new SMSVerify(...)
export const smsVerify = new SMSVerify(twilioClient,
    process.env.APP_HASH,
    process.env.VERIFICATION_SERVICE_SID,
    process.env.COUNTRY_CODE);

// module.exports['isValidClientKey'] = (clientSecret) => {
//     return configuredClientSecret == clientSecret;
// }
export const isValidClientKey = (clientSecret) => {
    return configuredClientSecret == clientSecret;
}
