const { google } = require('googleapis') // This package provides a Node.js client library for accessing the Google APIs.
const express = require('express'); // This package provides a web framework for building APIs.
const nodemailer = require('nodemailer'); // This package allows us to send email replies.
const dotenv = require('dotenv') // This package helps in storing environment variables which hold sensitive information

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URL = 'localhost:3000/';
const SCOPES =  ['https://www.googleapis.com/auth/gmail.modify'];

// For 45-120sec repetition
const INTERVAL_MIN = 45*1000;
const INTERVAL_MAX = 120*1000;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

dotenv.config();
const app = express();


app.get('/login', (req,res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })

    res.redirect(authUrl);
})

app.get('/oauth2callback', (req, res) => {
    const { code } = req.query;

    oAuth2Client.getToken(code, (err, token) => {
        if (err) {
            console.error('Error retrieving access token', err);
            return res.send('Error retrieving access token');
          }
      
          oAuth2Client.setCredentials(token);
          console.log('Access token successfully retrieved');
      
          // Start fetching emails
          setInterval(fetchEmails, getRandomInterval());
          res.send('Access token successfully retrieved');
    });
});

// Check for new emails in a given Gmail ID
function fetchEmails() {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    gmail.users.messages.list(
        {
            userId: 'me',
            q: 'is:inbox',
            maxResults: 10,
        }, (err, res) => {
            if(err) return console.log('The API returned an error: ' + err);

            const messages = res.data.messages;

            if(messages.length) {
                messages.forEach((message) => {
                    console.log(message.id)
                    gmail.users.messages.get(
                        {
                            userId: 'me',
                            id: message.id,
                            format: 'full',
                        }, (err, res) => {
                            if (err) return console.log('The API returned an error: ' + err);
              
                            const headers = res.data.payload.headers;
                            const threadId = res.data.threadId;
                            const hasReply = headers.some((header) => header.name === 'In-Reply-To');
              
                            if (!hasReply) {
                              sendReply(res.data);
                            }
              
                            labelEmail(threadId);
                          }
                    );
                });
            } else {
                console.log('No messages found.');
            }
        }
    );
}

// Send replies to Emails that have no prior replies
function sendReply(message) {
    const transport = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
            type: 'OAuth2',
            user: 'me',
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: oAuth2Client.credentials.refresh_token,
            accessToken: oAuth2Client.credentials.access_token,
            expires: oAuth2Client.credentials.expiry_date,
      },
    });
  
    const mailOptions = {
        to: message.payload.headers.find((header) => header.name === 'From').value,
        subject: 'NOT Available',
        text: 'Thank you for your email. I am currently out of office and will not be able to respond to your message. I will get back to you as soon as possible after my return.',
    };
  
    transport.sendMail(mailOptions, (err, info) => {
        if (err) {
        console.log('Error occurred while sending email: ', err.message);
        return;
        }
        console.log('Email sent successfully: ', info.messageId);
    });
}

// Adding label to the email and moving the email to the label
function labelEmail(threadId) {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    gmail.users.threads.modify(
    {
        userId: 'me',
        id: threadId,
        resource: {
        addLabelIds: ['Vacation Autoresponse'],
        },
    },
    (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        console.log('Email labeled successfully');
    });
}

//This will help in repeating this sequence of steps 1-3 in random intervals of 45 to 120 seconds
function getRandomInterval() {
    return Math.floor(Math.random() * (INTERVAL_MAX - INTERVAL_MIN) + INTERVAL_MIN);
}

app.get('/' , ( req, res ) => {
    res.send('Working')
})
//Starting our app
app.listen(process.env.PORT, () => {
    console.log('Server listening on http://localhost:3000');
});


// Here are some suggestions to improve the code:

// Use environment variables to store the sensitive information like client ID and client secret instead of hardcoding them in the code.
// Implement error handling for all the API calls to handle the errors gracefully and to avoid crashing the application.
// Use a template engine like Handlebars to generate dynamic email templates instead of hardcoding the email content.
// Implement unit tests and integration tests to test the code and to ensure that the code is working as expected.
// Use a job scheduler like node-cron to run the email fetching and sending logic at a specific interval instead of using setInterval.
// Implement rate limiting to avoid hitting the Gmail API rate limits and to prevent overloading the server.
// Use TypeScript instead of plain JavaScript to add type safety to the code and to catch potential errors at compile time.