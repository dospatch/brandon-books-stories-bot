const http=require("http");
const PORT=process.env.PORT||8080;
http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/plain"});res.end("Brandon Books & Stories bot is online.\n");}).listen(PORT,"0.0.0.0",()=>console.log("Health server listening on "+PORT));
require("dotenv").config();
const {Client,GatewayIntentBits,ChannelType,EmbedBuilder,ActivityType,REST,Routes,SlashCommandBuilder,PermissionFlagsBits}=require("discord.js");
const token=process.env.DISCORD_TOKEN;
if(!token){console.error("STARTUP FAILED: DISCORD_TOKEN is missing.");process.exit(1);}

const client=new Client({intents:[GatewayIntentBits.Guilds]});

client.on("error",e=>console.error("DISCORD CLIENT ERROR:",e));
client.on("warn",m=>console.warn("DISCORD WARNING:",m));
client.on("shardError",e=>console.error("DISCORD SHARD ERROR:",e));

const commands=[
 new SlashCommandBuilder().setName("setup-author-server").setDescription("Create or repair the Books & Stories server structure."),
 new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
 new SlashCommandBuilder().setName("books").setDescription("Show the author's books."),
 new SlashCommandBuilder().setName("website").setDescription("Show the author website."),
 new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
 new SlashCommandBuilder().setName("ping").setDescription("Check whether the bot is responding.")
].map(x=>x.toJSON());

const structure={
"📌 START HERE":["👋・welcome","📜・rules","📢・announcements","📰・latest-updates"],
"📚 BOOKS":["📖・my-life-story-with-grandma","📕・part-2","🛒・where-to-buy","⭐・reader-reviews"],
"✍️ THE AUTHOR":["👤・about-brandon","✍️・writing-journey","🌅・family-and-memories","📸・behind-the-books"],
"💬 COMMUNITY":["💬・general","📚・book-discussion","❤️・memories","💡・reader-ideas","🎉・community"],
"📺 MEDIA":["▶️・youtube","📸・instagram","📘・facebook","🎵・music-projects"],
"🤖 BOT":["🤖・bot-commands","📋・bot-updates"],
"🔒 STAFF":["🔒・staff","🛠️・staff-logs","📊・server-logs"]
};
const roles=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team","📚 Reader","⭐ VIP Reader","🤖 Bot"];

function allowed(i){return i.guild.ownerId===i.user.id || (process.env.OWNER_ID && i.user.id===process.env.OWNER_ID);}

function explainDiscordError(e,context){
 const code=e?.code||e?.rawError?.code||"unknown";
 const status=e?.status||e?.httpStatus||e?.rawError?.status||"unknown";
 const api=e?.method&&e?.url ? " | "+e.method+" "+e.url : "";
 return "Discord access failure at "+context+" | code="+code+" | status="+status+" | message="+(e?.message||"Unknown Discord error")+api;
}

async function setup(guild){
 let step="checking bot permissions";
 const me=guild.members.me || await guild.members.fetchMe();
 const needed=[[PermissionFlagsBits.ViewChannel,"View Channel"],[PermissionFlagsBits.ManageChannels,"Manage Channels"],[PermissionFlagsBits.ManageRoles,"Manage Roles"],[PermissionFlagsBits.SendMessages,"Send Messages"],[PermissionFlagsBits.EmbedLinks,"Embed Links"],[PermissionFlagsBits.ReadMessageHistory,"Read Message History"]];
 const missing=needed.filter(x=>!me.permissions.has(x[0])).map(x=>x[1]);
 if(missing.length)throw new Error("Missing bot server permissions: "+missing.join(", ")+" | Add these permissions to the bot's managed role.");
 if(!me.permissions.has(PermissionFlagsBits.Administrator)){
  const everyone=guild.roles.everyone;
  console.log("SETUP PREFLIGHT: Bot role="+me.roles.highest.name+" position="+me.roles.highest.position+" | @everyone position="+everyone.position);
 }
 const roleMap={};
 for(const name of roles){
  step="creating/checking role "+name;
  let r=guild.roles.cache.find(x=>x.name===name);
  if(!r){
   try{r=await guild.roles.create({name,reason:"Books & Stories bot setup"});}
   catch(e){throw new Error(explainDiscordError(e,"creating role "+name+" | requires Manage Roles"));}
  } else if(r.managed){
   throw new Error("Cannot use role "+name+" because it is a managed/integration role. Create a normal Discord role with this name instead.");
  }
  roleMap[name]=r;
 }
 for(const [catName,names] of Object.entries(structure)){
  step="creating/checking category "+catName;
  let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===catName);
  if(!cat){
   try{cat=await guild.channels.create({name:catName,type:ChannelType.GuildCategory,reason:"Books & Stories bot setup"});}
   catch(e){throw new Error(explainDiscordError(e,"creating category "+catName+" | requires Manage Channels"));}
  }
  for(const name of names){
   step="creating/checking channel "+name;
   let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===cat.id);
   if(!ch){
    try{ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,reason:"Books & Stories bot setup"});}
    catch(e){throw new Error(explainDiscordError(e,"creating channel "+name+" in category "+catName+" | requires Manage Channels"));}
   }
   if(catName==="🔒 STAFF"){
    step="configuring staff permissions for "+name;
    try{await ch.permissionOverwrites.edit(guild.roles.everyone,{ViewChannel:false});}
    catch(e){throw new Error(explainDiscordError(e,"denying @everyone access to staff channel "+name+" | requires Manage Channels"));}
    for(const rn of ["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"]){
     const role=roleMap[rn];
     if(!role)throw new Error("Staff role was not created: "+rn);
     if(role.position>=me.roles.highest.position)throw new Error("Cannot manage permission for role "+rn+" because it is at/above the bot highest role.");
     try{await ch.permissionOverwrites.edit(role,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});}
     catch(e){throw new Error(explainDiscordError(e,"granting "+rn+" access to staff channel "+name+" | requires Manage Channels"));}
    }
   }
  }
 }
 const welcome=guild.channels.cache.find(x=>x.name==="👋・welcome");
 if(welcome)await welcome.send({embeds:[new EmbedBuilder().setTitle("📖 Welcome to Brandon D. Coleman Jr. — Books & Stories").setDescription("Welcome to the community for books, stories, memories, writing updates, and creative projects.\n\n📚 Books • ✍️ Stories • ❤️ Memories\n\nPlease read the rules and introduce yourself!").setFooter({text:"📖 Real Stories • Bigger Purpose"})]}).catch(e=>console.warn("WELCOME MESSAGE FAILED:",e.message));
 const rules=guild.channels.cache.find(x=>x.name==="📜・rules");
 if(rules)await rules.send({embeds:[new EmbedBuilder().setTitle("📜 Community Rules").setDescription("1. Be respectful.\n2. Keep the community welcoming.\n3. No harassment or spam.\n4. Keep discussions constructive.\n5. Follow Discord Terms and Community Guidelines.")]}).catch(e=>console.warn("RULES MESSAGE FAILED:",e.message));
}

client.once("ready",async()=>{
 console.log("BOOKS & STORIES READY: "+client.user.tag+" | Guilds: "+client.guilds.cache.size);
 client.user.setPresence({activities:[{name:"Books & Stories 📖",type:ActivityType.Watching}],status:"online"});
 try{
  const rest=new REST({version:"10"}).setToken(token);
  console.log("Registering "+commands.length+" global slash commands...");
  await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
  console.log("SLASH COMMANDS REGISTERED SUCCESSFULLY.");
 }catch(e){
  console.error("SLASH COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);
 }
});

client.on("interactionCreate",async i=>{
 if(!i.isChatInputCommand())return;
 console.log("INTERACTION RECEIVED: /"+i.commandName+" by "+i.user.tag);
 if(!i.guild)return i.reply({content:"This command can only be used in a server.",ephemeral:true}).catch(()=>{});
 try{
  if(i.commandName==="setup-author-server"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can run setup.",ephemeral:true});
   await i.reply({content:"🔎 **Books & Stories setup starting...** I’m checking Discord access and will report the exact problem if anything fails.",ephemeral:true});
   try{
    await setup(i.guild);
    await i.editReply("✅ **Books & Stories server setup is complete.** You can safely run setup again to repair the structure.");
   }catch(e){
    console.error("SETUP FAILED at setup step:",e);
    const detail=e.message||String(e);
    await i.editReply("❌ **Setup failed**\\n\\n**What failed:** "+detail+"\\n\\nCheck the FadeHost logs for the full diagnostic.").catch(()=>{});
   }
   return;
  }
  if(i.commandName==="ping")return i.reply({content:"🏓 Pong! The bot is online and responding.",ephemeral:true});
  if(i.commandName==="help")return i.reply({content:"📖 **Books & Stories Bot**\n\n/setup-author-server — Build the server\n/books — Show books\n/website — Show website\n/serverinfo — Server info\n/ping — Test the bot\n/help — Help",ephemeral:true});
  if(i.commandName==="books")return i.reply({embeds:[new EmbedBuilder().setTitle("📚 Brandon D. Coleman Jr. — Books").setDescription("📖 My Life Story With Grandma\n"+(process.env.BOOK_1_URL||"Book link coming soon.")+"\n\n📕 Part 2: Continuing the Journey, Memories, and the Road Ahead\n"+(process.env.PART_2_URL||"Part 2 link coming soon."))]});
  if(i.commandName==="website")return i.reply({content:"🌐 **Brandon D. Coleman Jr. — Books & Stories**\n"+(process.env.WEBSITE_URL||"https://brandon-books-stories-bot-website-3n7hbjx9r-dospatchs-projects.vercel.app")});
  if(i.commandName==="serverinfo")return i.reply({content:"🖥️ **"+i.guild.name+"**\nMembers: "+i.guild.memberCount+"\nChannels: "+i.guild.channels.cache.size,ephemeral:true});
 }catch(e){
  console.error("INTERACTION FAILED:",e);
  const msg="❌ Command failed: "+(e.message||String(e));
  if(i.deferred||i.replied)await i.editReply(msg).catch(()=>{});
  else await i.reply({content:msg,ephemeral:true}).catch(()=>{});
 }
});

client.login(token).then(()=>console.log("Discord login initiated.")).catch(e=>{console.error("DISCORD LOGIN FAILED:",e.code||"unknown",e.message||e);process.exit(1);});
