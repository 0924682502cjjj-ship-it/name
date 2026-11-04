import 'dotenv/config'; // 👈 เรียกใช้งาน dotenv บรรทัดแรกสุด
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, EmbedBuilder, REST, Routes, SlashCommandBuilder } from 'discord.js';
import express from 'express';

// --- สร้าง Web Server เพื่อให้ Render ตรวจจับพอร์ตและรันได้ 24 ชม. ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Intro Bot is running 24/7!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server is running on port ${PORT}`);
});

// --- 🔒 ดึงข้อมูลความปลอดภัยจาก Environment Variables หรือไฟล์ .env ---
const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;         // ห้องสำหรับให้บอทส่งปุ่มแนะนำตัวไปตั้งไว้
const INTRO_LIST_CHANNEL_ID = process.env.INTRO_LIST_CHANNEL_ID; // ห้องสำหรับส่งข้อมูลการ์ดแนะนำตัวไปแสดงผล
const ROLE_TO_GIVE_ID = process.env.ROLE_TO_GIVE_ID;             // ยศที่จะแจกให้สมาชิกอัตโนมัติ

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('clientReady', async () => {
    console.log(`🤖 บอทแนะนำตัวออนไลน์แล้วในชื่อ: ${client.user.tag}`);

    // --- 📌 ระบบส่งปุ่มแนะนำตัวอัตโนมัติทันทีที่บอทออนไลน์ ---
    try {
        const introChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
        if (introChannel) {
            const messages = await introChannel.messages.fetch({ limit: 10 });
            const botMessageExists = messages.some(msg => msg.author.id === client.user.id && msg.components.length > 0);

            if (!botMessageExists) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('open_intro_modal')
                        .setLabel('📝 กดเพื่อกรอกข้อมูลแนะนำตัว')
                        .setStyle(ButtonStyle.Success)
                );

                await introChannel.send({
                    content: '📌 **ยินดีต้อนรับสู่เซิร์ฟเวอร์!** กรุณากดปุ่มด้านล่างเพื่อกรอกข้อมูลแนะนำตัวและรับยศอัตโนมัติครับ',
                    components: [row]
                });
                console.log('✅ ส่งปุ่มแนะนำตัวเข้าห้องอัตโนมัติเรียบร้อยแล้ว!');
            }
        }
    } catch (err) {
        console.error('เกิดข้อผิดพลาดในการส่งปุ่มอัตโนมัติ:', err);
    }

    // ลงทะเบียน Slash Command /setup (สำรอง)
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('สร้างปุ่มแนะนำตัวในช่องนี้ (สำหรับผู้ดูแลระบบ)')
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('ลงทะเบียนคำสั่ง /setup สำเร็จ!');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    
    // 1. เมื่อผู้ใช้พิมพ์คำสั่ง /setup (สำรอง)
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_intro_modal')
                .setLabel('📝 กดเพื่อกรอกข้อมูลแนะนำตัว')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({
            content: '📌 **ยินดีต้อนรับสู่เซิร์ฟเวอร์!** กรุณากดปุ่มด้านล่างเพื่อกรอกข้อมูลแนะนำตัวและรับยศอัตโนมัติครับ',
            components: [row]
        });

        return interaction.reply({ content: '✅ ส่งปุ่มแนะนำตัวเรียบร้อยแล้ว!', ephemeral: true });
    }

    // 2. เมื่อผู้ใช้กดปุ่ม "กรอกข้อมูลแนะนำตัว"
    if (interaction.isButton() && interaction.customId === 'open_intro_modal') {
        const modal = new ModalBuilder()
            .setCustomId('intro_modal_submit')
            .setTitle('แบบฟอร์มแนะนำตัว');

        const nameInput = new TextInputBuilder()
            .setCustomId('user_name')
            .setLabel('ชื่อ')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('เช่น YAM Sterling')
            .setRequired(true);

        const ageInput = new TextInputBuilder()
            .setCustomId('user_age')
            .setLabel('อายุ')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('เช่น 20')
            .setRequired(true);

        const aboutInput = new TextInputBuilder()
            .setCustomId('user_about')
            .setLabel('เพศ')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('ชาย/หญิง')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(ageInput),
            new ActionRowBuilder().addComponents(aboutInput)
        );

        return interaction.showModal(modal);
    }

    // 3. เมื่อกรอกฟอร์มเสร็จและกด Submit -> แจกยศและส่งข้อมูลไปยังห้อง "รายชื่อคนแนะนำตัว"
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'intro_modal_submit') {
        await interaction.reply({ content: '⏳ กำลังบันทึกข้อมูล...', flags: [6] }); // ตอบกลับทันทีกัน Timeout

        const name = interaction.fields.getTextInputValue('user_name');
        const age = interaction.fields.getTextInputValue('user_age');
        const gender = interaction.fields.getTextInputValue('user_about') || 'ไม่ได้ระบุ';
        const member = interaction.member;

        try {
            // แจกยศอัตโนมัติ
            if (ROLE_TO_GIVE_ID) {
                const targetRole = interaction.guild.roles.cache.get(ROLE_TO_GIVE_ID);
                if (targetRole) {
                    await member.roles.add(targetRole);
                } else {
                    console.log('❌ ไม่พบยศที่ระบุในเซิร์ฟเวอร์ กรุณาตรวจสอบ ROLE_TO_GIVE_ID');
                }
            }

            // 🔍 ค้นหาห้องสำหรับแสดงรายชื่อแนะนำตัวจาก INTRO_LIST_CHANNEL_ID
            const introListChannel = interaction.guild.channels.cache.get(INTRO_LIST_CHANNEL_ID);
            
            if (introListChannel) {
                const embed = new EmbedBuilder()
                    .setTitle(`🎉 สมาชิกใหม่แนะนำตัว`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setColor('#00FF7F')
                    .addFields(
                        { name: '👤 ชื่อ', value: name, inline: true },
                        { name: '🎂 อายุ', value: age, inline: true },
                        { name: '⚧️ เพศ', value: gender, inline: true }
                    )
                    .setTimestamp();

                await introListChannel.send({ embeds: [embed] });
            } else {
                console.log(`❌ ไม่พบห้องปลายทางสำหรับแสดงรายชื่อ กรุณาตรวจสอบ INTRO_LIST_CHANNEL_ID`);
            }

            const assignedRole = ROLE_TO_GIVE_ID ? interaction.guild.roles.cache.get(ROLE_TO_GIVE_ID) : null;
            await interaction.editReply({
                content: `✅ แนะนำตัวเรียบร้อยแล้ว! คุณได้รับยศ **${assignedRole ? assignedRole.name : 'สมาชิก'}** และบันทึกข้อมูลเรียบร้อยครับ`
            });

        } catch (error) {
            console.error('เกิดข้อผิดพลาด:', error);
            await interaction.editReply({
                content: '❌ เกิดข้อผิดพลาด! กรุณาตรวจสอบสิทธิ์และลำดับยศของบอทให้อยู่เหนือยศที่จะแจก'
            });
        }
    }
});

client.login(TOKEN);