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

async function upsertEmbedMessage(channel, marker, embed){
 const messages=await channel.messages.fetch({limit:50}).catch(()=>null);
 if(!messages)return null;
 const existing=messages.find(m=>m.author?.id===client.user.id && m.embeds?.some(e=>e.footer?.text===marker));
 if(existing){
  await existing.edit({embeds:[embed]});
  return existing;
 }
 return channel.send({embeds:[embed]});
}

async function announceDeploymentSuccess(guild){
 try{
  const channelId=process.env.BOT_UPDATES_CHANNEL_ID;
  let channel=channelId ? await client.channels.fetch(channelId).catch(()=>null) : null;
  if(!channel){
   channel=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name==="📋・bot-updates");
  }
  if(!channel || !channel.isTextBased())return;
  const embed=new EmbedBuilder()
   .setTitle("✅ Deployment Complete")
   .setDescription("**Brandon Books & Stories** is online and running the latest deployed version.")
   .addFields(
    {name:"Status",value:"🟢 Online",inline:true},
    {name:"Hosting",value:"FadeHost",inline:true},
    {name:"Source",value:"GitHub → FadeHost",inline:true}
   )
   .setFooter({text:"BBS:AUTO:DEPLOY"});
  await upsertEmbedMessage(channel,"BBS:AUTO:DEPLOY",embed);
 }catch(e){
  console.warn("DEPLOYMENT STATUS MESSAGE FAILED:",e.message||e);
 }
}

async function setup(guild){
 const me=guild.members.me || await guild.members.fetchMe();
 const needed=[
  [PermissionFlagsBits.ViewChannel,"View Channel"],
  [PermissionFlagsBits.ManageChannels,"Manage Channels"],
  [PermissionFlagsBits.ManageRoles,"Manage Roles"],
  [PermissionFlagsBits.SendMessages,"Send Messages"],
  [PermissionFlagsBits.EmbedLinks,"Embed Links"],
  [PermissionFlagsBits.ReadMessageHistory,"Read Message History"]
 ];
 const missing=needed.filter(x=>!me.permissions.has(x[0])).map(x=>x[1]);
 if(missing.length)throw new Error("Missing bot server permissions: "+missing.join(", "));

 const roleMap={};
 const rolePermissions={
  "👑 Owner":[PermissionFlagsBits.Administrator],
  "🛠️ Administrator":[
   PermissionFlagsBits.ManageGuild,
   PermissionFlagsBits.ManageChannels,
   PermissionFlagsBits.ManageRoles,
   PermissionFlagsBits.ManageMessages,
   PermissionFlagsBits.ViewAuditLog,
   PermissionFlagsBits.KickMembers,
   PermissionFlagsBits.BanMembers,
   PermissionFlagsBits.ManageWebhooks
  ],
  "🛡️ Moderator":[
   PermissionFlagsBits.ManageMessages,
   PermissionFlagsBits.KickMembers,
   PermissionFlagsBits.ModerateMembers,
   PermissionFlagsBits.ViewAuditLog
  ],
  "✍️ Author Team":[],
  "📚 Reader":[],
  "⭐ VIP Reader":[],
  "🤖 Bot":[]
 };

 for(const name of roles){
  let r=guild.roles.cache.find(x=>x.name===name);
  if(!r){
   try{r=await guild.roles.create({name,permissions:rolePermissions[name]||[],reason:"Books & Stories bot setup"});}
   catch(e){throw new Error(explainDiscordError(e,"creating role "+name));}
  }
  if(r.managed)throw new Error("Cannot use managed role "+name+".");
  roleMap[name]=r;
  try{
   const desired=rolePermissions[name]||[];
   if(!r.permissions.equals(desired) && r.editable){
    await r.setPermissions(desired,"Books & Stories role configuration");
   }
  }catch(e){
   console.warn("ROLE PERMISSION WARNING:",explainDiscordError(e,"configuring role "+name));
  }
 }

 // Keep the Books & Stories roles below the bot's highest manageable role.
 // Discord will not allow a bot to manage roles at/above its own highest role.
 const hierarchy=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team","⭐ VIP Reader","📚 Reader","🤖 Bot"];
 for(const name of hierarchy){
  const role=roleMap[name];
  if(!role || role.managed || !role.editable)continue;
  const target=Math.max(1,me.roles.highest.position-1);
  if(role.position>target){
   try{await role.setPosition(target,"Books & Stories role hierarchy repair");}
   catch(e){console.warn("ROLE HIERARCHY WARNING:",explainDiscordError(e,"moving role "+name));}
  }
 }
 await me.fetch();
 if(roleMap["🤖 Bot"] && roleMap["🤖 Bot"].editable && !me.roles.cache.has(roleMap["🤖 Bot"].id)){
  try{await me.roles.add(roleMap["🤖 Bot"],"Books & Stories bot role");}
  catch(e){console.warn("BOT ROLE ASSIGNMENT WARNING:",explainDiscordError(e,"assigning 🤖 Bot role"));}
 }

 const staffRoleNames=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"];
 const readOnlyChannels=new Set([
  "👋・welcome","📜・rules","📢・announcements","📰・latest-updates",
  "📖・my-life-story-with-grandma","📕・part-2","🛒・where-to-buy",
  "👤・about-brandon","✍️・writing-journey","🌅・family-and-memories","📸・behind-the-books",
  "▶️・youtube","📸・instagram","📘・facebook","🎵・music-projects",
  "📋・bot-updates"
 ]);

 const publicAllow={
  ViewChannel:true,
  ReadMessageHistory:true,
  SendMessages:true,
  EmbedLinks:true
 };
 const publicReadOnly={
  ViewChannel:true,
  ReadMessageHistory:true,
  SendMessages:false,
  EmbedLinks:true
 };
 const botAllow={
  ViewChannel:true,
  ReadMessageHistory:true,
  SendMessages:true,
  EmbedLinks:true
 };

 const categoryMap={};
 for(const [catName,names] of Object.entries(structure)){
  let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===catName);
  if(!cat){
   try{
    cat=await guild.channels.create({
     name:catName,
     type:ChannelType.GuildCategory,
     reason:"Books & Stories bot setup"
    });
   }catch(e){
    throw new Error(explainDiscordError(e,"creating category "+catName));
   }
  }
  categoryMap[catName]=cat;

  // Reconcile category visibility and staff access every time setup runs.
  if(catName==="🔒 STAFF"){
   // If an existing Staff category is inaccessible to the bot, create a fresh
   // managed Staff category so setup can recover without manual permission repair.
   if(!cat.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel)){
    try{
     cat=await guild.channels.create({name:"🔒 STAFF",type:ChannelType.GuildCategory,reason:"Books & Stories staff access recovery"});
     categoryMap[catName]=cat;
    }catch(e){throw new Error(explainDiscordError(e,"recovering inaccessible staff category"));}
   }
   try{
    // Restore bot access FIRST. If Discord still reports 50001, create a
    // replacement Staff category and continue the setup there.
    await cat.permissionOverwrites.edit(me.id,{
     ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true
    });
    await cat.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false});
   }catch(e){
    const code=e?.code||e?.rawError?.code;
    if(String(code)==="50001"){
     console.warn("STAFF CATEGORY INACCESSIBLE; CREATING RECOVERY CATEGORY.");
     try{
      const recovery=await guild.channels.create({
       name:"🔒 STAFF",
       type:ChannelType.GuildCategory,
       reason:"Books & Stories automatic Staff access recovery"
      });
      cat=recovery;
      categoryMap[catName]=cat;
      await cat.permissionOverwrites.edit(me.id,{
       ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true
      });
      await cat.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false});
     }catch(recoveryError){
      throw new Error(explainDiscordError(recoveryError,"recovering staff category after 50001"));
     }
    }else{
     throw new Error(explainDiscordError(e,"securing staff category"));
    }
   }
   for(const rn of staffRoleNames){
    const role=roleMap[rn];
    if(!role || role.position>=me.roles.highest.position)continue;
    try{
     await cat.permissionOverwrites.edit(role.id,{
      ViewChannel:true,SendMessages:true,ReadMessageHistory:true
     });
    }catch(e){
     console.warn("STAFF CATEGORY ROLE WARNING:",explainDiscordError(e,"granting staff access to "+rn));
    }
   }
  }else{
   try{
    await cat.permissionOverwrites.edit(guild.roles.everyone.id,publicAllow);
    await cat.permissionOverwrites.edit(me.id,botAllow);
   }catch(e){
    console.warn("PUBLIC CATEGORY WARNING:",explainDiscordError(e,"configuring category "+catName));
   }
  }

  for(const name of names){
   // First look for the exact channel anywhere, so an existing channel is
   // repaired/moved instead of creating a duplicate in the correct category.
   let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===cat.id);
   if(!ch){
    try{
     ch=await guild.channels.create({
      name,
      type:ChannelType.GuildText,
      parent:cat.id,
      reason:"Books & Stories bot setup"
     });
    }catch(e){
     throw new Error(explainDiscordError(e,"creating channel "+name));
    }
   }else if(ch.parentId!==cat.id){
    try{
     await ch.setParent(cat.id,{lockPermissions:false,reason:"Books & Stories channel structure repair"});
    }catch(e){
     throw new Error(explainDiscordError(e,"moving channel "+name+" into "+catName));
    }
   }

   try{
    if(catName==="🔒 STAFF"){
     // Restore bot access before denying @everyone for the same reason as
     // the category: never lock the bot out during the repair operation.
     await ch.permissionOverwrites.edit(me.id,{
      ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true
     });
     await ch.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false});
     for(const rn of staffRoleNames){
      const role=roleMap[rn];
      if(!role || role.position>=me.roles.highest.position)continue;
      await ch.permissionOverwrites.edit(role.id,{
       ViewChannel:true,SendMessages:true,ReadMessageHistory:true
      });
     }
    }else{
     const memberPermissions=readOnlyChannels.has(name)?publicReadOnly:publicAllow;
     await ch.permissionOverwrites.edit(guild.roles.everyone.id,memberPermissions);
     await ch.permissionOverwrites.edit(me.id,botAllow);
    }
   }catch(e){
    console.warn("CHANNEL PERMISSION WARNING:",explainDiscordError(e,"configuring channel "+name));
   }
  }
 }

 // Keep the intended category order.
 const categoryOrder=Object.keys(structure);
 for(let index=categoryOrder.length-1;index>=0;index--){
  const cat=categoryMap[categoryOrder[index]];
  if(!cat)continue;
  try{await cat.setPosition(index,"Books & Stories category order");}
  catch(e){console.warn("CATEGORY ORDER WARNING:",explainDiscordError(e,"ordering "+cat.name));}
 }

 const welcome=guild.channels.cache.find(x=>x.name==="👋・welcome");
 if(welcome){
  const welcomeEmbed=new EmbedBuilder()
   .setTitle("📚 Welcome to Brandon Books & Stories! ❤️")
   .setDescription(
    "I’m truly glad you’re here.\n\n"+
    "This community is a place where I can share the books, stories, memories, ideas, and creative projects that mean something to me — and where I hope we can build a community around them together.\n\n"+
    "📚 Books\n✍️ Stories & Writing\n❤️ Memories & Personal Moments\n🎨 Creative Projects\n📝 Writing & Publishing Updates\n📢 News & Announcements\n💬 Community Conversations\n\n"+
    "Some of the stories shared here may be personal, some may be creative, and others may simply be little updates from along the journey. My goal is to make this a place where people can read, connect, share, encourage, and enjoy.\n\n"+
    "Whether you've been following my work for a while or you’re just discovering it for the first time, you’re welcome here. ❤️\n\n"+
    "🌟 **What You Can Expect**\n\n"+
    "You'll find updates about my books and writing, new projects, behind-the-scenes moments, memories, announcements, and other creative things I’m working on.\n\n"+
    "I also want this to be more than just a place where I post updates. Your support, conversations, and participation are what help make a community feel like a community.\n\n"+
    "Feel free to join the conversation, share your thoughts, and support fellow members — while always remembering that everyone here deserves to be treated with kindness and respect.\n\n"+
    "📌 **Before You Get Started**\n\n"+
    "Please take a moment to read the community rules before posting or participating.\n\n"+
    "The rules are here to help keep this a positive, respectful, welcoming, and enjoyable space for everyone.\n\n"+
    "Thank you for taking the time to be here and for supporting my books, stories, and creative journey.\n\n"+
    "I’m excited to have you along for the journey. 📚❤️\n\n— Brandon"
   )
   .setFooter({text:"BBS:AUTO:WELCOME"});
  await upsertEmbedMessage(welcome,"BBS:AUTO:WELCOME",welcomeEmbed).catch(e=>console.warn("WELCOME MESSAGE FAILED:",e.message));
 }

 const rules=guild.channels.cache.find(x=>x.name==="📜・rules");
 if(rules){
  const rulesEmbed=new EmbedBuilder()
   .setTitle("📜 Brandon Books & Stories — Community Rules")
   .setDescription(
    "Welcome! ❤️ These simple rules help keep our community friendly, respectful, and enjoyable for everyone.\n\n"+
    "**1. 🤝 Be Respectful**\nTreat everyone with kindness. Disagreements are okay; harassment, insults, bullying, and personal attacks are not.\n\n"+
    "**2. ❤️ Keep It Welcoming**\nHelp create a positive environment where everyone feels comfortable participating.\n\n"+
    "**3. 🚫 No Harassment or Spam**\nNo harassment, threats, excessive tagging, spam, scams, or unwanted promotional messages.\n\n"+
    "**4. 💬 Keep Discussions Constructive**\nShare your opinions and feedback respectfully. Keep conversations relevant and avoid unnecessary arguments.\n\n"+
    "**5. 🔒 Respect Privacy**\nNever share someone else's private or personal information without permission.\n\n"+
    "**6. 📢 No Unapproved Promotion**\nDon't advertise, promote, or post unrelated links without permission.\n\n"+
    "**7. 🛡️ Follow Discord's Rules**\nYou must follow the Discord Terms of Service and Community Guidelines as well as these community rules.\n\n"+
    "📩 **Need Help?**\nIf you have a question, concern, or need to report a problem, contact the community staff through the designated support/contact method rather than starting an argument publicly.\n\n"+
    "⚖️ **Appeals**\nIf you believe you received a warning, restriction, or removal unfairly, you may contact community staff privately to request an appeal.\n\n"+
    "Please include:\n• Your Discord username\n• What happened\n• Any relevant details or screenshots\n• Why you believe the action should be reconsidered\n\n"+
    "Appeals will be reviewed based on the information available. Please do not repeatedly submit the same appeal or harass staff about a decision.\n\n"+
    "❤️ **Our Goal**\nThese rules aren't here to make the community feel strict. They're here to help protect the people, conversations, stories, and memories that make this community special.\n\n"+
    "Thank you for being part of Brandon Books & Stories! 📚❤️"
   )
   .setFooter({text:"BBS:AUTO:RULES"});
  await upsertEmbedMessage(rules,"BBS:AUTO:RULES",rulesEmbed).catch(e=>console.warn("RULES MESSAGE FAILED:",e.message));
 }
}
client.once("ready",async()=>{
 discordReady=true;
 console.log("BOOKS & STORIES READY: "+client.user.tag+" | Guilds: "+client.guilds.cache.size);
 client.user.setPresence({activities:[{name:"Books & Stories 📖",type:ActivityType.Watching}],status:"online"});
 try{
  const rest=new REST({version:"10"}).setToken(token);
  for(const guild of client.guilds.cache.values()){
   try{
    await rest.put(Routes.applicationGuildCommands(client.user.id,guild.id),{body:commands});
    const registered=await rest.get(Routes.applicationGuildCommands(client.user.id,guild.id));
    const names=Array.isArray(registered)?registered.map(x=>"/"+x.name).join(", "):"unknown";
    console.log("GUILD SLASH COMMANDS REGISTERED: "+guild.name+" ("+guild.id+") => "+names);
   }catch(e){
    console.error("GUILD COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);
   }
  }
  try{
   await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
   console.log("GLOBAL SLASH COMMANDS REGISTERED.");
  }catch(e){
   console.error("GLOBAL COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);
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
  if(i.commandName==="ping"){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   return i.editReply("🏓 Pong! The bot is online and responding.");
  }
  if(i.commandName==="apply"){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   return i.editReply({
    content:"📋 **Brandon Books & Stories Applications**\n\nChoose the type of application you want to submit below. Your application will be sent to a private staff review channel.",
    components:[applicationMenu()]
   });
  }
  if(i.commandName==="setup-author-server"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can run setup.",flags:MessageFlags.Ephemeral});
   await i.deferReply({flags:MessageFlags.Ephemeral});
   await i.editReply("🔎 **Books & Stories setup starting...**");
   try{
    await withTimeout(setup(i.guild),"setting up the server");
    await i.editReply("✅ **Books & Stories server setup is complete.**");
   }catch(e){
    console.error("SETUP FAILED:",e);
    await i.editReply("❌ **Setup failed:** "+(e.message||String(e))).catch(()=>{});
   }
   return;
  }
  if(i.commandName==="help")return i.reply({embeds:[new EmbedBuilder().setTitle("📖 Brandon Books & Stories").setDescription("**Community & Information**\n📚 `/books` — View the books and purchase links\n🌐 `/website` — Open the author website\n🖥️ `/serverinfo` — View server information\n\n**Community**\n📋 `/apply` — Submit a private application\n🛠️ `/setup-author-server` — Repair the server structure *(owner/staff setup only)*\n\n**Bot**\n🏓 `/ping` — Check bot response\n❓ `/help` — Show this help menu").setFooter({text:"📖 Real Stories • Bigger Purpose"})],flags:MessageFlags.Ephemeral});
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
