import bunyan from 'bunyan';
const moduleName = 'crowdjoindetect';
var log = bunyan.createLogger({name: moduleName});
var discordClient;
var keyv;
var config;
var backendChannel;
var userlists = {}
var lastUpdated = 0
var lastWarned1 = {}
var lastWarned2 = {}

var handleMemberAdd = async (member) => {
    let guildName = member.guild.name
    if(!config.guilds[guildName]){
        return
    }
    let now = new Date()
    let memberShort = {
        joinedAt: member.joinedAt,
        username: member.user.username,
        userid: member.user.id
    }
    let userListCurrent = userlists[guildName]
    console.log(now-member.joinedAt)
    console.log(userListCurrent.map(m=>now-m.joinedAt))
    userListCurrent = userListCurrent.concat([memberShort]).filter(m => now - m.joinedAt < config.window * 1000)
    console.log(userListCurrent)
    log.info(`MemberAdd: Currently ${userListCurrent.length} user(s) under watch.`)
    if (userListCurrent.length > config.threshold1 && now - lastWarned1[guildName] > config.warnCooldown * 1000) {
        lastWarned1[guildName] = now
        backendChannel.send(`@everyone :warning: 警告： ${guildName} 最近${config.window}秒内，连续涌入新未验证用户 ${userListCurrent.length} 人 请注意！！！`)
        backendChannel.send("用户名："+ userListCurrent.map(x=>x.username).join(" "))
    }
    if (userListCurrent.length > config.threshold2 && now - lastWarned2[guildName] > config.warnCooldown * 1000) {
        lastWarned2[guildName] = now
        backendChannel.send(`@everyone :warning: :warning: 警告： ${guildName} 最近${config.window}秒内，连续涌入新未验证用户 ${userListCurrent.length} 人 请注意！！！`)
        backendChannel.send("用户名："+ userListCurrent.map(x=>x.username).join(" "))
    }
    userlists[guildName] = userListCurrent
    if(now - lastUpdated > config.updateInterval * 1000){
        try {
            await keyv.set(`joinDetect#${guildName}`, {
                userlist: userListCurrent,
                lastWarned1: lastWarned1[guildName],
                lastWarned2: lastWarned2[guildName]
            })
        } catch(e) {
            log.error(e)
        }
    }
}
var handleMemberUpdate = (_ , newMember) => {
    let guildName = newMember.guild.name
    if(!config.guilds[guildName]){
        return
    }
    let userListCurrent = userlists[guildName]
    if(newMember.roles.find(r => r.name === config.guilds[guildName])){
        userListCurrent = userListCurrent.filter(x=>x.userid !== newMember.user.id)
    }
    userlists[guildName] = userListCurrent
    log.info(`MemberUpdate: Currently ${userListCurrent.length} user(s) under watch.`)
}

var init = async () => {
    let [guildName,channelName]  = config.backendChannel.split('#');
    backendChannel = discordClient
    .guilds.find(guild => guild.name === guildName)
    .channels.find(ch => ch.name === channelName)
    log.info(`Start watching crowd join: window: ${config.window} threshold1: ${config.threshold1} threshold2: ${config.threshold2}` )
    for (let guildName in config.guilds){
        log.info(`Watching guild: [${guildName}]`)
        userlists[guildName] = []
        lastWarned1[guildName] = 0
        lastWarned2[guildName] = 0
        let data = await keyv.get(`joinDetect#${guildName}`)
        if(data){
            userlists[guildName] = data.userlist
            lastWarned1[guildName] = data.lastWarned1
            lastWarned2[guildName] = data.lastWarned2
        }
    }
}

var task = {
    name: moduleName,
    start: (settings,discord,kv) => {
        config = settings;
        keyv = kv;
        discordClient = discord;
        init()
        discordClient.on("guildMemberAdd", handleMemberAdd)
        discordClient.on("guildMemberUpdate", handleMemberUpdate)
    }
};
module.exports = task;