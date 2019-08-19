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
                let failed = 0
                let countdown = size => () => {
                    count++
                    if(count>=size){
                        console.log(count + " users updated. " + failed +" users failed.")
                        console.log("Done")
                        client.destroy()
                    }
                }
                let handleErr = m => e => {
                    failed++
                    console.log("error add role to "+m.user.username)
                    console.log(e.message)
                }
                g.members.array().forEach((m, i) => {
                    setTimeout(() => {
                        console.log(`Update role ${roleName} for ${m.user.username}#${m.user.discriminator}`)
                        if (addDelete === 'delete') {
                            m.removeRole(role).catch(console.error).finally(countdown(g.members.size))
                        } else {
                            m.addRole(role).catch(console.error).finally(countdown(g.members.size))
                        }
                    }, 50 * i)
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