const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getClashUsers, saveClashUsers, getClashClans, saveClashClans } = require('../utils/dataManager');

const TH_LEVELS = {
    1: { maxGold: 5000, maxElixir: 5000, upgradeCost: 0, productionRate: 100 },
    2: { maxGold: 15000, maxElixir: 15000, upgradeCost: 2500, productionRate: 300 },
    3: { maxGold: 50000, maxElixir: 50000, upgradeCost: 10000, productionRate: 1000 },
    4: { maxGold: 200000, maxElixir: 200000, upgradeCost: 40000, productionRate: 2500 },
    5: { maxGold: 1000000, maxElixir: 1000000, upgradeCost: 150000, productionRate: 6000 }
};

const TROOPS = {
    warrior: { name: 'Warrior', attack: 10, cost: 10, thRequired: 1, icon: '🗡️' },
    archer: { name: 'Archer', attack: 25, cost: 30, thRequired: 2, icon: '🏹' },
    brute: { name: 'Brute', attack: 100, cost: 150, thRequired: 3, icon: '🛡️' }
};

function ensureUser(users, userId) {
    if (!users[userId]) {
        users[userId] = {
            townHall: 1,
            gold: 1000,
            elixir: 1000,
            lastCollected: Date.now(),
            troops: { warrior: 0, archer: 0, brute: 0 },
            clan: null,
            trophies: 0,
            shieldEnds: 0
        };
    }
    return users[userId];
}

function calculateDefense(user) {
    let defense = user.townHall * 50; // Base defense
    if (user.troops.warrior) defense += user.troops.warrior * 2;
    if (user.troops.archer) defense += user.troops.archer * 5;
    if (user.troops.brute) defense += user.troops.brute * 20;
    return defense;
}

function calculateOffense(user) {
    let offense = 0;
    if (user.troops.warrior) offense += user.troops.warrior * TROOPS.warrior.attack;
    if (user.troops.archer) offense += user.troops.archer * TROOPS.archer.attack;
    if (user.troops.brute) offense += user.troops.brute * TROOPS.brute.attack;
    return offense;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clash')
        .setDescription('Play the Clash Simulator game!')
        .addSubcommand(sub => sub.setName('profile').setDescription('View your base, resources, and troops'))
        .addSubcommand(sub => sub.setName('collect').setDescription('Collect Gold and Elixir from your collectors'))
        .addSubcommand(sub => sub.setName('upgrade').setDescription('Upgrade your Town Hall to the next level'))
        .addSubcommand(sub => 
            sub.setName('train')
            .setDescription('Train troops using Elixir')
            .addStringOption(opt => 
                opt.setName('troop')
                .setDescription('The type of troop to train')
                .setRequired(true)
                .addChoices(
                    { name: 'Warrior (10 Elixir)', value: 'warrior' },
                    { name: 'Archer (30 Elixir)', value: 'archer' },
                    { name: 'Brute (150 Elixir)', value: 'brute' }
                )
            )
            .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of troops to train').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('attack')
            .setDescription('Attack another player to steal their resources!')
            .addUserOption(opt => opt.setName('target').setDescription('The user to attack').setRequired(true))
        )
        .addSubcommandGroup(group => 
            group.setName('clan')
            .setDescription('Clan management commands')
            .addSubcommand(sub => 
                sub.setName('create')
                .setDescription('Create a new clan (Costs 50,000 Gold)')
                .addStringOption(opt => opt.setName('name').setDescription('The name of your clan').setRequired(true))
            )
            .addSubcommand(sub => 
                sub.setName('join')
                .setDescription('Join an existing clan')
                .addStringOption(opt => opt.setName('name').setDescription('The name of the clan to join').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('leave').setDescription('Leave your current clan'))
            .addSubcommand(sub => sub.setName('info').setDescription('View information about your current clan'))
            .addSubcommand(sub => 
                sub.setName('war')
                .setDescription('Start a clan war against another clan!')
                .addStringOption(opt => opt.setName('target_clan').setDescription('The name of the clan to war against').setRequired(true))
            )
        ),
        
    async execute(interaction) {
        const users = getClashUsers();
        const clans = getClashClans();
        const userId = interaction.user.id;
        const user = ensureUser(users, userId);
        
        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        
        // Auto-collection calculations for active users
        const now = Date.now();
        const minsElapsed = Math.floor((now - user.lastCollected) / 60000);
        
        if (group === 'clan') {
            return await handleClanCommand(interaction, subcommand, users, user, clans);
        }

        if (subcommand === 'profile') {
            const th = TH_LEVELS[user.townHall];
            const embed = new EmbedBuilder()
                .setTitle(`🏰 ${interaction.user.username}'s Base`)
                .setColor('#2ecc71')
                .addFields(
                    { name: '🏛️ Town Hall', value: `Level ${user.townHall}`, inline: true },
                    { name: '🏆 Trophies', value: `${user.trophies || 0}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '🪙 Gold', value: `${Math.floor(user.gold).toLocaleString()} / ${th.maxGold.toLocaleString()}`, inline: true },
                    { name: '💧 Elixir', value: `${Math.floor(user.elixir).toLocaleString()} / ${th.maxElixir.toLocaleString()}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '⚔️ Troops', value: `🗡️ Warriors: ${user.troops.warrior}\n🏹 Archers: ${user.troops.archer}\n🛡️ Brutes: ${user.troops.brute}`, inline: false }
                );
                
            if (user.clan) {
                embed.setDescription(`Clan: **${user.clan}**`);
            }
            if (user.shieldEnds > now) {
                const shieldTime = Math.ceil((user.shieldEnds - now) / 3600000);
                embed.setFooter({ text: `🛡️ Shield active for ${shieldTime} hours` });
            }

            return interaction.reply({ embeds: [embed] });
        }
        
        if (subcommand === 'collect') {
            if (minsElapsed < 1) {
                return interaction.reply({ content: 'You can only collect resources once per minute!', ephemeral: true });
            }
            
            const th = TH_LEVELS[user.townHall];
            const generated = th.productionRate * minsElapsed;
            
            let goldGained = generated;
            let elixirGained = generated;
            
            if (user.gold + goldGained > th.maxGold) goldGained = th.maxGold - user.gold;
            if (user.elixir + elixirGained > th.maxElixir) elixirGained = th.maxElixir - user.elixir;
            
            user.gold += goldGained;
            user.elixir += elixirGained;
            user.lastCollected = now;
            
            saveClashUsers(users);
            
            return interaction.reply({ content: `⛏️ You collected **${Math.floor(goldGained).toLocaleString()} Gold** and **${Math.floor(elixirGained).toLocaleString()} Elixir**!` });
        }
        
        if (subcommand === 'upgrade') {
            const nextLevel = user.townHall + 1;
            const thConfig = TH_LEVELS[nextLevel];
            
            if (!thConfig) {
                return interaction.reply({ content: 'Your Town Hall is already at the maximum level!', ephemeral: true });
            }
            
            if (user.gold < thConfig.upgradeCost) {
                return interaction.reply({ content: `You need **${thConfig.upgradeCost.toLocaleString()} Gold** to upgrade to Town Hall Level ${nextLevel}. You currently have **${Math.floor(user.gold).toLocaleString()} Gold**.`, ephemeral: true });
            }
            
            user.gold -= thConfig.upgradeCost;
            user.townHall = nextLevel;
            saveClashUsers(users);
            
            return interaction.reply({ content: `🎉 Congratulations! Your Town Hall has been upgraded to **Level ${nextLevel}**!` });
        }
        
        if (subcommand === 'train') {
            const troopKey = interaction.options.getString('troop');
            const amount = interaction.options.getInteger('amount');
            const troopConfig = TROOPS[troopKey];
            
            if (amount <= 0) return interaction.reply({ content: 'Amount must be greater than 0.', ephemeral: true });
            
            if (user.townHall < troopConfig.thRequired) {
                return interaction.reply({ content: `You need Town Hall Level ${troopConfig.thRequired} to train ${troopConfig.name}s!`, ephemeral: true });
            }
            
            const totalCost = troopConfig.cost * amount;
            if (user.elixir < totalCost) {
                return interaction.reply({ content: `You need **${totalCost.toLocaleString()} Elixir** to train ${amount} ${troopConfig.name}(s). You only have **${Math.floor(user.elixir).toLocaleString()} Elixir**.`, ephemeral: true });
            }
            
            user.elixir -= totalCost;
            user.troops[troopKey] += amount;
            saveClashUsers(users);
            
            return interaction.reply({ content: `✅ Successfully trained **${amount} ${troopConfig.name}(s)** for **${totalCost.toLocaleString()} Elixir**!` });
        }
        
        if (subcommand === 'attack') {
            const targetUser = interaction.options.getUser('target');
            
            if (targetUser.id === userId) {
                return interaction.reply({ content: 'You cannot attack yourself!', ephemeral: true });
            }
            
            if (targetUser.bot) {
                return interaction.reply({ content: 'You cannot attack bots!', ephemeral: true });
            }
            
            const targetProfile = ensureUser(users, targetUser.id);
            
            if (targetProfile.shieldEnds > now) {
                return interaction.reply({ content: `🛡️ **${targetUser.username}** has an active shield and cannot be attacked right now!`, ephemeral: true });
            }
            
            const attackerOffense = calculateOffense(user);
            const targetDefense = calculateDefense(targetProfile);
            
            if (attackerOffense === 0) {
                return interaction.reply({ content: 'You have no troops to attack with! Train some troops first using `/clash train`.', ephemeral: true });
            }
            
            // Calculate outcome
            let winPercentage = 0;
            if (attackerOffense > targetDefense) {
                winPercentage = Math.min(100, Math.floor((attackerOffense / targetDefense) * 50)); // Up to 100% win
            } else {
                winPercentage = Math.floor((attackerOffense / targetDefense) * 40); // Max 40% if weaker
            }
            
            // Random variance (-10% to +10%)
            winPercentage += Math.floor(Math.random() * 20) - 10;
            if (winPercentage < 0) winPercentage = 0;
            if (winPercentage > 100) winPercentage = 100;
            
            const won = winPercentage > 50;
            
            let goldStolen = 0;
            let elixirStolen = 0;
            let trophiesChange = 0;
            
            if (won) {
                // Steal percentage of their resources based on win percentage
                const stealRate = winPercentage / 200; // max 50%
                goldStolen = Math.floor(targetProfile.gold * stealRate);
                elixirStolen = Math.floor(targetProfile.elixir * stealRate);
                
                // Add to attacker (respect caps)
                const thConfig = TH_LEVELS[user.townHall];
                if (user.gold + goldStolen > thConfig.maxGold) goldStolen = thConfig.maxGold - user.gold;
                if (user.elixir + elixirStolen > thConfig.maxElixir) elixirStolen = thConfig.maxElixir - user.elixir;
                
                user.gold += goldStolen;
                user.elixir += elixirStolen;
                
                // Remove from defender
                targetProfile.gold -= goldStolen;
                targetProfile.elixir -= elixirStolen;
                
                trophiesChange = Math.floor(Math.random() * 15) + 15; // 15-30
                user.trophies = (user.trophies || 0) + trophiesChange;
                targetProfile.trophies = Math.max(0, (targetProfile.trophies || 0) - trophiesChange);
                
                // Give defender a shield for 12 hours
                targetProfile.shieldEnds = now + (12 * 3600000);
            } else {
                trophiesChange = Math.floor(Math.random() * 10) + 10; // 10-20
                user.trophies = Math.max(0, (user.trophies || 0) - trophiesChange);
                targetProfile.trophies = (targetProfile.trophies || 0) + trophiesChange;
            }
            
            // Lose troops
            const troopLossRate = won ? 0.3 : 0.8; // Lose 30% if won, 80% if lost
            for (const key of Object.keys(user.troops)) {
                user.troops[key] = Math.floor(user.troops[key] * (1 - troopLossRate));
            }
            for (const key of Object.keys(targetProfile.troops)) {
                targetProfile.troops[key] = Math.floor(targetProfile.troops[key] * 0.9); // Defender loses 10%
            }
            
            saveClashUsers(users);
            
            const embed = new EmbedBuilder()
                .setTitle(`⚔️ Attack on ${targetUser.username}`)
                .setColor(won ? '#2ecc71' : '#e74c3c')
                .setDescription(`Your Offense: **${attackerOffense}**\nTheir Defense: **${targetDefense}**\nDestruction: **${winPercentage}%**`)
                .addFields(
                    { name: 'Result', value: won ? '🏆 **VICTORY**' : '💀 **DEFEAT**', inline: false }
                );
                
            if (won) {
                embed.addFields(
                    { name: 'Loot Stolen', value: `🪙 ${goldStolen.toLocaleString()} Gold\n💧 ${elixirStolen.toLocaleString()} Elixir`, inline: true },
                    { name: 'Trophies', value: `+${trophiesChange} 🏆`, inline: true }
                );
            } else {
                embed.addFields(
                    { name: 'Trophies', value: `-${trophiesChange} 🏆`, inline: true }
                );
            }
            
            embed.setFooter({ text: 'Troops were lost in the battle.' });
            
            return interaction.reply({ embeds: [embed] });
        }
    }
};

async function handleClanCommand(interaction, subcommand, users, user, clans) {
    if (subcommand === 'create') {
        const clanName = interaction.options.getString('name');
        
        if (user.clan) {
            return interaction.reply({ content: `You are already in a clan (**${user.clan}**)! Leave it first to create a new one.`, ephemeral: true });
        }
        
        if (clans[clanName]) {
            return interaction.reply({ content: `A clan named **${clanName}** already exists!`, ephemeral: true });
        }
        
        if (user.gold < 50000) {
            return interaction.reply({ content: `You need **50,000 Gold** to create a clan! You have **${Math.floor(user.gold).toLocaleString()} Gold**.`, ephemeral: true });
        }
        
        user.gold -= 50000;
        user.clan = clanName;
        
        clans[clanName] = {
            name: clanName,
            leader: interaction.user.id,
            members: [interaction.user.id],
            warWins: 0,
            warLosses: 0
        };
        
        saveClashUsers(users);
        saveClashClans(clans);
        
        return interaction.reply({ content: `🎉 You have successfully created the clan **${clanName}**!` });
    }
    
    if (subcommand === 'join') {
        const clanName = interaction.options.getString('name');
        
        if (user.clan) {
            return interaction.reply({ content: `You are already in a clan (**${user.clan}**)! Leave it first.`, ephemeral: true });
        }
        
        const clan = clans[clanName];
        if (!clan) {
            return interaction.reply({ content: `The clan **${clanName}** does not exist.`, ephemeral: true });
        }
        
        if (clan.members.length >= 50) {
            return interaction.reply({ content: `The clan **${clanName}** is full!`, ephemeral: true });
        }
        
        clan.members.push(interaction.user.id);
        user.clan = clanName;
        
        saveClashUsers(users);
        saveClashClans(clans);
        
        return interaction.reply({ content: `✅ You have successfully joined the clan **${clanName}**!` });
    }
    
    if (subcommand === 'leave') {
        if (!user.clan) {
            return interaction.reply({ content: `You are not in a clan!`, ephemeral: true });
        }
        
        const clanName = user.clan;
        const clan = clans[clanName];
        
        if (clan.leader === interaction.user.id) {
            if (clan.members.length > 1) {
                return interaction.reply({ content: 'You are the leader! You must pass leadership or kick all members before leaving.', ephemeral: true });
            } else {
                // Delete clan if leader is last member
                delete clans[clanName];
            }
        } else {
            clan.members = clan.members.filter(m => m !== interaction.user.id);
        }
        
        user.clan = null;
        
        saveClashUsers(users);
        saveClashClans(clans);
        
        return interaction.reply({ content: `👋 You have left the clan **${clanName}**.` });
    }
    
    if (subcommand === 'info') {
        if (!user.clan) {
            return interaction.reply({ content: `You are not in a clan!`, ephemeral: true });
        }
        
        const clan = clans[user.clan];
        
        let totalTrophies = 0;
        for (const memberId of clan.members) {
            if (users[memberId]) totalTrophies += (users[memberId].trophies || 0);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Clan: ${clan.name}`)
            .setColor('#3498db')
            .addFields(
                { name: 'Leader', value: `<@${clan.leader}>`, inline: true },
                { name: 'Members', value: `${clan.members.length} / 50`, inline: true },
                { name: 'Clan Trophies', value: `🏆 ${totalTrophies}`, inline: true },
                { name: 'War Stats', value: `Wins: ${clan.warWins || 0} | Losses: ${clan.warLosses || 0}`, inline: false }
            );
            
        return interaction.reply({ embeds: [embed] });
    }
    
    if (subcommand === 'war') {
        const targetClanName = interaction.options.getString('target_clan');
        
        if (!user.clan) {
            return interaction.reply({ content: `You must be in a clan to start a war!`, ephemeral: true });
        }
        
        const clan = clans[user.clan];
        if (clan.leader !== interaction.user.id) {
            return interaction.reply({ content: `Only the clan leader can start a war!`, ephemeral: true });
        }
        
        if (clan.name === targetClanName) {
            return interaction.reply({ content: `You cannot war against your own clan!`, ephemeral: true });
        }
        
        const targetClan = clans[targetClanName];
        if (!targetClan) {
            return interaction.reply({ content: `The clan **${targetClanName}** does not exist.`, ephemeral: true });
        }
        
        // Calculate power of both clans
        let clanOffense = 0;
        let clanDefense = 0;
        for (const memberId of clan.members) {
            if (users[memberId]) {
                clanOffense += calculateOffense(users[memberId]);
                clanDefense += calculateDefense(users[memberId]);
            }
        }
        
        let targetOffense = 0;
        let targetDefense = 0;
        for (const memberId of targetClan.members) {
            if (users[memberId]) {
                targetOffense += calculateOffense(users[memberId]);
                targetDefense += calculateDefense(users[memberId]);
            }
        }
        
        if (clanOffense === 0) {
            return interaction.reply({ content: `Your clan has 0 offense! Members need to train troops first.`, ephemeral: true });
        }
        
        // Very simple war logic: Compare average power
        const myPower = clanOffense + clanDefense;
        const enemyPower = targetOffense + targetDefense;
        
        // Base win chance 50%, scaled by power difference
        let winChance = 50;
        if (myPower > enemyPower) {
            winChance += Math.min(45, ((myPower - enemyPower) / enemyPower) * 50);
        } else if (enemyPower > myPower) {
            winChance -= Math.min(45, ((enemyPower - myPower) / myPower) * 50);
        }
        
        // Random variance
        const roll = Math.random() * 100;
        const won = roll <= winChance;
        
        if (won) {
            clan.warWins = (clan.warWins || 0) + 1;
            targetClan.warLosses = (targetClan.warLosses || 0) + 1;
            
            // Give all winning members gold/elixir bonus
            const bonusGold = 25000;
            const bonusElixir = 25000;
            for (const memberId of clan.members) {
                if (users[memberId]) {
                    const th = TH_LEVELS[users[memberId].townHall];
                    users[memberId].gold = Math.min(th.maxGold, users[memberId].gold + bonusGold);
                    users[memberId].elixir = Math.min(th.maxElixir, users[memberId].elixir + bonusElixir);
                }
            }
        } else {
            clan.warLosses = (clan.warLosses || 0) + 1;
            targetClan.warWins = (targetClan.warWins || 0) + 1;
            // No loot for losers
        }
        
        saveClashUsers(users);
        saveClashClans(clans);
        
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Clan War: ${clan.name} vs ${targetClan.name}`)
            .setColor(won ? '#2ecc71' : '#e74c3c')
            .setDescription(`**${clan.name}** Power: ${myPower}\n**${targetClan.name}** Power: ${enemyPower}\n\nWin Chance: ${winChance.toFixed(1)}%\nRoll: ${roll.toFixed(1)}`)
            .addFields(
                { name: 'Result', value: won ? `🏆 **${clan.name} WON THE WAR!**\nMembers received 25,000 Gold & Elixir bonus!` : `💀 **${clan.name} LOST THE WAR!**`, inline: false }
            );
            
        return interaction.reply({ embeds: [embed] });
    }
}
