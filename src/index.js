require("dotenv").config();
const http = require("node:http");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType, MessageFlags } = require("discord.js");
const { applicationMenu, handleApplicationInteraction } = require("./applications");
const { reviewMenu, feedbackModal, handleReviewInteraction, handleReviewWebhook } = require("./reviews");
const { logStaffEvent, logServerEvent, upsertStaffDashboard } = require("./staff");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || "";
const WEBSITE_URL = process.env.WEBSITE_URL || "https://brandon-books-stories-bot-website.vercel.app/";
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "";
const AMAZON_SECRET = process.env.AMAZON_REVIEW_WEBHOOK_SECRET || "";

if (!TOKEN || TOKEN === "your_bot_token_here") {
  console.error("Missing DISCORD_TOKEN. Add it privately in your hosting panel environment variables.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const commandList = [
  new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot response."),
  new SlashCommandBuilder().setName("books").setDescription("Browse the book series."),
  new SlashCommandBuilder().setName("recommend").setDescription("Get a reading recommendation.").addStringOption(o => o.setName("theme").setDescription("Reading theme").setRequired(false).addChoices({name:"Family and memories",value:"family"},{name:"Growth and life lessons",value:"growth"},{name:"Looking ahead",value:"future"})),
  new SlashCommandBuilder().setName("about").setDescription("About Brandon Books & Stories."),
  new SlashCommandBuilder().setName("aboutmedia").setDescription("Official website and media information."),
  new SlashCommandBuilder().setName("community").setDescription("How to participate in the community."),
  new SlashCommandBuilder().setName("website").setDescription("Get the official website."),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Information about this server."),
  new SlashCommandBuilder().setName("announce").setDescription("Post an announcement (owner only).").addStringOption(o => o.setName("message").setDescription("Announcement").setRequired(true)),
  new SlashCommandBuilder().setName("authorupdate").setDescription("Post an author update (owner only).").addStringOption(o => o.setName("message").setDescription("Update").setRequired(true)),
  new SlashCommandBuilder().setName("giveaway").setDescription("Announce a giveaway (owner only).").addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true)).addStringOption(o => o.setName("details").setDescription("Entry instructions and closing time").setRequired(true)),
  new SlashCommandBuilder().setName("promotion").setDescription("Post a book promotion (owner only).").addStringOption(o => o.setName("details").setDescription("Promotion details").setRequired(true)),
  new SlashCommandBuilder().setName("publishingupdate").setDescription("Post a publishing update (owner only).").addStringOption(o => o.setName("message").setDescription("Update").setRequired(true)),
  new SlashCommandBuilder().setName("readerprompt").setDescription("Post a reader discussion prompt (staff only).").addStringOption(o => o.setName("question").setDescription("Question").setRequired(true)),
  new SlashCommandBuilder().setName("setup-author-server").setDescription("Create missing standard server roles and channels (owner only)."),
  new SlashCommandBuilder().setName("staff").setDescription("Refresh the private staff dashboard."),
  new SlashCommandBuilder().setName("apply").setDescription("Start a private community application."),
  new SlashCommandBuilder().setName("review").setDescription("Submit a reader review."),
  new SlashCommandBuilder().setName("feedback").setDescription("Send private feedback to staff."),
  new SlashCommandBuilder().setName("amazonreview").setDescription("Post a verified Amazon review alert (owner only).").addStringOption(o => o.setName("book").setDescription("Book title").setRequired(true)).addIntegerOption(o => o.setName("rating").setDescription("Rating 1 to 5").setRequired(true).setMinValue(1).setMaxValue(5)).addStringOption(o => o.setName("url").setDescription("Public HTTPS URL").setRequired(true)).addStringOption(o => o.setName("details").setDescription("Optional details").setRequired(false))
].map(c => c.toJSON());

function isOwner(i) {
  return Boolean(OWNER_ID && i.user.id === OWNER_ID) || Boolean(i.guild && i.guild.ownerId === i.user.id);
}
function isStaff(i) {
  if (isOwner(i)) return true;
  return Boolean(i.member?.roles?.cache?.some(r => ["👑 Owner", "🛠️ Administrator", "🛡️ Moderator", "✍️ Author Team"].includes(r.name)));
}
function isHttpsUrl(value) { try { return new URL(value).protocol === "https:"; } catch { return false; } }
function embed(title, description) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description).setFooter({text:"Brandon Books & Stories • 📖 Real Stories • Bigger Purpose"});
}
async function postInCurrentChannel(i, title, body) {
  if (!i.channel?.isTextBased()) return i.reply({content:"Use this command in a text channel.",flags:MessageFlags.Ephemeral});
  await i.channel.send({embeds:[embed(title,body).setTimestamp()]});
  await i.reply({content:"✅ Posted.",flags:MessageFlags.Ephemeral});
}
async function ensureRole(guild, name, color) {
  if (!guild.roles.cache.some(r => r.name === name)) await guild.roles.create({name,color,reason:"Brandon Books & Stories setup"});
}
async function ensureCategory(guild, name) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name) ||
    await guild.channels.create({name,type:ChannelType.GuildCategory,reason:"Brandon Books & Stories setup"});
}
async function ensureChannel(guild, name, parent) {
  let c = guild.channels.cache.find(x => x.type === ChannelType.GuildText && x.name === name);
  if (!c) c = await guild.channels.create({name,type:ChannelType.GuildText,parent:parent.id,reason:"Brandon Books & Stories setup"});
  else if (c.parentId !== parent.id) await c.setParent(parent.id).catch(()=>{});
}
async function setupServer(guild) {
  for (const [n,c] of [["👑 Owner",0xF1C40F],["🛠️ Administrator",0xE74C3C],["🛡️ Moderator",0x3498DB],["✍️ Author Team",0x9B59B6],["📚 Book Reviewer",0x2ECC71],["📖 Reader",0x95A5A6]]) await ensureRole(guild,n,c);
  const community = await ensureCategory(guild,"📖 BOOKS & STORIES");
  const staff = await ensureCategory(guild,"🔒 STAFF");
  const logs = await ensureCategory(guild,"📋 LOGS");
  for (const n of ["👋・welcome","📢・announcements","📚・book-discussion","⭐・reader-reviews","💡・reader-feedback","📋・bot-updates","⭐・amazon-reviews"]) await ensureChannel(guild,n,community);
  await ensureChannel(guild,"🔒・staff",staff);
  await ensureChannel(guild,"🛠️・staff-logs",logs);
  await ensureChannel(guild,"📊・server-logs",logs);
  await upsertStaffDashboard(guild);
  await logServerEvent(guild,"✅ Setup Complete","Standard Books & Stories roles, categories, and channels are ready.",0x57F287);
}

client.once("ready", async () => {
  console.log("Logged in as " + client.user.tag);
  try {
    const rest = new REST({version:"10"}).setToken(TOKEN);
    if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(client.user.id,GUILD_ID),{body:commandList});
    else await rest.put(Routes.applicationCommands(client.user.id),{body:commandList});
    console.log("Registered " + commandList.length + " slash commands.");
  } catch (e) { console.error("Command registration failed:",e); }
  for (const g of client.guilds.cache.values()) await logServerEvent(g,"🤖 Bot Online","Brandon Books & Stories bot is online.",0x57F287);
});

client.on("interactionCreate", async i => {
  try {
    if (await handleApplicationInteraction(i)) return;
    if (await handleReviewInteraction(i)) return;
    if (!i.isChatInputCommand()) return;
    const n = i.commandName;
    if (n === "ping") return i.reply({content:"🏓 Pong! Gateway latency: " + client.ws.ping + " ms.",flags:MessageFlags.Ephemeral});
    if (n === "help") return i.reply({embeds:[embed("📖 Brandon Books & Stories — Help","**Reader:** /books, /recommend, /about, /aboutmedia, /community, /website, /serverinfo, /review, /feedback, /apply, /ping\\n\\n**Staff:** /staff, /readerprompt\\n\\n**Owner:** /announce, /authorupdate, /giveaway, /promotion, /publishingupdate, /amazonreview, /setup-author-server")] ,flags:MessageFlags.Ephemeral});
    if (n === "books") return i.reply({embeds:[embed("📚 My Life Story With Grandma","**Book 1:** Foundations\\n**Part 2:** Continuing the Journey\\n**Book 3:** The Journey Continues\\n**Part 4:** The Memories We Carry Forward\\n**Part 5:** The Journey Continues\\n\\nOfficial information and links: " + WEBSITE_URL)]});
    if (n === "recommend") {
      const t=i.options.getString("theme")||"family";
      const m={family:"Start with **Book 1: Foundations**, the beginning of the family story and memories.",growth:"Try **Book 3: The Journey Continues**, about growing, building, remembering, and looking ahead.",future:"Try **Part 4: The Memories We Carry Forward**, about carrying love and memories into the road ahead."};
      return i.reply({embeds:[embed("📖 Reading Recommendation",m[t]||m.family)]});
    }
    if (n === "about") return i.reply({embeds:[embed("✍️ About Brandon Books & Stories","Brandon D. Coleman Jr. shares personal storytelling, family memories, life lessons, and creative projects through the My Life Story With Grandma series.\\n\\n"+WEBSITE_URL)]});
    if (n === "aboutmedia") return i.reply({embeds:[embed("🌐 Official Media","Website: "+WEBSITE_URL+"\\nUse the official website and server announcements for current links and updates.")]});
    if (n === "community") return i.reply({embeds:[embed("🤝 Join the Community","Discuss books, submit a review with /review, send private feedback with /feedback, or apply to help with /apply. Please be respectful and protect private information.")]});
    if (n === "website") return i.reply({content:"📖 Brandon Books & Stories: "+WEBSITE_URL});
    if (n === "serverinfo") return i.reply({embeds:[embed("ℹ️ Server Information","**Server:** "+i.guild.name+"\\n**Members:** "+i.guild.memberCount+"\\n**Created:** <t:"+Math.floor(i.guild.createdTimestamp/1000)+":D>")]});
    if (["announce","authorupdate","publishingupdate"].includes(n)) {
      if (!isOwner(i)) return i.reply({content:"🔒 Owner only.",flags:MessageFlags.Ephemeral});
      const titles={announce:"📢 Official Announcement",authorupdate:"✍️ Author Update",publishingupdate:"📚 Publishing Update"};
      await postInCurrentChannel(i,titles[n],i.options.getString("message",true));
      await logStaffEvent(i.guild,titles[n],"Posted by <@"+i.user.id+">.");
      return;
    }
    if (n === "giveaway" || n === "promotion") {
      if (!isOwner(i)) return i.reply({content:"🔒 Owner only.",flags:MessageFlags.Ephemeral});
      const body=n==="giveaway" ? "🎁 Prize: "+i.options.getString("prize",true)+"\\n\\n"+i.options.getString("details",true)+"\\n\\nWinner selection is manual." : i.options.getString("details",true)+"\\n\\n"+WEBSITE_URL;
      return postInCurrentChannel(i,n==="giveaway"?"🎉 Giveaway":"📣 Book Promotion",body);
    }
    if (n === "readerprompt") {
      if (!isStaff(i)) return i.reply({content:"🔒 Authorized staff only.",flags:MessageFlags.Ephemeral});
      return postInCurrentChannel(i,"💬 Reader Discussion Prompt",i.options.getString("question",true));
    }
    if (n === "setup-author-server") {
      if (!isOwner(i)) return i.reply({content:"🔒 Server owner or configured bot owner only.",flags:MessageFlags.Ephemeral});
      await i.deferReply({flags:MessageFlags.Ephemeral});
      await setupServer(i.guild);
      return i.editReply("✅ Server structure is ready. Existing channels were preserved; missing standard roles and channels were created.");
    }
    if (n === "staff") {
      if (!isStaff(i)) return i.reply({content:"🔒 Authorized staff only.",flags:MessageFlags.Ephemeral});
      await upsertStaffDashboard(i.guild);
      return i.reply({content:"🔒 Staff dashboard refreshed. Check the private staff channel.",flags:MessageFlags.Ephemeral});
    }
    if (n === "apply") return i.reply({content:"Choose your application type:",components:[applicationMenu()],flags:MessageFlags.Ephemeral});
    if (n === "review") return i.reply({content:"Choose the book you want to review:",components:[reviewMenu()],flags:MessageFlags.Ephemeral});
    if (n === "feedback") return i.showModal(feedbackModal());
    if (n === "amazonreview") {
      if (!isOwner(i)) return i.reply({content:"🔒 Owner only.",flags:MessageFlags.Ephemeral});
      const book=i.options.getString("book",true), rating=i.options.getInteger("rating",true), url=i.options.getString("url",true);
      if (!isHttpsUrl(url)) return i.reply({content:"Please provide a public HTTPS URL.",flags:MessageFlags.Ephemeral});
      const ch=i.guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="⭐・amazon-reviews");
      if (!ch) return i.reply({content:"Channel ⭐・amazon-reviews not found. Run /setup-author-server first.",flags:MessageFlags.Ephemeral});
      const details=i.options.getString("details")||"No additional details provided.";
      const e=embed("⭐ Amazon Review Alert",details).addFields({name:"📚 Book",value:book.slice(0,1024)},{name:"⭐ Rating",value:"⭐".repeat(rating)+"☆".repeat(5-rating)+" ("+rating+"/5)",inline:true},{name:"🔗 Public Link",value:url.slice(0,1024)}).setTimestamp();
      await ch.send({embeds:[e]});
      return i.reply({content:"✅ Review alert posted in "+ch.toString()+".",flags:MessageFlags.Ephemeral});
    }
  } catch (e) {
    console.error("Interaction handler failed:",e);
    if (i.isRepliable()&&!i.replied&&!i.deferred) await i.reply({content:"❌ Something went wrong. Please try again or contact the server owner.",flags:MessageFlags.Ephemeral}).catch(()=>{});
    else if (i.isRepliable()&&i.deferred) await i.editReply("❌ Something went wrong. Please contact the server owner.").catch(()=>{});
  }
});

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url||"/","http://localhost");
  if (req.method==="GET" && ["/","/health","/api/health"].includes(url.pathname)) {
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true,service:"Brandon Books & Stories Discord Bot",botReady:client.isReady(),uptimeSeconds:Math.floor(process.uptime())}));
  }
  if (req.method==="POST" && url.pathname==="/reviews/webhook") return handleReviewWebhook(req,res,client.guilds.cache);
  if (req.method==="POST" && url.pathname==="/amazon-reviews/webhook") {
    if (!AMAZON_SECRET) { res.writeHead(503,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:"AMAZON_REVIEW_WEBHOOK_SECRET is not configured"})); }
    if (req.headers["x-amazon-review-secret"]!==AMAZON_SECRET) { res.writeHead(401,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:"Unauthorized"})); }
    try {
      let body=""; for await (const chunk of req) { body+=chunk.toString(); if(body.length>100000) throw new Error("Payload too large."); }
      const d=JSON.parse(body||"{}"), rating=Number(d.rating), book=String(d.book||"").trim(), link=String(d.url||"").trim();
      if(!book||!Number.isInteger(rating)||rating<1||rating>5||!isHttpsUrl(link)) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:"Required fields: book, rating 1-5, and HTTPS url."})); }
      const results=[];
      for(const g of client.guilds.cache.values()) {
        const ch=g.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="⭐・amazon-reviews");
        if(!ch){results.push({guild:g.id,ok:false,error:"Review channel not found"});continue;}
        try { const e=embed("⭐ Amazon Review Alert",String(d.review||d.title||"A review notification was received.").slice(0,4000)).addFields({name:"📚 Book",value:book.slice(0,1024)},{name:"⭐ Rating",value:"⭐".repeat(rating)+"☆".repeat(5-rating)+" ("+rating+"/5)",inline:true},{name:"🔗 Public Link",value:link.slice(0,1024)}).setTimestamp(); await ch.send({embeds:[e]}); results.push({guild:g.id,ok:true,channelId:ch.id}); }
        catch(e){results.push({guild:g.id,ok:false,error:e.message||String(e)});}
      }
      const ok=results.some(x=>x.ok); res.writeHead(ok?200:400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok,results}));
    } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false,error:e.message||"Invalid JSON payload"})); }
  }
  res.writeHead(404,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:false,error:"Not found"}));
});
server.listen(PORT,"0.0.0.0",()=>console.log("Health/webhook server listening on port "+PORT));
client.login(TOKEN).catch(e=>{console.error("Discord login failed. Check DISCORD_TOKEN in hosting environment:",e.message||e);process.exit(1);});
process.on("unhandledRejection",e=>console.error("Unhandled promise rejection:",e));
process.on("uncaughtException",e=>console.error("Uncaught exception:",e));
