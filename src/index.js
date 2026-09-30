const http=require("http");
const PORT=process.env.PORT||8080;
http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/plain"});res.end("Brandon Books & Stories bot is online.\n");}).listen(PORT,"0.0.0.0",()=>console.log("Health server listening on "+PORT));
require("dotenv").config();
const {Client,GatewayIntentBits,ChannelType,EmbedBuilder,ActivityType,REST,Routes,SlashCommandBuilder}=require("discord.js");
const token=process.env.DISCORD_TOKEN;
if(!token){console.error("DISCORD_TOKEN is missing.");process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]});
const commands=[
 new SlashCommandBuilder().setName("setup-author-server").setDescription("Create or repair the Books & Stories server structure."),
 new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
 new SlashCommandBuilder().setName("books").setDescription("Show the author's books."),
 new SlashCommandBuilder().setName("website").setDescription("Show the author website."),
 new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information.")
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

async function setup(guild){
 const roleMap={};
 for(const name of roles){
  let r=guild.roles.cache.find(x=>x.name===name);
  if(!r) r=await guild.roles.create({name,reason:"Books & Stories bot setup"});
  roleMap[name]=r;
 }
 for(const [catName,names] of Object.entries(structure)){
  let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name===catName);
  if(!cat) cat=await guild.channels.create({name:catName,type:ChannelType.GuildCategory,reason:"Books & Stories bot setup"});
  for(const name of names){
   let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.name===name&&x.parentId===cat.id);
   if(!ch) ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,reason:"Books & Stories bot setup"});
   if(catName==="🔒 STAFF"){
    await ch.permissionOverwrites.edit(guild.roles.everyone,{ViewChannel:false});
    for(const rn of ["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"])
     await ch.permissionOverwrites.edit(roleMap[rn],{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
   }
  }
 }
 const welcome=guild.channels.cache.find(x=>x.name==="👋・welcome");
 if(welcome){
  await welcome.send({embeds:[new EmbedBuilder().setTitle("📖 Welcome to Brandon D. Coleman Jr. — Books & Stories").setDescription("Welcome to the community for books, stories, memories, writing updates, and creative projects.\n\n📚 Books • ✍️ Stories • ❤️ Memories\n\nPlease read the rules and introduce yourself!").setFooter({text:"📖 Real Stories • Bigger Purpose"})]}).catch(()=>{});
 }
 const rules=guild.channels.cache.find(x=>x.name==="📜・rules");
 if(rules){
  await rules.send({embeds:[new EmbedBuilder().setTitle("📜 Community Rules").setDescription("1. Be respectful.\n2. Keep the community welcoming.\n3. No harassment or spam.\n4. Keep discussions constructive.\n5. Follow Discord Terms and Community Guidelines.")]}).catch(()=>{});
 }
}

client.once("ready",async()=>{
 console.log("Books & Stories bot online as "+client.user.tag);
 client.user.setPresence({activities:[{name:"Books & Stories 📖",type:ActivityType.Watching}],status:"online"});
 const rest=new REST({version:"10"}).setToken(token);
 await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
 console.log("Slash commands registered.");
});

client.on("guildMemberAdd",async member=>{
 const ch=member.guild.channels.cache.find(x=>x.name==="👋・welcome");
 if(ch) await ch.send({content:"👋 Welcome "+member+" to **Brandon D. Coleman Jr. — Books & Stories**! 📖❤️"}).catch(()=>{});
});

client.on("interactionCreate",async i=>{
 if(!i.isChatInputCommand()||!i.guild)return;
 if(i.commandName==="setup-author-server"){
  if(!allowed(i))return i.reply({content:"🔒 Only the server owner or configured bot owner can run setup.",ephemeral:true});
  await i.deferReply({ephemeral:true});
  try{await setup(i.guild);await i.editReply("✅ **Books & Stories server setup is complete.** You can safely run setup again to repair the structure.");}
  catch(e){console.error(e);await i.editReply("❌ Setup failed. Check the bot's Discord permissions.");}
 }
 if(i.commandName==="help")return i.reply({content:"📖 **Books & Stories Bot**\n\n/setup-author-server — Build the server\n/books — Show books\n/website — Show website\n/serverinfo — Server info\n/help — Help",ephemeral:true});
 if(i.commandName==="books")return i.reply({embeds:[new EmbedBuilder().setTitle("📚 Brandon D. Coleman Jr. — Books").setDescription("📖 My Life Story With Grandma\n"+(process.env.BOOK_1_URL||"Book link coming soon.")+"\n\n📕 Part 2: Continuing the Journey, Memories, and the Road Ahead\n"+(process.env.PART_2_URL||"Part 2 link coming soon."))]});
 if(i.commandName==="website")return i.reply({content:process.env.WEBSITE_URL||"🌐 The author website link will be added when it is live.",ephemeral:true});
 if(i.commandName==="serverinfo")return i.reply({content:"🖥️ **"+i.guild.name+"**\nMembers: "+i.guild.memberCount+"\nChannels: "+i.guild.channels.cache.size,ephemeral:true});
});
client.login(token);
