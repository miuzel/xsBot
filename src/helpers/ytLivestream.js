const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { config } = require('../../settings');
const ffmpeg = require('fluent-ffmpeg');

const client = new Discord.Client();
const myUsername = config.myUsername;
const prefix = config.prefix;
var voiceChannel = false
var dispatcher = false
var connection = false
var stream = false
var playing = false
client.on("ready",()=>{
    console.log("ready")
})


var msgToMe = m => {
    if( m.author.id === client.user.id){
      return false 
    }
    let trimed = m.content.trim().toLowerCase();
    
    if( trimed.startsWith(prefix)){
      return m.content.trim().slice(prefix.length).trim()
    }
    if( trimed.startsWith(myUsername)){
      return m.content.trim().slice(myUsername.length).trim()
    }
    if( m.channel.type === "dm"){
      return m.content.trim()
    }
    let matches = trimed.match(/^(<@!?\d+>)/);
    if( matches && m.mentions.users.first() && m.mentions.users.first().username === myUsername){
      return m.content.trim().slice(matches[1].length).trim()
    }
    return false;
  } 

  
client.on('message', message => {
    if (message.channel.type !== 'text') return;
    let msg = msgToMe(message);
    if (!msg){
        return
    }
	if ( msg.toLowerCase().startsWith('请你转播')) {
        if (!( message.member.roles.find(role => role.name === "DJ") ||
               message.member.roles.find(role => role.name === "程序员") ||
               message.member.roles.find(role => role.name.startsWith("管理员"))
        ))
        {
            return message.reply('转播直播内容请找DJ吧');
        }
        let url = msg.slice('请你转播'.length).trim()
        if(!url){
			return message.reply('没有链接吗？');
        }
        console.log("play "+ url)
		voiceChannel = message.member.voiceChannel;

		if (!voiceChannel) {
			return message.reply('请你先加入一个语音室，让我知道你有权限。');
		}

        message.reply('好的，我来试一下，请稍候。。。');
		voiceChannel.join().then( c => {
      connection = c
      dispatch(url,message)
		});
	} else if ( msg.toLowerCase().startsWith('请停止转播')){
        if (!( message.member.roles.find(role => role.name === "DJ") ||
               message.member.roles.find(role => role.name === "程序员") ||
               message.member.roles.find(role => role.name.startsWith("管理员"))
        ))
        {
            return message.reply('控制转播内容请找DJ吧');
        }
        if(connection){
            message.reply('好的。');
            playing = false
            connection.disconnect()
            voiceChannel.leave()
            connection = false
            return 
        }
        return message.reply('什么，现在没有转播啊');
    }
});

dispatch = async (url,message) => {
  try {
    const info = await ytdl.getInfo(url)
    console.log(info.player_response.playabilityStatus.liveStreamability.pollDelayMs)
    const delay = info.player_response.playabilityStatus ? info.player_response.playabilityStatus.liveStreamability.pollDelayMs : 5000
    const livequality = info.formats.filter(x=> x.isHLS && x.audioBitrate > 95).map(x=>x.itag).sort((a,b) => a*1 > b*1)
    stream = ytdl.downloadFromInfo(info, livequality.length ? { quality: livequality , highWaterMark: 1<<22, liveBuffer: 25000, begin: Date.now() - delay } : {highWaterMark: 1<<22,  liveBuffer: 25000, quality: "lowestaudio", filter: 'audioonly' });
    stream.on("info", (info, format) => { console.log(format) })
    message.reply('开始转播，正在缓冲，请稍候。。。');
    playing = true
    const s = ffmpeg(stream).withNoVideo().withAudioBitrate(96).audioCodec('libopus').format('opus')
    // const s = stream
    s.on('start', function(commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    });
    s.on("end", () => {
        message.reply(url + ' 的直播结束了，如果出了啥问你，请你重新播一次。');
        console.log("play end "+ url )
        playing = false
        voiceChannel.leave()
    })
    s.on("error", (err) => {
        if(playing){
          message.reply(url + ' 的直播出错了\n YouTube说：' + err);
          console.log("play error "+ url + "\n" + err)
          playing = false
        } 
        voiceChannel.leave()
    })
    dispatcher = connection.playStream( s );
    dispatcher.on('end', () => {
      console.log("dispatcher stopped "+ url + "\n")
      if(playing){
        message.reply('直播中断了，重连中，请稍候。。。'); 
        setTimeout(() => {
          dispatch(url,message)
        }, 100);
      }
    });
    dispatcher.on('error', (err) =>{
      console.log("dispatcher error "+ url + "\n" + err)
      playing = false
      voiceChannel.leave()
    });
  } catch(err){
      console.log("play info error "+ url + "\n" + err)
      playing = false
      voiceChannel.leave()
      return message.reply(url + ' 的直播出错了\n YouTube说：' + err);
  }
}
client.login(config.token);