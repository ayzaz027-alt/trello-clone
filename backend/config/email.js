const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service error:', error);
  } else {
    console.log('✅ Email service ready');
  }
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Trello Clone" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      text,
      html
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

// Email Templates
const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to Trello Clone!',
    html: `
      <h1>Welcome ${name}!</h1>
      <p>Thank you for joining Trello Clone. Start organizing your tasks today!</p>
      <a href="${process.env.FRONTEND_URL}" style="background: #0079BF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
    `
  }),
  
  boardInvitation: (boardName, inviterName, boardId) => ({
    subject: `You've been invited to ${boardName}`,
    html: `
      <h2>Board Invitation</h2>
      <p><strong>${inviterName}</strong> has invited you to join the board <strong>${boardName}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/boards/${boardId}" style="background: #0079BF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Board</a>
    `
  }),
  
  cardAssigned: (cardTitle, boardName, assignerName, cardId) => ({
    subject: `You've been assigned to a card`,
    html: `
      <h2>Card Assignment</h2>
      <p><strong>${assignerName}</strong> assigned you to the card <strong>${cardTitle}</strong> in <strong>${boardName}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/cards/${cardId}" style="background: #0079BF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Card</a>
    `
  }),
  
  dueDateReminder: (cardTitle, dueDate, cardId) => ({
    subject: `Card Due Date Reminder`,
    html: `
      <h2>⏰ Due Date Reminder</h2>
      <p>The card <strong>${cardTitle}</strong> is due on <strong>${new Date(dueDate).toLocaleDateString()}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/cards/${cardId}" style="background: #EB5A46; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Card</a>
    `
  }),
  
  commentNotification: (cardTitle, commenterName, comment, cardId) => ({
    subject: `New comment on ${cardTitle}`,
    html: `
      <h2>💬 New Comment</h2>
      <p><strong>${commenterName}</strong> commented on <strong>${cardTitle}</strong>:</p>
      <blockquote style="background: #f4f5f7; padding: 10px; border-left: 3px solid #0079BF; margin: 10px 0;">${comment}</blockquote>
      <a href="${process.env.FRONTEND_URL}/cards/${cardId}" style="background: #0079BF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Card</a>
    `
  }),
  
  passwordReset: (resetToken) => ({
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}" style="background: #0079BF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  })
};

module.exports = { sendEmail, emailTemplates };
