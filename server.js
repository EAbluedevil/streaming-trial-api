const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;

// Authenticate Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1jc_BuWam_WzjS0LUvdBkfg_CLQz82LhCqhW3TtSf65A';
const SHEET_NAME = 'Sheet1';

app.get('/api/streaming-trials', async (req, res) => {
  try {
    const authClient = await auth.getClient();

    const result = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:E`
    });

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      return res.status(200).json({ message: 'No data found' });
    }

    const response = rows.map((row) => ({
      service: row[0],
      trialStatus: row[1],
      trialLastSeen: row[2],
      notes: row[3] || '',
      alertSent: row[4] === 'TRUE'
    }));

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching sheet data:', error);
    res.status(500).json({ error: 'Failed to fetch sheet data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
app.post('/api/alert-trials', async (req, res) => {
  try {
    // Fetch all rows from the Google Sheet
    const result = await sheets.spreadsheets.values.get({
      auth: await auth.getClient(),
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:E`
    });

    const rows = result.data.values;
    const alertPromises = [];

    if (!rows || rows.length === 0) {
      return res.status(200).json({ message: 'No data found to check' });
    }

    rows.forEach((row, i) => {
      const service = row[0];
      const currentStatus = row[1];
      const lastSeen = row[2];
      const alertSent = row[4] === 'TRUE';

      // Check if trial status has changed since the last check
      if (currentStatus === 'Not Available' && !alertSent) {
        // Send an alert if status is 'Not Available' and no alert has been sent
        alertPromises.push(sendAlert(service, lastSeen, currentStatus, i + 2));  // `i + 2` to account for headers
      }
    });

    // Wait for all alert sending to complete
    await Promise.all(alertPromises);

    res.status(200).json({ message: 'Alerts processed successfully' });

  } catch (error) {
    console.error('Error processing alerts:', error);
    res.status(500).json({ error: 'Failed to process alerts' });
  }
});
const nodemailer = require('nodemailer');

async function sendAlert(service, lastSeen, currentStatus, rowIndex) {
  console.log(`sendAlert triggered for ${service} - Row ${rowIndex}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ALERT_EMAIL,
      pass: process.env.ALERT_PASS,
    },
  });

  const mailOptions = {
    from: process.env.ALERT_EMAIL,
    to: process.env.ALERT_EMAIL,
    subject: `${service} Trial Status Update`,
    text: `The trial for ${service} has changed. Last seen: ${lastSeen}. New status: ${currentStatus}.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent for ${service}`);

    await sheets.spreadsheets.values.update({
      auth: await auth.getClient(),
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['true']],
      },
    });

    console.log(`✅ Sheet updated for row ${rowIndex}`);
  } catch (error) {
    console.error(`❌ Error in sendAlert for ${service}:`, error);
  }
}
