
// load enviroment variables in the .env file
// import dotenv from 'dotenv';
// dotenv.config();

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
import functions from 'firebase-functions';
import admin from 'firebase-admin';

import {isValidClientKey, smsVerify} from './twilio/app.mjs';

admin.initializeApp();

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
  
/* ===================================================== *
                PHONE NUMBER VERIFICATION
*  ===================================================== */
export const requestSmsVerification = functions.https.onCall(async (data, context) => {
    const clientSecret = data.client_secret;
    const phone = data.phone;

    // check argument
    if(clientSecret == null || phone == null){
        throw new functions.https.HttpsError('invalid-argument', 'Both client_secret and phone are required.')
    }else if(!isValidClientKey(clientSecret)){
        throw new functions.https.HttpsError('invalid-argument', 'The client_secret parameter does not match.')
    }

    const formattedPhoneNumber = await smsVerify.request(phone);
    return JSON.stringify({seccess: true, formattedPhoneNumber:formattedPhoneNumber});
});

export const verifySmsCode = functions.https.onCall( async (data, context) => {
    const clientSecret = data.client_secret;
    const phone = data.phone;
    const code = data.code;
    const next = data.next;
    
    // check argument
    if(clientSecret == null || phone == null || code == null){
        throw new functions.https.HttpsError('invalid-argument', 'The client_secret, phone and code parameters are required.')
    }else if(!isValidClientKey(clientSecret)){
        throw new functions.https.HttpsError('invalid-argument', 'The client_secret parameter does not match.')
    }

    const result = await smsVerify.verify(phone, code);
    if(!result.success){
        return JSON.stringify({success:false, message:'Unable to validate code for this phone number'});
    } else if(next == "create"){
        return JSON.stringify(await checkCreate(result.formattedPhoneNumber));
    } else if(next == "addnumber"){
        if(context.auth == null){
            return JSON.stringify({success:false, message:'user not authenticated'})
        }else{
            return JSON.stringify(await addNumber(result.formattedPhoneNumber, context.auth.uid))
        }
    } else {
        return JSON.stringify(result);
    }
});


/* ========================================================== *
                    USER AUTHENTICATION
 * ========================================================== */
const checkCreate = async (phone) => {
    // get user
    const phoneOwnerSnapshot = await admin.database().ref(`/phones/${phone}/uid`).once('value');
    if(!phoneOwnerSnapshot.exists()){
        return {success:true, message:'create new', formattedPhoneNumber:phone}
    }
    const userId = phoneOwnerSnapshot.val()
    // get phone numbers registered by user
    const usersPhonesSnapshot = await admin.database().ref(`/users/${userId}/phones`).once('value');
    if(usersPhonesSnapshot.numChildren == 1){
        // logout existing user
        await admin.auth().revokeRefreshTokens(userId);
        const clientId = encryptUserId(userId);
        const token = await admin.auth().createCustomToken(userId);
        return {success:true, 'client_id':clientId, message:'sign in', token:token}
    }
    const phones = usersPhonesSnapshot.val();
    return {success:true, other_phones:phones, message:'import account'}
}

const addNumber = async (phone, newOwnerId) => {
    // get old ownerId
    const oldOwnnerSnapshot = await admin.database().ref(`/phones/${phone}/uid`).once('value');
    let childValues = {}
    if(oldOwnnerSnapshot.exists()){ 
        // logout and remove number
        const oldOwnerId = oldOwnnerSnapshot.val();
        admin.auth().revokeRefreshTokens(oldOwnerId);
        childValues = {
            users:{
                [oldOwnerId]:{phones:{[phone]: null }},
                [newOwnerId]:{phones:{[phone]: true }}},
            phones:{[phone]:{uid:newOwnerId, timeCreated:dbTimestamp()}}
        }
    }else{
        childValues = {
            users:{[newOwnerId]:{phones:{[phone]: true }}},
            phones:{[phone]:{uid:newOwnerId, timeCreated:dbTimestamp()}}
        }
    }
    await admin.database().ref().update(childValues);
    return {success:true, message:'Number added', formattedPhoneNumber:phone}
}


const encryptUserId = (userId, time=0, device=0) => {
    if(time == 0) time = Date.now();
    return userId + ':' + time;
}

export const createUserAccount = functions.https.onCall(async (data, context) => {
    if(context.auth == null){
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
            'while authenticated.');
    }
    const phone = data.phone
    const userId = context.auth.uid;

    // check argument
    if(phone == null){
        throw new functions.https.HttpsError('invalid-argument', 'Phone parameters is required.')
    }
    const msgSignId = (await admin.database().ref('/usersMessageSign').push()).key
    const childValues = {
        phones: {[phone]:{uid:userId, timeCreated:dbTimestamp()}},
        users:{[userId]:{accessTime:dbTimestamp(),msgSignId:msgSignId,phones:{[phone]:true}}}
    }
    console.log(childValues);
    await admin.database().ref().update(childValues)

    const clientId = encryptUserId(userId)
    console.log('created data for uid:', userId);
    return JSON.stringify({success:true, 'client_id':clientId})
});

export const importUserAccount = functions.https.onCall((data, context) => {
    if(!context.auth){
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called ' +
            'while authenticated.');
    }
    const clientId = encryptUserId(context.auth.uid)
    return JSON.stringify({success:true, client_id:clientId})
})

const dbTimestamp = () => {
    return {'.sv':'timestamp'};
}