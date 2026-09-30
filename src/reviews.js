const {
  ActionRowBuilder,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,
  TextInputStyle,EmbedBuilder,ChannelType,MessageFlags
}=require("discord.js");

const BOOKS={
  "book-1":"My Life Story With Grandma",
  "part-2":"My Life Story With Grandma — Part 2: Continuing the Journey, Memories, and the Road Ahead"
};

function reviewMenu(){
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("review-book")
      .setPlaceholder("Choose a book to review")
      .addOptions(
        {label:"My Life Story With Grandma",value:"book-1",description:"Share your thoughts on Book 1.",emoji:"📖"},
        {label:"Part 2",value:"part-2",description:"Review the continuing journey.",emoji:"📕"}
      )
  );
}

function reviewModal(bookKey){
  const modal=new ModalBuilder().setCustomId("review-modal:"+bookKey).setTitle("Reader Review");
  const rating=new TextInputBuilder().setCustomId("rating").setLabel("Rating (1-5)").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(1);
  const review=new TextInputBuilder().setCustomId("review").setLabel("Your review").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1500);
  const favorite=new TextInputBuilder().setCustomId("favorite").setLabel("Favorite part (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(800);
  modal.addComponents(
    new ActionRowBuilder().addComponents(rating),
    new ActionRowBuilder().addComponents(review),
    new ActionRowBuilder().addComponents(favorite)
  );
  return modal;
}

function feedbackModal(){
  const modal=new ModalBuilder().setCustomId("feedback-modal").setTitle("Private Community Feedback");
  const category=new TextInputBuilder().setCustomId("category").setLabel("Feedback type").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder("Idea, issue, suggestion, etc.");
  const message=new TextInputBuilder().setCustomId("message").setLabel("Your feedback").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(2000);
  modal.addComponents(new ActionRowBuilder().addComponents(category),new ActionRowBuilder().addComponents(message));
  return modal;
}

function staffChannel(guild){
  return guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="🔒・staff");
}

async function handleReviewInteraction(i){
  if(i.isStringSelectMenu()&&i.customId==="review-book"){
    await i.showModal(reviewModal(i.values[0]));
    return true;
  }
  if(i.isModalSubmit()&&i.customId.startsWith("review-modal:")){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const bookKey=i.customId.split(":")[1];
    const bookName=BOOKS[bookKey]||"Book";
    const ratingText=i.fields.getTextInputValue("rating").trim();
    const rating=Number(ratingText);
    if(!Number.isInteger(rating)||rating<1||rating>5){
      await i.editReply("❌ Please enter a rating from **1 to 5** and submit the review again.");
      return true;
    }
    const review=i.fields.getTextInputValue("review").trim();
    const favorite=i.fields.getTextInputValue("favorite").trim()||"Not provided.";
    const channel=i.guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name==="⭐・reader-reviews");
    if(!channel){
      await i.editReply("❌ The ⭐・reader-reviews channel could not be found. Please contact staff.");
      return true;
    }
    const stars="⭐".repeat(rating)+"☆".repeat(5-rating);
    const embed=new EmbedBuilder()
      .setTitle("⭐ New Reader Review")
      .setDescription(review)
      .addFields(
        {name:"📚 Book",value:bookName,inline:false},
        {name:"⭐ Rating",value:stars+" ("+rating+"/5)",inline:true},
        {name:"❤️ Favorite Part",value:favorite,inline:false}
      )
      .setAuthor({name:i.user.displayName||i.user.username,iconURL:i.user.displayAvatarURL()})
      .setFooter({text:"Brandon Books & Stories • Reader Review"})
      .setTimestamp();
    await channel.send({embeds:[embed]});
    await i.editReply("✅ Thank you! Your review has been posted in <#"+channel.id+">.");
    return true;
  }
  if(i.isModalSubmit()&&i.customId==="feedback-modal"){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const channel=staffChannel(i.guild);
    if(!channel){
      await i.editReply("❌ The private staff channel could not be found. Please contact the server owner.");
      return true;
    }
    const category=i.fields.getTextInputValue("category").trim();
    const message=i.fields.getTextInputValue("message").trim();
    const embed=new EmbedBuilder()
      .setTitle("💡 Private Reader Feedback")
      .setDescription(message)
      .addFields(
        {name:"Category",value:category,inline:true},
        {name:"From",value:i.user.tag,inline:true},
        {name:"User ID",value:i.user.id,inline:true}
      )
      .setFooter({text:"Brandon Books & Stories • Private Feedback"})
      .setTimestamp();
    await channel.send({embeds:[embed]});
    await i.editReply("✅ Your feedback was sent privately to the Brandon Books & Stories staff team. Thank you for helping improve the community.");
    return true;
  }
  return false;
}

module.exports={reviewMenu,feedbackModal,handleReviewInteraction};
