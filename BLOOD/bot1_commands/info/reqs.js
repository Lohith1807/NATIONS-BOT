const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reqs')
        .setDescription('Displays the clan requirements and rules'),

    async execute(interaction) {
        const description = `### **The Basics & Activity** ${getEmoji('clancastle')}

* **Town Hall:** TH14+ ${getEmoji('th14')} ${getEmoji('th15')} ${getEmoji('th16')} ${getEmoji('th17')} ${getEmoji('th18')}
* **Clan Games:** Hit that **4,000 point** max every season! ${getEmoji('dart')}
* **Clan Capital:** Use all **6/6 attacks** on Raid Weekends. ${getEmoji('cocfight')}

**Troops Minimums** ${getEmoji('drop')}

* **Dragons** (Lvl 8) ${getEmoji('dragon')}, **Valkyries** (Lvl 8) ${getEmoji('valkk')}, and **Goblins** (Lvl 7) ${getEmoji('gob')}
* *Note: If you don't meet these yet, just make them your top upgrade priority!* ${getEmoji('uparrow')}

**War & Strikes** ${getEmoji('cocfight')}

* **Lose Wars:** Please follow the plan. 3-starring a lose war = **1 Strike** ${getEmoji('bluex')}
* **Mirror Attacks:** Stealing a clanmate's mirror base before the cleanup period (the last 8 hours of war) = **1 Strike** ${getEmoji('bluex')}. Let everyone have a chance at their own mirror first! ${getEmoji('alaram')}
* **5 Strikes in a month:** Potential kick . Let's keep it fair for everyone! ${getEmoji('mem')}`;

        const embed = new EmbedBuilder()
            .setTitle('Clan Requirements & Rules')
            .setDescription(description)
            .setColor('#2ECC71')
            .setFooter({ text: 'Blood Alliance', iconURL: interaction.guild?.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
