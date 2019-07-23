/**
 * An example of how you can send embeds
 */

// Extract the required classes from the discord.js module
import { Client } from 'discord.js';
import { config } from '../settings';
import runDialogFlow from './helpers/dialogBot';
import bunyan from 'bunyan';
import task from './tasks/ytlivenotify';
import Keyv from 'keyv';

var log = bunyan.createLogger({name: "xsBot"});
// Create an instance of a Discord client
const client = new Client();
const keyv = new Keyv(`sqlite://${config.kv}`);
const prefix = config.prefix;
const gProject = config.gProject;
const token = config.token;
const myUsername = config.myUsername;


keyv.on('error', err => log.error('Keyv connection error:', err));

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received fr
 * om Discord
 */
client.on('ready',  () => {
  log.info('I am ready!');
  // var tasks = ['ytlivenotify','ytmailnotify','ytcrawlernotify']//
  var tasks = ['ytcrawlernotify','ytmailnotify']
  for (var t of tasks ){
    var task = require(`./tasks/${t}`)
    task.start(config.tasks[task.name],client,keyv);
  }
});

var tryDialog = async m => {
  let result = await runDialogFlow(m.author.id,m.content,gProject)
  if(result){
    await m.channel.send(result.response);
  }
}

var msgToMe = m => {
  const trimed = m.content.trim().toLowerCase();
  if( trimed.startsWith(prefix)){
    return m.content.trim().slice(prefix.length).trim()
  }
  if( trimed.startsWith(myUsername)){
    return m.content.trim().slice(myUsername.length).trim()
  }
  if( m.channel.type === "dm"){
    return m.content.trim()
  }
  const matches = trimed.match(/^(<@!?\d+>)/);
  if( matches && m.mentions.users.first() && m.mentions.users.first().username === myUsername){
    return trimed.slice(matches[1].length).trim()
  }
  return false;
} 

client.on('message', async message => {
  // If the message is "how to embed"
  const msg = msgToMe(message);
  if (msg) {
    message.channel.startTyping();
    message.content = msg;
    await tryDialog(message);
    message.channel.stopTyping();
  }
});


// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);

