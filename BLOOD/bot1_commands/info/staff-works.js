const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../utils/botemoji.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-works')
        .setDescription('View the responsibilities and guidelines for various staff roles')
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Select the staff role to view')
                .setRequired(true)
                .addChoices(
                    { name: 'Owner', value: 'owner' },
                    { name: 'Admin Works', value: 'admin' },
                    { name: 'Co-Admin Works', value: 'coadmin' },
                    { name: 'Server Moderator', value: 'mod' },
                    { name: 'Trial Moderator', value: 'tmod' },
                    { name: 'Executive Staff', value: 'exec' },
                    { name: 'Server HR', value: 'hr' },
                    { name: 'CWL Staff', value: 'cwl' },
                    { name: 'Welcomer & Assistance Executive', value: 'welcomer' }
                )
        ),

    async execute(interaction) {
        const role = interaction.options.getString('role');
        let title = '';
        let description = '';
        let color = '#2b2d31';

        switch (role) {
            case 'mod':
                title = `${getEmoji('crown')} Server Moderator Responsibilities`;
                color = '#ffaa00';
                description = `
${getEmoji('parrow')} **Sync Verification:** Check Sync message; ensure users have chosen options. If not, tag them and ask them to choose.
${getEmoji('rarroww')} **Monitoring:** Monitor text chats and voice channels actively.
${getEmoji('yarrow')} **Discipline:** Warn or mute rule breakers promptly.
${getEmoji('rarrow')} **Enforcement:** Kick or ban users when necessary (requires admin perms).
${getEmoji('parrow')} **Conflict Resolution:** Resolve member disputes peacefully.
${getEmoji('rarroww')} **Escalation:** Report serious issues directly to admins.
${getEmoji('yarrow')} **Leadership:** Supervise the moderator team and handle complex situations.
${getEmoji('rarroww')} **Training:** Train new staff members.
${getEmoji('parrow')} **Assistance:** Assist admins with staff management.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If an **Admin** or **Co-Admin** (either one or both) grants you permission to carry out a specific action or task, you **must proceed** with it without hesitation.
> ${getEmoji('parrow')} Their authorization is your green light — act on it promptly and responsibly.`;
                break;

            case 'tmod':
                title = `${getEmoji('crown')} Trial Moderator Responsibilities`;
                color = '#f39c12';
                description = `
${getEmoji('parrow')} **Sync Verification:** Check Sync message; ensure users have chosen options. If not, tag them and ask them to choose.
${getEmoji('rarroww')} **Monitoring:** Monitor text chats and voice channels actively.
${getEmoji('yarrow')} **Discipline:** Warn or mute rule breakers promptly.
${getEmoji('rarrow')} **Enforcement:** Kick or ban users when necessary (requires admin perms).
${getEmoji('parrow')} **Conflict Resolution:** Resolve member disputes peacefully.
${getEmoji('rarroww')} **Escalation:** Report serious issues directly to your Server Moderator or Admin.
${getEmoji('yarrow')} **Learning:** Observe and learn from Senior Moderators and Staff.
${getEmoji('rarroww')} **Assistance:** Support the mod team and assist when called upon.
${getEmoji('parrow')} **Conduct:** Maintain professional behaviour at all times — you are on trial; your actions are being observed.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If your **Server Moderator** grants you permission to carry out a specific action or task, you **must proceed** with it.
> ${getEmoji('parrow')} Do not act on your own for anything significant without your Mod's explicit approval first. Your Mod's word is your authorization.`;
                break;

            case 'exec':
                title = `${getEmoji('bluestar')} Executive Staff Responsibilities`;
                color = '#00aaff';
                description = `
${getEmoji('yarrow')} **Ticket Conduct — Before Claiming:**
> ${getEmoji('rarroww')} You are **NOT** supposed to interfere in a ticket that you have not claimed. If another staff member has already taken a ticket, stay out of it unless explicitly tagged/assigned by them.

${getEmoji('yarrow')} **Ticket Conduct — After Claiming:**
> ${getEmoji('rarroww')} Once you have claimed a ticket, **no other staff** may interfere with it unless you tag and assign them yourself.
> ${getEmoji('parrow')} **Exception:** Admins and Server Owners can step into any ticket at any time. If an Admin or Owner joins your active ticket in the staff room, tag them and ask: *"Can I continue with this ticket?"* and proceed based on their reply.

${getEmoji('rarroww')} **Clan Assignment:** Assign recruits based on requirements in the recruitment channel (https://discord.com/channels/1153720899715993681/1503298102860320829). After assigning, you **MUST** update the requirement count using \`/edit-recuirtment clan: <clan>\`. (e.g., if they need 5 TH18s and you assign 2, change the count to 3). Accurate counts are mandatory! After review, use \`/approve\` or \`/decline\`.

${getEmoji('rarroww')} **Alliance & Rep Tickets:** For clans wanting to join the alliance or users applying for Rep, ask them to follow the required steps and tag admins.

${getEmoji('yarrow')} **Help & Query Tickets:** Ask about their problem and try to solve it. If unable to help, tag a Server Moderator or Admin.

${getEmoji('rarroww')} **Staff & Rep Applications:** Ensure applicants have filled all details completely, then ping an Admin.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If a **Server Moderator** grants you permission to carry out a specific action or task, you **must proceed** with it.
> ${getEmoji('parrow')} The Mod's authorization is your green light — act on it accordingly and keep them informed of the outcome.`;
                break;

            case 'hr':
                title = `${getEmoji('mem')} Server HR Responsibilities`;
                color = '#ff55ff';
                description = `
${getEmoji('parrow')} **Recruitment:** Actively recruit new players to join our alliance.
${getEmoji('rarroww')} **Promotion:** Keep an eye out for loyal and active members to recommend for staff positions.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If an **Admin** grants you permission to carry out a specific action or task, you **must proceed** with it.
> ${getEmoji('parrow')} Admin authorization is your direct green light — act on it promptly and report back once done.`;
                break;

            case 'cwl':
                title = `${getEmoji('cwl')} CWL Staff Responsibilities`;
                color = '#ff5555';
                description = `
${getEmoji('yarrow')} **Management:** Efficiently manage the CWL (Clan War Leagues) events and rosters.
${getEmoji('rarroww')} **Rotation:** Assist with clan rotation when requested to ensure smooth operations.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If an **Admin** grants you permission to carry out a specific CWL action, decision, or task, you **must proceed** with it.
> ${getEmoji('parrow')} Do not make significant CWL changes or decisions on your own — always operate under Admin's authorization.`;
                break;

            case 'welcomer':
                title = `${getEmoji('heart')} Welcomer & Assistance Exec Responsibilities`;
                color = '#55ff55';
                description = `
${getEmoji('parrow')} **Welcoming:** Warmly welcome new members in the welcome channel.
${getEmoji('rarroww')} **Assistance:** Provide guidance and help in the assistance channels as soon as new members are added.

${getEmoji('yarrow')} **Permission Authority:**
> ${getEmoji('rarroww')} If a **Server Moderator** grants you permission to carry out a specific action or task related to your role, you **must proceed** with it.
> ${getEmoji('parrow')} The Mod's word is your authorization — act on it and ensure new members receive the best experience.`;
                break;

            case 'admin':
                title = `${getEmoji('crown')} Admin — Works & Responsibilities`;
                color = '#e74c3c';
                description = `
${getEmoji('yarrow')} **Role Overview:**
> Admins are the **primary authority** of the server. Their core duty is to **control, watch, and keep the server running smoothly** — not to simply pass things up to Owners or Retired persons. Handle situations yourself; escalate to the Owner only when absolutely necessary.

${getEmoji('parrow')} **Permission Chain:**
> ${getEmoji('rarroww')} Admins operate **under the Owner's authority**. Do not take major or irreversible actions (e.g., server-wide changes, mass bans, major alliance decisions) without the **Owner's explicit permission or approval**.
> ${getEmoji('yarrow')} For day-to-day server management, Admins have full operational freedom — use it wisely and responsibly.

${getEmoji('rarroww')} **Server Control & Watchdog:**
> ${getEmoji('parrow')} Actively monitor all channels, voice rooms, and staff activity. Be the first to notice and act on problems.
> ${getEmoji('yarrow')} Ensure every department (staff, moderators, executives) is functioning correctly and meeting expectations.
> ${getEmoji('rarroww')} Address server issues, conflicts, or rule violations swiftly — don't wait for them to escalate.

${getEmoji('yarrow')} **Staff Oversight:**
> ${getEmoji('parrow')} Supervise the entire staff team. Guide, correct, and support them.
> ${getEmoji('rarroww')} Promote deserving members, demote or remove underperforming ones (with Owner's awareness for major decisions).
> ${getEmoji('parrow')} Conduct regular check-ins to ensure staff are active and doing their duties properly.

${getEmoji('parrow')} **Ticket & Situation Management:**
> ${getEmoji('rarroww')} Admins may step into any ticket or staff situation at any time. When stepping into an active ticket, the assigned staff member should tag you and ask: *"Can I continue with this ticket?"* — respond clearly so they know whether to proceed or hand it over.
> ${getEmoji('yarrow')} Handle situations that are beyond the capability of Executive Staff or Moderators.

${getEmoji('rarroww')} **Alliance & Server Decisions:**
> ${getEmoji('parrow')} Approve or decline clan applications, Rep requests, and Alliance memberships.
> ${getEmoji('yarrow')} Work with staff to maintain alliance integrity and standards.
> ${getEmoji('rarroww')} Post official announcements, rule updates, and policy changes when authorized.

${getEmoji('yarrow')} **Key Reminder:**
> ${getEmoji('parrow')} You are here to **run the server**, not to redirect every problem to the Owner or Retired staff. Take ownership of your role and handle things proactively.
> ${getEmoji('rarroww')} Always keep the Owner informed of major events, but **do not burden them with things you can handle yourself**.`;
                break;

            case 'coadmin':
                title = `${getEmoji('bluestar')} Co-Admin — Works & Responsibilities`;
                color = '#9b59b6';
                description = `
${getEmoji('yarrow')} **Role Overview:**
> Co-Admins act as a **direct support layer to Admins**. Your role is to assist the Admin in controlling and watching the server — helping things run smoothly from behind the scenes. You are **not an independent authority**; your actions are guided by the Admin.

${getEmoji('parrow')} **Permission Chain:**
> ${getEmoji('rarroww')} Co-Admins operate **strictly under Admin's authority**. You must **not take direct or significant actions** without the Admin's explicit permission or green light.
> ${getEmoji('yarrow')} This includes: staff decisions, disciplinary actions, server changes, alliance approvals, and any action that impacts the server or its members meaningfully.
> ${getEmoji('rarroww')} When unsure, **always check with the Admin first** before acting. It is better to ask and wait than to act without authorization.

${getEmoji('rarroww')} **Day-to-Day Duties:**
> ${getEmoji('parrow')} Monitor channels, voice rooms, and staff activity alongside the Admin.
> ${getEmoji('yarrow')} Keep an eye on ongoing tickets and staff performance. Report concerns to the Admin.
> ${getEmoji('rarroww')} Be present and responsive — your availability and awareness is your biggest contribution.

${getEmoji('yarrow')} **Assisting the Admin:**
> ${getEmoji('parrow')} Carry out tasks and instructions assigned by the Admin promptly and accurately.
> ${getEmoji('rarroww')} Relay information between the Admin and the staff team when needed.
> ${getEmoji('parrow')} Help the Admin stay on top of server happenings by flagging issues early.

${getEmoji('parrow')} **Situation Handling:**
> ${getEmoji('rarroww')} If you encounter a situation that needs action and the Admin is unavailable, assess the urgency. For **minor, clearly safe actions** you may act, but inform the Admin as soon as possible.
> ${getEmoji('yarrow')} For anything significant — wait for the Admin. Do not overstep your authority.
> ${getEmoji('rarroww')} Never make alliance decisions, staff promotions/demotions, or major bans without Admin's prior approval.

${getEmoji('rarroww')} **Ticket Conduct:**
> ${getEmoji('parrow')} Co-Admins, like Admins, may observe and step into any ticket when needed. However, significant decisions within a ticket still require Admin's backing.
> ${getEmoji('yarrow')} When stepping into an active ticket, ask: *"Can I continue with this ticket?"* and coordinate with the Admin if it's a complex case.

${getEmoji('yarrow')} **Key Reminder:**
> ${getEmoji('parrow')} Your power comes from the Admin's trust. Act within that trust — never exceed it.
> ${getEmoji('rarroww')} Think of yourself as the Admin's right hand: **supportive, vigilant, and always in sync** with the Admin's decisions.`;
                break;

            case 'owner':
                title = `${getEmoji('crown')} Owner — Blood Alliance`;
                color = '#FFD700';
                description = `
${getEmoji('parrow')} **The Main Boss — Buddha:**
> ${getEmoji('rarroww')} Above all, we listen to **Buddha** — he is the **main boss** and the highest authority of Blood Alliance. Everything the Owner does is under Buddha's guidance. Buddha's word supersedes everyone in this server.

${getEmoji('yarrow')} **Role Overview:**
> The Owner handles **everything** — all the duties that each staff role does separately, the Owner does it all as one person. Moderating, managing tickets, overseeing staff, handling alliance matters, making decisions — nothing is outside the Owner's responsibility.

${getEmoji('rarroww')} **In Simple Words:**
> ${getEmoji('parrow')} Every job you see in the other roles — Server Moderator, Executive Staff, HR, CWL, Welcomer, Admin, Co-Admin — the Owner does all of that and more, alone or together.
> ${getEmoji('yarrow')} The Owner holds final authority over every person and every decision in the server. No one overrules the Owner except Buddha.
> ${getEmoji('rarroww')} Do not tag or bother the Owner for small things — respect their time. Only reach out when it truly cannot be handled by the team.

${getEmoji('yarrow')} **Owner's Decision is Final:**
> ${getEmoji('parrow')} Whatever decision the Owner makes — it is **final**. There is no appealing, questioning, or going against it.
> ${getEmoji('rarroww')} The Owner always takes the **right and correct decision** for the server and the alliance. Trust the process.
> ${getEmoji('parrow')} Every member and every staff, regardless of rank, must **respect and follow** the Owner's decision without argument.`;
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: 'Nations Alliance — Role Guidelines', iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
