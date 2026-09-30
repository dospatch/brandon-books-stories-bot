const http=require("http");
const PORT=process.env.PORT||8080;
http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/plain"});res.end("Brandon Books & Stories bot is online.\n");}).listen(PORT,"0.0.0.0",()=>console.log("Health server listening on "+PORT));
require("dotenv").config();
const {Client,GatewayIntentBits,ChannelType,EmbedBuilder,ActivityType,REST,Routes,SlashCommandBuilder,PermissionFlagsBits,MessageFlags}=require("discord.js");
const {applicationMenu,handleApplicationInteraction}=require("./applications");

const token=process.env.DISCORD_TOKEN;
if(!token){console.error("STARTUP FAILED: DISCORD_TOKEN is missing.");process.exit(1);}

const client=new Client({intents:[GatewayIntentBits.Guilds]});
let discordReady=false;

client.on("error",e=>console.error("DISCORD CLIENT ERROR:",e));
client.on("warn",m=>console.warn("DISCORD WARNING:",m));
client.on("shardError",e=>console.error("DISCORD SHARD ERROR:",e));
client.on("debug",m=>console.log("DISCORD DEBUG:",m));

const commands=[
 new SlashCommandBuilder().setName("setup-author-server").setDescription("Create or repair the Books & Stories server structure."),
 new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
 new SlashCommandBuilder().setName("books").setDescription("Show the author's books."),
 new SlashCommandBuilder().setName("website").setDescription("Show the author website."),
 new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
 new SlashCommandBuilder().setName("ping").setDescription("Check whether the bot is responding."),
 new SlashCommandBuilder().setName("apply").setDescription("Submit a private Books & Stories community application.")
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
 return "Discord access failure at "+context+" | code="+code+" | status="+status+" | message="+(e?.message||"Unknown Discord error");
}
async function withTimeout(promise,label,ms=120000){
 const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Timed out while "+label+" after "+ms+"ms.")),ms));
 return Promise.race([promise,timeout]);
}

async function setup(guild){
 const me=guild.members.me || await guild.members.fetchMe();
 const needed=[[PermissionFlagsBits.ViewChannel,"View Channel"],[PermissionFlagsBits.ManageChannels,"Manage Channels"],[PermissionFlagsBits.ManageRoles,"Manage Roles"],[PermissionFlagsBits.SendMessages,"Send Messages"],[PermissionFlagsBits.EmbedLinks,"Embed Links"],[PermissionFlagsBits.ReadMessageHistory,"Read Message History"]];
 const missing=needed.filter(x=>!me.permissions.has(x[0])).map(x=>x[1]);
 if(missing.length)throw new Error("Missing bot server permissions: "+missing.join(", "));
 const roleMap={};
 for(const name of roles){
  let r=guild.roles.cache.find(x=>x.name===name);
  if(!r){try{r=await guild.roles.create({name,reason:"Books & Stories bot setup"});}catch(e){throw new Error(explainDiscordError(e,"creating role "+name));}}
  if(r.managed)throw new Error("Cannot use managed role "+name+".");
  roleMap[name]=r;
 }
 for(const [catName,names] of Object.entries(structure)){
  let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===catName);
  if(!cat){try{cat=await guild.channels.create({name:catName,type:ChannelType.GuildCategory,reason:"Books & Stories bot setup"});}catch(e){throw new Error(explainDiscordError(e,"creating category "+catName));}}
  for(const name of names){
   let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===cat.id);
   if(!ch){try{ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,reason:"Books & Stories bot setup"});}catch(e){throw new Error(explainDiscordError(e,"creating channel "+name));}}
   if(catName==="🔒 STAFF"){
    // Keep the bot explicitly allowed before denying @everyone. Otherwise
    // the @everyone deny can remove the bot's channel access mid-setup.
    try{
     await ch.permissionOverwrites.edit(me.id,{
      ViewChannel:true,
      SendMessages:true,
      ReadMessageHistory:true,
      ManageChannels:true
     });
     await ch.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false});
    }catch(e){
     throw new Error(explainDiscordError(e,"securing staff channel "+name));
    }
    for(const rn of ["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"]){
     const role=roleMap[rn];
     if(!role)continue;
     if(role.position>=me.roles.highest.position){
      console.warn("STAFF ROLE HIERARCHY WARNING: Bot role must be above "+rn+" in the Discord role list.");
      continue;
     }
     try{
      await ch.permissionOverwrites.edit(role.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
     }catch(e){
      console.warn("STAFF ROLE ACCESS WARNING:",explainDiscordError(e,"granting staff access to "+name+" for "+rn));
     }
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
 discordReady=true;
 console.log("BOOKS & STORIES READY: "+client.user.tag+" | Guilds: "+client.guilds.cache.size);
 client.user.setPresence({activities:[{name:"Books & Stories 📖",type:ActivityType.Watching}],status:"online"});
 try{
  const rest=new REST({version:"10"}).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
  console.log("GLOBAL SLASH COMMANDS REGISTERED.");
  for(const guild of client.guilds.cache.values()){
   try{await rest.put(Routes.applicationGuildCommands(client.user.id,guild.id),{body:commands});console.log("GUILD COMMANDS REGISTERED: "+guild.name+" ("+guild.id+")");}
   catch(e){console.error("GUILD COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);}
  }
 }catch(e){console.error("SLASH COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);}
});

client.on("interactionCreate",async i=>{
 console.log("INTERACTION EVENT: "+(i.type||"unknown")+" / "+(i.commandName||"non-command")+" guild="+(i.guildId||"DM"));
 try{
  if(!i.isChatInputCommand()){
   await handleApplicationInteraction(i);
   return;
  }
  if(!i.guild)return i.reply({content:"This command can only be used in a server.",flags:MessageFlags.Ephemeral});
  if(i.commandName==="ping")return i.reply({content:"🏓 Pong! The bot is online and responding.",flags:MessageFlags.Ephemeral});
  if(i.commandName==="apply")return i.reply({content:"📋 **Brandon Books & Stories Applications**\n\nChoose the type of application you want to submit below. Your application will be sent to a private staff review channel.",components:[applicationMenu()],flags:MessageFlags.Ephemeral});
  if(i.commandName==="setup-author-server"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can run setup.",flags:MessageFlags.Ephemeral});
   await i.reply({content:"🔎 **Books & Stories setup starting...**",flags:MessageFlags.Ephemeral});
   try{await withTimeout(setup(i.guild),"setting up the server");await i.editReply("✅ **Books & Stories server setup is complete.**");}
   catch(e){console.error("SETUP FAILED:",e);await i.editReply("❌ **Setup failed:** "+(e.message||String(e))).catch(()=>{});}
   return;
  }
  if(i.commandName==="help")return i.reply({content:"📖 **Books & Stories Bot**\n\n/setup-author-server — Build the server\n/apply — Submit an application\n/books — Show books\n/website — Show website\n/serverinfo — Server info\n/ping — Test the bot\n/help — Help",flags:MessageFlags.Ephemeral});
  if(i.commandName==="books")return i.reply({embeds:[new EmbedBuilder().setTitle("📚 Brandon D. Coleman Jr. — Books").setDescription("📖 My Life Story With Grandma\n"+(process.env.BOOK_1_URL||"Book link coming soon.")+"\n\n📕 Part 2: Continuing the Journey, Memories, and the Road Ahead\n"+(process.env.PART_2_URL||"Part 2 link coming soon."))]});
  if(i.commandName==="website")return i.reply({content:"🌐 **Brandon D. Coleman Jr. — Books & Stories**\n"+(process.env.WEBSITE_URL||"https://brandon-books-stories-bot-website-3n7hbjx9r-dospatchs-projects.vercel.app")});
  if(i.commandName==="serverinfo")return i.reply({content:"🖥️ **"+i.guild.name+"**\nMembers: "+i.guild.memberCount+"\nChannels: "+i.guild.channels.cache.size,flags:MessageFlags.Ephemeral});
 }catch(e){
  console.error("INTERACTION FAILED:",e);
  if(i.deferred||i.replied)await i.editReply("❌ Command failed: "+(e.message||String(e))).catch(()=>{});
  else await i.reply({content:"❌ Command failed: "+(e.message||String(e)),flags:MessageFlags.Ephemeral}).catch(()=>{});
 }
});

process.on("unhandledRejection",e=>console.error("UNHANDLED REJECTION:",e));
process.on("uncaughtException",e=>{console.error("UNCAUGHT EXCEPTION:",e);});
client.login(token).then(()=>console.log("DISCORD LOGIN INITIATED.")).catch(e=>{console.error("DISCORD LOGIN FAILED:",e.code||"unknown",e.message||e);process.exit(1);});
