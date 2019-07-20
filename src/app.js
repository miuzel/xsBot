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
  let result = await runDialogFlow(m.author.id,m.content.trim().substr(4),gProject)
  if(result){
    m.channel.send(result.response);
  }
}

var isMine = m => {
  return m.content.trim().toLowerCase().startsWith(prefix) || 
  (m.mentions.users.first() && m.mentions.users.first().username === myUsername);
} 

client.on('message', message => {
  // If the message is "how to embed"
  if (isMine(message)) {
    tryDialog(message);
  }
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);


