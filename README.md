# Twitch HLS Player

**English** | [Español](README.es.md)

An extension for Chromium-based browsers such as Chrome, Edge and Brave (Manifest V3). It replaces the Twitch player with one built on [hls.js](https://github.com/video-dev/hls.js) and filters ad segments out of the playlist.

Twitch inserts ads into the stream itself, so blocking domains doesn't work. This extension removes those segments before they reach the player.

## Features

- Plays live channels with hls.js.
- Filters ad segments out of the playlist.
- Quality selector with an automatic option.
- Twitch-style controls: play, volume, clip, quality, theatre mode and fullscreen.
- Remembers quality and volume across channels.

## Installation

1. Download or clone this repository.
2. Open your browser's extensions page: `chrome://extensions`, `edge://extensions` or `brave://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the project folder.

## Limitations

- **The ad wait may remain:** ads aren't seen or heard, but a waiting screen may appear when opening a channel, and mid-stream ads freeze the video until they end.
- **No Twitch session:** the stream is requested anonymously, so subscriber-only channels use the original player, with its ads.
- **Live only:** recorded videos and clips use the original player.
- **Clips and theatre mode:** these rely on the original Twitch player and may fail or, for clips, capture the wrong moment.
- **Fragility:** changes to Twitch's player or playlists can break the extension.

## Privacy

The extension has no server of its own and uses no analytics. It only communicates with Twitch, and your chosen quality and volume are stored in the browser.

## Disclaimer

Personal project, not affiliated with Twitch or Amazon. Twitch is a trademark of its respective owners. Avoiding ads may go against the platform's terms of service: use at your own risk.
