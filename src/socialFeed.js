const {EmbedBuilder,ChannelType}=require("discord.js");

const CHANNEL_NAME="📱・social-media";
const SOURCE_CHANNELS={
  instagram:"📸・instagram",
  facebook:"📘・facebook",
  tiktok:"📱・social-media",
  youtube:"▶️・youtube",
  website:"📱・social-media",
  book:"🛒・where-to-buy",
  music:"🎵・music-projects"
};
const SOURCE_LABELS={
  instagram:"📸 Instagram",
  facebook:"📘 Facebook",
  tiktok:"🎵 TikTok",
  youtube:"▶️ YouTube",
  website:"🌐 Website",
  book:"📚 Books"
};

function clean(value,max=1024){
  return String(value||"").trim().slice(0,max);
}

async function findChannel(guild,name){
  return guild.channels.cache.find(
    x=>x.type===ChannelType.GuildText&&x.name===name
  )||null;
}

async function alreadyPosted(channel,marker){
  const messages=await channel.messages.fetch({limit:100}).catch(()=>null);
  if(!messages)return false;
  return messages.some(m=>
    m.author?.id===channel.client.user.id &&
    m.embeds?.some(e=>e.footer?.text===marker)
  );
}

async function postSocialUpdate(guild,data){
  const source=String(data.source||"website").toLowerCase();
  const id=clean(data.id||data.url||data.title||Date.now(),200);
  const marker="BBS:AUTO:SOCIAL:"+source+":"+id;

  const title=clean(data.title||("New "+(SOURCE_LABELS[source]||"Update")),256);
  const description=clean(data.description||data.text||"Brandon Books & Stories has a new update.",4096);
  const url=clean(data.url,2000);

  const embed=new EmbedBuilder()
    .setTitle((SOURCE_LABELS[source]||"📣 Social Update")+" — "+title)
    .setDescription(description)
    .setFooter({text:marker})
    .setTimestamp(new Date());

  if(url)embed.setURL(url);
  if(data.image)embed.setImage(clean(data.image,2000));
  if(data.author)embed.addFields({name:"Posted by",value:clean(data.author,256),inline:true});

  const targetNames=[CHANNEL_NAME,SOURCE_CHANNELS[source]||CHANNEL_NAME];
  const uniqueNames=[...new Set(targetNames)];
  const results=[];
  for(const name of uniqueNames){
    const channel=await findChannel(guild,name);
    if(!channel||!channel.isTextBased()){
      results.push({channel:name,ok:false,reason:"channel not found"});
      continue;
    }
    const channelMarker=marker+":"+name;
    if(await alreadyPosted(channel,channelMarker)){
      results.push({channel:name,ok:true,duplicate:true});
      continue;
    }
    const channelEmbed=EmbedBuilder.from(embed).setFooter({text:channelMarker});
    await channel.send({
      content:"📣 **New Brandon Books & Stories update!**",
      embeds:[channelEmbed]
    });
    results.push({channel:name,ok:true,duplicate:false});
  }

  const posted=results.some(x=>x.ok&&!x.duplicate);
  return {ok:posted||results.every(x=>x.duplicate),duplicate:results.length>0&&results.every(x=>x.duplicate),channels:results};
}

async function handleSocialWebhook(req,res,guilds){
  const expected=process.env.SOCIAL_WEBHOOK_SECRET;
  if(!expected){
    res.writeHead(503,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:false,error:"SOCIAL_WEBHOOK_SECRET is not configured"}));
    return;
  }

  const provided=req.headers["x-social-webhook-secret"];
  if(provided!==expected){
    res.writeHead(401,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:false,error:"Unauthorized"}));
    return;
  }

  let body="";
  req.on("data",chunk=>{
    body+=chunk.toString();
    if(body.length>100000)req.destroy();
  });
  req.on("end",async()=>{
    try{
      const data=JSON.parse(body||"{}");
      const results=[];
      for(const guild of guilds.values()){
        try{
          results.push({guild:guild.id,...await postSocialUpdate(guild,data)});
        }catch(e){
          console.error("SOCIAL POST FAILED:",e);
          results.push({guild:guild.id,ok:false,error:e.message||String(e)});
        }
      }
      res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify({ok:true,results}));
    }catch(e){
      res.writeHead(400,{"Content-Type":"application/json"});
      res.end(JSON.stringify({ok:false,error:"Invalid JSON payload"}));
    }
  });
}

module.exports={handleSocialWebhook,postSocialUpdate};
