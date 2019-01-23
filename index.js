require('dotenv').config();
var express = require('express');
var Airtable = require('airtable');
var base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_KEY);
var axios = require('axios');
var expressApp = express();
var router = express.Router();

expressApp.use(express.urlencoded({ extended: false }));
expressApp.use(express.json());

/**
 * A Bot for Slack!
 */

/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({ user: installer }, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({ mongoUri: process.env.MONGOLAB_URI }),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN) ? './db_slack_bot_ci/' : './db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */



router.post('/quote', (req, res) => {
    if (req.body.quote) {
        base('Quotes').create({
            "quote": req.body.quote
        }, function (err, record) {
            if (err) { console.error(err); return; }
            console.log(record.getId());            
            res.send('quote added!');
        });
    } else {
        res.send('no quote specified');
    }
});

router.get('/list', (req, res) => {
    getQuotes((quotes) => {
        res.json(quotes);
    });
});

router.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>bill-bot</title>
    </head>
    <body>
    <form action="/quote" method="POST">
        New Quote:<br>
        <input type="text" name="quote" placeholder="Enter something Bill says...">                
        <br><br>
        <input type="submit" value="Submit">
    </form> 
    </body>
    </html>`;
    res.send(html);
});

expressApp.use('/', router);

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "What do you want???")
});

controller.hears('gateway', 'ambient,message_received', function (bot, message) {
    bot.reply(message, 'DRISCOLLLLLLL!!!');
});
controller.hears('pointing', 'ambient,message_received', function (bot, message) {
    var pointing = 
    `UGHHHH, you guys...
    1 = 1 hour 
    2 = 2 to 4 hours
    3 = 5 to 8 hours
    5 = 2-4 days 
    8 = 5 or more days/1 week or more
    13 = 1 sprint/10 days
    20 = PBI needs to be broken down more`;
    bot.reply(message, pointing);
});

controller.hears(['think', 'idea', 'why', 'like', 'problem', 'help', 'what'], 'direct_mention,mention,direct_message', function (bot, message) {
    getQuotes((quotes) => {        
        bot.reply(message, quotes[Math.floor(Math.random() * quotes.length)]);
    });
});

function getQuotes(cb) {
    var tempQuotes = [];
    base('Quotes').select({
        maxRecords: 300,
        view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {
        records.forEach(function (record) {
            tempQuotes.push(record.get('quote'));
            console.log('Retrieved', record.get('Name'));
        });
        fetchNextPage();
    }, function done(err) {
        if (err) { console.error(err); return; }
        cb(tempQuotes);
    });
}

/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
controller.on('direct_message,mention,direct_mention', function (bot, message) {
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function (err) {
        if (err) {
            console.log(err)
        }
        bot.reply(message, 'What do you want???');
    });
});

expressApp.listen(process.env.PORT, function () {
    console.log('started bill-bot');
});