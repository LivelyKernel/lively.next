import { component, ViewModel, HTMLMorph } from 'lively.morphic';
import liteYouTubeEmbed from 'lite-youtube-embed';
import { pt } from 'lively.graphics/geometry-2d.js';

class YouTubeEmbedViewModel extends ViewModel {
  static get properties () {
    return {
      videoID: { defaultValue: 'baY3SaIhfl0' }
    };
  }

  async viewDidLoad () {
    this.view.html = `<lite-youtube videoid="${this.videoID}" width="100%" height="100%" style="max-width: unset; height: 100%;"></lite-youtube>`;
  }
}

export const YouTubeEmbed = component({
  type: HTMLMorph,
  defaultViewModel: YouTubeEmbedViewModel,
  extent: pt(748, 281)
});
