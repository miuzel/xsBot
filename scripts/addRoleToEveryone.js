// This is a tool script for the admin to add / delete role to all guild members in a batch.

// Extract the required classes from the discord.js module
const { Client } = require('discord.js');
const { config } = require('../settings');
const async = require("async");
const Keyv = require('keyv');
// Create an instance of a Discord client
const client = new Client();
const token = config.token;
// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token);
const [guildName,roleName,addDelete,concurrent,taskid] = process.argv.slice(2);
process.setMaxListeners(0)
const keyv = new Keyv(`sqlite://./script.db`);

client.on('ready',() => {
    console.log(`I am ready! Updating role ${roleName} of members in ${guildName}`);
    let guild = client.guilds.find(guild => guild.name === guildName)
    if (guild) {
        let role = guild.roles.find(role => role.name === roleName)
        if (role){
            guild.fetchMembers().then(g => {
                let count = 0
                let failed = 0
                let countdown = (m,size) => {
                    count++
                    console.log("[DONE]"+m.user.username)
                    if(count>=size){
                        console.log(count + " users updated. " + failed +" requests failed.")
                        console.log("Done")
                        client.destroy()
                    }
                }
                let handleErr = (m,e) => {
                    failed++
                    console.log("error update role to "+m.user.username)
                    console.log(e.message)
                }

                async.mapLimit(g.members.array(),concurrent, async m => {
                    const taskKey = `script#${m.user.id}#role#${taskid}`
                    let done = await keyv.get(taskKey) 
                    let fails = 0
                    while (!done && fails < 5){
                        if (addDelete === 'delete') {
                            console.log(`Del role ${roleName} for ${m.user.username}#${m.user.discriminator}`)
                            try {
                                await m.removeRole(role)
                                done = true
                                await keyv.set(taskKey,true) 
                            } catch (e){
                                fails++
                                handleErr(m,e)
                            }
                        } else {
                            console.log(`Add role ${roleName} for ${m.user.username}#${m.user.discriminator}`)
                            try {
                                await m.addRole(role)
                                done = true
                                await keyv.set(taskKey,true) 
                            } catch (e){
                                fails++
                                handleErr(m,e)
                            }
                        }
                    }
                    countdown(m,g.members.size)
                },err => err ? console.log(err) : null)
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