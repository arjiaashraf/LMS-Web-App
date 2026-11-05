
require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function testEmail() {
  try {
    await transporter.verify();
    console.log("✅ Gmail SMTP connected successfully!");

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER,
      subject: "Campus 95 LMS - Email Test",
      text: "Congratulations! Campus 95 real email system is working."
    });

    console.log("✅ Test email sent!");
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("❌ Email test failed:", error.message);
  }
}

testEmail();
