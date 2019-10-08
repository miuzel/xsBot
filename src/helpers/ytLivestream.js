const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { config } = require('../../settings');

const client = new Discord.Client();
client.on("ready",()=>{
    console.log("ready")
})
client.on('message', message => {
    if (message.channel.type !== 'text') return;
    if (!message.member.roles.has(message.guild.roles.find(role => role.name === "DJ")) ||
    !message.member.roles.has(message.guild.roles.find(role => role.name === "程序员")) ||
    !message.member.roles.has(message.guild.roles.find(role => role.name.startsWith("管理员")))){
        return message.reply('转播直播内容请找DJ吧');
    }
    const msg = message.content.trim()
	if (msg.toLowerCase().startsWith('细姐请转播')) {
        let url = msg.substring('细姐请转播'.length -1 )
        if(!url){
			return message.reply('没有链接吗？');
        }
        console.log("play "+ url.trim())
		const { voiceChannel } = message.member;

		if (!voiceChannel) {
			return message.reply('请你先加入一个语音室，让我知道你有权限。');
		}

		voiceChannel.join().then(async connection => {
            //const stream = ytdl('https://www.youtube.com/watch?v=Ha2rCC9IOCA', { filter: 'audioonly' });
            const info = await ytdl.getInfo(url)
            //{ quality: [128,127,120,96,95,94,93] }
            const livequality = info.formats.filter(x=> x.live && ["151","132","128","127","120","96","95","94","93","92"].indexOf(x.itag) !== -1 ).map(x=>x.itag).sort((a,b) => a > b)
            //console.log(livequality)
            const stream = ytdl.downloadFromInfo(info, livequality ? { quality: livequality , liveBuffer: 25000, begin: Date.now() - 20000 } : { filter: 'audioonly' });
            stream.on("info", (info, format) => { console.log(format) })
            //connection.play(stream);
            stream.on("end", () => {
                message.reply(url + '直播结束了，如果出了啥问你，请你重新播一次。');
            })
            stream.on("error", () => {
                message.reply(url + '直播出错了');
            })
			const dispatcher = connection.playStream(stream);
			dispatcher.on('end', () => voiceChannel.leave());
			dispatcher.on('error', () => voiceChannel.leave());
		});
	}
});

client.login(config.token);