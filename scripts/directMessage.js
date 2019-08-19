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
const [guildName,userName,text,concurrent,taskid] = process.argv.slice(2);
process.setMaxListeners(0)
const keyv = new Keyv(`sqlite://./script.db`);

client.on('ready',  () => {
    console.log(`I am ready! push DM to ${userName}`);
    let guild = client.guilds.find(guild => guild.name === guildName)
    if (guild) {
            guild.fetchMembers().then(g => {
                let count = 0
                let failed = 0
                let failMembers = []
                let countdown = (m,size) => {
                    count++
                    console.log("[DONE]"+m.user.username)
                    if(count>=size ){
                        console.log(count + " users sent. " + failed +" users failed.")
                        console.log("Done. FailMembers:")
                        console.log(failMembers)
                        client.destroy()
                    }
                }
                let handleErr = (m,e) => {
                    failed++
                    console.log("error DM to "+m.user.username)
                    console.log(e.message)
                }
                if(userName === "@everyone"){
                    async.mapLimit(g.members.array(),concurrent, async m => {
                        const taskKey = `script#${m.user.id}#DM#${taskid}`
                        let done =  await keyv.get(taskKey) 
                        let fails = 0
                        while (!done && fails < 5){
                            console.log(`Send msg to ${m.user.username}#${m.user.discriminator}`)
                            try {
                                await m.send(text)
                                done = true
                            } catch (e){
                                fails++
                                handleErr(m,e)
                                if (e.code === 50007){
                                    failMembers = failMembers.concat([`${m.user.username}#${m.user.discriminator}`])
                                    fails = 10
                                }
                            }
                        }
                        countdown(m,g.members.size)
                    },err => err ? console.log(err) : null)
                } else {
                    m = g.members.find(m => m.user.username === userName)
                    if (m && client.user.id !== m.user.id){
                        m.send(text).catch(handleErr(m)).finally(countdown(m,1))
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