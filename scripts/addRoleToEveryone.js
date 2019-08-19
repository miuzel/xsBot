// This is a tool script for the admin to add / delete role to all guild members in a batch.

// Extract the required classes from the discord.js module
const { Client } = require('discord.js');
const { config } = require('../settings');
// Create an instance of a Discord client
const client = new Client();
const token = config.token;
// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);
const [guildName,roleName,addDelete] = process.argv.slice(2);
process.setMaxListeners(0)

client.on('ready',  () => {
    console.log(`I am ready! Updating role ${roleName} of members in ${guildName}`);
    let guild = client.guilds.find(guild => guild.name === guildName)
    if (guild) {
        let role = guild.roles.find(role => role.name === roleName)
        if (role){
            guild.fetchMembers().then(g => {
                let count = 0
                g.members.forEach(m => {
                    addDelete === 'delete'? m.removeRole(role).catch(console.error) : m.addRole(role).catch(console.error)
                    console.log(`role ${roleName} updated for ${m.user.username}#${m.user.discriminator}`)
                    count++
                    if(count>=g.members.size){
                        console.log("Done")
                        client.destroy()
                    }
                })
            })
            .catch(console.error);
        } else {
            console.log("no such role " + roleName)
            client.destroy()
        }

    } else {
        console.log("no such guild " + guildName )
        client.destroy()
    }

    
  });