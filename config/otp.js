import 'dotenv/config';
import sgMail from '@sendgrid/mail'; 
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


export default async function sendOtp(x, recipient) {

  try {
    console.log("Sending OTP to:", recipient);
   let message = `message Thanks for believing in us, ${x} is your OTP for verification. Welcome to the codeDEV we believe your experience with our application will be good.`;
    
  await sgMail.send({
  to: recipient, 
  from: process.env.FROM_EMAIL,
  subject: 'OTP form codeDEV',
  text: `   Thanks for beliving in us, ${x} is your OTP for verification. 
            Welcome to the codeDEV we belive your experience with our application will good `,
            
  html: `<strong>${message}</strong>`,
});

    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Notification Error:', error.response?.body || error.message || error);
    return false;
  }
};