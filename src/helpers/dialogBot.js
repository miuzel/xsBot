import dialogflow  from 'dialogflow';
import uuid  from 'uuid';
import bunyan from 'bunyan';

var sessions = new Map();
var log = bunyan.createLogger({name: "xsBot"});
async function runDialogFlow(userId = 'default',message = '',projectId = 'xsbot-wgmlfx') {
    // A unique identifier for the given session
    var sessionId
    if (sessions.get(userId)) {
        sessionId = sessions.get(userId)
    } else {
        sessionId = uuid.v4();
        sessions.set(userId,sessionId);
    }
    // Create a new session
    let sessionClient = await new dialogflow.SessionsClient();
    let sessionPath = sessionClient.sessionPath(projectId, sessionId);

    // The text query request.
    let request = {
        session: sessionPath,
        queryInput: {
        text: {
            // The query to send to the dialogflow agent
            text: message,
            // The language used by the client (en-US)
            languageCode: 'zh-CN',
        },
        },
    };

    // Send request and log result
    try {
        let responses = await sessionClient.detectIntent(request);
        let result = responses[0].queryResult;
        log.debug(`  Query: ${result.queryText}`);
        log.debug(`  Response: ${result.fulfillmentText}`);
        if (result.intent) {
            log.debug(`  Intent: ${result.intent.displayName}`);
        } else {
            log.debug(`  No intent matched.`);
        }
        if (result.fulfillmentText){
            return {
                response: result.fulfillmentText,
                intent: result.intent
            }
        }
    } catch (err) {
        log.error(err);
    }
    log.warn(`  No intent matched.`);
}
module.exports = runDialogFlow;