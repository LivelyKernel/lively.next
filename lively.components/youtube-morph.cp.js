import { component, ViewModel, HTMLMorph } from 'lively.morphic';
import { pt } from 'lively.graphics/geometry-2d.js';

class YouTubeEmbedViewModel extends ViewModel {
  static get properties () {
    return {
      videoID: { defaultValue: 'baY3SaIhfl0' },
      maxWidth: { defaultValue: 'unset' }
    };
  }

  async viewDidLoad () {
    // Browsers do not like us importing this in more than once place...
    window.liteYouTubeEmbed ? null : (window.liteYouTubeEmbed = await System.import('lite-youtube-embed'));
    this.view.html = `<lite-youtube videoid="${this.videoID}" width="100%" height="100%" style="max-width: ${this.maxWidth};"></lite-youtube>`;
  }
}

export const YouTubeEmbed = component({
  type: HTMLMorph,
  defaultViewModel: YouTubeEmbedViewModel,
  extent: pt(748, 281)
});
