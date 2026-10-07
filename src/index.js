const http=require("http");
const PORT=process.env.PORT||8080;
http.createServer((req,res)=>{
 if(req.method==="POST"&&req.url==="/social/webhook"){
  return handleSocialWebhook(req,res,client.guilds.cache);
 }
 res.writeHead(200,{"Content-Type":"text/plain"});
 res.end("Brandon Books & Stories bot is online.\n");
}).listen(PORT,"0.0.0.0",()=>console.log("Health server listening on "+PORT));
require("dotenv").config();
const {Client,GatewayIntentBits,ChannelType,EmbedBuilder,ActivityType,REST,Routes,SlashCommandBuilder,PermissionFlagsBits,MessageFlags}=require("discord.js");
const {applicationMenu,handleApplicationInteraction}=require("./applications");
const {reviewMenu,feedbackModal,handleReviewInteraction}=require("./reviews");
const {handleSocialWebhook}=require("./socialFeed");
const {startMetricoolBridge}=require("./metricoolBridge");

const token=process.env.DISCORD_TOKEN;
if(!token){console.error("STARTUP FAILED: DISCORD_TOKEN is missing.");process.exit(1);}

const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]});
let discordReady=false;

client.on("error",e=>console.error("DISCORD CLIENT ERROR:",e));
client.on("warn",m=>console.warn("DISCORD WARNING:",m));
client.on("shardError",e=>console.error("DISCORD SHARD ERROR:",e));
client.on("debug",m=>{
 if(typeof m==="string" && /token/i.test(m))return;
 console.log("DISCORD DEBUG:",m);
});

const commands=[
 new SlashCommandBuilder().setName("setup-author-server").setDescription("Create or repair the Books & Stories server structure."),
 new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
 new SlashCommandBuilder().setName("books").setDescription("Show Brandon's books and reading information."),
 new SlashCommandBuilder().setName("about").setDescription("Learn about Brandon and Books & Stories."),
 new SlashCommandBuilder().setName("aboutmedia").setDescription("Show official Brandon Books & Stories media links."),
 new SlashCommandBuilder().setName("community").setDescription("Show what you can do in the Books & Stories community."),
 new SlashCommandBuilder().setName("announce").setDescription("Post an official community announcement."),
 new SlashCommandBuilder().setName("promotion").setDescription("Post the current My Life Story With Grandma promotion."),
 new SlashCommandBuilder().setName("publishingupdate").setDescription("Post the latest My Life Story With Grandma publishing update."),
 new SlashCommandBuilder().setName("website").setDescription("Show the author website."),
 new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
 new SlashCommandBuilder().setName("ping").setDescription("Check whether the bot is responding."),
 new SlashCommandBuilder().setName("apply").setDescription("Submit a private Books & Stories community application."),
 new SlashCommandBuilder().setName("review").setDescription("Submit a reader review for one of Brandon's books."),
 new SlashCommandBuilder().setName("feedback").setDescription("Send private feedback to the Books & Stories staff.")
].map(x=>x.toJSON());

const structure={
"📌 START HERE":["👋・welcome","📜・rules","📢・announcements","📰・latest-updates"],
"📚 BOOKS":["📖・my-life-story-with-grandma","📕・part-2","🛒・where-to-buy","⭐・reader-reviews"],
"✍️ THE AUTHOR":["👤・about-brandon","✍️・writing-journey","🌅・family-and-memories","📸・behind-the-books"],
"💬 COMMUNITY":["💬・general","📚・book-discussion","❤️・memories","💡・reader-ideas","🎉・community"],
"📺 MEDIA":["📖・about-media","📱・social-media","▶️・youtube","📸・instagram","📘・facebook","🎵・music-projects"],
"🤖 BOT":["🤖・bot-commands","📋・bot-updates"],
"🔒 STAFF":["🔒・staff","🛠️・staff-logs","📊・server-logs"]
};
const roles=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team","⭐ VIP Customer","📚 Reader","⭐ VIP Reader","🤖 Bot"];

const roleColors={
 "👑 Owner":"#F1C40F",
 "🛠️ Administrator":"#E74C3C",
 "🛡️ Moderator":"#3498DB",
 "✍️ Author Team":"#9B59B6",
 "⭐ VIP Customer":"#F39C12",
 "📚 Reader":"#2ECC71",
 "⭐ VIP Reader":"#E91E63",
 "🤖 Bot":"#5865F2",
 "Staff":"#F1C40F"
};

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

async function cleanupDuplicateStructure(guild,me){
 const cleanupErrors=[];
 for(const [catName,names] of Object.entries(structure)){
  const categories=[...guild.channels.cache.filter(x=>x.type===ChannelType.GuildCategory&&x.name===catName).values()];
  if(categories.length===0)continue;
  const accessible=categories.filter(x=>x.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel));
  const keep=accessible[0]||categories[0];
  // Remove duplicate channels with the same name, preferring the channel
  // already inside the kept category.
  for(const name of names){
   const matches=[...guild.channels.cache.filter(x=>x.type===ChannelType.GuildText&&x.name===name).values()];
   if(matches.length<=1)continue;
   let keeper=matches.find(x=>x.parentId===keep.id)||matches[0];
   for(const ch of matches){
    if(ch.id===keeper.id)continue;
    try{
     await ch.delete("Books & Stories duplicate channel cleanup");
    }catch(e){
     cleanupErrors.push(explainDiscordError(e,"deleting duplicate channel "+name));
    }
   }
  }
  // Move any required channels from duplicate categories into the kept
  // category, then remove the now-empty duplicate categories.
  for(const duplicate of categories){
   if(duplicate.id===keep.id)continue;
   for(const name of names){
    const ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===duplicate.id);
    if(!ch)continue;
    const target=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===keep.id);
    try{
     if(target && target.id!==ch.id)await ch.delete("Books & Stories duplicate channel cleanup");
     else await ch.setParent(keep.id,{lockPermissions:false,reason:"Books & Stories duplicate category cleanup"});
    }catch(e){
     cleanupErrors.push(explainDiscordError(e,"moving duplicate channel "+name));
    }
   }
   try{
    if(duplicate.deletable)await duplicate.delete("Books & Stories duplicate category cleanup");
   }catch(e){
    cleanupErrors.push(explainDiscordError(e,"deleting duplicate category "+catName));
   }
  }
 }
 if(cleanupErrors.length)console.warn("STRUCTURE CLEANUP WARNINGS:",cleanupErrors.join(" || "));
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
  "⭐ VIP Customer":[],
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
   const desiredColor=roleColors[name];
   if(desiredColor && r.editable && r.hexColor.toUpperCase()!==desiredColor.toUpperCase()){
    await r.setColor(desiredColor,"Books & Stories role color configuration");
   }
  }catch(e){
   console.warn("ROLE CONFIGURATION WARNING:",explainDiscordError(e,"configuring role "+name));
  }
 }

 // Keep the Books & Stories roles below the bot's highest manageable role.
 // Discord will not allow a bot to manage roles at/above its own highest role.
 const hierarchy=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team","⭐ VIP Customer","⭐ VIP Reader","📚 Reader","🤖 Bot"];
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
  "📖・about-media","▶️・youtube","📸・instagram","📘・facebook","🎵・music-projects",
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
 const roleAccess={
  owner:roleMap["👑 Owner"],
  admin:roleMap["🛠️ Administrator"],
  moderator:roleMap["🛡️ Moderator"],
  author:roleMap["✍️ Author Team"],
  vipCustomer:roleMap["⭐ VIP Customer"],
  reader:roleMap["📚 Reader"],
  vipReader:roleMap["⭐ VIP Reader"],
  customBot:roleMap["🤖 Bot"]
 };
 const staffAccessRoles=[
  roleAccess.owner,
  roleAccess.admin,
  roleAccess.moderator,
  roleAccess.author
 ].filter(Boolean);

 // Category/channel permission plan:
 // START HERE, BOOKS, AUTHOR, COMMUNITY and MEDIA are public.
 // BOT is visible to members but bot-updates is read-only.
 // STAFF is private to Owner/Admin/Moderator/Author Team plus the bot.
 const categoryPublicReadOnly=new Set(["📌 START HERE","📚 BOOKS","✍️ THE AUTHOR","📺 MEDIA"]);
 const categoryPublicInteractive=new Set(["💬 COMMUNITY"]);
 await cleanupDuplicateStructure(guild,me);

 const categoryMap={};
 for(const [catName,names] of Object.entries(structure)){
  // Consolidate duplicate categories created by previous setup/recovery runs.
  // Keep one category, move unique channels into it, and remove duplicate
  // channels/categories when the bot has permission to do so.
  const matchingCategories=guild.channels.cache.filter(x=>x.type===ChannelType.GuildCategory&&x.name===catName);
  let cat=matchingCategories.find(x=>x.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel))||matchingCategories.first();
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

  if(matchingCategories.size>1){
   for(const duplicate of matchingCategories.values()){
    if(duplicate.id===cat.id)continue;
    const duplicateChannels=guild.channels.cache.filter(x=>x.type===ChannelType.GuildText&&x.parentId===duplicate.id);
    for(const duplicateChannel of duplicateChannels.values()){
     const target=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===duplicateChannel.name&&x.parentId===cat.id);
     try{
      if(target){
       await duplicateChannel.delete("Books & Stories duplicate channel cleanup");
      }else{
       await duplicateChannel.setParent(cat.id,{lockPermissions:false,reason:"Books & Stories duplicate category cleanup"});
      }
     }catch(e){
      console.warn("DUPLICATE CHANNEL CLEANUP WARNING:",explainDiscordError(e,"cleaning duplicate channel "+duplicateChannel.name));
     }
    }
    try{
     if(duplicate.deletable)await duplicate.delete("Books & Stories duplicate category cleanup");
    }catch(e){
     console.warn("DUPLICATE CATEGORY CLEANUP WARNING:",explainDiscordError(e,"cleaning duplicate category "+catName));
    }
   }
  }

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
    const categoryPermissions=categoryPublicInteractive.has(catName)?publicAllow:publicReadOnly;
    await cat.permissionOverwrites.edit(guild.roles.everyone.id,categoryPermissions);
    await cat.permissionOverwrites.edit(me.id,botAllow);

    // Explicitly keep the staff roles able to manage their community areas.
    for(const role of staffAccessRoles){
     if(!role || role.position>=me.roles.highest.position)continue;
     await cat.permissionOverwrites.edit(role.id,{
      ViewChannel:true,
      ReadMessageHistory:true,
      SendMessages:true,
      EmbedLinks:true,
      ManageMessages:role===roleAccess.owner||role===roleAccess.admin||role===roleAccess.moderator,
      ManageChannels:role===roleAccess.owner||role===roleAccess.admin
     });
    }
   }catch(e){
    console.warn("PUBLIC CATEGORY WARNING:",explainDiscordError(e,"configuring category "+catName));
   }
  }

  for(const name of names){
   // Prefer the intended category. If a duplicate channel exists elsewhere,
   // move it into the intended category instead of creating another copy.
   let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===cat.id);
   if(!ch){
    const elsewhere=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId!==cat.id);
    if(elsewhere){
     try{
      await elsewhere.setParent(cat.id,{lockPermissions:false,reason:"Books & Stories duplicate channel repair"});
      ch=elsewhere;
     }catch(e){
      console.warn("CHANNEL MOVE WARNING:",explainDiscordError(e,"moving duplicate channel "+name));
     }
    }
   }
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

     // Staff can moderate public channels without exposing the private Staff category.
     for(const role of staffAccessRoles){
      if(!role || role.position>=me.roles.highest.position)continue;
      await ch.permissionOverwrites.edit(role.id,{
       ViewChannel:true,
       ReadMessageHistory:true,
       SendMessages:true,
       EmbedLinks:true,
       ManageMessages:role===roleAccess.owner||role===roleAccess.admin||role===roleAccess.moderator,
       ManageChannels:role===roleAccess.owner||role===roleAccess.admin
      });
     }
    }
   }catch(e){
    console.warn("CHANNEL PERMISSION WARNING:",explainDiscordError(e,"configuring channel "+name));
   }
  }
 }

 await cleanupDuplicateStructure(guild,me);

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
client.on("guildMemberAdd",async member=>{
 try{
  const guild=member.guild;
  let vipRole=guild.roles.cache.find(r=>r.name==="⭐ VIP Customer");
  if(!vipRole){
   vipRole=await guild.roles.create({
    name:"⭐ VIP Customer",
    permissions:[],
    color:roleColors["⭐ VIP Customer"],
    reason:"Brandon Books & Stories automatic new-member VIP role"
   });
  }else if(vipRole.editable && roleColors["⭐ VIP Customer"] && vipRole.hexColor.toUpperCase()!==roleColors["⭐ VIP Customer"].toUpperCase()){
   await vipRole.setColor(roleColors["⭐ VIP Customer"],"Brandon Books & Stories automatic VIP Customer role color");
  }
  const me=guild.members.me||await guild.members.fetchMe();
  if(vipRole.editable && !member.roles.cache.has(vipRole.id)){
   await member.roles.add(vipRole,"Brandon Books & Stories automatic VIP Customer role");
  }
  const welcome=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name==="👋・welcome");
  if(!welcome||!welcome.isTextBased())return;
  const embed=new EmbedBuilder()
   .setTitle("🎉 Welcome to Brandon Books & Stories!")
   .setDescription(
    "Welcome, <@"+member.id+">! ❤️\n\n"+
    "We're glad you're here. You've been welcomed as a **⭐ VIP Customer** and can now explore the community, books, stories, memories, and updates.\n\n"+
    "📚 **Start Here**\n"+
    "• Read <#"+(guild.channels.cache.find(x=>x.name==="📜・rules")?.id||"")+">\n"+
    "• Explore the books and community channels\n"+
    "• Watch for new stories, announcements, and projects\n\n"+
    "🌐 **Stay Connected**\n"+
    "📖 Website: https://brandon-books-stories-bot-website.vercel.app/\n"+
    "📸 Instagram: https://www.instagram.com/brandonbooksandstories/\n"+
    "📘 Facebook: https://www.facebook.com/brandon.d.coleman.books\n"+
    "▶️ YouTube: https://youtube.com/@chieifthebcfamily-dispatcher\n\n"+
    "Thank you for joining **Brandon Books & Stories**! 📖❤️"
   )
   .setFooter({text:"📖 Real Stories • Bigger Purpose"});
  await welcome.send({content:"🎉 Welcome <@"+member.id+">! You now have the ⭐ VIP Customer role.",embeds:[embed]});
 }catch(e){
  console.error("NEW MEMBER WELCOME FAILED:",e.code||"unknown",e.message||e);
 }
});

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
  // This bot is intended for the Brandon Books & Stories server.
  // Clear any older global commands so they do not appear alongside the guild commands.
  try{
   await rest.put(Routes.applicationCommands(client.user.id),{body:[]});
   console.log("OLD GLOBAL SLASH COMMANDS CLEARED.");
  }catch(e){
   console.error("GLOBAL COMMAND CLEANUP FAILED:",e.code||"unknown",e.message||e);
  }
 }catch(e){console.error("SLASH COMMAND REGISTRATION FAILED:",e.code||"unknown",e.message||e);}
 startMetricoolBridge(client);
});

client.on("interactionCreate",async i=>{
 console.log("INTERACTION EVENT: "+(i.type||"unknown")+" / "+(i.commandName||"non-command")+" guild="+(i.guildId||"DM"));
 try{
  if(!i.isChatInputCommand()){
   if(await handleReviewInteraction(i))return;
   await handleApplicationInteraction(i);
   return;
  }
  if(!i.guild)return i.reply({content:"This command can only be used in a server.",flags:MessageFlags.Ephemeral});
  if(i.commandName==="ping"){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   return i.editReply("🏓 Pong! The bot is online and responding.");
  }
  if(i.commandName==="review"){
   return i.reply({
    content:"⭐ **Reader Reviews**\\n\\nChoose the book you want to review. Your review will be posted in ⭐・reader-reviews for the community.",
    components:[reviewMenu()],
    flags:MessageFlags.Ephemeral
   });
  }
  if(i.commandName==="feedback"){
   return i.showModal(feedbackModal());
  }
  if(i.commandName==="apply"){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   return i.editReply({
    content:"📋 **Brandon Books & Stories Applications**\n\nChoose the type of application you want to submit below. Your application will be sent to a private staff review channel.",
    components:[applicationMenu()]
   });
  }
  if(i.commandName==="setup-author-server"){
   // Acknowledge the interaction before any permission checks or setup work.
   // This guarantees Discord receives the interaction response immediately.
   await i.deferReply({flags:MessageFlags.Ephemeral});
   if(!allowed(i)){
    await i.editReply("🔒 Only the server owner or configured bot owner can run setup.");
    return;
   }
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
  if(i.commandName==="help")return i.reply({embeds:[new EmbedBuilder().setTitle("📖 Brandon Books & Stories").setDescription("**Community & Information**\n📚 `/books` — View the books and purchase links\n🌐 `/website` — Open the author website\n📖 `/aboutmedia` — Show official media links\n🖥️ `/serverinfo` — View server information\n\n**Community**\n⭐ `/review` — Submit a reader review\n💡 `/feedback` — Send private feedback to staff\n📋 `/apply` — Submit a private application\n🛠️ `/setup-author-server` — Repair the server structure *(owner/staff setup only)*\n📢 `/promotion` — Post the current Book 1 promotion *(owner only)*\n📚 `/publishingupdate` — Post the latest publishing status update *(owner only)*\n\n**Bot**\n🏓 `/ping` — Check bot response\n❓ `/help` — Show this help menu").setFooter({text:"📖 Real Stories • Bigger Purpose"})],flags:MessageFlags.Ephemeral});
  if(i.commandName==="books"){
   const embed=new EmbedBuilder()
    .setTitle("📚 Brandon D. Coleman Jr. — Books")
    .setDescription("Explore the books, stories, memories, and continuing journey behind **Brandon Books & Stories**.")
    .addFields(
     {name:"📖 My Life Story With Grandma",value:process.env.BOOK_1_URL||"Purchase link coming soon."},
     {name:"📕 Part 2",value:"**My Life Story With Grandma — Part 2: Continuing the Journey, Memories, and the Road Ahead**\\n"+(process.env.PART_2_URL||"Purchase link coming soon.")},
     {name:"❤️ The Heart Behind the Books",value:"These books are part of a larger journey of family, memories, storytelling, and preserving meaningful moments."}
    )
    .setFooter({text:"📖 Real Stories • Bigger Purpose"});
   return i.reply({embeds:[embed]});
  }
  if(i.commandName==="about")return i.reply({embeds:[new EmbedBuilder()
   .setTitle("📖 Brandon Books & Stories")
   .setDescription("**Stories. Memories. Creativity. A Journey Worth Sharing.**\\n\\nWelcome to Brandon Books & Stories — the official author brand of **Brandon D. Coleman Jr.**\\n\\nI’m an independent author, storyteller, and creator who believes the experiences we live, the people we love, and the memories we make are worth preserving. Through books, music, videos, and other creative projects, I turn meaningful experiences and ideas into stories that can be shared, remembered, and enjoyed.")
   .addFields(
    {name:"✍️ Meet the Author",value:"I’m Brandon D. Coleman Jr., an independent author, storyteller, and creator. Writing gives me a way to remember, creating gives me a way to express myself, and sharing my work gives me a way to connect with readers. I’m continuing to learn, grow, and build my career one story, project, and chapter at a time."},
    {name:"📚 My Books",value:"**My Life Story With Grandma** is a heartfelt personal story centered around family, memories, love, and the special relationship between a grandson and his grandmother. **Part 2: Continuing the Journey, Memories, and the Road Ahead** continues the story with more memories, experiences, reflections, and the road ahead."},
    {name:"🎵 Creative Projects",value:"My creativity extends beyond books into music, videos, tributes, photography, storytelling, and future projects. **I Miss You Grandma** is an ongoing music project created as a heartfelt way of remembering and honoring my grandma."},
    {name:"🎥 Media",value:"Follow the creative journey through YouTube, Instagram, Facebook, videos, tributes, memories, and other media projects.\\n▶️ YouTube\\n📸 Instagram\\n📘 Facebook"},
    {name:"❤️ Why I Create",value:"Memories matter. Stories matter. People matter. I want meaningful experiences to have a place to live while giving readers a chance to connect with stories that may remind them of their own lives, families, memories, and experiences."},
    {name:"🌱 The Journey Continues",value:"There will be new stories, new books, new creative projects, and another chapter waiting to be written."},
    {name:"🤝 Join the Journey",value:"Read the books, leave an honest review, follow the social pages, discover the creative projects, watch the videos, and join the Brandon Books & Stories community."}
   )
   .setFooter({text:"📖 Real Stories • Bigger Purpose"})],flags:MessageFlags.Ephemeral});
  if(i.commandName==="aboutmedia"){
   const embed=new EmbedBuilder()
    .setTitle("📖 About Media — Brandon Books & Stories")
    .setDescription("Official places to follow Brandon D. Coleman Jr. — Books & Stories.\n\n**📖 Real Stories • Bigger Purpose**")
    .addFields(
     {name:"🌐 Official Website",value:"https://brandon-books-stories-bot-website.vercel.app"},
     {name:"📸 Instagram",value:"https://www.instagram.com/brandonbooksandstories/"},
     {name:"📘 Facebook",value:"https://www.facebook.com/brandon.d.coleman.books"},
     {name:"▶️ YouTube",value:"https://youtube.com/@chieifthebcfamily-dispatcher"},
     {name:"🎵 Creative Projects",value:"Follow the media channels for music, videos, tributes, memories, writing updates, and new projects."},
     {name:"📱 Automatic Updates",value:"New supported social updates are automatically shared in the appropriate media channels when the social bridge is active."}
    )
    .setFooter({text:"Brandon D. Coleman Jr. — Books & Stories"});
   return i.reply({embeds:[embed],flags:MessageFlags.Ephemeral});
  }
  if(i.commandName==="community")return i.reply({embeds:[new EmbedBuilder()
   .setTitle("💬 Brandon Books & Stories Community")
   .setDescription("There is more to the community than announcements. You can take part in the conversation and follow the creative journey.")
   .addFields(
    {name:"📚 Read & Discuss",value:"Talk about the books, stories, memories, and themes shared in the community."},
    {name:"❤️ Share Memories",value:"Share thoughtful memories and experiences while respecting everyone's privacy."},
    {name:"💡 Reader Ideas",value:"Share constructive ideas, feedback, and suggestions for future projects."},
    {name:"✍️ Get Involved",value:"Use /apply when applications are open for Author Team, Moderator, or Book Reviewer roles."}
   )
   .setFooter({text:"📖 Real Stories • Bigger Purpose"})],flags:MessageFlags.Ephemeral});
  if(i.commandName==="announce"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can post official announcements.",flags:MessageFlags.Ephemeral});
   const channel=i.guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name==="📢・announcements");
   if(!channel)return i.reply({content:"❌ The 📢・announcements channel could not be found.",flags:MessageFlags.Ephemeral});
   await i.deferReply({flags:MessageFlags.Ephemeral});
   const embed=new EmbedBuilder()
    .setTitle("📢 Brandon Books & Stories")
    .setDescription("A new official update is available.\\n\\nFollow this channel for books, stories, writing updates, community news, and important announcements.")
    .setFooter({text:"📖 Real Stories • Bigger Purpose"});
   await channel.send({content:"📢 **New Brandon Books & Stories Update**",embeds:[embed]});
   return i.editReply("✅ Official announcement posted in <#"+channel.id+">.");
  }
  if(i.commandName==="publishingupdate"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can post the official publishing update.",flags:MessageFlags.Ephemeral});
   const channel=i.guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name==="📢・announcements");
   if(!channel)return i.reply({content:"❌ The 📢・announcements channel could not be found.",flags:MessageFlags.Ephemeral});
   await i.deferReply({flags:MessageFlags.Ephemeral});
   const embed=new EmbedBuilder()
    .setTitle("📚✨ BIG PUBLISHING UPDATE! ✨📚")
    .setDescription("I’m excited to share the latest progress on my **My Life Story with Grandma** book series! ❤️📖\n\nMore editions are officially live and making their way out into the world. We are getting closer and closer to having the complete collection fully available across formats! 🙏🏾")
    .addFields(
     {name:"📕 BOOK 1 — Foundations",value:"🟢 Hardcover: **PUBLISHED!** ✅"},
     {name:"📗 BOOK 2 — New Horizons",value:"🟢 Kindle: **PUBLISHED!** ✅\n🟢 Paperback: **PUBLISHED!** ✅\n🕐 Hardcover: **DRAFT / SETUP**"},
     {name:"📘 BOOK 3 — The Journey Continues",value:"🟢 Kindle: **PUBLISHED!** ✅\n🟢 Paperback: **PUBLISHED!** ✅\n🕐 Hardcover: **IN REVIEW**"},
     {name:"📙 BOOK 4 — The Memories We Carry Forward",value:"🟢 Kindle: **PUBLISHED!** ✅\n🕐 Paperback: **IN REVIEW**\n🕐 Hardcover: **DRAFT**"},
     {name:"📔 BOOK 5 — Part 5: The Journey Continues",value:"🟢 Kindle: **PUBLISHED!** ✅\n🟢 Paperback: **PUBLISHED!** ✅\n🕐 Hardcover: **COMING SOON**"},
     {name:"⏳ NEXT STEPS",value:"The remaining hardcover editions and drafts are currently being polished and set up so they can join the live lineup very soon."},
     {name:"❤️ Why This Journey Matters",value:"These books are more than just stories — they are memories, family, growth, faith, and a way of honoring my Grandma’s legacy.\n\n🙏🏾 Thank you to everyone who has supported me, followed this journey, purchased a book, shared a post, or simply encouraged me along the way.\n\n📚 More books. More memories. More of the story.\n\n🔥 The journey continues..."}
    )
    .setFooter({text:"Brandon D. Coleman Jr. — Books & Stories • 📖 Real Stories • Bigger Purpose"});
   await channel.send({content:"📢 **BIG PUBLISHING UPDATE!**",embeds:[embed]});
   return i.editReply("✅ Publishing update posted in <#"+channel.id+">.");
  }
  if(i.commandName==="promotion"){
   if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can post the official promotion.",flags:MessageFlags.Ephemeral});
   const channel=i.guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name==="📢・announcements");
   if(!channel)return i.reply({content:"❌ The 📢・announcements channel could not be found.",flags:MessageFlags.Ephemeral});
   await i.deferReply({flags:MessageFlags.Ephemeral});
   const embed=new EmbedBuilder()
    .setTitle("📖 My Life Story With Grandma — A Story Worth Remembering")
    .setDescription("**Real Stories. Real Memories. A Journey Worth Sharing. ❤️**\n\nI didn't write this story just to have a book. I wrote it because some memories deserve to be remembered.\n\n**My Life Story With Grandma — Book 1: Foundations** is part of my journey through family, memories, life experiences, and the love and lessons that helped shape who I am.\n\n❤️ **Some memories deserve to live beyond us.**\n\n📚 Read the book and join Brandon D. Coleman Jr. on the journey.\n🌐 https://brandon-books-stories-bot-website.vercel.app/\n🛒 https://www.amazon.com/dp/B0HL794K8Z")
    .setFooter({text:"Brandon D. Coleman Jr. — Books & Stories • 📖 Real Stories • Bigger Purpose"});
   await channel.send({content:"📢 **A Story Worth Remembering**",embeds:[embed]});
   return i.editReply("✅ The current book promotion was posted in <#"+channel.id+">.");
  }
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
