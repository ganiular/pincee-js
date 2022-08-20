const phoneRe = /^\+[1-9]\d{10,14}$/

// module.exports['f'] = () => {console.log("f called")}
function SMSVerify(twilioClient, appHash, verificationServiceSID, countryCode) {
  this.twilioClient = twilioClient;
  this.appHash = appHash;
  this.verificationServiceSID = verificationServiceSID;
  this.countryCode = countryCode;
};

export default SMSVerify;

SMSVerify.prototype.isE164Number = (phone) => {
  return phoneRe.test(phone);
}

//TODO: make as promise
SMSVerify.prototype.getE164Number = async function(phone) {
  if (this.isE164Number(phone)){
    return phone;
  }
  if(process.env.NODE_ENV == 'development') return '+234' + phone.substring(1);
  const lookupResult = await this.twilioClient.lookups.phoneNumbers(phone)
      .fetch({countryCode: this.countryCode});
  return lookupResult.phoneNumber;
};

//TODO: make as promise
SMSVerify.prototype.request = async function(phone) {
  console.log('Requesting verification SMS to be sent to ' + phone);
  const formattedPhoneNumber = await this.getE164Number(phone);
  if(process.env.NODE_ENV == 'development') return formattedPhoneNumber;
  const verification = await this.twilioClient.verify.services(this.verificationServiceSID)
      .verifications.create({
          to: formattedPhoneNumber,
          channel: 'sms',
          appHash: this.appHash,
        });
  console.log("verification_sid sent to phone "+formattedPhoneNumber+" is:", verification.sid);
  return formattedPhoneNumber;
};

SMSVerify.prototype.verify = async function(phone, code) {
  console.log('Verifying phone ' + phone + ' with code: ' + code);
  const formattedPhoneNumber = await this.getE164Number(phone);
  if(process.env.NODE_ENV == 'development') 
      return {success:true, formattedPhoneNumber:formattedPhoneNumber};
  const verificationCheck = await this.twilioClient.verify.services(this.verificationServiceSID)
        .verificationChecks
        .create({to: formattedPhoneNumber, code: code});
  return {success: verificationCheck.status == 'approved', formattedPhoneNumber:formattedPhoneNumber};
};

SMSVerify.prototype.reset = function(phone) {
  console.log('Resetting code for:  ' + phone);
  // Not needed for Verify
  return true;
};
