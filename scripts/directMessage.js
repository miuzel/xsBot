// This is a tool script for the admin to add / delete role to all guild members in a batch.

// Extract the required classes from the discord.js module
const { Client } = require('discord.js');
const { config } = require('../settings');
// Create an instance of a Discord client
const client = new Client();
const token = config.token;
// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);
const [guildName,userName,text] = process.argv.slice(2);
process.setMaxListeners(0)

client.on('ready',  () => {
    console.log(`I am ready! push DM to ${userName}`);
    let guild = client.guilds.find(guild => guild.name === guildName)
    if (guild) {
            guild.fetchMembers().then(g => {
                let count = 0
                let countdown = ()=>{
                    count++
                    if(count>=g.members.size){
                        console.log(g.members.size + " users sent.")
                        console.log("Done")
                        client.destroy()
                    }
                }
                if(userName === "@everyone"){
                    g.members.forEach(m => {
                        m.send(text).then(countdown).catch((e) => {
                            console.error("error send msg to "+ m.user.username)
                            console.error(e)
                        })
                        console.log(`Sent msg to ${m.user.username}#${m.user.discriminator}`)
                    })
                } else {
                    m = g.members.find(m => m.user.username === userName)
                    if (m && client.user.id !== m.user.id){
                        m.send(text).then(()=> {
                            console.log(`Sent msg to ${m.user.username}#${m.user.discriminator}`)
                            client.destroy()
                        }).catch((e) => {
                            console.error("error send msg to "+ m.user.username)
                            console.error(e)
                        })
                    } else {
                        console.log("no user "+userName +" found")
                        client.destroy()
                    }
                }
            })
            .catch(console.error);

    } else {
        console.log("no such guild " + guildName )
        client.destroy()
    }

    
  });