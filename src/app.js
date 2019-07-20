/**
 * An example of how you can send embeds
 */

// Extract the required classes from the discord.js module
import { Client, RichEmbed } from 'discord.js';
import { token } from '../settings';
import { exists } from 'fs';
import runDialogFlow from './helpers/dialogBot';
// Create an instance of a Discord client
const client = new Client();


/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready',  () => {
  console.log('I am ready!');
});

client.on('message', message => {
  // If the message is "how to embed"
  if (message.content === 'how to embed') {
    // We can create embeds using the MessageEmbed constructor
    // Read more about all that you can do with the constructor
    // over at https://discord.js.org/#/docs/main/stable/class/RichEmbed
    const embed = new RichEmbed()
      // Set the title of the field
      .setTitle('A slick little embed')
      // Set the color of the embed
      .setColor(0xFF0000)
      // Set the main content of the embed
      .setDescription('Hello, this is a slick embed!');
    // Send the embed to the same channel as the message
    message.channel.send(embed);
  } else if (message.content.trim().toLowerCase().startsWith('xsjj')) {
    
    let tryDialog = async m => {
      let result = await runDialogFlow(m.author.id,m.content.trim().substr(4),'xsbot-wgmlfx')
      console.log(result)
      m.channel.send(result.response);
    }
    tryDialog(message);
  }


});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);


