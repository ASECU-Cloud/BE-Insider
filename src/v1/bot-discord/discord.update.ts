import { Injectable, Logger } from '@nestjs/common';
import { Context, On, Once, ContextOf } from 'necord';
import { Client, VoiceState, MessageReaction, User } from 'discord.js';
import axios from 'axios';

@Injectable()
export class AppUpdate {
  private readonly logger = new Logger(AppUpdate.name);

  public constructor(private readonly client: Client) {}

  @Once('ready')
  public onReady(@Context() [client]: ContextOf<'ready'>) {
    this.logger.log(`Bot logged in as ${client.user.username}`);
  }

  @On('messageReactionAdd')
  public async onReactionAdd(
    @Context() [reaction, user]: [MessageReaction, User],
  ) {
    this.logger.log(`Reaction added: ${reaction.emoji.name} by ${user.tag}`);
    axios.post(process.env.URL_SIA_BE, {
      query: `mutation addInsiderPointFromDiscord($secret: String, $content: String, $discordUsername: String, $type:String) {
        addInsiderPointFromDiscord(secret: $secret, content: $content, discordUsername: $discordUsername, type: $type)
      }
      `,
      variables: {
        secret: process.env.SECRET_AUTH,
        type: 'reactionAdd',
        discordUsername: user.tag,
      },
    });
  }

  @On('messageReactionRemove')
  public async onReactionRemove(
    @Context() [reaction, user]: [MessageReaction, User],
  ) {
    this.logger.log(`Reaction removed: ${reaction.emoji.name} by ${user.tag}`);
    axios.post(process.env.URL_SIA_BE, {
      query: `mutation addInsiderPointFromDiscord($secret: String, $content: String, $discordUsername: String, $type:String) {
        addInsiderPointFromDiscord(secret: $secret, content: $content, discordUsername: $discordUsername, type: $type)
      }
      `,
      variables: {
        secret: process.env.SECRET_AUTH,
        type: 'reactionRemove',
        discordUsername: user.tag,
      },
    });
  }

  @On('messageCreate')
  public async createMessage(@Context() [message]: ContextOf<'messageCreate'>) {
    // Kamu bisa akses properti dari message di sini
    this.logger.log(
      `Received message: ${message.content} from ${message.author.tag} | ${message.channelId}`,
    );
    const member = message.guild.members.cache.get(message.author.id);

    if (message.guild) {
      // Dapatkan member dari message
      if (
        member &&
        member.roles.cache.some((role) => role.name === 'Verified')
      ) {
        this.logger.log(`${message.author.tag} is verified!`);
      } else {
        this.logger.log(`${message.author.tag} is not verified!`);
      }
    }
    const connectedRole = message.guild.roles.cache.find(
      (role) => role.name === 'Connected',
    );
    const notConnectedRole = message.guild.roles.cache.find(
      (role) => role.name === 'Not Connected',
    );

    await axios
      .post(process.env.URL_SIA_BE, {
        query: `mutation addInsiderPointFromDiscord($secret: String, $content: String, $discordUsername: String) {
        addInsiderPointFromDiscord(secret: $secret, content: $content, discordUsername: $discordUsername)
      }
      `,
        variables: {
          secret: process.env.SECRET_AUTH,
          content: message.content,
          discordUsername: message.author.tag,
        },
      })
      .then(async (res) => {
        if (message.author.tag == 'dimarhanung') {
          await message.channel.send(
            `Lagi Debugging Di Prod 👀 ( Berhasil ) ${res.data?.addInsiderPointFromDiscord} ${process.env.URL_SIA_BE}`,
          );

          await message.channel.send(
            JSON.stringify({
              url: process.env.URL_SIA_BE,
              secret: process.env.SECRET_AUTH,
              content: message.content,
              discordUsername: message.author.tag,
              res: JSON.stringify(res.data),
            }),
          );
        }

        await member.roles.add(connectedRole);
        await member.roles.remove(notConnectedRole);
        this.logger.log(`Added role "Connected" to ${message.author.tag}`);
      })
      .catch(async (err) => {
        await member.roles.add(notConnectedRole);
        await member.roles.remove(connectedRole);
        if (message.author.tag == 'dimarhanung') {
          await message.channel.send(
            `Lagi Debugging Di Prod 👀 ( Gagal ) ${err}`,
          );
        }
        this.logger.log(`Remove role "Connected" to ${message.author.tag}`);
      });

    // console.log(message);
  }

  @On('warn')
  public onWarn(@Context() [message]: ContextOf<'warn'>) {
    this.logger.warn(message);
  }

  // pantai member left/join voice chanenl
  @On('voiceStateUpdate')
  public async onVoiceStateUpdate(
    @Context() [before, after]: ContextOf<'voiceStateUpdate'>,
  ) {
    const member = after.member || before.member; // Njumuk objek member sing join/left voice
    const userId = member.id;
    if (before.channel && !after.channel) {
      //left
      this.logger.log(`User ${userId} left a voice channel`);
    } else if (!before.channel && after.channel) {
      //join
      this.logger.log(`User ${userId} joined a voice channel`);
    }
  }
}
