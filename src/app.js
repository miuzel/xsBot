/**
 * An example of how you can send embeds
 */

// Extract the required classes from the discord.js module
import { Client, RichEmbed } from 'discord.js';
import { token,gProject,prefix,myUsername} from '../settings';
import { exists } from 'fs';
import runDialogFlow from './helpers/dialogBot';
import bunyan from 'bunyan';
// Create an instance of a Discord client
const client = new Client();
var log = bunyan.createLogger({name: "xsBot"});
/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received fr
 * om Discord
 */
client.on('ready',  () => {
  log.info('I am ready!');
});

var tryDialog = async m => {
  let result = await runDialogFlow(m.author.id,m.content,gProject)
  if(result){
    m.channel.send(result.response);
  }
}

var msgToMe = m => {
  const trimed = m.content.trim().toLowerCase();
  if( trimed.startsWith(prefix)){
    return m.content.trim().slice(prefix.length).trim()
  }
  const matches = trimed.match(/^(<@!?\d+>)/);
  if( matches && m.mentions.users.first() && m.mentions.users.first().username === myUsername){
    return trimed.slice(matches[1].length).trim()
  }
  return false;
} 

client.on('message', message => {
  // If the message is "how to embed"
  const msg = msgToMe(message);
  if (msg) {
    message.content = msg;
    tryDialog(message);
  }
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);


